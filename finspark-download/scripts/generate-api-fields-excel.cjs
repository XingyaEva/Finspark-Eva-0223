// 生成 Tushare API 字段详情 Excel 文件
const XLSX = require('xlsx');
const path = require('path');

// Tushare 接口字段详情
const apiFieldsData = [
  // ========== 1. 利润表 income ==========
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'ann_date',
    字段中文名: '公告日期',
    数据类型: 'string',
    示例值: '20251030',
    字段说明: '财报公告日期，格式YYYYMMDD',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'f_ann_date',
    字段中文名: '实际公告日期',
    数据类型: 'string',
    示例值: '20251030',
    字段说明: '实际公告日期',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20250930',
    字段说明: '报告期截止日期，格式YYYYMMDD',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'report_type',
    字段中文名: '报告类型',
    数据类型: 'string',
    示例值: '1',
    字段说明: '1=合并报表，2=单季报',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'basic_eps',
    字段中文名: '基本每股收益',
    数据类型: 'number',
    示例值: '48.49',
    字段说明: '基本每股收益(元/股)',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'diluted_eps',
    字段中文名: '稀释每股收益',
    数据类型: 'number',
    示例值: '48.49',
    字段说明: '稀释每股收益(元/股)',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'total_revenue',
    字段中文名: '营业总收入',
    数据类型: 'number',
    示例值: '136286000000',
    字段说明: '营业总收入(元)',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'revenue',
    字段中文名: '营业收入',
    数据类型: 'number',
    示例值: '133619000000',
    字段说明: '营业收入(元)',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'total_cogs',
    字段中文名: '营业总成本',
    数据类型: 'number',
    示例值: '45000000000',
    字段说明: '营业总成本(元)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'oper_cost',
    字段中文名: '营业成本',
    数据类型: 'number',
    示例值: '11200000000',
    字段说明: '营业成本(元)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'sell_exp',
    字段中文名: '销售费用',
    数据类型: 'number',
    示例值: '3860000000',
    字段说明: '销售费用(元)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'admin_exp',
    字段中文名: '管理费用',
    数据类型: 'number',
    示例值: '9510000000',
    字段说明: '管理费用(元)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'rd_exp',
    字段中文名: '研发费用',
    数据类型: 'number',
    示例值: '520000000',
    字段说明: '研发费用(元)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'fin_exp',
    字段中文名: '财务费用',
    数据类型: 'number',
    示例值: '-2470000000',
    字段说明: '财务费用(元)，负数表示利息收入',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'operate_profit',
    字段中文名: '营业利润',
    数据类型: 'number',
    示例值: '81200000000',
    字段说明: '营业利润(元)',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'n_income',
    字段中文名: '净利润',
    数据类型: 'number',
    示例值: '60930000000',
    字段说明: '净利润(元)',
    使用Agent: 'PLANNING, PROFITABILITY'
  },
  {
    接口名称: 'income',
    中文名称: '利润表',
    字段名: 'n_income_attr_p',
    字段中文名: '归母净利润',
    数据类型: 'number',
    示例值: '60500000000',
    字段说明: '归属于母公司所有者的净利润(元)',
    使用Agent: 'PROFITABILITY'
  },

  // ========== 2. 资产负债表 balancesheet ==========
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'ann_date',
    字段中文名: '公告日期',
    数据类型: 'string',
    示例值: '20251030',
    字段说明: '财报公告日期',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20250930',
    字段说明: '报告期截止日期',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'report_type',
    字段中文名: '报告类型',
    数据类型: 'string',
    示例值: '1',
    字段说明: '1=合并报表',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'total_assets',
    字段中文名: '总资产',
    数据类型: 'number',
    示例值: '304738000000',
    字段说明: '资产总计(元)',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'total_liab',
    字段中文名: '总负债',
    数据类型: 'number',
    示例值: '39033000000',
    字段说明: '负债合计(元)',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'total_hldr_eqy_exc_min_int',
    字段中文名: '股东权益(不含少数股东)',
    数据类型: 'number',
    示例值: '257070000000',
    字段说明: '股东权益合计(不含少数股东权益)(元)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'money_cap',
    字段中文名: '货币资金',
    数据类型: 'number',
    示例值: '51753000000',
    字段说明: '货币资金(元)',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'accounts_receiv',
    字段中文名: '应收账款',
    数据类型: 'number',
    示例值: '25530000',
    字段说明: '应收账款(元)',
    使用Agent: 'PLANNING, BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'inventories',
    字段中文名: '存货',
    数据类型: 'number',
    示例值: '55859000000',
    字段说明: '存货(元)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'fix_assets',
    字段中文名: '固定资产',
    数据类型: 'number',
    示例值: '18500000000',
    字段说明: '固定资产(元)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'st_borr',
    字段中文名: '短期借款',
    数据类型: 'number',
    示例值: '0',
    字段说明: '短期借款(元)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'lt_borr',
    字段中文名: '长期借款',
    数据类型: 'number',
    示例值: '0',
    字段说明: '长期借款(元)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'balancesheet',
    中文名称: '资产负债表',
    字段名: 'accounts_pay',
    字段中文名: '应付账款',
    数据类型: 'number',
    示例值: '2822000000',
    字段说明: '应付账款(元)',
    使用Agent: 'BALANCE_SHEET'
  },

  // ========== 3. 现金流量表 cashflow ==========
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'PLANNING, CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'ann_date',
    字段中文名: '公告日期',
    数据类型: 'string',
    示例值: '20251030',
    字段说明: '财报公告日期',
    使用Agent: 'PLANNING, CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20250930',
    字段说明: '报告期截止日期',
    使用Agent: 'PLANNING, CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'report_type',
    字段中文名: '报告类型',
    数据类型: 'string',
    示例值: '1',
    字段说明: '1=合并报表',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'n_cashflow_act',
    字段中文名: '经营活动现金流净额',
    数据类型: 'number',
    示例值: '52890000000',
    字段说明: '经营活动产生的现金流量净额(元)',
    使用Agent: 'PLANNING, CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'n_cashflow_inv_act',
    字段中文名: '投资活动现金流净额',
    数据类型: 'number',
    示例值: '-8500000000',
    字段说明: '投资活动产生的现金流量净额(元)',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'n_cash_flows_fnc_act',
    字段中文名: '筹资活动现金流净额',
    数据类型: 'number',
    示例值: '-35000000000',
    字段说明: '筹资活动产生的现金流量净额(元)',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'c_pay_acq_const_fiam',
    字段中文名: '购建固定资产支付现金',
    数据类型: 'number',
    示例值: '2500000000',
    字段说明: '购建固定资产、无形资产支付的现金(元)',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'c_paid_for_assets',
    字段中文名: '购置资产支付现金',
    数据类型: 'number',
    示例值: '3200000000',
    字段说明: '购置长期资产支付的现金(元)',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'cashflow',
    中文名称: '现金流量表',
    字段名: 'free_cashflow',
    字段中文名: '自由现金流',
    数据类型: 'number',
    示例值: '48500000000',
    字段说明: '企业自由现金流(元)',
    使用Agent: 'PLANNING, CASH_FLOW'
  },

  // ========== 4. 财务指标 fina_indicator ==========
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'PROFITABILITY, BALANCE_SHEET, CASH_FLOW, FORECAST, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'ann_date',
    字段中文名: '公告日期',
    数据类型: 'string',
    示例值: '20251030',
    字段说明: '财报公告日期',
    使用Agent: 'PROFITABILITY, BALANCE_SHEET, CASH_FLOW, FORECAST, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20250930',
    字段说明: '报告期截止日期',
    使用Agent: 'PROFITABILITY, BALANCE_SHEET, CASH_FLOW, FORECAST, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'eps',
    字段中文名: '基本每股收益',
    数据类型: 'number',
    示例值: '51.53',
    字段说明: '基本每股收益(元)',
    使用Agent: 'PROFITABILITY, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'dt_eps',
    字段中文名: '稀释每股收益',
    数据类型: 'number',
    示例值: '51.53',
    字段说明: '稀释每股收益(元)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'bps',
    字段中文名: '每股净资产',
    数据类型: 'number',
    示例值: '195.53',
    字段说明: '每股净资产(元)',
    使用Agent: 'PROFITABILITY, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'ocfps',
    字段中文名: '每股经营现金流',
    数据类型: 'number',
    示例值: '42.15',
    字段说明: '每股经营活动产生的现金流量净额(元)',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'roe',
    字段中文名: '净资产收益率',
    数据类型: 'number',
    示例值: '26.37',
    字段说明: '净资产收益率(%)',
    使用Agent: 'PROFITABILITY, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'roe_waa',
    字段中文名: '加权ROE',
    数据类型: 'number',
    示例值: '27.15',
    字段说明: '加权平均净资产收益率(%)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'roe_dt',
    字段中文名: '扣非ROE',
    数据类型: 'number',
    示例值: '25.89',
    字段说明: '净资产收益率(扣除非经常性损益)(%)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'roa',
    字段中文名: '总资产收益率',
    数据类型: 'number',
    示例值: '22.39',
    字段说明: '总资产报酬率(%)',
    使用Agent: 'PROFITABILITY, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'gross_margin',
    字段中文名: '毛利率',
    数据类型: 'number',
    示例值: '91.54',
    字段说明: '销售毛利率(%)',
    使用Agent: 'PROFITABILITY, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'netprofit_margin',
    字段中文名: '净利率',
    数据类型: 'number',
    示例值: '52.08',
    字段说明: '销售净利率(%)',
    使用Agent: 'PROFITABILITY, VALUATION'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'current_ratio',
    字段中文名: '流动比率',
    数据类型: 'number',
    示例值: '6.62',
    字段说明: '流动比率',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'quick_ratio',
    字段中文名: '速动比率',
    数据类型: 'number',
    示例值: '5.18',
    字段说明: '速动比率',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'cash_ratio',
    字段中文名: '现金比率',
    数据类型: 'number',
    示例值: '1.47',
    字段说明: '现金比率',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'debt_to_assets',
    字段中文名: '资产负债率',
    数据类型: 'number',
    示例值: '12.81',
    字段说明: '资产负债率(%)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'debt_to_eqt',
    字段中文名: '产权比率',
    数据类型: 'number',
    示例值: '14.69',
    字段说明: '产权比率(%)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'ar_turn',
    字段中文名: '应收账款周转率',
    数据类型: 'number',
    示例值: '5772.43',
    字段说明: '应收账款周转率(次)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'ca_turn',
    字段中文名: '流动资产周转率',
    数据类型: 'number',
    示例值: '0.5151',
    字段说明: '流动资产周转率(次)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'fa_turn',
    字段中文名: '固定资产周转率',
    数据类型: 'number',
    示例值: '6.0826',
    字段说明: '固定资产周转率(次)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'assets_turn',
    字段中文名: '总资产周转率',
    数据类型: 'number',
    示例值: '0.4337',
    字段说明: '总资产周转率(次)',
    使用Agent: 'BALANCE_SHEET'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'op_yoy',
    字段中文名: '营业利润同比',
    数据类型: 'number',
    示例值: '6.85',
    字段说明: '营业利润同比增长率(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'ebt_yoy',
    字段中文名: '利润总额同比',
    数据类型: 'number',
    示例值: '6.52',
    字段说明: '利润总额同比增长率(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'netprofit_yoy',
    字段中文名: '净利润同比',
    数据类型: 'number',
    示例值: '6.25',
    字段说明: '净利润同比增长率(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'tr_yoy',
    字段中文名: '营业总收入同比',
    数据类型: 'number',
    示例值: '6.36',
    字段说明: '营业总收入同比增长率(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'or_yoy',
    字段中文名: '营业收入同比',
    数据类型: 'number',
    示例值: '6.36',
    字段说明: '营业收入同比增长率(%)',
    使用Agent: 'PROFITABILITY, FORECAST'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'saleexp_to_gr',
    字段中文名: '销售费用率',
    数据类型: 'number',
    示例值: '2.89',
    字段说明: '销售费用/营业总收入(%)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'adminexp_of_gr',
    字段中文名: '管理费用率',
    数据类型: 'number',
    示例值: '7.12',
    字段说明: '管理费用/营业总收入(%)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'finaexp_of_gr',
    字段中文名: '财务费用率',
    数据类型: 'number',
    示例值: '-1.85',
    字段说明: '财务费用/营业总收入(%)',
    使用Agent: 'PROFITABILITY'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'fcff',
    字段中文名: '企业自由现金流',
    数据类型: 'number',
    示例值: '48500000000',
    字段说明: '企业自由现金流量(元)',
    使用Agent: 'CASH_FLOW'
  },
  {
    接口名称: 'fina_indicator',
    中文名称: '财务指标',
    字段名: 'fcfe',
    字段中文名: '股权自由现金流',
    数据类型: 'number',
    示例值: '46200000000',
    字段说明: '股权自由现金流量(元)',
    使用Agent: 'CASH_FLOW'
  },

  // ========== 5. 主营业务构成 fina_mainbz ==========
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20250630',
    字段说明: '报告期截止日期',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'bz_item',
    字段中文名: '业务项目',
    数据类型: 'string',
    示例值: '茅台酒',
    字段说明: '主营业务项目名称',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'bz_code',
    字段中文名: '项目代码',
    数据类型: 'string',
    示例值: 'P001',
    字段说明: '主营业务项目代码',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'bz_sales',
    字段中文名: '主营业务收入',
    数据类型: 'number',
    示例值: '75590000000',
    字段说明: '主营业务收入(元)',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'bz_profit',
    字段中文名: '主营业务利润',
    数据类型: 'number',
    示例值: '68500000000',
    字段说明: '主营业务利润(元)',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'bz_cost',
    字段中文名: '主营业务成本',
    数据类型: 'number',
    示例值: '7090000000',
    字段说明: '主营业务成本(元)',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },
  {
    接口名称: 'fina_mainbz',
    中文名称: '主营业务构成',
    字段名: 'curr_type',
    字段中文名: '货币代码',
    数据类型: 'string',
    示例值: 'CNY',
    字段说明: '货币代码',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL'
  },

  // ========== 6. 业绩预告 forecast ==========
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'ann_date',
    字段中文名: '公告日期',
    数据类型: 'string',
    示例值: '20241030',
    字段说明: '业绩预告公告日期',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20241231',
    字段说明: '预告报告期',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'type',
    字段中文名: '预告类型',
    数据类型: 'string',
    示例值: '略增',
    字段说明: '预增/预减/扭亏/首亏/续亏/续盈/略增/略减',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'p_change_min',
    字段中文名: '净利润变动下限',
    数据类型: 'number',
    示例值: '14.5',
    字段说明: '预计净利润变动幅度下限(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'p_change_max',
    字段中文名: '净利润变动上限',
    数据类型: 'number',
    示例值: '14.85',
    字段说明: '预计净利润变动幅度上限(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'net_profit_min',
    字段中文名: '预计净利润下限',
    数据类型: 'number',
    示例值: '84500000',
    字段说明: '预计净利润下限(万元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'net_profit_max',
    字段中文名: '预计净利润上限',
    数据类型: 'number',
    示例值: '86200000',
    字段说明: '预计净利润上限(万元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'last_parent_net',
    字段中文名: '上年同期归母净利润',
    数据类型: 'number',
    示例值: '73740000',
    字段说明: '上年同期归属母公司净利润(万元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'first_ann_date',
    字段中文名: '首次公告日',
    数据类型: 'string',
    示例值: '20241030',
    字段说明: '首次公告日期',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'summary',
    字段中文名: '业绩摘要',
    数据类型: 'string',
    示例值: '公司预计2024年度净利润同比增长约14.67%',
    字段说明: '业绩预告摘要说明',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'forecast',
    中文名称: '业绩预告',
    字段名: 'change_reason',
    字段中文名: '变动原因',
    数据类型: 'string',
    示例值: '品牌优势持续强化，直销渠道占比提升',
    字段说明: '业绩变动原因说明',
    使用Agent: 'FORECAST'
  },

  // ========== 7. 业绩快报 express ==========
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'ann_date',
    字段中文名: '公告日期',
    数据类型: 'string',
    示例值: '20250128',
    字段说明: '业绩快报公告日期',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'end_date',
    字段中文名: '报告期',
    数据类型: 'string',
    示例值: '20241231',
    字段说明: '快报报告期',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'revenue',
    字段中文名: '营业收入',
    数据类型: 'number',
    示例值: '172060000000',
    字段说明: '营业收入(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'operate_profit',
    字段中文名: '营业利润',
    数据类型: 'number',
    示例值: '112035000000',
    字段说明: '营业利润(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'total_profit',
    字段中文名: '利润总额',
    数据类型: 'number',
    示例值: '110500000000',
    字段说明: '利润总额(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'n_income',
    字段中文名: '净利润',
    数据类型: 'number',
    示例值: '86228000000',
    字段说明: '净利润(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'total_assets',
    字段中文名: '总资产',
    数据类型: 'number',
    示例值: '310000000000',
    字段说明: '总资产(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'total_hldr_eqy_exc_min_int',
    字段中文名: '股东权益',
    数据类型: 'number',
    示例值: '265000000000',
    字段说明: '股东权益合计(不含少数股东权益)(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'diluted_eps',
    字段中文名: '稀释每股收益',
    数据类型: 'number',
    示例值: '68.65',
    字段说明: '稀释每股收益(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'diluted_roe',
    字段中文名: '摊薄ROE',
    数据类型: 'number',
    示例值: '34.52',
    字段说明: '摊薄净资产收益率(%)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'yoy_net_profit',
    字段中文名: '去年同期净利润',
    数据类型: 'number',
    示例值: '75260000000',
    字段说明: '去年同期净利润(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'bps',
    字段中文名: '每股净资产',
    数据类型: 'number',
    示例值: '198.85',
    字段说明: '每股净资产(元)',
    使用Agent: 'FORECAST'
  },
  {
    接口名称: 'express',
    中文名称: '业绩快报',
    字段名: 'perf_summary',
    字段中文名: '业绩说明',
    数据类型: 'string',
    示例值: '公司全年业绩稳健增长',
    字段说明: '业绩简要说明',
    使用Agent: 'FORECAST'
  },

  // ========== 8. 每日指标 daily_basic ==========
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'ts_code',
    字段中文名: '股票代码',
    数据类型: 'string',
    示例值: '600519.SH',
    字段说明: '股票唯一标识符',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'trade_date',
    字段中文名: '交易日期',
    数据类型: 'string',
    示例值: '20251220',
    字段说明: '交易日期',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'close',
    字段中文名: '收盘价',
    数据类型: 'number',
    示例值: '1422',
    字段说明: '当日收盘价(元)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'turnover_rate',
    字段中文名: '换手率',
    数据类型: 'number',
    示例值: '0.1914',
    字段说明: '换手率(%)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'volume_ratio',
    字段中文名: '量比',
    数据类型: 'number',
    示例值: '0.71',
    字段说明: '量比',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'pe',
    字段中文名: '市盈率(静态)',
    数据类型: 'number',
    示例值: '20.53',
    字段说明: '市盈率(静态)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'pe_ttm',
    字段中文名: '市盈率(TTM)',
    数据类型: 'number',
    示例值: '19.78',
    字段说明: '市盈率(TTM，滚动12个月)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'pb',
    字段中文名: '市净率',
    数据类型: 'number',
    示例值: '6.93',
    字段说明: '市净率',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'ps',
    字段中文名: '市销率(静态)',
    数据类型: 'number',
    示例值: '10.35',
    字段说明: '市销率(静态)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'ps_ttm',
    字段中文名: '市销率(TTM)',
    数据类型: 'number',
    示例值: '9.97',
    字段说明: '市销率(TTM)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'dv_ratio',
    字段中文名: '股息率(静态)',
    数据类型: 'number',
    示例值: '2.65',
    字段说明: '股息率(静态)(%)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'dv_ttm',
    字段中文名: '股息率(TTM)',
    数据类型: 'number',
    示例值: '2.85',
    字段说明: '股息率(TTM)(%)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'total_share',
    字段中文名: '总股本',
    数据类型: 'number',
    示例值: '1256197800',
    字段说明: '总股本(股)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'float_share',
    字段中文名: '流通股本',
    数据类型: 'number',
    示例值: '1256197800',
    字段说明: '流通股本(股)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'free_share',
    字段中文名: '自由流通股本',
    数据类型: 'number',
    示例值: '800000000',
    字段说明: '自由流通股本(股)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'total_mv',
    字段中文名: '总市值',
    数据类型: 'number',
    示例值: '178072800',
    字段说明: '总市值(万元)',
    使用Agent: 'VALUATION'
  },
  {
    接口名称: 'daily_basic',
    中文名称: '每日指标',
    字段名: 'circ_mv',
    字段中文名: '流通市值',
    数据类型: 'number',
    示例值: '178072800',
    字段说明: '流通市值(万元)',
    使用Agent: 'VALUATION'
  }
];

// 创建工作簿
const workbook = XLSX.utils.book_new();

// 1. 创建详细字段表
const detailSheet = XLSX.utils.json_to_sheet(apiFieldsData);
detailSheet['!cols'] = [
  { wch: 15 },  // 接口名称
  { wch: 15 },  // 中文名称
  { wch: 25 },  // 字段名
  { wch: 20 },  // 字段中文名
  { wch: 10 },  // 数据类型
  { wch: 25 },  // 示例值
  { wch: 40 },  // 字段说明
  { wch: 50 }   // 使用Agent
];
XLSX.utils.book_append_sheet(workbook, detailSheet, 'API字段详情');

// 2. 创建接口汇总表
const apiSummary = [
  { 
    接口名称: 'income', 
    中文名称: '利润表', 
    字段数量: 18,
    主要字段: 'ts_code, ann_date, end_date, total_revenue, revenue, n_income, basic_eps, operate_profit, sell_exp, admin_exp, rd_exp, fin_exp',
    使用Agent: 'PLANNING, PROFITABILITY',
    数据说明: '提供公司营收、利润、费用等损益数据，用于盈利能力分析'
  },
  { 
    接口名称: 'balancesheet', 
    中文名称: '资产负债表', 
    字段数量: 14,
    主要字段: 'ts_code, ann_date, end_date, total_assets, total_liab, money_cap, inventories, accounts_receiv, fix_assets, st_borr, lt_borr',
    使用Agent: 'PLANNING, BALANCE_SHEET',
    数据说明: '提供公司资产、负债、权益等财务状况数据，用于财务健康分析'
  },
  { 
    接口名称: 'cashflow', 
    中文名称: '现金流量表', 
    字段数量: 10,
    主要字段: 'ts_code, ann_date, end_date, n_cashflow_act, n_cashflow_inv_act, n_cash_flows_fnc_act, free_cashflow',
    使用Agent: 'PLANNING, CASH_FLOW',
    数据说明: '提供经营、投资、筹资三大现金流数据，用于现金流质量分析'
  },
  { 
    接口名称: 'fina_indicator', 
    中文名称: '财务指标', 
    字段数量: 32,
    主要字段: 'roe, roa, gross_margin, netprofit_margin, current_ratio, quick_ratio, debt_to_assets, ar_turn, assets_turn, netprofit_yoy, fcff',
    使用Agent: 'PROFITABILITY, BALANCE_SHEET, CASH_FLOW, FORECAST, VALUATION',
    数据说明: '提供计算好的财务比率指标，包括盈利、偿债、运营、成长能力等'
  },
  { 
    接口名称: 'fina_mainbz', 
    中文名称: '主营业务构成', 
    字段数量: 8,
    主要字段: 'ts_code, end_date, bz_item, bz_sales, bz_profit, bz_cost',
    使用Agent: 'BUSINESS_INSIGHT, BUSINESS_MODEL',
    数据说明: '提供按产品/地区分类的收入、利润、成本数据，用于业务结构分析'
  },
  { 
    接口名称: 'forecast', 
    中文名称: '业绩预告', 
    字段数量: 12,
    主要字段: 'ts_code, ann_date, end_date, type, p_change_min, p_change_max, net_profit_min, net_profit_max, summary, change_reason',
    使用Agent: 'FORECAST',
    数据说明: '提供管理层发布的业绩预告数据，是预测未来业绩的重要依据'
  },
  { 
    接口名称: 'express', 
    中文名称: '业绩快报', 
    字段数量: 14,
    主要字段: 'ts_code, ann_date, end_date, revenue, n_income, diluted_eps, diluted_roe, perf_summary',
    使用Agent: 'FORECAST',
    数据说明: '提供正式财报发布前的业绩快报数据，是财报的预览版'
  },
  { 
    接口名称: 'daily_basic', 
    中文名称: '每日指标', 
    字段数量: 17,
    主要字段: 'ts_code, trade_date, close, pe_ttm, pb, ps_ttm, turnover_rate, volume_ratio, total_mv, dv_ttm',
    使用Agent: 'VALUATION',
    数据说明: '提供每日估值指标，包括PE/PB/PS/市值/换手率等，用于估值分析'
  }
];

const summarySheet = XLSX.utils.json_to_sheet(apiSummary);
summarySheet['!cols'] = [
  { wch: 15 },
  { wch: 15 },
  { wch: 10 },
  { wch: 80 },
  { wch: 50 },
  { wch: 60 }
];
XLSX.utils.book_append_sheet(workbook, summarySheet, '接口汇总');

// 3. 按接口分组的表格
const apis = ['income', 'balancesheet', 'cashflow', 'fina_indicator', 'fina_mainbz', 'forecast', 'express', 'daily_basic'];
apis.forEach(apiName => {
  const apiData = apiFieldsData.filter(item => item.接口名称 === apiName);
  const sheet = XLSX.utils.json_to_sheet(apiData.map(item => ({
    字段名: item.字段名,
    中文名: item.字段中文名,
    类型: item.数据类型,
    示例值: item.示例值,
    说明: item.字段说明,
    使用Agent: item.使用Agent
  })));
  sheet['!cols'] = [
    { wch: 25 },
    { wch: 20 },
    { wch: 10 },
    { wch: 25 },
    { wch: 45 },
    { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, apiName);
});

// 保存文件
const outputPath = path.join(__dirname, '..', 'Tushare_API字段详情.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Excel文件已生成: ${outputPath}`);
console.log(`包含 ${apiFieldsData.length} 个字段的详细信息`);
console.log(`共 ${apis.length + 2} 个工作表`);
