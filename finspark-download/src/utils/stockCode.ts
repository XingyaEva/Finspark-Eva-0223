/**
 * 股票代码类型识别与标准化工具
 * 
 * 功能:
 * 1. 识别股票代码所属市场 (A股/港股/美股)
 * 2. 标准化股票代码格式
 * 3. 提供市场类型判断函数
 * 
 * 设计原则:
 * - 无副作用的纯函数
 * - 完整的类型定义
 * - 兼容多种输入格式
 */

export type MarketType = 'A' | 'HK' | 'US' | 'UNKNOWN';

/**
 * 股票代码标准化结果
 */
export interface NormalizedStockCode {
  /** 标准化后的股票代码 (含后缀) */
  code: string;
  /** 市场类型 */
  market: MarketType;
  /** 原始输入代码 */
  originalCode: string;
  /** 纯数字部分 */
  numericCode: string;
}

/**
 * 判断是否为港股代码
 * 
 * 规则:
 * - 00700.HK, 00700 (5位数字开头)
 * - 港股代码: 00001-09999 (主板), 08001-08999 (创业板/GEM)
 * - 也支持带 .HK 后缀的格式
 * 
 * @param code 股票代码
 * @returns 是否为港股
 */
export function isHKStock(code: string): boolean {
  if (!code) return false;
  
  const normalized = code.toUpperCase().trim();
  
  // 明确带 .HK 后缀
  if (normalized.includes('.HK')) {
    return true;
  }
  
  // 排除 A股 后缀
  if (normalized.includes('.SH') || normalized.includes('.SZ')) {
    return false;
  }
  
  // 纯数字且长度为5位 → 港股
  const numericPart = normalized.replace(/[^0-9]/g, '');
  if (numericPart.length === 5) {
    return true;
  }
  
  // 4位数字开头且不是 A股格式 → 可能是港股简写 (如 700 → 00700)
  if (/^[0-9]{4}$/.test(numericPart)) {
    // 以 0 开头的4位可能是港股
    if (numericPart.startsWith('0')) {
      return true;
    }
  }
  
  // 3位数字 → 可能是港股简写 (如 700 → 00700)
  if (/^[0-9]{3}$/.test(numericPart)) {
    return true;
  }
  
  return false;
}

/**
 * 判断是否为A股代码
 * 
 * 规则:
 * - 600xxx.SH, 601xxx.SH, 603xxx.SH (上交所主板)
 * - 688xxx.SH (科创板)
 * - 000xxx.SZ, 001xxx.SZ (深交所主板)
 * - 002xxx.SZ, 003xxx.SZ (中小板)
 * - 300xxx.SZ, 301xxx.SZ (创业板)
 * 
 * @param code 股票代码
 * @returns 是否为A股
 */
export function isAStock(code: string): boolean {
  if (!code) return false;
  
  const normalized = code.toUpperCase().trim();
  
  // 明确带 .SH 或 .SZ 后缀
  if (normalized.includes('.SH') || normalized.includes('.SZ')) {
    return true;
  }
  
  // 排除港股后缀
  if (normalized.includes('.HK')) {
    return false;
  }
  
  // 纯数字部分
  const numericPart = normalized.replace(/[^0-9]/g, '');
  
  // A股代码为6位数字
  if (numericPart.length !== 6) {
    return false;
  }
  
  // 验证是否符合 A股代码规则
  const aStockPrefixes = [
    '600', '601', '603', '605',  // 上交所主板
    '688', '689',                 // 科创板
    '000', '001',                 // 深交所主板
    '002', '003',                 // 中小板
    '300', '301',                 // 创业板
  ];
  
  const prefix = numericPart.substring(0, 3);
  return aStockPrefixes.includes(prefix);
}

/**
 * 判断是否为美股代码
 * 
 * 规则:
 * - 纯字母代码 (如 AAPL, TSLA, BABA)
 * - 带 .US 后缀
 * 
 * @param code 股票代码
 * @returns 是否为美股
 */
export function isUSStock(code: string): boolean {
  if (!code) return false;
  
  const normalized = code.toUpperCase().trim();
  
  // 带 .US 后缀
  if (normalized.includes('.US')) {
    return true;
  }
  
  // 排除 A股和港股后缀
  if (normalized.includes('.SH') || normalized.includes('.SZ') || normalized.includes('.HK')) {
    return false;
  }
  
  // 纯字母代码 (1-5位)
  const symbolPart = normalized.replace(/\..+$/, '');
  if (/^[A-Z]{1,5}$/.test(symbolPart)) {
    return true;
  }
  
  return false;
}

/**
 * 标准化股票代码
 * 
 * 转换规则:
 * - A股: 600519 → 600519.SH, 000001 → 000001.SZ
 * - 港股: 00700 → 00700.HK, 700 → 00700.HK
 * - 美股: AAPL → AAPL.US
 * 
 * @param code 原始股票代码
 * @returns 标准化结果
 */
export function normalizeStockCode(code: string): NormalizedStockCode {
  if (!code) {
    return {
      code: '',
      market: 'UNKNOWN',
      originalCode: '',
      numericCode: '',
    };
  }
  
  const original = code.trim();
  const upper = original.toUpperCase();
  
  // 已有明确后缀
  if (upper.includes('.SH')) {
    const numericPart = upper.replace('.SH', '').replace(/[^0-9]/g, '');
    return { code: upper, market: 'A', originalCode: original, numericCode: numericPart };
  }
  if (upper.includes('.SZ')) {
    const numericPart = upper.replace('.SZ', '').replace(/[^0-9]/g, '');
    return { code: upper, market: 'A', originalCode: original, numericCode: numericPart };
  }
  if (upper.includes('.HK')) {
    const numericPart = upper.replace('.HK', '').replace(/[^0-9]/g, '').padStart(5, '0');
    return { code: `${numericPart}.HK`, market: 'HK', originalCode: original, numericCode: numericPart };
  }
  if (upper.includes('.US')) {
    return { code: upper, market: 'US', originalCode: original, numericCode: '' };
  }
  
  // 纯数字判断
  const numericPart = upper.replace(/[^0-9]/g, '');
  
  // 6位数字 → A股
  if (numericPart.length === 6 && isAStock(numericPart)) {
    const prefix = numericPart.substring(0, 1);
    // 6开头 → 上交所
    const suffix = prefix === '6' ? '.SH' : '.SZ';
    return { code: `${numericPart}${suffix}`, market: 'A', originalCode: original, numericCode: numericPart };
  }
  
  // 5位数字 → 港股
  if (numericPart.length === 5) {
    return { code: `${numericPart}.HK`, market: 'HK', originalCode: original, numericCode: numericPart };
  }
  
  // 3-4位数字 → 港股简写，补齐5位
  if (numericPart.length >= 3 && numericPart.length <= 4) {
    const padded = numericPart.padStart(5, '0');
    return { code: `${padded}.HK`, market: 'HK', originalCode: original, numericCode: padded };
  }
  
  // 纯字母 → 美股
  const alphabeticPart = upper.replace(/[^A-Z]/g, '');
  if (alphabeticPart.length >= 1 && alphabeticPart.length <= 5 && /^[A-Z]+$/.test(upper)) {
    return { code: `${upper}.US`, market: 'US', originalCode: original, numericCode: '' };
  }
  
  // 无法识别
  return { code: upper, market: 'UNKNOWN', originalCode: original, numericCode: numericPart };
}

/**
 * 获取市场类型
 * 
 * @param code 股票代码
 * @returns 市场类型
 */
export function getMarketType(code: string): MarketType {
  return normalizeStockCode(code).market;
}

/**
 * 将港股代码转换为 AKShare 格式
 * 
 * AKShare 港股接口使用纯5位数字 (如 00700)
 * 
 * @param code 港股代码 (任意格式)
 * @returns AKShare 格式的港股代码
 */
export function toAkshareHKCode(code: string): string {
  const normalized = normalizeStockCode(code);
  if (normalized.market !== 'HK') {
    throw new Error(`Not a HK stock code: ${code}`);
  }
  return normalized.numericCode;
}

/**
 * 将股票代码转换为 Tushare 格式
 * 
 * Tushare A股: 600519.SH, 000001.SZ
 * Tushare 港股: 00700.HK (通过中转站)
 * 
 * @param code 股票代码
 * @returns Tushare 格式的股票代码
 */
export function toTushareCode(code: string): string {
  return normalizeStockCode(code).code;
}

/**
 * 验证股票代码是否有效
 * 
 * @param code 股票代码
 * @returns 是否为有效代码
 */
export function isValidStockCode(code: string): boolean {
  if (!code) return false;
  const normalized = normalizeStockCode(code);
  return normalized.market !== 'UNKNOWN' && normalized.code.length > 0;
}
