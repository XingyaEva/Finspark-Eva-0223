-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  stock_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  notes TEXT,                           -- 用户备注
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, stock_code)           -- 同一用户不能重复收藏
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_stock ON user_favorites(stock_code);

-- 漫画数据表
CREATE TABLE IF NOT EXISTS comic_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,           -- 关联的分析报告ID
  user_id INTEGER,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  style TEXT DEFAULT 'modern',          -- modern/classic/minimal
  summary TEXT,                         -- 漫画总结文本
  panels_json TEXT,                     -- 漫画面板JSON数据
  status TEXT DEFAULT 'pending',        -- pending/generating/completed/failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comic_report ON comic_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_comic_user ON comic_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_comic_status ON comic_reports(status);

-- 用户会话/刷新令牌表（用于JWT刷新）
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  device_info TEXT,                     -- 设备信息
  ip_address TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- 更新分析报告表，添加漫画生成状态
ALTER TABLE analysis_reports ADD COLUMN comic_status TEXT DEFAULT NULL;
ALTER TABLE analysis_reports ADD COLUMN comic_id INTEGER DEFAULT NULL;

-- 添加用户索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
