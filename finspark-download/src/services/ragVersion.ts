/**
 * 知识库版本管理服务 — services/ragVersion.ts
 *
 * 核心职责：
 * 1. 版本创建 — 对当前知识库状态创建快照 (文档数/Chunk数/配置/评测)
 * 2. 版本列表 — 时间线展示，支持搜索/过滤
 * 3. 版本 Diff — 对比两个版本之间的 Chunk 变化 (新增/删除/修改)
 * 4. 性能基准 — 关联评测结果，记录版本性能指标
 * 5. A/B 对比 — 两个版本的性能基准横向对比
 * 6. 回归测试 — 针对两个版本运行同一测试集，逐题对比
 * 7. 回滚 — 标记版本状态，支持回滚到指定版本
 *
 * 关联页面: P.16 知识库版本管理
 */

// ==================== 类型定义 ====================

export interface KbVersion {
  id: number;
  version_label: string;
  name: string;
  description: string | null;
  total_documents: number;
  total_chunks: number;
  total_embeddings: number;
  config_snapshot: string;
  chunk_strategy: string | null;
  embedding_model: string | null;
  llm_model: string | null;
  eval_score: number | null;
  eval_details: string;
  tags: string;
  status: string;
  parent_version_id: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionChunk {
  id: number;
  version_id: number;
  chunk_id: number;
  document_id: number | null;
  content_hash: string | null;
  content_preview: string | null;
  metadata: string;
  created_at: string;
}

export interface VersionBenchmark {
  id: number;
  version_id: number;
  test_set_id: number | null;
  evaluation_id: number | null;
  overall_score: number | null;
  exact_match_score: number | null;
  semantic_score: number | null;
  recall_score: number | null;
  citation_score: number | null;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  total_questions: number;
  scores_by_type: string;
  scores_by_difficulty: string;
  config_used: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RegressionTest {
  id: number;
  version_a_id: number;
  version_b_id: number;
  test_set_id: number | null;
  score_diff: number | null;
  improved_count: number;
  degraded_count: number;
  unchanged_count: number;
  comparison_details: string;
  summary: string;
  recommendation: string | null;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DiffResult {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  added_chunks: { chunk_id: number; preview: string }[];
  removed_chunks: { chunk_id: number; preview: string }[];
  modified_chunks: { chunk_id: number; preview_old: string; preview_new: string }[];
}

// ==================== 服务工厂 ====================

export function createVersionService(
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

  // simple hash for content comparison
  function simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const c = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash |= 0; // to 32-bit int
    }
    return hash.toString(16);
  }

  // ---------- 自动生成版本号 ----------
  async function getNextVersionLabel(): Promise<string> {
    const latest = await db
      .prepare("SELECT version_label FROM rag_kb_versions ORDER BY id DESC LIMIT 1")
      .first<{ version_label: string }>();
    if (!latest) return 'v1.0';
    const match = latest.version_label.match(/^v(\d+)\.(\d+)$/);
    if (!match) return 'v1.0';
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    return `v${major}.${minor + 1}`;
  }

  // ---------- 创建版本快照 ----------
  async function createVersion(params: {
    name: string;
    description?: string;
    tags?: string[];
    created_by?: string;
    version_label?: string;
  }): Promise<{ version_id: number; version_label: string }> {
    const versionLabel = params.version_label || await getNextVersionLabel();

    // 采集当前统计信息
    const docCount = await db.prepare('SELECT COUNT(*) as cnt FROM rag_documents').first<{ cnt: number }>();
    const chunkCount = await db.prepare('SELECT COUNT(*) as cnt FROM rag_chunks').first<{ cnt: number }>();
    const totalDocs = docCount?.cnt || 0;
    const totalChunks = chunkCount?.cnt || 0;

    // 采集当前配置快照
    const modelConfigs = await db.prepare('SELECT * FROM rag_model_configs WHERE is_active = 1').all();
    const sysConfigs = await db.prepare('SELECT config_key, config_value FROM rag_system_configs').all();
    const configSnapshot = {
      models: modelConfigs.results || [],
      system: sysConfigs.results || [],
    };

    // 获取嵌入/LLM模型名称
    const embModel = await db.prepare("SELECT model_name FROM rag_model_configs WHERE usage = 'embedding' AND is_active = 1").first<{ model_name: string }>();
    const llmModel = await db.prepare("SELECT model_name FROM rag_model_configs WHERE usage = 'rag_chat' AND is_active = 1").first<{ model_name: string }>();
    const chunkStrategy = await db.prepare("SELECT config_value FROM rag_system_configs WHERE config_key = 'default_chunk_strategy'").first<{ config_value: string }>();

    // 最近评测分数
    const latestEval = await db
      .prepare("SELECT overall_score FROM rag_evaluations WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1")
      .first<{ overall_score: number }>();

    // 插入版本记录
    const insertRes = await db
      .prepare(
        `INSERT INTO rag_kb_versions
          (version_label, name, description, total_documents, total_chunks, total_embeddings,
           config_snapshot, chunk_strategy, embedding_model, llm_model,
           eval_score, tags, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
      )
      .bind(
        versionLabel,
        params.name,
        params.description || null,
        totalDocs,
        totalChunks,
        totalChunks, // embeddings = chunks
        JSON.stringify(configSnapshot),
        chunkStrategy?.config_value || null,
        embModel?.model_name || null,
        llmModel?.model_name || null,
        latestEval?.overall_score || null,
        JSON.stringify(params.tags || []),
        params.created_by || null,
      )
      .run();
    const versionId = insertRes.meta?.last_row_id || 0;

    // 快照当前所有 Chunk (批量, 每次 100)
    const batchSize = 100;
    let offset = 0;
    while (offset < totalChunks) {
      const chunkBatch = await db
        .prepare('SELECT id, document_id, content FROM rag_chunks LIMIT ? OFFSET ?')
        .bind(batchSize, offset)
        .all();
      const rows = (chunkBatch.results || []) as any[];
      if (rows.length === 0) break;

      for (const row of rows) {
        const contentStr = (row.content || '') as string;
        await db
          .prepare(
            `INSERT INTO rag_version_chunks (version_id, chunk_id, document_id, content_hash, content_preview, metadata)
             VALUES (?, ?, ?, ?, ?, '{}')`
          )
          .bind(
            versionId,
            row.id,
            row.document_id || null,
            simpleHash(contentStr),
            contentStr.slice(0, 200),
          )
          .run();
      }
      offset += batchSize;
    }

    return { version_id: versionId, version_label: versionLabel };
  }

  // ---------- 版本列表 ----------
  async function listVersions(params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ versions: KbVersion[]; total: number }> {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;

    let countSql = 'SELECT COUNT(*) as cnt FROM rag_kb_versions WHERE 1=1';
    let querySql = 'SELECT * FROM rag_kb_versions WHERE 1=1';
    const binds: any[] = [];

    if (params?.status) {
      countSql += ' AND status = ?';
      querySql += ' AND status = ?';
      binds.push(params.status);
    }
    if (params?.search) {
      countSql += ' AND (name LIKE ? OR version_label LIKE ? OR description LIKE ?)';
      querySql += ' AND (name LIKE ? OR version_label LIKE ? OR description LIKE ?)';
      const like = `%${params.search}%`;
      binds.push(like, like, like);
    }

    const countRes = await db.prepare(countSql).bind(...binds).first<{ cnt: number }>();

    querySql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const allBinds = [...binds, limit, offset];
    const { results } = await db.prepare(querySql).bind(...allBinds).all();

    return {
      versions: (results || []) as unknown as KbVersion[],
      total: countRes?.cnt || 0,
    };
  }

  // ---------- 获取单个版本 ----------
  async function getVersion(versionId: number): Promise<KbVersion | null> {
    return db
      .prepare('SELECT * FROM rag_kb_versions WHERE id = ?')
      .bind(versionId)
      .first<KbVersion>();
  }

  // ---------- 更新版本 ----------
  async function updateVersion(versionId: number, params: {
    name?: string;
    description?: string;
    tags?: string[];
    status?: string;
  }): Promise<void> {
    const sets: string[] = [];
    const binds: any[] = [];

    if (params.name !== undefined) { sets.push('name = ?'); binds.push(params.name); }
    if (params.description !== undefined) { sets.push('description = ?'); binds.push(params.description); }
    if (params.tags !== undefined) { sets.push('tags = ?'); binds.push(JSON.stringify(params.tags)); }
    if (params.status !== undefined) { sets.push('status = ?'); binds.push(params.status); }

    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    binds.push(versionId);

    await db.prepare(`UPDATE rag_kb_versions SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  // ---------- 删除版本 ----------
  async function deleteVersion(versionId: number): Promise<void> {
    await db.prepare('DELETE FROM rag_version_chunks WHERE version_id = ?').bind(versionId).run();
    await db.prepare('DELETE FROM rag_version_benchmarks WHERE version_id = ?').bind(versionId).run();
    await db.prepare('DELETE FROM rag_regression_tests WHERE version_a_id = ? OR version_b_id = ?').bind(versionId, versionId).run();
    await db.prepare('DELETE FROM rag_kb_versions WHERE id = ?').bind(versionId).run();
  }

  // ---------- 版本 Diff ----------
  async function diffVersions(versionAId: number, versionBId: number): Promise<DiffResult> {
    // Get chunk hashes for both versions
    const chunksA = await db
      .prepare('SELECT chunk_id, content_hash, content_preview FROM rag_version_chunks WHERE version_id = ?')
      .bind(versionAId)
      .all();
    const chunksB = await db
      .prepare('SELECT chunk_id, content_hash, content_preview FROM rag_version_chunks WHERE version_id = ?')
      .bind(versionBId)
      .all();

    const mapA = new Map<number, { hash: string; preview: string }>();
    for (const row of (chunksA.results || []) as any[]) {
      mapA.set(row.chunk_id, { hash: row.content_hash || '', preview: row.content_preview || '' });
    }

    const mapB = new Map<number, { hash: string; preview: string }>();
    for (const row of (chunksB.results || []) as any[]) {
      mapB.set(row.chunk_id, { hash: row.content_hash || '', preview: row.content_preview || '' });
    }

    const added: { chunk_id: number; preview: string }[] = [];
    const removed: { chunk_id: number; preview: string }[] = [];
    const modified: { chunk_id: number; preview_old: string; preview_new: string }[] = [];
    let unchanged = 0;

    // Find added and modified (in B but not in A, or hash differs)
    for (const [chunkId, b] of mapB) {
      const a = mapA.get(chunkId);
      if (!a) {
        added.push({ chunk_id: chunkId, preview: b.preview });
      } else if (a.hash !== b.hash) {
        modified.push({ chunk_id: chunkId, preview_old: a.preview, preview_new: b.preview });
      } else {
        unchanged++;
      }
    }

    // Find removed (in A but not in B)
    for (const [chunkId, a] of mapA) {
      if (!mapB.has(chunkId)) {
        removed.push({ chunk_id: chunkId, preview: a.preview });
      }
    }

    return {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged,
      added_chunks: added.slice(0, 50),
      removed_chunks: removed.slice(0, 50),
      modified_chunks: modified.slice(0, 50),
    };
  }

  // ---------- 添加性能基准 ----------
  async function addBenchmark(params: {
    version_id: number;
    evaluation_id?: number;
    test_set_id?: number;
    overall_score?: number;
    exact_match_score?: number;
    semantic_score?: number;
    recall_score?: number;
    citation_score?: number;
    avg_latency_ms?: number;
    p95_latency_ms?: number;
    total_questions?: number;
    scores_by_type?: any;
    scores_by_difficulty?: any;
    config_used?: any;
    notes?: string;
    created_by?: string;
  }): Promise<{ benchmark_id: number }> {
    // If evaluation_id is provided, auto-populate from evaluation
    let overall = params.overall_score;
    let exact = params.exact_match_score;
    let semantic = params.semantic_score;
    let recall = params.recall_score;
    let citation = params.citation_score;
    let totalQ = params.total_questions || 0;
    let byType = params.scores_by_type || {};
    let byDiff = params.scores_by_difficulty || {};

    if (params.evaluation_id) {
      const evalData = await db
        .prepare('SELECT * FROM rag_evaluations WHERE id = ?')
        .bind(params.evaluation_id)
        .first<any>();
      if (evalData) {
        overall = overall ?? evalData.overall_score;
        exact = exact ?? evalData.exact_match_score;
        semantic = semantic ?? evalData.semantic_score;
        recall = recall ?? evalData.recall_score;
        citation = citation ?? evalData.citation_score;
        totalQ = totalQ || evalData.total_questions || 0;
        try { byType = JSON.parse(evalData.scores_by_type || '{}'); } catch { /* ignore */ }
        try { byDiff = JSON.parse(evalData.scores_by_difficulty || '{}'); } catch { /* ignore */ }
      }
    }

    const res = await db
      .prepare(
        `INSERT INTO rag_version_benchmarks
          (version_id, test_set_id, evaluation_id, overall_score, exact_match_score,
           semantic_score, recall_score, citation_score, avg_latency_ms, p95_latency_ms,
           total_questions, scores_by_type, scores_by_difficulty, config_used, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.version_id,
        params.test_set_id || null,
        params.evaluation_id || null,
        overall ?? null,
        exact ?? null,
        semantic ?? null,
        recall ?? null,
        citation ?? null,
        params.avg_latency_ms ?? null,
        params.p95_latency_ms ?? null,
        totalQ,
        JSON.stringify(byType),
        JSON.stringify(byDiff),
        JSON.stringify(params.config_used || {}),
        params.notes || null,
        params.created_by || null,
      )
      .run();

    // Update version's eval_score
    if (overall != null) {
      await db
        .prepare("UPDATE rag_kb_versions SET eval_score = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(overall, params.version_id)
        .run();
    }

    return { benchmark_id: res.meta?.last_row_id || 0 };
  }

  // ---------- 获取版本基准列表 ----------
  async function listBenchmarks(versionId: number): Promise<VersionBenchmark[]> {
    const { results } = await db
      .prepare('SELECT * FROM rag_version_benchmarks WHERE version_id = ? ORDER BY created_at DESC')
      .bind(versionId)
      .all();
    return (results || []) as unknown as VersionBenchmark[];
  }

  // ---------- A/B 性能对比 ----------
  async function compareVersions(versionAId: number, versionBId: number): Promise<{
    version_a: KbVersion | null;
    version_b: KbVersion | null;
    benchmark_a: VersionBenchmark | null;
    benchmark_b: VersionBenchmark | null;
    diff: DiffResult;
    performance_comparison: {
      overall: { a: number | null; b: number | null; diff: number | null };
      exact_match: { a: number | null; b: number | null; diff: number | null };
      semantic: { a: number | null; b: number | null; diff: number | null };
      recall: { a: number | null; b: number | null; diff: number | null };
      citation: { a: number | null; b: number | null; diff: number | null };
      latency: { a: number | null; b: number | null; diff: number | null };
    };
    recommendation: string;
  }> {
    const verA = await getVersion(versionAId);
    const verB = await getVersion(versionBId);

    // Get latest benchmark for each version
    const benchA = await db
      .prepare('SELECT * FROM rag_version_benchmarks WHERE version_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(versionAId)
      .first<VersionBenchmark>();
    const benchB = await db
      .prepare('SELECT * FROM rag_version_benchmarks WHERE version_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(versionBId)
      .first<VersionBenchmark>();

    const diff = await diffVersions(versionAId, versionBId);

    const calcDiff = (a: number | null | undefined, b: number | null | undefined): number | null => {
      if (a == null || b == null) return null;
      return Math.round((b - a) * 100) / 100;
    };

    const performance_comparison = {
      overall: { a: benchA?.overall_score ?? null, b: benchB?.overall_score ?? null, diff: calcDiff(benchA?.overall_score, benchB?.overall_score) },
      exact_match: { a: benchA?.exact_match_score ?? null, b: benchB?.exact_match_score ?? null, diff: calcDiff(benchA?.exact_match_score, benchB?.exact_match_score) },
      semantic: { a: benchA?.semantic_score ?? null, b: benchB?.semantic_score ?? null, diff: calcDiff(benchA?.semantic_score, benchB?.semantic_score) },
      recall: { a: benchA?.recall_score ?? null, b: benchB?.recall_score ?? null, diff: calcDiff(benchA?.recall_score, benchB?.recall_score) },
      citation: { a: benchA?.citation_score ?? null, b: benchB?.citation_score ?? null, diff: calcDiff(benchA?.citation_score, benchB?.citation_score) },
      latency: { a: benchA?.avg_latency_ms ?? null, b: benchB?.avg_latency_ms ?? null, diff: calcDiff(benchA?.avg_latency_ms, benchB?.avg_latency_ms) },
    };

    // Generate recommendation
    let recommendation = 'neutral';
    const overallDiff = performance_comparison.overall.diff;
    if (overallDiff != null) {
      if (overallDiff > 5) recommendation = 'upgrade';
      else if (overallDiff < -5) recommendation = 'rollback';
    }

    return {
      version_a: verA,
      version_b: verB,
      benchmark_a: benchA,
      benchmark_b: benchB,
      diff,
      performance_comparison,
      recommendation,
    };
  }

  // ---------- 运行回归测试 ----------
  async function runRegressionTest(params: {
    version_a_id: number;
    version_b_id: number;
    test_set_id?: number;
    created_by?: string;
  }): Promise<{ regression_id: number }> {
    // Create regression record
    const insertRes = await db
      .prepare(
        `INSERT INTO rag_regression_tests
          (version_a_id, version_b_id, test_set_id, status, started_at, created_by)
         VALUES (?, ?, ?, 'running', datetime('now'), ?)`
      )
      .bind(params.version_a_id, params.version_b_id, params.test_set_id || null, params.created_by || null)
      .run();
    const regressionId = insertRes.meta?.last_row_id || 0;

    try {
      // Get benchmarks for both versions
      const benchA = await db
        .prepare('SELECT * FROM rag_version_benchmarks WHERE version_id = ? ORDER BY created_at DESC LIMIT 1')
        .bind(params.version_a_id)
        .first<any>();
      const benchB = await db
        .prepare('SELECT * FROM rag_version_benchmarks WHERE version_id = ? ORDER BY created_at DESC LIMIT 1')
        .bind(params.version_b_id)
        .first<any>();

      if (!benchA || !benchB) {
        throw new Error('Both versions need at least one benchmark to run regression test');
      }

      const scoreA = benchA.overall_score || 0;
      const scoreB = benchB.overall_score || 0;
      const scoreDiff = Math.round((scoreB - scoreA) * 100) / 100;

      // Parse detailed results if available from evaluations
      let improved = 0;
      let degraded = 0;
      let unchanged = 0;
      const comparisonDetails: any[] = [];

      if (benchA.evaluation_id && benchB.evaluation_id) {
        // Get per-question results
        const resultsA = await db
          .prepare('SELECT question_id, question_text, score FROM rag_evaluation_results WHERE evaluation_id = ?')
          .bind(benchA.evaluation_id)
          .all();
        const resultsB = await db
          .prepare('SELECT question_id, question_text, score FROM rag_evaluation_results WHERE evaluation_id = ?')
          .bind(benchB.evaluation_id)
          .all();

        const mapA = new Map<number, any>();
        for (const r of (resultsA.results || []) as any[]) {
          mapA.set(r.question_id, r);
        }

        for (const rB of (resultsB.results || []) as any[]) {
          const rA = mapA.get(rB.question_id);
          if (!rA) continue;
          const diff = (rB.score || 0) - (rA.score || 0);
          const direction = diff > 0.05 ? 'improved' : diff < -0.05 ? 'degraded' : 'unchanged';
          if (direction === 'improved') improved++;
          else if (direction === 'degraded') degraded++;
          else unchanged++;
          comparisonDetails.push({
            question_id: rB.question_id,
            question: rB.question_text,
            score_a: rA.score,
            score_b: rB.score,
            diff: Math.round(diff * 100) / 100,
            direction,
          });
        }
      } else {
        // Estimate from scores
        if (scoreDiff > 2) improved = 1;
        else if (scoreDiff < -2) degraded = 1;
        else unchanged = 1;
      }

      // Use LLM to generate summary
      let summary: any = {};
      let recommendation = 'neutral';
      try {
        const prompt = `你是一个知识库版本评估专家。请根据以下回归测试数据给出简要分析和建议。

版本 A 总分: ${scoreA}
版本 B 总分: ${scoreB}
差值: ${scoreDiff}
改善题数: ${improved}
退步题数: ${degraded}
持平题数: ${unchanged}

请以 JSON 格式返回：
{
  "analysis": "简要分析（50字以内）",
  "recommendation": "upgrade / rollback / neutral",
  "key_findings": ["发现1", "发现2"]
}`;
        const { content } = await callLLM(prompt, 0.1);
        summary = parseJSON<any>(content, {});
        recommendation = summary.recommendation || 'neutral';
      } catch {
        recommendation = scoreDiff > 5 ? 'upgrade' : scoreDiff < -5 ? 'rollback' : 'neutral';
        summary = { analysis: `总分差异 ${scoreDiff}`, recommendation, key_findings: [] };
      }

      // Update regression record
      await db
        .prepare(
          `UPDATE rag_regression_tests SET
            score_diff = ?, improved_count = ?, degraded_count = ?, unchanged_count = ?,
            comparison_details = ?, summary = ?, recommendation = ?,
            status = 'completed', completed_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          scoreDiff, improved, degraded, unchanged,
          JSON.stringify(comparisonDetails),
          JSON.stringify(summary),
          recommendation,
          regressionId,
        )
        .run();
    } catch (err: any) {
      await db
        .prepare("UPDATE rag_regression_tests SET status = 'failed', error_message = ? WHERE id = ?")
        .bind(err.message || 'Unknown error', regressionId)
        .run();
    }

    return { regression_id: regressionId };
  }

  // ---------- 获取回归测试 ----------
  async function getRegressionTest(regressionId: number): Promise<RegressionTest | null> {
    return db
      .prepare('SELECT * FROM rag_regression_tests WHERE id = ?')
      .bind(regressionId)
      .first<RegressionTest>();
  }

  // ---------- 回归测试列表 ----------
  async function listRegressionTests(params?: {
    version_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ tests: RegressionTest[]; total: number }> {
    const limit = params?.limit || 20;
    const offset = params?.offset || 0;

    let countSql = 'SELECT COUNT(*) as cnt FROM rag_regression_tests WHERE 1=1';
    let querySql = 'SELECT * FROM rag_regression_tests WHERE 1=1';
    const binds: any[] = [];

    if (params?.version_id) {
      countSql += ' AND (version_a_id = ? OR version_b_id = ?)';
      querySql += ' AND (version_a_id = ? OR version_b_id = ?)';
      binds.push(params.version_id, params.version_id);
    }

    const countRes = await db.prepare(countSql).bind(...binds).first<{ cnt: number }>();
    querySql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const allBinds = [...binds, limit, offset];
    const { results } = await db.prepare(querySql).bind(...allBinds).all();

    return {
      tests: (results || []) as unknown as RegressionTest[],
      total: countRes?.cnt || 0,
    };
  }

  // ---------- 回滚到指定版本 ----------
  async function rollbackToVersion(versionId: number, createdBy?: string): Promise<{ new_version_id: number }> {
    const targetVersion = await getVersion(versionId);
    if (!targetVersion) throw new Error('Target version not found');

    // Create a new version as a rollback marker
    const result = await createVersion({
      name: `Rollback to ${targetVersion.version_label}`,
      description: `Rolled back from current state to ${targetVersion.version_label} (${targetVersion.name})`,
      tags: ['rollback'],
      created_by: createdBy,
    });

    // Mark the new version with parent reference
    await db
      .prepare("UPDATE rag_kb_versions SET parent_version_id = ?, status = 'active' WHERE id = ?")
      .bind(versionId, result.version_id)
      .run();

    // Mark the original version as rolled back
    await db
      .prepare("UPDATE rag_kb_versions SET status = 'rolled_back', updated_at = datetime('now') WHERE id = ?")
      .bind(versionId)
      .run();

    return { new_version_id: result.version_id };
  }

  // ---------- 版本统计总览 ----------
  async function getStats(): Promise<{
    total_versions: number;
    active_versions: number;
    latest_version: KbVersion | null;
    avg_score: number | null;
    total_benchmarks: number;
    total_regressions: number;
  }> {
    const totalRes = await db.prepare('SELECT COUNT(*) as cnt FROM rag_kb_versions').first<{ cnt: number }>();
    const activeRes = await db.prepare("SELECT COUNT(*) as cnt FROM rag_kb_versions WHERE status = 'active'").first<{ cnt: number }>();
    const latestVersion = await db.prepare('SELECT * FROM rag_kb_versions ORDER BY created_at DESC LIMIT 1').first<KbVersion>();
    const avgRes = await db.prepare('SELECT AVG(eval_score) as avg FROM rag_kb_versions WHERE eval_score IS NOT NULL').first<{ avg: number }>();
    const benchCount = await db.prepare('SELECT COUNT(*) as cnt FROM rag_version_benchmarks').first<{ cnt: number }>();
    const regCount = await db.prepare('SELECT COUNT(*) as cnt FROM rag_regression_tests').first<{ cnt: number }>();

    return {
      total_versions: totalRes?.cnt || 0,
      active_versions: activeRes?.cnt || 0,
      latest_version: latestVersion,
      avg_score: avgRes?.avg ? Math.round(avgRes.avg * 10) / 10 : null,
      total_benchmarks: benchCount?.cnt || 0,
      total_regressions: regCount?.cnt || 0,
    };
  }

  return {
    createVersion,
    listVersions,
    getVersion,
    updateVersion,
    deleteVersion,
    diffVersions,
    addBenchmark,
    listBenchmarks,
    compareVersions,
    runRegressionTest,
    getRegressionTest,
    listRegressionTests,
    rollbackToVersion,
    getStats,
  };
}
