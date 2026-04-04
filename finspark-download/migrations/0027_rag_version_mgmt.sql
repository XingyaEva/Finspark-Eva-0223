-- 0027_rag_version_mgmt.sql
-- Phase 4: 知识库版本管理
-- 关联页面: P.16 知识库版本管理

-- ========================================
-- 知识库版本 (快照记录)
-- ========================================
CREATE TABLE IF NOT EXISTS rag_kb_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_label TEXT NOT NULL,               -- 'v1.0', 'v2.0' 等
    name TEXT NOT NULL,                        -- 版本名称/描述
    description TEXT,
    -- 快照统计
    total_documents INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    total_embeddings INTEGER DEFAULT 0,
    -- 快照配置 (创建时的 RAG 参数)
    config_snapshot TEXT DEFAULT '{}',         -- 当时的模型/prompt/search 配置 JSON
    chunk_strategy TEXT,                       -- 当时的切片策略
    embedding_model TEXT,                      -- 当时的嵌入模型
    llm_model TEXT,                            -- 当时的 LLM 模型
    -- 评测快照
    eval_score REAL,                           -- 最近评测总分
    eval_details TEXT DEFAULT '{}',            -- 评测维度明细 JSON
    -- 元数据
    tags TEXT DEFAULT '[]',                    -- 标签列表 JSON
    status TEXT DEFAULT 'active',             -- active / archived / rolled_back
    parent_version_id INTEGER,                 -- 回滚/衍生自哪个版本
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kb_ver_label ON rag_kb_versions(version_label);
CREATE INDEX IF NOT EXISTS idx_kb_ver_status ON rag_kb_versions(status);
CREATE INDEX IF NOT EXISTS idx_kb_ver_created ON rag_kb_versions(created_at);

-- ========================================
-- 版本 Chunk 快照 (关联版本与 chunk ID 映射)
-- ========================================
CREATE TABLE IF NOT EXISTS rag_version_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    chunk_id INTEGER NOT NULL,
    document_id INTEGER,
    content_hash TEXT,                         -- 内容 hash 用于快速 diff
    content_preview TEXT,                      -- 前 200 字符预览
    metadata TEXT DEFAULT '{}',                -- chunk 元数据快照 JSON
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ver_chunks_ver ON rag_version_chunks(version_id);
CREATE INDEX IF NOT EXISTS idx_ver_chunks_chunk ON rag_version_chunks(chunk_id);
CREATE INDEX IF NOT EXISTS idx_ver_chunks_hash ON rag_version_chunks(content_hash);

-- ========================================
-- 版本性能基准 (Benchmark)
-- ========================================
CREATE TABLE IF NOT EXISTS rag_version_benchmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL,
    test_set_id INTEGER,                       -- 关联的测试集
    evaluation_id INTEGER,                     -- 关联的评测任务
    -- 性能指标
    overall_score REAL,
    exact_match_score REAL,
    semantic_score REAL,
    recall_score REAL,
    citation_score REAL,
    avg_latency_ms REAL,
    p95_latency_ms REAL,
    total_questions INTEGER DEFAULT 0,
    -- 附加指标
    scores_by_type TEXT DEFAULT '{}',          -- 按题型分数 JSON
    scores_by_difficulty TEXT DEFAULT '{}',    -- 按难度分数 JSON
    config_used TEXT DEFAULT '{}',             -- 评测时使用的配置 JSON
    -- 元数据
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ver_bench_ver ON rag_version_benchmarks(version_id);
CREATE INDEX IF NOT EXISTS idx_ver_bench_eval ON rag_version_benchmarks(evaluation_id);

-- ========================================
-- 回归测试记录
-- ========================================
CREATE TABLE IF NOT EXISTS rag_regression_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_a_id INTEGER NOT NULL,             -- 对比版本 A (基线)
    version_b_id INTEGER NOT NULL,             -- 对比版本 B (目标)
    test_set_id INTEGER,                       -- 使用的测试集
    -- 对比结果
    score_diff REAL,                           -- B - A 总分差
    improved_count INTEGER DEFAULT 0,          -- 改善的题数
    degraded_count INTEGER DEFAULT 0,          -- 退步的题数
    unchanged_count INTEGER DEFAULT 0,         -- 持平的题数
    -- 明细 JSON
    comparison_details TEXT DEFAULT '[]',      -- 每题对比结果 [{question, score_a, score_b, diff, direction}]
    summary TEXT DEFAULT '{}',                 -- 汇总分析 JSON
    recommendation TEXT,                       -- upgrade / rollback / neutral
    -- 元数据
    status TEXT DEFAULT 'pending',             -- pending / running / completed / failed
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_regression_ver_a ON rag_regression_tests(version_a_id);
CREATE INDEX IF NOT EXISTS idx_regression_ver_b ON rag_regression_tests(version_b_id);
CREATE INDEX IF NOT EXISTS idx_regression_status ON rag_regression_tests(status);
