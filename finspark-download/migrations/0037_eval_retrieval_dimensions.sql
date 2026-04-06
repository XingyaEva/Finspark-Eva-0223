-- 0037_eval_retrieval_dimensions.sql
-- Add retrieval-focused evaluation dimensions to support chunking strategy & retrieval quality assessment
-- New dimensions: context_sufficiency, chunk_relevance, chunk_integrity

-- Add new dimension columns to rag_evaluations
ALTER TABLE rag_evaluations ADD COLUMN context_sufficiency_score REAL;
ALTER TABLE rag_evaluations ADD COLUMN chunk_relevance_score REAL;
ALTER TABLE rag_evaluations ADD COLUMN chunk_integrity_score REAL;
