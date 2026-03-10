-- 0011_favorite_groups.sql
-- Finspark 收藏分组系统

-- ============================================
-- 1. 收藏分组表
-- ============================================

CREATE TABLE IF NOT EXISTS favorite_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,              -- 分组名称
  description TEXT,                -- 分组描述
  color TEXT DEFAULT '#d4af37',    -- 分组颜色（用于UI展示）
  icon TEXT DEFAULT 'folder',      -- 分组图标
  sort_order INTEGER DEFAULT 0,    -- 排序顺序
  is_default INTEGER DEFAULT 0,    -- 是否为默认分组
  item_count INTEGER DEFAULT 0,    -- 分组内收藏数量（缓存）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)            -- 同一用户不能有重名分组
);

CREATE INDEX IF NOT EXISTS idx_favorite_groups_user ON favorite_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_groups_order ON favorite_groups(user_id, sort_order);

-- ============================================
-- 2. 扩展用户收藏表 - 添加分组关联
-- ============================================

-- 添加分组ID字段
ALTER TABLE user_favorites ADD COLUMN group_id INTEGER DEFAULT NULL;
ALTER TABLE user_favorites ADD COLUMN sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_favorites_group ON user_favorites(group_id);
CREATE INDEX IF NOT EXISTS idx_favorites_sort ON user_favorites(user_id, sort_order);

-- ============================================
-- 3. 为每个已有用户创建默认分组
-- ============================================

-- 注意：这个操作需要在应用层执行，因为SQLite不支持触发器中使用子查询插入
-- 在用户首次访问收藏功能时，应用层会自动创建默认分组
