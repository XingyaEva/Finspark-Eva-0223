-- 0024_rag_platform_config.sql
-- Phase 2: 平台配置管理
-- 关联页面: P.11 模型配置, P.12 Prompt 模板管理, P.13 系统配置

-- ========================================
-- 模型配置
-- ========================================
CREATE TABLE IF NOT EXISTS rag_model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usage TEXT NOT NULL UNIQUE,             -- 'embedding' / 'rag_chat' / 'rerank' / 'intent' / 'question_gen' / 'eval_scoring'
    provider TEXT NOT NULL,                 -- 'dashscope' / 'vectorengine' / 'openai'
    model_name TEXT NOT NULL,
    api_key_ref TEXT,                       -- 环境变量名引用 (e.g. 'DASHSCOPE_API_KEY')
    base_url TEXT,
    extra_config TEXT DEFAULT '{}',         -- 额外配置 JSON (dimensions, temperature, batch_size 等)
    is_active INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- ========================================
-- Prompt 模板
-- ========================================
CREATE TABLE IF NOT EXISTS rag_prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_key TEXT NOT NULL UNIQUE,       -- 'RAG_QA' / 'INTENT_CLASSIFY' / 'QUERY_REWRITE' / 'RERANK' / 'QUESTION_GEN' / 'EVAL_SCORING' / 'TABLE_SERIALIZE' / 'COMPARATIVE_SPLIT'
    display_name TEXT NOT NULL,
    description TEXT,
    usage_context TEXT,                      -- 使用场景说明
    variables TEXT DEFAULT '[]',             -- 模板变量列表 JSON
    current_version_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now')),
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- ========================================
-- Prompt 版本历史
-- ========================================
CREATE TABLE IF NOT EXISTS rag_prompt_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version_label TEXT NOT NULL,             -- 'v1.0', 'v2.1' 等
    content TEXT NOT NULL,                   -- Prompt 文本内容
    change_note TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_ver_template ON rag_prompt_versions(template_id);

-- ========================================
-- 系统全局配置
-- ========================================
CREATE TABLE IF NOT EXISTS rag_system_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type TEXT DEFAULT 'string',       -- string / number / boolean / json
    description TEXT,
    category TEXT DEFAULT 'general',         -- general / rag / security / storage / debug
    updated_at DATETIME DEFAULT (datetime('now'))
);

-- ========================================
-- 插入默认模型配置
-- ========================================
INSERT OR IGNORE INTO rag_model_configs (usage, provider, model_name, api_key_ref, base_url, extra_config) VALUES
    ('embedding', 'dashscope', 'text-embedding-v4', 'DASHSCOPE_API_KEY', 'https://dashscope.aliyuncs.com/compatible-mode/v1', '{"dimensions":1024,"batch_size":10}'),
    ('rag_chat', 'vectorengine', 'gpt-4.1', 'VECTORENGINE_API_KEY', 'https://api.vectorengine.ai/v1', '{"temperature":0.1,"max_tokens":2000}'),
    ('rerank', 'vectorengine', 'gpt-4.1', 'VECTORENGINE_API_KEY', 'https://api.vectorengine.ai/v1', '{"temperature":0.1}'),
    ('intent', 'vectorengine', 'gpt-4.1', 'VECTORENGINE_API_KEY', 'https://api.vectorengine.ai/v1', '{"temperature":0.1}'),
    ('question_gen', 'vectorengine', 'gpt-4.1', 'VECTORENGINE_API_KEY', 'https://api.vectorengine.ai/v1', '{"temperature":0.7}'),
    ('eval_scoring', 'vectorengine', 'gpt-4.1', 'VECTORENGINE_API_KEY', 'https://api.vectorengine.ai/v1', '{"temperature":0.3}');

-- ========================================
-- 插入默认 Prompt 模板
-- ========================================
INSERT OR IGNORE INTO rag_prompt_templates (template_key, display_name, description, usage_context, variables) VALUES
    ('RAG_QA', 'RAG 问答 System Prompt', '对话助手的 System Prompt', '用于 RAG 增强问答生成回答', '["context","question"]'),
    ('INTENT_CLASSIFY', '意图识别 Prompt', 'Query 意图分类与实体提取', '用于识别用户问题的意图类型', '["question"]'),
    ('QUERY_REWRITE', 'Query 改写 Prompt', '改写模糊/不完整的用户查询', '用于优化检索效果', '["question","intent_type"]'),
    ('RERANK', 'LLM 重排 Prompt', '对检索结果进行相关性重排', '用于提升检索精度', '["question","chunk_content"]'),
    ('QUESTION_GEN', '测试题生成 Prompt', '基于文档内容生成测试题', '用于自动生成测试集', '["chunk_content","question_type","difficulty"]'),
    ('EVAL_SCORING', '评测打分 Prompt', '对模型回答进行语义打分', '用于评估 RAG 回答质量', '["question","expected_answer","model_answer"]'),
    ('TABLE_SERIALIZE', '表格序列化 Prompt', '将表格转为自然语言描述', '用于表格类 Chunk 处理', '["table_content"]'),
    ('COMPARATIVE_SPLIT', '比较题拆分 Prompt', '将比较类问题拆分为子问题', '用于比较类意图处理', '["question","entities"]');

-- ========================================
-- 插入默认系统配置
-- ========================================
INSERT OR IGNORE INTO rag_system_configs (config_key, config_value, config_type, description, category) VALUES
    ('default_search_strategy', 'hybrid', 'string', '默认检索策略: vector / bm25 / hybrid', 'rag'),
    ('default_top_k', '5', 'number', '默认检索 Top-K', 'rag'),
    ('default_min_score', '0.25', 'number', '默认最低相关度阈值', 'rag'),
    ('default_chunk_size', '500', 'number', '默认分块大小 (字符)', 'rag'),
    ('default_overlap', '100', 'number', '默认分块重叠 (字符)', 'rag'),
    ('default_chunk_strategy', 'recursive', 'string', '默认切片策略: recursive / token / paragraph / page / markdown', 'rag'),
    ('rerank_weight', '0.7', 'number', 'LLM 重排权重', 'rag'),
    ('max_document_size_mb', '50', 'number', '单文档最大大小 (MB)', 'security'),
    ('max_document_chars', '500000', 'number', '单文档最大字符数', 'security'),
    ('max_documents_per_user', '200', 'number', '每用户最大文档数', 'security'),
    ('max_chunks_per_user', '50000', 'number', '每用户最大 Chunk 数', 'security'),
    ('enable_user_isolation', 'true', 'boolean', '启用用户文档隔离', 'security'),
    ('enable_content_moderation', 'false', 'boolean', '启用问答内容审核', 'security'),
    ('enable_rate_limiting', 'true', 'boolean', '启用速率限制', 'security'),
    ('rate_limit_per_minute', '30', 'number', '每用户每分钟最大问答次数', 'security'),
    ('enable_debug_log', 'true', 'boolean', '开启调试日志', 'debug'),
    ('enable_latency_tracking', 'true', 'boolean', '开启耗时追踪', 'debug'),
    ('enable_dry_run', 'false', 'boolean', '开启 dry-run 模式', 'debug');
