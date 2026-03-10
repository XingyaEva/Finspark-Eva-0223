# Finspark / Genspark 财报分析系统 — 技术设计（PPT友好版 v2.1，对齐代码真实性）

最后更新：2026-01-06  面向读者：技术负责人 / 架构师 / 研发

—

## 0. 一页图（Architecture at a glance）
- 运行环境：Cloudflare Pages + Hono（Workers Runtime）
- 前端：原生 JS + Tailwind + Chart.js（轻交互）
- 后端：Hono 路由 + 多 Agent 编排（TypeScript）
- 存储：Cloudflare D1（结构化）+ KV（缓存/共享）；R2 暂未启用（wrangler 中注释）
- 数据：Tushare（默认走 5000 积分代理网关）
- AI：VectorEngine 统一封装，主分析 GPT-4.1；漫画脚本/图片 = Gemini 系列

ASCII 结构（精简）：
```
[Frontend (Tailwind/Chart.js)]
        |  HTTP/SSE
        v
[Hono API]
  /api/analyze/*     /api/stock/*      /api/reports/* (PDF/Comic)
  /api/analyze/industry-comparison/:code
  /api/analyze/trend-interpretation/:code
        |
        v
[Services]
  VectorEngine  Tushare  StockDB  Reports  Comic  DataSync  ModelRouter
        |
        v
[Storage]
  D1 (analysis_reports, comic_reports, model_evaluations)
  KV (shared/pending 分析、趋势/行业缓存、漫画图片Base64 临时存储)
```

—

## 1. 关键“对齐代码”的修正点（Truth Checks）
- 行业对比不在主编排（orchestrator.ts 无 INDUSTRY_COMPARISON）；以独立 API 模块实现（7 天缓存）
- 漫画接口不是 /api/comic/*，而是 /api/reports/:id/comic 和 /api/reports/:id/comic-text
- 主分析模型为 GPT-4.1（VectorEngine 封装）；漫画脚本/图片使用 Gemini（2.5-flash / 3-pro-image-preview）
- R2 未启用（仅规划），当前漫画图片通过 KV 暂存（7 天）
- 趋势解读为独立 Agent，季度级缓存（90 天），缓存键 trend_interpretation:{code}:{latestPeriod}

证据（代码路径）：
- 主编排：src/agents/orchestrator.ts（含 Trend + Valuation，确无 IndustryComparison）
- 行业 API：src/routes/api.ts（industry-peers/sync/industry-comparison/analyze/industry-comparison）
- 漫画 & PDF：src/routes/reports.ts、src/services/pdf.ts、src/services/comic.ts
- 模型封装/路由：src/services/vectorengine.ts、src/services/modelRouter.ts
- Tushare 封装：src/services/tushare.ts（TTL/代理/令牌桶）

—

## 2. 多 Agent 编排（DAG Hybrid）
执行序（与 orchestrator.ts 一致）：
- Phase 0：Planning（分析规划）
- Phase 1（并行）：Profitability / BalanceSheet / CashFlow
- Trend：TrendInterpretation（三表后执行，KV 缓存 90 天）
- Phase 2：EarningsQuality；并行 Risk + BusinessInsight
- Phase 3（可选）：BusinessModel（mainBiz）/ Forecast（forecast/express/fina）
- 常驻：Valuation（daily_basic + fina 指标）
- Final：FinalConclusion（汇总）

进度统计：基础 8 + 可选 BM + 可选 Forecast + Valuation + Final（约 12 最大）。
返回结果包含 dataSource（Tushare、报告期、公告日、API URL）。

—

## 3. 数据与缓存（Tushare Service）
- 默认代理：https://tspro.matetrip.cn/dataapi（token=788627836620509184）
- 官方：http://api.tushare.pro（useProxy=false 时）
- 频率限制：令牌桶 capacity=50，refillRate=0.8 tokens/s（代码内置重试/等待）
- 缓存 TTL（KV）：
  - STOCK_BASIC 7d，COMPANY 3d，INDUSTRY 7d
  - DAILY_HISTORY 30d，DAILY_TODAY 5m
  - FINANCIAL 24h（income/balance/cashflow）
  - FORECAST 12h，EXPRESS 12h，FINA_INDICATOR 24h，MAIN_BIZ 24h
  - 分析共享：shared:analysis:* 24h；pending:analysis:* 10m
  - 趋势解读：trend_interpretation:* 90d
  - 行业对比分析：industry_comparison_analysis:* 7d

—

## 4. API 面（与代码一致，PPT可直贴）
- 分析
  - POST /api/analyze/start
  - GET  /api/analyze/status/:id
  - GET  /api/analyze/result/:id
  - GET  /api/analyze/stream/:id
  - POST /api/analyze/force-reanalyze
  - GET  /api/analyze/trend-interpretation/:code
  - GET  /api/analyze/industry-comparison/:code
- 股票/行业
  - GET  /api/stock/search
  - GET  /api/stock/basic/:code
  - GET  /api/stock/daily/:code
  - GET  /api/stock/financial/:code/:type (income|balance|cashflow)
  - GET  /api/stock/industries
  - GET  /api/stock/by-industry/:industry
  - GET  /api/stock/industry-peers/:code
  - POST /api/stock/sync-industry-peers/:code
  - GET  /api/stock/industry-comparison/:code
- 报告/漫画/PDF
  - GET  /api/reports/my | GET /api/reports/recent | GET/DELETE /api/reports/:id
  - GET  /api/reports/:id/pdf?comic=true
  - POST /api/reports/:id/comic | GET /api/reports/:id/comic | POST /api/reports/:id/comic-text
- 助手（Text-to-SQL/聊天）
  - POST /api/assistant/query  |  POST /api/assistant/chat
- 认证（节选）
  - POST /api/auth/register | /login | /refresh | /logout | /logout-all
  - GET/PUT /api/auth/me

—

## 5. 持久化与结构（D1 + KV）
- D1 表（核心）
```sql
-- 分析报告（含漫画状态/ID）
CREATE TABLE analysis_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_period TEXT,
  status TEXT DEFAULT 'pending',
  result_json TEXT,
  comic_status TEXT,
  comic_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 漫画结果（KV 里存图片 Base64，仅在此存引用）
CREATE TABLE comic_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  user_id INTEGER,
  company_code TEXT,
  company_name TEXT,
  style TEXT,
  summary TEXT,
  panels_json TEXT,           -- 存 kv:xxx 引用 + 文本
  status TEXT,
  character_set_id TEXT,
  main_character_id TEXT,
  output_format TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 多模型评测（ModelRouter）
CREATE TABLE model_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER,
  agent_type TEXT,
  model_key TEXT,
  latency_ms INTEGER,
  token_input INTEGER,
  token_output INTEGER,
  cost_usd REAL,
  json_valid INTEGER,
  fields_complete_rate REAL,
  auto_score REAL,
  data_accuracy REAL,
  insight_count INTEGER,
  risk_identified INTEGER,
  recommendation_count INTEGER,
  key_metrics_count INTEGER,
  content_score REAL,
  accuracy_score REAL,
  raw_response TEXT,
  error_message TEXT,
  created_at TEXT
);
```
- KV 键位
  - report:progress:{id}（进度，1h）
  - report:result:{id}（结果，24h）
  - shared:analysis:{code}:{type}（共享分析指针，24h）
  - pending:analysis:{code}:{type}（进行中指针，10m）
  - trend_interpretation:{code}:{period}（90d）
  - industry_comparison_analysis:{code}（7d）
  - comic:{reportId}:panel:{i}（Base64 图，7d）

—

## 6. 模型与调用策略（VectorEngine + ModelRouter）
- VectorEngine（src/services/vectorengine.ts）
  - ANALYSIS=gpt-4.1（主分析，temperature=0.3，maxTokens=16384）
  - COMIC_SCRIPT=gemini-2.5-flash；IMAGE_GEN=gemini-3-pro-image-preview
  - 提供 analyzeFinancialReport / analyzeFinancialReportJson（强制 JSON）/ chatStream / generateImage
- ModelRouter（AB 并行评测）
  - 支持 gemini-2.5-pro、gpt-4.1、gpt-5-nano-2025-08-07
  - 采集 latency/tokens/cost + JSON 完整率/内容指标/准确率估计
  - 评分与推荐写入 model_evaluations（便于后续看板）

—

## 7. PDF 与漫画流水线
- PDF：/api/reports/:id/pdf → 生成完整可打印 HTML（包含估值/预测/业务/风险等章节）
  - 可选包含漫画（从 KV 还原 Base64，若过期会提示）
- 漫画：/api/reports/:id/comic（支持 8 格、IP 角色、长图滚动）
  - 图片按面板分批生成，失败返回占位图与可读错误
  - Base64 写入 KV（7 天），D1 仅保存 kv: 引用
  - /api/reports/:id/comic GET 自动检测图片过期与 IP 角色变更，提示需重新生成

—

## 7.5 智能问数助手（Text-to-SQL）
- 形态：独立于主编排的“问数模块/Agent”，对接 D1 中的结构化财务数据与本地分析结果摘要；不占用前台 10 个进度卡片。
- 能力：自然语言→只读 SQL；自动表头与类型推断；结果表格 + AI 解读（引用关键数字与来源），支持 CSV 导出。
- 上下文：自动携带股票代码/公司名/行业基准/报告期；多轮追问可复用上一轮结果（sessionId）。
- 安全网：
  - 仅允许 SELECT；强制 LIMIT（默认200，可通过 allowLarge=true 且鉴权后提升上限）。
  - 表名/列名白名单；时间/数字参数校验；参数化绑定；禁用分号与子查询黑名单关键词（DROP/UPDATE/DELETE/INSERT/ALTER）。
  - 超时/行数/并发限流（IP+用户）。
- 返回结构：
  - { columns: [name,type], rows: [...], rowCount, sql, dataSource: { tables, period, limit }, interpretation }
- 评估指标：SQL 生成成功率≥95%，只读校验通过率≥99%，完整答案≤8s（P90）。
- 前端入口：
  - 悬浮球“问数”侧边栏（分析页右下角），局部“问这个指标”快捷按钮，全屏 /assistant 页面。

—

## 8. 安全与合规
- 生产：密钥放 Cloudflare Pages Secret；前端不暴露 Token
- 数据溯源：结果携带 dataSource（Tushare、报告期、公告日期、API URL）
- 免责声明：不构成投资建议；输出引用需有数据支撑；趋势/行业输出有 TTL 与刷新参数

—

## 9. 监控与成本（落地建议）
- 成本：单次完整分析约 ¥0.3~0.5（随模型/长度浮动）
- 监控：
  - D1：model_evaluations 聚合 → 模型速度/成本/质量看板
  - KV：shared/pending 命中率、趋势/行业缓存命中率
  - Tushare：令牌桶等待统计、代理/官方回退告警

—

版本：v2.1（对齐代码真实性）  来源：/src/**  作者：Genspark AI Assistant
