-- =====================================================================
-- Finspark 财报分析系统 - 完整数据库初始化脚本
-- 版本: 2.0
-- 日期: 2026-01-12
-- 说明: 合并所有迁移文件，一次性初始化所有数据表
-- =====================================================================

-- =====================================================================
-- 第一部分: 核心数据表
-- =====================================================================

-- 1.1 股票基础信息表
CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL UNIQUE,        -- Tushare股票代码 (如 600519.SH)
  symbol TEXT NOT NULL,                 -- 股票简码 (如 600519)
  name TEXT NOT NULL,                   -- 股票名称
  area TEXT,                            -- 地区
  industry TEXT,                        -- 所属行业
  market TEXT,                          -- 市场类型 (主板/创业板/科创板/港股主板)
  exchange TEXT,                        -- 交易所 (SSE/SZSE/HKEX)
  list_date TEXT,                       -- 上市日期
  list_status TEXT DEFAULT 'L',         -- 上市状态 L-上市 D-退市 P-暂停上市
  is_hot INTEGER DEFAULT 0,             -- 是否热门股票
  search_count INTEGER DEFAULT 0,       -- 搜索次数（用于热度排序）
  pinyin TEXT,                          -- 全拼 (如 guizhoumaotai)
  pinyin_abbr TEXT,                     -- 拼音首字母 (如 gzmt)
  stock_type TEXT DEFAULT 'A',          -- 股票类型: A-A股, HK-港股
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 股票表索引
CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks(name);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_ts_code ON stocks(ts_code);
CREATE INDEX IF NOT EXISTS idx_stocks_industry ON stocks(industry);
CREATE INDEX IF NOT EXISTS idx_stocks_is_hot ON stocks(is_hot);
CREATE INDEX IF NOT EXISTS idx_stocks_list_status ON stocks(list_status);
CREATE INDEX IF NOT EXISTS idx_stocks_hot_search ON stocks(list_status, is_hot DESC, search_count DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_status_name ON stocks(list_status, name);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol_prefix ON stocks(symbol COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_stocks_pinyin ON stocks(pinyin);
CREATE INDEX IF NOT EXISTS idx_stocks_pinyin_abbr ON stocks(pinyin_abbr);
CREATE INDEX IF NOT EXISTS idx_stocks_type ON stocks(stock_type);

-- 1.2 全文搜索表 (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS stocks_fts USING fts5(
  name,
  symbol,
  ts_code,
  industry,
  pinyin,
  pinyin_abbr,
  content='stocks',
  content_rowid='id',
  prefix='1,2,3',
  tokenize='unicode61'
);

-- FTS 同步触发器
CREATE TRIGGER IF NOT EXISTS stocks_ai AFTER INSERT ON stocks BEGIN
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry, new.pinyin, new.pinyin_abbr);
END;

CREATE TRIGGER IF NOT EXISTS stocks_ad AFTER DELETE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry, old.pinyin, old.pinyin_abbr);
END;

CREATE TRIGGER IF NOT EXISTS stocks_au AFTER UPDATE ON stocks BEGIN
  INSERT INTO stocks_fts(stocks_fts, rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES ('delete', old.id, old.name, old.symbol, old.ts_code, old.industry, old.pinyin, old.pinyin_abbr);
  INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
  VALUES (new.id, new.name, new.symbol, new.ts_code, new.industry, new.pinyin, new.pinyin_abbr);
END;

-- =====================================================================
-- 第二部分: 用户系统表
-- =====================================================================

-- 2.1 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',  -- free/pro/enterprise
  membership_tier TEXT DEFAULT 'free',    -- guest/free/pro/elite
  membership_expires_at DATETIME DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  nickname TEXT DEFAULT NULL,
  avatar_type TEXT DEFAULT 'default',
  daily_analysis_count INTEGER DEFAULT 0,
  daily_analysis_date TEXT DEFAULT NULL,
  total_analysis_count INTEGER DEFAULT 0,
  last_login_at DATETIME DEFAULT NULL,
  login_count INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0,
  verification_token TEXT DEFAULT NULL,
  verification_expires_at DATETIME DEFAULT NULL,
  password_reset_token TEXT DEFAULT NULL,
  password_reset_expires_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_membership ON users(membership_tier);

-- 2.2 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  device_info TEXT,
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- 2.3 第三方认证绑定表
CREATE TABLE IF NOT EXISTS user_auth_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_openid TEXT,
  provider_unionid TEXT,
  provider_nickname TEXT,
  provider_avatar TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  raw_profile TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_bindings_user ON user_auth_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_bindings_provider ON user_auth_bindings(provider, provider_user_id);

-- 2.4 访客会话表
CREATE TABLE IF NOT EXISTS guest_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT DEFAULT 'unknown',
  analysis_count INTEGER DEFAULT 0,
  last_analysis_at DATETIME,
  first_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  converted_to_user_id INTEGER DEFAULT NULL,
  converted_at DATETIME DEFAULT NULL,
  metadata TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_fingerprint ON guest_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_converted ON guest_sessions(converted_to_user_id);

-- 2.5 邮件验证码表
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  is_used INTEGER DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_codes_expires ON email_verification_codes(expires_at);

-- 2.6 用户活动日志表
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  guest_fingerprint TEXT,
  action_type TEXT NOT NULL,
  action_target TEXT,
  action_detail TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_guest ON user_activity_logs(guest_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_time ON user_activity_logs(created_at);

-- =====================================================================
-- 第三部分: 分析报告与收藏
-- =====================================================================

-- 3.1 分析报告表
CREATE TABLE IF NOT EXISTS analysis_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  report_type TEXT DEFAULT 'annual',
  report_period TEXT,
  status TEXT DEFAULT 'pending',
  result_json TEXT,
  comic_status TEXT DEFAULT NULL,
  comic_id INTEGER DEFAULT NULL,
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME DEFAULT NULL,
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT NULL,
  key_conclusions TEXT DEFAULT NULL,
  guest_fingerprint TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_company ON analysis_reports(company_code);
CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON analysis_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_deleted ON analysis_reports(is_deleted);
CREATE INDEX IF NOT EXISTS idx_reports_guest ON analysis_reports(guest_fingerprint);

-- 3.2 漫画报告表
CREATE TABLE IF NOT EXISTS comic_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  user_id INTEGER,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  style TEXT DEFAULT 'modern',
  summary TEXT,
  panels_json TEXT,
  status TEXT DEFAULT 'pending',
  character_set_id TEXT DEFAULT 'nezha-movie',
  main_character_id TEXT DEFAULT 'nezha',
  output_format TEXT DEFAULT 'grid',
  content_style TEXT DEFAULT 'creative',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comic_report ON comic_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_comic_user ON comic_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_comic_status ON comic_reports(status);
CREATE INDEX IF NOT EXISTS idx_comic_character_set ON comic_reports(character_set_id);
CREATE INDEX IF NOT EXISTS idx_comic_character ON comic_reports(main_character_id);
CREATE INDEX IF NOT EXISTS idx_comic_content_style ON comic_reports(content_style);

-- 3.3 收藏分组表
CREATE TABLE IF NOT EXISTS favorite_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#d4af37',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_favorite_groups_user ON favorite_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_groups_order ON favorite_groups(user_id, sort_order);

-- 3.4 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  stock_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  notes TEXT,
  favorite_type TEXT DEFAULT 'stock',
  report_id INTEGER DEFAULT NULL,
  tags TEXT DEFAULT NULL,
  is_pinned INTEGER DEFAULT 0,
  last_viewed_at DATETIME DEFAULT NULL,
  group_id INTEGER DEFAULT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, stock_code)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_stock ON user_favorites(stock_code);
CREATE INDEX IF NOT EXISTS idx_favorites_type ON user_favorites(favorite_type);
CREATE INDEX IF NOT EXISTS idx_favorites_report ON user_favorites(report_id);
CREATE INDEX IF NOT EXISTS idx_favorites_group ON user_favorites(group_id);
CREATE INDEX IF NOT EXISTS idx_favorites_sort ON user_favorites(user_id, sort_order);

-- 3.5 分享链接表
CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  created_by INTEGER,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0,
  last_viewed_at DATETIME,
  settings_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_share_code ON share_links(share_code);
CREATE INDEX IF NOT EXISTS idx_share_report ON share_links(report_id);
CREATE INDEX IF NOT EXISTS idx_share_active ON share_links(is_active, expires_at);

-- 3.6 分享访问记录表
CREATE TABLE IF NOT EXISTS share_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL,
  visitor_ip TEXT,
  visitor_ua TEXT,
  referrer TEXT,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (share_link_id) REFERENCES share_links(id)
);

CREATE INDEX IF NOT EXISTS idx_share_access_link ON share_access_logs(share_link_id);
CREATE INDEX IF NOT EXISTS idx_share_access_time ON share_access_logs(accessed_at);

-- 3.7 保存的问题表
CREATE TABLE IF NOT EXISTS saved_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  context_stock_code TEXT,
  context_stock_name TEXT,
  context_report_id INTEGER,
  category TEXT DEFAULT 'general',
  tags TEXT,
  is_pinned INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (context_report_id) REFERENCES analysis_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_saved_questions_user ON saved_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_questions_category ON saved_questions(category);
CREATE INDEX IF NOT EXISTS idx_saved_questions_pinned ON saved_questions(is_pinned);
CREATE INDEX IF NOT EXISTS idx_saved_questions_stock ON saved_questions(context_stock_code);

-- =====================================================================
-- 第四部分: 财务数据存储表
-- =====================================================================

-- 4.1 利润表
CREATE TABLE IF NOT EXISTS income_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  report_type TEXT,
  total_revenue REAL,
  revenue REAL,
  total_cogs REAL,
  operate_cost REAL,
  sell_exp REAL,
  admin_exp REAL,
  fin_exp REAL,
  rd_exp REAL,
  operate_profit REAL,
  total_profit REAL,
  income_tax REAL,
  n_income REAL,
  n_income_attr_p REAL,
  basic_eps REAL,
  diluted_eps REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ts_code, end_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_income_ts_code ON income_statements(ts_code);
CREATE INDEX IF NOT EXISTS idx_income_end_date ON income_statements(end_date);

-- 4.2 资产负债表
CREATE TABLE IF NOT EXISTS balance_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  report_type TEXT,
  total_assets REAL,
  total_cur_assets REAL,
  money_cap REAL,
  notes_receiv REAL,
  accounts_receiv REAL,
  inventories REAL,
  total_nca REAL,
  fix_assets REAL,
  intan_assets REAL,
  goodwill REAL,
  total_liab REAL,
  total_cur_liab REAL,
  notes_payable REAL,
  acct_payable REAL,
  adv_receipts REAL,
  total_ncl REAL,
  lt_borr REAL,
  bond_payable REAL,
  total_hldr_eqy_exc_min_int REAL,
  minority_int REAL,
  total_hldr_eqy_inc_min_int REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ts_code, end_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_balance_ts_code ON balance_sheets(ts_code);
CREATE INDEX IF NOT EXISTS idx_balance_end_date ON balance_sheets(end_date);

-- 4.3 现金流量表
CREATE TABLE IF NOT EXISTS cash_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  report_type TEXT,
  n_cashflow_act REAL,
  c_fr_sale_sg REAL,
  c_paid_goods_s REAL,
  c_paid_to_for_empl REAL,
  c_paid_for_taxes REAL,
  n_cashflow_inv_act REAL,
  c_pay_acq_const_fiolta REAL,
  c_recp_disp_fiolta REAL,
  n_cash_flows_fnc_act REAL,
  c_recp_borrow REAL,
  c_prepay_amt_borr REAL,
  c_pay_dist_dpcp_int_exp REAL,
  n_incr_cash_cash_equ REAL,
  free_cashflow REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ts_code, end_date, report_type)
);

CREATE INDEX IF NOT EXISTS idx_cashflow_ts_code ON cash_flows(ts_code);
CREATE INDEX IF NOT EXISTS idx_cashflow_end_date ON cash_flows(end_date);

-- 4.4 财务指标表
CREATE TABLE IF NOT EXISTS fina_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  grossprofit_margin REAL,
  netprofit_margin REAL,
  roe REAL,
  roe_dt REAL,
  roa REAL,
  netprofit_yoy REAL,
  or_yoy REAL,
  op_yoy REAL,
  assets_yoy REAL,
  debt_to_assets REAL,
  current_ratio REAL,
  quick_ratio REAL,
  assets_turn REAL,
  inv_turn REAL,
  ar_turn REAL,
  eps REAL,
  bps REAL,
  cfps REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ts_code, end_date)
);

CREATE INDEX IF NOT EXISTS idx_fina_ts_code ON fina_indicators(ts_code);
CREATE INDEX IF NOT EXISTS idx_fina_end_date ON fina_indicators(end_date);

-- 4.5 日线行情数据表
CREATE TABLE IF NOT EXISTS daily_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  trade_date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL,
  pre_close REAL,
  change REAL,
  pct_chg REAL,
  vol REAL,
  amount REAL,
  turnover_rate REAL,
  pe REAL,
  pe_ttm REAL,
  pb REAL,
  ps REAL,
  ps_ttm REAL,
  total_share REAL,
  float_share REAL,
  total_mv REAL,
  circ_mv REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ts_code, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_ts_code ON daily_quotes(ts_code);
CREATE INDEX IF NOT EXISTS idx_daily_trade_date ON daily_quotes(trade_date);
CREATE INDEX IF NOT EXISTS idx_daily_ts_trade ON daily_quotes(ts_code, trade_date);

-- 4.6 数据同步记录表
CREATE TABLE IF NOT EXISTS data_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  data_type TEXT NOT NULL,
  sync_date TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_ts_code ON data_sync_logs(ts_code);
CREATE INDEX IF NOT EXISTS idx_sync_type ON data_sync_logs(data_type);
CREATE INDEX IF NOT EXISTS idx_sync_date ON data_sync_logs(sync_date);

-- =====================================================================
-- 第五部分: 会员与订阅系统
-- =====================================================================

-- 5.1 会员方案表
CREATE TABLE IF NOT EXISTS membership_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  original_price_cents INTEGER NOT NULL,
  current_price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'CNY',
  features TEXT NOT NULL,
  highlight TEXT,
  is_recommended INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_tier ON membership_plans(tier);
CREATE INDEX IF NOT EXISTS idx_plans_active ON membership_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort ON membership_plans(sort_order);

-- 预置会员方案
INSERT OR IGNORE INTO membership_plans (code, name, tier, duration_months, original_price_cents, current_price_cents, features, highlight, is_recommended, sort_order) VALUES 
  ('pro_monthly', 'Pro 月度会员', 'pro', 1, 4900, 2900, '["每日50次分析","AI漫画解读","专业风险评估","行业对比分析","PDF无水印导出","500个收藏位"]', NULL, 0, 1),
  ('pro_yearly', 'Pro 年度会员', 'pro', 12, 58800, 29900, '["每日50次分析","AI漫画解读","专业风险评估","行业对比分析","PDF无水印导出","500个收藏位","年省近300元"]', '最受欢迎', 1, 2),
  ('elite_monthly', 'Elite 月度会员', 'elite', 1, 9900, 6900, '["无限分析次数","全部Pro功能","批量分析","API访问权限","1000个收藏位","优先客服支持"]', NULL, 0, 3),
  ('elite_yearly', 'Elite 年度会员', 'elite', 12, 118800, 69900, '["无限分析次数","全部Pro功能","批量分析","API访问权限","1000个收藏位","优先客服支持","年省近600元"]', '性价比之选', 0, 4);

-- 5.2 会员订单表
CREATE TABLE IF NOT EXISTS membership_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_no TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  tier TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'CNY',
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  payment_id TEXT,
  payment_time DATETIME,
  membership_start DATETIME,
  membership_end DATETIME,
  invoice_info TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON membership_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_no ON membership_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON membership_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_time ON membership_orders(created_at);

-- 5.3 会员使用记录表
CREATE TABLE IF NOT EXISTS membership_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  feature TEXT NOT NULL,
  usage_date DATE NOT NULL,
  usage_count INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, feature, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON membership_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON membership_usage_logs(usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_feature ON membership_usage_logs(feature);

-- 5.4 功能权益配置表
CREATE TABLE IF NOT EXISTS feature_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature TEXT NOT NULL,
  tier TEXT NOT NULL,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  is_enabled INTEGER DEFAULT 1,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feature, tier)
);

-- 预置功能权益
INSERT OR IGNORE INTO feature_limits (feature, tier, daily_limit, monthly_limit, is_enabled, description) VALUES
  ('analysis', 'guest', 3, NULL, 1, '财报分析'),
  ('analysis', 'free', 10, NULL, 1, '财报分析'),
  ('analysis', 'pro', 50, NULL, 1, '财报分析'),
  ('analysis', 'elite', NULL, NULL, 1, '财报分析'),
  ('pdf_export', 'guest', 0, NULL, 0, 'PDF导出'),
  ('pdf_export', 'free', 3, NULL, 1, 'PDF导出'),
  ('pdf_export', 'pro', 50, NULL, 1, 'PDF导出'),
  ('pdf_export', 'elite', NULL, NULL, 1, 'PDF导出'),
  ('ai_comic', 'guest', 0, NULL, 0, 'AI漫画解读'),
  ('ai_comic', 'free', 0, NULL, 0, 'AI漫画解读'),
  ('ai_comic', 'pro', 50, NULL, 1, 'AI漫画解读'),
  ('ai_comic', 'elite', NULL, NULL, 1, 'AI漫画解读'),
  ('industry_comparison', 'guest', 0, NULL, 0, '行业对比分析'),
  ('industry_comparison', 'free', 0, NULL, 0, '行业对比分析'),
  ('industry_comparison', 'pro', 50, NULL, 1, '行业对比分析'),
  ('industry_comparison', 'elite', NULL, NULL, 1, '行业对比分析'),
  ('favorite', 'guest', 0, NULL, 0, '收藏功能'),
  ('favorite', 'free', 100, NULL, 1, '收藏功能'),
  ('favorite', 'pro', 500, NULL, 1, '收藏功能'),
  ('favorite', 'elite', 1000, NULL, 1, '收藏功能');

CREATE INDEX IF NOT EXISTS idx_limits_feature ON feature_limits(feature);
CREATE INDEX IF NOT EXISTS idx_limits_tier ON feature_limits(tier);

-- =====================================================================
-- 第六部分: 模型评估系统
-- =====================================================================

-- 6.1 模型配置表
CREATE TABLE IF NOT EXISTS model_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_key TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  cost_per_1k_tokens REAL DEFAULT 0,
  max_tokens INTEGER DEFAULT 8192,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 预置模型配置
INSERT OR IGNORE INTO model_configs (model_key, model_name, display_name, provider, priority, cost_per_1k_tokens, description) VALUES
  ('gemini-2.5-pro', 'gemini-2.5-pro-preview', 'Gemini 2.5 Pro', 'google', 10, 0.00125, 'Google最新的Gemini 2.5 Pro模型'),
  ('gpt-4.1', 'gpt-4.1', 'GPT-4.1', 'openai', 9, 0.01, 'OpenAI GPT-4.1模型'),
  ('gpt-4o-mini', 'gpt-4o-mini-2025-08-07', 'GPT-4o Mini', 'openai', 8, 0.00015, 'OpenAI轻量级模型');

-- 6.2 模型评估结果表
CREATE TABLE IF NOT EXISTS model_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  model_key TEXT NOT NULL,
  latency_ms INTEGER,
  token_input INTEGER,
  token_output INTEGER,
  cost_usd REAL,
  json_valid BOOLEAN,
  fields_complete_rate REAL,
  response_length INTEGER,
  raw_response TEXT,
  error_message TEXT,
  auto_score REAL,
  data_accuracy REAL DEFAULT 0,
  insight_count INTEGER DEFAULT 0,
  risk_identified INTEGER DEFAULT 0,
  recommendation_count INTEGER DEFAULT 0,
  key_metrics_count INTEGER DEFAULT 0,
  content_score REAL DEFAULT 0,
  accuracy_score REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_model_evaluations_report ON model_evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_model_evaluations_model ON model_evaluations(model_key);
CREATE INDEX IF NOT EXISTS idx_model_evaluations_agent ON model_evaluations(agent_type);

-- 6.3 模型对比测试表
CREATE TABLE IF NOT EXISTS model_comparison_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  models_tested TEXT NOT NULL,
  agents_tested TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at DATETIME,
  completed_at DATETIME,
  summary_report TEXT,
  winner_model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_model_comparison_report ON model_comparison_tests(report_id);

-- 6.4 用户模型偏好表
CREATE TABLE IF NOT EXISTS user_model_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  default_model TEXT DEFAULT 'auto',
  agent_preferences TEXT,
  prefer_speed BOOLEAN DEFAULT false,
  prefer_quality BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- 6.5 模型统计汇总表
CREATE TABLE IF NOT EXISTS model_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_key TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  period TEXT NOT NULL,
  total_calls INTEGER DEFAULT 0,
  success_calls INTEGER DEFAULT 0,
  avg_latency_ms REAL,
  avg_cost_usd REAL,
  avg_auto_score REAL,
  avg_fields_complete_rate REAL,
  rank_by_speed INTEGER,
  rank_by_quality INTEGER,
  rank_by_cost INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_key, agent_type, period)
);

CREATE INDEX IF NOT EXISTS idx_model_statistics_period ON model_statistics(period);

-- =====================================================================
-- 第七部分: Agent Preset 系统
-- =====================================================================

-- 7.1 用户 Agent Preset 表
CREATE TABLE IF NOT EXISTS user_agent_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  preset_name TEXT NOT NULL,
  preset_config_json TEXT,
  preset_prompt_text TEXT,
  model_preference TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_presets_user_agent ON user_agent_presets(user_id, agent_type);
CREATE INDEX IF NOT EXISTS idx_presets_default ON user_agent_presets(user_id, agent_type, is_default);
CREATE INDEX IF NOT EXISTS idx_presets_usage ON user_agent_presets(user_id, use_count DESC);

-- 7.2 用户 Agent 设置表
CREATE TABLE IF NOT EXISTS user_agent_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  model_preference TEXT,
  default_preset_id INTEGER,
  auto_load_preset BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_preset_id) REFERENCES user_agent_presets(id) ON DELETE SET NULL,
  UNIQUE(user_id, agent_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_settings_user ON user_agent_settings(user_id);

-- 7.3 用户偏好设置表
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  default_report_type TEXT DEFAULT 'annual',
  analysis_depth TEXT DEFAULT 'standard',
  include_comic INTEGER DEFAULT 1,
  include_forecast INTEGER DEFAULT 1,
  include_industry_compare INTEGER DEFAULT 1,
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'zh-CN',
  chart_color_scheme TEXT DEFAULT 'gold',
  email_notifications INTEGER DEFAULT 1,
  report_complete_notify INTEGER DEFAULT 1,
  weekly_digest INTEGER DEFAULT 0,
  marketing_emails INTEGER DEFAULT 0,
  favorite_stocks TEXT,
  recent_searches TEXT,
  pinned_reports TEXT,
  api_key TEXT,
  custom_prompts TEXT,
  export_format TEXT DEFAULT 'pdf',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- 7.4 用户偏好变更历史
CREATE TABLE IF NOT EXISTS user_preferences_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  preference_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pref_history_user ON user_preferences_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pref_history_time ON user_preferences_history(changed_at);

-- =====================================================================
-- 完成
-- =====================================================================
