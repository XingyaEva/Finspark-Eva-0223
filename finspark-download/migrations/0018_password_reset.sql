-- 密码重置功能 - 添加 reset_token 字段
-- 用于忘记密码功能的 token 存储

ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL;

-- 为 reset_token 添加索引以加速查询
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
