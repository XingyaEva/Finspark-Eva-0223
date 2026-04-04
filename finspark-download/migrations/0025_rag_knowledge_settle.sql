-- 0025_rag_knowledge_settle.sql
-- Phase 3: 对话知识沉淀系统
-- 关联页面: P.14 对话知识沉淀

-- ========================================
-- 对话知识提取 (从对话中提取的原始知识条目)
-- ========================================
CREATE TABLE IF NOT EXISTS rag_conversation_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_log_id INTEGER,                  -- 关联 rag_message_logs
    conversation_id INTEGER,                 -- 关联 rag_conversations
    knowledge_type TEXT NOT NULL,             -- fact / procedure / definition / rule / insight
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence REAL DEFAULT 0.0,             -- LLM 提取置信度 0~1
    source_question TEXT,                    -- 原始问题
    source_answer TEXT,                      -- 原始回答
    status TEXT DEFAULT 'pending',           -- pending / accepted / rejected / merged
    review_note TEXT,                        -- 审核备注
    reviewed_by TEXT,
    reviewed_at DATETIME,
    extracted_by TEXT DEFAULT 'llm',         -- llm / manual
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conv_knowledge_type ON rag_conversation_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_conv_knowledge_status ON rag_conversation_knowledge(status);
CREATE INDEX IF NOT EXISTS idx_conv_knowledge_conv ON rag_conversation_knowledge(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_knowledge_msg ON rag_conversation_knowledge(message_log_id);

-- ========================================
-- 已沉淀知识 (审核通过并合并后的知识库条目)
-- ========================================
CREATE TABLE IF NOT EXISTS rag_settled_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    knowledge_type TEXT NOT NULL,             -- fact / procedure / definition / rule / insight
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    merged_from TEXT DEFAULT '[]',            -- 合并来源 conversation_knowledge id 列表 JSON
    source_count INTEGER DEFAULT 1,          -- 来源对话数
    chunk_id INTEGER,                        -- 入库后对应的 chunk ID
    document_id INTEGER,                     -- 入库后对应的 document ID
    applied_at DATETIME,                     -- 入库时间
    status TEXT DEFAULT 'pending_apply',     -- pending_apply / applied / archived
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_settled_type ON rag_settled_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_settled_status ON rag_settled_knowledge(status);
