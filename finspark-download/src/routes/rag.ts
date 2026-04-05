/**
 * RAG 知识库 API 路由
 * 
 * 提供：
 * - 文档上传与管理
 * - RAG问答
 * - 知识库统计
 * 
 * Embedding Provider 自动选择：
 * - 优先 DashScope (text-embedding-v4, 1024维, 中文优化)
 * - 回退 VectorEngine (text-embedding-3-small, 1536维)
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createRAGService, createEmbeddingConfig } from '../services/rag';
import { createBM25Service } from '../services/ragBm25';
import { createFTS5Service } from '../services/ragFts5';
import { createIntentService } from '../services/ragIntent';
import { createPipelineService } from '../services/ragPipeline';
import { createPdfParserService, cleanMineruMarkdown, validatePdfSize, extractStructuredBlocks } from '../services/ragPdfParser';
import { createCninfoService } from '../services/ragCninfo';
import { createAutoSyncService } from '../services/ragAutoSync';
import { createGpuProvider, type GpuProvider } from '../services/ragGpuProvider';
import { authMiddleware } from '../middleware/auth';

const rag = new Hono<{ Bindings: Bindings }>();

/**
 * 创建 RAG 服务实例的辅助函数
 * 自动根据环境变量配置 Embedding Provider
 * 优先级: DashScope (text-embedding-v4) > VectorEngine (text-embedding-3-small)
 */
function createRAGServiceFromEnv(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) {
    throw new Error('VECTORENGINE_API_KEY not configured');
  }

  const embeddingConfig = createEmbeddingConfig({
    dashscopeApiKey: env.DASHSCOPE_API_KEY || undefined,
    vectorengineApiKey: apiKey,
    // DashScope 优先，如果配置了 DASHSCOPE_API_KEY 则使用
    // 否则回退到 VectorEngine
  });

  return createRAGService(env.DB, env.CACHE, apiKey, embeddingConfig, env.VECTORIZE);
}

/**
 * 从请求头中提取用户ID（如果已登录）
 */
function getUserIdFromRequest(c: any): number | undefined {
  try {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId;
    }
  } catch {}
  return undefined;
}

// ==================== 文档管理 ====================

/**
 * 创建 BM25 服务实例
 */
function createBM25ServiceFromEnv(env: Bindings) {
  return createBM25Service(env.DB);
}

/**
 * 创建 GPU Provider 实例
 * 根据环境变量自动配置 GPU 路由（recommended/all_gpu/all_cloud）
 */
function createGpuProviderFromEnv(env: Bindings): GpuProvider {
  return createGpuProvider({
    gpuServerUrl: env.GPU_SERVER_URL,
    gpuLlmModel: env.GPU_LLM_MODEL,
    gpuRoutingMode: env.GPU_ROUTING_MODE,
    gpuProxyAuthToken: env.GPU_PROXY_AUTH_TOKEN,
    cloudApiKey: env.VECTORENGINE_API_KEY,
  });
}

/**
 * 创建 Pipeline 服务实例（增强问答 Pipeline）
 * 支持 GPU 路由：自动根据任务类型选择 GPU 或 Cloud LLM
 */
function createPipelineServiceFromEnv(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');

  const gpuProvider = createGpuProviderFromEnv(env);
  const ragService = createRAGServiceFromEnv(env);
  const bm25Service = createBM25ServiceFromEnv(env);
  
  // 意图识别使用 GPU 路由的 LLM 配置
  const intentLlmConfig = gpuProvider.getLlmConfig('intent');
  const intentService = createIntentService(intentLlmConfig.apiKey, intentLlmConfig.baseUrl, intentLlmConfig.model, intentLlmConfig.extraHeaders);
  
  const autoSyncService = createAutoSyncService(env.DB, env.CACHE, apiKey);
  const fts5Service = createFTS5Service(env.DB);

  return createPipelineService(env.DB, env.CACHE, ragService, bm25Service, intentService, apiKey, autoSyncService, gpuProvider, fts5Service);
}

// ==================== 文档管理（原有）====================

/**
 * POST /upload - 上传文档到知识库
 * 
 * Body: {
 *   title: string,
 *   content: string,          // 文本内容
 *   fileName?: string,
 *   fileType?: 'text' | 'markdown' | 'html',
 *   stockCode?: string,       // 关联股票代码
 *   stockName?: string,
 *   category?: string,        // annual_report | quarterly_report | research | announcement | general
 *   tags?: string[],
 *   chunkSize?: number,       // 分块大小（默认500）
 *   chunkOverlap?: number,    // 重叠大小（默认100）
 * }
 * 
 * Response 额外返回:
 *   embeddingProvider: 'dashscope' | 'vectorengine'
 *   embeddingModel: string
 *   embeddingDimensions: number
 */
rag.post('/upload', async (c) => {
  const { env } = c;
  
  try {
    const body = await c.req.json();
    const { title, content, fileName, fileType, stockCode, stockName, category, tags, chunkSize, chunkOverlap } = body;
    
    if (!title || !content) {
      return c.json({ success: false, error: '标题和内容不能为空' }, 400);
    }
    
    if (content.length > 500000) {
      return c.json({ success: false, error: '文档内容不能超过500,000字符' }, 400);
    }
    
    const userId = getUserIdFromRequest(c);
    const ragService = createRAGServiceFromEnv(env);
    
    // 注入 BM25 索引构建回调（文档入库后自动构建 BM25 索引）
    const bm25Service = createBM25ServiceFromEnv(env);
    ragService.setBM25BuildCallback(async (documentId: number) => {
      await bm25Service.buildIndexForDocument(documentId);
    });
    
    const result = await ragService.ingestDocument({
      title,
      content,
      fileName: fileName || `${title}.txt`,
      fileType: fileType || 'text',
      stockCode,
      stockName,
      category: category || 'general',
      tags: tags || [],
      userId,
      chunkSize: chunkSize || 500,
      chunkOverlap: chunkOverlap || 100,
    });
    
    const embeddingInfo = ragService.getEmbeddingInfo();
    
    return c.json({
      success: true,
      message: `文档 "${title}" 已成功导入知识库`,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      embeddingProvider: embeddingInfo.provider,
      embeddingModel: embeddingInfo.model,
      embeddingDimensions: embeddingInfo.dimensions,
    });
    
  } catch (error) {
    console.error('[RAG Upload Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '文档上传处理失败',
    }, 500);
  }
});

/**
 * POST /upload/pdf - PDF 文件上传与 MinerU 解析
 * 
 * Body: {
 *   fileData: string,          // PDF 文件的 Base64 编码
 *   fileName: string,          // 原始文件名
 *   title?: string,            // 文档标题（默认从文件名提取）
 *   stockCode?: string,
 *   stockName?: string,
 *   category?: string,
 *   tags?: string[],
 *   chunkSize?: number,
 *   chunkOverlap?: number,
 *   parseModel?: string,       // MinerU 解析模型（auto / pipeline / vlm）
 *   enableOcr?: boolean,       // 是否启用 OCR（默认 true）
 *   enableTable?: boolean,     // 是否提取表格（默认 true）
 *   enableFormula?: boolean,   // 是否提取公式（默认 true）
 *   pageRange?: string,        // 指定解析页范围，如 "1-10"
 *   autoIngest?: boolean,      // 解析后是否自动入库（默认 true）
 * }
 */
rag.post('/upload/pdf', async (c) => {
  const { env } = c;

  try {
    const body = await c.req.json();
    const {
      fileData, fileName,
      title, stockCode, stockName, category, tags,
      chunkSize, chunkOverlap,
      parseModel, enableOcr, enableTable, enableFormula, pageRange,
      autoIngest = true,
    } = body;

    // 验证必要参数
    if (!fileData) {
      return c.json({ success: false, error: '请选择 PDF 文件' }, 400);
    }
    if (!fileName) {
      return c.json({ success: false, error: '缺少文件名' }, 400);
    }

    // 验证文件大小
    const sizeCheck = validatePdfSize(fileData);
    if (!sizeCheck.valid) {
      return c.json({ success: false, error: sizeCheck.error }, 400);
    }

    // 检查 MinerU API Key
    const mineruApiKey = env.MINERU_API_KEY;
    if (!mineruApiKey) {
      return c.json({ 
        success: false, 
        error: 'MinerU API Key 未配置。请在环境变量中设置 MINERU_API_KEY。获取地址: https://mineru.net' 
      }, 500);
    }

    // 创建 MinerU 解析服务
    const pdfParser = createPdfParserService({ apiKey: mineruApiKey });

    // 执行解析
    const parseResult = await pdfParser.parsePdf(fileData, fileName, {
      model: parseModel,
      enableOcr: enableOcr !== false,
      enableTable: enableTable !== false,
      enableFormula: enableFormula !== false,
      pageRange,
    });

    // 清理 Markdown
    const cleanedMarkdown = cleanMineruMarkdown(parseResult.markdown);

    if (cleanedMarkdown.length < 10) {
      return c.json({
        success: false,
        error: 'PDF 解析结果内容过少，可能是纯图片 PDF 或空白页',
      }, 400);
    }

    // 提取结构化块（表格→HTML, 页码/章节追踪）
    const structuredBlocks = extractStructuredBlocks(cleanedMarkdown);
    const tableCount = structuredBlocks.filter(b => b.type === 'table').length;
    console.log(`[RAG PDF] Extracted ${structuredBlocks.length} blocks (${tableCount} tables)`);

    // 构建文档标题
    const docTitle = title || fileName.replace(/\.pdf$/i, '') || '未命名 PDF';

    // 如果不需要自动入库，仅返回解析结果
    if (!autoIngest) {
      return c.json({
        success: true,
        message: 'PDF 解析完成',
        parsed: {
          markdown: cleanedMarkdown,
          fileName: parseResult.fileName,
          pageCount: parseResult.pageCount,
          parseDurationMs: parseResult.parseDurationMs,
          model: parseResult.model,
          contentLength: cleanedMarkdown.length,
          structuredBlockCount: structuredBlocks.length,
          tableCount,
        },
      });
    }

    // 自动入库（使用结构感知分块）
    const userId = getUserIdFromRequest(c);
    const ragService = createRAGServiceFromEnv(env);

    const bm25Service = createBM25ServiceFromEnv(env);
    ragService.setBM25BuildCallback(async (documentId: number) => {
      await bm25Service.buildIndexForDocument(documentId);
    });

    const result = await ragService.ingestDocument({
      title: docTitle,
      content: cleanedMarkdown,
      fileName: fileName,
      fileType: 'pdf',
      stockCode,
      stockName,
      category: category || 'general',
      tags: tags || [],
      userId,
      chunkSize: chunkSize || 500,
      chunkOverlap: chunkOverlap || 100,
      structuredBlocks, // 传入结构化块，启用结构感知分块
    });

    const embeddingInfo = ragService.getEmbeddingInfo();

    return c.json({
      success: true,
      message: `PDF "${docTitle}" 已成功解析并导入知识库`,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      parsed: {
        fileName: parseResult.fileName,
        pageCount: parseResult.pageCount,
        parseDurationMs: parseResult.parseDurationMs,
        model: parseResult.model,
        contentLength: cleanedMarkdown.length,
        fullZipUrl: parseResult.fullZipUrl,
      },
      embeddingProvider: embeddingInfo.provider,
      embeddingModel: embeddingInfo.model,
      embeddingDimensions: embeddingInfo.dimensions,
    });

  } catch (error) {
    console.error('[RAG PDF Upload Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'PDF 上传解析失败',
    }, 500);
  }
});

/**
 * POST /upload/pdf/parse-only - 仅解析 PDF，不入库（预览用）
 * 
 * Body: {
 *   fileData: string,
 *   fileName: string,
 *   parseModel?: string,
 *   enableOcr?: boolean,
 *   pageRange?: string,
 * }
 */
rag.post('/upload/pdf/parse-only', async (c) => {
  const { env } = c;

  try {
    const body = await c.req.json();
    const { fileData, fileName, parseModel, enableOcr, pageRange } = body;

    if (!fileData || !fileName) {
      return c.json({ success: false, error: '请选择 PDF 文件' }, 400);
    }

    const sizeCheck = validatePdfSize(fileData);
    if (!sizeCheck.valid) {
      return c.json({ success: false, error: sizeCheck.error }, 400);
    }

    const mineruApiKey = env.MINERU_API_KEY;
    if (!mineruApiKey) {
      return c.json({ success: false, error: 'MinerU API Key 未配置' }, 500);
    }

    const pdfParser = createPdfParserService({ apiKey: mineruApiKey });

    const parseResult = await pdfParser.parsePdf(fileData, fileName, {
      model: parseModel,
      enableOcr: enableOcr !== false,
      pageRange,
    });

    const cleanedMarkdown = cleanMineruMarkdown(parseResult.markdown);

    return c.json({
      success: true,
      markdown: cleanedMarkdown,
      fileName: parseResult.fileName,
      pageCount: parseResult.pageCount,
      parseDurationMs: parseResult.parseDurationMs,
      model: parseResult.model,
      contentLength: cleanedMarkdown.length,
      sizeMB: sizeCheck.sizeMB,
    });

  } catch (error) {
    console.error('[RAG PDF Parse Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'PDF 解析失败',
    }, 500);
  }
});

/**
 * GET /upload/pdf/health - 检查 MinerU API 可用性
 */
rag.get('/upload/pdf/health', async (c) => {
  const { env } = c;

  try {
    const mineruApiKey = env.MINERU_API_KEY;
    if (!mineruApiKey) {
      return c.json({
        success: true,
        available: false,
        message: 'MINERU_API_KEY 未配置',
      });
    }

    const pdfParser = createPdfParserService({ apiKey: mineruApiKey });
    const health = await pdfParser.checkHealth();

    return c.json({
      success: true,
      ...health,
    });
  } catch (error) {
    return c.json({
      success: true,
      available: false,
      message: error instanceof Error ? error.message : 'MinerU 健康检查失败',
    });
  }
});

/**
 * GET /documents - 获取知识库文档列表
 */
rag.get('/documents', async (c) => {
  const { env } = c;
  
  try {
    const stockCode = c.req.query('stockCode') || undefined;
    const category = c.req.query('category') || undefined;
    const status = c.req.query('status') || undefined;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const ragService = createRAGServiceFromEnv(env);
    
    const result = await ragService.listDocuments({
      stockCode,
      category,
      status,
      limit,
      offset,
    });
    
    return c.json({
      success: true,
      ...result,
    });
    
  } catch (error) {
    console.error('[RAG List Documents Error]', error);
    return c.json({
      success: false,
      error: '获取文档列表失败',
    }, 500);
  }
});

/**
 * GET /documents/:id - 获取文档详情
 */
rag.get('/documents/:id', async (c) => {
  const { env } = c;
  
  try {
    const documentId = parseInt(c.req.param('id'));
    if (!documentId) {
      return c.json({ success: false, error: '无效的文档ID' }, 400);
    }
    
    const ragService = createRAGServiceFromEnv(env);
    const doc = await ragService.getDocument(documentId);
    
    if (!doc) {
      return c.json({ success: false, error: '文档不存在' }, 404);
    }
    
    return c.json({ success: true, document: doc });
    
  } catch (error) {
    console.error('[RAG Get Document Error]', error);
    return c.json({ success: false, error: '获取文档详情失败' }, 500);
  }
});

/**
 * DELETE /documents/:id - 删除文档
 */
rag.delete('/documents/:id', async (c) => {
  const { env } = c;
  
  try {
    const documentId = parseInt(c.req.param('id'));
    if (!documentId) {
      return c.json({ success: false, error: '无效的文档ID' }, 400);
    }
    
    const ragService = createRAGServiceFromEnv(env);
    await ragService.deleteDocument(documentId);
    
    return c.json({ success: true, message: '文档已删除' });
    
  } catch (error) {
    console.error('[RAG Delete Document Error]', error);
    return c.json({ success: false, error: '删除文档失败' }, 500);
  }
});

// ==================== RAG 问答 ====================

/**
 * POST /query - RAG知识库问答
 * 
 * Body: {
 *   question: string,          // 用户问题
 *   sessionId?: string,        // 会话ID（用于多轮对话）
 *   stockCode?: string,        // 限定特定股票的文档
 *   documentIds?: number[],    // 限定特定文档
 *   conversationHistory?: Array<{role: string, content: string}>,
 *   topK?: number,             // 检索文档数量（默认5）
 * }
 */
rag.post('/query', async (c) => {
  const { env } = c;
  
  try {
    const { question, sessionId, stockCode, documentIds, conversationHistory, topK } = await c.req.json();
    
    if (!question) {
      return c.json({ success: false, error: '请输入问题' }, 400);
    }
    
    const userId = getUserIdFromRequest(c);
    const ragService = createRAGServiceFromEnv(env);
    
    const result = await ragService.ragQuery({
      question,
      sessionId,
      stockCode,
      documentIds,
      conversationHistory: conversationHistory || [],
      topK: topK || 5,
      userId,
    });
    
    return c.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      sessionId: result.sessionId,
      sourceCount: result.sources.length,
    });
    
  } catch (error) {
    console.error('[RAG Query Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'RAG问答失败',
    }, 500);
  }
});

/**
 * POST /search - 纯向量检索（不生成回答，仅返回相关文档片段）
 * 
 * Body: {
 *   query: string,
 *   topK?: number,
 *   minScore?: number,
 *   stockCode?: string,
 *   category?: string,
 * }
 */
rag.post('/search', async (c) => {
  const { env } = c;
  
  try {
    const { query, topK, minScore, stockCode, category } = await c.req.json();
    
    if (!query) {
      return c.json({ success: false, error: '请输入检索内容' }, 400);
    }
    
    const ragService = createRAGServiceFromEnv(env);
    
    const results = await ragService.searchSimilar(query, {
      topK: topK || 10,
      minScore: minScore || 0.25,
      stockCode,
      category,
    });
    
    return c.json({
      success: true,
      results: results.map(r => ({
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        content: r.chunk.content,
        score: Math.round(r.score * 1000) / 1000,
        chunkIndex: r.chunk.chunkIndex,
      })),
      totalResults: results.length,
    });
    
  } catch (error) {
    console.error('[RAG Search Error]', error);
    return c.json({
      success: false,
      error: '检索失败',
    }, 500);
  }
});

// ==================== 知识库统计 ====================

/**
 * GET /stats - 获取知识库统计
 * 
 * Response 额外返回当前 Embedding 配置信息:
 *   embeddingProvider: 'dashscope' | 'vectorengine'
 *   embeddingModel: string
 *   embeddingDimensions: number
 */
rag.get('/stats', async (c) => {
  const { env } = c;
  
  try {
    const ragService = createRAGServiceFromEnv(env);
    const stats = await ragService.getStats();
    const embeddingInfo = ragService.getEmbeddingInfo();
    
    return c.json({
      success: true,
      ...stats,
      embeddingProvider: embeddingInfo.provider,
      embeddingModel: embeddingInfo.model,
      embeddingDimensions: embeddingInfo.dimensions,
    });
    
  } catch (error) {
    console.error('[RAG Stats Error]', error);
    return c.json({ success: false, error: '获取统计信息失败' }, 500);
  }
});

// ==================== Chunk CRUD（Phase 1 新增）====================

/**
 * GET /chunks - Chunk 列表（分页/筛选）
 * 
 * Query: ?documentId=&type=&search=&limit=20&offset=0
 */
rag.get('/chunks', async (c) => {
  const { env } = c;

  try {
    const documentId = c.req.query('documentId') ? parseInt(c.req.query('documentId')!) : undefined;
    const chunkType = c.req.query('type') || undefined;
    const search = c.req.query('search') || undefined;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const ragService = createRAGServiceFromEnv(env);
    const result = await ragService.listChunks({ documentId, chunkType, search, limit, offset });

    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG List Chunks Error]', error);
    return c.json({ success: false, error: '获取 Chunk 列表失败' }, 500);
  }
});

/**
 * GET /chunks/:id - Chunk 详情
 */
rag.get('/chunks/:id', async (c) => {
  const { env } = c;

  try {
    const chunkId = parseInt(c.req.param('id'));
    if (!chunkId) {
      return c.json({ success: false, error: '无效的 Chunk ID' }, 400);
    }

    const ragService = createRAGServiceFromEnv(env);
    const chunk = await ragService.getChunk(chunkId);

    if (!chunk) {
      return c.json({ success: false, error: 'Chunk 不存在' }, 404);
    }

    return c.json({ success: true, chunk });
  } catch (error) {
    console.error('[RAG Get Chunk Error]', error);
    return c.json({ success: false, error: '获取 Chunk 详情失败' }, 500);
  }
});

/**
 * PUT /chunks/:id - 编辑 Chunk 内容（重新向量化 + 更新 BM25 索引）
 * 
 * Body: { content: string }
 */
rag.put('/chunks/:id', async (c) => {
  const { env } = c;

  try {
    const chunkId = parseInt(c.req.param('id'));
    if (!chunkId) {
      return c.json({ success: false, error: '无效的 Chunk ID' }, 400);
    }

    const { content } = await c.req.json();
    if (!content || typeof content !== 'string') {
      return c.json({ success: false, error: '内容不能为空' }, 400);
    }

    const ragService = createRAGServiceFromEnv(env);
    const result = await ragService.updateChunk(chunkId, content);

    // 同时更新 BM25 索引：获取 chunk 的 document_id 重建该文档索引
    try {
      const chunk = await ragService.getChunk(chunkId);
      if (chunk) {
        const bm25Service = createBM25ServiceFromEnv(env);
        await bm25Service.buildIndexForDocument(chunk.document_id as number);
      }
    } catch (bm25Error) {
      console.error('[RAG] BM25 re-index after chunk update failed:', bm25Error);
    }

    return c.json({ success: true, message: 'Chunk 已更新并重新向量化', ...result });
  } catch (error) {
    console.error('[RAG Update Chunk Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '更新 Chunk 失败',
    }, 500);
  }
});

/**
 * DELETE /chunks/:id - 删除 Chunk
 */
rag.delete('/chunks/:id', async (c) => {
  const { env } = c;

  try {
    const chunkId = parseInt(c.req.param('id'));
    if (!chunkId) {
      return c.json({ success: false, error: '无效的 Chunk ID' }, 400);
    }

    const ragService = createRAGServiceFromEnv(env);
    await ragService.deleteChunk(chunkId);

    return c.json({ success: true, message: 'Chunk 已删除' });
  } catch (error) {
    console.error('[RAG Delete Chunk Error]', error);
    return c.json({ success: false, error: '删除 Chunk 失败' }, 500);
  }
});

/**
 * POST /chunks/:id/similar - 以 Chunk 内容为 Query 的相似搜索
 * 
 * Body: { topK?: number }
 */
rag.post('/chunks/:id/similar', async (c) => {
  const { env } = c;

  try {
    const chunkId = parseInt(c.req.param('id'));
    if (!chunkId) {
      return c.json({ success: false, error: '无效的 Chunk ID' }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const topK = body.topK || 5;

    const ragService = createRAGServiceFromEnv(env);
    const chunk = await ragService.getChunk(chunkId);

    if (!chunk) {
      return c.json({ success: false, error: 'Chunk 不存在' }, 404);
    }

    const results = await ragService.searchSimilar(chunk.content as string, {
      topK,
      minScore: 0.3,
    });

    // 过滤掉自身
    const filtered = results.filter((r) => r.chunk.id !== chunkId);

    return c.json({
      success: true,
      results: filtered.map((r) => ({
        chunkId: r.chunk.id,
        documentId: r.documentId,
        documentTitle: r.documentTitle,
        content: r.chunk.content,
        score: Math.round(r.score * 1000) / 1000,
        chunkIndex: r.chunk.chunkIndex,
      })),
      totalResults: filtered.length,
    });
  } catch (error) {
    console.error('[RAG Similar Chunks Error]', error);
    return c.json({ success: false, error: '相似 Chunk 搜索失败' }, 500);
  }
});

/**
 * POST /chunks/reindex/:documentId - 重建文档的 BM25 + Embedding 索引
 */
rag.post('/chunks/reindex/:documentId', async (c) => {
  const { env } = c;

  try {
    const documentId = parseInt(c.req.param('documentId'));
    if (!documentId) {
      return c.json({ success: false, error: '无效的文档 ID' }, 400);
    }

    const bm25Service = createBM25ServiceFromEnv(env);
    const stats = await bm25Service.buildIndexForDocument(documentId);

    return c.json({
      success: true,
      message: `文档 ${documentId} BM25 索引已重建`,
      tokenCount: stats.tokenCount,
      chunkCount: stats.chunkCount,
    });
  } catch (error) {
    console.error('[RAG Reindex Error]', error);
    return c.json({ success: false, error: '重建索引失败' }, 500);
  }
});

// ==================== 增强问答（Phase 1 新增）====================

/**
 * POST /query/enhanced - 增强版 RAG 问答（混合检索 + 意图识别 + 可选 LLM 重排）
 * 
 * Body: {
 *   question: string,
 *   sessionId?: string,
 *   config?: {
 *     enableBm25?: boolean,
 *     enableRerank?: boolean,
 *     topK?: number,
 *     minScore?: number,
 *     rerankWeight?: number,
 *     documentIds?: number[],
 *     stockCode?: string,
 *   },
 *   conversationHistory?: Array<{role: string, content: string}>,
 * }
 */
rag.post('/query/enhanced', async (c) => {
  const { env } = c;

  try {
    const body = await c.req.json();
    const { question, sessionId, config, conversationHistory } = body;

    if (!question) {
      return c.json({ success: false, error: '请输入问题' }, 400);
    }

    const userId = getUserIdFromRequest(c);
    const pipelineService = createPipelineServiceFromEnv(env);

    const result = await pipelineService.enhancedQuery({
      question,
      sessionId,
      config,
      conversationHistory: conversationHistory || [],
      userId,
    });

    return c.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      sessionId: result.sessionId,
      pipeline: result.pipeline,
      messageLogId: result.messageLogId,
    });
  } catch (error) {
    console.error('[RAG Enhanced Query Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '增强问答失败',
    }, 500);
  }
});

// ==================== Pipeline 任务（Phase 1 新增）====================

/**
 * GET /pipeline/status/:taskId - 获取 Pipeline 任务进度
 */
rag.get('/pipeline/status/:taskId', async (c) => {
  const { env } = c;

  try {
    const taskId = parseInt(c.req.param('taskId'));
    if (!taskId) {
      return c.json({ success: false, error: '无效的任务 ID' }, 400);
    }

    const pipelineService = createPipelineServiceFromEnv(env);
    const progress = await pipelineService.getTaskProgress(taskId);

    if (!progress) {
      return c.json({ success: false, error: '任务不存在' }, 404);
    }

    return c.json({ success: true, ...progress });
  } catch (error) {
    console.error('[RAG Pipeline Status Error]', error);
    return c.json({ success: false, error: '获取任务进度失败' }, 500);
  }
});

// ==================== 切片预览（Phase 1 新增）====================

/**
 * POST /upload/preview - 切片预览（不入库，仅返回分块结果）
 * 
 * Body: { content: string, chunkSize?: number, chunkOverlap?: number }
 */
rag.post('/upload/preview', async (c) => {
  const { env } = c;

  try {
    const { content, chunkSize, chunkOverlap } = await c.req.json();

    if (!content) {
      return c.json({ success: false, error: '内容不能为空' }, 400);
    }

    const ragService = createRAGServiceFromEnv(env);
    const result = ragService.previewChunking(content, {
      chunkSize: chunkSize || 500,
      chunkOverlap: chunkOverlap || 100,
    });

    // 只返回前 20 个 chunk 预览（避免响应体过大）
    return c.json({
      success: true,
      chunks: result.chunks.slice(0, 20),
      stats: result.stats,
      hasMore: result.chunks.length > 20,
    });
  } catch (error) {
    console.error('[RAG Preview Error]', error);
    return c.json({ success: false, error: '切片预览失败' }, 500);
  }
});

// ==================== 仪表盘（Phase 1 新增）====================

/**
 * GET /stats/dashboard - 仪表盘聚合数据
 */
rag.get('/stats/dashboard', async (c) => {
  const { env } = c;

  try {
    const ragService = createRAGServiceFromEnv(env);
    const dashboard = await ragService.getDashboardStats();

    return c.json({ success: true, ...dashboard });
  } catch (error) {
    console.error('[RAG Dashboard Stats Error]', error);
    return c.json({ success: false, error: '获取仪表盘数据失败' }, 500);
  }
});

// ==================== 日志查询（Phase 1 新增）====================

/**
 * GET /logs/recent - 问答日志（支持筛选和分页）
 * 
 * Query: ?limit=10&offset=0&intentType=&status=&sessionId=
 * 
 * 前端 Chat Logs / Intent Logs / Pipeline Tracking 页面共用此端点
 */
rag.get('/logs/recent', async (c) => {
  const { env } = c;

  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    const intentType = c.req.query('intentType') || undefined;
    const status = c.req.query('status') || undefined;
    const sessionId = c.req.query('sessionId') || undefined;

    const pipelineService = createPipelineServiceFromEnv(env);

    // If no filters, use simple recent logs; otherwise use getLogs with filters
    if (!intentType && !status && !sessionId && offset === 0) {
      const logs = await pipelineService.getRecentLogs(limit);
      return c.json({ success: true, logs });
    }

    const result = await pipelineService.getLogs({
      intentType,
      status,
      sessionId,
      limit,
      offset,
    });

    return c.json({ success: true, logs: result.logs, total: result.total });
  } catch (error) {
    console.error('[RAG Recent Logs Error]', error);
    return c.json({ success: false, error: '获取日志失败' }, 500);
  }
});

/**
 * GET /logs/list - 问答日志列表（带完整分页和筛选）
 * 
 * Query: ?limit=20&offset=0&intentType=&status=&sessionId=
 * 
 * 返回: { success, logs, total }
 */
rag.get('/logs/list', async (c) => {
  const { env } = c;

  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    const intentType = c.req.query('intentType') || undefined;
    const status = c.req.query('status') || undefined;
    const sessionId = c.req.query('sessionId') || undefined;

    const pipelineService = createPipelineServiceFromEnv(env);
    const result = await pipelineService.getLogs({
      intentType,
      status,
      sessionId,
      limit,
      offset,
    });

    return c.json({
      success: true,
      logs: result.logs,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[RAG Logs List Error]', error);
    return c.json({ success: false, error: '获取日志列表失败' }, 500);
  }
});

/**
 * GET /logs/export - 导出问答日志为 JSON
 * 
 * Query: ?intentType=&status=&limit=1000
 */
rag.get('/logs/export', async (c) => {
  const { env } = c;

  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '1000'), 5000);
    const intentType = c.req.query('intentType') || undefined;
    const status = c.req.query('status') || undefined;

    const pipelineService = createPipelineServiceFromEnv(env);
    const result = await pipelineService.getLogs({
      intentType,
      status,
      limit,
      offset: 0,
    });

    return c.json({
      success: true,
      exportedAt: new Date().toISOString(),
      totalExported: result.logs.length,
      logs: result.logs,
    });
  } catch (error) {
    console.error('[RAG Logs Export Error]', error);
    return c.json({ success: false, error: '导出日志失败' }, 500);
  }
});

// ==================== BM25 索引管理（Phase 1 新增）====================

/**
 * GET /bm25/stats - BM25 索引统计
 */
rag.get('/bm25/stats', async (c) => {
  const { env } = c;

  try {
    const bm25Service = createBM25ServiceFromEnv(env);
    const stats = await bm25Service.getIndexStats();

    return c.json({ success: true, ...stats });
  } catch (error) {
    console.error('[RAG BM25 Stats Error]', error);
    return c.json({ success: false, error: '获取 BM25 索引统计失败' }, 500);
  }
});

/**
 * POST /bm25/search - 纯 BM25 关键词检索
 * 
 * Body: { query: string, topK?: number, documentIds?: number[], stockCode?: string }
 */
rag.post('/bm25/search', async (c) => {
  const { env } = c;

  try {
    const { query, topK, documentIds, stockCode } = await c.req.json();

    if (!query) {
      return c.json({ success: false, error: '请输入检索内容' }, 400);
    }

    const bm25Service = createBM25ServiceFromEnv(env);
    const results = await bm25Service.search(query, {
      topK: topK || 10,
      documentIds,
      stockCode,
    });

    return c.json({
      success: true,
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('[RAG BM25 Search Error]', error);
    return c.json({ success: false, error: 'BM25 检索失败' }, 500);
  }
});

// ==================== Week 2 新增端点 ====================

/**
 * POST /bm25/reindex-all - 重建所有文档的 BM25 索引
 * 
 * 用于初始化或修复索引。执行时间可能较长。
 */
rag.post('/bm25/reindex-all', async (c) => {
  const { env } = c;

  try {
    const bm25Service = createBM25ServiceFromEnv(env);
    const result = await bm25Service.reindexAllDocuments();

    return c.json({
      success: true,
      message: `BM25 索引重建完成: ${result.documentsProcessed} 个文档`,
      documentsProcessed: result.documentsProcessed,
      totalTokens: result.totalTokens,
      totalChunks: result.totalChunks,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[RAG BM25 Reindex All Error]', error);
    return c.json({ success: false, error: '批量重建 BM25 索引失败' }, 500);
  }
});

/**
 * GET /documents/:id/chunks - 获取指定文档的所有 Chunk（带分页）
 * 
 * Query: ?limit=20&offset=0&search=
 * 
 * 比通用的 /chunks?documentId= 更语义化，前端知识库浏览器使用
 */
rag.get('/documents/:id/chunks', async (c) => {
  const { env } = c;

  try {
    const documentId = parseInt(c.req.param('id'));
    if (!documentId) {
      return c.json({ success: false, error: '无效的文档 ID' }, 400);
    }

    const search = c.req.query('search') || undefined;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const ragService = createRAGServiceFromEnv(env);

    // Verify document exists
    const doc = await ragService.getDocument(documentId);
    if (!doc) {
      return c.json({ success: false, error: '文档不存在' }, 404);
    }

    const result = await ragService.listChunks({
      documentId,
      search,
      limit,
      offset,
    });

    return c.json({
      success: true,
      documentId,
      documentTitle: doc.title,
      ...result,
    });
  } catch (error) {
    console.error('[RAG Document Chunks Error]', error);
    return c.json({ success: false, error: '获取文档 Chunk 列表失败' }, 500);
  }
});

/**
 * POST /chunks/batch-delete - 批量删除 Chunk
 * 
 * Body: { chunkIds: number[] }
 */
rag.post('/chunks/batch-delete', async (c) => {
  const { env } = c;

  try {
    const { chunkIds } = await c.req.json();

    if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
      return c.json({ success: false, error: '请提供要删除的 Chunk ID 列表' }, 400);
    }

    if (chunkIds.length > 100) {
      return c.json({ success: false, error: '单次最多删除 100 个 Chunk' }, 400);
    }

    const ragService = createRAGServiceFromEnv(env);
    const results: Array<{ chunkId: number; success: boolean; error?: string }> = [];

    for (const chunkId of chunkIds) {
      try {
        await ragService.deleteChunk(chunkId);
        results.push({ chunkId, success: true });
      } catch (e) {
        results.push({
          chunkId,
          success: false,
          error: e instanceof Error ? e.message : '删除失败',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return c.json({
      success: true,
      message: `已删除 ${successCount}/${chunkIds.length} 个 Chunk`,
      results,
    });
  } catch (error) {
    console.error('[RAG Batch Delete Chunks Error]', error);
    return c.json({ success: false, error: '批量删除 Chunk 失败' }, 500);
  }
});

/**
 * GET /conversations/:sessionId - 获取指定会话的对话历史
 * 
 * 用于 Chat 页面加载历史对话
 */
rag.get('/conversations/:sessionId', async (c) => {
  const { env } = c;

  try {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ success: false, error: '无效的会话 ID' }, 400);
    }

    const result = await env.DB.prepare(
      `SELECT id, role, content, sources, metadata, created_at 
       FROM rag_conversations 
       WHERE session_id = ? 
       ORDER BY created_at ASC`
    )
      .bind(sessionId)
      .all();

    const messages = (result.results || []).map((r: any) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      sources: r.sources ? JSON.parse(r.sources) : [],
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
      createdAt: r.created_at,
    }));

    return c.json({
      success: true,
      sessionId,
      messages,
      messageCount: messages.length,
    });
  } catch (error) {
    console.error('[RAG Conversations Error]', error);
    return c.json({ success: false, error: '获取对话历史失败' }, 500);
  }
});

/**
 * GET /conversations - 获取会话列表（每个 session 的最新一条消息）
 * 
 * Query: ?limit=20&offset=0
 */
rag.get('/conversations', async (c) => {
  const { env } = c;

  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await env.DB.prepare(
      `SELECT session_id, 
              MIN(CASE WHEN role = 'user' THEN content END) as first_question,
              COUNT(*) as message_count,
              MAX(created_at) as last_active
       FROM rag_conversations 
       GROUP BY session_id 
       ORDER BY last_active DESC
       LIMIT ? OFFSET ?`
    )
      .bind(limit, offset)
      .all();

    const countResult = await env.DB.prepare(
      'SELECT COUNT(DISTINCT session_id) as total FROM rag_conversations'
    ).first<{ total: number }>();

    return c.json({
      success: true,
      sessions: (result.results || []).map((r: any) => ({
        sessionId: r.session_id,
        firstQuestion: r.first_question,
        messageCount: r.message_count,
        lastActive: r.last_active,
      })),
      total: countResult?.total || 0,
    });
  } catch (error) {
    console.error('[RAG Session List Error]', error);
    return c.json({ success: false, error: '获取会话列表失败' }, 500);
  }
});

/**
 * GET /logs/detail/:id - 获取问答日志详情（完整 Pipeline 执行记录）
 */
rag.get('/logs/detail/:id', async (c) => {
  const { env } = c;

  try {
    const logId = parseInt(c.req.param('id'));
    if (!logId) {
      return c.json({ success: false, error: '无效的日志 ID' }, 400);
    }

    const log = await env.DB.prepare(
      'SELECT * FROM rag_message_logs WHERE id = ?'
    )
      .bind(logId)
      .first();

    if (!log) {
      return c.json({ success: false, error: '日志不存在' }, 404);
    }

    // Parse JSON fields
    const parsed = {
      ...log,
      intent_entities: log.intent_entities ? JSON.parse(log.intent_entities as string) : [],
      sources_json: log.sources_json ? JSON.parse(log.sources_json as string) : [],
    };

    return c.json({ success: true, log: parsed });
  } catch (error) {
    console.error('[RAG Log Detail Error]', error);
    return c.json({ success: false, error: '获取日志详情失败' }, 500);
  }
});

/**
 * GET /logs/stats - 问答日志统计（意图分布、延迟趋势等）
 */
rag.get('/logs/stats', async (c) => {
  const { env } = c;

  try {
    // 意图类型分布
    const intentDistResult = await env.DB.prepare(
      `SELECT intent_type, COUNT(*) as count 
       FROM rag_message_logs 
       WHERE intent_type IS NOT NULL
       GROUP BY intent_type 
       ORDER BY count DESC`
    ).all();

    // 检索来源分布（向量 vs BM25 vs 混合）
    const retrievalStatsResult = await env.DB.prepare(
      `SELECT 
         SUM(CASE WHEN bm25_results_count > 0 AND vector_results_count > 0 THEN 1 ELSE 0 END) as hybrid_count,
         SUM(CASE WHEN bm25_results_count = 0 AND vector_results_count > 0 THEN 1 ELSE 0 END) as vector_only_count,
         SUM(CASE WHEN bm25_results_count > 0 AND vector_results_count = 0 THEN 1 ELSE 0 END) as bm25_only_count,
         AVG(total_latency_ms) as avg_latency,
         AVG(vector_latency_ms) as avg_vector_latency,
         AVG(bm25_latency_ms) as avg_bm25_latency,
         AVG(llm_latency_ms) as avg_llm_latency,
         COUNT(*) as total_queries,
         SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
       FROM rag_message_logs`
    ).first();

    // 每日查询量趋势（最近 7 天）
    const dailyTrendResult = await env.DB.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM rag_message_logs
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    ).all();

    return c.json({
      success: true,
      intentDistribution: intentDistResult.results || [],
      retrievalStats: retrievalStatsResult || {},
      dailyTrend: dailyTrendResult.results || [],
    });
  } catch (error) {
    console.error('[RAG Log Stats Error]', error);
    return c.json({ success: false, error: '获取日志统计失败' }, 500);
  }
});

/**
 * GET /pipeline/tasks - 获取 Pipeline 任务列表
 * 
 * Query: ?status=&limit=20&offset=0
 */
/**
 * DELETE /conversations/:sessionId - 删除指定会话的所有消息
 */
rag.delete('/conversations/:sessionId', async (c) => {
  const { env } = c;

  try {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ success: false, error: '无效的会话 ID' }, 400);
    }

    const result = await env.DB.prepare(
      'DELETE FROM rag_conversations WHERE session_id = ?'
    )
      .bind(sessionId)
      .run();

    return c.json({
      success: true,
      message: `会话 ${sessionId} 已删除`,
      deletedCount: result.meta?.changes || 0,
    });
  } catch (error) {
    console.error('[RAG Delete Conversation Error]', error);
    return c.json({ success: false, error: '删除会话失败' }, 500);
  }
});

/**
 * GET /system/health - 系统健康检查
 * 
 * 返回: Embedding/BM25/D1/KV 状态, 索引统计, 服务可用性
 */
rag.get('/system/health', async (c) => {
  const { env } = c;

  try {
    const checks: Record<string, { status: string; detail?: any; latencyMs?: number }> = {};

    // 1. D1 数据库检查
    const d1Start = Date.now();
    try {
      const d1Result = await env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();
      checks.d1 = {
        status: d1Result?.ok === 1 ? 'healthy' : 'degraded',
        latencyMs: Date.now() - d1Start,
      };
    } catch (e) {
      checks.d1 = { status: 'error', detail: (e as Error).message, latencyMs: Date.now() - d1Start };
    }

    // 2. KV 缓存检查
    const kvStart = Date.now();
    try {
      await env.CACHE.put('_health_check', 'ok', { expirationTtl: 60 });
      const val = await env.CACHE.get('_health_check');
      checks.kv = {
        status: val === 'ok' ? 'healthy' : 'degraded',
        latencyMs: Date.now() - kvStart,
      };
    } catch (e) {
      checks.kv = { status: 'error', detail: (e as Error).message, latencyMs: Date.now() - kvStart };
    }

    // 3. 文档 & 分块统计
    try {
      const [docsResult, chunksResult, bm25Result] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed FROM rag_documents").first(),
        env.DB.prepare('SELECT COUNT(*) as total, SUM(has_embedding) as with_embedding FROM rag_chunks').first(),
        env.DB.prepare("SELECT total_docs, avg_doc_length FROM rag_bm25_meta WHERE document_id IS NULL AND source = 'content' LIMIT 1").first().catch(() => null),
      ]);

      checks.documents = {
        status: 'healthy',
        detail: {
          total: (docsResult as any)?.total || 0,
          completed: (docsResult as any)?.completed || 0,
          failed: (docsResult as any)?.failed || 0,
        },
      };

      checks.chunks = {
        status: 'healthy',
        detail: {
          total: (chunksResult as any)?.total || 0,
          withEmbedding: (chunksResult as any)?.with_embedding || 0,
        },
      };

      checks.bm25 = {
        status: bm25Result && (bm25Result as any).total_docs > 0 ? 'healthy' : 'not_indexed',
        detail: bm25Result ? {
          indexedDocs: (bm25Result as any).total_docs || 0,
          avgDocLength: Math.round((bm25Result as any).avg_doc_length || 0),
        } : { indexedDocs: 0 },
      };
    } catch (e) {
      checks.documents = { status: 'error', detail: (e as Error).message };
    }

    // 4. Embedding Provider
    try {
      const ragService = createRAGServiceFromEnv(env);
      const embeddingInfo = ragService.getEmbeddingInfo();
      checks.embedding = {
        status: 'healthy',
        detail: {
          provider: embeddingInfo.provider,
          model: embeddingInfo.model,
          dimensions: embeddingInfo.dimensions,
        },
      };
    } catch (e) {
      checks.embedding = { status: 'error', detail: (e as Error).message };
    }

    // 5. 最近日志统计
    try {
      const logResult = await env.DB.prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                AVG(CASE WHEN status = 'success' THEN total_latency_ms END) as avg_latency
         FROM rag_message_logs
         WHERE created_at >= datetime('now', '-24 hours')`
      ).first();

      checks.recentActivity = {
        status: 'healthy',
        detail: {
          last24h: {
            totalQueries: (logResult as any)?.total || 0,
            successCount: (logResult as any)?.success || 0,
            errorCount: (logResult as any)?.errors || 0,
            avgLatencyMs: Math.round((logResult as any)?.avg_latency || 0),
          },
        },
      };
    } catch (e) {
      checks.recentActivity = { status: 'error', detail: (e as Error).message };
    }

    // Overall status
    const allStatuses = Object.values(checks).map(c => c.status);
    const overallStatus = allStatuses.includes('error') ? 'degraded' : 'healthy';

    return c.json({
      success: true,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    console.error('[RAG System Health Error]', error);
    return c.json({
      success: false,
      status: 'error',
      error: '系统健康检查失败',
    }, 500);
  }
});

/**
 * GET /pipeline/tasks - 获取 Pipeline 任务列表
 * 
 * Query: ?status=&limit=20&offset=0
 */
rag.get('/pipeline/tasks', async (c) => {
  const { env } = c;

  try {
    const status = c.req.query('status') || undefined;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    let sql = `
      SELECT t.*, d.title as document_title
      FROM rag_pipeline_tasks t
      LEFT JOIN rag_documents d ON t.document_id = d.id
    `;
    const binds: any[] = [];

    if (status) {
      sql += ' WHERE t.status = ?';
      binds.push(status);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    binds.push(limit, offset);

    const result = await env.DB.prepare(sql).bind(...binds).all();

    // Count
    let countSql = 'SELECT COUNT(*) as total FROM rag_pipeline_tasks';
    const countBinds: any[] = [];
    if (status) {
      countSql += ' WHERE status = ?';
      countBinds.push(status);
    }
    const countStmt = countBinds.length > 0
      ? env.DB.prepare(countSql).bind(...countBinds)
      : env.DB.prepare(countSql);
    const countResult = await countStmt.first<{ total: number }>();

    return c.json({
      success: true,
      tasks: result.results || [],
      total: countResult?.total || 0,
    });
  } catch (error) {
    console.error('[RAG Pipeline Tasks Error]', error);
    return c.json({ success: false, error: '获取 Pipeline 任务列表失败' }, 500);
  }
});

// ==================== 巨潮 API 财报同步（Feature 3）====================

/**
 * 创建 AutoSync 服务
 */
function createAutoSyncServiceFromEnv(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');
  return createAutoSyncService(env.DB, env.CACHE, apiKey);
}

/**
 * POST /sync/trigger - 手动触发财报同步
 * 
 * Body: {
 *   stockCode: string,       // 股票代码（如 "600519"）
 *   stockName?: string,      // 股票名称
 *   reportType?: string,     // 报告类型：annual / semi_annual / q1 / q3（默认 annual）
 *   reportYear?: number,     // 报告年份（默认最近一年）
 * }
 */
rag.post('/sync/trigger', async (c) => {
  const { env } = c;

  try {
    const { stockCode, stockName, reportType, reportYear } = await c.req.json();

    if (!stockCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const currentYear = new Date().getFullYear();

    const { taskId, status } = await autoSync.triggerSync({
      stockCode: stockCode.replace(/\.\w+$/, ''), // 去掉后缀如 .SH
      stockName,
      reportType: reportType || 'annual',
      reportYear: reportYear || currentYear - 1,
    });

    if (taskId === 0) {
      return c.json({
        success: true,
        message: status === 'already_ingested' ? '该报告已在知识库中' : '同步任务已在进行中',
        status,
      });
    }

    // 尝试在后台执行同步任务
    // 在 Cloudflare Workers 中使用 ctx.waitUntil
    try {
      const cninfoService = createCninfoService();
      const mineruApiKey = env.MINERU_API_KEY;
      
      if (mineruApiKey) {
        const pdfParser = createPdfParserService({ apiKey: mineruApiKey });
        const ragService = createRAGServiceFromEnv(env);
        const bm25Service = createBM25ServiceFromEnv(env);

        // 使用 waitUntil 在后台执行（不阻塞响应）
        const execCtx = (c as any).executionCtx;
        if (execCtx?.waitUntil) {
          execCtx.waitUntil(
            autoSync.executeSyncTask(taskId, {
              cninfo: cninfoService,
              pdfParser,
              ragService,
              bm25Service,
            }).catch((err: Error) => {
              console.error(`[AutoSync] Background execution failed for task #${taskId}:`, err);
            })
          );
        } else {
          // 非 Workers 环境：直接启动（不 await，以非阻塞方式执行）
          autoSync.executeSyncTask(taskId, {
            cninfo: cninfoService,
            pdfParser,
            ragService,
            bm25Service,
          }).catch((err: Error) => {
            console.error(`[AutoSync] Background execution failed for task #${taskId}:`, err);
          });
        }
      } else {
        // 没有 MinerU API Key，标记为失败
        await autoSync.updateSyncTask(taskId, {
          status: 'failed',
          errorMessage: 'MinerU API Key 未配置，无法解析 PDF',
        });
      }
    } catch (bgError) {
      console.error('[AutoSync] Failed to start background execution:', bgError);
    }

    return c.json({
      success: true,
      message: '同步任务已创建并开始执行',
      taskId,
      status: 'created',
    });
  } catch (error) {
    console.error('[RAG Sync Trigger Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '触发同步失败',
    }, 500);
  }
});

/**
 * GET /sync/status - 查询指定股票的同步状态
 * 
 * Query: ?stockCode=600519
 */
rag.get('/sync/status', async (c) => {
  const { env } = c;

  try {
    const stockCode = c.req.query('stockCode');
    if (!stockCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const status = await autoSync.checkStockDataStatus(stockCode.replace(/\.\w+$/, ''));

    return c.json({ success: true, ...status });
  } catch (error) {
    console.error('[RAG Sync Status Error]', error);
    return c.json({ success: false, error: '获取同步状态失败' }, 500);
  }
});

/**
 * GET /sync/tasks - 获取同步任务列表
 * 
 * Query: ?stockCode=&status=&limit=20&offset=0
 */
rag.get('/sync/tasks', async (c) => {
  const { env } = c;

  try {
    const stockCode = c.req.query('stockCode') || undefined;
    const status = c.req.query('status') || undefined;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const autoSync = createAutoSyncServiceFromEnv(env);
    const result = await autoSync.listSyncTasks({ stockCode, status, limit, offset });

    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Sync Tasks Error]', error);
    return c.json({ success: false, error: '获取同步任务列表失败' }, 500);
  }
});

/**
 * GET /sync/task/:id - 获取单个同步任务详情
 */
rag.get('/sync/task/:id', async (c) => {
  const { env } = c;

  try {
    const taskId = parseInt(c.req.param('id'));
    if (!taskId) {
      return c.json({ success: false, error: '无效的任务 ID' }, 400);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const task = await autoSync.getSyncTask(taskId);

    if (!task) {
      return c.json({ success: false, error: '同步任务不存在' }, 404);
    }

    return c.json({ success: true, task });
  } catch (error) {
    console.error('[RAG Sync Task Detail Error]', error);
    return c.json({ success: false, error: '获取同步任务详情失败' }, 500);
  }
});

/**
 * GET /sync/available - 查询巨潮可用的财报列表
 * 
 * Query: ?stockCode=600519&reportType=annual&year=2024
 */
rag.get('/sync/available', async (c) => {
  const { env } = c;

  try {
    const stockCode = c.req.query('stockCode');
    if (!stockCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }

    const reportType = c.req.query('reportType') as any || undefined;
    const year = c.req.query('year') ? parseInt(c.req.query('year')!) : undefined;

    const cninfoService = createCninfoService();
    const reports = await cninfoService.searchFinancialReports(
      stockCode.replace(/\.\w+$/, ''),
      reportType,
      year
    );

    // 检查每个报告是否已入库
    const autoSync = createAutoSyncServiceFromEnv(env);
    const reportsWithStatus = await Promise.all(
      reports.map(async (report) => {
        const ingested = await autoSync.isReportIngested(
          report.stockCode, report.reportType, report.reportYear
        );
        const hasActive = await autoSync.hasActiveSync(
          report.stockCode, report.reportType, report.reportYear
        );
        return {
          ...report,
          ingested,
          syncing: hasActive,
        };
      })
    );

    return c.json({
      success: true,
      reports: reportsWithStatus,
      totalCount: reportsWithStatus.length,
    });
  } catch (error) {
    console.error('[RAG Sync Available Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '查询可用财报失败',
    }, 500);
  }
});

/**
 * GET /sync/cninfo/health - 检查巨潮 API 可用性
 */
rag.get('/sync/cninfo/health', async (c) => {
  try {
    const cninfoService = createCninfoService();
    const health = await cninfoService.checkHealth();
    return c.json({ success: true, ...health });
  } catch (error) {
    return c.json({
      success: true,
      available: false,
      message: error instanceof Error ? error.message : '巨潮 API 健康检查失败',
    });
  }
});

/**
 * POST /sync/ensure - 自动检查并触发同步（供 Pipeline 内部调用）
 * 
 * Body: { stockCode: string, stockName?: string }
 * 
 * 返回：{ status, syncTriggered, newTaskIds }
 */
rag.post('/sync/ensure', async (c) => {
  const { env } = c;

  try {
    const { stockCode, stockName } = await c.req.json();
    if (!stockCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const result = await autoSync.ensureReportsAvailable(
      stockCode.replace(/\.\w+$/, ''),
      stockName
    );

    // 如果触发了新任务，尝试后台执行
    if (result.syncTriggered && result.newTaskIds.length > 0) {
      const mineruApiKey = env.MINERU_API_KEY;
      if (mineruApiKey) {
        const cninfoService = createCninfoService();
        const pdfParser = createPdfParserService({ apiKey: mineruApiKey });
        const ragService = createRAGServiceFromEnv(env);
        const bm25Service = createBM25ServiceFromEnv(env);

        const execCtx = (c as any).executionCtx;
        for (const taskId of result.newTaskIds) {
          const execPromise = autoSync.executeSyncTask(taskId, {
            cninfo: cninfoService,
            pdfParser,
            ragService,
            bm25Service,
          }).catch((err: Error) => {
            console.error(`[AutoSync] Background task #${taskId} failed:`, err);
          });

          if (execCtx?.waitUntil) {
            execCtx.waitUntil(execPromise);
          }
        }
      }
    }

    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Sync Ensure Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '自动同步检查失败',
    }, 500);
  }
});

// ==================== 分步同步推进（Advance Pattern） ====================

/**
 * POST /sync/advance/:id - 推进单个同步任务一步
 * 
 * 状态机模式：每次调用只执行当前状态的下一步
 * 客户端/脚本循环调用直到 needsMoreAdvance === false
 * 
 * 返回: { taskId, previousStatus, currentStatus, progress, action, needsMoreAdvance, error? }
 */
rag.post('/sync/advance/:id', async (c) => {
  const { env } = c;

  try {
    const taskId = parseInt(c.req.param('id'));
    if (!taskId) {
      return c.json({ success: false, error: '无效的任务 ID' }, 400);
    }

    const mineruApiKey = env.MINERU_API_KEY;
    if (!mineruApiKey) {
      return c.json({ success: false, error: 'MINERU_API_KEY 未配置' }, 500);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const cninfoService = createCninfoService();
    const pdfParser = createPdfParserService({ apiKey: mineruApiKey });
    const ragService = createRAGServiceFromEnv(env);
    const bm25Service = createBM25ServiceFromEnv(env);

    const result = await autoSync.advanceSyncTask(taskId, {
      cninfo: cninfoService,
      pdfParser,
      ragService,
      bm25Service,
    });

    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Sync Advance Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '推进同步任务失败',
    }, 500);
  }
});

/**
 * POST /sync/batch-advance - 批量推进所有活跃任务一步
 * 
 * Body: { staleMinutes?: number, resetStale?: boolean, maxTasks?: number }
 * 
 * 1. 可选：先重置停滞任务
 * 2. 对所有非终态任务调用一次 advance
 * 3. 返回每个任务的推进结果
 */
rag.post('/sync/batch-advance', async (c) => {
  const { env } = c;

  try {
    const body = await c.req.json().catch(() => ({}));
    const { staleMinutes = 10, resetStale = false, maxTasks = 20 } = body as any;

    const mineruApiKey = env.MINERU_API_KEY;
    if (!mineruApiKey) {
      return c.json({ success: false, error: 'MINERU_API_KEY 未配置' }, 500);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const cninfoService = createCninfoService();
    const pdfParser = createPdfParserService({ apiKey: mineruApiKey });
    const ragService = createRAGServiceFromEnv(env);
    const bm25Service = createBM25ServiceFromEnv(env);
    const services = { cninfo: cninfoService, pdfParser, ragService, bm25Service };

    // 可选：先重置停滞任务
    let resetResult = null;
    if (resetStale) {
      resetResult = await autoSync.resetStaleTasks(staleMinutes);
    }

    // 获取所有活跃任务
    const { tasks: activeTasks } = await autoSync.listSyncTasks({
      limit: maxTasks,
    });

    const nonTerminalTasks = activeTasks.filter(
      t => t.status !== 'completed' && t.status !== 'failed'
    );

    // 逐个推进（不并发，避免超过 Workers CPU 限制）
    const results = [];
    for (const task of nonTerminalTasks) {
      if (!task.id) continue;
      try {
        const advResult = await autoSync.advanceSyncTask(task.id, services);
        results.push(advResult);
      } catch (err) {
        results.push({
          taskId: task.id,
          previousStatus: task.status,
          currentStatus: 'failed',
          progress: task.progress,
          action: 'advance_error',
          needsMoreAdvance: false,
          error: err instanceof Error ? err.message : '推进失败',
        });
      }
    }

    // 统计
    const summary = {
      total: nonTerminalTasks.length,
      advanced: results.filter(r => r.previousStatus !== r.currentStatus).length,
      completed: results.filter(r => r.currentStatus === 'completed').length,
      failed: results.filter(r => r.currentStatus === 'failed').length,
      stillProcessing: results.filter(r => r.needsMoreAdvance).length,
    };

    return c.json({
      success: true,
      summary,
      resetResult,
      results,
    });
  } catch (error) {
    console.error('[RAG Sync Batch Advance Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '批量推进失败',
    }, 500);
  }
});

/**
 * POST /sync/reset/:id - 重置失败/卡住的任务以便重试
 */
rag.post('/sync/reset/:id', async (c) => {
  const { env } = c;

  try {
    const taskId = parseInt(c.req.param('id'));
    if (!taskId) {
      return c.json({ success: false, error: '无效的任务 ID' }, 400);
    }

    const autoSync = createAutoSyncServiceFromEnv(env);
    const result = await autoSync.resetTaskForRetry(taskId);

    return c.json({ ...result });
  } catch (error) {
    console.error('[RAG Sync Reset Error]', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : '重置任务失败',
    }, 500);
  }
});

/**
 * POST /sync/reset-stale - 批量重置停滞任务
 * 
 * Body: { staleMinutes?: number } (默认 10 分钟)
 */
rag.post('/sync/reset-stale', async (c) => {
  const { env } = c;

  try {
    const body = await c.req.json().catch(() => ({}));
    const { staleMinutes = 10 } = body as any;

    const autoSync = createAutoSyncServiceFromEnv(env);
    const result = await autoSync.resetStaleTasks(staleMinutes);

    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Sync Reset Stale Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '批量重置失败',
    }, 500);
  }
});

// ==================== GPU 服务管理 ====================

/**
 * GET /gpu/status — 获取 GPU 服务器状态和路由配置
 */
rag.get('/gpu/status', async (c) => {
  try {
    const env = c.env;
    const gpuProvider = createGpuProviderFromEnv(env);
    const info = gpuProvider.getInfo();
    
    return c.json({
      success: true,
      data: {
        ...info,
        description: info.gpuEnabled 
          ? `GPU 已启用 (${info.llmModel}@${info.backendEngine}), 路由模式: ${env.GPU_ROUTING_MODE || 'recommended'}`
          : 'GPU 未启用，所有任务使用 Cloud API',
        taskRouting: info.gpuEnabled ? {
          '意图识别': info.routing.intent === 'gpu' ? `GPU (${info.llmModel})` : 'Cloud (GPT-4.1)',
          '重排': info.routing.rerank === 'gpu' ? 'GPU (BGE-Reranker-v2-m3)' : 'Cloud (GPT-4.1-mini LLM重排)',
          '回答生成': info.routing.answer === 'gpu' ? `GPU (${info.llmModel})` 
            : info.routing.answer === 'ab_test' ? 'A/B测试 (GPU vs Cloud)'
            : 'Cloud (GPT-4.1)',
          'HyDE问题生成': info.routing.hyde === 'gpu' ? `GPU (${info.llmModel})` : 'Cloud (GPT-4.1)',
          '摘要': info.routing.summary === 'gpu' ? `GPU (${info.llmModel})` : 'Cloud (GPT-4.1)',
          'NER': info.routing.entity === 'gpu' ? `GPU (${info.llmModel})` : 'Cloud (GPT-4.1)',
          '知识提取': info.routing.knowledge === 'gpu' ? `GPU (${info.llmModel})` : 'Cloud (GPT-4.1)',
          '知识合并': info.routing.knowledgeMerge === 'gpu' ? `GPU (${info.llmModel})` : 'Cloud (GPT-4.1)',
          'Embedding': info.routing.embedding === 'gpu' ? 'GPU (BGE-M3)' : 'Cloud (DashScope/VectorEngine)',
        } : null,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

/**
 * GET /gpu/health — GPU 服务器健康检查
 */
rag.get('/gpu/health', async (c) => {
  try {
    const env = c.env;
    const gpuProvider = createGpuProviderFromEnv(env);
    const health = await gpuProvider.healthCheck();
    
    const allHealthy = health.llm.healthy && health.embedding.healthy && health.reranker.healthy;
    
    return c.json({
      success: true,
      data: {
        overall: allHealthy ? 'healthy' : 'degraded',
        services: health,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: (error as Error).message }, 500);
  }
});

export default rag;
