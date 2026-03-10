-- 用户保存的问题表
-- 支持智能助手问题收藏功能

CREATE TABLE IF NOT EXISTS saved_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    context_stock_code TEXT,
    context_stock_name TEXT,
    context_report_id INTEGER,
    category TEXT DEFAULT 'general',
    tags TEXT,
    is_pinned INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (context_report_id) REFERENCES analysis_reports(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_saved_questions_user ON saved_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_questions_category ON saved_questions(category);
CREATE INDEX IF NOT EXISTS idx_saved_questions_pinned ON saved_questions(is_pinned);
CREATE INDEX IF NOT EXISTS idx_saved_questions_stock ON saved_questions(context_stock_code);
