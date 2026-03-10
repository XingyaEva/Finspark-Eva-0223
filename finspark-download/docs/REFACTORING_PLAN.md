# Finspark 四项重构行动 — 开发计划与技术方案

> 编制日期: 2026-02-23  
> 状态: 待评审  
> 关联代码版本: commit 7bafa28 (genspark_ai_developer)

---

## 目录

- [行动一: 拆分 index.tsx 巨石文件](#行动一-拆分-indextsx-巨石文件)
- [行动二: 实现分析结果缓存](#行动二-实现分析结果缓存)
- [行动三: 添加合规免责声明](#行动三-添加合规免责声明)
- [行动四: PostCSS 替代 CDN TailwindCSS](#行动四-postcss-替代-cdn-tailwindcss)
- [总排期与优先级](#总排期与优先级)
- [风险评估](#风险评估)

---

## 行动一: 拆分 index.tsx 巨石文件

### 1.1 现状诊断

`src/index.tsx` 当前 **11,548 行**, 内含 **6 个完整 HTML 页面**, **207 个函数**, 全部以模板字符串形式内联。

| 页面段 | 行号范围 | 行数 | 函数数 | 说明 |
|--------|---------|------|--------|------|
| 路由/导入区 | 1–145 | 145 | 0 | import + 路由绑定 + 分享页逻辑 |
| **首页** | 146–1300 | **1,155** | 33 | 搜索、热门股票、认证UI、导航 |
| **分析页面** | 1301–8787 | **7,487** | 94 | 12 Agent 结果渲染、图表、行业对比、漫画生成 |
| 我的报告 | 8788–9448 | 661 | 21 | 报告列表、删除、查看 |
| 我的收藏 | 9449–10089 | 641 | 20 | 收藏列表、分组管理 |
| 账号设置 | 10090–10398 | 309 | 4 | 个人信息编辑 |
| 模型对比 | 10399–11548 | 1,150 | 18 | 模型对比测试 |

**核心矛盾**: 分析页面单段 7,487 行、94 个函数, 承载了:
- SSE 流式进度监听 (startAnalysis, pollStatus)
- 12 个 Agent 结果的完整渲染逻辑 (displayResults → 12 个 display* 函数)
- ECharts 图表初始化/切换 (6 个 chart 相关函数)
- 趋势解读面板 (8 个 trend 相关函数)
- 行业对比分析 (12 个 industry 相关函数)
- 漫画生成配置 (8 个 comic 相关函数)
- 历史对比/分享/PDF 导出 (15 个辅助函数)

### 1.2 拆分方案

#### 原则
1. **保持现有 SSR 模式不变** — 仍然由 Hono 后端渲染 HTML 字符串, 不引入 React/Vue
2. **每个页面拆为独立 `pages/*.ts` 文件** — 与 `assistant.ts`、`membership.ts` 等已有模式一致
3. **分析页面内部进一步按职责拆分 JS 模块** — 通过 `<script>` 标签组合
4. **提取公共模块** — 认证 UI、主题样式、工具函数等跨页面复用

#### 目标文件结构

```
src/
├── index.tsx                    # 主入口: 仅包含路由注册 (~150 行)
│
├── pages/
│   ├── home.ts                  # 首页 HTML+JS (~500 行)
│   ├── analysis.ts              # 分析页 HTML 骨架 (~400 行, 仅 DOM 结构)
│   ├── myReports.ts             # 我的报告 (~500 行)
│   ├── favorites.ts             # 我的收藏 (~500 行) 
│   ├── account.ts               # 账号设置 (~300 行)
│   ├── modelTest.ts             # 模型对比 (~500 行)
│   ├── assistant.ts             # 已有 ✓
│   ├── membership.ts            # 已有 ✓
│   ├── settings.ts              # 已有 ✓
│   ├── agentSettings.ts         # 已有 ✓
│   ├── share.ts                 # 已有 ✓
│   └── testChart.ts             # 已有 ✓
│
├── frontend/                    # 新建: 前端 JS 模块目录
│   ├── shared/
│   │   ├── auth.ts              # 认证状态管理 (checkAuth, showGuestUI, showUserUI, handleLogin...)
│   │   ├── theme.ts             # 黑金主题共享样式变量
│   │   ├── permissions.ts       # 权限检查与升级提示
│   │   ├── navigation.ts        # 导航栏 (桌面/移动端)
│   │   └── utils.ts             # formatDate, formatNumber 等工具函数
│   │
│   └── analysis/                # 分析页 JS 模块 (原 7,487 行 → 8 个文件)
│       ├── controller.ts        # 分析流程控制 (startAnalysis, pollStatus, displayResults)  ~400 行
│       ├── agentRenderers.ts    # 12 个 Agent 渲染函数 (displayFinancialAnalysis, displayRiskAnalysis...)  ~2,500 行
│       ├── charts.ts            # ECharts 图表 (initMainChart, updateMainChart, switchChartTab...)  ~600 行
│       ├── trendPanel.ts        # 趋势解读面板 (updateTrendInterpretationPanel, loadTrendInterpretation...)  ~500 行
│       ├── industryComparison.ts # 行业对比 (loadIndustryComparison, renderIndustryComparison, radar/bar chart...)  ~700 行
│       ├── comic.ts             # 漫画生成 (showComicConfigModal, startComicGeneration...)  ~500 行
│       ├── share.ts             # 分享/对比/PDF (createShareLink, showCompareModal, exportPDF...)  ~400 行
│       └── jsonParser.ts        # 前端 JSON 解析容错 (parseRawResult, parsePartialJson...)  ~200 行
│
├── styles/
│   ├── responsive.ts            # 已有 ✓
│   └── goldTheme.ts             # 新建: 提取黑金主题共享 CSS 变量
│
└── components/                  # 已有组件目录
    ├── floatingAssistant.ts     # 已有 ✓
    ├── analysisConfig.ts        # 已有 ✓
    ├── stockMarketPanel.ts      # 已有 ✓
    └── disclaimer.ts            # 新建: 合规免责声明组件
```

#### JS 模块组合方式

由于是 SSR 模板字符串（非 SPA 的前端 bundle）, 模块组合采用以下方式:

```typescript
// src/pages/analysis.ts
import { analysisControllerScript } from '../frontend/analysis/controller';
import { agentRenderersScript } from '../frontend/analysis/agentRenderers';
import { chartsScript } from '../frontend/analysis/charts';
// ...

export const analysisPageHtml = `
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <!-- HTML 骨架 -->
  ...
  <script>
    // 共享模块
    ${authScript}
    ${permissionsScript}
    
    // 分析页专用模块
    ${analysisControllerScript}
    ${agentRenderersScript}
    ${chartsScript}
    ${trendPanelScript}
    ${industryComparisonScript}
    ${comicScript}
    ${shareScript}
    ${jsonParserScript}
  </script>
</body>
</html>`;
```

每个 `frontend/**/*.ts` 文件导出一个字符串变量, 包含纯 JS 代码（因为最终会被嵌入 `<script>` 标签内）:

```typescript
// src/frontend/analysis/charts.ts
export const chartsScript = `
  // ========== ECharts图表全局变量和函数 ==========
  let mainChartInstance = null;
  let currentChartType = 'revenue';
  // ...

  function initMainChart(chartData) { ... }
  function updateMainChart() { ... }
  function switchChartTab(chartType, btnElement) { ... }
`;
```

### 1.3 执行步骤

| 步骤 | 任务 | 预估工时 | 风险 |
|------|------|---------|------|
| **S1** | 提取公共模块: `shared/auth.ts`, `shared/permissions.ts`, `shared/theme.ts` | 4h | 低: 纯提取, 不改逻辑 |
| **S2** | 拆分首页 → `pages/home.ts` | 2h | 低: 行数少, 逻辑简单 |
| **S3** | 拆分我的报告 → `pages/myReports.ts` | 1.5h | 低 |
| **S4** | 拆分我的收藏 → `pages/favorites.ts` (增强版) | 1.5h | 低 |
| **S5** | 拆分账号设置 → `pages/account.ts` | 1h | 低 |
| **S6** | 拆分模型对比 → `pages/modelTest.ts` (新文件) | 2h | 低 |
| **S7** | **拆分分析页面 JS 模块** (核心难点) | **8h** | **中**: 94 个函数间有隐式依赖 |
| **S8** | 拆分分析页面 HTML 骨架 → `pages/analysis.ts` | 2h | 低 |
| **S9** | 精简 `index.tsx` 至纯路由注册 (~150 行) | 1h | 低 |
| **S10** | 全量回归测试 (每个页面逐一验证) | 3h | 中: 可能有遗漏引用 |

**总预估: 26 小时 (约 3.5 个工作日)**

### 1.4 关键风险与对策

| 风险 | 概率 | 对策 |
|------|------|------|
| 前端 JS 函数间的隐式全局变量依赖 | 高 | S7 时先用 grep 扫描所有全局变量引用关系, 画出依赖图 |
| 模板字符串拼接时的转义问题 | 中 | 使用 tagged template literals, 避免手动 `${}` |
| 拆分后某些页面的 CSS 样式丢失 | 中 | 把共享样式 (`goldTheme.ts`) 统一注入每个页面 `<style>` |

### 1.5 验收标准

- [ ] `index.tsx` 行数 < 200 行, 仅包含 import 和路由注册
- [ ] 分析页面拆分为 8 个 JS 模块文件, 每个 < 700 行
- [ ] 所有 6 个页面功能 100% 回归通过 (搜索、分析、图表、漫画、分享、报告列表、收藏)
- [ ] `npm run build` 无新增 error
- [ ] 构建产物 `_worker.js` 体积无显著增长 (±5% 以内)

---

## 行动二: 实现分析结果缓存

### 2.1 现状诊断

**已有缓存机制** (代码审计发现):

| 缓存层 | 位置 | 策略 | TTL |
|--------|------|------|-----|
| 共享分析缓存 | `routes/api.ts` L472-582 | KV `shared:analysis:{code}:{type}` → 报告ID | **24 小时** |
| 进行中分析锁 | `routes/api.ts` L513-534 | KV `pending:analysis:{code}:{type}` | 分析期间 |
| 数据库回退 | `routes/api.ts` L536-580 | 查询 D1 最近一条 completed 报告 | **无过期** |
| 趋势解读缓存 | `orchestrator.ts` L1050-1123 | KV `trend_interpretation:{code}:{period}` | **90 天** |
| 洞察缓存 | `stockInsightAgent.ts` | `getCachedInsights()` → KV | 配置化 TTL |
| 报告完整性校验 | `reportValidation.ts` | 验证缓存报告是否包含 11 个必需字段 | — |

**结论**: 已有一套可用的共享缓存基础, 但存在以下不足:

1. **KV 缓存与 D1 不同步**: KV 24h 过期后, 每次都要查 D1, 但 D1 查到后只重设 KV 24h, 没有更长期策略
2. **无用户维度缓存**: 同一用户重复分析同一股票, 没有快速复用路径
3. **无缓存预热机制**: 热门股票 (贵州茅台/宁德时代等) 没有主动预热
4. **无缓存命中率监控**: 无法衡量缓存效果

### 2.2 优化方案

#### 三层缓存架构

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: KV 热缓存 (快速命中)                             │
│  Key: shared:analysis:{code}:{type}                       │
│  Value: reportId                                          │
│  TTL: 7 天 (从 24h 提升至 7 天)                            │
│  命中率目标: >60%                                          │
├──────────────────────────────────────────────────────────┤
│  Layer 2: D1 持久化报告 (可靠回退)                          │
│  表: analysis_reports                                      │
│  条件: status='completed' + 完整性校验通过                  │
│  新增字段: cache_valid_until (缓存有效期标记)               │
│  保鲜策略: 财报季更新后标记旧报告失效                        │
├──────────────────────────────────────────────────────────┤
│  Layer 3: 用户个人缓存 (登录用户专属)                       │
│  Key: user:{userId}:analysis:{code}                       │
│  Value: reportId                                          │
│  TTL: 30 天                                               │
│  价值: 用户自定义 Prompt 的分析结果独立缓存                  │
└──────────────────────────────────────────────────────────┘
```

#### 具体改动

**改动 1: 延长 KV 缓存 TTL (24h → 7 天)**

```typescript
// routes/api.ts — 分析完成后的缓存设置
// 改前:
await c.env.CACHE.put(cacheKey, String(reportId), { expirationTtl: 86400 }); // 24小时

// 改后:
const ANALYSIS_CACHE_TTL = 7 * 24 * 60 * 60; // 7天
await c.env.CACHE.put(cacheKey, String(reportId), { expirationTtl: ANALYSIS_CACHE_TTL });
```

**改动 2: D1 增加 `cache_valid_until` 字段**

```sql
-- migrations/0018_cache_optimization.sql
ALTER TABLE analysis_reports ADD COLUMN cache_valid_until TEXT;
-- 设置已有完成报告的缓存有效期为创建后90天
UPDATE analysis_reports 
SET cache_valid_until = datetime(created_at, '+90 days') 
WHERE status = 'completed' AND cache_valid_until IS NULL;
```

**改动 3: D1 回退查询增加有效期过滤**

```typescript
// routes/api.ts — D1 回退查询
const recentReport = await c.env.DB.prepare(
  `SELECT id, status, result_json FROM analysis_reports 
   WHERE company_code = ? AND report_type = ? AND status = 'completed'
   AND (cache_valid_until IS NULL OR cache_valid_until > datetime('now'))
   ORDER BY id DESC LIMIT 1`
).bind(body.companyCode, reportType).first();
```

**改动 4: 缓存命中率埋点**

```typescript
// routes/api.ts — 在每个缓存查询点添加计数
interface CacheMetrics {
  kvHit: number; kvMiss: number; d1Hit: number; d1Miss: number; newAnalysis: number;
}
// 使用 KV 存储每日计数 → 可在 /api/admin/cache-stats 查看
```

**改动 5: 热门股票缓存预热 (可选, Phase 2)**

```typescript
// scripts/cache-warmup.mjs — Cron Job (每日凌晨)
const HOT_STOCKS = ['600519.SH', '000858.SZ', '300750.SZ', '601318.SH', '600036.SH'];
for (const code of HOT_STOCKS) {
  // 检查缓存是否即将过期, 若是则触发预分析
  const cacheKey = `shared:analysis:${code}:annual`;
  const cached = await CACHE.get(cacheKey);
  if (!cached) {
    await fetch(`${BASE_URL}/api/analyze/start`, {
      method: 'POST',
      body: JSON.stringify({ companyCode: code, reportType: 'annual' }),
    });
    await sleep(60000); // 每个间隔60秒, 避免 API 峰值
  }
}
```

### 2.3 执行步骤

| 步骤 | 任务 | 预估工时 | 影响范围 |
|------|------|---------|---------|
| **C1** | KV TTL 从 24h 提升至 7 天 | 0.5h | `routes/api.ts` 3 处 |
| **C2** | D1 迁移: 增加 `cache_valid_until` 字段 | 1h | 新增 migration 文件 |
| **C3** | D1 回退查询增加有效期过滤 | 1h | `routes/api.ts` |
| **C4** | 分析完成时设置 `cache_valid_until` | 1h | `routes/api.ts` 分析完成回调 |
| **C5** | 缓存命中率埋点与监控 API | 3h | 新增 `/api/admin/cache-stats` |
| **C6** | 热门股票缓存预热脚本 (Phase 2) | 3h | 新增 scripts 文件 |
| **C7** | 联调测试: 缓存命中/失效/预热 | 2h | — |

**总预估: 11.5 小时 (约 1.5 个工作日)**

### 2.4 成本影响预估

| 场景 | 改动前 | 改动后 | 节约 |
|------|--------|--------|------|
| 热门股票 (日均 50 次查询) | 50 × 1.5 = 75 元/日 | 1 × 1.5 + 49 × 0 = 1.5 元/日 | **-98%** |
| 长尾股票 (日均 200 次, 去重 100 只) | 200 × 1.5 = 300 元/日 | 100 × 1.5 + 100 × 0 = 150 元/日 | **-50%** |
| 月度总成本 (估算) | ~11,250 元 | ~4,545 元 | **-60%** |

### 2.5 验收标准

- [ ] 相同股票在 7 天内第二次分析直接返回缓存 (estimatedTime: 0)
- [ ] 缓存报告通过完整性校验后方可返回
- [ ] `/api/admin/cache-stats` 可查看命中率
- [ ] D1 中的 `cache_valid_until` 字段正确设置

---

## 行动三: 添加合规免责声明

### 3.1 现状诊断

**法律风险分析**:

根据中国《证券法》第一百六十条: 未经证监会核准, 任何机构和个人不得经营证券投资咨询业务。Finspark 输出的「强烈买入/买入/持有/卖出」等明确买卖建议, 可能构成非法荐股。

**当前代码中的风险点**:

| 位置 | 风险内容 | 严重程度 |
|------|---------|---------|
| `prompts.ts` L515 | `"recommendation": "强烈买入/买入/持有/卖出/强烈卖出"` | **极高** |
| `prompts.ts` L543-547 | `"action": "强烈买入"`, `"positionSizing": "建议仓位比例"`, `"holdingPeriod": "建议持有期限"` | **极高** |
| `prompts.ts` L518 | `"oneSentence": "一句话核心投资建议"` | **高** |
| `prompts.ts` L649-650 | `"entryPointAssessment": "当前价位是否适合买入"`, `"suggestedAction": "强烈买入/买入/持有/减持/卖出"` | **极高** |
| `index.tsx` L2167 | 已有一句免责声明, 但用语不够严谨, 且不够醒目 | 中 |
| `pdf.ts` L1714-1726 | PDF 报告底部有免责声明, 但主体仍输出买卖建议 | 中 |
| 分析页面结论渲染 | 直接展示 recommendation.action（买入/卖出等） | **高** |

**已有的正面措施**:
- `index.tsx` L2167: "AI分析结论仅供参考，不构成任何投资建议"
- PDF 报告底部有免责声明
- 漫画第 8 格提示 "AI生成，仅供参考"

### 3.2 整改方案

#### 3.2.1 Agent Prompt 整改 (根本措施)

**策略**: 将「投资建议」转换为「财务质量评估」, 即:
- "强烈买入" → "财务质量优秀"
- "买入" → "财务质量良好"  
- "持有" → "财务质量一般"
- "卖出" → "财务质量较弱"
- "强烈卖出" → "财务质量堪忧"

**FINAL_CONCLUSION Prompt 改动**:

```typescript
// 改前 (prompts.ts L508):
FINAL_CONCLUSION: `你是资深的投资顾问，负责整合所有分析给出最终投资建议。`

// 改后:
FINAL_CONCLUSION: `你是资深的财务分析教育专家，负责整合所有分析给出客观的企业财务质量评估。

## 重要合规约束
- 你是财务数据解读工具，不是投资顾问
- 严禁给出任何买入、卖出、持有等具体交易建议
- 严禁预测股价走势或给出目标价
- 严禁建议仓位比例或持有期限
- 所有输出必须定位为"客观财务数据教育解读"
`
```

**FINAL_CONCLUSION JSON 结构改动**:

```
改前:                              改后:
─────                              ─────
"recommendation": "强烈买入"    →  "financialGrade": "优秀" (A/B/C/D/F)
"action": "强烈买入"            →  "qualityAssessment": "优秀/良好/一般/较弱/堪忧"
"holdingPeriod": "建议持有期限"  →  删除
"positionSizing": "建议仓位比例" →  删除
"targetPriceRange": "目标价格"   →  删除
"suitableInvestorType": "类型"   →  "riskAppetiteMatch": "适合偏好低风险的研究者了解"
"oneSentence": "投资建议"        →  "oneSentence": "一句话财务质量总结"
```

**VALUATION Prompt 改动** (L649-650):

```
改前: "suggestedAction": "强烈买入/买入/持有/减持/卖出"
改后: "valuationConclusion": "显著低估/轻度低估/合理/轻度高估/显著高估"

改前: "entryPointAssessment": "当前价位是否适合买入"  
改后: "valuationAssessment": "当前估值水平相对于历史和行业均值的位置分析"
```

#### 3.2.2 前端展示整改

**分析页面结论区域**: 原来展示 "投资建议: 强烈买入", 改为展示 "财务质量: 优秀 (A级)"

**新增全局免责声明横幅** (`components/disclaimer.ts`):

```typescript
export const disclaimerBannerHtml = `
<div id="globalDisclaimer" style="
  background: linear-gradient(90deg, #7c2d12 0%, #9a3412 100%); 
  border-top: 2px solid #f97316;
  padding: 12px 24px;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
  font-size: 12px; color: #fed7aa; text-align: center;
">
  <strong>⚠️ 免责声明</strong>：本平台所有分析内容由AI模型基于公开财务数据自动生成，仅供财务知识学习和研究参考，
  <strong>不构成任何投资建议</strong>。投资有风险，入市需谨慎。用户基于本平台内容做出的任何投资决策，
  本平台不承担任何法律责任。
  <button onclick="this.parentElement.style.display='none'" style="
    margin-left: 16px; color: #f97316; background: none; border: 1px solid #f97316;
    border-radius: 4px; padding: 2px 12px; cursor: pointer; font-size: 11px;
  ">我已知悉</button>
</div>`;
```

**新增首次访问免责弹窗**:

```typescript
export const disclaimerModalHtml = `
<div id="disclaimerModal" class="modal active" style="z-index:10000">
  <div class="modal-content" style="max-width:520px; padding:32px; border-radius:16px;">
    <h2 style="color:#f97316; font-size:20px; margin-bottom:16px;">
      ⚠️ 重要免责声明
    </h2>
    <div style="color:#d1d5db; font-size:14px; line-height:1.8;">
      <p>Finspark 是一个基于AI的<strong>财务数据教育解读工具</strong>。使用前请您知悉：</p>
      <ul style="padding-left:20px; margin:12px 0;">
        <li>所有分析内容由AI模型自动生成，可能存在错误</li>
        <li>本平台<strong style="color:#f97316;">不提供任何投资建议</strong>，不推荐任何证券买卖</li>
        <li>财务数据来自第三方，可能存在延迟或偏差</li>
        <li>用户的投资决策应独立判断，本平台不承担任何责任</li>
      </ul>
      <p style="color:#9ca3af; font-size:12px;">
        依据《中华人民共和国证券法》，未经许可不得从事证券投资咨询业务。
        本平台定位为财务知识教育工具，不属于证券投资咨询服务。
      </p>
    </div>
    <button onclick="
      localStorage.setItem('disclaimerAccepted','true');
      document.getElementById('disclaimerModal').classList.remove('active');
    " class="btn-gold" style="width:100%; padding:12px; border-radius:8px; margin-top:20px; cursor:pointer;">
      我已阅读并理解上述声明
    </button>
  </div>
</div>`;

export const disclaimerCheckScript = `
  if (!localStorage.getItem('disclaimerAccepted')) {
    // 首次访问显示弹窗, 已有则不显示
  } else {
    document.getElementById('disclaimerModal')?.classList.remove('active');
  }
`;
```

#### 3.2.3 PDF 报告免责声明增强

在 `pdf.ts` 的免责声明部分增加合规语句, 并在报告标题区域加入 "本报告不构成投资建议" 水印。

#### 3.2.4 后端敏感词过滤 (兜底措施)

```typescript
// services/contentFilter.ts — 新建
const SENSITIVE_PATTERNS = [
  /建议(买入|卖出|减持|增持|清仓)/g,
  /目标(价|股价)[：:]\s*\d/g,
  /仓位.{0,5}(比例|建议)[：:]/g,
  /(适合|建议).{0,5}(买入|建仓|加仓)/g,
];

export function sanitizeAnalysisOutput(text: string): string {
  let sanitized = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      console.warn(`[ContentFilter] 已过滤敏感内容: "${match}"`);
      return '【本段内容已过滤，仅提供客观数据解读】';
    });
  }
  return sanitized;
}
```

### 3.3 执行步骤

| 步骤 | 任务 | 预估工时 | 风险 |
|------|------|---------|------|
| **L1** | 修改 `FINAL_CONCLUSION` Prompt (去买卖建议, 改为质量评级) | 2h | 中: 需同步改前端渲染 |
| **L2** | 修改 `VALUATION` Prompt (去 suggestedAction) | 1h | 低 |
| **L3** | 新建 `components/disclaimer.ts` (免责横幅+弹窗) | 2h | 低 |
| **L4** | 所有 6 个页面注入免责声明 | 1.5h | 低 |
| **L5** | 前端分析结论渲染改为"财务质量评级" | 3h | 中: 逻辑较多 |
| **L6** | PDF 报告免责声明增强 | 1h | 低 |
| **L7** | 新建 `contentFilter.ts` 敏感词兜底过滤 | 2h | 低 |
| **L8** | 漫画脚本 Prompt 去投资建议 | 1h | 低 |
| **L9** | 测试: 触发分析, 验证输出不含买卖建议 | 2h | 中 |

**总预估: 15.5 小时 (约 2 个工作日)**

### 3.4 验收标准

- [ ] 全站搜索不到 "强烈买入"、"建议卖出"、"目标价"、"建议仓位" 等敏感词
- [ ] 首次访问弹出免责声明弹窗, 点击"我已知悉"后不再弹出
- [ ] 每个页面底部有固定免责声明横幅
- [ ] PDF 报告首页有醒目免责声明
- [ ] `contentFilter.ts` 对遗漏的敏感词有兜底过滤
- [ ] 新分析结果的结论区域显示"财务质量: A 优秀"而非"投资建议: 强烈买入"

---

## 行动四: PostCSS 替代 CDN TailwindCSS

### 4.1 现状诊断

**当前加载方式**:

```html
<!-- 在 11 个页面文件中都有 -->
<script src="https://cdn.tailwindcss.com"></script>
```

| 文件 | CDN 引用次数 |
|------|-------------|
| `index.tsx` | 6 (首页/分析/报告/收藏/账号/模型对比) |
| `pages/assistant.ts` | 1 |
| `pages/assistantWidget.ts` | 1 |
| `pages/membership.ts` | 1 |
| `pages/settings.ts` | 1 |
| `pages/share.ts` | 1 |
| `pages/agentSettings.ts` | 1 |
| **合计** | **12 处** |

**CDN 方式的问题**:

| 问题 | 影响 |
|------|------|
| 浏览器端实时编译 CSS (JIT) | 首屏延迟 +200-400ms |
| 下载 tailwindcss.min.js (~365KB gzip) | 带宽浪费 |
| 控制台 warning: "should not be used in production" | 不专业 |
| 依赖外部 CDN 可用性 | 中国大陆有时不稳定 |
| 无法 tree-shake 未使用的 class | — |

### 4.2 迁移方案

#### 方案选型

由于项目是 **Hono SSR + 模板字符串** (非标准 SPA), 不适合常规的 Vite + PostCSS + Tailwind 打包流程。
需要一种方式将 Tailwind CSS **预编译为静态 CSS 文件**, 然后在模板中引用。

**选定方案: Tailwind CLI 独立构建 → 静态 CSS 文件 → `<link>` 引用**

```
构建流程:
  tailwindcss CLI 扫描模板字符串 → 生成 dist/static/tailwind.css → Hono 路由返回静态文件
```

#### 具体改动

**新增文件**:

```
src/
├── styles/
│   └── tailwind.css          # Tailwind 入口文件 (仅 3 行)
├── tailwind.config.js         # Tailwind 配置
```

```css
/* src/styles/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',     // 扫描所有模板字符串中的 class
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4af37',
          light: '#f5d17e',
          dark: '#b8941f',
        },
      },
    },
  },
  plugins: [],
};
```

**package.json 新增脚本**:

```json
{
  "scripts": {
    "css:build": "npx tailwindcss -i ./src/styles/tailwind.css -o ./dist/static/tailwind.css --minify",
    "css:watch": "npx tailwindcss -i ./src/styles/tailwind.css -o ./public/static/tailwind.css --watch",
    "build": "npm run css:build && vite build",
    "dev": "npm run css:watch & vite"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

**模板字符串替换 (12 处)**:

```html
<!-- 改前 -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- 改后 -->
<link rel="stylesheet" href="/static/tailwind.css">
```

**Hono 静态文件路由** (确保 dist/static/ 被正确 serve):

Cloudflare Pages 默认会 serve `dist/` 下的静态文件, 所以 `dist/static/tailwind.css` 会自动映射到 `/static/tailwind.css`。本地 wrangler dev 也一样。

**自定义 CSS 处理**:

当前内联在 `<style>` 标签中的自定义样式 (如 `.gold-text`, `.search-input`, 动画等) **保持不变**, 它们不依赖 Tailwind 编译, 是纯 CSS。

Tailwind CLI 的扫描范围设置为 `src/**/*.{ts,tsx}`, 它能够从模板字符串中提取 Tailwind class (`bg-black/80`, `text-gray-400`, `flex`, `space-x-3` 等) 并生成对应的 CSS 规则。

### 4.3 执行步骤

| 步骤 | 任务 | 预估工时 | 风险 |
|------|------|---------|------|
| **T1** | 安装 tailwindcss, 创建配置文件和入口 CSS | 0.5h | 低 |
| **T2** | 配置 Tailwind content 扫描路径 | 0.5h | **中**: 模板字符串中的动态 class 需验证 |
| **T3** | 修改 build 脚本, 集成 CSS 构建 | 1h | 低 |
| **T4** | 替换 12 处 CDN `<script>` 为 `<link>` | 1h | 低: 机械替换 |
| **T5** | 验证 Tailwind CLI 扫描覆盖率 | 2h | **中**: 可能有遗漏的 class |
| **T6** | 验证所有 11 个页面样式一致 | 2h | 中: 视觉回归 |
| **T7** | 本地 + Wrangler Pages Dev 联调 | 1h | 低 |

**总预估: 8 小时 (约 1 个工作日)**

### 4.4 性能提升预估

| 指标 | CDN 方式 | PostCSS 方式 | 改善 |
|------|---------|-------------|------|
| Tailwind JS 下载 | 365 KB (gzip) | 0 KB | **-100%** |
| CSS 文件大小 | — (运行时编译) | ~15–25 KB (gzip) | — |
| 首屏 CSS 就绪时间 | 600-800ms (下载+编译) | 50-100ms (静态文件) | **-85%** |
| 控制台警告 | 1 条 production warning | 无 | ✅ |
| CDN 依赖 | 需要 | 不需要 | ✅ |

### 4.5 验收标准

- [ ] 全站搜索不到 `cdn.tailwindcss.com`
- [ ] `dist/static/tailwind.css` 文件存在且大小 < 100KB
- [ ] 所有 11 个页面的样式与改动前视觉一致
- [ ] 浏览器控制台无 Tailwind production warning
- [ ] `npm run build` 包含 CSS 构建步骤
- [ ] Lighthouse Performance 分数提升 ≥ 5 分

### 4.6 风险说明

**主要风险**: Tailwind CLI 扫描模板字符串中的动态 class。

例如, 如果代码中有:
```javascript
element.className = `text-${color}-500`;
```
Tailwind CLI 无法识别这种动态拼接的 class。需要:
1. 在 `tailwind.config.js` 的 `safelist` 中预声明动态 class
2. 或改用完整的 class 名 (`text-red-500`, `text-green-500` 写在注释中)

**对策**: 在 T5 步骤中, 通过对比 CDN 方式和 PostCSS 方式的渲染结果, 逐页检查, 找出遗漏的 class 并加入 safelist。

---

## 总排期与优先级

### 执行优先级矩阵

```
          影响大
            ↑
            │    行动一          行动二
            │    拆分 index     分析缓存
            │    (26h, P1)      (11.5h, P1)
            │
            │    行动三          行动四
            │    合规免责        PostCSS
            │    (15.5h, P0!)   (8h, P2)
            │
            └──────────────────────────→ 工时少
```

### 建议执行顺序

| 顺序 | 行动 | 理由 | 工时 | 依赖 |
|------|------|------|------|------|
| **第 1 周** | 行动三: 合规免责 | 法律风险最高, 应立即处理 | 2 天 | 无 |
| **第 1-2 周** | 行动四: PostCSS | 工时最少, 快速见效, 且为行动一铺路 | 1 天 | 无 |
| **第 2-3 周** | 行动二: 分析缓存 | 直接省钱, ROI 最高 | 1.5 天 | 无 |
| **第 3-4 周** | 行动一: 拆分 index | 工时最大, 但为后续所有迭代铺路 | 3.5 天 | 建议先完成行动四 |

**总工时**: 61 小时 ≈ **8 个工作日**

### 里程碑

| 日期 | 里程碑 | 交付物 |
|------|--------|--------|
| W1-D3 | 合规免责上线 | Prompt 改版 + 免责弹窗/横幅 + 敏感词过滤 |
| W1-D4 | PostCSS 迁移完成 | 去除 CDN, 静态 CSS 构建 |
| W2-D3 | 缓存优化上线 | 7 天 TTL + D1 有效期 + 命中率监控 |
| W4-D2 | index.tsx 拆分完成 | 11,548 行 → 150 行入口 + 18 个模块文件 |
| W4-D3 | 全量回归测试通过 | 全部功能验证 |

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 行动一拆分导致页面功能回退 | 中 | 高 | 每拆一个模块就立即测试; Git 细粒度提交便于回滚 |
| 行动三 Prompt 改动导致分析质量下降 | 中 | 中 | 先在测试环境对 5 只股票 A/B 对比新旧 Prompt 输出质量 |
| 行动四 Tailwind 扫描遗漏动态 class | 中 | 低 | safelist 兜底 + 逐页视觉回归 |
| 行动二缓存过期策略不合理 | 低 | 中 | 可通过 admin API 随时手动清除特定缓存 |
| 四项行动并行开发导致合并冲突 | 高 | 低 | 行动三和四先行, 完成后再开始行动一; 行动二独立于前端 |

---

*本文档由 AI 辅助生成, 所有方案需经团队评审后方可执行。*
