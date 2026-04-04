# Phase 1 详细开发计划 — 核心数据层（Week 1-3）

> 版本：v1.0 | 日期：2026-03-30  
> 前置文档：`RAG_MASTER_DEVELOPMENT_PLAN.md` | `RAG_BACKEND_DEVELOPMENT_PLAN.md` | `RAG_PLATFORM_UI_SPEC.md`  
> 总目标：完成文档上传增强 + Chunk 级操作 + BM25 检索 + 混合检索问答 + 意图识别 + Pipeline 日志 + 仪表盘，构成用户可完整使用的最小闭环。

---

## 一、Phase 1 总览

### 1.1 交付范围

| 维度 | 具体内容 |
|------|---------|
| **前端页面** | P.0 仪表盘 + P.1 文档上传 + P.2 知识库浏览器 + P.4 对话助手 + RAG 平台导航框架 |
| **后端 Service** | ragBm25.ts（新建）+ ragPipeline.ts（新建）+ ragIntent.ts（新建）+ rag.ts（扩展） |
| **后端 Route** | routes/rag.ts（扩展 ~12 个新 API） |
| **DB Migration** | 0020 + 0021 + 0022（3 个迁移文件，6 张新表 + 1 张表扩展） |
| **新增 API** | 约 15 个端点 |

### 1.2 Phase 1 验收标准

- [ ] PDF 文件可上传并自动解析（MinerU）、分块、向量化、BM25 索引
- [ ] Chunk 可浏览、编辑（重新向量化）、删除、搜索
- [ ] 问答支持混合检索（向量 + BM25）+ 可选 LLM 重排
- [ ] 每次问答自动记录完整 Pipeline 日志（意图→检索→重排→生成，各步耗时）
- [ ] 仪表盘展示基础 KPI（文档数/Chunk 数/问答数/准确率/延迟）+ 趋势图
- [ ] RAG 平台二级导航正常切换（17 页路由已注册，Phase 1 外的页面显示 Coming Soon）

### 1.3 现有代码基线（出发点）

| 能力 | 文件 | 状态 |
|------|------|------|
| 纯文本上传 + 递归分块 + Embedding + 向量检索 + RAG 问答 | `services/rag.ts`（972行） | ✅ 完整可用 |
| 6 个 API 端点（upload/documents/query/search/stats/delete） | `routes/rag.ts`（357行） | ✅ 完整可用 |
| 3 张 DB 表（rag_documents/rag_chunks/rag_conversations） | `0019_rag_knowledge_base.sql` | ✅ 已迁移 |
| Embedding 多 Provider（DashScope 1024d / VectorEngine 1536d） | `services/rag.ts` | ✅ 完整可用 |
| 路由注册在 `api.ts` 的 `/rag` 前缀 | `routes/api.ts` | ✅ 已集成 |

---

## 二、数据库迁移详细设计

### 2.1 迁移文件清单

| 序号 | 文件名 | 新增/修改表 | 行数 | 优先级 |
|------|--------|-----------|------|--------|
| 1 | `0020_rag_chunks_enhance.sql` | 修改 `rag_chunks`（+6字段）+ 新增 `rag_chunk_questions` | ~30 | W1-D1 |
| 2 | `0021_rag_bm25_index.sql` | 新增 `rag_bm25_tokens` + `rag_bm25_meta` | ~25 | W1-D1 |
| 3 | `0022_rag_pipeline_logs.sql` | 新增 `rag_pipeline_tasks` + `rag_pipeline_steps` + `rag_message_logs` | ~60 | W1-D1 |

### 2.2 Migration 0020: Chunk 增强字段

**目的**：为后续 Chunk 编辑、HyDE 问题生成、摘要增强做好数据结构准备。

```sql
-- 0020_rag_chunks_enhance.sql

-- Chunk 增强字段（为 P.2 编辑、P.3 增强做准备）
ALTER TABLE rag_chunks ADD COLUMN summary TEXT;                    -- LLM 生成的摘要
ALTER TABLE rag_chunks ADD COLUMN entities TEXT DEFAULT '[]';      -- 自动标注的实体 JSON
ALTER TABLE rag_chunks ADD COLUMN keywords TEXT DEFAULT '[]';      -- 自动提取的关键词 JSON
ALTER TABLE rag_chunks ADD COLUMN chunk_type TEXT DEFAULT 'text';  -- text/table/image
ALTER TABLE rag_chunks ADD COLUMN page_range TEXT;                 -- PDF 页码范围 "12-13"
ALTER TABLE rag_chunks ADD COLUMN question_count INTEGER DEFAULT 0; -- 已生成的问题数（Phase 3 用）

-- Chunk 关联的假设性问题 (HyDE, Phase 3 用，Phase 1 先建表)
CREATE TABLE IF NOT EXISTS rag_chunk_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT DEFAULT 'factual',       -- factual/analytical/boolean/comparative/open
    difficulty TEXT DEFAULT 'medium',            -- easy/medium/hard
    embedding_key TEXT,                          -- KV 中的问题 Embedding key
    has_embedding INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunk_questions_chunk ON rag_chunk_questions(chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_questions_doc ON rag_chunk_questions(document_id);
```

**Phase 1 实际使用的字段**：`chunk_type`（区分文本/表格）、`page_range`（PDF 页码映射）。其余字段 Phase 3 使用。

### 2.3 Migration 0021: BM25 倒排索引

**目的**：支持 BM25 关键词检索，实现混合检索（向量 + BM25）。

```sql
-- 0021_rag_bm25_index.sql

-- BM25 Token 倒排索引
CREATE TABLE IF NOT EXISTS rag_bm25_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,                         -- 分词后的 token
    chunk_id INTEGER NOT NULL,                   -- 关联 Chunk ID
    document_id INTEGER NOT NULL,                -- 关联文档 ID
    frequency INTEGER DEFAULT 1,                 -- 词频 (TF)
    source TEXT DEFAULT 'content',               -- 'content' 或 'question'（Phase 3 扩展）
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bm25_token ON rag_bm25_tokens(token);
CREATE INDEX IF NOT EXISTS idx_bm25_chunk ON rag_bm25_tokens(chunk_id);
CREATE INDEX IF NOT EXISTS idx_bm25_doc ON rag_bm25_tokens(document_id);
CREATE INDEX IF NOT EXISTS idx_bm25_source ON rag_bm25_tokens(source);

-- BM25 索引元数据（全局统计信息）
CREATE TABLE IF NOT EXISTS rag_bm25_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,                         -- NULL 表示全局
    source TEXT NOT NULL,                        -- 'content' 或 'question'
    total_docs INTEGER DEFAULT 0,
    avg_doc_length REAL DEFAULT 0,
    last_built DATETIME DEFAULT (datetime('now'))
);
```

### 2.4 Migration 0022: Pipeline 与日志

**目的**：支持后台任务追踪（PDF 解析进度）和每次问答的完整 Pipeline 日志记录。

```sql
-- 0022_rag_pipeline_logs.sql

-- Pipeline 任务（文档处理进度追踪）
CREATE TABLE IF NOT EXISTS rag_pipeline_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,              -- 'ingest'/'enhance'/'reindex'/'health_check'
    document_id INTEGER,
    status TEXT DEFAULT 'pending',        -- pending/running/completed/failed
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_task_status ON rag_pipeline_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_task_doc ON rag_pipeline_tasks(document_id);

-- Pipeline 步骤日志
CREATE TABLE IF NOT EXISTS rag_pipeline_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    step_name TEXT NOT NULL,              -- 'pdf_parse'/'chunking'/'embedding'/'bm25_index'
    step_order INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    input_data TEXT DEFAULT '{}',         -- 输入参数 JSON
    output_data TEXT DEFAULT '{}',        -- 输出结果 JSON
    duration_ms INTEGER,
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pipeline_steps_task ON rag_pipeline_steps(task_id);

-- 问答消息详细日志（每次问答的完整 Pipeline 执行记录）
CREATE TABLE IF NOT EXISTS rag_message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,              -- 关联 rag_conversations.id
    session_id TEXT NOT NULL,
    user_query TEXT NOT NULL,
    rewritten_query TEXT,

    -- 意图识别
    intent_type TEXT,                      -- number/name/boolean/comparative/string/open
    intent_confidence REAL,
    intent_entities TEXT DEFAULT '[]',     -- 提取的实体 JSON
    intent_latency_ms INTEGER,

    -- 向量检索
    vector_results_count INTEGER,
    vector_top_score REAL,
    vector_latency_ms INTEGER,

    -- BM25 检索
    bm25_results_count INTEGER,
    bm25_top_score REAL,
    bm25_latency_ms INTEGER,

    -- 去重合并
    dedup_count INTEGER,

    -- LLM 重排
    rerank_enabled INTEGER DEFAULT 0,
    rerank_input_count INTEGER,
    rerank_output_count INTEGER,
    rerank_model TEXT,
    rerank_latency_ms INTEGER,

    -- 回答生成
    llm_model TEXT,
    llm_input_tokens INTEGER,
    llm_output_tokens INTEGER,
    llm_latency_ms INTEGER,
    llm_temperature REAL,

    -- 引用来源
    sources_json TEXT DEFAULT '[]',       -- [{doc_id, chunk_id, page, score}]

    -- 总耗时
    total_latency_ms INTEGER,
    status TEXT DEFAULT 'success',        -- success/error
    error_message TEXT,

    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_msg_logs_session ON rag_message_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_msg_logs_intent ON rag_message_logs(intent_type);
CREATE INDEX IF NOT EXISTS idx_msg_logs_created ON rag_message_logs(created_at);
```

---

## 三、后端 Service 层详细设计

### 3.1 新建 `services/ragBm25.ts` — BM25 检索服务

**文件大小估计**：~300 行  
**核心职责**：中文分词、BM25 倒排索引构建与检索

#### 3.1.1 导出接口

```typescript
// services/ragBm25.ts

export interface BM25Config {
  k1: number;      // 默认 1.5
  b: number;       // 默认 0.75
}

export interface BM25SearchResult {
  chunkId: number;
  documentId: number;
  score: number;
  content: string;
  matchedTokens: string[];
}

export class BM25Service {
  constructor(db: D1Database);

  // ========== 分词 ==========
  /** 中文分词（Intl.Segmenter + 停用词过滤） */
  tokenize(text: string): string[];

  // ========== 索引构建 ==========
  /** 为指定文档构建 BM25 索引 */
  buildIndexForDocument(documentId: number): Promise<{ tokenCount: number; chunkCount: number }>;
  /** 删除指定文档的 BM25 索引 */
  deleteIndexForDocument(documentId: number): Promise<void>;
  /** 重建全局索引元数据 */
  rebuildGlobalMeta(): Promise<void>;

  // ========== 检索 ==========
  /** BM25 关键词检索 */
  search(query: string, options?: {
    topK?: number;
    documentIds?: number[];
    stockCode?: string;
    minScore?: number;
  }): Promise<BM25SearchResult[]>;
}
```

#### 3.1.2 关键实现细节

**分词方案**：

```typescript
// 使用 Intl.Segmenter（Workers 原生支持，无需第三方依赖）
private segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

// 扩展停用词表（从 Python 版的 28 个扩展到 ~200 个高频中文停用词）
private STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
  '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
  '们', '那', '些', '什么', '多', '为', '所以', '对', '出', '来',
  // ... 更多高频停用词
]);

tokenize(text: string): string[] {
  const segments = this.segmenter.segment(text);
  return Array.from(segments)
    .filter(s => s.isWordLike)
    .map(s => s.segment.toLowerCase())
    .filter(s => s.length > 1 && !this.STOP_WORDS.has(s));
}
```

**BM25 计算**：

```typescript
// BM25Okapi 公式：
// score(q, D) = Σ IDF(t) × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × dl/avgdl))

async search(query: string, options = {}): Promise<BM25SearchResult[]> {
  const { topK = 10, documentIds, minScore = 0.0 } = options;
  const queryTokens = this.tokenize(query);
  if (queryTokens.length === 0) return [];

  // 1. 获取全局统计信息
  const meta = await this.getGlobalMeta();

  // 2. SQL 查询所有匹配的 chunk + 词频
  const placeholders = queryTokens.map(() => '?').join(',');
  let sql = `
    SELECT bt.chunk_id, bt.document_id, bt.token, bt.frequency,
           (SELECT content FROM rag_chunks WHERE id = bt.chunk_id) as content,
           (SELECT SUM(frequency) FROM rag_bm25_tokens 
            WHERE chunk_id = bt.chunk_id AND source = 'content') as doc_length
    FROM rag_bm25_tokens bt
    WHERE bt.token IN (${placeholders}) AND bt.source = 'content'
  `;
  // ... 可选 documentIds 过滤

  // 3. 应用层计算 BM25 分数
  // 按 chunk_id 分组 → 对每个 chunk 的每个匹配 token 计算 BM25 → 求和
  // 4. 排序返回 Top-K
}
```

**索引构建**（分批写入，避免 D1 并发锁）：

```typescript
async buildIndexForDocument(documentId: number) {
  // 1. 清理旧索引
  await this.deleteIndexForDocument(documentId);

  // 2. 获取所有 Chunk
  const chunks = await this.db.prepare(
    'SELECT id, content FROM rag_chunks WHERE document_id = ?'
  ).bind(documentId).all();

  // 3. 分批构建索引（每批 50 条 INSERT）
  const BATCH_SIZE = 50;
  let batchValues: any[] = [];

  for (const chunk of chunks.results) {
    const tokens = this.tokenize(chunk.content as string);
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);

    for (const [token, count] of freq) {
      batchValues.push([token, chunk.id, documentId, count, 'content']);
      if (batchValues.length >= BATCH_SIZE) {
        await this.batchInsertTokens(batchValues);
        batchValues = [];
      }
    }
  }
  if (batchValues.length > 0) await this.batchInsertTokens(batchValues);

  // 4. 更新元数据
  await this.updateDocumentMeta(documentId);
}
```

---

### 3.2 新建 `services/ragIntent.ts` — 意图识别服务

**文件大小估计**：~200 行  
**核心职责**：Query 意图分类、Query 改写、比较题拆分、实体提取

#### 3.2.1 导出接口

```typescript
export interface IntentResult {
  type: 'number' | 'name' | 'boolean' | 'comparative' | 'open' | 'string';
  confidence: number;
  entities: string[];
  rewrittenQuery: string | null;
  subQueries?: string[];       // 比较题拆分后的子查询
  latencyMs: number;
}

export class IntentService {
  constructor(apiKey: string, baseUrl?: string, model?: string);

  /** 分类意图 + 改写 Query + 提取实体（单次 LLM 调用） */
  classifyAndRewrite(query: string): Promise<IntentResult>;
}
```

#### 3.2.2 LLM Prompt 设计

```
Temperature: 0.1（高确定性任务）
Model: qwen-turbo-latest（DashScope）或 gpt-4.1（VectorEngine）

System Prompt:
你是一个专业的金融问答意图分析器。分析用户问题，返回以下 JSON：
{
  "type": "number|name|boolean|comparative|open|string",
  "confidence": 0.0-1.0,
  "entities": ["贵州茅台", "2024年", "营收"],
  "rewritten_query": "贵州茅台2024年度营业收入",  // 如果原 Query 需要改写
  "sub_queries": ["贵州茅台毛利率", "五粮液毛利率"]  // 仅 comparative 类型
}

意图类型定义：
- number: 查询具体数值（营收、利润、增长率等）
- name: 查询名称/名字（CEO、子公司、产品名等）
- boolean: 是/否判断（是否盈利、是否超过等）
- comparative: 多公司/多指标对比
- open: 开放性分析（竞争优势、行业分析等）
- string: 其他文本查询

改写规则：
- 补全公司全称（"茅台" → "贵州茅台"）
- 规范化指标名称（"赚了多少" → "净利润"）
- 补充时间范围（默认最新年报）
- 如果原 Query 已经清晰，rewritten_query 设为 null
```

---

### 3.3 新建 `services/ragPipeline.ts` — Pipeline 编排服务

**文件大小估计**：~250 行  
**核心职责**：增强版 RAG 问答的完整 Pipeline 编排 + 日志记录、文档处理任务管理

#### 3.3.1 导出接口

```typescript
export interface EnhancedRAGConfig {
  enableBm25: boolean;           // 是否启用 BM25
  enableRerank: boolean;         // 是否启用 LLM 重排
  topK: number;                  // 检索返回数量
  minScore: number;              // 最低分阈值
  rerankWeight: number;          // LLM 重排权重（0-1），向量权重 = 1-rerankWeight
  documentIds?: number[];
  stockCode?: string;
}

export interface EnhancedRAGResult {
  answer: string;
  sources: Array<{
    documentId: number;
    documentTitle: string;
    chunkContent: string;
    relevanceScore: number;
    chunkId: number;
    pageRange?: string;
    source: 'vector' | 'bm25' | 'both';
  }>;
  sessionId: string;
  pipeline: {
    intent: IntentResult;
    vectorResults: number;
    bm25Results: number;
    dedupCount: number;
    rerankApplied: boolean;
    totalLatencyMs: number;
  };
  messageLogId: number;          // 日志记录 ID
}

export class PipelineService {
  constructor(
    db: D1Database,
    kv: KVNamespace,
    ragService: RAGService,
    bm25Service: BM25Service,
    intentService: IntentService,
    apiKey: string
  );

  /** 增强版 RAG 问答（完整 Pipeline） */
  enhancedQuery(params: {
    question: string;
    sessionId?: string;
    config: EnhancedRAGConfig;
    conversationHistory?: Array<{ role: string; content: string }>;
    userId?: number;
  }): Promise<EnhancedRAGResult>;

  // ========== 文档处理 Pipeline ==========
  /** 创建文档处理任务 */
  createIngestTask(documentId: number): Promise<number>;
  /** 获取任务进度 */
  getTaskProgress(taskId: number): Promise<PipelineTaskProgress>;
  /** 更新任务步骤 */
  updateStep(taskId: number, stepName: string, status: string, data?: any): Promise<void>;
}
```

#### 3.3.2 增强问答 Pipeline 流程

```
用户 Query → ① 意图识别(IntentService) 
           → ② 并行执行 [向量检索(RAGService) || BM25 检索(BM25Service)]
           → ③ 去重合并（按 chunk_id 去重，取最高分）
           → ④ LLM 重排（可选，加权融合）
           → ⑤ LLM 生成回答（使用重排后 Top-K 作为 Context）
           → ⑥ 保存日志到 rag_message_logs
           → 返回 EnhancedRAGResult
```

**LLM 重排实现**：

```typescript
// 对合并后的候选 Chunks，逐一让 LLM 评估相关性
// Temperature: 0.1
// Prompt: "给定问题：{query}\n给定文档片段：{chunk}\n评估相关性（0-10分），返回 JSON: {score: N, reason: '...'}"
// 最终分数 = rerankWeight * llmScore/10 + (1-rerankWeight) * originalScore
```

---

### 3.4 扩展 `services/rag.ts` — 现有服务增强

**新增方法**（~100 行新增）：

```typescript
// 在 RAGService 类中新增：

/** 获取 Chunk 列表（分页/筛选） */
async listChunks(params: {
  documentId?: number;
  chunkType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ chunks: any[]; total: number }>;

/** 获取 Chunk 详情 */
async getChunk(chunkId: number): Promise<any>;

/** 编辑 Chunk 内容 → 重新向量化 */
async updateChunk(chunkId: number, content: string): Promise<{ embeddingKey: string }>;

/** 删除 Chunk → 清理向量 */
async deleteChunk(chunkId: number): Promise<void>;

/** 仪表盘聚合统计 */
async getDashboardStats(): Promise<{
  totalDocuments: number;
  totalChunks: number;
  totalConversations: number;
  weeklyNewDocs: number;
  weeklyNewChunks: number;
  weeklyNewConversations: number;
  avgLatencyMs: number;
  categories: Array<{ category: string; count: number }>;
  recentConversations: Array<{ sessionId: string; question: string; time: string }>;
  systemStatus: { embeddingProvider: string; model: string; dimensions: number; bm25Ready: boolean };
}>;

/** 切片预览（不入库，仅返回分块结果） */
previewChunking(content: string, config: { chunkSize: number; chunkOverlap: number }): { chunks: string[]; stats: { count: number; avgLength: number; maxLength: number; minLength: number } };
```

---

## 四、后端 Route 层详细设计

### 4.1 `routes/rag.ts` 扩展端点

在现有 6 个端点基础上，新增以下端点：

| # | 方法 | 路径 | 说明 | 请求体/参数 | 响应 | 优先级 |
|---|------|------|------|-----------|------|--------|
| 1 | `GET` | `/chunks` | Chunk 列表（分页/筛选） | `?documentId=&type=&search=&limit=20&offset=0` | `{ chunks[], total }` | W1 |
| 2 | `GET` | `/chunks/:id` | Chunk 详情 | — | `{ chunk }` | W1 |
| 3 | `PUT` | `/chunks/:id` | 编辑 Chunk（重新向量化） | `{ content }` | `{ success, embeddingKey }` | W1 |
| 4 | `DELETE` | `/chunks/:id` | 删除 Chunk | — | `{ success }` | W1 |
| 5 | `POST` | `/chunks/:id/similar` | 以 Chunk 为 Query 的相似搜索 | `{ topK? }` | `{ results[] }` | W1 |
| 6 | `POST` | `/query/enhanced` | 增强版问答（混合检索） | `{ question, config, sessionId?, history? }` | `{ answer, sources, pipeline, logId }` | W2 |
| 7 | `POST` | `/upload/pdf` | PDF 文件上传 + MinerU 解析 | `FormData: file + metadata` | `{ taskId, documentId }` | W3 |
| 8 | `GET` | `/upload/preview` | 切片预览 | `{ content, chunkSize, chunkOverlap }` | `{ chunks[], stats }` | W3 |
| 9 | `GET` | `/stats/dashboard` | 仪表盘聚合数据 | `?period=7d` | `{ KPIs, trends, recent, system }` | W3 |
| 10 | `GET` | `/pipeline/status/:taskId` | Pipeline 任务进度 | — | `{ status, steps, progress }` | W2 |
| 11 | `POST` | `/chunks/reindex/:documentId` | 重建文档索引（Embedding+BM25） | — | `{ taskId }` | W1 |
| 12 | `GET` | `/logs/recent` | 最近问答日志 | `?limit=10` | `{ logs[] }` | W3 |

### 4.2 路由注册变更

```typescript
// routes/api.ts — 无需修改（已有 api.route('/rag', rag)）
// 所有新端点在 routes/rag.ts 内扩展即可
```

---

## 五、前端任务详细设计

### 5.1 Week 1：RAG 平台框架 + 公共组件

| 任务 | 交付物 | 文件 | 工作量 |
|------|--------|------|--------|
| RAG 平台二级导航 sidebar 组件 | 左侧窄栏，6 组导航（数据管理/检索与问答/评测中心/版本管理/日志与追踪/平台设置），支持折叠 | `src/components/ragSidebar.ts` | 1d |
| RAG 平台路由注册（17 页面） | 所有 `/rag/*` 路由声明，Phase 1 外页面显示 Coming Soon 占位 | 路由配置（ragKnowledgeBase.ts 扩展或新路由文件） | 0.5d |
| 主站侧边栏入口 | sidebar.ts 添加 "RAG 平台" 入口（icon: brain, badge: New） | `src/pages/home/sidebar.ts` | 0.5d |
| 公共 UI 组件库 | KPI 卡片、进度条、可折叠面板、数据表格、Tab 切换器、空状态 | `src/components/ragCommon.ts` | 2d |

### 5.2 Week 2：P.1 文档上传 + P.2 知识库浏览器

| 任务 | 交付物 | 文件 | 工作量 |
|------|--------|------|--------|
| P.1 文档上传页面 | PDF 拖拽上传 + 文本粘贴 Tab + 文档信息表单 + 切片参数配置（滑动条） | `src/pages/ragUpload.ts` | 2d |
| P.1 切片预览 + 处理进度 | 调参后实时预览前 20 个 Chunk + 4 步处理进度条（KV 轮询） | `src/pages/ragUpload.ts` | 1d |
| P.2 知识库浏览器 — 文档列表 | 左侧文档目录树 + 右侧文档元数据面板 + 操作按钮（重新分块/重建索引/删除） | `src/pages/ragKnowledgeBrowser.ts` | 1.5d |
| P.2 知识库浏览器 — Chunk 列表 | Chunk 卡片列表 + Tab 筛选(全部/文本/表格) + 分页 + 编辑/删除 | `src/pages/ragKnowledgeBrowser.ts` | 1.5d |

### 5.3 Week 3：P.4 对话助手 + P.0 仪表盘

| 任务 | 交付物 | 文件 | 工作量 |
|------|--------|------|--------|
| P.4 对话助手 — 对话界面 | 左侧对话区 + 消息列表 + 输入框 + Markdown 渲染 + 历史 Session 列表 | `src/pages/ragChat.ts` | 1.5d |
| P.4 对话助手 — 工作流可视化 | 4 步 Pipeline 面板(意图→检索→重排→生成) + 各步耗时标注 + 可折叠 | `src/pages/ragChat.ts` | 1.5d |
| P.4 对话助手 — 右侧检索面板 | 检索详情（向量/BM25 各环节数据）+ 引用来源卡片 + 实时检索配置调节 | `src/pages/ragChat.ts` | 1d |
| P.0 仪表盘 | 5 项 KPI 卡片 + 问答趋势折线图 + 分类饼图 + 最近问答列表 + 系统状态 | `src/pages/ragDashboard.ts` | 1.5d |

---

## 六、每日开发任务分解（3 周 / 15 个工作日）

### Week 1（Day 1-5）：数据基础 + BM25 + Chunk CRUD

| 天 | 上午（后端） | 下午（前端/后端） | 交付物 |
|----|------------|-----------------|--------|
| **D1** | 创建 3 个 DB Migration 文件（0020-0022）并本地验证 | 实现 `services/ragBm25.ts` — 分词(tokenize) + 停用词表 | Migration SQL ready + 分词可用 |
| **D2** | 实现 `services/ragBm25.ts` — 索引构建(buildIndexForDocument) + 删除 + 元数据更新 | 实现 `services/ragBm25.ts` — search() BM25 检索 + 排序 | BM25 Service 完整可用 |
| **D3** | 扩展 `services/rag.ts` — listChunks + getChunk + updateChunk + deleteChunk | 扩展 `routes/rag.ts` — Chunk CRUD 5 个端点（GET/PUT/DELETE /chunks） | Chunk API 可测试 |
| **D4** | 搭建 RAG 平台二级导航 sidebar + 路由注册（17 页） + 主站入口 | 公共 UI 组件库（KPI 卡片、表格、进度条、Tab） | 前端框架 ready |
| **D5** | 将 BM25 索引构建集成到文档 ingest 流程（ingestDocument 末尾自动调用） | 端到端测试：上传文档 → BM25 索引自动构建 → BM25 搜索返回结果 | W1 后端集成验证 |

### Week 2（Day 6-10）：混合检索 + 意图识别 + 对话助手前端

| 天 | 上午（后端） | 下午（前端/后端） | 交付物 |
|----|------------|-----------------|--------|
| **D6** | 实现 `services/ragIntent.ts` — classifyAndRewrite（LLM 单次调用，意图+改写+实体） | 实现 `services/ragPipeline.ts` — enhancedQuery 骨架（步骤编排框架） | Intent + Pipeline 骨架 |
| **D7** | 实现 `services/ragPipeline.ts` — 完整 enhancedQuery（并行检索+去重+重排+日志） | 扩展 `routes/rag.ts` — POST /query/enhanced + GET /pipeline/status | 增强问答 API 可用 |
| **D8** | 实现 `services/ragPipeline.ts` — createIngestTask + updateStep + 日志保存 | P.1 文档上传页面（PDF 拖拽 + 文本粘贴 + 文档信息表单 + 切片参数） | Pipeline 日志 + P.1 基础 |
| **D9** | P.1 切片预览 + 处理进度（对接 upload/preview + pipeline/status 轮询） | P.2 知识库浏览器 — 文档列表 + 文档元数据面板 | P.1 完整 + P.2 左侧 |
| **D10** | P.2 知识库浏览器 — Chunk 列表 + 编辑/删除（对接 Chunk CRUD API） | 端到端测试：上传→分块→搜索→Chunk 编辑→重新向量化 | W2 前端+后端联调 |

### Week 3（Day 11-15）：PDF 上传 + 对话助手 + 仪表盘 + 联调

| 天 | 上午（后端） | 下午（前端） | 交付物 |
|----|------------|------------|--------|
| **D11** | R2 绑定启用 + PDF 上传 API（POST /upload/pdf → R2 存储） + MinerU API 集成 | P.4 对话助手 — 对话界面（消息列表 + 输入框 + Markdown 渲染） | PDF 上传后端 + P.4 基础 |
| **D12** | 切片预览 API（GET /upload/preview）+ PDF 解析结果回调处理 | P.4 对话助手 — 工作流可视化（4 步 Pipeline 面板 + 耗时标注） | 切片预览 + P.4 Pipeline |
| **D13** | 仪表盘聚合统计 API（GET /stats/dashboard）+ 最近日志 API | P.4 对话助手 — 右侧检索面板 + 检索配置调节器 | 仪表盘 API + P.4 完整 |
| **D14** | P.0 仪表盘页面（KPI 卡片 + 趋势图 + 分类占比 + 最近问答 + 系统状态） | 全平台联调：P.0→P.1→P.2→P.4 完整用户流程 | P.0 完成 + 全链路联调 |
| **D15** | Bug 修复 + 边界情况处理 + 错误提示优化 + 代码整理 + Phase 1 验收自测 | Vite 构建验证 + 提交代码 + 更新 PR | Phase 1 交付完成 |

---

## 七、API 端点详细规格

### 7.1 POST `/api/rag/query/enhanced` — 增强版问答

**请求体**：
```json
{
  "question": "茅台2024年的营收增速是多少？",
  "sessionId": "rag-xxx-yyy",
  "config": {
    "enableBm25": true,
    "enableRerank": true,
    "topK": 5,
    "minScore": 0.25,
    "rerankWeight": 0.7,
    "documentIds": [1, 2],
    "stockCode": "600519.SH"
  },
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**响应体**：
```json
{
  "success": true,
  "answer": "根据贵州茅台2024年年报数据...",
  "sources": [
    {
      "documentId": 1,
      "documentTitle": "贵州茅台2024年报",
      "chunkContent": "2024年,公司实现营业收入1,741.44亿元...",
      "relevanceScore": 0.962,
      "chunkId": 12,
      "pageRange": "12-13",
      "source": "both"
    }
  ],
  "sessionId": "rag-xxx-yyy",
  "pipeline": {
    "intent": {
      "type": "number",
      "confidence": 0.95,
      "entities": ["贵州茅台", "2024年", "营收增速"],
      "rewrittenQuery": "贵州茅台2024年营业收入同比增长率",
      "latencyMs": 12
    },
    "vectorResults": 5,
    "bm25Results": 3,
    "dedupCount": 8,
    "rerankApplied": true,
    "totalLatencyMs": 3542
  },
  "messageLogId": 156
}
```

### 7.2 GET `/api/rag/stats/dashboard` — 仪表盘数据

**响应体**：
```json
{
  "success": true,
  "kpi": {
    "totalDocuments": 127,
    "weeklyNewDocs": 12,
    "totalChunks": 12840,
    "weeklyNewChunks": 1230,
    "totalConversations": 3056,
    "weeklyNewConversations": 320,
    "avgLatencyMs": 1800,
    "latencyChange": -300
  },
  "trends": {
    "dates": ["03-24", "03-25", "03-26", "03-27", "03-28", "03-29", "03-30"],
    "conversations": [42, 38, 55, 61, 47, 52, 65]
  },
  "categories": [
    { "category": "annual_report", "count": 58, "percentage": 45.7 },
    { "category": "quarterly_report", "count": 38, "percentage": 29.9 }
  ],
  "recentConversations": [
    { "sessionId": "rag-abc", "question": "茅台2024年营收?", "answer": "1741.44亿元...", "time": "14:23:15", "status": "success" }
  ],
  "systemStatus": {
    "embeddingProvider": "dashscope",
    "embeddingModel": "text-embedding-v4",
    "dimensions": 1024,
    "bm25Ready": true,
    "kvUsage": "1.8GB"
  }
}
```

---

## 八、技术风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| `Intl.Segmenter` 中文分词质量不够 | 中 | BM25 检索精度下降 | 预构建金融领域高频词典（200+），补充 N-gram 切分作为 fallback |
| MinerU API 不可用或延迟高 | 低 | PDF 上传功能不可用 | 实现纯文本提取 fallback（基于 PDF.js）；失败重试 3 次 |
| D1 批量写入锁（BM25 索引构建） | 中 | 大文档索引构建卡顿 | 分批 INSERT（每批 50 条）+ 适当 delay（100ms） |
| Workers CPU 30s 限制 | 中 | 大文档的 Embedding 生成超时 | 使用 `waitUntil()` 后台执行 + 分批处理 |
| R2 绑定未启用 | 低 | PDF 文件存储不可用 | Phase 1 W3 再启用 R2；W1-W2 不依赖 PDF 上传 |
| LLM 重排耗时过长 | 低 | 用户体验差（>5s） | 重排结果缓存 + 前端先返回检索结果再异步更新重排结果 |

---

## 九、测试策略

### 9.1 每日验证清单

| 测试项 | 预期结果 | 所属天 |
|--------|---------|--------|
| 分词函数对"贵州茅台2024年营业收入同比增长15.7%"的切分结果 | `["贵州", "茅台", "2024", "营业", "收入", "同比", "增长", "15.7"]`（停用词已过滤） | D1 |
| 上传一份 500 字文档，BM25 索引自动构建 | `rag_bm25_tokens` 有记录，`rag_bm25_meta` 有统计 | D5 |
| BM25 搜索"茅台营收"返回相关 Chunk | 返回 Top-3，Score > 0 | D5 |
| 增强问答"茅台2024年营收是多少？" | Pipeline 日志完整记录：意图=number，向量+BM25 均有结果，日志写入 rag_message_logs | D7 |
| 编辑 Chunk 内容后搜索 | 修改后的内容能被向量检索和 BM25 检索命中 | D10 |
| 仪表盘 KPI 数据正确 | 文档数/Chunk 数/问答数与数据库一致 | D13 |
| Vite 构建成功（无 TypeScript 错误） | `dist/_worker.js` 成功生成 | D15 |

### 9.2 Phase 1 端到端验收场景

**场景 1：文本上传 → 问答**
1. P.1 粘贴一份财报文本 → 配置 chunkSize=500, overlap=100 → 预览 → 确认入库
2. P.2 浏览上传的文档 → 查看 Chunk 列表 → 编辑某个 Chunk
3. P.4 提问"这家公司的主营业务是什么？" → 看到完整 Pipeline 工作流 → 检查引用来源

**场景 2：混合检索对比**
1. P.4 配置为"纯向量"检索 → 提问 → 记录结果
2. P.4 配置为"混合+重排" → 同样问题 → 对比结果质量和耗时

**场景 3：仪表盘数据验证**
1. P.0 查看 KPI → 验证与数据库实际数据一致
2. 执行几次问答后刷新 → 验证趋势图和最近问答更新

---

## 十、文件创建清单汇总

### 后端文件

| 文件路径 | 类型 | 行数估计 | 所属天 |
|---------|------|---------|--------|
| `migrations/0020_rag_chunks_enhance.sql` | DB Migration | ~30 | D1 |
| `migrations/0021_rag_bm25_index.sql` | DB Migration | ~25 | D1 |
| `migrations/0022_rag_pipeline_logs.sql` | DB Migration | ~60 | D1 |
| `src/services/ragBm25.ts` | 新建 Service | ~300 | D1-D2 |
| `src/services/ragIntent.ts` | 新建 Service | ~200 | D6 |
| `src/services/ragPipeline.ts` | 新建 Service | ~250 | D6-D8 |
| `src/services/rag.ts` | 扩展（+100 行） | +100 | D3 |
| `src/routes/rag.ts` | 扩展（+200 行） | +200 | D3, D7, D11-D13 |

### 前端文件

| 文件路径 | 类型 | 行数估计 | 所属天 |
|---------|------|---------|--------|
| `src/components/ragSidebar.ts` | 新建组件 | ~200 | D4 |
| `src/components/ragCommon.ts` | 新建组件库 | ~400 | D4 |
| `src/pages/ragUpload.ts` | 新建页面 (P.1) | ~800 | D8-D9 |
| `src/pages/ragKnowledgeBrowser.ts` | 新建页面 (P.2) | ~700 | D9-D10 |
| `src/pages/ragChat.ts` | 新建页面 (P.4) | ~900 | D11-D13 |
| `src/pages/ragDashboard.ts` | 新建页面 (P.0) | ~500 | D14 |

---

## 十一、Phase 1 → Phase 2 衔接

### Phase 1 完成后的代码资产

完成 Phase 1 后，项目新增：
- **3 个 Service 文件** + 1 个扩展（ragBm25 / ragIntent / ragPipeline + rag.ts 扩展）
- **4 个前端页面** + 2 个组件文件
- **3 个 DB Migration**（6 张新表 + 1 张扩展）
- **~15 个新 API 端点**
- 总新增代码 ~4,500 行（后端 ~1,150 + 前端 ~3,500）

### Phase 2 启动条件

| 条件 | 说明 |
|------|------|
| Phase 1 全部验收通过 | 6 项验收标准全部 ✓ |
| 混合检索可用 | 向量+BM25 并行检索 + 去重 + 可选重排 |
| 日志数据有积累 | rag_message_logs 有 >20 条记录 |
| 构建无错误 | `npm run build` 成功 |

### Phase 2 预备工作（Phase 1 期间顺带完成）

1. Migration 0020 中的 `rag_chunk_questions` 表（Phase 3 用，但 Phase 1 先建好）
2. Pipeline 日志格式已覆盖 Phase 2 评测所需的全部字段
3. 前端 Coming Soon 占位页已注册好 Phase 2 的 4 个页面路由

---

> **下一步**：确认本计划后，立即开始 Day 1 — 创建 3 个 DB Migration 文件 + 实现 BM25 分词函数。
