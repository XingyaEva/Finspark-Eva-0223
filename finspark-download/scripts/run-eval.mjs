#!/usr/bin/env node
/**
 * RAG 评测外部驱动脚本 — scripts/run-eval.mjs
 *
 * 目的：绕过 Cloudflare Workers CPU/timeout 限制，从外部逐题驱动评测
 * 流程：
 *   1. 获取评测详情和所有题目
 *   2. 获取已完成的结果（支持断点续跑）
 *   3. 对未完成的题目逐一调用 POST /evaluations/:id/run-one
 *   4. 所有题目完成后调用 POST /evaluations/:id/finalize 计算总分
 *
 * 用法：
 *   node scripts/run-eval.mjs --eval-id 67
 *   node scripts/run-eval.mjs --eval-id 67 --eval-id 68 --eval-id 69
 *   node scripts/run-eval.mjs --eval-id 67,68,69
 *   node scripts/run-eval.mjs --test-set-id 1 --name "v10.3-test"    # 创建新评测并运行
 *
 * 环境变量：
 *   BASE_URL  — API 基础地址 (默认: https://finspark-financial.pages.dev)
 *   DELAY_MS  — 题间延迟毫秒数 (默认: 2000)
 *   TIMEOUT   — 单题超时毫秒数 (默认: 120000)
 */

const BASE_URL = process.env.BASE_URL || 'https://finspark-financial.pages.dev';
const DELAY_MS = parseInt(process.env.DELAY_MS || '2000');
const TIMEOUT = parseInt(process.env.TIMEOUT || '120000');

// ==================== 工具函数 ====================

async function api(path, options = {}) {
  const url = `${BASE_URL}/api/rag/enhance${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `API error: ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  return m > 0 ? `${m}m${remaining}s` : `${remaining}s`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { evalIds: [], testSetId: null, name: null, config: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--eval-id' && args[i + 1]) {
      // Support comma-separated: --eval-id 67,68,69
      const ids = args[++i].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      result.evalIds.push(...ids);
    } else if (args[i] === '--test-set-id' && args[i + 1]) {
      result.testSetId = parseInt(args[++i]);
    } else if (args[i] === '--name' && args[i + 1]) {
      result.name = args[++i];
    } else if (args[i] === '--config' && args[i + 1]) {
      result.config = JSON.parse(args[++i]);
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
RAG Evaluation Driver Script

Usage:
  node scripts/run-eval.mjs --eval-id <id>              Run existing evaluation
  node scripts/run-eval.mjs --eval-id 67,68,69           Run multiple evaluations
  node scripts/run-eval.mjs --test-set-id <id> --name <name>  Create and run new evaluation

Environment:
  BASE_URL   API base (default: ${BASE_URL})
  DELAY_MS   Delay between questions in ms (default: ${DELAY_MS})
  TIMEOUT    Per-question timeout in ms (default: ${TIMEOUT})

Examples:
  node scripts/run-eval.mjs --eval-id 67
  node scripts/run-eval.mjs --eval-id 67,68,69
  BASE_URL=http://localhost:8788 node scripts/run-eval.mjs --eval-id 70
`);
      process.exit(0);
    }
  }

  return result;
}

// ==================== 核心流程 ====================

async function getQuestionsForEval(evalId) {
  // Get evaluation to find test_set_id
  const evalData = await api(`/evaluations/${evalId}`);
  const testSetId = evalData.evaluation.test_set_id;

  // Get all questions
  const qData = await api(`/test-sets/${testSetId}/questions?limit=500`);
  return qData.questions;
}

async function getCompletedQuestionIds(evalId) {
  const data = await api(`/evaluations/${evalId}/results`);
  return new Set((data.results || []).map(r => r.question_id));
}

async function runSingleQuestion(evalId, questionId, idx, total) {
  const start = Date.now();
  try {
    const data = await api(`/evaluations/${evalId}/run-one`, {
      method: 'POST',
      body: JSON.stringify({ questionId }),
      timeout: TIMEOUT,
    });
    const elapsed = Date.now() - start;
    const score = data.score?.toFixed(1) || data.score;
    console.log(`  [${idx}/${total}] Q#${questionId} => ${score} pts (${formatDuration(elapsed)}) ${data.reason || ''}`);
    return { success: true, ...data, elapsed };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`  [${idx}/${total}] Q#${questionId} FAILED (${formatDuration(elapsed)}): ${err.message}`);
    return { success: false, questionId, error: err.message, elapsed };
  }
}

async function runEvaluation(evalId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Evaluation #${evalId}`);
  console.log(`${'='.repeat(60)}`);

  // 1. Get questions
  const questions = await getQuestionsForEval(evalId);
  console.log(`Total questions: ${questions.length}`);

  // 2. Get already completed
  const completedIds = await getCompletedQuestionIds(evalId);
  console.log(`Already completed: ${completedIds.size}`);

  // 3. Filter pending
  const pending = questions.filter(q => !completedIds.has(q.id));
  if (pending.length === 0) {
    console.log('All questions already completed. Running finalize...');
    const finalResult = await api(`/evaluations/${evalId}/finalize`, { method: 'POST', body: '{}' });
    console.log(`\nFinal Score: ${finalResult.overall}`);
    console.log('Dimensions:', JSON.stringify(finalResult.dimensions, null, 2));
    return finalResult;
  }

  console.log(`Pending: ${pending.length} questions`);
  console.log(`Estimated time: ${formatDuration(pending.length * 45000)} (at ~45s/question with parallel scoring)\n`);

  // 4. Run each question sequentially
  const results = [];
  const evalStart = Date.now();

  for (let i = 0; i < pending.length; i++) {
    const q = pending[i];
    const globalIdx = completedIds.size + i + 1;
    const result = await runSingleQuestion(evalId, q.id, globalIdx, questions.length);
    results.push(result);

    // Delay between questions (avoid overwhelming the API)
    if (i < pending.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalElapsed = Date.now() - evalStart;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\nCompleted: ${successCount} success, ${failCount} failed in ${formatDuration(totalElapsed)}`);

  // 5. Finalize — calculate aggregate scores
  if (failCount < pending.length) {
    console.log('Running finalize...');
    try {
      const finalResult = await api(`/evaluations/${evalId}/finalize`, { method: 'POST', body: '{}' });
      console.log(`\nFinal Score: ${finalResult.overall}`);
      console.log('Dimensions:', JSON.stringify(finalResult.dimensions, null, 2));
      if (finalResult.scoresByType) console.log('By Type:', JSON.stringify(finalResult.scoresByType, null, 2));
      if (finalResult.scoresByDifficulty) console.log('By Difficulty:', JSON.stringify(finalResult.scoresByDifficulty, null, 2));
      return finalResult;
    } catch (err) {
      console.error('Finalize failed:', err.message);
    }
  }

  return { evalId, results };
}

async function createAndRunEvaluation(testSetId, name, config) {
  console.log(`Creating new evaluation for test set #${testSetId}...`);

  const defaultConfig = {
    searchStrategy: 'hybrid',
    topK: 12,
    minScore: 0.25,
    enableRerank: true,
    rerankWeight: 0.5,
    contextMode: 'none',
    contextWindow: 1,
  };

  const data = await api('/evaluations', {
    method: 'POST',
    body: JSON.stringify({
      testSetId,
      name: name || `eval-${new Date().toISOString().slice(0, 10)}`,
      config: config || defaultConfig,
    }),
  });

  const evalId = data.evaluation?.id || data.id;
  console.log(`Created evaluation #${evalId}`);

  return runEvaluation(evalId);
}

// ==================== 主入口 ====================

async function main() {
  const args = parseArgs();

  console.log(`RAG Evaluation Driver`);
  console.log(`API: ${BASE_URL}`);
  console.log(`Delay: ${DELAY_MS}ms | Timeout: ${TIMEOUT}ms`);

  if (args.evalIds.length > 0) {
    for (const evalId of args.evalIds) {
      await runEvaluation(evalId);
    }
  } else if (args.testSetId) {
    await createAndRunEvaluation(args.testSetId, args.name, args.config);
  } else {
    console.error('\nError: Please specify --eval-id or --test-set-id');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
