# Promptfoo 接入 FinSpark 可执行开发计划 (终稿)

> **版本**: v2.0 (终稿，待确认)  
> **日期**: 2026-04-07  
> **前置文档**: `PROMPTFOO_INTEGRATION_ANALYSIS.md`  
> **关联 PR**: #36 (rerank fix + 分析文档)  
> **目标**: 将 Promptfoo 接入 FinSpark，作为 **RAG 离线评测 + CI/CD 回归门禁** 工具

---

## 0. 执行摘要

| 维度 | 数值 |
|------|------|
| **总工期** | 8-10 工作日 (Phase 1-2 必做) + 3-4 天 (Phase 3 可选) |
| **Phase 1** | 基础接入 + RAG 评测 — **3-4 天** (6 个任务) |
| **Phase 2** | CI/CD 门禁 + 回归防护 — **1.5-2 天** (4 个任务) |
| **Phase 3** | 高级评测 + 安全扫描 — **3-4 天** (4 个任务, 可延后) |
| **工具成本** | $0 (MIT 开源) |
| **评测成本** | ~$5-10/次 (gpt-4.1-mini grader) |
| **不修改现有系统** | ragTestSet / openevals / Langfuse 保持原样 |

> **核心原则**: Phase 1 做完即可独立产出价值；Phase 2 是防护性投资；Phase 3 根据 Phase 1-2 实际效果决定是否启动。

---

## 1. 当前项目状态总结 (截至 2026-04-07)

### 1.1 已完成
- [x] v10.3 rerank fix (PR #36): `llmRerank` + `dedicatedRerank` 返回全部 chunks
- [x] 600519.SH (贵州茅台) 资产负债数据已入库
- [x] Langfuse + OpenEvals 集成 (PR #1-#3 已合并)
- [x] 3 个黄金测试集已建立 (共 23 题: 10 事实 + 7 分析 + 6 对比)
- [x] Promptfoo 价值分析文档已完成 (`PROMPTFOO_INTEGRATION_ANALYSIS.md`)

### 1.2 进行中
- [ ] 评测 ID #67, #68, #69 (v10.3-rerank-fix) 正在运行中
- [ ] 静态文件服务器运行中 (localhost:9999, PID 68832)
- [ ] "贵州茅台分析失败" 问题待根因诊断和重跑

### 1.3 前置条件
| 条件 | 状态 | 说明 |
|------|------|------|
| Node.js >= 20 | OK | CI 和本地均已配置 |
| `VECTORENGINE_API_KEY` | OK | 用于调用 RAG API 和 grader |
| 线上 RAG API | OK | `https://finspark-financial.pages.dev/api/rag/query` |
| v10.3 rerank fix | 待合并 | PR #36, 合并后 source count 应 >= 6 |
| GitHub Secrets | 待配置 | `VECTORENGINE_API_KEY` 需添加到 repo secrets |
| 评测 #67-#69 结果 | 待完成 | 结果将用于与 promptfoo 评分对比 |

---

## 2. 目录结构设计

```
finspark-download/
├── .github/
│   └── workflows/
│       ├── build-deploy.yml           # 现有: 构建部署 (保持不变)
│       └── rag-eval.yml               # [新增] Promptfoo RAG 回归评测
├── promptfoo/
│   ├── promptfooconfig.yaml           # 主配置 (完整 23 题评测)
│   ├── regression.yaml                # CI/CD 精简回归配置 (5-8 题)
│   ├── providers/
│   │   └── finspark-rag.ts            # Custom provider: 对接 RAG API
│   ├── tests/
│   │   ├── ts1-factual.yaml           # TestSet 1: 事实型 (10 题)
│   │   ├── ts2-analytical.yaml        # TestSet 2: 分析推理型 (7 题)
│   │   ├── ts3-comparative.yaml       # TestSet 3: 跨公司对比型 (6 题)
│   │   └── regression-quick.yaml      # CI 快速回归子集 (5-8 题)
│   ├── experiments/                   # Phase 1.6 / Phase 3
│   │   ├── rerank-comparison.yaml     # Rerank ON vs OFF 对比
│   │   └── relevance-comparison.yaml  # LLM vs 算法 Relevance 对比
│   └── .promptfoo/                    # 缓存目录 (gitignore)
├── src/                               # 现有代码 (不修改)
└── package.json                       # 添加 promptfoo devDependency + scripts
```

---

## 3. Phase 1: 基础接入 + RAG 评测 (3-4 天)

### 任务 1.1 环境初始化

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 0.5 天 |
| **依赖** | 无 |
| **产出** | 目录结构 + promptfoo 可运行 |

**具体步骤**:

1. 安装 promptfoo 为开发依赖:
   ```bash
   cd finspark-download
   npm install -D promptfoo
   ```

2. 创建目录结构:
   ```bash
   mkdir -p promptfoo/providers promptfoo/tests promptfoo/experiments
   ```

3. 更新 `.gitignore`:
   ```
   # Promptfoo cache
   promptfoo/.promptfoo/
   promptfoo/output/
   ```

4. 在 `package.json` 的 `scripts` 中添加:
   ```json
   {
     "promptfoo:eval": "cd promptfoo && npx promptfoo eval",
     "promptfoo:eval:regression": "cd promptfoo && npx promptfoo eval -c regression.yaml",
     "promptfoo:view": "cd promptfoo && npx promptfoo view"
   }
   ```

5. 验证:
   ```bash
   npx promptfoo --version
   ```

**验收标准**: `npx promptfoo --version` 成功输出版本号，目录结构就位。

---

### 任务 1.2 Custom Provider: 对接 RAG API

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 1 天 |
| **依赖** | 任务 1.1 |
| **产出** | `promptfoo/providers/finspark-rag.ts` |

**核心设计**:

```typescript
// promptfoo/providers/finspark-rag.ts
//
// 职责: 调用线上 FinSpark RAG API, 返回标准化 JSON 供 assertions 消费
//
// 输入 (通过 context.vars):
//   - question: string          — 测试问题
//   - stockCode?: string        — 股票代码 (可选)
//   - documentIds?: number[]    — 限定文档 (可选)
//   - config?: object           — RAG 配置覆盖 (topK, enableRerank 等)
//
// 输出 (ProviderResponse):
//   - output: JSON string {
//       answer: string,
//       sources: Array<{ documentId, chunkId, pageRange, relevanceScore, chunkContent, title }>,
//       sourceCount: number,
//       intent: object,
//       rerankApplied: boolean,
//       latencyMs: number
//     }
//   - tokenUsage: { total, prompt, completion }
//   - metadata: { latencyMs, sourceCount, intent }
//
// 环境变量:
//   - FINSPARK_API_URL (默认: https://finspark-financial.pages.dev)
//   - VECTORENGINE_API_KEY (必需)
//
// 错误处理: API 超时 (30s) / 网络错误 → { error: 'FinSpark RAG API error: ...' }
```

**关键实现点**:
- 使用 `fetch()` 调用 `POST ${FINSPARK_API_URL}/api/rag/query`
- 支持通过 provider `config` 或 test `vars.config` 覆盖 RAG 参数 (topK, enableRerank, rerankWeight, minScore, contextMode, contextWindow)
- JSON 输出需包含完整的 `sources[]` 以供 `contextTransform` 提取
- 记录 `latencyMs` 以发现性能退化
- 超时设置 30 秒 (单道题)

**验证方式**:
```bash
# 用 1 道题测试 provider 能否正常工作
VECTORENGINE_API_KEY=xxx npx promptfoo eval -c promptfooconfig.yaml --filter-pattern "比亚迪2024年营收" --verbose
```

**验收标准**: 单道题评测成功，返回 answer + sources (sourceCount >= 5)。

---

### 任务 1.3 黄金测试集导出 (23 题)

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 1 天 |
| **依赖** | 任务 1.1, 线上 API 可用 |
| **产出** | 3 个 YAML 文件 (ts1-factual / ts2-analytical / ts3-comparative) |

**数据来源**: 从线上 D1 的 3 个 TestSet 导出 (API: `/api/rag/enhance/test-sets/{id}/questions`)

**每题 YAML 结构**:
```yaml
- description: 'Q1: 比亚迪2024年营收 [factual/easy]'
  vars:
    question: '比亚迪2024年实现的营业收入是多少？同比增长多少？'
    expected_answer: '约人民币7,771.02亿元，同比增长29.02%。'
    question_type: 'factual'
    difficulty: 'easy'
    stockCode: '002594.SZ'
    documentIds: [20,21,22,23,24,25,26,27,28,29,30,31,32,33]
  assert:
    # ---- 检索层 ----
    - type: context-relevance
      threshold: 0.65
    - type: context-faithfulness
      threshold: 0.6
    # ---- 生成层 (根据题型差异化) ----
    - type: factuality
      value: '{{expected_answer}}'
      threshold: 0.7
    # ---- 回归保护 ----
    - type: javascript
      value: |
        const data = JSON.parse(output);
        const count = data.sourceCount || 0;
        if (count >= 6) return { pass: true, score: 1.0 };
        if (count >= 4) return { pass: true, score: 0.7, reason: `${count} sources` };
        return { pass: false, score: count / 8, reason: `REGRESSION: ${count} sources` };
```

**每种题型的差异化 assertion 策略**:

| 题型 | 特有 assertion | 阈值 | 说明 |
|------|---------------|------|------|
| factual/number | `factuality` + `javascript` (数值正则) | 0.7 / 0.5 | 数值精确匹配 |
| factual/name | `factuality` + `contains` | 0.7 | 关键实体匹配 |
| analytical | `answer-relevance` + `llm-rubric` (分析深度) | 0.7 / 0.6 | 因果+趋势+对比 |
| comparative | `answer-relevance` + `llm-rubric` (对比完整性) | 0.7 / 0.6 | 多公司对比 |

**全部题目共享 assertion (通过 `defaultTest`)**:
1. `context-relevance` >= 0.65
2. `context-faithfulness` >= 0.6
3. `javascript: sourceCount >= 4` (硬性回归保护)

**验收标准**: 3 个 YAML 文件共 23 题，每题有完整的 vars 和至少 3 条 assert。

---

### 任务 1.4 主配置文件 + Context Transform

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 0.5 天 |
| **依赖** | 任务 1.2 + 1.3 |
| **产出** | `promptfoo/promptfooconfig.yaml` |

**核心配置**:
```yaml
description: 'FinSpark RAG 评测 (23题 x 多维度)'

providers:
  - file://providers/finspark-rag.ts

prompts:
  - '{{question}}'    # prompt 仅作传递, 实际问题通过 vars 注入

tests:
  - file://tests/ts1-factual.yaml
  - file://tests/ts2-analytical.yaml
  - file://tests/ts3-comparative.yaml

defaultTest:
  options:
    provider:
      id: openai:gpt-4.1-mini
      config:
        apiKey: ${VECTORENGINE_API_KEY}
        baseUrl: https://api.vectorengine.ai/v1
    # 从 JSON output 中提取 answer 供 factuality/answer-relevance 使用
    transform: |
      const parsed = JSON.parse(output);
      return parsed.answer;
  assert:
    # Context Transform: 从 JSON output 中提取 sources 拼接为 context
    - type: context-faithfulness
      threshold: 0.6
      contextTransform: |
        const parsed = JSON.parse(output);
        return (parsed.sources || []).map(s => s.chunkContent).join('\n---\n');
    - type: context-relevance
      threshold: 0.65
      contextTransform: |
        const parsed = JSON.parse(output);
        return (parsed.sources || []).map(s => s.chunkContent).join('\n---\n');
    # Source count 回归保护
    - type: javascript
      value: |
        const data = JSON.parse(output);
        const count = (data.sources || []).length;
        if (count >= 6) return { pass: true, score: 1.0 };
        if (count >= 4) return { pass: true, score: 0.7, reason: `${count} sources` };
        return { pass: false, score: count / 8, reason: `REGRESSION: only ${count} sources` };

# 并发控制 (避免 API rate limit)
evaluateOptions:
  maxConcurrency: 2
```

**关键设计决策**:
- `transform` 在 `defaultTest.options` 层级: 全局从 JSON 提取 `answer`
- `contextTransform` 在每条 context assertion 中: 提取 `sources[].chunkContent`
- grader 使用 `gpt-4.1-mini` (通过 VectorEngine 代理), 与现有系统一致
- `maxConcurrency: 2` 避免线上 API rate limit

**验收标准**: 配置文件通过 `npx promptfoo validate` (如有此命令), 或成功执行 `npx promptfoo eval --dry-run`。

---

### 任务 1.5 首次评测运行 + 结果校验

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 0.5 天 |
| **依赖** | 任务 1.4 |
| **产出** | `results.json` + 与 ragTestSet 评分对比分析 |

**执行步骤**:
```bash
# 1. 完整运行 23 题评测
VECTORENGINE_API_KEY=xxx npx promptfoo eval \
  -c promptfooconfig.yaml \
  -o output/first-run.json \
  --verbose

# 2. 查看 Web UI 矩阵
npx promptfoo view

# 3. 生成可分享链接
npx promptfoo eval -c promptfooconfig.yaml --share
```

**对比校验项** (与 ragTestSet 评测 #65 overall=75.3, #66 overall=54.5, #64 overall=65.4 对比):

| promptfoo 指标 | 对标 ragTestSet 指标 | 预期偏差 |
|---------------|---------------------|---------|
| `context-faithfulness` | Faithfulness (10%, v3) | 方向一致, 绝对值可能不同 |
| `context-relevance` | Chunk Relevance (10%, v3) | promptfoo LLM 可能显著高于算法评分 |
| `factuality` | Semantic (25%) + ExactMatch (10%) | 方向一致 |
| `answer-relevance` | Context Sufficiency (25%) | 近似 |
| source count | — (新增回归指标) | 预期 >= 6 (v10.3 fix) |

**验收标准**:
- [ ] 23 题全部有返回 (无 error)
- [ ] 整体通过率 >= 65% (与 ragTestSet Overall ~65 大致匹配)
- [ ] Source count >= 6 的比例 >= 80%
- [ ] 如有异常, 记录并调整 assertion 阈值

---

### 任务 1.6 跨版本/跨配置对比实验

| 属性 | 值 |
|------|---|
| **优先级** | P1 |
| **预计** | 0.5 天 |
| **依赖** | 任务 1.5 |
| **产出** | `promptfoo/experiments/rerank-comparison.yaml` + 对比报告 |

**实验设计**:
```yaml
# promptfoo/experiments/rerank-comparison.yaml
description: 'Rerank ON vs OFF vs TopK=12 对比'

providers:
  - id: file://providers/finspark-rag.ts
    label: 'Rerank ON (weight=0.7, topK=8)'
    config:
      enableRerank: true
      rerankWeight: 0.7
      topK: 8
  - id: file://providers/finspark-rag.ts
    label: 'Rerank OFF (topK=8)'
    config:
      enableRerank: false
      topK: 8
  - id: file://providers/finspark-rag.ts
    label: 'Rerank ON (topK=12)'
    config:
      enableRerank: true
      rerankWeight: 0.7
      topK: 12
```

**预期产出**: 三种配置的矩阵视图, 量化 rerank/topK 对 faithfulness、factuality、source count 的影响。

---

## 4. Phase 2: CI/CD 门禁 + 回归防护 (1.5-2 天)

> **启动条件**: Phase 1 任务 1.5 验收通过

### 任务 2.1 精简回归测试集 + Source Count 断言

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 0.5 天 |
| **依赖** | Phase 1 完成 |
| **产出** | `promptfoo/tests/regression-quick.yaml` |

**选题标准** (从 23 题中精选 6-8 题):
- 每种题型至少 1 题 (factual x2, analytical x2, comparative x2)
- 包含曾触发 bug 的场景 (如 sub-query 场景)
- 答案明确、评分稳定 (Phase 1 首次评测中标准差小的题目优先)
- 包含数值型事实核查 (如营收金额)

**初步候选** (依据 Phase 1 首次评测结果微调):
1. Q1: 比亚迪2024年营收 (factual/easy, 数值型)
2. Q4: 宁德时代各季度收入 (factual/medium, 多数值)
3. Q7: 北方华创营收 (factual/easy, 精确数值)
4. Q11: 招商银行营收下降原因 (analytical/hard)
5. Q13: 海螺水泥行业挑战 (analytical/hard)
6. Q18: 比亚迪 vs 宁德时代核心业务 (comparative/medium)

**每题硬性回归断言**:
```yaml
# 硬性断言: source count >= 5 (CI 阻断级别)
- type: javascript
  value: |
    const data = JSON.parse(output);
    if (data.sourceCount < 5) {
      return { pass: false, score: 0, reason: 'CRITICAL REGRESSION: sourceCount=' + data.sourceCount + ' (must >=5)' };
    }
    return { pass: true, score: 1 };
```

**验收标准**: 6-8 题回归集在 3 分钟内完成评测。

---

### 任务 2.2 GitHub Actions Workflow

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 0.5 天 |
| **依赖** | 任务 2.1 |
| **产出** | `.github/workflows/rag-eval.yml` |

**Workflow 设计**:
```yaml
name: RAG Quality Gate
on:
  pull_request:
    paths:
      - 'finspark-download/src/services/ragPipeline.ts'
      - 'finspark-download/src/services/ragGpuProvider.ts'
      - 'finspark-download/src/services/ragIntent.ts'
      - 'finspark-download/src/services/ragBm25.ts'
      - 'finspark-download/src/services/ragFts5.ts'
      - 'finspark-download/src/services/rag.ts'
      - 'finspark-download/src/services/ragConfig.ts'
      - 'finspark-download/src/services/ragEnhance.ts'

jobs:
  rag-regression:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: finspark-download/package-lock.json
      - name: Install dependencies
        working-directory: finspark-download
        run: npm ci
      - name: Run RAG regression evaluation
        working-directory: finspark-download/promptfoo
        env:
          VECTORENGINE_API_KEY: ${{ secrets.VECTORENGINE_API_KEY }}
          FINSPARK_API_URL: https://finspark-financial.pages.dev
        run: |
          npx promptfoo eval \
            -c regression.yaml \
            -o output/regression-results.json \
            -j 2
      - name: Check quality gate
        working-directory: finspark-download/promptfoo
        run: |
          FAILURES=$(jq '.results.stats.failures' output/regression-results.json)
          TOTAL=$(jq '.results.stats.total' output/regression-results.json)
          PASS_RATE=$(echo "scale=2; ($TOTAL - $FAILURES) * 100 / $TOTAL" | bc)
          echo "Pass rate: ${PASS_RATE}% (${FAILURES} failures / ${TOTAL} total)"
          if [ "$FAILURES" -gt 0 ]; then
            echo "::error::RAG regression detected: ${FAILURES} failures (pass rate: ${PASS_RATE}%)"
            exit 1
          fi
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: rag-eval-results
          path: finspark-download/promptfoo/output/
```

**关键配置**:
- 触发条件: 仅 PR 中修改了 RAG 相关代码文件
- `VECTORENGINE_API_KEY` 需手动添加到 GitHub Repo Secrets
- `FINSPARK_API_URL` 指向线上 (不是 localhost)
- 并发 `-j 2` 避免 API rate limit
- `timeout-minutes: 10` 防止评测卡住

**验收标准**: PR 修改 `ragPipeline.ts` 时自动触发 CI 评测, 5 分钟内完成。

---

### 任务 2.3 PR 评论集成

| 属性 | 值 |
|------|---|
| **优先级** | P1 |
| **预计** | 0.5 天 |
| **依赖** | 任务 2.2 |
| **产出** | rag-eval.yml 中的 PR 评论 step |

**实现**: 在 workflow 末尾添加:
```yaml
- name: Comment on PR (failure)
  if: failure() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const results = JSON.parse(fs.readFileSync('finspark-download/promptfoo/output/regression-results.json'));
      const stats = results.results?.stats || {};
      const failures = stats.failures || 0;
      const total = stats.successes + failures;
      const passRate = total > 0 ? ((total - failures) / total * 100).toFixed(1) : 'N/A';
      
      const body = [
        `## RAG 回归评测失败`,
        ``,
        `| 指标 | 值 |`,
        `|------|---|`,
        `| 通过率 | ${passRate}% |`,
        `| 失败项 | ${failures} |`,
        `| 总计 | ${total} |`,
        ``,
        `> 详情见 [Artifacts](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})`
      ].join('\n');
      
      await github.rest.issues.createComment({
        ...context.repo,
        issue_number: context.issue.number,
        body
      });
```

---

### 任务 2.4 回归配置文件 (`regression.yaml`)

| 属性 | 值 |
|------|---|
| **优先级** | P0 |
| **预计** | 与 2.1 合并 |
| **依赖** | 任务 2.1 |
| **产出** | `promptfoo/regression.yaml` |

**内容**:
```yaml
description: 'FinSpark RAG CI/CD 回归评测 (6-8 题)'

providers:
  - file://providers/finspark-rag.ts

prompts:
  - '{{question}}'

tests:
  - file://tests/regression-quick.yaml

defaultTest:
  options:
    provider:
      id: openai:gpt-4.1-mini
      config:
        apiKey: ${VECTORENGINE_API_KEY}
        baseUrl: https://api.vectorengine.ai/v1
    transform: |
      const parsed = JSON.parse(output);
      return parsed.answer;
  assert:
    - type: context-faithfulness
      threshold: 0.5
      contextTransform: |
        const parsed = JSON.parse(output);
        return (parsed.sources || []).map(s => s.chunkContent).join('\n---\n');
    # 硬性回归: source count
    - type: javascript
      value: |
        const data = JSON.parse(output);
        if ((data.sources || []).length < 5) {
          return { pass: false, score: 0, reason: 'CRITICAL: sourceCount < 5' };
        }
        return { pass: true, score: 1 };

evaluateOptions:
  maxConcurrency: 2
```

---

## 5. Phase 3: 高级评测 + 安全扫描 (3-4 天, 可延后)

> **启动条件**: Phase 1-2 完成且运行稳定 >= 1 周

### 任务 3.1 Relevance 评分方法对比实验

| 属性 | 值 |
|------|---|
| **优先级** | P2 |
| **预计** | 1 天 |
| **依赖** | Phase 1 完成 |
| **产出** | 实验报告 + 阈值调整建议 |

**目标**: 系统对比 `computeChunkRelevance` (算法, 阈值 0.6) vs `context-relevance` (promptfoo LLM) 的评分差异。

**方法**:
1. 23 题同时计算两种评分 (在 assertion 中同时输出)
2. 绘制散点图, 找出差异最大的 case
3. 产出: 是否调整 `relevantThreshold = 0.6` 的决策建议

---

### 任务 3.2 12-Agent 端到端评测

| 属性 | 值 |
|------|---|
| **优先级** | P2 |
| **预计** | 2 天 |
| **依赖** | Phase 1 完成 |
| **产出** | `finspark-analysis.ts` provider + `agent-e2e.yaml` |

**设计**: 调用完整 12-Agent 分析 API, 评估:
- Agent 间数据一致性 (llm-rubric)
- 关键字段完整性 (javascript assertion)
- 结论逻辑性 (answer-relevance)
- 测试集: 3-5 只代表性股票 (比亚迪, 招商银行, 宁德时代, 海螺水泥, 北方华创)

---

### 任务 3.3 红队安全扫描

| 属性 | 值 |
|------|---|
| **优先级** | P3 |
| **预计** | 1 天 |
| **依赖** | 任务 1.2 (provider 可用) |
| **产出** | `redteam-config.yaml` + 安全报告 |

**覆盖**: prompt injection, RAG poisoning, PII 泄露, excessive agency, SQL injection (D1)

---

### 任务 3.4 评分一致性分析

| 属性 | 值 |
|------|---|
| **优先级** | P3 |
| **预计** | 0.5 天 |
| **依赖** | 任务 1.5 |
| **产出** | 评分一致性报告 |

**方法**: 对同一测试集运行 3 次评测 (清缓存), 计算每题标准差, 标注不稳定题目。

---

## 6. 依赖关系图

```
Phase 1:
  1.1 环境初始化
   │
   ├──> 1.2 Custom Provider ──> 1.4 主配置 ──> 1.5 首次评测 ──> 1.6 对比实验
   │                              ^
   └──> 1.3 测试集导出 ──────────┘

Phase 2 (依赖 Phase 1 完成):
  1.5 ──> 2.1 回归集 + 2.4 regression.yaml ──> 2.2 GitHub Actions ──> 2.3 PR 评论

Phase 3 (可延后):
  Phase 1 完成 ──> 3.1 Relevance 实验
                ──> 3.2 Agent E2E
                ──> 3.3 红队安全
  1.5 完成     ──> 3.4 评分一致性
```

---

## 7. 开发节奏

```
Day 1:  任务 1.1 (环境) + 1.2 (Provider 开发 + 调试)
Day 2:  任务 1.3 (测试集导出) + 1.4 (主配置)
Day 3:  任务 1.5 (首次评测) + 1.6 (对比实验)
        -> Phase 1 交付
Day 4:  任务 2.1 (回归集) + 2.4 (regression.yaml) + 2.2 (CI/CD) + 2.3 (PR 评论)
        -> Phase 2 交付

---------- Phase 1-2 完成, 观察运行 1 周 ----------

Day 5:  任务 3.1 (Relevance 实验)
Day 6-7: 任务 3.2 (Agent E2E)
Day 8:  任务 3.3 (红队) + 3.4 (一致性)
        -> Phase 3 交付
```

---

## 8. 验收标准总表

### Phase 1 验收
- [ ] `npx promptfoo eval` 23 题全部有返回, 无 error
- [ ] promptfoo Web UI 可查看评测矩阵
- [ ] 评测结果与 ragTestSet 评分趋势一致 (偏差 < 20%)
- [ ] rerank on/off 对比实验产出可分享结果
- [ ] 首次评测的 source count >= 6 比例 >= 80%

### Phase 2 验收
- [ ] PR 修改 RAG 文件时自动触发 CI 评测
- [ ] source count < 5 的情况 CI 自动阻断
- [ ] CI 评测在 5 分钟内完成
- [ ] 失败时 PR 自动添加评论

### Phase 3 验收 (可选)
- [ ] Relevance 评分对比报告产出阈值调整建议
- [ ] 3-5 只股票端到端评测通过
- [ ] 红队扫描无 critical 漏洞 (或已修复)
- [ ] 评分不稳定题目识别并优化

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| promptfoo 中文 prompt 评估不准 | 低 | 高 | LLM-based metrics 天然支持中文; Phase 1.5 首次评测验证 |
| 线上 API rate limit 导致评测超时 | 中 | 中 | `maxConcurrency: 2` + promptfoo 缓存 |
| 与现有系统评分不一致造成混淆 | 中 | 中 | Phase 1.5 对比校验, 确认映射关系后再推广 |
| CI 评测耗时过长阻塞 PR | 低 | 中 | 回归集仅 6-8 题, 预期 < 5min |
| v10.3 fix 未合并影响评测基线 | 中 | 中 | 先合并 PR #36, 再开始 Phase 1 |

---

## 10. 需要确认的决策点

在开始开发前, 请确认以下事项:

### 10.1 环境相关
1. **API URL**: provider 调用 `https://finspark-financial.pages.dev/api/rag/query` 是否正确? 是否需要认证?
2. **GitHub Secrets**: `VECTORENGINE_API_KEY` 是否可以添加到 GitHub Repo Secrets?
3. **PR #36 合并时间**: Phase 1 依赖 rerank fix 已部署, 是否先合并?

### 10.2 评测相关
4. **测试集范围**: 23 题是否足够? 是否需要为 600519.SH (贵州茅台) 新增测试题?
5. **评分阈值**: `context-faithfulness >= 0.6`, `context-relevance >= 0.65`, `factuality >= 0.7` 是否合理? (Phase 1.5 可调)
6. **grader 模型**: 使用 `gpt-4.1-mini` 是否 OK? 或者用 `gpt-4.1` (更准但更贵)?

### 10.3 CI/CD 相关
7. **触发范围**: 除了 ragPipeline.ts 等 8 个文件, 是否还需要监控其他文件?
8. **阻断策略**: CI 失败是 block PR 合并, 还是仅 warning?
9. **评测频率**: 是否也需要定时 (如每天) 跑完整 23 题评测?

### 10.4 开发安排
10. **开发顺序**: 先 Phase 1 全做完再开 Phase 2? 还是 1.2+1.3 完成后就开始 2.1?
11. **Phase 3 启动**: 是否确认 Phase 3 可延后? 红队安全是否有紧迫需求?

---

## 附录 A: 与现有系统共存关系图

```
开发/CI 阶段 (Promptfoo 新增):
  ┌─────────────────────────────────────────────┐
  │  PR 提交 -> GitHub Actions                    │
  │    -> promptfoo eval (regression.yaml)        │
  │    -> pass/fail 门禁                           │
  │                                               │
  │  本地开发 -> npx promptfoo eval               │
  │    -> 跨版本矩阵对比                            │
  │    -> 实验验证                                  │
  └─────────────────────────────────────────────┘

生产运行时 (保持不变):
  ┌─────────────────────────────────────────────┐
  │  ragTestSet.ts  -> 线上评测 -> D1 存储        │
  │  openevals      -> 实时抽样 -> D1 + Langfuse  │
  │  Langfuse       -> 全链路 Trace + 成本追踪     │
  └─────────────────────────────────────────────┘
```

**Promptfoo 不替代任何现有系统, 纯增量工具。**

---

## 附录 B: 成本估算

| 项目 | 每次评测成本 | 频率 | 月成本估算 |
|------|------------|------|-----------|
| 23 题完整评测 (grader) | ~$3-5 | 每周 2 次 | ~$25-40 |
| 6 题 CI 回归评测 (grader) | ~$1-2 | 每天 1-2 次 PR | ~$30-60 |
| 红队扫描 (30 题) | ~$5-10 | 每月 1 次 | ~$5-10 |
| **月度总计** | | | **~$60-110** |

> 远低于现有系统的 $100-230/月 运行成本。
