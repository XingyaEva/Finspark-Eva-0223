# Finspark Multi-Agent 财报分析系统 - Agent Prompt 设计与输出分析报告

## 目录
1. [Agent清单与架构总览](#一agent清单与架构总览)
2. [各Agent Prompt设计详解](#二各agent-prompt设计详解)
3. [贵州茅台(600519)分析输出示例](#三贵州茅台600519分析输出示例)
4. [Prompt设计思路与下游衔接分析](#四prompt设计思路与下游衔接分析)
5. [迭代演进历史](#五迭代演进历史)

---

## 一、Agent清单与架构总览

### 1.1 系统架构图

```
Financial Analysis Orchestrator (DAG混合编排)
│ 
├── Phase 1: 并行执行 (Promise.all) ─────────────────────────
│   ├── PROFITABILITY Agent (利润表分析)         │
│   ├── BALANCE_SHEET Agent (资产负债表分析)      │ 并行
│   └── CASH_FLOW Agent (现金流量表分析)          │
│ 
├── Phase 1.5: 趋势解读 ────────────────────────────────────
│   └── TREND_INTERPRETATION Agent (趋势解读)     串行(依赖Phase 1)
│ 
├── Phase 2: 深度分析 ─────────────────────────────────────
│   ├── EARNINGS_QUALITY Agent (三表联动分析)     串行(依赖Phase 1结果)
│   ├── RISK Agent (风险评估)                     │
│   └── BUSINESS_INSIGHT Agent (业务洞察)         │ 并行
│ 
├── Phase 3: 可选模块 + 估值 ───────────────────────────────
│   ├── BUSINESS_MODEL Agent (商业模式分析)       可选
│   ├── FORECAST Agent (业绩预测)                 可选
│   └── VALUATION Agent (估值评估)                始终执行
│ 
├── Phase 4: 行业对比 (独立模块) ───────────────────────────
│   └── INDUSTRY_COMPARISON Agent (行业对比分析)  Pro/Elite专属
│ 
└── Final Phase: 汇总 ─────────────────────────────────────
    └── FINAL_CONCLUSION Agent (投资结论)         整合所有结果
```

### 1.2 Agent功能矩阵

| 序号 | Agent名称 | 英文标识 | 执行阶段 | 输入依赖 | 输出用途 | 状态 |
|------|-----------|----------|----------|----------|----------|------|
| 1 | 分析规划 | PLANNING | 启动 | 原始财务数据 | 确定分析计划和重点 | ✅ 已上线 |
| 2 | 利润表分析 | PROFITABILITY | Phase 1 | income表+finaIndicator | 盈利能力评估 | ✅ 已上线 |
| 3 | 资产负债表分析 | BALANCE_SHEET | Phase 1 | balance表+偿债指标 | 财务健康度 | ✅ 已上线 |
| 4 | 现金流量表分析 | CASH_FLOW | Phase 1 | cashflow表+现金流指标 | 现金流质量 | ✅ 已上线 |
| 5 | 趋势解读 | TREND_INTERPRETATION | Phase 1.5 | 三表结果+历史数据 | 8指标趋势分析 | ✅ 已上线 |
| 6 | 三表联动分析 | EARNINGS_QUALITY | Phase 2 | Phase1三个结果 | 盈利质量验证 | ✅ 已上线 |
| 7 | 风险评估 | RISK | Phase 2 | 资产负债+现金流+盈利质量 | 综合风险评级 | ✅ 已上线 |
| 8 | 业务洞察 | BUSINESS_INSIGHT | Phase 2 | 利润表+主营业务构成 | 竞争力分析 | ✅ 已上线 |
| 9 | 商业模式分析 | BUSINESS_MODEL | Phase 3 | 业务洞察+主营业务 | 护城河评估 | ✅ 已上线 |
| 10 | 业绩预测 | FORECAST | Phase 3 | 盈利分析+业绩预告 | 未来展望 | ✅ 已上线 |
| 11 | 估值评估 | VALUATION | Phase 3 | daily_basic+财务指标 | 估值判断 | ✅ 已上线 |
| 12 | 行业对比 | INDUSTRY_COMPARISON | Phase 4 | 同行业财务数据 | 竞争地位 | ✅ 已上线 |
| 13 | 投资结论 | FINAL_CONCLUSION | Final | 所有Agent结果 | 最终建议 | ✅ 已上线 |

---

## 二、各Agent Prompt设计详解

### 2.1 PLANNING Agent - 分析规划

**设计目的**：制定分析计划，识别数据质量和初步风险信号

**Prompt核心结构**：
```
输入要求：
1. 判断季度/年度财报类型
2. 识别数据质量和完整性
3. 发现财务亮点和风险信号
4. 规划分析重点和顺序

输出JSON Schema：
{
  "reportType": "annual/quarterly",
  "dataQuality": "数据质量评估",
  "keyHighlights": ["亮点1", "亮点2"],
  "riskFlags": ["风险1", "风险2"],
  "analysisSequence": ["分析步骤"],
  "estimatedTime": 60
}
```

**下游衔接**：
- 为后续Agent提供分析方向指引
- 识别出的riskFlags会影响风险评估Agent的关注点

---

### 2.2 PROFITABILITY Agent - 利润表分析

**设计目的**：深度评估企业盈利能力

**Prompt设计亮点**：
1. **多维度指标覆盖**：营收增长率、毛利率、净利率、ROE、ROA
2. **趋势+对比分析**：要求近3年趋势描述 + 行业对比
3. **质量评估**：评估营收质量、可持续性
4. **结构化输出**：summary/detailedAnalysis/keyMetrics/risks/opportunities

**输入数据源**：
- `income` 利润表（最近8期）
- `finaIndicator` 核心财务指标（ROE/毛利率/净利率/费用率等）

**输出JSON关键字段**：
```json
{
  "summary": {
    "revenueGrowth": "8.70%",
    "grossMargin": "85.00%",
    "netMargin": "48.00%",
    "profitTrend": "增长/稳定/下降",
    "sustainability": "高/中/低",
    "oneSentence": "30字核心结论"
  },
  "detailedAnalysis": {
    "revenueAnalysis": {...},
    "profitabilityAnalysis": {...},
    "competitivePosition": {...}
  },
  "keyMetrics": [...],
  "risks": [...],
  "opportunities": [...]
}
```

**下游衔接**：
- → EARNINGS_QUALITY（验证利润真实性）
- → BUSINESS_INSIGHT（驱动因素分析）
- → FORECAST（预测基础数据）
- → FINAL_CONCLUSION（综合评估）

---

### 2.3 BALANCE_SHEET Agent - 资产负债表分析

**设计目的**：评估企业财务健康度和资本结构

**Prompt设计亮点**：
1. **资产结构分析**：流动vs非流动资产占比、资产质量评估
2. **负债结构分析**：短期vs长期负债、有息负债占比、偿债压力
3. **资本结构分析**：股东权益、留存收益、资本效率
4. **流动性指标**：流动比率、速动比率、现金比率

**输入数据源**：
- `balance` 资产负债表
- `finaIndicator` 偿债能力指标（流动比率/速动比率/资产负债率/周转率等）

**关键输出字段**：
```json
{
  "summary": {
    "debtRatio": "25%",
    "currentRatio": "2.5",
    "quickRatio": "2.0",
    "financialHealth": "优秀/良好/一般/较差",
    "leverageRisk": "低/中/高"
  }
}
```

---

### 2.4 CASH_FLOW Agent - 现金流量表分析

**设计目的**：评估企业现金流质量和造血能力

**Prompt设计亮点**：
1. **三活动分析**：经营/投资/筹资现金流
2. **质量验证**：净利润与经营现金流匹配度
3. **自由现金流**：FCFF/FCFE分析
4. **周期分析**：现金周转周期评估

**关键创新点**：
```
profitCashRatio: "净利润与经营现金流匹配度分析"
- 比率>100%：现金流质量高
- 比率<80%：可能存在应收账款风险
```

---

### 2.5 TREND_INTERPRETATION Agent - 趋势解读

**设计目的**：为8个核心指标生成专业趋势解读

**Prompt设计特色（最复杂的Agent）**：

1. **行业差异化配置**：
```javascript
INDUSTRY_CHARACTERISTICS: {
  '白酒': {
    description: '白酒行业具有高毛利率（通常60-90%）...',
    benchmarks: { grossMargin: 75, netMargin: 35, roe: 25 },
    keyFactors: ['品牌力', '产品结构升级', '渠道控制力'...],
    risks: ['消费降级', '行业政策', '库存积压'...]
  },
  '银行': { ... },
  '科技': { ... }
}
```

2. **强制输出规范（10字段必填）**：
```json
{
  "netProfit": {
    "latestValue": "646.30亿",
    "latestPeriod": "2025三季报",
    "yoyChange": "+15.23%",      // 必须计算同比
    "yoyDirection": "up",
    "trend": "up",
    "trendLabel": "上升",
    "trendPeriods": "近12期整体呈上升趋势",
    "peakInfo": "峰值2024年报达862亿",
    "insight": "150-200字深度分析",
    "concerns": "100-150字风险关注"  // 必须与insight不同
  }
}
```

3. **同比计算强制规范**：
```
yoyChange = (最新值 - 去年同期值) / |去年同期值| × 100%
格式：正数加"+"前缀（+15.23%），负数直接显示（-8.56%）
```

---

### 2.6 EARNINGS_QUALITY Agent - 三表联动分析

**设计目的**：通过三表勾稽关系验证盈利质量

**核心分析维度**：
1. **利润现金匹配度**：净利润vs经营现金流对比
2. **营运资本质量**：应收账款、存货、应付账款分析
3. **财务操纵风险**：收入确认激进度、费用资本化程度、关联交易风险

**输入**：Phase 1三个Agent的结果（profitability + balanceSheet + cashFlow）

**输出关键字段**：
```json
{
  "summary": {
    "profitCashMatch": "高/中/低",
    "receivableRisk": "低/中/高",
    "inventoryRisk": "低/中/高",
    "earningsGrade": "A/B/C/D/F",
    "realProfit": "真实/基本真实/存疑"
  },
  "redFlags": ["需关注的财务异常信号"],
  "greenFlags": ["盈利质量良好的证据"]
}
```

---

### 2.7 RISK Agent - 风险评估

**设计目的**：多维度风险全面评估

**四大风险维度**：
1. **负债风险**：债务规模、结构、偿债能力
2. **流动性风险**：现金储备、短期偿债能力
3. **运营风险**：经营稳定性、收入集中度
4. **市场风险**：行业周期性、竞争、政策监管

**风险矩阵输出**：
```json
{
  "riskMatrix": [
    {"risk": "负债风险", "probability": "低", "impact": "低", "priority": "低"},
    {"risk": "流动性风险", "probability": "低", "impact": "中", "priority": "低"}
  ],
  "recommendations": ["风险管理建议1", "建议2"]
}
```

---

### 2.8 BUSINESS_INSIGHT Agent - 业务洞察

**设计目的**：分析主营业务构成和行业竞争地位

**创新设计**：整合 `fina_mainbz` 主营业务构成数据

**分析框架**：
1. **收入结构**：按产品/渠道/地区分类
2. **利润贡献**：高毛利vs低毛利业务
3. **结构演进**：业务结构变化趋势
4. **SWOT分析**：优势/劣势/机会/威胁

---

### 2.9 BUSINESS_MODEL Agent - 商业模式分析

**设计目的**：深度分析护城河和企业文化

**参考巴菲特护城河理论**：
1. **品牌护城河**：品牌溢价能力、消费者心智
2. **转换成本**：技术、学习、数据迁移成本
3. **网络效应**：用户规模带来的价值增长
4. **成本优势**：规模经济、独特资源
5. **无形资产**：专利、牌照、特许经营权

**输出结构**：
```json
{
  "summary": {
    "modelType": "高端消费品/平台型/订阅制",
    "moatType": "品牌/转换成本/网络效应/成本优势/无形资产",
    "moatStrength": "极强/强/中等/弱/无",
    "moatDurability": "极高/高/中等/低"
  },
  "moatAnalysis": {
    "primaryMoat": {...},
    "secondaryMoats": [...],
    "moatThreats": [...]
  }
}
```

---

### 2.10 FORECAST Agent - 业绩预测

**设计目的**：基于管理层预期和历史趋势进行业绩预测

**创新数据源整合**：
1. **业绩预告 (forecast)**：管理层官方业绩预期（最权威参考）
2. **业绩快报 (express)**：正式财报前的业绩快照
3. **历史增长率**：从finaIndicator提取

**情景分析输出**：
```json
{
  "scenarioAnalysis": {
    "bullCase": {"scenario": "乐观", "growth": "X%", "probability": "X%"},
    "baseCase": {"scenario": "基准", "growth": "X%", "probability": "X%"},
    "bearCase": {"scenario": "悲观", "growth": "X%", "probability": "X%"}
  }
}
```

---

### 2.11 VALUATION Agent - 估值评估

**设计目的**：基于市场数据和财务指标进行估值分析

**数据来源**：
- `daily_basic`：PE/PB/PS/换手率/量比/市值/股息率
- `fina_indicator`：ROE/ROA/EPS/BPS

**分析框架**：
1. **相对估值**：PE/PB/PS当前vs历史vs行业
2. **内在价值**：DCF简易估算
3. **市场情绪**：换手率/量比分析

---

### 2.12 INDUSTRY_COMPARISON Agent - 行业对比

**设计目的**：与同行业TOP5公司横向对比

**对比维度**：
1. 盈利能力：营收、毛利率、净利率、ROE、ROA
2. 成长性：营收同比、净利润同比
3. 风险水平：资产负债率、流动比率

**雷达图数据输出**：
```json
{
  "radarChartData": {
    "dimensions": ["盈利能力", "成长性", "偿债能力", "运营效率", "估值水平"],
    "targetScores": [85, 70, 90, 75, 60],
    "industryAvgScores": [70, 65, 75, 70, 70]
  }
}
```

---

### 2.13 FINAL_CONCLUSION Agent - 投资结论

**设计目的**：整合所有分析给出最终投资建议

**输出结构**：
```json
{
  "summary": {
    "score": 85,
    "recommendation": "强烈买入/买入/持有/卖出/强烈卖出",
    "suitableInvestorType": "稳健型/成长型/激进型",
    "targetPriceRange": "目标价格区间"
  },
  "companyQuality": { "score": 85, "grade": "A" },
  "riskAssessment": { "overallRiskLevel": "低/中/高" },
  "keyTakeaways": ["核心要点1", "要点2", "要点3", "要点4", "要点5"]
}
```

---

## 三、贵州茅台(600519)分析输出示例

### 3.1 分析基本信息
- **股票代码**：600519.SH
- **公司名称**：贵州茅台
- **报告类型**：annual（年度）
- **数据期间**：2024年年报 + 2025年前三季度
- **执行时间**：62.93秒

### 3.2 PLANNING Agent 输出示例

```json
{
  "company": {
    "name": "贵州茅台",
    "code": "600519.SH",
    "industry": "白酒/高端消费品"
  },
  "dataQuality": {
    "completeness": 0.9,
    "reliability": "high",
    "notes": [
      "财务报表覆盖2024年年报及2025年前三季度，包含利润表、资产负债表、现金流量表以及主要财务指标，数据详实。",
      "部分季度财报有字段缺失（如EBITDA、部分明细科目、现金流补充项），但不影响核心分析。",
      "数据均为定期或中报公告数据，且与常用数据库结构匹配，可靠性高。"
    ]
  },
  "analysisStrategy": {
    "focus": [
      "盈利能力与增长：重点关注营业收入、净利润、毛利率、净利率等高端消费品核心指标",
      "现金流健康性：分析经营、投资、筹资现金流及自由现金流",
      "资本结构与偿债能力：关注资产负债率、流动比率、速动比率",
      "估值水平与股东回报：结合PE、PB、ROE、分红率等市场指标"
    ],
    "concerns": [
      "现金流同比下滑显著，尤其2025年上半年经营、投资活动现金流波动大",
      "存货高企与资产周转率下降，需警惕渠道库存、需求变化带来的业绩压力",
      "估值处于A股高位，需结合业绩增长稳定性与消费环境变化"
    ],
    "methodology": "采用横向与纵向比较相结合的分析方法，核心采用杜邦分析、现金流量表三大活动分析、资产结构与周转效率分析"
  }
}
```

### 3.3 PROFITABILITY Agent 输出示例

```json
{
  "metrics": {
    "grossMargin": {
      "current": 91.29,
      "trend": "stable",
      "industryComparison": "above"
    },
    "netMargin": {
      "current": 52.08,
      "trend": "stable"
    },
    "roe": {
      "current": 26.37,
      "trend": "slightly declining"
    },
    "roa": {
      "current": 29.41,
      "trend": "improving"
    }
  },
  "revenueGrowth": {
    "rate": 6.32,
    "drivers": [
      "高端白酒市场需求稳定",
      "品牌溢价能力强",
      "渠道精细化管理",
      "产品结构优化"
    ]
  },
  "profitGrowth": {
    "rate": 6.25,
    "sustainability": "公司净利率极高，费用管控能力强，毛利率保持高位，盈利能力具备高度可持续性，但ROE略有下行趋势需关注资本效率"
  },
  "conclusion": "贵州茅台展现出极强的盈利能力。公司毛利率和净利率均处于行业天花板，品牌护城河深厚，费用率管控出色。尽管ROE有所下行，但依然显著优于行业，且ROA持续提升，显示资产利用效率进一步提高。",
  "rating": "excellent"
}
```

**金融专家点评**：
- ✅ 毛利率91.29%、净利率52.08%数据准确，反映茅台极强的定价权
- ✅ ROE 26.37%略有下降的判断客观
- ⚠️ 建议增加：杜邦分解分析（ROE = 净利率 × 周转率 × 杠杆倍数）

### 3.4 BALANCE_SHEET Agent 输出示例

```json
{
  "assetStructure": {
    "totalAssets": 304738184929.86,
    "currentRatio": 6.6193,
    "quickRatio": 5.1783,
    "assetTurnover": 0.4337
  },
  "liabilityStructure": {
    "debtRatio": 12.81,
    "shortTermDebt": 38763379268.53,
    "longTermDebt": 269780788.48,
    "debtToEquity": 0.1469
  },
  "workingCapital": {
    "value": 217823782432.33,
    "trend": "improving"
  },
  "conclusion": "贵州茅台的资产负债结构极为稳健。公司总资产保持在高位，流动比率与速动比率大幅高于行业平均，表明流动性充足。负债率较低（12.81%），资本结构以股东权益为主，财务杠杆风险极低。",
  "rating": "excellent"
}
```

**金融专家点评**：
- ✅ 流动比率6.62、速动比率5.18远超安全线，判断准确
- ✅ 资产负债率12.81%极低，正确识别为财务保守型企业
- ⚠️ 建议增加：有息负债率分析、货币资金/短期负债覆盖率

### 3.5 CASH_FLOW Agent 输出示例

```json
{
  "operatingCashFlow": {
    "value": 38196802155.27,
    "trend": "declining",
    "quality": "贵州茅台的经营活动现金流量净额为381.97亿元，同比下降明显，主要受税费支出和员工薪酬增加影响。现金流质量仍高，销售回款能力极强。"
  },
  "investingCashFlow": {
    "value": -5423368095.74,
    "capexRatio": 0.06,
    "purpose": "投资现金流为净流出，主要用于固定资产、在建工程、金融理财产品等投资。资本性支出占总收入比约6%，投资较为稳健。"
  },
  "financingCashFlow": {
    "value": -43243803506.28,
    "dividendPayout": 2541434067.5,
    "debtChanges": "公司无明显新增借款，融资现金流为大额净流出，主要因分红和股权回购。"
  },
  "freeCashFlow": {
    "value": 33738068687.06,
    "trend": "declining"
  },
  "conclusion": "贵州茅台现金流结构非常健康，经营现金流和自由现金流均为正，显示持续强劲的盈利和回款能力。但经营、自由现金流同比均有下降，需关注税费和成本上升对现金流的影响。",
  "rating": "excellent"
}
```

**金融专家点评**：
- ✅ 正确识别现金流下滑趋势
- ✅ 自由现金流337亿仍然充沛的判断准确
- ⚠️ 需关注：净利润现金含量比（经营现金流/净利润）应计算并展示

### 3.6 EARNINGS_QUALITY Agent 输出示例

```json
{
  "accrualRatio": {
    "value": 0.24,
    "assessment": "应计利润率约为24%，略高于国际优秀水平（建议<20%），但考虑到白酒行业季节性，整体应计项目无异常，盈利质量较高。"
  },
  "cashConversion": {
    "ratio": 0.57,
    "quality": "high"
  },
  "revenueRecognition": {
    "risk": "low",
    "notes": "收入增长与现金流、回款趋势基本一致，账龄结构好，应收账款极低（<0.03%），不存在提前确认收入或虚增收入迹象。"
  },
  "sustainabilityScore": 9.5,
  "conclusion": "贵州茅台盈利质量极高：现金流充裕、利润与现金流匹配，收入确认透明，应收类科目极低，经营杠杆适度。短中长期盈利可持续性极强，具备稀缺的高质量盈利特征。",
  "rating": "excellent"
}
```

**金融专家点评**：
- ✅ 应收账款占比<0.03%的识别非常关键，说明茅台是先款后货模式
- ✅ 盈利质量评分9.5/10合理
- ⚠️ 建议增加：Beneish M-Score财务操纵风险评估

### 3.7 RISK Agent 输出示例

```json
{
  "financialRisk": {
    "liquidityRisk": {
      "level": "low",
      "factors": [
        "流动比率6.62、速动比率5.18远高于行业标准",
        "货币资金超500亿元，应收账款极低",
        "负债率仅12.8%，无大额短期借款"
      ]
    },
    "debtRisk": {
      "level": "low",
      "factors": [
        "净债务为负（货币资金远大于有息负债），不存在偿债压力"
      ]
    },
    "marketRisk": {
      "level": "medium",
      "factors": [
        "宏观经济波动、消费升级放缓等可能影响高端白酒消费",
        "品牌溢价极高，但受政策、反腐、限酒等外部事件影响较大"
      ]
    }
  },
  "overallRisk": "low",
  "conclusion": "贵州茅台具备极强的抗风险能力和可持续发展基础，综合风险极低，为中国资本市场稀缺的高质量优质资产。",
  "rating": "excellent"
}
```

**金融专家点评**：
- ✅ 正确识别净债务为负（净现金状态）
- ✅ 市场风险medium的判断客观
- ⚠️ 建议增加：渠道库存风险、批价波动风险的量化分析

### 3.8 VALUATION Agent 输出示例

```json
{
  "relativeValuation": {
    "peRatio": {
      "current": 20.61,
      "industryAvg": 15,
      "assessment": "当前PE处于行业高位，反映市场对品牌溢价和业绩稳定性的高度认可。估值溢价合理，但从历史和同行角度看，股价并不便宜。"
    },
    "pbRatio": {
      "current": 7.83,
      "industryAvg": 4,
      "assessment": "当前PB远高于行业平均，显示市场给予公司极高的成长预期和护城河溢价。"
    }
  },
  "intrinsicValue": {
    "method": "DCF（自由现金流贴现法）",
    "estimate": "根据2025年FCFF约337亿，结合WACC 8%，长期增长率4%，估算公司合理市值约为1.6万亿元，对应每股目标价1280-1350元。",
    "confidence": "medium"
  },
  "valuationConclusion": "fairly_valued",
  "targetPriceRange": {
    "low": 1280,
    "high": 1350
  },
  "conclusion": "贵州茅台估值在国内高端白酒及A股市场中属于合理溢价，但已反映了业绩的稳定性和成长预期。"
}
```

**金融专家点评**：
- ✅ PE 20.61倍、PB 7.83倍数据准确
- ✅ DCF估值方法选择合理
- ⚠️ WACC假设8%偏高（茅台β低，应在6-7%），目标价可能偏保守
- ⚠️ 建议增加：股息率分析、PEG估值

### 3.9 FINAL_CONCLUSION Agent 输出示例

```json
{
  "investmentRating": "buy",
  "summary": "贵州茅台具备极强盈利能力、稳健财务结构和品牌护城河，估值溢价合理但不便宜，长期持有价值突出，短期关注业绩兑现和宏观扰动。",
  "keyStrengths": [
    "白酒行业绝对龙头，品牌壁垒极高，定价权强",
    "毛利率、净利率、现金流和资产负债表处于行业顶尖水平",
    "抗周期能力强，分红政策稳定，资本回报率优异"
  ],
  "keyRisks": [
    "估值处于高位，ROE略有下行，若业绩不及预期估值风险加大",
    "高端白酒受宏观经济、政策（如控酒、反腐）及消费结构变化影响"
  ],
  "catalysts": [
    "高端白酒需求持续升级及渠道创新",
    "产品结构优化与系列酒放量",
    "分红回购提升股东回报，品牌溢价持续强化"
  ],
  "investmentThesis": "贵州茅台凭借无可复制的品牌、稀缺的产品和强大渠道管理，构筑行业护城河。适合长期价值投资者持有，短期配置建议关注业绩兑现和估值波动。",
  "confidenceLevel": "high"
}
```

**金融专家综合评价**：
- ✅ 投资评级"buy"合理，论述逻辑清晰
- ✅ 风险与机会识别全面
- ⚠️ 缺少具体仓位建议和止损点位
- ⚠️ 建议增加：估值安全边际分析、情景假设敏感性

---

## 四、Prompt设计思路与下游衔接分析

### 4.1 设计原则

1. **结构化输出**：所有Agent强制JSON输出，便于解析和前端展示
2. **数据驱动**：Prompt中嵌入真实财务数据，避免AI凭空生成
3. **行业差异化**：针对不同行业配置不同的基准值和关注点
4. **层层递进**：上游Agent结果作为下游Agent输入，形成分析链路

### 4.2 数据流转示意

```
Tushare API
    │
    ├─► income ────────────► PROFITABILITY ─┬─► EARNINGS_QUALITY
    │                                       │
    ├─► balance ───────────► BALANCE_SHEET ─┤─► RISK
    │                                       │
    ├─► cashflow ──────────► CASH_FLOW ─────┘
    │                                       │
    ├─► mainbiz ───────────► BUSINESS_INSIGHT ─► BUSINESS_MODEL
    │
    ├─► forecast/express ──► FORECAST
    │
    ├─► daily_basic ───────► VALUATION
    │
    └─► 同行业数据 ─────────► INDUSTRY_COMPARISON
                                            │
                                            ▼
                                    FINAL_CONCLUSION
```

### 4.3 Prompt与下游衔接要点

| Agent | 关键输出字段 | 下游使用方 | 衔接要点 |
|-------|-------------|-----------|----------|
| PROFITABILITY | rating, revenueGrowth, conclusion | EARNINGS_QUALITY, FORECAST | 盈利趋势判断影响预测准确性 |
| BALANCE_SHEET | debtRatio, currentRatio | RISK | 偿债指标决定风险等级 |
| CASH_FLOW | freeCashFlow, trend | EARNINGS_QUALITY, VALUATION | 现金流质量影响估值 |
| VALUATION | targetPriceRange | FINAL_CONCLUSION | 估值结论决定投资建议 |

---

## 五、迭代演进历史

### 5.1 已确认的迭代记录

根据Git历史，主要迭代包括：

| 提交ID | 日期 | 迭代内容 |
|--------|------|----------|
| b81172e | 最新 | 修复趋势解读同比/趋势判断缺失及关注点重复问题 |
| 9e9f977 | 较早 | Agent Preset系统 - 用户自定义分析配置 |
| 1103567 | 较早 | Agent独立模型调用基础设施 |

### 5.2 TREND_INTERPRETATION Agent 的迭代重点

最近一次迭代(b81172e)主要修复：

1. **yoyChange必须计算**：强制要求同比计算公式
2. **concerns与insight不能重复**：明确区分深度分析和风险关注
3. **10字段全部必填**：latestValue, latestPeriod, yoyChange, yoyDirection, trend, trendLabel, trendPeriods, peakInfo, insight, concerns

### 5.3 Prompt设计演进方向建议

基于当前分析，建议后续迭代方向：

1. **增加杜邦分析**：在PROFITABILITY中增加ROE拆解
2. **增加Beneish M-Score**：在EARNINGS_QUALITY中增加财务操纵风险量化
3. **完善DCF参数**：在VALUATION中优化WACC估算逻辑
4. **增加技术分析维度**：在VALUATION中增加K线形态和技术指标

---

## 附录：数据源对照表

| Agent | Tushare接口 | 关键字段 |
|-------|-------------|----------|
| PROFITABILITY | income, fina_indicator | revenue, n_income, gross_margin, roe |
| BALANCE_SHEET | balancesheet, fina_indicator | total_assets, total_liab, current_ratio |
| CASH_FLOW | cashflow, fina_indicator | n_cashflow_act, fcff, fcfe |
| BUSINESS_INSIGHT | fina_mainbz | bz_item, bz_sales, bz_profit |
| FORECAST | forecast, express | type, p_change_min/max, summary |
| VALUATION | daily_basic | pe_ttm, pb, ps_ttm, total_mv |
| INDUSTRY_COMPARISON | 同行业financial数据 | 多公司横向对比 |

---

*报告生成时间: 2026-01-12*
*数据来源: Tushare Pro API*
*分析框架: Finspark Multi-Agent System v1.0*
