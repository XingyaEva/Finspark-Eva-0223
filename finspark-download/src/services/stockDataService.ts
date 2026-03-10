/**
 * 统一股票数据服务
 * 
 * 作用: 根据股票类型自动路由到对应数据源
 * - A股 → TushareService
 * - 港股 → AkshareHKService
 * 
 * 设计原则:
 * 1. 对外接口与 TushareService 完全一致
 * 2. 内部自动判断股票类型并路由
 * 3. 返回数据格式统一 (兼容现有 Orchestrator 和 Agent)
 * 4. 向后兼容 - 可作为 TushareService 的替代品
 * 
 * 关键特性:
 * - 无缝衔接: 现有代码无需修改即可支持港股
 * - 自动识别: 根据股票代码自动判断市场类型
 * - 格式统一: 港股数据转换为 A股兼容格式
 */

import { TushareService, TushareConfig } from './tushare';
import { AkshareHKService, AkshareHKConfig } from './akshareHK';
import { isHKStock, normalizeStockCode, MarketType } from '../utils/stockCode';
import type { 
  IncomeData, 
  BalanceData, 
  CashFlowData,
  DailyData,
  StockBasic,
  CompanyInfo,
  DailyBasicData,
  ForecastData,
  ExpressData,
  FinaIndicatorData,
  MainBizData,
  MarketDataPackage
} from './tushare';

/**
 * 统一数据服务配置
 */
export interface StockDataServiceConfig {
  /** Tushare 配置 (A股数据源) */
  tushare: TushareConfig;
  /** AKShare 港股配置 (可选) */
  akshareHK?: AkshareHKConfig;
}

/**
 * 数据来源标识
 */
export type DataSource = 'tushare' | 'akshare_hk';

/**
 * 统一股票数据服务类
 * 
 * 自动根据股票代码路由到对应数据源:
 * - 600xxx.SH, 000xxx.SZ 等 → TushareService
 * - 00700.HK, 00700 等 → AkshareHKService
 */
export class StockDataService {
  private tushare: TushareService;
  private akshareHK: AkshareHKService;

  constructor(config: StockDataServiceConfig) {
    // 初始化 A股数据服务
    this.tushare = new TushareService(config.tushare);
    
    // 初始化港股数据服务 (共享缓存)
    this.akshareHK = new AkshareHKService({
      cache: config.akshareHK?.cache || config.tushare.cache,
      pythonProxyUrl: config.akshareHK?.pythonProxyUrl,
    });
    
    console.log('[StockDataService] 统一数据服务初始化完成');
  }

  // ========== 核心财务报表接口 (自动路由) ==========

  /**
   * 获取利润表 (自动路由)
   * 
   * @param tsCode 股票代码 (支持 A股/港股)
   * @param period 报告期 (可选)
   * @returns 利润表数据 (Tushare 格式)
   */
  async getIncomeStatement(tsCode: string, period?: string): Promise<IncomeData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股利润表: ${code}`);
      return this.akshareHK.getIncomeStatement(code, period);
    }
    
    console.log(`[StockDataService] A股利润表: ${code}`);
    return this.tushare.getIncomeStatement(code, period);
  }

  /**
   * 获取资产负债表 (自动路由)
   */
  async getBalanceSheet(tsCode: string, period?: string): Promise<BalanceData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股资产负债表: ${code}`);
      return this.akshareHK.getBalanceSheet(code, period);
    }
    
    console.log(`[StockDataService] A股资产负债表: ${code}`);
    return this.tushare.getBalanceSheet(code, period);
  }

  /**
   * 获取现金流量表 (自动路由)
   */
  async getCashFlow(tsCode: string, period?: string): Promise<CashFlowData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股现金流量表: ${code}`);
      return this.akshareHK.getCashFlow(code, period);
    }
    
    console.log(`[StockDataService] A股现金流量表: ${code}`);
    return this.tushare.getCashFlow(code, period);
  }

  // ========== 股票基本信息接口 ==========

  /**
   * 获取股票基本信息 (自动路由)
   */
  async getStockBasic(tsCode: string): Promise<StockBasic | null> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getStockBasic(code);
    }
    
    return this.tushare.getStockBasic(code);
  }

  /**
   * 搜索股票
   * 
   * 注意: 当前仅支持 A股搜索，港股搜索功能待实现
   * 建议: 前端搜索结果应同时展示 A股和港股匹配结果
   */
  async searchStock(keyword: string): Promise<StockBasic[]> {
    // 目前仅支持 A股搜索
    const aStockResults = await this.tushare.searchStock(keyword);
    
    // TODO: 未来可添加港股搜索
    // const hkStockResults = await this.akshareHK.searchStock(keyword);
    
    return aStockResults;
  }

  /**
   * 获取公司基本信息 (自动路由)
   */
  async getCompanyInfo(tsCode: string): Promise<CompanyInfo | null> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getCompanyInfo(code);
    }
    
    return this.tushare.getCompanyInfo(code);
  }

  // ========== 行情数据接口 ==========

  /**
   * 获取日线数据 (自动路由)
   */
  async getDailyData(tsCode: string, startDate?: string, endDate?: string): Promise<DailyData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getDailyData(code, startDate, endDate);
    }
    
    return this.tushare.getDailyData(code, startDate, endDate);
  }

  /**
   * 获取K线数据 (自动路由)
   */
  async getStockKline(tsCode: string, days: number = 180): Promise<DailyData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getStockKline(code, days);
    }
    
    return this.tushare.getStockKline(code, days);
  }

  /**
   * 获取每日指标 (自动路由)
   */
  async getDailyBasic(tsCode: string, tradeDate?: string): Promise<DailyBasicData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getDailyBasic(code, tradeDate);
    }
    
    return this.tushare.getDailyBasic(code, tradeDate);
  }

  /**
   * 获取历史每日指标 (自动路由)
   */
  async getHistoricalDailyBasic(tsCode: string, days: number = 180): Promise<DailyBasicData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getHistoricalDailyBasic(code, days);
    }
    
    return this.tushare.getHistoricalDailyBasic(code, days);
  }

  // ========== 高级财务数据接口 ==========

  /**
   * 获取业绩预告 (自动路由)
   * 
   * 注意: 港股通常不发布业绩预告，返回空数组
   */
  async getForecast(tsCode: string): Promise<ForecastData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      // 港股不发布业绩预告
      return this.akshareHK.getForecast(code);
    }
    
    return this.tushare.getForecast(code);
  }

  /**
   * 获取业绩快报 (自动路由)
   * 
   * 注意: 港股通常不发布业绩快报，返回空数组
   */
  async getExpress(tsCode: string): Promise<ExpressData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      // 港股不发布业绩快报
      return this.akshareHK.getExpress(code);
    }
    
    return this.tushare.getExpress(code);
  }

  /**
   * 获取财务指标 (自动路由)
   */
  async getFinaIndicator(tsCode: string, period?: string): Promise<FinaIndicatorData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getFinaIndicator(code, period);
    }
    
    return this.tushare.getFinaIndicator(code, period);
  }

  /**
   * 获取主营业务构成 (自动路由)
   */
  async getMainBiz(tsCode: string, period?: string): Promise<MainBizData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      return this.akshareHK.getMainBiz(code, period);
    }
    
    return this.tushare.getMainBiz(code, period);
  }

  // ========== 聚合数据包接口 ==========

  /**
   * 获取完整市场数据包 (自动路由)
   * 
   * 用于股票走势面板一次性加载所有数据
   */
  async getMarketDataPackage(tsCode: string, days: number = 180): Promise<MarketDataPackage> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股市场数据包: ${code}`);
      return this.akshareHK.getMarketDataPackage(code, days);
    }
    
    console.log(`[StockDataService] A股市场数据包: ${code}`);
    return this.tushare.getMarketDataPackage(code, days);
  }

  // ========== 工具方法 ==========

  /**
   * 获取股票市场类型
   */
  getMarketType(tsCode: string): MarketType {
    return normalizeStockCode(tsCode).market;
  }

  /**
   * 判断是否为港股
   */
  isHKStock(tsCode: string): boolean {
    return isHKStock(tsCode);
  }

  /**
   * 获取数据来源标识
   */
  getDataSource(tsCode: string): DataSource {
    const { market } = normalizeStockCode(tsCode);
    return market === 'HK' ? 'akshare_hk' : 'tushare';
  }

  /**
   * 获取原始 Tushare 服务 (向后兼容)
   */
  getTushareService(): TushareService {
    return this.tushare;
  }

  /**
   * 获取原始 AKShare 港股服务
   */
  getAkshareHKService(): AkshareHKService {
    return this.akshareHK;
  }
}

/**
 * 创建统一数据服务实例
 * 
 * @example
 * ```typescript
 * const dataService = createStockDataService({
 *   tushare: {
 *     token: env.TUSHARE_TOKEN,
 *     cache: env.CACHE,
 *   },
 *   akshareHK: {
 *     pythonProxyUrl: env.AKSHARE_PROXY_URL,
 *   }
 * });
 * 
 * // 自动路由到正确的数据源
 * const aStockIncome = await dataService.getIncomeStatement('600519.SH');
 * const hkStockIncome = await dataService.getIncomeStatement('00700.HK');
 * ```
 */
export function createStockDataService(config: StockDataServiceConfig): StockDataService {
  return new StockDataService(config);
}

/**
 * 类型别名 - 用于 Orchestrator 配置
 * 
 * StockDataService 与 TushareService 具有相同的核心接口，
 * 可作为 TushareService 的替代品使用
 */
export type DataServiceInterface = StockDataService | TushareService;
