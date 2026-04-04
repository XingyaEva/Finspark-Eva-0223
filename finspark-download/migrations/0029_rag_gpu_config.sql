-- 0029_rag_gpu_config.sql
-- GPU 自托管服务器配置 + 模型路由 + A/B 测试日志
-- 用于记录 GPU 服务状态和 A/B 测试比较结果

-- GPU A/B 测试日志表（比较 GPU vs Cloud 模型回答质量）
CREATE TABLE IF NOT EXISTS rag_ab_test_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  question TEXT NOT NULL,
  -- GPU 结果
  gpu_model TEXT,
  gpu_answer TEXT,
  gpu_latency_ms INTEGER DEFAULT 0,
  gpu_input_tokens INTEGER DEFAULT 0,
  gpu_output_tokens INTEGER DEFAULT 0,
  -- Cloud 结果
  cloud_model TEXT,
  cloud_answer TEXT,
  cloud_latency_ms INTEGER DEFAULT 0,
  cloud_input_tokens INTEGER DEFAULT 0,
  cloud_output_tokens INTEGER DEFAULT 0,
  -- 选择
  selected_provider TEXT DEFAULT 'cloud',  -- 'gpu' | 'cloud'
  -- 评价（可手动/自动评分）
  gpu_score REAL,
  cloud_score REAL,
  evaluation_note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 向 rag_system_configs 插入 GPU 相关默认配置
INSERT OR IGNORE INTO rag_system_configs (config_key, config_value, config_type, description, category)
VALUES 
  ('gpu_server_url', '', 'string', 'GPU 服务器统一入口 URL (Nginx 反向代理)', 'gpu'),
  ('gpu_llm_model', 'qwen3-14b', 'string', 'GPU LLM 模型名称', 'gpu'),
  ('gpu_routing_mode', 'recommended', 'string', '路由模式: recommended/all_gpu/all_cloud', 'gpu'),
  ('gpu_enabled', 'false', 'boolean', '是否启用 GPU 自托管服务', 'gpu'),
  ('gpu_ab_test_enabled', 'false', 'boolean', '是否启用 A/B 测试（回答生成: Qwen vs GPT）', 'gpu');

-- 向 rag_model_configs 插入 GPU 模型配置
INSERT OR IGNORE INTO rag_model_configs (usage, provider, model_name, api_key_ref, base_url, extra_config, is_active)
VALUES
  ('gpu_llm', 'self-hosted', 'qwen3-14b', NULL, '', '{"type":"vLLM","quantization":"AWQ","vram_gb":10}', 0),
  ('gpu_embedding', 'self-hosted', 'bge-m3', NULL, '', '{"type":"FlagEmbedding","dimensions":1024,"vram_gb":3}', 0),
  ('gpu_reranker', 'self-hosted', 'bge-reranker-v2-m3', NULL, '', '{"type":"FlagReranker","vram_gb":2}', 0);
