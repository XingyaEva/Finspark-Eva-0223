-- Migration 0033: D1 FTS5 全文检索（替换自建 BM25 倒排索引）
-- 
-- 用 SQLite FTS5 替代 ragBm25.ts 中的 rag_bm25_tokens 自建倒排索引
-- 优势：
--   1. 原生 BM25 评分，单次 MATCH 查询完成（vs 旧方案 4-5 次 DB round-trip）
--   2. 触发器自动同步，无需手动构建索引
--   3. 支持前缀/短语/布尔查询
--
-- 注意：
--   - D1 原生支持 FTS5，但 wrangler d1 export 不能导出含虚拟表的库
--   - unicode61 tokenizer 对中英文都有基础支持

-- 创建 FTS5 虚拟表（content 同步自 rag_chunks）
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  content,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- 触发器：INSERT 时自动同步到 FTS5
CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_insert
AFTER INSERT ON rag_chunks
BEGIN
  INSERT INTO rag_chunks_fts(rowid, content)
  VALUES (NEW.id, NEW.content);
END;

-- 触发器：DELETE 时自动从 FTS5 移除
CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_delete
AFTER DELETE ON rag_chunks
BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content)
  VALUES ('delete', OLD.id, OLD.content);
END;

-- 触发器：UPDATE content 时自动更新 FTS5
CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_update
AFTER UPDATE OF content ON rag_chunks
BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content)
  VALUES ('delete', OLD.id, OLD.content);
  INSERT INTO rag_chunks_fts(rowid, content)
  VALUES (NEW.id, NEW.content);
END;
