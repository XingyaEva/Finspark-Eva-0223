-- Migration 0030: Analysis Evaluation Scores Table
-- Phase 2.4: Persist OpenEvals LLM-as-Judge scores to D1
-- Enables historical analysis of evaluation quality, model degradation tracking,
-- and dashboard display of per-agent quality metrics.

CREATE TABLE IF NOT EXISTS analysis_eval_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  dimension TEXT NOT NULL,
  score REAL NOT NULL,
  reasoning TEXT DEFAULT '',
  judge_model TEXT NOT NULL DEFAULT 'gpt-4.1',
  eval_latency_ms INTEGER DEFAULT 0,
  degraded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),

  -- Indexes for common queries
  UNIQUE(report_id, agent_type, dimension)
);

-- Query: Get all scores for a report
CREATE INDEX IF NOT EXISTS idx_eval_scores_report ON analysis_eval_scores(report_id);

-- Query: Track degradation rate over time
CREATE INDEX IF NOT EXISTS idx_eval_scores_degraded ON analysis_eval_scores(degraded, created_at);

-- Query: Average scores by dimension
CREATE INDEX IF NOT EXISTS idx_eval_scores_dimension ON analysis_eval_scores(dimension, score);
