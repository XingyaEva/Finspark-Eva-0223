-- 财务数据持久化存储表
-- 用于存储从Tushare同步的财务数据，支持Text-to-SQL和RAG

-- 1. 利润表 (Income Statement)
CREATE TABLE IF NOT EXISTS income_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,                    -- 股票代码
  ann_date TEXT,                            -- 公告日期
  end_date TEXT NOT NULL,                   -- 报告期
  report_type TEXT,                         -- 报告类型 (1合并报表 2单季合并)
  
  -- 核心利润指标
  total_revenue REAL,                       -- 营业总收入
  revenue REAL,                             -- 营业收入
  total_cogs REAL,                          -- 营业总成本
  operate_cost REAL,                        -- 营业成本
  sell_exp REAL,                            -- 销售费用
  admin_exp REAL,                           -- 管理费用
  fin_exp REAL,                             -- 财务费用
  rd_exp REAL,                              -- 研发费用
  operate_profit REAL,                      -- 营业利润
  total_profit REAL,                        -- 利润总额
  income_tax REAL,                          -- 所得税费用
  n_income REAL,                            -- 净利润
  n_income_attr_p REAL,                     -- 归属于母公司股东的净利润
  basic_eps REAL,                           -- 基本每股收益
  diluted_eps REAL,                         -- 稀释每股收益
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ts_code, end_date, report_type)
);

-- 2. 资产负债表 (Balance Sheet)
CREATE TABLE IF NOT EXISTS balance_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  report_type TEXT,
  
  -- 资产类
  total_assets REAL,                        -- 总资产
  total_cur_assets REAL,                    -- 流动资产合计
  money_cap REAL,                           -- 货币资金
  notes_receiv REAL,                        -- 应收票据
  accounts_receiv REAL,                     -- 应收账款
  inventories REAL,                         -- 存货
  total_nca REAL,                           -- 非流动资产合计
  fix_assets REAL,                          -- 固定资产
  intan_assets REAL,                        -- 无形资产
  goodwill REAL,                            -- 商誉
  
  -- 负债类
  total_liab REAL,                          -- 负债合计
  total_cur_liab REAL,                      -- 流动负债合计
  notes_payable REAL,                       -- 应付票据
  acct_payable REAL,                        -- 应付账款
  adv_receipts REAL,                        -- 预收款项
  total_ncl REAL,                           -- 非流动负债合计
  lt_borr REAL,                             -- 长期借款
  bond_payable REAL,                        -- 应付债券
  
  -- 所有者权益
  total_hldr_eqy_exc_min_int REAL,          -- 归属于母公司股东权益
  minority_int REAL,                        -- 少数股东权益
  total_hldr_eqy_inc_min_int REAL,          -- 股东权益合计
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ts_code, end_date, report_type)
);

-- 3. 现金流量表 (Cash Flow)
CREATE TABLE IF NOT EXISTS cash_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  report_type TEXT,
  
  -- 经营活动现金流
  n_cashflow_act REAL,                      -- 经营活动产生的现金流量净额
  c_fr_sale_sg REAL,                        -- 销售商品、提供劳务收到的现金
  c_paid_goods_s REAL,                      -- 购买商品、接受劳务支付的现金
  c_paid_to_for_empl REAL,                  -- 支付给职工的现金
  c_paid_for_taxes REAL,                    -- 支付的税费
  
  -- 投资活动现金流
  n_cashflow_inv_act REAL,                  -- 投资活动产生的现金流量净额
  c_pay_acq_const_fiolta REAL,              -- 购建固定资产等支付的现金
  c_recp_disp_fiolta REAL,                  -- 处置固定资产等收到的现金
  
  -- 筹资活动现金流
  n_cash_flows_fnc_act REAL,                -- 筹资活动产生的现金流量净额
  c_recp_borrow REAL,                       -- 取得借款收到的现金
  c_prepay_amt_borr REAL,                   -- 偿还债务支付的现金
  c_pay_dist_dpcp_int_exp REAL,             -- 分配股利、利润支付的现金
  
  -- 汇总
  n_incr_cash_cash_equ REAL,                -- 现金及现金等价物净增加额
  free_cashflow REAL,                       -- 自由现金流 (计算值)
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ts_code, end_date, report_type)
);

-- 4. 财务指标 (Financial Indicators)
CREATE TABLE IF NOT EXISTS fina_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  ann_date TEXT,
  end_date TEXT NOT NULL,
  
  -- 盈利能力
  grossprofit_margin REAL,                  -- 毛利率 (%)
  netprofit_margin REAL,                    -- 净利率 (%)
  roe REAL,                                 -- 净资产收益率 (%)
  roe_dt REAL,                              -- 净资产收益率(扣除/摊薄)
  roa REAL,                                 -- 总资产报酬率 (%)
  
  -- 成长能力
  netprofit_yoy REAL,                       -- 净利润同比增长率 (%)
  or_yoy REAL,                              -- 营业收入同比增长率 (%)
  op_yoy REAL,                              -- 营业利润同比增长率 (%)
  assets_yoy REAL,                          -- 总资产同比增长率 (%)
  
  -- 偿债能力
  debt_to_assets REAL,                      -- 资产负债率 (%)
  current_ratio REAL,                       -- 流动比率
  quick_ratio REAL,                         -- 速动比率
  
  -- 营运能力
  assets_turn REAL,                         -- 总资产周转率
  inv_turn REAL,                            -- 存货周转率
  ar_turn REAL,                             -- 应收账款周转率
  
  -- 每股指标
  eps REAL,                                 -- 每股收益
  bps REAL,                                 -- 每股净资产
  cfps REAL,                                -- 每股经营现金流
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ts_code, end_date)
);

-- 5. 日线行情数据 (Daily Quotes)
CREATE TABLE IF NOT EXISTS daily_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  trade_date TEXT NOT NULL,                 -- 交易日期 YYYYMMDD
  
  -- 价格数据
  open REAL,                                -- 开盘价
  high REAL,                                -- 最高价
  low REAL,                                 -- 最低价
  close REAL,                               -- 收盘价
  pre_close REAL,                           -- 昨收价
  change REAL,                              -- 涨跌额
  pct_chg REAL,                             -- 涨跌幅 (%)
  
  -- 成交数据
  vol REAL,                                 -- 成交量 (手)
  amount REAL,                              -- 成交额 (千元)
  
  -- 估值数据 (来自daily_basic)
  turnover_rate REAL,                       -- 换手率 (%)
  pe REAL,                                  -- 市盈率
  pe_ttm REAL,                              -- 市盈率TTM
  pb REAL,                                  -- 市净率
  ps REAL,                                  -- 市销率
  ps_ttm REAL,                              -- 市销率TTM
  total_share REAL,                         -- 总股本 (万股)
  float_share REAL,                         -- 流通股本 (万股)
  total_mv REAL,                            -- 总市值 (万元)
  circ_mv REAL,                             -- 流通市值 (万元)
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ts_code, trade_date)
);

-- 6. 数据同步记录表
CREATE TABLE IF NOT EXISTS data_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_code TEXT NOT NULL,
  data_type TEXT NOT NULL,                  -- income/balance/cashflow/fina/daily
  sync_date TEXT NOT NULL,                  -- 同步日期
  records_count INTEGER DEFAULT 0,          -- 同步记录数
  status TEXT DEFAULT 'success',            -- success/failed
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_income_ts_code ON income_statements(ts_code);
CREATE INDEX IF NOT EXISTS idx_income_end_date ON income_statements(end_date);
CREATE INDEX IF NOT EXISTS idx_balance_ts_code ON balance_sheets(ts_code);
CREATE INDEX IF NOT EXISTS idx_balance_end_date ON balance_sheets(end_date);
CREATE INDEX IF NOT EXISTS idx_cashflow_ts_code ON cash_flows(ts_code);
CREATE INDEX IF NOT EXISTS idx_cashflow_end_date ON cash_flows(end_date);
CREATE INDEX IF NOT EXISTS idx_fina_ts_code ON fina_indicators(ts_code);
CREATE INDEX IF NOT EXISTS idx_fina_end_date ON fina_indicators(end_date);
CREATE INDEX IF NOT EXISTS idx_daily_ts_code ON daily_quotes(ts_code);
CREATE INDEX IF NOT EXISTS idx_daily_trade_date ON daily_quotes(trade_date);
CREATE INDEX IF NOT EXISTS idx_daily_ts_trade ON daily_quotes(ts_code, trade_date);
