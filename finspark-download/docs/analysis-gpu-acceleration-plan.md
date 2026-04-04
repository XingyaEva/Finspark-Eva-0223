# 分析 Agent GPU 推理加速方案 — SGLang 部署评估

> **文档版本**: v1.0  
> **创建日期**: 2026-04-03  
> **适用范围**: FinSpark 12-Agent 财报分析编排器 (Orchestrator) 的 LLM 推理加速  
> **前置依赖**: RAG 侧已部署 SGLang + Qwen3-14B-AWQ GPU 服务 (`src/services/ragGpuProvider.ts`)

---

## 目录

1. [核心结论](#1-核心结论)
2. [当前架构与瓶颈分析](#2-当前架构与瓶颈分析)
3. [SGLang 对分析 Agent 的适配性评估](#3-sglang-对分析-agent-的适配性评估)
4. [模型选型与质量风险](#4-模型选型与质量风险)
5. [推荐方案：分级混合路由](#5-推荐方案分级混合路由)
6. [性能与成本预估](#6-性能与成本预估)
7. [实施路径](#7-实施路径)
8. [附录](#8-附录)

---

## 1. 核心结论

**可以用 SGLang 加速分析 Agent，但不能简单平移 RAG 的 GPU 方案。**

| 判断 | 理由 |
|------|------|
| ✅ 技术上可行 | SGLang 已支持 `json_schema` response_format，OpenAI 兼容协议无需改接口 |
| ✅ 有独特优势 | RadixAttention 前缀缓存可复用 12 个 Agent 共享的财务数据 KV Cache |
| ⚠️ 不能全量迁移 | 14B 模型质量不足以应对复杂财务 JSON 分析，需分级路由 |
| ⚠️ 不能直接替代 GPT-4.1 | 开源 72B 模型在 strict json_schema 复杂嵌套场景下仍有差距 |
| ✅ 推荐分级策略 | 简单 Agent → GPU，复杂 Agent → Cloud，提速 20-25% + 节省 ~35% API 成本 |

---

## 2. 当前架构与瓶颈分析

### 2.1 分析 Agent vs RAG 工作负载对比

| 维度 | RAG Pipeline (已跑 GPU) | 分析 Agent (待评估) |
|------|------------------------|-------------------|
| 单次 LLM 调用数 | 2 次 (intent + answer) | **12 次** (DAG 混合编排) |
| 单次输入 Token | ~2k-5k | **10k-30k** (含大量 JSON 财务数据) |
| 单次输出 Token | ~500-2k | **3k-8k** (结构化 JSON 分析结果) |
| 单次总 Token | ~10k | **~200k+** |
| 最大并发请求 | 1 | **3** (Phase 1 三表并行) |
| response_format | text / json_object | **json_schema (strict)** ← 关键差异 |
| context 复用率 | 低 (每次 query 不同) | **中高** (12 Agent 共享财务数据) |
| 端到端耗时要求 | < 5s | 目标 < 30s (当前 60-120s) |
| 质量要求 | 中 (RAG 回答) | **极高** (投资分析报告) |

### 2.2 当前 LLM 调用路径

```
Orchestrator.run*Agent()
  → mergeSystemPrompt(AGENT_PROMPTS.XXX, 'XXX')
  → getModelForAgent('XXX')  // 当前全部返回 'gpt-4.1'
  → vectorEngine.analyzeFinancialReportJson(
      systemPrompt, userPrompt,
      { model, responseFormat: getModelAwareResponseFormat(...) }
    )
  → vectorEngine.chat()
  → fetch('https://api.vectorengine.ai/v1/chat/completions')
  → parseJsonResult(result)
```

**关键信息**:
- 所有 12 个 Agent 均通过 VectorEngine API 代理调用 GPT-4.1
- 每个 Agent 使用 `json_schema` strict 模式（`schemas.ts` 定义了 12 个 Schema）
- 输出温度 0.2, max_tokens 16384
- 无 Token 用量记录（`chat()` 仅返回 content，丢弃 usage）

### 2.3 延迟分解

以一次典型分析为例（贵州茅台 600519.SH, 全年报）：

```
数据获取 (8 并行 API):           ~5s
├─ income (tushare)               1.8s
├─ balance (tushare)              1.5s
├─ cashFlow (tushare)             1.6s
├─ forecast (tushare)             0.8s
├─ express (tushare)              0.5s
├─ finaIndicator (tushare)        2.1s  ← 最慢
├─ mainBiz (tushare)              1.2s
└─ dailyBasic (tushare)           0.9s

PLANNING Agent (串行):            ~5s
├─ 网络 RTT                       ~0.3s
├─ Prefill (输入 ~8k tok)         ~1.5s
└─ Decode (输出 ~2k tok)          ~3.2s

Phase 1 (三表并行, 取最慢):       ~18s
├─ PROFITABILITY                   18.3s  ← 最慢
├─ BALANCE_SHEET                   16.5s
└─ CASH_FLOW                       15.8s

TREND_INTERPRETATION (串行):      ~7s  (或命中缓存 ~0s)

Phase 2 (串行+并行):              ~11s
├─ EARNINGS_QUALITY (串行)         5.1s
├─ RISK (并行)                     5.8s
└─ BUSINESS_INSIGHT (并行)         5.5s

Phase 3 (串行):                   ~22s
├─ BUSINESS_MODEL                  8.2s
├─ FORECAST                        7.1s
└─ VALUATION                       6.5s

FINAL_CONCLUSION (串行):          ~8s
─────────────────────────────────────
总计:                             ~68-76s
其中网络 RTT (12次 × ~0.3s):      ~3.6s
```

**瓶颈分析**:
1. **串行叠加** 是最大瓶颈（Phase 3 三个 Agent 串行 = 22s）
2. **Prefill 时间** 在长输入时显著（Phase 1 每个 Agent 输入 15-20k token）
3. **网络 RTT** 12 次累计 ~3.6s
4. **数据获取** 5s 无法通过 GPU 优化

---

## 3. SGLang 对分析 Agent 的适配性评估

### 3.1 RadixAttention 前缀缓存 — 核心优势

分析 Agent 的 12 个 LLM 调用中，**大量输入数据是共享的**：

```
Agent         输入数据来源                     与其他 Agent 的重叠度
──────────    ──────────────────────           ─────────────────────
PLANNING      income + balance + cashFlow       基础数据集, Phase 1 全部复用
PROFITABILITY income + finaIndicator            income 被多个 Agent 共享
BALANCE_SHEET balance + finaIndicator           finaIndicator 被多个 Agent 共享
CASH_FLOW     cashFlow + finaIndicator          同上
TREND_INTERP  mergedData + analysisContext       mergedData 来自 income + finaIndicator
EARNINGS_Q    profitResult + balanceResult + cashResult   前置结果（较短）
RISK          balanceResult + cashResult + earningsResult 前置结果（较短）
BIZ_INSIGHT   financialData + profitResult       income 数据再次出现
BIZ_MODEL     businessInsight + mainBiz          独特数据
FORECAST      profitResult + bizInsight + forecast + express  混合数据
VALUATION     financialData + profitResult + balanceResult    financialData 再次出现
CONCLUSION    所有前置 Agent 结果汇总              独特（但结构化输入）
```

SGLang 的 RadixAttention 会将已处理的前缀 KV Cache 存储在 Radix Tree 中，相同前缀的后续请求直接复用，**省去重复 prefill 计算**。

**预计收益**:
- PLANNING 的 income/balance/cashFlow 数据（~3k token）被 Phase 1 三个 Agent 复用
- finaIndicator 数据（~2k token）被 PROFITABILITY、BALANCE_SHEET、CASH_FLOW、TREND 四个 Agent 复用
- 共享前缀占输入的 ~20-40%，prefill 阶段加速 **1.5-2x**

### 3.2 连续批处理 (Continuous Batching)

Phase 1 三表并行和 Phase 2 的 RISK + BUSINESS_INSIGHT 并行，如果走同一个 SGLang 实例，会被自动批处理：
- GPU 同时处理 2-3 个请求，利用率从 ~30%（单请求）提升到 ~70-90%
- 并行阶段的 wall-clock time 接近单个请求时间（而非顺序叠加）

### 3.3 结构化输出 (Constrained Decoding)

SGLang 已支持 OpenAI 兼容的 `response_format.json_schema`：
- 你的 `schemas.ts` 定义的 12 个 strict schema 可直接传给 SGLang
- SGLang 使用 `xgrammar` 或 `outlines` 后端做 constrained decoding
- **注意**: constrained decoding 在小模型上可能导致生成质量下降（可选路径被过度限制）

### 3.4 网络延迟消除

自建 GPU 直连 vs VectorEngine API 代理：
- 消除 12 次 × ~300ms RTT = **~3.6s 纯收益**
- 如果 GPU 部署在同一云区域（如 AutoDL / 潞晨 / SeetaCloud），延迟可降到 <50ms

### 3.5 关键限制

| 限制 | 影响 | 缓解 |
|------|------|------|
| 开源模型质量 < GPT-4.1 | 复杂 Agent 分析质量下降 | 分级路由，关键 Agent 保持 Cloud |
| GPU 显存有限 | 72B 模型需 2×H100 | 使用 FP8/AWQ 量化减少显存 |
| 单实例并发上限 | 大量并发可能排队 | 业务量不大（~100次/天）暂无此问题 |
| strict json_schema + 小模型 | constrained decoding 可能死循环 | 设置超时 + 降级到 json_object |

---

## 4. 模型选型与质量风险

### 4.1 候选模型矩阵

| 模型 | 参数量 | 类型 | GPU 需求 (推荐) | 输出速度 (SGLang, H20) | 质量 vs GPT-4.1 | json_schema strict |
|------|--------|------|----------------|----------------------|----------------|-------------------|
| Qwen3-14B-AWQ | 14B | Dense | 1× H20 (已有) | ~96 tok/s (input=1) | 70-80% | ✅ 支持，简单 schema 可靠 |
| Qwen3-32B-FP8 | 32B | Dense | 1× H100/H20 | ~46 tok/s (input=1) | 80-85% | ✅ 支持，中等 schema 可靠 |
| Qwen3-30B-A3B-FP8 | 30B(3B active) | MoE | 1× H20 | ~155 tok/s (input=1) | 75-85% | ✅ 支持，速度极快但质量波动大 |
| Qwen3-72B-FP8 | 72B | Dense | 2× H100/H20 | ~25-35 tok/s (估算) | 85-92% | ✅ 支持，复杂 schema 基本可靠 |
| Qwen3-235B-A22B-FP8 | 235B(22B active) | MoE | 4× H100 | ~71 tok/s | 90-95% | ✅ 支持，接近 GPT-4.1 |
| DeepSeek-V3.1 | 671B MoE | MoE | 8× H100 | 参考值 | 92-97% | ✅ 支持 |

> 速度数据来源：Qwen 官方 SGLang benchmark (H20 96GB, batch_size=1, generating 2048 tokens)

### 4.2 你的 12 个 Schema 的复杂度分级

从 `schemas.ts` 分析：

| Agent | Schema 嵌套层级 | 必填字段数 | 复杂度 | 14B 可否胜任 |
|-------|---------------|-----------|--------|-------------|
| PLANNING | 1 层 | 6 | ⭐ 低 | ✅ 可以 |
| PROFITABILITY | 3 层 | ~25 | ⭐⭐⭐ 高 | ❌ 频繁出错 |
| BALANCE_SHEET | 3 层 | ~20 | ⭐⭐⭐ 高 | ❌ 频繁出错 |
| CASH_FLOW | 3 层 | ~20 | ⭐⭐⭐ 高 | ❌ 频繁出错 |
| TREND_INTERPRETATION | 2 层 | ~14 | ⭐⭐ 中 | ⚠️ 勉强 |
| EARNINGS_QUALITY | 2 层 | ~15 | ⭐⭐ 中 | ⚠️ 勉强 |
| RISK | 2-3 层 | ~20 | ⭐⭐ 中 | ⚠️ 勉强 |
| BUSINESS_INSIGHT | 2 层 | ~15 | ⭐⭐ 中 | ⚠️ 勉强 |
| BUSINESS_MODEL | 3 层 | ~20 | ⭐⭐⭐ 高 | ❌ 需商业判断 |
| FORECAST | 3 层 | ~20 | ⭐⭐⭐ 高 | ❌ 预测推理不足 |
| VALUATION | 3 层 | ~25 | ⭐⭐⭐ 高 | ❌ 数值敏感 |
| FINAL_CONCLUSION | 3 层 | ~25 | ⭐⭐⭐ 高 | ❌ 需全局综合 |

### 4.3 结论

- **14B 模型**: 仅适用于 PLANNING、可能适用于 TREND/EARNINGS/RISK/BIZ_INSIGHT
- **32B 模型**: 可覆盖上述 + 部分中等 Agent，但三表分析仍有风险
- **72B 模型**: 可覆盖 80% Agent，但 FINAL_CONCLUSION 等汇总型仍建议 Cloud
- **替代 GPT-4.1 需要 72B+**，且要做 A/B 测试验证

---

## 5. 推荐方案：分级混合路由

### 5.1 Tier 分级

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1  →  GPU (SGLang + Qwen3-32B/72B)                    │
│  简单→中等复杂度 Agent，输入较短或以前置结果为主              │
│  ─────────────────────────────────────────────────────────  │
│  PLANNING            输入短, 输出结构简单, 规划型              │
│  TREND_INTERPRETATION 有 KV 缓存命中, 输入中等                │
│  EARNINGS_QUALITY    输入是前置 Agent 结果, 非原始数据         │
│  RISK                输入是前置 Agent 结果                    │
│  BUSINESS_INSIGHT    中等复杂度, 输入含部分原始数据            │
│                                                              │
│  → 5 个 Agent, 占总 Token ~35%, 占总耗时 ~30%                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Tier 2  →  Cloud (VectorEngine API → GPT-4.1)              │
│  高复杂度 Agent，需要深度推理、复杂 JSON 输出                 │
│  ─────────────────────────────────────────────────────────  │
│  PROFITABILITY       输入大量原始财务 JSON, 需深度推理         │
│  BALANCE_SHEET       输入大量原始财务 JSON, 需深度推理         │
│  CASH_FLOW           输入大量原始财务 JSON, 需深度推理         │
│  BUSINESS_MODEL      需要商业判断能力, 14B/32B 不足           │
│  FORECAST            需要预测推理, 对准确性要求极高            │
│  VALUATION           需要估值计算, 数字敏感度高                │
│  FINAL_CONCLUSION    汇总所有结果, 需要全局视野                │
│                                                              │
│  → 7 个 Agent, 占总 Token ~65%, 占总耗时 ~70%                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 架构图

```
                     ┌────────────────────┐
                     │   Orchestrator     │
                     │  analyze() 方法    │
                     └────────┬───────────┘
                              │
                    ┌─────────▼─────────┐
                    │ AnalysisRouter    │
                    │ (扩展 GpuProvider)│
                    └────┬─────────┬────┘
                         │         │
            Tier 1       │         │     Tier 2
         ┌───────────────▼───┐ ┌───▼───────────────────┐
         │ SGLang Server     │ │ VectorEngine API      │
         │ (已有或升级)      │ │ api.vectorengine.ai   │
         │                   │ │                       │
         │ Qwen3-32B-FP8    │ │ GPT-4.1               │
         │ :8000             │ │ GPT-4.1-mini          │
         │                   │ │ DeepSeek-Reasoner     │
         │ RadixAttention ON │ │ (用户可配置)          │
         │ json_schema ✅    │ │                       │
         └───────────────────┘ └───────────────────────┘
```

### 5.3 代码改动设计

#### 5.3.1 扩展 GpuProvider

在现有 `ragGpuProvider.ts` 的 `ModelRouting` 基础上新增分析路由：

```typescript
// src/services/ragGpuProvider.ts 新增

/** 分析 Agent 模型路由配置 */
export interface AnalysisModelRouting {
  PLANNING: 'gpu' | 'cloud';
  PROFITABILITY: 'gpu' | 'cloud';
  BALANCE_SHEET: 'gpu' | 'cloud';
  CASH_FLOW: 'gpu' | 'cloud';
  TREND_INTERPRETATION: 'gpu' | 'cloud';
  EARNINGS_QUALITY: 'gpu' | 'cloud';
  RISK: 'gpu' | 'cloud';
  BUSINESS_INSIGHT: 'gpu' | 'cloud';
  BUSINESS_MODEL: 'gpu' | 'cloud';
  FORECAST: 'gpu' | 'cloud';
  VALUATION: 'gpu' | 'cloud';
  FINAL_CONCLUSION: 'gpu' | 'cloud';
}

/** 推荐分级路由 (Tier 1 → GPU, Tier 2 → Cloud) */
export const ANALYSIS_RECOMMENDED_ROUTING: AnalysisModelRouting = {
  PLANNING: 'gpu',
  TREND_INTERPRETATION: 'gpu',
  EARNINGS_QUALITY: 'gpu',
  RISK: 'gpu',
  BUSINESS_INSIGHT: 'gpu',
  PROFITABILITY: 'cloud',
  BALANCE_SHEET: 'cloud',
  CASH_FLOW: 'cloud',
  BUSINESS_MODEL: 'cloud',
  FORECAST: 'cloud',
  VALUATION: 'cloud',
  FINAL_CONCLUSION: 'cloud',
};

/** 保守方案 (全部 Cloud) */
export const ANALYSIS_ALL_CLOUD_ROUTING: AnalysisModelRouting = {
  PLANNING: 'cloud',
  PROFITABILITY: 'cloud',
  BALANCE_SHEET: 'cloud',
  CASH_FLOW: 'cloud',
  TREND_INTERPRETATION: 'cloud',
  EARNINGS_QUALITY: 'cloud',
  RISK: 'cloud',
  BUSINESS_INSIGHT: 'cloud',
  BUSINESS_MODEL: 'cloud',
  FORECAST: 'cloud',
  VALUATION: 'cloud',
  FINAL_CONCLUSION: 'cloud',
};

/** 激进方案 (全部 GPU, 需要 72B+ 模型) */
export const ANALYSIS_ALL_GPU_ROUTING: AnalysisModelRouting = {
  PLANNING: 'gpu',
  PROFITABILITY: 'gpu',
  BALANCE_SHEET: 'gpu',
  CASH_FLOW: 'gpu',
  TREND_INTERPRETATION: 'gpu',
  EARNINGS_QUALITY: 'gpu',
  RISK: 'gpu',
  BUSINESS_INSIGHT: 'gpu',
  BUSINESS_MODEL: 'gpu',
  FORECAST: 'gpu',
  VALUATION: 'gpu',
  FINAL_CONCLUSION: 'gpu',
};
```

#### 5.3.2 扩展 GpuProvider 类

```typescript
// GpuProvider 新增方法

/**
 * 获取分析 Agent 的 LLM 配置
 * 根据 Agent 类型和路由配置，返回 GPU 或 Cloud 的连接信息
 */
getAnalysisLlmConfig(
  agentType: keyof AnalysisModelRouting,
  analysisRouting?: AnalysisModelRouting
): {
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: 'gpu' | 'cloud';
  extraHeaders?: Record<string, string>;
} {
  const routing = analysisRouting || ANALYSIS_RECOMMENDED_ROUTING;
  const mode = routing[agentType];

  if (mode === 'gpu' && this.config.enabled) {
    return {
      baseUrl: this.getGpuUrl(),
      apiKey: 'not-needed',
      model: this.config.llmModel,  // qwen3-32b 或 qwen3-72b
      provider: 'gpu',
      extraHeaders: this.getGpuHeaders(),
    };
  }

  return {
    baseUrl: this.cloudBaseUrl,
    apiKey: this.cloudApiKey,
    model: 'gpt-4.1',  // 默认使用用户配置的模型
    provider: 'cloud',
  };
}
```

#### 5.3.3 Orchestrator 改动

```typescript
// orchestrator.ts — 最小改动方案

export interface OrchestratorConfig {
  // ... 现有字段 ...
  gpuProvider?: GpuProvider;                    // 新增: GPU 服务提供者
  analysisRouting?: AnalysisModelRouting;       // 新增: 分析路由配置
}

// 在各 run*Agent 方法中, 替换 model 来源:

// BEFORE (当前):
const planningModel = this.getModelForAgent('PLANNING');
const result = await this.vectorEngine.analyzeFinancialReportJson(
  mergedSystemPrompt, prompt,
  { model: planningModel, responseFormat: ... }
);

// AFTER (GPU 路由):
const { baseUrl, apiKey, model, provider } = this.getRoutedLlmConfig('PLANNING');
const result = await this.callLlmWithRouting(
  mergedSystemPrompt, prompt,
  { model, responseFormat: ... },
  { baseUrl, apiKey, provider }
);
```

关键新增方法:

```typescript
/**
 * 根据 Agent 类型获取路由后的 LLM 配置
 */
private getRoutedLlmConfig(agentType: keyof AnalysisModelRouting) {
  if (this.gpuProvider && this.analysisRouting) {
    return this.gpuProvider.getAnalysisLlmConfig(agentType, this.analysisRouting);
  }
  // 降级: 使用原有的 VectorEngine
  const model = this.getModelForAgent(agentType as any);
  return {
    baseUrl: 'https://api.vectorengine.ai/v1',
    apiKey: this.vectorEngine.getApiKey(),  // 需新增 getter
    model,
    provider: 'cloud' as const,
  };
}

/**
 * 带路由的 LLM 调用
 * GPU 路由时直接 fetch SGLang, Cloud 时走 VectorEngine
 */
private async callLlmWithRouting(
  systemPrompt: string,
  userPrompt: string,
  options: ChatOptions,
  routing: { baseUrl: string; apiKey: string; provider: 'gpu' | 'cloud' }
): Promise<string> {
  if (routing.provider === 'gpu') {
    // 直接调用 SGLang (OpenAI 兼容)
    const response = await fetch(`${routing.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(routing.apiKey !== 'not-needed' ? { 'Authorization': `Bearer ${routing.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: options.maxTokens || 16384,
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      }),
    });
    if (!response.ok) throw new Error(`GPU LLM error: ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
  
  // Cloud 路径: 复用现有 VectorEngine
  return this.vectorEngine.analyzeFinancialReportJson(systemPrompt, userPrompt, options);
}
```

### 5.4 SGLang 部署配置 (分析 Agent 专用)

如果使用 Qwen3-32B-FP8（单卡 H20/H100）：

```bash
# SGLang 启动命令 (分析 Agent 专用)
python -m sglang.launch_server \
  --model-path Qwen/Qwen3-32B-FP8 \
  --host 0.0.0.0 \
  --port 8000 \
  --context-length 32768 \
  --mem-fraction-static 0.88 \
  --enable-mixed-chunk \
  --quantization fp8 \
  --tp 1 \
  --max-running-requests 8 \
  --schedule-policy lpm  # Longest Prefix Match, 最大化 prefix cache 命中
```

关键参数说明：
- `--schedule-policy lpm`: 优先调度与已缓存前缀最长匹配的请求，对分析 Agent 场景至关重要
- `--context-length 32768`: 足够覆盖最长的 FINAL_CONCLUSION 输入 (~25k token)
- `--max-running-requests 8`: 支持 Phase 1 三并行 + 预留余量

如果使用 Qwen3-72B-FP8（需 2 卡）：

```bash
python -m sglang.launch_server \
  --model-path Qwen/Qwen3-72B-FP8 \
  --host 0.0.0.0 \
  --port 8000 \
  --context-length 32768 \
  --mem-fraction-static 0.88 \
  --enable-mixed-chunk \
  --quantization fp8 \
  --tp 2 \
  --max-running-requests 4 \
  --schedule-policy lpm
```

### 5.5 前缀缓存优化要点

为了最大化 RadixAttention 的缓存命中率，**同一次分析的 12 个请求必须发到同一个 SGLang 实例**。方案：

```
方案 A (简单): 只部署 1 个 SGLang 实例 → 天然满足
方案 B (多实例): Nginx sticky session by trace_id → 需配置
方案 C (手动): Orchestrator 在 fetch header 中添加 routing key
```

建议初期用方案 A，业务量不大（~100次/天）单实例足够。

---

## 6. 性能与成本预估

### 6.1 性能对比

| 方案 | 总耗时 | 提速幅度 | 质量 |
|------|--------|---------|------|
| **当前 (全 Cloud GPT-4.1)** | 68-76s | 基线 | 100% |
| **方案 A: 分级混合 (推荐)** | 49-56s | **↓ 20-25%** | ~98% |
| **方案 B: 全 GPU 72B** | 35-42s | **↓ 40-45%** | 85-90% |
| **方案 C: 全 GPU 235B (4×H100)** | 30-38s | **↓ 50%** | 90-95% |

方案 A 详细时间分解：

```
数据获取:                  ~5s   (不变)
PLANNING (GPU):           ~2s   (GPU 推理快, 输入短)
Phase 1 并行 (Cloud):     ~18s  (不变, 保持 GPT-4.1 质量)
TREND (GPU):              ~3s   (GPU, 或命中 KV 缓存 0s)
EARNINGS_QUALITY (GPU):   ~2s   (GPU, 输入是前置结果较短)
RISK + BIZ_INSIGHT (GPU): ~3s   (GPU, 并行)
Phase 3 (Cloud):          ~22s  (不变)
CONCLUSION (Cloud):       ~8s   (不变)
───────────────────────────────
总计:                     ~49-56s
节省来源: 5 个 Agent 走 GPU (省 ~12s) + 消除 5 次网络 RTT (~1.5s)
```

### 6.2 成本对比 (按日均 100 次分析计算)

| 方案 | GPU 硬件 | 月 GPU 成本 | 月 API 成本 | 月总成本 |
|------|---------|------------|------------|---------|
| **当前 (全 Cloud)** | 无 | $0 | ~$3,600 | **$3,600** |
| **方案 A (混合, 已有 GPU)** | 已有 Qwen3-14B 机器 | ~$0 (增量) | ~$2,340 (-35%) | **~$2,340** |
| **方案 A (混合, 新增 32B)** | 1× H20/H100 | ~$2,160 | ~$2,340 | **~$4,500** |
| **方案 B (72B, 2× H100)** | 2× H100 | ~$4,320 | $0 | **$4,320** |
| **方案 C (235B, 4× H100)** | 4× H100 | ~$10,080 | $0 | **$10,080** |

> GPU 成本按 H100 $3/h (云厂商竞价实例) 计算，按月 24×30=720h

**结论**: 
- 如果**已有 GPU 机器有余量**（RAG 用的 Qwen3-14B 机器），方案 A 增量成本几乎为零，直接省 35% API 费用
- 如果需要新购 GPU，日均 100 次量级下方案 A 和全 Cloud 成本接近
- **日均 300+ 次**时，方案 B (72B 全 GPU) 开始比全 Cloud 便宜

### 6.3 盈亏平衡分析

```
全 Cloud 单次成本:  ~$1.20
方案 A 单次成本:    ~$0.78 (GPU Agent 免费, Cloud Agent 按比例)
方案 B 单次成本:    ~$0.06/h ÷ 请求数 (固定成本, 随量摊薄)

方案 B 盈亏平衡点:  $4,320/月 ÷ ($1.20/次 × 30天) = ~120 次/天
方案 A 盈亏平衡点:  已有 GPU 时立即有收益; 新购 GPU 时 ~175 次/天
```

---

## 7. 实施路径

### 7.1 Phase 概览

```
Phase 0 (前置):   Trace 系统上线 → 有数据做对比基线
Phase 1 (验证):   A/B 测试 → 验证开源模型在各 Agent 上的质量
Phase 2 (实施):   分级路由 → 代码改动 + 灰度上线
Phase 3 (优化):   根据 Trace 数据调优路由策略
```

### 7.2 Phase 0: 前置条件 (与 Trace 并行)

| 任务 | 说明 | 依赖 |
|------|------|------|
| Agent Trace 系统上线 | 有延迟/Token/成本基线数据 | Trace P0-P1 完成 |
| 评估现有 GPU 余量 | 确认 RAG 用的机器是否能承载额外负载 | 运维确认 |
| SGLang 版本升级 | 确保支持 json_schema strict mode | SGLang ≥ 0.4.6 |

### 7.3 Phase 1: A/B 测试验证 (~3 天)

| 任务 | 代码量 | 说明 |
|------|--------|------|
| 在 Orchestrator 中添加 A/B 测试模式 | ~100 行 | 同一份财报, 5 个 Tier 1 Agent 同时走 GPU 和 Cloud |
| 将 A/B 结果写入 `agent_trace_spans` | ~30 行 | 复用 Trace 表，添加 `ab_test` 标记 |
| 对比脚本: 质量 + 延迟 + 成本 | ~80 行 | SQL 查询 + 人工审查 JSON 输出差异 |
| 选取 10 只不同行业股票做测试 | - | 贵州茅台/比亚迪/招商银行/中国平安/宁德时代等 |

**A/B 测试评估指标**:
1. JSON 解析成功率 (GPU vs Cloud)
2. 必填字段完整率 (fields_complete_rate)
3. 分析内容质量 (人工抽检)
4. 延迟对比 (GPU Agent 应快 2-3x)
5. 数值准确性 (财务数据引用是否正确)

**通过标准**: GPU 质量 ≥ 90% of Cloud 质量，JSON 成功率 ≥ 95%

### 7.4 Phase 2: 分级路由实施 (~2 天)

| 任务 | 涉及文件 | 代码量 |
|------|----------|--------|
| 扩展 `AnalysisModelRouting` 接口 | `src/services/ragGpuProvider.ts` | ~60 行 |
| GpuProvider 新增 `getAnalysisLlmConfig()` | `src/services/ragGpuProvider.ts` | ~30 行 |
| Orchestrator 新增路由逻辑 | `src/agents/orchestrator.ts` | ~80 行 |
| 环境变量 / Wrangler 配置 | `wrangler.toml` | ~5 行 |
| 灰度开关 (按用户 / 按比例) | `src/routes/api.ts` | ~20 行 |
| **Phase 2 合计** | | **~195 行** |

### 7.5 Phase 3: 持续优化 (长期)

| 任务 | 触发条件 | 说明 |
|------|----------|------|
| 将更多 Agent 迁移到 GPU | A/B 数据显示 GPU 质量达标 | 逐步将 Tier 2 Agent 迁移 |
| 升级 GPU 模型到 72B | 日均分析量 > 200 次 | 更多 Agent 可走 GPU |
| Prompt 针对开源模型优化 | GPU Agent 质量不达标时 | 针对 Qwen3 特性调整 Prompt 措辞 |
| 前缀缓存监控 | Trace 数据积累后 | 监控 RadixAttention 命中率 |
| 模型升级跟踪 | 新模型发布时 | Qwen3.5 / Qwen4 等新模型评估 |

### 7.6 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| GPU Agent JSON 解析失败率高 | 中 | 中 | constrained decoding 超时时降级到 json_object; 错误时自动重试走 Cloud |
| GPU 服务宕机 | 低 | 高 | GpuProvider 已有健康检查 + 自动降级到 Cloud 逻辑，可直接复用 |
| 前缀缓存命中率低 | 低 | 低 | 确保同一分析的请求走同一 SGLang 实例; 使用 `--schedule-policy lpm` |
| 开源模型商业判断能力不足 | 高 | 中 | 始终保持 FINAL_CONCLUSION 走 Cloud 做质量兜底 |
| GPU 显存不足 | 低 | 中 | 监控 GPU 内存; 限制并发请求数; 必要时降低 context_length |

---

## 8. 附录

### 8.1 与 Trace 系统的协同

GPU 加速方案**依赖** Trace 系统提供的数据：

```
Trace 系统 (先上线)
  ├── 提供基线数据: 每个 Agent 的延迟/Token/成本
  ├── A/B 测试记录: GPU vs Cloud 质量对比
  ├── 持续监控: GPU 路由后的质量/性能变化
  └── 告警: GPU Agent 异常率超阈值时通知

GPU 加速 (后实施)
  ├── 在 agent_trace_spans 中记录 provider='gpu'/'cloud'
  ├── 在 config_snapshot 中记录当前路由配置
  └── 为 Trace 详情页添加 GPU/Cloud 标签展示
```

### 8.2 Qwen3 官方 SGLang 性能数据参考 (H20 96GB)

来源: qwen.readthedocs.io/en/latest/getting_started/speed_benchmark.html

| 模型 | 量化 | 输入长度 | 速度 (tok/s) | GPU 数 |
|------|------|---------|-------------|--------|
| Qwen3-14B | FP8 | 6144 | 342.95 | 1 |
| Qwen3-14B | AWQ | 6144 | 321.62 | 1 |
| Qwen3-32B | FP8 | 6144 | 165.71 | 1 |
| Qwen3-32B | AWQ | 6144 | 159.99 | 1 |
| Qwen3-30B-A3B | BF16 | 6144 | 490.10 | 1 |
| Qwen3-14B | FP8 | 14336 | 587.33 | 1 |
| Qwen3-32B | FP8 | 14336 | 287.60 | 1 |

注: 速度 = (prompt_tokens + generation_tokens) / time, batch_size=1

### 8.3 涉及文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/ragGpuProvider.ts` | **修改** | 新增 AnalysisModelRouting 接口和路由方法 |
| `src/agents/orchestrator.ts` | **修改** | 新增 GPU 路由逻辑, 替换 LLM 调用路径 |
| `src/routes/api.ts` | **修改** | 传入 gpuProvider + analysisRouting 配置 |
| `wrangler.toml` | **修改** | 新增 ANALYSIS_GPU_ENABLED 等环境变量 |
| `src/services/vectorengine.ts` | **修改** (可选) | 新增 getApiKey() getter |

### 8.4 决策树

```
是否用 GPU 加速分析 Agent?
│
├── 已有 GPU 机器且有余量?
│   ├── YES → 方案 A (分级混合), 几乎零成本, 立即收益
│   └── NO → 先不动, 等 Trace 数据确认瓶颈
│
├── 日均分析量 > 200 次?
│   ├── YES → 考虑方案 B (72B, 2×H100), 成本已低于全 Cloud
│   └── NO → 方案 A 足够
│
└── 对响应时间有极致要求 (< 30s)?
    ├── YES → 方案 C (235B, 4×H100) + 全 GPU 路由
    └── NO → 方案 A 已能从 76s 降到 50s, 够用
```

---

> **实施顺序**: Agent Trace (P0) → Trace 基线数据收集 (1-2 周) → A/B 测试验证 (3 天) → 分级路由上线 (2 天)
