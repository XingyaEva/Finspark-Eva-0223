-- Migration 0028: RAG 自动同步任务表
-- 支持巨潮 API 财报搜索 → PDF 下载 → MinerU 解析 → RAG 入库 的异步任务追踪

CREATE TABLE IF NOT EXISTS rag_sync_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 股票信息
    stock_code TEXT NOT NULL,
    stock_name TEXT,
    -- 报告信息
    report_type TEXT NOT NULL,              -- annual / semi_annual / q1 / q3
    report_year INTEGER NOT NULL,
    -- 任务状态
    status TEXT NOT NULL DEFAULT 'pending',  -- pending / searching / downloading / parsing / ingesting / completed / failed
    progress INTEGER DEFAULT 0,             -- 0-100
    -- 巨潮关联
    announcement_id TEXT,                    -- 巨潮公告 ID
    pdf_url TEXT,                             -- PDF 下载链接
    -- 入库结果
    document_id INTEGER,                     -- 入库后的 rag_documents.id
    chunk_count INTEGER,                     -- 入库的切片数
    -- 错误处理
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    -- 时间戳
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- 索引：按股票代码查询
CREATE INDEX IF NOT EXISTS idx_sync_tasks_stock ON rag_sync_tasks(stock_code);

-- 索引：按状态查询（查找进行中的任务）
CREATE INDEX IF NOT EXISTS idx_sync_tasks_status ON rag_sync_tasks(status);

-- 索引：避免重复同步（stock_code + report_type + report_year）
CREATE INDEX IF NOT EXISTS idx_sync_tasks_unique ON rag_sync_tasks(stock_code, report_type, report_year);
