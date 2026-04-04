-- Migration 0031: Eval Alerts Table
-- Phase 3.1: Store low-score alerts from OpenEvals evaluator
-- Triggered when weighted_total < 0.5 for any Agent

CREATE TABLE IF NOT EXISTS eval_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  score REAL NOT NULL,
  message TEXT NOT NULL,
  judge_model TEXT NOT NULL DEFAULT 'gpt-4.1',
  degraded INTEGER DEFAULT 0,
  resolved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_alerts_report ON eval_alerts(report_id);
CREATE INDEX IF NOT EXISTS idx_eval_alerts_unresolved ON eval_alerts(resolved, created_at);
