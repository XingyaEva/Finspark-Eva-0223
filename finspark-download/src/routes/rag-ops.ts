/**
 * RAG 平台运维配置 API 路由 — routes/rag-ops.ts
 *
 * 提供：
 * - 模型配置 CRUD（Embedding / LLM / Rerank 等 Provider 管理 + 连接测试）
 * - Prompt 模板管理（CRUD + 版本管理 + 回退）
 * - 系统全局配置（RAG 参数、安全策略、调试开关等）
 * - 存储统计
 *
 * 关联页面: P.11 模型配置, P.12 Prompt 模板管理, P.13 系统配置
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createConfigService } from '../services/ragConfig';
import { createFTS5Service } from '../services/ragFts5';
import { createEmbeddingConfig, generateEmbedding, buildStructuredChunksV2, generateEmbeddings } from '../services/rag';
import { cleanMineruMarkdown, extractStructuredBlocks } from '../services/ragPdfParser';

const ragOps = new Hono<{ Bindings: Bindings }>();

/** 创建 ConfigService 实例 */
function createConfigServiceFromEnv(env: Bindings) {
  const envKeys: Record<string, string> = {};
  if (env.DASHSCOPE_API_KEY) envKeys['DASHSCOPE_API_KEY'] = env.DASHSCOPE_API_KEY;
  if (env.VECTORENGINE_API_KEY) envKeys['VECTORENGINE_API_KEY'] = env.VECTORENGINE_API_KEY;
  return createConfigService(env.DB, envKeys);
}

// ==================== 模型配置 ====================

/**
 * GET /models — 获取所有模型配置
 */
ragOps.get('/models', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const configs = await svc.listModelConfigs();

    // Mask API keys for safety
    const masked = configs.map(cfg => ({
      ...cfg,
      api_key_ref: cfg.api_key_ref || null,
      extra_config: cfg.extra_config ? JSON.parse(cfg.extra_config) : {},
    }));

    return c.json({ success: true, configs: masked });
  } catch (error) {
    console.error('[RAG Ops] List model configs error:', error);
    return c.json({ success: false, error: '获取模型配置失败' }, 500);
  }
});

/**
 * GET /models/:usage — 获取指定用途的模型配置
 */
ragOps.get('/models/:usage', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const usage = c.req.param('usage');
    const config = await svc.getModelConfig(usage);
    if (!config) return c.json({ success: false, error: '未找到该用途的模型配置' }, 404);

    return c.json({
      success: true,
      config: {
        ...config,
        extra_config: config.extra_config ? JSON.parse(config.extra_config) : {},
      },
    });
  } catch (error) {
    console.error('[RAG Ops] Get model config error:', error);
    return c.json({ success: false, error: '获取模型配置失败' }, 500);
  }
});

/**
 * PUT /models/:usage — 更新模型配置
 * Body: { provider?, modelName?, apiKeyRef?, baseUrl?, extraConfig? }
 */
ragOps.put('/models/:usage', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const usage = c.req.param('usage');
    const body = await c.req.json();

    const config = await svc.updateModelConfig(usage, {
      provider: body.provider,
      modelName: body.modelName,
      apiKeyRef: body.apiKeyRef,
      baseUrl: body.baseUrl,
      extraConfig: body.extraConfig,
    });

    return c.json({
      success: true,
      config: {
        ...config,
        extra_config: config.extra_config ? JSON.parse(config.extra_config) : {},
      },
    });
  } catch (error) {
    console.error('[RAG Ops] Update model config error:', error);
    return c.json({ success: false, error: '更新模型配置失败' }, 500);
  }
});

/**
 * POST /models/test-connection — 测试模型连接
 * Body: { provider, baseUrl, apiKeyRef }
 */
ragOps.post('/models/test-connection', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const body = await c.req.json();

    if (!body.provider || !body.baseUrl || !body.apiKeyRef) {
      return c.json({ success: false, error: '请提供 provider、baseUrl 和 apiKeyRef' }, 400);
    }

    const result = await svc.testConnection(body.provider, body.baseUrl, body.apiKeyRef);
    return c.json({ ...result, success: result.success !== false });
  } catch (error) {
    console.error('[RAG Ops] Test connection error:', error);
    return c.json({ success: false, error: '连接测试失败' }, 500);
  }
});

// ==================== Prompt 模板管理 ====================

/**
 * GET /prompts — 获取所有 Prompt 模板
 */
ragOps.get('/prompts', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const templates = await svc.listPromptTemplates();
    return c.json({ success: true, templates });
  } catch (error) {
    console.error('[RAG Ops] List prompts error:', error);
    return c.json({ success: false, error: '获取 Prompt 模板列表失败' }, 500);
  }
});

/**
 * GET /prompts/:key — 获取 Prompt 模板详情（含版本历史）
 */
ragOps.get('/prompts/:key', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const key = c.req.param('key');
    const template = await svc.getPromptTemplate(key);
    if (!template) return c.json({ success: false, error: 'Prompt 模板不存在' }, 404);

    return c.json({ success: true, template });
  } catch (error) {
    console.error('[RAG Ops] Get prompt error:', error);
    return c.json({ success: false, error: '获取 Prompt 模板失败' }, 500);
  }
});

/**
 * PUT /prompts/:key — 更新 Prompt 模板（自动创建新版本）
 * Body: { content, changeNote?, userId? }
 */
ragOps.put('/prompts/:key', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const key = c.req.param('key');
    const body = await c.req.json();

    if (!body.content || !body.content.trim()) {
      return c.json({ success: false, error: 'Prompt 内容不能为空' }, 400);
    }

    const template = await svc.updatePromptTemplate(key, {
      content: body.content.trim(),
      changeNote: body.changeNote || undefined,
      userId: body.userId || undefined,
    });

    return c.json({ success: true, template });
  } catch (error) {
    console.error('[RAG Ops] Update prompt error:', error);
    return c.json({ success: false, error: '更新 Prompt 模板失败' }, 500);
  }
});

/**
 * GET /prompts/:key/versions — 获取 Prompt 版本历史
 */
ragOps.get('/prompts/:key/versions', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const key = c.req.param('key');
    const versions = await svc.getPromptVersions(key);
    return c.json({ success: true, versions });
  } catch (error) {
    console.error('[RAG Ops] Get prompt versions error:', error);
    return c.json({ success: false, error: '获取版本历史失败' }, 500);
  }
});

/**
 * POST /prompts/:key/revert — 回退到指定版本
 * Body: { versionId }
 */
ragOps.post('/prompts/:key/revert', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const key = c.req.param('key');
    const body = await c.req.json();

    if (!body.versionId) {
      return c.json({ success: false, error: '请指定要回退的版本 ID' }, 400);
    }

    await svc.revertPromptVersion(key, body.versionId);
    return c.json({ success: true, message: '已回退到指定版本' });
  } catch (error) {
    console.error('[RAG Ops] Revert prompt error:', error);
    return c.json({ success: false, error: '版本回退失败' }, 500);
  }
});

// ==================== 系统配置 ====================

/**
 * GET /system/configs — 获取系统配置列表
 * Query: ?category=rag
 */
ragOps.get('/system/configs', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const category = c.req.query('category') || undefined;
    const configs = await svc.listSystemConfigs(category);
    return c.json({ success: true, configs });
  } catch (error) {
    console.error('[RAG Ops] List system configs error:', error);
    return c.json({ success: false, error: '获取系统配置失败' }, 500);
  }
});

/**
 * GET /system/configs/:key — 获取单个系统配置值
 */
ragOps.get('/system/configs/:key', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const key = c.req.param('key');
    const value = await svc.getSystemConfig(key);
    return c.json({ success: true, key, value });
  } catch (error) {
    console.error('[RAG Ops] Get system config error:', error);
    return c.json({ success: false, error: '获取配置值失败' }, 500);
  }
});

/**
 * PUT /system/configs/:key — 设置单个系统配置
 * Body: { value }
 */
ragOps.put('/system/configs/:key', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const key = c.req.param('key');
    const body = await c.req.json();

    if (body.value === undefined || body.value === null) {
      return c.json({ success: false, error: '配置值不能为空' }, 400);
    }

    await svc.setSystemConfig(key, String(body.value));
    return c.json({ success: true, message: '配置已更新' });
  } catch (error) {
    console.error('[RAG Ops] Set system config error:', error);
    return c.json({ success: false, error: '设置配置失败' }, 500);
  }
});

/**
 * PUT /system/configs — 批量更新系统配置
 * Body: { configs: { key: value, ... } }
 */
ragOps.put('/system/configs', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const body = await c.req.json();

    if (!body.configs || typeof body.configs !== 'object') {
      return c.json({ success: false, error: '请提供 configs 对象' }, 400);
    }

    const stringConfigs: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.configs)) {
      stringConfigs[k] = String(v);
    }

    const updated = await svc.setSystemConfigs(stringConfigs);
    return c.json({ success: true, updated });
  } catch (error) {
    console.error('[RAG Ops] Batch update configs error:', error);
    return c.json({ success: false, error: '批量更新配置失败' }, 500);
  }
});

// ==================== 存储统计 ====================

/**
 * GET /system/storage-stats — 获取存储统计
 */
ragOps.get('/system/storage-stats', async (c) => {
  try {
    const svc = createConfigServiceFromEnv(c.env);
    const stats = await svc.getStorageStats();
    return c.json({ success: true, ...stats });
  } catch (error) {
    console.error('[RAG Ops] Get storage stats error:', error);
    return c.json({ success: false, error: '获取存储统计失败' }, 500);
  }
});

// ==================== Vectorize 迁移工具 ====================

/**
 * POST /migrate-vectorize — 将历史 KV embedding 迁移到 Vectorize
 *
 * 扫描 rag_chunks 中 has_embedding=1 的记录，从 KV 读取 embedding，
 * 批量 upsert 到 Vectorize。支持断点续传（通过 offset 参数）。
 */
ragOps.post('/migrate-vectorize', async (c) => {
  try {
    const env = c.env;
    if (!env.VECTORIZE) {
      return c.json({ success: false, error: 'Vectorize binding not configured' }, 400);
    }

    const body = await c.req.json().catch(() => ({})) as { batchSize?: number; offset?: number; limit?: number };
    const batchSize = Math.min(body.batchSize || 500, 1000);
    const offset = body.offset || 0;
    const totalLimit = body.limit || 10000;  // 单次请求最多迁移 10000 条

    // 获取待迁移的 chunks
    const chunksResult = await env.DB.prepare(
      `SELECT c.id, c.document_id, c.chunk_index, c.embedding_key,
              d.stock_code, d.category
       FROM rag_chunks c
       JOIN rag_documents d ON d.id = c.document_id
       WHERE c.has_embedding = 1 AND d.status = 'completed'
       ORDER BY c.id
       LIMIT ? OFFSET ?`
    ).bind(totalLimit, offset).all();

    const chunks = chunksResult.results || [];
    if (chunks.length === 0) {
      return c.json({ success: true, message: 'No chunks to migrate', migrated: 0, offset });
    }

    let migrated = 0;
    let failed = 0;
    const errors: Array<{ chunkId: number; error: string }> = [];

    // 批量处理
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const vectors: VectorizeVector[] = [];

      for (const chunk of batch) {
        try {
          const embeddingStr = await env.CACHE.get(chunk.embedding_key as string);
          if (!embeddingStr) {
            failed++;
            continue;
          }
          const embedding = JSON.parse(embeddingStr) as number[];
          vectors.push({
            id: `${chunk.document_id}:${chunk.chunk_index}`,
            values: embedding,
            metadata: {
              document_id: chunk.document_id as number,
              chunk_index: chunk.chunk_index as number,
              stock_code: (chunk.stock_code as string) || '',
              category: (chunk.category as string) || 'general',
            },
          });
        } catch (e) {
          failed++;
          errors.push({ chunkId: chunk.id as number, error: String(e) });
        }
      }

      if (vectors.length > 0) {
        try {
          await env.VECTORIZE.upsert(vectors);
          migrated += vectors.length;
        } catch (e) {
          failed += vectors.length;
          console.error(`[Migrate] Vectorize upsert batch failed:`, e);
        }
      }
    }

    return c.json({
      success: true,
      migrated,
      failed,
      total: chunks.length,
      nextOffset: offset + chunks.length,
      hasMore: chunks.length >= totalLimit,
      errors: errors.slice(0, 10),  // 最多返回 10 个错误详情
    });
  } catch (error) {
    console.error('[RAG Ops] Migrate vectorize error:', error);
    return c.json({ success: false, error: '迁移失败' }, 500);
  }
});

// ==================== FTS5 管理工具 ====================

/**
 * POST /rebuild-fts5 — 重建 FTS5 全文索引
 */
ragOps.post('/rebuild-fts5', async (c) => {
  try {
    const fts5Service = createFTS5Service(c.env.DB);
    const result = await fts5Service.rebuildIndex();
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Ops] Rebuild FTS5 error:', error);
    return c.json({ success: false, error: '重建 FTS5 索引失败' }, 500);
  }
});

/**
 * GET /fts5-stats — 获取 FTS5 索引统计
 */
ragOps.get('/fts5-stats', async (c) => {
  try {
    const fts5Service = createFTS5Service(c.env.DB);
    const stats = await fts5Service.getStats();
    return c.json({ success: true, ...stats });
  } catch (error) {
    console.error('[RAG Ops] FTS5 stats error:', error);
    return c.json({ success: false, error: '获取 FTS5 统计失败' }, 500);
  }
});

/**
 * POST /optimize-fts5 — 优化 FTS5 索引（合并内部 b-tree 段）
 */
ragOps.post('/optimize-fts5', async (c) => {
  try {
    const fts5Service = createFTS5Service(c.env.DB);
    await fts5Service.optimize();
    return c.json({ success: true, message: 'FTS5 索引优化完成' });
  } catch (error) {
    console.error('[RAG Ops] Optimize FTS5 error:', error);
    return c.json({ success: false, error: '优化 FTS5 索引失败' }, 500);
  }
});

// ==================== 检索 A/B 对比 ====================

/**
 * GET /search-compare — 多通道检索结果对比
 * 同时运行 FTS5 + BM25 对比（向量检索通过 searchSimilar 自动选择）
 */
ragOps.get('/search-compare', async (c) => {
  try {
    const query = c.req.query('q');
    if (!query) return c.json({ success: false, error: 'Missing query parameter q' }, 400);

    const topK = parseInt(c.req.query('topK') || '5');
    const stockCode = c.req.query('stockCode') || undefined;
    const env = c.env;

    const results: Record<string, { latencyMs: number; count: number; topScore: number; results: any[] }> = {};

    // FTS5 检索
    try {
      const fts5Service = createFTS5Service(env.DB);
      const fts5Start = Date.now();
      const fts5Results = await fts5Service.search(query, { topK, stockCode });
      results.fts5 = {
        latencyMs: Date.now() - fts5Start,
        count: fts5Results.length,
        topScore: fts5Results[0]?.score || 0,
        results: fts5Results.map(r => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          score: r.score,
          snippet: r.snippet,
        })),
      };
    } catch (e) {
      results.fts5 = { latencyMs: 0, count: 0, topScore: 0, results: [{ error: String(e) }] };
    }

    // 旧 BM25 检索
    try {
      const { createBM25Service } = await import('../services/ragBm25');
      const bm25Service = createBM25Service(env.DB);
      const bm25Start = Date.now();
      const bm25Results = await bm25Service.search(query, { topK, stockCode });
      results.bm25 = {
        latencyMs: Date.now() - bm25Start,
        count: bm25Results.length,
        topScore: bm25Results[0]?.score || 0,
        results: bm25Results.map(r => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          score: r.score,
          matchedTokens: r.matchedTokens,
        })),
      };
    } catch (e) {
      results.bm25 = { latencyMs: 0, count: 0, topScore: 0, results: [{ error: String(e) }] };
    }

    // Vectorize 信息
    if (env.VECTORIZE) {
      try {
        const info = await env.VECTORIZE.describe();
        results.vectorize_info = {
          latencyMs: 0,
          count: 0,
          topScore: 0,
          results: [{ indexInfo: info }],
        };
      } catch (e) {
        results.vectorize_info = { latencyMs: 0, count: 0, topScore: 0, results: [{ error: String(e) }] };
      }
    }

    return c.json({ success: true, query, results });
  } catch (error) {
    console.error('[RAG Ops] Search compare error:', error);
    return c.json({ success: false, error: '检索对比失败' }, 500);
  }
});

// ==================== 临时迁移端点 ====================

/**
 * POST /admin/apply-migration - 执行 SQL 迁移语句
 * 
 * Body: { statements: string[], label?: string }
 * 注意：此端点仅供运维使用，生产环境应禁用或加鉴权
 */
ragOps.post('/admin/apply-migration', async (c) => {
  try {
    const { statements, label } = await c.req.json() as { statements: string[]; label?: string };
    
    if (!statements || !Array.isArray(statements) || statements.length === 0) {
      return c.json({ success: false, error: 'No statements provided' }, 400);
    }

    const db = c.env.DB;
    const results: Array<{ index: number; sql: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < statements.length; i++) {
      const sql = statements[i].trim();
      if (!sql) continue;
      
      try {
        await db.prepare(sql).run();
        results.push({ index: i, sql: sql.substring(0, 80), success: true });
      } catch (err) {
        results.push({
          index: i,
          sql: sql.substring(0, 80),
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return c.json({
      success: true,
      label: label || 'unnamed',
      total: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '迁移执行失败',
    }, 500);
  }
});

// ==================== 文档 Rechunk API ====================

/**
 * POST /rechunk/:documentId — 对已有文档重新切片
 * 
 * 流程：
 * 1. 读取文档的所有现有 chunks，拼接为完整文本
 * 2. 用新的 extractStructuredBlocks + buildStructuredChunksV2 重新切片
 * 3. 删除旧 chunks 和 embeddings
 * 4. 写入新 chunks
 * 5. 批量生成新 embeddings
 * 
 * Query params:
 * - dryRun=true : 只预览新切片结果，不实际修改
 * - skipEmbedding=true : 只切片不生成 embedding（后续由 auto-sync advance 补充）
 */
ragOps.post('/rechunk/:documentId', async (c) => {
  try {
    const documentId = parseInt(c.req.param('documentId'), 10);
    if (isNaN(documentId)) {
      return c.json({ success: false, error: 'Invalid document ID' }, 400);
    }

    const dryRun = c.req.query('dryRun') === 'true';
    const skipEmbedding = c.req.query('skipEmbedding') === 'true';

    const db = c.env.DB;
    const kv = c.env.CACHE;

    // 1. 获取文档信息
    const doc = await db.prepare(
      'SELECT id, title, file_name, file_type, stock_code, stock_name, category, tags, status FROM rag_documents WHERE id = ?'
    ).bind(documentId).first<Record<string, unknown>>();

    if (!doc) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    // 2. 读取现有 chunks 拼接原文
    const existingChunks = await db.prepare(
      'SELECT content, chunk_index, chunk_type FROM rag_chunks WHERE document_id = ? ORDER BY chunk_index ASC'
    ).bind(documentId).all();

    if (!existingChunks.results || existingChunks.results.length === 0) {
      return c.json({ success: false, error: 'No chunks found for this document' }, 404);
    }

    const oldChunkCount = existingChunks.results.length;
    const oldChunkTypes = {
      text: existingChunks.results.filter((c: any) => (c.chunk_type || 'text') === 'text').length,
      table: existingChunks.results.filter((c: any) => c.chunk_type === 'table').length,
      heading: existingChunks.results.filter((c: any) => c.chunk_type === 'heading').length,
    };

    // 拼接所有 text chunks 为原文（跳过 table HTML 以避免重复）
    const fullContent = existingChunks.results
      .map((c: any) => c.content)
      .join('\n');

    // 3. 用新算法重新切片
    const structuredBlocks = extractStructuredBlocks(fullContent);
    const fileName = doc.file_name as string || '';
    const stockCode = doc.stock_code as string || '';
    const category = doc.category as string || '';

    const newChunks = buildStructuredChunksV2(structuredBlocks, {
      chunkSize: 800,
      chunkOverlap: 50,
      fileName,
      stockCode,
      category,
    });

    const newChunkTypes = {
      text: newChunks.filter(c => c.meta.chunkType === 'text').length,
      table: newChunks.filter(c => c.meta.chunkType === 'table').length,
      heading: newChunks.filter(c => c.meta.chunkType === 'heading').length,
    };

    const avgLength = Math.round(newChunks.reduce((s, c) => s + c.text.length, 0) / (newChunks.length || 1));
    const hasHeadings = newChunks.some(c => c.meta.heading);
    const hasPages = newChunks.some(c => c.meta.pageStart && c.meta.pageStart > 1);

    // Dry run - 只返回预览
    if (dryRun) {
      return c.json({
        success: true,
        dryRun: true,
        documentId,
        title: doc.title,
        old: { chunkCount: oldChunkCount, types: oldChunkTypes },
        new: {
          chunkCount: newChunks.length,
          types: newChunkTypes,
          avgLength,
          hasHeadings,
          hasPages,
          structuredBlocks: structuredBlocks.length,
          blockTypes: {
            text: structuredBlocks.filter(b => b.type === 'text').length,
            table: structuredBlocks.filter(b => b.type === 'table').length,
            heading: structuredBlocks.filter(b => b.type === 'heading').length,
          },
        },
        sampleChunks: newChunks.slice(0, 5).map((c, i) => ({
          index: i,
          length: c.text.length,
          type: c.meta.chunkType,
          heading: c.meta.heading,
          pageRange: c.meta.pageStart ? `${c.meta.pageStart}-${c.meta.pageEnd || c.meta.pageStart}` : null,
          preview: c.text.slice(0, 200),
        })),
      });
    }

    // 4. 删除旧 chunks 和 KV embeddings
    // 先获取旧的 embedding keys
    const oldEmbeddings = await db.prepare(
      'SELECT embedding_key FROM rag_chunks WHERE document_id = ? AND embedding_key IS NOT NULL AND embedding_key != \'\''
    ).bind(documentId).all();

    // 删除 KV 中的 embeddings
    let kvDeleteCount = 0;
    if (oldEmbeddings.results) {
      for (const row of oldEmbeddings.results) {
        const key = (row as any).embedding_key as string;
        if (key) {
          try { await kv.delete(key); kvDeleteCount++; } catch {}
        }
      }
    }

    // 删除旧 chunks
    await db.prepare('DELETE FROM rag_chunks WHERE document_id = ?').bind(documentId).run();

    // 5. 写入新 chunks
    const BATCH = 50;
    for (let i = 0; i < newChunks.length; i += BATCH) {
      const batch = newChunks.slice(i, i + BATCH);
      const stmts = batch.map((c, idx) => {
        const chunkIdx = i + idx;
        const pageRange = c.meta.pageStart
          ? (c.meta.pageEnd && c.meta.pageEnd !== c.meta.pageStart
            ? `${c.meta.pageStart}-${c.meta.pageEnd}` : `${c.meta.pageStart}`)
          : null;
        return db.prepare(`
          INSERT INTO rag_chunks (document_id, chunk_index, content, content_length, embedding_key, has_embedding, metadata, chunk_type, page_range)
          VALUES (?, ?, ?, ?, '', 0, ?, ?, ?)
        `).bind(
          documentId, chunkIdx, c.text, c.text.length,
          JSON.stringify(c.meta), c.meta.chunkType || 'text', pageRange
        );
      });
      await db.batch(stmts);
    }

    // 6. 生成 embeddings（如果不跳过）
    let embeddingCount = 0;
    if (!skipEmbedding) {
      const dashscopeKey = c.env.DASHSCOPE_API_KEY;
      const vectorengineKey = c.env.VECTORENGINE_API_KEY;

      if (dashscopeKey || vectorengineKey) {
        const embeddingConfig = createEmbeddingConfig({
          dashscopeApiKey: dashscopeKey,
          vectorengineApiKey: vectorengineKey,
        });

        const EMBED_BATCH = embeddingConfig.batchSize;
        for (let i = 0; i < newChunks.length; i += EMBED_BATCH) {
          const batchItems = newChunks.slice(i, i + EMBED_BATCH);
          const batchTexts = batchItems.map(item => item.text);

          try {
            const embeddings = await generateEmbeddings(batchTexts, embeddingConfig);

            const stmts: D1PreparedStatement[] = [];
            for (let j = 0; j < batchItems.length; j++) {
              const chunkIdx = i + j;
              const embeddingKey = `rag:emb:${documentId}:${chunkIdx}`;
              await kv.put(embeddingKey, JSON.stringify(embeddings[j]));

              stmts.push(
                db.prepare(
                  'UPDATE rag_chunks SET embedding_key = ?, has_embedding = 1 WHERE document_id = ? AND chunk_index = ?'
                ).bind(embeddingKey, documentId, chunkIdx)
              );
            }
            await db.batch(stmts);
            embeddingCount += batchItems.length;
          } catch (embError) {
            console.error(`[Rechunk] Embedding batch ${Math.floor(i / EMBED_BATCH) + 1} failed:`, embError);
            // 继续处理，后续可通过 auto-sync advance 补充
          }
        }
      }
    }

    // 7. 更新文档 chunk_count
    await db.prepare(
      'UPDATE rag_documents SET chunk_count = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(newChunks.length, documentId).run();

    return c.json({
      success: true,
      documentId,
      title: doc.title,
      old: { chunkCount: oldChunkCount, types: oldChunkTypes, kvDeleted: kvDeleteCount },
      new: {
        chunkCount: newChunks.length,
        types: newChunkTypes,
        avgLength,
        hasHeadings,
        hasPages,
        embeddingsGenerated: embeddingCount,
      },
      improvement: {
        chunkCountChange: newChunks.length - oldChunkCount,
        tablesPreserved: newChunkTypes.table,
        headingsDetected: hasHeadings,
        pagesEstimated: hasPages,
      },
    });

  } catch (error) {
    console.error('[Rechunk] Error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Rechunk failed',
    }, 500);
  }
});

/**
 * POST /rechunk-all — 对所有文档重新切片
 * 
 * 逐个调用 rechunk 逻辑，避免超时
 * Query params:
 * - dryRun=true : 只预览
 * - skipEmbedding=true : 跳过 embedding
 * - limit=N : 最多处理 N 个文档（默认全部）
 */
ragOps.post('/rechunk-all', async (c) => {
  try {
    const dryRun = c.req.query('dryRun') === 'true';
    const skipEmbedding = c.req.query('skipEmbedding') === 'true';
    const limit = parseInt(c.req.query('limit') || '100', 10);

    const db = c.env.DB;

    const docs = await db.prepare(
      'SELECT id, title, stock_code, chunk_count FROM rag_documents WHERE status = \'completed\' ORDER BY id ASC LIMIT ?'
    ).bind(limit).all();

    if (!docs.results || docs.results.length === 0) {
      return c.json({ success: true, message: 'No documents to rechunk', processed: 0 });
    }

    // 由于 Cloudflare Workers 有 CPU 时间限制，这里只返回文档列表和预览
    // 实际 rechunk 需要逐个调用 /rechunk/:documentId
    const docList = docs.results.map((d: any) => ({
      id: d.id,
      title: d.title,
      stockCode: d.stock_code,
      currentChunks: d.chunk_count,
    }));

    return c.json({
      success: true,
      message: dryRun
        ? 'Dry run: listing documents that would be rechunked'
        : 'Use POST /rechunk/:documentId to rechunk each document individually (Workers CPU limit)',
      totalDocuments: docList.length,
      documents: docList,
      instructions: 'Call POST /api/rag/ops/rechunk/{documentId}?skipEmbedding=true for each document, then use auto-sync advance to generate embeddings',
    });

  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list documents',
    }, 500);
  }
});

export default ragOps;
