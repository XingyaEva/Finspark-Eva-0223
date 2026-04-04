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

export default ragOps;
