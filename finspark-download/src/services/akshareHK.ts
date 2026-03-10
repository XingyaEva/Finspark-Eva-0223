/**
 * AKShare 港股财务数据服务
 * 
 * 功能:
 * 1. 获取港股三大财务报表 (利润表/资产负债表/现金流量表)
 * 2. 将港股数据格式转换为 Tushare A股兼容格式 (供 Orchestrator 使用)
 * 3. 支持 KV 缓存策略
 * 4. 通过 Python 代理服务调用 AKShare API
 * 
 * 数据来源: AKShare stock_financial_hk_report_em (东方财富)
 * 
 * 关键设计:
 * - 港股数据为"长表"格式 (每个指标一行)
 * - A股数据为"宽表"格式 (每个报告期一行，各指标为列)
 * - 本服务负责将长表转换为宽表
 */

/// <reference types="@cloudflare/workers-types" />

import type { 
  IncomeData, 
  BalanceData, 
  CashFlowData,
  DailyData,
  StockBasic,
  FinaIndicatorData,
  DailyBasicData,
  MarketDataPackage,
  CompanyInfo,
  ForecastData,
  ExpressData,
  MainBizData
} from './tushare';
import { toAkshareHKCode } from '../utils/stockCode';

export interface AkshareHKConfig {
  cache?: KVNamespace | undefined;
  pythonProxyUrl?: string;  // Python 代理服务地址
}

// 缓存配置
const CACHE_TTL = {
  FINANCIAL: 24 * 3600,        // 财务报表: 24小时
  KLINE: 5 * 60,               // K线数据: 5分钟
  STOCK_BASIC: 7 * 24 * 3600,  // 股票基本信息: 7天
  COMPANY_INFO: 3 * 24 * 3600, // 公司信息: 3天
  FINANCIAL_INDICATOR: 24 * 3600, // 财务指标: 24小时
} as const;

// 缓存Key生成器
const CacheKeys = {
  income: (code: string) => `akshare:hk:income:${code}`,
  balance: (code: string) => `akshare:hk:balance:${code}`,
  cashflow: (code: string) => `akshare:hk:cashflow:${code}`,
  kline: (code: string, days: number) => `akshare:hk:kline:${code}:${days}`,
  stockBasic: (code: string) => `akshare:hk:basic:${code}`,
  companyInfo: (code: string) => `akshare:hk:company:${code}`,
  finaIndicator: (code: string) => `akshare:hk:fina:${code}`,
};

/**
 * AKShare 原始数据格式 (长表)
 * 每行代表一个财务指标项
 */
interface AkshareRawItem {
  SECUCODE: string;           // 证券代码 (如 00700.HK)
  SECURITY_CODE: string;      // 股票代码 (如 00700)
  SECURITY_NAME_ABBR: string; // 股票简称
  ORG_CODE: string;           // 组织代码
  REPORT_DATE: string;        // 报告日期
  DATE_TYPE_CODE: string;     // 日期类型
  FISCAL_YEAR: string;        // 财年
  START_DATE?: string;        // 开始日期 (利润表/现金流量表)
  STD_ITEM_CODE: string;      // 标准项目代码
  STD_ITEM_NAME: string;      // 标准项目名称 (中文)
  AMOUNT: number | null;      // 金额
  STD_REPORT_DATE?: string;   // 标准报告日期 (资产负债表)
}

/**
 * 港股利润表字段映射
 * 港股中文项目名 → Tushare A股字段名
 * 数据来源: AKShare stock_financial_hk_report_em (东方财富)
 */
const INCOME_FIELD_MAP: Record<string, keyof IncomeData> = {
  // 核心收入指标
  '营业额': 'total_revenue',
  '收入': 'revenue',
  '营运收入': 'revenue',
  '其他营业收入': 'revenue',
  '其他收入': 'revenue',
  '其他收益': 'revenue',
  
  // 成本相关
  '销售成本': 'total_cogs',
  '销货成本': 'oper_cost',
  '营运支出': 'oper_cost',
  
  // 利润指标
  '毛利': 'operate_profit',  // 港股毛利映射到营业利润
  '经营溢利': 'operate_profit',
  '营业利润': 'operate_profit',
  '除税前溢利': 'operate_profit',
  '持续经营业务税后利润': 'n_income',
  
  // 净利润
  '股东应占溢利': 'n_income_attr_p',
  '归属于母公司股东的净利润': 'n_income_attr_p',
  '净利润': 'n_income',
  '除税后溢利': 'n_income',
  '少数股东损益': 'minority_gain',
  
  // 每股指标
  '每股基本盈利': 'basic_eps',
  '基本每股收益': 'basic_eps',
  '稀释每股收益': 'diluted_eps',
  '每股摊薄盈利': 'diluted_eps',
  '每股股息': 'basic_eps',  // 映射到 basic_eps 作为备用
  
  // 费用
  '销售费用': 'sell_exp',
  '销售及分销费用': 'sell_exp',
  '管理费用': 'admin_exp',
  '行政开支': 'admin_exp',
  '研发费用': 'rd_exp',
  '财务费用': 'fin_exp',
  '利息支出': 'fin_exp',
  '融资成本': 'fin_exp',
  '利息收入': 'fin_exp',  // 负值
  
  // 其他
  '税项': 'income_tax',
  '全面收益总额': 'compr_inc_attr_p',
  '本公司拥有人应占全面收益总额': 'compr_inc_attr_p',
};

/**
 * 港股资产负债表字段映射
 * 数据来源: AKShare stock_financial_hk_report_em (东方财富)
 */
const BALANCE_FIELD_MAP: Record<string, keyof BalanceData> = {
  // 资产总计
  '总资产': 'total_assets',
  '资产总计': 'total_assets',
  
  // 负债总计
  '总负债': 'total_liab',
  '负债合计': 'total_liab',
  '流动负债合计': 'total_cur_liab',
  '非流动负债合计': 'total_ncl',
  
  // 权益
  '股东权益': 'total_hldr_eqy_exc_min_int',
  '股东权益合计': 'total_hldr_eqy_exc_min_int',
  '总权益': 'total_hldr_eqy_exc_min_int',
  '净资产': 'total_hldr_eqy_exc_min_int',
  '少数股东权益': 'minority_int',
  '股本': 'share_capital',
  '股本溢价': 'cap_rese',
  '储备': 'surplus_rese',
  '其他储备': 'oth_eqt_tools',
  '保留溢利(累计亏损)': 'undistr_porfit',
  '库存股': 'treasury_share',
  
  // 现金及等价物
  '现金及等价物': 'money_cap',
  '现金及银行结余': 'money_cap',
  '货币资金': 'money_cap',
  '短期存款': 'money_cap',
  '中长期存款': 'oth_cash_inflo_oper_act',
  '受限制存款及现金': 'restrict_deposit',
  
  // 应收应付
  '应收帐款': 'accounts_receiv',
  '应收账款': 'accounts_receiv',
  '应收关联方款项': 'oth_receiv',
  '预付款按金及其他应收款': 'prepayment',
  '预付款项': 'prepayment',
  '应付帐款': 'accounts_pay',
  '应付账款': 'accounts_pay',
  '其他应付款及应计费用': 'oth_pay',
  '应付关联方款项(流动)': 'oth_cur_liab',
  '应付票据': 'notes_pay',
  '应付票据(非流动)': 'notes_pay',
  '应付税项': 'taxes_pay',
  '应付股利': 'div_pay',
  
  // 存货
  '存货': 'inventories',
  
  // 固定资产
  '固定资产': 'fix_assets',
  '物业厂房及设备': 'fix_assets',
  '在建工程': 'cip',
  '无形资产': 'intan_assets',
  '土地使用权': 'r_and_d',
  '投资物业': 'invest_prop',
  
  // 借款
  '短期贷款': 'st_borr',
  '短期银行贷款': 'st_borr',
  '长期贷款': 'lt_borr',
  '长期银行贷款': 'lt_borr',
  '长期应付款': 'lt_pay',
  '融资租赁负债(流动)': 'st_borr',
  '融资租赁负债(非流动)': 'lt_borr',
  
  // 投资相关
  '联营公司权益': 'lt_eqt_invest',
  '合营公司权益': 'lt_eqt_invest',
  '可供出售投资': 'avail_for_sale_fin_assets',
  '持有至到期投资': 'held_to_mty_invest',
  '持有至到期投资(流动)': 'held_to_mty_invest',
  '交易性金融资产(流动)': 'trad_asset',
  '其他金融资产(流动)': 'oth_cur_assets',
  '其他金融资产(非流动)': 'oth_nca',
  '指定以公允价值记账之金融资产': 'fvtpl_fin_assets',
  '指定以公允价值记账之金融资产(流动)': 'fvtpl_fin_assets',
  '于联营公司可赎回工具的投资': 'lt_eqt_invest',
  
  // 负债相关
  '其他金融负债(流动)': 'oth_cur_liab',
  '其他金融负债(非流动)': 'oth_ncl',
  '递延收入(流动)': 'deferred_inc',
  '递延收入(非流动)': 'lt_deferred_income',
  '递延税项负债': 'defer_tax_liab',
  '递延税项资产': 'defer_tax_assets',
  '衍生金融工具-负债(流动)': 'derivative_liab',
  '衍生金融工具-资产(流动)': 'derivative_assets',
  
  // 合计项目
  '流动资产合计': 'total_cur_assets',
  '非流动资产合计': 'total_nca',
  '非流动资产其他项目': 'oth_nca',
  '净流动资产': 'net_cur_assets',
  '总资产减流动负债': 'total_assets_net_cur_liab',
  '总资产减总负债合计': 'total_hldr_eqy_exc_min_int',
  '总权益及总负债': 'total_assets',
  '总权益及非流动负债': 'total_ncl_and_eqy',
  '持作出售的资产(流动)': 'hfs_assets',
};

/**
 * 港股现金流量表字段映射
 * 数据来源: AKShare stock_financial_hk_report_em (东方财富)
 */
const CASHFLOW_FIELD_MAP: Record<string, keyof CashFlowData> = {
  // 经营活动
  '经营活动产生的现金流量净额': 'n_cashflow_act',
  '经营产生现金': 'n_cashflow_act',
  '经营业务现金净额': 'n_cashflow_act',
  '营运资金变动前经营溢利': 'oper_profit_before_wc',
  '除税前溢利(业务利润)': 'operate_profit',
  
  // 投资活动
  '投资活动产生的现金流量净额': 'n_cashflow_inv_act',
  '投资活动现金': 'n_cashflow_inv_act',
  '投资业务现金净额': 'n_cashflow_inv_act',
  '投资支付现金': 'c_inf_dis_d_others',
  '收回投资所得现金': 'c_fr_disp_other_invest',
  '收购附属公司': 'c_paid_for_subsi',
  '出售附属公司': 'c_fr_disposal_group',
  '已收股息(投资)': 'c_fr_div_inv',
  '已收利息(投资)': 'c_fr_int_exp',
  '应收关联方款项(增加)减少(投资)': 'c_fr_oth_operate_a',
  '持作买卖投资(增加)减少': 'c_fr_trad_asset',
  
  // 筹资活动
  '筹资活动产生的现金流量净额': 'n_cash_flows_fnc_act',
  '融资活动现金': 'n_cash_flows_fnc_act',
  '融资业务现金净额': 'n_cash_flows_fnc_act',
  '新增借款': 'c_fr_borr',
  '偿还借款': 'c_repay_debt',
  '发行股份': 'c_fr_issue_share',
  '吸收投资所得': 'c_fr_min_s_instr',
  '发行债券': 'c_fr_borr',
  '赎回债券': 'c_repay_debt',
  '回购股份': 'c_pay_for_repurch',
  '已付股息(融资)': 'c_fr_div_fnc_act',
  '已付利息(融资)': 'c_int_pay',
  '已付利息(经营)': 'c_int_exp',
  '发行相关费用': 'c_pay_acq_const_fiasm',
  '偿还融资租赁': 'c_repay_debt',
  '融资前现金净额': 'net_cash_before_fin',
  '购买子公司少数股权而支付的现金': 'c_pay_for_minority_int',
  
  // 固定资产投资
  '购建固定资产': 'c_paid_for_assets',
  '购建无形资产及其他资产': 'c_paid_for_intan_assets',
  '资本开支': 'c_paid_for_assets',
  '处置固定资产': 'c_fr_disp_fix_assets',
  '处置无形资产及其他资产': 'c_fr_disp_intan_assets',
  
  // 调整项
  '加:折旧及摊销': 'depr_fa_coga_dpba',
  '加:减值及拨备': 'loss_asset_imp',
  '加:利息支出': 'int_exp',
  '减:利息收入': 'int_income',
  '减:投资收益': 'invest_income',
  '减:出售资产之溢利': 'gain_on_disposal',
  '减:汇兑收益': 'foreign_ex_loss',
  '减:重估盈余': 'gain_on_revaluation',
  '减:应占附属公司溢利': 'invest_income',
  '加:经营调整其他项目': 'oth_oper_act',
  
  // 营运资本变动
  '存货(增加)减少': 'incr_decr_inv',
  '应收帐款减少': 'incr_decr_accounts_receiv',
  '应付帐款及应计费用增加(减少)': 'incr_decr_accounts_pay',
  '存款(增加)减少': 'incr_decr_depo',
  '存款减少(增加)': 'incr_decr_depo',
  '预付款项、按金及其他应收款项减少(增加)': 'incr_decr_prepay',
  '预收账款、按金及其他应付款增加(减少)': 'incr_decr_adv_receipts',
  '递延收入(增加)减少': 'incr_decr_deferred_income',
  '应付关联方款项增加(减少)': 'incr_decr_related_party',
  '营运资本变动其他项目': 'oth_wc_changes',
  
  // 税项
  '已付税项': 'c_pay_income_tax',
  
  // 现金变动
  '期初现金': 'beg_cash_equiv',
  '期末现金': 'end_cash_equiv',
  '现金净额': 'n_incr_cash_cash_equ',
  '期间变动其他项目': 'oth_cash_inflo',
  
  // 业务相关
  '投资业务其他项目': 'oth_inv_act',
  '融资业务其他项目': 'oth_fnc_act',
  '非运算项目': 'non_oper_item',
  
  // 自由现金流
  '自由现金流': 'free_cashflow',
};

/**
 * AKShare 港股服务类
 */
export class AkshareHKService {
  private cache?: KVNamespace | undefined;
  private pythonProxyUrl: string;

  constructor(config: AkshareHKConfig) {
    this.cache = config.cache;
    // Python 代理服务默认地址
    this.pythonProxyUrl = config.pythonProxyUrl || 'http://localhost:8000';
  }

  // ========== 核心财务报表接口 ==========

  /**
   * 获取港股利润表 (转换为 Tushare IncomeData 格式)
   */
  async getIncomeStatement(stockCode: string, _period?: string): Promise<IncomeData[]> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.income(code);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          console.log(`[AkshareHK] 利润表缓存命中: ${code}`);
          return cached as IncomeData[];
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    // 调用 Python 代理获取数据
    const rawData = await this.fetchFromProxy(code, 'income');
    
    // 转换为 Tushare 格式
    const transformed = this.transformToIncomeData(rawData, code);
    
    // 写入缓存
    if (this.cache && transformed.length > 0) {
      try {
        await this.cache.put(cacheKey, JSON.stringify(transformed), {
          expirationTtl: CACHE_TTL.FINANCIAL,
        });
      } catch (e) {
        console.warn('[AkshareHK] 缓存写入失败:', e);
      }
    }
    
    return transformed;
  }

  /**
   * 获取港股资产负债表 (转换为 Tushare BalanceData 格式)
   */
  async getBalanceSheet(stockCode: string, _period?: string): Promise<BalanceData[]> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.balance(code);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          console.log(`[AkshareHK] 资产负债表缓存命中: ${code}`);
          return cached as BalanceData[];
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    // 调用 Python 代理获取数据
    const rawData = await this.fetchFromProxy(code, 'balance');
    
    // 转换为 Tushare 格式
    const transformed = this.transformToBalanceData(rawData, code);
    
    // 写入缓存
    if (this.cache && transformed.length > 0) {
      try {
        await this.cache.put(cacheKey, JSON.stringify(transformed), {
          expirationTtl: CACHE_TTL.FINANCIAL,
        });
      } catch (e) {
        console.warn('[AkshareHK] 缓存写入失败:', e);
      }
    }
    
    return transformed;
  }

  /**
   * 获取港股现金流量表 (转换为 Tushare CashFlowData 格式)
   */
  async getCashFlow(stockCode: string, _period?: string): Promise<CashFlowData[]> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.cashflow(code);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          console.log(`[AkshareHK] 现金流量表缓存命中: ${code}`);
          return cached as CashFlowData[];
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    // 调用 Python 代理获取数据
    const rawData = await this.fetchFromProxy(code, 'cashflow');
    
    // 转换为 Tushare 格式
    const transformed = this.transformToCashFlowData(rawData, code);
    
    // 写入缓存
    if (this.cache && transformed.length > 0) {
      try {
        await this.cache.put(cacheKey, JSON.stringify(transformed), {
          expirationTtl: CACHE_TTL.FINANCIAL,
        });
      } catch (e) {
        console.warn('[AkshareHK] 缓存写入失败:', e);
      }
    }
    
    return transformed;
  }

  /**
   * 获取港股基本信息 (返回 Tushare StockBasic 兼容格式)
   */
  async getStockBasic(stockCode: string): Promise<StockBasic | null> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.stockBasic(code);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          return cached as StockBasic;
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    try {
      const response = await fetch(`${this.pythonProxyUrl}/hk/basic/${code}`);
      const result = await response.json() as { success: boolean; data?: any; error?: string };
      
      if (!result.success || !result.data) {
        console.warn(`[AkshareHK] 获取股票基本信息失败: ${code}`);
        return null;
      }
      
      const stockBasic: StockBasic = {
        ts_code: `${code}.HK`,
        symbol: code,
        name: result.data.name || '',
        area: '香港',
        industry: result.data.industry || '港股',
        market: 'HK',
        list_date: result.data.list_date || '',
        exchange: 'HKEX',
        curr_type: 'HKD',
        list_status: 'L',
      };
      
      // 写入缓存
      if (this.cache) {
        try {
          await this.cache.put(cacheKey, JSON.stringify(stockBasic), {
            expirationTtl: CACHE_TTL.STOCK_BASIC,
          });
        } catch (e) {
          console.warn('[AkshareHK] 缓存写入失败:', e);
        }
      }
      
      return stockBasic;
    } catch (error) {
      console.error(`[AkshareHK] 获取股票基本信息异常: ${code}`, error);
      // 返回基础信息
      return {
        ts_code: `${code}.HK`,
        symbol: code,
        name: code,
        area: '香港',
        industry: '港股',
        market: 'HK',
        list_date: '',
        exchange: 'HKEX',
        curr_type: 'HKD',
        list_status: 'L',
      };
    }
  }

  /**
   * 获取港股公司信息
   */
  async getCompanyInfo(stockCode: string): Promise<CompanyInfo | null> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.companyInfo(code);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          return cached as CompanyInfo;
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    try {
      const response = await fetch(`${this.pythonProxyUrl}/hk/company/${code}`);
      const result = await response.json() as { success: boolean; data?: any; error?: string };
      
      if (!result.success || !result.data) {
        return null;
      }
      
      const companyInfo: CompanyInfo = {
        ts_code: `${code}.HK`,
        exchange: 'HKEX',
        chairman: result.data.chairman || '',
        manager: result.data.manager || '',
        secretary: result.data.secretary || '',
        reg_capital: result.data.reg_capital || 0,
        setup_date: result.data.setup_date || '',
        province: '香港',
        city: '香港',
        introduction: result.data.introduction || '',
        website: result.data.website || '',
        email: result.data.email || '',
        office: result.data.office || '',
        employees: result.data.employees || 0,
        main_business: result.data.main_business || '',
      };
      
      // 写入缓存
      if (this.cache) {
        try {
          await this.cache.put(cacheKey, JSON.stringify(companyInfo), {
            expirationTtl: CACHE_TTL.COMPANY_INFO,
          });
        } catch (e) {
          console.warn('[AkshareHK] 缓存写入失败:', e);
        }
      }
      
      return companyInfo;
    } catch (error) {
      console.error(`[AkshareHK] 获取公司信息异常: ${code}`, error);
      return null;
    }
  }

  /**
   * 获取港股K线数据
   */
  async getStockKline(stockCode: string, days: number = 180): Promise<DailyData[]> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.kline(code, days);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          return cached as DailyData[];
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    try {
      const response = await fetch(`${this.pythonProxyUrl}/hk/kline/${code}?days=${days}`);
      const result = await response.json() as { success: boolean; data?: any[]; error?: string };
      
      if (!result.success || !result.data) {
        return [];
      }
      
      const dailyData: DailyData[] = result.data.map((item: any) => ({
        ts_code: `${code}.HK`,
        trade_date: this.formatDate(item.date || item.trade_date || item.日期),
        open: item.open || item.开盘 || 0,
        high: item.high || item.最高 || 0,
        low: item.low || item.最低 || 0,
        close: item.close || item.收盘 || 0,
        pre_close: item.pre_close || 0,
        change: item.change || item.涨跌额 || 0,
        pct_chg: item.pct_chg || item.涨跌幅 || 0,
        vol: item.volume || item.vol || item.成交量 || 0,
        amount: item.amount || item.成交额 || 0,
      }));
      
      // 写入缓存
      if (this.cache && dailyData.length > 0) {
        try {
          await this.cache.put(cacheKey, JSON.stringify(dailyData), {
            expirationTtl: CACHE_TTL.KLINE,
          });
        } catch (e) {
          console.warn('[AkshareHK] 缓存写入失败:', e);
        }
      }
      
      return dailyData;
    } catch (error) {
      console.error(`[AkshareHK] 获取K线数据异常: ${code}`, error);
      return [];
    }
  }

  /**
   * 获取港股日线数据 (别名)
   */
  async getDailyData(stockCode: string, _startDate?: string, _endDate?: string): Promise<DailyData[]> {
    return this.getStockKline(stockCode, 365);
  }

  /**
   * 获取每日基本指标 (港股简化版)
   */
  async getDailyBasic(stockCode: string, _tradeDate?: string): Promise<DailyBasicData[]> {
    const code = toAkshareHKCode(stockCode);
    
    try {
      const response = await fetch(`${this.pythonProxyUrl}/hk/daily_basic/${code}`);
      const result = await response.json() as { success: boolean; data?: any[]; error?: string };
      
      if (!result.success || !result.data) {
        return [];
      }
      
      return result.data.map((item: any) => ({
        ts_code: `${code}.HK`,
        trade_date: this.formatDate(item.trade_date || item.日期),
        close: item.close || 0,
        turnover_rate: item.turnover_rate || 0,
        volume_ratio: item.volume_ratio || 0,
        pe: item.pe || 0,
        pe_ttm: item.pe_ttm || item.pe || 0,
        pb: item.pb || 0,
        ps: item.ps || 0,
        ps_ttm: item.ps_ttm || item.ps || 0,
        dv_ratio: item.dv_ratio || 0,
        dv_ttm: item.dv_ttm || 0,
        total_share: item.total_share || 0,
        float_share: item.float_share || 0,
        free_share: item.free_share || 0,
        total_mv: item.total_mv || 0,
        circ_mv: item.circ_mv || 0,
      }));
    } catch (error) {
      console.error(`[AkshareHK] 获取每日基本指标异常: ${code}`, error);
      return [];
    }
  }

  /**
   * 获取财务指标 (港股简化版)
   */
  async getFinaIndicator(stockCode: string, _period?: string): Promise<FinaIndicatorData[]> {
    const code = toAkshareHKCode(stockCode);
    const cacheKey = CacheKeys.finaIndicator(code);
    
    // 尝试从缓存读取
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey, 'json');
        if (cached) {
          return cached as FinaIndicatorData[];
        }
      } catch (e) {
        console.warn('[AkshareHK] 缓存读取失败:', e);
      }
    }
    
    try {
      const response = await fetch(`${this.pythonProxyUrl}/hk/fina_indicator/${code}`);
      const result = await response.json() as { success: boolean; data?: any[]; error?: string };
      
      if (!result.success || !result.data) {
        // 返回空数组，让 Agent 使用可用数据
        return [];
      }
      
      const transformed = result.data.map((item: any) => ({
        ts_code: `${code}.HK`,
        ann_date: this.formatDate(item.ann_date || ''),
        end_date: this.formatDate(item.end_date || item.报告期 || ''),
        eps: item.eps || 0,
        dt_eps: item.dt_eps || item.eps || 0,
        bps: item.bps || 0,
        ocfps: item.ocfps || 0,
        roe: item.roe || 0,
        roe_waa: item.roe_waa || item.roe || 0,
        roe_dt: item.roe_dt || item.roe || 0,
        roa: item.roa || 0,
        gross_margin: item.gross_margin || item.grossprofit_margin || 0,
        netprofit_margin: item.netprofit_margin || 0,
        current_ratio: item.current_ratio || 0,
        quick_ratio: item.quick_ratio || 0,
        cash_ratio: item.cash_ratio || 0,
        debt_to_assets: item.debt_to_assets || 0,
        debt_to_eqt: item.debt_to_eqt || 0,
        ar_turn: item.ar_turn || 0,
        ca_turn: item.ca_turn || 0,
        fa_turn: item.fa_turn || 0,
        assets_turn: item.assets_turn || 0,
        op_yoy: item.op_yoy || 0,
        ebt_yoy: item.ebt_yoy || 0,
        netprofit_yoy: item.netprofit_yoy || 0,
        tr_yoy: item.tr_yoy || 0,
        or_yoy: item.or_yoy || 0,
        saleexp_to_gr: item.saleexp_to_gr || 0,
        adminexp_of_gr: item.adminexp_of_gr || 0,
        finaexp_of_gr: item.finaexp_of_gr || 0,
        fcff: item.fcff || 0,
        fcfe: item.fcfe || 0,
      }));
      
      // 写入缓存
      if (this.cache && transformed.length > 0) {
        try {
          await this.cache.put(cacheKey, JSON.stringify(transformed), {
            expirationTtl: CACHE_TTL.FINANCIAL_INDICATOR,
          });
        } catch (e) {
          console.warn('[AkshareHK] 缓存写入失败:', e);
        }
      }
      
      return transformed;
    } catch (error) {
      console.error(`[AkshareHK] 获取财务指标异常: ${code}`, error);
      return [];
    }
  }

  /**
   * 获取业绩预告 (港股暂不支持，返回空数组)
   */
  async getForecast(_stockCode: string): Promise<ForecastData[]> {
    // 港股通常不发布业绩预告，返回空数组
    return [];
  }

  /**
   * 获取业绩快报 (港股暂不支持，返回空数组)
   */
  async getExpress(_stockCode: string): Promise<ExpressData[]> {
    // 港股通常不发布业绩快报，返回空数组
    return [];
  }

  /**
   * 获取主营业务构成 (港股简化版)
   */
  async getMainBiz(stockCode: string, _period?: string): Promise<MainBizData[]> {
    const code = toAkshareHKCode(stockCode);
    
    try {
      const response = await fetch(`${this.pythonProxyUrl}/hk/main_biz/${code}`);
      const result = await response.json() as { success: boolean; data?: any[]; error?: string };
      
      if (!result.success || !result.data) {
        return [];
      }
      
      return result.data.map((item: any) => ({
        ts_code: `${code}.HK`,
        end_date: this.formatDate(item.end_date || item.报告期 || ''),
        bz_item: item.bz_item || item.业务项目 || '',
        bz_code: item.bz_code || '',
        bz_sales: item.bz_sales || 0,
        bz_profit: item.bz_profit || 0,
        bz_cost: item.bz_cost || 0,
        curr_type: item.curr_type || 'HKD',
      }));
    } catch (error) {
      console.error(`[AkshareHK] 获取主营业务构成异常: ${code}`, error);
      return [];
    }
  }

  /**
   * 获取历史每日基本指标
   */
  async getHistoricalDailyBasic(stockCode: string, days: number = 180): Promise<DailyBasicData[]> {
    return this.getDailyBasic(stockCode);
  }

  /**
   * 获取完整市场数据包
   */
  async getMarketDataPackage(stockCode: string, days: number = 180): Promise<MarketDataPackage> {
    const code = toAkshareHKCode(stockCode);
    
    const [basic, company, kline, dailyBasic] = await Promise.all([
      this.getStockBasic(stockCode),
      this.getCompanyInfo(stockCode),
      this.getStockKline(stockCode, days),
      this.getDailyBasic(stockCode),
    ]);
    
    const latestKline = kline.length > 0 ? kline[kline.length - 1] : null;
    const latestDailyBasic = dailyBasic.length > 0 ? dailyBasic[0] : null;
    
    return {
      basic: basic ? {
        code: basic.ts_code,
        name: basic.name,
        industry: basic.industry,
        market: basic.market,
        listDate: basic.list_date,
      } : null,
      company: company ? {
        chairman: company.chairman,
        employees: company.employees,
        mainBusiness: company.main_business,
      } : null,
      quote: latestKline ? {
        tradeDate: latestKline.trade_date,
        open: latestKline.open,
        high: latestKline.high,
        low: latestKline.low,
        close: latestKline.close,
        preClose: latestKline.pre_close,
        change: latestKline.change,
        pctChg: latestKline.pct_chg,
        volume: latestKline.vol,
        amount: latestKline.amount,
        turnoverRate: latestDailyBasic?.turnover_rate ?? null,
        volumeRatio: latestDailyBasic?.volume_ratio ?? null,
      } : null,
      valuation: latestDailyBasic ? {
        pe: latestDailyBasic.pe,
        peTtm: latestDailyBasic.pe_ttm,
        pb: latestDailyBasic.pb,
        ps: latestDailyBasic.ps,
        psTtm: latestDailyBasic.ps_ttm,
        dvRatio: latestDailyBasic.dv_ratio,
        dvTtm: latestDailyBasic.dv_ttm,
      } : null,
      shares: latestDailyBasic ? {
        totalShare: latestDailyBasic.total_share,
        floatShare: latestDailyBasic.float_share,
        freeShare: latestDailyBasic.free_share,
        totalMv: latestDailyBasic.total_mv,
        circMv: latestDailyBasic.circ_mv,
      } : null,
      kline: kline.map(k => ({
        date: k.trade_date,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.vol,
        amount: k.amount,
        pctChg: k.pct_chg,
      })),
      dailyBasicHistory: dailyBasic.map(d => ({
        date: d.trade_date,
        turnoverRate: d.turnover_rate,
        volumeRatio: d.volume_ratio,
        pe: d.pe,
        peTtm: d.pe_ttm,
        pb: d.pb,
        totalMv: d.total_mv,
        circMv: d.circ_mv,
      })),
      updateTime: new Date().toISOString(),
    };
  }

  // ========== 私有方法 ==========

  /**
   * 从 Python 代理服务获取数据
   */
  private async fetchFromProxy(stockCode: string, reportType: 'income' | 'balance' | 'cashflow'): Promise<AkshareRawItem[]> {
    try {
      const response = await fetch(
        `${this.pythonProxyUrl}/hk/financial/${stockCode}/${reportType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const result = await response.json() as { success: boolean; data?: AkshareRawItem[]; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      
      return result.data || [];
    } catch (error) {
      console.error(`[AkshareHK] 获取 ${reportType} 数据失败:`, error);
      return [];
    }
  }

  /**
   * 将 AKShare 长表数据转换为 Tushare IncomeData 宽表格式
   */
  private transformToIncomeData(rawData: AkshareRawItem[], stockCode: string): IncomeData[] {
    if (!rawData || rawData.length === 0) {
      return [];
    }
    
    // 按报告期分组
    const periodMap = new Map<string, Partial<IncomeData>>();
    
    for (const item of rawData) {
      const period = this.formatDate(item.REPORT_DATE);
      if (!period) continue;
      
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          ts_code: `${stockCode}.HK`,
          ann_date: this.formatDate(item.REPORT_DATE),
          f_ann_date: this.formatDate(item.REPORT_DATE),
          end_date: period,
          report_type: '1',
        });
      }
      
      const record = periodMap.get(period)!;
      const fieldName = INCOME_FIELD_MAP[item.STD_ITEM_NAME];
      
      if (fieldName && item.AMOUNT !== null) {
        (record as any)[fieldName] = item.AMOUNT;
      }
    }
    
    // 转换为数组并按日期降序排序
    return Array.from(periodMap.values())
      .filter(item => item.end_date)
      .sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''))
      .map(item => ({
        ts_code: item.ts_code || `${stockCode}.HK`,
        ann_date: item.ann_date || '',
        f_ann_date: item.f_ann_date || '',
        end_date: item.end_date || '',
        report_type: item.report_type || '1',
        basic_eps: item.basic_eps || 0,
        diluted_eps: item.diluted_eps || 0,
        total_revenue: item.total_revenue || 0,
        revenue: item.revenue || item.total_revenue || 0,
        total_cogs: item.total_cogs || 0,
        oper_cost: item.oper_cost || 0,
        sell_exp: item.sell_exp || 0,
        admin_exp: item.admin_exp || 0,
        rd_exp: item.rd_exp || 0,
        fin_exp: item.fin_exp || 0,
        operate_profit: item.operate_profit || 0,
        n_income: item.n_income || 0,
        n_income_attr_p: item.n_income_attr_p || item.n_income || 0,
      })) as IncomeData[];
  }

  /**
   * 将 AKShare 长表数据转换为 Tushare BalanceData 宽表格式
   */
  private transformToBalanceData(rawData: AkshareRawItem[], stockCode: string): BalanceData[] {
    if (!rawData || rawData.length === 0) {
      return [];
    }
    
    // 按报告期分组
    const periodMap = new Map<string, Partial<BalanceData>>();
    
    for (const item of rawData) {
      const period = this.formatDate(item.REPORT_DATE);
      if (!period) continue;
      
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          ts_code: `${stockCode}.HK`,
          ann_date: this.formatDate(item.REPORT_DATE),
          end_date: period,
          report_type: '1',
        });
      }
      
      const record = periodMap.get(period)!;
      const fieldName = BALANCE_FIELD_MAP[item.STD_ITEM_NAME];
      
      if (fieldName && item.AMOUNT !== null) {
        (record as any)[fieldName] = item.AMOUNT;
      }
    }
    
    // 转换为数组并按日期降序排序
    return Array.from(periodMap.values())
      .filter(item => item.end_date)
      .sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''))
      .map(item => ({
        ts_code: item.ts_code || `${stockCode}.HK`,
        ann_date: item.ann_date || '',
        end_date: item.end_date || '',
        report_type: item.report_type || '1',
        total_assets: item.total_assets || 0,
        total_liab: item.total_liab || 0,
        total_hldr_eqy_exc_min_int: item.total_hldr_eqy_exc_min_int || 0,
        money_cap: item.money_cap || 0,
        accounts_receiv: item.accounts_receiv || 0,
        inventories: item.inventories || 0,
        fix_assets: item.fix_assets || 0,
        st_borr: item.st_borr || 0,
        lt_borr: item.lt_borr || 0,
        accounts_pay: item.accounts_pay || 0,
      })) as BalanceData[];
  }

  /**
   * 将 AKShare 长表数据转换为 Tushare CashFlowData 宽表格式
   */
  private transformToCashFlowData(rawData: AkshareRawItem[], stockCode: string): CashFlowData[] {
    if (!rawData || rawData.length === 0) {
      return [];
    }
    
    // 按报告期分组
    const periodMap = new Map<string, Partial<CashFlowData>>();
    
    for (const item of rawData) {
      const period = this.formatDate(item.REPORT_DATE);
      if (!period) continue;
      
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          ts_code: `${stockCode}.HK`,
          ann_date: this.formatDate(item.REPORT_DATE),
          end_date: period,
          report_type: '1',
        });
      }
      
      const record = periodMap.get(period)!;
      const fieldName = CASHFLOW_FIELD_MAP[item.STD_ITEM_NAME];
      
      if (fieldName && item.AMOUNT !== null) {
        (record as any)[fieldName] = item.AMOUNT;
      }
    }
    
    // 转换为数组并按日期降序排序
    return Array.from(periodMap.values())
      .filter(item => item.end_date)
      .sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''))
      .map(item => ({
        ts_code: item.ts_code || `${stockCode}.HK`,
        ann_date: item.ann_date || '',
        end_date: item.end_date || '',
        report_type: item.report_type || '1',
        n_cashflow_act: item.n_cashflow_act || 0,
        n_cashflow_inv_act: item.n_cashflow_inv_act || 0,
        n_cash_flows_fnc_act: item.n_cash_flows_fnc_act || 0,
        c_pay_acq_const_fiasm: 0,
        c_paid_for_assets: item.c_paid_for_assets || 0,
        free_cashflow: item.free_cashflow || 0,
      })) as CashFlowData[];
  }

  /**
   * 格式化日期为 YYYYMMDD 格式
   */
  private formatDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '';
    
    // 处理 "2024-12-31" 格式
    if (dateStr.includes('-')) {
      return dateStr.replace(/-/g, '');
    }
    
    // 处理 "2024/12/31" 格式
    if (dateStr.includes('/')) {
      return dateStr.replace(/\//g, '');
    }
    
    // 处理时间戳或其他格式
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0].replace(/-/g, '');
      }
    } catch {
      // ignore
    }
    
    // 已是 YYYYMMDD 格式
    return dateStr;
  }
}

/**
 * 创建 AKShare 港股服务实例
 */
export function createAkshareHKService(config: AkshareHKConfig): AkshareHKService {
  return new AkshareHKService(config);
}
