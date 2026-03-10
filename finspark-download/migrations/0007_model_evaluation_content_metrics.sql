-- 模型评估内容指标扩展
-- 增加洞察数量、风险识别数量、建议数量等内容指标

-- 为 model_evaluations 表添加新列
ALTER TABLE model_evaluations ADD COLUMN data_accuracy REAL DEFAULT 0;
ALTER TABLE model_evaluations ADD COLUMN insight_count INTEGER DEFAULT 0;
ALTER TABLE model_evaluations ADD COLUMN risk_identified INTEGER DEFAULT 0;
ALTER TABLE model_evaluations ADD COLUMN recommendation_count INTEGER DEFAULT 0;
ALTER TABLE model_evaluations ADD COLUMN key_metrics_count INTEGER DEFAULT 0;
ALTER TABLE model_evaluations ADD COLUMN content_score REAL DEFAULT 0;
ALTER TABLE model_evaluations ADD COLUMN accuracy_score REAL DEFAULT 0;

-- 为旧的列名创建兼容性视图（可选）
-- model_key -> model_name, token_input -> input_tokens, token_output -> output_tokens
