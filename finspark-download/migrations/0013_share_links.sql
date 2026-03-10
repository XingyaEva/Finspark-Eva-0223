-- 分享链接表
-- 用于存储报告分享链接和访问统计

CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  share_code TEXT UNIQUE NOT NULL,     -- 短链接码 (8-12位)
  created_by INTEGER,                   -- 创建者用户ID (可为空表示访客)
  expires_at DATETIME,                  -- 过期时间 (null表示永不过期)
  is_active INTEGER DEFAULT 1,          -- 是否激活
  view_count INTEGER DEFAULT 0,         -- 查看次数
  last_viewed_at DATETIME,              -- 最后查看时间
  settings_json TEXT,                   -- 分享设置 (JSON格式)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_share_code ON share_links(share_code);
CREATE INDEX IF NOT EXISTS idx_share_report ON share_links(report_id);
CREATE INDEX IF NOT EXISTS idx_share_active ON share_links(is_active, expires_at);

-- 分享访问记录表 (用于统计分析)
CREATE TABLE IF NOT EXISTS share_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL,
  visitor_ip TEXT,
  visitor_ua TEXT,                      -- User Agent
  referrer TEXT,
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (share_link_id) REFERENCES share_links(id)
);

CREATE INDEX IF NOT EXISTS idx_share_access_link ON share_access_logs(share_link_id);
CREATE INDEX IF NOT EXISTS idx_share_access_time ON share_access_logs(accessed_at);
