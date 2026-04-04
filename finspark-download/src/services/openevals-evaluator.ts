/**
 * OpenEvals 风格评估服务
 * 
 * 基于 OpenEvals (langchain-ai/openevals) LLM-as-Judge 模式的 TypeScript 实现
 * 核心功能:
 * 1. LLM-as-Judge: 使用 Judge 模型评估 Agent 输出质量
 * 2. 多维度评估: 6 个评估维度 + 加权综合分
 * 3. Langfuse 集成: 评估分数自动记录到 Langfuse Trace
 * 4. 异步非阻塞: 评估不影响主分析流程
 * 5. 抽样控制: 支持 sampling 模式降低成本
 * 
 * 评估架构:
 *   Layer 1: 基础指标 (JSON合规/字段完整率/延迟) — 已有 (orchestrator)
 *   Layer 2: Agent 输出质量 (6维 LLM-as-Judge) — 本服务
 *   Layer 3: 报告级评估 (跨Agent一致性) — 本服务
 * 
 * @see docs/openevals-evaluation-framework.md
 */

import type { TraceContext } from './langfuse';
import { recordScore } from './langfuse';
import {
  FINANCIAL_HALLUCINATION_PROMPT,
  FINANCIAL_ANALYSIS_DEPTH_PROMPT,
  FINANCIAL_LOGICAL_CONSISTENCY_PROMPT,
  FINANCIAL_EXPRESSION_QUALITY_PROMPT,
  AGENT_EVAL_PROMPTS,
  CROSS_AGENT_CONSISTENCY_PROMPT,
  EVAL_DIMENSION_WEIGHTS,
  type EvalDimension,
} from './eval-prompts';

// ============ 类型定义 ============

export interface EvalConfig {
  /** 是否启用评估 (默认 true) */
  enabled?: boolean;
  /** 评估模式: sampling=10%抽样, full=全量, off=关闭 */
  mode?: 'sampling' | 'full' | 'off';
  /** 抽样率 (0-1, 仅 sampling 模式, 默认 0.1) */
  samplingRate?: number;
  /** Judge 模型 (默认 gpt-4.1) */
  judgeModel?: string;
  /** 评估维度选择 (默认全部6维) */
  dimensions?: EvalDimension[];
  /** 是否执行 Layer3 跨Agent一致性检查 (默认 false, 仅 full 模式) */
  enableCrossConsistency?: boolean;
  /** 最大并发评估数 (防止 Workers CPU 超时, 默认 2) */
  maxConcurrency?: number;
  /** 单次 Judge 调用超时 (ms, 默认 15000) */
  judgeTimeoutMs?: number;
  /** Judge 降级模型 (主模型失败时使用, 默认 gpt-4.1-mini) */
  fallbackJudgeModel?: string;
  /** D1 数据库引用 (用于持久化评分) */
  db?: any;
  /** 关联的报告 ID */
  reportId?: number;
}

export interface EvalScore {
  /** 评估维度名 */
  dimension: string;
  /** 分数 (0-1) */
  score: number;
  /** 评审理由 */
  reasoning: string;
}

export interface AgentEvalResult {
  /** Agent 类型 */
  agentType: string;
  /** 各维度评分 */
  scores: {
    dataAccuracy?: EvalScore;
    analysisDepth?: EvalScore;
    professionalInsight?: EvalScore;
    logicalConsistency?: EvalScore;
    expressionQuality?: EvalScore;
    hallucination?: EvalScore;
  };
  /** 加权综合分 (0-1) */
  weightedTotal: number;
  /** Judge 模型 */
  judgeModel: string;
  /** 评估耗时 (ms) */
  evalLatencyMs: number;
  /** 是否跳过 (抽样未命中) */
  skipped: boolean;
}

export interface ReportEvalResult {
  /** 跨 Agent 一致性评分 */
  crossConsistency?: EvalScore;
  /** 整体报告评分 */
  overallScore: number;
  /** 所有 Agent 评估结果 */
  agentResults: AgentEvalResult[];
}

/** LLM 调用函数签名 (复用 VectorEngine) */
export type LLMCallFn = (
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; temperature?: number }
) => Promise<string>;

// ============ 评估服务 ============

export class OpenEvalsEvaluator {
  private config: Required<EvalConfig>;
  private llmCall: LLMCallFn;
  private langfuseTrace: TraceContext | null;
  private agentResults: AgentEvalResult[] = [];
  /** 当前正在执行的 Judge 调用数 */
  private activeCalls = 0;
  /** Judge 调用失败次数 (用于触发降级) */
  private judgeFailCount = 0;
  /** 是否已降级到 fallback 模型 */
  private degraded = false;

  constructor(
    llmCall: LLMCallFn,
    langfuseTrace: TraceContext | null,
    config?: EvalConfig,
  ) {
    this.llmCall = llmCall;
    this.langfuseTrace = langfuseTrace;
    this.config = {
      enabled: config?.enabled !== false,
      mode: config?.mode || 'sampling',
      samplingRate: config?.samplingRate ?? 0.1,
      judgeModel: config?.judgeModel || 'gpt-4.1',
      dimensions: config?.dimensions || [
        'dataAccuracy', 'analysisDepth', 'professionalInsight',
        'logicalConsistency', 'expressionQuality', 'hallucination',
      ],
      enableCrossConsistency: config?.enableCrossConsistency ?? false,
      maxConcurrency: config?.maxConcurrency ?? 2,
      judgeTimeoutMs: config?.judgeTimeoutMs ?? 15000,
      fallbackJudgeModel: config?.fallbackJudgeModel || 'gpt-4.1-mini',
      db: config?.db || null,
      reportId: config?.reportId ?? 0,
    };
  }

  /**
   * 判断当前 Agent 是否需要评估 (基于抽样率)
   */
  private shouldEvaluate(): boolean {
    if (!this.config.enabled || this.config.mode === 'off') return false;
    if (this.config.mode === 'full') return true;
    // sampling 模式: 按概率抽样
    return Math.random() < this.config.samplingRate;
  }

  /**
   * 获取当前实际使用的 Judge 模型 (考虑降级)
   */
  private getCurrentJudgeModel(): string {
    return this.degraded ? this.config.fallbackJudgeModel : this.config.judgeModel;
  }

  /**
   * 带超时的 Promise 包装
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[OpenEvals] ${label} 超时 (${ms}ms)`));
      }, ms);
      promise.then(
        val => { clearTimeout(timer); resolve(val); },
        err => { clearTimeout(timer); reject(err); },
      );
    });
  }

  /**
   * 并发控制信号量 — 等待直到有空闲 slot
   */
  private async acquireSlot(): Promise<void> {
    while (this.activeCalls >= this.config.maxConcurrency) {
      await new Promise(r => setTimeout(r, 100));
    }
    this.activeCalls++;
  }

  private releaseSlot(): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
  }

  /**
   * 执行单个 LLM-as-Judge 评估
   * P2.1: 并发限制 + 超时控制
   * P2.3: 主模型失败 → 自动降级到 fallback 模型
   */
  private async runJudge(
    prompt: string,
    inputs: string,
    outputs: string,
  ): Promise<EvalScore> {
    const filledPrompt = prompt
      .replace('{inputs}', inputs)
      .replace('{outputs}', outputs);

    await this.acquireSlot();
    try {
      const model = this.getCurrentJudgeModel();
      const response = await this.withTimeout(
        this.llmCall(
          '你是专业的财务分析质量评审专家。请严格按照JSON格式返回评估结果。',
          filledPrompt,
          { model, temperature: 0.1 },
        ),
        this.config.judgeTimeoutMs,
        `Judge(${model})`,
      );

      // 成功：重置失败计数
      if (this.degraded) {
        // 降级模型成功，保持降级
      } else {
        this.judgeFailCount = 0;
      }
      return this.parseJudgeResponse(response);
    } catch (error) {
      this.judgeFailCount++;
      const currentModel = this.getCurrentJudgeModel();
      console.error(`[OpenEvals] Judge(${currentModel}) 调用失败 (第${this.judgeFailCount}次):`, error);

      // 连续失败 2 次 → 降级到 fallback 模型
      if (!this.degraded && this.judgeFailCount >= 2) {
        this.degraded = true;
        console.warn(`[OpenEvals] ⚠️ 降级: ${this.config.judgeModel} → ${this.config.fallbackJudgeModel}`);

        // 用 fallback 模型重试一次
        try {
          const response = await this.withTimeout(
            this.llmCall(
              '你是专业的财务分析质量评审专家。请严格按照JSON格式返回评估结果。',
              filledPrompt,
              { model: this.config.fallbackJudgeModel, temperature: 0.1 },
            ),
            this.config.judgeTimeoutMs,
            `Judge(${this.config.fallbackJudgeModel})-retry`,
          );
          return this.parseJudgeResponse(response);
        } catch (retryError) {
          console.error('[OpenEvals] Fallback Judge 也失败:', retryError);
        }
      }

      return { dimension: 'unknown', score: -1, reasoning: `评估失败: ${error}` };
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * 解析 Judge 模型的 JSON 响应
   */
  private parseJudgeResponse(response: string): EvalScore {
    try {
      // 尝试直接解析
      const parsed = JSON.parse(response);
      return {
        dimension: '',
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      // 尝试从 markdown 中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*?"score"[\s\S]*?"reasoning"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            dimension: '',
            score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
            reasoning: String(parsed.reasoning || ''),
          };
        } catch { /* fall through */ }
      }

      // 尝试从文本中提取分数
      const scoreMatch = response.match(/(?:score|评分)[：:]\s*([\d.]+)/i);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;
      return {
        dimension: '',
        score: Math.max(0, Math.min(1, score)),
        reasoning: response.slice(0, 500),
      };
    }
  }

  /**
   * 评估单个 Agent 输出 (Layer 2)
   * 
   * 执行 6 个维度的 LLM-as-Judge 评估:
   * 1. Agent专用评估 → dataAccuracy + professionalInsight (合并)
   * 2. 分析深度评估 → analysisDepth
   * 3. 逻辑一致性评估 → logicalConsistency
   * 4. 表达质量评估 → expressionQuality
   * 5. 幻觉检测 → hallucination
   * 
   * @param agentType Agent 类型标识
   * @param inputData 输入给 Agent 的数据 (用于评估准确性)
   * @param agentOutput Agent 的 JSON 输出
   */
  async evaluateAgent(
    agentType: string,
    inputData: string,
    agentOutput: string,
  ): Promise<AgentEvalResult> {
    const startTime = Date.now();

    // 抽样检查
    if (!this.shouldEvaluate()) {
      const skippedResult: AgentEvalResult = {
        agentType,
        scores: {},
        weightedTotal: -1,
        judgeModel: this.config.judgeModel,
        evalLatencyMs: 0,
        skipped: true,
      };
      this.agentResults.push(skippedResult);
      return skippedResult;
    }

    console.log(`[OpenEvals] 开始评估 Agent: ${agentType} (Judge: ${this.config.judgeModel})`);

    // 截断输入输出以控制评估成本
    const truncatedInput = inputData.slice(0, 8000);
    const truncatedOutput = agentOutput.slice(0, 8000);

    const scores: AgentEvalResult['scores'] = {};

    // 并发受限的多维度评估 (P2.1: maxConcurrency 控制)
    const evalPromises: Promise<void>[] = [];

    // 1. Agent 专用评估 → 映射为 dataAccuracy + professionalInsight
    const agentPrompt = AGENT_EVAL_PROMPTS[agentType];
    if (agentPrompt && this.config.dimensions.includes('dataAccuracy')) {
      evalPromises.push(
        this.runJudge(agentPrompt, truncatedInput, truncatedOutput).then(result => {
          result.dimension = 'dataAccuracy';
          scores.dataAccuracy = result;
          // 同时复用为 professionalInsight (Agent 专用 prompt 综合评估了两个维度)
          if (this.config.dimensions.includes('professionalInsight')) {
            scores.professionalInsight = { ...result, dimension: 'professionalInsight' };
          }
        }),
      );
    }

    // 2. 分析深度评估
    if (this.config.dimensions.includes('analysisDepth')) {
      evalPromises.push(
        this.runJudge(FINANCIAL_ANALYSIS_DEPTH_PROMPT, truncatedInput, truncatedOutput).then(result => {
          result.dimension = 'analysisDepth';
          scores.analysisDepth = result;
        }),
      );
    }

    // 3. 逻辑一致性评估
    if (this.config.dimensions.includes('logicalConsistency')) {
      evalPromises.push(
        this.runJudge(FINANCIAL_LOGICAL_CONSISTENCY_PROMPT, '', truncatedOutput).then(result => {
          result.dimension = 'logicalConsistency';
          scores.logicalConsistency = result;
        }),
      );
    }

    // 4. 表达质量评估
    if (this.config.dimensions.includes('expressionQuality')) {
      evalPromises.push(
        this.runJudge(FINANCIAL_EXPRESSION_QUALITY_PROMPT, '', truncatedOutput).then(result => {
          result.dimension = 'expressionQuality';
          scores.expressionQuality = result;
        }),
      );
    }

    // 5. 幻觉检测
    if (this.config.dimensions.includes('hallucination')) {
      evalPromises.push(
        this.runJudge(FINANCIAL_HALLUCINATION_PROMPT, truncatedInput, truncatedOutput).then(result => {
          result.dimension = 'hallucination';
          scores.hallucination = result;
        }),
      );
    }

    // 等待所有评估完成 (并发由 acquireSlot/releaseSlot 控制)
    await Promise.all(evalPromises);

    // 计算加权综合分
    const weightedTotal = this.calculateWeightedScore(scores);
    const evalLatencyMs = Date.now() - startTime;

    console.log(`[OpenEvals] Agent ${agentType} 评估完成: 综合分=${weightedTotal.toFixed(2)}, 耗时=${evalLatencyMs}ms`);

    // 记录评分到 Langfuse
    this.recordToLangfuse(agentType, scores, weightedTotal);

    // P2.4: 持久化评分到 D1
    await this.persistToD1(agentType, scores, weightedTotal, evalLatencyMs);

    const result: AgentEvalResult = {
      agentType,
      scores,
      weightedTotal,
      judgeModel: this.config.judgeModel,
      evalLatencyMs,
      skipped: false,
    };
    this.agentResults.push(result);
    return result;
  }

  /**
   * 计算加权综合分
   */
  private calculateWeightedScore(scores: AgentEvalResult['scores']): number {
    let totalWeight = 0;
    let weightedSum = 0;

    const dimensionMap: Record<string, EvalScore | undefined> = {
      dataAccuracy: scores.dataAccuracy,
      analysisDepth: scores.analysisDepth,
      professionalInsight: scores.professionalInsight,
      logicalConsistency: scores.logicalConsistency,
      expressionQuality: scores.expressionQuality,
      hallucination: scores.hallucination,
    };

    for (const [dim, evalScore] of Object.entries(dimensionMap)) {
      if (evalScore && evalScore.score >= 0) {
        const weight = EVAL_DIMENSION_WEIGHTS[dim as EvalDimension] || 0;
        weightedSum += evalScore.score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * 将评分记录到 Langfuse Trace
   */
  private recordToLangfuse(
    agentType: string,
    scores: AgentEvalResult['scores'],
    weightedTotal: number,
  ): void {
    if (!this.langfuseTrace) return;

    // 记录各维度分数
    for (const [dim, evalScore] of Object.entries(scores)) {
      if (evalScore && evalScore.score >= 0) {
        recordScore(this.langfuseTrace, {
          name: `eval-${agentType}-${dim}`,
          value: evalScore.score,
          comment: evalScore.reasoning?.slice(0, 500),
        });
      }
    }

    // 记录加权综合分
    recordScore(this.langfuseTrace, {
      name: `eval-${agentType}-weighted-total`,
      value: weightedTotal,
      comment: `Agent ${agentType} 加权综合评分 (${this.config.judgeModel})`,
    });
  }

  /**
   * Layer 3: 跨 Agent 一致性评估
   * 在所有 Agent 执行完成后调用
   * 
   * @param allOutputs 所有 Agent 的输出 (JSON 字符串)
   */
  async evaluateCrossConsistency(allOutputs: string): Promise<EvalScore | null> {
    if (!this.config.enableCrossConsistency) return null;
    if (!this.config.enabled || this.config.mode === 'off') return null;

    console.log('[OpenEvals] 开始跨 Agent 一致性评估 (Layer 3)');
    const startTime = Date.now();

    try {
      const result = await this.runJudge(
        CROSS_AGENT_CONSISTENCY_PROMPT,
        '',
        allOutputs.slice(0, 15000), // 截断以控制成本
      );
      result.dimension = 'crossConsistency';

      const latency = Date.now() - startTime;
      console.log(`[OpenEvals] 跨 Agent 一致性评分: ${result.score.toFixed(2)}, 耗时=${latency}ms`);

      // 记录到 Langfuse
      if (this.langfuseTrace) {
        recordScore(this.langfuseTrace, {
          name: 'eval-cross-consistency',
          value: result.score,
          comment: result.reasoning?.slice(0, 500),
        });
      }

      return result;
    } catch (error) {
      console.error('[OpenEvals] 跨 Agent 一致性评估失败:', error);
      return null;
    }
  }

  /**
   * P2.4: 将评分持久化到 D1 analysis_eval_scores 表
   */
  private async persistToD1(
    agentType: string,
    scores: AgentEvalResult['scores'],
    weightedTotal: number,
    evalLatencyMs: number,
  ): Promise<void> {
    const db = this.config.db;
    const reportId = this.config.reportId;
    if (!db || !reportId) return;

    try {
      const judgeModel = this.getCurrentJudgeModel();
      const scoreEntries = Object.entries(scores)
        .filter(([, v]) => v && v.score >= 0)
        .map(([dim, v]) => ({
          dimension: dim,
          score: v!.score,
          reasoning: v!.reasoning?.slice(0, 1000) || '',
        }));

      // 批量写入各维度分数
      const stmts = scoreEntries.map(entry =>
        db.prepare(
          `INSERT INTO analysis_eval_scores (report_id, agent_type, dimension, score, reasoning, judge_model, eval_latency_ms, degraded)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          reportId, agentType, entry.dimension, entry.score, entry.reasoning,
          judgeModel, evalLatencyMs, this.degraded ? 1 : 0,
        ),
      );

      // 写入加权综合分
      stmts.push(
        db.prepare(
          `INSERT INTO analysis_eval_scores (report_id, agent_type, dimension, score, reasoning, judge_model, eval_latency_ms, degraded)
           VALUES (?, ?, 'weighted_total', ?, ?, ?, ?, ?)`
        ).bind(
          reportId, agentType, weightedTotal,
          `加权综合评分 (${judgeModel})`,
          judgeModel, evalLatencyMs, this.degraded ? 1 : 0,
        ),
      );

      if (stmts.length > 0) {
        await db.batch(stmts);
      }
    } catch (error) {
      // 持久化失败不影响主流程
      console.error(`[OpenEvals] D1 持久化失败 (${agentType}):`, error);
    }
  }

  /**
   * 获取完整的报告评估结果
   */
  getReportEvalResult(): ReportEvalResult {
    const evaluatedResults = this.agentResults.filter(r => !r.skipped && r.weightedTotal >= 0);
    const avgScore = evaluatedResults.length > 0
      ? evaluatedResults.reduce((sum, r) => sum + r.weightedTotal, 0) / evaluatedResults.length
      : 0;

    return {
      overallScore: avgScore,
      agentResults: this.agentResults,
    };
  }

  /**
   * 获取评估摘要 (适合日志输出)
   */
  getSummary(): string {
    const result = this.getReportEvalResult();
    const evaluated = result.agentResults.filter(r => !r.skipped);
    const skipped = result.agentResults.filter(r => r.skipped);
    const judgeInfo = this.degraded
      ? `${this.config.fallbackJudgeModel} (降级自 ${this.config.judgeModel})`
      : this.config.judgeModel;

    const lines = [
      `\n========== OpenEvals 评估摘要 ==========`,
      `模式: ${this.config.mode} | Judge: ${judgeInfo}`,
      `并发限制: ${this.config.maxConcurrency} | 超时: ${this.config.judgeTimeoutMs}ms`,
      `评估: ${evaluated.length} 个 Agent | 跳过: ${skipped.length} 个`,
      `整体评分: ${result.overallScore.toFixed(3)}`,
      this.degraded ? `⚠️ 已降级到 fallback 模型 (失败${this.judgeFailCount}次)` : '',
    ].filter(Boolean);

    for (const r of evaluated) {
      const dims = Object.entries(r.scores)
        .filter(([, v]) => v && v.score >= 0)
        .map(([k, v]) => `${k}=${v!.score.toFixed(2)}`)
        .join(', ');
      lines.push(`  ${r.agentType}: 综合=${r.weightedTotal.toFixed(2)} [${dims}] (${r.evalLatencyMs}ms)`);
    }

    lines.push(`=========================================\n`);
    return lines.join('\n');
  }
}

// ============ 工厂函数 ============

/**
 * 创建 OpenEvals 评估器
 * 
 * @param llmCall LLM 调用函数 (通常从 VectorEngineService 适配)
 * @param langfuseTrace Langfuse 追踪上下文 (可选)
 * @param config 评估配置
 */
export function createOpenEvalsEvaluator(
  llmCall: LLMCallFn,
  langfuseTrace: TraceContext | null,
  config?: EvalConfig,
): OpenEvalsEvaluator {
  return new OpenEvalsEvaluator(llmCall, langfuseTrace, config);
}
