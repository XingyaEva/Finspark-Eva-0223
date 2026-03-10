-- Phase 1: Agent Preset 系统
-- 支持用户自定义每个 Agent 的 Preset（参数配置 + Prompt + 模型偏好）

-- ============================================
-- 用户 Agent Preset 表
-- ============================================
CREATE TABLE IF NOT EXISTS user_agent_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,           -- Agent 类型: PROFITABILITY, RISK, etc.
  preset_name TEXT NOT NULL,          -- 用户自定义名称
  preset_config_json TEXT,            -- L1 结构化参数 (JSON)
  preset_prompt_text TEXT,            -- L2/L3 高级 Prompt 文本
  model_preference TEXT,              -- 模型偏好标签 (可为空，与 Preset 解耦)
  is_default BOOLEAN DEFAULT FALSE,   -- 是否为该 Agent 的默认 Preset
  use_count INTEGER DEFAULT 0,        -- 使用次数统计
  last_used_at DATETIME,              -- 最近使用时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引：按用户和 Agent 类型查询
CREATE INDEX IF NOT EXISTS idx_presets_user_agent ON user_agent_presets(user_id, agent_type);

-- 索引：查找默认 Preset
CREATE INDEX IF NOT EXISTS idx_presets_default ON user_agent_presets(user_id, agent_type, is_default);

-- 索引：按使用次数排序
CREATE INDEX IF NOT EXISTS idx_presets_usage ON user_agent_presets(user_id, use_count DESC);


-- ============================================
-- 用户 Agent 级别设置表（轻量，与 Preset 解耦）
-- ============================================
CREATE TABLE IF NOT EXISTS user_agent_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,           -- Agent 类型
  model_preference TEXT,              -- 单独的模型偏好设置 (可不创建 Preset 直接设置)
  default_preset_id INTEGER,          -- 关联的默认 Preset ID (可为空)
  auto_load_preset BOOLEAN DEFAULT TRUE, -- 分析时是否自动加载默认 Preset
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_preset_id) REFERENCES user_agent_presets(id) ON DELETE SET NULL,
  UNIQUE(user_id, agent_type)
);

-- 索引：按用户查询所有 Agent 设置
CREATE INDEX IF NOT EXISTS idx_agent_settings_user ON user_agent_settings(user_id);


-- ============================================
-- 触发器：更新 updated_at 时间戳
-- ============================================

-- Preset 表更新触发器
CREATE TRIGGER IF NOT EXISTS trigger_presets_updated_at
AFTER UPDATE ON user_agent_presets
FOR EACH ROW
BEGIN
  UPDATE user_agent_presets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Settings 表更新触发器
CREATE TRIGGER IF NOT EXISTS trigger_settings_updated_at
AFTER UPDATE ON user_agent_settings
FOR EACH ROW
BEGIN
  UPDATE user_agent_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


-- ============================================
-- 约束：确保每个用户每个 Agent 只有一个默认 Preset
-- (通过应用层逻辑保证，SQLite 不支持部分唯一索引)
-- ============================================

-- 注：设置默认 Preset 时，需要先将该用户该 Agent 的其他 Preset 的 is_default 设为 FALSE
