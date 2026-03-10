-- 为股票表添加 stock_type 字段以支持 A股/港股/美股区分
-- 版本: v3.0
-- 日期: 2026-01-16
-- 说明: 支持全量 A 股数据同步 (5400+)

-- 添加 stock_type 字段
ALTER TABLE stocks ADD COLUMN stock_type TEXT DEFAULT 'A';

-- 添加港股相关字段（为将来港股接入做准备）
ALTER TABLE stocks ADD COLUMN lot_size INTEGER DEFAULT 100;       -- 每手股数
ALTER TABLE stocks ADD COLUMN hk_stock_connect INTEGER DEFAULT 0;  -- 是否港股通标的

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stocks_stock_type ON stocks(stock_type);
CREATE INDEX IF NOT EXISTS idx_stocks_hk_connect ON stocks(hk_stock_connect);

-- 更新现有数据的 stock_type
UPDATE stocks SET stock_type = 'A' WHERE stock_type IS NULL;

-- 根据代码后缀自动判断类型
UPDATE stocks SET stock_type = 'A' WHERE ts_code LIKE '%.SH' OR ts_code LIKE '%.SZ' OR ts_code LIKE '%.BJ';
UPDATE stocks SET stock_type = 'HK' WHERE ts_code LIKE '%.HK';
