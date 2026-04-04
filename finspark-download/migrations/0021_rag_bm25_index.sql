-- Migration 0021: BM25 倒排索引
-- 支持 BM25 关键词检索，实现混合检索（向量 + BM25）

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
-- 复合索引加速 token+source 联合查询
CREATE INDEX IF NOT EXISTS idx_bm25_token_source ON rag_bm25_tokens(token, source);

-- BM25 索引元数据（全局统计信息）
CREATE TABLE IF NOT EXISTS rag_bm25_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER,                         -- NULL 表示全局
    source TEXT NOT NULL DEFAULT 'content',       -- 'content' 或 'question'
    total_docs INTEGER DEFAULT 0,                -- 总文档(chunk)数
    avg_doc_length REAL DEFAULT 0,               -- 平均文档(chunk)长度(token 数)
    last_built DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bm25_meta_doc ON rag_bm25_meta(document_id);
CREATE INDEX IF NOT EXISTS idx_bm25_meta_source ON rag_bm25_meta(source);
