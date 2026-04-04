# Finspark RAG 平台 — 后端开发方案与开发计划

> 版本：v1.0 | 日期：2026-03-30  
> 前置文档：`RAG_PLATFORM_UI_SPEC.md` (v2.0) | `RAG_CODE_REFERENCE.md` (v1.0)  
> 技术栈：Hono + Cloudflare Workers (D1 + KV + R2) + TypeScript

---

## 一、现有后端基线分析

### 1.1 已有技术架构

| 组件 | 技术选型 | 当前状态 |
|------|---------|---------|
| Web 框架 | Hono v4.11+ (Cloudflare Pages Functions) | ✅ 生产可用 |
| 数据库 | Cloudflare D1 (SQLite 兼容) | ✅ 19 个 migration，含 rag_documents/chunks/conversations |
| 缓存 / KV | Cloudflare KV (`CACHE` binding) | ✅ 存储 Embedding 向量 + 分析缓存 |
| 文件存储 | Cloudflare R2 (`STORAGE` binding) | ⚠️ wrangler.jsonc 已注释，待启用 |
| 认证 | JWT + optionalAuth / requireAuth / requireFeature 中间件 | ✅ 完整三级权限体系 |
| Embedding | DashScope text-embedding-v4 (1024d) / VectorEngine text-embedding-3-small (1536d) | ✅ 多 Provider 支持 |
| LLM Chat | VectorEngine gpt-4.1 (via OpenAI-compatible API) | ✅ 用于 RAG 问答 |
| 构建 | Vite + @hono/vite-build → dist/_worker.js | ✅ 前后端一体构建 |

### 1.2 已有 RAG 模块清单

#### 已实现的后端能力

| 能力 | 文件 | API 路由 | 状态 |
|------|------|---------|------|
| 文档上传（纯文本） | `services/rag.ts` → `ingestDocument()` | `POST /api/rag/upload` | ✅ |
| 文本分块 (Recursive Character Splitter) | `services/rag.ts` → `splitTextIntoChunks()` | 内部调用 | ✅ |
| Embedding 生成 (多Provider批量) | `services/rag.ts` → `generateEmbeddings()` | 内部调用 | ✅ |
| 向量相似度检索 (Cosine Similarity) | `services/rag.ts` → `searchSimilar()` | `POST /api/rag/search` | ✅ |
| RAG 增强问答 | `services/rag.ts` → `ragQuery()` | `POST /api/rag/query` | ✅ |
| 文档列表 / 详情 / 删除 | `services/rag.ts` | `GET/DELETE /api/rag/documents` | ✅ |
| 知识库统计 | `services/rag.ts` → `getStats()` | `GET /api/rag/stats` | ✅ |
| 对话记录存储 | `services/rag.ts` → `ragQuery()` 内部 | D1 `rag_conversations` 表 | ✅ |

#### 尚未实现的能力（差距一览）

| UI 页面 | 需要的后端能力 | 当前状态 |
|---------|--------------|---------|
| P.0 仪表盘 | 聚合统计 API (问答趋势、分类占比、检索准确率、平均延迟) | ❌ 仅有基础 stats |
| P.1 文档上传 | PDF 解析 (MinerU API)、切片预览、多策略分块、处理进度 SSE | ❌ 仅文本上传 |
| P.2 知识库浏览器 | Chunk CRUD、Chunk 编辑后重新向量化、相似 Chunk 搜索 | ❌ 仅文档级 CRUD |
| P.3 Chunk 质量增强 | HyDE 问题生成、摘要增强、实体标注、批量处理进度 | ❌ 全新 |
| P.4 对话助手增强 | BM25 检索、混合检索、LLM 重排、意图识别、Pipeline 日志 | ❌ 仅向量检索 |
| P.5 检索调试台 | 多策略并行检索、Recall 计算、向量可视化数据 | ❌ 全新 |
| P.6 测试集管理 | 测试集 CRUD、LLM 题目生成、问题扩写 | ❌ 全新 |
| P.7 批量评测 | 评测任务管理、自动/LLM 打分、多维度分析 | ❌ 全新 |
| P.8 对话日志 | 结构化 Pipeline 日志存储与查询 | ❌ 仅基础对话记录 |
| P.9 意图识别日志 | 意图分类 + Query 改写日志 | ❌ 全新 |
| P.10 Pipeline 追踪 | 后台任务管理 + 步骤日志 | ❌ 全新 |
| P.11 模型配置 | 模型/Provider CRUD、API Key 管理、连接测试 | ❌ 硬编码 |
| P.12 Prompt 管理 | Prompt 模板 CRUD + 版本管理 | ❌ 硬编码 |
| P.13 系统配置 | 全局配置 KV 存储 | ❌ 硬编码 |
| P.14 对话知识沉淀 | 知识提取 LLM、批量提取、LLM 合并、审核工作流 | ❌ 全新 (Python 原型已有) |
| P.15 知识库健康度 | 三维检查 LLM、健康报告存储、定时任务 | ❌ 全新 (Python 原型已有) |
| P.16 版本管理 | 版本快照、Diff 计算、性能评测、回归测试 | ❌ 全新 (Python 原型已有) |

---

## 二、后端架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     API Routes Layer                        │
│  src/routes/rag.ts          (文档/问答/搜索/统计)           │
│  src/routes/rag-enhance.ts  (Chunk增强/BM25/测试集/评测)    │
│  src/routes/rag-ops.ts      (日志/Pipeline/模型/Prompt/配置) │
│  src/routes/rag-knowledge.ts(知识沉淀/健康检查/版本管理)     │
├─────────────────────────────────────────────────────────────┤
│                     Service Layer                           │
│  services/rag.ts            (现有: 文档/Embedding/检索/问答) │
│  services/ragBm25.ts        (BM25 索引构建与检索)           │
│  services/ragPipeline.ts    (Pipeline 编排 + 日志)          │
│  services/ragEnhance.ts     (问题生成/摘要/实体标注)         │
│  services/ragTestSet.ts     (测试集/评测/打分)              │
│  services/ragKnowledge.ts   (知识提取/合并/沉淀)            │
│  services/ragHealth.ts      (三维健康检查)                   │
│  services/ragVersion.ts     (版本快照/Diff/性能对比)         │
│  services/ragIntent.ts      (意图识别/Query改写)            │
│  services/ragConfig.ts      (模型/Prompt/系统配置管理)       │
├─────────────────────────────────────────────────────────────┤
│                     Data Access Layer                       │
│  Cloudflare D1  — 结构化数据 (文档/Chunk/日志/配置/版本)     │
│  Cloudflare KV  — Embedding 向量 / BM25 索引 / 配置缓存     │
│  Cloudflare R2  — PDF 原文件 / 导出报告 (待启用)            │
├─────────────────────────────────────────────────────────────┤
│                     External Services                       │
│  DashScope API  — Embedding (text-embedding-v4) + LLM Chat  │
│  VectorEngine   — LLM Chat (gpt-4.1) + 备选 Embedding      │
│  MinerU API     — PDF OCR 解析                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 路由文件划分策略

将 17 个页面的后端 API 按职责域拆分为 4 个路由文件，避免单文件膨胀：

| 路由文件 | 前缀 | 覆盖页面 | 职责 |
|---------|------|---------|------|
| `routes/rag.ts` (现有，扩展) | `/api/rag` | P.0, P.1, P.2, P.4 | 核心数据 CRUD + 问答 + 统计 |
| `routes/rag-enhance.ts` (新建) | `/api/rag/enhance` + `/api/rag/test-sets` + `/api/rag/evaluation` | P.3, P.5, P.6, P.7 | 质量增强 + 检索调试 + 评测 |
| `routes/rag-ops.ts` (新建) | `/api/rag/logs` + `/api/rag/settings` | P.8, P.9, P.10, P.11, P.12, P.13 | 运维日志 + 平台配置 |
| `routes/rag-knowledge.ts` (新建) | `/api/rag/knowledge` + `/api/rag/health` + `/api/rag/versions` | P.14, P.15, P.16 | 知识沉淀 + 健康检查 + 版本管理 |

### 2.3 路由注册 (api.ts 集成)

```typescript
// src/routes/api.ts — 新增 RAG 平台路由注册
import ragEnhance from './rag-enhance';
import ragOps from './rag-ops';
import ragKnowledge from './rag-knowledge';

// 现有 rag 路由已注册：api.route('/rag', rag);
api.route('/rag/enhance', ragEnhance);
api.route('/rag', ragOps);       // /api/rag/logs/*, /api/rag/settings/*
api.route('/rag', ragKnowledge); // /api/rag/knowledge/*, /api/rag/health/*, /api/rag/versions/*
```

---

## 三、数据库 Schema 设计

### 3.1 迁移文件规划

基于 17 个页面的需求，规划以下 D1 数据库迁移：

| 迁移文件 | 新增/修改表 | 关联页面 |
|---------|-----------|---------|
| `0020_rag_chunks_enhance.sql` | 修改 `rag_chunks` (增 summary/entities 字段) + 新增 `rag_chunk_questions` | P.2, P.3 |
| `0021_rag_bm25_index.sql` | `rag_bm25_tokens` | P.4, P.5 |
| `0022_rag_pipeline_logs.sql` | `rag_pipeline_tasks` + `rag_pipeline_steps` + `rag_message_logs` | P.8, P.9, P.10 |
| `0023_rag_test_evaluation.sql` | `rag_test_sets` + `rag_test_questions` + `rag_test_question_variants` + `rag_evaluations` + `rag_evaluation_results` | P.6, P.7 |
| `0024_rag_platform_config.sql` | `rag_model_configs` + `rag_prompt_templates` + `rag_prompt_versions` + `rag_system_configs` | P.11, P.12, P.13 |
| `0025_rag_knowledge_settle.sql` | `rag_conversation_knowledge` + `rag_settled_knowledge` | P.14 |
| `0026_rag_health_check.sql` | `rag_health_reports` + `rag_health_issues` | P.15 |
| `0027_rag_version_mgmt.sql` | `rag_kb_versions` + `rag_kb_version_chunks` + `rag_version_benchmarks` + `rag_regression_tests` | P.16 |

### 3.2 详细 Schema 设计

#### 3.2.1 现有表扩展 — `rag_chunks` 增加字段

```sql
-- 0020_rag_chunks_enhance.sql

ALTER TABLE rag_chunks ADD COLUMN summary TEXT;                    -- LLM 生成的摘要
ALTER TABLE rag_chunks ADD COLUMN entities TEXT DEFAULT '[]';      -- 自动标注的实体 JSON
ALTER TABLE rag_chunks ADD COLUMN keywords TEXT DEFAULT '[]';      -- 自动提取的关键词 JSON
ALTER TABLE rag_chunks ADD COLUMN chunk_type TEXT DEFAULT 'text';  -- text/table/image
ALTER TABLE rag_chunks ADD COLUMN page_range TEXT;                 -- 页码范围 "12-13"
ALTER TABLE rag_chunks ADD COLUMN question_count INTEGER DEFAULT 0; -- 已生成的问题数

-- Chunk 关联的假设性问题 (HyDE)
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

#### 3.2.2 BM25 倒排索引

```sql
-- 0021_rag_bm25_index.sql

-- BM25 Token 倒排索引（D1 实现的简化 BM25）
CREATE TABLE IF NOT EXISTS rag_bm25_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,                         -- 分词后的 token
    chunk_id INTEGER NOT NULL,                   -- 关联 Chunk ID
    document_id INTEGER NOT NULL,                -- 关联文档 ID
    frequency INTEGER DEFAULT 1,                 -- 词频 (TF)
    source TEXT DEFAULT 'content',               -- content 或 question
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bm25_token ON rag_bm25_tokens(token);
CREATE INDEX IF NOT EXISTS idx_bm25_chunk ON rag_bm25_tokens(chunk_id);
CREATE INDEX IF NOT EXISTS idx_bm25_doc ON rag_bm25_tokens(document_id);
CREATE INDEX IF NOT EXISTS idx_bm25_source ON rag_bm25_tokens(source);

-- BM25 索引元数据
CREATE TABLE IF NOT EXISTS rag_bm25_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,                         -- NULL 表示全局
    source TEXT NOT NULL,                        -- 'content' 或 'question'
    total_docs INTEGER DEFAULT 0,
    avg_doc_length REAL DEFAULT 0,
    last_built DATETIME DEFAULT (datetime('now'))
);
```

#### 3.2.3 Pipeline 与日志

```sql
-- 0022_rag_pipeline_logs.sql

-- Pipeline 任务
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

-- 问答消息详细日志（扩展 rag_conversations）
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

#### 3.2.4 测试集与评测

```sql
-- 0023_rag_test_evaluation.sql

-- 测试集
CREATE TABLE IF NOT EXISTS rag_test_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    document_ids TEXT DEFAULT '[]',        -- 覆盖的文档 ID 列表
    question_count INTEGER DEFAULT 0,
    last_eval_score REAL,
    last_eval_at DATETIME,
    created_by INTEGER,                    -- user_id
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- 测试题目
CREATE TABLE IF NOT EXISTS rag_test_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_set_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT DEFAULT 'factual',   -- factual/name/boolean/comparative/open/number
    expected_answer TEXT NOT NULL,
    reference_pages TEXT DEFAULT '[]',      -- 参考页码
    difficulty TEXT DEFAULT 'medium',       -- easy/medium/hard
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_test_q_set ON rag_test_questions(test_set_id);

-- 测试题扩写变体
CREATE TABLE IF NOT EXISTS rag_test_question_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    variant_text TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_test_var_q ON rag_test_question_variants(question_id);

-- 评测任务
CREATE TABLE IF NOT EXISTS rag_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    test_set_id INTEGER NOT NULL,
    config_json TEXT NOT NULL,              -- RAG 参数配置 JSON
    status TEXT DEFAULT 'pending',          -- pending/running/completed/failed
    total_questions INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,
    
    -- 总分
    overall_score REAL,
    exact_match_score REAL,
    semantic_score REAL,
    recall_score REAL,
    citation_score REAL,
    
    -- 按类型/难度分组分数
    scores_by_type TEXT DEFAULT '{}',
    scores_by_difficulty TEXT DEFAULT '{}',
    
    started_at DATETIME,
    completed_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_set ON rag_evaluations(test_set_id);

-- 评测逐题结果
CREATE TABLE IF NOT EXISTS rag_evaluation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    expected_answer TEXT,
    model_answer TEXT,
    score REAL,
    is_correct INTEGER DEFAULT 0,
    scoring_reason TEXT,
    retrieval_results TEXT DEFAULT '[]',    -- 检索结果 JSON
    latency_ms INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_result_eval ON rag_evaluation_results(evaluation_id);
```

#### 3.2.5 平台配置

```sql
-- 0024_rag_platform_config.sql

-- 模型配置
CREATE TABLE IF NOT EXISTS rag_model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usage TEXT NOT NULL UNIQUE,             -- 'embedding'/'rag_chat'/'rerank'/'intent'/'question_gen'/'eval_scoring'
    provider TEXT NOT NULL,                 -- 'dashscope'/'vectorengine'/'openai'
    model_name TEXT NOT NULL,
    api_key_ref TEXT,                       -- 环境变量名引用
    base_url TEXT,
    extra_config TEXT DEFAULT '{}',         -- 额外配置 (dimensions, temperature 等)
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- Prompt 模板
CREATE TABLE IF NOT EXISTS rag_prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_key TEXT NOT NULL UNIQUE,       -- 'RAG_QA'/'INTENT_CLASSIFY'/'QUERY_REWRITE'/...
    display_name TEXT NOT NULL,
    description TEXT,
    usage_context TEXT,                      -- 使用场景说明
    variables TEXT DEFAULT '[]',             -- 模板变量列表
    current_version_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- Prompt 版本历史
CREATE TABLE IF NOT EXISTS rag_prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version_label TEXT NOT NULL,             -- 'v1.0', 'v2.1' 等
    content TEXT NOT NULL,                   -- Prompt 文本内容
    change_note TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_ver_template ON rag_prompt_versions(template_id);

-- 系统全局配置
CREATE TABLE IF NOT EXISTS rag_system_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT (datetime('now'))
);
```

#### 3.2.6 对话知识沉淀

```sql
-- 0025_rag_knowledge_settle.sql

-- 从对话提取的知识点
CREATE TABLE IF NOT EXISTS rag_conversation_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,                          -- 来源对话 Session
    knowledge_type TEXT NOT NULL,             -- 'fact'/'process'/'caution'/'demand'/'question'
    content TEXT NOT NULL,                    -- 知识内容
    confidence REAL DEFAULT 0,               -- 置信度 0-1
    source TEXT DEFAULT 'ai_answer',         -- 'user_stated'/'ai_answer'/'dialogue'
    keywords TEXT DEFAULT '[]',              -- 关键词 JSON
    category TEXT,                            -- 分类标签
    frequency INTEGER DEFAULT 1,             -- 出现频率
    is_filtered INTEGER DEFAULT 0,           -- 是否被自动过滤 (需求/问题类型)
    review_status TEXT DEFAULT 'pending',    -- pending/accepted/rejected
    settled_knowledge_id INTEGER,            -- 合并后沉淀到的知识 ID
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conv_know_type ON rag_conversation_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_conv_know_review ON rag_conversation_knowledge(review_status);
CREATE INDEX IF NOT EXISTS idx_conv_know_session ON rag_conversation_knowledge(session_id);

-- 合并审核后的沉淀知识
CREATE TABLE IF NOT EXISTS rag_settled_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    knowledge_type TEXT NOT NULL,
    content TEXT NOT NULL,                    -- 合并后的知识内容
    confidence REAL DEFAULT 0,
    frequency INTEGER DEFAULT 0,             -- 累计频率
    keywords TEXT DEFAULT '[]',
    category TEXT,
    source_count INTEGER DEFAULT 0,          -- 合并前知识点数
    review_status TEXT DEFAULT 'pending',    -- pending/approved/rejected/applied
    applied_chunk_id INTEGER,                -- 应用到知识库后的 Chunk ID
    applied_at DATETIME,
    reviewed_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_settled_review ON rag_settled_knowledge(review_status);
```

#### 3.2.7 知识库健康度检查

```sql
-- 0026_rag_health_check.sql

-- 健康度检查报告
CREATE TABLE IF NOT EXISTS rag_health_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 总分
    overall_score REAL,
    health_level TEXT,                       -- 'excellent'/'good'/'fair'/'poor'
    
    -- 三维分数
    coverage_score REAL,
    freshness_score REAL,
    consistency_score REAL,
    
    -- 问题统计
    missing_count INTEGER DEFAULT 0,
    outdated_count INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    
    -- 详细数据
    coverage_detail TEXT DEFAULT '{}',        -- 覆盖率分析 JSON
    freshness_detail TEXT DEFAULT '{}',       -- 新鲜度分析 JSON
    consistency_detail TEXT DEFAULT '{}',     -- 一致性分析 JSON
    recommendations TEXT DEFAULT '[]',       -- 改进建议 JSON
    
    -- 配置
    config_json TEXT DEFAULT '{}',            -- 检查配置 (文档范围、测试集等)
    test_set_id INTEGER,
    duration_ms INTEGER,
    
    created_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
);

-- 健康度问题明细
CREATE TABLE IF NOT EXISTS rag_health_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    issue_type TEXT NOT NULL,                 -- 'missing'/'outdated'/'conflict'
    severity TEXT DEFAULT 'medium',           -- 'high'/'medium'/'low'
    description TEXT NOT NULL,
    affected_chunks TEXT DEFAULT '[]',        -- 受影响的 Chunk ID 列表
    suggestion TEXT,
    fix_status TEXT DEFAULT 'open',           -- 'open'/'in_progress'/'fixed'/'ignored'
    fixed_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_issue_report ON rag_health_issues(report_id);
CREATE INDEX IF NOT EXISTS idx_health_issue_status ON rag_health_issues(fix_status);
```

#### 3.2.8 知识库版本管理

```sql
-- 0027_rag_version_mgmt.sql

-- 知识库版本
CREATE TABLE IF NOT EXISTS rag_kb_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_name TEXT NOT NULL,                -- 'v1.0', 'v2.1' 等
    description TEXT,
    is_current INTEGER DEFAULT 0,             -- 是否为当前激活版本
    
    -- 统计信息
    total_chunks INTEGER DEFAULT 0,
    total_content_length INTEGER DEFAULT 0,
    avg_chunk_length REAL DEFAULT 0,
    document_count INTEGER DEFAULT 0,
    
    -- 评测
    eval_score REAL,                          -- 关联的评测得分
    eval_test_set_id INTEGER,
    
    -- Embedding 配置快照
    embedding_provider TEXT,
    embedding_model TEXT,
    embedding_dimensions INTEGER,
    
    created_by INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
);

-- 版本 Chunk 快照（记录每个版本包含的 Chunk）
CREATE TABLE IF NOT EXISTS rag_kb_version_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    chunk_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    content_hash TEXT NOT NULL,                -- 内容 MD5 哈希 (用于 Diff)
    content_snapshot TEXT,                     -- 可选: 内容快照 (用于回滚)
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ver_chunk_ver ON rag_kb_version_chunks(version_id);
CREATE INDEX IF NOT EXISTS idx_ver_chunk_hash ON rag_kb_version_chunks(content_hash);

-- 版本性能评测结果
CREATE TABLE IF NOT EXISTS rag_version_benchmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    test_set_id INTEGER NOT NULL,
    accuracy REAL,
    avg_response_time_ms REAL,
    total_queries INTEGER,
    correct_queries INTEGER,
    results_detail TEXT DEFAULT '[]',          -- 逐题结果 JSON
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ver_bench_ver ON rag_version_benchmarks(version_id);

-- 回归测试记录
CREATE TABLE IF NOT EXISTS rag_regression_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    test_set_id INTEGER NOT NULL,
    pass_rate REAL,
    total_tests INTEGER,
    passed_tests INTEGER,
    failed_tests INTEGER,
    failed_details TEXT DEFAULT '[]',          -- 失败题目明细 JSON
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reg_test_ver ON rag_regression_tests(version_id);
```

---

## 四、Service 层详细设计

### 4.1 BM25 检索服务 — `services/ragBm25.ts`

```
核心功能:
├── buildBm25Index(documentId)        // 对指定文档的 Chunks 构建 BM25 索引
├── buildGlobalIndex()                // 全局重建索引
├── searchBm25(query, options)        // BM25 关键词检索
├── tokenize(text)                    // 中文分词 (简化版 jieba)
└── calculateBm25Score(query, doc)    // BM25Okapi 分数计算

实现要点:
- 分词: 在 Workers 环境无法用 jieba，采用以下策略:
  方案A: 使用 Intl.Segmenter (浏览器原生分词，Workers 已支持)
  方案B: 基于字典的简单分词 + 正则切分
  方案C: 调用外部分词 API (DashScope NLP)
- BM25 参数: k1=1.5, b=0.75 (经典默认值)
- 索引存储: D1 表 rag_bm25_tokens (倒排索引)
- 查询时: SQL 查询匹配 token → 计算 TF-IDF → BM25 排序
```

### 4.2 Pipeline 编排服务 — `services/ragPipeline.ts`

```
核心功能:
├── createPipeline(taskType, documentId)    // 创建 Pipeline 任务
├── executePipeline(taskId)                 // 执行 Pipeline (含步骤日志)
├── updateStep(taskId, stepName, result)    // 更新步骤状态
├── getPipelineStatus(taskId)               // 获取 Pipeline 进度
└── retryPipeline(taskId)                   // 重试失败的 Pipeline

Pipeline 类型:
- ingest: PDF解析 → 文本分块 → Embedding → BM25索引 → 质量检查
- enhance: 问题生成 → 摘要生成 → 实体标注 → 问题Embedding
- reindex: 重新分块 → 重新Embedding → 重建BM25
- health_check: 覆盖率检查 → 新鲜度检查 → 一致性检查 → 评分

实现要点:
- 每步记录 started_at / completed_at / duration_ms / status
- 失败步骤可单步重试
- 进度通过 KV 实时更新，前端轮询
```

### 4.3 增强质量服务 — `services/ragEnhance.ts`

```
核心功能:
├── generateQuestionsForChunk(chunkId, count)     // HyDE 问题生成
├── generateQuestionsForDocument(docId, config)    // 批量问题生成
├── generateSummary(chunkId)                       // 摘要增强
├── extractEntities(chunkId)                       // 实体标注
├── trialRun(docId, config)                        // 试运行 (3个Chunk)
└── getEnhanceStatus(docId)                        // 增强状态查询

Python → TypeScript 移植要点:
- generate_questions_for_chunk() → generateQuestionsForChunk()
  Prompt 模板移植，保留 "5种问题类型" 约束
  JSON 响应解析复用现有 jsonParser.ts
- generate_diverse_questions() → 用于测试集生成 (P.6)
  增加 "角度 + 可回答性 + 参考答案" 字段
```

### 4.4 知识沉淀服务 — `services/ragKnowledge.ts`

```
核心功能:
├── extractFromConversation(sessionId)          // 单次对话知识提取
├── batchExtract(config)                        // 批量提取
├── filterKnowledge(knowledgeList)              // 自动类型过滤
├── mergeKnowledge(knowledgeGroup)              // LLM 智能合并
├── reviewKnowledge(id, action)                 // 人工审核 (accept/reject)
├── applyToKnowledgeBase(settledId)             // 应用到知识库
└── getKnowledgeStats()                         // 统计数据

移植要点 (from ConversationKnowledgeExtractor):
- extract_knowledge_from_conversation → extractFromConversation
  5类知识: fact/demand/question/process/caution
  置信度 0-1 + 来源标注 + 关键词提取
- batch_extract_knowledge → batchExtract
  频率统计 (Counter → Map)
- merge_similar_knowledge → mergeKnowledge
  过滤 demand/question 类型 → 按类型分组 → LLM 合并
- merge_knowledge_with_llm → 内部方法
  Prompt: 合并多个知识点为一条更完整准确的知识
  Temperature: 0.3 (分析任务)
```

### 4.5 健康检查服务 — `services/ragHealth.ts`

```
核心功能:
├── runHealthCheck(config)                      // 执行完整健康检查
├── checkCoverage(testQueries, knowledge)       // 覆盖率检查 (LLM)
├── checkFreshness(knowledge)                   // 新鲜度检查 (LLM)
├── checkConsistency(knowledge)                 // 一致性检查 (LLM)
├── calculateOverallScore(coverage, freshness, consistency)  // 加权综合评分
├── generateRecommendations(results)            // 生成改进建议
├── getHealthHistory()                          // 历史报告列表
└── trackIssue(issueId, action)                 // 问题跟踪

移植要点 (from KnowledgeBaseHealthChecker):
- 三维健康模型: 覆盖率 40% + 新鲜度 30% + 一致性 30%
- 四级评分: excellent(80-100) / good(60-79) / fair(40-59) / poor(0-39)
- check_missing_knowledge → checkCoverage
  LLM Prompt: 分析测试查询是否能被知识库回答
- check_outdated_knowledge → checkFreshness
  LLM Prompt: 检查内容中的时间/价格/政策信息是否过期
- check_conflicting_knowledge → checkConsistency
  LLM Prompt: 检测同主题不同数据的矛盾
```

### 4.6 版本管理服务 — `services/ragVersion.ts`

```
核心功能:
├── createVersion(name, description)             // 创建版本快照
├── listVersions()                              // 版本列表 (时间线)
├── getVersion(versionId)                       // 版本详情
├── compareVersions(v1Id, v2Id)                 // 版本 Diff 对比
├── evaluateVersion(versionId, testSetId)       // 版本性能评测
├── comparePerformance(v1Id, v2Id, testSetId)   // 性能 A/B 对比
├── runRegressionTest(versionId, testSetId)     // 回归测试
├── rollbackToVersion(versionId)                // 回滚到指定版本
└── setCurrentVersion(versionId)                // 设为当前版本

移植要点 (from KnowledgeBaseVersionManager):
- create_version → createVersion
  快照所有 Chunk 的 content_hash + metadata
  记录 Embedding 配置快照
  计算统计信息 (total_chunks, avg_length 等)
  
- compare_versions → compareVersions
  基于 content_hash 做集合运算:
  added   = v2_hashes - v1_hashes
  removed = v1_hashes - v2_hashes
  modified = 同 chunk_id 但 hash 不同
  unchanged = 同 chunk_id 且 hash 相同
  
- evaluate_version_performance → evaluateVersion
  对版本的向量索引运行测试集
  Python 用 FAISS → TS 用现有 searchSimilar()
  统计: accuracy, avg_response_time, per_query_results
  
- compare_version_performance → comparePerformance
  分别运行两版本评测 → 比较 accuracy_improvement + time_change
  生成推荐建议 (accuracy 提升且 time 不显著增加 → 推荐新版本)
  
- generate_regression_test → runRegressionTest
  运行测试集全部查询 → 输出 pass/fail 列表 + pass_rate
```

### 4.7 意图识别服务 — `services/ragIntent.ts`

```
核心功能:
├── classifyIntent(query)                       // 意图分类
├── rewriteQuery(query, intent)                 // Query 改写
├── splitComparativeQuery(query)                // 比较题拆分
└── extractEntities(query)                      // 实体提取

意图类型: number / name / boolean / comparative / open / string
实现: LLM 单次调用，返回 JSON {type, confidence, entities, rewritten_query}
Temperature: 0.1 (高确定性任务)
```

### 4.8 配置管理服务 — `services/ragConfig.ts`

```
核心功能:
├── getModelConfig(usage)                       // 获取模型配置
├── updateModelConfig(usage, config)            // 更新模型配置
├── testConnection(provider, apiKey)            // 测试 API 连接
├── getPromptTemplate(key)                      // 获取 Prompt 模板
├── updatePromptTemplate(key, content)          // 更新 Prompt (创建新版本)
├── getPromptVersions(key)                      // 获取版本历史
├── getSystemConfig(key)                        // 获取系统配置
└── setSystemConfig(key, value)                 // 设置系统配置
```

---

## 五、API 路由详细设计

### 5.1 现有路由扩展 — `routes/rag.ts`

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|-------|
| `GET` | `/stats/dashboard` | 仪表盘聚合数据 (P.0) | P1 |
| `POST` | `/upload/pdf` | PDF 文件上传 + MinerU 解析 (P.1) | P0 |
| `GET` | `/upload/preview` | 切片预览 (P.1) | P0 |
| `GET` | `/chunks` | Chunk 列表 (分页/筛选) (P.2) | P0 |
| `GET` | `/chunks/:id` | Chunk 详情 (P.2) | P0 |
| `PUT` | `/chunks/:id` | Chunk 编辑 + 重新向量化 (P.2) | P0 |
| `DELETE` | `/chunks/:id` | 删除 Chunk (P.2) | P0 |
| `POST` | `/chunks/:id/similar` | 以 Chunk 为 Query 的相似搜索 (P.2) | P1 |
| `POST` | `/query/enhanced` | 增强版问答 (混合检索+重排) (P.4) | P0 |

### 5.2 增强与评测路由 — `routes/rag-enhance.ts`

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|-------|
| `POST` | `/enhance/questions/trial` | 问题生成试运行 (P.3) | P2 |
| `POST` | `/enhance/questions/batch` | 批量问题生成 (P.3) | P2 |
| `POST` | `/enhance/summary/batch` | 批量摘要生成 (P.3) | P2 |
| `POST` | `/enhance/entities/batch` | 批量实体标注 (P.3) | P2 |
| `GET` | `/enhance/status/:docId` | 增强状态查询 (P.3) | P2 |
| `POST` | `/retrieval-debug` | 多策略并行检索对比 (P.5) | P2 |
| `POST` | `/test-sets` | 创建测试集 (P.6) | P1 |
| `GET` | `/test-sets` | 测试集列表 (P.6) | P1 |
| `GET` | `/test-sets/:id` | 测试集详情 (P.6) | P1 |
| `PUT` | `/test-sets/:id` | 更新测试集 (P.6) | P1 |
| `DELETE` | `/test-sets/:id` | 删除测试集 (P.6) | P1 |
| `POST` | `/test-sets/:id/generate` | LLM 自动生成题目 (P.6) | P1 |
| `POST` | `/test-sets/:id/expand` | LLM 问题扩写 (P.6) | P1 |
| `POST` | `/evaluation/run` | 运行评测任务 (P.7) | P1 |
| `GET` | `/evaluation/:id` | 评测结果详情 (P.7) | P1 |
| `GET` | `/evaluation/history/:testSetId` | 评测历史列表 (P.7) | P1 |

### 5.3 运维配置路由 — `routes/rag-ops.ts`

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|-------|
| `GET` | `/logs/chat` | 对话日志列表 (分页/筛选) (P.8) | P1 |
| `GET` | `/logs/chat/:id` | 对话日志详情 (Pipeline 步骤) (P.8) | P1 |
| `GET` | `/logs/intent` | 意图识别日志列表 (P.9) | P2 |
| `GET` | `/logs/intent/stats` | 意图类型分布统计 (P.9) | P2 |
| `GET` | `/logs/pipeline` | Pipeline 任务列表 (P.10) | P3 |
| `GET` | `/logs/pipeline/:id` | Pipeline 详情 + 步骤日志 (P.10) | P3 |
| `POST` | `/logs/pipeline/:id/retry` | 重试 Pipeline (P.10) | P3 |
| `GET` | `/settings/models` | 模型配置列表 (P.11) | P3 |
| `PUT` | `/settings/models/:usage` | 更新模型配置 (P.11) | P3 |
| `POST` | `/settings/models/test` | 测试 API 连接 (P.11) | P3 |
| `GET` | `/settings/prompts` | Prompt 模板列表 (P.12) | P3 |
| `GET` | `/settings/prompts/:key` | Prompt 模板详情 + 版本历史 (P.12) | P3 |
| `PUT` | `/settings/prompts/:key` | 更新 Prompt (创建新版本) (P.12) | P3 |
| `GET` | `/settings/system` | 系统配置列表 (P.13) | P3 |
| `PUT` | `/settings/system` | 批量更新系统配置 (P.13) | P3 |

### 5.4 知识沉淀与版本管理路由 — `routes/rag-knowledge.ts`

| 方法 | 路径 | 说明 | 优先级 |
|------|------|------|-------|
| `POST` | `/knowledge/extract` | 单次对话知识提取 (P.14) | P2 |
| `POST` | `/knowledge/batch-extract` | 批量知识提取 (P.14) | P2 |
| `POST` | `/knowledge/merge` | LLM 知识合并 (P.14) | P2 |
| `POST` | `/knowledge/:id/review` | 知识审核 (accept/reject) (P.14) | P2 |
| `POST` | `/knowledge/:id/apply` | 应用到知识库 (P.14) | P2 |
| `GET` | `/knowledge/stats` | 知识沉淀统计 (P.14) | P2 |
| `GET` | `/knowledge/settled` | 已沉淀知识列表 (P.14) | P2 |
| `POST` | `/health/run` | 执行健康度检查 (P.15) | P2 |
| `GET` | `/health/reports` | 健康报告列表 (P.15) | P2 |
| `GET` | `/health/reports/:id` | 健康报告详情 (P.15) | P2 |
| `POST` | `/health/issues/:id/fix` | 标记问题已修复 (P.15) | P2 |
| `POST` | `/versions` | 创建版本快照 (P.16) | P2 |
| `GET` | `/versions` | 版本列表 (时间线) (P.16) | P2 |
| `GET` | `/versions/:id` | 版本详情 (P.16) | P2 |
| `POST` | `/versions/compare` | 版本 Diff 对比 (P.16) | P2 |
| `POST` | `/versions/:id/evaluate` | 版本性能评测 (P.16) | P2 |
| `POST` | `/versions/compare-performance` | 性能 A/B 对比 (P.16) | P2 |
| `POST` | `/versions/:id/regression-test` | 回归测试 (P.16) | P2 |
| `POST` | `/versions/:id/rollback` | 回滚到指定版本 (P.16) | P2 |

---

## 六、关键技术方案

### 6.1 BM25 在 D1 中的实现方案

Cloudflare Workers 环境无法使用 rank_bm25 Python 库，需要基于 D1 自行实现：

```typescript
// BM25Okapi 计算公式
// score(q, D) = sum_over_terms( IDF(t) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl)) )

class D1Bm25Service {
  // 1. 分词: 使用 Intl.Segmenter (Workers 原生支持)
  tokenize(text: string): string[] {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    const segments = segmenter.segment(text);
    return Array.from(segments)
      .filter(s => s.isWordLike && s.segment.length > 1)
      .filter(s => !STOP_WORDS.has(s.segment))
      .map(s => s.segment);
  }

  // 2. 构建索引: 对每个 Chunk 分词，写入 rag_bm25_tokens
  async buildIndex(documentId: number) {
    const chunks = await this.db.prepare(
      'SELECT id, content FROM rag_chunks WHERE document_id = ?'
    ).bind(documentId).all();
    
    for (const chunk of chunks.results) {
      const tokens = this.tokenize(chunk.content);
      const freq = new Map<string, number>();
      for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
      
      for (const [token, count] of freq) {
        await this.db.prepare(
          'INSERT INTO rag_bm25_tokens (token, chunk_id, document_id, frequency) VALUES (?, ?, ?, ?)'
        ).bind(token, chunk.id, documentId, count).run();
      }
    }
  }

  // 3. 查询: SQL + 应用层 BM25 计算
  async search(query: string, topK: number = 10): Promise<ChunkWithScore[]> {
    const queryTokens = this.tokenize(query);
    // SQL 查询匹配的 chunks + 词频
    // 应用层计算 BM25 分数
    // 排序返回 Top-K
  }
}
```

### 6.2 混合检索 + LLM 重排

```typescript
// 增强版 RAG 问答 Pipeline
async enhancedRagQuery(question: string, config: RAGConfig): Promise<RAGResult> {
  const log = createMessageLog(question);
  
  // Step 1: 意图识别 + Query 改写
  const intent = await ragIntent.classifyIntent(question);
  log.intent = intent;
  
  const query = intent.rewrittenQuery || question;
  
  // Step 2: 并行执行向量检索和 BM25 检索
  const [vectorResults, bm25Results] = await Promise.all([
    ragService.searchSimilar(query, { topK: config.topK }),
    ragBm25.search(query, config.topK),
  ]);
  log.vectorResults = vectorResults;
  log.bm25Results = bm25Results;
  
  // Step 3: 去重合并
  const merged = deduplicateResults(vectorResults, bm25Results);
  
  // Step 4: LLM 重排 (可选)
  let ranked = merged;
  if (config.enableRerank) {
    ranked = await llmRerank(merged, question, config.rerankWeight);
    log.rerankResults = ranked;
  }
  
  // Step 5: LLM 生成回答
  const answer = await generateAnswer(question, ranked.slice(0, config.topK));
  log.answer = answer;
  
  // Step 6: 保存日志
  await saveMessageLog(log);
  
  return { answer, sources: ranked, log };
}
```

### 6.3 PDF 解析集成 (MinerU API)

```typescript
// PDF 上传 → MinerU 异步解析 → 轮询结果 → 文本提取
async processPdf(file: File): Promise<{ text: string; pages: PageInfo[] }> {
  // 1. 上传 PDF 到 R2
  const key = `pdf/${Date.now()}-${file.name}`;
  await this.r2.put(key, file.stream());
  
  // 2. 调用 MinerU API 启动解析任务
  const task = await fetch('https://mineru-api.opendatalab.com/api/v1/extract', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${this.mineruApiKey}` },
    body: JSON.stringify({ file_url: r2PublicUrl(key), extract_type: 'text+table' }),
  });
  
  // 3. 轮询任务状态 (或 Pipeline 步骤中轮询)
  // 4. 提取文本和表格数据
}
```

### 6.4 进度推送方案

由于 Cloudflare Workers 不支持 WebSocket (Pages Functions)，采用以下方案：

```
方案: KV 轮询 (与现有分析报告进度一致)

前端 → 定时 GET /api/rag/pipeline/status/:taskId
后端 → 从 KV 读取 pipeline:{taskId} 的最新进度 JSON
        { step: 'embedding', progress: 65, total: 127, currentChunk: 83 }

每步完成时 → KV.put(`pipeline:${taskId}`, progressJSON)
```

### 6.5 Cloudflare Workers 限制应对策略

| 限制 | 影响 | 应对策略 |
|------|------|---------|
| CPU 时间 50ms (免费) / 30s (Paid) | 批量操作可能超时 | 使用 `waitUntil()` 后台执行 + 分批处理 |
| D1 单次查询 5MB 返回 | 大文档 Chunk 列表 | 分页查询 |
| KV 单值 25MB | 大向量存储 | 单 Chunk 向量 ~4KB，无问题 |
| 请求体 100MB (Paid) | PDF 上传 | 限制 50MB |
| 无原生定时任务 | 定时健康检查 | 使用 Cloudflare Cron Triggers (wrangler.toml 配置) |

---

## 七、开发计划与排期

### 7.1 阶段划分

```
Phase 1: 核心数据层 (Week 1-3)     ← 当前阶段
Phase 2: 运维评测层 (Week 4-6)
Phase 3: 智能增强层 (Week 7-9)
Phase 4: 版本管理层 (Week 10-12)
```

### 7.2 详细排期

#### Phase 1: 核心数据层 (Week 1-3, P0)

**目标**: 完成文档上传增强 + Chunk 级操作 + 增强版问答 + 混合检索

| 周 | 任务 | 文件 | 交付物 |
|----|------|------|--------|
| **W1** | DB 迁移 0020-0022 | migrations/ | 表结构 ready |
| **W1** | Chunk CRUD API | routes/rag.ts, services/rag.ts | P.2 后端完成 |
| **W1** | BM25 服务 (分词+索引+检索) | services/ragBm25.ts | BM25 检索可用 |
| **W2** | 混合检索 + LLM 重排 Pipeline | services/ragPipeline.ts | P.4 增强问答 |
| **W2** | 意图识别 + Query 改写 | services/ragIntent.ts | 意图日志可记录 |
| **W2** | 消息详细日志存储 | services/ragPipeline.ts | P.8 数据源 ready |
| **W3** | PDF 上传 + MinerU 集成 | routes/rag.ts, services/rag.ts | P.1 PDF 上传 |
| **W3** | 切片预览 API | routes/rag.ts | P.1 预览功能 |
| **W3** | 仪表盘聚合统计 API | routes/rag.ts | P.0 数据源 |

**Phase 1 交付验收标准**:
- [x] PDF 文件可上传并自动解析、分块、向量化
- [x] Chunk 可浏览、编辑、删除、搜索
- [x] 问答支持混合检索 (向量 + BM25) + 可选 LLM 重排
- [x] 每次问答自动记录完整 Pipeline 日志
- [x] 仪表盘可展示基础 KPI

#### Phase 2: 运维评测层 (Week 4-6, P1)

**目标**: 完成测试集管理 + 批量评测 + 对话日志 + 基础配置

| 周 | 任务 | 文件 | 交付物 |
|----|------|------|--------|
| **W4** | DB 迁移 0023-0024 | migrations/ | 测试集+配置表 |
| **W4** | 测试集 CRUD + LLM 题目生成 | services/ragTestSet.ts, routes/rag-enhance.ts | P.6 后端完成 |
| **W4** | 问题扩写 API | services/ragTestSet.ts | P.6 扩写功能 |
| **W5** | 评测任务执行引擎 | services/ragTestSet.ts | P.7 核心引擎 |
| **W5** | 多维度打分 (精确匹配+LLM语义+Recall+引用) | services/ragTestSet.ts | P.7 打分完成 |
| **W5** | 评测历史对比 API | routes/rag-enhance.ts | P.7 历史图表 |
| **W6** | 对话日志查询 + Pipeline 详情 | routes/rag-ops.ts | P.8 后端完成 |
| **W6** | 意图识别日志 + 统计 | routes/rag-ops.ts | P.9 后端完成 |
| **W6** | 模型/Prompt/系统配置 CRUD | services/ragConfig.ts, routes/rag-ops.ts | P.11/12/13 基础 |

**Phase 2 交付验收标准**:
- [x] 可创建测试集 (手动/LLM生成/CSV导入)
- [x] 可运行批量评测并获取多维度分数
- [x] 对话日志可搜索、筛选、查看 Pipeline 步骤
- [x] 模型和 Prompt 可在线配置

#### Phase 3: 智能增强层 (Week 7-9, P2)

**目标**: 完成 Chunk 质量增强 + 对话知识沉淀 + 健康度检查

| 周 | 任务 | 文件 | 交付物 |
|----|------|------|--------|
| **W7** | DB 迁移 0025-0026 | migrations/ | 知识沉淀+健康检查表 |
| **W7** | HyDE 问题生成 (试运行+批量) | services/ragEnhance.ts | P.3 问题改写 |
| **W7** | 摘要增强 + 实体标注 | services/ragEnhance.ts | P.3 完成 |
| **W8** | 检索调试台 (多策略并行对比) | routes/rag-enhance.ts | P.5 后端完成 |
| **W8** | 对话知识提取 + 批量提取 | services/ragKnowledge.ts | P.14 提取功能 |
| **W8** | 知识过滤 + LLM 合并 | services/ragKnowledge.ts | P.14 合并功能 |
| **W9** | 审核工作流 + 应用到知识库 | routes/rag-knowledge.ts | P.14 完成 |
| **W9** | 三维健康检查引擎 | services/ragHealth.ts | P.15 检查引擎 |
| **W9** | 健康报告 + 问题追踪 + 改进建议 | routes/rag-knowledge.ts | P.15 完成 |

**Phase 3 交付验收标准**:
- [x] Chunk 可批量生成假设性问题并建立向量索引
- [x] 检索调试台可并行对比向量/BM25/混合三种策略
- [x] 对话日志可自动提取知识 → 过滤 → 合并 → 审核 → 入库
- [x] 知识库可运行三维健康检查并生成结构化报告

#### Phase 4: 版本管理层 (Week 10-12, P2-P3)

**目标**: 完成版本管理 + Pipeline 追踪 + 高级配置

| 周 | 任务 | 文件 | 交付物 |
|----|------|------|--------|
| **W10** | DB 迁移 0027 | migrations/ | 版本管理表 |
| **W10** | 版本创建 (快照机制) | services/ragVersion.ts | 版本快照可创建 |
| **W10** | 版本 Diff 对比 | services/ragVersion.ts | P.16 Diff 功能 |
| **W11** | 版本性能评测 + A/B 对比 | services/ragVersion.ts | P.16 性能对比 |
| **W11** | 回归测试 + 版本回滚 | services/ragVersion.ts | P.16 完成 |
| **W11** | Pipeline 追踪完善 | routes/rag-ops.ts | P.10 完成 |
| **W12** | Prompt 版本管理完善 | services/ragConfig.ts | P.12 完善 |
| **W12** | Cron 定时任务 (健康检查) | wrangler.toml + handler | 定时健康检查 |
| **W12** | 集成测试 + 性能优化 + 文档 | 全局 | 平台交付 |

**Phase 4 交付验收标准**:
- [x] 知识库可创建版本快照并查看版本时间线
- [x] 两个版本可 Diff 对比，查看新增/删除/修改的 Chunk
- [x] 可运行性能 A/B 对比和回归测试
- [x] 可回滚到历史版本

---

## 八、开发规范与约定

### 8.1 文件命名规范

```
services/ragBm25.ts          — BM25 检索服务
services/ragPipeline.ts      — Pipeline 编排
services/ragEnhance.ts       — 质量增强
services/ragTestSet.ts       — 测试集与评测
services/ragKnowledge.ts     — 知识沉淀
services/ragHealth.ts        — 健康检查
services/ragVersion.ts       — 版本管理
services/ragIntent.ts        — 意图识别
services/ragConfig.ts        — 配置管理
```

### 8.2 API 响应格式统一

```typescript
// 成功
{ success: true, data: {...}, message?: string }

// 列表
{ success: true, data: [...], total: number, limit: number, offset: number }

// 失败
{ success: false, error: string, code?: string }

// 进度
{ success: true, taskId: number, status: 'running', progress: { step, percentage, detail } }
```

### 8.3 LLM 调用约定

| 任务类型 | Temperature | 示例场景 |
|---------|-------------|---------|
| 高确定性分析 | 0.1 | 意图识别、实体提取 |
| 结构化判断 | 0.3 | 健康检查、知识提取、评测打分 |
| 创意生成 | 0.7 | 问题生成、问题扩写 |

### 8.4 Prompt 管理约定

所有 LLM Prompt 初始硬编码在 Service 层（常量），Phase 2 后通过 P.12 Prompt 管理页面转为数据库存储，支持在线编辑和版本管理。

```typescript
// 过渡期: 硬编码 + 配置覆盖
const DEFAULT_PROMPTS = {
  RAG_QA: '你是一个专业的财报分析助手...',
  INTENT_CLASSIFY: '请分析用户问题的意图类型...',
  // ...
};

async function getPrompt(key: string, db?: D1Database): Promise<string> {
  // 优先从 DB 读取 (如果 P.12 已实现)
  if (db) {
    const custom = await db.prepare(
      'SELECT pv.content FROM rag_prompt_templates pt JOIN rag_prompt_versions pv ON pt.current_version_id = pv.id WHERE pt.template_key = ?'
    ).bind(key).first();
    if (custom) return custom.content as string;
  }
  // 回退到默认
  return DEFAULT_PROMPTS[key];
}
```

---

## 九、风险与依赖

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Workers CPU 30s 限制 | 批量操作 (问题生成/评测) 可能超时 | 使用 `waitUntil()` + 分批处理 + Pipeline 任务化 |
| D1 并发写入限制 | 批量索引构建可能遇到锁 | 批量 INSERT 分批 (每批 50 条) + 适当 delay |
| Intl.Segmenter 分词质量 | BM25 中文检索精度 | 预构建高频词典 + 回退到字符 N-gram |
| MinerU API 可用性 | PDF 解析依赖外部服务 | 支持纯文本提取回退 + 错误重试 |
| KV 存储大小 | 大量向量数据 | 监控 KV 使用量，必要时清理旧版本向量 |

### 9.2 外部依赖

| 依赖 | 用途 | 备选方案 |
|------|------|---------|
| DashScope API | Embedding + LLM | VectorEngine API |
| VectorEngine API | LLM Chat (gpt-4.1) | DashScope qwen-turbo |
| MinerU API | PDF OCR 解析 | 纯文本提取 (pdf.js 浏览器端) |
| Cloudflare D1 | 结构化数据存储 | 无 (核心依赖) |
| Cloudflare KV | 向量 + 缓存 | 无 (核心依赖) |
| Cloudflare R2 | 文件存储 | 外部 OSS (阿里云 OSS) |

---

## 十、总结

本方案基于对现有代码库 (`rag.ts` 服务 + `rag.ts` 路由 + `0019_rag_knowledge_base.sql` 迁移 + 4 份 Python 原型) 的深度分析，设计了完整的后端开发方案：

### 工作量概要

| 维度 | 数量 |
|------|------|
| 新增 Service 文件 | 8 个 |
| 新增 Route 文件 | 3 个 (1 个现有扩展) |
| 新增 DB Migration | 8 个 |
| 新增 D1 表 | 24 个 (3 个现有扩展) |
| 新增 API 端点 | 50+ 个 |
| 开发周期 | 12 周 (4 个 Phase) |

### 关键设计决策

1. **分层架构**: Route → Service → D1/KV/R2，各层职责清晰
2. **渐进式交付**: Phase 1 核心功能 → Phase 4 高级功能，每 Phase 可独立发布
3. **Python → TypeScript 移植**: 统一使用 OpenAI 兼容 API + 现有 jsonParser.ts + Intl.Segmenter 替代 jieba
4. **BM25 D1 实现**: 基于倒排索引表 + SQL 查询 + 应用层计算
5. **版本管理**: 基于 content_hash 的轻量快照机制，避免数据冗余
6. **配置化**: 从硬编码 → DB 存储，Prompt/模型/参数均可在线调整

### 下一步行动

1. **立即**: 创建 Phase 1 的 8 个 migration SQL 文件
2. **本周**: 实现 `services/ragBm25.ts` 核心 BM25 检索能力
3. **本周**: 扩展 `routes/rag.ts` 增加 Chunk CRUD API
4. **下周**: 实现混合检索 Pipeline + 意图识别
