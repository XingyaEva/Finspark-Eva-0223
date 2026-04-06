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

// ==================== 文档 Rechunk API (分阶段) ====================

/**
 * POST /rechunk/:documentId — 对已有文档重新切片（分阶段执行，适应 Workers CPU 限制）
 * 
 * 阶段设计：
 * - phase=1 (默认): 分批读取旧 chunks → 拼接 → 存入 KV 缓存
 * - phase=2: 从 KV 读取原文 → 重新切片 → 删除旧 chunks → 写入新 chunks
 * - phase=3: 为未嵌入的 chunks 生成 embeddings（每次一批 20 个）
 * - dryRun=true: 只预览（在 phase=1 时执行完整预览）
 * 
 * 每个阶段在单次请求内完成，客户端需连续调用直到返回 done=true
 */
ragOps.post('/rechunk/:documentId', async (c) => {
  try {
    const documentId = parseInt(c.req.param('documentId'), 10);
    if (isNaN(documentId)) {
      return c.json({ success: false, error: 'Invalid document ID' }, 400);
    }

    const phase = parseInt(c.req.query('phase') || '1', 10);
    const dryRun = c.req.query('dryRun') === 'true';
    const skipEmbedding = c.req.query('skipEmbedding') === 'true';

    const db = c.env.DB;
    const kv = c.env.CACHE;
    const kvKey = `rechunk:content:${documentId}`;

    // 获取文档信息
    let doc;
    try {
      doc = await db.prepare(
        'SELECT id, title, file_name, file_type, stock_code, stock_name, category, tags, status FROM rag_documents WHERE id = ?'
      ).bind(documentId).first<Record<string, unknown>>();
    } catch (docErr) {
      return c.json({ success: false, error: `Doc query failed: ${docErr instanceof Error ? docErr.message : docErr}` }, 500);
    }

    if (!doc) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    // ==================== Phase 1: 读取旧 chunks → 拼接 → 存 KV ====================
    if (phase === 1) {
      // 检查 KV 是否已有缓存（支持幂等重试）
      const existing = await kv.get(kvKey);
      if (existing) {
        const oldCount = await db.prepare(
          'SELECT COUNT(*) as cnt FROM rag_chunks WHERE document_id = ?'
        ).bind(documentId).first<{ cnt: number }>();

        // 如果是 dryRun，直接用 KV 中的内容做预览
        if (dryRun) {
          const structuredBlocks = extractStructuredBlocks(existing);
          const newChunks = buildStructuredChunksV2(structuredBlocks, {
            chunkSize: 800, chunkOverlap: 50,
            fileName: doc.file_name as string || '',
            stockCode: doc.stock_code as string || '',
            category: doc.category as string || '',
          });
          return c.json({
            success: true, dryRun: true, documentId, title: doc.title,
            old: { chunkCount: oldCount?.cnt || 0 },
            new: {
              chunkCount: newChunks.length,
              types: {
                text: newChunks.filter(ch => ch.meta.chunkType === 'text').length,
                table: newChunks.filter(ch => ch.meta.chunkType === 'table').length,
              },
              avgLength: Math.round(newChunks.reduce((s, ch) => s + ch.text.length, 0) / (newChunks.length || 1)),
              hasHeadings: newChunks.some(ch => ch.meta.heading),
              hasPages: newChunks.some(ch => ch.meta.pageStart && ch.meta.pageStart > 1),
            },
            sampleChunks: newChunks.slice(0, 3).map((ch, i) => ({
              index: i, length: ch.text.length, type: ch.meta.chunkType,
              heading: ch.meta.heading, preview: ch.text.slice(0, 150),
            })),
          });
        }

        return c.json({
          success: true, phase: 1, status: 'cached',
          documentId, title: doc.title,
          contentLength: existing.length,
          oldChunkCount: oldCount?.cnt || 0,
          nextPhase: 2,
          message: 'Content already in KV, proceed to phase 2',
        });
      }

      // 分批读取 chunks（每次 500 条），拼接
      const contentParts: string[] = [];
      let offset = 0;
      const PAGE_SIZE = 500;
      let totalRead = 0;

      while (true) {
        const batch = await db.prepare(
          'SELECT content FROM rag_chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT ? OFFSET ?'
        ).bind(documentId, PAGE_SIZE, offset).all();

        if (!batch.results || batch.results.length === 0) break;

        for (const row of batch.results) {
          contentParts.push((row as any).content as string);
        }
        totalRead += batch.results.length;
        offset += PAGE_SIZE;

        // 安全阀：最多读 5000 条（防止超时）
        if (totalRead >= 5000) break;
      }

      if (contentParts.length === 0) {
        return c.json({ success: false, error: 'No chunks found for this document' }, 404);
      }

      const fullContent = contentParts.join('\n');

      // 存入 KV（TTL 1 小时）
      await kv.put(kvKey, fullContent, { expirationTtl: 3600 });

      if (dryRun) {
        const structuredBlocks = extractStructuredBlocks(fullContent);
        const newChunks = buildStructuredChunksV2(structuredBlocks, {
          chunkSize: 800, chunkOverlap: 50,
          fileName: doc.file_name as string || '',
          stockCode: doc.stock_code as string || '',
          category: doc.category as string || '',
        });
        return c.json({
          success: true, dryRun: true, documentId, title: doc.title,
          old: { chunkCount: totalRead },
          new: {
            chunkCount: newChunks.length,
            types: {
              text: newChunks.filter(ch => ch.meta.chunkType === 'text').length,
              table: newChunks.filter(ch => ch.meta.chunkType === 'table').length,
            },
            avgLength: Math.round(newChunks.reduce((s, ch) => s + ch.text.length, 0) / (newChunks.length || 1)),
            hasHeadings: newChunks.some(ch => ch.meta.heading),
            hasPages: newChunks.some(ch => ch.meta.pageStart && ch.meta.pageStart > 1),
            structuredBlocks: structuredBlocks.length,
          },
          sampleChunks: newChunks.slice(0, 5).map((ch, i) => ({
            index: i, length: ch.text.length, type: ch.meta.chunkType,
            heading: ch.meta.heading,
            pageRange: ch.meta.pageStart ? `${ch.meta.pageStart}-${ch.meta.pageEnd || ch.meta.pageStart}` : null,
            preview: ch.text.slice(0, 200),
          })),
        });
      }

      return c.json({
        success: true, phase: 1, status: 'content_cached',
        documentId, title: doc.title,
        contentLength: fullContent.length,
        oldChunkCount: totalRead,
        nextPhase: 2,
        message: `Read ${totalRead} chunks (${fullContent.length} chars) → stored in KV. Call phase=2 next.`,
      });
    }

    // ==================== Phase 2: 从 KV 读取 → 重新切片 → 写入 ====================
    if (phase === 2) {
      const fullContent = await kv.get(kvKey);
      if (!fullContent) {
        return c.json({ success: false, error: 'KV cache missing, run phase=1 first' }, 400);
      }

      const fileName = doc.file_name as string || '';
      const stockCode = doc.stock_code as string || '';
      const category = doc.category as string || '';

      // 重新切片
      let structuredBlocks;
      let newChunks;
      try {
        structuredBlocks = extractStructuredBlocks(fullContent);
        newChunks = buildStructuredChunksV2(structuredBlocks, {
          chunkSize: 800, chunkOverlap: 50, fileName, stockCode, category,
        });
        console.log(`[Rechunk] Doc ${documentId}: ${structuredBlocks.length} blocks → ${newChunks.length} chunks`);
      } catch (chunkErr) {
        return c.json({ success: false, error: `Chunking failed: ${chunkErr instanceof Error ? chunkErr.message : chunkErr}`, phase: 2 }, 500);
      }

      // 删除旧 chunks
      // 注意：FTS5 触发器可能导致 DELETE 失败（索引不同步），所以先禁用触发器
      try {
        // 先删除 FTS5 触发器（避免 DELETE 时 FTS5 索引不同步报错）
        await db.batch([
          db.prepare('DROP TRIGGER IF EXISTS rag_chunks_fts_delete'),
          db.prepare('DROP TRIGGER IF EXISTS rag_chunks_fts_insert'),
          db.prepare('DROP TRIGGER IF EXISTS rag_chunks_fts_update'),
        ]);
        console.log(`[Rechunk] FTS5 triggers dropped for doc ${documentId}`);

        await db.prepare('DELETE FROM rag_chunks WHERE document_id = ?').bind(documentId).run();
        console.log(`[Rechunk] Deleted old chunks for doc ${documentId}`);
      } catch (delErr) {
        // 即使失败也尝试重建触发器
        try {
          await db.batch([
            db.prepare(`CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_insert AFTER INSERT ON rag_chunks BEGIN INSERT INTO rag_chunks_fts(rowid, content) VALUES (NEW.id, NEW.content); END`),
            db.prepare(`CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_delete AFTER DELETE ON rag_chunks BEGIN INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content) VALUES ('delete', OLD.id, OLD.content); END`),
            db.prepare(`CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_update AFTER UPDATE OF content ON rag_chunks BEGIN INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content) VALUES ('delete', OLD.id, OLD.content); INSERT INTO rag_chunks_fts(rowid, content) VALUES (NEW.id, NEW.content); END`),
          ]);
        } catch {}
        return c.json({ success: false, error: `Delete failed: ${delErr instanceof Error ? delErr.message : delErr}`, phase: 2 }, 500);
      }

      // 写入新 chunks（不含 embedding）
      // 使用较小的批次（10条/批）避免 D1 payload 限制（表格 HTML 可能很大）
      const BATCH = 10;
      let writeErrors = 0;
      for (let i = 0; i < newChunks.length; i += BATCH) {
        const batch = newChunks.slice(i, i + BATCH);
        const stmts = batch.map((ch, idx) => {
          const chunkIdx = i + idx;
          const pageRange = ch.meta.pageStart
            ? (ch.meta.pageEnd && ch.meta.pageEnd !== ch.meta.pageStart
              ? `${ch.meta.pageStart}-${ch.meta.pageEnd}` : `${ch.meta.pageStart}`)
            : null;
          // 限制 content 长度以避免超出 D1 限制
          const content = ch.text.length > 50000 ? ch.text.slice(0, 50000) + '...(truncated)' : ch.text;
          const metaStr = JSON.stringify(ch.meta);
          return db.prepare(`
            INSERT INTO rag_chunks (document_id, chunk_index, content, content_length, embedding_key, has_embedding, metadata, chunk_type, page_range)
            VALUES (?, ?, ?, ?, '', 0, ?, ?, ?)
          `).bind(
            documentId, chunkIdx, content, content.length,
            metaStr, ch.meta.chunkType || 'text', pageRange
          );
        });
        try {
          await db.batch(stmts);
        } catch (batchErr) {
          console.error(`[Rechunk] Batch ${Math.floor(i / BATCH) + 1} failed for doc ${documentId}:`, batchErr);
          writeErrors++;
          // 尝试逐条写入
          for (const stmt of stmts) {
            try {
              await stmt.run();
            } catch (singleErr) {
              console.error(`[Rechunk] Single insert failed:`, singleErr);
              writeErrors++;
            }
          }
        }
      }

      // 重建 FTS5：清空 → 回填 → 重建触发器
      try {
        // 清空旧 FTS5 数据
        await db.prepare("DELETE FROM rag_chunks_fts").run();
        // 回填所有 chunks 到 FTS5
        await db.prepare(`
          INSERT INTO rag_chunks_fts(rowid, content)
          SELECT id, content FROM rag_chunks
        `).run();
        // 重建触发器
        await db.batch([
          db.prepare(`CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_insert AFTER INSERT ON rag_chunks BEGIN INSERT INTO rag_chunks_fts(rowid, content) VALUES (NEW.id, NEW.content); END`),
          db.prepare(`CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_delete AFTER DELETE ON rag_chunks BEGIN INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content) VALUES ('delete', OLD.id, OLD.content); END`),
          db.prepare(`CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_update AFTER UPDATE OF content ON rag_chunks BEGIN INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content) VALUES ('delete', OLD.id, OLD.content); INSERT INTO rag_chunks_fts(rowid, content) VALUES (NEW.id, NEW.content); END`),
        ]);
        // 优化 FTS5
        await db.prepare("INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES ('optimize')").run();
        console.log(`[Rechunk] FTS5 rebuilt and triggers recreated`);
      } catch (ftsErr) {
        console.warn(`[Rechunk] Warning: FTS5 rebuild failed (non-critical):`, ftsErr);
      }

      // 更新文档 chunk_count
      const actualCount = await db.prepare(
        'SELECT COUNT(*) as cnt FROM rag_chunks WHERE document_id = ?'
      ).bind(documentId).first<{ cnt: number }>();
      
      await db.prepare(
        'UPDATE rag_documents SET chunk_count = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(actualCount?.cnt || newChunks.length, documentId).run();

      // 清理 KV 缓存
      await kv.delete(kvKey);

      const newChunkTypes = {
        text: newChunks.filter(ch => ch.meta.chunkType === 'text').length,
        table: newChunks.filter(ch => ch.meta.chunkType === 'table').length,
      };

      return c.json({
        success: true, phase: 2, status: 'rechunked',
        documentId, title: doc.title,
        new: {
          chunkCount: actualCount?.cnt || newChunks.length,
          expectedCount: newChunks.length,
          types: newChunkTypes,
          avgLength: Math.round(newChunks.reduce((s, ch) => s + ch.text.length, 0) / (newChunks.length || 1)),
          hasHeadings: newChunks.some(ch => ch.meta.heading),
          hasPages: newChunks.some(ch => ch.meta.pageStart && ch.meta.pageStart > 1),
          writeErrors,
        },
        nextPhase: skipEmbedding ? null : 3,
        done: skipEmbedding,
        message: skipEmbedding
          ? `Rechunked: ${actualCount?.cnt || newChunks.length} new chunks (no embedding). Done.`
          : `Rechunked: ${actualCount?.cnt || newChunks.length} new chunks. Call phase=3 to generate embeddings.`,
      });
    }

    // ==================== Phase 3: 批量生成 embeddings ====================
    if (phase === 3) {
      const dashscopeKey = c.env.DASHSCOPE_API_KEY;
      const vectorengineKey = c.env.VECTORENGINE_API_KEY;

      if (!dashscopeKey && !vectorengineKey) {
        return c.json({ success: false, error: 'No embedding API key configured' }, 400);
      }

      const embeddingConfig = createEmbeddingConfig({
        dashscopeApiKey: dashscopeKey,
        vectorengineApiKey: vectorengineKey,
      });

      // 找到下一批未嵌入的 chunks
      const EMBED_BATCH = 20;
      const unembedded = await db.prepare(
        `SELECT id, chunk_index, content FROM rag_chunks 
         WHERE document_id = ? AND has_embedding = 0 
         ORDER BY chunk_index ASC LIMIT ?`
      ).bind(documentId, EMBED_BATCH).all();

      if (!unembedded.results || unembedded.results.length === 0) {
        // 全部嵌入完成
        const totalChunks = await db.prepare(
          'SELECT COUNT(*) as cnt FROM rag_chunks WHERE document_id = ?'
        ).bind(documentId).first<{ cnt: number }>();

        return c.json({
          success: true, phase: 3, status: 'embedding_complete',
          documentId, title: doc.title,
          totalChunks: totalChunks?.cnt || 0,
          done: true,
          message: 'All chunks embedded. Rechunk complete.',
        });
      }

      const batchTexts = unembedded.results.map((r: any) => r.content as string);
      const embeddings = await generateEmbeddings(batchTexts, embeddingConfig);

      const stmts: D1PreparedStatement[] = [];
      for (let j = 0; j < unembedded.results.length; j++) {
        const row = unembedded.results[j] as any;
        const embeddingKey = `rag:emb:${documentId}:${row.chunk_index}`;
        await kv.put(embeddingKey, JSON.stringify(embeddings[j]));
        stmts.push(
          db.prepare(
            'UPDATE rag_chunks SET embedding_key = ?, has_embedding = 1 WHERE id = ?'
          ).bind(embeddingKey, row.id)
        );
      }
      await db.batch(stmts);

      // 还剩多少未嵌入
      const remaining = await db.prepare(
        'SELECT COUNT(*) as cnt FROM rag_chunks WHERE document_id = ? AND has_embedding = 0'
      ).bind(documentId).first<{ cnt: number }>();

      const remainingCount = remaining?.cnt || 0;

      return c.json({
        success: true, phase: 3, status: 'embedding_progress',
        documentId, title: doc.title,
        embedded: unembedded.results.length,
        remaining: remainingCount,
        done: remainingCount === 0,
        nextPhase: remainingCount > 0 ? 3 : null,
        message: `Embedded ${unembedded.results.length} chunks. ${remainingCount} remaining.`,
      });
    }

    return c.json({ success: false, error: `Unknown phase: ${phase}` }, 400);

  } catch (error) {
    console.error('[Rechunk] Error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Rechunk failed',
    }, 500);
  }
});

/**
 * POST /rechunk-all — 列出所有待 rechunk 文档
 */
ragOps.post('/rechunk-all', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const db = c.env.DB;

    const docs = await db.prepare(
      'SELECT id, title, stock_code, chunk_count FROM rag_documents WHERE status = \'completed\' ORDER BY id ASC LIMIT ?'
    ).bind(limit).all();

    if (!docs.results || docs.results.length === 0) {
      return c.json({ success: true, message: 'No documents to rechunk', processed: 0 });
    }

    return c.json({
      success: true,
      totalDocuments: docs.results.length,
      documents: docs.results.map((d: any) => ({
        id: d.id, title: d.title, stockCode: d.stock_code, currentChunks: d.chunk_count,
      })),
      instructions: 'For each document: call phase=1, then phase=2 (skipEmbedding=true), then optionally phase=3 (loop until done=true)',
      example: 'POST /api/rag/ops/rechunk/{id}?phase=1 → POST /api/rag/ops/rechunk/{id}?phase=2&skipEmbedding=true',
    });

  } catch (error) {
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Failed' }, 500);
  }
});

export default ragOps;
