-- 0004_comic_ip_character.sql
-- 为漫画报告添加IP角色和输出格式字段支持

-- 添加角色集ID字段
ALTER TABLE comic_reports ADD COLUMN character_set_id TEXT DEFAULT 'nezha-movie';

-- 添加主角ID字段
ALTER TABLE comic_reports ADD COLUMN main_character_id TEXT DEFAULT 'nezha';

-- 添加输出格式字段（grid/vertical-scroll）
ALTER TABLE comic_reports ADD COLUMN output_format TEXT DEFAULT 'grid';

-- 添加角色相关索引
CREATE INDEX IF NOT EXISTS idx_comic_character_set ON comic_reports(character_set_id);
CREATE INDEX IF NOT EXISTS idx_comic_character ON comic_reports(main_character_id);
