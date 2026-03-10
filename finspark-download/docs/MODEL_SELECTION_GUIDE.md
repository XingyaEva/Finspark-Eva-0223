# Multi-Agent 分析系统 - 模型选型指南

## 1. 当前架构分析

### 1.1 代码改动范围评估

| 改动级别 | 涉及文件 | 改动量 | 说明 |
|:--------:|----------|:------:|------|
| **最小改动** | `src/services/vectorengine.ts` | ~5行 | 仅修改 MODELS 常量 |
| **中等改动** | + `src/agents/orchestrator.ts` | ~20行 | 为不同Agent指定不同模型 |
| **完整改动** | + 新增 Provider 抽象层 | ~200行 | 支持多厂商模型切换 |

### 1.2 当前模型调用链路

```
┌─────────────────────────────────────────────────────────────────┐
│                    模型调用链路（当前）                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  Orchestrator │ --> │ VectorEngine │ --> │  API 调用    │    │
│  │  (编排器)     │     │  Service     │     │              │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │ Agent调用    │     │ MODELS常量   │     │ OpenAI兼容   │    │
│  │ analyzeXxx() │     │ 统一配置     │     │ 协议         │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 关键代码位置

```typescript
// 文件: src/services/vectorengine.ts
// 位置: 第38-47行

export const MODELS = {
  ANALYSIS: 'gemini-2.5-flash',      // ← 修改这里切换主模型
  THINKING: 'gemini-2.5-pro-thinking', // ← 深度思考模型
  IMAGE_GEN: 'gemini-3-pro-image-preview',
  FAST: 'gemini-2.0-flash-001',
} as const;

// 文件: src/services/vectorengine.ts  
// 位置: 第140-158行

async analyzeFinancialReport(
  systemPrompt: string,
  userPrompt: string,
  options: ChatOptions = {}  // ← 可通过options覆盖默认模型
): Promise<string> {
  // ...
  const response = await this.chat(messages, {
    model: MODELS.ANALYSIS,  // ← 默认使用ANALYSIS模型
    temperature: 0.3,
    maxTokens: 16384,
    ...options,  // ← 支持覆盖
  });
}
```

---

## 2. 模型选型方案

### 2.1 方案一：最小改动（仅改常量）

**改动文件**: `src/services/vectorengine.ts`  
**改动行数**: 4行

```typescript
// 修改前
export const MODELS = {
  ANALYSIS: 'gemini-2.5-flash',
  THINKING: 'gemini-2.5-pro-thinking',
  IMAGE_GEN: 'gemini-3-pro-image-preview',
  FAST: 'gemini-2.0-flash-001',
} as const;

// 修改后（示例：切换到 Claude）
export const MODELS = {
  ANALYSIS: 'claude-3-5-sonnet-20241022',
  THINKING: 'claude-3-5-sonnet-20241022',
  IMAGE_GEN: 'gemini-3-pro-image-preview',  // 图片生成保持
  FAST: 'claude-3-haiku-20240307',
} as const;
```

**优点**: 改动最小，风险低  
**缺点**: 所有Agent使用同一模型，无法按需分配

---

### 2.2 方案二：按Agent分配模型

**改动文件**: `src/agents/orchestrator.ts`  
**改动行数**: ~50行

```typescript
// 新增：Agent模型映射配置
const AGENT_MODEL_CONFIG = {
  PLANNING: { model: 'gemini-2.5-flash', temperature: 0.3 },
  PROFITABILITY: { model: 'claude-3-5-sonnet', temperature: 0.2 },
  BALANCE_SHEET: { model: 'claude-3-5-sonnet', temperature: 0.2 },
  CASH_FLOW: { model: 'claude-3-5-sonnet', temperature: 0.2 },
  EARNINGS_QUALITY: { model: 'gpt-4o', temperature: 0.3 },
  RISK: { model: 'gpt-4o', temperature: 0.3 },
  BUSINESS_INSIGHT: { model: 'claude-3-5-sonnet', temperature: 0.4 },
  BUSINESS_MODEL: { model: 'claude-3-5-sonnet', temperature: 0.5 },
  FORECAST: { model: 'gpt-4o', temperature: 0.3 },
  VALUATION: { model: 'gpt-4o', temperature: 0.2 },
  FINAL_CONCLUSION: { model: 'claude-3-5-sonnet', temperature: 0.4 },
};

// 修改每个Agent调用
const result = await this.vectorEngine.analyzeFinancialReport(
  AGENT_PROMPTS.PROFITABILITY,
  prompt,
  AGENT_MODEL_CONFIG.PROFITABILITY  // ← 传入配置
);
```

**优点**: 可按Agent特性选择最优模型  
**缺点**: 需修改11处Agent调用

---

### 2.3 方案三：完整Provider抽象（推荐）

**新增文件**: `src/services/llm-provider.ts`  
**改动行数**: ~200行

```typescript
// 新增: LLM Provider 抽象层
interface LLMProvider {
  name: string;
  chat(messages: Message[], options: ChatOptions): Promise<string>;
}

// OpenAI 兼容 Provider (支持 VectorEngine, OpenAI, Azure等)
class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private defaultModel: string
  ) {}
  
  async chat(messages: Message[], options: ChatOptions): Promise<string> {
    // 统一的 OpenAI 兼容协议调用
  }
}

// Anthropic Provider
class AnthropicProvider implements LLMProvider {
  constructor(private apiKey: string) {}
  
  async chat(messages: Message[], options: ChatOptions): Promise<string> {
    // Claude 原生 API 调用
  }
}

// Provider 工厂
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'openai': return new OpenAICompatibleProvider(config);
    case 'anthropic': return new AnthropicProvider(config);
    case 'vectorengine': return new OpenAICompatibleProvider(config);
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

**优点**: 架构清晰，易扩展，支持多厂商  
**缺点**: 改动较大，需要重构

---

## 3. 推荐模型清单（2024-2025）

### 3.1 财报分析场景推荐模型

| 模型 | 厂商 | 推荐场景 | 优势 | 劣势 |
|------|------|----------|------|------|
| **Claude 3.5 Sonnet** | Anthropic | 三表分析、商业模式 | 长文本理解强、数字推理准确、输出结构化 | 价格较高 |
| **GPT-4o** | OpenAI | 风险评估、估值分析 | 多模态、推理能力强 | 成本高 |
| **GPT-4o-mini** | OpenAI | 规划Agent、快速任务 | 性价比高、速度快 | 复杂推理弱 |
| **Gemini 2.5 Flash** | Google | 全场景 | 速度快、成本低、JSON输出稳定 | 中文表达略逊 |
| **Gemini 2.5 Pro** | Google | 深度分析 | 推理能力强 | 速度较慢 |
| **DeepSeek V3** | DeepSeek | 全场景 | 性价比极高、中文优秀 | API稳定性待验证 |
| **Qwen2.5-72B** | 阿里 | 中文财报 | 中文理解强、成本低 | 英文场景弱 |

### 3.2 按Agent推荐配置

| Agent | 推荐模型 | 备选模型 | 理由 |
|-------|----------|----------|------|
| **Planning** | GPT-4o-mini | Gemini Flash | 任务简单，需要快速响应 |
| **Profitability** | Claude 3.5 Sonnet | GPT-4o | 需要精确数字计算 |
| **Balance Sheet** | Claude 3.5 Sonnet | GPT-4o | 结构化数据分析 |
| **Cash Flow** | Claude 3.5 Sonnet | GPT-4o | 现金流推理 |
| **Earnings Quality** | GPT-4o | Claude 3.5 Sonnet | 多表联动推理 |
| **Risk** | GPT-4o | Claude 3.5 Sonnet | 风险识别需要强推理 |
| **Business Insight** | Claude 3.5 Sonnet | DeepSeek V3 | 长文本理解+商业洞察 |
| **Business Model** | Claude 3.5 Sonnet | GPT-4o | 商业模式抽象 |
| **Forecast** | GPT-4o | Gemini Pro | 预测需要数学推理 |
| **Valuation** | GPT-4o | Claude 3.5 Sonnet | 估值计算精度要求高 |
| **Final Conclusion** | Claude 3.5 Sonnet | GPT-4o | 综合总结+表达能力 |

### 3.3 成本优化配置（推荐）

```typescript
// 高性价比配置
export const COST_OPTIMIZED_CONFIG = {
  PLANNING: 'gpt-4o-mini',           // $0.15/1M tokens
  PROFITABILITY: 'deepseek-v3',      // $0.27/1M tokens
  BALANCE_SHEET: 'deepseek-v3',
  CASH_FLOW: 'deepseek-v3',
  EARNINGS_QUALITY: 'claude-3-haiku', // $0.25/1M tokens
  RISK: 'gpt-4o-mini',
  BUSINESS_INSIGHT: 'deepseek-v3',
  BUSINESS_MODEL: 'claude-3-haiku',
  FORECAST: 'gpt-4o-mini',
  VALUATION: 'gpt-4o-mini',
  FINAL_CONCLUSION: 'deepseek-v3',
};

// 预估单次分析成本: ~$0.02-0.05
```

---

## 4. 模型评估体系

### 4.1 评估维度框架

```
┌─────────────────────────────────────────────────────────────────┐
│                    模型评估体系 (6大维度)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  准确性      │  │  性能        │  │  成本        │          │
│  │  Accuracy    │  │  Performance │  │  Cost        │          │
│  │  (40%)       │  │  (20%)       │  │  (15%)       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  稳定性      │  │  可控性      │  │  扩展性      │          │
│  │  Stability   │  │  Controllability │  Scalability │          │
│  │  (10%)       │  │  (10%)       │  │  (5%)        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 详细评估指标

#### 4.2.1 准确性 (Accuracy) - 权重 40%

| 指标 | 计算方式 | 基准值 | 说明 |
|------|----------|:------:|------|
| **数字准确率** | 提取数字/实际数字 | ≥95% | 财务数字提取准确性 |
| **JSON格式成功率** | 有效JSON/总请求 | ≥98% | 结构化输出稳定性 |
| **逻辑一致性** | 人工评分(1-5) | ≥4.0 | 分析逻辑是否自洽 |
| **结论合理性** | 人工评分(1-5) | ≥4.0 | 投资建议是否合理 |
| **中文表达质量** | 人工评分(1-5) | ≥4.0 | 语言流畅度和专业性 |

**测试用例示例**:
```json
{
  "test_case": "数字提取测试",
  "input": "2024年营业收入1,505.89亿元，同比增长16.35%",
  "expected": {
    "revenue": 150589000000,
    "yoy_growth": 0.1635
  },
  "evaluation": "exact_match"
}
```

#### 4.2.2 性能 (Performance) - 权重 20%

| 指标 | 计算方式 | 基准值 | 说明 |
|------|----------|:------:|------|
| **首Token延迟** | TTFT (ms) | ≤500ms | 首个Token返回时间 |
| **生成速度** | Tokens/秒 | ≥50 | 输出Token速率 |
| **单Agent耗时** | 秒 | ≤15s | 单个Agent完成时间 |
| **完整分析耗时** | 秒 | ≤90s | 全流程完成时间 |
| **并发能力** | QPS | ≥10 | 并发请求处理能力 |

**性能测试脚本**:
```typescript
async function benchmarkModel(model: string) {
  const start = Date.now();
  let firstTokenTime = 0;
  let totalTokens = 0;
  
  for await (const token of streamChat(model, prompt)) {
    if (!firstTokenTime) firstTokenTime = Date.now() - start;
    totalTokens++;
  }
  
  return {
    ttft: firstTokenTime,
    totalTime: Date.now() - start,
    tokensPerSecond: totalTokens / ((Date.now() - start) / 1000)
  };
}
```

#### 4.2.3 成本 (Cost) - 权重 15%

| 指标 | 计算方式 | 基准值 | 说明 |
|------|----------|:------:|------|
| **输入成本** | $/1M input tokens | ≤$3 | 输入Token单价 |
| **输出成本** | $/1M output tokens | ≤$15 | 输出Token单价 |
| **单次分析成本** | $ | ≤$0.10 | 完整分析总成本 |
| **月度预算** | $ | ≤$500 | 月度总开销预估 |

**成本计算公式**:
```
单次成本 = (输入Tokens × 输入单价 + 输出Tokens × 输出单价) × Agent数量
```

#### 4.2.4 稳定性 (Stability) - 权重 10%

| 指标 | 计算方式 | 基准值 | 说明 |
|------|----------|:------:|------|
| **API可用率** | 成功请求/总请求 | ≥99.5% | 服务可用性 |
| **超时率** | 超时请求/总请求 | ≤1% | 请求超时比例 |
| **错误重试成功率** | 重试成功/重试总数 | ≥95% | 重试机制有效性 |
| **输出一致性** | 相同输入的输出相似度 | ≥90% | 结果可复现性 |

#### 4.2.5 可控性 (Controllability) - 权重 10%

| 指标 | 计算方式 | 基准值 | 说明 |
|------|----------|:------:|------|
| **指令遵循率** | 符合指令的输出/总输出 | ≥95% | 是否按要求输出 |
| **格式遵循率** | 正确格式/总输出 | ≥98% | JSON/Markdown格式正确率 |
| **长度控制** | 实际长度/目标长度 | 0.8-1.2 | 输出长度是否可控 |
| **风格一致性** | 人工评分(1-5) | ≥4.0 | 输出风格是否统一 |

#### 4.2.6 扩展性 (Scalability) - 权重 5%

| 指标 | 计算方式 | 基准值 | 说明 |
|------|----------|:------:|------|
| **上下文窗口** | Tokens | ≥32K | 最大输入长度 |
| **批处理支持** | 是/否 | 是 | 是否支持批量请求 |
| **流式输出** | 是/否 | 是 | 是否支持流式返回 |
| **多模态能力** | 支持类型数 | ≥2 | 文本/图片/代码等 |

### 4.3 评估流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    模型评估流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: 准备测试集                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • 财报原文 (10家公司 × 3年 = 30份)                       │   │
│  │  • 标准答案 (人工标注的分析结果)                          │   │
│  │  • 边界用例 (异常数据、缺失数据)                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  Step 2: 自动化测试                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • 批量调用各候选模型                                     │   │
│  │  • 记录性能指标 (延迟、速度、成功率)                      │   │
│  │  • 收集输出结果                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  Step 3: 准确性评估                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • 自动评估: JSON格式、数字准确率                         │   │
│  │  • 人工评估: 逻辑一致性、结论合理性 (抽样20%)             │   │
│  │  • LLM-as-Judge: 使用GPT-4o评估输出质量                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  Step 4: 综合评分                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  总分 = 准确性×0.4 + 性能×0.2 + 成本×0.15                 │   │
│  │       + 稳定性×0.1 + 可控性×0.1 + 扩展性×0.05             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  Step 5: 输出评估报告                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • 模型排名                                               │   │
│  │  • 各维度得分详情                                         │   │
│  │  • 推荐配置方案                                           │   │
│  │  • 成本预估                                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 评估工具推荐

| 工具 | 用途 | 链接 |
|------|------|------|
| **LangSmith** | LLM应用监控与评估 | langsmith.com |
| **Promptfoo** | 开源Prompt评估框架 | promptfoo.dev |
| **OpenAI Evals** | 标准化评估框架 | github.com/openai/evals |
| **LLM-as-Judge** | 用LLM评估LLM输出 | 自建 |
| **Human Eval** | 人工标注平台 | Label Studio等 |

---

## 5. 实施建议

### 5.1 第一阶段：快速验证（1周）

```bash
# 仅修改 MODELS 常量，测试2-3个候选模型
# 改动: 1个文件，4行代码
```

### 5.2 第二阶段：按Agent优化（2周）

```bash
# 根据评估结果，为不同Agent配置最优模型
# 改动: 2个文件，~50行代码
```

### 5.3 第三阶段：Provider抽象（4周）

```bash
# 构建完整的Provider抽象层，支持多厂商切换
# 改动: 新增1个文件，修改2个文件，~200行代码
```

---

## 6. 快速开始

### 6.1 切换模型（最小改动）

```typescript
// 文件: src/services/vectorengine.ts

// 切换到 Claude
export const MODELS = {
  ANALYSIS: 'claude-3-5-sonnet-20241022',
  // ...
};

// 或切换到 DeepSeek (性价比最高)
export const MODELS = {
  ANALYSIS: 'deepseek-chat',
  // ...
};
```

### 6.2 添加新的API Provider

```typescript
// 修改 baseUrl 即可切换 API 提供商
// 大多数提供商都支持 OpenAI 兼容协议

// VectorEngine (当前)
private baseUrl: string = 'https://api.vectorengine.ai';

// OpenAI 官方
private baseUrl: string = 'https://api.openai.com';

// Azure OpenAI
private baseUrl: string = 'https://YOUR-RESOURCE.openai.azure.com';

// DeepSeek
private baseUrl: string = 'https://api.deepseek.com';

// 阿里云百炼
private baseUrl: string = 'https://dashscope.aliyuncs.com/compatible-mode';
```

---

**文档版本**: v1.0  
**更新日期**: 2025-12-28  
**作者**: Genspark AI Assistant
