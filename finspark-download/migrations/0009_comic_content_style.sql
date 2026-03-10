-- 0009_comic_content_style.sql
-- 为漫画报告添加内容风格字段支持

-- 添加内容风格字段
ALTER TABLE comic_reports ADD COLUMN content_style TEXT DEFAULT 'creative';

-- 添加内容风格索引
CREATE INDEX IF NOT EXISTS idx_comic_content_style ON comic_reports(content_style);
