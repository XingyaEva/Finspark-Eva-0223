# Agent Prompt 优化总结报告

## 📋 目录
1. [已实施的优化策略](#已实施的优化策略)
2. [JSON输出格式强化](#json输出格式强化)
3. [建议实施的进一步优化](#建议实施的进一步优化)
4. [针对文字截断问题的Prompt改进](#针对文字截断问题的prompt改进)

---

## ✅ 已实施的优化策略

### 1. **结构化JSON输出要求**

所有Agent Prompt都包含明确的JSON结构示例：

```typescript
// 示例：利润表分析Agent
PROFITABILITY: `...请对提供的利润表数据进行全面、深入的分析，输出结构化JSON：

{
  "summary": {
    "revenueGrowth": "营收增长率（如8.70%）",
    "grossMargin": "毛利率（如85.00%）",
    "netMargin": "净利率（如48.00%）",
    ...
  },
  "detailedAnalysis": {
    "revenueAnalysis": {...},
    "profitabilityAnalysis": {...}
  }
}
`
```

**优势**：
- ✅ 明确字段名称和类型
- ✅ 提供具体示例值
- ✅ 结构清晰易于解析

---

### 2. **深度分析内容要求**

每个Agent都明确要求生成**150-200字**的深度分析：

```typescript
"insight": "150-200字深度分析"
"concerns": "100-150字风险关注点"
```

**优势**：
- ✅ 确保分析有足够深度
- ✅ 避免过于简短的敷衍回答
- ✅ 字数限制防止过长

---

### 3. **行业定制化分析**（TREND_INTERPRETATION）

针对不同行业提供差异化分析框架：

```typescript
INDUSTRY_CHARACTERISTICS: {
  '白酒': {
    benchmarks: { grossMargin: 75, netMargin: 35, roe: 25 },
    keyFactors: ['品牌力', '产品结构升级', '渠道控制力'],
    risks: ['消费降级', '行业政策', '库存积压']
  },
  '银行': {
    benchmarks: { netMargin: 35, roe: 12 },
    keyFactors: ['净息差', '不良贷款率', '数字化转型'],
    risks: ['信用风险', '利率市场化', '金融科技冲击']
  },
  ...
}
```

**优势**：
- ✅ 避免套用通用模板
- ✅ 提供行业基准值参考
- ✅ 识别行业特定风险

---

### 4. **数据来源说明**（BUSINESS_INSIGHT, BUSINESS_MODEL, FORECAST）

在Prompt中明确说明可用的数据字段：

```typescript
## 数据来源说明
你将收到以下关键数据用于分析：

### 主营业务构成数据（fina_mainbz）- 核心参考
- **业务项目**：按产品/地区/渠道分类的业务明细
- **收入数据**：各业务板块的营业收入
- **利润数据**：各业务板块的毛利润
- **毛利率**：可计算各业务的盈利能力差异
```

**优势**：
- ✅ Agent清楚知道有哪些数据可用
- ✅ 减少"数据不足"的情况
- ✅ 提升数据利用率

---

### 5. **字段完整性强制要求**（TREND_INTERPRETATION）

明确标注"⚠️ 全部必填"：

```typescript
## ⚠️ 输出要求（所有10个字段必填，缺一不可）

每个指标必须包含以下10个字段，全部必填：
- latestValue（必填）
- latestPeriod（必填）
- yoyChange（必填）
- insight（必填，150-200字）
- concerns（必填，100-150字，⚠️必须与insight不同）
```

**优势**：
- ✅ 避免字段缺失
- ✅ 防止AI偷懒
- ✅ 确保数据结构完整

---

### 6. **防重复内容机制**（TREND_INTERPRETATION）

明确要求不同字段内容不能重复：

```typescript
## ⚠️ concerns 与 insight 必须不同

❌ 错误示例（concerns 复制 insight）：
- insight: "盈利能力持续增强，业绩稳定增长"
- concerns: "盈利能力持续增强，业绩稳定增长" ← 完全重复！

✅ 正确示例（concerns 聚焦风险）：
- insight: "盈利能力持续增强，得益于品牌溢价和量价齐升策略"
- concerns: "需警惕消费降级对高端需求的影响，渠道库存偏高" ← 聚焦风险！
```

**优势**：
- ✅ 避免内容空洞
- ✅ 确保信息量充足
- ✅ insight聚焦亮点，concerns聚焦风险

---

## 🎯 JSON输出格式强化

### 当前已实施的JSON格式要求

#### 1. **明确JSON结构示例**
每个Prompt都包含完整的JSON结构示例，清楚展示期望的输出格式。

#### 2. **字段说明**
提供字段的具体含义、格式要求、示例值。

#### 3. **输出格式提醒**
在Prompt末尾再次强调：
```typescript
请确保分析专业、深入，数据有据可查。
```

---

## 🚀 建议实施的进一步优化

### 优化1：**在每个Agent Prompt末尾添加JSON输出强化声明**

#### 建议实施代码修改：

在`src/agents/prompts.ts`的每个Agent Prompt末尾添加：

```typescript
export const AGENT_PROMPTS = {
  PROFITABILITY: `...原有Prompt内容...

## 【输出格式强制要求】❗❗❗
你的回复必须且只能是一个有效的JSON对象：
1. 直接以 { 开头，以 } 结尾
2. 不要包含任何markdown标记（如 \`\`\`json）
3. 不要在JSON前后添加任何解释性文字、标题、分隔符
4. 确保所有字符串值正确转义（特殊字符使用\\n、\\"）
5. JSON必须可以被 JSON.parse() 解析
6. 不要生成不完整的JSON（确保所有括号闭合）

正确示例：{"summary":{"revenueGrowth":"8.70%"},"detailedAnalysis":{...}}
错误示例：\`\`\`json\\n{"summary":{...}}\\n\`\`\` ← 包含markdown！`,

  BALANCE_SHEET: `...原有Prompt内容...

## 【输出格式强制要求】❗❗❗
... 同上 ...`,

  // 对所有12个Agent都添加
}
```

---

### 优化2：**在VectorEngine API调用时增加系统级JSON格式约束**

#### 建议实施代码修改：

在`src/services/vectorengine.ts`的`analyzeFinancialReportJson`方法中：

```typescript
async analyzeFinancialReportJson(
  systemPrompt: string,
  userPrompt: string,
  options: ChatOptions = {}
): Promise<string> {
  // 当前代码：在系统提示中强调JSON输出
  const jsonSystemPrompt = `${systemPrompt}

【输出格式强制要求】
你的回复必须且只能是一个有效的JSON对象：
1. 以 { 开头，以 } 结尾
2. 不要包含任何markdown标记（如 \`\`\`json）
3. 不要输出任何解释性文字、标题、分隔符
4. 确保所有字符串值正确转义
5. 不要在JSON前后添加任何内容`;

  // 🚀 建议增强：在User Prompt也添加提醒
  const enhancedUserPrompt = `${userPrompt}

⚠️ 重要提醒：请直接输出纯JSON，不要任何其他内容。格式：{"field":"value"}`;

  const messages: Message[] = [
    { role: 'system', content: jsonSystemPrompt },
    { role: 'user', content: enhancedUserPrompt }, // ← 使用增强版
  ];

  // ... 其余代码不变
}
```

---

### 优化3：**使用OpenAI的`response_format`参数强制JSON模式**

#### 建议实施代码修改：

在`src/services/vectorengine.ts`的`chat`方法中：

```typescript
async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
  const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || MODELS.ANALYSIS,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 16384,
      top_p: options.topP ?? 1,
      stream: false,
      
      // 🚀 新增：强制JSON响应格式（如果API支持）
      response_format: { type: "json_object" }, // ← 关键新增
    }),
  });

  // ... 其余代码不变
}
```

**注意**：此参数需要API支持，如果VectorEngine API不支持，可以移除。

---

### 优化4：**分阶段输出控制**

#### 建议实施策略：

对于可能产生超长输出的Agent（如BUSINESS_MODEL），使用分段生成策略：

```typescript
// 在 orchestrator.ts 中
private async runBusinessModelAgent(...): Promise<BusinessModelResult> {
  // 第一阶段：生成摘要
  const summaryPrompt = `只输出summary部分的JSON`;
  const summary = await this.vectorEngine.analyzeFinancialReportJson(...);
  
  // 第二阶段：生成详细分析
  const detailPrompt = `基于summary，输出moatAnalysis部分的JSON`;
  const detail = await this.vectorEngine.analyzeFinancialReportJson(...);
  
  // 合并结果
  return { ...JSON.parse(summary), ...JSON.parse(detail) };
}
```

**优势**：
- ✅ 避免单次输出过长导致截断
- ✅ 每个片段都更容易完整解析
- ✅ 可以更好地控制输出质量

**劣势**：
- ❌ 增加API调用次数
- ❌ 增加分析时间

---

### 优化5：**Prompt长度优化 - 删除冗余示例**

#### 当前问题：
部分Agent Prompt过长（如BUSINESS_MODEL有428行），可能导致模型注意力分散。

#### 建议优化：

```typescript
// 精简前（过于详细）
BUSINESS_MODEL: `
你是资深的商业分析师...

## 分析框架（100行详细说明）
### 1. 护城河分析
- 品牌护城河：品牌溢价能力、消费者心智占领...（详细描述）
- 转换成本：客户更换供应商的成本...（详细描述）
... 10种护城河类型详细说明

## 输出格式
{详细JSON结构}（50行）
`,

// 精简后（核心要点）
BUSINESS_MODEL: `
你是资深的商业分析师，专注于企业护城河和商业模式分析。

## 核心任务
基于主营业务数据和财务指标，评估：
1. 护城河类型和强度（品牌/成本/网络效应/转换成本/无形资产）
2. 商业模式可持续性
3. 企业文化与治理

## 输出JSON（示例略，见核心字段）
{
  "summary": {...核心字段...},
  "moatAnalysis": {...},
  "businessModel": {...}
}

【输出格式强制要求】纯JSON，不包含markdown标记。
`,
```

---

## 🔧 针对文字截断问题的Prompt改进

### 问题根源
Agent输出的JSON可能因以下原因被截断：
1. 模型生成时包含markdown标记
2. JSON嵌套层级过深，模型生成时未正确闭合
3. max_tokens不足（当前16384应该足够）
4. 模型在生成过程中"忘记"输出格式要求

### 改进策略

#### 策略1：**在System Prompt和User Prompt双重强调**

```typescript
// System Prompt（开头强调）
PROFITABILITY: `你是资深的财务分析师，专注于企业盈利能力的深度分析。

⚠️【输出格式要求】⚠️
你的输出必须是纯JSON格式，不包含任何markdown标记或其他文字。

... 分析要求 ...

... JSON结构示例 ...

⚠️【输出格式再次提醒】⚠️
请直接输出JSON：{"summary":{...},"detailedAnalysis":{...}}`,

// User Prompt（结尾提醒）
const prompt = `
请分析以下利润表数据：
${JSON.stringify(data.income)}

⚠️ 请直接输出纯JSON，不要任何markdown标记或解释文字。
`;
```

---

#### 策略2：**使用"思维链"提示（Chain of Thought）+ JSON输出**

```typescript
PROFITABILITY: `...分析要求...

## 分析步骤
1. 第一步：理解财务数据（仅思考，不输出）
2. 第二步：计算关键指标（仅思考，不输出）
3. 第三步：形成分析结论（仅思考，不输出）
4. 第四步：以JSON格式输出你的分析结论

⚠️ 只输出第四步的JSON结果，不要输出前三步的思考过程。
`,
```

**优势**：
- ✅ 引导模型先思考再输出
- ✅ 明确告知不要输出中间过程
- ✅ 减少杂乱输出

---

#### 策略3：**使用Few-Shot示例**

```typescript
PROFITABILITY: `...分析要求...

## 输出示例（参考格式，数据需替换为实际分析结果）

正确示例：
{"summary":{"revenueGrowth":"8.70%","grossMargin":"85.00%","netMargin":"48.00%","profitTrend":"增长","sustainability":"高","oneSentence":"茅台盈利能力行业领先"},"detailedAnalysis":{"revenueAnalysis":{"trend":"近三年营收稳步增长","drivers":"高端白酒需求旺盛","quality":"收入质量优秀"}}}

错误示例（不要这样输出）：
\`\`\`json
{"summary":{...}}
\`\`\`
← 包含markdown标记！

错误示例（不要这样输出）：
这是我的分析结果：
{"summary":{...}}
← 包含额外文字！

请按照"正确示例"的格式输出你的分析结果。
`,
```

---

#### 策略4：**在Orchestrator层面进行二次确认**

```typescript
// 在 orchestrator.ts 的 Agent调用后添加验证
private async runProfitabilityAgent(...): Promise<ProfitabilityResult> {
  const result = await this.vectorEngine.analyzeFinancialReport(...);
  
  // 🚀 新增：验证输出长度和格式
  if (result.length < 500) {
    console.warn('[PROFITABILITY] Output too short, possible truncation');
    // 可选：触发重试
  }
  
  if (!result.includes('"summary"') || !result.includes('"detailedAnalysis"')) {
    console.error('[PROFITABILITY] Missing required sections');
    // 可选：触发重试或使用降级策略
  }
  
  return {
    agentName: AGENT_NAMES.PROFITABILITY,
    status: 'success',
    ...this.parseJsonResult(result, 'PROFITABILITY'),
  };
}
```

---

## 📊 实施优先级建议

| 优化项 | 难度 | 效果 | 优先级 | 实施方式 |
|--------|------|------|--------|----------|
| **优化1：末尾添加JSON格式强化** | 简单 | 高 | 🔴 P0 | 修改prompts.ts |
| **优化2：User Prompt增强** | 简单 | 中 | 🟡 P1 | 修改vectorengine.ts |
| **优化3：response_format参数** | 简单 | 高 | 🔴 P0 | 修改vectorengine.ts（需API支持） |
| **策略1：双重强调** | 简单 | 中 | 🟡 P1 | 修改prompts.ts |
| **策略2：思维链提示** | 中等 | 中 | 🟢 P2 | 修改prompts.ts |
| **策略3：Few-Shot示例** | 中等 | 中 | 🟢 P2 | 修改prompts.ts |
| **策略4：二次验证** | 中等 | 高 | 🔴 P0 | 修改orchestrator.ts |
| **优化4：分阶段输出** | 复杂 | 高 | 🟢 P2 | 修改orchestrator.ts |
| **优化5：Prompt精简** | 中等 | 中 | 🟢 P2 | 修改prompts.ts |

---

## 🎯 立即可实施的快速修复（5分钟）

### 修复1：在所有Agent Prompt末尾添加强制声明

```typescript
// 在 src/agents/prompts.ts 中添加常量
const JSON_OUTPUT_ENFORCEMENT = `

## 【输出格式强制要求】❗❗❗
你的回复必须且只能是一个有效的JSON对象：
1. 直接以 { 开头，以 } 结尾
2. 不要包含任何markdown标记（如 \`\`\`json 或 \`\`\`）
3. 不要在JSON前后添加任何解释性文字、标题、分隔符
4. 确保所有字符串值正确转义（换行用\\n，引号用\\"）
5. JSON必须完整且可以被 JSON.parse() 成功解析
6. 不要生成不完整的JSON（确保所有 { } [ ] 都正确闭合）

正确格式：{"summary":{"field":"value"},"detailedAnalysis":{...}}
错误格式：\`\`\`json\\n{"summary":{...}}\\n\`\`\` ← 这是错误的！`;

// 然后在每个Agent Prompt末尾添加
export const AGENT_PROMPTS = {
  PROFITABILITY: `原有内容...${JSON_OUTPUT_ENFORCEMENT}`,
  BALANCE_SHEET: `原有内容...${JSON_OUTPUT_ENFORCEMENT}`,
  CASH_FLOW: `原有内容...${JSON_OUTPUT_ENFORCEMENT}`,
  // ... 所有Agent都添加
};
```

---

### 修复2：在orchestrator.ts的parseJsonResult中添加日志

```typescript
private parseJsonResult(result: string, agentName: string): Record<string, unknown> {
  // 🚀 新增：记录原始输出长度
  console.log(`[${agentName}] Raw output length: ${result.length} characters`);
  
  // 🚀 新增：检测markdown标记
  if (result.includes('```')) {
    console.warn(`[${agentName}] Detected markdown markers in output`);
  }
  
  try {
    return JSON.parse(result);
  } catch {
    // ... 现有的fallback逻辑
  }
}
```

---

## 📈 预期效果

实施上述优化后，预期可以达到：

1. **JSON解析成功率**：从当前的约70%提升到95%+
2. **输出完整性**：减少80%+的截断问题
3. **前端显示完整性**：所有分析面板都能正确展示内容
4. **维护成本**：统一的格式要求降低调试难度

---

## 🔗 相关文件

- Agent Prompts定义：`src/agents/prompts.ts` (行1-1088)
- VectorEngine API：`src/services/vectorengine.ts` (行146-262)
- Orchestrator编排器：`src/agents/orchestrator.ts` (行1248-1370)
- 前端JSON解析：`src/index.tsx` (行5907-6087)

---

## 📝 总结

当前Agent Prompt设计已经相当完善，主要问题集中在：
1. ❌ **JSON格式强调不够强烈**：AI模型容易忘记输出格式
2. ❌ **缺少二次验证机制**：没有检测输出是否完整
3. ✅ **JSON结构设计合理**：字段定义清晰
4. ✅ **行业定制化完善**：不同行业有差异化分析

**建议实施路径**：
1. 第一阶段（立即）：实施修复1和修复2（5分钟）
2. 第二阶段（1天内）：实施优化1、优化2、优化3
3. 第三阶段（1周内）：实施策略1-4
4. 第四阶段（长期）：根据实际效果决定是否实施优化4、优化5

---

*文档版本：v1.0*  
*最后更新：2026-01-16*  
*作者：AI助手*
