# FinSpark 可观测性与评估体系：Langfuse + OpenEvals 选型决策与价值总结

> **版本**: v1.0  
> **日期**: 2026-04-05  
> **状态**: 已实施（Phase 1-3 已合并）  
> **关联 PR**: #1 (Langfuse+OpenEvals 集成), #2 (OpenEvals 稳定性硬化), #3 (Eval Dashboard+Token Tracking)  
> **详细文档**: `langfuse-observability-analysis.md`, `openevals-evaluation-framework.md`, `deepeval-vs-openevals-comparison.md`

---

## 一、选型决策总结

### 1.1 核心洞察

**Langfuse 与 OpenEvals 不是竞品，而是互补工具**，分别解决 LLM 应用生命周期中不同阶段的问题：

| 工具 | 类别 | 核心问题 | 在 FinSpark 中的角色 |
|------|------|----------|---------------------|
| **Langfuse** | LLM 可观测性平台 | "系统运行状况如何？" | 替代自建 Trace 系统，全链路追踪、成本追踪、Prompt 管理 |
| **OpenEvals** | LLM 评估工具箱 | "模型输出质量达标吗？" | 评估 12 Agent 输出质量，字段级 Rubric 评估 |
| **DeepEval** | 备选评估框架 | "更全面的评估能力" | 按需引入 DAG 确定性评估、合成数据、红队测试 |

### 1.2 最终决策卡

```
┌──────────────────────────────────────────────────────────────┐
│                   技术选型决策卡                               │
│                                                              │
│  可观测性：  Langfuse（自部署 Docker，MIT 开源）              │
│  质量评估：  OpenEvals（TypeScript 原生，MIT 开源）           │
│  评分存储：  Langfuse Score（评估结果统一存入，关联 Trace）    │
│  备选工具：  DeepEval（DAG/合成数据/红队测试，按需引入）      │
│                                                              │
│  预算影响：  ~$100-230/月（与纯自建方案相当）                 │
│  工期影响：  节省 ~25 天，加速 50%+ 上线                      │
│  风险等级：  极低（全部 MIT 开源，自部署零厂商锁定）          │
│                                                              │
│  实施状态：  ✅ Phase 1-3 已合并                              │
│  决策日期：  2026-04-03                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、为什么选 Langfuse

### 2.1 Langfuse vs 自建 Trace 系统

| 维度 | 自建 Trace | Langfuse |
|------|-----------|----------|
| **开发工时** | ~15-20 天 | **~3-5 天** |
| **UI 质量** | 需要从零开发 | **开箱即用，专业级 UI** |
| **功能深度** | 完全自定义 | 通用但已覆盖 80%+ 需求 |
| **成本追踪** | 需自建计算逻辑 | **自动计算，内置模型价格** |
| **Prompt 管理** | 不包含 | **内置版本管理 + Playground** |
| **扩展性** | 受限于团队资源 | 社区持续迭代 |

### 2.2 Langfuse 为 FinSpark 提供的六大能力

1. **全链路 Trace** — 12 Agent × 4 Phase DAG 执行的完整链路追踪
2. **Token & 成本追踪** — 每次分析 ~200K tokens、~$1-2 的精确成本核算
3. **Prompt 版本管理** — 12 Agent 的 Prompt 版本控制 + A/B 测试
4. **延迟监控** — P50/P90/P99 延迟分布，识别性能瓶颈
5. **评估分数集成** — OpenEvals 评估结果统一存储，趋势可视化
6. **人工标注** — CFA 分析师审核队列，持续优化评估基线

### 2.3 Cloudflare Workers 兼容方案

```typescript
// 使用 waitUntil 确保 Trace 数据不被截断
export default {
  async fetch(request, env, ctx) {
    const langfuse = new Langfuse({ ... });
    const result = await handleAnalysis(langfuse, request);
    ctx.waitUntil(langfuse.flushAsync());  // 关键：异步发送不阻塞响应
    return new Response(JSON.stringify(result));
  }
};
```

---

## 三、为什么选 OpenEvals（而非 DeepEval）

### 3.1 加权综合评分

| 框架 | 加权总分 | 核心需求得分 | 工程适配得分 |
|------|---------|------------|------------|
| **OpenEvals** | **78.0%** | **93%** (JSON+字段+Prompt) | **87%** (TS+Workers) |
| **DeepEval** | **63.5%** | **67%** (缺字段级评估) | **33%** (Python only) |

### 3.2 决定性因素

| 决策因素 | OpenEvals | DeepEval |
|---------|-----------|---------|
| **TypeScript 原生** | ✅ 直接 import | ❌ 需搭建 Python 微服务 |
| **字段级 Rubric 评估** | ✅ `createJsonMatchEvaluator` | ❌ 仅 Schema 合规检查 |
| **12 Agent JSON 输出评估** | ✅ 每字段独立评分 0-1 | ⚠️ 需额外组合 G-Eval |
| **Cloudflare Workers 兼容** | ✅ 部分可内联 | ❌ 不可能 (Python) |
| **Agent 轨迹评估** | ✅ 多匹配模式 (strict/subset) | ⚠️ 单一模式 |
| **成本** | ~$263/月 | ~$280/月 (相当) |

### 3.3 DeepEval 保留为未来选项

| 场景 | 触发条件 | 引入方式 |
|------|---------|---------|
| 需要合成测试数据 | 金标准数据集不足 100 家 | 独立 Python 脚本 |
| 需要 DAG 确定性评估 | LLM Judge 评分波动过大 | 独立 Python 服务 |
| 需要红队安全测试 | 合规要求或安全问题 | 独立 Python 脚本 |

---

## 四、已实施的三层评估体系

### 4.1 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: 端到端报告评估                                       │
│   Trajectory LLM-as-Judge + 跨Agent一致性检查                 │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Agent 输出评估 (OpenEvals)                          │
│   createJsonMatchEvaluator + 自定义财务 Prompt                │
│   6 维度: 数据准确性(25%) / 分析深度(25%) / 专业洞察(20%)      │
│          逻辑一致性(15%) / 表达质量(10%) / 幻觉检测(5%)        │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: 基础指标 (已有 model_evaluations)                    │
│   JSON 合法性 / 字段完整率 / 响应时间 / Token 使用量           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 评估运行模式

| 模式 | 频率 | 评估范围 | 月成本 |
|------|------|---------|--------|
| **实时抽样** (10%) | 每次分析 | Layer 1 全量 + Layer 2 幻觉检测 | ~$3 |
| **每日深度** | 每日 10 份 | Layer 1 + 2 全部 6 维度 | ~$240 |
| **每周回归** | 每周 | 固定基准集三层全量 | ~$20 |
| **模型对比** | 按需 | 多模型并行评估 | ~$10-20/轮 |

### 4.3 推荐架构数据流

```
Cloudflare Workers (TS 后端)
  ├─ 12 Agent 执行 ──→ Langfuse Trace (全链路记录)
  ├─ Agent 输出     ──→ OpenEvals 评估
  │                      ├─ 字段级 Rubric 评分
  │                      ├─ 幻觉检测
  │                      └─ 轨迹评估
  └─ 评估结果       ──→ Langfuse Score (统一存储 + 趋势分析)
                          └─ Langfuse UI (仪表板 + 告警)
```

---

## 五、实施进展

### 5.1 已完成的 PR

| PR | 标题 | 内容 | 状态 |
|----|------|------|------|
| **#1** | Langfuse+OpenEvals 集成 | Langfuse 可观测性 + OpenEvals LLM-as-Judge + GPU SGLang RAG | ✅ Merged |
| **#2** | OpenEvals 稳定性硬化 | Phase 2 - OpenEvals stability hardening + D1 persistence | ✅ Merged |
| **#3** | Eval Dashboard + Token Tracking | Phase 3 - Eval dashboard API, token tracking, dynamic sampling, alerts | ✅ Merged |

### 5.2 已实施功能

| 功能 | 实现文件 | 状态 |
|------|---------|------|
| Langfuse Trace 集成 | `services/langfuse.ts` | ✅ |
| OpenEvals 幻觉检测 | `evaluation/evaluators/common.ts` | ✅ |
| 动态采样率 | `evaluation/eval-runner.ts` | ✅ |
| Eval Dashboard API | `routes/eval-dashboard.ts` | ✅ |
| Token & 成本追踪 | `services/token-tracking.ts` | ✅ |
| 告警规则 | `services/alerts.ts` | ✅ |
| D1 持久化 | migrations 0030-0032 | ✅ |

---

## 六、投入产出总结

### 6.1 开发效率

| 指标 | 纯自建方案 | Langfuse + OpenEvals |
|------|-----------|---------------------|
| Trace 系统开发 | ~20 天 | **~5 天**（SDK 集成） |
| 评估系统开发 | ~27 天 | **~15 天**（OpenEvals 框架） |
| **总计** | **~47 天** | **~20 天** |
| **节省** | — | **~27 天（57%）** |

### 6.2 月运营成本

| 成本项 | 金额 |
|--------|------|
| Langfuse 自部署 (VPS) | $0-30 |
| OpenEvals Judge API (GPT-4.1) | $100-200 |
| **月总计** | **$100-230** |

### 6.3 核心价值

1. **将模型质量从"感觉"变成"数字"** — 6 维度 × 12 Agent = 72 个可量化质量指标
2. **加速 Prompt 优化闭环** — 评估→发现弱点→优化 Prompt→回归验证→上线
3. **降低运维成本** — Langfuse 替代自建 Trace，OpenEvals 替代自建评估逻辑
4. **零厂商锁定** — 全部 MIT 开源，数据在自有 PostgreSQL 中

---

## 七、后续演进

| 阶段 | 内容 | 时间线 |
|------|------|--------|
| **Phase 4** | 12 Agent 专用评估 Prompt + 字段级 Rubric | 1-2 周 |
| **Phase 5** | 10 家公司金标准基准数据集 | 2-3 周 |
| **Phase 6** | Langfuse Prompt Management 迁移 | 3-4 周 |
| **Phase 7** | 人工标注队列 + 告警规则优化 | 按需 |
| **按需** | 引入 DeepEval (DAG/合成数据/红队测试) | 按需 |

---

## 附录：相关文档导航

| 文档 | 内容 | 阅读场景 |
|------|------|---------|
| `langfuse-observability-analysis.md` | Langfuse 功能详细分析 + 与自建系统对比 + 技术方案 | 了解 Langfuse 选型全貌 |
| `openevals-evaluation-framework.md` | 三层评估体系详细设计 + 12 Agent 评估 Prompt + DB Schema | 实施评估功能 |
| `deepeval-vs-openevals-comparison.md` | DeepEval 与 OpenEvals 深度对比 + 成本分析 | 理解为什么选 OpenEvals |
| `RAG_REQUIREMENTS.md` (第十二章) | 可观测性与评估体系在 RAG 需求文档中的定位 | 全局视角 |
| `plan-c-vectorize-fts5.md` | Plan C 检索优化方案详设 | 理解 RAG 检索架构升级 |

---

> **文档维护说明**：本文档为 Langfuse + OpenEvals 选型决策的执行摘要。详细技术方案请参阅各关联文档。
