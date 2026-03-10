// ============ 用户相关类型 ============
export interface User {
  id: number;
  email: string;
  name?: string;
  avatarUrl?: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPayload {
  userId: number;
  email: string;
  tier: string;
  exp: number;
}

// ============ 财务数据类型 ============
export interface FinancialStatement {
  tsCode: string;
  companyName: string;
  period: string;
  reportType: 'Q1' | 'Q2' | 'Q3' | 'annual';
}

// 利润表数据
export interface IncomeStatement extends FinancialStatement {
  revenue: number;
  revenueGrowth: number;
  grossProfit: number;
  grossMargin: number;
  operatingProfit: number;
  operatingMargin: number;
  netProfit: number;
  netMargin: number;
  eps: number;
  costOfRevenue: number;
  sellingExpense: number;
  adminExpense: number;
  rdExpense: number;
  financeExpense: number;
}

// 资产负债表数据
export interface BalanceSheet extends FinancialStatement {
  totalAssets: number;
  totalLiabilities: number;
  shareholderEquity: number;
  cash: number;
  accountsReceivable: number;
  inventory: number;
  fixedAssets: number;
  shortTermDebt: number;
  longTermDebt: number;
  accountsPayable: number;
  debtToAssetRatio: number;
  currentRatio: number;
  quickRatio: number;
}

// 现金流量表数据
export interface CashFlowStatement extends FinancialStatement {
  operatingCashFlow: number;
  netProfitToOCF: number;
  investingCashFlow: number;
  capex: number;
  financingCashFlow: number;
  dividendPaid: number;
  freeCashFlow: number;
}

// ============ Agent 分析结果类型 ============
export interface AgentResult {
  agentName: string;
  status: 'success' | 'error';
  executionTime: number;
  timestamp: Date;
}

// 分析规划结果
export interface PlanningResult extends AgentResult {
  reportType: 'quarterly' | 'annual';
  analysisSequence: string[];
  riskFlags: RiskFlag[];
  estimatedTime: number;
}

export interface RiskFlag {
  type: 'high_debt' | 'high_receivables' | 'negative_ocf' | 'margin_decline';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// 利润表分析结果
export interface ProfitabilityResult extends AgentResult {
  revenueAnalysis: {
    trend: 'growing' | 'stable' | 'declining';
    growthRate: number;
    coreBusinessRatio: number;
    analysis: string;
  };
  marginAnalysis: {
    grossMarginTrend: 'improving' | 'stable' | 'declining';
    netMarginTrend: 'improving' | 'stable' | 'declining';
    analysis: string;
  };
  costStructure: {
    costRatio: number;
    expenseBreakdown: Record<string, number>;
    efficiency: string;
  };
  sustainability: {
    score: number;
    factors: string[];
    conclusion: string;
  };
}

// 资产负债表分析结果
export interface BalanceSheetResult extends AgentResult {
  assetQuality: {
    assetGrowth: number;
    cashPosition: 'strong' | 'adequate' | 'weak';
    receivablesRisk: 'low' | 'medium' | 'high';
    analysis: string;
  };
  leverageAnalysis: {
    debtLevel: 'safe' | 'moderate' | 'high' | 'dangerous';
    debtToAssetRatio: number;
    interestCoverage: number;
    analysis: string;
  };
  financialHealth: {
    score: number;
    liquidity: string;
    solvency: string;
    conclusion: string;
  };
}

// 现金流分析结果
export interface CashFlowResult extends AgentResult {
  operatingCashFlow: {
    quality: 'excellent' | 'good' | 'weak' | 'poor';
    profitConversion: number;
    sustainability: string;
    analysis: string;
  };
  investingActivities: {
    strategyAlignment: 'aligned' | 'questionable' | 'misaligned';
    capexRatio: number;
    analysis: string;
  };
  financingActivities: {
    dependency: 'low' | 'moderate' | 'high';
    dividendPolicy: string;
    analysis: string;
  };
  freeCashFlow: {
    trend: 'positive' | 'negative';
    amount: number;
    analysis: string;
  };
}

// 三表联动分析结果
export interface EarningsQualityResult extends AgentResult {
  profitToCashValidation: {
    isValidated: boolean;
    ratio: number;
    analysis: string;
  };
  receivablesRisk: {
    receivablesToRevenue: number;
    daysReceivable: number;
    riskLevel: 'low' | 'medium' | 'high';
    analysis: string;
  };
  freeCashFlowAnalysis: {
    trend: string;
    sustainability: string;
    analysis: string;
  };
  overallQuality: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    conclusion: string;
  };
}

// 风险分析结果
export interface RiskResult extends AgentResult {
  debtRisk: {
    level: 'low' | 'moderate' | 'high' | 'critical';
    debtToAssetRatio: number;
    interestCoverage: number;
    analysis: string;
  };
  liquidityRisk: {
    level: 'low' | 'moderate' | 'high';
    currentRatio: number;
    quickRatio: number;
    analysis: string;
  };
  operationalRisk: {
    level: 'low' | 'moderate' | 'high';
    factors: string[];
    analysis: string;
  };
  overallRisk: {
    score: number;
    grade: 'safe' | 'moderate' | 'risky' | 'dangerous';
    recommendations: string[];
  };
}

// 业务洞察结果
export interface BusinessInsightResult extends AgentResult {
  channelAnalysis: {
    changes: string[];
    impact: string;
  };
  productStructure: {
    changes: string[];
    trend: string;
  };
  industryPosition: {
    cyclicalImpact: string;
    competitivePosition: string;
    marketTrend: string;
  };
  keyFindings: string[];
}

// 商业模式分析结果
export interface BusinessModelResult extends AgentResult {
  coreModel: {
    type: string;
    description: string;
    moat: string[];
  };
  competitiveAdvantage: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  cultureAnalysis: {
    innovationCapability: 'strong' | 'moderate' | 'weak';
    employeeStability: 'high' | 'medium' | 'low';
    customerLoyalty: 'high' | 'medium' | 'low';
    analysis: string;
  };
  sustainability: {
    score: number;
    outlook: string;
    recommendations: string[];
  };
}

// 业绩预测结果
export interface ForecastResult extends AgentResult {
  assumptions: string[];
  revenueForecast: {
    nextQuarter: { min: number; max: number; expected: number };
    fullYear: { min: number; max: number; expected: number };
  };
  profitForecast: {
    nextQuarter: { min: number; max: number; expected: number };
    fullYear: { min: number; max: number; expected: number };
  };
  confidence: 'high' | 'medium' | 'low';
  risks: string[];
  caveats: string[];
}

// 估值评估结果
export interface ValuationResult extends AgentResult {
  summary: {
    currentPE: number | string;
    currentPB: number | string;
    currentPS: number | string;
    marketCap: number | string;
    overallAssessment: '低估' | '合理' | '高估' | '严重高估';
    oneSentence: string;
  };
  relativeValuation: {
    peAnalysis: {
      current: number | string;
      historicalAvg: string;
      industryAvg: string;
      assessment: string;
      isAttractive: boolean;
    };
    pbAnalysis: {
      current: number | string;
      historicalAvg: string;
      industryAvg: string;
      assessment: string;
      isAttractive: boolean;
    };
    psAnalysis: {
      current: number | string;
      historicalAvg: string;
      industryAvg: string;
      assessment: string;
      isAttractive: boolean;
    };
  };
  intrinsicValue: {
    dcfEstimate: string;
    marginOfSafety: string;
    fairValueRange: string;
    assessment: string;
  };
  marketSentiment: {
    turnoverRate: number | string;
    volumeRatio: number | string;
    sentiment: '乐观' | '中性' | '悲观';
    analysis: string;
  };
  investmentImplication: {
    entryPointAssessment: string;
    suggestedAction: '强烈买入' | '买入' | '持有' | '减持' | '卖出';
    priceTarget: string;
    upside: string;
    timeHorizon: string;
  };
  risks: string[];
  catalysts: string[];
}

// ============ 趋势解读类型 ============
// 单个指标的趋势解读
export interface MetricInterpretation {
  // 基础数据
  latestValue: string;           // 最新值（如："646.27亿"）
  latestPeriod: string;          // 最新期间（如："2025三季报"）
  yoyChange: string;             // 同比变化（如："+6.25%"）
  yoyDirection: 'up' | 'down' | 'flat';  // 同比方向
  
  // 趋势判断
  trend: 'up' | 'down' | 'flat'; // 趋势方向
  trendLabel: string;            // 趋势标签（如："上升"、"下降"、"持平"）
  trendPeriods: string;          // 趋势描述（如："近12期整体呈上升趋势"）
  peakInfo: string;              // 峰值信息（如："峰值出现在2024年报"）
  
  // AI 深度解读
  insight: string;               // 深度洞察（150-200字）
  concerns: string;              // 关注点（100-150字）
}

// 7个核心指标的趋势解读集合
export interface TrendInterpretations {
  netProfit: MetricInterpretation;      // 归母净利润
  revenue: MetricInterpretation;        // 营业收入
  eps: MetricInterpretation;            // 每股收益
  grossMargin: MetricInterpretation;    // 毛利率
  netMargin: MetricInterpretation;      // 净利率
  roe: MetricInterpretation;            // ROE
  debtRatio: MetricInterpretation;      // 资产负债率
}

// 趋势解读缓存数据
export interface TrendInterpretationCache {
  companyCode: string;           // 股票代码
  companyName: string;           // 公司名称
  industry: string;              // 行业
  latestPeriod: string;          // 最新财报期间（用于判断缓存是否过期）
  interpretations: TrendInterpretations;
  generatedAt: string;           // 生成时间
  expiresAt: string;             // 过期时间（下一季度财报公示日）
}

// 最终投资结论
export interface FinalConclusionResult extends AgentResult {
  companyQuality: {
    isHealthy: boolean;
    score: number;
    summary: string;
  };
  investmentValue: {
    hasLongTermValue: boolean;
    valuationAssessment: 'undervalued' | 'fair' | 'overvalued';
    summary: string;
  };
  riskAssessment: {
    isAcceptable: boolean;
    mainRisks: string[];
    summary: string;
  };
  recommendation: {
    action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    targetInvestor: 'conservative' | 'growth' | 'aggressive';
    timeHorizon: 'short' | 'medium' | 'long';
    summary: string;
  };
  keyTakeaways: string[];
}

// ============ 完整分析报告 ============
export interface AnalysisReport {
  id: number;
  userId?: number;
  companyCode: string;
  companyName: string;
  reportType: 'quarterly' | 'annual';
  reportPeriod: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  planningResult?: PlanningResult;
  profitabilityResult?: ProfitabilityResult;
  balanceSheetResult?: BalanceSheetResult;
  cashFlowResult?: CashFlowResult;
  earningsQualityResult?: EarningsQualityResult;
  riskResult?: RiskResult;
  businessInsightResult?: BusinessInsightResult;
  businessModelResult?: BusinessModelResult;
  forecastResult?: ForecastResult;
  valuationResult?: ValuationResult;
  trendInterpretations?: TrendInterpretations;  // 趋势解读
  finalConclusion?: FinalConclusionResult;
  comicData?: ComicData;
  createdAt: Date;
  updatedAt: Date;
}

// 漫画数据 - 增强版
export interface ComicData {
  title?: string;
  panels: ComicPanel[];
  summary: string;
  style: 'business' | 'modern' | 'classic' | 'minimal';
  mainCharacter?: {
    name: string;
    description: string;
    personality: string;
  };
  financialHighlights?: string[];
}

export interface ComicPanel {
  imageUrl: string;
  caption: string;
  dialogue?: string;
  scene?: string;
  visualMetaphor?: string;
  mood?: string;
  order: number;
}

// ============ Agent 模型配置类型 ============
import type { AgentModelConfig, ModelPreference, AgentType } from '../services/vectorengine';
export type { AgentModelConfig, ModelPreference, AgentType };

// ============ Preset 覆盖配置 ============
export interface PresetOverride {
  presetId?: number;
  modelPreference?: ModelPreference;
}

// ============ Agent Prompt 配置类型 ============
/**
 * AgentPromptConfig - 用户自定义 Prompt 配置
 * 用于将用户的 Preset Prompt 注入到各 Agent 的 System Prompt 中
 * 
 * 使用方式：
 * - API 层从 AgentPresetsService 提取用户配置的 presetPromptText
 * - Orchestrator 通过 mergeSystemPrompt 将其追加到原始 System Prompt 末尾
 * - 最大长度限制：2000 字符
 * 
 * @example
 * const promptConfig: AgentPromptConfig = {
 *   PROFITABILITY: "请特别关注毛利率的行业对比分析",
 *   RISK: "风险分析时请重点关注债务结构"
 * };
 */
export type AgentPromptConfig = Partial<Record<AgentType, string | null>>;

// ============ API 请求/响应类型 ============
export interface StartAnalysisRequest {
  companyCode: string;
  companyName?: string;
  reportType: 'quarterly' | 'annual';
  reportPeriod?: string;
  options?: {
    /** @deprecated 商业模式分析已改为必选，此参数将被忽略 */
    includeBusinessModel?: boolean;
    /** @deprecated 业绩预测已改为必选，此参数将被忽略 */
    includeForecast?: boolean;
    includeComic?: boolean;
  };
  /** Phase 0: Agent 独立模型配置 - 允许用户为每个 Agent 指定不同的模型偏好 */
  agentModelConfig?: AgentModelConfig;
  /** Phase 1: Preset 覆盖 - 允许用户在单次分析中临时使用特定 Preset */
  presetOverrides?: Partial<Record<AgentType, PresetOverride>>;
}

export interface AnalysisProgress {
  currentPhase: string;
  completedAgents: string[];
  totalAgents: number;
  percentage: number;
}

// ============ IP角色系统 ============
// IP角色定义
export interface IPCharacter {
  id: string;                     // 角色唯一标识
  name: string;                   // 角色名称
  displayName: string;            // 显示名称
  description: string;            // 角色描述（用于图片生成）
  personality: string;            // 性格特点
  visualStyle: string;            // 视觉风格描述（英文，用于图片prompt）
  colorPalette: string[];         // 配色方案
  catchphrase?: string;           // 标志性台词
  source: string;                 // 来源（如：哪吒之魔童降世）
  suitableFor?: string[];         // 适合的行业类型
}

// IP角色集合
export interface IPCharacterSet {
  id: string;                     // 角色集ID
  name: string;                   // 角色集名称
  description: string;            // 描述
  source: string;                 // 来源
  characters: IPCharacter[];      // 角色列表
  defaultCharacterId: string;     // 默认主角ID
}

// ============ 漫画内容风格系统 ============
/**
 * 漫画内容风格类型
 * - structured: 规范4步分析 - 每格固定4小格，结构统一清晰
 * - creative: 自由创意 - 布局灵活多变，模型自由发挥
 * - academic: 学术论文风格 - 严谨专业，数据图表为主
 * - story: 叙事故事风格 - 连贯叙事，情节化展示
 * - dashboard: 仪表盘风格 - 数据密集，可视化为主
 */
export type ComicContentStyle = 'structured' | 'creative' | 'academic' | 'story' | 'dashboard';

// 内容风格显示信息（用于前端展示）
export interface ContentStyleInfo {
  id: ComicContentStyle;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  creativeFreedom: 'low' | 'medium' | 'high';
}

// 漫画生成配置 - 增强版
export interface ComicGenerationOptions {
  style?: 'business' | 'modern' | 'classic' | 'nezha' | 'custom';
  characterSetId?: string;        // IP角色集ID
  mainCharacterId?: string;       // 主角ID
  customCharacter?: IPCharacter;  // 自定义角色
  panelCount?: number;            // 面板数量
  outputFormat?: 'grid' | 'vertical-scroll';  // 输出格式：网格/长图滚动
  contentStyle?: ComicContentStyle;  // 内容风格
}

// 长图文漫画数据
export interface ScrollComicData extends ComicData {
  outputFormat: 'vertical-scroll';
  totalHeight?: number;           // 总高度（像素）
  panelHeight?: number;           // 每格高度
  htmlContent?: string;           // 渲染后的HTML内容
}

// ============ Cloudflare Bindings ============
export interface Bindings {
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
  VECTORENGINE_API_KEY: string;
  TUSHARE_TOKEN: string;
  JWT_SECRET: string;
  /** AKShare Python 代理服务地址 (港股数据) */
  AKSHARE_PROXY_URL?: string;
}
