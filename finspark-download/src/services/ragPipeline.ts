/**
 * Pipeline 编排服务 — services/ragPipeline.ts
 *
 * 核心职责：
 * 1. 增强版 RAG 问答编排：意图识别 → 并行检索(向量+BM25) → 去重 → 可选LLM重排 → LLM生成 → 日志
 * 2. 文档处理 Pipeline 任务管理（进度追踪）
 * 3. 问答消息详细日志记录（rag_message_logs）
 * 4. 混合路由支持：RAG + 工具调用（realtimeData 注入）
 *
 * LLM 重排默认关闭（用户确认：先搭建完平台测试后再决定是否开启）
 */

import type { RAGService, ChunkWithScore } from './rag';
import type { BM25Service, BM25SearchResult } from './ragBm25';
import type { FTS5Service, FTS5SearchResult } from './ragFts5';
import type { IntentService, IntentResult } from './ragIntent';
import type { AutoSyncService } from './ragAutoSync';
import type { GpuProvider } from './ragGpuProvider';
import { cleanLatexNoise } from './ragPdfParser';

// ==================== 类型定义 ====================

export interface EnhancedRAGConfig {
  enableBm25: boolean;          // 是否启用 BM25（默认 true）
  enableRerank: boolean;        // 是否启用 LLM 重排（默认 false）
  topK: number;                 // 最终返回的 Chunk 数量（默认 5）
  minScore: number;             // 最低分阈值（默认 0.25）
  rerankWeight: number;         // LLM 重排权重 0-1（默认 0.7）
  documentIds?: number[];
  stockCode?: string;

  // === Context Expansion（上下文扩展） ===
  contextMode: 'none' | 'adjacent' | 'parent';  // 上下文模式（默认 none = 向后兼容）
  contextWindow: number;                          // adjacent 模式窗口大小，前后各 N 个 chunk（默认 1）

  // === Hybrid / Tool Calling 支持 ===
  /**
   * 外部实时数据注入（由路由层获取后传入，Pipeline 只负责生成）
   * 例：股价、PE/PB、成交量等实时数据
   */
  realtimeData?: Record<string, unknown>;
}

export const DEFAULT_ENHANCED_CONFIG: EnhancedRAGConfig = {
  enableBm25: true,
  enableRerank: true,           // v10: 启用 LLM 重排，过滤噪声 chunk 提升 Sufficiency
  topK: 9,                      // v11: increased from 8 to 9 for better chunk relevance (rel 48.9%→target 65%)
  minScore: 0.18,               // v11: slightly lower threshold to improve recall diversity
  rerankWeight: 0.7,
  contextMode: 'adjacent',      // v5: enable adjacent context expansion by default
  contextWindow: 2,             // adjacent 模式默认前后各 2 个 chunk（更完整的上下文）
};

/** 合并后的 Chunk 内部类型（含 chunkIndex，用于 context expansion） */
export interface MergedChunk {
  chunkId: number;
  chunkIndex: number;           // chunk 在文档内的序号，用于 adjacent expansion
  documentId: number;
  documentTitle: string;
  content: string;
  score: number;                // 当前分数（可能已被 rerank 调整）
  originalScore: number;        // 原始检索分数（rerank 前），用于评估 Relevance
  pageRange?: string;
  heading?: string;
  chunkType?: string;
  sourceFile?: string;
  source: 'vector' | 'bm25' | 'both';
}

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
  _fullContent?: string; // 完整 chunk 内容（仅内部评测使用，不序列化到 API 响应）
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
  /** 路由类型（rag / realtime / hybrid / agent_report），由调用层写入 */
  route?: string;
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
  private fts5Service?: FTS5Service;  // FTS5 全文检索（替代 BM25，可选）
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
    gpuProvider?: GpuProvider,
    fts5Service?: FTS5Service
  ) {
    this.db = db;
    this.kv = kv;
    this.ragService = ragService;
    this.bm25Service = bm25Service;
    this.fts5Service = fts5Service;
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

      // ② 检索（支持 Sub-Query 多轮检索）
      //
      // 当意图为 comparative 且 Intent 层拆出了 subQueries 时：
      //   对主查询 + 每个 sub-query 并行检索，结果合并去重，多次命中的 chunk 加 boost。
      //   这对"比亚迪和海螺水泥行业环境差异"这类跨公司对比题至关重要——
      //   单次检索只能召回一家公司的内容，sub-query 多轮检索可覆盖所有对比对象。
      //
      // 其他题型：保持原有单查询逻辑不变。

      const hasSubQueries = intentResult.subQueries && intentResult.subQueries.length >= 2;
      const allQueries = hasSubQueries
        ? [searchQuery, ...intentResult.subQueries!]  // 主查询 + 子查询
        : [searchQuery];

      if (hasSubQueries) {
        console.log(`[Pipeline] Sub-query decomposition: ${allQueries.length} queries = main + ${intentResult.subQueries!.length} subs: ${intentResult.subQueries!.join(' | ')}`);
      }

      // 对每个查询做并行检索，收集所有结果
      const allVectorResults: ChunkWithScore[] = [];
      const allBm25Results: BM25SearchResult[] = [];
      const retrievalStart = Date.now();

      // 每个 sub-query 的 topK 较小（避免总量爆炸），主查询保持完整 topK
      const perQueryTopK = hasSubQueries
        ? Math.max(4, Math.ceil(config.topK * 1.5))  // sub-query 模式：每个查询取较少
        : config.topK * 2;                             // 单查询模式：保持原逻辑

      const queryPromises = allQueries.map((q, qIdx) => {
        const isMainQuery = qIdx === 0;
        const qTopK = isMainQuery ? config.topK * 2 : perQueryTopK;
        const promises: Array<Promise<void>> = [];

        // 向量检索
        promises.push(
          this.ragService
            .searchSimilar(q, {
              topK: qTopK,
              minScore: config.minScore,
              stockCode: config.stockCode,
              documentIds: config.documentIds,
            })
            .then((results) => {
              allVectorResults.push(...results);
            })
        );

        // 全文检索（如果启用）
        if (config.enableBm25) {
          if (this.fts5Service) {
            promises.push(
              this.fts5Service
                .search(q, {
                  topK: qTopK,
                  documentIds: config.documentIds,
                  stockCode: config.stockCode,
                })
                .then((fts5Results) => {
                  allBm25Results.push(...fts5Results.map(r => ({
                    chunkId: r.chunkId,
                    documentId: r.documentId,
                    score: r.score,
                    content: r.content,
                    matchedTokens: [],
                  })));
                })
                .catch((fts5Error) => {
                  console.warn(`[Pipeline] FTS5 failed for query #${qIdx}, falling back to BM25:`, fts5Error);
                  return this.bm25Service
                    .search(q, {
                      topK: qTopK,
                      documentIds: config.documentIds,
                      stockCode: config.stockCode,
                    })
                    .then((results) => {
                      allBm25Results.push(...results);
                    });
                })
            );
          } else {
            promises.push(
              this.bm25Service
                .search(q, {
                  topK: qTopK,
                  documentIds: config.documentIds,
                  stockCode: config.stockCode,
                })
                .then((results) => {
                  allBm25Results.push(...results);
                })
            );
          }
        }

        return Promise.all(promises);
      });

      // 所有查询并行执行
      await Promise.all(queryPromises);

      vectorResults = allVectorResults;
      bm25Results = allBm25Results;
      vectorLatency = Date.now() - retrievalStart;
      bm25Latency = vectorLatency; // 混合计时

      if (hasSubQueries) {
        console.log(`[Pipeline] Sub-query retrieval complete: ${allVectorResults.length} vector + ${allBm25Results.length} bm25 results from ${allQueries.length} queries in ${vectorLatency}ms`);
      } else {
        console.log(`[Pipeline] Single-query retrieval: ${allVectorResults.length} vector + ${allBm25Results.length} bm25 in ${vectorLatency}ms`);
      }

      // ③ 去重合并（多次命中同一 chunk 时 mergeAndDedup 自动加 boost）
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

      // ④.5 Context Expansion（上下文扩展）
      let contextExpanded = false;
      if (config.contextMode === 'adjacent' && config.contextWindow > 0 && finalChunks.length > 0) {
        try {
          const expandStart = Date.now();
          finalChunks = await this.expandAdjacentContext(finalChunks, config.contextWindow);
          contextExpanded = true;
          console.log(`[Pipeline] Adjacent context expansion (window=${config.contextWindow}): ${Date.now() - expandStart}ms`);
        } catch (expandError) {
          console.warn('[Pipeline] Context expansion failed, using raw chunks:', expandError);
        }
      }

      // ⑤ LLM 生成回答（支持 realtimeData 注入，hybrid 路由时使用）
      const llmStart = Date.now();
      const llmResponse = await this.generateAnswer(
        params.question,
        searchQuery,
        finalChunks,
        params.conversationHistory || [],
        intentResult,
        config.realtimeData
      );
      llmLatency = Date.now() - llmStart;
      llmInputTokens = llmResponse.inputTokens;
      llmOutputTokens = llmResponse.outputTokens;

      // 构造来源列表
      // chunkContent: API 响应用 200 字截断；内部 _fullContent 用于评测打分（不序列化到外部 JSON）
      // 清洗 LaTeX 噪音：已存储的旧 chunk 可能含有 MinerU 残留公式
      const sources: EnhancedSource[] = finalChunks.map((c) => {
        const cleanContent = cleanLatexNoise(c.content);
        return {
          documentId: c.documentId,
          documentTitle: c.documentTitle || `文档${c.documentId}`,
          chunkContent:
            cleanContent.slice(0, 200) + (cleanContent.length > 200 ? '...' : ''),
          // 使用原始检索分数（rerank 前）作为 relevanceScore —— 
          // rerank 后分数集中在 0.3-0.6，会让 Relevance 评分（阈值 0.6）误判为不相关
          relevanceScore: Math.round((c.originalScore || c.score) * 1000) / 1000,
          chunkId: c.chunkId,
          pageRange: c.pageRange,
          heading: c.heading,
          chunkType: c.chunkType,
          sourceFile: c.sourceFile,
          source: c.source,
          _fullContent: cleanContent, // 完整内容（已清洗），用于评测 faithfulness/sufficiency 打分
        };
      });

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
  ): MergedChunk[] {
    const mergedMap = new Map<number, MergedChunk>();

    // 添加向量检索结果（自带 chunkIndex）
    // Sub-query 场景下同一 chunk 可能被多个查询命中 — 保留最高分并加 boost
    for (const vr of vectorResults) {
      const chunkId = vr.chunk.id!;
      const meta = (vr.chunk.metadata || {}) as Record<string, any>;
      const existing = mergedMap.get(chunkId);
      if (existing) {
        // 同一 chunk 被多个 sub-query 命中 — 加 boost 并取最高分
        existing.score = Math.min(1.0, Math.max(existing.score, vr.score) + 0.05);
      } else {
        mergedMap.set(chunkId, {
          chunkId,
          chunkIndex: vr.chunk.chunkIndex,
          documentId: vr.documentId,
          documentTitle: vr.documentTitle || '',
          content: vr.chunk.content,
          score: vr.score,
          originalScore: vr.score,  // 保存原始检索分数（rerank 前）
          pageRange: meta.pageStart ? `${meta.pageStart}${meta.pageEnd && meta.pageEnd !== meta.pageStart ? '-' + meta.pageEnd : ''}` : meta.pageRange,
          heading: meta.heading,
          chunkType: meta.chunkType,
          sourceFile: meta.sourceFile,
          source: 'vector',
        });
      }
    }

    // 合并 BM25 检索结果
    // 策略：向量搜索是主要排序信号，BM25 用于补充召回
    // - 双通道命中的 chunk 获得额外 boost（+0.10），确保排在前面
    // - BM25-only 的 chunk 分数 cap 在 0.45，不会挤掉向量结果
    for (const br of bm25Results) {
      const existing = mergedMap.get(br.chunkId);
      if (existing) {
        // 双通道命中 — 在原向量分数基础上加 boost
        existing.source = 'both';
        existing.score = Math.min(1.0, existing.score + 0.10);
      } else {
        // BM25-only — 使用 capped 分数（不超过 0.45，低于典型向量分数 0.5+）
        const bm25Normalized = Math.min(0.45, this.normalizeBM25Score(br.score));
        mergedMap.set(br.chunkId, {
          chunkId: br.chunkId,
          chunkIndex: -1, // BM25 结果暂无 chunkIndex，expandAdjacentContext 时会通过 DB 补充
          documentId: br.documentId,
          documentTitle: '', // BM25 结果没有 title，后续可以补充
          content: br.content,
          score: bm25Normalized,
          originalScore: bm25Normalized,  // BM25-only 原始分数
          source: 'bm25',
        });
      }
    }

    // 按分数排序
    return [...mergedMap.values()].sort((a, b) => b.score - a.score);
  }

  // ==================== Adjacent Context Expansion ====================

  /**
   * 相邻 chunk 上下文扩展
   *
   * 对每个检索命中的 chunk，查询其前后 N 个相邻 chunk，拼接为更完整的上下文传给 LLM。
   *
   * 优化：
   * - 同一文档的多个命中 chunk 合并为一次 DB 查询
   * - 相邻 chunk 窗口有重叠时自动去重、合并为连续区间
   * - BM25-only 结果（chunkIndex=-1）通过额外 DB 查询补充 chunk_index
   */
  private async expandAdjacentContext(
    chunks: MergedChunk[],
    windowSize: number
  ): Promise<MergedChunk[]> {
    if (chunks.length === 0 || windowSize <= 0) return chunks;

    // Step 1: 补全缺失的 chunkIndex（BM25-only 结果可能缺失）
    const missingIndexChunks = chunks.filter(c => c.chunkIndex < 0);
    if (missingIndexChunks.length > 0) {
      const placeholders = missingIndexChunks.map(() => '?').join(',');
      const indexResult = await this.db.prepare(
        `SELECT id, chunk_index FROM rag_chunks WHERE id IN (${placeholders})`
      ).bind(...missingIndexChunks.map(c => c.chunkId)).all();

      const indexMap = new Map<number, number>();
      for (const row of indexResult.results || []) {
        indexMap.set(row.id as number, row.chunk_index as number);
      }
      for (const c of missingIndexChunks) {
        const idx = indexMap.get(c.chunkId);
        if (idx !== undefined) c.chunkIndex = idx;
      }
    }

    // 过滤掉仍然无法获取 chunkIndex 的（理论上不应发生）
    const validChunks = chunks.filter(c => c.chunkIndex >= 0);
    if (validChunks.length === 0) return chunks;

    // Step 2: 按文档分组，计算每个 chunk 的查询区间 [min, max]
    const rangesByDoc = new Map<number, Array<{ min: number; max: number; origChunks: MergedChunk[] }>>();

    for (const c of validChunks) {
      const min = Math.max(0, c.chunkIndex - windowSize);
      const max = c.chunkIndex + windowSize;
      if (!rangesByDoc.has(c.documentId)) rangesByDoc.set(c.documentId, []);
      rangesByDoc.get(c.documentId)!.push({ min, max, origChunks: [c] });
    }

    // Step 3: 合并同文档下的重叠区间（减少 DB 查询）
    for (const [docId, ranges] of rangesByDoc) {
      ranges.sort((a, b) => a.min - b.min);
      const merged: typeof ranges = [];
      for (const r of ranges) {
        if (merged.length > 0 && r.min <= merged[merged.length - 1].max + 1) {
          // 区间重叠或相邻，合并
          const last = merged[merged.length - 1];
          last.max = Math.max(last.max, r.max);
          last.origChunks.push(...r.origChunks);
        } else {
          merged.push({ ...r, origChunks: [...r.origChunks] });
        }
      }
      rangesByDoc.set(docId, merged);
    }

    // Step 4: 批量查询相邻 chunks（每个文档+区间一次查询）
    // 收集所有相邻 chunk 的内容，key = "docId:chunkIndex"
    const adjacentMap = new Map<string, string>();

    for (const [docId, ranges] of rangesByDoc) {
      for (const range of ranges) {
        const result = await this.db.prepare(
          `SELECT chunk_index, content FROM rag_chunks
           WHERE document_id = ? AND chunk_index BETWEEN ? AND ?
           ORDER BY chunk_index ASC`
        ).bind(docId, range.min, range.max).all();

        for (const row of result.results || []) {
          adjacentMap.set(`${docId}:${row.chunk_index}`, row.content as string);
        }
      }
    }

    // Step 5: 为每个命中 chunk 拼接扩展上下文
    const expandedChunks: MergedChunk[] = [];

    for (const c of validChunks) {
      const min = Math.max(0, c.chunkIndex - windowSize);
      const max = c.chunkIndex + windowSize;

      const parts: string[] = [];
      for (let idx = min; idx <= max; idx++) {
        const key = `${c.documentId}:${idx}`;
        const text = adjacentMap.get(key);
        if (text) parts.push(text);
      }

      // 拼接后替换原始 content（保留其他元信息）
      const expandedContent = parts.length > 0 ? parts.join('\n\n') : c.content;

      expandedChunks.push({
        ...c,
        content: expandedContent,
      });
    }

    // 补回那些 chunkIndex 无法获取的 chunks（原样保留）
    const invalidChunks = chunks.filter(c => c.chunkIndex < 0);
    expandedChunks.push(...invalidChunks);

    return expandedChunks;
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
    chunks: MergedChunk[],
    rerankWeight: number
  ): Promise<MergedChunk[]> {
    const toRerank = chunks.slice(0, 10);
    const documents = toRerank.map(c => c.content.slice(0, 500));

    const results = await this.gpuProvider!.dedicatedRerank(query, documents, toRerank.length);

    // 融合 Reranker 分数和原始分数
    const reranked = results.map(r => {
      const original = toRerank[r.index];
      return {
        ...original,
        score: rerankWeight * r.score + (1 - rerankWeight) * original.score,
      };
    });
    // 合并：rerank 过的 top-10 + 未 rerank 的其余 chunks（保留原始分数）
    const remaining = chunks.slice(10);
    return [...reranked, ...remaining].sort((a, b) => b.score - a.score);
  }

  // ==================== LLM 重排 ====================

  /**
   * LLM 重排：对候选 Chunk 逐一评估相关性（Cloud 模式回退方案）
   * 最终分数 = rerankWeight * llmScore/10 + (1-rerankWeight) * originalScore
   */
  private async llmRerank(
    query: string,
    chunks: MergedChunk[],
    rerankWeight: number
  ): Promise<MergedChunk[]> {
    // 限制重排数量（v10: 降为 4 以适配 Workers CPU 限制 —— 
    // 评估流程中 ragQueryFn(intent+rerank+answer ≈ 6-10 LLM) + scoring(suf+int+sem+faith ≈ 5 LLM)
    // 共 ~11-15 次 LLM 调用在同一个 Workers 请求内，4 个 rerank 使总数控制在 ~10 次以内）
    const toRerank = chunks.slice(0, 4);

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
    // 合并：rerank 过的 top-4 + 未 rerank 的其余 chunks（保留原始分数）
    // 这样 topK=8 时可以返回 8 个 sources，而非仅 4 个
    const remaining = chunks.slice(4);
    return [...reranked, ...remaining].sort((a, b) => b.score - a.score);
  }

  // ==================== LLM 回答生成 ====================

  /**
   * 使用检索到的 Chunk 生成回答
   */
  private async generateAnswer(
    originalQuery: string,
    searchQuery: string,
    chunks: MergedChunk[],
    conversationHistory: Array<{ role: string; content: string }>,
    intent: IntentResult,
    realtimeData?: Record<string, unknown>
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
        // 清洗 LaTeX 噪音（已存储的旧 chunk 可能含有 $5,0\\%$ 等 MinerU 残留）
        const cleanContent = cleanLatexNoise(chunk.content);
        context += `【来源${index + 1}: ${chunk.documentTitle || '未命名文档'}${pageInfo}${headingInfo}${typeLabel} (${sourceLabel}, 相关度: ${Math.round(chunk.score * 100)}%)】\n${cleanContent}\n\n`;
      });
    }

    // ============ P2: 深度 Prompt 模板分题型定制 ============
    // 针对 6 种 intent 类型设计差异化的 system prompt，
    // 分别优化 Faithfulness、ExactMatch、Semantic 和 Sufficiency 等维度。

    // 实时数据块（hybrid 路由时由外层注入）
    let realtimeBlock = '';
    if (realtimeData && Object.keys(realtimeData).length > 0) {
      const entries = Object.entries(realtimeData)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');
      realtimeBlock = `\n\n【实时市场数据（截止查询时刻）】\n${entries}\n`;
      console.log(`[Pipeline] generateAnswer: injecting realtimeData (${Object.keys(realtimeData).length} fields)`);
    }

    const contextBlock = (context || realtimeBlock)
      ? '【知识库检索结果】\n' + context + realtimeBlock
      : '当前知识库中没有找到与问题高度相关的文档。';

    // 通用基础规则（所有题型共享）
    const baseRules = `基础规则：
- **严格基于**知识库中的文档内容回答，不得捏造、推测或补充文档中不存在的数据
- 如果检索结果中没有足够信息回答问题，明确说明"根据当前检索到的文档，未找到XXX相关数据"
- 在回答末尾标注参考来源，格式如：📄 文档名称 · 第X页 · 章节名`;

    // 按题型生成差异化的回答策略
    let intentPrompt: string;
    switch (intent.type) {
      case 'number':
        intentPrompt = `【回答策略 — 数值查询】
你需要回答一个关于具体数值的问题。

回答要求：
1. **第一句话直接给出数值答案**，简明扼要，不要引用大段原文
2. **精确引用**原文中的数字，绝不四舍五入、单位换算或近似处理
3. 如果原文使用"万元"，回答中也必须使用"万元"；如果原文使用"%"，回答也用"%"
4. 如果问题涉及的指标有相关上下文（同比、环比、构成等），用1-2句简要补充
5. 若检索结果中不存在该数值，明确说明"未找到"，不要推算或编造
6. **不要大段摘抄原文**，用自己的语言组织答案，只在末尾标注出处`;
        break;

      case 'name':
        intentPrompt = `【回答策略 — 名称/实体查询】
你需要回答一个关于具体名称或实体的问题（如高管姓名、子公司名称、审计机构等）。

回答要求：
1. 给出**准确的全称**，不要缩写或简化
2. 如果原文有职位/角色信息，一并给出
3. 如果存在多个符合条件的实体，全部列出
4. 明确标注信息来源的文档和页码

回答格式：
- 直接给出名称/实体答案
- 标注出处和上下文`;
        break;

      case 'boolean':
        intentPrompt = `【回答策略 — 是/否判断】
你需要回答一个需要明确结论的判断性问题。

回答要求：
1. **先给出明确结论**：是/否/是的/不是（不要模棱两可）
2. 然后给出支撑结论的**具体数据或原文引用**
3. 如果证据不充分，说明"根据已检索文档，倾向于……但信息不完整"
4. 不要在没有证据的情况下给出肯定或否定结论

回答格式：
- 第一句话：明确结论
- 后续：引用支撑数据和出处`;
        break;

      case 'comparative':
        intentPrompt = `【回答策略 — 对比分析】
你需要回答一个涉及多个对象/指标/时间段对比的问题。

回答要求：
1. **逐一列出**每个对比对象的相关数据，确保覆盖所有被比较的对象
2. 使用简洁的分点格式呈现对比数据
3. 在列出数据后给出**明确的比较结论**
4. 如果某个对比对象的数据缺失，明确指出"未找到XX公司/指标的数据"
5. 不要只回答部分对象——如果问A和B的对比，必须同时回答A和B
6. **不要大段引用原文**，用精炼语言总结关键数据`;
        break;

      case 'open':
        intentPrompt = `【回答策略 — 开放性分析】
你需要回答一个开放性的分析问题（如竞争优势、风险分析、发展前景等）。

回答要求：
1. 回答必须**有理有据**，每个观点都要有检索文档中的数据支撑
2. 使用分点式结构组织回答，逻辑清晰
3. 区分"文档中明确提到的事实"和"基于事实的合理推断"
4. 如果检索内容不足以做全面分析，说明信息覆盖范围的局限性
5. **不要大段引用原文**，用精炼语言归纳要点`;
        break;

      default: // 'string' 或未知类型
        intentPrompt = `【回答策略 — 通用查询】
回答要求：
1. 基于检索到的文档内容准确回答
2. 引用具体来源（文档名称、页码、章节）
3. 确保每个关键数据点都能在检索结果中找到出处
4. 使用专业但易懂的中文回答`;
        break;
    }

    const systemPrompt = `你是Finspark AI财报知识库助手。你严格基于知识库中的公司财报文档回答用户问题。

${contextBlock}

${intentPrompt}

${baseRules}`;

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
  gpuProvider?: GpuProvider,
  fts5Service?: FTS5Service
): PipelineService {
  return new PipelineService(db, kv, ragService, bm25Service, intentService, apiKey, autoSyncService, gpuProvider, fts5Service);
}
