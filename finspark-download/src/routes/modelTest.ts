// 模型对比测试 API 路由
// 支持三模型并行调用和评估报告生成
// 注意：测试接口不需要用户认证，仅用于开发测试

import { Hono } from 'hono';
import { createModelRouter, SUPPORTED_MODELS, type ParallelCallResult } from '../services/modelRouter';
import { AGENT_PROMPTS } from '../agents/prompts';
import type { Bindings } from '../types';

const modelTest = new Hono<{ Bindings: Bindings }>();

// 获取支持的模型列表
modelTest.get('/models', (c) => {
  const models = Object.entries(SUPPORTED_MODELS).map(([id, config]) => ({
    id,
    name: config.name,
    provider: config.provider,
    description: config.description,
    costPerInputToken: config.costPerInputToken,
    costPerOutputToken: config.costPerOutputToken
  }));
  
  return c.json({ models });
});

// 获取支持的 Agent 类型
modelTest.get('/agents', (c) => {
  const agents = [
    { id: 'PLANNING', name: '分析规划', description: '制定财报分析计划' },
    { id: 'PROFITABILITY', name: '盈利能力', description: '利润表深度分析' },
    { id: 'BALANCE_SHEET', name: '资产负债', description: '资产负债表分析' },
    { id: 'CASH_FLOW', name: '现金流', description: '现金流量表分析' },
    { id: 'EARNINGS_QUALITY', name: '盈利质量', description: '三表联动验证' },
    { id: 'RISK', name: '风险评估', description: '多维度风险分析' },
    { id: 'BUSINESS_INSIGHT', name: '业务洞察', description: '业务与行业分析' }
  ];
  
  return c.json({ agents });
});

// Agent 对应的期望字段（用于计算完整率）
const AGENT_EXPECTED_FIELDS: Record<string, string[]> = {
  PLANNING: [
    'reportType', 'dataQuality', 'keyHighlights', 'riskFlags', 
    'analysisSequence', 'estimatedTime'
  ],
  PROFITABILITY: [
    'summary.revenueGrowth', 'summary.grossMargin', 'summary.netMargin',
    'summary.profitTrend', 'summary.sustainability', 'summary.oneSentence',
    'detailedAnalysis.revenueAnalysis', 'detailedAnalysis.profitabilityAnalysis',
    'keyMetrics', 'risks', 'opportunities'
  ],
  BALANCE_SHEET: [
    'summary.debtRatio', 'summary.currentRatio', 'summary.quickRatio',
    'summary.financialHealth', 'summary.leverageRisk', 'summary.oneSentence',
    'detailedAnalysis.assetStructure', 'detailedAnalysis.liabilityStructure',
    'keyMetrics', 'risks', 'strengths'
  ],
  CASH_FLOW: [
    'summary.operatingCashFlow', 'summary.freeCashFlow', 'summary.cashQuality',
    'summary.selfFunding', 'summary.oneSentence',
    'detailedAnalysis.operatingCashFlow', 'detailedAnalysis.investingCashFlow',
    'detailedAnalysis.financingCashFlow', 'keyMetrics', 'risks', 'highlights'
  ],
  EARNINGS_QUALITY: [
    'summary.profitCashMatch', 'summary.receivableRisk', 'summary.inventoryRisk',
    'summary.earningsGrade', 'summary.realProfit', 'summary.oneSentence',
    'detailedAnalysis.profitVsCash', 'detailedAnalysis.workingCapitalQuality',
    'redFlags', 'greenFlags'
  ],
  RISK: [
    'summary.debtRisk', 'summary.liquidityRisk', 'summary.operationalRisk',
    'summary.overallRisk', 'summary.oneSentence',
    'detailedAnalysis.debtRisk', 'detailedAnalysis.liquidityRisk',
    'detailedAnalysis.operationalRisk', 'riskMatrix', 'recommendations'
  ],
  BUSINESS_INSIGHT: [
    'summary.businessTrend', 'summary.industryPosition', 'summary.competitiveAdvantage',
    'summary.growthDriver', 'summary.oneSentence',
    'detailedAnalysis.businessModel', 'detailedAnalysis.competitiveAnalysis',
    'detailedAnalysis.industryAnalysis', 'swot'
  ]
};

// 三模型并行对比测试（无需认证）
modelTest.post('/compare', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      agentType, 
      testData,
      models = ['gemini-2.5-pro', 'gpt-4.1', 'gpt-5-nano']
    } = body;
    
    if (!agentType) {
      return c.json({ success: false, error: '请指定 Agent 类型' }, 400);
    }
    
    if (!testData) {
      return c.json({ success: false, error: '请提供测试数据' }, 400);
    }
    
    // 获取 Agent 的 Prompt
    const systemPrompt = AGENT_PROMPTS[agentType as keyof typeof AGENT_PROMPTS];
    if (!systemPrompt) {
      return c.json({ success: false, error: `未知的 Agent 类型: ${agentType}` }, 400);
    }
    
    // 构建用户提示词
    const userPrompt = typeof testData === 'string' 
      ? testData 
      : `请分析以下财务数据:\n\n${JSON.stringify(testData, null, 2)}`;
    
    // 创建模型路由器
    const router = createModelRouter(c.env.VECTORENGINE_API_KEY);
    
    // 获取期望字段
    const expectedFields = AGENT_EXPECTED_FIELDS[agentType] || [];
    
    console.log(`[ModelTest] 开始三模型对比测试, Agent: ${agentType}, Models: ${models.join(', ')}`);
    
    // 并行调用三个模型
    const result = await router.callModelsParallel(
      models,
      agentType,
      systemPrompt,
      userPrompt,
      expectedFields
    );
    
    // 保存评估结果到数据库
    if (c.env.DB) {
      try {
        await router.saveEvaluation(c.env.DB, 0, result); // reportId=0 表示测试数据
      } catch (dbError) {
        console.error('[ModelTest] 保存评估结果失败:', dbError);
      }
    }
    
    console.log(`[ModelTest] 对比测试完成, 最佳模型: ${result.bestModel}`);
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[ModelTest] 对比测试失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '对比测试失败'
    }, 500);
  }
});

// 使用示例数据进行快速测试（无需认证）
modelTest.post('/quick-test', async (c) => {
  try {
    const body = await c.req.json();
    const { agentType = 'PROFITABILITY' } = body;
    
    // 示例测试数据
    const sampleData = {
      companyName: '贵州茅台',
      companyCode: '600519',
      reportPeriod: '2023年报',
      financialData: {
        revenue: {
          current: 150652000000,
          previous: 127560000000,
          growth: '18.1%'
        },
        grossProfit: {
          current: 138600000000,
          margin: '92.0%'
        },
        netProfit: {
          current: 74734000000,
          previous: 62716000000,
          growth: '19.2%',
          margin: '49.6%'
        },
        operatingExpenses: {
          salesExpense: 4200000000,
          adminExpense: 8500000000,
          rdExpense: 620000000
        }
      }
    };
    
    // 使用 compare 的逻辑
    const systemPrompt = AGENT_PROMPTS[agentType as keyof typeof AGENT_PROMPTS];
    if (!systemPrompt) {
      return c.json({ success: false, error: `未知的 Agent 类型: ${agentType}` }, 400);
    }
    
    const userPrompt = `请分析以下财务数据:\n\n${JSON.stringify(sampleData, null, 2)}`;
    const router = createModelRouter(c.env.VECTORENGINE_API_KEY);
    const expectedFields = AGENT_EXPECTED_FIELDS[agentType] || [];
    
    const result = await router.callModelsParallel(
      ['gemini-2.5-pro', 'gpt-4.1', 'gpt-5-nano'],
      agentType,
      systemPrompt,
      userPrompt,
      expectedFields
    );
    
    // 保存评估结果
    if (c.env.DB) {
      try {
        await router.saveEvaluation(c.env.DB, 0, result);
      } catch (dbError) {
        console.error('[ModelTest] 保存评估结果失败:', dbError);
      }
    }
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[ModelTest] 快速测试失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '快速测试失败'
    }, 500);
  }
});

// 获取历史评估统计（无需认证）
modelTest.get('/statistics', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ success: false, error: '数据库未配置' }, 500);
    }
    
    const modelName = c.req.query('model');
    const agentType = c.req.query('agent');
    
    const router = createModelRouter(c.env.VECTORENGINE_API_KEY);
    const stats = await router.getModelStatistics(c.env.DB, modelName, agentType);
    
    return c.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('[ModelTest] 获取统计失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计失败'
    }, 500);
  }
});

// 获取详细的评估历史（无需认证）
modelTest.get('/history', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ success: false, error: '数据库未配置' }, 500);
    }
    
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const modelName = c.req.query('model');
    const agentType = c.req.query('agent');
    
    let sql = `
      SELECT 
        id, report_id, agent_type, model_key as model_name,
        latency_ms, token_input as input_tokens, token_output as output_tokens, cost_usd,
        json_valid, fields_complete_rate, auto_score,
        created_at
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
    
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await c.env.DB.prepare(sql).bind(...params).all();
    
    return c.json({
      success: true,
      history: result.results,
      pagination: { limit, offset }
    });
  } catch (error) {
    console.error('[ModelTest] 获取历史失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '获取历史失败'
    }, 500);
  }
});

// 测试单个 Agent（用于前端逐个调用，避免超时）
modelTest.post('/test-agent', async (c) => {
  try {
    const body = await c.req.json();
    const { agentType } = body;
    
    if (!agentType) {
      return c.json({ success: false, error: '请指定 Agent 类型' }, 400);
    }
    
    // 综合财务测试数据
    const sampleData = {
      companyName: '贵州茅台',
      companyCode: '600519',
      reportPeriod: '2023年报',
      financialData: {
        revenue: { current: 150652000000, previous: 127560000000, growth: '18.1%' },
        grossProfit: { current: 138600000000, margin: '92.0%' },
        netProfit: { current: 74734000000, previous: 62716000000, growth: '19.2%', margin: '49.6%' },
        operatingExpenses: { salesExpense: 4200000000, adminExpense: 8500000000, rdExpense: 620000000 },
        totalAssets: 285600000000,
        totalLiabilities: 71400000000,
        shareholderEquity: 214200000000,
        currentAssets: 178500000000,
        currentLiabilities: 65300000000,
        inventory: 42800000000,
        receivables: 3200000000,
        operatingCashFlow: 82500000000,
        investingCashFlow: -15600000000,
        financingCashFlow: -45200000000,
        freeCashFlow: 66900000000,
        mainBusiness: [
          { name: '茅台酒', revenue: 135800000000, margin: '94.2%', share: '90.1%' },
          { name: '系列酒', revenue: 14200000000, margin: '78.5%', share: '9.4%' }
        ]
      }
    };
    
    const systemPrompt = AGENT_PROMPTS[agentType as keyof typeof AGENT_PROMPTS];
    if (!systemPrompt) {
      return c.json({ success: false, error: `未知的 Agent 类型: ${agentType}` }, 400);
    }
    
    const models = ['gemini-2.5-pro', 'gpt-4.1', 'gpt-5-nano'];
    const router = createModelRouter(c.env.VECTORENGINE_API_KEY);
    const userPrompt = `请分析以下财务数据:\n\n${JSON.stringify(sampleData, null, 2)}`;
    const expectedFields = AGENT_EXPECTED_FIELDS[agentType] || [];
    
    console.log(`[ModelTest] 测试单个 Agent: ${agentType}`);
    
    const result = await router.callModelsParallel(
      models,
      agentType,
      systemPrompt,
      userPrompt,
      expectedFields
    );
    
    return c.json({
      success: true,
      agentType,
      result
    });
  } catch (error) {
    console.error('[ModelTest] 单个 Agent 测试失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败'
    }, 500);
  }
});

// 全量 Agent 测试 - 遍历所有 Agent 进行三模型对比（可能超时）
modelTest.post('/full-test', async (c) => {
  try {
    // 示例测试数据（综合财务数据）
    const sampleData = {
      companyName: '贵州茅台',
      companyCode: '600519',
      reportPeriod: '2023年报',
      financialData: {
        // 利润表数据
        revenue: { current: 150652000000, previous: 127560000000, growth: '18.1%' },
        grossProfit: { current: 138600000000, margin: '92.0%' },
        netProfit: { current: 74734000000, previous: 62716000000, growth: '19.2%', margin: '49.6%' },
        operatingExpenses: { salesExpense: 4200000000, adminExpense: 8500000000, rdExpense: 620000000 },
        // 资产负债表数据
        totalAssets: 285600000000,
        totalLiabilities: 71400000000,
        shareholderEquity: 214200000000,
        currentAssets: 178500000000,
        currentLiabilities: 65300000000,
        inventory: 42800000000,
        receivables: 3200000000,
        // 现金流数据
        operatingCashFlow: 82500000000,
        investingCashFlow: -15600000000,
        financingCashFlow: -45200000000,
        freeCashFlow: 66900000000,
        // 主营业务
        mainBusiness: [
          { name: '茅台酒', revenue: 135800000000, margin: '94.2%', share: '90.1%' },
          { name: '系列酒', revenue: 14200000000, margin: '78.5%', share: '9.4%' }
        ]
      }
    };
    
    const allAgents = [
      'PLANNING', 'PROFITABILITY', 'BALANCE_SHEET', 
      'CASH_FLOW', 'EARNINGS_QUALITY', 'RISK', 'BUSINESS_INSIGHT'
    ];
    
    const models = ['gemini-2.5-pro', 'gpt-4.1', 'gpt-5-nano'];
    const router = createModelRouter(c.env.VECTORENGINE_API_KEY);
    
    console.log('[ModelTest] 开始全量测试, Agents:', allAgents.join(', '));
    
    // 存储每个 Agent 的测试结果
    const agentResults: Record<string, ParallelCallResult> = {};
    const startTime = Date.now();
    
    // 逐个 Agent 进行测试（避免并发过高）
    for (const agentType of allAgents) {
      const systemPrompt = AGENT_PROMPTS[agentType as keyof typeof AGENT_PROMPTS];
      if (!systemPrompt) continue;
      
      const userPrompt = `请分析以下财务数据:\n\n${JSON.stringify(sampleData, null, 2)}`;
      const expectedFields = AGENT_EXPECTED_FIELDS[agentType] || [];
      
      console.log(`[ModelTest] 测试 Agent: ${agentType}`);
      
      try {
        const result = await router.callModelsParallel(
          models,
          agentType,
          systemPrompt,
          userPrompt,
          expectedFields
        );
        
        agentResults[agentType] = result;
        
        // 保存评估结果
        if (c.env.DB) {
          try {
            await router.saveEvaluation(c.env.DB, 0, result);
          } catch (dbError) {
            console.error(`[ModelTest] 保存 ${agentType} 评估结果失败:`, dbError);
          }
        }
      } catch (agentError) {
        console.error(`[ModelTest] Agent ${agentType} 测试失败:`, agentError);
        // 继续测试其他 Agent
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // 汇总统计
    const modelSummary: Record<string, {
      totalLatency: number;
      totalCost: number;
      totalScore: number;
      successCount: number;
      avgFieldsComplete: number;
      avgInsightCount: number;
      avgRiskCount: number;
      wins: { speed: number; quality: number; cost: number; overall: number };
      agentScores: Record<string, number>;
    }> = {};
    
    // 初始化
    for (const modelId of models) {
      modelSummary[modelId] = {
        totalLatency: 0,
        totalCost: 0,
        totalScore: 0,
        successCount: 0,
        avgFieldsComplete: 0,
        avgInsightCount: 0,
        avgRiskCount: 0,
        wins: { speed: 0, quality: 0, cost: 0, overall: 0 },
        agentScores: {}
      };
    }
    
    // 汇总各 Agent 结果
    for (const [agentType, result] of Object.entries(agentResults)) {
      if (!result.evaluation) continue;
      
      // 统计获胜次数
      if (result.evaluation.speedWinner) {
        modelSummary[result.evaluation.speedWinner].wins.speed++;
      }
      if (result.evaluation.qualityWinner) {
        modelSummary[result.evaluation.qualityWinner].wins.quality++;
      }
      if (result.evaluation.costWinner) {
        modelSummary[result.evaluation.costWinner].wins.cost++;
      }
      if (result.evaluation.overallWinner) {
        modelSummary[result.evaluation.overallWinner].wins.overall++;
      }
      
      // 汇总各模型的指标
      for (const modelResult of result.results) {
        const modelId = modelResult.modelId;
        const metrics = modelResult.metrics;
        const score = result.evaluation.scores?.[modelId];
        
        if (modelResult.success) {
          modelSummary[modelId].successCount++;
          modelSummary[modelId].totalLatency += metrics.latencyMs;
          modelSummary[modelId].totalCost += metrics.costUsd;
          modelSummary[modelId].avgFieldsComplete += metrics.fieldsCompleteRate;
          modelSummary[modelId].avgInsightCount += metrics.insightCount || 0;
          modelSummary[modelId].avgRiskCount += metrics.riskIdentified || 0;
          
          if (score) {
            modelSummary[modelId].totalScore += score.overall;
            modelSummary[modelId].agentScores[agentType] = score.overall;
          }
        }
      }
    }
    
    // 计算平均值
    const agentCount = Object.keys(agentResults).length;
    for (const modelId of models) {
      const summary = modelSummary[modelId];
      if (summary.successCount > 0) {
        summary.avgFieldsComplete = Math.round(summary.avgFieldsComplete / summary.successCount);
        summary.avgInsightCount = Math.round(summary.avgInsightCount / summary.successCount * 10) / 10;
        summary.avgRiskCount = Math.round(summary.avgRiskCount / summary.successCount * 10) / 10;
      }
    }
    
    // 确定综合获胜者
    let overallWinner = models[0];
    let maxWins = 0;
    for (const modelId of models) {
      if (modelSummary[modelId].wins.overall > maxWins) {
        maxWins = modelSummary[modelId].wins.overall;
        overallWinner = modelId;
      }
    }
    
    console.log(`[ModelTest] 全量测试完成, 耗时: ${totalTime}ms, 综合获胜: ${overallWinner}`);
    
    return c.json({
      success: true,
      summary: {
        totalAgents: agentCount,
        totalTime,
        models: modelSummary,
        overallWinner,
        testData: {
          company: sampleData.companyName,
          period: sampleData.reportPeriod
        }
      },
      agentResults
    });
  } catch (error) {
    console.error('[ModelTest] 全量测试失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '全量测试失败'
    }, 500);
  }
});

export default modelTest;
