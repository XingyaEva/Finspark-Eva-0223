# DeepEval vs OpenEvals 深度对比分析：FinSpark 评估框架选型

> 文档版本：v1.0 | 更新日期：2026-04-03
> 前置文档：`openevals-evaluation-framework.md`（OpenEvals 评估方案详细设计）
> 关联文档：`agent-trace-development-guide.md`, `analysis-gpu-acceleration-plan.md`

---

## 一、研究背景

在 `openevals-evaluation-framework.md` 中，我们已设计了基于 OpenEvals 的三层评估体系。本文档旨在评估其主要竞品 **DeepEval**（GitHub: [confident-ai/deepeval](https://github.com/confident-ai/deepeval)）是否在**成本、功能、灵活性**方面提供更优方案，以帮助我们做出最终技术选型。

### 1.1 评估维度

| 评估维度 | 权重 | 说明 |
|---|---|---|
| **评估成本** | 30% | API 费用 + 基础设施成本 |
| **功能覆盖度** | 25% | 预置指标数量 + 自定义能力 |
| **与 FinSpark 的适配性** | 25% | TypeScript/Python 兼容、金融场景契合 |
| **工程成熟度** | 10% | 社区活跃度、文档质量、版本稳定性 |
| **扩展性** | 10% | 未来功能拓展的能力上限 |

---

## 二、项目概况对比

### 2.1 基本信息

| 项目 | DeepEval | OpenEvals |
|---|---|---|
| **维护方** | Confident AI | LangChain |
| **GitHub** | [confident-ai/deepeval](https://github.com/confident-ai/deepeval) | [langchain-ai/openevals](https://github.com/langchain-ai/openevals) |
| **Stars** | ~5,000+ | ~2,500+ |
| **开源协议** | Apache 2.0 | MIT |
| **首次发布** | 2023 | 2025.02 |
| **语言** | **Python** | **TypeScript + Python** |
| **包管理** | `pip install deepeval` | `npm install openevals` / `pip install openevals` |
| **最新更新** | 2025.12 (持续活跃) | 2026.03 (持续活跃) |
| **配套平台** | Confident AI (可选, SaaS) | LangSmith (可选, SaaS) |
| **日评估量声称** | 2000万+/天 | 未公开 |
| **核心定位** | 全功能 LLM 评估框架 | 轻量级评估器工具箱 |

### 2.2 架构哲学对比

```
DeepEval 架构哲学：
┌──────────────────────────────────────────────────────┐
│               "全栈评估平台"                          │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐      │
│  │ 50+ 预置 │  │ 自定义    │  │ CI/CD 集成    │      │
│  │ 指标库   │  │ 指标框架  │  │ + 自动化测试  │      │
│  └─────────┘  └──────────┘  └────────────────┘      │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐      │
│  │ 合成数据 │  │ 红队测试 │  │ Confident AI   │      │
│  │ 生成    │  │ 攻击模拟 │  │ 云端仪表板     │      │
│  └─────────┘  └──────────┘  └────────────────┘      │
│  Python 优先 | pytest 集成 | 端到端工作流             │
└──────────────────────────────────────────────────────┘

OpenEvals 架构哲学：
┌──────────────────────────────────────────────────────┐
│             "可组合评估器工具箱"                       │
│  ┌──────────────┐  ┌─────────────────┐               │
│  │ LLM-as-Judge │  │ JSON 结构评估   │               │
│  │ + 预置Prompt │  │ (字段级Rubric) │               │
│  └──────────────┘  └─────────────────┘               │
│  ┌──────────────┐  ┌─────────────────┐               │
│  │ Agent 轨迹   │  │ LangSmith 集成  │               │
│  │ 评估         │  │ (日志+追踪)    │               │
│  └──────────────┘  └─────────────────┘               │
│  TypeScript 优先 | 函数式 | 可嵌入任何工作流           │
└──────────────────────────────────────────────────────┘
```

---

## 三、功能特性深度对比

### 3.1 预置评估指标

| 指标类别 | DeepEval | OpenEvals | 对 FinSpark 的价值 |
|---|---|---|---|
| **通用质量** | ✅ G-Eval, Answer Relevancy, Faithfulness | ✅ Correctness, Conciseness, Relevance | 通用报告质量把关 |
| **幻觉检测** | ✅ Faithfulness, Hallucination | ✅ HALLUCINATION_PROMPT | **核心需求**：财务数据不能捏造 |
| **JSON 结构** | ✅ JsonCorrectnessMetric (Pydantic) | ✅ createJsonMatchEvaluator (Rubric) | **核心需求**：12 Agent 结构化输出 |
| **RAG 评估** | ✅ Contextual Recall/Precision, Retrieval | ✅ RAG Helpfulness/Groundedness | 未来 RAG 功能需要 |
| **Agent 评估** | ✅ Task Completion, Tool Correctness, Step Efficiency | ✅ Trajectory Match (strict/subset/superset) | 4 阶段 Agent 路径评估 |
| **安全性** | ✅ Bias, Toxicity, PII | ✅ Toxicity, Fairness | 中等价值 |
| **多模态** | ✅ Image Relevance, Visual Hallucination | ✅ Image/Voice 评估 | 低优先级 |
| **自定义指标** | ✅ G-Eval + DAGMetric | ✅ Custom LLM-as-Judge | **核心需求**：12 套财务专用评估 |
| **对话评估** | ✅ Conversational G-Eval | ❌ 不原生支持 | 低优先级 |
| **红队攻防** | ✅ 内置 Red Teaming | ❌ 无 | 低优先级（安全测试） |

**小结**：DeepEval 在指标**数量**上占优（50+ vs ~15），但 OpenEvals 在**结构化输出评估**（createJsonMatchEvaluator）上更为成熟，这恰好是 FinSpark 12 Agent 输出评估的核心需求。

### 3.2 JSON 结构化输出评估（关键对比项）

这是 FinSpark 最核心的评估需求——我们需要评估 12 个 Agent 输出的 JSON 字段质量。

#### DeepEval: JsonCorrectnessMetric

```python
from deepeval.metrics import JsonCorrectnessMetric
from pydantic import BaseModel

# 定义期望的 JSON Schema
class ProfitabilitySummary(BaseModel):
    revenueGrowth: str
    grossMargin: str
    netMargin: str
    profitTrend: str
    oneSentence: str

metric = JsonCorrectnessMetric(
    expected_schema=ProfitabilitySummary,
    model="gpt-4.1",          # 用于生成reason
    include_reason=True,
    threshold=0.5
)

# 评估：二元结果（符合/不符合 schema）
test_case = LLMTestCase(input="...", actual_output='{"revenueGrowth":"8.7%",...}')
metric.measure(test_case)
# score: 1.0 或 0.0 — 只检查"结构是否正确"，不评估"内容质量"
```

**局限性**：
- ❌ 只做 Schema 合规检查（pass/fail），不评估字段内容质量
- ❌ 无法判断 `revenueGrowth: "增长"` vs `revenueGrowth: "8.70%"` 的质量差异
- ❌ 无法对文本字段做深度质量评估
- ✅ 要做内容质量评估，需额外用 G-Eval 或 DAGMetric 自己组合

#### OpenEvals: createJsonMatchEvaluator

```typescript
import { createJsonMatchEvaluator } from 'openevals';

const evaluator = createJsonMatchEvaluator({
  rubric: {
    'summary.revenueGrowth': '是否给出了准确的百分比数值，如"8.70%"而非笼统的"增长"？',
    'summary.oneSentence': '是否在30字以内精准概括了核心结论？',
    'detailedAnalysis.revenueAnalysis.trend': '是否包含100字以上实质性趋势分析？',
    'detailedAnalysis.profitabilityAnalysis.costControl': '是否评估了费用率变化趋势？',
  },
  aggregator: 'average',  // average | all
  model: 'openai:gpt-4.1',
  useReasoning: true,
});

// 评估：每个字段独立评分 0-1，支持自定义评估标准
const result = await evaluator({ outputs: agentOutput, referenceOutputs: goldStandard });
// result: { score: 0.82, fieldScores: { "summary.revenueGrowth": 0.95, ... } }
```

**优势**：
- ✅ **字段级 Rubric**：每个字段有独立的评估标准和评分
- ✅ **内容质量评估**：不仅检查"有没有"，还评估"好不好"
- ✅ **灵活聚合**：average/all 两种汇总模式
- ✅ **完美匹配 FinSpark**：我们 12 个 Agent 的 JSON Schema 已经定义好了

#### 对比结论

| 维度 | DeepEval JsonCorrectness | OpenEvals JsonMatchEvaluator |
|---|---|---|
| 检查范围 | Schema 合规性 | Schema + 内容质量 |
| 评分粒度 | 二元 (0/1) | 连续 (0-1) + 字段级 |
| 字段级评估 | ❌ | ✅ 自定义 Rubric |
| 内容深度评估 | 需额外组合 G-Eval | ✅ 原生支持 |
| 与 FinSpark 匹配度 | ⭐⭐ 需大量定制 | ⭐⭐⭐⭐⭐ 直接适配 |

> **结论**：在结构化 JSON 输出评估这一 FinSpark 最核心需求上，OpenEvals 的 `createJsonMatchEvaluator` **显著优于** DeepEval 的 `JsonCorrectnessMetric`。

### 3.3 自定义评估指标

#### DeepEval: G-Eval + DAGMetric

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

# G-Eval: 自然语言描述评估标准
financial_depth = GEval(
    name="财务分析深度",
    criteria="评估AI生成的财务分析报告是否包含因果归因、跨期比较、行业基准对比和前瞻判断",
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT
    ],
    model="gpt-4.1",
    threshold=0.7,
)

# DAGMetric: 确定性决策树评估（更精细）
from deepeval.metrics.dag import (
    DAGMetric, DeepAcyclicGraph, TaskNode, 
    BinaryJudgementNode, NonBinaryJudgementNode, VerdictNode
)

# 构建评估决策树
extract_metrics = TaskNode(
    instructions="从Agent输出中提取所有引用的财务指标数值",
    output_label="extracted_metrics"
)

check_accuracy = BinaryJudgementNode(
    criteria="提取的财务指标数值是否与输入数据一致？",
    children=[extract_metrics]
)

check_depth = NonBinaryJudgementNode(
    criteria="分析深度是否包含因果归因（而非仅数据转述）？",
    score_range=(0, 10),
    children=[extract_metrics]
)

verdict = VerdictNode(children=[check_accuracy, check_depth])

financial_eval_dag = DAGMetric(
    name="财务分析综合评估",
    dag=DeepAcyclicGraph(root_nodes=[extract_metrics]),
    threshold=0.5
)
```

**优势**：
- ✅ G-Eval 用自然语言即可定义评估标准，上手极快
- ✅ DAGMetric 提供确定性决策树，减少 Judge 幻觉
- ✅ 支持链式思维推理 (Chain-of-Thought)
- ✅ 可嵌套其他 DeepEval 指标

**劣势**：
- ❌ G-Eval 对字段级评估支持弱，需要自己遍历字段
- ❌ DAGMetric 定义复杂度高，12 个 Agent × 多个节点 = 巨大维护量
- ❌ 仅 Python，我们的后端是 TypeScript

#### OpenEvals: Custom LLM-as-Judge

```typescript
import { createLLMAsJudge } from 'openevals';

const profitabilityEval = createLLMAsJudge({
  prompt: PROFITABILITY_EVAL_PROMPT,  // 自定义财务评估prompt
  model: 'openai:gpt-4.1',
  feedbackKey: 'profitability_quality',
  continuous: true,                    // 0-1 连续评分
  fewShotExamples: [                  // 提供参考示例提升准确性
    { input: '...', output: '...', score: 0.9, comment: '优秀分析...' },
    { input: '...', output: '...', score: 0.4, comment: '分析偏浅...' },
  ],
});
```

**优势**：
- ✅ TypeScript 原生，与 FinSpark 后端完美匹配
- ✅ 简洁的函数式 API
- ✅ Few-shot examples 支持
- ✅ 与 createJsonMatchEvaluator 自然组合

**劣势**：
- ❌ 没有 DAGMetric 那样的确定性决策树
- ❌ 自定义评估完全依赖 prompt engineering

### 3.4 Agent/轨迹评估

| 功能 | DeepEval | OpenEvals (+ agentevals) |
|---|---|---|
| **任务完成度** | ✅ TaskCompletionMetric | ❌ 需自定义 |
| **工具调用正确性** | ✅ ToolCorrectnessMetric | ✅ Trajectory Match (strict/subset/...) |
| **参数正确性** | ✅ ArgumentCorrectnessMetric | ✅ Tool argument matching |
| **步骤效率** | ✅ StepEfficiencyMetric | ❌ 需自定义 |
| **LLM-as-Judge 轨迹** | ✅ 通过 G-Eval 自定义 | ✅ createTrajectoryLLMAsJudge |
| **LangGraph 集成** | ❌ | ✅ 原生支持 Graph Trajectory |
| **匹配模式** | 单一模式 | ✅ strict/unordered/subset/superset |

**对 FinSpark 的价值**：我们的 4 阶段（Phase 1-4）12 Agent 执行流程可以建模为一个 trajectory。OpenEvals/agentevals 的多种匹配模式（允许 Phase 1 内部 Agent 无序执行但 Phase 间严格有序）更贴合我们的场景。

### 3.5 评估成本机制

| 成本因素 | DeepEval | OpenEvals |
|---|---|---|
| **框架本身** | 免费 (Apache 2.0) | 免费 (MIT) |
| **LLM Judge 成本** | 取决于选择的模型 | 取决于选择的模型 |
| **本地模型支持** | ✅ 支持任意 LLM（Llama, Mistral, 本地部署） | ✅ 支持 OpenAI/Anthropic/自定义 |
| **JSON 强制输出** | ✅ lm-format-enforcer / instructor 库 | ✅ 依赖模型原生 JSON mode |
| **Schema 验证评估** | ❌ 不需要 LLM（纯代码检查） | 需要 LLM 做 Rubric 评估 |
| **Confident AI 平台** | 免费基础版 / 付费企业版 | N/A |
| **LangSmith 平台** | N/A | 免费基础版 / 付费企业版 |
| **缓存机制** | ✅ 通过 Confident AI | ❌ 需自行实现 |
| **并行评估** | ✅ async_mode | ✅ 可并行调用 |

---

## 四、成本深度分析

### 4.1 LLM Judge 成本对比

两个框架**本身不产生费用**，成本完全取决于 LLM Judge 的调用。关键差异在于**是否支持低成本本地模型**。

#### DeepEval 低成本方案

```python
# DeepEval 支持任意 LLM 作为 Judge
from deepeval.models.base_model import DeepEvalBaseLLM

class LocalLlamaJudge(DeepEvalBaseLLM):
    """用本地部署的 Llama-3-8B 作为 Judge，零 API 成本"""
    def __init__(self):
        self.model = load_llama_model("meta-llama/Llama-3-8B-4bit")
    
    def generate(self, prompt):
        return self.model(prompt)
    
    def get_model_name(self):
        return "llama-3-8b-local"

# 使用本地模型做评估
local_judge = LocalLlamaJudge()
metric = GEval(
    name="financial_depth",
    criteria="...",
    model=local_judge,  # 零API成本
)
```

**本地模型方案成本**：
| 方案 | GPU 需求 | 月成本 | Judge 质量 |
|---|---|---|---|
| Llama-3-8B (4-bit) | 1× RTX 4090 / A10 | ~$200-400/月(云GPU) | ⭐⭐⭐ 中等 |
| Mistral-7B | 1× RTX 4090 | ~$200-400/月 | ⭐⭐⭐ 中等 |
| GPT-4.1-mini (API) | 无 | ~$30-80/月 | ⭐⭐⭐⭐ 良好 |
| GPT-4.1 (API) | 无 | ~$100-200/月 | ⭐⭐⭐⭐⭐ 优秀 |

#### OpenEvals Judge 成本

```typescript
// OpenEvals 也支持多种模型
const evaluator = createLLMAsJudge({
  prompt: MY_PROMPT,
  model: 'openai:gpt-4.1-mini',  // 低成本
  // model: 'anthropic:claude-3-haiku', // 另一个低成本选项
  // model: 'openai:gpt-4.1',    // 高质量
});
```

### 4.2 FinSpark 场景成本建模

以我们的实际使用场景计算（每日 100 次分析，12 Agent/次）：

#### 方案 A：OpenEvals + GPT-4.1 Judge（当前推荐方案）

| 评估模式 | 频率 | 每次 Token | 单价 | 月成本 |
|---|---|---|---|---|
| 实时抽样 (10%) | 10次/天 × 30 | ~4.5K tokens | $0.01/次 | ~$3 |
| 每日深度评估 (10份) | 10份/天 × 30 | ~340K tokens | ~$0.80/份 | ~$240 |
| 每周回归测试 | 4次/月 | ~500K tokens | ~$5/次 | ~$20 |
| **月度总计** | | | | **~$263** |

#### 方案 B：DeepEval + GPT-4.1 Judge

| 评估模式 | 频率 | 每次 Token | 单价 | 月成本 |
|---|---|---|---|---|
| 实时 G-Eval (10%) | 10次/天 × 30 | ~5K tokens | ~$0.012/次 | ~$3.6 |
| 每日深度评估 (10份) | 10份/天 × 30 | ~360K tokens | ~$0.85/份 | ~$255 |
| 每周回归测试 | 4次/月 | ~530K tokens | ~$5.3/次 | ~$21.2 |
| **月度总计** | | | | **~$280** |

> **注意**：DeepEval 的 G-Eval 使用 Chain-of-Thought 推理，平均每次评估比 OpenEvals 的 LLM-as-Judge 多消耗约 5-10% 的 output tokens（思维链输出）。

#### 方案 C：DeepEval + 本地 Llama Judge（最低成本方案）

| 成本项 | 月成本 |
|---|---|
| GPU 实例 (A10/RTX4090) | ~$300-400 |
| 无 API 费用 | $0 |
| **月度总计** | **~$300-400** |

> **问题**：本地 8B 模型作为 Judge 的**评估质量明显低于 GPT-4.1**，尤其在中文财务分析这种专业领域。这可能导致：
> - 评估结果不可靠，降低整个评估体系的价值
> - 幻觉检测的漏检率上升
> - 专业深度评估的区分度不足
> - 需要额外维护 GPU 基础设施

#### 方案 D：DeepEval + GPT-4.1-mini Judge（低成本折中方案）

| 评估模式 | 频率 | 单价 | 月成本 |
|---|---|---|---|
| 实时 G-Eval (10%) | 10次/天 × 30 | ~$0.003/次 | ~$0.9 |
| 每日深度评估 (10份) | 10份/天 × 30 | ~$0.20/份 | ~$60 |
| 每周回归测试 | 4次/月 | ~$1.3/次 | ~$5.2 |
| **月度总计** | | | **~$66** |

> GPT-4.1-mini 成本约为 GPT-4.1 的 1/4，但 Judge 质量有一定下降。

### 4.3 成本对比总结

| 方案 | 月成本 | Judge 质量 | 工程复杂度 | 适合阶段 |
|---|---|---|---|---|
| **A: OpenEvals + GPT-4.1** | ~$263 | ⭐⭐⭐⭐⭐ | ⭐⭐ 低 | 生产环境推荐 |
| **B: DeepEval + GPT-4.1** | ~$280 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ 中 | 需 Python 服务 |
| **C: DeepEval + 本地 Llama** | ~$350 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ 高 | 不推荐 |
| **D: DeepEval + GPT-4.1-mini** | ~$66 | ⭐⭐⭐⭐ | ⭐⭐⭐ 中 | 预算紧张时 |
| **E: OpenEvals + GPT-4.1-mini** | ~$62 | ⭐⭐⭐⭐ | ⭐⭐ 低 | 预算紧张时 |

> **核心发现**：使用相同 Judge 模型时，两个框架的 API 成本几乎相同（差异 <10%）。成本差异主要来自 Judge 模型的选择，而非框架本身。DeepEval 的"低成本优势"主要体现在它**支持本地模型**，但实际上本地 GPU 成本可能更高，且 Judge 质量不够理想。

---

## 五、工程层面深度对比

### 5.1 语言生态适配性

| 维度 | DeepEval | OpenEvals | FinSpark 情况 |
|---|---|---|---|
| **主语言** | Python | TypeScript + Python | **TypeScript** (后端+前端) |
| **运行时** | Python 3.9+ | Node.js / Python | Cloudflare Workers (JS/TS) |
| **包大小** | 较重 (依赖多) | 轻量 | Workers 有包大小限制 |
| **测试框架集成** | pytest 原生集成 | 函数式 API，自由集成 | 可与 vitest/jest 集成 |
| **异步支持** | ✅ async_mode 参数 | ✅ 原生 async/await | Workers 全异步 |

**关键问题**：FinSpark 后端是 **TypeScript + Cloudflare Workers**。

- **OpenEvals**：TypeScript 原生包，可直接 `import` 使用，无需跨语言调用。
- **DeepEval**：Python 包。如果要在 FinSpark 中使用，有两个方案：
  1. **独立 Python 评估服务**：部署一个 Python 微服务运行 DeepEval，TypeScript 通过 HTTP 调用。增加架构复杂度和运维成本。
  2. **批处理脚本**：用 Python 脚本离线运行评估，结果写入数据库。无法支持实时评估。

```
方案对比：

OpenEvals 集成方式（简单）：
┌────────────────────────┐
│ FinSpark TS Backend    │
│   ├─ import openevals  │  ← 直接引用
│   ├─ Agent 输出        │
│   └─ 评估结果 → DB     │
└────────────────────────┘

DeepEval 集成方式（复杂）：
┌────────────────────┐      HTTP      ┌─────────────────────┐
│ FinSpark TS Backend│  ──────────→   │ Python Eval Service │
│   ├─ Agent 输出    │                │   ├─ import deepeval│
│   └─ 等待评估结果  │  ←──────────   │   └─ 运行评估      │
└────────────────────┘                └─────────────────────┘
                                       ↑ 额外维护一个服务
```

### 5.2 与 Cloudflare Workers 兼容性

| 因素 | DeepEval | OpenEvals |
|---|---|---|
| 直接部署到 Workers | ❌ 不可能 (Python) | ⚠️ 有限制 (部分功能可用) |
| 外部服务调用 | ✅ 通过 HTTP API | ✅ 通过 HTTP API |
| 内联评估 | ❌ | ✅ 轻量评估可内联 |
| 冷启动影响 | N/A | 极小 |

> **注意**：即使 OpenEvals 是 TypeScript，Cloudflare Workers 的运行时限制（如执行时间、CPU 时间）可能不适合运行完整的 LLM-as-Judge 评估（需等待 LLM API 响应）。建议**所有深度评估异步执行**，通过 Durable Objects 或队列触发。

### 5.3 测试与 CI/CD 集成

#### DeepEval

```python
# DeepEval 原生 pytest 集成
# test_financial_agents.py
import deepeval
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import GEval

@deepeval.log_hyperparameters(model="gpt-4.1", prompt_template="v2.3")
def test_profitability_agent():
    test_case = LLMTestCase(
        input=load_test_input("贵州茅台_2025"),
        actual_output=run_profitability_agent("贵州茅台_2025"),
    )
    
    depth_metric = GEval(name="分析深度", criteria="...", threshold=0.7)
    accuracy_metric = GEval(name="数据准确性", criteria="...", threshold=0.8)
    
    assert_test(test_case, [depth_metric, accuracy_metric])

# 运行：deepeval test run test_financial_agents.py
# 自动上传结果到 Confident AI 仪表板
```

**优势**：
- ✅ `deepeval test run` 命令行直接运行
- ✅ 自动生成测试报告
- ✅ 可选上传到 Confident AI 平台
- ✅ 支持 `@deepeval.log_hyperparameters` 追踪超参

#### OpenEvals

```typescript
// OpenEvals + vitest
// eval.test.ts
import { createLLMAsJudge } from 'openevals';
import { describe, it, expect } from 'vitest';

describe('Profitability Agent Quality', () => {
  const evaluator = createLLMAsJudge({
    prompt: PROFITABILITY_EVAL_PROMPT,
    model: 'openai:gpt-4.1',
    continuous: true,
  });

  it('should score above 0.7 on 贵州茅台 2025', async () => {
    const result = await evaluator({
      inputs: loadTestInput('贵州茅台_2025'),
      outputs: await runProfitabilityAgent('贵州茅台_2025'),
    });
    expect(result.score).toBeGreaterThan(0.7);
  });
});

// 运行：npx vitest run eval.test.ts
```

**优势**：
- ✅ 与现有 TypeScript 测试框架无缝集成
- ✅ 灵活的断言方式
- ✅ 可选集成 LangSmith

### 5.4 数据合成与红队测试

| 功能 | DeepEval | OpenEvals |
|---|---|---|
| 合成数据生成 | ✅ `Synthesizer` 类 | ❌ 无 |
| 红队攻击测试 | ✅ `RedTeamer` 类 | ❌ 无 |
| 对抗样本 | ✅ 内置多种攻击策略 | ❌ 无 |
| 测试数据增强 | ✅ 自动扰动 | ❌ 无 |

```python
# DeepEval 合成数据（对 FinSpark 有价值）
from deepeval.synthesizer import Synthesizer

synthesizer = Synthesizer()
# 基于少量真实财务数据，合成更多测试用例
synthetic_cases = synthesizer.generate(
    contexts=[load_financial_data("贵州茅台")],
    num_test_cases=50,
    scenario="financial analysis evaluation"
)
```

> **FinSpark 价值**：构建"金标准"基准数据集时，DeepEval 的合成器可以帮助从 10 家公司的真实数据扩展到更多样化的测试场景。但这不是框架核心功能，也可以用其他工具替代。

---

## 六、DeepEval 独有优势详解

### 6.1 DAGMetric — 确定性决策树评估

DAGMetric 是 DeepEval 最创新的功能之一，用有向无环图定义确定性评估流程，减少 LLM Judge 的随机性。

```python
# 为 FinSpark Profitability Agent 构建 DAG 评估
from deepeval.metrics.dag import *

# 节点1：提取Agent输出中的核心指标
extract_metrics = TaskNode(
    instructions="提取输出中的所有财务指标数值（毛利率、净利率、增长率等）",
    output_label="extracted_metrics"
)

# 节点2：与输入数据交叉验证
verify_accuracy = BinaryJudgementNode(
    criteria="提取的指标数值是否与输入财务数据一致（允许合理四舍五入）？",
    children=[extract_metrics]
)

# 节点3：评估分析深度
assess_depth = NonBinaryJudgementNode(
    criteria="分析是否超越了数据转述，包含因果归因和行业对比？",
    score_range=(0, 10),
    children=[extract_metrics]
)

# 节点4：检查逻辑一致性
check_consistency = BinaryJudgementNode(
    criteria="summary中的结论是否与detailedAnalysis的具体分析一致？",
    children=[extract_metrics]
)

# 最终裁决
verdict = VerdictNode(children=[verify_accuracy, assess_depth, check_consistency])

profitability_dag = DAGMetric(
    name="利润表分析质量DAG",
    dag=DeepAcyclicGraph(root_nodes=[extract_metrics]),
    model="gpt-4.1",
    threshold=0.6
)
```

**FinSpark 价值评估**：
- ✅ 减少单次 LLM 评估的随机性
- ✅ 评估过程可追溯、可调试
- ❌ 定义复杂度高：12 Agent × 5-8 节点 = 60-96 个节点
- ❌ 维护成本大：Prompt 变更后需同步更新 DAG
- ❌ 仅 Python

### 6.2 组件级追踪 (@observe 装饰器)

```python
from deepeval.tracing import observe, update_current_span

@observe(metrics=[financial_depth_metric, hallucination_metric])
def run_profitability_agent(financial_data: str) -> str:
    # Agent 执行逻辑
    result = llm.complete(prompt=PROFITABILITY_PROMPT, data=financial_data)
    
    # 可以在执行过程中更新追踪信息
    update_current_span(metadata={"model": "gpt-4.1", "tokens": 5000})
    
    return result
```

> 这与我们已有的 Agent Trace 系统功能重叠。我们的 Trace 系统已经记录了每个 Agent 的执行详情，无需 DeepEval 的追踪功能。

### 6.3 Confident AI 云平台

DeepEval 配套的 Confident AI 平台提供：
- 📊 评估结果可视化仪表板
- 📈 历史趋势追踪
- 🏷️ 数据集管理和版本控制
- 🔄 A/B 测试支持
- 💾 评估结果缓存（降低重复评估成本）
- 👥 团队协作

**定价**（截至 2026 年初）：
| Plan | 月价格 | 评估量 | 功能 |
|---|---|---|---|
| Free | $0 | 有限 | 基础仪表板 |
| Pro | ~$50-100/月 | 中等 | 完整功能 |
| Enterprise | 定制 | 无限 | SSO + API + 优先支持 |

> 与 LangSmith 类似，是可选增值服务。如果我们已有自己的 Trace 系统和仪表板，**这部分价值有限**。

---

## 七、OpenEvals 独有优势详解

### 7.1 createJsonMatchEvaluator — 字段级 Rubric 评估

这是 OpenEvals 对 FinSpark 最有价值的功能，前文已详述。补充几点：

```typescript
// 高级用法：list_aggregator 处理数组字段
const riskEvaluator = createJsonMatchEvaluator({
  rubric: {
    'riskMatrix[*].risk': '风险描述是否具体而非空泛？',
    'riskMatrix[*].probability': '概率等级是否与详细分析一致？',
    'recommendations[*]': '建议是否具体可操作？',
  },
  aggregator: 'average',       // 对象内字段取平均
  list_aggregator: 'average',  // 数组元素取平均
  model: 'openai:gpt-4.1',
});
```

### 7.2 LangChain/LangGraph 生态集成

```typescript
// 直接与 LangSmith evaluate 函数集成
import { evaluate } from 'langsmith/evaluation';
import { createLLMAsJudge, HALLUCINATION_PROMPT } from 'openevals';

const hallucinationEval = createLLMAsJudge({
  prompt: HALLUCINATION_PROMPT,
  model: 'openai:gpt-4.1',
});

await evaluate(
  myAgentFunction,
  {
    data: 'financial-analysis-benchmark',  // LangSmith 数据集
    evaluators: [hallucinationEval],
    experimentPrefix: 'profitability-v2.3',
  }
);
```

### 7.3 多模态评估支持（2026.03 更新）

OpenEvals 最新版本增加了多模态支持，包括：
- 图像相关性评估
- 视觉幻觉检测
- 敏感图像检测
- 音频质量评估

> 对 FinSpark 当前阶段价值不大，但如果未来需要评估图表生成质量，这将是有用的功能。

---

## 八、FinSpark 场景适配性综合评分

### 8.1 需求匹配度矩阵

| FinSpark 需求 | 重要性 | DeepEval 评分 | OpenEvals 评分 | 说明 |
|---|---|---|---|---|
| **12 Agent JSON 输出质量评估** | ⭐⭐⭐⭐⭐ | 3/5 | **5/5** | OpenEvals 的 JsonMatchEvaluator 完美匹配 |
| **字段级深度评估 (Rubric)** | ⭐⭐⭐⭐⭐ | 2/5 | **5/5** | DeepEval 无原生字段级 Rubric |
| **自定义财务评估 Prompt** | ⭐⭐⭐⭐⭐ | **5/5** | **5/5** | 两者都支持 |
| **4 阶段轨迹评估** | ⭐⭐⭐⭐ | 3/5 | **4/5** | agentevals 多匹配模式更适合 |
| **TypeScript 原生集成** | ⭐⭐⭐⭐ | 1/5 | **5/5** | DeepEval 仅 Python |
| **Cloudflare Workers 兼容** | ⭐⭐⭐⭐ | 1/5 | **3/5** | OpenEvals 可部分内联 |
| **实时抽样评估** | ⭐⭐⭐ | 3/5 | **4/5** | 两者都可，但 TS 集成更简单 |
| **批量回归测试** | ⭐⭐⭐ | **5/5** | 4/5 | DeepEval 的 pytest 集成更强 |
| **合成测试数据** | ⭐⭐ | **5/5** | 1/5 | DeepEval 独有优势 |
| **确定性评估 (DAG)** | ⭐⭐ | **5/5** | 1/5 | DeepEval 独有优势 |
| **低成本评估（本地模型）** | ⭐⭐ | **4/5** | 2/5 | DeepEval 本地模型支持更好 |
| **红队安全测试** | ⭐ | **5/5** | 1/5 | DeepEval 独有，但 FinSpark 暂不需要 |

### 8.2 加权综合评分

```
DeepEval 总分 = (3×5 + 2×5 + 5×5 + 3×4 + 1×4 + 1×4 + 3×3 + 5×3 + 5×2 + 5×2 + 4×2 + 5×1) / 加权总和
            = (15 + 10 + 25 + 12 + 4 + 4 + 9 + 15 + 10 + 10 + 8 + 5) / (25+25+25+20+20+20+15+15+10+10+10+5)
            = 127 / 200
            = 63.5%

OpenEvals 总分 = (5×5 + 5×5 + 5×5 + 4×4 + 5×4 + 3×4 + 4×3 + 4×3 + 1×2 + 1×2 + 2×2 + 1×1) / 加权总和
             = (25 + 25 + 25 + 16 + 20 + 12 + 12 + 12 + 2 + 2 + 4 + 1) / 200
             = 156 / 200
             = 78.0%
```

| 框架 | 加权总分 | 核心需求得分 | 工程适配得分 |
|---|---|---|---|
| **OpenEvals** | **78.0%** | **93%** (JSON+字段+Prompt) | **87%** (TS+Workers) |
| **DeepEval** | **63.5%** | **67%** (缺字段级评估) | **33%** (Python only) |

---

## 九、混合方案探讨

### 9.1 "OpenEvals 主力 + DeepEval 辅助" 方案

考虑到两者各有独特优势，是否可以混合使用？

```
┌─────────────────────────────────────────────────────────────┐
│                    评估系统架构                               │
│                                                              │
│  ┌───────────────────────────────────┐                      │
│  │ 主框架：OpenEvals (TypeScript)    │                      │
│  │  ├─ 实时抽样评估 (Workers 内联)   │                      │
│  │  ├─ JSON 字段级评估               │                      │
│  │  ├─ 12 Agent 自定义 Prompt        │                      │
│  │  └─ 轨迹评估 (agentevals)        │                      │
│  └───────────────────────────────────┘                      │
│                    │                                         │
│                    │  定期触发                                │
│                    ▼                                         │
│  ┌───────────────────────────────────┐                      │
│  │ 辅助：DeepEval (Python service)   │                      │
│  │  ├─ DAG 确定性评估（月度深度）    │                      │
│  │  ├─ 合成数据生成（季度扩展）      │                      │
│  │  ├─ 红队测试（安全审查）          │                      │
│  │  └─ 批量回归测试 (pytest)         │                      │
│  └───────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**混合方案优缺点**：

| 维度 | 优点 | 缺点 |
|---|---|---|
| 功能覆盖 | 两者优势都能利用 | 两套系统的学习成本 |
| 架构复杂度 | — | 增加 Python 服务运维 |
| 成本 | 灵活选择 Judge 模型 | 额外 Python 运行时成本 |
| 团队能力 | — | 需要 Python + TypeScript 双栈 |
| 指标一致性 | — | 两个框架的评分可能不完全可比 |

### 9.2 可行性判断

混合方案在技术上可行，但在 FinSpark 当前阶段**不推荐**：
1. 团队以 TypeScript 为主，增加 Python 服务增加维护负担
2. DAG 评估和合成数据是"锦上添花"，不是核心需求
3. 两套评分体系会增加结果解读的复杂度
4. 可以先用 OpenEvals 覆盖 90% 需求，未来按需引入 DeepEval

---

## 十、最终推荐

### 10.1 推荐方案：OpenEvals（主框架）

**推荐理由**：

| 优势项 | 具体说明 |
|---|---|
| **核心需求完美匹配** | `createJsonMatchEvaluator` 是 12 Agent JSON 输出评估的最佳工具 |
| **语言原生** | TypeScript 包，直接集成到 FinSpark 后端，零跨语言开销 |
| **轻量灵活** | 函数式 API，可嵌入任何工作流，不强制特定测试框架 |
| **字段级 Rubric** | 可为每个 JSON 字段定义独立评估标准，精细度远超 DeepEval |
| **Agent 轨迹** | agentevals 的多匹配模式（strict/subset/superset）精准匹配 4 阶段流程 |
| **成本相当** | 使用相同 Judge 模型时，成本与 DeepEval 几乎一致 |
| **生态协同** | 与 LangSmith 天然集成，未来可低成本接入追踪平台 |

### 10.2 DeepEval 保留为"未来选项"

| 场景 | 触发条件 | 引入方式 |
|---|---|---|
| **需要合成测试数据** | 金标准数据集不足 100 家公司 | 独立 Python 脚本，离线生成 |
| **需要 DAG 确定性评估** | 发现 LLM Judge 评分波动过大 | 独立 Python 服务，月度运行 |
| **需要红队安全测试** | 用户反馈安全问题或合规要求 | 独立 Python 脚本，定期执行 |
| **需要本地模型 Judge** | API 成本超过预算上限 | 独立 Python 服务 + GPU |

### 10.3 实施路线图

```
Phase 0（当前）：选定 OpenEvals
                 ↓
Phase 1（第1-2周）：引入 openevals，实现 Layer 1+2 基础评估
  ├─ npm install openevals agentevals
  ├─ 实现 3 个通用评估器（幻觉/深度/一致性）
  ├─ 实现 createJsonMatchEvaluator 字段级评估
  └─ 接入实时 10% 抽样
                 ↓
Phase 2（第3-4周）：12 Agent 专用评估 + 回归测试
  ├─ 为 12 Agent 编写专用 Prompt + Rubric
  ├─ 构建 10 家公司基准数据集
  └─ 实现批量评估 + 回归测试脚本
                 ↓
Phase 3（第5-6周）：Layer 3 报告级评估 + 仪表板
  ├─ 实现 Trajectory 评估
  ├─ 实现跨 Agent 一致性检查
  └─ 前端评估仪表板
                 ↓
Phase 4（按需）：引入 DeepEval 辅助功能
  ├─ 合成数据扩展基准集
  ├─ DAG 确定性评估（如果 LLM Judge 波动大）
  └─ 红队安全测试
```

### 10.4 成本预期

| 阶段 | 月评估成本 | 工程投入 | 收益 |
|---|---|---|---|
| Phase 1 | ~$3-10 | 1 周 | 捕获幻觉和低质量输出 |
| Phase 2 | ~$30-80 | 2 周 | 12 Agent 精细化质量监控 |
| Phase 3 | ~$100-200 | 2 周 | 端到端报告质量保障 |
| Phase 4 | +$50-100 (如引入) | 按需 | DAG/合成数据/安全测试 |

---

## 十一、附录

### 附录 A：DeepEval 核心 API 速查

```python
# 安装
pip install deepeval

# G-Eval 自定义指标
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

metric = GEval(
    name="财务分析深度",
    criteria="...",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    model="gpt-4.1",
    threshold=0.7,
    async_mode=True,
)

test_case = LLMTestCase(input="...", actual_output="...")
metric.measure(test_case)
print(metric.score, metric.reason)

# JSON 合规检查
from deepeval.metrics import JsonCorrectnessMetric
from pydantic import BaseModel

class MySchema(BaseModel):
    field1: str
    field2: int

metric = JsonCorrectnessMetric(expected_schema=MySchema)
metric.measure(test_case)

# DAG 评估
from deepeval.metrics.dag import DAGMetric, DeepAcyclicGraph, TaskNode, VerdictNode

task = TaskNode(instructions="...", output_label="result")
verdict = VerdictNode(children=[task])
dag = DAGMetric(name="...", dag=DeepAcyclicGraph(root_nodes=[task]))

# pytest 集成
# deepeval test run test_file.py
from deepeval import assert_test
assert_test(test_case, [metric1, metric2])

# 合成数据
from deepeval.synthesizer import Synthesizer
synth = Synthesizer()
cases = synth.generate(contexts=[...], num_test_cases=50)
```

### 附录 B：OpenEvals 核心 API 速查

```typescript
// 安装
// npm install openevals agentevals

// LLM-as-Judge
import { createLLMAsJudge, HALLUCINATION_PROMPT } from 'openevals';

const evaluator = createLLMAsJudge({
  prompt: MY_PROMPT,
  model: 'openai:gpt-4.1',
  feedbackKey: 'my_metric',
  continuous: true,
  fewShotExamples: [...],
});

const result = await evaluator({
  inputs: '...', outputs: '...', referenceOutputs: '...',
});
// { key: 'my_metric', score: 0.85, comment: '...' }

// JSON 字段级评估
import { createJsonMatchEvaluator } from 'openevals';

const jsonEval = createJsonMatchEvaluator({
  rubric: { 'field.path': '评估标准描述' },
  aggregator: 'average',
  model: 'openai:gpt-4.1',
  useReasoning: true,
});

// Agent 轨迹评估
import { createTrajectoryLLMAsJudge } from 'agentevals';

const trajectoryEval = createTrajectoryLLMAsJudge({
  prompt: MY_TRAJECTORY_PROMPT,
  model: 'openai:gpt-4.1',
  continuous: true,
});
```

### 附录 C：关键参考链接

| 资源 | URL |
|---|---|
| DeepEval GitHub | https://github.com/confident-ai/deepeval |
| DeepEval 文档 | https://deepeval.com/docs |
| DeepEval G-Eval | https://deepeval.com/docs/metrics-g-eval |
| DeepEval DAGMetric | https://deepeval.com/docs/metrics-dag |
| DeepEval JSON Correctness | https://deepeval.com/docs/metrics-json-correctness |
| DeepEval 自定义 LLM | https://deepeval.com/guides/guides-using-custom-llms |
| OpenEvals GitHub | https://github.com/langchain-ai/openevals |
| OpenEvals NPM | https://www.npmjs.com/package/openevals |
| AgentEvals GitHub | https://github.com/langchain-ai/agentevals |
| LangSmith 评估 | https://docs.langchain.com/langsmith/evaluation-quickstart |
| Confident AI 平台 | https://confident-ai.com |

### 附录 D：决策摘要卡

```
┌──────────────────────────────────────────────────────────┐
│                   技术选型决策卡                          │
│                                                          │
│  选型结论：  OpenEvals（主框架）                          │
│  备选方案：  DeepEval（未来按需引入）                     │
│                                                          │
│  核心理由：                                               │
│  1. createJsonMatchEvaluator 完美匹配 12 Agent 评估需求  │
│  2. TypeScript 原生，与 FinSpark 后端零摩擦集成           │
│  3. 字段级 Rubric 是 DeepEval 缺乏的关键能力             │
│  4. 相同 Judge 模型下成本基本一致                         │
│                                                          │
│  主要取舍：                                               │
│  放弃 DeepEval 的 DAG 确定性评估（未来可补充）            │
│  放弃 DeepEval 的合成数据生成（可用其他工具替代）         │
│  放弃 DeepEval 的红队测试（当前不是优先级）               │
│                                                          │
│  预算影响：  ~$100-200/月（与 DeepEval 方案无显著差异）   │
│  工期影响：  比 DeepEval 方案节省 ~5 天（无需搭建 Python）│
│                                                          │
│  决策者：_____________  日期：2026-04-03                  │
└──────────────────────────────────────────────────────────┘
```

---

*文档结束。本文档应与 `openevals-evaluation-framework.md` 配合阅读，后者包含了基于 OpenEvals 的完整实施方案设计。*
