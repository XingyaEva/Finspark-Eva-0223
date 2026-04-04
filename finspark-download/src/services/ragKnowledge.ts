/**
 * 知识沉淀服务 — services/ragKnowledge.ts
 *
 * 核心职责：
 * 1. 单次对话知识提取 — 从一条对话中提取 5 类知识 (fact/procedure/definition/rule/insight)
 * 2. 批量对话知识提取 — 按时间范围批量处理历史对话
 * 3. 知识自动过滤 — 过滤掉需求类/问题类/无效内容
 * 4. LLM 知识合并 — 按类型分组，智能合并相似知识条目
 * 5. 审核工作流 — accept/reject + 应用到知识库 (创建新 Chunk + 向量化)
 * 6. 统计面板数据
 *
 * 关联页面: P.14 对话知识沉淀
 */

// ==================== 类型定义 ====================

export interface ConversationKnowledge {
  id: number;
  message_log_id: number | null;
  conversation_id: number | null;
  knowledge_type: string;
  title: string;
  content: string;
  confidence: number;
  source_question: string | null;
  source_answer: string | null;
  status: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  extracted_by: string;
  created_at: string;
}

export interface SettledKnowledge {
  id: number;
  knowledge_type: string;
  title: string;
  content: string;
  merged_from: string;
  source_count: number;
  chunk_id: number | null;
  document_id: number | null;
  applied_at: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeExtractionResult {
  message_log_id: number | null;
  conversation_id: number | null;
  items: Array<{
    knowledge_type: string;
    title: string;
    content: string;
    confidence: number;
  }>;
  tokens_used: number;
  latency_ms: number;
}

export interface MergeResult {
  merged_title: string;
  merged_content: string;
  source_ids: number[];
  source_count: number;
  tokens_used: number;
}

export interface KnowledgeStats {
  total_extracted: number;
  pending_review: number;
  accepted: number;
  rejected: number;
  merged: number;
  settled: number;
  applied: number;
  by_type: Record<string, number>;
}

// ==================== 常量 ====================

const KNOWLEDGE_TYPES = ['fact', 'procedure', 'definition', 'rule', 'insight'];

const EXTRACT_PROMPT = `你是一个知识提取专家。请从以下问答对话中提取有价值的知识条目。

知识类型说明：
- fact: 事实性知识（数据、指标、事件等客观信息）
- procedure: 操作流程（如何做某事的步骤）
- definition: 定义与解释（概念、术语的含义）
- rule: 规则与约束（业务规则、法规要求）
- insight: 洞察与分析（因果关系、趋势判断）

请忽略以下类型的内容：
- 用户的提问本身（需求/问题）
- 无实际内容的礼貌用语
- 高度不确定的推测

问题：{question}
回答：{answer}

请以 JSON 数组格式返回：
[{
  "knowledge_type": "fact|procedure|definition|rule|insight",
  "title": "知识条目标题（20字以内）",
  "content": "知识条目内容（完整描述）",
  "confidence": 0.0~1.0
}]

如果没有可提取的知识，返回空数组 []。`;

const MERGE_PROMPT = `你是一个知识整理专家。请将以下多条相似的知识合并为一条完整、无冗余的知识条目。

待合并的知识条目：
{items}

请以 JSON 格式返回合并后的单条知识：
{
  "title": "合并后的标题",
  "content": "合并后的完整内容（保留所有关键信息，去除重复）"
}`;

// ==================== 服务工厂 ====================

export function createKnowledgeService(
  db: D1Database,
  kv: KVNamespace,
  llmApiKey: string,
  llmBaseUrl: string = 'https://api.vectorengine.ai/v1',
  llmModel: string = 'gpt-4.1',
  llmExtraHeaders: Record<string, string> = {}
) {
  // ---------- LLM 调用 ----------
  async function callLLM(prompt: string, temperature = 0.3): Promise<{ content: string; tokens: number }> {
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
    // 处理 Qwen3 thinking tags
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

  // ---------- 单次知识提取 ----------
  async function extractFromConversation(
    question: string,
    answer: string,
    messageLogId?: number,
    conversationId?: number
  ): Promise<KnowledgeExtractionResult> {
    const start = Date.now();
    const prompt = EXTRACT_PROMPT
      .replace('{question}', question.slice(0, 2000))
      .replace('{answer}', answer.slice(0, 4000));

    const { content, tokens } = await callLLM(prompt, 0.3);
    const items = parseJSON<Array<{ knowledge_type: string; title: string; content: string; confidence: number }>>(content, []);

    // filter valid items
    const validItems = items.filter(
      (item) => KNOWLEDGE_TYPES.includes(item.knowledge_type) && item.title && item.content && item.confidence >= 0.3
    );

    // store to DB
    for (const item of validItems) {
      await db
        .prepare(
          `INSERT INTO rag_conversation_knowledge
           (message_log_id, conversation_id, knowledge_type, title, content, confidence, source_question, source_answer, status, extracted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'llm')`
        )
        .bind(
          messageLogId || null,
          conversationId || null,
          item.knowledge_type,
          item.title,
          item.content,
          item.confidence,
          question.slice(0, 500),
          answer.slice(0, 2000)
        )
        .run();
    }

    return {
      message_log_id: messageLogId || null,
      conversation_id: conversationId || null,
      items: validItems,
      tokens_used: tokens,
      latency_ms: Date.now() - start,
    };
  }

  // ---------- 批量知识提取 ----------
  async function batchExtract(params: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    minAnswerLength?: number;
  }): Promise<{
    total_conversations: number;
    processed: number;
    total_items_extracted: number;
    total_tokens: number;
  }> {
    const { fromDate, toDate, limit = 50, minAnswerLength = 100 } = params;

    let query = `SELECT id, question, answer, conversation_id FROM rag_message_logs WHERE 1=1`;
    const binds: any[] = [];

    if (fromDate) {
      query += ` AND created_at >= ?`;
      binds.push(fromDate);
    }
    if (toDate) {
      query += ` AND created_at <= ?`;
      binds.push(toDate);
    }
    if (minAnswerLength > 0) {
      query += ` AND LENGTH(answer) >= ?`;
      binds.push(minAnswerLength);
    }

    // exclude already extracted
    query += ` AND id NOT IN (SELECT DISTINCT message_log_id FROM rag_conversation_knowledge WHERE message_log_id IS NOT NULL)`;
    query += ` ORDER BY created_at DESC LIMIT ?`;
    binds.push(limit);

    const { results } = await db.prepare(query).bind(...binds).all();
    const logs = (results || []) as any[];

    let totalItems = 0;
    let totalTokens = 0;
    let processed = 0;

    for (const log of logs) {
      try {
        const result = await extractFromConversation(log.question || '', log.answer || '', log.id, log.conversation_id);
        totalItems += result.items.length;
        totalTokens += result.tokens_used;
        processed++;
      } catch {
        // skip on error, continue batch
      }
    }

    return {
      total_conversations: logs.length,
      processed,
      total_items_extracted: totalItems,
      total_tokens: totalTokens,
    };
  }

  // ---------- 知识条目列表 ----------
  async function listExtracted(params: {
    status?: string;
    knowledge_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ConversationKnowledge[]; total: number }> {
    const { status, knowledge_type, limit = 20, offset = 0 } = params;
    let where = 'WHERE 1=1';
    const binds: any[] = [];
    if (status) {
      where += ' AND status = ?';
      binds.push(status);
    }
    if (knowledge_type) {
      where += ' AND knowledge_type = ?';
      binds.push(knowledge_type);
    }

    const countRes = await db.prepare(`SELECT COUNT(*) as cnt FROM rag_conversation_knowledge ${where}`).bind(...binds).first<{ cnt: number }>();
    const total = countRes?.cnt || 0;

    const { results } = await db
      .prepare(`SELECT * FROM rag_conversation_knowledge ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset)
      .all();

    return { items: (results || []) as unknown as ConversationKnowledge[], total };
  }

  // ---------- 审核操作 ----------
  async function reviewKnowledge(id: number, action: 'accept' | 'reject', reviewNote?: string, reviewedBy?: string): Promise<void> {
    const status = action === 'accept' ? 'accepted' : 'rejected';
    await db
      .prepare('UPDATE rag_conversation_knowledge SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime(\'now\') WHERE id = ?')
      .bind(status, reviewNote || null, reviewedBy || null, id)
      .run();
  }

  // ---------- 知识合并 ----------
  async function mergeKnowledge(ids: number[]): Promise<MergeResult> {
    if (ids.length < 2) throw new Error('At least 2 items required for merge');

    const placeholders = ids.map(() => '?').join(',');
    const { results } = await db
      .prepare(`SELECT * FROM rag_conversation_knowledge WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();
    const items = (results || []) as unknown as ConversationKnowledge[];

    if (items.length < 2) throw new Error('Not enough valid items found');

    const itemsText = items.map((i, idx) => `${idx + 1}. [${i.knowledge_type}] ${i.title}: ${i.content}`).join('\n');
    const prompt = MERGE_PROMPT.replace('{items}', itemsText);
    const { content, tokens } = await callLLM(prompt, 0.3);
    const parsed = parseJSON<{ title: string; content: string }>(content, { title: items[0].title, content: items[0].content });

    // create settled knowledge
    await db
      .prepare(
        `INSERT INTO rag_settled_knowledge (knowledge_type, title, content, merged_from, source_count, status)
         VALUES (?, ?, ?, ?, ?, 'pending_apply')`
      )
      .bind(items[0].knowledge_type, parsed.title, parsed.content, JSON.stringify(ids), ids.length)
      .run();

    // mark originals as merged
    await db
      .prepare(`UPDATE rag_conversation_knowledge SET status = 'merged' WHERE id IN (${placeholders})`)
      .bind(...ids)
      .run();

    return {
      merged_title: parsed.title,
      merged_content: parsed.content,
      source_ids: ids,
      source_count: ids.length,
      tokens_used: tokens,
    };
  }

  // ---------- 已沉淀知识列表 ----------
  async function listSettled(params: {
    status?: string;
    knowledge_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SettledKnowledge[]; total: number }> {
    const { status, knowledge_type, limit = 20, offset = 0 } = params;
    let where = 'WHERE 1=1';
    const binds: any[] = [];
    if (status) {
      where += ' AND status = ?';
      binds.push(status);
    }
    if (knowledge_type) {
      where += ' AND knowledge_type = ?';
      binds.push(knowledge_type);
    }

    const countRes = await db.prepare(`SELECT COUNT(*) as cnt FROM rag_settled_knowledge ${where}`).bind(...binds).first<{ cnt: number }>();
    const total = countRes?.cnt || 0;

    const { results } = await db
      .prepare(`SELECT * FROM rag_settled_knowledge ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset)
      .all();

    return { items: (results || []) as unknown as SettledKnowledge[], total };
  }

  // ---------- 应用到知识库 ----------
  async function applyToKnowledgeBase(settledId: number, documentId: number): Promise<{ chunk_id: number }> {
    const settled = await db.prepare('SELECT * FROM rag_settled_knowledge WHERE id = ?').bind(settledId).first<SettledKnowledge>();
    if (!settled) throw new Error('Settled knowledge not found');

    // create a new chunk in the knowledge base
    const insertRes = await db
      .prepare(
        `INSERT INTO rag_chunks (document_id, content, chunk_index, token_count, metadata, created_at)
         VALUES (?, ?, 99999, ?, ?, datetime('now'))`
      )
      .bind(
        documentId,
        `[${settled.knowledge_type}] ${settled.title}\n\n${settled.content}`,
        settled.content.length,
        JSON.stringify({ source: 'knowledge_settle', settled_id: settled.id, knowledge_type: settled.knowledge_type })
      )
      .run();

    const chunkId = insertRes.meta?.last_row_id || 0;

    // update settled record
    await db
      .prepare("UPDATE rag_settled_knowledge SET status = 'applied', chunk_id = ?, document_id = ?, applied_at = datetime('now') WHERE id = ?")
      .bind(chunkId, documentId, settledId)
      .run();

    return { chunk_id: chunkId };
  }

  // ---------- 统计面板 ----------
  async function getStats(): Promise<KnowledgeStats> {
    const extracted = await db.prepare("SELECT status, COUNT(*) as cnt FROM rag_conversation_knowledge GROUP BY status").all();
    const byType = await db.prepare("SELECT knowledge_type, COUNT(*) as cnt FROM rag_conversation_knowledge GROUP BY knowledge_type").all();
    const settled = await db.prepare("SELECT status, COUNT(*) as cnt FROM rag_settled_knowledge GROUP BY status").all();

    const statusMap: Record<string, number> = {};
    for (const r of (extracted.results || []) as any[]) statusMap[r.status] = r.cnt;

    const typeMap: Record<string, number> = {};
    for (const r of (byType.results || []) as any[]) typeMap[r.knowledge_type] = r.cnt;

    const settledMap: Record<string, number> = {};
    for (const r of (settled.results || []) as any[]) settledMap[r.status] = r.cnt;

    return {
      total_extracted: Object.values(statusMap).reduce((a, b) => a + b, 0),
      pending_review: statusMap['pending'] || 0,
      accepted: statusMap['accepted'] || 0,
      rejected: statusMap['rejected'] || 0,
      merged: statusMap['merged'] || 0,
      settled: Object.values(settledMap).reduce((a, b) => a + b, 0),
      applied: settledMap['applied'] || 0,
      by_type: typeMap,
    };
  }

  return {
    extractFromConversation,
    batchExtract,
    listExtracted,
    reviewKnowledge,
    mergeKnowledge,
    listSettled,
    applyToKnowledgeBase,
    getStats,
  };
}
