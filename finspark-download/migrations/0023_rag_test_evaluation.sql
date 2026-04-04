-- 0023_rag_test_evaluation.sql
-- Phase 2: 测试集与评测系统
-- 关联页面: P.6 测试集管理, P.7 批量评测与打分

-- ========================================
-- 测试集
-- ========================================
CREATE TABLE IF NOT EXISTS rag_test_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    document_ids TEXT DEFAULT '[]',        -- 覆盖的文档 ID 列表 JSON
    question_count INTEGER DEFAULT 0,
    last_eval_score REAL,
    last_eval_at DATETIME,
    status TEXT DEFAULT 'active',          -- active / archived
    created_by TEXT,                       -- user_id or name
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- ========================================
-- 测试题目
-- ========================================
CREATE TABLE IF NOT EXISTS rag_test_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_set_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT DEFAULT 'factual',   -- factual / name / boolean / comparative / open / number
    expected_answer TEXT NOT NULL,
    reference_pages TEXT DEFAULT '[]',      -- 参考页码 JSON
    difficulty TEXT DEFAULT 'medium',       -- easy / medium / hard
    source TEXT DEFAULT 'manual',           -- manual / llm / csv
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_test_q_set ON rag_test_questions(test_set_id);
CREATE INDEX IF NOT EXISTS idx_test_q_type ON rag_test_questions(question_type);

-- ========================================
-- 测试题扩写变体
-- ========================================
CREATE TABLE IF NOT EXISTS rag_test_question_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    variant_text TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_test_var_q ON rag_test_question_variants(question_id);

-- ========================================
-- 评测任务
-- ========================================
CREATE TABLE IF NOT EXISTS rag_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    test_set_id INTEGER NOT NULL,
    config_json TEXT NOT NULL,              -- RAG 参数配置 JSON
    status TEXT DEFAULT 'pending',          -- pending / running / completed / failed
    total_questions INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,

    -- 总分
    overall_score REAL,
    exact_match_score REAL,
    semantic_score REAL,
    recall_score REAL,
    citation_score REAL,

    -- 按类型/难度分组分数 JSON
    scores_by_type TEXT DEFAULT '{}',
    scores_by_difficulty TEXT DEFAULT '{}',

    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_set ON rag_evaluations(test_set_id);
CREATE INDEX IF NOT EXISTS idx_eval_status ON rag_evaluations(status);

-- ========================================
-- 评测逐题结果
-- ========================================
CREATE TABLE IF NOT EXISTS rag_evaluation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT,
    difficulty TEXT,
    expected_answer TEXT,
    model_answer TEXT,
    score REAL,
    is_correct INTEGER DEFAULT 0,
    scoring_reason TEXT,
    retrieval_results TEXT DEFAULT '[]',    -- 检索结果 JSON
    sources_used TEXT DEFAULT '[]',         -- 引用来源 JSON
    latency_ms INTEGER,
    tokens_input INTEGER,
    tokens_output INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_result_eval ON rag_evaluation_results(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_result_q ON rag_evaluation_results(question_id);
