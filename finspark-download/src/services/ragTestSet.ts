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
    sources: { documentId: number; chunkId: number; pageRange?: string; relevanceScore: number }[];
    latencyMs: number;
    tokensInput: number;
    tokensOutput: number;
  }>): Promise<Evaluation> {
    const evaluation = await this.getEvaluation(evaluationId);
    const config: EvalConfig = JSON.parse(evaluation.config_json);

    // Mark as running
    await this.db.prepare(
      "UPDATE rag_evaluations SET status = 'running', started_at = datetime('now') WHERE id = ?"
    ).bind(evaluationId).run();

    // Fetch all questions
    const { questions } = await this.listQuestions(evaluation.test_set_id, { limit: 500 });

    let completed = 0;
    let exactMatchCorrect = 0;
    let semanticScoreSum = 0;
    let recallScoreSum = 0;
    let citationScoreSum = 0;

    const typeScores: Record<string, { total: number; sum: number }> = {};
    const difficultyScores: Record<string, { total: number; sum: number }> = {};

    for (const q of questions) {
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

    // Calculate final scores
    const total = questions.length || 1;
    const exactMatchScore = (exactMatchCorrect / total) * 100;
    const semanticScore = (semanticScoreSum / total);
    const recallScore = (recallScoreSum / total);
    const citationScore = (citationScoreSum / total);
    const overallScore = (exactMatchScore * 0.3 + semanticScore * 0.3 + recallScore * 0.2 + citationScore * 0.2);

    const scoresByType: Record<string, number> = {};
    for (const [k, v] of Object.entries(typeScores)) {
      scoresByType[k] = Math.round((v.sum / v.total) * 10) / 10;
    }
    const scoresByDifficulty: Record<string, number> = {};
    for (const [k, v] of Object.entries(difficultyScores)) {
      scoresByDifficulty[k] = Math.round((v.sum / v.total) * 10) / 10;
    }

    // Final update
    await this.db.prepare(
      `UPDATE rag_evaluations SET
       status = 'completed', completed_questions = ?, overall_score = ?,
       exact_match_score = ?, semantic_score = ?, recall_score = ?, citation_score = ?,
       scores_by_type = ?, scores_by_difficulty = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).bind(
      completed, Math.round(overallScore * 10) / 10,
      Math.round(exactMatchScore * 10) / 10,
      Math.round(semanticScore * 10) / 10,
      Math.round(recallScore * 10) / 10,
      Math.round(citationScore * 10) / 10,
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
  // 四维打分系统
  // ============================================================

  private async scoreResult(
    question: TestQuestion,
    result: { answer: string; sources: { documentId: number; chunkId: number; pageRange?: string; relevanceScore: number }[] }
  ): Promise<{
    overallScore: number;
    isCorrect: boolean;
    semanticScore: number;
    recallScore: number;
    citationScore: number;
    reason: string;
  }> {
    const expected = question.expected_answer.trim();
    const actual = (result.answer || '').trim();

    // 1. Exact match scoring (for number/name/boolean types)
    let isCorrect = false;
    if (['number', 'name', 'boolean'].includes(question.question_type)) {
      isCorrect = this.fuzzyMatch(expected, actual);
    }

    // 2. Semantic scoring via LLM
    let semanticScore = 0;
    try {
      semanticScore = await this.llmSemanticScore(question.question, expected, actual);
    } catch {
      // Fallback to simple overlap
      semanticScore = this.simpleOverlapScore(expected, actual);
    }

    if (semanticScore >= 80) isCorrect = true;

    // 3. Recall scoring — check if reference pages were retrieved
    let recallScore = 100; // default if no reference pages specified
    try {
      const refPages = JSON.parse(question.reference_pages || '[]') as string[];
      if (refPages.length > 0) {
        const retrievedPages = result.sources
          .map(s => s.pageRange)
          .filter(Boolean);
        const found = refPages.filter(rp =>
          retrievedPages.some(tp => tp && tp.includes(rp))
        );
        recallScore = (found.length / refPages.length) * 100;
      }
    } catch {
      recallScore = 50; // error parsing
    }

    // 4. Citation scoring — how many sources used were relevant
    let citationScore = 0;
    if (result.sources.length > 0) {
      const highScoreSources = result.sources.filter(s => s.relevanceScore >= 0.5);
      citationScore = (highScoreSources.length / result.sources.length) * 100;
    } else {
      citationScore = 0;
    }

    const overallScore = (
      (isCorrect ? 100 : semanticScore) * 0.3 +
      semanticScore * 0.3 +
      recallScore * 0.2 +
      citationScore * 0.2
    );

    const reason = `精确匹配: ${isCorrect ? '✓' : '✗'} | 语义: ${Math.round(semanticScore)}% | 召回: ${Math.round(recallScore)}% | 引用: ${Math.round(citationScore)}%`;

    return { overallScore, isCorrect, semanticScore, recallScore, citationScore, reason };
  }

  private fuzzyMatch(expected: string, actual: string): boolean {
    const normalize = (s: string) => s.replace(/[,，。.%％元亿万千百\s]/g, '').toLowerCase();
    const ne = normalize(expected);
    const na = normalize(actual);
    if (na.includes(ne) || ne.includes(na)) return true;

    // Extract numbers and compare
    const numE = expected.match(/[\d,.]+/g);
    const numA = actual.match(/[\d,.]+/g);
    if (numE && numA) {
      for (const e of numE) {
        for (const a of numA) {
          if (e.replace(/,/g, '') === a.replace(/,/g, '')) return true;
        }
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

  private async llmSemanticScore(question: string, expected: string, actual: string): Promise<number> {
    const prompt = `评估以下 RAG 系统的回答质量。

问题: ${question}
标准答案: ${expected}
模型回答: ${actual}

请只返回一个 0-100 的整数分数，不要返回其他内容。
评分标准：
- 100: 完全正确且信息完整
- 80-99: 核心信息正确但表述略有差异
- 60-79: 部分正确
- 40-59: 有部分相关信息但不够准确
- 0-39: 错误或无关`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: '你是一个严格的 RAG 评估打分员。只返回 0-100 之间的整数分数。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 10,
      }),
    });

    if (!response.ok) throw new Error('LLM scoring failed');

    const data = await response.json() as any;
    const content = (data.choices?.[0]?.message?.content || '').trim();
    const score = parseInt(content, 10);
    return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
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
