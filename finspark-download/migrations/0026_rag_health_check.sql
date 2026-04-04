-- 0026_rag_health_check.sql
-- Phase 3: 知识库健康度检查
-- 关联页面: P.15 知识库健康度检查

-- ========================================
-- 健康检查报告
-- ========================================
CREATE TABLE IF NOT EXISTS rag_health_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 总分 (覆盖率×40% + 新鲜度×30% + 一致性×30%)
    overall_score REAL,
    coverage_score REAL,                     -- 覆盖率得分 0~100
    freshness_score REAL,                    -- 新鲜度得分 0~100
    consistency_score REAL,                  -- 一致性得分 0~100

    -- 统计快照
    total_documents INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    total_questions_tested INTEGER DEFAULT 0,

    -- 详细分析结果 JSON
    coverage_details TEXT DEFAULT '{}',      -- {tested, covered, missing_topics:[...]}
    freshness_details TEXT DEFAULT '{}',     -- {fresh, stale, expired, stale_chunks:[...]}
    consistency_details TEXT DEFAULT '{}',   -- {consistent, conflicts:[], duplicates:[]}

    -- 改进建议 JSON
    suggestions TEXT DEFAULT '[]',           -- [{type, severity, title, description, action}]
    issues_count INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,

    status TEXT DEFAULT 'running',           -- running / completed / failed
    error_message TEXT,
    started_at DATETIME DEFAULT (datetime('now')),
    completed_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_report_status ON rag_health_reports(status);

-- ========================================
-- 健康检查问题追踪
-- ========================================
CREATE TABLE IF NOT EXISTS rag_health_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    issue_type TEXT NOT NULL,                 -- coverage_gap / stale_content / conflict / duplicate / low_quality
    severity TEXT DEFAULT 'medium',           -- low / medium / high / critical
    title TEXT NOT NULL,
    description TEXT,
    affected_chunk_ids TEXT DEFAULT '[]',     -- 受影响的 chunk ID 列表 JSON
    affected_document_ids TEXT DEFAULT '[]',  -- 受影响的 document ID 列表 JSON
    suggested_fix TEXT,                       -- 建议修复方案
    status TEXT DEFAULT 'open',              -- open / in_progress / fixed / ignored
    fixed_at DATETIME,
    fixed_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_issue_report ON rag_health_issues(report_id);
CREATE INDEX IF NOT EXISTS idx_health_issue_type ON rag_health_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_health_issue_status ON rag_health_issues(status);
CREATE INDEX IF NOT EXISTS idx_health_issue_severity ON rag_health_issues(severity);
