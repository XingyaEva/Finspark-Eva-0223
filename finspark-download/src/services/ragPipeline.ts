/**
 * Pipeline 编排服务 — services/ragPipeline.ts
 *
 * 核心职责：
 * 1. 增强版 RAG 问答编排：意图识别 → 并行检索(向量+BM25) → 去重 → 可选LLM重排 → LLM生成 → 日志
 * 2. 文档处理 Pipeline 任务管理（进度追踪）
 * 3. 问答消息详细日志记录（rag_message_logs）
 *
 * LLM 重排默认关闭（用户确认：先搭建完平台测试后再决定是否开启）
 */

import type { RAGService, ChunkWithScore } from './rag';
import type { BM25Service, BM25SearchResult } from './ragBm25';
import type { IntentService, IntentResult } from './ragIntent';
import type { AutoSyncService } from './ragAutoSync';
import type { GpuProvider } from './ragGpuProvider';

// ==================== 类型定义 ====================

export interface EnhancedRAGConfig {
  enableBm25: boolean;          // 是否启用 BM25（默认 true）
  enableRerank: boolean;        // 是否启用 LLM 重排（默认 false）
  topK: number;                 // 最终返回的 Chunk 数量（默认 5）
  minScore: number;             // 最低分阈值（默认 0.25）
  rerankWeight: number;         // LLM 重排权重 0-1（默认 0.7）
  documentIds?: number[];
  stockCode?: string;
}

export const DEFAULT_ENHANCED_CONFIG: EnhancedRAGConfig = {
  enableBm25: true,
  enableRerank: false,          // 默认关闭 LLM 重排
  topK: 5,
  minScore: 0.25,
  rerankWeight: 0.7,
};

export interface EnhancedSource {
  documentId: number;
  documentTitle: string;
  chunkContent: string;
  relevanceScore: number;
  chunkId: number;
  pageRange?: string;
  heading?: string;
  chunkType?: string;
  sourceFile?: string;
  source: 'vector' | 'bm25' | 'both';
}

export interface PipelineMetrics {
  intent: IntentResult;
  vectorResults: number;
  bm25Results: number;
  dedupCount: number;
  rerankApplied: boolean;
  totalLatencyMs: number;
}

export interface EnhancedRAGResult {
  answer: string;
  sources: EnhancedSource[];
  sessionId: string;
  pipeline: PipelineMetrics;
  messageLogId: number;
}

export interface PipelineTaskProgress {
  taskId: number;
  taskType: string;
  status: string;
  totalSteps: number;
  completedSteps: number;
  steps: Array<{
    name: string;
    order: number;
    status: string;
    durationMs?: number;
    outputData?: Record<string, unknown>;
  }>;
  error?: string;
}

// ==================== Pipeline Service ====================

export class PipelineService {
  private db: D1Database;
  private kv: KVNamespace;
  private ragService: RAGService;
  private bm25Service: BM25Service;
  private intentService: IntentService;
  private apiKey: string;
  private autoSyncService?: AutoSyncService;
  private gpuProvider?: GpuProvider;

  constructor(
    db: D1Database,
    kv: KVNamespace,
    ragService: RAGService,
    bm25Service: BM25Service,
    intentService: IntentService,
    apiKey: string,
    autoSyncService?: AutoSyncService,
    gpuProvider?: GpuProvider
  ) {
    this.db = db;
    this.kv = kv;
    this.ragService = ragService;
    this.bm25Service = bm25Service;
    this.intentService = intentService;
    this.apiKey = apiKey;
    this.autoSyncService = autoSyncService;
    this.gpuProvider = gpuProvider;
  }

  // ==================== 增强版 RAG 问答 ====================

  /**
   * 增强版 RAG 问答 Pipeline
   *
   * 流程：
   * ① 意图识别 → ② 并行检索 [向量 || BM25] → ③ 去重合并
   * → ④ LLM 重排（可选）→ ⑤ LLM 生成回答 → ⑥ 保存日志
   */
  async enhancedQuery(params: {
    question: string;
    sessionId?: string;
    config?: Partial<EnhancedRAGConfig>;
    conversationHistory?: Array<{ role: string; content: string }>;
    userId?: number;
  }): Promise<EnhancedRAGResult> {
    const totalStart = Date.now();
    const config = { ...DEFAULT_ENHANCED_CONFIG, ...params.config };
    const sessionId =
      params.sessionId ||
      `rag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let intentResult: IntentResult | null = null;
    let vectorResults: ChunkWithScore[] = [];
    let bm25Results: BM25SearchResult[] = [];
    let vectorLatency = 0;
    let bm25Latency = 0;
    let rerankLatency = 0;
    let llmLatency = 0;
    let llmInputTokens = 0;
    let llmOutputTokens = 0;
    let messageLogId = 0;

    try {
      // ① 意图识别
      intentResult = await this.intentService.classifyAndRewrite(params.question);
      const searchQuery = intentResult.rewrittenQuery || params.question;

      // ⓪ 自动同步检查：如果配置了 stockCode，检查是否需要同步财报数据
      let syncHint = '';
      if (this.autoSyncService && config.stockCode) {
        try {
          const syncResult = await this.autoSyncService.ensureReportsAvailable(
            config.stockCode,
            undefined,
            { autoSyncEnabled: true }
          );
          if (syncResult.syncTriggered) {
            syncHint = `\n【注意】该股票(${config.stockCode})的财报数据正在异步同步中，当前回答可能基于有限的数据。请稍后重新查询以获得更完整的回答。`;
            console.log(`[Pipeline] Auto-sync triggered for ${config.stockCode}, tasks: ${syncResult.newTaskIds.join(', ')}`);
          } else if (syncResult.status.recommendation === 'syncing') {
            syncHint = `\n【注意】该股票(${config.stockCode})的财报数据正在同步中（${syncResult.status.activeTasks.length} 个任务），请稍后查询。`;
          }
        } catch (syncError) {
          console.warn('[Pipeline] Auto-sync check failed:', syncError);
          // 同步检查失败不影响主流程
        }
      }

      // ② 并行检索（向量 + BM25）
      const retrievalPromises: Array<Promise<void>> = [];

      // 向量检索
      const vectorStart = Date.now();
      retrievalPromises.push(
        this.ragService
          .searchSimilar(searchQuery, {
            topK: config.topK * 2, // 多取一些再合并
            minScore: config.minScore,
            stockCode: config.stockCode,
            documentIds: config.documentIds,
          })
          .then((results) => {
            vectorResults = results;
            vectorLatency = Date.now() - vectorStart;
          })
      );

      // BM25 检索（如果启用）
      if (config.enableBm25) {
        const bm25Start = Date.now();
        retrievalPromises.push(
          this.bm25Service
            .search(searchQuery, {
              topK: config.topK * 2,
              documentIds: config.documentIds,
              stockCode: config.stockCode,
            })
            .then((results) => {
              bm25Results = results;
              bm25Latency = Date.now() - bm25Start;
            })
        );
      }

      await Promise.all(retrievalPromises);

      // ③ 去重合并
      const merged = this.mergeAndDedup(vectorResults, bm25Results);

      // ④ 重排（可选：优先用专用 BGE-Reranker，回退用 LLM 重排）
      let finalChunks = merged;
      let rerankModel: string | null = null;
      if (config.enableRerank && merged.length > 0) {
        const rerankStart = Date.now();
        
        // 检查是否有专用 GPU Reranker 可用
        const rerankerConfig = this.gpuProvider?.getRerankerConfig();
        if (rerankerConfig?.type === 'dedicated') {
          // 使用专用 BGE-Reranker（更快、更准）
          try {
            finalChunks = await this.dedicatedRerank(searchQuery, merged, config.rerankWeight);
            rerankModel = 'bge-reranker-v2-m3';
          } catch (e) {
            console.warn('[Pipeline] Dedicated reranker failed, falling back to LLM rerank:', e);
            finalChunks = await this.llmRerank(searchQuery, merged, config.rerankWeight);
            rerankModel = 'gpt-4.1-mini';
          }
        } else {
          // LLM 重排（云端模式）
          finalChunks = await this.llmRerank(searchQuery, merged, config.rerankWeight);
          rerankModel = 'gpt-4.1-mini';
        }
        
        rerankLatency = Date.now() - rerankStart;
      }

      // 取 Top-K
      finalChunks = finalChunks.slice(0, config.topK);

      // ⑤ LLM 生成回答
      const llmStart = Date.now();
      const llmResponse = await this.generateAnswer(
        params.question,
        searchQuery,
        finalChunks,
        params.conversationHistory || [],
        intentResult
      );
      llmLatency = Date.now() - llmStart;
      llmInputTokens = llmResponse.inputTokens;
      llmOutputTokens = llmResponse.outputTokens;

      // 构造来源列表
      const sources: EnhancedSource[] = finalChunks.map((c) => ({
        documentId: c.documentId,
        documentTitle: c.documentTitle || `文档${c.documentId}`,
        chunkContent:
          c.content.slice(0, 200) + (c.content.length > 200 ? '...' : ''),
        relevanceScore: Math.round(c.score * 1000) / 1000,
        chunkId: c.chunkId,
        pageRange: c.pageRange,
        heading: c.heading,
        chunkType: c.chunkType,
        sourceFile: c.sourceFile,
        source: c.source,
      }));

      // ⑥ 保存对话记录到 rag_conversations
      try {
        await this.db
          .prepare(
            `INSERT INTO rag_conversations (user_id, session_id, role, content, sources) 
             VALUES (?, ?, 'user', ?, '[]')`
          )
          .bind(params.userId || null, sessionId, params.question)
          .run();

        await this.db
          .prepare(
            `INSERT INTO rag_conversations (user_id, session_id, role, content, sources) 
             VALUES (?, ?, 'assistant', ?, ?)`
          )
          .bind(
            params.userId || null,
            sessionId,
            llmResponse.answer,
            JSON.stringify(sources)
          )
          .run();
      } catch (e) {
        console.error('[Pipeline] Failed to save conversation:', e);
      }

      // ⑥ 保存详细 Pipeline 日志
      const totalLatencyMs = Date.now() - totalStart;
      messageLogId = await this.saveMessageLog({
        sessionId,
        userQuery: params.question,
        rewrittenQuery: intentResult.rewrittenQuery,
        intent: intentResult,
        vectorResultsCount: vectorResults.length,
        vectorTopScore: vectorResults[0]?.score || 0,
        vectorLatencyMs: vectorLatency,
        bm25ResultsCount: bm25Results.length,
        bm25TopScore: bm25Results[0]?.score || 0,
        bm25LatencyMs: bm25Latency,
        dedupCount: merged.length,
        rerankEnabled: config.enableRerank,
        rerankInputCount: config.enableRerank ? merged.length : 0,
        rerankOutputCount: config.enableRerank ? finalChunks.length : 0,
        rerankModel: rerankModel,
        rerankLatencyMs: rerankLatency,
        llmModel: this.gpuProvider?.getLlmConfig('answer')?.model || 'gpt-4.1',
        llmInputTokens,
        llmOutputTokens,
        llmLatencyMs: llmLatency,
        llmTemperature: 0.3,
        sources,
        totalLatencyMs,
        status: 'success',
      });

      return {
        answer: syncHint ? llmResponse.answer + syncHint : llmResponse.answer,
        sources,
        sessionId,
        pipeline: {
          intent: intentResult,
          vectorResults: vectorResults.length,
          bm25Results: bm25Results.length,
          dedupCount: merged.length,
          rerankApplied: config.enableRerank,
          totalLatencyMs,
        },
        messageLogId,
      };
    } catch (error) {
      const totalLatencyMs = Date.now() - totalStart;
      const errorMsg =
        error instanceof Error ? error.message : 'Pipeline execution failed';

      // 保存错误日志
      try {
        await this.saveMessageLog({
          sessionId,
          userQuery: params.question,
          rewrittenQuery: intentResult?.rewrittenQuery || null,
          intent: intentResult || {
            type: 'string',
            confidence: 0,
            entities: [],
            rewrittenQuery: null,
            latencyMs: 0,
          },
          vectorResultsCount: vectorResults.length,
          vectorTopScore: 0,
          vectorLatencyMs: vectorLatency,
          bm25ResultsCount: bm25Results.length,
          bm25TopScore: 0,
          bm25LatencyMs: bm25Latency,
          dedupCount: 0,
          rerankEnabled: false,
          rerankInputCount: 0,
          rerankOutputCount: 0,
          rerankModel: null,
          rerankLatencyMs: 0,
          llmModel: this.gpuProvider?.getLlmConfig('answer')?.model || 'gpt-4.1',
          llmInputTokens: 0,
          llmOutputTokens: 0,
          llmLatencyMs: llmLatency,
          llmTemperature: 0.3,
          sources: [],
          totalLatencyMs,
          status: 'error',
          errorMessage: errorMsg,
        });
      } catch (logError) {
        console.error('[Pipeline] Failed to save error log:', logError);
      }

      throw error;
    }
  }

  // ==================== 去重合并 ====================

  /**
   * 合并向量检索和 BM25 检索结果，按 chunk_id 去重
   * 同一个 Chunk 出现在两种检索中时，取最高分并标记 source='both'
   */
  private mergeAndDedup(
    vectorResults: ChunkWithScore[],
    bm25Results: BM25SearchResult[]
  ): Array<{
    chunkId: number;
    documentId: number;
    documentTitle: string;
    content: string;
    score: number;
    pageRange?: string;
    heading?: string;
    chunkType?: string;
    sourceFile?: string;
    source: 'vector' | 'bm25' | 'both';
  }> {
    const mergedMap = new Map<
      number,
      {
        chunkId: number;
        documentId: number;
        documentTitle: string;
        content: string;
        score: number;
        pageRange?: string;
        heading?: string;
        chunkType?: string;
        sourceFile?: string;
        source: 'vector' | 'bm25' | 'both';
      }
    >();

    // 添加向量检索结果
    for (const vr of vectorResults) {
      const chunkId = vr.chunk.id!;
      const meta = (vr.chunk.metadata || {}) as Record<string, any>;
      mergedMap.set(chunkId, {
        chunkId,
        documentId: vr.documentId,
        documentTitle: vr.documentTitle || '',
        content: vr.chunk.content,
        score: vr.score,
        pageRange: meta.pageStart ? `${meta.pageStart}${meta.pageEnd && meta.pageEnd !== meta.pageStart ? '-' + meta.pageEnd : ''}` : meta.pageRange,
        heading: meta.heading,
        chunkType: meta.chunkType,
        sourceFile: meta.sourceFile,
        source: 'vector',
      });
    }

    // 合并 BM25 检索结果
    for (const br of bm25Results) {
      const existing = mergedMap.get(br.chunkId);
      if (existing) {
        // 同一 Chunk 在两种检索中都出现
        existing.source = 'both';
        existing.score = Math.max(existing.score, this.normalizeBM25Score(br.score));
      } else {
        mergedMap.set(br.chunkId, {
          chunkId: br.chunkId,
          documentId: br.documentId,
          documentTitle: '', // BM25 结果没有 title，后续可以补充
          content: br.content,
          score: this.normalizeBM25Score(br.score),
          source: 'bm25',
        });
      }
    }

    // 按分数排序
    return [...mergedMap.values()].sort((a, b) => b.score - a.score);
  }

  /**
   * 将 BM25 分数归一化到 0-1 范围（与向量余弦相似度可比）
   * 使用 sigmoid 变换：1 / (1 + e^(-score/5))
   */
  private normalizeBM25Score(rawScore: number): number {
    return 1 / (1 + Math.exp(-rawScore / 5));
  }

  // ==================== 专用 Reranker 重排 ====================

  /**
   * 使用专用 BGE-Reranker-v2-m3 进行文档重排
   * 优势：比 LLM 重排快 20-50x（<50ms vs 1-2s），更精准
   */
  private async dedicatedRerank(
    query: string,
    chunks: Array<{
      chunkId: number;
      documentId: number;
      documentTitle: string;
      content: string;
      score: number;
      pageRange?: string;
      heading?: string;
      chunkType?: string;
      sourceFile?: string;
      source: 'vector' | 'bm25' | 'both';
    }>,
    rerankWeight: number
  ): Promise<typeof chunks> {
    const toRerank = chunks.slice(0, 10);
    const documents = toRerank.map(c => c.content.slice(0, 500));

    const results = await this.gpuProvider!.dedicatedRerank(query, documents, toRerank.length);

    // 融合 Reranker 分数和原始分数
    return results.map(r => {
      const original = toRerank[r.index];
      return {
        ...original,
        score: rerankWeight * r.score + (1 - rerankWeight) * original.score,
      };
    }).sort((a, b) => b.score - a.score);
  }

  // ==================== LLM 重排 ====================

  /**
   * LLM 重排：对候选 Chunk 逐一评估相关性（Cloud 模式回退方案）
   * 最终分数 = rerankWeight * llmScore/10 + (1-rerankWeight) * originalScore
   */
  private async llmRerank(
    query: string,
    chunks: Array<{
      chunkId: number;
      documentId: number;
      documentTitle: string;
      content: string;
      score: number;
      pageRange?: string;
      heading?: string;
      chunkType?: string;
      sourceFile?: string;
      source: 'vector' | 'bm25' | 'both';
    }>,
    rerankWeight: number
  ): Promise<typeof chunks> {
    // 限制重排数量（避免 token 消耗过大）
    const toRerank = chunks.slice(0, 10);

    // 获取 LLM 配置用于重排（如果 GPU 可用则用 GPU，否则用 Cloud）
    const rerankLlmConfig = this.gpuProvider?.getLlmConfig('rerank') || {
      baseUrl: 'https://api.vectorengine.ai/v1',
      apiKey: this.apiKey,
      model: 'gpt-4.1-mini',
      provider: 'cloud' as const,
    };

    const rerankHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...('extraHeaders' in rerankLlmConfig ? (rerankLlmConfig as any).extraHeaders || {} : {}),
    };
    if (rerankLlmConfig.apiKey !== 'not-needed') {
      rerankHeaders['Authorization'] = `Bearer ${rerankLlmConfig.apiKey}`;
    }

    const rerankPromises = toRerank.map(async (chunk) => {
      try {
        const response = await fetch(
          `${rerankLlmConfig.baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers: rerankHeaders,
            body: JSON.stringify({
              model: rerankLlmConfig.model,
              messages: [
                {
                  role: 'system',
                  content:
                    '你是文档相关性评估专家。给定问题和文档片段，评估相关性（0-10分）。仅返回 JSON: {"score": N, "reason": "..."}',
                },
                {
                  role: 'user',
                  content: `问题：${query}\n\n文档片段：${chunk.content.slice(0, 500)}`,
                },
              ],
              temperature: 0.1,
              max_tokens: 100,
              // Qwen3 SGLang: 关闭 thinking 模式 (chat_template_kwargs 在请求体顶层)
              ...(rerankLlmConfig.provider === 'gpu' ? { chat_template_kwargs: { enable_thinking: false } } : {}),
            }),
          }
        );

        if (!response.ok) return chunk;

        const result = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        let content = result.choices?.[0]?.message?.content || '';
        // 处理 Qwen3 thinking tags（兜底）
        content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
        const parsed = JSON.parse(content);
        const llmScore = Math.max(0, Math.min(10, parsed.score || 0));

        return {
          ...chunk,
          score:
            rerankWeight * (llmScore / 10) +
            (1 - rerankWeight) * chunk.score,
        };
      } catch {
        return chunk; // 重排失败保留原分数
      }
    });

    const reranked = await Promise.all(rerankPromises);
    return reranked.sort((a, b) => b.score - a.score);
  }

  // ==================== LLM 回答生成 ====================

  /**
   * 使用检索到的 Chunk 生成回答
   */
  private async generateAnswer(
    originalQuery: string,
    searchQuery: string,
    chunks: Array<{
      chunkId: number;
      documentId: number;
      documentTitle: string;
      content: string;
      score: number;
      pageRange?: string;
      heading?: string;
      chunkType?: string;
      source: 'vector' | 'bm25' | 'both';
    }>,
    conversationHistory: Array<{ role: string; content: string }>,
    intent: IntentResult
  ): Promise<{
    answer: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    // 构建上下文
    let context = '';
    if (chunks.length > 0) {
      context = '以下是从知识库中检索到的相关文档内容：\n\n';
      chunks.forEach((chunk, index) => {
        const sourceLabel =
          chunk.source === 'both'
            ? '向量+关键词'
            : chunk.source === 'vector'
              ? '向量匹配'
              : '关键词匹配';
        const pageInfo = chunk.pageRange ? `, 第${chunk.pageRange}页` : '';
        const headingInfo = chunk.heading ? `, ${chunk.heading}` : '';
        const typeLabel = chunk.chunkType === 'table' ? ' [表格]' : '';
        context += `【来源${index + 1}: ${chunk.documentTitle || '未命名文档'}${pageInfo}${headingInfo}${typeLabel} (${sourceLabel}, 相关度: ${Math.round(chunk.score * 100)}%)】\n${chunk.content}\n\n`;
      });
    }

    const intentHint =
      intent.type === 'number'
        ? '用户在查询具体数值，请确保引用原文中的精确数字。'
        : intent.type === 'boolean'
          ? '用户需要一个明确的是/否判断，请给出清晰结论。'
          : intent.type === 'comparative'
            ? '用户在进行对比分析，请分别列出各对象的数据后给出比较结论。'
            : '';

    const systemPrompt = `你是Finspark AI财报知识库助手。你可以基于知识库中的公司财报文档回答用户问题。

${context ? '【知识库检索结果】\n' + context : '当前知识库中没有找到与问题高度相关的文档。'}

${intentHint ? '【提示】' + intentHint + '\n' : ''}
回答规则：
1. 优先基于知识库中的文档内容来回答
2. 如果知识库中有相关信息，请引用具体来源（包括文档名称、页码和章节）
3. 如果知识库中没有足够信息，可以基于你的金融知识补充，但要说明哪些是文档中的信息，哪些是补充分析
4. 使用专业但易懂的中文回答
5. 如果涉及投资建议，需要声明"仅供参考，不构成投资建议"
6. 在回答末尾标注参考来源，格式如：📄 文档名称 · 第X页 · 章节名`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map((h) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: originalQuery },
    ];

    // 获取 LLM 配置（根据 GPU Provider 路由）
    const llmConfig = this.gpuProvider?.getLlmConfig('answer') || {
      baseUrl: 'https://api.vectorengine.ai/v1',
      apiKey: this.apiKey,
      model: 'gpt-4.1',
      provider: 'cloud' as const,
    };

    // A/B 测试模式：同时调用 GPU 和 Cloud，比较结果
    if (this.gpuProvider?.isABTest('answer')) {
      const abResult = await this.gpuProvider.abTestLlmCall(messages, {
        temperature: 0.3,
        maxTokens: 2048,
      });
      console.log(`[Pipeline] A/B Test: selected=${abResult.selectedProvider}, gpu_latency=${abResult.gpuResult?.latencyMs}ms, cloud_latency=${abResult.cloudResult?.latencyMs}ms`);
      return {
        answer: abResult.answer,
        inputTokens: (abResult.selectedProvider === 'gpu' ? abResult.gpuResult?.tokens.input : abResult.cloudResult?.tokens.input) || 0,
        outputTokens: (abResult.selectedProvider === 'gpu' ? abResult.gpuResult?.tokens.output : abResult.cloudResult?.tokens.output) || 0,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...('extraHeaders' in llmConfig ? (llmConfig as any).extraHeaders || {} : {}),
    };
    if (llmConfig.apiKey !== 'not-needed') {
      headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
    }

    const requestBody = {
      model: llmConfig.model,
      messages,
      temperature: 0.3,
      // GPU (Qwen3-14B) max_model_len=8192, 需预留 prompt 空间; Cloud 可以更大
      max_tokens: llmConfig.provider === 'gpu' ? 2048 : 4096,
      // Qwen3 SGLang: 关闭 thinking 模式，直接输出答案 (chat_template_kwargs 在请求体顶层)
      ...(llmConfig.provider === 'gpu' ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    };
    
    console.log(`[Pipeline] generateAnswer: provider=${llmConfig.provider}, model=${llmConfig.model}, baseUrl=${llmConfig.baseUrl}, max_tokens=${requestBody.max_tokens}, messages_count=${messages.length}`);

    const response = await fetch(
      `${llmConfig.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      }
    );

    console.log(`[Pipeline] generateAnswer: fetch completed, status=${response.status}`);
    
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Pipeline] generateAnswer LLM error: ${response.status} ${errText}`);
      // 提供更友好的错误信息
      if (response.status === 403 && errText.includes('insufficient_quota')) {
        throw new Error('AI 服务额度不足，请联系管理员充值 VectorEngine API 额度。');
      } else if (response.status === 401) {
        throw new Error('AI 服务认证失败，请检查 API Key 配置。');
      } else if (response.status === 429) {
        throw new Error('AI 服务请求过于频繁，请稍后再试。');
      } else if (response.status === 502 || response.status === 503) {
        throw new Error('AI 服务暂时不可用，请稍后再试。');
      }
      throw new Error(`LLM API error: ${response.status} ${errText}`);
    }

    const rawText = await response.text();
    console.log(`[Pipeline] generateAnswer: raw response length=${rawText.length}, first200=${rawText.slice(0, 200)}`);
    
    const llmResult = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    let answer = llmResult.choices?.[0]?.message?.content || '抱歉，无法生成回答。';
    
    // 处理 Qwen3 的 thinking tags
    if (llmConfig.provider === 'gpu') {
      answer = answer.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    }

    return {
      answer,
      inputTokens: llmResult.usage?.prompt_tokens || 0,
      outputTokens: llmResult.usage?.completion_tokens || 0,
    };
  }

  // ==================== 日志记录 ====================

  /**
   * 保存问答详细 Pipeline 日志到 rag_message_logs
   */
  private async saveMessageLog(data: {
    sessionId: string;
    conversationId?: number;
    userQuery: string;
    rewrittenQuery: string | null;
    intent: IntentResult;
    vectorResultsCount: number;
    vectorTopScore: number;
    vectorLatencyMs: number;
    bm25ResultsCount: number;
    bm25TopScore: number;
    bm25LatencyMs: number;
    dedupCount: number;
    rerankEnabled: boolean;
    rerankInputCount: number;
    rerankOutputCount: number;
    rerankModel: string | null;
    rerankLatencyMs: number;
    llmModel: string;
    llmInputTokens: number;
    llmOutputTokens: number;
    llmLatencyMs: number;
    llmTemperature: number;
    sources: EnhancedSource[];
    totalLatencyMs: number;
    status: string;
    errorMessage?: string;
  }): Promise<number> {
    try {
      const result = await this.db
        .prepare(
          `INSERT INTO rag_message_logs (
            conversation_id, session_id, user_query, rewritten_query,
            intent_type, intent_confidence, intent_entities, intent_latency_ms,
            vector_results_count, vector_top_score, vector_latency_ms,
            bm25_results_count, bm25_top_score, bm25_latency_ms,
            dedup_count,
            rerank_enabled, rerank_input_count, rerank_output_count, rerank_model, rerank_latency_ms,
            llm_model, llm_input_tokens, llm_output_tokens, llm_latency_ms, llm_temperature,
            sources_json, total_latency_ms, status, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          data.conversationId || null,
          data.sessionId,
          data.userQuery,
          data.rewrittenQuery,
          data.intent.type,
          data.intent.confidence,
          JSON.stringify(data.intent.entities),
          data.intent.latencyMs,
          data.vectorResultsCount,
          data.vectorTopScore,
          data.vectorLatencyMs,
          data.bm25ResultsCount,
          data.bm25TopScore,
          data.bm25LatencyMs,
          data.dedupCount,
          data.rerankEnabled ? 1 : 0,
          data.rerankInputCount,
          data.rerankOutputCount,
          data.rerankModel,
          data.rerankLatencyMs,
          data.llmModel,
          data.llmInputTokens,
          data.llmOutputTokens,
          data.llmLatencyMs,
          data.llmTemperature,
          JSON.stringify(
            data.sources.map((s) => ({
              doc_id: s.documentId,
              chunk_id: s.chunkId,
              page: s.pageRange,
              heading: s.heading,
              chunk_type: s.chunkType,
              score: s.relevanceScore,
            }))
          ),
          data.totalLatencyMs,
          data.status,
          data.errorMessage || null
        )
        .run();

      return (result.meta.last_row_id as number) || 0;
    } catch (error) {
      console.error('[Pipeline] Failed to save message log:', error);
      return 0;
    }
  }

  // ==================== 文档处理 Pipeline ====================

  /**
   * 创建文档处理任务（用于追踪进度）
   */
  async createIngestTask(documentId: number): Promise<number> {
    const result = await this.db
      .prepare(
        `INSERT INTO rag_pipeline_tasks (task_type, document_id, status, total_steps, started_at) 
         VALUES ('ingest', ?, 'running', 4, datetime('now'))`
      )
      .bind(documentId)
      .run();

    const taskId = result.meta.last_row_id as number;

    // 创建 4 个标准步骤
    const steps = ['chunking', 'embedding', 'bm25_index', 'finalize'];
    const stmts = steps.map((step, idx) =>
      this.db
        .prepare(
          `INSERT INTO rag_pipeline_steps (task_id, step_name, step_order, status) 
           VALUES (?, ?, ?, 'pending')`
        )
        .bind(taskId, step, idx + 1)
    );

    await this.db.batch(stmts);

    // 缓存进度到 KV（用于前端轮询）
    await this.kv.put(
      `pipeline:task:${taskId}`,
      JSON.stringify({
        taskId,
        status: 'running',
        completedSteps: 0,
        totalSteps: 4,
      }),
      { expirationTtl: 3600 }
    );

    return taskId;
  }

  /**
   * 更新 Pipeline 步骤状态
   */
  async updateStep(
    taskId: number,
    stepName: string,
    status: string,
    data?: { input?: Record<string, unknown>; output?: Record<string, unknown>; error?: string; durationMs?: number }
  ): Promise<void> {
    const now = `datetime('now')`;
    let sql = `UPDATE rag_pipeline_steps SET status = ?`;
    const binds: any[] = [status];

    if (data?.input) {
      sql += ', input_data = ?';
      binds.push(JSON.stringify(data.input));
    }
    if (data?.output) {
      sql += ', output_data = ?';
      binds.push(JSON.stringify(data.output));
    }
    if (data?.error) {
      sql += ', error_message = ?';
      binds.push(data.error);
    }
    if (data?.durationMs) {
      sql += ', duration_ms = ?';
      binds.push(data.durationMs);
    }

    if (status === 'running') {
      sql += `, started_at = datetime('now')`;
    }
    if (status === 'completed' || status === 'failed') {
      sql += `, completed_at = datetime('now')`;
    }

    sql += ' WHERE task_id = ? AND step_name = ?';
    binds.push(taskId, stepName);

    await this.db.prepare(sql).bind(...binds).run();

    // 更新任务完成步骤数
    if (status === 'completed') {
      await this.db
        .prepare(
          `UPDATE rag_pipeline_tasks 
           SET completed_steps = (
             SELECT COUNT(*) FROM rag_pipeline_steps WHERE task_id = ? AND status = 'completed'
           )
           WHERE id = ?`
        )
        .bind(taskId, taskId)
        .run();
    }

    // 更新 KV 缓存
    const task = await this.db
      .prepare(
        'SELECT status, total_steps, completed_steps FROM rag_pipeline_tasks WHERE id = ?'
      )
      .bind(taskId)
      .first<{ status: string; total_steps: number; completed_steps: number }>();

    if (task) {
      await this.kv.put(
        `pipeline:task:${taskId}`,
        JSON.stringify({
          taskId,
          status: task.status,
          completedSteps: task.completed_steps,
          totalSteps: task.total_steps,
        }),
        { expirationTtl: 3600 }
      );
    }
  }

  /**
   * 完成任务
   */
  async completeTask(taskId: number, status: 'completed' | 'failed', error?: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE rag_pipeline_tasks 
         SET status = ?, completed_at = datetime('now'), error_message = ? 
         WHERE id = ?`
      )
      .bind(status, error || null, taskId)
      .run();

    // 更新 KV
    const task = await this.db
      .prepare(
        'SELECT total_steps, completed_steps FROM rag_pipeline_tasks WHERE id = ?'
      )
      .bind(taskId)
      .first<{ total_steps: number; completed_steps: number }>();

    if (task) {
      await this.kv.put(
        `pipeline:task:${taskId}`,
        JSON.stringify({
          taskId,
          status,
          completedSteps: task.completed_steps,
          totalSteps: task.total_steps,
          error,
        }),
        { expirationTtl: 3600 }
      );
    }
  }

  /**
   * 获取任务进度（优先从 KV 缓存读取）
   */
  async getTaskProgress(taskId: number): Promise<PipelineTaskProgress | null> {
    // 从 DB 获取完整数据
    const task = await this.db
      .prepare('SELECT * FROM rag_pipeline_tasks WHERE id = ?')
      .bind(taskId)
      .first<{
        id: number;
        task_type: string;
        status: string;
        total_steps: number;
        completed_steps: number;
        error_message: string;
      }>();

    if (!task) return null;

    const stepsResult = await this.db
      .prepare(
        'SELECT step_name, step_order, status, duration_ms, output_data FROM rag_pipeline_steps WHERE task_id = ? ORDER BY step_order'
      )
      .bind(taskId)
      .all();

    const steps = (stepsResult.results || []).map((s: any) => ({
      name: s.step_name as string,
      order: s.step_order as number,
      status: s.status as string,
      durationMs: s.duration_ms as number | undefined,
      outputData: s.output_data ? JSON.parse(s.output_data as string) : undefined,
    }));

    return {
      taskId: task.id,
      taskType: task.task_type,
      status: task.status,
      totalSteps: task.total_steps,
      completedSteps: task.completed_steps,
      steps,
      error: task.error_message || undefined,
    };
  }

  // ==================== 日志查询 ====================

  /**
   * 获取最近问答日志
   */
  async getRecentLogs(limit: number = 10): Promise<any[]> {
    try {
      const result = await this.db
        .prepare(
          `SELECT id, session_id, user_query, rewritten_query,
                  intent_type, intent_confidence,
                  vector_results_count, bm25_results_count, dedup_count,
                  rerank_enabled, llm_model, 
                  llm_input_tokens, llm_output_tokens,
                  total_latency_ms, status, error_message, created_at
           FROM rag_message_logs 
           ORDER BY created_at DESC 
           LIMIT ?`
        )
        .bind(limit)
        .all();

      return result.results || [];
    } catch (error) {
      console.error('[Pipeline] Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * 获取问答日志（带筛选和分页）
   */
  async getLogs(params: {
    intentType?: string;
    status?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const { intentType, status, sessionId, limit = 20, offset = 0 } = params;

    let where = 'WHERE 1=1';
    const binds: any[] = [];

    if (intentType) {
      where += ' AND intent_type = ?';
      binds.push(intentType);
    }
    if (status) {
      where += ' AND status = ?';
      binds.push(status);
    }
    if (sessionId) {
      where += ' AND session_id = ?';
      binds.push(sessionId);
    }

    try {
      const result = await this.db
        .prepare(
          `SELECT id, session_id, user_query, rewritten_query,
                  intent_type, intent_confidence, intent_entities,
                  vector_results_count, vector_top_score, vector_latency_ms,
                  bm25_results_count, bm25_top_score, bm25_latency_ms,
                  dedup_count, rerank_enabled,
                  llm_model, llm_input_tokens, llm_output_tokens, llm_latency_ms,
                  total_latency_ms, status, error_message, sources_json, created_at
           FROM rag_message_logs 
           ${where}
           ORDER BY created_at DESC 
           LIMIT ? OFFSET ?`
        )
        .bind(...binds, limit, offset)
        .all();

      const countResult = await this.db
        .prepare(`SELECT COUNT(*) as total FROM rag_message_logs ${where}`)
        .bind(...binds)
        .first<{ total: number }>();

      return {
        logs: (result.results || []).map((r: any) => ({
          ...r,
          intent_entities: r.intent_entities ? JSON.parse(r.intent_entities) : [],
          sources_json: r.sources_json ? JSON.parse(r.sources_json) : [],
        })),
        total: countResult?.total || 0,
      };
    } catch (error) {
      console.error('[Pipeline] Failed to get logs:', error);
      return { logs: [], total: 0 };
    }
  }
}

// ==================== 工厂函数 ====================

export function createPipelineService(
  db: D1Database,
  kv: KVNamespace,
  ragService: RAGService,
  bm25Service: BM25Service,
  intentService: IntentService,
  apiKey: string,
  autoSyncService?: AutoSyncService,
  gpuProvider?: GpuProvider
): PipelineService {
  return new PipelineService(db, kv, ragService, bm25Service, intentService, apiKey, autoSyncService, gpuProvider);
}
