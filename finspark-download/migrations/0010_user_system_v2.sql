-- 0010_user_system_v2.sql
-- Finspark 用户体系 v2 - 完整的用户管理系统

-- ============================================
-- 1. 扩展用户表 - 支持会员等级和详细信息
-- ============================================

-- 添加用户等级相关字段
ALTER TABLE users ADD COLUMN membership_tier TEXT DEFAULT 'free';  -- guest/free/pro/elite
ALTER TABLE users ADD COLUMN membership_expires_at DATETIME DEFAULT NULL;  -- 会员到期时间
ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL;  -- 手机号（可选）
ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT NULL;  -- 昵称
ALTER TABLE users ADD COLUMN avatar_type TEXT DEFAULT 'default';  -- default/upload/wechat/alipay
ALTER TABLE users ADD COLUMN daily_analysis_count INTEGER DEFAULT 0;  -- 今日分析次数
ALTER TABLE users ADD COLUMN daily_analysis_date TEXT DEFAULT NULL;  -- 今日日期（用于重置计数）
ALTER TABLE users ADD COLUMN total_analysis_count INTEGER DEFAULT 0;  -- 总分析次数
ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL;  -- 最后登录时间
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;  -- 登录次数
ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0;  -- 邮箱是否已验证
ALTER TABLE users ADD COLUMN verification_token TEXT DEFAULT NULL;  -- 邮箱验证token
ALTER TABLE users ADD COLUMN verification_expires_at DATETIME DEFAULT NULL;  -- 验证token过期时间
ALTER TABLE users ADD COLUMN password_reset_token TEXT DEFAULT NULL;  -- 密码重置token
ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME DEFAULT NULL;  -- 重置token过期时间

-- ============================================
-- 2. 第三方认证绑定表
-- ============================================

CREATE TABLE IF NOT EXISTS user_auth_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,  -- wechat/alipay/google/apple
  provider_user_id TEXT NOT NULL,  -- 第三方平台用户ID
  provider_openid TEXT,  -- 微信openid（如果有）
  provider_unionid TEXT,  -- 微信unionid（如果有）
  provider_nickname TEXT,  -- 第三方昵称
  provider_avatar TEXT,  -- 第三方头像URL
  access_token TEXT,  -- 访问token（加密存储）
  refresh_token TEXT,  -- 刷新token（加密存储）
  token_expires_at DATETIME,  -- token过期时间
  raw_profile TEXT,  -- 原始用户资料JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_bindings_user ON user_auth_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_bindings_provider ON user_auth_bindings(provider, provider_user_id);

-- ============================================
-- 3. 访客会话表 - 追踪未登录用户
-- ============================================

CREATE TABLE IF NOT EXISTS guest_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL UNIQUE,  -- 设备指纹
  ip_address TEXT,  -- IP地址
  user_agent TEXT,  -- 浏览器信息
  device_type TEXT DEFAULT 'unknown',  -- desktop/mobile/tablet
  analysis_count INTEGER DEFAULT 0,  -- 分析次数
  last_analysis_at DATETIME,  -- 最后分析时间
  first_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 首次访问时间
  last_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 最后访问时间
  converted_to_user_id INTEGER DEFAULT NULL,  -- 转化为注册用户的ID
  converted_at DATETIME DEFAULT NULL,  -- 转化时间
  metadata TEXT DEFAULT NULL,  -- 额外元数据JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_fingerprint ON guest_sessions(fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_converted ON guest_sessions(converted_to_user_id);

-- ============================================
-- 4. 会员订单表 - 支付与会员管理
-- ============================================

CREATE TABLE IF NOT EXISTS membership_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_no TEXT NOT NULL UNIQUE,  -- 订单号
  tier TEXT NOT NULL,  -- pro/elite
  duration_months INTEGER NOT NULL,  -- 购买时长（月）
  amount_cents INTEGER NOT NULL,  -- 金额（分）
  currency TEXT DEFAULT 'CNY',  -- 货币
  payment_method TEXT,  -- wechat/alipay/stripe
  payment_status TEXT DEFAULT 'pending',  -- pending/paid/failed/refunded/cancelled
  payment_id TEXT,  -- 第三方支付ID
  payment_time DATETIME,  -- 支付时间
  membership_start DATETIME,  -- 会员开始时间
  membership_end DATETIME,  -- 会员结束时间
  invoice_info TEXT,  -- 发票信息JSON
  notes TEXT,  -- 备注
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON membership_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON membership_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON membership_orders(payment_status);

-- ============================================
-- 5. 扩展用户收藏表 - 添加更多收藏类型
-- ============================================

-- 添加收藏类型字段（报告收藏、股票收藏）
ALTER TABLE user_favorites ADD COLUMN favorite_type TEXT DEFAULT 'stock';  -- stock/report
ALTER TABLE user_favorites ADD COLUMN report_id INTEGER DEFAULT NULL;  -- 关联的报告ID
ALTER TABLE user_favorites ADD COLUMN tags TEXT DEFAULT NULL;  -- 标签JSON数组
ALTER TABLE user_favorites ADD COLUMN is_pinned INTEGER DEFAULT 0;  -- 是否置顶
ALTER TABLE user_favorites ADD COLUMN last_viewed_at DATETIME DEFAULT NULL;  -- 最后查看时间

CREATE INDEX IF NOT EXISTS idx_favorites_type ON user_favorites(favorite_type);
CREATE INDEX IF NOT EXISTS idx_favorites_report ON user_favorites(report_id);

-- ============================================
-- 6. 扩展分析报告表 - 用户关联与软删除
-- ============================================

-- 添加软删除和用户关联字段
ALTER TABLE analysis_reports ADD COLUMN is_deleted INTEGER DEFAULT 0;  -- 软删除
ALTER TABLE analysis_reports ADD COLUMN deleted_at DATETIME DEFAULT NULL;  -- 删除时间
ALTER TABLE analysis_reports ADD COLUMN view_count INTEGER DEFAULT 0;  -- 查看次数
ALTER TABLE analysis_reports ADD COLUMN share_count INTEGER DEFAULT 0;  -- 分享次数
ALTER TABLE analysis_reports ADD COLUMN favorite_count INTEGER DEFAULT 0;  -- 收藏次数
ALTER TABLE analysis_reports ADD COLUMN health_score INTEGER DEFAULT NULL;  -- 财务健康评分
ALTER TABLE analysis_reports ADD COLUMN key_conclusions TEXT DEFAULT NULL;  -- 关键结论JSON
ALTER TABLE analysis_reports ADD COLUMN guest_fingerprint TEXT DEFAULT NULL;  -- 访客指纹（未登录时）

CREATE INDEX IF NOT EXISTS idx_reports_deleted ON analysis_reports(is_deleted);
CREATE INDEX IF NOT EXISTS idx_reports_guest ON analysis_reports(guest_fingerprint);

-- ============================================
-- 7. 用户操作日志表 - 审计与分析
-- ============================================

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,  -- 可为空（访客）
  guest_fingerprint TEXT,  -- 访客指纹
  action_type TEXT NOT NULL,  -- login/logout/register/analyze/favorite/export/view_comic/etc
  action_target TEXT,  -- 操作对象（如股票代码、报告ID）
  action_detail TEXT,  -- 操作详情JSON
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_guest ON user_activity_logs(guest_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_time ON user_activity_logs(created_at);

-- ============================================
-- 8. 邮件验证码表 - 邮箱登录验证
-- ============================================

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,  -- register/login/reset_password
  attempts INTEGER DEFAULT 0,  -- 尝试次数
  is_used INTEGER DEFAULT 0,  -- 是否已使用
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_codes_expires ON email_verification_codes(expires_at);

-- ============================================
-- 9. 用户配置表 - 个性化设置
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  theme TEXT DEFAULT 'light',  -- light/dark/auto
  language TEXT DEFAULT 'zh-CN',  -- zh-CN/en-US
  default_comic_style TEXT DEFAULT 'creative',  -- comic生成默认风格
  default_character_set TEXT DEFAULT 'nezha-movie',  -- 默认IP角色
  notification_email INTEGER DEFAULT 1,  -- 是否接收邮件通知
  notification_analysis INTEGER DEFAULT 1,  -- 分析完成通知
  notification_promotion INTEGER DEFAULT 0,  -- 促销通知
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);
