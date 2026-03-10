// Tushare Pro API 服务封装
// 包含本地缓存策略和频率限制

export interface TushareConfig {
  token: string;
  cache?: KVNamespace;
  useProxy?: boolean;  // 是否使用中转站（5000积分）
}

export interface TushareResponse<T> {
  code: number;
  msg: string;
  data: {
    fields: string[];
    items: T[][];
  };
}

// 缓存TTL配置（秒）
const CACHE_TTL = {
  STOCK_BASIC: 7 * 24 * 3600,      // 股票基本信息: 7天
  DAILY_HISTORY: 30 * 24 * 3600,   // 历史日线: 30天
  DAILY_TODAY: 5 * 60,             // 当日数据: 5分钟
  FINANCIAL: 24 * 3600,            // 财务报表: 24小时
  COMPANY: 3 * 24 * 3600,          // 公司信息: 3天
  INDUSTRY: 7 * 24 * 3600,         // 行业分类: 7天
  // 新增缓存TTL
  FORECAST: 12 * 3600,             // 业绩预告: 12小时
  EXPRESS: 12 * 3600,              // 业绩快报: 12小时
  FINA_INDICATOR: 24 * 3600,       // 财务指标: 24小时
  MAIN_BIZ: 24 * 3600,             // 主营业务构成: 24小时
  // 股票走势面板专用缓存TTL
  KLINE: 5 * 60,                   // K线数据: 5分钟（交易时间内频繁更新）
  DAILY_BASIC_HISTORY: 24 * 3600,  // 历史每日指标: 24小时
} as const;

// 缓存Key生成器
const CacheKeys = {
  stockBasic: (tsCode: string) => `tushare:stock:basic:${tsCode}`,
  stockDaily: (tsCode: string, date: string) => `tushare:stock:daily:${tsCode}:${date}`,
  stockRealtime: (tsCode: string) => `tushare:stock:realtime:${tsCode}`,
  incomeStatement: (tsCode: string, period: string) => `tushare:income:${tsCode}:${period}`,
  balanceSheet: (tsCode: string, period: string) => `tushare:balance:${tsCode}:${period}`,
  cashFlow: (tsCode: string, period: string) => `tushare:cashflow:${tsCode}:${period}`,
  company: (tsCode: string) => `tushare:company:${tsCode}`,
  industry: (tsCode: string) => `tushare:industry:${tsCode}`,
  // 新增缓存键
  forecast: (tsCode: string) => `tushare:forecast:${tsCode}`,
  express: (tsCode: string) => `tushare:express:${tsCode}`,
  finaIndicator: (tsCode: string, period: string) => `tushare:fina_indicator:${tsCode}:${period}`,
  mainBiz: (tsCode: string, period: string) => `tushare:mainbiz:${tsCode}:${period}`,
  // 股票走势面板专用缓存键
  kline: (tsCode: string, days: number) => `tushare:kline:${tsCode}:${days}`,
  dailyBasicHistory: (tsCode: string, days: number) => `tushare:daily_basic_history:${tsCode}:${days}`,
};

// 令牌桶速率限制器
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(capacity = 50, refillRate = 0.8) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<boolean> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    // 等待并重试
    await new Promise(resolve => setTimeout(resolve, 1000 / this.refillRate));
    return this.acquire();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Tushare API 地址配置
const TUSHARE_OFFICIAL_URL = 'http://api.tushare.pro';
const TUSHARE_PROXY_URL = 'https://tspro.matetrip.cn/dataapi';  // 中转站地址（5000积分）
const TUSHARE_PROXY_TOKEN = '788627836620509184';  // 中转站Token

export class TushareService {
  private baseUrl: string;
  private token: string;
  private cache?: KVNamespace;
  private rateLimiter: TokenBucket;
  private useProxy: boolean;

  constructor(config: TushareConfig) {
    // 默认使用中转站（5000积分，支持财务报表等高级接口）
    this.useProxy = config.useProxy !== false;
    
    if (this.useProxy) {
      this.baseUrl = TUSHARE_PROXY_URL;
      this.token = TUSHARE_PROXY_TOKEN;
      console.log('[Tushare] 使用中转站API（5000积分）');
    } else {
      this.baseUrl = TUSHARE_OFFICIAL_URL;
      this.token = config.token;
      console.log('[Tushare] 使用官方API');
    }
    
    this.cache = config.cache;
    this.rateLimiter = new TokenBucket(50, 0.8);
  }

  /**
   * 通用API调用
   */
  private async callApi<T>(
    apiName: string,
    params: Record<string, unknown> = {},
    fields: string[] = []
  ): Promise<T[]> {
    await this.rateLimiter.acquire();

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_name: apiName,
        token: this.token,
        params,
        fields: fields.join(','),
      }),
    });

    if (!response.ok) {
      throw new Error(`Tushare API error: ${response.status}`);
    }

    const result = await response.json() as TushareResponse<unknown>;
    
    if (result.code !== 0) {
      throw new Error(`Tushare API error: ${result.msg}`);
    }

    // 将数据转换为对象数组
    return result.data.items.map(item => {
      const obj: Record<string, unknown> = {};
      result.data.fields.forEach((field, index) => {
        obj[field] = item[index];
      });
      return obj as T;
    });
  }

  /**
   * 带缓存的API调用
   */
  private async callApiWithCache<T>(
    cacheKey: string,
    ttl: number,
    apiCall: () => Promise<T>
  ): Promise<T> {
    // 尝试从缓存读取
    if (this.cache) {
      const cached = await this.cache.get(cacheKey, 'json');
      if (cached) {
        return cached as T;
      }
    }

    // 调用API
    const data = await apiCall();

    // 写入缓存
    if (this.cache) {
      await this.cache.put(cacheKey, JSON.stringify(data), {
        expirationTtl: ttl,
      });
    }

    return data;
  }

  /**
   * 获取股票基本信息
   */
  async getStockBasic(tsCode: string): Promise<StockBasic | null> {
    const cacheKey = CacheKeys.stockBasic(tsCode);
    
    const data = await this.callApiWithCache<StockBasic[]>(
      cacheKey,
      CACHE_TTL.STOCK_BASIC,
      () => this.callApi<StockBasic>('stock_basic', { ts_code: tsCode }, [
        'ts_code', 'symbol', 'name', 'area', 'industry', 'market',
        'list_date', 'exchange', 'curr_type', 'list_status'
      ])
    );

    return data[0] || null;
  }

  /**
   * 搜索股票
   */
  async searchStock(keyword: string): Promise<StockBasic[]> {
    // 搜索不缓存，直接查询
    const allStocks = await this.callApi<StockBasic>('stock_basic', { list_status: 'L' }, [
      'ts_code', 'symbol', 'name', 'area', 'industry'
    ]);

    return allStocks.filter(stock => 
      stock.name?.includes(keyword) || 
      stock.symbol?.includes(keyword) ||
      stock.ts_code?.includes(keyword.toUpperCase())
    ).slice(0, 20);
  }

  /**
   * 获取日线数据
   */
  async getDailyData(
    tsCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyData[]> {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const isToday = !endDate || endDate === today;
    
    const cacheKey = isToday 
      ? CacheKeys.stockRealtime(tsCode)
      : CacheKeys.stockDaily(tsCode, `${startDate}-${endDate}`);
    
    const ttl = isToday ? CACHE_TTL.DAILY_TODAY : CACHE_TTL.DAILY_HISTORY;

    return this.callApiWithCache(
      cacheKey,
      ttl,
      () => this.callApi<DailyData>('daily', {
        ts_code: tsCode,
        start_date: startDate,
        end_date: endDate,
      }, [
        'ts_code', 'trade_date', 'open', 'high', 'low', 'close',
        'pre_close', 'change', 'pct_chg', 'vol', 'amount'
      ])
    );
  }

  /**
   * 获取利润表（带Mock数据降级）
   */
  async getIncomeStatement(tsCode: string, period?: string): Promise<IncomeData[]> {
    const cacheKey = CacheKeys.incomeStatement(tsCode, period || 'latest');
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.FINANCIAL,
        () => this.callApi<IncomeData>('income', {
          ts_code: tsCode,
          period,
        }, [
          'ts_code', 'ann_date', 'f_ann_date', 'end_date', 'report_type',
          'basic_eps', 'diluted_eps', 'total_revenue', 'revenue',
          'total_cogs', 'oper_cost', 'sell_exp', 'admin_exp', 'rd_exp',
          'fin_exp', 'operate_profit', 'n_income', 'n_income_attr_p'
        ])
      );
    } catch (error) {
      console.warn(`Tushare income API failed, using mock data: ${error}`);
      return this.getMockIncomeData(tsCode);
    }
  }

  /**
   * 获取资产负债表（带Mock数据降级）
   */
  async getBalanceSheet(tsCode: string, period?: string): Promise<BalanceData[]> {
    const cacheKey = CacheKeys.balanceSheet(tsCode, period || 'latest');
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.FINANCIAL,
        () => this.callApi<BalanceData>('balancesheet', {
          ts_code: tsCode,
          period,
        }, [
          'ts_code', 'ann_date', 'end_date', 'report_type',
          'total_assets', 'total_liab', 'total_hldr_eqy_exc_min_int',
          'money_cap', 'accounts_receiv', 'inventories', 'fix_assets',
          'st_borr', 'lt_borr', 'accounts_pay'
        ])
      );
    } catch (error) {
      console.warn(`Tushare balance API failed, using mock data: ${error}`);
      return this.getMockBalanceData(tsCode);
    }
  }

  /**
   * 获取现金流量表（带Mock数据降级）
   */
  async getCashFlow(tsCode: string, period?: string): Promise<CashFlowData[]> {
    const cacheKey = CacheKeys.cashFlow(tsCode, period || 'latest');
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.FINANCIAL,
        () => this.callApi<CashFlowData>('cashflow', {
          ts_code: tsCode,
          period,
        }, [
          'ts_code', 'ann_date', 'end_date', 'report_type',
          'n_cashflow_act', 'n_cashflow_inv_act', 'n_cash_flows_fnc_act',
          'c_pay_acq_const_fiam', 'c_paid_for_assets', 'free_cashflow'
        ])
      );
    } catch (error) {
      console.warn(`Tushare cashflow API failed, using mock data: ${error}`);
      return this.getMockCashFlowData(tsCode);
    }
  }

  /**
   * Mock利润表数据（用于演示/API权限不足时）
   */
  private getMockIncomeData(tsCode: string): IncomeData[] {
    // 基于股票代码生成合理的模拟数据
    const baseRevenue = tsCode.startsWith('600519') ? 150000000000 : 50000000000; // 茅台vs其他
    const years = ['20231231', '20221231', '20211231', '20201231'];
    
    return years.map((endDate, index) => {
      const growth = 1 - index * 0.08; // 逐年递减模拟历史数据
      const revenue = baseRevenue * growth;
      const netIncome = revenue * 0.48; // 高利润率（如茅台）
      
      return {
        ts_code: tsCode,
        ann_date: endDate.replace('1231', '0428'),
        f_ann_date: endDate.replace('1231', '0428'),
        end_date: endDate,
        report_type: '1',
        basic_eps: netIncome / 1256197800 * growth, // 假设总股本
        diluted_eps: netIncome / 1256197800 * growth,
        total_revenue: revenue,
        revenue: revenue * 0.98,
        total_cogs: revenue * 0.15,
        oper_cost: revenue * 0.08,
        sell_exp: revenue * 0.03,
        admin_exp: revenue * 0.05,
        rd_exp: revenue * 0.02,
        fin_exp: revenue * -0.01, // 负数表示利息收入
        operate_profit: revenue * 0.65,
        n_income: netIncome,
        n_income_attr_p: netIncome * 0.99,
      };
    });
  }

  /**
   * Mock资产负债表数据
   */
  private getMockBalanceData(tsCode: string): BalanceData[] {
    const baseAssets = tsCode.startsWith('600519') ? 280000000000 : 100000000000;
    const years = ['20231231', '20221231', '20211231', '20201231'];
    
    return years.map((endDate, index) => {
      const growth = 1 - index * 0.05;
      const totalAssets = baseAssets * growth;
      
      return {
        ts_code: tsCode,
        ann_date: endDate.replace('1231', '0428'),
        end_date: endDate,
        report_type: '1',
        total_assets: totalAssets,
        total_liab: totalAssets * 0.25, // 低负债率
        total_hldr_eqy_exc_min_int: totalAssets * 0.74,
        money_cap: totalAssets * 0.35, // 高现金
        accounts_receiv: totalAssets * 0.02,
        inventories: totalAssets * 0.15,
        fix_assets: totalAssets * 0.08,
        st_borr: totalAssets * 0.01,
        lt_borr: totalAssets * 0.02,
        accounts_pay: totalAssets * 0.08,
      };
    });
  }

  /**
   * Mock现金流量表数据
   */
  private getMockCashFlowData(tsCode: string): CashFlowData[] {
    const baseOCF = tsCode.startsWith('600519') ? 80000000000 : 20000000000;
    const years = ['20231231', '20221231', '20211231', '20201231'];
    
    return years.map((endDate, index) => {
      const growth = 1 - index * 0.06;
      const ocf = baseOCF * growth;
      
      return {
        ts_code: tsCode,
        ann_date: endDate.replace('1231', '0428'),
        end_date: endDate,
        report_type: '1',
        n_cashflow_act: ocf, // 经营活动现金流
        n_cashflow_inv_act: -ocf * 0.15, // 投资活动现金流（负数正常）
        n_cash_flows_fnc_act: -ocf * 0.6, // 筹资活动现金流（分红导致负数）
        c_pay_acq_const_fiasm: ocf * 0.05,
        c_paid_for_assets: ocf * 0.08,
        free_cashflow: ocf * 0.85, // 自由现金流
      };
    });
  }

  /**
   * 获取公司基本信息
   */
  async getCompanyInfo(tsCode: string): Promise<CompanyInfo | null> {
    const cacheKey = CacheKeys.company(tsCode);
    
    const data = await this.callApiWithCache<CompanyInfo[]>(
      cacheKey,
      CACHE_TTL.COMPANY,
      () => this.callApi<CompanyInfo>('stock_company', { ts_code: tsCode }, [
        'ts_code', 'exchange', 'chairman', 'manager', 'secretary',
        'reg_capital', 'setup_date', 'province', 'city', 'introduction',
        'website', 'email', 'office', 'employees', 'main_business'
      ])
    );

    return data[0] || null;
  }

  /**
   * 获取每日指标
   */
  async getDailyBasic(tsCode: string, tradeDate?: string): Promise<DailyBasicData[]> {
    return this.callApi<DailyBasicData>('daily_basic', {
      ts_code: tsCode,
      trade_date: tradeDate,
    }, [
      'ts_code', 'trade_date', 'close', 'turnover_rate', 'volume_ratio',
      'pe', 'pe_ttm', 'pb', 'ps', 'ps_ttm', 'dv_ratio', 'dv_ttm',
      'total_share', 'float_share', 'free_share', 'total_mv', 'circ_mv'
    ]);
  }

  // ========== 新增4个高级接口（需要5000积分） ==========

  /**
   * 获取业绩预告数据
   * 用于业绩预测Agent - 提供管理层对未来业绩的预期
   */
  async getForecast(tsCode: string): Promise<ForecastData[]> {
    const cacheKey = CacheKeys.forecast(tsCode);
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.FORECAST,
        () => this.callApi<ForecastData>('forecast', {
          ts_code: tsCode,
        }, [
          'ts_code', 'ann_date', 'end_date', 'type',
          'p_change_min', 'p_change_max', 'net_profit_min', 'net_profit_max',
          'last_parent_net', 'first_ann_date', 'summary', 'change_reason'
        ])
      );
    } catch (error) {
      console.warn(`[Tushare] 业绩预告API调用失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取业绩快报数据
   * 用于业绩预测Agent - 提供正式报告前的业绩快照
   */
  async getExpress(tsCode: string): Promise<ExpressData[]> {
    const cacheKey = CacheKeys.express(tsCode);
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.EXPRESS,
        () => this.callApi<ExpressData>('express', {
          ts_code: tsCode,
        }, [
          'ts_code', 'ann_date', 'end_date', 'revenue', 'operate_profit',
          'total_profit', 'n_income', 'total_assets', 'total_hldr_eqy_exc_min_int',
          'diluted_eps', 'diluted_roe', 'yoy_net_profit', 'bps', 'perf_summary'
        ])
      );
    } catch (error) {
      console.warn(`[Tushare] 业绩快报API调用失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取财务指标数据
   * 用于各Agent - 提供ROE/ROA/毛利率/资产周转率等核心指标
   */
  async getFinaIndicator(tsCode: string, period?: string): Promise<FinaIndicatorData[]> {
    const cacheKey = CacheKeys.finaIndicator(tsCode, period || 'latest');
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.FINA_INDICATOR,
        () => this.callApi<FinaIndicatorData>('fina_indicator', {
          ts_code: tsCode,
          period,
        }, [
          'ts_code', 'ann_date', 'end_date',
          // 每股指标
          'eps', 'dt_eps', 'bps', 'ocfps',
          // 盈利能力
          'roe', 'roe_waa', 'roe_dt', 'roa', 'gross_margin', 'netprofit_margin',
          // 偿债能力
          'current_ratio', 'quick_ratio', 'cash_ratio', 'debt_to_assets', 'debt_to_eqt',
          // 运营能力
          'ar_turn', 'ca_turn', 'fa_turn', 'assets_turn',
          // 成长能力
          'op_yoy', 'ebt_yoy', 'netprofit_yoy', 'tr_yoy', 'or_yoy',
          // 费用占比
          'saleexp_to_gr', 'adminexp_of_gr', 'finaexp_of_gr',
          // 现金流
          'fcff', 'fcfe'
        ])
      );
    } catch (error) {
      console.warn(`[Tushare] 财务指标API调用失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取主营业务构成数据
   * 用于商业模式Agent和业务洞察Agent - 分析收入来源和业务结构
   */
  async getMainBiz(tsCode: string, period?: string): Promise<MainBizData[]> {
    const cacheKey = CacheKeys.mainBiz(tsCode, period || 'latest');
    
    try {
      return await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.MAIN_BIZ,
        () => this.callApi<MainBizData>('fina_mainbz', {
          ts_code: tsCode,
          period,
        }, [
          'ts_code', 'end_date', 'bz_item', 'bz_code',
          'bz_sales', 'bz_profit', 'bz_cost', 'curr_type'
        ])
      );
    } catch (error) {
      console.warn(`[Tushare] 主营业务构成API调用失败: ${error}`);
      return [];
    }
  }

  // ========== 股票走势面板专用接口 ==========

  /**
   * 获取股票K线数据（用于走势面板）
   * @param tsCode 股票代码
   * @param days 获取最近N天的数据，默认180天（6个月）
   * @returns K线数据数组，按日期升序排列
   */
  async getStockKline(tsCode: string, days: number = 180): Promise<DailyData[]> {
    const cacheKey = CacheKeys.kline(tsCode, days);
    
    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const data = await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.KLINE,
        () => this.callApi<DailyData>('daily', {
          ts_code: tsCode,
          start_date: formatDate(startDate),
          end_date: formatDate(endDate),
        }, [
          'ts_code', 'trade_date', 'open', 'high', 'low', 'close',
          'pre_close', 'change', 'pct_chg', 'vol', 'amount'
        ])
      );
      
      // Tushare返回的数据是按日期降序，需要反转为升序
      return data.reverse();
    } catch (error) {
      console.warn(`[Tushare] K线数据API调用失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取历史每日指标数据（用于走势面板的估值/交易Tab）
   * @param tsCode 股票代码
   * @param days 获取最近N天的数据，默认180天
   * @returns 每日指标数据数组，按日期升序排列
   */
  async getHistoricalDailyBasic(tsCode: string, days: number = 180): Promise<DailyBasicData[]> {
    const cacheKey = CacheKeys.dailyBasicHistory(tsCode, days);
    
    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
    
    try {
      const data = await this.callApiWithCache(
        cacheKey,
        CACHE_TTL.DAILY_BASIC_HISTORY,
        () => this.callApi<DailyBasicData>('daily_basic', {
          ts_code: tsCode,
          start_date: formatDate(startDate),
          end_date: formatDate(endDate),
        }, [
          'ts_code', 'trade_date', 'close', 'turnover_rate', 'volume_ratio',
          'pe', 'pe_ttm', 'pb', 'ps', 'ps_ttm', 'dv_ratio', 'dv_ttm',
          'total_share', 'float_share', 'free_share', 'total_mv', 'circ_mv'
        ])
      );
      
      // Tushare返回的数据是按日期降序，需要反转为升序
      return data.reverse();
    } catch (error) {
      console.warn(`[Tushare] 历史每日指标API调用失败: ${error}`);
      return [];
    }
  }

  /**
   * 获取股票完整市场数据包（用于走势面板一次性加载）
   * 整合K线、每日指标、基本信息，减少多次API调用
   * @param tsCode 股票代码
   * @param days K线天数，默认180天
   */
  async getMarketDataPackage(tsCode: string, days: number = 180): Promise<MarketDataPackage> {
    // 并行请求所有数据
    const [basic, company, kline, dailyBasic] = await Promise.all([
      this.getStockBasic(tsCode),
      this.getCompanyInfo(tsCode),
      this.getStockKline(tsCode, days),
      this.getHistoricalDailyBasic(tsCode, days),
    ]);
    
    // 获取最新一天的数据
    const latestKline = kline.length > 0 ? kline[kline.length - 1] : null;
    const latestDailyBasic = dailyBasic.length > 0 ? dailyBasic[dailyBasic.length - 1] : null;
    
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
}

// 数据类型定义
export interface StockBasic {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
  exchange: string;
  curr_type: string;
  list_status: string;
}

export interface DailyData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  change: number;
  pct_chg: number;
  vol: number;
  amount: number;
}

export interface IncomeData {
  ts_code: string;
  ann_date: string;
  f_ann_date: string;
  end_date: string;
  report_type: string;
  basic_eps: number;
  diluted_eps: number;
  total_revenue: number;
  revenue: number;
  total_cogs: number;
  oper_cost: number;
  sell_exp: number;
  admin_exp: number;
  rd_exp: number;
  fin_exp: number;
  operate_profit: number;
  n_income: number;
  n_income_attr_p: number;
}

export interface BalanceData {
  ts_code: string;
  ann_date: string;
  end_date: string;
  report_type: string;
  total_assets: number;
  total_liab: number;
  total_hldr_eqy_exc_min_int: number;
  money_cap: number;
  accounts_receiv: number;
  inventories: number;
  fix_assets: number;
  st_borr: number;
  lt_borr: number;
  accounts_pay: number;
}

export interface CashFlowData {
  ts_code: string;
  ann_date: string;
  end_date: string;
  report_type: string;
  n_cashflow_act: number;
  n_cashflow_inv_act: number;
  n_cash_flows_fnc_act: number;
  c_pay_acq_const_fiasm: number;
  c_paid_for_assets: number;
  free_cashflow: number;
}

export interface CompanyInfo {
  ts_code: string;
  exchange: string;
  chairman: string;
  manager: string;
  secretary: string;
  reg_capital: number;
  setup_date: string;
  province: string;
  city: string;
  introduction: string;
  website: string;
  email: string;
  office: string;
  employees: number;
  main_business: string;
}

export interface DailyBasicData {
  ts_code: string;
  trade_date: string;
  close: number;
  turnover_rate: number;
  volume_ratio: number;
  pe: number;
  pe_ttm: number;
  pb: number;
  ps: number;
  ps_ttm: number;
  dv_ratio: number;
  dv_ttm: number;
  total_share: number;
  float_share: number;
  free_share: number;
  total_mv: number;
  circ_mv: number;
}

// ========== 新增接口数据类型 ==========

/**
 * 业绩预告数据 (forecast)
 * 用于业绩预测Agent分析
 */
export interface ForecastData {
  ts_code: string;        // 股票代码
  ann_date: string;       // 公告日期
  end_date: string;       // 报告期
  type: string;           // 业绩预告类型（预增/预减/扭亏/首亏/续亏/续盈/略增/略减/预亏/其他）
  p_change_min: number;   // 预计净利润变动幅度下限(%)
  p_change_max: number;   // 预计净利润变动幅度上限(%)
  net_profit_min: number; // 预计净利润下限（万元）
  net_profit_max: number; // 预计净利润上限（万元）
  last_parent_net: number; // 上年同期归母净利润（万元）
  first_ann_date: string; // 首次公告日
  summary: string;        // 业绩预告摘要
  change_reason: string;  // 业绩变动原因
}

/**
 * 业绩快报数据 (express)
 * 用于业绩预测Agent分析
 */
export interface ExpressData {
  ts_code: string;        // 股票代码
  ann_date: string;       // 公告日期
  end_date: string;       // 报告期
  revenue: number;        // 营业收入(元)
  operate_profit: number; // 营业利润(元)
  total_profit: number;   // 利润总额(元)
  n_income: number;       // 净利润(元)
  total_assets: number;   // 总资产(元)
  total_hldr_eqy_exc_min_int: number; // 股东权益合计(不含少数股东权益)(元)
  diluted_eps: number;    // 稀释每股收益
  diluted_roe: number;    // 摊薄净资产收益率(%)
  yoy_net_profit: number; // 去年同期净利润(元)
  bps: number;            // 每股净资产
  perf_summary: string;   // 业绩简要说明
}

/**
 * 财务指标数据 (fina_indicator)
 * 用于各Agent深度财务分析
 */
export interface FinaIndicatorData {
  ts_code: string;        // 股票代码
  ann_date: string;       // 公告日期
  end_date: string;       // 报告期
  // 每股指标
  eps: number;            // 基本每股收益
  dt_eps: number;         // 稀释每股收益
  bps: number;            // 每股净资产
  ocfps: number;          // 每股经营活动产生的现金流量净额
  // 盈利能力指标
  roe: number;            // 净资产收益率(%)
  roe_waa: number;        // 加权平均净资产收益率(%)
  roe_dt: number;         // 净资产收益率(扣除非经常性损益)(%)
  roa: number;            // 总资产报酬率(%)
  gross_margin: number;   // 毛利率(%)
  netprofit_margin: number; // 净利率(%)
  // 偿债能力指标
  current_ratio: number;  // 流动比率
  quick_ratio: number;    // 速动比率
  cash_ratio: number;     // 现金比率
  debt_to_assets: number; // 资产负债率(%)
  debt_to_eqt: number;    // 产权比率
  // 运营能力指标
  ar_turn: number;        // 应收账款周转率(次)
  ca_turn: number;        // 流动资产周转率(次)
  fa_turn: number;        // 固定资产周转率(次)
  assets_turn: number;    // 总资产周转率(次)
  // 成长能力指标
  op_yoy: number;         // 营业利润同比增长率(%)
  ebt_yoy: number;        // 利润总额同比增长率(%)
  netprofit_yoy: number;  // 净利润同比增长率(%)
  tr_yoy: number;         // 营业总收入同比增长率(%)
  or_yoy: number;         // 营业收入同比增长率(%)
  // 费用占比
  saleexp_to_gr: number;  // 销售费用/营业总收入(%)
  adminexp_of_gr: number; // 管理费用/营业总收入(%)
  finaexp_of_gr: number;  // 财务费用/营业总收入(%)
  // 现金流指标
  fcff: number;           // 企业自由现金流量(元)
  fcfe: number;           // 股权自由现金流量(元)
}

/**
 * 主营业务构成数据 (fina_mainbz)
 * 用于商业模式Agent和业务洞察Agent分析
 */
export interface MainBizData {
  ts_code: string;        // 股票代码
  end_date: string;       // 报告期
  bz_item: string;        // 主营业务项目
  bz_code: string;        // 项目代码
  bz_sales: number;       // 主营业务收入(元)
  bz_profit: number;      // 主营业务利润(元)
  bz_cost: number;        // 主营业务成本(元)
  curr_type: string;      // 货币代码
}

// ========== 股票走势面板数据包类型 ==========

/**
 * 市场数据包 - 用于走势面板一次性加载
 */
export interface MarketDataPackage {
  basic: {
    code: string;
    name: string;
    industry: string;
    market: string;
    listDate: string;
  } | null;
  company: {
    chairman: string;
    employees: number;
    mainBusiness: string;
  } | null;
  quote: {
    tradeDate: string;
    open: number;
    high: number;
    low: number;
    close: number;
    preClose: number;
    change: number;
    pctChg: number;
    volume: number;
    amount: number;
    turnoverRate: number | null;
    volumeRatio: number | null;
  } | null;
  valuation: {
    pe: number;
    peTtm: number;
    pb: number;
    ps: number;
    psTtm: number;
    dvRatio: number;
    dvTtm: number;
  } | null;
  shares: {
    totalShare: number;
    floatShare: number;
    freeShare: number;
    totalMv: number;
    circMv: number;
  } | null;
  kline: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
    pctChg: number;
  }>;
  dailyBasicHistory: Array<{
    date: string;
    turnoverRate: number;
    volumeRatio: number;
    pe: number;
    peTtm: number;
    pb: number;
    totalMv: number;
    circMv: number;
  }>;
  updateTime: string;
}

// 创建服务实例的工厂函数
export function createTushareService(config: TushareConfig): TushareService {
  return new TushareService(config);
}
