// 多Agent编排器 - DAG混合编排实现
import { 
  VectorEngineService, 
  AgentModelConfig, 
  getAgentModel,
  DEFAULT_AGENT_MODEL_CONFIG 
} from '../services/vectorengine';
import { 
  TushareService, 
  IncomeData, 
  BalanceData, 
  CashFlowData,
  ForecastData,
  ExpressData,
  FinaIndicatorData,
  MainBizData,
  DailyBasicData
} from '../services/tushare';
import { StockDataService } from '../services/stockDataService';
import { normalizeStockCode } from '../utils/stockCode';
import { AGENT_PROMPTS, AGENT_NAMES, AGENT_PHASES } from './prompts';
import type {
  AnalysisReport,
  PlanningResult,
  ProfitabilityResult,
  BalanceSheetResult,
  CashFlowResult,
  EarningsQualityResult,
  RiskResult,
  BusinessInsightResult,
  BusinessModelResult,
  ForecastResult,
  ValuationResult,
  FinalConclusionResult,
  AnalysisProgress,
  TrendInterpretations,
  TrendInterpretationCache,
  AgentPromptConfig,
} from '../types';

export interface OrchestratorConfig {
  vectorEngine: VectorEngineService;
  /** @deprecated 使用 dataService 替代 */
  tushare?: TushareService;
  /** 统一数据服务 (支持 A股 + 港股自动路由) */
  dataService?: StockDataService;
  cache?: KVNamespace;  // 用于趋势解读缓存
  onProgress?: (progress: AnalysisProgress) => void;
  agentModelConfig?: AgentModelConfig;  // Agent 独立模型配置
  agentPromptConfig?: AgentPromptConfig;  // 用户自定义 Prompt 配置
}

export interface AnalysisOptions {
  companyCode: string;
  companyName: string;
  reportType: 'quarterly' | 'annual';
  reportPeriod?: string;
  /** @deprecated 商业模式分析已改为必选，此参数将被忽略 */
  includeBusinessModel?: boolean;
  /** @deprecated 业绩预测已改为必选，此参数将被忽略 */
  includeForecast?: boolean;
  agentModelConfig?: AgentModelConfig;  // 可在分析时覆盖模型配置
}

export interface FinancialData {
  income: IncomeData[];
  balance: BalanceData[];
  cashFlow: CashFlowData[];
  // 新增高级数据（5000积分接口）
  forecast?: ForecastData[];      // 业绩预告 - 用于业绩预测Agent
  express?: ExpressData[];        // 业绩快报 - 用于业绩预测Agent
  finaIndicator?: FinaIndicatorData[]; // 财务指标 - 用于各Agent深度分析
  mainBiz?: MainBizData[];        // 主营业务构成 - 用于商业模式Agent和业务洞察Agent
  dailyBasic?: DailyBasicData[];  // 每日指标 - 用于估值评估Agent（PE/PB/PS/市值等）
}

export class AnalysisOrchestrator {
  private vectorEngine: VectorEngineService;
  /** @deprecated 使用 dataService 替代 */
  private tushare?: TushareService;
  /** 统一数据服务 (支持 A股 + 港股自动路由) */
  private dataService?: StockDataService;
  private cache?: KVNamespace;
  private onProgress?: (progress: AnalysisProgress) => void;
  private completedAgents: string[] = [];
  private totalAgents = 10;
  private agentModelConfig: AgentModelConfig;
  private agentPromptConfig: AgentPromptConfig;

  // 趋势解读缓存TTL：90天（一个季度）
  private static TREND_CACHE_TTL = 90 * 24 * 60 * 60;
  
  // 用户自定义 Prompt 最大长度限制
  private static MAX_USER_PROMPT_LENGTH = 2000;

  constructor(config: OrchestratorConfig) {
    this.vectorEngine = config.vectorEngine;
    // 优先使用 dataService (统一数据服务)，向后兼容 tushare
    this.dataService = config.dataService;
    this.tushare = config.tushare;
    this.cache = config.cache;
    this.onProgress = config.onProgress;
    // 合并默认配置与用户配置
    this.agentModelConfig = {
      ...DEFAULT_AGENT_MODEL_CONFIG,
      ...config.agentModelConfig
    };
    // 初始化用户 Prompt 配置（默认为空对象）
    this.agentPromptConfig = config.agentPromptConfig || {};
    
    // 日志记录使用的数据服务
    if (this.dataService) {
      console.log('[Orchestrator] 使用统一数据服务 (支持 A股 + 港股)');
    } else if (this.tushare) {
      console.log('[Orchestrator] 使用 Tushare 数据服务 (仅 A股)');
    }
  }

  /**
   * 获取数据服务 (统一访问入口)
   * 优先返回 dataService，向后兼容 tushare
   */
  private getDataService(): StockDataService | TushareService {
    if (this.dataService) {
      return this.dataService;
    }
    if (this.tushare) {
      return this.tushare;
    }
    throw new Error('[Orchestrator] 未配置数据服务 (dataService 或 tushare)');
  }

  /**
   * 获取指定 Agent 的模型
   */
  private getModelForAgent(agentType: keyof AgentModelConfig, options?: AnalysisOptions): string {
    // 优先使用 options 中的配置，其次使用实例配置
    const config = options?.agentModelConfig 
      ? { ...this.agentModelConfig, ...options.agentModelConfig }
      : this.agentModelConfig;
    return getAgentModel(agentType, config);
  }

  /**
   * 合并系统 Prompt 与用户自定义 Prompt
   * 
   * 策略：将用户 Prompt 追加到原始 System Prompt 末尾
   * - 使用分隔标记明确区分
   * - 保留 JSON 输出格式约束
   * - 最大长度限制 2000 字符
   * 
   * @param systemPrompt 原始 System Prompt（来自 AGENT_PROMPTS）
   * @param agentType Agent 类型，用于查找用户配置
   * @returns 合并后的 System Prompt
   */
  private mergeSystemPrompt(systemPrompt: string, agentType: keyof AgentPromptConfig): string {
    const userCustomPrompt = this.agentPromptConfig[agentType];
    
    // 如果没有用户自定义 Prompt，直接返回原始 Prompt
    if (!userCustomPrompt || userCustomPrompt.trim() === '') {
      return systemPrompt;
    }
    
    // 截断过长的用户 Prompt
    let trimmedUserPrompt = userCustomPrompt.trim();
    if (trimmedUserPrompt.length > AnalysisOrchestrator.MAX_USER_PROMPT_LENGTH) {
      trimmedUserPrompt = trimmedUserPrompt.substring(0, AnalysisOrchestrator.MAX_USER_PROMPT_LENGTH);
      console.warn(`[Orchestrator] 用户 Prompt 超过最大长度限制，已截断至 ${AnalysisOrchestrator.MAX_USER_PROMPT_LENGTH} 字符`);
    }
    
    // 记录日志
    console.log(`[Orchestrator] 合并用户 Prompt: Agent=${String(agentType)}, 长度=${trimmedUserPrompt.length}字符`);
    
    // 追加用户 Prompt 到末尾，使用分隔标记
    return `${systemPrompt}

---
## 用户自定义分析指令（请优先遵循以下要求）
${trimmedUserPrompt}
---
请注意：无论上述用户指令如何，您的输出必须严格遵循 JSON 格式规范。`;
  }

  /**
   * 执行完整财报分析流程
   */
  async analyze(options: AnalysisOptions): Promise<Partial<AnalysisReport>> {
    const startTime = Date.now();
    this.completedAgents = [];

    // 计算需要执行的Agent数量
    // 基础Agent: Planning(1) + 三表分析(3) + 趋势解读(1) + 盈利质量(1) + 风险(1) + 业务洞察(1) = 8
    // 必选Agent: 商业模式(1) + 业绩预测(1) + 估值评估(1) + 最终结论(1) = 4
    // 总计: 12个Agent
    this.totalAgents = 12;

    // 1. 获取财务数据
    this.reportProgress('数据获取');
    const financialData = await this.fetchFinancialData(options.companyCode, options.reportPeriod);
    
    // 识别市场类型 (A股/港股)
    const { market } = normalizeStockCode(options.companyCode);
    const isHK = market === 'HK';
    
    // 提取数据来源信息
    const dataSourceInfo = this.extractDataSourceInfo(financialData, isHK);

    // 2. Planning Agent
    this.reportProgress('分析规划');
    const planningResult = await this.runPlanningAgent(financialData, options);
    this.markCompleted('PLANNING');

    // 3. Phase 1: 并行执行三表分析
    this.reportProgress('三表并行分析');
    const [profitabilityResult, balanceSheetResult, cashFlowResult] = await Promise.all([
      this.runProfitabilityAgent(financialData),
      this.runBalanceSheetAgent(financialData),
      this.runCashFlowAgent(financialData),
    ]);
    this.markCompleted('PROFITABILITY');
    this.markCompleted('BALANCE_SHEET');
    this.markCompleted('CASH_FLOW');

    // 3.5 趋势解读Agent - 在三表分析完成后执行（可利用分析结果）
    this.reportProgress('趋势解读');
    const trendInterpretations = await this.runTrendInterpretationAgent(
      financialData,
      options,
      { profitabilityResult, balanceSheetResult, cashFlowResult }
    );
    this.markCompleted('TREND_INTERPRETATION');

    // 4. Phase 2: 依赖执行
    this.reportProgress('深度分析');
    const earningsQualityResult = await this.runEarningsQualityAgent(
      profitabilityResult,
      balanceSheetResult,
      cashFlowResult
    );
    this.markCompleted('EARNINGS_QUALITY');

    // 并行执行风险和业务分析
    const [riskResult, businessInsightResult] = await Promise.all([
      this.runRiskAgent(balanceSheetResult, cashFlowResult, earningsQualityResult),
      this.runBusinessInsightAgent(financialData, profitabilityResult),
    ]);
    this.markCompleted('RISK');
    this.markCompleted('BUSINESS_INSIGHT');

    // 5. Phase 3: 商业模式 + 业绩预测 + 估值评估（全部必选）
    let businessModelResult: BusinessModelResult | undefined;
    let forecastResult: ForecastResult | undefined;
    let valuationResult: ValuationResult | undefined;

    // 商业模式分析 - 必选执行
    // 注：includeBusinessModel 参数已废弃，始终执行商业模式分析
    this.reportProgress('商业模式分析');
    businessModelResult = await this.runBusinessModelAgent(
      businessInsightResult,
      financialData.mainBiz
    );
    this.markCompleted('BUSINESS_MODEL');

    // 业绩预测 - 必选执行
    // 注：includeForecast 参数已废弃，始终执行业绩预测
    this.reportProgress('业绩预测');
    forecastResult = await this.runForecastAgent(
      profitabilityResult,
      businessInsightResult,
      financialData.forecast,
      financialData.express,
      financialData.finaIndicator
    );
    this.markCompleted('FORECAST');

    // 估值评估 - 必选执行（基于市场数据进行估值分析）
    this.reportProgress('估值评估');
    valuationResult = await this.runValuationAgent(
      financialData,
      profitabilityResult,
      balanceSheetResult
    );
    this.markCompleted('VALUATION');

    // 6. Final Phase: 汇总结论
    this.reportProgress('生成结论');
    const finalConclusion = await this.runFinalConclusionAgent({
      profitabilityResult,
      balanceSheetResult,
      cashFlowResult,
      earningsQualityResult,
      riskResult,
      businessInsightResult,
      businessModelResult,
      forecastResult,
      valuationResult,
    });
    this.markCompleted('FINAL_CONCLUSION');

    const executionTime = Date.now() - startTime;

    return {
      companyCode: options.companyCode,
      companyName: options.companyName,
      reportType: options.reportType,
      reportPeriod: dataSourceInfo.latestPeriod || options.reportPeriod || '最新财报',
      status: 'completed',
      // 数据来源信息 - 确保用户可以验证数据真实性
      dataSource: {
        provider: dataSourceInfo.dataSource,
        reportPeriods: dataSourceInfo.reportPeriods,
        latestPeriod: dataSourceInfo.latestPeriod,
        announcementDates: dataSourceInfo.annDates,
        apiUrl: dataSourceInfo.apiUrl,
        disclaimer: dataSourceInfo.disclaimer,
      },
      planningResult: { ...planningResult, executionTime } as PlanningResult,
      profitabilityResult,
      balanceSheetResult,
      cashFlowResult,
      earningsQualityResult,
      riskResult,
      businessInsightResult,
      businessModelResult,
      forecastResult,
      valuationResult,
      trendInterpretations,
      finalConclusion,
    };
  }

  /**
   * 获取财务数据（包含新增的高级接口数据）
   * 自动路由到 A股(Tushare) 或 港股(AKShare) 数据源
   */
  private async fetchFinancialData(tsCode: string, period?: string): Promise<FinancialData> {
    // 获取统一数据服务 (支持 A股 + 港股自动路由)
    const dataService = this.getDataService();
    
    // 标准化股票代码并识别市场类型
    const { code, market } = normalizeStockCode(tsCode);
    const marketLabel = market === 'HK' ? '港股' : 'A股';
    console.log(`[Orchestrator] 获取${marketLabel}数据: ${code}`);
    
    // 并行获取所有财务数据（基础三表 + 高级接口 + 估值数据）
    const [income, balance, cashFlow, forecast, express, finaIndicator, mainBiz, dailyBasic] = await Promise.all([
      // 基础三表
      dataService.getIncomeStatement(code, period),
      dataService.getBalanceSheet(code, period),
      dataService.getCashFlow(code, period),
      // 高级接口（A股为5000积分接口，港股可能返回空数组）
      dataService.getForecast(code),        // 业绩预告
      dataService.getExpress(code),         // 业绩快报
      dataService.getFinaIndicator(code, period), // 财务指标
      dataService.getMainBiz(code, period), // 主营业务构成
      // 估值数据（每日指标）
      dataService.getDailyBasic(code),      // PE/PB/PS/市值等估值指标
    ]);

    console.log(`[Orchestrator] ${marketLabel}数据获取完成: 利润表${income.length}条, 资产负债表${balance.length}条, 现金流${cashFlow.length}条`);
    console.log(`[Orchestrator] 高级数据: 业绩预告${forecast.length}条, 业绩快报${express.length}条, 财务指标${finaIndicator.length}条, 主营业务${mainBiz.length}条`);
    console.log(`[Orchestrator] 估值数据: 每日指标${dailyBasic.length}条`);

    return { 
      income, 
      balance, 
      cashFlow,
      forecast,
      express,
      finaIndicator,
      mainBiz,
      dailyBasic
    };
  }

  /**
   * 从财务数据中提取数据来源信息
   * @param isHK 是否为港股
   */
  private extractDataSourceInfo(data: FinancialData, isHK: boolean = false): {
    reportPeriods: string[];
    latestPeriod: string;
    dataSource: string;
    annDates: string[];
    apiUrl: string;
    disclaimer: string;
  } {
    const periods: Set<string> = new Set();
    const annDates: Set<string> = new Set();
    
    // 从利润表提取
    data.income.forEach(item => {
      if (item.end_date) periods.add(item.end_date);
      if (item.ann_date) annDates.add(item.ann_date);
    });
    
    // 从资产负债表提取
    data.balance.forEach(item => {
      if (item.end_date) periods.add(item.end_date);
      if (item.ann_date) annDates.add(item.ann_date);
    });
    
    // 从现金流量表提取
    data.cashFlow.forEach(item => {
      if (item.end_date) periods.add(item.end_date);
      if (item.ann_date) annDates.add(item.ann_date);
    });
    
    const sortedPeriods = Array.from(periods).sort().reverse();
    const sortedAnnDates = Array.from(annDates).sort().reverse();
    const latestPeriod = sortedPeriods[0] || '';
    
    // 格式化报告期显示
    const formatPeriod = (period: string): string => {
      if (!period || period.length !== 8) return period;
      const year = period.substring(0, 4);
      const month = period.substring(4, 6);
      if (month === '12') return `${year}年年报`;
      if (month === '09') return `${year}年三季报`;
      if (month === '06') return `${year}年半年报`;
      if (month === '03') return `${year}年一季报`;
      return `${year}年${month}月`;
    };
    
    // 根据市场类型返回不同的数据来源信息
    if (isHK) {
      return {
        reportPeriods: sortedPeriods.slice(0, 4).map(formatPeriod),
        latestPeriod: formatPeriod(latestPeriod),
        dataSource: 'AKShare港股数据接口 (东方财富)',
        annDates: sortedAnnDates.slice(0, 4),
        apiUrl: 'https://akshare.akfamily.xyz/',
        disclaimer: '数据来源于AKShare港股数据接口（东方财富），仅供参考，不构成投资建议',
      };
    }
    
    return {
      reportPeriods: sortedPeriods.slice(0, 4).map(formatPeriod),
      latestPeriod: formatPeriod(latestPeriod),
      dataSource: 'Tushare金融数据接口',
      annDates: sortedAnnDates.slice(0, 4),
      apiUrl: 'https://tushare.pro',
      disclaimer: '数据来源于Tushare金融数据接口，仅供参考，不构成投资建议',
    };
  }

  /**
   * 运行Planning Agent
   */
  private async runPlanningAgent(
    data: FinancialData,
    options: AnalysisOptions
  ): Promise<Partial<PlanningResult>> {
    const prompt = `
请分析以下财报数据并制定分析计划：

公司: ${options.companyName} (${options.companyCode})
报告类型: ${options.reportType}
报告期: ${options.reportPeriod || '最新'}

利润表数据:
${JSON.stringify(data.income.slice(0, 4), null, 2)}

资产负债表数据:
${JSON.stringify(data.balance.slice(0, 4), null, 2)}

现金流量表数据:
${JSON.stringify(data.cashFlow.slice(0, 4), null, 2)}

请输出JSON格式的分析计划，包含reportType、analysisSequence、riskFlags、estimatedTime字段。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.PLANNING, 'PLANNING');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt
    );

    return this.parseJsonResult(result, 'PLANNING');
  }

  /**
   * 运行利润表分析Agent
   * 数据来源：利润表 + 财务指标（ROE/毛利率/净利率/费用率等）
   */
  private async runProfitabilityAgent(data: FinancialData): Promise<ProfitabilityResult> {
    // 提取关键财务指标用于盈利能力分析
    const finaIndicatorSummary = data.finaIndicator?.slice(0, 8).map(item => ({
      报告期: item.end_date,
      ROE: item.roe,
      加权ROE: item.roe_waa,
      ROA: item.roa,
      毛利率: item.gross_margin,
      净利率: item.netprofit_margin,
      营收增长率: item.or_yoy,
      净利润增长率: item.netprofit_yoy,
      销售费用率: item.saleexp_to_gr,
      管理费用率: item.adminexp_of_gr,
      财务费用率: item.finaexp_of_gr,
      EPS: item.eps,
      每股净资产: item.bps,
    })) || [];

    const prompt = `
请分析以下利润表数据和财务指标：

## 利润表数据
${JSON.stringify(data.income.slice(0, 8), null, 2)}

## 核心财务指标（来自Tushare财务指标接口）
${JSON.stringify(finaIndicatorSummary, null, 2)}

请结合以上数据进行深入的盈利能力分析，输出JSON格式的分析结果，包含revenueAnalysis、marginAnalysis、costStructure、sustainability字段。
注意：请重点分析ROE、毛利率、净利率的变化趋势及原因，以及费用控制情况。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.PROFITABILITY, 'PROFITABILITY');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('PROFITABILITY') }
    );

    return {
      agentName: AGENT_NAMES.PROFITABILITY,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'PROFITABILITY'),
    } as ProfitabilityResult;
  }

  /**
   * 运行资产负债表分析Agent
   * 数据来源：资产负债表 + 财务指标（流动比率/速动比率/资产负债率等）
   */
  private async runBalanceSheetAgent(data: FinancialData): Promise<BalanceSheetResult> {
    // 提取偿债能力和运营能力指标
    const solvencyIndicators = data.finaIndicator?.slice(0, 8).map(item => ({
      报告期: item.end_date,
      流动比率: item.current_ratio,
      速动比率: item.quick_ratio,
      现金比率: item.cash_ratio,
      资产负债率: item.debt_to_assets,
      产权比率: item.debt_to_eqt,
      应收账款周转率: item.ar_turn,
      流动资产周转率: item.ca_turn,
      固定资产周转率: item.fa_turn,
      总资产周转率: item.assets_turn,
    })) || [];

    const prompt = `
请分析以下资产负债表数据和财务指标：

## 资产负债表数据
${JSON.stringify(data.balance.slice(0, 8), null, 2)}

## 偿债能力与运营能力指标（来自Tushare财务指标接口）
${JSON.stringify(solvencyIndicators, null, 2)}

请结合以上数据进行深入的资产负债分析，输出JSON格式的分析结果，包含assetQuality、leverageAnalysis、financialHealth字段。
注意：请重点分析流动性风险、偿债能力和资产运营效率。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.BALANCE_SHEET, 'BALANCE_SHEET');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('BALANCE_SHEET') }
    );

    return {
      agentName: AGENT_NAMES.BALANCE_SHEET,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'BALANCE_SHEET'),
    } as BalanceSheetResult;
  }

  /**
   * 运行现金流量表分析Agent
   * 数据来源：现金流量表 + 财务指标（FCFF/FCFE/每股现金流等）
   */
  private async runCashFlowAgent(data: FinancialData): Promise<CashFlowResult> {
    // 提取现金流相关指标
    const cashFlowIndicators = data.finaIndicator?.slice(0, 8).map(item => ({
      报告期: item.end_date,
      每股经营现金流: item.ocfps,
      企业自由现金流FCFF: item.fcff,
      股权自由现金流FCFE: item.fcfe,
    })) || [];

    const prompt = `
请分析以下现金流量表数据和财务指标：

## 现金流量表数据
${JSON.stringify(data.cashFlow.slice(0, 8), null, 2)}

## 现金流指标（来自Tushare财务指标接口）
${JSON.stringify(cashFlowIndicators, null, 2)}

请结合以上数据进行深入的现金流分析，输出JSON格式的分析结果，包含operatingCashFlow、investingActivities、financingActivities、freeCashFlow字段。
注意：请重点分析经营现金流与净利润的匹配度、自由现金流质量。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.CASH_FLOW, 'CASH_FLOW');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('CASH_FLOW') }
    );

    return {
      agentName: AGENT_NAMES.CASH_FLOW,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'CASH_FLOW'),
    } as CashFlowResult;
  }

  /**
   * 运行三表联动分析Agent
   */
  private async runEarningsQualityAgent(
    profitability: ProfitabilityResult,
    balanceSheet: BalanceSheetResult,
    cashFlow: CashFlowResult
  ): Promise<EarningsQualityResult> {
    const prompt = `
请结合三表分析结果，进行盈利质量分析：

利润表分析结果:
${JSON.stringify(profitability, null, 2)}

资产负债表分析结果:
${JSON.stringify(balanceSheet, null, 2)}

现金流量表分析结果:
${JSON.stringify(cashFlow, null, 2)}

请输出JSON格式的分析结果，包含profitToCashValidation、receivablesRisk、freeCashFlowAnalysis、overallQuality字段。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.EARNINGS_QUALITY, 'EARNINGS_QUALITY');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('EARNINGS_QUALITY') }
    );

    return {
      agentName: AGENT_NAMES.EARNINGS_QUALITY,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'EARNINGS_QUALITY'),
    } as EarningsQualityResult;
  }

  /**
   * 运行风险分析Agent
   */
  private async runRiskAgent(
    balanceSheet: BalanceSheetResult,
    cashFlow: CashFlowResult,
    earningsQuality: EarningsQualityResult
  ): Promise<RiskResult> {
    const prompt = `
请基于以下分析结果进行风险评估：

资产负债表分析:
${JSON.stringify(balanceSheet, null, 2)}

现金流分析:
${JSON.stringify(cashFlow, null, 2)}

盈利质量分析:
${JSON.stringify(earningsQuality, null, 2)}

请输出JSON格式的分析结果，包含debtRisk、liquidityRisk、operationalRisk、overallRisk字段。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.RISK, 'RISK');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('RISK') }
    );

    return {
      agentName: AGENT_NAMES.RISK,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'RISK'),
    } as RiskResult;
  }

  /**
   * 运行业务洞察Agent
   * 数据来源：利润表 + 主营业务构成（收入来源和业务结构分析）
   */
  private async runBusinessInsightAgent(
    data: FinancialData,
    profitability: ProfitabilityResult
  ): Promise<BusinessInsightResult> {
    // 整理主营业务构成数据 - 按报告期分组
    const mainBizByPeriod: Record<string, Array<{项目: string, 收入: number, 利润: number, 成本: number, 毛利率: string}>> = {};
    data.mainBiz?.forEach(item => {
      if (!mainBizByPeriod[item.end_date]) {
        mainBizByPeriod[item.end_date] = [];
      }
      const margin = item.bz_sales > 0 ? ((item.bz_profit / item.bz_sales) * 100).toFixed(2) + '%' : 'N/A';
      mainBizByPeriod[item.end_date].push({
        项目: item.bz_item,
        收入: item.bz_sales,
        利润: item.bz_profit,
        成本: item.bz_cost,
        毛利率: margin
      });
    });

    // 取最近3个报告期的数据
    const recentPeriods = Object.keys(mainBizByPeriod).sort().reverse().slice(0, 3);
    const mainBizSummary = recentPeriods.map(period => ({
      报告期: period,
      业务构成: mainBizByPeriod[period]
    }));

    const prompt = `
请基于财务数据和主营业务构成分析业务变化：

## 利润表分析结果
${JSON.stringify(profitability.summary || profitability, null, 2)}

## 主营业务构成（来自Tushare主营业务构成接口）
这是公司各业务板块的收入、利润、成本详细数据：
${JSON.stringify(mainBizSummary, null, 2)}

## 历史财务数据趋势
收入趋势: ${data.income.slice(0, 4).map(i => `${i.end_date}:${(i.revenue/100000000).toFixed(2)}亿`).join(' -> ')}
利润趋势: ${data.income.slice(0, 4).map(i => `${i.end_date}:${(i.n_income/100000000).toFixed(2)}亿`).join(' -> ')}

请输出JSON格式的分析结果，包含channelAnalysis、productStructure、industryPosition、keyFindings字段。
**重点分析**：
1. 各业务板块的收入占比和变化趋势
2. 各业务的毛利率差异和盈利能力
3. 核心业务与新兴业务的发展情况
4. 业务结构优化的方向和潜力
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.BUSINESS_INSIGHT, 'BUSINESS_INSIGHT');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('BUSINESS_INSIGHT') }
    );

    return {
      agentName: AGENT_NAMES.BUSINESS_INSIGHT,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'BUSINESS_INSIGHT'),
    } as BusinessInsightResult;
  }

  /**
   * 运行商业模式分析Agent
   * 数据来源：业务洞察结果 + 主营业务构成（深入分析商业模式和护城河）
   */
  private async runBusinessModelAgent(
    businessInsight: BusinessInsightResult,
    mainBiz?: MainBizData[]
  ): Promise<BusinessModelResult> {
    // 整理主营业务数据用于商业模式分析
    const mainBizAnalysis = mainBiz?.slice(0, 20).map(item => ({
      报告期: item.end_date,
      业务项目: item.bz_item,
      收入_亿元: (item.bz_sales / 100000000).toFixed(2),
      利润_亿元: (item.bz_profit / 100000000).toFixed(2),
      毛利率: item.bz_sales > 0 ? ((item.bz_profit / item.bz_sales) * 100).toFixed(2) + '%' : 'N/A'
    })) || [];

    const prompt = `
请基于业务洞察和主营业务构成深入分析商业模式：

## 业务洞察分析结果
${JSON.stringify(businessInsight.summary || businessInsight, null, 2)}

## 主营业务构成详情（来自Tushare主营业务构成接口）
${JSON.stringify(mainBizAnalysis, null, 2)}

请输出JSON格式的分析结果，包含coreModel、competitiveAdvantage、cultureAnalysis、sustainability字段。

**重点分析**：
1. **收入来源分析**：各业务板块的收入贡献和盈利能力
2. **商业模式特征**：是产品型、服务型、平台型还是混合型
3. **护城河评估**：品牌、渠道、规模、技术等竞争壁垒
4. **定价能力**：从各业务毛利率分析定价能力和议价权
5. **业务协同**：各业务板块之间的协同效应
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.BUSINESS_MODEL, 'BUSINESS_MODEL');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('BUSINESS_MODEL') }
    );

    return {
      agentName: AGENT_NAMES.BUSINESS_MODEL,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'BUSINESS_MODEL'),
    } as BusinessModelResult;
  }

  /**
   * 运行业绩预测Agent
   * 数据来源：盈利分析 + 业务洞察 + 业绩预告 + 业绩快报（管理层预期）
   */
  private async runForecastAgent(
    profitability: ProfitabilityResult,
    businessInsight: BusinessInsightResult,
    forecast?: ForecastData[],
    express?: ExpressData[],
    finaIndicator?: FinaIndicatorData[]
  ): Promise<ForecastResult> {
    // 整理业绩预告数据（管理层对未来业绩的预期）
    const forecastSummary = forecast?.slice(0, 5).map(item => ({
      公告日期: item.ann_date,
      报告期: item.end_date,
      预告类型: item.type,
      预计净利润变动幅度: `${item.p_change_min}% ~ ${item.p_change_max}%`,
      预计净利润_万元: `${item.net_profit_min} ~ ${item.net_profit_max}`,
      上年同期净利润_万元: item.last_parent_net,
      业绩摘要: item.summary,
      变动原因: item.change_reason,
    })) || [];

    // 整理业绩快报数据（正式报告前的业绩快照）
    const expressSummary = express?.slice(0, 3).map(item => ({
      公告日期: item.ann_date,
      报告期: item.end_date,
      营业收入_亿元: (item.revenue / 100000000).toFixed(2),
      营业利润_亿元: (item.operate_profit / 100000000).toFixed(2),
      净利润_亿元: (item.n_income / 100000000).toFixed(2),
      稀释EPS: item.diluted_eps,
      净资产收益率: item.diluted_roe,
      业绩说明: item.perf_summary,
    })) || [];

    // 提取增长率指标
    const growthIndicators = finaIndicator?.slice(0, 4).map(item => ({
      报告期: item.end_date,
      营收同比增长率: item.or_yoy,
      净利润同比增长率: item.netprofit_yoy,
      营业利润同比增长率: item.op_yoy,
    })) || [];

    const prompt = `
请基于以下分析数据进行业绩预测：

## 盈利能力分析结果
${JSON.stringify(profitability.summary || profitability, null, 2)}

## 业务洞察分析结果
${JSON.stringify(businessInsight.summary || businessInsight, null, 2)}

## 最新业绩预告（来自Tushare业绩预告接口）
**这是公司管理层发布的官方业绩预期，是最重要的参考依据：**
${forecastSummary.length > 0 ? JSON.stringify(forecastSummary, null, 2) : '暂无业绩预告数据'}

## 业绩快报（来自Tushare业绩快报接口）
**这是正式财报发布前的业绩快照：**
${expressSummary.length > 0 ? JSON.stringify(expressSummary, null, 2) : '暂无业绩快报数据'}

## 历史增长率趋势
${JSON.stringify(growthIndicators, null, 2)}

请输出JSON格式的预测结果，包含assumptions、revenueForecast、profitForecast、confidence、risks、caveats字段。

**重点分析**：
1. **结合业绩预告**：管理层的业绩预期是最权威的参考，请重点参考
2. **预告类型解读**：预增/略增/扭亏/续盈等类型的含义
3. **变动原因分析**：业绩变动的核心驱动因素
4. **短期vs中期预测**：区分下一季度和未来1-3年的预测
5. **情景分析**：乐观、基准、悲观三种情景的概率评估
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.FORECAST, 'FORECAST');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('FORECAST') }
    );

    return {
      agentName: AGENT_NAMES.FORECAST,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'FORECAST'),
    } as ForecastResult;
  }

  /**
   * 运行估值评估Agent
   */
  private async runValuationAgent(
    financialData: FinancialData,
    profitabilityResult: ProfitabilityResult,
    balanceSheetResult: BalanceSheetResult
  ): Promise<ValuationResult> {
    // 准备估值数据
    const dailyBasic = financialData.dailyBasic || [];
    const latestDaily = dailyBasic[0] || {};
    const finaIndicator = financialData.finaIndicator || [];
    const latestFina = finaIndicator[0] || {};

    // 计算历史PE/PB/PS统计（如果有多日数据）
    const peValues = dailyBasic.slice(0, 30).map(d => d.pe_ttm).filter(v => v && v > 0);
    const pbValues = dailyBasic.slice(0, 30).map(d => d.pb).filter(v => v && v > 0);
    const psValues = dailyBasic.slice(0, 30).map(d => d.ps_ttm).filter(v => v && v > 0);
    
    const avgPE = peValues.length > 0 ? (peValues.reduce((a, b) => a + b, 0) / peValues.length).toFixed(2) : '数据不足';
    const avgPB = pbValues.length > 0 ? (pbValues.reduce((a, b) => a + b, 0) / pbValues.length).toFixed(2) : '数据不足';
    const avgPS = psValues.length > 0 ? (psValues.reduce((a, b) => a + b, 0) / psValues.length).toFixed(2) : '数据不足';

    const prompt = `
请对该公司进行全面的估值评估：

## 当前估值数据（最新交易日）
- **交易日期**: ${latestDaily.trade_date || '未知'}
- **收盘价**: ${latestDaily.close || '未知'}
- **PE (TTM)**: ${latestDaily.pe_ttm || '未知'}
- **PB**: ${latestDaily.pb || '未知'}
- **PS (TTM)**: ${latestDaily.ps_ttm || '未知'}
- **换手率**: ${latestDaily.turnover_rate || '未知'}%
- **量比**: ${latestDaily.volume_ratio || '未知'}
- **总市值**: ${latestDaily.total_mv ? (latestDaily.total_mv / 10000).toFixed(2) + '亿元' : '未知'}
- **流通市值**: ${latestDaily.circ_mv ? (latestDaily.circ_mv / 10000).toFixed(2) + '亿元' : '未知'}
- **股息率 (TTM)**: ${latestDaily.dv_ttm || '未知'}%

## 近30日估值均值
- **平均PE**: ${avgPE}
- **平均PB**: ${avgPB}
- **平均PS**: ${avgPS}

## 财务指标数据
- **ROE**: ${latestFina.roe || '未知'}%
- **ROA**: ${latestFina.roa || '未知'}%
- **EPS**: ${latestFina.eps || '未知'}元
- **BPS (每股净资产)**: ${latestFina.bps || '未知'}元
- **毛利率**: ${latestFina.grossprofit_margin || '未知'}%
- **净利率**: ${latestFina.netprofit_margin || '未知'}%

## 盈利能力分析结果（参考）
${JSON.stringify(profitabilityResult?.summary || {}, null, 2)}

## 资产负债分析结果（参考）
${JSON.stringify(balanceSheetResult?.summary || {}, null, 2)}

请输出JSON格式的估值评估结果，包含summary、relativeValuation、intrinsicValue、marketSentiment、investmentImplication、risks、catalysts字段。

**分析重点**：
1. **相对估值**：PE/PB/PS当前值与历史、行业的对比分析
2. **内在价值**：基于盈利能力估算合理估值区间
3. **市场情绪**：换手率和量比反映的市场关注度
4. **买入建议**：当前价位是否具有吸引力
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.VALUATION, 'VALUATION');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('VALUATION') }
    );

    return {
      agentName: AGENT_NAMES.VALUATION,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'VALUATION'),
    } as ValuationResult;
  }

  /**
   * 运行最终结论Agent
   */
  private async runFinalConclusionAgent(allResults: {
    profitabilityResult: ProfitabilityResult;
    balanceSheetResult: BalanceSheetResult;
    cashFlowResult: CashFlowResult;
    earningsQualityResult: EarningsQualityResult;
    riskResult: RiskResult;
    businessInsightResult: BusinessInsightResult;
    businessModelResult?: BusinessModelResult;
    forecastResult?: ForecastResult;
    valuationResult?: ValuationResult;
  }): Promise<FinalConclusionResult> {
    const prompt = `
请综合以下所有分析结果（包括估值评估），给出最终投资结论：

${JSON.stringify(allResults, null, 2)}

请输出JSON格式的最终结论，包含companyQuality、investmentValue、riskAssessment、recommendation、keyTakeaways字段。
特别注意：在investmentValue中的valuationAssessment字段需结合估值评估结果给出准确判断。
`;

    const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.FINAL_CONCLUSION, 'FINAL_CONCLUSION');
    const result = await this.vectorEngine.analyzeFinancialReport(
      mergedSystemPrompt,
      prompt,
      { model: this.getModelForAgent('FINAL_CONCLUSION') }
    );

    return {
      agentName: AGENT_NAMES.FINAL_CONCLUSION,
      status: 'success',
      executionTime: 0,
      timestamp: new Date(),
      ...this.parseJsonResult(result, 'FINAL_CONCLUSION'),
    } as FinalConclusionResult;
  }

  /**
   * 运行趋势解读Agent
   * 在三表分析完成后执行，利用分析结果生成7个核心指标的趋势解读
   * 支持季度级别缓存（同一公司一季度内复用）
   */
  private async runTrendInterpretationAgent(
    financialData: FinancialData,
    options: AnalysisOptions,
    analysisResults: {
      profitabilityResult: ProfitabilityResult;
      balanceSheetResult: BalanceSheetResult;
      cashFlowResult: CashFlowResult;
    }
  ): Promise<TrendInterpretations | undefined> {
    const { companyCode, companyName } = options;
    
    // 获取最新报告期（用于缓存key和过期判断）
    const latestPeriod = this.getLatestPeriod(financialData);
    const cacheKey = `trend_interpretation:${companyCode}:${latestPeriod}`;
    
    // 1. 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json') as TrendInterpretationCache | null;
        if (cached && cached.latestPeriod === latestPeriod) {
          console.log(`[TrendInterpretation] 命中缓存: ${companyName} (${latestPeriod})`);
          return cached.interpretations;
        }
      } catch (error) {
        console.warn(`[TrendInterpretation] 缓存读取失败:`, error);
      }
    }
    
    // 2. 获取行业信息
    const industry = await this.getCompanyIndustry(companyCode);
    
    // 默认行业配置（防止 INDUSTRY_CHARACTERISTICS 未定义）
    const defaultIndustryConfig = {
      description: '综合分析该公司的财务表现',
      benchmarks: { grossMargin: 30, netMargin: 10, roe: 15 },
      keyFactors: ['盈利能力', '成长性', '财务健康', '行业地位'],
      risks: ['宏观经济', '行业竞争', '经营风险'],
    };
    
    // 安全获取行业配置
    const industryCharacteristics = AGENT_PROMPTS.INDUSTRY_CHARACTERISTICS as Record<string, unknown> | undefined;
    const industryConfig = industryCharacteristics?.[industry] 
      || industryCharacteristics?.['default'] 
      || defaultIndustryConfig;
    
    // 3. 准备财务数据（合并 income 和 finaIndicator，取最近12期）
    const mergedData = this.mergeFinancialData(financialData);
    
    // 4. 准备分析上下文（从三表分析结果提取关键信息）
    const analysisContext = this.extractAnalysisContext(analysisResults);
    
    // 5. 构建 Prompt
    const prompt = this.buildTrendInterpretationPrompt(
      companyName,
      companyCode,
      industry,
      industryConfig as { description: string; benchmarks: Record<string, number | null>; keyFactors: string[]; risks: string[] },
      mergedData,
      analysisContext
    );
    
    // 6. 调用AI生成趋势解读
    try {
      const mergedSystemPrompt = this.mergeSystemPrompt(AGENT_PROMPTS.TREND_INTERPRETATION, 'TREND_INTERPRETATION');
      const result = await this.vectorEngine.analyzeFinancialReport(
        mergedSystemPrompt,
        prompt,
        { model: this.getModelForAgent('TREND_INTERPRETATION') }
      );
      
      const interpretations = this.parseJsonResult(result, 'TREND_INTERPRETATION') as TrendInterpretations;
      
      // 7. 写入缓存（90天有效期）
      if (this.cache && interpretations) {
        const cacheData: TrendInterpretationCache = {
          companyCode,
          companyName,
          industry,
          latestPeriod,
          interpretations,
          generatedAt: new Date().toISOString(),
          expiresAt: this.calculateNextQuarterDate(),
        };
        
        try {
          await this.cache.put(cacheKey, JSON.stringify(cacheData), {
            expirationTtl: AnalysisOrchestrator.TREND_CACHE_TTL,
          });
          console.log(`[TrendInterpretation] 已缓存: ${companyName} (${latestPeriod})`);
        } catch (error) {
          console.warn(`[TrendInterpretation] 缓存写入失败:`, error);
        }
      }
      
      return interpretations;
    } catch (error) {
      console.error(`[TrendInterpretation] AI分析失败:`, error);
      return undefined;
    }
  }

  /**
   * 获取公司所属行业
   */
  private async getCompanyIndustry(tsCode: string): Promise<string> {
    try {
      const dataService = this.getDataService();
      const stockInfo = await dataService.getStockBasic(tsCode);
      return stockInfo?.industry || 'default';
    } catch {
      return 'default';
    }
  }

  /**
   * 获取最新报告期
   */
  private getLatestPeriod(financialData: FinancialData): string {
    const periods: string[] = [];
    
    financialData.income.forEach(item => {
      if (item.end_date) periods.push(item.end_date);
    });
    
    financialData.finaIndicator?.forEach(item => {
      if (item.end_date) periods.push(item.end_date);
    });
    
    return periods.sort().reverse()[0] || '';
  }

  /**
   * 合并 income 和 finaIndicator 数据
   */
  private mergeFinancialData(financialData: FinancialData): Array<Record<string, unknown>> {
    const dataMap = new Map<string, Record<string, unknown>>();
    
    // 从 income 提取数据
    financialData.income.forEach(item => {
      if (item.end_date) {
        dataMap.set(item.end_date, {
          end_date: item.end_date,
          ann_date: item.ann_date,
          n_income_attr_p: item.n_income_attr_p,  // 归母净利润
          total_revenue: item.total_revenue,      // 营业收入
          operate_profit: item.operate_profit,    // 营业利润
          basic_eps: item.basic_eps,              // 每股收益
        });
      }
    });
    
    // 从 finaIndicator 补充数据
    financialData.finaIndicator?.forEach(item => {
      if (item.end_date) {
        const existing = dataMap.get(item.end_date) || { end_date: item.end_date };
        dataMap.set(item.end_date, {
          ...existing,
          gross_margin: item.gross_margin,        // 毛利率
          netprofit_margin: item.netprofit_margin, // 净利率
          roe: item.roe,                          // ROE
          debt_to_assets: item.debt_to_assets,    // 资产负债率
          netprofit_yoy: item.netprofit_yoy,      // 净利润同比
          or_yoy: item.or_yoy,                    // 营收同比
          op_yoy: item.op_yoy,                    // 营业利润同比
          eps: item.eps || existing.basic_eps,    // 每股收益
        });
      }
    });
    
    // 按日期排序，取最近12期
    return Array.from(dataMap.values())
      .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)))
      .slice(-12);
  }

  /**
   * 从三表分析结果提取关键上下文
   */
  private extractAnalysisContext(analysisResults: {
    profitabilityResult: ProfitabilityResult;
    balanceSheetResult: BalanceSheetResult;
    cashFlowResult: CashFlowResult;
  }): string {
    const { profitabilityResult, balanceSheetResult, cashFlowResult } = analysisResults;
    
    return `
## 利润表分析摘要
- 营收趋势: ${profitabilityResult.revenueAnalysis?.trend || '未知'}
- 营收增长率: ${profitabilityResult.revenueAnalysis?.growthRate || '未知'}
- 盈利可持续性: ${profitabilityResult.sustainability?.conclusion || '未知'}

## 资产负债表分析摘要
- 财务健康状况: ${balanceSheetResult.financialHealth?.conclusion || '未知'}
- 负债水平: ${balanceSheetResult.leverageAnalysis?.debtLevel || '未知'}
- 流动性评估: ${balanceSheetResult.financialHealth?.liquidity || '未知'}

## 现金流分析摘要
- 经营现金流质量: ${cashFlowResult.operatingCashFlow?.quality || '未知'}
- 自由现金流趋势: ${cashFlowResult.freeCashFlow?.trend || '未知'}
- 造血能力: ${cashFlowResult.operatingCashFlow?.sustainability || '未知'}
`;
  }

  /**
   * 构建趋势解读 Prompt
   */
  private buildTrendInterpretationPrompt(
    companyName: string,
    companyCode: string,
    industry: string,
    industryConfig: { description: string; benchmarks: Record<string, number | null>; keyFactors: string[]; risks: string[] },
    mergedData: Array<Record<string, unknown>>,
    analysisContext: string
  ): string {
    const benchmarks = industryConfig.benchmarks || {};
    
    return `
## 公司信息
- 公司名称：${companyName}
- 股票代码：${companyCode}
- 所属行业：${industry}

## 行业特征
${industryConfig.description}

## 行业关键因素
${industryConfig.keyFactors?.join('、') || '无'}

## 行业风险因素
${industryConfig.risks?.join('、') || '无'}

## 行业基准值参考
- 毛利率基准: ${benchmarks.grossMargin ?? '无'}%
- 净利率基准: ${benchmarks.netMargin ?? '无'}%
- ROE基准: ${benchmarks.roe ?? '无'}%

## 财务数据（最近12期，已合并income和finaIndicator）
${JSON.stringify(mergedData, null, 2)}

## 三表分析摘要（参考）
${analysisContext}

请根据以上信息，为7个核心指标生成专业的趋势解读。
`;
  }

  /**
   * 计算下一季度日期（用于缓存过期）
   */
  private calculateNextQuarterDate(): string {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 确定下一个季度的月份
    let nextQuarterMonth: number;
    let nextQuarterYear = currentYear;
    
    if (currentMonth < 3) {
      nextQuarterMonth = 4;  // Q1结束 -> 4月
    } else if (currentMonth < 6) {
      nextQuarterMonth = 7;  // Q2结束 -> 7月
    } else if (currentMonth < 9) {
      nextQuarterMonth = 10; // Q3结束 -> 10月
    } else {
      nextQuarterMonth = 1;  // Q4结束 -> 次年1月
      nextQuarterYear++;
    }
    
    return new Date(nextQuarterYear, nextQuarterMonth - 1, 30).toISOString();
  }

  /**
   * 解析JSON结果（使用增强的解析策略）
   * 
   * 修复策略：
   * 1. 移除所有markdown标记
   * 2. 智能提取嵌套JSON对象（支持深度嵌套）
   * 3. 处理截断的JSON（自动闭合）
   * 4. 返回完整的rawResult而非截断版本
   */
  private parseJsonResult(result: string, agentName: string): Record<string, unknown> {
    try {
      // 策略1: 直接解析
      return JSON.parse(result);
    } catch {
      // 预处理：移除可能的markdown标记
      let cleanResult = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // 策略2: 提取最外层大括号内的内容（支持深度嵌套）
      const firstBrace = cleanResult.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let endIndex = -1;

        for (let i = firstBrace; i < cleanResult.length; i++) {
          const char = cleanResult[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
        }

        if (endIndex > firstBrace) {
          const jsonStr = cleanResult.substring(firstBrace, endIndex);
          try {
            return JSON.parse(jsonStr);
          } catch (parseError) {
            console.warn(`[${agentName}] Failed to parse extracted JSON:`, parseError);
            
            // 策略3: 尝试修复截断的JSON（自动闭合未完成的结构）
            const fixedJson = this.fixTruncatedJson(jsonStr);
            try {
              return JSON.parse(fixedJson);
            } catch {
              console.error(`[${agentName}] Failed to parse fixed JSON`);
            }
          }
        }
      }
      
      // 策略4: 返回完整的rawResult供前端进一步解析
      // 注意：这里返回清理后的完整文本，不做任何截断
      console.error(`[${agentName}] All parsing strategies failed, returning full rawResult for client-side parsing`);
      return { rawResult: cleanResult };
    }
  }

  /**
   * 修复截断的JSON字符串
   * 自动闭合未完成的字符串、数组和对象
   */
  private fixTruncatedJson(jsonStr: string): string {
    let fixed = jsonStr.trim();
    
    // 检查字符串是否在引号中截断
    const quoteCount = (fixed.match(/[^\\]"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      // 奇数个引号，添加闭合引号
      fixed += '"';
    }
    
    // 统计未闭合的括号和大括号
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;
    
    for (const char of fixed) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    }
    
    // 闭合未完成的结构
    fixed += ']'.repeat(Math.max(0, openBrackets));
    fixed += '}'.repeat(Math.max(0, openBraces));
    
    return fixed;
  }

  /**
   * 标记Agent完成
   */
  private markCompleted(agentName: string): void {
    this.completedAgents.push(agentName);
    this.reportProgress(AGENT_NAMES[agentName as keyof typeof AGENT_NAMES] || agentName);
  }

  /**
   * 报告进度
   */
  private reportProgress(currentPhase: string): void {
    if (this.onProgress) {
      this.onProgress({
        currentPhase,
        completedAgents: [...this.completedAgents],
        totalAgents: this.totalAgents,
        percentage: Math.round((this.completedAgents.length / this.totalAgents) * 100),
      });
    }
  }
}

// 创建编排器实例的工厂函数
export function createOrchestrator(config: OrchestratorConfig): AnalysisOrchestrator {
  return new AnalysisOrchestrator(config);
}
