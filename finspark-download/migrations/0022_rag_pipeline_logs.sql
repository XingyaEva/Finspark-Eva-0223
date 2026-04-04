-- Migration 0022: Pipeline 任务追踪与问答日志
-- 支持后台任务追踪（PDF 解析进度）和每次问答的完整 Pipeline 日志记录

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
    status TEXT DEFAULT 'pending',        -- pending/running/completed/failed/skipped
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
CREATE INDEX IF NOT EXISTS idx_msg_logs_status ON rag_message_logs(status);
