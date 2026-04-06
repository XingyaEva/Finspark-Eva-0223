-- 0036_eval_faithfulness_score.sql
-- Add faithfulness_score column to rag_evaluations for the enhanced 5-dimension scoring system
-- Faithfulness measures whether the model answer stays within the retrieved context

ALTER TABLE rag_evaluations ADD COLUMN faithfulness_score REAL;
