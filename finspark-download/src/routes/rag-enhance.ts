/**
 * RAG 测试集与评测 API 路由 — routes/rag-enhance.ts
 *
 * 提供：
 * - 测试集 CRUD（创建 / 列表 / 详情 / 编辑 / 删除）
 * - 测试题目 CRUD（手动 / LLM 自动生成 / 扩写）
 * - 批量评测引擎（创建评测任务、运行、查询进度、查询结果）
 * - 评测历史对比
 *
 * 关联页面: P.6 测试集管理, P.7 批量评测与打分
 */

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createTestSetService } from '../services/ragTestSet';
import { createRAGService, createEmbeddingConfig } from '../services/rag';
import { createBM25Service } from '../services/ragBm25';
import { createFTS5Service } from '../services/ragFts5';
import { createIntentService } from '../services/ragIntent';
import { createPipelineService } from '../services/ragPipeline';
import { createGpuProvider } from '../services/ragGpuProvider';

const ragEnhance = new Hono<{ Bindings: Bindings }>();

/** 创建 TestSetService 实例 */
function createTestSetServiceFromEnv(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');
  return createTestSetService(env.DB, env.CACHE, apiKey);
}

/** 创建 Pipeline 用于评测（支持 GPU 路由） */
function createPipelineForEval(env: Bindings) {
  const apiKey = env.VECTORENGINE_API_KEY;
  if (!apiKey) throw new Error('VECTORENGINE_API_KEY not configured');

  const gpuProvider = createGpuProvider({
    gpuServerUrl: env.GPU_SERVER_URL,
    gpuLlmModel: env.GPU_LLM_MODEL,
    gpuRoutingMode: env.GPU_ROUTING_MODE,
    gpuProxyAuthToken: env.GPU_PROXY_AUTH_TOKEN,
    cloudApiKey: apiKey,
  });

  const embeddingConfig = createEmbeddingConfig({
    dashscopeApiKey: env.DASHSCOPE_API_KEY || undefined,
    vectorengineApiKey: apiKey,
  });
  const ragService = createRAGService(env.DB, env.CACHE, apiKey, embeddingConfig, env.VECTORIZE);
  const bm25Service = createBM25Service(env.DB);
  const fts5Service = createFTS5Service(env.DB);
  
  const intentLlm = gpuProvider.getLlmConfig('intent');
  const intentService = createIntentService(intentLlm.apiKey, intentLlm.baseUrl, intentLlm.model, intentLlm.extraHeaders);
  
  return createPipelineService(env.DB, env.CACHE, ragService, bm25Service, intentService, apiKey, undefined, gpuProvider, fts5Service);
}

// ==================== 测试集 CRUD ====================

/**
 * GET /test-sets — 获取测试集列表
 * Query: ?status=active&limit=20&offset=0
 */
ragEnhance.get('/test-sets', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const status = c.req.query('status') || 'active';
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await svc.listTestSets({ status, limit, offset });
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Enhance] List test sets error:', error);
    return c.json({ success: false, error: '获取测试集列表失败' }, 500);
  }
});

/**
 * POST /test-sets — 创建测试集
 * Body: { name, description?, documentIds? }
 */
ragEnhance.post('/test-sets', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const body = await c.req.json();

    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: '测试集名称不能为空' }, 400);
    }

    const testSet = await svc.createTestSet({
      name: body.name.trim(),
      description: body.description || undefined,
      documentIds: body.documentIds || [],
    }, body.userId || undefined);

    return c.json({ success: true, testSet });
  } catch (error) {
    console.error('[RAG Enhance] Create test set error:', error);
    return c.json({ success: false, error: '创建测试集失败' }, 500);
  }
});

/**
 * GET /test-sets/:id — 获取测试集详情
 */
ragEnhance.get('/test-sets/:id', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const testSet = await svc.getTestSet(id);
    return c.json({ success: true, testSet });
  } catch (error) {
    console.error('[RAG Enhance] Get test set error:', error);
    return c.json({ success: false, error: '获取测试集详情失败' }, 500);
  }
});

/**
 * PUT /test-sets/:id — 更新测试集
 * Body: { name?, description?, documentIds? }
 */
ragEnhance.put('/test-sets/:id', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const body = await c.req.json();
    const testSet = await svc.updateTestSet(id, {
      name: body.name,
      description: body.description,
      documentIds: body.documentIds,
    });

    return c.json({ success: true, testSet });
  } catch (error) {
    console.error('[RAG Enhance] Update test set error:', error);
    return c.json({ success: false, error: '更新测试集失败' }, 500);
  }
});

/**
 * DELETE /test-sets/:id — 删除测试集
 */
ragEnhance.delete('/test-sets/:id', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    await svc.deleteTestSet(id);
    return c.json({ success: true, message: '测试集已删除' });
  } catch (error) {
    console.error('[RAG Enhance] Delete test set error:', error);
    return c.json({ success: false, error: '删除测试集失败' }, 500);
  }
});

// ==================== 测试题目管理 ====================

/**
 * GET /test-sets/:id/questions — 获取测试集题目列表
 * Query: ?type=&difficulty=&limit=50&offset=0
 */
ragEnhance.get('/test-sets/:id/questions', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const testSetId = parseInt(c.req.param('id'));
    if (!testSetId) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const type = c.req.query('type') || undefined;
    const difficulty = c.req.query('difficulty') || undefined;
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await svc.listQuestions(testSetId, { type, difficulty, limit, offset });
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Enhance] List questions error:', error);
    return c.json({ success: false, error: '获取题目列表失败' }, 500);
  }
});

/**
 * POST /test-sets/:id/questions — 添加测试题目
 * Body: { question, expectedAnswer, questionType?, difficulty?, referencePages? }
 */
ragEnhance.post('/test-sets/:id/questions', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const testSetId = parseInt(c.req.param('id'));
    if (!testSetId) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const body = await c.req.json();
    if (!body.question || !body.expectedAnswer) {
      return c.json({ success: false, error: '问题和标准答案不能为空' }, 400);
    }

    const question = await svc.addQuestion(testSetId, {
      question: body.question,
      questionType: body.questionType || 'factual',
      expectedAnswer: body.expectedAnswer,
      referencePages: body.referencePages || [],
      difficulty: body.difficulty || 'medium',
      source: 'manual',
    });

    return c.json({ success: true, question });
  } catch (error) {
    console.error('[RAG Enhance] Add question error:', error);
    return c.json({ success: false, error: '添加题目失败' }, 500);
  }
});

/**
 * POST /test-sets/:id/questions/batch — 批量添加题目
 * Body: { questions: [{ question, expectedAnswer, questionType?, difficulty? }] }
 */
ragEnhance.post('/test-sets/:id/questions/batch', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const testSetId = parseInt(c.req.param('id'));
    if (!testSetId) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const body = await c.req.json();
    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return c.json({ success: false, error: '请提供至少一道题目' }, 400);
    }

    const added = await svc.addQuestionsBatch(testSetId, body.questions.map((q: any) => ({
      question: q.question,
      questionType: q.questionType || 'factual',
      expectedAnswer: q.expectedAnswer,
      referencePages: q.referencePages || [],
      difficulty: q.difficulty || 'medium',
      source: q.source || 'manual',
    })));

    return c.json({ success: true, added });
  } catch (error) {
    console.error('[RAG Enhance] Batch add questions error:', error);
    return c.json({ success: false, error: '批量添加题目失败' }, 500);
  }
});

/**
 * PUT /questions/:id — 更新题目
 * Body: { question?, expectedAnswer?, questionType?, difficulty?, referencePages? }
 */
ragEnhance.put('/questions/:id', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的题目 ID' }, 400);

    const body = await c.req.json();
    const question = await svc.updateQuestion(id, {
      question: body.question,
      questionType: body.questionType,
      expectedAnswer: body.expectedAnswer,
      referencePages: body.referencePages,
      difficulty: body.difficulty,
    });

    return c.json({ success: true, question });
  } catch (error) {
    console.error('[RAG Enhance] Update question error:', error);
    return c.json({ success: false, error: '更新题目失败' }, 500);
  }
});

/**
 * DELETE /questions/:id — 删除题目
 * Query: ?testSetId=
 */
ragEnhance.delete('/questions/:id', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    const testSetId = parseInt(c.req.query('testSetId') || '0');
    if (!id) return c.json({ success: false, error: '无效的题目 ID' }, 400);
    if (!testSetId) return c.json({ success: false, error: '需要 testSetId 参数' }, 400);

    await svc.deleteQuestion(id, testSetId);
    return c.json({ success: true, message: '题目已删除' });
  } catch (error) {
    console.error('[RAG Enhance] Delete question error:', error);
    return c.json({ success: false, error: '删除题目失败' }, 500);
  }
});

// ==================== LLM 题目生成 & 扩写 ====================

/**
 * POST /test-sets/:id/generate — LLM 自动生成题目
 * Body: { documentId, count, typeDistribution?, difficultyDistribution? }
 */
ragEnhance.post('/test-sets/:id/generate', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const testSetId = parseInt(c.req.param('id'));
    if (!testSetId) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const body = await c.req.json();
    if (!body.documentId || !body.count) {
      return c.json({ success: false, error: '请指定文档 ID 和生成数量' }, 400);
    }

    const result = await svc.generateQuestions(testSetId, {
      documentId: body.documentId,
      count: Math.min(body.count, 20),
      typeDistribution: body.typeDistribution,
      difficultyDistribution: body.difficultyDistribution,
    });

    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Enhance] Generate questions error:', error);
    return c.json({ success: false, error: '题目生成失败: ' + (error as Error).message }, 500);
  }
});

/**
 * POST /questions/:id/expand — LLM 问题扩写
 * Body: { count?: number }
 */
ragEnhance.post('/questions/:id/expand', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的题目 ID' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const count = Math.min(body.count || 3, 5);

    const variants = await svc.expandQuestion(id, count);
    return c.json({ success: true, variants });
  } catch (error) {
    console.error('[RAG Enhance] Expand question error:', error);
    return c.json({ success: false, error: '问题扩写失败: ' + (error as Error).message }, 500);
  }
});

/**
 * GET /questions/:id/variants — 获取题目扩写变体
 */
ragEnhance.get('/questions/:id/variants', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的题目 ID' }, 400);

    const variants = await svc.getQuestionVariants(id);
    return c.json({ success: true, variants });
  } catch (error) {
    console.error('[RAG Enhance] Get variants error:', error);
    return c.json({ success: false, error: '获取扩写变体失败' }, 500);
  }
});

// ==================== 评测引擎 ====================

/**
 * POST /evaluations — 创建评测任务
 * Body: { name, testSetId, config: { searchStrategy, topK, minScore, enableRerank, rerankWeight } }
 */
ragEnhance.post('/evaluations', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const body = await c.req.json();

    if (!body.name || !body.testSetId) {
      return c.json({ success: false, error: '请指定评测名称和测试集 ID' }, 400);
    }

    const config = body.config || {};
    const evaluation = await svc.createEvaluation({
      name: body.name,
      testSetId: body.testSetId,
      config: {
        searchStrategy: config.searchStrategy || 'hybrid',
        topK: config.topK || 5,
        minScore: config.minScore || 0.25,
        enableRerank: config.enableRerank || false,
        rerankWeight: config.rerankWeight || 0.7,
        contextMode: config.contextMode || 'none',
        contextWindow: config.contextWindow ?? 1,
      },
      userId: body.userId || undefined,
    });

    return c.json({ success: true, evaluation });
  } catch (error) {
    console.error('[RAG Enhance] Create evaluation error:', error);
    return c.json({ success: false, error: '创建评测任务失败' }, 500);
  }
});

/**
 * POST /evaluations/:id/run — 运行评测
 */
ragEnhance.post('/evaluations/:id/run', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const pipelineService = createPipelineForEval(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的评测 ID' }, 400);

    // Check status — allow resume for stalled 'running' evaluations
    const existing = await svc.getEvaluation(id);
    const body = await c.req.json().catch(() => ({}));
    if (existing.status === 'running' && !(body as any).resume) {
      return c.json({ success: false, error: '评测任务正在运行中，传入 {"resume": true} 可恢复执行' }, 409);
    }

    // Run evaluation asynchronously via ctx.waitUntil if available
    const ragQueryFn = async (question: string, config: any) => {
      const start = Date.now();
      const result = await pipelineService.enhancedQuery({
        question,
        config: {
          enableBm25: config.searchStrategy !== 'vector',
          enableRerank: config.enableRerank || false,
          topK: config.topK || 5,
          minScore: config.minScore || 0.25,
          contextMode: config.contextMode || 'none',
          contextWindow: config.contextWindow ?? 1,
        },
      });

      return {
        answer: result.answer,
        sources: result.sources.map(s => ({
          documentId: s.documentId,
          chunkId: s.chunkId || 0,
          pageRange: s.pageRange,
          relevanceScore: s.relevanceScore,
          // 评测打分使用完整 chunk 内容（_fullContent），确保 faithfulness/sufficiency 评估准确
          chunkContent: s._fullContent || s.chunkContent || '',
          documentTitle: s.documentTitle || '',
        })),
        latencyMs: result.pipeline.totalLatencyMs,
        tokensInput: 0,
        tokensOutput: 0,
      };
    };

    // Start evaluation (non-blocking via waitUntil if possible)
    const evalPromise = svc.runEvaluation(id, ragQueryFn);

    // Use c.executionCtx.waitUntil for Cloudflare Workers
    try {
      (c as any).executionCtx?.waitUntil?.(evalPromise);
    } catch {
      // If waitUntil not available, await directly
      await evalPromise;
    }

    return c.json({
      success: true,
      message: '评测任务已启动',
      evaluationId: id,
    });
  } catch (error) {
    console.error('[RAG Enhance] Run evaluation error:', error);
    return c.json({ success: false, error: '运行评测失败: ' + (error as Error).message }, 500);
  }
});

/**
 * POST /evaluations/:id/finalize — 手动计算并保存最终评分
 * 用于 Worker 超时导致 runEvaluation 未完成最终化的情况
 * 从已有的 rag_evaluation_results 中读取所有打分，计算 7 维加权总分并更新数据库
 */
ragEnhance.post('/evaluations/:id/finalize', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'Invalid evaluation ID' }, 400);

    const evaluation = await svc.getEvaluation(id);
    if (!evaluation) return c.json({ success: false, error: '评测不存在' }, 404);

    // Read all results for this evaluation
    const db = c.env.DB;
    const results = await db.prepare(
      `SELECT question_id, question_type, difficulty, score, is_correct, scoring_reason
       FROM rag_evaluation_results WHERE evaluation_id = ?
       ORDER BY question_id ASC`
    ).bind(id).all();

    const allResults = results.results || [];
    if (allResults.length === 0) {
      return c.json({ success: false, error: '没有评测结果' }, 400);
    }

    // Deduplicate by question_id (keep last = latest)
    const byQid = new Map<number, any>();
    for (const r of allResults) {
      byQid.set(r.question_id as number, r);
    }

    const uniqueResults = [...byQid.values()];
    const total = uniqueResults.length;

    // Parse dimension scores from scoring_reason
    let suffSum = 0, relSum = 0, intSum = 0, recSum = 0;
    let semSum = 0, exSum = 0, faithSum = 0, citSum = 0;

    const typeScores: Record<string, { total: number; sum: number }> = {};
    const difficultyScores: Record<string, { total: number; sum: number }> = {};

    for (const r of uniqueResults) {
      const reason = (r.scoring_reason || '') as string;
      const score = (r.score || 0) as number;
      const qt = (r.question_type || 'unknown') as string;
      const diff = (r.difficulty || 'unknown') as string;

      // Parse: "充分: 10% | 相关: 76% | 完整: 43% | 召回: 56% | 语义: 40% | 精确: 25% | 忠实: 20% | 引用: 100%"
      const parseVal = (key: string): number => {
        const m = reason.match(new RegExp(key + '[：:]\\s*(\\d+)%'));
        return m ? parseInt(m[1]) : 50;
      };
      suffSum += parseVal('充分');
      relSum += parseVal('相关');
      intSum += parseVal('完整');
      recSum += parseVal('召回');
      semSum += parseVal('语义');
      exSum += parseVal('精确');
      faithSum += parseVal('忠实');
      citSum += parseVal('引用');

      // Accumulate by type and difficulty
      if (!typeScores[qt]) typeScores[qt] = { total: 0, sum: 0 };
      typeScores[qt].total++;
      typeScores[qt].sum += score;
      if (!difficultyScores[diff]) difficultyScores[diff] = { total: 0, sum: 0 };
      difficultyScores[diff].total++;
      difficultyScores[diff].sum += score;
    }

    // 7-dimension weighted v3 formula
    const suf = suffSum / total;
    const rel = relSum / total;
    const intg = intSum / total;
    const rec = recSum / total;
    const sem = semSum / total;
    const ex = exSum / total;
    const faith = faithSum / total;
    const cit = citSum / total;

    const overallScore = suf * 0.25 + rel * 0.10 + intg * 0.10 + rec * 0.10 + sem * 0.25 + ex * 0.10 + faith * 0.10;

    const scoresByType: Record<string, number> = {};
    for (const [k, v] of Object.entries(typeScores)) {
      scoresByType[k] = Math.round((v.sum / v.total) * 10) / 10;
    }
    const scoresByDifficulty: Record<string, number> = {};
    for (const [k, v] of Object.entries(difficultyScores)) {
      scoresByDifficulty[k] = Math.round((v.sum / v.total) * 10) / 10;
    }

    // Update database
    await db.prepare(
      `UPDATE rag_evaluations SET
       status = 'completed', completed_questions = ?, overall_score = ?,
       exact_match_score = ?, semantic_score = ?, recall_score = ?, citation_score = ?,
       faithfulness_score = ?,
       context_sufficiency_score = ?, chunk_relevance_score = ?, chunk_integrity_score = ?,
       scores_by_type = ?, scores_by_difficulty = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      total, Math.round(overallScore * 10) / 10,
      Math.round(ex * 10) / 10,
      Math.round(sem * 10) / 10,
      Math.round(rec * 10) / 10,
      Math.round(cit * 10) / 10,
      Math.round(faith * 10) / 10,
      Math.round(suf * 10) / 10,
      Math.round(rel * 10) / 10,
      Math.round(intg * 10) / 10,
      JSON.stringify(scoresByType),
      JSON.stringify(scoresByDifficulty),
      id
    ).run();

    // Update test set
    await db.prepare(
      "UPDATE rag_test_sets SET last_eval_score = ?, last_eval_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(Math.round(overallScore * 10) / 10, evaluation.test_set_id).run();

    return c.json({
      success: true,
      evaluationId: id,
      uniqueQuestions: total,
      overall: Math.round(overallScore * 10) / 10,
      dimensions: {
        contextSufficiency: Math.round(suf * 10) / 10,
        chunkRelevance: Math.round(rel * 10) / 10,
        chunkIntegrity: Math.round(intg * 10) / 10,
        recall: Math.round(rec * 10) / 10,
        semantic: Math.round(sem * 10) / 10,
        exactMatch: Math.round(ex * 10) / 10,
        faithfulness: Math.round(faith * 10) / 10,
        citation: Math.round(cit * 10) / 10,
      },
      scoresByType,
      scoresByDifficulty,
    });
  } catch (error) {
    console.error('[RAG Enhance] Finalize evaluation error:', error);
    return c.json({ success: false, error: '最终化评测失败: ' + (error as Error).message }, 500);
  }
});

/**
 * GET /evaluations — 获取评测列表
 * Query: ?testSetId=&status=&limit=20&offset=0
 */
ragEnhance.get('/evaluations', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const testSetId = c.req.query('testSetId') ? parseInt(c.req.query('testSetId')!) : undefined;
    const status = c.req.query('status') || undefined;
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await svc.listEvaluations({ testSetId, status, limit, offset });
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('[RAG Enhance] List evaluations error:', error);
    return c.json({ success: false, error: '获取评测列表失败' }, 500);
  }
});

/**
 * GET /evaluations/:id — 获取评测详情
 */
ragEnhance.get('/evaluations/:id', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的评测 ID' }, 400);

    const evaluation = await svc.getEvaluation(id);
    return c.json({ success: true, evaluation });
  } catch (error) {
    console.error('[RAG Enhance] Get evaluation error:', error);
    return c.json({ success: false, error: '获取评测详情失败' }, 500);
  }
});

/**
 * GET /evaluations/:id/results — 获取评测逐题结果
 */
ragEnhance.get('/evaluations/:id/results', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的评测 ID' }, 400);

    const results = await svc.getEvaluationResults(id);
    return c.json({ success: true, results });
  } catch (error) {
    console.error('[RAG Enhance] Get evaluation results error:', error);
    return c.json({ success: false, error: '获取评测结果失败' }, 500);
  }
});

/**
 * GET /evaluations/:id/progress — 获取评测进度
 */
ragEnhance.get('/evaluations/:id/progress', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const id = parseInt(c.req.param('id'));
    if (!id) return c.json({ success: false, error: '无效的评测 ID' }, 400);

    const progress = await svc.getEvalProgress(id);
    return c.json({ success: true, progress });
  } catch (error) {
    console.error('[RAG Enhance] Get eval progress error:', error);
    return c.json({ success: false, error: '获取评测进度失败' }, 500);
  }
});

/**
 * GET /evaluations/history/:testSetId — 获取测试集的评测历史（用于趋势对比）
 */
ragEnhance.get('/evaluations/history/:testSetId', async (c) => {
  try {
    const svc = createTestSetServiceFromEnv(c.env);
    const testSetId = parseInt(c.req.param('testSetId'));
    if (!testSetId) return c.json({ success: false, error: '无效的测试集 ID' }, 400);

    const history = await svc.getEvaluationHistory(testSetId);
    return c.json({ success: true, history });
  } catch (error) {
    console.error('[RAG Enhance] Get eval history error:', error);
    return c.json({ success: false, error: '获取评测历史失败' }, 500);
  }
});

export default ragEnhance;
