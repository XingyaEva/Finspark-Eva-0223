# FinSpark Agent 模型评估框架：基于 OpenEvals 的全面质量评估方案

> 文档版本：v1.0 | 更新日期：2026-04-03  
> 关联文档：`agent-trace-development-guide.md`, `analysis-gpu-acceleration-plan.md`

---

## 一、背景与动机

### 1.1 当前评估能力的局限性

我们现有的 `model_evaluations` 表只记录了基础指标：

| 现有指标 | 能力 | 不足 |
|---|---|---|
| `json_valid` | JSON 格式正确性 | 只知道是否合法，不知道内容质量 |
| `fields_complete_rate` | 字段完整率 | 只知道字段是否存在，不知道字段值是否有意义 |
| `latency_ms` | 响应时间 | 纯性能指标，与质量无关 |
| `insight_count` | 洞察数量 | 计数≠质量，3个深刻洞察 > 10个空洞描述 |
| `auto_score` | 综合自动评分 | 算法简单，无法判断分析专业性 |

**核心问题：我们能知道模型"输出了什么格式"，但无法知道模型"说的对不对、深不深、有没有专业价值"。**

### 1.2 OpenEvals 能带来什么

OpenEvals (langchain-ai/openevals) 是 LangChain 推出的 LLM 评估框架，提供：

| 能力 | 对应我们的需求 |
|---|---|
| **LLM-as-Judge** | 用强模型评判弱模型的分析报告质量 |
| **Structured Output Evaluation** (`createJsonMatchEvaluator`) | 评估 12 个 Agent 的 JSON 输出质量 |
| **Custom Prompts** | 为财务分析创建专业评估标准 |
| **Trajectory Evaluation** (`agentevals`) | 评估 4 阶段 12 Agent 的执行路径是否合理 |
| **Continuous Scoring** (0-1 浮点) | 比 pass/fail 更精细的质量梯度 |
| **LangSmith Integration** | 长期追踪评估结果，发现模型退化 |

### 1.3 参考代码分析：12-openevals_evaluators.py

用户提供的参考代码展示了一个典型的 OpenEvals 使用模式：

```python
# 1. 使用预制 prompt 评估通用维度
evaluators = [
    createLLMAsJudge(prompt=RELEVANCE_PROMPT, ...),       # 相关性
    createLLMAsJudge(prompt=CONCISENESS_PROMPT, ...),     # 简洁性
    createLLMAsJudge(prompt=HELPFULNESS_PROMPT, ...),     # 有用性
    createLLMAsJudge(prompt=HALLUCINATION_PROMPT, ...),   # 幻觉检测
    createLLMAsJudge(prompt=TOXICITY_PROMPT, ...),        # 安全性
]

# 2. 使用自定义 prompt 评估领域特定维度
custom_evaluators = [
    createLLMAsJudge(prompt=PROCESSING_MODE_PROMPT, ...),  # 处理模式正确性
    createLLMAsJudge(prompt=RESPONSE_COMPLETENESS_PROMPT, ...), # 回答完整性
]

# 3. 创建测试数据集 → 运行评估 → 汇总分数
```

**我们的改造方向：**
- 预制 prompt → 用于通用质量把关（幻觉、简洁）
- 自定义 prompt → 为 12 个 Agent 各写专业财务分析评估标准
- 测试数据集 → 构建 "金标准" 公司分析样本库
- 结构化输出评估 → 利用 `createJsonMatchEvaluator` 配合 rubric 评估字段级质量

---

## 二、评估框架总体架构

### 2.1 三层评估体系

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: 端到端评估（Report Level）            │
│  - 报告整体连贯性    - Agent间数据一致性    - 投资结论合理性       │
│  - 评估工具: Trajectory LLM-as-Judge + Custom Report Evaluator   │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 2: Agent 输出评估（Agent Level）         │
│  - 结构化输出质量    - 分析深度    - 数据准确性    - 专业性       │
│  - 评估工具: createJsonMatchEvaluator + Custom Financial Prompts │
├─────────────────────────────────────────────────────────────────┤
│                    Layer 1: 基础指标（已有 model_evaluations）     │
│  - JSON 合法性       - 字段完整率    - 响应时间    - Token 使用量  │
│  - 评估工具: 直接计算，无需 LLM                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 评估运行模式

| 模式 | 触发时机 | 评估范围 | 成本 |
|---|---|---|---|
| **实时轻量评估** | 每次分析完成 | Layer 1 全量 + Layer 2 抽样（10%） | ~$0.05/次 |
| **定期深度评估** | 每日/每周批量 | Layer 1 + Layer 2 + Layer 3 全量 | ~$2-5/批次 |
| **模型对比评估** | 新模型上线/A/B测试 | 三层全量，多模型并行 | ~$10-20/轮 |
| **回归测试** | Prompt 修改后 | 固定测试集三层评估 | ~$5-8/轮 |

---

## 三、Layer 2：Agent 输出评估（核心创新）

### 3.1 评估维度矩阵

每个 Agent 输出从 6 个维度评估，每个维度 0-1 浮点分：

| 维度 | 英文标识 | 评估方法 | 权重 |
|---|---|---|---|
| **数据准确性** | `data_accuracy` | LLM-as-Judge + 数值校验 | 25% |
| **分析深度** | `analysis_depth` | Custom LLM-as-Judge | 25% |
| **专业洞察** | `professional_insight` | Custom LLM-as-Judge | 20% |
| **逻辑一致性** | `logical_consistency` | Custom LLM-as-Judge | 15% |
| **表达质量** | `expression_quality` | CONCISENESS + Custom | 10% |
| **幻觉/捏造** | `hallucination` | HALLUCINATION_PROMPT | 5% |

### 3.2 通用评估 Prompt（所有 Agent 共享）

#### 3.2.1 财务分析幻觉检测

```typescript
export const FINANCIAL_HALLUCINATION_PROMPT = `
你是资深财务审计专家，负责检测 AI 生成的财务分析报告中是否存在"数据捏造"和"过度推断"。

评分标准（0-1 浮点分）：
- 1.0: 所有数据和结论都有输入数据直接支持，推断合理
- 0.8: 存在少量合理推断但未标注不确定性
- 0.5: 存在明显的数据外推或行业知识过度使用
- 0.2: 出现明确的数字捏造或与输入数据矛盾的结论
- 0.0: 大量捏造，分析与输入数据严重不符

检查要点：
1. 报告中引用的数值是否能在输入数据中找到来源
2. 趋势判断是否与实际数据走向一致
3. 行业对比数据是否标注了"行业一般水平"或"估算"
4. 预测性表述是否使用了不确定性修饰词（"预计"、"可能"、"如果..."）
5. 是否出现了输入数据中不存在的具体公司名、具体数字

<input_data>
{inputs}
</input_data>

<agent_output>
{outputs}
</agent_output>
`;

export const FINANCIAL_ANALYSIS_DEPTH_PROMPT = `
你是CFA持证分析师，负责评估 AI 财务分析的深度和专业性。

评分标准（0-1 浮点分）：
- 1.0: 分析层次丰富，包含因果归因、跨期比较、行业基准对比、前瞻判断
- 0.8: 分析有因果逻辑，但缺少某一维度的深入展开
- 0.6: 描述了数据变化但因果分析不足，更像"数据转述"
- 0.4: 主要是数据罗列，缺乏专业分析视角
- 0.2: 分析过于笼统，没有具体数据支撑
- 0.0: 纯属空话套话，无实质分析内容

评估维度：
1. 【数据利用率】是否充分利用了提供的财务数据，还是只提取了很少的数据点
2. 【因果归因】是否尝试解释"为什么"而不只是"是什么"
3. 【时间维度】是否包含同比、环比、趋势分析
4. 【对比分析】是否引用了行业基准或历史平均进行对比
5. 【前瞻判断】是否基于历史趋势做出合理的未来展望
6. 【风险识别】是否识别了潜在的财务风险和不确定性

<input_data>
{inputs}
</input_data>

<agent_output>
{outputs}
</agent_output>
`;

export const FINANCIAL_LOGICAL_CONSISTENCY_PROMPT = `
你是财务逻辑审核专家，检查 AI 财务分析报告中的逻辑一致性。

评分标准（0-1 浮点分）：
- 1.0: 各部分分析逻辑自洽，数据引用一致，结论与分析过程吻合
- 0.7: 基本逻辑通顺但存在 1-2 处小矛盾
- 0.4: 存在明显的逻辑矛盾（如分析说增长但结论说下降）
- 0.0: 严重逻辑混乱

检查要点：
1. summary 中的结论是否与 detailedAnalysis 中的具体分析一致
2. 数值在不同字段中引用时是否一致
3. 风险评估与数据表现是否匹配（如高毛利却说盈利风险高需要合理解释）
4. 评级/评分是否与文字描述对应

<agent_output>
{outputs}
</agent_output>
`;
```

### 3.3 Agent 专用评估 Prompt（12 个 Agent 各一套）

#### 3.3.1 Profitability Agent 专用评估

```typescript
export const PROFITABILITY_EVAL_PROMPT = `
你是利润表分析质量评审专家。请评估以下利润表分析的专业质量。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * summary.revenueGrowth 给出了准确的增长率数值
  * grossMargin/netMargin 趋势分析包含至少3期数据对比
  * profitTrend 有数据支撑的明确判断
  * detailedAnalysis 各子字段都有100字以上的实质性分析
  * competitivePosition 引用了行业对比（即使是估算值）
  * keyMetrics 至少包含 5 个核心指标，且 benchmark 有参考价值
  * risks/opportunities 每项都基于具体数据推导而非空泛列举

- 0.7 良好：
  * 核心指标数值准确，趋势判断正确
  * 但深度分析中某些字段偏短或偏泛
  * 竞争分析可能缺少具体行业数据

- 0.4 及格：
  * 基本结构完整，但分析停留在"数据转述"层面
  * 缺乏因果归因和前瞻判断
  * keyMetrics 的 benchmark 大量使用"行业平均"而无具体数值

- 0.2 不及格：
  * 关键数值错误或与输入数据不符
  * 大量字段只有一句话描述
  * risks/opportunities 完全是套话

<input_financial_data>
{inputs}
</input_financial_data>

<profitability_output>
{outputs}
</profitability_output>
`;
```

#### 3.3.2 Balance Sheet Agent 专用评估

```typescript
export const BALANCE_SHEET_EVAL_PROMPT = `
你是资产负债表分析质量评审专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * summary 中 debtRatio/currentRatio/quickRatio 数值与输入数据一致
  * financialHealth 和 leverageRisk 评估有数据支撑
  * detailedAnalysis.assetStructure 分析了资产构成变化趋势
  * liabilityStructure 区分了短期/长期负债风险
  * capitalStructure 评估了资本效率和留存收益质量
  * keyMetrics 包含至少 5 个关键偿债/效率指标

- 0.7: 核心比率正确，结构分析完整但深度不足
- 0.4: 数据正确但分析流于表面，未揭示深层风险
- 0.2: 关键比率计算错误或结论与数据矛盾

<input_financial_data>
{inputs}
</input_financial_data>

<balance_sheet_output>
{outputs}
</balance_sheet_output>
`;
```

#### 3.3.3 Cash Flow Agent 专用评估

```typescript
export const CASH_FLOW_EVAL_PROMPT = `
你是现金流量表分析质量评审专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * 经营/投资/筹资三项现金流分别分析，趋势判断有数据支撑
  * profitCashRatio（利润现金比）分析清晰
  * 资本支出与折旧摊销的关系被正确评估
  * 自由现金流（FCFF/FCFE）计算逻辑正确
  * cashCycle 分析了营运资本变化
  * highlights 基于具体数据而非空洞总结

- 0.7: 三项现金流分析完整，但 FCFF/FCFE 或利润现金比分析不够深入
- 0.4: 仅描述了现金流方向，未做深层质量分析
- 0.2: 现金流方向判断错误或关键指标缺失

<input_financial_data>
{inputs}
</input_financial_data>

<cash_flow_output>
{outputs}
</cash_flow_output>
`;
```

#### 3.3.4 Earnings Quality Agent 专用评估

```typescript
export const EARNINGS_QUALITY_EVAL_PROMPT = `
你是盈余质量审计专家。这是一个综合性Agent，需要交叉验证利润表、资产负债表和现金流的数据。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * profitVsCash.comparison 正确比较了净利润与经营现金流的差异
  * discrepancyReasons 给出了差异的具体财务原因（应收账款变动、存货变化等）
  * workingCapitalQuality 分析了应收/存货/应付的异常变动
  * earningsManipulationRisk 评估了盈余操纵的可能性
  * redFlags 和 greenFlags 每一条都有具体数据支撑
  * earningsGrade 评级与整体分析一致

- 0.7: 交叉验证逻辑正确，但盈余操纵风险分析不够细致
- 0.4: 只是简单对比了利润和现金流，未深入分析差异原因
- 0.2: 交叉验证逻辑有误或忽略了重要的盈余质量信号

<previous_agent_results>
{inputs}
</previous_agent_results>

<earnings_quality_output>
{outputs}
</earnings_quality_output>
`;
```

#### 3.3.5 Risk Agent 专用评估

```typescript
export const RISK_EVAL_PROMPT = `
你是企业风险评估审核专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * 四类风险（债务/流动性/经营/市场）均有独立分析
  * 每类风险的 level 评级有数据支撑
  * keyIndicators/keyFactors 引用了具体财务指标数值
  * riskMatrix 的概率/影响评估与详细分析一致
  * recommendations 具体可操作而非泛泛而谈
  * stressTest（流动性压力测试）分析了极端情景

- 0.7: 风险分类全面，但某类风险分析偏浅
- 0.4: 风险识别完整但分析停留在定性层面，缺乏定量支撑
- 0.2: 风险等级判断与数据不符，或遗漏重要风险类别

<previous_agent_results>
{inputs}
</previous_agent_results>

<risk_output>
{outputs}
</risk_output>
`;
```

#### 3.3.6 Business Insight Agent 专用评估

```typescript
export const BUSINESS_INSIGHT_EVAL_PROMPT = `
你是业务洞察分析评审专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * summary 精准概括了业务发展核心趋势
  * businessStructureAnalysis 详细分析了产品/渠道/区域收入结构
  * profitabilityBySegment 区分了高/低毛利业务并分析原因
  * competitiveAnalysis 的竞争优势/威胁有具体证据
  * swot 分析四个象限各至少3条有数据支撑的点
  * growthAnalysis 基于历史数据做出了合理的增长预判

- 0.7: 业务分析全面但 SWOT 部分偏套路化
- 0.4: 业务描述准确但缺乏战略层面的深入洞察
- 0.2: 业务分析与财务数据脱节，或主要依赖模型自身知识而非输入数据

<input_data>
{inputs}
</input_data>

<business_insight_output>
{outputs}
</business_insight_output>
`;
```

#### 3.3.7 Business Model Agent 专用评估

```typescript
export const BUSINESS_MODEL_EVAL_PROMPT = `
你是商业模式和护城河分析评审专家（巴菲特/芒格投资视角）。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * moatAnalysis 准确识别了护城河类型（品牌/成本/网络效应/转换成本/规模优势）
  * primaryMoat 的 evidence 包含具体财务证据（如高毛利=品牌溢价、高用户留存=转换成本）
  * moatTrend 判断了护城河是在加强还是削弱
  * businessModel 清晰描述了价值主张和收入模式
  * cultureAndGovernance 评估了管理层能力和治理结构
  * investmentImplication 将护城河分析转化为投资含义

- 0.7: 护城河识别正确但 evidence 部分偏弱
- 0.4: 护城河类型正确但分析停留在教科书层面
- 0.2: 护城河判断明显错误（如将周期性企业判断为有网络效应）

<input_data>
{inputs}
</input_data>

<business_model_output>
{outputs}
</business_model_output>
`;
```

#### 3.3.8 Forecast Agent 专用评估

```typescript
export const FORECAST_EVAL_PROMPT = `
你是财务预测质量评审专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * summary.forecastBasis 明确说明了预测的数据基础
  * confidence 评级与 dataQuality 一致
  * scenarioAnalysis 三种情景（乐观/中性/悲观）概率合理（总和约100%）
  * shortTerm 预测有具体数值和关键假设
  * catalysts 正面/负面催化剂具体且与业务相关
  * forecastRisks 识别了预测偏差的主要来源
  * 如果 hasPerformanceForecast/hasExpressReport 为 true，分析中引用了这些数据

- 0.7: 预测框架完整但情景分析的概率分配不够合理
- 0.4: 预测过于依赖简单趋势外推，缺乏驱动因素分析
- 0.2: 预测数值与历史趋势明显矛盾或信心评估与数据质量不匹配

<input_data>
{inputs}
</input_data>

<forecast_output>
{outputs}
</forecast_output>
`;
```

#### 3.3.9 Valuation Agent 专用评估

```typescript
export const VALUATION_EVAL_PROMPT = `
你是估值分析质量评审专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * relativeValuation 三维度（PE/PB/PS）分析各包含当前值、历史均值、行业均值
  * isAttractive 判断与估值数据一致
  * intrinsicValue 的 DCF 估算方法透明，假设合理
  * marginOfSafety 概念正确使用
  * marketSentiment 分析了换手率和量比等技术指标
  * investmentImplication 将估值分析转化为具体的买入/持有/卖出建议
  * priceTarget 有定量依据而非随意猜测

- 0.7: 相对估值分析完整，但内在价值分析偏简略
- 0.4: 估值方法单一（仅用 PE），缺乏多角度交叉验证
- 0.2: 估值结论与数据矛盾（如 PE 远高于行业却判断低估）

<input_data>
{inputs}
</input_data>

<valuation_output>
{outputs}
</valuation_output>
`;
```

#### 3.3.10 Final Conclusion Agent 专用评估

```typescript
export const FINAL_CONCLUSION_EVAL_PROMPT = `
你是投资报告终审专家。这是 12 个 Agent 中最重要的最终输出。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * summary.score (0-100) 与整体分析一致
  * recommendation 明确（强烈推荐/推荐/中性/谨慎/回避）
  * companyQuality 评估综合了前面所有 Agent 的核心发现
  * investmentValue 的 hasLongTermValue 判断有充分论据
  * riskAssessment.keyRisks 与 Risk Agent 的输出一致但更精炼
  * recommendation.action 与 Valuation Agent 的估值结论一致
  * keyTakeaways 精炼到 5-7 条最核心的投资要点
  * monitoringPoints 具体到可跟踪的指标或事件

- 0.7: 结论与前序分析一致，但综合提炼不够精炼
- 0.4: 结论正确但像是简单拼接前面分析，缺乏独立的综合判断
- 0.2: 结论与前面某些 Agent 的分析矛盾，或评分/建议不一致

<all_agent_results>
{inputs}
</all_agent_results>

<final_conclusion_output>
{outputs}
</final_conclusion_output>
`;
```

#### 3.3.11 Trend Interpretation Agent 专用评估

```typescript
export const TREND_INTERPRETATION_EVAL_PROMPT = `
你是财务趋势分析质量评审专家。

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * 8 个指标（净利润/营收/营业利润/EPS/毛利率/净利率/ROE/资产负债率）全部分析
  * latestValue 和 latestPeriod 与输入数据一致
  * yoyChange 计算正确
  * trend 和 trendLabel 与实际数据走向匹配
  * insight 不是简单复述趋势而是解释了背后原因
  * concerns 识别了趋势中的潜在风险
  * peakInfo 正确标注了历史峰值信息

- 0.7: 8 个指标趋势判断正确，但 insight 部分偏浅
- 0.4: 趋势方向正确但数值存在误差
- 0.2: 趋势判断错误或与输入数据矛盾

<input_financial_data>
{inputs}
</input_financial_data>

<trend_output>
{outputs}
</trend_output>
`;
```

### 3.4 结构化输出评估：createJsonMatchEvaluator 方案

除了 LLM-as-Judge 的定性评估，我们还需要字段级的结构化评估。OpenEvals 的 `createJsonMatchEvaluator` 可以实现这一点。

#### 3.4.1 精确匹配 + LLM Rubric 混合策略

```typescript
import { createJsonMatchEvaluator } from 'openevals';

// 示例：评估 Profitability Agent 输出
const profitabilityEvaluator = createJsonMatchEvaluator({
  // 对数值型字段用精确匹配（与参考答案对比）
  // 对文本型字段用 LLM rubric 评估质量
  rubric: {
    'summary.revenueGrowth': '是否给出了准确的百分比数值，如"8.70%"而非笼统的"增长"？',
    'summary.grossMargin': '是否给出了准确的百分比数值？',
    'summary.netMargin': '是否给出了准确的百分比数值？',
    'summary.profitTrend': '是否给出了明确的趋势判断（增长/稳定/下降），而非模糊描述？',
    'summary.oneSentence': '是否在30字以内精准概括了核心结论？',
    'detailedAnalysis.revenueAnalysis.trend': '是否包含100字以上实质性趋势分析？',
    'detailedAnalysis.revenueAnalysis.drivers': '是否识别了至少2个具体的增长/下降驱动因素？',
    'detailedAnalysis.profitabilityAnalysis.costControl': '是否评估了费用率变化趋势？',
    'detailedAnalysis.competitivePosition.moat': '是否给出了明确的竞争优势/劣势判断？',
  },
  // 不评估的字段（纯列表型字段直接看数量即可）
  excludeKeys: [],
  aggregator: 'average',
  model: 'openai:gpt-4.1',
  useReasoning: true,
});
```

#### 3.4.2 各 Agent 字段级评估 Rubric 汇总

| Agent | 精确匹配字段 | LLM Rubric 字段 | 数量检查字段 |
|---|---|---|---|
| Planning | `reportType`, `estimatedTime` | `dataQuality`, `analysisSequence` | `keyHighlights≥2`, `riskFlags≥1` |
| Profitability | `summary.revenueGrowth` | `detailedAnalysis.*` (9个子字段) | `keyMetrics≥5`, `risks≥2` |
| Balance Sheet | `summary.debtRatio`, `currentRatio`, `quickRatio` | `detailedAnalysis.*` (9个子字段) | `keyMetrics≥5` |
| Cash Flow | `summary.operatingCashFlow` | `detailedAnalysis.*` (10个子字段) | `keyMetrics≥4` |
| Earnings Quality | - | `summary.*`, `detailedAnalysis.*` (9个子字段) | `redFlags≥1`, `greenFlags≥1` |
| Risk | - | `summary.*`, `detailedAnalysis.*` (16个子字段) | `riskMatrix≥3`, `recommendations≥2` |
| Business Insight | - | `summary.*`, `detailedAnalysis.*` (12个子字段) | `swot.*≥2` each |
| Business Model | - | `moatAnalysis.*`, `businessModel.*` | `evidence≥2`, `moatThreats≥1` |
| Forecast | `managementGuidance.hasGuidance` | `summary.*`, `detailedForecast.*` | `catalysts.*≥2`, `forecastRisks≥2` |
| Valuation | `relativeValuation.*.isAttractive` | `intrinsicValue.*`, `investmentImplication.*` | `risks≥2`, `catalysts≥2` |
| Final Conclusion | `summary.score` (数值范围), `investmentValue.hasLongTermValue` | `companyQuality.*`, `recommendation.*` | `keyTakeaways≥3`, `monitoringPoints≥3` |
| Trend Interpretation | `*.latestValue`, `*.yoyDirection` | `*.insight`, `*.concerns` | 8个指标全量 |

---

## 四、Layer 3：端到端报告评估

### 4.1 Trajectory 评估：Agent 执行路径

借鉴 `agentevals` 的 Trajectory LLM-as-Judge，我们将 12 Agent 的 4 阶段执行视为一个"trajectory"。

```typescript
export const ANALYSIS_TRAJECTORY_PROMPT = `
你是财务分析流程审核专家。评估以下多Agent分析流程的执行质量。

执行阶段：
- Phase 1（并行）: 利润表分析、资产负债表分析、现金流分析
- Phase 2（依赖Phase 1）: 盈余质量、风险评估、业务洞察
- Phase 3（依赖Phase 1+2）: 商业模式、预测、估值
- Phase 4（依赖全部）: 最终结论

评分标准（0-1 浮点分）：
- 1.0 优秀：
  * Phase 2 的分析明显引用了 Phase 1 的数据和结论
  * Phase 3 的预测基于 Phase 1+2 的发现
  * Phase 4 的结论综合了所有 Phase 的核心洞察
  * 各 Agent 之间数据引用一致（如毛利率数值一致）
  * 没有 Agent 之间的结论矛盾

- 0.5: Agent 间有一定关联但引用关系不够紧密
- 0.0: Agent 各自独立分析，看不出依赖关系

<trajectory>
{outputs}
</trajectory>
`;
```

### 4.2 跨 Agent 一致性检查

```typescript
export const CROSS_AGENT_CONSISTENCY_PROMPT = `
你是财务报告一致性审核专家。检查以下多个分析Agent的输出是否在核心数据和结论上保持一致。

检查项：
1. 【数值一致性】不同Agent引用的同一指标（如净利率、营收增长率）是否一致
2. 【风险判断一致性】Risk Agent vs Final Conclusion 的风险评级是否匹配
3. 【估值结论一致性】Valuation Agent 的建议 vs Final Conclusion 的推荐是否一致
4. 【趋势一致性】Trend Agent vs Profitability Agent 的趋势判断是否一致
5. 【评分合理性】Final Conclusion 的 score 是否与各维度分析吻合

评分标准（0-1 浮点分）：
- 1.0: 完全一致，数据引用精确匹配
- 0.7: 核心结论一致，但某些数值存在微小差异（如四舍五入）
- 0.4: 主要结论一致但存在 1-2 处明显矛盾
- 0.0: 存在严重矛盾（如利润分析说增长强劲但结论给低分）

<agent_outputs>
{outputs}
</agent_outputs>
`;
```

---

## 五、实施方案

### 5.1 技术选型

| 组件 | 选择 | 理由 |
|---|---|---|
| **评估框架** | `openevals` (npm) | TypeScript 原生，与我们的代码库一致 |
| **Judge 模型** | GPT-4.1 / GPT-5 Nano | 作为 judge 需要比被评估模型更强或同等 |
| **结果存储** | 扩展 `model_evaluations` 表 | 复用现有基础设施 |
| **结果可视化** | 新增评估仪表板页面 | 集成到现有前端 |
| **CI/CD 集成** | 回归测试脚本 | Prompt 修改后自动评估 |

### 5.2 数据库 Schema 扩展

```sql
-- 新增：Agent 输出评估表（Layer 2）
CREATE TABLE IF NOT EXISTS agent_output_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  model_key TEXT NOT NULL,
  
  -- 6 维评分（0-1 浮点）
  data_accuracy_score REAL,           -- 数据准确性
  analysis_depth_score REAL,          -- 分析深度
  professional_insight_score REAL,    -- 专业洞察
  logical_consistency_score REAL,     -- 逻辑一致性
  expression_quality_score REAL,      -- 表达质量
  hallucination_score REAL,           -- 幻觉/捏造（1=无幻觉，0=严重捏造）
  
  -- 加权综合分
  weighted_total_score REAL,          -- 加权后总分（0-1）
  
  -- 结构化输出评估
  field_level_scores TEXT,            -- JSON: 字段级评分 {"summary.revenueGrowth": 0.9, ...}
  field_rubric_feedback TEXT,         -- JSON: 字段级 LLM 评估理由
  
  -- 评估元数据
  judge_model TEXT NOT NULL,          -- 评审模型
  judge_latency_ms INTEGER,           -- 评审耗时
  judge_cost_usd REAL,                -- 评审成本
  eval_mode TEXT DEFAULT 'sampling',  -- sampling | batch | regression | comparison
  
  -- LLM 评审原始反馈
  accuracy_feedback TEXT,             -- 准确性评审理由
  depth_feedback TEXT,                -- 深度评审理由
  insight_feedback TEXT,              -- 洞察评审理由
  consistency_feedback TEXT,          -- 一致性评审理由
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id)
);

-- 新增：报告级评估表（Layer 3）
CREATE TABLE IF NOT EXISTS report_level_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  
  -- 轨迹评估
  trajectory_score REAL,              -- Agent 执行路径合理性（0-1）
  trajectory_feedback TEXT,           -- 轨迹评审理由
  
  -- 跨 Agent 一致性
  cross_consistency_score REAL,       -- 跨 Agent 数据一致性（0-1）
  consistency_feedback TEXT,          -- 一致性评审理由
  inconsistencies TEXT,               -- JSON: 发现的不一致项列表
  
  -- 综合报告质量
  overall_report_score REAL,          -- 综合质量分（0-1）
  
  -- 评估元数据
  judge_model TEXT NOT NULL,
  judge_total_cost_usd REAL,
  eval_mode TEXT DEFAULT 'batch',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id)
);

-- 新增：评估基准数据集表
CREATE TABLE IF NOT EXISTS evaluation_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  report_type TEXT NOT NULL,          -- annual | quarterly
  
  -- 标准输入
  input_data TEXT NOT NULL,           -- JSON: 标准化输入数据
  
  -- 参考答案（人工审核过的"金标准"分析结果）
  reference_outputs TEXT,             -- JSON: 各 Agent 的参考输出
  
  -- 元数据
  difficulty_level TEXT DEFAULT 'medium', -- easy | medium | hard
  industry TEXT,
  tags TEXT,                          -- JSON: ["高增长", "周期性", "ST风险"] 等标签
  created_by TEXT,                    -- 创建者
  reviewed_by TEXT,                   -- 审核者
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_agent_eval_report ON agent_output_evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_agent_eval_agent ON agent_output_evaluations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_eval_model ON agent_output_evaluations(model_key);
CREATE INDEX IF NOT EXISTS idx_report_eval_report ON report_level_evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_company ON evaluation_benchmarks(company_code);
```

### 5.3 TypeScript 实现架构

```
src/
  evaluation/
    index.ts                 # 评估框架入口
    evaluators/
      common.ts              # 通用评估器（幻觉、深度、一致性）
      profitability.ts       # 利润表专用评估
      balance-sheet.ts       # 资产负债表专用评估
      cash-flow.ts           # 现金流专用评估
      earnings-quality.ts    # 盈余质量专用评估
      risk.ts                # 风险评估专用评估
      business-insight.ts    # 业务洞察专用评估
      business-model.ts      # 商业模式专用评估
      forecast.ts            # 预测专用评估
      valuation.ts           # 估值专用评估
      final-conclusion.ts    # 最终结论专用评估
      trend.ts               # 趋势解读专用评估
    report-evaluator.ts      # Layer 3 报告级评估
    benchmark-manager.ts     # 基准数据集管理
    eval-runner.ts           # 评估任务调度器
    prompts.ts               # 所有评估 prompt 集中管理
    types.ts                 # 评估类型定义
```

### 5.4 核心代码实现示例

#### 5.4.1 Agent 输出评估器

```typescript
// src/evaluation/evaluators/common.ts
import { createLLMAsJudge } from 'openevals';
import {
  FINANCIAL_HALLUCINATION_PROMPT,
  FINANCIAL_ANALYSIS_DEPTH_PROMPT,
  FINANCIAL_LOGICAL_CONSISTENCY_PROMPT,
} from '../prompts';

export interface AgentEvalResult {
  agentType: string;
  scores: {
    dataAccuracy: number;
    analysisDepth: number;
    professionalInsight: number;
    logicalConsistency: number;
    expressionQuality: number;
    hallucination: number;
  };
  weightedTotal: number;
  fieldLevelScores: Record<string, number>;
  feedback: {
    accuracy: string;
    depth: string;
    insight: string;
    consistency: string;
  };
  judgeModel: string;
  judgeLatencyMs: number;
  judgeCostUsd: number;
}

// 权重配置
const EVAL_WEIGHTS = {
  dataAccuracy: 0.25,
  analysisDepth: 0.25,
  professionalInsight: 0.20,
  logicalConsistency: 0.15,
  expressionQuality: 0.10,
  hallucination: 0.05,
};

export function createCommonEvaluators(judgeModel: string = 'openai:gpt-4.1') {
  const hallucinationEvaluator = createLLMAsJudge({
    prompt: FINANCIAL_HALLUCINATION_PROMPT,
    model: judgeModel,
    feedbackKey: 'hallucination',
    continuous: true,  // 0-1 浮点分
  });

  const depthEvaluator = createLLMAsJudge({
    prompt: FINANCIAL_ANALYSIS_DEPTH_PROMPT,
    model: judgeModel,
    feedbackKey: 'analysis_depth',
    continuous: true,
  });

  const consistencyEvaluator = createLLMAsJudge({
    prompt: FINANCIAL_LOGICAL_CONSISTENCY_PROMPT,
    model: judgeModel,
    feedbackKey: 'logical_consistency',
    continuous: true,
  });

  return { hallucinationEvaluator, depthEvaluator, consistencyEvaluator };
}
```

#### 5.4.2 评估任务调度器

```typescript
// src/evaluation/eval-runner.ts
import type { AgentEvalResult } from './evaluators/common';

export interface EvalRunConfig {
  mode: 'sampling' | 'batch' | 'regression' | 'comparison';
  reportIds?: number[];
  agentTypes?: string[];
  judgeModel?: string;
  samplingRate?: number;  // 0-1, 用于 sampling 模式
}

export class EvalRunner {
  private db: D1Database;
  private vectorEngine: VectorEngineService;
  
  constructor(db: D1Database, vectorEngine: VectorEngineService) {
    this.db = db;
    this.vectorEngine = vectorEngine;
  }

  /**
   * 实时轻量评估（每次分析完成后调用）
   * 只评估 hallucination + field completeness
   */
  async runRealtimeEval(
    reportId: number,
    agentType: string,
    input: string,
    output: string,
    model: string
  ): Promise<{ hallucination: number; fieldComplete: number }> {
    // 10% 抽样
    if (Math.random() > 0.1) {
      return { hallucination: -1, fieldComplete: -1 }; // -1 = 未评估
    }
    
    const evaluators = createCommonEvaluators();
    const start = Date.now();
    
    const result = await evaluators.hallucinationEvaluator({
      inputs: input,
      outputs: output,
    });
    
    const latency = Date.now() - start;
    
    // 存储到数据库
    await this.db.prepare(`
      INSERT INTO agent_output_evaluations 
      (report_id, agent_type, model_key, hallucination_score, judge_model, judge_latency_ms, eval_mode)
      VALUES (?, ?, ?, ?, ?, ?, 'sampling')
    `).bind(reportId, agentType, model, result.score, 'gpt-4.1', latency).run();
    
    return { hallucination: result.score, fieldComplete: 1 };
  }

  /**
   * 批量深度评估（定期任务）
   * 评估所有 6 个维度
   */
  async runBatchEval(config: EvalRunConfig): Promise<AgentEvalResult[]> {
    // 1. 获取待评估的报告
    const reports = await this.getReportsForEval(config);
    const results: AgentEvalResult[] = [];
    
    for (const report of reports) {
      for (const agentOutput of report.agentOutputs) {
        const evalResult = await this.evaluateAgentOutput(
          report.id,
          agentOutput.agentType,
          agentOutput.input,
          agentOutput.output,
          agentOutput.model,
          config.judgeModel || 'openai:gpt-4.1'
        );
        results.push(evalResult);
      }
      
      // Layer 3: 报告级评估
      await this.evaluateReportLevel(report);
    }
    
    return results;
  }

  /**
   * 回归测试（Prompt 修改后）
   * 在固定基准数据集上运行全量评估
   */
  async runRegressionTest(benchmarkIds?: number[]): Promise<{
    before: AgentEvalResult[];
    after: AgentEvalResult[];
    regressions: string[];
  }> {
    const benchmarks = await this.loadBenchmarks(benchmarkIds);
    // 对比 before/after 分数，检测退化
    // ...
  }
}
```

### 5.5 评估成本估算

| 评估模式 | 每次评估的 LLM 调用 | 预估 Token | 预估成本 |
|---|---|---|---|
| **实时抽样** (10%) | 1次（幻觉检测） | ~4K input + ~500 output | ~$0.01 |
| **单Agent深度评估** | 6次（6个维度） | ~25K input + ~3K output | ~$0.06 |
| **全报告深度评估** (12 Agent) | 72次 + 2次报告级 | ~300K input + ~40K output | ~$0.80 |
| **模型对比评估** (3 模型) | ~220次 | ~900K input + ~120K output | ~$2.50 |

按每日 100 次分析计算：
- 实时抽样成本：~$0.10/天
- 每日深度评估（抽10份）：~$8/天
- 每周回归测试：~$5/次

**月度总评估成本：~$100-200，占 API 总成本的 3-5%，性价比极高。**

---

## 六、金标准基准数据集构建

### 6.1 数据集设计

```
evaluation_benchmarks/
  easy/
    贵州茅台_annual.json      # 白酒龙头，财务稳健，容易分析
    宁德时代_annual.json      # 新能源龙头，高增长
  medium/
    美的集团_annual.json      # 制造业，多业务线
    中国平安_annual.json      # 金融综合，复杂报表
  hard/
    恒大地产_quarterly.json   # 债务危机，风险识别难度大
    ST某某_quarterly.json     # ST 风险，盈余操纵嫌疑
    某周期股_quarterly.json   # 周期底部，预测困难
```

### 6.2 参考答案制作流程

```
1. 选取代表性公司 → 获取真实财务数据
2. 运行当前最强模型 (GPT-4.1) 生成分析
3. CFA 持证分析师审核并修正：
   - 校正数值错误
   - 增补遗漏的深度分析
   - 标注关键洞察和风险点
   - 评估护城河和估值合理性
4. 形成"金标准"参考答案
5. 每季度更新数据和答案
```

### 6.3 数据集规模规划

| 阶段 | 数量 | 行业覆盖 | 难度分布 |
|---|---|---|---|
| Phase 1 (MVP) | 10 家公司 | 5 个行业 | 4 easy + 4 medium + 2 hard |
| Phase 2 | 30 家公司 | 15 个行业 | 10 + 12 + 8 |
| Phase 3 | 100 家公司 | 30+ 个行业 | 30 + 40 + 30 |

---

## 七、评估结果应用

### 7.1 模型选择优化

```typescript
// 基于评估结果自动优化 Agent-Model 映射
async function optimizeModelRouting(evalResults: AgentEvalResult[]) {
  const modelScores: Record<string, Record<string, number>> = {};
  
  for (const result of evalResults) {
    const key = `${result.agentType}_${result.model}`;
    if (!modelScores[result.agentType]) {
      modelScores[result.agentType] = {};
    }
    modelScores[result.agentType][result.model] = result.weightedTotal;
  }
  
  // 为每个 Agent 选择最优模型
  const optimalRouting: Record<string, string> = {};
  for (const [agent, scores] of Object.entries(modelScores)) {
    optimalRouting[agent] = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0][0];
  }
  
  return optimalRouting;
}
```

### 7.2 Prompt 优化指导

评估反馈直接指导 prompt 改进：

```
评估发现：BUSINESS_MODEL Agent 的 moatAnalysis.evidence 经常评分 < 0.5
↓
分析原因：prompt 中未明确要求"基于财务数据的护城河证据"
↓
优化 prompt：增加 "请基于以下财务指标证明护城河的存在：高毛利率(>X%)、ROE持续(>Y%)..."
↓
回归测试：moatAnalysis.evidence 评分提升至 0.75
```

### 7.3 质量监控告警

```typescript
// 质量退化告警规则
const ALERT_RULES = {
  // 单次分析告警
  singleReport: {
    hallucinationBelow: 0.5,       // 幻觉分 < 0.5 告警
    weightedTotalBelow: 0.4,       // 综合分 < 0.4 告警
    crossConsistencyBelow: 0.5,    // 跨Agent一致性 < 0.5 告警
  },
  // 趋势告警（7日均值）
  trend: {
    scoreDropPercent: 0.15,         // 7日均分下降 >15% 告警
    hallucinationRisePercent: 0.2,  // 幻觉率上升 >20% 告警
  },
};
```

---

## 八、与 Agent Trace 系统的集成

### 8.1 数据流向

```
用户发起分析
    ↓
Orchestrator 执行 12 Agents（Trace 系统记录 span）
    ↓
每个 Agent 输出保存到 Trace Span
    ↓
[实时] 10% 抽样 → 轻量评估 → agent_output_evaluations
    ↓
[定期] 批量任务 → 深度评估 → agent_output_evaluations + report_level_evaluations
    ↓
前端 Trace 详情页展示评估分数
```

### 8.2 Trace UI 集成

在 Agent Trace 详情页的 "质量评估" Tab 中展示：

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Agent 质量评估                    评审模型: GPT-4.1  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  综合评分: ████████████████░░░░  0.82 / 1.0            │
│                                                         │
│  ┌─ 维度评分 ──────────────────────────────────────┐   │
│  │ 数据准确性    ██████████████████░░  0.90        │   │
│  │ 分析深度      ████████████████░░░░  0.78        │   │
│  │ 专业洞察      █████████████████░░░  0.85        │   │
│  │ 逻辑一致性    ████████████████░░░░  0.80        │   │
│  │ 表达质量      ██████████████████░░  0.88        │   │
│  │ 无幻觉        ███████████████████░  0.95        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ 字段级评估 ────────────────────────────────────┐   │
│  │ summary.revenueGrowth    ✅ 0.95  准确匹配     │   │
│  │ summary.oneSentence      ✅ 0.88  简洁有力     │   │
│  │ detailedAnalysis.trend   ⚠️ 0.65  深度不足     │   │
│  │ competitivePosition.moat ❌ 0.40  缺乏证据     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ 评审反馈 ─────────────────────────────────────┐    │
│  │ 📝 准确性: 核心财务指标数值与输入数据一致，     │    │
│  │    但行业对比数据缺乏具体来源。                 │    │
│  │ 📝 深度: revenueAnalysis.trend 仅描述了方向，   │    │
│  │    未分析增长率变化的具体驱动因素。              │    │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 九、开发计划

### 9.1 阶段规划

| 阶段 | 内容 | 预计工时 | 优先级 |
|---|---|---|---|
| **P0: 评估基础设施** | 安装 openevals，创建 DB schema，实现 types.ts 和 prompts.ts | 3天 | 🔴 高 |
| **P1: 通用评估器** | 实现 3 个通用维度评估（幻觉/深度/一致性），接入实时抽样 | 4天 | 🔴 高 |
| **P2: Agent 专用评估** | 为 12 个 Agent 编写专用评估 prompt + 字段级评估 | 5天 | 🟡 中 |
| **P3: 报告级评估** | 实现 Trajectory + Cross-consistency 评估 | 3天 | 🟡 中 |
| **P4: 金标准数据集** | 构建 10 家公司的基准数据集 | 5天 | 🟡 中 |
| **P5: 前端可视化** | 评估仪表板 + Trace 集成 | 4天 | 🟢 低 |
| **P6: 自动化流水线** | 批量评估任务、回归测试、告警 | 3天 | 🟢 低 |

总计预估：**~27 个工作日**

### 9.2 P0 具体任务

```
□ npm install openevals agentevals
□ 创建 migration: 0018_evaluation_framework.sql
□ 创建 src/evaluation/types.ts — 评估类型定义
□ 创建 src/evaluation/prompts.ts — 所有评估 prompt
□ 创建 src/evaluation/evaluators/common.ts — 通用评估器
□ 创建 src/evaluation/eval-runner.ts — 调度器骨架
□ 在 orchestrator.ts 中预埋评估钩子（不影响现有流程）
```

### 9.3 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| Judge 模型自身幻觉 | 中 | 高 | 使用最强模型 + few-shot examples + 交叉验证 |
| 评估成本超预期 | 低 | 中 | 实时模式严格抽样，批量模式控制频率 |
| 评估耗时影响用户体验 | 低 | 高 | 评估全部异步执行，不阻塞分析流程 |
| 金标准答案本身有误 | 中 | 高 | 多人审核 + 定期更新 |
| openevals 版本升级不兼容 | 低 | 中 | 锁定版本 + 封装抽象层 |

---

## 十、OpenEvals 核心 API 速查表

### 10.1 LLM-as-Judge

```typescript
import { createLLMAsJudge, CONCISENESS_PROMPT } from 'openevals';

const evaluator = createLLMAsJudge({
  prompt: MY_PROMPT,          // f-string 或 ChatPromptTemplate
  model: 'openai:gpt-4.1',   // provider:model
  feedbackKey: 'my_metric',   // 返回结果的 key 名
  continuous: true,           // true=浮点分(0-1), false=布尔
  choices: [0, 0.25, 0.5, 0.75, 1.0], // 限定分数选项（与 continuous 二选一）
  system: '你是财务分析评审专家', // 可选系统消息
  fewShotExamples: [...],    // 可选少样本示例
});

const result = await evaluator({
  inputs: '...',      // 输入数据
  outputs: '...',     // Agent 输出
  referenceOutputs: '...', // 可选参考答案
});
// result: { key: 'my_metric', score: 0.85, comment: '...' }
```

### 10.2 结构化输出评估

```typescript
import { createJsonMatchEvaluator } from 'openevals';

const evaluator = createJsonMatchEvaluator({
  rubric: {
    'summary.revenueGrowth': '是否是准确的百分比数值？',
    'detailedAnalysis.trend': '是否有100字以上的实质性分析？',
  },
  excludeKeys: ['keyMetrics'],   // 不评估的字段
  aggregator: 'average',          // average | all | null
  model: 'openai:gpt-4.1',
  useReasoning: true,
});

const result = await evaluator({
  outputs: agentOutput,
  referenceOutputs: referenceAnswer,  // 可选
});
```

### 10.3 Agent Trajectory 评估

```typescript
import { createTrajectoryLLMAsJudge, TRAJECTORY_ACCURACY_PROMPT } from 'agentevals';

const evaluator = createTrajectoryLLMAsJudge({
  prompt: TRAJECTORY_ACCURACY_PROMPT,
  model: 'openai:gpt-4.1',
  continuous: true,
});

const result = await evaluator({
  outputs: trajectoryMessages, // OpenAI 格式消息数组
});
```

### 10.4 预置 Prompt 列表

| 类别 | Prompt 名称 | 用途 |
|---|---|---|
| Quality | `CONCISENESS_PROMPT` | 简洁性 |
| Quality | `CORRECTNESS_PROMPT` | 正确性 |
| Quality | `HALLUCINATION_PROMPT` | 幻觉检测 |
| Quality | `ANSWER_RELEVANCE_PROMPT` | 相关性 |
| Quality | `PLAN_ADHERENCE_PROMPT` | 计划遵循 |
| Safety | `TOXICITY_PROMPT` | 有害内容 |
| RAG | `RAG_HELPFULNESS_PROMPT` | 回答有用性 |
| RAG | `RAG_GROUNDEDNESS_PROMPT` | 依据性 |
| RAG | `RAG_RETRIEVAL_RELEVANCE_PROMPT` | 检索相关性 |
| Trajectory | `TRAJECTORY_ACCURACY_PROMPT` | 轨迹准确性 |

---

## 十一、与现有 model_evaluations 的兼容策略

### 11.1 渐进式升级

```
Phase 1: 新增表 agent_output_evaluations，与 model_evaluations 并行
         → model_evaluations 继续记录 Layer 1 基础指标
         → agent_output_evaluations 记录 Layer 2+3 深度评估

Phase 2: 在 model_evaluations 中增加关联字段
         ALTER TABLE model_evaluations ADD COLUMN eval_id INTEGER;
         → 可从 Layer 1 表直接跳转到对应的 Layer 2 详情

Phase 3: 前端统一仪表板
         → 左侧列表展示 model_evaluations（性能视角）
         → 右侧详情展示 agent_output_evaluations（质量视角）
```

### 11.2 数据迁移

无需迁移历史数据。新评估系统从上线日期开始积累评估结果，约 1 个月后即可建立有意义的统计基线。

---

## 十二、总结

### 12.1 OpenEvals 借鉴价值总结

| 借鉴项 | 适用性 | 改造工作量 | 预期收益 |
|---|---|---|---|
| **LLM-as-Judge 框架** | ⭐⭐⭐⭐⭐ 完美适用 | 低（直接用） | 从0到1获得质量评估能力 |
| **HALLUCINATION_PROMPT** | ⭐⭐⭐⭐ 可直接用 | 极低 | 捕获数据捏造问题 |
| **createJsonMatchEvaluator** | ⭐⭐⭐⭐⭐ 完美匹配 | 中（写 rubric） | 字段级精细评估 |
| **Trajectory 评估** | ⭐⭐⭐ 需要适配 | 中 | 评估 4 阶段执行合理性 |
| **Custom Prompt + continuous** | ⭐⭐⭐⭐⭐ 核心工具 | 高（12套prompt） | 专业财务分析质量把关 |
| **LangSmith 集成** | ⭐⭐ 可选 | 低 | 长期追踪（需要LangSmith账号） |
| **Few-shot Examples** | ⭐⭐⭐⭐ 提升judge准确性 | 中（需要参考答案） | Judge 评分更可靠 |
| **Benchmark 数据集** | ⭐⭐⭐⭐⭐ 必须有 | 高（人工审核） | 回归测试和模型对比的基础 |

### 12.2 最终建议

1. **立即可做**：引入 `openevals`，先用 `HALLUCINATION_PROMPT` 做实时抽样检测
2. **1-2周内**：编写 12 套 Agent 专用评估 prompt，建立字段级评估
3. **1个月内**：构建 10 家公司金标准数据集，跑通回归测试流程
4. **持续迭代**：基于评估反馈优化 Agent prompt，形成"评估-优化-再评估"闭环

**核心价值：将模型质量从"感觉"变成"数字"，从"猜测"变成"可衡量"。**
