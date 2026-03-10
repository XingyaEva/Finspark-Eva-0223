-- Finspark 会员方案系统
-- 版本: 0012
-- 描述: 会员方案配置表和订单历史表

-- ============================================
-- 1. 会员方案表
-- ============================================
CREATE TABLE IF NOT EXISTS membership_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,              -- 方案代码 (pro_monthly, elite_yearly)
  name TEXT NOT NULL,                     -- 显示名称
  tier TEXT NOT NULL,                     -- 会员等级 (pro / elite)
  duration_months INTEGER NOT NULL,       -- 时长（月）
  original_price_cents INTEGER NOT NULL,  -- 原价（分）
  current_price_cents INTEGER NOT NULL,   -- 现价（分）
  currency TEXT DEFAULT 'CNY',            -- 货币类型
  features TEXT NOT NULL,                 -- 功能列表 JSON
  highlight TEXT,                         -- 推荐亮点
  is_recommended INTEGER DEFAULT 0,       -- 是否推荐（主推方案）
  is_active INTEGER DEFAULT 1,            -- 是否上架
  sort_order INTEGER DEFAULT 0,           -- 排序权重
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_plans_tier ON membership_plans(tier);
CREATE INDEX IF NOT EXISTS idx_plans_active ON membership_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_sort ON membership_plans(sort_order);

-- ============================================
-- 2. 预置会员方案数据
-- ============================================
INSERT OR IGNORE INTO membership_plans (code, name, tier, duration_months, original_price_cents, current_price_cents, features, highlight, is_recommended, sort_order)
VALUES 
  -- Pro 会员
  ('pro_monthly', 'Pro 月度会员', 'pro', 1, 4900, 2900, 
   '["每日50次分析","AI漫画解读","专业风险评估","行业对比分析","PDF无水印导出","500个收藏位"]', 
   NULL, 0, 1),
  
  ('pro_yearly', 'Pro 年度会员', 'pro', 12, 58800, 29900, 
   '["每日50次分析","AI漫画解读","专业风险评估","行业对比分析","PDF无水印导出","500个收藏位","年省近300元"]', 
   '最受欢迎', 1, 2),
  
  -- Elite 会员
  ('elite_monthly', 'Elite 月度会员', 'elite', 1, 9900, 6900, 
   '["无限分析次数","全部Pro功能","批量分析","API访问权限","1000个收藏位","优先客服支持"]', 
   NULL, 0, 3),
  
  ('elite_yearly', 'Elite 年度会员', 'elite', 12, 118800, 69900, 
   '["无限分析次数","全部Pro功能","批量分析","API访问权限","1000个收藏位","优先客服支持","年省近600元"]', 
   '性价比之选', 0, 4);

-- ============================================
-- 3. 会员订单表（支付集成后启用）
-- ============================================
CREATE TABLE IF NOT EXISTS membership_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_no TEXT NOT NULL UNIQUE,          -- 订单号
  plan_code TEXT NOT NULL,                -- 方案代码
  plan_name TEXT NOT NULL,                -- 方案名称（快照）
  tier TEXT NOT NULL,                     -- 会员等级
  duration_months INTEGER NOT NULL,       -- 购买时长
  amount_cents INTEGER NOT NULL,          -- 支付金额（分）
  currency TEXT DEFAULT 'CNY',
  
  -- 支付信息
  payment_method TEXT,                    -- 支付方式 (wechat/alipay/manual)
  payment_status TEXT DEFAULT 'pending',  -- pending/paid/failed/refunded
  payment_id TEXT,                        -- 第三方支付订单号
  payment_time DATETIME,                  -- 支付时间
  
  -- 会员期限
  membership_start DATETIME,              -- 会员开始时间
  membership_end DATETIME,                -- 会员结束时间
  
  -- 其他
  invoice_info TEXT,                      -- 发票信息 JSON
  notes TEXT,                             -- 备注
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 订单索引
CREATE INDEX IF NOT EXISTS idx_orders_user ON membership_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_no ON membership_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON membership_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_time ON membership_orders(created_at);

-- ============================================
-- 4. 会员权益使用记录表
-- ============================================
CREATE TABLE IF NOT EXISTS membership_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  feature TEXT NOT NULL,                  -- 功能标识 (analysis/comic/pdf_export等)
  usage_date DATE NOT NULL,               -- 使用日期
  usage_count INTEGER DEFAULT 1,          -- 当日使用次数
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, feature, usage_date)
);

-- 使用记录索引
CREATE INDEX IF NOT EXISTS idx_usage_user ON membership_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_date ON membership_usage_logs(usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_feature ON membership_usage_logs(feature);

-- ============================================
-- 5. 功能权益配置表
-- ============================================
CREATE TABLE IF NOT EXISTS feature_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature TEXT NOT NULL,                  -- 功能标识
  tier TEXT NOT NULL,                     -- 会员等级
  daily_limit INTEGER,                    -- 每日限制 (NULL=无限制)
  monthly_limit INTEGER,                  -- 每月限制 (NULL=无限制)
  is_enabled INTEGER DEFAULT 1,           -- 是否开启
  description TEXT,                       -- 功能描述
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(feature, tier)
);

-- 预置功能权益配置
INSERT OR IGNORE INTO feature_limits (feature, tier, daily_limit, monthly_limit, is_enabled, description)
VALUES
  -- 分析次数
  ('analysis', 'guest', 3, NULL, 1, '财报分析'),
  ('analysis', 'free', 10, NULL, 1, '财报分析'),
  ('analysis', 'pro', 50, NULL, 1, '财报分析'),
  ('analysis', 'elite', NULL, NULL, 1, '财报分析'),
  
  -- PDF导出
  ('pdf_export', 'guest', 0, NULL, 0, 'PDF导出'),
  ('pdf_export', 'free', 3, NULL, 1, 'PDF导出'),
  ('pdf_export', 'pro', 50, NULL, 1, 'PDF导出'),
  ('pdf_export', 'elite', NULL, NULL, 1, 'PDF导出'),
  
  -- AI漫画
  ('ai_comic', 'guest', 0, NULL, 0, 'AI漫画解读'),
  ('ai_comic', 'free', 0, NULL, 0, 'AI漫画解读'),
  ('ai_comic', 'pro', 50, NULL, 1, 'AI漫画解读'),
  ('ai_comic', 'elite', NULL, NULL, 1, 'AI漫画解读'),
  
  -- 行业对比
  ('industry_comparison', 'guest', 0, NULL, 0, '行业对比分析'),
  ('industry_comparison', 'free', 0, NULL, 0, '行业对比分析'),
  ('industry_comparison', 'pro', 50, NULL, 1, '行业对比分析'),
  ('industry_comparison', 'elite', NULL, NULL, 1, '行业对比分析'),
  
  -- 收藏数量
  ('favorite', 'guest', 0, NULL, 0, '收藏功能'),
  ('favorite', 'free', 100, NULL, 1, '收藏功能'),
  ('favorite', 'pro', 500, NULL, 1, '收藏功能'),
  ('favorite', 'elite', 1000, NULL, 1, '收藏功能');

CREATE INDEX IF NOT EXISTS idx_limits_feature ON feature_limits(feature);
CREATE INDEX IF NOT EXISTS idx_limits_tier ON feature_limits(tier);
