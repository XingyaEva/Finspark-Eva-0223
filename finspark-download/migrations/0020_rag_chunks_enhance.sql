-- Migration 0020: RAG Chunks 增强字段
-- 为 Chunk 编辑、HyDE 问题生成、摘要增强、PDF 页码映射做好数据结构准备

-- Chunk 增强字段
ALTER TABLE rag_chunks ADD COLUMN summary TEXT;                    -- LLM 生成的摘要
ALTER TABLE rag_chunks ADD COLUMN entities TEXT DEFAULT '[]';      -- 自动标注的实体 JSON
ALTER TABLE rag_chunks ADD COLUMN keywords TEXT DEFAULT '[]';      -- 自动提取的关键词 JSON
ALTER TABLE rag_chunks ADD COLUMN chunk_type TEXT DEFAULT 'text';  -- text/table/image
ALTER TABLE rag_chunks ADD COLUMN page_range TEXT;                 -- PDF 页码范围 "12-13"
ALTER TABLE rag_chunks ADD COLUMN question_count INTEGER DEFAULT 0; -- 已生成的问题数

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
