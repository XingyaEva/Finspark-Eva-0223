-- Migration 0032: Eval Token Usage Table
-- Phase 3.2: Track Judge LLM token consumption per report evaluation
-- Estimates based on input/output character length (≈ 0.7 tokens/char)

CREATE TABLE IF NOT EXISTS eval_token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  judge_model TEXT NOT NULL DEFAULT 'gpt-4.1',
  total_calls INTEGER NOT NULL DEFAULT 0,
  success_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  estimated_input_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_latency_ms INTEGER NOT NULL DEFAULT 0,
  degraded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_eval_token_usage_report ON eval_token_usage(report_id);
CREATE INDEX IF NOT EXISTS idx_eval_token_usage_created ON eval_token_usage(created_at);
