# Agent Trace 可观测性系统 — 前后端开发方案与计划

> **文档版本**: v1.0  
> **创建日期**: 2026-04-03  
> **适用范围**: FinSpark 分析 Agent 编排器 (Orchestrator) 全链路追踪  
> **相关文件**: `src/agents/orchestrator.ts`, `src/services/vectorengine.ts`, `src/routes/api.ts`

---

## 目录

1. [项目背景与目标](#1-项目背景与目标)
2. [当前架构分析](#2-当前架构分析)
3. [数据模型设计](#3-数据模型设计)
4. [后端开发方案](#4-后端开发方案)
5. [前端 UI 设计方案](#5-前端-ui-设计方案)
6. [API 接口设计](#6-api-接口设计)
7. [开发计划与排期](#7-开发计划与排期)
8. [附录](#8-附录)

---

## 1. 项目背景与目标

### 1.1 问题陈述

当前 FinSpark 的 12-Agent 分析编排器 (`AnalysisOrchestrator`) 存在以下可观测性盲区：

| 盲区 | 影响 |
|------|------|
| 12 次 LLM 调用无 Prompt/Response 记录 | 出错后无法复现、无法对比调优 |
| 8 次并行数据 API 无延迟追踪 | 无法定位数据获取瓶颈 |
| Token 用量 & 成本无实时统计 | 无法做成本预警和预算控制 |
| JSON 解析成功率未记录 | 无法量化模型输出质量 |
| DAG 执行顺序无可视化 | 用户/开发者无法理解分析流程 |
| 用户配置快照未持久化 | 无法重现历史分析的配置上下文 |

### 1.2 目标

构建统一的 **Agent Trace** 可观测性系统，实现：

1. **全链路追踪**: 每次分析生成唯一 `trace_id`，关联所有 Span（Agent 调用、数据获取）
2. **LLM 调用透明化**: 记录完整 System Prompt、User Prompt、Raw Response、Token 用量、模型、延迟
3. **数据获取监控**: 记录每个 API 调用的 URL、耗时、返回数据量
4. **DAG 可视化**: 前端展示 Phase 分组 + Waterfall 时间线 + 并行/串行关系
5. **成本追踪**: 按 Trace / Agent / 模型 聚合成本统计
6. **异常定位**: 错误/降级/超时一目了然，支持快速定位

### 1.3 与 RAG Trace 的关系

| 维度 | 分析 Agent Trace | RAG Pipeline Trace |
|------|-----------------|-------------------|
| LLM 调用次数 | 12 次 | 2 次 (意图+生成) |
| 数据 API 调用 | 8 次并行 | 0 (本地向量检索) |
| 典型耗时 | 60-120s | 3-10s |
| Token 消耗 | ~200k | ~10k |
| 成本量级 | $1-2 / 次 | $0.01-0.05 / 次 |
| DAG 复杂度 | 4-Phase 混合编排 | 线性 Pipeline |

两者共享同一张 `agent_trace_spans` 表，通过 `trace_type` 字段区分。

---

## 2. 当前架构分析

### 2.1 Orchestrator DAG 执行流

```
用户请求 (POST /api/analyze/start)
  │
  ▼
┌─────────────────────────────────────────────┐
│  createOrchestrator(config)                  │
│  → VectorEngine, DataService, Cache, Prefs   │
└──────────────────┬──────────────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  fetchFinancialData()           │  ← 8 个并行 API 调用
  │  ┌─────────────────────────┐    │
  │  │ income     │ balance    │    │
  │  │ cashFlow   │ forecast   │    │
  │  │ express    │ finaIndicator│  │
  │  │ mainBiz    │ dailyBasic │    │
  │  └─────────────────────────┘    │
  └────────────────┬────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  PLANNING Agent (串行)           │  Phase 0
  └────────────────┬────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  Phase 1: 三表并行分析           │
  │  ┌──────────┬──────────┬──────┐ │
  │  │PROFIT-   │BALANCE_  │CASH_ │ │
  │  │ABILITY   │SHEET     │FLOW  │ │
  │  └──────────┴──────────┴──────┘ │
  └────────────────┬────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  TREND_INTERPRETATION (串行)     │  Phase 1.5
  │  (依赖三表结果, 有 KV 缓存)     │
  └────────────────┬────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  Phase 2: 深度分析               │
  │  EARNINGS_QUALITY (串行)         │
  │  ┌──────────┬──────────┐        │
  │  │  RISK    │BUSINESS_ │        │  ← 并行
  │  │          │INSIGHT   │        │
  │  └──────────┴──────────┘        │
  └────────────────┬────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  Phase 3: 扩展分析 (串行)        │
  │  BUSINESS_MODEL → FORECAST      │
  │  → VALUATION                    │
  └────────────────┬────────────────┘
                   │
  ┌────────────────▼────────────────┐
  │  FINAL_CONCLUSION (串行)         │  Phase 4
  └────────────────┬────────────────┘
                   │
                   ▼
            返回 AnalysisReport
```

### 2.2 Agent 清单 (12 个)

| # | Agent ID | 中文名 | Phase | 执行方式 | 依赖输入 |
|---|----------|--------|-------|----------|----------|
| 1 | `PLANNING` | 分析规划 | 0 | 串行 | FinancialData + Options |
| 2 | `PROFITABILITY` | 利润表分析 | 1 | **并行** | FinancialData (income + finaIndicator) |
| 3 | `BALANCE_SHEET` | 资产负债表分析 | 1 | **并行** | FinancialData (balance + finaIndicator) |
| 4 | `CASH_FLOW` | 现金流量表分析 | 1 | **并行** | FinancialData (cashFlow + finaIndicator) |
| 5 | `TREND_INTERPRETATION` | 趋势解读 | 1.5 | 串行 | FinancialData + 三表结果 + 行业信息 |
| 6 | `EARNINGS_QUALITY` | 三表联动分析 | 2 | 串行 | Profitability + BalanceSheet + CashFlow |
| 7 | `RISK` | 风险评估 | 2 | **并行** | BalanceSheet + CashFlow + EarningsQuality |
| 8 | `BUSINESS_INSIGHT` | 业务洞察 | 2 | **并行** | FinancialData + Profitability |
| 9 | `BUSINESS_MODEL` | 商业模式分析 | 3 | 串行 | BusinessInsight + mainBiz |
| 10 | `FORECAST` | 业绩预测 | 3 | 串行 | Profitability + BusinessInsight + forecast/express |
| 11 | `VALUATION` | 估值评估 | 3 | 串行 | FinancialData + Profitability + BalanceSheet |
| 12 | `FINAL_CONCLUSION` | 投资结论 | 4 | 串行 | 所有前置 Agent 结果汇总 |

### 2.3 LLM 调用路径

所有 12 个 Agent 均通过同一调用链：

```
orchestrator.run*Agent()
  → this.mergeSystemPrompt(AGENT_PROMPTS.XXX, 'XXX')    // 合并系统 Prompt
  → this.getModelForAgent('XXX')                         // 获取模型偏好
  → this.vectorEngine.analyzeFinancialReportJson(         // LLM 调用
      mergedSystemPrompt,
      userPrompt,
      { model, responseFormat }
    )
  → this.parseJsonResult(result, 'XXX')                  // JSON 解析
```

`analyzeFinancialReportJson` 内部调用 `chat()`，发送 `POST /v1/chat/completions` 到 VectorEngine API (`https://api.vectorengine.ai`)。

**关键问题**: `analyzeFinancialReportJson` 仅返回 `response.choices[0].message.content`，丢失了：
- `response.usage` (prompt_tokens, completion_tokens, total_tokens)
- `response.model` (实际使用的模型)
- 完整的 systemPrompt & userPrompt 文本
- 响应延迟

### 2.4 数据获取路径

`fetchFinancialData()` 内部 8 路并行：

```typescript
const [income, balance, cashFlow, forecast, express, finaIndicator, mainBiz, dailyBasic] 
  = await Promise.all([
    dataService.getIncomeStatement(code, period),
    dataService.getBalanceSheet(code, period),
    dataService.getCashFlow(code, period),
    dataService.getForecast(code),
    dataService.getExpress(code),
    dataService.getFinaIndicator(code, period),
    dataService.getMainBiz(code, period),
    dataService.getDailyBasic(code),
  ]);
```

数据源根据市场自动路由：
- **A 股**: Tushare API (`POST https://api.tushare.pro/`) → `src/services/tushare.ts`
- **港股**: AKShare Python Proxy (`GET ${pythonProxyUrl}/hk/...`) → `src/services/akshareHK.ts`

### 2.5 现有 model_evaluations 表

已有 `model_evaluations` 表 (migration `0006`)，记录字段包括：
- `report_id`, `agent_type`, `model_key`
- `latency_ms`, `token_input`, `token_output`, `cost_usd`
- `json_valid`, `fields_complete_rate`, `response_length`
- `raw_response`, `error_message`, `auto_score`

**局限性**: 
- 缺少 Prompt 记录（systemPrompt, userPrompt 均未存储）
- 缺少 trace_id 关联（无法将 12 个 Agent 关联到同一次分析）
- 缺少数据获取 Span
- 缺少 DAG Phase 信息
- 缺少用户配置快照

---

## 3. 数据模型设计

### 3.1 核心表: `agent_trace_spans`

```sql
-- Migration: 0018_agent_trace_spans.sql

CREATE TABLE IF NOT EXISTS agent_trace_spans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- ========== Trace 关联 ==========
  trace_id TEXT NOT NULL,                  -- 全局追踪ID (UUID v4)
  span_id TEXT NOT NULL,                   -- 当前 Span ID (UUID v4)
  parent_span_id TEXT,                     -- 父 Span ID (用于嵌套，如 Phase 内的 Agent)
  
  -- ========== 分类 ==========
  trace_type TEXT NOT NULL DEFAULT 'analysis',  -- 'analysis' | 'rag' | 'insight'
  span_type TEXT NOT NULL,                 -- 'root' | 'data_fetch' | 'llm_call' | 'phase' | 'cache_check'
  span_name TEXT NOT NULL,                 -- 'PLANNING' | 'PROFITABILITY' | 'fetch_income' 等
  
  -- ========== 业务上下文 ==========
  report_id INTEGER,                       -- 关联 analysis_reports.id
  session_id TEXT,                         -- 用户会话 ID
  user_id TEXT,                            -- 用户 ID
  company_code TEXT,                       -- 股票代码
  company_name TEXT,                       -- 公司名称
  phase TEXT,                              -- 'phase_0' | 'phase_1' | 'phase_1.5' | 'phase_2' | 'phase_3' | 'phase_4'
  
  -- ========== LLM 调用详情 ==========
  llm_model TEXT,                          -- 实际使用的模型 (如 'gpt-4.1')
  llm_provider TEXT,                       -- 'vectorengine'
  llm_model_preference TEXT,               -- 用户配置的偏好标签 (如 'standard', 'rigorous')
  llm_system_prompt TEXT,                  -- 完整 System Prompt
  llm_user_prompt TEXT,                    -- 完整 User Prompt
  llm_response_raw TEXT,                   -- LLM 原始响应文本
  llm_response_parsed INTEGER DEFAULT 1,   -- JSON 解析是否成功 (0/1)
  llm_token_input INTEGER DEFAULT 0,       -- 输入 Token 数
  llm_token_output INTEGER DEFAULT 0,      -- 输出 Token 数
  llm_token_total INTEGER DEFAULT 0,       -- 总 Token 数
  llm_cost_usd REAL DEFAULT 0,            -- 本次调用成本 (USD)
  llm_temperature REAL,                    -- 温度参数
  llm_max_tokens INTEGER,                  -- 最大 Token 设置
  llm_response_format TEXT,                -- 'json_object' | 'json_schema' | 'text'
  
  -- ========== 数据获取详情 ==========
  api_url TEXT,                            -- API 请求 URL
  api_method TEXT,                         -- 'GET' | 'POST'
  api_provider TEXT,                       -- 'tushare' | 'akshare'
  api_response_size INTEGER,               -- 响应体大小 (bytes)
  api_record_count INTEGER,                -- 返回记录数
  
  -- ========== 缓存信息 ==========
  cache_hit INTEGER DEFAULT 0,             -- 是否命中缓存 (0/1)
  cache_key TEXT,                          -- 缓存 Key
  
  -- ========== 时间与状态 ==========
  started_at TEXT NOT NULL,                -- ISO 时间戳 (毫秒精度)
  ended_at TEXT,                           -- ISO 时间戳
  duration_ms INTEGER DEFAULT 0,           -- 耗时 (毫秒)
  status TEXT DEFAULT 'running',           -- 'running' | 'success' | 'error' | 'timeout' | 'degraded'
  error_message TEXT,                      -- 错误信息
  error_stack TEXT,                        -- 错误堆栈 (开发环境)
  
  -- ========== 配置快照 ==========
  config_snapshot TEXT,                    -- JSON: 当次分析的完整配置快照
  
  -- ========== 元数据 ==========
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace ON agent_trace_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_report ON agent_trace_spans(report_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_type ON agent_trace_spans(trace_type, span_type);
CREATE INDEX IF NOT EXISTS idx_trace_spans_company ON agent_trace_spans(company_code);
CREATE INDEX IF NOT EXISTS idx_trace_spans_user ON agent_trace_spans(user_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_time ON agent_trace_spans(created_at);
CREATE INDEX IF NOT EXISTS idx_trace_spans_status ON agent_trace_spans(status);
```

### 3.2 汇总视图表: `agent_trace_summaries`

```sql
-- 每次完整 Trace 的汇总 (在 flush 时写入)
CREATE TABLE IF NOT EXISTS agent_trace_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id TEXT NOT NULL UNIQUE,
  trace_type TEXT NOT NULL DEFAULT 'analysis',
  
  -- 业务信息
  report_id INTEGER,
  user_id TEXT,
  company_code TEXT,
  company_name TEXT,
  
  -- 汇总指标
  total_spans INTEGER DEFAULT 0,           -- Span 总数
  llm_call_count INTEGER DEFAULT 0,        -- LLM 调用次数
  data_fetch_count INTEGER DEFAULT 0,      -- 数据获取次数
  total_duration_ms INTEGER DEFAULT 0,     -- 总耗时
  total_token_input INTEGER DEFAULT 0,     -- 总输入 Token
  total_token_output INTEGER DEFAULT 0,    -- 总输出 Token
  total_cost_usd REAL DEFAULT 0,           -- 总成本
  
  -- 质量指标
  success_count INTEGER DEFAULT 0,         -- 成功 Span 数
  error_count INTEGER DEFAULT 0,           -- 失败 Span 数
  json_parse_success_rate REAL DEFAULT 0,  -- JSON 解析成功率 (0-1)
  cache_hit_count INTEGER DEFAULT 0,       -- 缓存命中次数
  
  -- 状态
  status TEXT DEFAULT 'running',           -- 'running' | 'completed' | 'partial' | 'failed'
  started_at TEXT NOT NULL,
  ended_at TEXT,
  
  -- 配置快照
  config_snapshot TEXT,                    -- JSON: 模型配置 + 用户偏好
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trace_summaries_report ON agent_trace_summaries(report_id);
CREATE INDEX IF NOT EXISTS idx_trace_summaries_user ON agent_trace_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_trace_summaries_time ON agent_trace_summaries(created_at);
```

### 3.3 字段大小估算

| 字段 | 单个 Agent 估算 | 12 Agent 总计 |
|------|----------------|--------------|
| `llm_system_prompt` | 2-5 KB | 24-60 KB |
| `llm_user_prompt` | 5-30 KB | 60-360 KB |
| `llm_response_raw` | 3-15 KB | 36-180 KB |
| `config_snapshot` | 1 KB (仅 root span) | 1 KB |
| **单次 Trace 总存储** | | **~120-600 KB** |

> D1 SQLite 单行最大 1MB，`llm_response_raw` 最大约 15KB，无需担心溢出。

---

## 4. 后端开发方案

### 4.1 核心类: `AgentTraceContext`

**文件**: `src/services/agentTrace.ts`

```typescript
// ==================== 接口定义 ====================

export interface TraceConfig {
  traceType: 'analysis' | 'rag' | 'insight';
  reportId?: number;
  userId?: string;
  sessionId?: string;
  companyCode?: string;
  companyName?: string;
  configSnapshot?: Record<string, unknown>;
}

export interface SpanOptions {
  spanType: 'root' | 'data_fetch' | 'llm_call' | 'phase' | 'cache_check';
  spanName: string;
  parentSpanId?: string;
  phase?: string;
}

export interface LlmCallRecord {
  model: string;
  provider?: string;
  modelPreference?: string;
  systemPrompt: string;
  userPrompt: string;
  responseRaw: string;
  responseParsed: boolean;
  tokenInput: number;
  tokenOutput: number;
  tokenTotal: number;
  costUsd: number;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
}

export interface DataFetchRecord {
  apiUrl: string;
  apiMethod: string;
  apiProvider: string;
  responseSize: number;
  recordCount: number;
}

export interface SpanData {
  spanId: string;
  parentSpanId?: string;
  spanType: string;
  spanName: string;
  phase?: string;
  startedAt: string;
  endedAt?: string;
  durationMs: number;
  status: 'running' | 'success' | 'error' | 'timeout' | 'degraded';
  errorMessage?: string;
  llm?: LlmCallRecord;
  dataFetch?: DataFetchRecord;
  cacheHit?: boolean;
  cacheKey?: string;
}

// ==================== 核心实现 ====================

export class AgentTraceContext {
  readonly traceId: string;
  private config: TraceConfig;
  private spans: Map<string, SpanData> = new Map();
  private rootSpanId: string;
  
  constructor(config: TraceConfig) {
    this.traceId = crypto.randomUUID();
    this.config = config;
    
    // 自动创建 root span
    this.rootSpanId = this.startSpan({
      spanType: 'root',
      spanName: `${config.traceType}_root`,
    });
  }
  
  /**
   * 开始一个新 Span
   * @returns spanId
   */
  startSpan(options: SpanOptions): string {
    const spanId = crypto.randomUUID();
    this.spans.set(spanId, {
      spanId,
      parentSpanId: options.parentSpanId,
      spanType: options.spanType,
      spanName: options.spanName,
      phase: options.phase,
      startedAt: new Date().toISOString(),
      durationMs: 0,
      status: 'running',
    });
    return spanId;
  }
  
  /**
   * 记录 LLM 调用结果
   */
  recordLlmCall(spanId: string, record: LlmCallRecord): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.llm = record;
    }
  }
  
  /**
   * 记录数据获取结果
   */
  recordDataFetch(spanId: string, record: DataFetchRecord): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.dataFetch = record;
    }
  }
  
  /**
   * 记录缓存命中
   */
  recordCacheHit(spanId: string, cacheKey: string, hit: boolean): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.cacheHit = hit;
      span.cacheKey = cacheKey;
    }
  }
  
  /**
   * 结束一个 Span
   */
  endSpan(spanId: string, status: SpanData['status'] = 'success', error?: string): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endedAt = new Date().toISOString();
      span.durationMs = new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime();
      span.status = status;
      if (error) span.errorMessage = error;
    }
  }
  
  /**
   * 结束 root span
   */
  endTrace(status?: SpanData['status']): void {
    this.endSpan(this.rootSpanId, status || 'success');
  }
  
  /**
   * 获取 root span ID
   */
  getRootSpanId(): string {
    return this.rootSpanId;
  }
  
  /**
   * 将所有 Span 写入 D1 数据库
   * 应在 ctx.waitUntil() 中调用，不阻塞主请求
   */
  async flush(db: D1Database): Promise<void> {
    // 1. 批量插入所有 spans
    const insertStmt = db.prepare(`
      INSERT INTO agent_trace_spans (
        trace_id, span_id, parent_span_id,
        trace_type, span_type, span_name,
        report_id, session_id, user_id,
        company_code, company_name, phase,
        llm_model, llm_provider, llm_model_preference,
        llm_system_prompt, llm_user_prompt,
        llm_response_raw, llm_response_parsed,
        llm_token_input, llm_token_output, llm_token_total,
        llm_cost_usd, llm_temperature, llm_max_tokens, llm_response_format,
        api_url, api_method, api_provider,
        api_response_size, api_record_count,
        cache_hit, cache_key,
        started_at, ended_at, duration_ms,
        status, error_message,
        config_snapshot
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?
      )
    `);
    
    const batchOps = [];
    for (const span of this.spans.values()) {
      batchOps.push(
        insertStmt.bind(
          this.traceId, span.spanId, span.parentSpanId || null,
          this.config.traceType, span.spanType, span.spanName,
          this.config.reportId || null, this.config.sessionId || null, this.config.userId || null,
          this.config.companyCode || null, this.config.companyName || null, span.phase || null,
          span.llm?.model || null, span.llm?.provider || 'vectorengine', span.llm?.modelPreference || null,
          span.llm?.systemPrompt || null, span.llm?.userPrompt || null,
          span.llm?.responseRaw || null, span.llm?.responseParsed ? 1 : 0,
          span.llm?.tokenInput || 0, span.llm?.tokenOutput || 0, span.llm?.tokenTotal || 0,
          span.llm?.costUsd || 0, span.llm?.temperature || null, span.llm?.maxTokens || null, span.llm?.responseFormat || null,
          span.dataFetch?.apiUrl || null, span.dataFetch?.apiMethod || null, span.dataFetch?.apiProvider || null,
          span.dataFetch?.responseSize || null, span.dataFetch?.recordCount || null,
          span.cacheHit ? 1 : 0, span.cacheKey || null,
          span.startedAt, span.endedAt || null, span.durationMs,
          span.status, span.errorMessage || null,
          span.spanType === 'root' ? JSON.stringify(this.config.configSnapshot || {}) : null
        )
      );
    }
    
    // 2. 写入汇总表
    const summary = this.buildSummary();
    batchOps.push(
      db.prepare(`
        INSERT INTO agent_trace_summaries (
          trace_id, trace_type,
          report_id, user_id, company_code, company_name,
          total_spans, llm_call_count, data_fetch_count,
          total_duration_ms, total_token_input, total_token_output, total_cost_usd,
          success_count, error_count, json_parse_success_rate, cache_hit_count,
          status, started_at, ended_at,
          config_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        this.traceId, this.config.traceType,
        this.config.reportId || null, this.config.userId || null,
        this.config.companyCode || null, this.config.companyName || null,
        summary.totalSpans, summary.llmCallCount, summary.dataFetchCount,
        summary.totalDurationMs, summary.totalTokenInput, summary.totalTokenOutput, summary.totalCostUsd,
        summary.successCount, summary.errorCount, summary.jsonParseSuccessRate, summary.cacheHitCount,
        summary.status, summary.startedAt, summary.endedAt,
        JSON.stringify(this.config.configSnapshot || {})
      )
    );
    
    // 3. 批量执行
    await db.batch(batchOps);
  }
  
  /**
   * 构建汇总数据
   */
  private buildSummary() {
    let llmCallCount = 0, dataFetchCount = 0;
    let totalTokenInput = 0, totalTokenOutput = 0, totalCostUsd = 0;
    let successCount = 0, errorCount = 0, cacheHitCount = 0;
    let jsonParseSuccessCount = 0, jsonParseTotal = 0;
    let startedAt = '', endedAt = '';
    
    for (const span of this.spans.values()) {
      if (span.spanType === 'llm_call') {
        llmCallCount++;
        totalTokenInput += span.llm?.tokenInput || 0;
        totalTokenOutput += span.llm?.tokenOutput || 0;
        totalCostUsd += span.llm?.costUsd || 0;
        jsonParseTotal++;
        if (span.llm?.responseParsed) jsonParseSuccessCount++;
      }
      if (span.spanType === 'data_fetch') dataFetchCount++;
      if (span.status === 'success') successCount++;
      if (span.status === 'error') errorCount++;
      if (span.cacheHit) cacheHitCount++;
      
      if (!startedAt || span.startedAt < startedAt) startedAt = span.startedAt;
      if (span.endedAt && (!endedAt || span.endedAt > endedAt)) endedAt = span.endedAt;
    }
    
    const rootSpan = this.spans.get(this.rootSpanId);
    
    return {
      totalSpans: this.spans.size,
      llmCallCount,
      dataFetchCount,
      totalDurationMs: rootSpan?.durationMs || 0,
      totalTokenInput,
      totalTokenOutput,
      totalCostUsd,
      successCount,
      errorCount,
      jsonParseSuccessRate: jsonParseTotal > 0 ? jsonParseSuccessCount / jsonParseTotal : 1,
      cacheHitCount,
      status: errorCount > 0 ? (successCount > 0 ? 'partial' : 'failed') : 'completed',
      startedAt,
      endedAt,
    };
  }
}
```

### 4.2 VectorEngine 增强: `analyzeFinancialReportJsonTraced`

**文件修改**: `src/services/vectorengine.ts`

新增方法，在不改变原有 `analyzeFinancialReportJson` 签名的前提下，返回完整追踪数据：

```typescript
export interface TracedLlmResult {
  content: string;                    // 原始返回的 content (与旧方法一致)
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;                      // 实际使用的模型
  systemPrompt: string;               // 完整 System Prompt
  userPrompt: string;                 // 完整 User Prompt
  latencyMs: number;                  // 请求耗时
  responseFormat?: string;            // 使用的 response_format 类型
}

/**
 * 带追踪信息的 JSON 分析调用
 * 返回完整的 Prompt / Response / Usage 信息，供 AgentTraceContext 使用
 */
async analyzeFinancialReportJsonTraced(
  systemPrompt: string,
  userPrompt: string,
  options: ChatOptions = {}
): Promise<TracedLlmResult> {
  const startTime = Date.now();
  
  // 复用现有 prompt 处理逻辑 (与 analyzeFinancialReportJson 一致)
  const useStructuredOutput = !!options.responseFormat;
  let finalSystemPrompt = systemPrompt;
  let finalUserPrompt = userPrompt;
  
  if (!useStructuredOutput) {
    finalSystemPrompt = `${systemPrompt}\n\n【输出格式强制要求】...`;  // 同现有逻辑
    finalUserPrompt = userPrompt + '\n\n请直接输出JSON，不要任何其他内容：';
  }
  
  const messages: Message[] = [
    { role: 'system', content: finalSystemPrompt },
    { role: 'user', content: finalUserPrompt },
  ];
  
  const model = options.model || MODELS.ANALYSIS;
  
  const response = await this.chat(messages, {
    temperature: 0.2,
    maxTokens: 16384,
    ...options,
    model,
  });
  
  const latencyMs = Date.now() - startTime;
  
  return {
    content: response.choices[0]?.message?.content || '',
    usage: {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
    model: response.model || model,
    systemPrompt: finalSystemPrompt,
    userPrompt: finalUserPrompt,
    latencyMs,
    responseFormat: options.responseFormat?.type,
  };
}
```

### 4.3 Orchestrator 埋点方案

**修改**: `src/agents/orchestrator.ts`

#### 4.3.1 构造函数变更

```typescript
export interface OrchestratorConfig {
  // ... 现有字段 ...
  db?: D1Database;         // 新增：用于 Trace 写入
  traceEnabled?: boolean;  // 新增：是否启用追踪 (默认 true)
}

export class AnalysisOrchestrator {
  // ... 现有字段 ...
  private trace?: AgentTraceContext;  // 新增
  private db?: D1Database;           // 新增
  private traceEnabled: boolean;     // 新增
  
  constructor(config: OrchestratorConfig) {
    // ... 现有逻辑 ...
    this.db = config.db;
    this.traceEnabled = config.traceEnabled !== false;  // 默认启用
  }
}
```

#### 4.3.2 analyze() 方法埋点 (伪代码)

```typescript
async analyze(options: AnalysisOptions): Promise<Partial<AnalysisReport>> {
  const startTime = Date.now();
  this.completedAgents = [];
  this.totalAgents = 12;
  
  // ===== TRACE: 初始化 =====
  if (this.traceEnabled) {
    this.trace = new AgentTraceContext({
      traceType: 'analysis',
      reportId: undefined,  // 后续设置
      userId: undefined,    // 从上层传入
      companyCode: options.companyCode,
      companyName: options.companyName,
      configSnapshot: {
        agentModelConfig: this.agentModelConfig,
        agentPromptConfig: Object.keys(this.agentPromptConfig),  // 仅记录 key，不记录完整 prompt
        userPreferences: this.userPreferences,
        reportType: options.reportType,
        reportPeriod: options.reportPeriod,
      },
    });
  }

  // 1. 获取财务数据
  this.reportProgress('数据获取');
  const financialData = await this.fetchFinancialDataTraced(options.companyCode, options.reportPeriod);
  
  // 2. Planning Agent
  this.reportProgress('分析规划');
  const planningResult = await this.runAgentTraced('PLANNING', 'phase_0', 
    () => this.runPlanningAgent(financialData, options));
  this.markCompleted('PLANNING');

  // 3. Phase 1: 并行三表
  this.reportProgress('三表并行分析');
  const [profitabilityResult, balanceSheetResult, cashFlowResult] = await Promise.all([
    this.runAgentTraced('PROFITABILITY', 'phase_1',
      () => this.runProfitabilityAgent(financialData)),
    this.runAgentTraced('BALANCE_SHEET', 'phase_1',
      () => this.runBalanceSheetAgent(financialData)),
    this.runAgentTraced('CASH_FLOW', 'phase_1',
      () => this.runCashFlowAgent(financialData)),
  ]);
  // ... markCompleted ...

  // ... 后续 Phase 同理 ...

  // ===== TRACE: 完成 =====
  if (this.trace) {
    this.trace.endTrace('success');
    // 异步写入，不阻塞响应
    // 在 api.ts 中通过 ctx.waitUntil(trace.flush(db)) 调用
  }

  return { /* ... */ };
}
```

#### 4.3.3 Agent 包装器: `runAgentTraced`

```typescript
/**
 * 通用 Agent 追踪包装器
 * 包裹每个 run*Agent 方法，自动记录 Span
 */
private async runAgentTraced<T>(
  agentName: string,
  phase: string,
  agentFn: () => Promise<T>
): Promise<T> {
  if (!this.trace) {
    return agentFn();
  }
  
  const spanId = this.trace.startSpan({
    spanType: 'llm_call',
    spanName: agentName,
    parentSpanId: this.trace.getRootSpanId(),
    phase,
  });
  
  try {
    const result = await agentFn();
    this.trace.endSpan(spanId, 'success');
    return result;
  } catch (error) {
    this.trace.endSpan(spanId, 'error', String(error));
    throw error;
  }
}
```

#### 4.3.4 各 Agent 内部增加 LLM 记录

每个 `run*Agent` 方法中，将 `analyzeFinancialReportJson` 替换为 `analyzeFinancialReportJsonTraced`，并记录结果：

```typescript
// 示例: runProfitabilityAgent 中的变更

// BEFORE:
const result = await this.vectorEngine.analyzeFinancialReportJson(
  mergedSystemPrompt, prompt, { model: profitModel, responseFormat: ... }
);

// AFTER:
const traced = await this.vectorEngine.analyzeFinancialReportJsonTraced(
  mergedSystemPrompt, prompt, { model: profitModel, responseFormat: ... }
);
const result = traced.content;

// 记录 LLM 调用详情
if (this.trace && currentSpanId) {
  this.trace.recordLlmCall(currentSpanId, {
    model: traced.model,
    provider: 'vectorengine',
    modelPreference: String(this.agentModelConfig.PROFITABILITY || 'standard'),
    systemPrompt: traced.systemPrompt,
    userPrompt: traced.userPrompt,
    responseRaw: traced.content,
    responseParsed: true,  // 后续 parseJsonResult 会更新
    tokenInput: traced.usage.promptTokens,
    tokenOutput: traced.usage.completionTokens,
    tokenTotal: traced.usage.totalTokens,
    costUsd: this.calculateCost(traced.model, traced.usage),
    temperature: 0.2,
    maxTokens: 16384,
    responseFormat: traced.responseFormat,
  });
}
```

#### 4.3.5 数据获取追踪

```typescript
private async fetchFinancialDataTraced(tsCode: string, period?: string): Promise<FinancialData> {
  const dataService = this.getDataService();
  const { code, market } = normalizeStockCode(tsCode);
  
  const dataApis = [
    { name: 'income', fn: () => dataService.getIncomeStatement(code, period) },
    { name: 'balance', fn: () => dataService.getBalanceSheet(code, period) },
    { name: 'cashFlow', fn: () => dataService.getCashFlow(code, period) },
    { name: 'forecast', fn: () => dataService.getForecast(code) },
    { name: 'express', fn: () => dataService.getExpress(code) },
    { name: 'finaIndicator', fn: () => dataService.getFinaIndicator(code, period) },
    { name: 'mainBiz', fn: () => dataService.getMainBiz(code, period) },
    { name: 'dailyBasic', fn: () => dataService.getDailyBasic(code) },
  ];
  
  const results = await Promise.all(
    dataApis.map(async (api) => {
      const spanId = this.trace?.startSpan({
        spanType: 'data_fetch',
        spanName: `fetch_${api.name}`,
        parentSpanId: this.trace.getRootSpanId(),
        phase: 'data_fetch',
      });
      
      try {
        const data = await api.fn();
        const recordCount = Array.isArray(data) ? data.length : 0;
        
        if (this.trace && spanId) {
          this.trace.recordDataFetch(spanId, {
            apiUrl: market === 'HK' ? `akshare/hk/${api.name}/${code}` : `tushare/${api.name}`,
            apiMethod: market === 'HK' ? 'GET' : 'POST',
            apiProvider: market === 'HK' ? 'akshare' : 'tushare',
            responseSize: JSON.stringify(data).length,
            recordCount,
          });
          this.trace.endSpan(spanId, 'success');
        }
        
        return data;
      } catch (error) {
        if (this.trace && spanId) {
          this.trace.endSpan(spanId, 'error', String(error));
        }
        return [];  // 降级返回空数组
      }
    })
  );
  
  const [income, balance, cashFlow, forecast, express, finaIndicator, mainBiz, dailyBasic] = results;
  return { income, balance, cashFlow, forecast, express, finaIndicator, mainBiz, dailyBasic } as FinancialData;
}
```

### 4.4 API 路由层集成

**修改**: `src/routes/api.ts` (在 `/analyze/start` handler 中)

```typescript
api.post('/analyze/start', optionalAuthMiddleware(), async (c) => {
  // ... 现有缓存检查逻辑 ...
  
  const orchestrator = createOrchestrator({
    vectorEngine,
    dataService: stockDataService,
    cache: c.env.CACHE,
    db: c.env.DB,              // 新增: 传入 D1
    traceEnabled: true,         // 新增: 启用追踪
    agentModelConfig: resolvedModelConfig,
    agentPromptConfig: resolvedPromptConfig,
    userPreferences: { /* ... */ },
    onProgress: async (progress) => { /* ... */ },
  });
  
  // 分析执行
  const result = await orchestrator.analyze({ /* ... */ });
  
  // 异步写入 Trace 数据 (不阻塞响应)
  const trace = orchestrator.getTrace();
  if (trace && c.env.DB) {
    trace.setReportId(reportId);  // 分析完成后设置 reportId
    c.executionCtx.waitUntil(
      trace.flush(c.env.DB).catch(err => 
        console.error('[Trace] flush failed:', err)
      )
    );
  }
  
  // ... 现有保存逻辑 ...
});
```

### 4.5 成本计算

```typescript
// src/services/agentTrace.ts 中的辅助方法

const MODEL_COST_MAP: Record<string, { input: number; output: number }> = {
  'gpt-4.1':              { input: 0.002,   output: 0.008 },
  'gpt-4.1-mini':         { input: 0.0004,  output: 0.0016 },
  'gpt-5-nano':           { input: 0.00015, output: 0.0006 },
  'gemini-2.5-pro':       { input: 0.00125, output: 0.005 },
  'gemini-2.5-flash':     { input: 0.00015, output: 0.0006 },
  'deepseek-reasoner':    { input: 0.0005,  output: 0.002 },
  'deepseek-chat':        { input: 0.0002,  output: 0.0008 },
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
};

export function calculateLlmCost(model: string, usage: { promptTokens: number; completionTokens: number }): number {
  const costs = MODEL_COST_MAP[model] || { input: 0.002, output: 0.008 };
  return (usage.promptTokens / 1000 * costs.input) + (usage.completionTokens / 1000 * costs.output);
}
```

---

## 5. 前端 UI 设计方案

### 5.1 总体架构

新增两个页面，纳入 RAG 平台侧边栏的「日志」分类下：

| 页面 | 路由 | 函数名 | 功能 |
|------|------|--------|------|
| Trace 列表 | `/rag/logs/trace` | `generateTraceList()` | 总览所有分析 Trace |
| Trace 详情 | `/rag/logs/trace-detail` | `generateTraceDetail()` | 单次 Trace 全链路视图 |

### 5.2 设计风格

沿用 RAG 平台暗色主题：

```
背景: #1e293b (深蓝灰)
卡片: rgba(255,255,255,0.05) + backdrop-filter: blur(10px)
文字: #e2e8f0 (主文字), #94a3b8 (次要文字)
强调: #d4af37 (金色), #3b82f6 (蓝色)
成功: #22c55e (绿色)
警告: #f59e0b (琥珀色)
错误: #ef4444 (红色)
```

组件复用现有 `rc-` 前缀体系 (`rc-card`, `rc-kpi-card`, `rc-table`, `rc-btn`)。

### 5.3 页面一: Trace 列表 (`/rag/logs/trace`)

#### 5.3.1 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  [侧边栏]  │  页面内容区                                     │
│             │  ┌─────────────────────────────────────────────┐│
│  RAG 平台   │  │  页面标题: Agent Trace 追踪                 ││
│  ──────────│  │  副标题: 分析编排器全链路可观测性              ││
│  数据管理   │  └─────────────────────────────────────────────┘│
│  知识库     │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐              │
│  ...        │  │KPI│ │KPI│ │KPI│ │KPI│ │KPI│ ← KPI 卡片行  │
│  ──────────│  └───┘ └───┘ └───┘ └───┘ └───┘              │
│  日志       │  ┌─────────────────────────────────────────────┐│
│  > 对话日志 │  │  筛选器: [类型▼] [搜索] [时间范围] [状态▼]  ││
│  > 意图日志 │  └─────────────────────────────────────────────┘│
│  > Pipeline │  ┌─────────────────────────────────────────────┐│
│  > Trace ★  │  │  Trace #1 ──────── waterfall ─── 时间/成本 ││
│  ──────────│  │  Trace #2 ──────── waterfall ─── 时间/成本 ││
│  ...        │  │  Trace #3 ──────── waterfall ─── 时间/成本 ││
│             │  │  ...                                        ││
│             │  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.2 KPI 卡片 (5 张)

| # | 指标 | 图标 | 颜色 | 数据来源 |
|---|------|------|------|----------|
| 1 | 最近 24h 执行数 | `fa-chart-line` | 蓝色 | `COUNT(*) WHERE created_at > -24h` |
| 2 | 成功率 | `fa-check-circle` | 绿色 | `success_count / total_spans` |
| 3 | 总 Token 消耗 | `fa-coins` | 金色 | `SUM(total_token_input + total_token_output)` |
| 4 | 平均耗时 | `fa-clock` | 紫色 | `AVG(total_duration_ms)` |
| 5 | 平均成本 | `fa-dollar-sign` | 琥珀色 | `AVG(total_cost_usd)` |

#### 5.3.3 Trace 列表行设计

每行结构:

```
┌──────────────────────────────────────────────────────────────────┐
│ 🟢  贵州茅台 (600519.SH)                                        │
│ ├── trace: a1b2c3d4     │ 用户: user_xxx    │ 2026-04-03 14:30 │
│ │                                                                │
│ │ ▓▓░░░░░░▓▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓▓░░░░▓▓▓▓░░▓▓▓▓ ← 微型 waterfall  │
│ │ data   plan  phase1   trend  phase2    p3  fc                  │
│ │                                                                │
│ │ ⏱ 68.2s   🔤 215k tok   💰 $1.23   ✅ 12/12 Agent            │
│ └────────────────────────────────────────── [查看详情 →]          │
└──────────────────────────────────────────────────────────────────┘
```

**异常标记**:
- 🔴 红色左边框: status = 'failed'
- 🟡 橙色左边框: status = 'partial' (部分 Agent 失败)
- 🟢 绿色左边框: status = 'completed'

#### 5.3.4 微型 Waterfall 条

每个 Trace 行内嵌一个微型 waterfall 可视化，宽度 400px，高度 16px：
- 按实际时间比例绘制每个 Span 的起止时间
- 颜色映射见 [5.6 颜色系统](#56-颜色系统)
- 悬停显示 Span 名称和耗时

```css
.rc-mini-waterfall {
  width: 400px;
  height: 16px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}
.rc-mini-waterfall .bar {
  position: absolute;
  height: 100%;
  border-radius: 2px;
  opacity: 0.85;
  transition: opacity 0.2s;
}
.rc-mini-waterfall .bar:hover {
  opacity: 1;
  z-index: 10;
}
```

### 5.4 页面二: Trace 详情 (`/rag/logs/trace-detail?id=xxx`)

#### 5.4.1 顶部信息栏

```
┌─────────────────────────────────────────────────────────┐
│  ← 返回列表                                             │
│                                                         │
│  贵州茅台 (600519.SH) — Trace #a1b2c3d4                │
│  2026-04-03 14:30:15 → 14:31:23   状态: ✅ 完成         │
│                                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ 68.2s│  │215k  │  │$1.23 │  │12/12 │  │100%  │     │
│  │总耗时│  │Token │  │总成本│  │Agent │  │JSON  │     │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘     │
└─────────────────────────────────────────────────────────┘
```

#### 5.4.2 四 Tab 视图

```
[📊 执行链路]  [📝 Prompt 对比]  [⚡ 性能分析]  [⚙️ 配置快照]
```

---

**Tab 1: 执行链路** (默认展示)

以 Phase 分组的 Waterfall 时间线 + 卡片列表：

```
══════════ 数据获取 (Phase: data_fetch) ══════════ 5.2s ════

┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ income │balance │cashFlow│forecast│express │fina    │mainBiz │daily   │
│ 1.8s   │ 1.5s   │ 1.6s   │ 0.8s   │ 0.5s   │ 2.1s   │ 1.2s   │ 0.9s   │
│ 8条    │ 8条    │ 8条    │ 5条    │ 3条    │ 8条    │ 20条   │ 30条   │
│ tushare│tushare │tushare │tushare │tushare │tushare │tushare │tushare │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘

══════════ Phase 0: 分析规划 ══════════ 4.5s ════════════════

┌────────────────────────────────────────────────────────────┐
│ 📋 PLANNING                                                │
│ 模型: gpt-4.1 (standard)    耗时: 4.5s    Token: 8k→2k   │
│ 成本: $0.03    JSON: ✅                                    │
│                                           [查看 Prompt ▶] │
└────────────────────────────────────────────────────────────┘

══════════ Phase 1: 三表并行分析 ══════════ 18.3s ═══════════

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 📊 PROFITABILITY │ │ 📊 BALANCE_SHEET │ │ 📊 CASH_FLOW     │
│ gpt-4.1          │ │ gpt-4.1          │ │ gpt-4.1          │
│ 18.3s            │ │ 16.5s            │ │ 15.8s            │
│ 15k→8k tok       │ │ 14k→7k tok       │ │ 12k→6k tok       │
│ $0.09            │ │ $0.08            │ │ $0.07            │
│ JSON: ✅          │ │ JSON: ✅          │ │ JSON: ✅          │
│ [Prompt ▶]       │ │ [Prompt ▶]       │ │ [Prompt ▶]       │
└──────────────────┘ └──────────────────┘ └──────────────────┘

══════════ Phase 1.5: 趋势解读 ══════════ 6.2s ════════════

┌────────────────────────────────────────────────────────────┐
│ 📈 TREND_INTERPRETATION         🟡 缓存: MISS            │
│ 模型: gpt-4.1    耗时: 6.2s    Token: 20k→5k             │
│ 成本: $0.08    JSON: ✅                                    │
│                                           [查看 Prompt ▶] │
└────────────────────────────────────────────────────────────┘

// ... Phase 2, 3, 4 同理 ...
```

**Span 卡片 CSS 类**:

| 状态 | CSS 类 | 边框颜色 |
|------|--------|---------|
| 成功 | `.rc-span-card` | 左边框绿色 |
| 错误 | `.rc-span-card.error` | 左边框红色 + 红色背景 |
| 降级 | `.rc-span-card.degraded` | 左边框橙色 |
| 缓存命中 | `.rc-span-card.cache` | 右上角蓝色 badge |

**并行 Agent Grid**:
```css
.rc-parallel-grid {
  display: grid;
  gap: 12px;
}
.rc-parallel-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.rc-parallel-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
```

**Phase 分割线**:
```css
.rc-phase-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 16px;
  color: #d4af37;
  font-weight: 600;
}
.rc-phase-divider::before,
.rc-phase-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #d4af37, transparent);
}
.rc-phase-divider .duration {
  color: #94a3b8;
  font-weight: 400;
  font-size: 0.85em;
}
```

---

**Tab 2: Prompt 对比**

左侧 Agent 列表 + 右侧 Prompt/Response 查看器：

```
┌──────────────┬──────────────────────────────────────────────┐
│ Agent 列表    │  PROFITABILITY — 利润表分析                   │
│              │                                              │
│ ◉ PLANNING   │  ┌────────────────────────────────────────── │
│ ◉ PROFIT ★   │  │ System Prompt (2,847 字)        [复制📋]  │
│ ○ BALANCE    │  │ ─────────────────────────────────────     │
│ ○ CASH_FLOW  │  │ 你是一位专业的财务分析师，擅长...          │
│ ○ TREND      │  │ ...                                       │
│ ○ EARNINGS   │  │                                           │
│ ○ RISK       │  └────────────────────────────────────────── │
│ ○ BIZ_INSIGHT│                                              │
│ ○ BIZ_MODEL  │  ┌────────────────────────────────────────── │
│ ○ FORECAST   │  │ User Prompt (12,345 字)         [复制📋]  │
│ ○ VALUATION  │  │ ─────────────────────────────────────     │
│ ○ CONCLUSION │  │ 请分析以下利润表数据和财务指标：            │
│              │  │ ## 利润表数据                              │
│              │  │ [{"end_date":"20250930",...}]              │
│              │  │ ...                                       │
│              │  └────────────────────────────────────────── │
│              │                                              │
│              │  ┌────────────────────────────────────────── │
│              │  │ LLM Response (6,789 字)          [复制📋]  │
│              │  │ ─────────────────────────────────────     │
│              │  │ {"revenueAnalysis":{"trend":"增长",...}    │
│              │  │ ...                                       │
│              │  └────────────────────────────────────────── │
└──────────────┴──────────────────────────────────────────────┘
```

**交互**:
- 左侧列表点击切换 Agent
- 键盘 ↑↓ 快速切换
- 每个 Prompt 块支持复制按钮 + 折叠/展开
- JSON Response 自动格式化高亮

**Prompt 块 CSS**:
```css
.rc-prompt-block {
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  max-height: 400px;
  overflow-y: auto;
}
.rc-prompt-block .header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #94a3b8;
  font-size: 0.85em;
}
.rc-prompt-block pre {
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.82em;
  line-height: 1.6;
}
```

---

**Tab 3: 性能分析**

#### 耗时柱状图 (横向)

```
PLANNING          ████░░░░░░░░░░░░░░░░░░░░░░░░░░  4.5s
PROFITABILITY     ████████████████░░░░░░░░░░░░░░░░ 18.3s  ← 最长
BALANCE_SHEET     ██████████████░░░░░░░░░░░░░░░░░░ 16.5s
CASH_FLOW         █████████████░░░░░░░░░░░░░░░░░░░ 15.8s
TREND_INTERPRET   █████████░░░░░░░░░░░░░░░░░░░░░░░  6.2s
EARNINGS_QUALITY  ███████░░░░░░░░░░░░░░░░░░░░░░░░░  5.1s
RISK              ████████░░░░░░░░░░░░░░░░░░░░░░░░  5.8s
BUSINESS_INSIGHT  ████████░░░░░░░░░░░░░░░░░░░░░░░░  5.5s
BUSINESS_MODEL    ████████████░░░░░░░░░░░░░░░░░░░░  8.2s
FORECAST          ██████████░░░░░░░░░░░░░░░░░░░░░░  7.1s
VALUATION         █████████░░░░░░░░░░░░░░░░░░░░░░░  6.5s
FINAL_CONCLUSION  ██████████░░░░░░░░░░░░░░░░░░░░░░  7.8s
```

#### Token 消耗明细表

```
┌──────────────────┬────────┬────────┬────────┬────────┬──────────┐
│ Agent            │ 模型   │ 输入   │ 输出   │ 合计   │ 成本     │
├──────────────────┼────────┼────────┼────────┼────────┼──────────┤
│ PLANNING         │ gpt-4.1│  8,234 │  2,145 │ 10,379 │ $0.034   │
│ PROFITABILITY    │ gpt-4.1│ 15,678 │  8,234 │ 23,912 │ $0.097   │
│ BALANCE_SHEET    │ gpt-4.1│ 14,234 │  7,567 │ 21,801 │ $0.089   │
│ ...              │        │        │        │        │          │
├──────────────────┼────────┼────────┼────────┼────────┼──────────┤
│ 合计             │ —      │148,567 │ 66,789 │215,356 │ $1.23    │
└──────────────────┴────────┴────────┴────────┴────────┴──────────┘
```

**Token 条可视化** (每行内):
```css
.rc-token-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255,255,255,0.05);
}
.rc-token-bar .input {
  background: #3b82f6;  /* 蓝色 = 输入 */
}
.rc-token-bar .output {
  background: #22c55e;  /* 绿色 = 输出 */
}
```

#### 成本饼图 (CSS 纯实现)

按 Phase 汇总的成本占比环形图，使用 `conic-gradient` 实现：
- Phase 1 (三表): ~35%
- Phase 2 (深度): ~25%
- Phase 3 (扩展): ~25%
- 其他: ~15%

---

**Tab 4: 配置快照**

展示分析时的完整配置，分为三个区块：

```
┌─────────────────────────────────────────────┐
│ 📊 模型配置                                  │
│ ┌─────────────────┬────────────────────┐    │
│ │ Agent           │ 模型偏好 → 实际模型 │    │
│ ├─────────────────┼────────────────────┤    │
│ │ PLANNING        │ standard → gpt-4.1 │    │
│ │ PROFITABILITY   │ standard → gpt-4.1 │    │
│ │ ...             │ ...                │    │
│ └─────────────────┴────────────────────┘    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 👤 用户偏好                                  │
│ • 分析深度: standard (标准)                   │
│ • 分析风格: balanced (均衡)                   │
│ • 业绩预测: ✅ 启用                           │
│ • 行业对比: ✅ 启用                           │
│ • 漫画生成: ✅ 启用                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ✏️ 自定义 Prompt (已配置的 Agent)              │
│ • PROFITABILITY: "请重点关注毛利率变化..." ×   │
│ • RISK: "请增加ESG风险分析..." ×              │
│ (其他 Agent 使用默认 Prompt)                  │
└─────────────────────────────────────────────┘
```

### 5.5 交互设计

| 交互 | 行为 |
|------|------|
| 列表行点击 | 跳转 Trace 详情页 |
| Span 卡片 [查看 Prompt] | 切换到 Prompt 对比 Tab 并定位到该 Agent |
| Tab 切换 | 无刷新切换，浏览器 URL hash 更新 |
| 键盘 ←→ | Prompt 对比 Tab 内切换 Agent |
| 异常 Span 点击 | 自动跳转 Prompt 对比 Tab 查看错误详情 |
| 复制按钮 | 复制到剪贴板 + toast 提示 "已复制" |
| 耗时柱状图悬停 | 显示精确数值 tooltip |
| 筛选器变更 | 实时重新加载列表 |
| KPI 点击 | 无操作 (纯展示) |

### 5.6 颜色系统

#### Agent 颜色映射

| Agent / Span | HEX 颜色 | 用途 |
|-------------|----------|------|
| `data_fetch` | `#64748b` | 灰蓝色 — 数据获取阶段 |
| `PLANNING` | `#8b5cf6` | 紫色 — 规划 |
| `PROFITABILITY` | `#3b82f6` | 蓝色 — 利润表 |
| `BALANCE_SHEET` | `#06b6d4` | 青色 — 资产负债表 |
| `CASH_FLOW` | `#14b8a6` | 碧色 — 现金流 |
| `TREND_INTERPRETATION` | `#f97316` | 橙色 — 趋势解读 |
| `EARNINGS_QUALITY` | `#a855f7` | 亮紫 — 盈利质量 |
| `RISK` | `#ef4444` | 红色 — 风险 |
| `BUSINESS_INSIGHT` | `#22c55e` | 绿色 — 业务洞察 |
| `BUSINESS_MODEL` | `#eab308` | 黄色 — 商业模式 |
| `FORECAST` | `#ec4899` | 粉色 — 预测 |
| `VALUATION` | `#6366f1` | 靛蓝 — 估值 |
| `FINAL_CONCLUSION` | `#d4af37` | 金色 — 最终结论 |

#### Phase 颜色

| Phase | 颜色 | 描述 |
|-------|------|------|
| data_fetch | `#64748b` | 灰蓝 |
| phase_0 | `#8b5cf6` | 紫色 |
| phase_1 | `#3b82f6` | 蓝色 |
| phase_1.5 | `#f97316` | 橙色 |
| phase_2 | `#a855f7` | 亮紫 |
| phase_3 | `#eab308` | 黄色 |
| phase_4 | `#d4af37` | 金色 |

### 5.7 响应式设计

| 断点 | 行为 |
|------|------|
| ≥ 1400px | 完整布局，并行卡片 3 列 |
| 1024-1399px | 并行卡片 2 列，waterfall 缩窄 |
| 768-1023px | 卡片单列，隐藏侧边栏 |
| < 768px | 纯移动布局，Tab 变为下拉 |

---

## 6. API 接口设计

### 6.1 Trace 列表

```
GET /api/trace/list?page=1&limit=20&type=analysis&status=completed&search=贵州茅台&from=2026-04-01&to=2026-04-03
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "traceId": "a1b2c3d4-...",
        "traceType": "analysis",
        "reportId": 1234,
        "userId": "user_xxx",
        "companyCode": "600519.SH",
        "companyName": "贵州茅台",
        "totalSpans": 21,
        "llmCallCount": 12,
        "dataFetchCount": 8,
        "totalDurationMs": 68200,
        "totalTokenInput": 148567,
        "totalTokenOutput": 66789,
        "totalCostUsd": 1.23,
        "successCount": 21,
        "errorCount": 0,
        "jsonParseSuccessRate": 1.0,
        "status": "completed",
        "startedAt": "2026-04-03T14:30:15.000Z",
        "endedAt": "2026-04-03T14:31:23.200Z",
        "configSnapshot": { ... }
      }
    ],
    "total": 156,
    "page": 1,
    "limit": 20
  }
}
```

### 6.2 Trace 详情

```
GET /api/trace/detail/:traceId
```

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": { /* agent_trace_summaries 数据 */ },
    "spans": [
      {
        "spanId": "...",
        "parentSpanId": "...",
        "spanType": "llm_call",
        "spanName": "PROFITABILITY",
        "phase": "phase_1",
        "llm": {
          "model": "gpt-4.1",
          "provider": "vectorengine",
          "modelPreference": "standard",
          "systemPrompt": "你是一位专业的...",
          "userPrompt": "请分析以下利润表...",
          "responseRaw": "{\"revenueAnalysis\":...}",
          "responseParsed": true,
          "tokenInput": 15678,
          "tokenOutput": 8234,
          "tokenTotal": 23912,
          "costUsd": 0.097
        },
        "startedAt": "2026-04-03T14:30:20.500Z",
        "endedAt": "2026-04-03T14:30:38.800Z",
        "durationMs": 18300,
        "status": "success"
      }
      // ... 更多 spans
    ]
  }
}
```

### 6.3 Trace 统计

```
GET /api/trace/stats?days=7
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalTraces": 156,
    "successRate": 0.97,
    "avgDurationMs": 72000,
    "avgCostUsd": 1.15,
    "totalTokens": 33612000,
    "totalCostUsd": 179.40,
    "byModel": {
      "gpt-4.1": { "calls": 1560, "avgLatency": 8500, "avgCost": 0.085 },
      "deepseek-reasoner": { "calls": 24, "avgLatency": 15000, "avgCost": 0.045 }
    },
    "byAgent": {
      "PROFITABILITY": { "avgLatency": 16000, "avgTokens": 22000, "successRate": 0.99 },
      "FINAL_CONCLUSION": { "avgLatency": 9000, "avgTokens": 35000, "successRate": 0.95 }
    },
    "dailyTrend": [
      { "date": "2026-04-01", "count": 45, "avgCost": 1.12, "successRate": 0.98 },
      { "date": "2026-04-02", "count": 52, "avgCost": 1.18, "successRate": 0.96 }
    ]
  }
}
```

### 6.4 Prompt 下载

```
GET /api/trace/prompt/:traceId/:spanName?type=system|user|response
```

返回纯文本，Content-Type: `text/plain`。

### 6.5 路由注册

在 `src/routes/api.ts` 或新建 `src/routes/trace.ts`：

```typescript
import { Hono } from 'hono';

const trace = new Hono<{ Bindings: Env }>();

trace.get('/list', async (c) => { /* ... */ });
trace.get('/detail/:traceId', async (c) => { /* ... */ });
trace.get('/stats', async (c) => { /* ... */ });
trace.get('/prompt/:traceId/:spanName', async (c) => { /* ... */ });

export default trace;
```

在 `src/index.tsx` 中注册：
```typescript
import traceRoute from './routes/trace';
app.route('/api/trace', traceRoute);
```

---

## 7. 开发计划与排期

### 7.1 Phase 概览

```
P0 (核心基础)     ██████████████░░░░░░░░  ~3天
P1 (前端列表页)   ██████████░░░░░░░░░░░░  ~2天
P2 (前端详情页)   ████████████████░░░░░░  ~3天
P3 (统计与优化)   ████████░░░░░░░░░░░░░░  ~2天
                  ──────────────────────
                  总计: ~10 个工作日
```

### 7.2 P0: 核心基础 (约 3 天)

| 任务 | 涉及文件 | 预估代码量 | 优先级 |
|------|----------|-----------|--------|
| 创建 Migration `0018_agent_trace_spans.sql` | `migrations/` | ~80 行 SQL | 🔴 |
| 实现 `AgentTraceContext` 类 | `src/services/agentTrace.ts` | ~250 行 TS | 🔴 |
| 实现成本计算 `calculateLlmCost()` | `src/services/agentTrace.ts` | ~30 行 TS | 🔴 |
| 新增 `analyzeFinancialReportJsonTraced()` | `src/services/vectorengine.ts` | ~50 行 TS | 🔴 |
| Orchestrator 构造函数变更 | `src/agents/orchestrator.ts` | ~15 行 TS | 🔴 |
| 实现 `fetchFinancialDataTraced()` | `src/agents/orchestrator.ts` | ~60 行 TS | 🔴 |
| 12 个 Agent 方法添加 Trace 埋点 | `src/agents/orchestrator.ts` | ~180 行 TS (12×15行) | 🔴 |
| API 路由层集成 (`analyze/start`) | `src/routes/api.ts` | ~20 行 TS | 🔴 |
| **P0 合计** | | **~685 行** | |

**P0 交付标准**: 
- 每次分析自动生成 Trace 写入 D1
- 可通过 SQL 查询验证数据完整性
- 不影响现有分析功能的正常运行

### 7.3 P1: Trace API + 列表页 (约 2 天)

| 任务 | 涉及文件 | 预估代码量 | 优先级 |
|------|----------|-----------|--------|
| 创建 `src/routes/trace.ts` (4 个 API) | `src/routes/trace.ts` | ~200 行 TS | 🟡 |
| 注册 Trace 路由 | `src/index.tsx` | ~5 行 TS | 🟡 |
| 实现 `generateTraceList()` 页面 | `src/pages/rag/index.ts` | ~400 行 TS/HTML | 🟡 |
| 注册前端路由 `/rag/logs/trace` | `src/index.tsx` | ~10 行 TS | 🟡 |
| 侧边栏新增 Trace 入口 | `src/pages/rag/index.ts` | ~5 行 TS | 🟡 |
| **P1 合计** | | **~620 行** | |

**P1 交付标准**: 
- 可在 `/rag/logs/trace` 查看所有 Trace 列表
- KPI 统计显示正确
- 筛选/搜索功能可用
- 点击行跳转详情页

### 7.4 P2: Trace 详情页 (约 3 天)

| 任务 | 涉及文件 | 预估代码量 | 优先级 |
|------|----------|-----------|--------|
| 实现 `generateTraceDetail()` 页面 | `src/pages/rag/index.ts` | ~600 行 TS/HTML | 🟡 |
| Tab 1: 执行链路 (Waterfall + 卡片) | 同上 | 含在上面 | 🟡 |
| Tab 2: Prompt 对比查看器 | 同上 | 含在上面 | 🟡 |
| Tab 3: 性能分析 (柱状图 + Token 表) | 同上 | 含在上面 | 🟡 |
| Tab 4: 配置快照展示 | 同上 | 含在上面 | 🟡 |
| 微型 Waterfall 组件 | 同上 | ~80 行 CSS+JS | 🟡 |
| Prompt 下载 API | `src/routes/trace.ts` | ~30 行 TS | 🟢 |
| **P2 合计** | | **~710 行** | |

**P2 交付标准**: 
- 四个 Tab 全部可用
- Waterfall 时间线正确展示 Phase 分组
- Prompt 可查看、可复制
- 性能柱状图和 Token 表数据准确

### 7.5 P3: 统计与优化 (约 2 天)

| 任务 | 涉及文件 | 预估代码量 | 优先级 |
|------|----------|-----------|--------|
| Trace 统计 API 实现 | `src/routes/trace.ts` | ~80 行 TS | 🟢 |
| 列表页 KPI 接入真实数据 | `src/pages/rag/index.ts` | ~30 行 JS | 🟢 |
| 数据清理策略 (30 天过期) | `src/services/agentTrace.ts` | ~40 行 TS | 🟢 |
| StockInsightAgent Trace 接入 | `src/services/stockInsightAgent.ts` | ~60 行 TS | 🟢 |
| RAG Pipeline 迁移到同一 Trace 表 | `src/services/ragPipeline.ts` | ~100 行 TS | 🟢 |
| 单元测试 | `src/agents/orchestrator.test.ts` | ~100 行 TS | 🟢 |
| **P3 合计** | | **~410 行** | |

### 7.6 总代码量估算

| Phase | 后端 (TS) | 前端 (HTML/CSS/JS) | SQL | 合计 |
|-------|----------|-------------------|-----|------|
| P0 | ~685 行 | 0 | ~80 行 | ~765 行 |
| P1 | ~215 行 | ~400 行 | 0 | ~615 行 |
| P2 | ~30 行 | ~680 行 | 0 | ~710 行 |
| P3 | ~380 行 | ~30 行 | 0 | ~410 行 |
| **合计** | **~1,310 行** | **~1,110 行** | **~80 行** | **~2,500 行** |

### 7.7 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Trace 写入影响分析性能 | 低 | 中 | 使用 `ctx.waitUntil()` 异步写入 |
| D1 单行 1MB 限制 | 极低 | 低 | Prompt/Response 已在正常范围内 |
| D1 批量写入 (21 Span) 超时 | 低 | 中 | 使用 `db.batch()` 单次事务 |
| 存储增长过快 | 中 | 低 | 30 天自动清理 + 仅存最近 1000 条 |
| 前端 Waterfall 渲染性能 | 低 | 低 | 纯 CSS 实现，无需 Canvas/SVG |

---

## 8. 附录

### 8.1 相关文件清单

| 文件路径 | 描述 | 操作类型 |
|----------|------|----------|
| `migrations/0018_agent_trace_spans.sql` | 新建表 | **新增** |
| `src/services/agentTrace.ts` | Trace 核心类 | **新增** |
| `src/routes/trace.ts` | Trace API 路由 | **新增** |
| `src/services/vectorengine.ts` | 新增 Traced 方法 | **修改** |
| `src/agents/orchestrator.ts` | 添加 Trace 埋点 | **修改** |
| `src/routes/api.ts` | 集成 Trace 初始化 | **修改** |
| `src/index.tsx` | 注册路由 + 页面 | **修改** |
| `src/pages/rag/index.ts` | 新增两个页面函数 | **修改** |

### 8.2 依赖关系

```
agentTrace.ts (新)
  ├── 被 orchestrator.ts 引用 (AgentTraceContext)
  ├── 被 api.ts 引用 (flush)
  └── 被 trace.ts 路由引用 (查询)

vectorengine.ts (改)
  └── 新增 analyzeFinancialReportJsonTraced()
      └── 被 orchestrator.ts 各 run*Agent 调用

trace.ts (新)
  ├── 查询 agent_trace_spans 表
  ├── 查询 agent_trace_summaries 表
  └── 被 index.tsx 注册为 /api/trace 路由
```

### 8.3 测试策略

| 层级 | 测试方式 | 覆盖内容 |
|------|----------|----------|
| 单元 | Vitest | AgentTraceContext 方法、成本计算、Summary 构建 |
| 集成 | 手动触发分析 | 完整 Trace 写入验证、SQL 数据正确性 |
| 端到端 | 浏览器访问 | 页面渲染、交互、API 联调 |
| 性能 | 对比测试 | 开启/关闭 Trace 的分析耗时对比 (预期 < 1% 开销) |

### 8.4 未来扩展

| 扩展方向 | 优先级 | 说明 |
|----------|--------|------|
| Helicone 集成 | P4 | 代理 VectorEngine API 通过 Helicone 获取外部监控 |
| 成本预算告警 | P4 | 单次 Trace 成本超 $3 自动告警 |
| Prompt 版本对比 | P4 | 对比不同时间的 System Prompt 变更 |
| A/B 测试集成 | P4 | 与现有 model_evaluations 表打通 |
| 导出功能 | P5 | 导出 Trace 为 JSON/CSV 供离线分析 |

---

> **下一步**: 确认此方案后，从 P0 Migration + AgentTraceContext 开始实施。
