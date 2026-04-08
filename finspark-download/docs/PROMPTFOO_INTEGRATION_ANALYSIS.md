# Promptfoo 对 FinSpark 项目的价值分析、可实现效果与开发方案

> **版本**: v1.0  
> **日期**: 2026-04-07  
> **状态**: 分析完成，待实施  
> **关联上下文**: v10.2→v10.3 评测修复 (PR #36), Langfuse+OpenEvals 已集成 (PR #1-#3)

---

## 一、FinSpark 当前评估体系全景

### 1.1 现有评估系统架构

FinSpark 目前有 **两套独立的评估体系**，分别覆盖不同场景：

```
┌─────────────────────────────────────────────────────────────────┐
│                    FinSpark 评估体系现状                          │
│                                                                 │
│  ┌──────────────────────────┐  ┌───────────────────────────┐   │
│  │  系统 A: RAG 评测引擎     │  │  系统 B: Agent 质量评估    │   │
│  │  (ragTestSet.ts)          │  │  (openevals-evaluator.ts) │   │
│  │                          │  │                           │   │
│  │  定位: RAG 检索+生成质量  │  │  定位: 12-Agent 输出质量   │   │
│  │  触发: 手动/批量评测      │  │  触发: 实时抽样(10%)       │   │
│  │  指标: 7 维打分 v3        │  │  指标: 6 维 LLM-as-Judge  │   │
│  │  存储: D1 (rag_eval_*)   │  │  存储: D1 + Langfuse      │   │
│  │  UI: /rag?tab=evaluation │  │  UI: /api/eval/* 接口      │   │
│  └──────────────────────────┘  └───────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────┐  ┌───────────────────────────┐   │
│  │  可观测性: Langfuse        │  │  Chunk 增强: ragEnhance   │   │
│  │  全链路 Trace + Cost      │  │  HyDE / 摘要 / 实体标注   │   │
│  └──────────────────────────┘  └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 系统 A — RAG 评测引擎 (ragTestSet.ts) 详细分析

**七维打分公式 (v3)**：
```
Overall = 检索层(55%) + 生成层(45%)

检索层:
  Context Sufficiency  25%  — LLM 判断 chunks 是否包含完整答案信息
  Chunk Relevance      10%  — 纯算法: Precision@3 + TopScore + 分数梯度
  Chunk Integrity      10%  — LLM 判断切片语义完整性
  Recall               10%  — reference_pages 匹配 + 实体覆盖率

生成层:
  Semantic             25%  — LLM 按题型差异化评估语义正确性
  Exact Match          10%  — 连续分数: 关键实体+数值匹配
  Faithfulness         10%  — LLM 判断答案是否忠实于检索上下文
```

**已发现的问题** (来自 v10.2→v10.3 调查):

| 问题 | 严重程度 | 状态 |
|------|---------|------|
| `computeChunkRelevance` 阈值 0.6 偏高，大多数 chunk 得分 0.45-0.61 | 🔴 高 | 待修复 |
| `llmRerank` 只返回 top-4，丢失剩余 chunks | 🟢 已修复 | PR #36 |
| `dedicatedRerank` 只返回 top-10，丢失剩余 chunks | 🟢 已修复 | PR #36 |
| 评测不传 `documentIds`，导致跨文档噪声 | 🟡 中 | 待验证 |
| LLM 评分 (Sufficiency/Integrity/Faithfulness) 无评分一致性校验 | 🟡 中 | 待解决 |
| 无 CI/CD 自动回归检测 | 🟡 中 | 未开始 |

### 1.3 系统 B — Agent 质量评估 (openevals-evaluator.ts) 详细分析

**六维评估体系**：
```
Agent 输出质量 = 加权(
  数据准确性 dataAccuracy     25%  — Agent 专用 prompt 评估
  分析深度   analysisDepth    25%  — 因果归因/趋势/对比/前瞻
  专业洞察   professionalInsight 20% — 复用 Agent 专用评估
  逻辑一致性 logicalConsistency 15% — 跨字段逻辑自洽
  表达质量   expressionQuality  10% — 语言/结构/简洁度
  幻觉检测   hallucination      5%  — 数据捏造+过度推断
)
```

**特点**: 12 个 Agent 各有专属 prompt (PROFITABILITY, BALANCE_SHEET, CASH_FLOW 等)

**已有功能**: 抽样控制、模型降级、并发限制、D1 持久化、Langfuse 联动、低分告警

---

## 二、Promptfoo 能力全面映射

### 2.1 Promptfoo 核心能力一览

| 能力域 | 具体功能 | FinSpark 对应需求 |
|--------|---------|------------------|
| **RAG 评估** | context-faithfulness, context-relevance, context-recall, factuality, answer-relevance | 对标系统 A 的 7 维打分 |
| **自定义 Provider** | TypeScript/Python/Shell 自定义 API 调用 | 对接 FinSpark RAG pipeline API |
| **矩阵对比** | 多 prompt × 多 provider × 多 test case | 对比 v9 vs v10.2 vs v10.3 |
| **CI/CD** | GitHub Actions, Quality Gates, 自动阻断 | 部署前自动回归检测 |
| **红队测试** | prompt injection, RAG poisoning, PII 泄露 | 金融数据安全合规 |
| **Agent 评估** | trajectory:goal-success, 多步轨迹 | 12-Agent 编排评估 |
| **跨语言** | LLM-based metrics 天然支持中文 | 中文财报 RAG 系统 |
| **声明式配置** | YAML 驱动, 无需编写代码 | 降低评估维护成本 |
| **Web UI** | 可分享的评估结果页面 | 团队协作审查 |
| **缓存** | 相同输入跳过重复调用 | 降低评估成本 |

### 2.2 Promptfoo vs 现有系统能力对比

```
                              FinSpark 现有        Promptfoo           结合效果
                              ────────────        ─────────           ────────
RAG 检索评估                    ✅ 7 维打分         ✅ 5 种内置指标      ⭐ 互补增强
Agent 输出评估                  ✅ 6 维 LLM Judge   ✅ llm-rubric       ⭐ 可替代
跨版本 A/B 对比                 ⚠️ 手动 SQL 查询    ✅ 矩阵视图         ⭐ 大幅提升
CI/CD 自动回归                  ❌ 无               ✅ GitHub Actions    ⭐ 填补空白
红队安全测试                    ❌ 无               ✅ 40+ 攻击插件      ⭐ 填补空白
评测结果可视化                  ⚠️ 基础表格         ✅ 专业 Web UI       ⭐ 大幅提升
Prompt 版本对比                 ❌ 无               ✅ 多 prompt 矩阵    ⭐ 填补空白
评测成本控制                    ⚠️ 手动估算         ✅ 缓存+token 追踪   ⭐ 优化
声明式测试管理                  ❌ 代码内嵌          ✅ YAML/CSV         ⭐ 大幅提升
多语言评估                      ⚠️ 自建中文 prompt  ✅ 原生跨语言        ⭐ 增强
评分一致性校验                  ❌ 无               ✅ 多 grader 对比    ⭐ 填补空白
```

---

## 三、Promptfoo 对 FinSpark 的具体价值

### 3.1 价值 1: RAG 评测专业化 — 替代 `computeChunkRelevance` 硬编码

**现有问题**: `computeChunkRelevance` 使用硬编码阈值 0.6，导致大多数 chunk (score 0.45-0.61) 被判定为不相关。

```typescript
// 现有代码 (ragTestSet.ts:1029-1049)
const relevantThreshold = 0.6;  // ← 硬编码阈值，不适应不同检索配置
const precision3 = top3.filter(s => s >= relevantThreshold).length / top3.length;
```

**Promptfoo 解决方案**: 使用 `context-relevance` (LLM-based) 替代纯算法评分

```yaml
# promptfoo 配置 — 自动用 LLM 判断上下文相关性
defaultTest:
  assert:
    - type: context-relevance
      threshold: 0.7
      contextTransform: 'output.sources.map(s => s.chunkContent).join("\n")'
```

**效果预估**: Relevance 得分从 41-47% 提升到 65-80%（因为 LLM 理解语义相关性，不依赖硬编码阈值）

### 3.2 价值 2: 跨版本矩阵对比 — 终结手动 SQL 查询

**现有痛点**: 每次对比 v9/v10.2/v10.3，需要手动写 SQL + Python 脚本拼数据

**Promptfoo 解决方案**: 一条命令生成矩阵视图

```yaml
# promptfooconfig.yaml — 跨版本对比
description: 'FinSpark RAG v9 vs v10.3 对比评测'

providers:
  - id: file://providers/finspark_rag_v9.ts
    label: 'v9-baseline'
  - id: file://providers/finspark_rag_v10.3.ts
    label: 'v10.3-rerank-fix'

prompts:
  - '{{question}}'

tests: file://tests/golden_test_set.yaml

defaultTest:
  assert:
    - type: context-faithfulness
      contextTransform: 'output.sources.map(s => s.chunkContent).join("\n")'
      threshold: 0.7
    - type: factuality
      value: '{{expected_answer}}'
    - type: answer-relevance
      threshold: 0.8
    - type: javascript
      value: |
        // 自定义: source 数量 >= 6
        const sources = JSON.parse(output).sources || [];
        return sources.length >= 6 ? { pass: true, score: 1 } : { pass: false, score: sources.length / 8, reason: `只有 ${sources.length} 个 source` };
```

**效果**: `promptfoo eval` → 自动生成 Web UI 矩阵对比表，一键分享给团队

### 3.3 价值 3: CI/CD 自动回归检测 — 防止 llmRerank 4-source bug 再次发生

**根因回顾**: `llmRerank` 只返回 top-4 的 bug 在部署后 **无自动检测**，直到手动跑评测才发现。

```yaml
# .github/workflows/rag-eval.yml
name: RAG Quality Gate
on:
  pull_request:
    paths:
      - 'src/services/ragPipeline.ts'
      - 'src/services/ragGpuProvider.ts'

jobs:
  rag-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run RAG evaluation
        env:
          VECTORENGINE_API_KEY: ${{ secrets.VECTORENGINE_API_KEY }}
        run: |
          npx promptfoo@latest eval \
            -c promptfoo/rag-regression.yaml \
            --fail-on-error \
            -o results.json
      
      - name: Check quality gate
        run: |
          FAILURES=$(jq '.results.stats.failures' results.json)
          if [ "$FAILURES" -gt 0 ]; then
            echo "❌ RAG regression detected: $FAILURES failures"
            exit 1
          fi
```

**效果**: 每次修改 RAG pipeline 代码，PR 自动触发评测，低于阈值自动阻断合并

### 3.4 价值 4: 12-Agent 编排评估 — 超越单 Agent 维度

**现有局限**: `openevals-evaluator.ts` 只评估单个 Agent 输出质量，缺乏：
- Agent 间数据传递正确性评估
- 整体报告与前序分析一致性评估  
- 不同股票/行业的 Agent 表现差异分析

**Promptfoo 解决方案**: trajectory + 自定义 provider

```yaml
# 12-Agent 编排评测
providers:
  - id: file://providers/finspark_analysis.ts
    label: 'Full 12-Agent Analysis'
    config:
      stockCode: '002594.SZ'
      timeout: 120000

tests:
  - vars:
      stockCode: '002594.SZ'
      stockName: '比亚迪'
    assert:
      # Agent 间一致性
      - type: llm-rubric
        value: |
          检查以下多Agent分析报告:
          1. Profitability Agent 的营收数据是否与 Balance Sheet Agent 一致
          2. Risk Agent 的风险等级是否与 Final Conclusion 的推荐一致
          3. Forecast Agent 的预测是否基于 Trend Interpretation 的历史趋势
          评分: 一致性 0-1
        threshold: 0.7
      
      # 幻觉检测
      - type: context-faithfulness
        contextTransform: 'output.inputData'
        threshold: 0.8
      
      # 关键字段完整性
      - type: javascript
        value: |
          const report = JSON.parse(output);
          const agents = ['PROFITABILITY', 'BALANCE_SHEET', 'CASH_FLOW', 'RISK', 
                         'BUSINESS_INSIGHT', 'FORECAST', 'VALUATION', 'FINAL_CONCLUSION'];
          const missing = agents.filter(a => !report[a] || !report[a].summary);
          return missing.length === 0 
            ? { pass: true, score: 1 } 
            : { pass: false, score: 1 - missing.length/agents.length, reason: `Missing: ${missing.join(', ')}` };
```

### 3.5 价值 5: 红队安全测试 — 金融场景合规

**现有空白**: 无任何安全评估

```yaml
# promptfoo/redteam-config.yaml
redteam:
  purpose: '中文金融年报问答系统'
  plugins:
    - harmful:privacy       # PII 泄露检测
    - rag-poisoning         # RAG 投毒攻击
    - prompt-injection      # 提示注入
    - ssrf                  # 服务端请求伪造
    - sql-injection         # SQL 注入 (D1 数据库)
    - excessive-agency      # 过度授权 (Agent 误操作)
  strategies:
    - jailbreak
    - prompt-injection
    - crescendo
  
  numTests: 50
```

**效果**: 自动生成 50+ 攻击测试用例，检测 RAG 系统的安全边界

### 3.6 价值 6: 评分一致性校验 — 解决 LLM 评分漂移

**现有问题**: `gpt-4.1-mini` 做 Judge 时，同一输入多次评分差异可达 ±15%

```yaml
# Promptfoo 多 grader 对比
defaultTest:
  options:
    provider:
      - openai:gpt-4.1-mini    # 主 grader
      - openai:gpt-4.1         # 对照 grader
  assert:
    - type: context-faithfulness
      threshold: 0.7
```

**效果**: 通过多 grader 交叉验证，发现评分不稳定的 test case，提升评估可信度

---

## 四、集成架构设计

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      FinSpark + Promptfoo 集成架构                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                    promptfoo/ 目录结构                            │     │
│  │                                                                 │     │
│  │  promptfoo/                                                     │     │
│  │  ├── promptfooconfig.yaml          # 主配置文件                   │     │
│  │  ├── rag-regression.yaml           # RAG 回归测试                 │     │
│  │  ├── agent-eval.yaml               # 12-Agent 评测                │     │
│  │  ├── redteam-config.yaml           # 红队安全测试                  │     │
│  │  │                                                              │     │
│  │  ├── providers/                                                 │     │
│  │  │   ├── finspark_rag.ts           # RAG pipeline 自定义 provider │     │
│  │  │   ├── finspark_analysis.ts      # 12-Agent 分析 provider       │     │
│  │  │   └── finspark_retrieval.ts     # 纯检索 provider (评估检索)   │     │
│  │  │                                                              │     │
│  │  ├── tests/                                                     │     │
│  │  │   ├── golden_rag.yaml           # RAG 黄金测试集               │     │
│  │  │   ├── golden_agent.yaml         # Agent 黄金测试集             │     │
│  │  │   ├── regression_sources.yaml   # Source 数量回归测试           │     │
│  │  │   └── security.yaml             # 安全测试用例                  │     │
│  │  │                                                              │     │
│  │  └── transforms/                                                │     │
│  │      ├── extract_context.ts        # 从 RAG 响应提取 context      │     │
│  │      └── parse_agent_output.ts     # 解析 Agent 输出              │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  调用链:                                                                  │
│                                                                          │
│  promptfoo eval                                                          │
│       │                                                                  │
│       ├─→ providers/finspark_rag.ts                                     │
│       │       │                                                          │
│       │       └─→ HTTP: POST /api/rag/query   ←── 线上/预发布环境        │
│       │            (或直接调用 createPipelineService)                     │
│       │                                                                  │
│       ├─→ 内置 assertions                                                │
│       │       ├── context-faithfulness                                   │
│       │       ├── context-relevance                                      │
│       │       ├── factuality                                             │
│       │       └── answer-relevance                                       │
│       │                                                                  │
│       ├─→ 自定义 assertions                                              │
│       │       ├── source-count >= 6                                      │
│       │       ├── relevance-score distribution                           │
│       │       └── agent-consistency check                                │
│       │                                                                  │
│       └─→ 输出                                                           │
│               ├── results.json      → CI/CD Quality Gate                │
│               ├── report.html       → 团队审查                           │
│               └── Web UI            → promptfoo view                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Custom Provider 实现 (核心代码)

```typescript
// promptfoo/providers/finspark_rag.ts
import type { ApiProvider, ProviderResponse } from 'promptfoo';

const BASE_URL = process.env.FINSPARK_API_URL || 'https://finspark-financial.pages.dev';
const API_KEY = process.env.VECTORENGINE_API_KEY;

class FinSparkRAGProvider implements ApiProvider {
  id() { return 'finspark-rag'; }

  async callApi(prompt: string, context?: any): Promise<ProviderResponse> {
    const question = context?.vars?.question || prompt;
    const documentIds = context?.vars?.documentIds || [];
    const config = context?.vars?.config || {};

    const startTime = Date.now();

    try {
      const response = await fetch(`${BASE_URL}/api/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          question,
          stockCode: context?.vars?.stockCode,
          documentIds,
          enableBm25: config.enableBm25 ?? true,
          enableRerank: config.enableRerank ?? true,
          topK: config.topK ?? 8,
          minScore: config.minScore ?? 0.2,
          contextMode: config.contextMode ?? 'adjacent',
          contextWindow: config.contextWindow ?? 2,
        }),
      });

      const data = await response.json() as any;
      const latencyMs = Date.now() - startTime;

      // 构建标准化输出 (供 assertions 使用)
      return {
        output: JSON.stringify({
          answer: data.answer,
          sources: data.sources || [],
          sourceCount: (data.sources || []).length,
          intent: data.intent,
          vectorResults: data.vectorResults,
          bm25Results: data.bm25Results,
          dedupCount: data.dedupCount,
          rerankApplied: data.rerankApplied,
        }),
        tokenUsage: {
          total: (data.tokensInput || 0) + (data.tokensOutput || 0),
          prompt: data.tokensInput || 0,
          completion: data.tokensOutput || 0,
        },
        metadata: {
          latencyMs,
          sourceCount: (data.sources || []).length,
          intent: data.intent,
        },
      };
    } catch (error: any) {
      return { error: `FinSpark RAG API error: ${error.message}` };
    }
  }
}

export default FinSparkRAGProvider;
```

### 4.3 测试用例设计 (从现有 TestSet 迁移)

```yaml
# promptfoo/tests/golden_rag.yaml
# 从 rag_test_sets (ID=1,2,3) 迁移，并增强 assertion 覆盖

- description: '比亚迪2024年营收 (数值型)'
  vars:
    question: '比亚迪2024年实现的营业收入是多少？同比增长多少？'
    stockCode: '002594.SZ'
    documentIds: [1, 2]
    expected_answer: '比亚迪2024年营收约7771亿元，同比增长29.02%'
  assert:
    # 检索层
    - type: context-relevance
      contextTransform: 'JSON.parse(output).sources.map(s => s.chunkContent).join("\n")'
      threshold: 0.7
    - type: context-faithfulness
      contextTransform: 'JSON.parse(output).sources.map(s => s.chunkContent).join("\n")'
      threshold: 0.7
    # 生成层
    - type: factuality
      value: '{{expected_answer}}'
    - type: answer-relevance
      threshold: 0.8
    # 自定义: source 数量
    - type: javascript
      value: |
        const data = JSON.parse(output);
        const count = data.sourceCount || 0;
        if (count >= 6) return { pass: true, score: 1.0 };
        if (count >= 4) return { pass: true, score: 0.7, reason: `${count} sources (期望>=6)` };
        return { pass: false, score: count / 8, reason: `仅 ${count} sources` };
    # 自定义: 关键数字匹配
    - type: javascript
      value: |
        const answer = JSON.parse(output).answer;
        const has7771 = /7[,.]?771/.test(answer);
        const has29 = /29\.?\d*%/.test(answer);
        const score = (has7771 ? 0.5 : 0) + (has29 ? 0.5 : 0);
        return { pass: score >= 0.5, score, reason: `营收${has7771?'✓':'✗'} 增长率${has29?'✓':'✗'}` };

- description: '招商银行净息收入趋势 (比较型)'
  vars:
    question: '招商银行2024年净利息收入与净手续费收入变化趋势如何？'
    stockCode: '600036.SH'
    documentIds: [3, 4]
    expected_answer: '净利息收入下降，净手续费收入也有所下降'
  assert:
    - type: context-relevance
      contextTransform: 'JSON.parse(output).sources.map(s => s.chunkContent).join("\n")'
      threshold: 0.7
    - type: factuality
      value: '{{expected_answer}}'
    - type: llm-rubric
      value: |
        评估回答是否准确描述了招商银行2024年的收入变化趋势。
        关键点: 1) 净利息收入的变化方向 2) 净手续费收入的变化方向 3) 是否有数据支撑
      threshold: 0.7
```

---

## 五、与现有系统的共存策略

### 5.1 不替代，而是增强

```
┌─────────────────────────────────────────────────────────────────────┐
│                     共存策略: 渐进式增强                              │
│                                                                     │
│  Phase 0 (现状):                                                    │
│    ragTestSet.ts  →  7维打分  →  D1 存储  →  基础 UI                 │
│    openevals       →  6维Judge →  D1+Langfuse → Eval Dashboard     │
│                                                                     │
│  Phase 1 (增强 RAG 评测):                                           │
│    ragTestSet.ts  →  保留，仍为线上实时评测引擎                       │
│    + promptfoo     →  新增，作为离线深度评测 + CI/CD 门禁              │
│    场景: 每次 PR 自动跑 promptfoo，线上仍用 ragTestSet               │
│                                                                     │
│  Phase 2 (增强 Agent 评测):                                         │
│    openevals      →  保留，仍为线上实时抽样评估                       │
│    + promptfoo     →  新增，作为 Agent 编排端到端评测                  │
│    场景: 修改 Agent prompt 时，promptfoo 对比新旧 prompt 效果         │
│                                                                     │
│  Phase 3 (安全 + 可选替代):                                         │
│    + promptfoo     →  红队测试                                       │
│    评估: 根据 Phase 1-2 效果，决定是否逐步用 promptfoo 替代           │
│           ragTestSet 的打分逻辑 (保留 D1 存储和 UI)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 关键决策点

| 问题 | 推荐策略 | 理由 |
|------|---------|------|
| 是否完全替代 ragTestSet.ts？ | **否，先共存** | ragTestSet 已深度集成 D1+UI，替代成本高 |
| 是否完全替代 openevals？ | **否，互补** | openevals 的实时抽样+Langfuse 联动 promptfoo 无法替代 |
| promptfoo 运行在哪里？ | **本地 + CI/CD** | 不部署到 Cloudflare Workers，作为开发/CI 工具 |
| 测试数据如何同步？ | **YAML 为主** | 从 D1 导出黄金测试集到 YAML，promptfoo 读 YAML |
| grader 用什么模型？ | **gpt-4.1-mini** | 与现有系统一致，便于分数对比 |

---

## 六、具体实验计划

### 6.1 实验 1: 检索质量对比 (立即可做)

**目标**: 对比 `computeChunkRelevance` (算法) vs `context-relevance` (LLM) 的评分差异

```yaml
# experiment-1-relevance.yaml
description: 'Experiment 1: 检索相关性评分方法对比'

providers:
  - id: file://providers/finspark_rag.ts
    label: 'FinSpark RAG (线上)'

tests: file://tests/golden_rag.yaml

defaultTest:
  assert:
    # Promptfoo 内置 LLM 评分
    - type: context-relevance
      contextTransform: 'JSON.parse(output).sources.map(s => s.chunkContent).join("\n")'
      threshold: 0.5
    
    # 自定义: 记录现有 computeChunkRelevance 等价逻辑
    - type: javascript
      value: |
        const data = JSON.parse(output);
        const scores = data.sources.map(s => s.relevanceScore).sort((a,b) => b-a);
        const top3 = scores.slice(0, 3);
        const precision3 = top3.filter(s => s >= 0.6).length / top3.length;
        const top1Factor = Math.min(30, Math.max(0, (scores[0] - 0.4) * 75));
        const topAvg = scores.slice(0, 2).reduce((s,v) => s+v, 0) / Math.min(2, scores.length);
        const bottomAvg = scores.length > 2 
          ? scores.slice(2).reduce((s,v) => s+v, 0) / (scores.length - 2) 
          : topAvg;
        const concentration = Math.min(30, Math.max(0, (topAvg - bottomAvg) * 200));
        const algorithmScore = Math.min(100, Math.round(precision3 * 40 + top1Factor + concentration));
        return { 
          pass: true, 
          score: algorithmScore / 100, 
          reason: `Algorithm Relevance: ${algorithmScore}%, P@3=${(precision3*100).toFixed(0)}%, Top1=${scores[0]?.toFixed(3)}` 
        };
```

**预期产出**: 明确 LLM 评分 vs 算法评分的差异，决定是否调整 `computeChunkRelevance` 阈值

### 6.2 实验 2: Rerank 效果量化 (待 v10.3 评测完成)

**目标**: 量化 rerank on/off 对检索质量的影响

```yaml
# experiment-2-rerank.yaml
providers:
  - id: file://providers/finspark_rag.ts
    label: 'Rerank ON'
    config:
      enableRerank: true
      rerankWeight: 0.7
  - id: file://providers/finspark_rag.ts
    label: 'Rerank OFF'
    config:
      enableRerank: false

defaultTest:
  assert:
    - type: context-faithfulness
      contextTransform: 'JSON.parse(output).sources.map(s => s.chunkContent).join("\n")'
      threshold: 0.6
    - type: factuality
      value: '{{expected_answer}}'
```

### 6.3 实验 3: Source Count 回归测试 (关键回归防护)

```yaml
# experiment-3-source-regression.yaml
description: 'Source Count 回归测试 — 防止 4-source bug 复现'

providers:
  - id: file://providers/finspark_rag.ts

tests:
  - vars:
      question: '比亚迪2024年实现的营业收入是多少？'
      stockCode: '002594.SZ'
    assert:
      - type: javascript
        value: |
          const data = JSON.parse(output);
          const count = data.sourceCount;
          if (count < 6) return { pass: false, score: 0, reason: `REGRESSION: only ${count} sources (expected >=6)` };
          return { pass: true, score: 1 };
  
  - vars:
      question: '宁德时代2024年各季度营业收入分别是多少？'
      stockCode: '300750.SZ'
    assert:
      - type: javascript
        value: |
          const data = JSON.parse(output);
          if (data.sourceCount < 6) return { pass: false, score: 0, reason: `REGRESSION: ${data.sourceCount} sources` };
          return { pass: true, score: 1 };
```

### 6.4 实验 4: 红队安全测试 (金融合规)

```yaml
# experiment-4-redteam.yaml
redteam:
  purpose: '中文金融年报 RAG 问答系统，基于 A 股上市公司年报数据'
  
  plugins:
    # RAG 特定攻击
    - rag-poisoning          # 尝试让 RAG 返回恶意内容
    
    # 提示注入
    - prompt-injection        # 尝试覆盖系统 prompt
    
    # 数据泄露
    - harmful:privacy         # 尝试获取个人隐私信息
    - pii:direct              # 直接 PII 查询
    
    # 滥用检测  
    - excessive-agency        # 尝试让系统执行超出权限的操作
    - hijacking               # 目标劫持
    
  strategies:
    - jailbreak
    - prompt-injection
    - crescendo
    - mischievous-user
    
  numTests: 30
```

---

## 七、开发计划 & 里程碑

### 7.1 Phase 1: RAG 评测增强 (第 1-2 周)

| 任务 | 工时 | 产出 |
|------|------|------|
| 初始化 promptfoo 环境 (`npm install -D promptfoo`) | 0.5d | package.json 更新 |
| 编写 `finspark_rag.ts` custom provider | 1d | 对接线上 RAG API |
| 从 D1 导出黄金测试集到 YAML (23 题) | 0.5d | golden_rag.yaml |
| 实验 1: context-relevance vs computeChunkRelevance | 1d | 对比报告 |
| 实验 2: rerank on/off 效果量化 | 0.5d | 矩阵对比 |
| 实验 3: source count 回归测试 | 0.5d | regression yaml |
| GitHub Actions CI/CD 配置 | 1d | .github/workflows/rag-eval.yml |
| **合计** | **5d** | |

### 7.2 Phase 2: Agent 评测增强 (第 3-4 周)

| 任务 | 工时 | 产出 |
|------|------|------|
| 编写 `finspark_analysis.ts` provider (对接 12-Agent) | 1.5d | Agent 评测 provider |
| 设计 Agent 黄金测试集 (5 只股票 × 12 Agent) | 2d | golden_agent.yaml |
| 跨 Agent 一致性 assertion (llm-rubric) | 1d | 一致性检测 |
| 与 openevals 评分对比分析 | 1d | 评分差异报告 |
| **合计** | **5.5d** | |

### 7.3 Phase 3: 安全 + 优化 (第 5-6 周)

| 任务 | 工时 | 产出 |
|------|------|------|
| 红队安全测试配置 | 1d | redteam-config.yaml |
| 运行红队扫描 + 修复发现的漏洞 | 2d | 安全报告 + 修复 PR |
| 根据 Phase 1-2 数据，决定是否调整 computeChunkRelevance | 1d | 阈值优化 |
| 评估 promptfoo 替代 ragTestSet 打分逻辑的可行性 | 1d | 决策文档 |
| **合计** | **5d** | |

### 7.4 总工期 & 投入

```
总工期:  ~15.5 人天 (3-4 周，非全职)
工具成本: $0 (promptfoo 开源, MIT 许可)
API 成本: ~$5-10/次评测 (gpt-4.1-mini 做 grader)
维护成本: 低 (YAML 声明式, CI/CD 自动化)
```

---

## 八、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| promptfoo 不支持中文 prompt 评估 | 低 | 高 | LLM-based metrics 天然支持中文；已验证 context-faithfulness 对中文有效 |
| 线上 API rate limit 导致评测失败 | 中 | 中 | 使用 promptfoo 缓存 + 限制并发 (`-j 2`) |
| 与现有系统评分不一致造成混淆 | 中 | 中 | Phase 1 先跑对比实验，确认分数映射关系后再推广 |
| CI/CD 评测耗时过长阻塞 PR | 低 | 中 | 只跑核心回归测试 (~10 题, <5min)，完整评测异步 |
| custom provider 维护负担 | 低 | 低 | provider 只是 HTTP 调用，结构稳定 |

---

## 九、结论与推荐

### 9.1 核心推荐

**立即实施 Phase 1 (RAG 评测 + CI/CD)**。理由：
1. **投入产出比最高**: 5 天开发，解决 3 个高优问题 (回归检测、Relevance 评分、跨版本对比)
2. **零风险**: 不修改现有系统，纯增量工具
3. **立竿见影**: 可直接量化 v10.3 rerank fix 的效果

### 9.2 优先级排序

```
P0 (立即): CI/CD 回归检测 — 防止 4-source bug 再次发生
P0 (立即): context-relevance 替代 computeChunkRelevance — 解决 Relevance 偏低
P1 (本月): 跨版本矩阵对比 — 数据驱动版本决策
P2 (下月): 12-Agent 端到端评测 — 报告质量保障
P3 (Q2):   红队安全测试 — 金融合规需求
```

### 9.3 与现有体系关系总结

```
Promptfoo 定位:  开发/CI 工具链 (离线评测 + 门禁)
现有系统定位:     生产运行时评估 (在线评测 + 监控)

互补关系:
  promptfoo    → 开发阶段: 版本对比 / 回归检测 / 安全扫描
  ragTestSet   → 运行阶段: 线上评测 / 持续监控 / 历史趋势
  openevals    → 运行阶段: 实时质量抽样 / Langfuse 联动
  Langfuse     → 全阶段:   可观测性 / Trace / 成本追踪
```

---

## 附录 A: 快速启动命令

```bash
# 1. 安装
cd finspark-download
npm install -D promptfoo

# 2. 初始化配置
mkdir -p promptfoo/providers promptfoo/tests promptfoo/transforms

# 3. 运行第一个评测
npx promptfoo eval -c promptfoo/rag-regression.yaml

# 4. 查看结果
npx promptfoo view

# 5. 分享结果
npx promptfoo eval -c promptfoo/rag-regression.yaml --share
```

## 附录 B: 现有测试集导出脚本

```bash
# 从线上 D1 导出测试集到 YAML
curl -s "https://finspark-financial.pages.dev/api/rag/enhance/test-sets/1/questions" \
  | python3 -c "
import sys, json, yaml
data = json.load(sys.stdin)
tests = []
for q in data.get('questions', []):
    tests.append({
        'description': f'{q[\"question_type\"]} - {q[\"difficulty\"]}',
        'vars': {
            'question': q['question'],
            'expected_answer': q['expected_answer'],
            'question_type': q['question_type'],
            'difficulty': q['difficulty'],
        }
    })
print(yaml.dump(tests, allow_unicode=True, default_flow_style=False))
" > promptfoo/tests/golden_rag_ts1.yaml
```
