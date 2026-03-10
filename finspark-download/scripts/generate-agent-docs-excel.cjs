// 生成 Agent 文档 Excel 文件
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Agent 配置数据
const agentData = [
  // ========== 分析 Agents ==========
  {
    category: '分析Agent',
    agentName: '分析规划 (PLANNING)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业财务报告分析规划专家。根据提供的财报数据，进行分析规划：
1. 识别报告类型和周期
2. 评估数据质量和完整性
3. 标注关键亮点和风险点
4. 规划后续分析的重点方向

请以JSON格式输出，包含以下字段：
- reportType: 报告类型
- period: 报告周期
- dataQuality: 数据质量评估
- highlights: 关键亮点数组
- risks: 风险点数组
- analysisSequence: 建议的分析顺序`,
    dataSource: '利润表(前4条) + 资产负债表(前4条) + 现金流量表(前4条)',
    tushareApi: 'income, balancesheet, cashflow',
    userPromptTemplate: `请分析以下财报数据并制定分析计划：

公司: {companyName} ({companyCode})
报告类型: {reportType}
报告期: {reportPeriod}

利润表数据:
{incomeData}

资产负债表数据:
{balanceData}

现金流量表数据:
{cashFlowData}

请输出JSON格式的分析计划，包含reportType、analysisSequence、riskFlags、estimatedTime字段。`,
    sampleInputData: `利润表数据示例:
[
  {
    "ts_code": "600519.SH",
    "ann_date": "20251030",
    "end_date": "20250930",
    "total_revenue": 136286000000,
    "revenue": 133619000000,
    "n_income": 60930000000,
    "basic_eps": 48.49
  }
]

资产负债表数据示例:
[
  {
    "ts_code": "600519.SH",
    "end_date": "20250930",
    "total_assets": 304738000000,
    "total_liab": 39033000000,
    "money_cap": 51753000000
  }
]

现金流量表数据示例:
[
  {
    "ts_code": "600519.SH",
    "end_date": "20250930",
    "n_cashflow_act": 52890000000,
    "free_cashflow": 48500000000
  }
]`
  },
  {
    category: '分析Agent',
    agentName: '利润表分析 (PROFITABILITY)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业利润表深度分析专家。请基于提供的利润表数据进行专业分析：
1. 营业收入分析：规模、增速、结构
2. 毛利率分析：水平、趋势、与行业对比
3. 费用率分析：销售/管理/研发/财务费用占比
4. 净利率分析：盈利质量和可持续性

请以JSON格式输出，包含：
- summary: 一句话总结
- detailedAnalysis: 详细分析对象
- keyMetrics: 关键指标数组
- trends: 趋势分析
- concerns: 值得关注的问题`,
    dataSource: '利润表(前8条) + 财务指标-盈利能力指标(前8条)',
    tushareApi: 'income, fina_indicator',
    userPromptTemplate: `请分析以下利润表数据和财务指标：

## 利润表数据
{incomeData}

## 核心财务指标（来自Tushare财务指标接口）
{finaIndicatorSummary}

请结合以上数据进行深入的盈利能力分析，输出JSON格式的分析结果，包含revenueAnalysis、marginAnalysis、costStructure、sustainability字段。
注意：请重点分析ROE、毛利率、净利率的变化趋势及原因，以及费用控制情况。`,
    sampleInputData: `财务指标数据示例:
[
  {
    "报告期": "20250930",
    "ROE": 26.37,
    "加权ROE": 27.15,
    "ROA": 22.39,
    "毛利率": 91.54,
    "净利率": 52.08,
    "营收增长率": 6.36,
    "净利润增长率": 6.25,
    "销售费用率": 2.89,
    "管理费用率": 7.12,
    "财务费用率": -1.85,
    "EPS": 51.53,
    "每股净资产": 195.53
  }
]`
  },
  {
    category: '分析Agent',
    agentName: '资产负债表分析 (BALANCE_SHEET)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业资产负债表深度分析专家。请基于提供的资产负债表数据进行分析：
1. 资产结构分析：流动资产vs非流动资产配置
2. 负债结构分析：负债率、短期vs长期债务
3. 流动性分析：流动比率、速动比率
4. 财务健康度评估

请以JSON格式输出，包含：
- summary: 一句话总结
- detailedAnalysis: 详细分析对象
- keyMetrics: 关键指标数组
- financialHealth: 财务健康评分(1-10)
- concerns: 值得关注的问题`,
    dataSource: '资产负债表(前8条) + 财务指标-偿债能力/运营能力指标(前8条)',
    tushareApi: 'balancesheet, fina_indicator',
    userPromptTemplate: `请分析以下资产负债表数据和财务指标：

## 资产负债表数据
{balanceData}

## 偿债能力与运营能力指标（来自Tushare财务指标接口）
{solvencyIndicators}

请结合以上数据进行深入的资产负债分析，输出JSON格式的分析结果，包含assetQuality、leverageAnalysis、financialHealth字段。
注意：请重点分析流动性风险、偿债能力和资产运营效率。`,
    sampleInputData: `偿债能力指标数据示例:
[
  {
    "报告期": "20250930",
    "流动比率": 6.62,
    "速动比率": 5.18,
    "现金比率": 1.47,
    "资产负债率": 12.81,
    "产权比率": 14.69,
    "应收账款周转率": 5772.43,
    "流动资产周转率": 0.5151,
    "固定资产周转率": 6.0826,
    "总资产周转率": 0.4337
  }
]`
  },
  {
    category: '分析Agent',
    agentName: '现金流量表分析 (CASH_FLOW)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业现金流量表深度分析专家。请基于提供的现金流量表数据进行分析：
1. 经营活动现金流：造血能力、与利润匹配度
2. 投资活动现金流：扩张/收缩信号、投资效率
3. 筹资活动现金流：融资结构、分红能力
4. 自由现金流分析

请以JSON格式输出，包含：
- summary: 一句话总结
- detailedAnalysis: 详细分析对象
- keyMetrics: 关键指标数组
- cashQuality: 现金流质量评分(1-10)
- concerns: 值得关注的问题`,
    dataSource: '现金流量表(前8条) + 财务指标-现金流指标(前8条)',
    tushareApi: 'cashflow, fina_indicator',
    userPromptTemplate: `请分析以下现金流量表数据和财务指标：

## 现金流量表数据
{cashFlowData}

## 现金流指标（来自Tushare财务指标接口）
{cashFlowIndicators}

请结合以上数据进行深入的现金流分析，输出JSON格式的分析结果，包含operatingCashFlow、investingActivities、financingActivities、freeCashFlow字段。
注意：请重点分析经营现金流与净利润的匹配度、自由现金流质量。`,
    sampleInputData: `现金流指标数据示例:
[
  {
    "报告期": "20250930",
    "每股经营现金流": 42.15,
    "企业自由现金流FCFF": 48500000000,
    "股权自由现金流FCFE": 46200000000
  }
]`
  },
  {
    category: '分析Agent',
    agentName: '盈利质量分析 (EARNINGS_QUALITY)',
    model: 'gpt-4.1',
    systemPrompt: `你是财务三表联动分析专家。请通过利润表、资产负债表和现金流量表的联动分析评估盈利质量：
1. 利润-现金流匹配度：净利润与经营现金流对比
2. 应收账款风险：应收账款周转率、账龄结构
3. 存货风险：存货周转率、跌价风险
4. 财务操纵风险识别

请以JSON格式输出，包含：
- summary: 一句话总结
- qualityScore: 盈利质量评分(1-10)
- profitCashMatch: 利润现金匹配分析
- receivableRisk: 应收账款风险
- inventoryRisk: 存货风险
- manipulationRisk: 操纵风险评估
- concerns: 值得关注的问题`,
    dataSource: '利润表分析结果 + 资产负债表分析结果 + 现金流分析结果',
    tushareApi: '(无直接调用，使用前置Agent结果)',
    userPromptTemplate: `请结合三表分析结果，进行盈利质量分析：

利润表分析结果:
{profitabilityResult}

资产负债表分析结果:
{balanceSheetResult}

现金流量表分析结果:
{cashFlowResult}

请输出JSON格式的分析结果，包含profitToCashValidation、receivablesRisk、freeCashFlowAnalysis、overallQuality字段。`,
    sampleInputData: `输入为前三个Agent的分析结果JSON，包含各自的summary和detailedAnalysis字段`
  },
  {
    category: '分析Agent',
    agentName: '风险评估 (RISK)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业风险评估专家。请进行多维度风险分析：
1. 债务风险：偿债能力、债务结构
2. 流动性风险：短期支付能力
3. 经营风险：业务集中度、客户依赖
4. 市场风险：行业周期、竞争格局

请以JSON格式输出，包含：
- summary: 一句话总结
- overallRiskLevel: 整体风险等级(低/中/高)
- debtRisk: 债务风险详情
- liquidityRisk: 流动性风险详情
- operationalRisk: 经营风险详情
- marketRisk: 市场风险详情
- recommendations: 风险应对建议`,
    dataSource: '资产负债表分析结果 + 现金流分析结果 + 盈利质量分析结果',
    tushareApi: '(无直接调用，使用前置Agent结果)',
    userPromptTemplate: `请基于以下分析结果进行风险评估：

资产负债表分析:
{balanceSheetResult}

现金流分析:
{cashFlowResult}

盈利质量分析:
{earningsQualityResult}

请输出JSON格式的分析结果，包含debtRisk、liquidityRisk、operationalRisk、overallRisk字段。`,
    sampleInputData: `输入为前置Agent的分析结果JSON`
  },
  {
    category: '分析Agent',
    agentName: '业务洞察 (BUSINESS_INSIGHT)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业业务洞察分析专家。请基于业务数据分析企业特征：
1. 核心业务识别：主营业务构成、收入占比
2. 业务趋势：各业务板块增速对比
3. 竞争优势：市场地位、品牌价值
4. 发展潜力：新业务布局、增长驱动力

请以JSON格式输出，包含：
- summary: 一句话总结
- businessTrend: 业务趋势
- industryPosition: 行业地位
- competitiveAdvantage: 竞争优势
- growthDriver: 增长驱动力
- coreBusinessContribution: 核心业务贡献
- byProduct: 按产品划分的收入
- byChannel: 按渠道划分的收入`,
    dataSource: '利润表分析结果 + 主营业务构成数据(fina_mainbz)',
    tushareApi: 'fina_mainbz',
    userPromptTemplate: `请基于财务数据和主营业务构成分析业务变化：

## 利润表分析结果
{profitabilitySummary}

## 主营业务构成（来自Tushare主营业务构成接口）
这是公司各业务板块的收入、利润、成本详细数据：
{mainBizSummary}

## 历史财务数据趋势
收入趋势: {revenueTrend}
利润趋势: {profitTrend}

请输出JSON格式的分析结果，包含channelAnalysis、productStructure、industryPosition、keyFindings字段。
**重点分析**：
1. 各业务板块的收入占比和变化趋势
2. 各业务的毛利率差异和盈利能力
3. 核心业务与新兴业务的发展情况
4. 业务结构优化的方向和潜力`,
    sampleInputData: `主营业务构成数据示例:
[
  {
    "报告期": "20250630",
    "业务构成": [
      {"项目": "茅台酒", "收入": 75590000000, "利润": 68500000000, "成本": 7090000000, "毛利率": "90.62%"},
      {"项目": "系列酒", "收入": 13763000000, "利润": 7200000000, "成本": 6563000000, "毛利率": "52.32%"},
      {"项目": "其他", "收入": 1741000000, "利润": 500000000, "成本": 1241000000, "毛利率": "28.72%"}
    ]
  }
]

收入趋势: 20250930:1336.19亿 -> 20250630:910.94亿 -> 20250331:480.29亿
利润趋势: 20250930:609.30亿 -> 20250630:418.09亿 -> 20250331:225.64亿`
  },
  {
    category: '分析Agent',
    agentName: '商业模式分析 (BUSINESS_MODEL)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业商业模式分析专家。请深度分析企业的商业模式和护城河：
1. 核心商业模式：收入来源、价值创造方式
2. 护城河分析：
   - 品牌价值
   - 客户转换成本
   - 网络效应
   - 成本优势
   - 无形资产
3. 企业文化评估

请以JSON格式输出，包含：
- coreModel: 核心商业模式描述
- competitiveAdvantage: 竞争优势详情
- moatAnalysis: 护城河五维度分析
- cultureAnalysis: 企业文化评估
- sustainability: 商业模式可持续性评分`,
    dataSource: '业务洞察分析结果 + 主营业务构成数据(fina_mainbz)',
    tushareApi: 'fina_mainbz',
    userPromptTemplate: `请基于业务洞察和主营业务构成深入分析商业模式：

## 业务洞察分析结果
{businessInsightSummary}

## 主营业务构成详情（来自Tushare主营业务构成接口）
{mainBizAnalysis}

请输出JSON格式的分析结果，包含coreModel、competitiveAdvantage、cultureAnalysis、sustainability字段。

**重点分析**：
1. **收入来源分析**：各业务板块的收入贡献和盈利能力
2. **商业模式特征**：是产品型、服务型、平台型还是混合型
3. **护城河评估**：品牌、渠道、规模、技术等竞争壁垒
4. **定价能力**：从各业务毛利率分析定价能力和议价权
5. **业务协同**：各业务板块之间的协同效应`,
    sampleInputData: `主营业务分析数据示例:
[
  {"报告期": "20250630", "业务项目": "茅台酒", "收入_亿元": "755.90", "利润_亿元": "685.00", "毛利率": "90.62%"},
  {"报告期": "20250630", "业务项目": "系列酒", "收入_亿元": "137.63", "利润_亿元": "72.00", "毛利率": "52.32%"},
  {"报告期": "20250630", "业务项目": "其他", "收入_亿元": "17.41", "利润_亿元": "5.00", "毛利率": "28.72%"}
]`
  },
  {
    category: '分析Agent',
    agentName: '业绩预测 (FORECAST)',
    model: 'gpt-4.1',
    systemPrompt: `你是企业业绩预测专家。请基于历史数据和业绩预告进行预测分析：
1. 官方业绩预告解读
2. 历史趋势外推
3. 行业景气度影响
4. 风险因素评估

请以JSON格式输出，包含：
- outlook: 业绩展望(乐观/中性/谨慎)
- revenueGrowthForecast: 收入增速预测
- profitGrowthForecast: 利润增速预测
- keyAssumptions: 关键假设
- riskFactors: 风险因素
- confidence: 预测置信度`,
    dataSource: '盈利分析结果 + 业务洞察结果 + 业绩预告(forecast) + 业绩快报(express) + 财务指标增长率',
    tushareApi: 'forecast, express, fina_indicator',
    userPromptTemplate: `请基于以下分析数据进行业绩预测：

## 盈利能力分析结果
{profitabilitySummary}

## 业务洞察分析结果
{businessInsightSummary}

## 最新业绩预告（来自Tushare业绩预告接口）
**这是公司管理层发布的官方业绩预期，是最重要的参考依据：**
{forecastSummary}

## 业绩快报（来自Tushare业绩快报接口）
**这是正式财报发布前的业绩快照：**
{expressSummary}

## 历史增长率趋势
{growthIndicators}

请输出JSON格式的预测结果，包含assumptions、revenueForecast、profitForecast、confidence、risks、caveats字段。

**重点分析**：
1. **结合业绩预告**：管理层的业绩预期是最权威的参考，请重点参考
2. **预告类型解读**：预增/略增/扭亏/续盈等类型的含义
3. **变动原因分析**：业绩变动的核心驱动因素
4. **短期vs中期预测**：区分下一季度和未来1-3年的预测
5. **情景分析**：乐观、基准、悲观三种情景的概率评估`,
    sampleInputData: `业绩预告数据示例:
[
  {
    "公告日期": "20241030",
    "报告期": "20241231",
    "预告类型": "略增",
    "预计净利润变动幅度": "14.5% ~ 14.85%",
    "预计净利润_万元": "84500000 ~ 86200000",
    "上年同期净利润_万元": 73740000,
    "业绩摘要": "公司预计2024年度净利润同比增长约14.67%",
    "变动原因": "品牌优势持续强化，直销渠道占比提升"
  }
]

业绩快报数据示例:
[
  {
    "公告日期": "20250128",
    "报告期": "20241231",
    "营业收入_亿元": "1720.60",
    "净利润_亿元": "862.28",
    "稀释EPS": 68.65,
    "净资产收益率": 34.52
  }
]

历史增长率趋势:
[
  {"报告期": "20250930", "营收同比增长率": 6.36, "净利润同比增长率": 6.25},
  {"报告期": "20250630", "营收同比增长率": 9.10, "净利润同比增长率": 8.52}
]`
  },
  {
    category: '分析Agent',
    agentName: '估值评估 (VALUATION)',
    model: 'gpt-4.1',
    systemPrompt: `你是股票估值分析专家。请基于市场数据和财务指标进行估值分析：
1. 相对估值：PE、PB、PS与历史及行业对比
2. 绝对估值参考：基于盈利能力的内在价值
3. 估值区间判断

请以JSON格式输出，包含：
- currentValuation: 当前估值水平
- peAnalysis: 市盈率分析
- pbAnalysis: 市净率分析
- psAnalysis: 市销率分析
- intrinsicValue: 内在价值估算
- valuationConclusion: 估值结论(低估/合理/高估)
- targetPriceRange: 目标价格区间`,
    dataSource: '每日指标(daily_basic) + 财务指标(fina_indicator) + 盈利分析结果 + 资产负债分析结果',
    tushareApi: 'daily_basic, fina_indicator',
    userPromptTemplate: `请对该公司进行全面的估值评估：

## 当前估值数据（最新交易日）
- **交易日期**: {tradeDate}
- **收盘价**: {closePrice}
- **PE (TTM)**: {peTtm}
- **PB**: {pb}
- **PS (TTM)**: {psTtm}
- **换手率**: {turnoverRate}%
- **量比**: {volumeRatio}
- **总市值**: {totalMv}亿元
- **流通市值**: {circMv}亿元
- **股息率 (TTM)**: {dvTtm}%

## 近30日估值均值
- **平均PE**: {avgPE}
- **平均PB**: {avgPB}
- **平均PS**: {avgPS}

## 财务指标数据
- **ROE**: {roe}%
- **ROA**: {roa}%
- **EPS**: {eps}元
- **BPS (每股净资产)**: {bps}元
- **毛利率**: {grossMargin}%
- **净利率**: {netMargin}%

## 盈利能力分析结果（参考）
{profitabilityResultSummary}

## 资产负债分析结果（参考）
{balanceSheetResultSummary}

请输出JSON格式的估值评估结果，包含summary、relativeValuation、intrinsicValue、marketSentiment、investmentImplication、risks、catalysts字段。

**分析重点**：
1. **相对估值**：PE/PB/PS当前值与历史、行业的对比分析
2. **内在价值**：基于盈利能力估算合理估值区间
3. **市场情绪**：换手率和量比反映的市场关注度
4. **买入建议**：当前价位是否具有吸引力`,
    sampleInputData: `每日指标数据示例:
{
  "ts_code": "600519.SH",
  "trade_date": "20251220",
  "close": 1422,
  "pe_ttm": 19.78,
  "pb": 6.93,
  "ps_ttm": 9.97,
  "turnover_rate": 0.1914,
  "volume_ratio": 0.71,
  "total_mv": 178072800,
  "circ_mv": 178072800,
  "dv_ttm": 2.85
}

财务指标数据示例:
{
  "roe": 26.37,
  "roa": 22.39,
  "eps": 51.53,
  "bps": 195.53,
  "gross_margin": 91.54,
  "netprofit_margin": 52.08
}`
  },
  {
    category: '分析Agent',
    agentName: '投资结论 (FINAL_CONCLUSION)',
    model: 'gpt-4.1',
    systemPrompt: `你是投资分析总监。请综合所有分析结果给出最终投资建议：
1. 整合各维度分析要点
2. 权衡利弊
3. 给出明确投资建议
4. 识别适合的投资者类型

请以JSON格式输出，包含：
- investmentScore: 投资评分(1-100)
- recommendation: 投资建议(强烈推荐/推荐/中性/谨慎/回避)
- keyStrengths: 核心优势
- keyRisks: 主要风险
- suitableInvestors: 适合投资者类型
- targetPrice: 目标价格
- investmentHorizon: 建议持有期限
- summary: 一句话总结`,
    dataSource: '所有前置Agent分析结果汇总',
    tushareApi: '(无直接调用，使用所有Agent结果)',
    userPromptTemplate: `请综合以下所有分析结果（包括估值评估），给出最终投资结论：

{allResults}

请输出JSON格式的最终结论，包含companyQuality、investmentValue、riskAssessment、recommendation、keyTakeaways字段。
特别注意：在investmentValue中的valuationAssessment字段需结合估值评估结果给出准确判断。`,
    sampleInputData: `输入为所有前置Agent的分析结果JSON汇总:
{
  "profitabilityResult": {...},
  "balanceSheetResult": {...},
  "cashFlowResult": {...},
  "earningsQualityResult": {...},
  "riskResult": {...},
  "businessInsightResult": {...},
  "businessModelResult": {...},
  "forecastResult": {...},
  "valuationResult": {...}
}`
  },
  // ========== 漫画生成 ==========
  {
    category: '漫画生成',
    agentName: '漫画脚本生成 (SCRIPT_GENERATOR)',
    model: 'gemini-3-pro-preview',
    systemPrompt: `你是一位顶级的财报漫画创意总监。

## 你的任务
将财报分析数据转化为一个由特定IP角色演绎的趣味漫画脚本。

## 漫画脚本要求

### 结构要求（固定8格）
1. **第1格 [自我介绍]**: IP角色以公司的身份登场自我介绍
2. **第2格 [盈利能力]**: 展示营收、毛利率、净利率等数据
3. **第3格 [资产负债]**: 展示资产负债率、流动比率等
4. **第4格 [现金流]**: 展示经营现金流、自由现金流等
5. **第5格 [盈利质量]**: 展示盈利可持续性分析
6. **第6格 [风险评估]**: 展示主要风险和警示
7. **第7格 [业务洞察]**: 展示竞争优势和行业地位
8. **第8格 [投资结论]**: 综合评分和投资建议，附"AI生成，仅供参考"

### imagePrompt要求（英文）
每个面板的imagePrompt必须包含：
1. 角色外观描述
2. 场景和背景描述
3. 角色动作和表情
4. 必须嵌入图像中的文字（TEXT IN IMAGE部分）
5. 配色方案

## 输出格式（JSON）
{
  "title": "漫画标题",
  "theme": "主题概述",
  "mainCharacter": {...},
  "panels": [{...}],
  "financialHighlights": [...],
  "investmentMessage": "核心投资建议"
}`,
    dataSource: '所有Agent分析结果摘要 + IP角色配置',
    tushareApi: '(无直接调用，使用分析结果摘要)',
    userPromptTemplate: `你是一位顶级的财报漫画创意总监。

## 指定IP角色
- **角色名称**: {characterName} ({characterDisplayName})
- **角色描述**: {characterDescription}
- **性格特点**: {characterPersonality}
- **标志性台词**: {characterCatchphrase}
- **来源**: {characterSource}

## 对话风格参考
- 自我介绍: "{greetingStyle}"
- 数据展示: "{dataStyle}"
- 结论表达: "{conclusionStyle}"

## 财报分析数据
{analysisData}

## 漫画脚本要求
[固定8格结构要求...]

请确保对话和表演符合角色的性格特点！`,
    sampleInputData: `分析数据摘要示例:
【公司基本信息】
公司名称：贵州茅台
股票代码：600519.SH
报告类型：quarterly
报告期：2025年三季报

【Agent: 盈利能力分析 PROFITABILITY】
营收增长率：6.36%
毛利率：67.74%
净利率：52.08%
盈利趋势：增长放缓
核心结论：盈利能力极强，但营收和净利增速放缓

【Agent: 资产负债分析 BALANCE_SHEET】
资产负债率：12.81%
流动比率：6.62
财务健康度：优秀
核心结论：财务结构极其稳健，偿债能力卓越

【Agent: 投资结论 FINAL_CONCLUSION】
综合评分：85/100
投资建议：买入/持有
适合投资者：长期价值投资者

IP角色配置示例:
- 角色名称: 哪吒 (Nezha)
- 角色描述: 叛逆少年，头戴乾坤圈，脚踩风火轮
- 性格特点: 桀骜不驯但重情重义，直率热血
- 标志性台词: "我命由我不由天！"`
  },
  {
    category: '漫画生成',
    agentName: '漫画图像生成 (IMAGE_GENERATOR)',
    model: 'gemini-3-pro-image-preview',
    systemPrompt: `[无独立System Prompt，使用动态构建的图片生成Prompt]

图片风格要求:
- Cute cartoon infographic comic style
- Soft pastel gradient background (pink, light blue, mint green, coral)
- Rounded friendly shapes and cute character design
- Clean, modern, minimalist aesthetic
- Information graphic elements (mini charts, trend arrows, data boxes)
- ALL CHINESE TEXT MUST BE CLEARLY RENDERED AND READABLE`,
    dataSource: '漫画脚本中每个Panel的imagePrompt + IP角色视觉配置',
    tushareApi: '(无直接调用)',
    userPromptTemplate: `Create a cute cartoon comic panel featuring the character from Chinese animation "{characterSource}":

=== CHARACTER ===
{characterVisualStyle}
Current action: {panelAction}
Expression/Mood: {panelMood}

=== SCENE ===
{panelScene}
Visual metaphor: {visualMetaphor}

=== TEXT IN IMAGE (CRITICAL - ALL TEXT MUST BE VISIBLE) ===
Speech bubble text: "{dialogue}"
Data labels: {dataLabels}
Title text: "{caption}"
Warning label: "{warningText}"

=== STYLE REQUIREMENTS ===
- Cute chibi cartoon style matching Chinese animated movie aesthetic
- Color palette: {colorPalette}
- Soft pastel gradient background
- Clean modern infographic elements
- Speech bubbles with rounded corners for dialogue
- Data displayed in colorful info boxes
- High quality 4K digital illustration
- ALL CHINESE TEXT MUST BE CLEARLY RENDERED AND READABLE

=== COMPOSITION ===
- Character on one side, data/charts on the other
- Balanced layout suitable for vertical scroll reading
- Panel height optimized for mobile viewing`,
    sampleInputData: `图像生成Prompt示例:
Create a cute cartoon comic panel featuring the character from Chinese animation "哪吒之魔童降世":

=== CHARACTER ===
哪吒 (Nezha): A rebellious young boy with flames on his forehead, wearing red armband and black-red outfit. 
Chibi style with big expressive eyes and fiery personality.
Current action: proudly presenting financial data charts
Expression/Mood: confident and playful

=== SCENE ===
Financial analysis room with floating holographic charts showing revenue growth
Visual metaphor: golden coins flowing upward representing profit growth

=== TEXT IN IMAGE (CRITICAL - ALL TEXT MUST BE VISIBLE) ===
Speech bubble text: "我命由我不由天！这业绩，稳！"
Data labels: "营收增长6.36%", "净利率52.08%", "ROE 26.37%"
Title text: "盈利能力分析"

=== STYLE REQUIREMENTS ===
- Color palette: crimson red, gold, black, flame orange
- Cute chibi cartoon style
- 4K quality`
  }
];

// 创建工作簿
const workbook = XLSX.utils.book_new();

// 准备数据（转换为适合Excel的格式）
const excelData = agentData.map((agent, index) => ({
  '序号': index + 1,
  '类别': agent.category,
  'Agent名称': agent.agentName,
  '调用模型': agent.model,
  'System Prompt': agent.systemPrompt,
  '数据来源': agent.dataSource,
  'Tushare API': agent.tushareApi,
  'User Prompt模板': agent.userPromptTemplate,
  '示例输入数据': agent.sampleInputData
}));

// 创建工作表
const worksheet = XLSX.utils.json_to_sheet(excelData);

// 设置列宽
const colWidths = [
  { wch: 5 },   // 序号
  { wch: 12 },  // 类别
  { wch: 35 },  // Agent名称
  { wch: 25 },  // 调用模型
  { wch: 80 },  // System Prompt
  { wch: 50 },  // 数据来源
  { wch: 40 },  // Tushare API
  { wch: 100 }, // User Prompt模板
  { wch: 80 }   // 示例输入数据
];
worksheet['!cols'] = colWidths;

// 添加工作表到工作簿
XLSX.utils.book_append_sheet(workbook, worksheet, 'Agent配置详情');

// 创建汇总表
const summaryData = agentData.map((agent, index) => ({
  '序号': index + 1,
  '类别': agent.category,
  'Agent名称': agent.agentName,
  '调用模型': agent.model,
  '数据来源': agent.dataSource,
  'Tushare API': agent.tushareApi
}));

const summarySheet = XLSX.utils.json_to_sheet(summaryData);
summarySheet['!cols'] = [
  { wch: 5 },
  { wch: 12 },
  { wch: 35 },
  { wch: 25 },
  { wch: 60 },
  { wch: 40 }
];
XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总表');

// 创建Tushare接口说明表
const tushareApiData = [
  { '接口名称': 'income', '中文名': '利润表', '主要字段': 'ts_code, ann_date, end_date, total_revenue, revenue, n_income, basic_eps, gross_margin', '使用Agent': 'PLANNING, PROFITABILITY' },
  { '接口名称': 'balancesheet', '中文名': '资产负债表', '主要字段': 'ts_code, end_date, total_assets, total_liab, money_cap, inventories, accounts_receiv', '使用Agent': 'PLANNING, BALANCE_SHEET' },
  { '接口名称': 'cashflow', '中文名': '现金流量表', '主要字段': 'ts_code, end_date, n_cashflow_act, n_cashflow_inv_act, n_cash_flows_fnc_act, free_cashflow', '使用Agent': 'PLANNING, CASH_FLOW' },
  { '接口名称': 'fina_indicator', '中文名': '财务指标', '主要字段': 'roe, roa, gross_margin, netprofit_margin, current_ratio, quick_ratio, debt_to_assets, eps, bps, fcff', '使用Agent': 'PROFITABILITY, BALANCE_SHEET, CASH_FLOW, FORECAST, VALUATION' },
  { '接口名称': 'fina_mainbz', '中文名': '主营业务构成', '主要字段': 'ts_code, end_date, bz_item, bz_sales, bz_profit, bz_cost', '使用Agent': 'BUSINESS_INSIGHT, BUSINESS_MODEL' },
  { '接口名称': 'forecast', '中文名': '业绩预告', '主要字段': 'ts_code, ann_date, end_date, type, p_change_min, p_change_max, net_profit_min, net_profit_max, summary, change_reason', '使用Agent': 'FORECAST' },
  { '接口名称': 'express', '中文名': '业绩快报', '主要字段': 'ts_code, ann_date, end_date, revenue, n_income, diluted_eps, diluted_roe, perf_summary', '使用Agent': 'FORECAST' },
  { '接口名称': 'daily_basic', '中文名': '每日指标', '主要字段': 'ts_code, trade_date, close, pe_ttm, pb, ps_ttm, turnover_rate, volume_ratio, total_mv, dv_ttm', '使用Agent': 'VALUATION' }
];

const tushareSheet = XLSX.utils.json_to_sheet(tushareApiData);
tushareSheet['!cols'] = [
  { wch: 15 },
  { wch: 15 },
  { wch: 80 },
  { wch: 50 }
];
XLSX.utils.book_append_sheet(workbook, tushareSheet, 'Tushare接口说明');

// 保存文件
const outputPath = path.join(__dirname, '..', 'Agent配置文档.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Excel文件已生成: ${outputPath}`);
console.log(`包含 ${agentData.length} 个Agent的配置信息`);
