-- 用户偏好设置表
-- 存储用户的个性化设置，包括分析偏好、界面主题、通知设置等

CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,         -- 用户ID，一对一关系
  
  -- 分析偏好
  default_report_type TEXT DEFAULT 'annual',    -- 默认报告类型 (annual/quarterly/all)
  analysis_depth TEXT DEFAULT 'standard',       -- 分析深度 (quick/standard/deep)
  include_comic INTEGER DEFAULT 1,              -- 默认包含漫画解读
  include_forecast INTEGER DEFAULT 1,           -- 默认包含业绩预测
  include_industry_compare INTEGER DEFAULT 1,   -- 默认包含行业对比
  
  -- 界面主题
  theme TEXT DEFAULT 'dark',                    -- 主题 (dark/light/auto)
  language TEXT DEFAULT 'zh-CN',                -- 语言
  chart_color_scheme TEXT DEFAULT 'gold',       -- 图表配色 (gold/blue/green/purple)
  
  -- 通知设置
  email_notifications INTEGER DEFAULT 1,        -- 邮件通知
  report_complete_notify INTEGER DEFAULT 1,     -- 报告完成通知
  weekly_digest INTEGER DEFAULT 0,              -- 每周摘要
  marketing_emails INTEGER DEFAULT 0,           -- 营销邮件
  
  -- 快捷设置
  favorite_stocks TEXT,                         -- 常用股票代码 (JSON数组)
  recent_searches TEXT,                         -- 最近搜索 (JSON数组)
  pinned_reports TEXT,                          -- 置顶报告ID (JSON数组)
  
  -- 高级设置
  api_key TEXT,                                 -- 用户自定义API Key (加密存储)
  custom_prompts TEXT,                          -- 自定义提示词 (JSON对象)
  export_format TEXT DEFAULT 'pdf',             -- 默认导出格式 (pdf/html/json)
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- 用户偏好变更历史（用于审计和回滚）
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
