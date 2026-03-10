-- 为股票表添加拼音字段以支持拼音搜索
ALTER TABLE stocks ADD COLUMN pinyin TEXT;        -- 全拼 (如 guizhoumaotai)
ALTER TABLE stocks ADD COLUMN pinyin_abbr TEXT;   -- 拼音首字母 (如 gzmt)

-- 创建拼音字段索引
CREATE INDEX IF NOT EXISTS idx_stocks_pinyin ON stocks(pinyin);
CREATE INDEX IF NOT EXISTS idx_stocks_pinyin_abbr ON stocks(pinyin_abbr);

-- 更新 FTS 表以包含拼音字段（需要重建）
DROP TABLE IF EXISTS stocks_fts;

CREATE VIRTUAL TABLE IF NOT EXISTS stocks_fts USING fts5(
  name,
  symbol,
  ts_code,
  industry,
  pinyin,
  pinyin_abbr,
  content='stocks',
  content_rowid='id'
);

-- 删除旧触发器
DROP TRIGGER IF EXISTS stocks_ai;
DROP TRIGGER IF EXISTS stocks_ad;
DROP TRIGGER IF EXISTS stocks_au;

-- 重建触发器：同步插入到 FTS 表
CREATE TRIGGER stocks_ai AFTER INSERT ON stocks BEGIN
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry, new.pinyin, new.pinyin_abbr);
END;

-- 触发器：同步删除
CREATE TRIGGER stocks_ad AFTER DELETE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry, old.pinyin, old.pinyin_abbr);
END;

-- 触发器：同步更新
CREATE TRIGGER stocks_au AFTER UPDATE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry, old.pinyin, old.pinyin_abbr);
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry, new.pinyin, new.pinyin_abbr);
END;
