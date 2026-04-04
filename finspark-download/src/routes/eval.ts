/**
 * Eval Dashboard API Routes
 * Phase 3.3: 评分展示数据接口 (雷达图、趋势线、告警)
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import {
  getReportEvalScores,
  getEvalScoreTrend,
  getEvalDimensionStats,
  getEvalAlerts,
  getEvalDegradationStats,
  getEvalTokenUsage,
} from '../services/openevals-evaluator';

const evalRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/eval/report/:reportId
 * 获取单个报告的评分详情 (雷达图数据)
 */
evalRoutes.get('/report/:reportId', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'Database not configured' }, 500);

  const reportId = parseInt(c.req.param('reportId'));
  if (isNaN(reportId)) return c.json({ error: 'Invalid reportId' }, 400);

  const scores = await getReportEvalScores(db, reportId);

  // 按 agent_type 分组构建雷达图数据
  const agentMap: Record<string, any> = {};
  for (const row of scores as any[]) {
    if (!agentMap[row.agent_type]) {
      agentMap[row.agent_type] = {
        agentType: row.agent_type,
        judgeModel: row.judge_model,
        degraded: row.degraded === 1,
        latencyMs: row.eval_latency_ms,
        dimensions: {},
        weightedTotal: 0,
      };
    }
    if (row.dimension === 'weighted_total') {
      agentMap[row.agent_type].weightedTotal = row.score;
    } else {
      agentMap[row.agent_type].dimensions[row.dimension] = {
        score: row.score,
        reasoning: row.reasoning,
      };
    }
  }

  return c.json({
    reportId,
    agents: Object.values(agentMap),
    totalScores: scores.length,
  });
});

/**
 * GET /api/eval/trend?limit=50
 * 获取评分趋势 (趋势线数据)
 */
evalRoutes.get('/trend', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'Database not configured' }, 500);

  const limit = parseInt(c.req.query('limit') || '50');
  const trend = await getEvalScoreTrend(db, Math.min(limit, 200));

  // 按 report_id 分组计算每次报告的平均分
  const reportMap: Record<number, { scores: number[]; createdAt: string; degradedAny: boolean }> = {};
  for (const row of trend as any[]) {
    if (!reportMap[row.report_id]) {
      reportMap[row.report_id] = { scores: [], createdAt: row.created_at, degradedAny: false };
    }
    reportMap[row.report_id].scores.push(row.score);
    if (row.degraded === 1) reportMap[row.report_id].degradedAny = true;
  }

  const trendData = Object.entries(reportMap).map(([rid, data]) => ({
    reportId: parseInt(rid),
    avgScore: +(data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(3),
    agentCount: data.scores.length,
    degraded: data.degradedAny,
    createdAt: data.createdAt,
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return c.json({ trend: trendData });
});

/**
 * GET /api/eval/stats
 * 获取维度聚合统计 + 降级统计
 */
evalRoutes.get('/stats', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'Database not configured' }, 500);

  const [dimensionStats, degradationStats] = await Promise.all([
    getEvalDimensionStats(db),
    getEvalDegradationStats(db),
  ]);

  return c.json({
    dimensions: dimensionStats,
    degradation: degradationStats,
  });
});

/**
 * GET /api/eval/alerts?limit=30
 * 获取低分告警列表
 */
evalRoutes.get('/alerts', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'Database not configured' }, 500);

  const limit = parseInt(c.req.query('limit') || '30');
  const alerts = await getEvalAlerts(db, Math.min(limit, 100));

  return c.json({
    alerts,
    total: alerts.length,
  });
});

/**
 * GET /api/eval/tokens?limit=50
 * P3.2: Judge 模型令牌消耗汇总
 */
evalRoutes.get('/tokens', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'Database not configured' }, 500);

  const limit = parseInt(c.req.query('limit') || '50');
  const usage = await getEvalTokenUsage(db, Math.min(limit, 200));

  return c.json({ usage });
});

/**
 * GET /api/eval/config
 * P3.4: 获取当前评估配置（动态采样率等）
 */
evalRoutes.get('/config', async (c) => {
  const cache = c.env.CACHE || c.env.KV;
  const config: Record<string, any> = {};

  if (cache) {
    try {
      const rate = await cache.get('eval:samplingRate');
      config.samplingRate = rate ? parseFloat(rate) : 0.3;
      const mode = await cache.get('eval:mode');
      config.mode = mode || 'sampling';
    } catch {
      config.samplingRate = 0.3;
      config.mode = 'sampling';
    }
  } else {
    config.samplingRate = 0.3;
    config.mode = 'sampling';
  }

  // 读取环境变量覆盖
  config.envSamplingRate = (c.env as any).EVAL_SAMPLING_RATE || null;
  config.envMode = (c.env as any).EVAL_MODE || null;

  return c.json({ config });
});

/**
 * PUT /api/eval/config
 * P3.4: 动态调整评估配置（采样率等）
 */
evalRoutes.put('/config', async (c) => {
  const cache = c.env.CACHE || c.env.KV;
  if (!cache) return c.json({ error: 'KV not configured' }, 500);

  const body = await c.req.json<{ samplingRate?: number; mode?: string }>();

  try {
    if (body.samplingRate !== undefined) {
      const rate = Math.max(0, Math.min(1, body.samplingRate));
      await cache.put('eval:samplingRate', String(rate));
    }
    if (body.mode && ['sampling', 'full', 'off'].includes(body.mode)) {
      await cache.put('eval:mode', body.mode);
    }

    return c.json({ success: true, updated: body });
  } catch (err) {
    return c.json({ error: `Failed to update config: ${err}` }, 500);
  }
});

export { evalRoutes };
