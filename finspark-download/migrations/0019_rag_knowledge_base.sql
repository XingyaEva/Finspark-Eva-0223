-- RAG Knowledge Base Tables
-- 用于存储公司财报文档和分块数据的RAG知识库

-- 文档表：存储上传的财报文档元信息
CREATE TABLE IF NOT EXISTS rag_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                          -- 上传者ID（NULL表示系统级）
    title TEXT NOT NULL,                       -- 文档标题
    file_name TEXT NOT NULL,                   -- 原始文件名
    file_type TEXT NOT NULL DEFAULT 'text',    -- 文件类型: text, pdf, markdown, html
    file_size INTEGER DEFAULT 0,              -- 文件大小（字节）
    stock_code TEXT,                           -- 关联股票代码（可选）
    stock_name TEXT,                           -- 关联公司名称（可选）
    category TEXT DEFAULT 'general',           -- 分类: annual_report, quarterly_report, research, announcement, general
    tags TEXT DEFAULT '[]',                    -- JSON数组，标签
    chunk_count INTEGER DEFAULT 0,            -- 分块数量
    embedding_model TEXT,                      -- 使用的embedding模型
    status TEXT DEFAULT 'pending',            -- 状态: pending, processing, completed, failed
    error_message TEXT,                        -- 处理失败时的错误信息
    metadata TEXT DEFAULT '{}',               -- 额外元信息JSON
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- 文档分块表：存储文档切分后的文本块
CREATE TABLE IF NOT EXISTS rag_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,              -- 关联文档ID
    chunk_index INTEGER NOT NULL,              -- 块序号（在文档内的顺序）
    content TEXT NOT NULL,                     -- 块文本内容
    content_length INTEGER DEFAULT 0,         -- 文本长度
    embedding_key TEXT,                        -- KV中的embedding存储key
    has_embedding INTEGER DEFAULT 0,          -- 是否已生成embedding (0/1)
    metadata TEXT DEFAULT '{}',               -- 块级别元信息（如页码、章节等）
    created_at DATETIME DEFAULT (datetime('now'))
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_rag_documents_user ON rag_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_stock ON rag_documents(stock_code);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status);
CREATE INDEX IF NOT EXISTS idx_rag_documents_category ON rag_documents(category);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks(has_embedding);

-- 对话历史表：存储RAG问答的对话记录
CREATE TABLE IF NOT EXISTS rag_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                           -- 用户ID
    session_id TEXT NOT NULL,                  -- 会话ID
    role TEXT NOT NULL,                         -- 角色: user, assistant
    content TEXT NOT NULL,                     -- 消息内容
    sources TEXT DEFAULT '[]',                 -- JSON数组，引用的文档源
    metadata TEXT DEFAULT '{}',               -- 额外信息
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rag_conversations_session ON rag_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_rag_conversations_user ON rag_conversations(user_id);
