/**
 * RAG 知识沉淀 + 健康检查 + Chunk 增强 API 路由 — routes/rag-knowledge.ts
 *
 * 提供：
 * - Chunk 质量增强（HyDE 问题生成 + 摘要 + 实体标注 + 试运行 + 批量处理）
 * - 对话知识沉淀（提取 + 批量提取 + 合并 + 审核 + 应用入库）
 * - 知识库健康度检查（运行检查 + 报告查看 + 问题追踪 + 修复）
 *
 * 关联页面: P.3 Chunk 质量增强, P.14 对话知识沉淀, P.15 知识库健康度检查
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createEnhanceService } from '../services/ragEnhance';
import { createKnowledgeService } from '../services/ragKnowledge';
import { createHealthService } from '../services/ragHealth';
import { createVersionService } from '../services/ragVersion';
import { createGpuProvider } from '../services/ragGpuProvider';

const ragKnowledge = new Hono<{ Bindings: Bindings }>();

/** 获取 GPU 路由后的 LLM 配置 */
function getGpuLlmConfig(env: Bindings, task: 'hyde' | 'summary' | 'entity' | 'knowledge' | 'knowledgeMerge') {
  const gpuProvider = createGpuProvider({
    gpuServerUrl: env.GPU_SERVER_URL,
    gpuLlmModel: env.GPU_LLM_MODEL,
    gpuRoutingMode: env.GPU_ROUTING_MODE,
    gpuProxyAuthToken: env.GPU_PROXY_AUTH_TOKEN,
    cloudApiKey: env.VECTORENGINE_API_KEY,
  });
  return gpuProvider.getLlmConfig(task);
}

/** Helper: create services from env */
function getEnhanceService(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');
  // 使用 GPU 路由：HyDE/Summary/Entity 任务走 GPU
  const hydeLlm = getGpuLlmConfig(env, 'hyde');
  return createEnhanceService(env.DB, env.CACHE, hydeLlm.apiKey, hydeLlm.baseUrl, hydeLlm.model, hydeLlm.extraHeaders || {});
}

function getKnowledgeService(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');
  // 使用 GPU 路由：知识提取任务走 GPU
  const knowledgeLlm = getGpuLlmConfig(env, 'knowledge');
  return createKnowledgeService(env.DB, env.CACHE, knowledgeLlm.apiKey, knowledgeLlm.baseUrl, knowledgeLlm.model, knowledgeLlm.extraHeaders || {});
}

function getHealthService(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');
  return createHealthService(env.DB, env.CACHE, apiKey);
}

function getVersionService(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');
  return createVersionService(env.DB, env.CACHE, apiKey);
}

// ================================================
//  Chunk 质量增强 API
// ================================================

/**
 * GET /enhance/strategies — 获取可用增强策略
 */
ragKnowledge.get('/enhance/strategies', async (c) => {
  try {
    const svc = getEnhanceService(c.env);
    return c.json({ success: true, data: svc.getStrategies() });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /enhance/stats — 获取增强统计
 * Query: ?document_id=1
 */
ragKnowledge.get('/enhance/stats', async (c) => {
  try {
    const svc = getEnhanceService(c.env);
    const documentId = c.req.query('document_id') ? Number(c.req.query('document_id')) : undefined;
    const stats = await svc.getEnhanceStats(documentId);
    return c.json({ success: true, data: stats });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /enhance/dry-run — 试运行增强 (3 个 Chunk 预览)
 * Body: { strategy, document_id? }
 */
ragKnowledge.post('/enhance/dry-run', async (c) => {
  try {
    const svc = getEnhanceService(c.env);
    const { strategy, document_id } = await c.req.json();
    if (!strategy || !['hyde_questions', 'summary', 'entity_tagging'].includes(strategy)) {
      return c.json({ success: false, error: 'Invalid strategy' }, 400);
    }
    const results = await svc.dryRun(strategy, document_id);
    return c.json({ success: true, data: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /enhance/batch — 批量增强
 * Body: { strategy, document_id? }
 */
ragKnowledge.post('/enhance/batch', async (c) => {
  try {
    const svc = getEnhanceService(c.env);
    const { strategy, document_id } = await c.req.json();
    if (!strategy || !['hyde_questions', 'summary', 'entity_tagging'].includes(strategy)) {
      return c.json({ success: false, error: 'Invalid strategy' }, 400);
    }
    const result = await svc.batchEnhance(strategy, document_id);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /enhance/progress/:taskId — 获取批量增强进度
 */
ragKnowledge.get('/enhance/progress/:taskId', async (c) => {
  try {
    const svc = getEnhanceService(c.env);
    const taskId = c.req.param('taskId');
    const progress = await svc.getEnhanceProgress(taskId);
    if (!progress) return c.json({ success: false, error: 'Task not found' }, 404);
    return c.json({ success: true, data: progress });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ================================================
//  对话知识沉淀 API
// ================================================

/**
 * POST /knowledge/extract — 单次对话知识提取
 * Body: { question, answer, message_log_id?, conversation_id? }
 */
ragKnowledge.post('/knowledge/extract', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const { question, answer, message_log_id, conversation_id } = await c.req.json();
    if (!question || !answer) return c.json({ success: false, error: 'question and answer are required' }, 400);
    const result = await svc.extractFromConversation(question, answer, message_log_id, conversation_id);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /knowledge/batch-extract — 批量对话知识提取
 * Body: { from_date?, to_date?, limit?, min_answer_length? }
 */
ragKnowledge.post('/knowledge/batch-extract', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const { from_date, to_date, limit, min_answer_length } = await c.req.json();
    const result = await svc.batchExtract({
      fromDate: from_date,
      toDate: to_date,
      limit,
      minAnswerLength: min_answer_length,
    });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /knowledge/extracted — 提取的知识条目列表
 * Query: ?status=pending&knowledge_type=fact&limit=20&offset=0
 */
ragKnowledge.get('/knowledge/extracted', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const result = await svc.listExtracted({
      status: c.req.query('status'),
      knowledge_type: c.req.query('knowledge_type'),
      limit: Number(c.req.query('limit') || 20),
      offset: Number(c.req.query('offset') || 0),
    });
    return c.json({ success: true, data: result.items, total: result.total });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /knowledge/:id/review — 审核知识条目
 * Body: { action: 'accept' | 'reject', review_note?, reviewed_by? }
 */
ragKnowledge.post('/knowledge/:id/review', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const id = Number(c.req.param('id'));
    const { action, review_note, reviewed_by } = await c.req.json();
    if (!['accept', 'reject'].includes(action)) {
      return c.json({ success: false, error: "action must be 'accept' or 'reject'" }, 400);
    }
    await svc.reviewKnowledge(id, action, review_note, reviewed_by);
    return c.json({ success: true, message: `Knowledge ${action}ed` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /knowledge/merge — 合并知识条目
 * Body: { ids: number[] }
 */
ragKnowledge.post('/knowledge/merge', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const { ids } = await c.req.json();
    if (!ids || ids.length < 2) return c.json({ success: false, error: 'At least 2 IDs required' }, 400);
    const result = await svc.mergeKnowledge(ids);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /knowledge/settled — 已沉淀知识列表
 * Query: ?status=pending_apply&knowledge_type=fact&limit=20&offset=0
 */
ragKnowledge.get('/knowledge/settled', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const result = await svc.listSettled({
      status: c.req.query('status'),
      knowledge_type: c.req.query('knowledge_type'),
      limit: Number(c.req.query('limit') || 20),
      offset: Number(c.req.query('offset') || 0),
    });
    return c.json({ success: true, data: result.items, total: result.total });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /knowledge/:id/apply — 将已沉淀知识应用到知识库
 * Body: { document_id }
 */
ragKnowledge.post('/knowledge/:id/apply', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const id = Number(c.req.param('id'));
    const { document_id } = await c.req.json();
    if (!document_id) return c.json({ success: false, error: 'document_id is required' }, 400);
    const result = await svc.applyToKnowledgeBase(id, document_id);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /knowledge/stats — 知识沉淀统计
 */
ragKnowledge.get('/knowledge/stats', async (c) => {
  try {
    const svc = getKnowledgeService(c.env);
    const stats = await svc.getStats();
    return c.json({ success: true, data: stats });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ================================================
//  健康检查 API
// ================================================

/**
 * POST /health/run — 运行健康检查
 * Body: { created_by? }
 */
ragKnowledge.post('/health/run', async (c) => {
  try {
    const svc = getHealthService(c.env);
    const body = await c.req.json().catch(() => ({}));
    const result = await svc.runHealthCheck(body.created_by);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /health/reports — 健康检查报告列表
 * Query: ?limit=10&offset=0
 */
ragKnowledge.get('/health/reports', async (c) => {
  try {
    const svc = getHealthService(c.env);
    const limit = Number(c.req.query('limit') || 10);
    const offset = Number(c.req.query('offset') || 0);
    const result = await svc.listReports(limit, offset);
    return c.json({ success: true, data: result.reports, total: result.total });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /health/reports/:id — 获取单个报告详情
 */
ragKnowledge.get('/health/reports/:id', async (c) => {
  try {
    const svc = getHealthService(c.env);
    const id = Number(c.req.param('id'));
    const report = await svc.getReport(id);
    if (!report) return c.json({ success: false, error: 'Report not found' }, 404);
    return c.json({ success: true, data: report });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /health/reports/:id/issues — 获取报告关联的问题列表
 * Query: ?status=open&severity=high
 */
ragKnowledge.get('/health/reports/:id/issues', async (c) => {
  try {
    const svc = getHealthService(c.env);
    const reportId = Number(c.req.param('id'));
    const issues = await svc.listIssues(reportId, {
      status: c.req.query('status'),
      severity: c.req.query('severity'),
    });
    return c.json({ success: true, data: issues });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /health/issues/:id/fix — 标记问题为已修复
 * Body: { fixed_by? }
 */
ragKnowledge.post('/health/issues/:id/fix', async (c) => {
  try {
    const svc = getHealthService(c.env);
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    await svc.fixIssue(id, body.fixed_by);
    return c.json({ success: true, message: 'Issue marked as fixed' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /health/issues/:id/ignore — 忽略问题
 */
ragKnowledge.post('/health/issues/:id/ignore', async (c) => {
  try {
    const svc = getHealthService(c.env);
    const id = Number(c.req.param('id'));
    await svc.ignoreIssue(id);
    return c.json({ success: true, message: 'Issue ignored' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ================================================
//  版本管理 API
// ================================================

/**
 * GET /versions/stats — 版本统计总览
 */
ragKnowledge.get('/versions/stats', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const stats = await svc.getStats();
    return c.json({ success: true, data: stats });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /versions — 版本列表
 * Query: ?status=active&search=xxx&limit=20&offset=0
 */
ragKnowledge.get('/versions', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const result = await svc.listVersions({
      status: c.req.query('status'),
      search: c.req.query('search'),
      limit: Number(c.req.query('limit') || 20),
      offset: Number(c.req.query('offset') || 0),
    });
    return c.json({ success: true, data: result.versions, total: result.total });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /versions — 创建版本快照
 * Body: { name, description?, tags?, created_by?, version_label? }
 */
ragKnowledge.post('/versions', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const body = await c.req.json();
    if (!body.name) return c.json({ success: false, error: 'name is required' }, 400);
    const result = await svc.createVersion(body);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /versions/:id — 获取单个版本详情
 */
ragKnowledge.get('/versions/:id', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    const version = await svc.getVersion(id);
    if (!version) return c.json({ success: false, error: 'Version not found' }, 404);
    return c.json({ success: true, data: version });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * PUT /versions/:id — 更新版本信息
 * Body: { name?, description?, tags?, status? }
 */
ragKnowledge.put('/versions/:id', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    await svc.updateVersion(id, body);
    return c.json({ success: true, message: 'Version updated' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * DELETE /versions/:id — 删除版本
 */
ragKnowledge.delete('/versions/:id', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    await svc.deleteVersion(id);
    return c.json({ success: true, message: 'Version deleted' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /versions/diff — 对比两个版本 Chunk 差异
 * Body: { version_a_id, version_b_id }
 */
ragKnowledge.post('/versions/diff', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const { version_a_id, version_b_id } = await c.req.json();
    if (!version_a_id || !version_b_id) {
      return c.json({ success: false, error: 'version_a_id and version_b_id are required' }, 400);
    }
    const diff = await svc.diffVersions(version_a_id, version_b_id);
    return c.json({ success: true, data: diff });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /versions/compare — A/B 性能对比
 * Body: { version_a_id, version_b_id }
 */
ragKnowledge.post('/versions/compare', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const { version_a_id, version_b_id } = await c.req.json();
    if (!version_a_id || !version_b_id) {
      return c.json({ success: false, error: 'version_a_id and version_b_id are required' }, 400);
    }
    const result = await svc.compareVersions(version_a_id, version_b_id);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /versions/:id/benchmarks — 版本性能基准列表
 */
ragKnowledge.get('/versions/:id/benchmarks', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    const benchmarks = await svc.listBenchmarks(id);
    return c.json({ success: true, data: benchmarks });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /versions/:id/benchmarks — 添加性能基准
 * Body: { evaluation_id?, test_set_id?, overall_score?, ... }
 */
ragKnowledge.post('/versions/:id/benchmarks', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const result = await svc.addBenchmark({ ...body, version_id: id });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /versions/regression — 运行回归测试
 * Body: { version_a_id, version_b_id, test_set_id?, created_by? }
 */
ragKnowledge.post('/versions/regression', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const body = await c.req.json();
    if (!body.version_a_id || !body.version_b_id) {
      return c.json({ success: false, error: 'version_a_id and version_b_id are required' }, 400);
    }
    const result = await svc.runRegressionTest(body);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /versions/regression/:id — 获取回归测试详情
 */
ragKnowledge.get('/versions/regression/:id', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    const test = await svc.getRegressionTest(id);
    if (!test) return c.json({ success: false, error: 'Regression test not found' }, 404);
    return c.json({ success: true, data: test });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * GET /versions/regressions/list — 回归测试列表
 * Query: ?version_id=1&limit=20&offset=0
 */
ragKnowledge.get('/versions/regressions/list', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const result = await svc.listRegressionTests({
      version_id: c.req.query('version_id') ? Number(c.req.query('version_id')) : undefined,
      limit: Number(c.req.query('limit') || 20),
      offset: Number(c.req.query('offset') || 0),
    });
    return c.json({ success: true, data: result.tests, total: result.total });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

/**
 * POST /versions/:id/rollback — 回滚到指定版本
 * Body: { created_by? }
 */
ragKnowledge.post('/versions/:id/rollback', async (c) => {
  try {
    const svc = getVersionService(c.env);
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const result = await svc.rollbackToVersion(id, body.created_by);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default ragKnowledge;
