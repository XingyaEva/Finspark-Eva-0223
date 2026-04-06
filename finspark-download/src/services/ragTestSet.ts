/**
 * 测试集与评测服务 — services/ragTestSet.ts
 *
 * 核心职责：
 * 1. 测试集 CRUD（创建/查看/编辑/删除）
 * 2. 测试题目管理（手动创建/LLM 自动生成/CSV 导入）
 * 3. LLM 问题扩写（同义改写变体）
 * 4. 批量评测引擎（逐题问答 → 记录结果 → 进度更新）
 * 5. 四维打分系统（精确匹配 + LLM 语义 + Recall + 引用准确率）
 *
 * 关联页面: P.6 测试集管理, P.7 批量评测与打分
 */

// ==================== 类型定义 ====================

export interface TestSet {
  id: number;
  name: string;
  description: string | null;
  document_ids: string;
  question_count: number;
  last_eval_score: number | null;
  last_eval_at: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestQuestion {
  id: number;
  test_set_id: number;
  question: string;
  question_type: string;
  expected_answer: string;
  reference_pages: string;
  difficulty: string;
  source: string;
  metadata: string;
  created_at: string;
}

export interface TestQuestionVariant {
  id: number;
  question_id: number;
  variant_text: string;
  created_at: string;
}

export interface Evaluation {
  id: number;
  name: string;
  test_set_id: number;
  config_json: string;
  status: string;
  total_questions: number;
  completed_questions: number;
  overall_score: number | null;
  exact_match_score: number | null;
  semantic_score: number | null;
  recall_score: number | null;
  citation_score: number | null;
  faithfulness_score: number | null;
  scores_by_type: string;
  scores_by_difficulty: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EvaluationResult {
  id: number;
  evaluation_id: number;
  question_id: number;
  question_text: string;
  question_type: string | null;
  difficulty: string | null;
  expected_answer: string | null;
  model_answer: string | null;
  score: number | null;
  is_correct: number;
  scoring_reason: string | null;
  retrieval_results: string;
  sources_used: string;
  latency_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

export interface CreateTestSetInput {
  name: string;
  description?: string;
  documentIds?: number[];
}

export interface CreateQuestionInput {
  question: string;
  questionType?: string;
  expectedAnswer: string;
  referencePages?: string[];
  difficulty?: string;
  source?: string;
}

export interface GenerateQuestionsConfig {
  documentId: number;
  count: number;
  typeDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
}

export interface EvalConfig {
  searchStrategy: 'vector' | 'bm25' | 'hybrid';
  topK: number;
  minScore: number;
  enableRerank: boolean;
  rerankWeight: number;
  llmModel?: string;
}

// ==================== Service 实现 ====================

export class TestSetService {
  constructor(
    private db: D1Database,
    private cache: KVNamespace,
    private apiKey: string,
    private baseUrl: string = 'https://api.vectorengine.ai/v1'
  ) {}

  // ============================================================
  // 测试集 CRUD
  // ============================================================

  async createTestSet(input: CreateTestSetInput, userId?: string): Promise<TestSet> {
    const result = await this.db.prepare(
      `INSERT INTO rag_test_sets (name, description, document_ids, created_by)
       VALUES (?, ?, ?, ?)`
    ).bind(
      input.name,
      input.description || null,
      JSON.stringify(input.documentIds || []),
      userId || null
    ).run();

    const id = result.meta?.last_row_id;
    return this.getTestSet(id as number);
  }

  async getTestSet(id: number): Promise<TestSet> {
    const row = await this.db.prepare(
      'SELECT * FROM rag_test_sets WHERE id = ?'
    ).bind(id).first();
    if (!row) throw new Error(`Test set ${id} not found`);
    return row as unknown as TestSet;
  }

  async listTestSets(params: { status?: string; limit?: number; offset?: number } = {}): Promise<{ sets: TestSet[]; total: number }> {
    const { status = 'active', limit = 20, offset = 0 } = params;
    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      binds.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as total FROM rag_test_sets ${where}`
    ).bind(...binds).first();

    const rows = await this.db.prepare(
      `SELECT * FROM rag_test_sets ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    return {
      sets: (rows.results || []) as unknown as TestSet[],
      total: (countResult?.total as number) || 0,
    };
  }

  async updateTestSet(id: number, data: Partial<CreateTestSetInput>): Promise<TestSet> {
    const updates: string[] = [];
    const binds: unknown[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); binds.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); binds.push(data.description); }
    if (data.documentIds !== undefined) { updates.push('document_ids = ?'); binds.push(JSON.stringify(data.documentIds)); }
    updates.push("updated_at = datetime('now')");

    if (updates.length <= 1) return this.getTestSet(id);

    await this.db.prepare(
      `UPDATE rag_test_sets SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...binds, id).run();

    return this.getTestSet(id);
  }

  async deleteTestSet(id: number): Promise<void> {
    await this.db.prepare('DELETE FROM rag_test_question_variants WHERE question_id IN (SELECT id FROM rag_test_questions WHERE test_set_id = ?)').bind(id).run();
    await this.db.prepare('DELETE FROM rag_evaluation_results WHERE evaluation_id IN (SELECT id FROM rag_evaluations WHERE test_set_id = ?)').bind(id).run();
    await this.db.prepare('DELETE FROM rag_evaluations WHERE test_set_id = ?').bind(id).run();
    await this.db.prepare('DELETE FROM rag_test_questions WHERE test_set_id = ?').bind(id).run();
    await this.db.prepare('DELETE FROM rag_test_sets WHERE id = ?').bind(id).run();
  }

  // ============================================================
  // 测试题目 CRUD
  // ============================================================

  async addQuestion(testSetId: number, input: CreateQuestionInput): Promise<TestQuestion> {
    const result = await this.db.prepare(
      `INSERT INTO rag_test_questions (test_set_id, question, question_type, expected_answer, reference_pages, difficulty, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      testSetId,
      input.question,
      input.questionType || 'factual',
      input.expectedAnswer,
      JSON.stringify(input.referencePages || []),
      input.difficulty || 'medium',
      input.source || 'manual'
    ).run();

    // Update question count
    await this.db.prepare(
      "UPDATE rag_test_sets SET question_count = (SELECT COUNT(*) FROM rag_test_questions WHERE test_set_id = ?), updated_at = datetime('now') WHERE id = ?"
    ).bind(testSetId, testSetId).run();

    const id = result.meta?.last_row_id;
    const row = await this.db.prepare('SELECT * FROM rag_test_questions WHERE id = ?').bind(id).first();
    return row as unknown as TestQuestion;
  }

  async addQuestionsBatch(testSetId: number, questions: CreateQuestionInput[]): Promise<number> {
    let added = 0;
    for (const q of questions) {
      try {
        await this.db.prepare(
          `INSERT INTO rag_test_questions (test_set_id, question, question_type, expected_answer, reference_pages, difficulty, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          testSetId, q.question, q.questionType || 'factual',
          q.expectedAnswer, JSON.stringify(q.referencePages || []),
          q.difficulty || 'medium', q.source || 'manual'
        ).run();
        added++;
      } catch (e) {
        console.error('[TestSet] Failed to add question:', e);
      }
    }

    await this.db.prepare(
      "UPDATE rag_test_sets SET question_count = (SELECT COUNT(*) FROM rag_test_questions WHERE test_set_id = ?), updated_at = datetime('now') WHERE id = ?"
    ).bind(testSetId, testSetId).run();

    return added;
  }

  async listQuestions(testSetId: number, params: { type?: string; difficulty?: string; limit?: number; offset?: number } = {}): Promise<{ questions: TestQuestion[]; total: number }> {
    const { type, difficulty, limit = 50, offset = 0 } = params;
    const conditions = ['test_set_id = ?'];
    const binds: unknown[] = [testSetId];

    if (type) { conditions.push('question_type = ?'); binds.push(type); }
    if (difficulty) { conditions.push('difficulty = ?'); binds.push(difficulty); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await this.db.prepare(`SELECT COUNT(*) as total FROM rag_test_questions ${where}`).bind(...binds).first();
    const rows = await this.db.prepare(`SELECT * FROM rag_test_questions ${where} ORDER BY id ASC LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all();

    return {
      questions: (rows.results || []) as unknown as TestQuestion[],
      total: (countResult?.total as number) || 0,
    };
  }

  async getQuestion(id: number): Promise<TestQuestion> {
    const row = await this.db.prepare('SELECT * FROM rag_test_questions WHERE id = ?').bind(id).first();
    if (!row) throw new Error(`Question ${id} not found`);
    return row as unknown as TestQuestion;
  }

  async updateQuestion(id: number, data: Partial<CreateQuestionInput>): Promise<TestQuestion> {
    const updates: string[] = [];
    const binds: unknown[] = [];

    if (data.question !== undefined) { updates.push('question = ?'); binds.push(data.question); }
    if (data.questionType !== undefined) { updates.push('question_type = ?'); binds.push(data.questionType); }
    if (data.expectedAnswer !== undefined) { updates.push('expected_answer = ?'); binds.push(data.expectedAnswer); }
    if (data.referencePages !== undefined) { updates.push('reference_pages = ?'); binds.push(JSON.stringify(data.referencePages)); }
    if (data.difficulty !== undefined) { updates.push('difficulty = ?'); binds.push(data.difficulty); }

    if (updates.length === 0) return this.getQuestion(id);

    await this.db.prepare(
      `UPDATE rag_test_questions SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...binds, id).run();

    return this.getQuestion(id);
  }

  async deleteQuestion(questionId: number, testSetId: number): Promise<void> {
    await this.db.prepare('DELETE FROM rag_test_question_variants WHERE question_id = ?').bind(questionId).run();
    await this.db.prepare('DELETE FROM rag_test_questions WHERE id = ?').bind(questionId).run();
    await this.db.prepare(
      "UPDATE rag_test_sets SET question_count = (SELECT COUNT(*) FROM rag_test_questions WHERE test_set_id = ?), updated_at = datetime('now') WHERE id = ?"
    ).bind(testSetId, testSetId).run();
  }

  // ============================================================
  // LLM 题目自动生成
  // ============================================================

  async generateQuestions(testSetId: number, config: GenerateQuestionsConfig): Promise<{ generated: number; questions: CreateQuestionInput[] }> {
    // Fetch document chunks for context
    const chunks = await this.db.prepare(
      `SELECT id, content, chunk_index FROM rag_chunks
       WHERE document_id = ? AND status = 'active'
       ORDER BY chunk_index ASC LIMIT 30`
    ).bind(config.documentId).all();

    if (!chunks.results || chunks.results.length === 0) {
      throw new Error('No chunks found for the specified document');
    }

    // Build context from chunks
    const chunkTexts = (chunks.results as any[])
      .map((c, i) => `[Chunk ${i + 1}]\n${(c.content as string).substring(0, 800)}`)
      .join('\n\n');

    const typeHint = config.typeDistribution
      ? `题目类型分布要求：${Object.entries(config.typeDistribution).map(([k, v]) => `${k}(${v}%)`).join(', ')}`
      : '题目类型均匀分布：factual, name, boolean, number, open';

    const difficultyHint = config.difficultyDistribution
      ? `难度分布要求：${Object.entries(config.difficultyDistribution).map(([k, v]) => `${k}(${v}%)`).join(', ')}`
      : '难度分布：easy(30%), medium(50%), hard(20%)';

    const prompt = `基于以下文档内容，生成 ${config.count} 道高质量的 RAG 测试题。

要求：
1. 每道题必须能从给定文本中找到答案
2. ${typeHint}
3. ${difficultyHint}
4. 问题应多样化，覆盖不同方面
5. 标准答案应简洁准确

题目类型说明：
- factual: 事实查询（公司做什么、产品是什么）
- name: 名称查询（CEO、审计师、子公司名）
- boolean: 是非判断（是否盈利、是否超过某值）
- number: 数值查询（营收、利润、增长率）
- comparative: 比较类（同比变化、排名）
- open: 开放分析（竞争优势、风险因素）

请以 JSON 数组格式返回，每个元素包含：
{
  "question": "问题文本",
  "question_type": "类型",
  "expected_answer": "标准答案",
  "difficulty": "easy|medium|hard"
}

文档内容：
${chunkTexts}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [
            { role: 'system', content: '你是一个专业的测试集生成器。请严格按照 JSON 数组格式返回测试题。只返回 JSON 数组，不要包含其他文本。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';

      // Parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Failed to parse LLM response as JSON array');

      const parsed = JSON.parse(jsonMatch[0]) as any[];
      const questions: CreateQuestionInput[] = parsed.map((q: any) => ({
        question: q.question,
        questionType: q.question_type || 'factual',
        expectedAnswer: q.expected_answer,
        difficulty: q.difficulty || 'medium',
        source: 'llm',
      }));

      // Add to test set
      const added = await this.addQuestionsBatch(testSetId, questions);

      return { generated: added, questions };
    } catch (error) {
      console.error('[TestSet] LLM generation error:', error);
      throw new Error(`Failed to generate questions: ${(error as Error).message}`);
    }
  }

  // ============================================================
  // LLM 问题扩写
  // ============================================================

  async expandQuestion(questionId: number, count: number = 3): Promise<TestQuestionVariant[]> {
    const question = await this.getQuestion(questionId);

    const prompt = `请对以下问题生成 ${count} 种不同的自然语言改写版本。要求：
1. 保持语义不变
2. 使用不同的表达方式
3. 包括正式/口语化/简洁等不同风格
4. 每种改写应与原始问题有明显的措辞差异

原始问题：${question.question}

请以 JSON 数组格式返回，每个元素只包含改写后的文本字符串。
示例: ["改写1", "改写2", "改写3"]`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [
            { role: 'system', content: '你是一个专业的问题改写助手。只返回 JSON 数组格式的改写结果。' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) throw new Error(`LLM API error: ${response.status}`);

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Failed to parse LLM response');

      const variants = JSON.parse(jsonMatch[0]) as string[];
      const results: TestQuestionVariant[] = [];

      for (const variant of variants.slice(0, count)) {
        const r = await this.db.prepare(
          'INSERT INTO rag_test_question_variants (question_id, variant_text) VALUES (?, ?)'
        ).bind(questionId, variant).run();
        results.push({
          id: r.meta?.last_row_id as number,
          question_id: questionId,
          variant_text: variant,
          created_at: new Date().toISOString(),
        });
      }

      return results;
    } catch (error) {
      console.error('[TestSet] Expansion error:', error);
      throw new Error(`Failed to expand question: ${(error as Error).message}`);
    }
  }

  async getQuestionVariants(questionId: number): Promise<TestQuestionVariant[]> {
    const rows = await this.db.prepare(
      'SELECT * FROM rag_test_question_variants WHERE question_id = ? ORDER BY id ASC'
    ).bind(questionId).all();
    return (rows.results || []) as unknown as TestQuestionVariant[];
  }

  // ============================================================
  // 评测引擎
  // ============================================================

  async createEvaluation(params: {
    name: string;
    testSetId: number;
    config: EvalConfig;
    userId?: string;
  }): Promise<Evaluation> {
    const testSet = await this.getTestSet(params.testSetId);

    const result = await this.db.prepare(
      `INSERT INTO rag_evaluations (name, test_set_id, config_json, total_questions, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      params.name,
      params.testSetId,
      JSON.stringify(params.config),
      testSet.question_count,
      params.userId || null
    ).run();

    const id = result.meta?.last_row_id;
    return this.getEvaluation(id as number);
  }

  async getEvaluation(id: number): Promise<Evaluation> {
    const row = await this.db.prepare('SELECT * FROM rag_evaluations WHERE id = ?').bind(id).first();
    if (!row) throw new Error(`Evaluation ${id} not found`);
    return row as unknown as Evaluation;
  }

  async listEvaluations(params: { testSetId?: number; status?: string; limit?: number; offset?: number } = {}): Promise<{ evaluations: Evaluation[]; total: number }> {
    const { testSetId, status, limit = 20, offset = 0 } = params;
    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (testSetId) { conditions.push('test_set_id = ?'); binds.push(testSetId); }
    if (status) { conditions.push('status = ?'); binds.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.db.prepare(`SELECT COUNT(*) as total FROM rag_evaluations ${where}`).bind(...binds).first();
    const rows = await this.db.prepare(`SELECT * FROM rag_evaluations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all();

    return {
      evaluations: (rows.results || []) as unknown as Evaluation[],
      total: (countResult?.total as number) || 0,
    };
  }

  async getEvaluationResults(evaluationId: number): Promise<EvaluationResult[]> {
    const rows = await this.db.prepare(
      'SELECT * FROM rag_evaluation_results WHERE evaluation_id = ? ORDER BY id ASC'
    ).bind(evaluationId).all();
    return (rows.results || []) as unknown as EvaluationResult[];
  }

  /**
   * 运行评测 — 逐题调用 RAG pipeline 并自动打分
   * 注意：这是一个耗时操作，应通过 KV 追踪进度
   */
  async runEvaluation(evaluationId: number, ragQueryFn: (question: string, config: any) => Promise<{
    answer: string;
    sources: { documentId: number; chunkId: number; pageRange?: string; relevanceScore: number; chunkContent?: string; documentTitle?: string }[];
    latencyMs: number;
    tokensInput: number;
    tokensOutput: number;
  }>): Promise<Evaluation> {
    const evaluation = await this.getEvaluation(evaluationId);
    const config: EvalConfig = JSON.parse(evaluation.config_json);

    // Resume support: load already-completed question IDs
    const existingResults = await this.getEvaluationResults(evaluationId);
    const completedQuestionIds = new Set(existingResults.map(r => r.question_id));

    // Mark as running (keep existing started_at if resuming)
    if (completedQuestionIds.size === 0) {
      await this.db.prepare(
        "UPDATE rag_evaluations SET status = 'running', started_at = datetime('now') WHERE id = ?"
      ).bind(evaluationId).run();
    } else {
      await this.db.prepare(
        "UPDATE rag_evaluations SET status = 'running' WHERE id = ?"
      ).bind(evaluationId).run();
      console.log(`[Eval] Resuming eval #${evaluationId}, ${completedQuestionIds.size} questions already done`);
    }

    // Fetch all questions
    const { questions } = await this.listQuestions(evaluation.test_set_id, { limit: 500 });

    // Accumulate from existing results first
    let completed = existingResults.length;
    let exactMatchCorrect = existingResults.filter(r => r.is_correct === 1).length;
    let semanticScoreSum = 0;
    let recallScoreSum = 0;
    let citationScoreSum = 0;
    let faithfulnessScoreSum = 0;

    // Parse existing scores from scoring_reason
    for (const r of existingResults) {
      const reason = r.scoring_reason || '';
      const semMatch = reason.match(/语义:\s*(\d+)%/);
      const recMatch = reason.match(/召回:\s*(\d+)%/);
      const citMatch = reason.match(/引用:\s*(\d+)%/);
      const faithMatch = reason.match(/忠实:\s*(\d+)%/);
      semanticScoreSum += semMatch ? parseInt(semMatch[1]) : (r.score || 0);
      recallScoreSum += recMatch ? parseInt(recMatch[1]) : 100;
      citationScoreSum += citMatch ? parseInt(citMatch[1]) : 0;
      faithfulnessScoreSum += faithMatch ? parseInt(faithMatch[1]) : 50;
    }

    const typeScores: Record<string, { total: number; sum: number }> = {};
    const difficultyScores: Record<string, { total: number; sum: number }> = {};

    // Accumulate type/difficulty from existing results
    for (const r of existingResults) {
      const qt = r.question_type || 'unknown';
      const diff = r.difficulty || 'unknown';
      if (!typeScores[qt]) typeScores[qt] = { total: 0, sum: 0 };
      typeScores[qt].total++;
      typeScores[qt].sum += (r.score || 0);
      if (!difficultyScores[diff]) difficultyScores[diff] = { total: 0, sum: 0 };
      difficultyScores[diff].total++;
      difficultyScores[diff].sum += (r.score || 0);
    }

    // Process only unanswered questions
    const pendingQuestions = questions.filter(q => !completedQuestionIds.has(q.id));

    for (const q of pendingQuestions) {
      try {
        // Run RAG query
        const result = await ragQueryFn(q.question, config);

        // Score the result
        const scoring = await this.scoreResult(q, result);

        // Save result
        await this.db.prepare(
          `INSERT INTO rag_evaluation_results
           (evaluation_id, question_id, question_text, question_type, difficulty, expected_answer, model_answer, score, is_correct, scoring_reason, retrieval_results, sources_used, latency_ms, tokens_input, tokens_output)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          evaluationId, q.id, q.question, q.question_type, q.difficulty,
          q.expected_answer, result.answer, scoring.overallScore,
          scoring.isCorrect ? 1 : 0, scoring.reason,
          JSON.stringify(result.sources), JSON.stringify(result.sources),
          result.latencyMs, result.tokensInput, result.tokensOutput
        ).run();

        // Accumulate scores
        if (scoring.isCorrect) exactMatchCorrect++;
        semanticScoreSum += scoring.semanticScore;
        recallScoreSum += scoring.recallScore;
        citationScoreSum += scoring.citationScore;
        faithfulnessScoreSum += scoring.faithfulnessScore;

        // By type
        if (!typeScores[q.question_type]) typeScores[q.question_type] = { total: 0, sum: 0 };
        typeScores[q.question_type].total++;
        typeScores[q.question_type].sum += scoring.overallScore;

        // By difficulty
        if (!difficultyScores[q.difficulty]) difficultyScores[q.difficulty] = { total: 0, sum: 0 };
        difficultyScores[q.difficulty].total++;
        difficultyScores[q.difficulty].sum += scoring.overallScore;

        completed++;

        // Update progress in KV
        await this.cache.put(`eval:${evaluationId}`, JSON.stringify({
          status: 'running',
          completed,
          total: questions.length,
          percentage: Math.round((completed / questions.length) * 100),
        }), { expirationTtl: 3600 });

        // Update DB progress
        await this.db.prepare(
          'UPDATE rag_evaluations SET completed_questions = ? WHERE id = ?'
        ).bind(completed, evaluationId).run();

      } catch (error) {
        console.error(`[Eval] Error on question ${q.id}:`, error);
        // Record failed result
        await this.db.prepare(
          `INSERT INTO rag_evaluation_results
           (evaluation_id, question_id, question_text, question_type, difficulty, expected_answer, model_answer, score, is_correct, scoring_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
        ).bind(evaluationId, q.id, q.question, q.question_type, q.difficulty, q.expected_answer, '', `Error: ${(error as Error).message}`).run();
        completed++;
      }
    }

    // Calculate final scores (5-dimension weighted formula)
    const total = questions.length || 1;
    const exactMatchScore = (exactMatchCorrect / total) * 100;
    const semanticScore = (semanticScoreSum / total);
    const recallScore = (recallScoreSum / total);
    const citationScore = (citationScoreSum / total);
    const faithfulnessScore = (faithfulnessScoreSum / total);
    // Updated: semantic 30% + faithfulness 20% + exact 20% + recall 15% + citation 15%
    const overallScore = (
      semanticScore * 0.30 +
      faithfulnessScore * 0.20 +
      exactMatchScore * 0.20 +
      recallScore * 0.15 +
      citationScore * 0.15
    );

    const scoresByType: Record<string, number> = {};
    for (const [k, v] of Object.entries(typeScores)) {
      scoresByType[k] = Math.round((v.sum / v.total) * 10) / 10;
    }
    const scoresByDifficulty: Record<string, number> = {};
    for (const [k, v] of Object.entries(difficultyScores)) {
      scoresByDifficulty[k] = Math.round((v.sum / v.total) * 10) / 10;
    }

    // Final update (includes faithfulness_score)
    await this.db.prepare(
      `UPDATE rag_evaluations SET
       status = 'completed', completed_questions = ?, overall_score = ?,
       exact_match_score = ?, semantic_score = ?, recall_score = ?, citation_score = ?,
       faithfulness_score = ?,
       scores_by_type = ?, scores_by_difficulty = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      completed, Math.round(overallScore * 10) / 10,
      Math.round(exactMatchScore * 10) / 10,
      Math.round(semanticScore * 10) / 10,
      Math.round(recallScore * 10) / 10,
      Math.round(citationScore * 10) / 10,
      Math.round(faithfulnessScore * 10) / 10,
      JSON.stringify(scoresByType),
      JSON.stringify(scoresByDifficulty),
      evaluationId
    ).run();

    // Update test set with latest eval score
    await this.db.prepare(
      "UPDATE rag_test_sets SET last_eval_score = ?, last_eval_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(Math.round(overallScore * 10) / 10, evaluation.test_set_id).run();

    // Clean up KV progress
    await this.cache.delete(`eval:${evaluationId}`);

    return this.getEvaluation(evaluationId);
  }

  // ============================================================
  // 五维增强打分系统 (v2)
  // 维度: 语义正确性 30% + 忠实度 20% + 精确匹配 20% + 召回 15% + 引用 15%
  // ============================================================

  private async scoreResult(
    question: TestQuestion,
    result: {
      answer: string;
      sources: { documentId: number; chunkId: number; pageRange?: string; relevanceScore: number; chunkContent?: string; documentTitle?: string }[];
    }
  ): Promise<{
    overallScore: number;
    isCorrect: boolean;
    semanticScore: number;
    recallScore: number;
    citationScore: number;
    faithfulnessScore: number;
    reason: string;
  }> {
    const expected = question.expected_answer.trim();
    const actual = (result.answer || '').trim();

    // 1. Exact match scoring (for number/name/boolean types)
    let isCorrect = false;
    if (['number', 'name', 'boolean', 'factual'].includes(question.question_type)) {
      isCorrect = this.fuzzyMatch(expected, actual);
    }

    // 2. Enhanced semantic scoring via LLM (type-differentiated prompt)
    let semanticScore = 0;
    try {
      semanticScore = await this.llmSemanticScore(
        question.question, expected, actual, question.question_type, question.difficulty
      );
    } catch {
      // Fallback to simple overlap
      semanticScore = this.simpleOverlapScore(expected, actual);
    }

    if (semanticScore >= 80) isCorrect = true;

    // 3. Recall scoring — FIXED: use document-hit when no reference pages
    let recallScore = 0;
    try {
      const refPages = JSON.parse(question.reference_pages || '[]') as string[];
      if (refPages.length > 0) {
        // Original page-level recall
        const retrievedPages = result.sources
          .map(s => s.pageRange)
          .filter(Boolean);
        const found = refPages.filter(rp =>
          retrievedPages.some(tp => tp && tp.includes(rp))
        );
        recallScore = (found.length / refPages.length) * 100;
      } else {
        // Fallback: document-level recall + content relevance
        // Check if retrieved sources contain meaningful content (not empty/error)
        recallScore = this.computeDocumentRecall(expected, actual, result.sources);
      }
    } catch {
      recallScore = 30; // error parsing
    }

    // 4. Citation scoring — how many sources used were relevant
    let citationScore = 0;
    if (result.sources.length > 0) {
      const highScoreSources = result.sources.filter(s => s.relevanceScore >= 0.5);
      citationScore = (highScoreSources.length / result.sources.length) * 100;
    }

    // 5. NEW: Faithfulness scoring — does the answer stay within context?
    let faithfulnessScore = 50; // default neutral
    try {
      const contextText = this.buildContextForFaithfulness(result.sources);
      if (contextText && actual) {
        faithfulnessScore = await this.llmFaithfulnessScore(
          question.question, actual, contextText
        );
      }
    } catch (err) {
      console.warn('[Eval] Faithfulness scoring failed, using fallback:', err);
      // Fallback: if answer is short and sources are relevant, assume decent faithfulness
      faithfulnessScore = result.sources.length > 0 ? 60 : 30;
    }

    // Weighted overall: semantic 30% + faithfulness 20% + exact 20% + recall 15% + citation 15%
    const overallScore = (
      semanticScore * 0.30 +
      faithfulnessScore * 0.20 +
      (isCorrect ? 100 : semanticScore) * 0.20 +
      recallScore * 0.15 +
      citationScore * 0.15
    );

    const reason = [
      `精确匹配: ${isCorrect ? '✓' : '✗'}`,
      `语义: ${Math.round(semanticScore)}%`,
      `忠实: ${Math.round(faithfulnessScore)}%`,
      `召回: ${Math.round(recallScore)}%`,
      `引用: ${Math.round(citationScore)}%`,
    ].join(' | ');

    return { overallScore, isCorrect, semanticScore, recallScore, citationScore, faithfulnessScore, reason };
  }

  /**
   * 构建 faithfulness 检测所需的 context 文本（拼接 chunk 内容）
   */
  private buildContextForFaithfulness(
    sources: { chunkContent?: string; documentTitle?: string; relevanceScore: number }[]
  ): string {
    const parts: string[] = [];
    for (const s of sources) {
      if (s.chunkContent) {
        const title = s.documentTitle ? `[${s.documentTitle}] ` : '';
        parts.push(`${title}${s.chunkContent}`);
      }
    }
    // Limit to ~6000 chars to keep LLM call manageable
    const joined = parts.join('\n---\n');
    return joined.length > 6000 ? joined.slice(0, 6000) + '...' : joined;
  }

  /**
   * 文档级召回评分（当 reference_pages 为空时使用）
   * 综合评估：是否检索到了相关文档 + 答案中的关键实体是否在 chunks 中出现
   */
  private computeDocumentRecall(
    expected: string,
    actual: string,
    sources: { documentId: number; chunkContent?: string; relevanceScore: number }[]
  ): number {
    if (sources.length === 0) return 0;

    // Factor 1: Source diversity and relevance (0-50)
    const avgRelevance = sources.reduce((s, src) => s + src.relevanceScore, 0) / sources.length;
    const relevanceFactor = Math.min(50, avgRelevance * 100);

    // Factor 2: Key entity coverage — are key numbers/names from expected answer found in chunks? (0-50)
    const keyEntities = this.extractKeyEntities(expected);
    if (keyEntities.length === 0) {
      // No extractable entities, use pure relevance
      return Math.min(100, relevanceFactor * 2);
    }

    const chunkTexts = sources
      .map(s => s.chunkContent || '')
      .join(' ');
    let found = 0;
    for (const entity of keyEntities) {
      if (chunkTexts.includes(entity)) found++;
    }
    const entityCoverage = (found / keyEntities.length) * 50;

    return Math.min(100, Math.round(relevanceFactor + entityCoverage));
  }

  /**
   * 从标准答案中提取关键实体（数字、专有名词等）
   */
  private extractKeyEntities(text: string): string[] {
    const entities: string[] = [];

    // Extract numbers with units (e.g., "7,771.02亿", "425.12万辆")
    const numbers = text.match(/[\d,]+\.?\d*[亿万千百元%％辆台套件个]+/g);
    if (numbers) {
      for (const n of numbers) {
        // Normalize: remove commas for matching
        entities.push(n.replace(/,/g, ''));
      }
    }

    // Extract pure numbers (e.g., "2100", "46.06")
    const pureNums = text.match(/\d{4,}|\d+\.\d{2,}/g);
    if (pureNums) {
      for (const n of pureNums) {
        if (!entities.some(e => e.includes(n))) {
          entities.push(n);
        }
      }
    }

    // Extract Chinese proper nouns (company names, product names, etc.)
    const cnNames = text.match(/[一-龥]{2,}(?:银行|电力|水泥|时代|华创|比亚迪|五粮液|证券|基金)/g);
    if (cnNames) {
      entities.push(...cnNames);
    }

    return [...new Set(entities)].slice(0, 15); // Deduplicate, max 15 entities
  }

  private fuzzyMatch(expected: string, actual: string): boolean {
    const normalize = (s: string) => s.replace(/[,，。.%％元亿万千百\s]/g, '').toLowerCase();
    const ne = normalize(expected);
    const na = normalize(actual);
    if (ne.length > 3 && (na.includes(ne) || ne.includes(na))) return true;

    // Extract numbers and compare
    const numE = expected.match(/[\d,.]+/g);
    const numA = actual.match(/[\d,.]+/g);
    if (numE && numA) {
      let matchCount = 0;
      for (const e of numE) {
        const eClean = e.replace(/,/g, '');
        if (eClean.length < 2) continue; // skip trivial numbers
        for (const a of numA) {
          if (eClean === a.replace(/,/g, '')) { matchCount++; break; }
        }
      }
      // At least half of key numbers must match
      const significantNums = numE.filter(e => e.replace(/,/g, '').length >= 2);
      if (significantNums.length > 0 && matchCount >= Math.ceil(significantNums.length * 0.5)) {
        return true;
      }
    }

    return false;
  }

  private simpleOverlapScore(expected: string, actual: string): number {
    const wordsE = new Set(expected.split(/[\s,，。.!！?？；;：:、]+/).filter(w => w.length > 1));
    const wordsA = new Set(actual.split(/[\s,，。.!！?？；;：:、]+/).filter(w => w.length > 1));
    if (wordsE.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsE) {
      if (wordsA.has(w)) overlap++;
    }
    return Math.min(100, (overlap / wordsE.size) * 100);
  }

  /**
   * 增强版语义评分 — 按题目类型差异化 prompt
   */
  private async llmSemanticScore(
    question: string,
    expected: string,
    actual: string,
    questionType: string,
    difficulty: string
  ): Promise<number> {
    // Type-specific scoring criteria
    let typeGuidance = '';
    switch (questionType) {
      case 'factual':
      case 'number':
      case 'name':
        typeGuidance = `这是一道事实/数值型题目，评分重点：
- 核心数字是否正确（允许四舍五入误差<5%）
- 关键实体名称是否一致
- 数值单位是否匹配（亿元 vs 万元）
- 如果标准答案包含多个数据点，检查是否全部涵盖`;
        break;
      case 'comparative':
        typeGuidance = `这是一道对比分析型题目，评分重点：
- 是否涵盖了所有需要对比的对象
- 对比维度是否完整（业务、财务、行业等）
- 对比结论是否与标准答案一致
- 是否有数据支撑对比结论`;
        break;
      case 'open':
        typeGuidance = `这是一道开放分析型题目，评分重点：
- 分析视角是否与标准答案的核心观点一致
- 是否覆盖了标准答案中的关键论点（>=60%即可）
- 分析是否有数据/事实支撑
- 允许额外的合理分析，不因此扣分`;
        break;
      default:
        typeGuidance = `评分重点：核心信息正确性、信息完整度、数据准确性`;
    }

    const prompt = `评估以下 RAG 系统的回答质量。

【题目类型】${questionType} | 难度: ${difficulty}
【评分要点】${typeGuidance}

【问题】${question}
【标准答案】${expected}
【模型回答】${actual}

请严格按照以下 JSON 格式返回，不要添加其他内容：
{"score": <0-100整数>, "brief": "<一句话评分理由>"}

评分标准：
- 90-100: 核心信息完全正确且完整，数据准确
- 75-89: 核心信息正确但有细微遗漏或表述差异
- 60-74: 大部分正确但遗漏重要信息点
- 40-59: 部分相关但关键数据缺失或有误
- 20-39: 仅有少量相关信息
- 0-19: 完全错误或答非所问`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: '你是专业的 RAG 系统评估员。请严格按照 JSON 格式返回评分结果。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!response.ok) throw new Error(`LLM scoring failed: ${response.status}`);

    const data = await response.json() as any;
    const content = (data.choices?.[0]?.message?.content || '').trim();

    // Parse JSON response
    try {
      const parsed = JSON.parse(content);
      const score = parseInt(parsed.score, 10);
      return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
    } catch {
      // Fallback: extract number from text
      const numMatch = content.match(/(\d{1,3})/);
      return numMatch ? Math.min(100, Math.max(0, parseInt(numMatch[1], 10))) : 50;
    }
  }

  /**
   * 忠实度评分 — 检测答案是否超出检索 context 的范围
   * 核心问题: 模型是否"捏造"了 context 中不存在的信息?
   */
  private async llmFaithfulnessScore(
    question: string,
    answer: string,
    context: string
  ): Promise<number> {
    const prompt = `你是 RAG 系统的忠实度审核员。请判断模型回答是否忠实于检索到的上下文。

【问题】${question}

【检索到的上下文】
${context}

【模型回答】
${answer}

请评估模型回答的忠实度，即回答中的信息是否都能在上下文中找到依据。

请严格按照以下 JSON 格式返回：
{"score": <0-100整数>, "issues": "<发现的忠实度问题，没问题则写'无'>"}

评分标准：
- 90-100: 回答完全基于上下文，所有数据和结论都有据可查
- 70-89: 回答基本忠实，有少量合理推断但不超出上下文范围
- 50-69: 回答部分基于上下文，但添加了一些上下文中没有的信息
- 30-49: 回答中有较多信息在上下文中找不到依据
- 0-29: 回答严重偏离上下文，大量捏造信息`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: '你是 RAG 忠实度检测专家。严格按照 JSON 格式返回结果。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (!response.ok) throw new Error(`Faithfulness scoring failed: ${response.status}`);

    const data = await response.json() as any;
    const content = (data.choices?.[0]?.message?.content || '').trim();

    try {
      const parsed = JSON.parse(content);
      const score = parseInt(parsed.score, 10);
      return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
    } catch {
      const numMatch = content.match(/(\d{1,3})/);
      return numMatch ? Math.min(100, Math.max(0, parseInt(numMatch[1], 10))) : 50;
    }
  }

  // ============================================================
  // 评测历史对比
  // ============================================================

  async getEvaluationHistory(testSetId: number): Promise<Evaluation[]> {
    const rows = await this.db.prepare(
      "SELECT * FROM rag_evaluations WHERE test_set_id = ? AND status = 'completed' ORDER BY created_at ASC"
    ).bind(testSetId).all();
    return (rows.results || []) as unknown as Evaluation[];
  }

  async getEvalProgress(evaluationId: number): Promise<{ status: string; completed: number; total: number; percentage: number } | null> {
    const cached = await this.cache.get(`eval:${evaluationId}`);
    if (cached) return JSON.parse(cached);
    const ev = await this.getEvaluation(evaluationId);
    return {
      status: ev.status,
      completed: ev.completed_questions,
      total: ev.total_questions,
      percentage: ev.total_questions > 0 ? Math.round((ev.completed_questions / ev.total_questions) * 100) : 0,
    };
  }
}

// ==================== 工厂函数 ====================

export function createTestSetService(
  db: D1Database,
  cache: KVNamespace,
  apiKey: string,
  baseUrl?: string
): TestSetService {
  return new TestSetService(db, cache, apiKey, baseUrl);
}
