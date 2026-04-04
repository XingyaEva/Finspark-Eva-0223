/**
 * OpenEvals 风格评估 Prompt 集合
 * 
 * 基于 OpenEvals (langchain-ai/openevals) 的 LLM-as-Judge 模式
 * 为 FinSpark 12-Agent 编排器提供三层评估:
 * - Layer 1: 基础指标 (JSON合规、字段完整率、延迟) — 已有
 * - Layer 2: Agent 输出质量 (6维度评估) — 本文件实现
 * - Layer 3: 报告级评估 (跨Agent一致性、轨迹评估) — 本文件实现
 * 
 * 评估维度权重:
 *   data_accuracy: 25%
 *   analysis_depth: 25%
 *   professional_insight: 20%
 *   logical_consistency: 15%
 *   expression_quality: 10%
 *   hallucination: 5%
 */

// ============ 通用评估 Prompt (所有 Agent 共享) ============

/**
 * 财务分析幻觉检测 (hallucination)
 * 检测 AI 生成的财务分析中是否存在数据捏造和过度推断
 */
export const FINANCIAL_HALLUCINATION_PROMPT = `你是资深财务审计专家，负责检测 AI 生成的财务分析报告中是否存在"数据捏造"和"过度推断"。

你必须以JSON格式返回评估结果，格式如下:
{"score": <0到1的浮点数>, "reasoning": "<评估理由>"}

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
4. 预测性表述是否使用了不确定性修饰词
5. 是否出现了输入数据中不存在的具体公司名、具体数字

<input_data>
{inputs}
</input_data>

<agent_output>
{outputs}
</agent_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/**
 * 分析深度评估 (analysis_depth)
 */
export const FINANCIAL_ANALYSIS_DEPTH_PROMPT = `你是CFA持证分析师，负责评估 AI 财务分析的深度和专业性。

你必须以JSON格式返回评估结果，格式如下:
{"score": <0到1的浮点数>, "reasoning": "<评估理由>"}

评分标准（0-1 浮点分）：
- 1.0: 分析层次丰富，包含因果归因、跨期比较、行业基准对比、前瞻判断
- 0.8: 分析有因果逻辑，但缺少某一维度的深入展开
- 0.6: 描述了数据变化但因果分析不足，更像"数据转述"
- 0.4: 主要是数据罗列，缺乏专业分析视角
- 0.2: 分析过于笼统，没有具体数据支撑
- 0.0: 纯属空话套话，无实质分析内容

评估维度：
1. 【数据利用率】是否充分利用了提供的财务数据
2. 【因果归因】是否解释了"为什么"而不只是"是什么"
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

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/**
 * 逻辑一致性评估 (logical_consistency)
 */
export const FINANCIAL_LOGICAL_CONSISTENCY_PROMPT = `你是财务逻辑审核专家，检查 AI 财务分析报告中的逻辑一致性。

你必须以JSON格式返回评估结果，格式如下:
{"score": <0到1的浮点数>, "reasoning": "<评估理由>"}

评分标准（0-1 浮点分）：
- 1.0: 各部分分析逻辑自洽，数据引用一致，结论与分析过程吻合
- 0.7: 基本逻辑通顺但存在 1-2 处小矛盾
- 0.4: 存在明显的逻辑矛盾（如分析说增长但结论说下降）
- 0.0: 严重逻辑混乱

检查要点：
1. summary 中的结论是否与 detailedAnalysis 中的具体分析一致
2. 数值在不同字段中引用时是否一致
3. 风险评估与数据表现是否匹配
4. 评级/评分是否与文字描述对应

<agent_output>
{outputs}
</agent_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/**
 * 表达质量评估 (expression_quality)
 */
export const FINANCIAL_EXPRESSION_QUALITY_PROMPT = `你是财务报告编辑专家，评估 AI 财务分析的表达质量。

你必须以JSON格式返回评估结果，格式如下:
{"score": <0到1的浮点数>, "reasoning": "<评估理由>"}

评分标准（0-1 浮点分）：
- 1.0: 语言专业精炼，结构清晰，重点突出，无冗余
- 0.8: 表达专业但部分段落偏冗长
- 0.5: 内容可读但缺乏专业术语或表达不够凝练
- 0.2: 表达混乱，重复较多，结构散乱
- 0.0: 语言质量极差，难以理解

评估维度：
1. 语言专业性：是否使用了正确的财务术语
2. 结构清晰性：段落组织是否合理
3. 简洁性：是否避免了不必要的冗余
4. 可操作性：结论是否明确可参考

<agent_output>
{outputs}
</agent_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


// ============ Agent 专用评估 Prompt ============

/** PROFITABILITY Agent */
export const PROFITABILITY_EVAL_PROMPT = `你是利润表分析质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：summary 给出准确增长率数值，毛利率/净利率包含多期对比趋势分析，detailedAnalysis 各子字段有100字以上实质性分析，keyMetrics 至少5个指标且 benchmark 有参考价值
- 0.7 良好：核心指标数值准确，趋势判断正确，但深度分析偏短
- 0.4 及格：结构完整但分析停留在数据转述层面
- 0.2 不及格：关键数值错误或与输入数据不符

<input_financial_data>
{inputs}
</input_financial_data>
<profitability_output>
{outputs}
</profitability_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** BALANCE_SHEET Agent */
export const BALANCE_SHEET_EVAL_PROMPT = `你是资产负债表分析质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：debtRatio/currentRatio/quickRatio 数值与输入一致，资产/负债/资本结构均深入分析，keyMetrics 至少5个
- 0.7: 核心比率正确，结构分析完整但深度不足
- 0.4: 数据正确但分析流于表面
- 0.2: 关键比率计算错误或结论与数据矛盾

<input_financial_data>
{inputs}
</input_financial_data>
<balance_sheet_output>
{outputs}
</balance_sheet_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** CASH_FLOW Agent */
export const CASH_FLOW_EVAL_PROMPT = `你是现金流量表分析质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：三项现金流分别分析且趋势有数据支撑，利润现金比分析清晰，FCFF/FCFE 计算逻辑正确
- 0.7: 三项现金流分析完整，但某些深入指标不够
- 0.4: 仅描述了现金流方向，未做深层质量分析
- 0.2: 现金流方向判断错误或关键指标缺失

<input_financial_data>
{inputs}
</input_financial_data>
<cash_flow_output>
{outputs}
</cash_flow_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** EARNINGS_QUALITY Agent */
export const EARNINGS_QUALITY_EVAL_PROMPT = `你是盈余质量审计专家。此Agent需要交叉验证利润表、资产负债表和现金流的数据。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：正确比较净利润与经营现金流差异，给出具体差异原因，分析了盈余操纵风险，redFlags/greenFlags 有数据支撑
- 0.7: 交叉验证逻辑正确，但盈余操纵分析不够细致
- 0.4: 只是简单对比了利润和现金流，未深入分析差异原因
- 0.2: 交叉验证逻辑有误或忽略了重要信号

<previous_agent_results>
{inputs}
</previous_agent_results>
<earnings_quality_output>
{outputs}
</earnings_quality_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** RISK Agent */
export const RISK_EVAL_PROMPT = `你是企业风险评估审核专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：四类风险均有独立分析，level 评级有数据支撑，recommendations 具体可操作
- 0.7: 风险分类全面，但某类风险分析偏浅
- 0.4: 风险识别完整但缺乏定量支撑
- 0.2: 风险等级判断与数据不符

<previous_agent_results>
{inputs}
</previous_agent_results>
<risk_output>
{outputs}
</risk_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** BUSINESS_INSIGHT Agent */
export const BUSINESS_INSIGHT_EVAL_PROMPT = `你是业务洞察分析评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：业务结构、竞争分析有具体证据，SWOT 各象限≥3条有数据支撑
- 0.7: 业务分析全面但 SWOT 偏套路化
- 0.4: 描述准确但缺乏战略洞察
- 0.2: 分析与财务数据脱节

<input_data>
{inputs}
</input_data>
<business_insight_output>
{outputs}
</business_insight_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** BUSINESS_MODEL Agent */
export const BUSINESS_MODEL_EVAL_PROMPT = `你是商业模式和护城河分析评审专家（巴菲特投资视角）。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：护城河类型识别正确且有财务数据证据，moatTrend 有判断，investmentImplication 实用
- 0.7: 护城河识别正确但 evidence 偏弱
- 0.4: 停留在教科书层面
- 0.2: 护城河判断明显错误

<input_data>
{inputs}
</input_data>
<business_model_output>
{outputs}
</business_model_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** FORECAST Agent */
export const FORECAST_EVAL_PROMPT = `你是财务预测质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：预测基础明确，情景分析概率合理（总和约100%），有催化剂和风险分析
- 0.7: 框架完整但情景概率分配不够合理
- 0.4: 过于依赖趋势外推，缺乏驱动因素分析
- 0.2: 预测与历史矛盾或信心评估与数据质量不匹配

<input_data>
{inputs}
</input_data>
<forecast_output>
{outputs}
</forecast_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** VALUATION Agent */
export const VALUATION_EVAL_PROMPT = `你是估值分析质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：PE/PB/PS 多维度分析含当前值/历史/行业对比，DCF 假设合理，有明确买入建议
- 0.7: 相对估值完整，但内在价值分析偏简略
- 0.4: 估值方法单一（仅用 PE）
- 0.2: 估值结论与数据矛盾

<input_data>
{inputs}
</input_data>
<valuation_output>
{outputs}
</valuation_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** FINAL_CONCLUSION Agent */
export const FINAL_CONCLUSION_EVAL_PROMPT = `你是投资报告终审专家。这是12个Agent中最重要的最终输出。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：score 与整体分析一致，recommendation 明确，companyQuality 综合了前面所有核心发现，keyTakeaways 精炼到5-7条
- 0.7: 结论与前序分析一致，但综合提炼不够精炼
- 0.4: 像是简单拼接前面分析，缺乏独立综合判断
- 0.2: 结论与前面Agent分析矛盾

<all_agent_results>
{inputs}
</all_agent_results>
<final_conclusion_output>
{outputs}
</final_conclusion_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** TREND_INTERPRETATION Agent */
export const TREND_INTERPRETATION_EVAL_PROMPT = `你是财务趋势分析质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：8个指标全部分析，latestValue 与输入一致，趋势和insight 不是简单复述
- 0.7: 趋势判断正确但 insight 偏浅
- 0.4: 趋势方向正确但数值有误差
- 0.2: 趋势判断错误或与输入矛盾

<input_financial_data>
{inputs}
</input_financial_data>
<trend_output>
{outputs}
</trend_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


/** PLANNING Agent */
export const PLANNING_EVAL_PROMPT = `你是财务分析规划质量评审专家。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>"}

评分标准（0-1 浮点分）：
- 1.0 优秀：分析计划全面，准确识别关键风险点，分析序列合理
- 0.7: 计划完整但风险识别偏泛
- 0.4: 基本框架正确但缺乏数据驱动的计划定制
- 0.2: 计划过于模板化，未考虑公司特殊性

<input_data>
{inputs}
</input_data>
<planning_output>
{outputs}
</planning_output>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>"}`;


// ============ Layer 3: 报告级评估 Prompt ============

/**
 * 跨 Agent 一致性检查
 */
export const CROSS_AGENT_CONSISTENCY_PROMPT = `你是财务报告一致性审核专家。检查多个分析Agent的输出是否在核心数据和结论上保持一致。

你必须以JSON格式返回评估结果: {"score": <0-1>, "reasoning": "<理由>", "inconsistencies": ["<不一致项1>", "<不一致项2>"]}

检查项：
1. 不同Agent引用的同一指标（如净利率、营收增长率）是否一致
2. Risk Agent vs Final Conclusion 的风险评级是否匹配
3. Valuation Agent 的建议 vs Final Conclusion 的推荐是否一致
4. Trend Agent vs Profitability Agent 的趋势判断是否一致
5. Final Conclusion 的 score 是否与各维度分析吻合

评分标准（0-1 浮点分）：
- 1.0: 完全一致，数据引用精确匹配
- 0.7: 核心结论一致，但某些数值存在微小差异
- 0.4: 主要结论一致但存在 1-2 处明显矛盾
- 0.0: 存在严重矛盾

<agent_outputs>
{outputs}
</agent_outputs>

请返回JSON: {"score": <0-1>, "reasoning": "<理由>", "inconsistencies": [...]}`;


// ============ Agent 类型到评估 Prompt 的映射 ============

export const AGENT_EVAL_PROMPTS: Record<string, string> = {
  PLANNING: PLANNING_EVAL_PROMPT,
  PROFITABILITY: PROFITABILITY_EVAL_PROMPT,
  BALANCE_SHEET: BALANCE_SHEET_EVAL_PROMPT,
  CASH_FLOW: CASH_FLOW_EVAL_PROMPT,
  EARNINGS_QUALITY: EARNINGS_QUALITY_EVAL_PROMPT,
  RISK: RISK_EVAL_PROMPT,
  BUSINESS_INSIGHT: BUSINESS_INSIGHT_EVAL_PROMPT,
  BUSINESS_MODEL: BUSINESS_MODEL_EVAL_PROMPT,
  FORECAST: FORECAST_EVAL_PROMPT,
  VALUATION: VALUATION_EVAL_PROMPT,
  FINAL_CONCLUSION: FINAL_CONCLUSION_EVAL_PROMPT,
  TREND_INTERPRETATION: TREND_INTERPRETATION_EVAL_PROMPT,
};

/**
 * 评估维度权重配置
 */
export const EVAL_DIMENSION_WEIGHTS = {
  dataAccuracy: 0.25,
  analysisDepth: 0.25,
  professionalInsight: 0.20,
  logicalConsistency: 0.15,
  expressionQuality: 0.10,
  hallucination: 0.05,
} as const;

export type EvalDimension = keyof typeof EVAL_DIMENSION_WEIGHTS;
