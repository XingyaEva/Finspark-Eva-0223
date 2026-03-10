-- 搜索性能优化迁移脚本
-- 添加复合索引优化搜索查询

-- 1. 复合索引：list_status + is_hot + search_count（覆盖热门搜索排序）
CREATE INDEX IF NOT EXISTS idx_stocks_hot_search ON stocks(list_status, is_hot DESC, search_count DESC);

-- 2. 复合索引：list_status + name（覆盖名称搜索）
CREATE INDEX IF NOT EXISTS idx_stocks_status_name ON stocks(list_status, name);

-- 3. 前缀索引优化：symbol前缀搜索（股票代码通常是数字开头）
CREATE INDEX IF NOT EXISTS idx_stocks_symbol_prefix ON stocks(symbol COLLATE NOCASE);

-- 4. 更新FTS5配置以支持更快的前缀搜索
-- 重建FTS表以添加前缀索引支持
DROP TABLE IF EXISTS stocks_fts;
CREATE VIRTUAL TABLE IF NOT EXISTS stocks_fts USING fts5(
  name,
  symbol,
  ts_code,
  industry,
  content='stocks',
  content_rowid='id',
  prefix='1,2,3',  -- 支持1-3字符前缀搜索
  tokenize='unicode61'  -- 更好的中文分词支持
);

-- 重建FTS索引数据
INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry)
SELECT id, name, symbol, ts_code, industry FROM stocks WHERE list_status = 'L';

-- 重建触发器
DROP TRIGGER IF EXISTS stocks_ai;
DROP TRIGGER IF EXISTS stocks_ad;
DROP TRIGGER IF EXISTS stocks_au;

CREATE TRIGGER stocks_ai AFTER INSERT ON stocks BEGIN
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry);
END;

CREATE TRIGGER stocks_ad AFTER DELETE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry);
END;

CREATE TRIGGER stocks_au AFTER UPDATE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry);
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry);
END;
