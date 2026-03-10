/**
 * 官方默认 Preset 配置
 * 
 * 这些是平台提供的默认分析配置，用户可以基于这些创建自己的 Preset。
 * 使用代码常量而非数据库表，便于版本控制和部署。
 */

import type { AgentType, ModelPreference } from '../services/vectorengine';

// ============================================
// 类型定义
// ============================================

/**
 * L1 结构化配置 Schema - 每个 Agent 的可配置参数
 */
export interface L1ConfigSchema {
  // 通用配置
  analysisDepth?: 'quick' | 'standard' | 'deep';
  language?: 'zh-CN' | 'en-US';
  outputFormat?: 'detailed' | 'concise' | 'bullet_points';
  
  // Agent 特定配置（根据 Agent 类型不同）
  [key: string]: any;
}

/**
 * 官方 Preset 定义
 */
export interface OfficialPreset {
  agentType: AgentType;
  presetName: string;
  presetNameEn: string;
  description: string;
  descriptionEn: string;
  presetConfigJson: L1ConfigSchema;
  modelPreference: ModelPreference;
  /** Agent 级别: L0 不可配置, L1 参数化, L2 核心差异区, L3 最高付费区 */
  level: 'L0' | 'L1' | 'L2' | 'L3';
  /** 是否允许用户自定义 Prompt */
  allowCustomPrompt: boolean;
  /** 是否允许用户修改模型偏好 */
  allowModelChange: boolean;
}

/**
 * L1 Agent 配置 Schema（参数化配置）
 */
export interface AgentConfigSchema {
  agentType: AgentType;
  level: 'L0' | 'L1' | 'L2' | 'L3';
  configFields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  labelEn: string;
  type: 'select' | 'boolean' | 'number' | 'text' | 'multi_select';
  options?: { value: string; label: string; labelEn: string }[];
  default: any;
  description?: string;
  descriptionEn?: string;
  /** 最低权限要求 */
  minTier?: 'free' | 'pro' | 'elite';
}

// ============================================
// 官方默认 Preset
// ============================================

export const OFFICIAL_PRESETS: Record<AgentType, OfficialPreset> = {
  // ==================== L0 Agent ====================
  PLANNING: {
    agentType: 'PLANNING',
    presetName: '标准分析规划',
    presetNameEn: 'Standard Analysis Planning',
    description: '智能规划分析流程，协调各 Agent 执行顺序',
    descriptionEn: 'Intelligent analysis workflow planning and agent coordination',
    presetConfigJson: {
      analysisDepth: 'standard',
    },
    modelPreference: 'standard',
    level: 'L0',
    allowCustomPrompt: false,
    allowModelChange: false,
  },

  // ==================== L1 Agents ====================
  PROFITABILITY: {
    agentType: 'PROFITABILITY',
    presetName: '标准利润分析',
    presetNameEn: 'Standard Profitability Analysis',
    description: '全面分析公司盈利能力，包括营收增长、毛利率、净利率等关键指标',
    descriptionEn: 'Comprehensive profitability analysis including revenue growth, margins, and key metrics',
    presetConfigJson: {
      analysisDepth: 'standard',
      focusAreas: ['revenue_growth', 'margin_analysis', 'cost_structure', 'profitability_drivers'],
      includeYoYComparison: true,
      includeQoQComparison: true,
      periodCount: 4,
      highlightAnomalies: true,
    },
    modelPreference: 'standard',
    level: 'L1',
    allowCustomPrompt: false,
    allowModelChange: true,
  },

  BALANCE_SHEET: {
    agentType: 'BALANCE_SHEET',
    presetName: '标准资产负债分析',
    presetNameEn: 'Standard Balance Sheet Analysis',
    description: '分析资产质量、负债结构和财务健康状况',
    descriptionEn: 'Analyze asset quality, liability structure, and financial health',
    presetConfigJson: {
      analysisDepth: 'standard',
      focusAreas: ['asset_quality', 'leverage_analysis', 'liquidity', 'working_capital'],
      includeRatioAnalysis: true,
      alertThresholds: {
        debtToAssets: 0.7,
        currentRatio: 1.0,
        quickRatio: 0.8,
      },
    },
    modelPreference: 'standard',
    level: 'L1',
    allowCustomPrompt: false,
    allowModelChange: true,
  },

  CASH_FLOW: {
    agentType: 'CASH_FLOW',
    presetName: '标准现金流分析',
    presetNameEn: 'Standard Cash Flow Analysis',
    description: '分析经营、投资、筹资现金流及自由现金流质量',
    descriptionEn: 'Analyze operating, investing, financing cash flows and free cash flow quality',
    presetConfigJson: {
      analysisDepth: 'standard',
      focusAreas: ['operating_cash_flow', 'free_cash_flow', 'cash_conversion', 'capex_analysis'],
      includeFCFF: true,
      includeFCFE: true,
      cashBurnAnalysis: true,
    },
    modelPreference: 'standard',
    level: 'L1',
    allowCustomPrompt: false,
    allowModelChange: true,
  },

  EARNINGS_QUALITY: {
    agentType: 'EARNINGS_QUALITY',
    presetName: '标准盈利质量分析',
    presetNameEn: 'Standard Earnings Quality Analysis',
    description: '三表联动分析，验证利润真实性和可持续性',
    descriptionEn: 'Cross-statement analysis to verify profit authenticity and sustainability',
    presetConfigJson: {
      analysisDepth: 'standard',
      focusAreas: ['profit_cash_match', 'receivables_quality', 'accrual_analysis', 'revenue_recognition'],
      redFlagDetection: true,
      includeAuditIndicators: true,
    },
    modelPreference: 'standard',
    level: 'L1',
    allowCustomPrompt: false,
    allowModelChange: true,
  },

  TREND_INTERPRETATION: {
    agentType: 'TREND_INTERPRETATION',
    presetName: '标准趋势解读',
    presetNameEn: 'Standard Trend Interpretation',
    description: '解读财务数据趋势，识别关键拐点和驱动因素',
    descriptionEn: 'Interpret financial trends, identify key inflection points and drivers',
    presetConfigJson: {
      analysisDepth: 'standard',
      trendPeriods: 8,
      includeSeasonality: true,
      includeIndustryContext: true,
    },
    modelPreference: 'standard',
    level: 'L1',
    allowCustomPrompt: false,
    allowModelChange: true,
  },

  // ==================== L2 Agents ====================
  RISK: {
    agentType: 'RISK',
    presetName: '标准风险评估',
    presetNameEn: 'Standard Risk Assessment',
    description: '评估财务风险、流动性风险和经营风险，提供风险预警',
    descriptionEn: 'Assess financial, liquidity, and operational risks with early warning',
    presetConfigJson: {
      analysisDepth: 'standard',
      riskCategories: ['debt_risk', 'liquidity_risk', 'operational_risk', 'market_risk'],
      alertThresholds: {
        debtRatio: 0.7,
        currentRatio: 1.0,
        interestCoverage: 2.0,
      },
      includeStressTest: false,
      includeScenarioAnalysis: false,
    },
    modelPreference: 'rigorous',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  BUSINESS_INSIGHT: {
    agentType: 'BUSINESS_INSIGHT',
    presetName: '标准业务洞察',
    presetNameEn: 'Standard Business Insight',
    description: '分析主营业务构成、收入结构和业务发展趋势',
    descriptionEn: 'Analyze main business composition, revenue structure, and business trends',
    presetConfigJson: {
      analysisDepth: 'standard',
      focusAreas: ['revenue_breakdown', 'segment_analysis', 'product_mix', 'geographic_distribution'],
      includeMarketPosition: true,
      includeCompetitorContext: false,
    },
    modelPreference: 'standard',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  BUSINESS_MODEL: {
    agentType: 'BUSINESS_MODEL',
    presetName: '标准商业模式分析',
    presetNameEn: 'Standard Business Model Analysis',
    description: '分析公司商业模式、竞争优势和护城河',
    descriptionEn: 'Analyze business model, competitive advantages, and moat',
    presetConfigJson: {
      analysisDepth: 'standard',
      focusAreas: ['value_proposition', 'revenue_model', 'cost_structure', 'competitive_moat'],
      includePorterAnalysis: false,
      includeSWOT: false,
    },
    modelPreference: 'standard',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  INDUSTRY_COMPARISON: {
    agentType: 'INDUSTRY_COMPARISON',
    presetName: '标准行业对比',
    presetNameEn: 'Standard Industry Comparison',
    description: '与同行业公司进行横向对比分析',
    descriptionEn: 'Horizontal comparison with industry peers',
    presetConfigJson: {
      analysisDepth: 'standard',
      comparisonMetrics: ['revenue_growth', 'profitability', 'efficiency', 'valuation'],
      peerCount: 5,
      includeIndustryAverage: true,
      includeLeaderBenchmark: true,
    },
    modelPreference: 'standard',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  // 规划中的 L2 Agents（占位）
  SENTIMENT_ANALYSIS: {
    agentType: 'SENTIMENT_ANALYSIS' as AgentType,
    presetName: '舆情分析',
    presetNameEn: 'Sentiment Analysis',
    description: '分析市场舆情和投资者情绪（规划中）',
    descriptionEn: 'Analyze market sentiment and investor mood (Planned)',
    presetConfigJson: {
      analysisDepth: 'standard',
    },
    modelPreference: 'standard',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  COMPETITOR_TRACKING: {
    agentType: 'COMPETITOR_TRACKING' as AgentType,
    presetName: '竞品追踪',
    presetNameEn: 'Competitor Tracking',
    description: '追踪竞争对手动态和市场变化（规划中）',
    descriptionEn: 'Track competitor dynamics and market changes (Planned)',
    presetConfigJson: {
      analysisDepth: 'standard',
    },
    modelPreference: 'standard',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  POLICY_ANALYSIS: {
    agentType: 'POLICY_ANALYSIS' as AgentType,
    presetName: '政策解读',
    presetNameEn: 'Policy Analysis',
    description: '解读相关政策对公司的影响（规划中）',
    descriptionEn: 'Interpret policy impacts on the company (Planned)',
    presetConfigJson: {
      analysisDepth: 'standard',
    },
    modelPreference: 'standard',
    level: 'L2',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  // ==================== L3 Agents ====================
  FORECAST: {
    agentType: 'FORECAST',
    presetName: '标准业绩预测',
    presetNameEn: 'Standard Earnings Forecast',
    description: '基于历史数据和管理层指引预测未来业绩',
    descriptionEn: 'Forecast future performance based on historical data and management guidance',
    presetConfigJson: {
      analysisDepth: 'standard',
      forecastHorizon: 'short_term', // short_term: 1Q, medium_term: 1Y, long_term: 3Y
      scenarioCount: 3, // 乐观/基准/悲观
      includeManagementGuidance: true,
      includeAnalystConsensus: false,
      assumptionStyle: 'balanced', // conservative, balanced, aggressive
    },
    modelPreference: 'deep_reasoning',
    level: 'L3',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  VALUATION: {
    agentType: 'VALUATION',
    presetName: '标准估值评估',
    presetNameEn: 'Standard Valuation Assessment',
    description: '综合相对估值和内在价值评估',
    descriptionEn: 'Comprehensive relative and intrinsic valuation assessment',
    presetConfigJson: {
      analysisDepth: 'standard',
      valuationMethods: ['pe_relative', 'pb_relative', 'ps_relative', 'dcf_simplified'],
      includeHistoricalComparison: true,
      includeIndustryComparison: true,
      includeSensitivityAnalysis: false,
      dcfAssumptions: {
        discountRate: 0.10,
        terminalGrowth: 0.03,
      },
    },
    modelPreference: 'rigorous',
    level: 'L3',
    allowCustomPrompt: true,
    allowModelChange: true,
  },

  FINAL_CONCLUSION: {
    agentType: 'FINAL_CONCLUSION',
    presetName: '标准投资结论',
    presetNameEn: 'Standard Investment Conclusion',
    description: '综合所有分析结果，给出投资建议和风险提示',
    descriptionEn: 'Synthesize all analyses into investment recommendations and risk alerts',
    presetConfigJson: {
      analysisDepth: 'standard',
      conclusionStyle: 'balanced', // conservative, balanced, aggressive
      includeScorecard: true,
      includeKeyTakeaways: true,
      includeRiskWarnings: true,
      recommendationFormat: 'structured', // structured, narrative
    },
    modelPreference: 'rigorous',
    level: 'L3',
    allowCustomPrompt: true,
    allowModelChange: true,
  },
};

// ============================================
// Agent 配置 Schema（用于 L1 参数化配置 UI）
// ============================================

export const AGENT_CONFIG_SCHEMAS: Record<AgentType, AgentConfigSchema> = {
  PLANNING: {
    agentType: 'PLANNING',
    level: 'L0',
    configFields: [], // L0 不可配置
  },

  PROFITABILITY: {
    agentType: 'PROFITABILITY',
    level: 'L1',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
        description: '分析的详细程度',
        descriptionEn: 'Level of analysis detail',
      },
      {
        key: 'focusAreas',
        label: '重点分析领域',
        labelEn: 'Focus Areas',
        type: 'multi_select',
        options: [
          { value: 'revenue_growth', label: '营收增长', labelEn: 'Revenue Growth' },
          { value: 'margin_analysis', label: '利润率分析', labelEn: 'Margin Analysis' },
          { value: 'cost_structure', label: '成本结构', labelEn: 'Cost Structure' },
          { value: 'profitability_drivers', label: '盈利驱动因素', labelEn: 'Profitability Drivers' },
        ],
        default: ['revenue_growth', 'margin_analysis', 'cost_structure', 'profitability_drivers'],
        description: '选择要重点分析的领域',
        descriptionEn: 'Select areas to focus on',
      },
      {
        key: 'includeYoYComparison',
        label: '包含同比分析',
        labelEn: 'Include YoY Comparison',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeQoQComparison',
        label: '包含环比分析',
        labelEn: 'Include QoQ Comparison',
        type: 'boolean',
        default: true,
      },
      {
        key: 'periodCount',
        label: '分析期数',
        labelEn: 'Period Count',
        type: 'number',
        default: 4,
        description: '分析最近几期数据',
        descriptionEn: 'Number of periods to analyze',
      },
    ],
  },

  BALANCE_SHEET: {
    agentType: 'BALANCE_SHEET',
    level: 'L1',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
      },
      {
        key: 'focusAreas',
        label: '重点分析领域',
        labelEn: 'Focus Areas',
        type: 'multi_select',
        options: [
          { value: 'asset_quality', label: '资产质量', labelEn: 'Asset Quality' },
          { value: 'leverage_analysis', label: '杠杆分析', labelEn: 'Leverage Analysis' },
          { value: 'liquidity', label: '流动性', labelEn: 'Liquidity' },
          { value: 'working_capital', label: '营运资本', labelEn: 'Working Capital' },
        ],
        default: ['asset_quality', 'leverage_analysis', 'liquidity', 'working_capital'],
      },
      {
        key: 'includeRatioAnalysis',
        label: '包含比率分析',
        labelEn: 'Include Ratio Analysis',
        type: 'boolean',
        default: true,
      },
    ],
  },

  CASH_FLOW: {
    agentType: 'CASH_FLOW',
    level: 'L1',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
      },
      {
        key: 'includeFCFF',
        label: '包含企业自由现金流(FCFF)',
        labelEn: 'Include FCFF',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeFCFE',
        label: '包含股权自由现金流(FCFE)',
        labelEn: 'Include FCFE',
        type: 'boolean',
        default: true,
      },
      {
        key: 'cashBurnAnalysis',
        label: '现金消耗分析',
        labelEn: 'Cash Burn Analysis',
        type: 'boolean',
        default: true,
      },
    ],
  },

  EARNINGS_QUALITY: {
    agentType: 'EARNINGS_QUALITY',
    level: 'L1',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
      },
      {
        key: 'redFlagDetection',
        label: '财务红旗检测',
        labelEn: 'Red Flag Detection',
        type: 'boolean',
        default: true,
        description: '检测潜在的财务造假迹象',
        descriptionEn: 'Detect potential financial fraud indicators',
      },
      {
        key: 'includeAuditIndicators',
        label: '包含审计指标',
        labelEn: 'Include Audit Indicators',
        type: 'boolean',
        default: true,
      },
    ],
  },

  TREND_INTERPRETATION: {
    agentType: 'TREND_INTERPRETATION',
    level: 'L1',
    configFields: [
      {
        key: 'trendPeriods',
        label: '趋势分析期数',
        labelEn: 'Trend Periods',
        type: 'number',
        default: 8,
      },
      {
        key: 'includeSeasonality',
        label: '包含季节性分析',
        labelEn: 'Include Seasonality',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeIndustryContext',
        label: '包含行业背景',
        labelEn: 'Include Industry Context',
        type: 'boolean',
        default: true,
      },
    ],
  },

  RISK: {
    agentType: 'RISK',
    level: 'L2',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
      },
      {
        key: 'riskCategories',
        label: '风险类别',
        labelEn: 'Risk Categories',
        type: 'multi_select',
        options: [
          { value: 'debt_risk', label: '债务风险', labelEn: 'Debt Risk' },
          { value: 'liquidity_risk', label: '流动性风险', labelEn: 'Liquidity Risk' },
          { value: 'operational_risk', label: '经营风险', labelEn: 'Operational Risk' },
          { value: 'market_risk', label: '市场风险', labelEn: 'Market Risk' },
        ],
        default: ['debt_risk', 'liquidity_risk', 'operational_risk', 'market_risk'],
      },
      {
        key: 'includeStressTest',
        label: '包含压力测试',
        labelEn: 'Include Stress Test',
        type: 'boolean',
        default: false,
        minTier: 'elite',
      },
      {
        key: 'includeScenarioAnalysis',
        label: '包含情景分析',
        labelEn: 'Include Scenario Analysis',
        type: 'boolean',
        default: false,
        minTier: 'elite',
      },
    ],
  },

  BUSINESS_INSIGHT: {
    agentType: 'BUSINESS_INSIGHT',
    level: 'L2',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
      },
      {
        key: 'includeMarketPosition',
        label: '包含市场地位分析',
        labelEn: 'Include Market Position',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeCompetitorContext',
        label: '包含竞争对手背景',
        labelEn: 'Include Competitor Context',
        type: 'boolean',
        default: false,
        minTier: 'elite',
      },
    ],
  },

  BUSINESS_MODEL: {
    agentType: 'BUSINESS_MODEL',
    level: 'L2',
    configFields: [
      {
        key: 'analysisDepth',
        label: '分析深度',
        labelEn: 'Analysis Depth',
        type: 'select',
        options: [
          { value: 'quick', label: '快速', labelEn: 'Quick' },
          { value: 'standard', label: '标准', labelEn: 'Standard' },
          { value: 'deep', label: '深度', labelEn: 'Deep' },
        ],
        default: 'standard',
      },
      {
        key: 'includePorterAnalysis',
        label: '包含波特五力分析',
        labelEn: 'Include Porter Analysis',
        type: 'boolean',
        default: false,
        minTier: 'elite',
      },
      {
        key: 'includeSWOT',
        label: '包含 SWOT 分析',
        labelEn: 'Include SWOT Analysis',
        type: 'boolean',
        default: false,
        minTier: 'elite',
      },
    ],
  },

  INDUSTRY_COMPARISON: {
    agentType: 'INDUSTRY_COMPARISON',
    level: 'L2',
    configFields: [
      {
        key: 'peerCount',
        label: '对比公司数量',
        labelEn: 'Peer Count',
        type: 'number',
        default: 5,
      },
      {
        key: 'comparisonMetrics',
        label: '对比指标',
        labelEn: 'Comparison Metrics',
        type: 'multi_select',
        options: [
          { value: 'revenue_growth', label: '营收增长', labelEn: 'Revenue Growth' },
          { value: 'profitability', label: '盈利能力', labelEn: 'Profitability' },
          { value: 'efficiency', label: '运营效率', labelEn: 'Efficiency' },
          { value: 'valuation', label: '估值水平', labelEn: 'Valuation' },
        ],
        default: ['revenue_growth', 'profitability', 'efficiency', 'valuation'],
      },
      {
        key: 'includeIndustryAverage',
        label: '包含行业平均',
        labelEn: 'Include Industry Average',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeLeaderBenchmark',
        label: '包含行业龙头对标',
        labelEn: 'Include Leader Benchmark',
        type: 'boolean',
        default: true,
      },
    ],
  },

  // 规划中的 Agents
  SENTIMENT_ANALYSIS: {
    agentType: 'SENTIMENT_ANALYSIS' as AgentType,
    level: 'L2',
    configFields: [],
  },

  COMPETITOR_TRACKING: {
    agentType: 'COMPETITOR_TRACKING' as AgentType,
    level: 'L2',
    configFields: [],
  },

  POLICY_ANALYSIS: {
    agentType: 'POLICY_ANALYSIS' as AgentType,
    level: 'L2',
    configFields: [],
  },

  FORECAST: {
    agentType: 'FORECAST',
    level: 'L3',
    configFields: [
      {
        key: 'forecastHorizon',
        label: '预测时间范围',
        labelEn: 'Forecast Horizon',
        type: 'select',
        options: [
          { value: 'short_term', label: '短期 (1季度)', labelEn: 'Short Term (1Q)' },
          { value: 'medium_term', label: '中期 (1年)', labelEn: 'Medium Term (1Y)' },
          { value: 'long_term', label: '长期 (3年)', labelEn: 'Long Term (3Y)' },
        ],
        default: 'short_term',
        minTier: 'elite',
      },
      {
        key: 'scenarioCount',
        label: '情景数量',
        labelEn: 'Scenario Count',
        type: 'number',
        default: 3,
        description: '乐观/基准/悲观情景',
        descriptionEn: 'Optimistic/Base/Pessimistic scenarios',
      },
      {
        key: 'assumptionStyle',
        label: '假设风格',
        labelEn: 'Assumption Style',
        type: 'select',
        options: [
          { value: 'conservative', label: '保守', labelEn: 'Conservative' },
          { value: 'balanced', label: '均衡', labelEn: 'Balanced' },
          { value: 'aggressive', label: '激进', labelEn: 'Aggressive' },
        ],
        default: 'balanced',
        minTier: 'elite',
      },
      {
        key: 'includeManagementGuidance',
        label: '参考管理层指引',
        labelEn: 'Include Management Guidance',
        type: 'boolean',
        default: true,
      },
    ],
  },

  VALUATION: {
    agentType: 'VALUATION',
    level: 'L3',
    configFields: [
      {
        key: 'valuationMethods',
        label: '估值方法',
        labelEn: 'Valuation Methods',
        type: 'multi_select',
        options: [
          { value: 'pe_relative', label: 'PE 相对估值', labelEn: 'PE Relative' },
          { value: 'pb_relative', label: 'PB 相对估值', labelEn: 'PB Relative' },
          { value: 'ps_relative', label: 'PS 相对估值', labelEn: 'PS Relative' },
          { value: 'dcf_simplified', label: 'DCF 简化模型', labelEn: 'DCF Simplified' },
        ],
        default: ['pe_relative', 'pb_relative', 'ps_relative', 'dcf_simplified'],
      },
      {
        key: 'includeHistoricalComparison',
        label: '包含历史估值对比',
        labelEn: 'Include Historical Comparison',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeIndustryComparison',
        label: '包含行业估值对比',
        labelEn: 'Include Industry Comparison',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeSensitivityAnalysis',
        label: '包含敏感性分析',
        labelEn: 'Include Sensitivity Analysis',
        type: 'boolean',
        default: false,
        minTier: 'elite',
      },
    ],
  },

  FINAL_CONCLUSION: {
    agentType: 'FINAL_CONCLUSION',
    level: 'L3',
    configFields: [
      {
        key: 'conclusionStyle',
        label: '结论风格',
        labelEn: 'Conclusion Style',
        type: 'select',
        options: [
          { value: 'conservative', label: '保守', labelEn: 'Conservative' },
          { value: 'balanced', label: '均衡', labelEn: 'Balanced' },
          { value: 'aggressive', label: '激进', labelEn: 'Aggressive' },
        ],
        default: 'balanced',
        minTier: 'elite',
      },
      {
        key: 'includeScorecard',
        label: '包含评分卡',
        labelEn: 'Include Scorecard',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeKeyTakeaways',
        label: '包含关键要点',
        labelEn: 'Include Key Takeaways',
        type: 'boolean',
        default: true,
      },
      {
        key: 'includeRiskWarnings',
        label: '包含风险提示',
        labelEn: 'Include Risk Warnings',
        type: 'boolean',
        default: true,
      },
      {
        key: 'recommendationFormat',
        label: '建议格式',
        labelEn: 'Recommendation Format',
        type: 'select',
        options: [
          { value: 'structured', label: '结构化', labelEn: 'Structured' },
          { value: 'narrative', label: '叙述式', labelEn: 'Narrative' },
        ],
        default: 'structured',
      },
    ],
  },
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取官方默认 Preset
 */
export function getOfficialPreset(agentType: AgentType): OfficialPreset | undefined {
  return OFFICIAL_PRESETS[agentType];
}

/**
 * 获取 Agent 配置 Schema
 */
export function getAgentConfigSchema(agentType: AgentType): AgentConfigSchema | undefined {
  return AGENT_CONFIG_SCHEMAS[agentType];
}

/**
 * 获取所有已上线的 Agent 类型
 */
export function getActiveAgentTypes(): AgentType[] {
  return [
    'PLANNING',
    'PROFITABILITY',
    'BALANCE_SHEET',
    'CASH_FLOW',
    'EARNINGS_QUALITY',
    'TREND_INTERPRETATION',
    'RISK',
    'BUSINESS_INSIGHT',
    'BUSINESS_MODEL',
    'INDUSTRY_COMPARISON',
    'FORECAST',
    'VALUATION',
    'FINAL_CONCLUSION',
  ];
}

/**
 * 获取指定级别的 Agent
 */
export function getAgentsByLevel(level: 'L0' | 'L1' | 'L2' | 'L3'): AgentType[] {
  return Object.entries(OFFICIAL_PRESETS)
    .filter(([_, preset]) => preset.level === level)
    .map(([agentType]) => agentType as AgentType);
}

/**
 * 检查用户是否有权限配置指定 Agent
 */
export function canConfigureAgent(
  agentType: AgentType,
  userTier: 'guest' | 'free' | 'pro' | 'elite'
): { canConfigure: boolean; canEditPrompt: boolean; canChangeModel: boolean } {
  const preset = OFFICIAL_PRESETS[agentType];
  if (!preset) {
    return { canConfigure: false, canEditPrompt: false, canChangeModel: false };
  }

  const tierOrder = { guest: 0, free: 1, pro: 2, elite: 3 };
  const userTierLevel = tierOrder[userTier];

  // L0 不可配置
  if (preset.level === 'L0') {
    return { canConfigure: false, canEditPrompt: false, canChangeModel: false };
  }

  // L1: Pro+ 可配置参数和模型
  if (preset.level === 'L1') {
    const canConfigure = userTierLevel >= tierOrder.pro;
    return {
      canConfigure,
      canEditPrompt: false, // L1 不允许自定义 Prompt
      canChangeModel: canConfigure && preset.allowModelChange,
    };
  }

  // L2: Pro+ 可配置，Elite 可编辑 Prompt
  if (preset.level === 'L2') {
    const canConfigure = userTierLevel >= tierOrder.pro;
    return {
      canConfigure,
      canEditPrompt: userTierLevel >= tierOrder.elite && preset.allowCustomPrompt,
      canChangeModel: canConfigure && preset.allowModelChange,
    };
  }

  // L3: Elite 独占
  if (preset.level === 'L3') {
    const canConfigure = userTierLevel >= tierOrder.elite;
    return {
      canConfigure,
      canEditPrompt: canConfigure && preset.allowCustomPrompt,
      canChangeModel: canConfigure && preset.allowModelChange,
    };
  }

  return { canConfigure: false, canEditPrompt: false, canChangeModel: false };
}
