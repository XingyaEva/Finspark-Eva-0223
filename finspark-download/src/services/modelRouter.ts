// 多模型路由服务 - 支持 Gemini 和 GPT 模型并行调用
// 实现 A/B 测试、指标采集和模型对比评估

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'google' | 'openai';
  modelId: string;
  maxTokens: number;
  temperature: number;
  costPerInputToken: number;  // USD per 1K tokens
  costPerOutputToken: number; // USD per 1K tokens
  description: string;
}

// 支持的模型配置
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    maxTokens: 16384,
    temperature: 0.3,
    costPerInputToken: 0.00125,  // $1.25 per 1M input
    costPerOutputToken: 0.005,   // $5 per 1M output
    description: 'Google 最新模型，擅长复杂推理和长文本'
  },
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    maxTokens: 16384,
    temperature: 0.3,
    costPerInputToken: 0.002,    // $2 per 1M input
    costPerOutputToken: 0.008,   // $8 per 1M output
    description: 'OpenAI 旗舰模型，综合能力强'
  },
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    modelId: 'gpt-5-nano-2025-08-07',
    maxTokens: 16384,
    temperature: 0.3,
    costPerInputToken: 0.00015,  // $0.15 per 1M input
    costPerOutputToken: 0.0006,  // $0.6 per 1M output
    description: 'OpenAI 最新轻量模型，性能优化版'
  }
};

// 模型调用结果
export interface ModelCallResult {
  modelId: string;
  modelName: string;
  success: boolean;
  content: string | null;
  parsedJson: any | null;
  error: string | null;
  metrics: ModelMetrics;
}

// 定量指标 - 完整版
export interface ModelMetrics {
  // 性能指标
  latencyMs: number;           // 响应时间 (ms)
  inputTokens: number;         // 输入 Token 数
  outputTokens: number;        // 输出 Token 数
  totalTokens: number;         // 总 Token 数
  costUsd: number;             // 成本 (USD)
  
  // 质量指标（自动评估）
  jsonValid: boolean;          // JSON 格式是否正确
  fieldsCompleteRate: number;  // 必填字段完整率 (0-100%)
  dataAccuracy: number;        // 数据引用准确率 (0-100%)
  
  // 内容指标
  responseLength: number;      // 响应长度 (字符数)
  insightCount: number;        // 洞察点数量
  riskIdentified: number;      // 识别的风险数量
  recommendationCount: number; // 建议数量
  keyMetricsCount: number;     // 关键指标数量
}

// 并行调用结果
export interface ParallelCallResult {
  agentType: string;
  prompt: string;
  results: ModelCallResult[];
  timestamp: string;
  bestModel: string | null;
  evaluation: EvaluationSummary | null;
}

// 评估摘要
export interface EvaluationSummary {
  speedWinner: string;
  qualityWinner: string;
  costWinner: string;
  overallWinner: string;
  recommendation: string;
  scores: Record<string, ModelScore>;
}

// 模型得分
export interface ModelScore {
  speed: number;        // 0-100, 越高越好
  quality: number;      // 0-100, 越高越好
  cost: number;         // 0-100, 越高越好（成本越低分数越高）
  completeness: number; // 0-100, JSON 字段完整率
  content: number;      // 0-100, 内容丰富度
  accuracy: number;     // 0-100, 数据准确率
  overall: number;      // 综合得分
}

// 模型路由器类
export class ModelRouter {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.vectorengine.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * 调用单个模型
   */
  async callModel(
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    expectedFields?: string[]
  ): Promise<ModelCallResult> {
    const config = SUPPORTED_MODELS[modelId];
    if (!config) {
      return {
        modelId,
        modelName: modelId,
        success: false,
        content: null,
        parsedJson: null,
        error: `未知模型: ${modelId}`,
        metrics: this.getEmptyMetrics()
      };
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature
        })
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          modelId,
          modelName: config.name,
          success: false,
          content: null,
          parsedJson: null,
          error: `API 错误 (${response.status}): ${errorText}`,
          metrics: {
            ...this.getEmptyMetrics(),
            latencyMs
          }
        };
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      // 尝试解析 JSON
      const { parsedJson, jsonValid } = this.parseJsonContent(content);
      
      // 计算字段完整率
      const fieldsCompleteRate = expectedFields 
        ? this.calculateFieldsCompleteRate(parsedJson, expectedFields)
        : (jsonValid ? 100 : 0);

      // 计算成本
      const costUsd = (usage.prompt_tokens / 1000 * config.costPerInputToken) +
                      (usage.completion_tokens / 1000 * config.costPerOutputToken);

      // 计算内容指标
      const contentMetrics = this.analyzeContentMetrics(parsedJson, content);
      
      // 计算数据准确率（需要原始数据对比，这里基于结构完整性估算）
      const dataAccuracy = this.estimateDataAccuracy(parsedJson, jsonValid);

      return {
        modelId,
        modelName: config.name,
        success: true,
        content,
        parsedJson,
        error: null,
        metrics: {
          // 性能指标
          latencyMs,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          costUsd,
          // 质量指标
          jsonValid,
          fieldsCompleteRate,
          dataAccuracy,
          // 内容指标
          responseLength: content.length,
          insightCount: contentMetrics.insightCount,
          riskIdentified: contentMetrics.riskIdentified,
          recommendationCount: contentMetrics.recommendationCount,
          keyMetricsCount: contentMetrics.keyMetricsCount
        }
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return {
        modelId,
        modelName: config.name,
        success: false,
        content: null,
        parsedJson: null,
        error: error instanceof Error ? error.message : '未知错误',
        metrics: {
          ...this.getEmptyMetrics(),
          latencyMs
        }
      };
    }
  }

  /**
   * 并行调用多个模型
   */
  async callModelsParallel(
    modelIds: string[],
    agentType: string,
    systemPrompt: string,
    userPrompt: string,
    expectedFields?: string[]
  ): Promise<ParallelCallResult> {
    console.log(`[ModelRouter] 并行调用 ${modelIds.length} 个模型, Agent: ${agentType}`);
    
    const startTime = Date.now();
    
    // 并行调用所有模型
    const promises = modelIds.map(modelId => 
      this.callModel(modelId, systemPrompt, userPrompt, expectedFields)
    );
    
    const results = await Promise.all(promises);
    
    console.log(`[ModelRouter] 并行调用完成, 总耗时: ${Date.now() - startTime}ms`);
    
    // 生成评估摘要
    const evaluation = this.evaluateResults(results);
    
    return {
      agentType,
      prompt: userPrompt.substring(0, 500) + '...', // 截断保存
      results,
      timestamp: new Date().toISOString(),
      bestModel: evaluation?.overallWinner || null,
      evaluation
    };
  }

  /**
   * 评估多个模型的结果
   */
  private evaluateResults(results: ModelCallResult[]): EvaluationSummary | null {
    const successResults = results.filter(r => r.success);
    if (successResults.length === 0) return null;

    const scores: Record<string, ModelScore> = {};
    
    // 计算各维度的最值用于归一化
    const latencies = successResults.map(r => r.metrics.latencyMs);
    const costs = successResults.map(r => r.metrics.costUsd);
    const insightCounts = successResults.map(r => r.metrics.insightCount);
    const riskCounts = successResults.map(r => r.metrics.riskIdentified);
    const recCounts = successResults.map(r => r.metrics.recommendationCount);
    const metricsCounts = successResults.map(r => r.metrics.keyMetricsCount);
    
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    const maxCost = Math.max(...costs);
    const minCost = Math.min(...costs);
    const maxInsight = Math.max(...insightCounts, 1);
    const maxRisk = Math.max(...riskCounts, 1);
    const maxRec = Math.max(...recCounts, 1);
    const maxMetrics = Math.max(...metricsCounts, 1);

    // 计算每个模型的得分
    for (const result of successResults) {
      const m = result.metrics;
      
      // 速度分数：延迟越低分数越高
      const speedScore = maxLatency === minLatency ? 100 :
        100 - ((m.latencyMs - minLatency) / (maxLatency - minLatency) * 100);
      
      // 成本分数：成本越低分数越高
      const costScore = maxCost === minCost ? 100 :
        100 - ((m.costUsd - minCost) / (maxCost - minCost) * 100);
      
      // 质量分数：基于 JSON 有效性和字段完整率
      const qualityScore = (m.jsonValid ? 40 : 0) + (m.fieldsCompleteRate * 0.6);
      
      // 内容丰富度分数：基于洞察、风险、建议、指标数量
      const contentScore = (
        (m.insightCount / maxInsight) * 25 +
        (m.riskIdentified / maxRisk) * 25 +
        (m.recommendationCount / maxRec) * 25 +
        (m.keyMetricsCount / maxMetrics) * 25
      );
      
      // 数据准确率分数
      const accuracyScore = m.dataAccuracy;
      
      // 综合分数：加权平均
      // 速度 15%, 成本 15%, 质量 25%, 内容 25%, 准确率 10%, 完整率 10%
      const overallScore = 
        speedScore * 0.15 + 
        costScore * 0.15 + 
        qualityScore * 0.25 + 
        contentScore * 0.25 +
        accuracyScore * 0.10 +
        m.fieldsCompleteRate * 0.10;

      scores[result.modelId] = {
        speed: Math.round(speedScore),
        quality: Math.round(qualityScore),
        cost: Math.round(costScore),
        completeness: Math.round(m.fieldsCompleteRate),
        content: Math.round(contentScore),
        accuracy: Math.round(accuracyScore),
        overall: Math.round(overallScore)
      };
    }

    // 找出各维度的优胜者
    const speedWinner = this.findWinner(scores, 'speed');
    const qualityWinner = this.findWinner(scores, 'quality');
    const costWinner = this.findWinner(scores, 'cost');
    const overallWinner = this.findWinner(scores, 'overall');

    // 生成推荐
    const recommendation = this.generateRecommendation(scores, overallWinner);

    return {
      speedWinner,
      qualityWinner,
      costWinner,
      overallWinner,
      recommendation,
      scores
    };
  }

  /**
   * 找出某维度的优胜者
   */
  private findWinner(scores: Record<string, ModelScore>, dimension: keyof ModelScore): string {
    let winner = '';
    let maxScore = -1;
    
    for (const [modelId, score] of Object.entries(scores)) {
      if (score[dimension] > maxScore) {
        maxScore = score[dimension];
        winner = modelId;
      }
    }
    
    return winner;
  }

  /**
   * 生成推荐文本
   */
  private generateRecommendation(
    scores: Record<string, ModelScore>,
    overallWinner: string
  ): string {
    const winnerScore = scores[overallWinner];
    const winnerConfig = SUPPORTED_MODELS[overallWinner];
    
    if (!winnerScore || !winnerConfig) {
      return '无法生成推荐';
    }

    const parts = [`推荐使用 **${winnerConfig.name}**`];
    
    if (winnerScore.speed >= 80) {
      parts.push('响应速度快');
    }
    if (winnerScore.quality >= 80) {
      parts.push('输出质量高');
    }
    if (winnerScore.cost >= 80) {
      parts.push('成本效益好');
    }
    if (winnerScore.completeness >= 90) {
      parts.push('字段完整度高');
    }

    return parts.join('，') + '。';
  }

  /**
   * 解析 JSON 内容
   */
  private parseJsonContent(content: string): { parsedJson: any; jsonValid: boolean } {
    try {
      // 尝试直接解析
      const parsed = JSON.parse(content);
      return { parsedJson: parsed, jsonValid: true };
    } catch {
      // 尝试从代码块中提取
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          return { parsedJson: parsed, jsonValid: true };
        } catch {
          // 继续尝试其他方法
        }
      }
      
      // 尝试提取第一个 { 到最后一个 } 之间的内容
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          const parsed = JSON.parse(content.substring(start, end + 1));
          return { parsedJson: parsed, jsonValid: true };
        } catch {
          // 解析失败
        }
      }
      
      return { parsedJson: null, jsonValid: false };
    }
  }

  /**
   * 计算字段完整率
   */
  private calculateFieldsCompleteRate(parsedJson: any, expectedFields: string[]): number {
    if (!parsedJson || expectedFields.length === 0) return 0;
    
    let presentCount = 0;
    
    for (const field of expectedFields) {
      const value = this.getNestedValue(parsedJson, field);
      if (value !== undefined && value !== null && value !== '') {
        presentCount++;
      }
    }
    
    return (presentCount / expectedFields.length) * 100;
  }

  /**
   * 获取嵌套字段值
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    return current;
  }

  /**
   * 分析内容指标
   */
  private analyzeContentMetrics(parsedJson: any, rawContent: string): {
    insightCount: number;
    riskIdentified: number;
    recommendationCount: number;
    keyMetricsCount: number;
  } {
    if (!parsedJson) {
      return {
        insightCount: 0,
        riskIdentified: 0,
        recommendationCount: 0,
        keyMetricsCount: 0
      };
    }

    // 统计洞察点数量（从各种分析字段中提取）
    let insightCount = 0;
    const insightFields = [
      'detailedAnalysis', 'analysis', 'insights', 'findings',
      'revenueAnalysis', 'profitabilityAnalysis', 'competitivePosition',
      'assetStructure', 'liabilityStructure', 'capitalStructure',
      'operatingCashFlow', 'investingCashFlow', 'financingCashFlow',
      'businessModel', 'competitiveAnalysis', 'industryAnalysis', 'growthAnalysis'
    ];
    insightCount += this.countNonEmptyFields(parsedJson, insightFields);
    
    // 统计风险识别数量
    let riskIdentified = 0;
    const riskArrays = ['risks', 'riskFlags', 'redFlags', 'threats', 'weaknesses'];
    for (const field of riskArrays) {
      const value = this.findFieldRecursive(parsedJson, field);
      if (Array.isArray(value)) {
        riskIdentified += value.filter(v => v && typeof v === 'string' && v.trim()).length;
      }
    }
    // 检查 riskMatrix
    const riskMatrix = this.findFieldRecursive(parsedJson, 'riskMatrix');
    if (Array.isArray(riskMatrix)) {
      riskIdentified += riskMatrix.length;
    }
    
    // 统计建议数量
    let recommendationCount = 0;
    const recArrays = ['recommendations', 'opportunities', 'suggestions', 'highlights', 'greenFlags', 'strengths'];
    for (const field of recArrays) {
      const value = this.findFieldRecursive(parsedJson, field);
      if (Array.isArray(value)) {
        recommendationCount += value.filter(v => v && typeof v === 'string' && v.trim()).length;
      }
    }
    
    // 统计关键指标数量
    let keyMetricsCount = 0;
    const metricsArrays = ['keyMetrics', 'keyIndicators', 'metrics'];
    for (const field of metricsArrays) {
      const value = this.findFieldRecursive(parsedJson, field);
      if (Array.isArray(value)) {
        keyMetricsCount += value.length;
      }
    }
    // 检查 summary 中的指标
    const summary = parsedJson.summary;
    if (summary && typeof summary === 'object') {
      keyMetricsCount += Object.keys(summary).filter(k => 
        k !== 'oneSentence' && summary[k] !== null && summary[k] !== undefined
      ).length;
    }

    return {
      insightCount,
      riskIdentified,
      recommendationCount,
      keyMetricsCount
    };
  }

  /**
   * 递归查找字段
   */
  private findFieldRecursive(obj: any, fieldName: string): any {
    if (!obj || typeof obj !== 'object') return null;
    
    if (obj[fieldName] !== undefined) return obj[fieldName];
    
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const result = this.findFieldRecursive(obj[key], fieldName);
        if (result !== null) return result;
      }
    }
    
    return null;
  }

  /**
   * 统计非空分析字段数量
   */
  private countNonEmptyFields(obj: any, fieldNames: string[]): number {
    let count = 0;
    
    const checkObject = (o: any) => {
      if (!o || typeof o !== 'object') return;
      
      for (const key of Object.keys(o)) {
        if (fieldNames.includes(key)) {
          const value = o[key];
          if (value && typeof value === 'object') {
            // 对象类型，统计其非空子字段
            const subKeys = Object.keys(value).filter(k => {
              const v = value[k];
              return v !== null && v !== undefined && v !== '';
            });
            count += subKeys.length > 0 ? 1 : 0;
          } else if (value && typeof value === 'string' && value.trim()) {
            count++;
          }
        }
        // 递归检查子对象
        if (typeof o[key] === 'object' && o[key] !== null) {
          checkObject(o[key]);
        }
      }
    };
    
    checkObject(obj);
    return count;
  }

  /**
   * 估算数据准确率
   * 基于结构完整性和数值格式正确性
   */
  private estimateDataAccuracy(parsedJson: any, jsonValid: boolean): number {
    if (!jsonValid || !parsedJson) return 0;
    
    let totalChecks = 0;
    let passedChecks = 0;
    
    const checkValue = (value: any, key: string) => {
      totalChecks++;
      
      // 检查数值格式（百分比、金额等）
      if (typeof value === 'string') {
        // 检查百分比格式
        if (key.toLowerCase().includes('rate') || 
            key.toLowerCase().includes('margin') ||
            key.toLowerCase().includes('ratio') ||
            key.toLowerCase().includes('growth')) {
          if (/\d+(\.\d+)?%?/.test(value)) {
            passedChecks++;
          }
        }
        // 检查状态/评级格式
        else if (key.toLowerCase().includes('status') ||
                 key.toLowerCase().includes('level') ||
                 key.toLowerCase().includes('grade') ||
                 key.toLowerCase().includes('risk')) {
          if (value.length > 0 && value.length < 50) {
            passedChecks++;
          }
        }
        // 检查描述性内容
        else if (value.length >= 10) {
          passedChecks++;
        }
      }
      // 检查数值
      else if (typeof value === 'number') {
        if (!isNaN(value) && isFinite(value)) {
          passedChecks++;
        }
      }
      // 检查数组
      else if (Array.isArray(value)) {
        if (value.length > 0) {
          passedChecks++;
        }
      }
      // 检查对象
      else if (typeof value === 'object' && value !== null) {
        passedChecks++;
      }
    };
    
    const traverse = (obj: any, parentKey: string = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          checkValue(value, key);
          value.forEach((item, i) => {
            if (typeof item === 'object') {
              traverse(item, key);
            } else {
              checkValue(item, key);
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          traverse(value, key);
        } else {
          checkValue(value, key);
        }
      }
    };
    
    traverse(parsedJson);
    
    return totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
  }

  /**
   * 获取空指标
   */
  private getEmptyMetrics(): ModelMetrics {
    return {
      // 性能指标
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      // 质量指标
      jsonValid: false,
      fieldsCompleteRate: 0,
      dataAccuracy: 0,
      // 内容指标
      responseLength: 0,
      insightCount: 0,
      riskIdentified: 0,
      recommendationCount: 0,
      keyMetricsCount: 0
    };
  }

  /**
   * 保存评估结果到数据库
   */
  async saveEvaluation(
    db: D1Database,
    reportId: number,
    result: ParallelCallResult
  ): Promise<void> {
    const now = new Date().toISOString();
    
    for (const modelResult of result.results) {
      const m = modelResult.metrics;
      const score = result.evaluation?.scores[modelResult.modelId];
      
      await db.prepare(`
        INSERT INTO model_evaluations (
          report_id, agent_type, model_key,
          latency_ms, token_input, token_output, cost_usd,
          json_valid, fields_complete_rate, auto_score,
          data_accuracy, insight_count, risk_identified,
          recommendation_count, key_metrics_count,
          content_score, accuracy_score,
          raw_response, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        reportId,
        result.agentType,
        modelResult.modelId,
        m.latencyMs,
        m.inputTokens,
        m.outputTokens,
        m.costUsd,
        m.jsonValid ? 1 : 0,
        m.fieldsCompleteRate,
        score?.overall || 0,
        m.dataAccuracy,
        m.insightCount,
        m.riskIdentified,
        m.recommendationCount,
        m.keyMetricsCount,
        score?.content || 0,
        score?.accuracy || 0,
        modelResult.content?.substring(0, 500) || null,
        modelResult.error,
        now
      ).run();
    }
  }

  /**
   * 获取模型统计信息
   */
  async getModelStatistics(
    db: D1Database,
    modelName?: string,
    agentType?: string
  ): Promise<any[]> {
    let sql = `
      SELECT 
        model_key as model_name,
        agent_type,
        COUNT(*) as total_calls,
        AVG(latency_ms) as avg_latency_ms,
        AVG(cost_usd) as avg_cost_usd,
        AVG(auto_score) as avg_auto_score,
        SUM(CASE WHEN json_valid = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
        AVG(fields_complete_rate) as avg_fields_complete_rate
      FROM model_evaluations
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (modelName) {
      sql += ` AND model_key = ?`;
      params.push(modelName);
    }
    
    if (agentType) {
      sql += ` AND agent_type = ?`;
      params.push(agentType);
    }
    
    sql += ` GROUP BY model_key, agent_type ORDER BY model_key, agent_type`;
    
    const result = await db.prepare(sql).bind(...params).all();
    return result.results;
  }
}

// 创建路由器实例
export function createModelRouter(apiKey: string): ModelRouter {
  return new ModelRouter(apiKey);
}
