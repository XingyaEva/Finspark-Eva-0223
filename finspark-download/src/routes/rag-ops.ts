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
import { createEmbeddingConfig, generateEmbedding } from '../services/rag';

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

export default ragOps;
