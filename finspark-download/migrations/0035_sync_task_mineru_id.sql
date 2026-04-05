-- Migration 0035: 为 rag_sync_tasks 添加 MinerU 任务 ID 和 markdown 缓存 URL
-- 支持分步状态机推进（advance pattern），避免 waitUntil 超时

ALTER TABLE rag_sync_tasks ADD COLUMN mineru_task_id TEXT;
ALTER TABLE rag_sync_tasks ADD COLUMN mineru_result_url TEXT;
