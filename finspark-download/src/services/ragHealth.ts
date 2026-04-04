/**
 * 知识库健康度检查服务 — services/ragHealth.ts
 *
 * 核心职责：
 * 1. 覆盖率检查 (40%) — 知识库是否覆盖常见问题领域
 * 2. 新鲜度检查 (30%) — 内容是否过时 (>90 天未更新)
 * 3. 一致性检查 (30%) — 是否存在冲突/重复内容
 * 4. 综合评分 = 覆盖率×40% + 新鲜度×30% + 一致性×30%
 * 5. 改进建议生成 — 根据检查结果自动生成修复建议
 * 6. 问题追踪 — issue CRUD + 修复状态管理
 * 7. 历史报告管理 — 报告列表 + 趋势对比
 *
 * 关联页面: P.15 知识库健康度检查
 */

// ==================== 类型定义 ====================

export interface HealthReport {
  id: number;
  overall_score: number | null;
  coverage_score: number | null;
  freshness_score: number | null;
  consistency_score: number | null;
  total_documents: number;
  total_chunks: number;
  total_questions_tested: number;
  coverage_details: string;
  freshness_details: string;
  consistency_details: string;
  suggestions: string;
  issues_count: number;
  critical_issues: number;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HealthIssue {
  id: number;
  report_id: number;
  issue_type: string;
  severity: string;
  title: string;
  description: string | null;
  affected_chunk_ids: string;
  affected_document_ids: string;
  suggested_fix: string | null;
  status: string;
  fixed_at: string | null;
  fixed_by: string | null;
  created_at: string;
}

export interface Suggestion {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
}

// ==================== 常量 ====================

const COVERAGE_WEIGHT = 0.4;
const FRESHNESS_WEIGHT = 0.3;
const CONSISTENCY_WEIGHT = 0.3;

const STALE_DAYS = 90;     // 超过 90 天视为过期
const SIMILAR_THRESHOLD = 0.9;  // 内容相似度阈值

const COVERAGE_PROMPT = `你是一个知识库质量审核专家。给定以下知识库内容片段，请评估这些内容对金融投资分析领域常见问题的覆盖度。

知识库内容摘要（随机抽样 {sample_count} 个 Chunk）：
{samples}

请评估以下维度：
1. 这些内容覆盖了哪些主题？
2. 常见金融分析问题中，有哪些主题明显缺失？
3. 你预估的覆盖率分数 (0~100)

请以 JSON 格式返回：
{
  "covered_topics": ["主题1", "主题2"],
  "missing_topics": ["缺失主题1", "缺失主题2"],
  "score": 75,
  "reasoning": "评分理由"
}`;

const CONSISTENCY_PROMPT = `你是一个文本一致性检查专家。请检查以下两段文本是否存在信息冲突。

文本 A：{text_a}
文本 B：{text_b}

请以 JSON 格式返回：
{
  "has_conflict": true/false,
  "conflict_description": "冲突描述（如无冲突则为空字符串）",
  "severity": "low/medium/high"
}`;

// ==================== 服务工厂 ====================

export function createHealthService(
  db: D1Database,
  kv: KVNamespace,
  llmApiKey: string,
  llmBaseUrl: string = 'https://api.vectorengine.ai/v1',
  llmModel: string = 'gpt-4.1',
  llmExtraHeaders: Record<string, string> = {}
) {
  // ---------- LLM 调用 ----------
  async function callLLM(prompt: string, temperature = 0.1): Promise<{ content: string; tokens: number }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...llmExtraHeaders };
    if (llmApiKey !== 'not-needed') {
      headers['Authorization'] = `Bearer ${llmApiKey}`;
    }
    const resp = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: llmModel,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 2000,
      }),
    });
    if (!resp.ok) throw new Error(`LLM call failed (${resp.status})`);
    const data: any = await resp.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    return {
      content,
      tokens: data.usage?.total_tokens || 0,
    };
  }

  function parseJSON<T>(text: string, fallback: T): T {
    try {
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = m ? m[1].trim() : text.trim();
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // ---------- 运行健康检查 ----------
  async function runHealthCheck(createdBy?: string): Promise<{ report_id: number }> {
    // create report record
    const insertRes = await db
      .prepare(
        "INSERT INTO rag_health_reports (status, created_by, started_at) VALUES ('running', ?, datetime('now'))"
      )
      .bind(createdBy || null)
      .run();
    const reportId = insertRes.meta?.last_row_id || 0;

    try {
      // gather stats
      const docCount = await db.prepare('SELECT COUNT(*) as cnt FROM rag_documents').first<{ cnt: number }>();
      const chunkCount = await db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks').first<{ cnt: number }>();
      const totalDocs = docCount?.cnt || 0;
      const totalChunks = chunkCount?.cnt || 0;

      // ====== 1. Coverage Check (40%) ======
      const coverageResult = await checkCoverage(totalChunks);

      // ====== 2. Freshness Check (30%) ======
      const freshnessResult = await checkFreshness();

      // ====== 3. Consistency Check (30%) ======
      const consistencyResult = await checkConsistency();

      // ====== Calculate overall score ======
      const overallScore =
        coverageResult.score * COVERAGE_WEIGHT +
        freshnessResult.score * FRESHNESS_WEIGHT +
        consistencyResult.score * CONSISTENCY_WEIGHT;

      // ====== Generate suggestions ======
      const suggestions = generateSuggestions(coverageResult, freshnessResult, consistencyResult);

      // ====== Create issues ======
      let issuesCount = 0;
      let criticalCount = 0;
      for (const s of suggestions) {
        await db
          .prepare(
            `INSERT INTO rag_health_issues (report_id, issue_type, severity, title, description, suggested_fix, status)
             VALUES (?, ?, ?, ?, ?, ?, 'open')`
          )
          .bind(reportId, s.type, s.severity, s.title, s.description, s.action)
          .run();
        issuesCount++;
        if (s.severity === 'critical') criticalCount++;
      }

      // ====== Update report ======
      await db
        .prepare(
          `UPDATE rag_health_reports SET
            overall_score = ?, coverage_score = ?, freshness_score = ?, consistency_score = ?,
            total_documents = ?, total_chunks = ?, total_questions_tested = ?,
            coverage_details = ?, freshness_details = ?, consistency_details = ?,
            suggestions = ?, issues_count = ?, critical_issues = ?,
            status = 'completed', completed_at = datetime('now')
          WHERE id = ?`
        )
        .bind(
          Math.round(overallScore * 10) / 10,
          Math.round(coverageResult.score * 10) / 10,
          Math.round(freshnessResult.score * 10) / 10,
          Math.round(consistencyResult.score * 10) / 10,
          totalDocs,
          totalChunks,
          coverageResult.tested || 0,
          JSON.stringify(coverageResult.details),
          JSON.stringify(freshnessResult.details),
          JSON.stringify(consistencyResult.details),
          JSON.stringify(suggestions),
          issuesCount,
          criticalCount,
          reportId
        )
        .run();
    } catch (err: any) {
      await db
        .prepare("UPDATE rag_health_reports SET status = 'failed', error_message = ? WHERE id = ?")
        .bind(err.message || 'Unknown error', reportId)
        .run();
    }

    return { report_id: reportId };
  }

  // ---------- Coverage Check ----------
  async function checkCoverage(totalChunks: number): Promise<{
    score: number;
    tested: number;
    details: any;
  }> {
    if (totalChunks === 0) {
      return { score: 0, tested: 0, details: { covered_topics: [], missing_topics: ['No content'], reasoning: 'Knowledge base is empty' } };
    }

    // sample up to 30 chunks
    const sampleSize = Math.min(30, totalChunks);
    const { results } = await db
      .prepare('SELECT id, content FROM rag_chunks ORDER BY RANDOM() LIMIT ?')
      .bind(sampleSize)
      .all();
    const samples = (results || []) as any[];

    const samplesText = samples.map((s: any, i: number) => `[${i + 1}] ${(s.content || '').slice(0, 200)}`).join('\n');
    const prompt = COVERAGE_PROMPT
      .replace('{sample_count}', String(sampleSize))
      .replace('{samples}', samplesText);

    try {
      const { content } = await callLLM(prompt);
      const parsed = parseJSON<any>(content, { covered_topics: [], missing_topics: [], score: 50, reasoning: '' });
      return { score: Math.min(100, Math.max(0, parsed.score)), tested: sampleSize, details: parsed };
    } catch {
      return { score: 50, tested: sampleSize, details: { covered_topics: [], missing_topics: [], score: 50, reasoning: 'LLM analysis failed' } };
    }
  }

  // ---------- Freshness Check ----------
  async function checkFreshness(): Promise<{
    score: number;
    details: any;
  }> {
    const now = new Date();
    const staleDate = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const totalRes = await db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks').first<{ cnt: number }>();
    const total = totalRes?.cnt || 0;
    if (total === 0) return { score: 0, details: { fresh: 0, stale: 0, expired: 0 } };

    const freshRes = await db
      .prepare('SELECT COUNT(*) as cnt FROM rag_chunks WHERE created_at >= ?')
      .bind(staleDate)
      .first<{ cnt: number }>();
    const fresh = freshRes?.cnt || 0;
    const stale = total - fresh;

    // get oldest stale chunks for reporting
    const staleChunks = await db
      .prepare('SELECT id, document_id, created_at FROM rag_chunks WHERE created_at < ? ORDER BY created_at ASC LIMIT 10')
      .bind(staleDate)
      .all();

    const score = total > 0 ? (fresh / total) * 100 : 0;

    return {
      score: Math.min(100, Math.max(0, score)),
      details: {
        fresh,
        stale,
        expired: stale,
        total,
        stale_threshold_days: STALE_DAYS,
        stale_chunks: (staleChunks.results || []).slice(0, 10),
      },
    };
  }

  // ---------- Consistency Check ----------
  async function checkConsistency(): Promise<{
    score: number;
    details: any;
  }> {
    const totalRes = await db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks').first<{ cnt: number }>();
    const total = totalRes?.cnt || 0;
    if (total === 0) return { score: 0, details: { consistent: 0, conflicts: [], duplicates: [] } };

    // detect near-duplicate chunks (simple approach: exact content match)
    const dupRes = await db
      .prepare(
        `SELECT content, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
         FROM rag_chunks GROUP BY content HAVING cnt > 1 LIMIT 20`
      )
      .all();
    const duplicates = (dupRes.results || []) as any[];

    // sample pairs for LLM conflict detection (up to 5 pairs)
    let conflicts: any[] = [];
    if (total >= 2) {
      const samplePairs = await db
        .prepare('SELECT id, content, document_id FROM rag_chunks ORDER BY RANDOM() LIMIT 10')
        .all();
      const chunks = (samplePairs.results || []) as any[];

      for (let i = 0; i < Math.min(chunks.length - 1, 5); i++) {
        try {
          const prompt = CONSISTENCY_PROMPT
            .replace('{text_a}', (chunks[i].content || '').slice(0, 500))
            .replace('{text_b}', (chunks[i + 1].content || '').slice(0, 500));
          const { content } = await callLLM(prompt);
          const parsed = parseJSON<any>(content, { has_conflict: false });
          if (parsed.has_conflict) {
            conflicts.push({
              chunk_a: chunks[i].id,
              chunk_b: chunks[i + 1].id,
              description: parsed.conflict_description,
              severity: parsed.severity,
            });
          }
        } catch {
          // skip on error
        }
      }
    }

    // score: penalize for duplicates and conflicts
    const dupPenalty = Math.min(30, duplicates.length * 5);
    const conflictPenalty = Math.min(30, conflicts.length * 10);
    const score = Math.max(0, 100 - dupPenalty - conflictPenalty);

    return {
      score,
      details: {
        consistent: total - duplicates.length,
        duplicates: duplicates.map((d: any) => ({
          content_preview: (d.content || '').slice(0, 100),
          count: d.cnt,
          ids: d.ids,
        })),
        conflicts,
      },
    };
  }

  // ---------- Generate Suggestions ----------
  function generateSuggestions(
    coverage: { score: number; details: any },
    freshness: { score: number; details: any },
    consistency: { score: number; details: any }
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Coverage suggestions
    if (coverage.score < 60) {
      suggestions.push({
        type: 'coverage_gap',
        severity: coverage.score < 30 ? 'critical' : 'high',
        title: '知识覆盖率不足',
        description: `当前覆盖率 ${Math.round(coverage.score)}%，缺失主题：${(coverage.details.missing_topics || []).join('、')}`,
        action: '建议上传更多文档以覆盖缺失领域，或使用 Chunk 质量增强功能生成补充内容',
      });
    }

    // Freshness suggestions
    if (freshness.score < 70) {
      const staleCount = freshness.details?.stale || 0;
      suggestions.push({
        type: 'stale_content',
        severity: freshness.score < 40 ? 'high' : 'medium',
        title: `${staleCount} 个 Chunk 内容过期`,
        description: `超过 ${STALE_DAYS} 天未更新的内容占比 ${Math.round(100 - freshness.score)}%`,
        action: '建议更新过期文档或重新上传最新版本',
      });
    }

    // Consistency suggestions
    const dups = consistency.details?.duplicates || [];
    if (dups.length > 0) {
      suggestions.push({
        type: 'duplicate',
        severity: dups.length > 5 ? 'high' : 'medium',
        title: `发现 ${dups.length} 组重复内容`,
        description: '存在完全相同的 Chunk，可能导致检索结果冗余',
        action: '建议在知识库浏览器中去重，或使用重建索引功能',
      });
    }

    const conflicts = consistency.details?.conflicts || [];
    if (conflicts.length > 0) {
      suggestions.push({
        type: 'conflict',
        severity: 'high',
        title: `发现 ${conflicts.length} 处内容冲突`,
        description: '不同 Chunk 中存在矛盾的信息，可能影响回答准确性',
        action: '建议人工审核冲突内容并修正',
      });
    }

    return suggestions;
  }

  // ---------- 获取报告 ----------
  async function getReport(reportId: number): Promise<HealthReport | null> {
    return db.prepare('SELECT * FROM rag_health_reports WHERE id = ?').bind(reportId).first<HealthReport>();
  }

  // ---------- 报告列表 ----------
  async function listReports(limit = 10, offset = 0): Promise<{ reports: HealthReport[]; total: number }> {
    const countRes = await db.prepare('SELECT COUNT(*) as cnt FROM rag_health_reports').first<{ cnt: number }>();
    const { results } = await db
      .prepare('SELECT * FROM rag_health_reports ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(limit, offset)
      .all();
    return { reports: (results || []) as unknown as HealthReport[], total: countRes?.cnt || 0 };
  }

  // ---------- 问题列表 ----------
  async function listIssues(reportId: number, params?: { status?: string; severity?: string }): Promise<HealthIssue[]> {
    let query = 'SELECT * FROM rag_health_issues WHERE report_id = ?';
    const binds: any[] = [reportId];
    if (params?.status) {
      query += ' AND status = ?';
      binds.push(params.status);
    }
    if (params?.severity) {
      query += ' AND severity = ?';
      binds.push(params.severity);
    }
    query += ' ORDER BY CASE severity WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END';
    const { results } = await db.prepare(query).bind(...binds).all();
    return (results || []) as unknown as HealthIssue[];
  }

  // ---------- 修复问题 ----------
  async function fixIssue(issueId: number, fixedBy?: string): Promise<void> {
    await db
      .prepare("UPDATE rag_health_issues SET status = 'fixed', fixed_at = datetime('now'), fixed_by = ? WHERE id = ?")
      .bind(fixedBy || null, issueId)
      .run();
  }

  // ---------- 忽略问题 ----------
  async function ignoreIssue(issueId: number): Promise<void> {
    await db.prepare("UPDATE rag_health_issues SET status = 'ignored' WHERE id = ?").bind(issueId).run();
  }

  return {
    runHealthCheck,
    getReport,
    listReports,
    listIssues,
    fixIssue,
    ignoreIssue,
  };
}
