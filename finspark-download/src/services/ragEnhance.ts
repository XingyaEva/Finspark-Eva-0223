/**
 * Chunk 质量增强服务 — services/ragEnhance.ts
 *
 * 核心职责：
 * 1. HyDE 假设性问题生成 — 为 Chunk 生成潜在查询问题，提升检索召回率
 * 2. 摘要增强 — LLM 生成 Chunk 摘要，补充元信息
 * 3. 实体标注 — 自动提取关键词、实体、标签
 * 4. 试运行 — 先处理 3 个 Chunk 预览效果，确认后再批量
 * 5. 批量处理 — 支持按文档级批量增强 + 进度追踪
 *
 * 关联页面: P.3 Chunk 质量增强
 */

// ==================== 类型定义 ====================

export interface EnhanceStrategy {
  type: 'hyde_questions' | 'summary' | 'entity_tagging';
  displayName: string;
  description: string;
}

export interface HydeQuestion {
  id?: number;
  chunk_id: number;
  question: string;
  embedding_stored: boolean;
}

export interface ChunkSummary {
  chunk_id: number;
  summary: string;
  keywords: string[];
}

export interface EntityTag {
  chunk_id: number;
  entities: Array<{ name: string; type: string; mentions: number }>;
  keywords: string[];
  topics: string[];
}

export interface EnhanceDryRunResult {
  chunk_id: number;
  chunk_content_preview: string;
  strategy: string;
  result: HydeQuestion[] | ChunkSummary | EntityTag;
  quality_score: number;       // 0~5 星
  tokens_used: number;
  latency_ms: number;
}

export interface EnhanceBatchProgress {
  task_id: string;
  strategy: string;
  document_id: number | null;
  total_chunks: number;
  processed_chunks: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tokens_used: number;
  started_at: string | null;
  error_message: string | null;
}

export interface EnhanceBatchResult {
  task_id: string;
  strategy: string;
  total_chunks: number;
  success_count: number;
  fail_count: number;
  total_tokens: number;
  total_latency_ms: number;
  per_document: Array<{
    document_id: number;
    document_title: string;
    chunks_enhanced: number;
    status: string;
  }>;
}

// ==================== 常量 ====================

const STRATEGIES: EnhanceStrategy[] = [
  {
    type: 'hyde_questions',
    displayName: 'HyDE 问题改写',
    description: '为每个 Chunk 生成假设性查询问题（3~5 个），构建问题→Chunk 的反向索引，大幅提升检索召回率',
  },
  {
    type: 'summary',
    displayName: '摘要增强',
    description: '为每个 Chunk 生成 50~100 字的结构化摘要 + 关键词列表，辅助粗排和展示',
  },
  {
    type: 'entity_tagging',
    displayName: '自动实体标注',
    description: '自动提取命名实体（公司名/人名/指标/日期）+ 主题标签，支持精确筛选和知识图谱构建',
  },
];

const HYDE_PROMPT = `你是一个专业的信息检索专家。给定以下文本内容，请生成 3~5 个用户可能会提出的自然语言问题。
这些问题应当多样化，涵盖事实性问题、定义类问题、比较类问题等。

文本内容：
{chunk_content}

请以 JSON 数组格式返回，每个元素是一个问题字符串：
["问题1", "问题2", ...]`;

const SUMMARY_PROMPT = `你是一个文本摘要专家。请为以下文本生成一段 50~100 字的结构化摘要和关键词列表。

文本内容：
{chunk_content}

请以 JSON 格式返回：
{
  "summary": "摘要内容",
  "keywords": ["关键词1", "关键词2", ...]
}`;

const ENTITY_PROMPT = `你是一个命名实体识别专家。请从以下文本中提取所有命名实体和主题标签。

文本内容：
{chunk_content}

请以 JSON 格式返回：
{
  "entities": [{"name": "实体名", "type": "类型(PERSON/ORG/LOC/METRIC/DATE/PRODUCT)", "mentions": 1}],
  "keywords": ["关键词1", "关键词2"],
  "topics": ["主题1", "主题2"]
}`;

// ==================== 服务工厂 ====================

export function createEnhanceService(
  db: D1Database,
  kv: KVNamespace,
  llmApiKey: string,
  llmBaseUrl: string = 'https://api.vectorengine.ai/v1',
  llmModel: string = 'gpt-4.1',
  llmExtraHeaders: Record<string, string> = {}
) {
  // ---------- LLM 调用 ----------
  async function callLLM(prompt: string, temperature = 0.7): Promise<{ content: string; tokens: number }> {
    const start = Date.now();
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
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`LLM call failed (${resp.status}): ${errText}`);
    }
    const data: any = await resp.json();
    let content = data.choices?.[0]?.message?.content || '';
    // 处理 Qwen3 thinking tags
    content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    const tokens = (data.usage?.total_tokens as number) || 0;
    return { content, tokens };
  }

  function parseJSON<T>(text: string, fallback: T): T {
    try {
      // extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = jsonMatch ? jsonMatch[1].trim() : text.trim();
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // ---------- 获取策略列表 ----------
  function getStrategies(): EnhanceStrategy[] {
    return STRATEGIES;
  }

  // ---------- HyDE 问题生成 ----------
  async function generateHydeQuestions(chunkId: number, chunkContent: string): Promise<{ questions: string[]; tokens: number; latency_ms: number }> {
    const start = Date.now();
    const prompt = HYDE_PROMPT.replace('{chunk_content}', chunkContent.slice(0, 3000));
    const { content, tokens } = await callLLM(prompt, 0.7);
    const questions = parseJSON<string[]>(content, []);
    const latency_ms = Date.now() - start;
    return { questions, tokens, latency_ms };
  }

  // ---------- 摘要生成 ----------
  async function generateSummary(chunkId: number, chunkContent: string): Promise<{ summary: ChunkSummary; tokens: number; latency_ms: number }> {
    const start = Date.now();
    const prompt = SUMMARY_PROMPT.replace('{chunk_content}', chunkContent.slice(0, 3000));
    const { content, tokens } = await callLLM(prompt, 0.3);
    const parsed = parseJSON<{ summary: string; keywords: string[] }>(content, { summary: '', keywords: [] });
    const latency_ms = Date.now() - start;
    return {
      summary: { chunk_id: chunkId, summary: parsed.summary, keywords: parsed.keywords },
      tokens,
      latency_ms,
    };
  }

  // ---------- 实体标注 ----------
  async function generateEntityTags(chunkId: number, chunkContent: string): Promise<{ tags: EntityTag; tokens: number; latency_ms: number }> {
    const start = Date.now();
    const prompt = ENTITY_PROMPT.replace('{chunk_content}', chunkContent.slice(0, 3000));
    const { content, tokens } = await callLLM(prompt, 0.1);
    const parsed = parseJSON<{ entities: any[]; keywords: string[]; topics: string[] }>(content, {
      entities: [],
      keywords: [],
      topics: [],
    });
    const latency_ms = Date.now() - start;
    return {
      tags: { chunk_id: chunkId, entities: parsed.entities, keywords: parsed.keywords, topics: parsed.topics },
      tokens,
      latency_ms,
    };
  }

  // ---------- 试运行 (3 Chunk) ----------
  async function dryRun(
    strategy: 'hyde_questions' | 'summary' | 'entity_tagging',
    documentId?: number
  ): Promise<EnhanceDryRunResult[]> {
    // Fetch up to 3 chunks for preview
    let query = 'SELECT id, content, document_id FROM rag_chunks';
    const params: any[] = [];
    if (documentId) {
      query += ' WHERE document_id = ?';
      params.push(documentId);
    }
    query += ' ORDER BY RANDOM() LIMIT 3';

    const { results } = await db.prepare(query).bind(...params).all();
    if (!results || results.length === 0) return [];

    const dryResults: EnhanceDryRunResult[] = [];

    for (const chunk of results as any[]) {
      const chunkContent = chunk.content || '';
      let result: any;
      let tokensUsed = 0;
      let latency = 0;
      let qualityScore = 0;

      if (strategy === 'hyde_questions') {
        const r = await generateHydeQuestions(chunk.id, chunkContent);
        result = r.questions.map((q: string) => ({ chunk_id: chunk.id, question: q, embedding_stored: false }));
        tokensUsed = r.tokens;
        latency = r.latency_ms;
        qualityScore = Math.min(5, Math.max(1, r.questions.length));
      } else if (strategy === 'summary') {
        const r = await generateSummary(chunk.id, chunkContent);
        result = r.summary;
        tokensUsed = r.tokens;
        latency = r.latency_ms;
        qualityScore = r.summary.summary.length > 30 ? 4 : 2;
      } else {
        const r = await generateEntityTags(chunk.id, chunkContent);
        result = r.tags;
        tokensUsed = r.tokens;
        latency = r.latency_ms;
        qualityScore = r.tags.entities.length > 0 ? 4 : 2;
      }

      dryResults.push({
        chunk_id: chunk.id,
        chunk_content_preview: chunkContent.slice(0, 200),
        strategy,
        result,
        quality_score: qualityScore,
        tokens_used: tokensUsed,
        latency_ms: latency,
      });
    }

    return dryResults;
  }

  // ---------- 批量增强 ----------
  async function batchEnhance(
    strategy: 'hyde_questions' | 'summary' | 'entity_tagging',
    documentId?: number,
    taskId?: string
  ): Promise<EnhanceBatchResult> {
    const tid = taskId || `enhance_${Date.now()}`;

    // get chunks
    let query = 'SELECT id, content, document_id FROM rag_chunks';
    const params: any[] = [];
    if (documentId) {
      query += ' WHERE document_id = ?';
      params.push(documentId);
    }
    query += ' ORDER BY id';

    const { results } = await db.prepare(query).bind(...params).all();
    const chunks = (results || []) as any[];

    // init progress in KV
    const progress: EnhanceBatchProgress = {
      task_id: tid,
      strategy,
      document_id: documentId || null,
      total_chunks: chunks.length,
      processed_chunks: 0,
      status: 'running',
      tokens_used: 0,
      started_at: new Date().toISOString(),
      error_message: null,
    };
    await kv.put(`enhance:${tid}`, JSON.stringify(progress), { expirationTtl: 3600 });

    let successCount = 0;
    let failCount = 0;
    let totalTokens = 0;
    let totalLatency = 0;
    const docMap = new Map<number, { title: string; enhanced: number; status: string }>();

    for (const chunk of chunks) {
      try {
        if (strategy === 'hyde_questions') {
          const r = await generateHydeQuestions(chunk.id, chunk.content || '');
          // store generated questions
          for (const q of r.questions) {
            await db
              .prepare('INSERT INTO rag_chunk_questions (chunk_id, question, source) VALUES (?, ?, ?)')
              .bind(chunk.id, q, 'hyde')
              .run();
          }
          totalTokens += r.tokens;
          totalLatency += r.latency_ms;
        } else if (strategy === 'summary') {
          const r = await generateSummary(chunk.id, chunk.content || '');
          // store summary as chunk metadata update
          await db
            .prepare('UPDATE rag_chunks SET metadata = json_set(COALESCE(metadata, \'{}\'), \'$.summary\', ?, \'$.keywords\', ?) WHERE id = ?')
            .bind(r.summary.summary, JSON.stringify(r.summary.keywords), chunk.id)
            .run();
          totalTokens += r.tokens;
          totalLatency += r.latency_ms;
        } else {
          const r = await generateEntityTags(chunk.id, chunk.content || '');
          await db
            .prepare('UPDATE rag_chunks SET metadata = json_set(COALESCE(metadata, \'{}\'), \'$.entities\', ?, \'$.topics\', ?) WHERE id = ?')
            .bind(JSON.stringify(r.tags.entities), JSON.stringify(r.tags.topics), chunk.id)
            .run();
          totalTokens += r.tokens;
          totalLatency += r.latency_ms;
        }

        successCount++;
        const entry = docMap.get(chunk.document_id) || { title: `Document #${chunk.document_id}`, enhanced: 0, status: 'success' };
        entry.enhanced++;
        docMap.set(chunk.document_id, entry);
      } catch (err: any) {
        failCount++;
        const entry = docMap.get(chunk.document_id) || { title: `Document #${chunk.document_id}`, enhanced: 0, status: 'partial' };
        entry.status = 'partial';
        docMap.set(chunk.document_id, entry);
      }

      // update progress
      progress.processed_chunks++;
      progress.tokens_used = totalTokens;
      await kv.put(`enhance:${tid}`, JSON.stringify(progress), { expirationTtl: 3600 });
    }

    progress.status = failCount === chunks.length ? 'failed' : 'completed';
    await kv.put(`enhance:${tid}`, JSON.stringify(progress), { expirationTtl: 3600 });

    return {
      task_id: tid,
      strategy,
      total_chunks: chunks.length,
      success_count: successCount,
      fail_count: failCount,
      total_tokens: totalTokens,
      total_latency_ms: totalLatency,
      per_document: Array.from(docMap.entries()).map(([docId, info]) => ({
        document_id: docId,
        document_title: info.title,
        chunks_enhanced: info.enhanced,
        status: info.status,
      })),
    };
  }

  // ---------- 获取增强进度 ----------
  async function getEnhanceProgress(taskId: string): Promise<EnhanceBatchProgress | null> {
    const cached = await kv.get(`enhance:${taskId}`);
    if (!cached) return null;
    return JSON.parse(cached);
  }

  // ---------- 获取 Chunk 增强状态汇总 ----------
  async function getEnhanceStats(documentId?: number): Promise<{
    total_chunks: number;
    with_questions: number;
    with_summary: number;
    with_entities: number;
    question_count: number;
  }> {
    const baseWhere = documentId ? 'WHERE c.document_id = ?' : '';
    const params = documentId ? [documentId] : [];

    const totalRes = await db
      .prepare(`SELECT COUNT(*) as cnt FROM rag_chunks c ${baseWhere}`)
      .bind(...params)
      .first<{ cnt: number }>();

    const qCountRes = await db
      .prepare(
        `SELECT COUNT(DISTINCT cq.chunk_id) as with_q, COUNT(*) as total_q
         FROM rag_chunk_questions cq
         ${documentId ? 'INNER JOIN rag_chunks c ON cq.chunk_id = c.id WHERE c.document_id = ?' : ''}`
      )
      .bind(...params)
      .first<{ with_q: number; total_q: number }>();

    const summaryRes = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM rag_chunks c
         ${baseWhere ? baseWhere + ' AND' : 'WHERE'} json_extract(c.metadata, '$.summary') IS NOT NULL`
      )
      .bind(...params)
      .first<{ cnt: number }>();

    const entityRes = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM rag_chunks c
         ${baseWhere ? baseWhere + ' AND' : 'WHERE'} json_extract(c.metadata, '$.entities') IS NOT NULL`
      )
      .bind(...params)
      .first<{ cnt: number }>();

    return {
      total_chunks: totalRes?.cnt || 0,
      with_questions: qCountRes?.with_q || 0,
      with_summary: summaryRes?.cnt || 0,
      with_entities: entityRes?.cnt || 0,
      question_count: qCountRes?.total_q || 0,
    };
  }

  return {
    getStrategies,
    generateHydeQuestions,
    generateSummary,
    generateEntityTags,
    dryRun,
    batchEnhance,
    getEnhanceProgress,
    getEnhanceStats,
  };
}
