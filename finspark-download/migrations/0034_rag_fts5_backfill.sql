-- Migration 0034: 回填 FTS5 索引（历史 rag_chunks 数据）
--
-- 将已有的 rag_chunks 内容写入 FTS5 虚拟表
-- 之后新增的 chunk 会通过触发器自动同步

INSERT OR IGNORE INTO rag_chunks_fts(rowid, content)
SELECT id, content
FROM rag_chunks
WHERE content IS NOT NULL AND content != '';
