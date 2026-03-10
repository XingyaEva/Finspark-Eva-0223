-- 模型评估系统数据库表
-- 支持多模型A/B测试和对比评估

-- 1. 模型配置表
CREATE TABLE IF NOT EXISTS model_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_key TEXT NOT NULL UNIQUE,        -- 'gemini-2.5-pro', 'gpt-4.1', 'gpt-4o-mini'
  model_name TEXT NOT NULL,              -- VectorEngine API 模型名称
  display_name TEXT NOT NULL,            -- 显示名称
  provider TEXT NOT NULL,                -- 'google', 'openai'
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,            -- 优先级，数字越大越优先
  cost_per_1k_tokens REAL DEFAULT 0,     -- 每1000 token成本（美元）
  max_tokens INTEGER DEFAULT 8192,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 模型评估结果表（每次Agent调用记录）
CREATE TABLE IF NOT EXISTS model_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,              -- 'PROFITABILITY', 'BALANCE_SHEET', 'RISK' 等
  model_key TEXT NOT NULL,
  
  -- 性能指标
  latency_ms INTEGER,                    -- 响应时间（毫秒）
  token_input INTEGER,                   -- 输入token数
  token_output INTEGER,                  -- 输出token数
  cost_usd REAL,                         -- 成本（美元）
  
  -- 质量指标
  json_valid BOOLEAN,                    -- JSON格式是否正确
  fields_complete_rate REAL,             -- 必填字段完整率 (0-1)
  response_length INTEGER,               -- 响应长度（字符数）
  
  -- 原始数据
  raw_response TEXT,                     -- 原始响应（JSON字符串）
  error_message TEXT,                    -- 错误信息（如果有）
  
  -- 自动评估分数
  auto_score REAL,                       -- 综合自动评分 (0-100)
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id)
);

-- 3. 模型对比测试表（一次对比测试包含多个模型的评估）
CREATE TABLE IF NOT EXISTS model_comparison_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  company_code TEXT NOT NULL,
  company_name TEXT NOT NULL,
  
  -- 测试配置
  models_tested TEXT NOT NULL,           -- JSON数组: ["gemini-2.5-pro", "gpt-4.1", "gpt-4o-mini"]
  agents_tested TEXT NOT NULL,           -- JSON数组: ["PROFITABILITY", "BALANCE_SHEET", ...]
  
  -- 测试状态
  status TEXT DEFAULT 'pending',         -- pending, running, completed, failed
  started_at DATETIME,
  completed_at DATETIME,
  
  -- 汇总结果
  summary_report TEXT,                   -- JSON: 综合评估报告
  winner_model TEXT,                     -- 获胜模型
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (report_id) REFERENCES analysis_reports(id)
);

-- 4. 用户模型偏好表
CREATE TABLE IF NOT EXISTS user_model_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  
  -- 默认模型
  default_model TEXT DEFAULT 'auto',     -- 'auto', 'gemini-2.5-pro', 'gpt-4.1', etc.
  
  -- Agent级别偏好（JSON）
  agent_preferences TEXT,                -- {"PROFITABILITY": "gpt-4.1", "RISK": "gemini-2.5-pro"}
  
  -- 偏好设置
  prefer_speed BOOLEAN DEFAULT false,
  prefer_quality BOOLEAN DEFAULT true,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- 5. 模型统计汇总表（定期更新）
CREATE TABLE IF NOT EXISTS model_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_key TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  period TEXT NOT NULL,                  -- '2025-01', '2025-01-03' 等
  
  -- 汇总统计
  total_calls INTEGER DEFAULT 0,
  success_calls INTEGER DEFAULT 0,
  avg_latency_ms REAL,
  avg_cost_usd REAL,
  avg_auto_score REAL,
  avg_fields_complete_rate REAL,
  
  -- 排名
  rank_by_speed INTEGER,
  rank_by_quality INTEGER,
  rank_by_cost INTEGER,
  
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(model_key, agent_type, period)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_model_evaluations_report ON model_evaluations(report_id);
CREATE INDEX IF NOT EXISTS idx_model_evaluations_model ON model_evaluations(model_key);
CREATE INDEX IF NOT EXISTS idx_model_evaluations_agent ON model_evaluations(agent_type);
CREATE INDEX IF NOT EXISTS idx_model_comparison_report ON model_comparison_tests(report_id);
CREATE INDEX IF NOT EXISTS idx_model_statistics_period ON model_statistics(period);

-- 插入默认模型配置
INSERT OR IGNORE INTO model_configs (model_key, model_name, display_name, provider, priority, cost_per_1k_tokens, description) VALUES
  ('gemini-2.5-pro', 'gemini-2.5-pro-preview', 'Gemini 2.5 Pro', 'google', 10, 0.00125, 'Google最新的Gemini 2.5 Pro模型，擅长复杂推理'),
  ('gpt-4.1', 'gpt-4.1', 'GPT-4.1', 'openai', 9, 0.01, 'OpenAI GPT-4.1模型，强大的语言理解能力'),
  ('gpt-4o-mini', 'gpt-4o-mini-2025-08-07', 'GPT-4o Mini', 'openai', 8, 0.00015, 'OpenAI轻量级模型，速度快成本低');
