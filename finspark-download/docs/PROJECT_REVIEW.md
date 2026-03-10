# Finspark / Genspark 财报分析系统 — 项目复盘（PPT友好版 v2.1）

更新时间：2026-01-06  核心读者：产品/增长/研发负责人  用途：投放给大模型生成PPT

—

## 0. 一页纸摘要（Executive Summary）
- 核心目标：把机构级财报分析能力以“人话”交付给普通投资者（5分钟读懂一家公司）
- 当前形态：Cloudflare Pages + Hono 边缘应用，后端API + 前端轻页面，D1/KV 持久化与缓存
- 分析引擎：多Agent DAG编排（10+），新增“行业对比”为独立API模块（非主编排）
- 数据源：Tushare Pro（默认走5000积分代理），支持业绩预告/快报/财务指标/主营业务等高级接口
- 模型策略：主分析 GPT-4.1（VectorEngine），漫画=Gemini（脚本/图片），提供多模型AB评测与路由；新增“智能问数助手（Text-to-SQL，独立Agent/模块）”
- 特色输出：结构化JSON分析、趋势解读（90天缓存）、估值评估、行业对比、PDF/漫画（8格信息图）、问数结果“表格+AI解读”（支持CSV导出）
- 关键API：/api/analyze/*、/api/stock/*、/api/reports/*、/api/analyze/industry-comparison、/api/analyze/trend-interpretation、/api/assistant/chat、/api/assistant/query
- 商业化假设：单次完整分析成本约¥0.3~0.5；订阅制¥299~999/年（详见产品文档）

—

## 1. 项目概述（Why & What）
- 目标用户：25-45岁、资产10万-500万的个人投资者；每周1-3小时研究
- 核心痛点：财报难懂、难横纵对比、时间不够；传统阅读年报3-5小时
- 价值主张：5分钟生成结构化分析+漫画+行业同业对比；效率提速36-60倍

—

## 2. 架构总览（Architecture at a glance）
- 前端：原生JS + Tailwind + Chart.js（轻交互）
- 后端：Hono（TypeScript/Cloudflare Workers）
- 存储：D1（结构化报告/漫画记录/评测）、KV（缓存/共享分析）
- 数据：Tushare（默认代理）、VectorEngine（统一AI API）
- 输出：HTML报告、PDF导出、8格漫画（KV临时存图7天）

—

## 3. 能力矩阵（Feature Matrix）
| 模块 | 现状 | 说明 |
|---|---|---|
| 多Agent编排 | 已实现 | 规划→三表并行→联动/风险/洞察→可选（商业/预测）→估值→结论 |
| 趋势解读 | 已实现 | 独立Agent，KV缓存90天；API: GET /api/analyze/trend-interpretation/:code |
| 行业对比 | 已实现 | 独立模块+API，7天缓存；详见“新增Industry模块” |
| 估值评估 | 已实现 | 基于 daily_basic + fina_indicator，常驻执行 |
| 智能问数助手（Text-to-SQL） | 已实现（Beta） | 自然语言→SQL 查询 D1；表格+AI 解读；支持 CSV 导出；API: /api/assistant/query |
| PDF/漫画 | 已实现 | PDF导出；漫画8格，KV存图7天，支持文本版 |
| 强制重分析 | 已实现 | 清缓存+重跑；POST /api/analyze/force-reanalyze |

—

## 4. 新增 Industry 对比模块（非主编排，事实对齐）
- 事实核对：主编排 orchestrator.ts 未包含 INDUSTRY_COMPARISON；行业对比通过独立API实现
- 数据口径：D1中行业同行集合 + Tushare 拉取对标财务数据 + 计算行业均值/排名 + AI深度解读
- 缓存策略：KV 7天（key: industry_comparison_analysis:${code}）
- 相关API：
  - GET /api/stock/industry-peers/:code（取同业TOP5）
  - POST /api/stock/sync-industry-peers/:code（批量同步同业财务数据入D1）
  - GET /api/stock/industry-comparison/:code（计算对比、均值、排名）
  - GET /api/analyze/industry-comparison/:code（调用AI做结构化结论，7天缓存，可refresh）
- 前端形态：独立卡片/面板展示（非10项主进度卡）

—

## 5. 数据与缓存（Data & Caching）
- 数据源（默认代理）：https://tspro.matetrip.cn/dataapi（token=788627836620509184）
- 关键接口：income/balancesheet/cashflow/forecast/express/fina_indicator/mainbiz/daily_basic
- 缓存TTL（KV）：
  - 报表类：FINANCIAL=24h（income/balance/cashflow）
  - 基本信息：STOCK_BASIC=7d；COMPANY=3d；INDUSTRY=7d
  - 日线：历史=30d，当日=5m
  - 高级：FORECAST=12h，EXPRESS=12h，FINA_INDICATOR=24h，MAIN_BIZ=24h
  - 分析共享：shared:analysis:*=24h；pending:analysis:*=10m
  - 趋势解读：trend_interpretation:*=90d
  - 行业对比分析：industry_comparison_analysis:*=7d

—

## 6. 模型与成本（Models & Cost）
- 主分析：GPT-4.1（VectorEngine，低温 0.3，maxTokens 16384）
- 漫画：
  - 脚本：Gemini-2.5-flash（或 gemini-3-pro-preview）
  - 图片：Gemini-3-pro-image-preview（批量/重试）
- 多模型评测与路由：支持 Gemini-2.5-Pro、GPT-4.1、GPT-5 Nano；保存评测指标到 D1
- 成本估算：单次完整分析约¥0.3~0.5（随模型路由与长度浮动）

—

## 7. Multi-Agent 编排（DAG，含趋势解读与估值）
- Phase 0：Planning（规划）
- Phase 1（并行）：Profitability / BalanceSheet / CashFlow
- Trend：TrendInterpretation（独立缓存90天）
- Phase 2：EarningsQuality；并行 Risk + BusinessInsight
- Phase 3（可选）：BusinessModel / Forecast；常驻 Valuation（估值）
- Final：FinalConclusion（汇总）
- 真实对齐：industry-comparison 不在主编排内，以独立API实现

—

## 8. API一览（按使用频度，PPT可截屏）
- 分析：
  - POST /api/analyze/start | GET /api/analyze/result/:id | GET /api/analyze/stream/:id
  - POST /api/analyze/force-reanalyze
  - GET /api/analyze/trend-interpretation/:code
  - GET /api/analyze/industry-comparison/:code
- 助手（Text-to-SQL/聊天）：
  - POST /api/assistant/query  |  POST /api/assistant/chat
- 股票/行业：
  - GET /api/stock/search | GET /api/stock/basic/:code | GET /api/stock/daily/:code
  - GET /api/stock/financial/:code/:type
  - GET /api/stock/industries | GET /api/stock/by-industry/:industry
  - GET /api/stock/industry-peers/:code | POST /api/stock/sync-industry-peers/:code
  - GET /api/stock/industry-comparison/:code
- 报告/漫画：
  - GET /api/reports/my | GET /api/reports/:id | DELETE /api/reports/:id
  - GET /api/reports/:id/pdf | POST /api/reports/:id/comic | GET /api/reports/:id/comic | POST /api/reports/:id/comic-text

—

## 9. 产出形式（Outputs）
- 结构化 JSON：summary、metrics、analysis、risks、highlights 等
- 趋势解读：8项核心指标（netProfit、revenue、operatingProfit、eps、grossMargin、netMargin、roe、debtRatio）
- 估值卡片：PE/PB/PS均值对比 + 市场情绪（量比/换手）+ 投资含义
- 行业对比：行业均值/排名 + AI 解释（支持缓存）
- 问数结果：SQL 表格 + AI 解读（引用关键数字与数据来源），支持 CSV 导出
- PDF导出：/api/reports/:id/pdf（可选附带漫画文本）
- 漫画：8格，面板图Base64存KV 7天（自动预生成）

—

## 10. 风险与合规（Risk & Compliance）
- 数据溯源：返回 dataSource 字段（provider=Tushare、报告期、公告日期、API URL）
- 文责边界：免责声明“仅供参考，不构成投资建议”；避免直接买卖指令
- 稳定性：KV/D1多级回退；趋势/行业结果缓存；Tushare代理+速率限制；Mock降级

—

## 11. 本次“对齐代码的修订点”（Truth Check）
- 行业对比：从“主流水线Agent”改为“独立API模块+缓存”
- 模型策略：主分析=GPT-4.1；漫画=Gemini；新增 ModelRouter AB评测
- 数据TTL：补全 forecast/express/fina_indicator/main_biz；趋势90天；行业7天
- 漫画API：走 /api/reports/:id/comic（非 /api/comic/*）
- R2：当前未启用（wrangler中注释），改为计划项

证据路径（代码）：
- 主编排：src/agents/orchestrator.ts（无 INDUSTRY_COMPARISON；含趋势解读与估值）
- 行业API：src/routes/api.ts（industry-peers/sync/industry-comparison/analyze/industry-comparison）
- Tushare：src/services/tushare.ts（TTL/Proxy/新接口）
- 漫画/报告：src/routes/reports.ts、src/services/comic.ts
- 模型路由：src/services/modelRouter.ts、src/services/vectorengine.ts

—

## 12. 路线图（Roadmap）
- 短期：
  - P0 生产部署核验；P1 错误边界/移动端优化；P1 行业面板可视图表；P1 问数助手可视化（自动折线/柱状）与问题收藏
- 中期：
  - 模型成本看板与自动路由调优；更多行业基准模板；多币种与港美股适配；问数助手RAG接入财报原文与公告
- 长期：
  - 生态化（API/小程序/插件）、用户自定义模板、投研协作

—

版本：v2.1（对齐代码真实性）  作者：Genspark AI Assistant
