-- 股票基础信息表
CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL UNIQUE,        -- Tushare股票代码 (如 600519.SH)
  symbol TEXT NOT NULL,                 -- 股票简码 (如 600519)
  name TEXT NOT NULL,                   -- 股票名称
  area TEXT,                            -- 地区
  industry TEXT,                        -- 所属行业
  market TEXT,                          -- 市场类型 (主板/创业板/科创板)
  exchange TEXT,                        -- 交易所 (SSE/SZSE)
  list_date TEXT,                       -- 上市日期
  list_status TEXT DEFAULT 'L',         -- 上市状态 L-上市 D-退市 P-暂停上市
  is_hot INTEGER DEFAULT 0,             -- 是否热门股票
  search_count INTEGER DEFAULT 0,       -- 搜索次数（用于热度排序）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以加速搜索
CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks(name);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_ts_code ON stocks(ts_code);
CREATE INDEX IF NOT EXISTS idx_stocks_industry ON stocks(industry);
CREATE INDEX IF NOT EXISTS idx_stocks_is_hot ON stocks(is_hot);
CREATE INDEX IF NOT EXISTS idx_stocks_list_status ON stocks(list_status);

-- 全文搜索视图（SQLite FTS5）
-- 注：Cloudflare D1 支持 FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS stocks_fts USING fts5(
  name,
  symbol,
  ts_code,
  industry,
  content='stocks',
  content_rowid='id'
);

-- 触发器：同步插入到 FTS 表
CREATE TRIGGER IF NOT EXISTS stocks_ai AFTER INSERT ON stocks BEGIN
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry);
END;

-- 触发器：同步删除
CREATE TRIGGER IF NOT EXISTS stocks_ad AFTER DELETE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry);
END;

-- 触发器：同步更新
CREATE TRIGGER IF NOT EXISTS stocks_au AFTER UPDATE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry);
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry);
END;

-- 用户表（可选，为用户系统准备）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',  -- free/pro/enterprise
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分析报告表
CREATE TABLE IF NOT EXISTS analysis_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  report_type TEXT DEFAULT 'annual',
  report_period TEXT,
  status TEXT DEFAULT 'pending',
  result_json TEXT,                    -- 完整分析结果JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_company ON analysis_reports(company_code);
CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON analysis_reports(status);
