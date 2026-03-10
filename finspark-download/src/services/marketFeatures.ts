/**
 * 市场特征计算服务
 * 用于股票走势面板的派生指标计算
 * 
 * 计算内容：
 * 1. 均线（MA5/10/20/60）及排列状态
 * 2. 振幅、跳空缺口等派生指标
 * 3. 分位数计算（换手率、估值等）
 * 4. 趋势判断和量能状态
 */

import type { MarketDataPackage } from './tushare';

// ========== 类型定义 ==========

export interface KlineItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  pctChg: number;
}

export interface DailyBasicItem {
  date: string;
  turnoverRate: number;
  volumeRatio: number;
  pe: number;
  peTtm: number;
  pb: number;
  totalMv: number;
  circMv: number;
}

/**
 * 计算后的市场特征
 */
export interface MarketFeatures {
  // 基础行情数据
  tradeDate: string;
  close: number;
  open: number;
  high: number;
  low: number;
  preClose: number;
  pctChg: number;
  change: number;
  
  // 派生指标 - Tab1 重点
  amplitude: number;           // 振幅 = (high - low) / preClose
  gapPct: number;              // 跳空缺口 = (open - preClose) / preClose
  amountBillion: number;       // 成交额（亿元）
  volumeWanShou: number;       // 成交量（万手）
  
  // 均线数据
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  
  // 均线关系
  closeVsMa5Pct: number | null;   // 收盘价相对MA5偏离度
  closeVsMa10Pct: number | null;
  closeVsMa20Pct: number | null;
  closeVsMa60Pct: number | null;
  maArrangement: 'bullish' | 'bearish' | 'mixed';  // 均线排列
  
  // 成交量均线
  volMa5: number | null;
  volMa10: number | null;
  
  // 量能指标
  volumeRatio: number | null;     // 量比
  turnoverRate: number | null;    // 换手率
  amtVsMa20Pct: number | null;    // 成交额相对20日均值偏离
  
  // 分位数（用于历史对比）
  turnoverPercentile120: number | null;  // 换手率在120日内的分位
  volumePercentile20: number | null;     // 成交量在20日内的分位
  
  // 价格位置
  high20d: number | null;         // 20日最高价
  low20d: number | null;          // 20日最低价
  positionIn20d: number | null;   // 当前价格在20日区间的位置 (0-100)
  distanceToHigh20dPct: number | null;  // 距20日高点的距离
  distanceToLow20dPct: number | null;   // 距20日低点的距离
  
  // 估值数据
  pe: number | null;
  peTtm: number | null;
  pb: number | null;
  totalMv: number | null;         // 总市值（亿元）
  circMv: number | null;          // 流通市值（亿元）
  
  // 股本结构
  totalShare: number | null;      // 总股本（亿股）
  floatShare: number | null;      // 流通股本（亿股）
  freeShare: number | null;       // 自由流通股本（亿股）
  floatRatio: number | null;      // 流通占比
  freeFloatRatio: number | null;  // 自由流通占比
  
  // 趋势和状态判断
  trend: 'up' | 'down' | 'sideways';
  volumeStatus: 'surge' | 'shrink' | 'normal';
  priceBreakout: 'breakHigh' | 'breakLow' | 'none';
  aboveMa20: boolean;
  aboveMa60: boolean;
}

// ========== 工具函数 ==========

/**
 * 计算简单移动平均线
 */
function calculateMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * 计算分位数
 */
function calculatePercentile(value: number, data: number[]): number {
  if (data.length === 0) return 50;
  const sorted = [...data].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else break;
  }
  return Math.round((count / sorted.length) * 100);
}

/**
 * 判断均线排列
 */
function determineMAArrangement(
  ma5: number | null,
  ma10: number | null,
  ma20: number | null,
  ma60: number | null
): 'bullish' | 'bearish' | 'mixed' {
  if (!ma5 || !ma10 || !ma20) return 'mixed';
  
  // 多头排列：MA5 > MA10 > MA20 > MA60
  if (ma5 > ma10 && ma10 > ma20 && (!ma60 || ma20 > ma60)) {
    return 'bullish';
  }
  
  // 空头排列：MA5 < MA10 < MA20 < MA60
  if (ma5 < ma10 && ma10 < ma20 && (!ma60 || ma20 < ma60)) {
    return 'bearish';
  }
  
  return 'mixed';
}

/**
 * 判断趋势
 */
function determineTrend(
  kline: KlineItem[],
  ma20: number | null
): 'up' | 'down' | 'sideways' {
  if (kline.length < 5) return 'sideways';
  
  const recent5 = kline.slice(-5);
  const changes = recent5.map(k => k.pctChg);
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  
  const latestClose = kline[kline.length - 1].close;
  
  // 结合均线和近期涨跌判断
  if (avgChange > 1 && ma20 && latestClose > ma20) {
    return 'up';
  } else if (avgChange < -1 && ma20 && latestClose < ma20) {
    return 'down';
  }
  
  return 'sideways';
}

/**
 * 判断量能状态
 */
function determineVolumeStatus(
  currentVolume: number,
  volMa5: number | null
): 'surge' | 'shrink' | 'normal' {
  if (!volMa5) return 'normal';
  
  const ratio = currentVolume / volMa5;
  
  if (ratio > 1.5) return 'surge';    // 放量
  if (ratio < 0.6) return 'shrink';   // 缩量
  return 'normal';
}

/**
 * 判断价格突破
 */
function determinePriceBreakout(
  close: number,
  high20d: number | null,
  low20d: number | null
): 'breakHigh' | 'breakLow' | 'none' {
  if (!high20d || !low20d) return 'none';
  
  if (close >= high20d) return 'breakHigh';
  if (close <= low20d) return 'breakLow';
  return 'none';
}

// ========== 主要计算函数 ==========

/**
 * 计算市场特征
 * @param marketData 从 API 获取的市场数据包
 * @returns 计算后的市场特征
 */
export function calculateMarketFeatures(marketData: MarketDataPackage): MarketFeatures | null {
  const { kline, dailyBasicHistory, quote, valuation, shares } = marketData;
  
  // 确保有足够的数据
  if (!kline || kline.length === 0 || !quote) {
    return null;
  }
  
  const latest = kline[kline.length - 1];
  const closes = kline.map(k => k.close);
  const volumes = kline.map(k => k.volume);
  const amounts = kline.map(k => k.amount);
  
  // 计算均线
  const ma5 = calculateMA(closes, 5);
  const ma10 = calculateMA(closes, 10);
  const ma20 = calculateMA(closes, 20);
  const ma60 = calculateMA(closes, 60);
  
  // 计算成交量均线
  const volMa5 = calculateMA(volumes, 5);
  const volMa10 = calculateMA(volumes, 10);
  
  // 计算成交额20日均值
  const amountMa20 = calculateMA(amounts, 20);
  
  // 计算20日高低点
  const recent20 = kline.slice(-20);
  const high20d = recent20.length > 0 ? Math.max(...recent20.map(k => k.high)) : null;
  const low20d = recent20.length > 0 ? Math.min(...recent20.map(k => k.low)) : null;
  
  // 计算分位数
  const turnoverRates = dailyBasicHistory.slice(-120).map(d => d.turnoverRate).filter(v => v != null);
  const recent20Volumes = volumes.slice(-20);
  
  const turnoverPercentile120 = quote.turnoverRate != null 
    ? calculatePercentile(quote.turnoverRate, turnoverRates)
    : null;
  
  const volumePercentile20 = recent20Volumes.length > 0
    ? calculatePercentile(latest.volume, recent20Volumes)
    : null;
  
  // 计算当前价格在20日区间的位置
  const positionIn20d = (high20d && low20d && high20d !== low20d)
    ? Math.round(((latest.close - low20d) / (high20d - low20d)) * 100)
    : null;
  
  // 派生指标计算
  const preClose = quote.preClose || latest.close;
  const amplitude = preClose > 0 ? ((latest.high - latest.low) / preClose) * 100 : 0;
  const gapPct = preClose > 0 ? ((latest.open - preClose) / preClose) * 100 : 0;
  // Tushare amount 单位是千元，除以100000得到亿元
  const amountBillion = latest.amount / 100000;  // 千元 -> 亿元
  // Tushare vol 单位是手，除以10000得到万手
  const volumeWanShou = latest.volume / 10000;   // 手 -> 万手
  
  // 均线偏离度
  const closeVsMa5Pct = ma5 ? ((latest.close - ma5) / ma5) * 100 : null;
  const closeVsMa10Pct = ma10 ? ((latest.close - ma10) / ma10) * 100 : null;
  const closeVsMa20Pct = ma20 ? ((latest.close - ma20) / ma20) * 100 : null;
  const closeVsMa60Pct = ma60 ? ((latest.close - ma60) / ma60) * 100 : null;
  
  // 成交额偏离度
  const amtVsMa20Pct = amountMa20 ? ((latest.amount - amountMa20) / amountMa20) * 100 : null;
  
  // 距高低点距离
  const distanceToHigh20dPct = high20d ? ((high20d - latest.close) / latest.close) * 100 : null;
  const distanceToLow20dPct = low20d ? ((latest.close - low20d) / latest.close) * 100 : null;
  
  // 股本结构
  const totalShareYi = shares?.totalShare ? shares.totalShare / 10000 : null;  // 转换为亿股
  const floatShareYi = shares?.floatShare ? shares.floatShare / 10000 : null;
  const freeShareYi = shares?.freeShare ? shares.freeShare / 10000 : null;
  const floatRatio = (totalShareYi && floatShareYi) ? (floatShareYi / totalShareYi) * 100 : null;
  const freeFloatRatio = (totalShareYi && freeShareYi) ? (freeShareYi / totalShareYi) * 100 : null;
  
  // 市值转换为亿元
  const totalMvYi = shares?.totalMv ? shares.totalMv / 10000 : null;
  const circMvYi = shares?.circMv ? shares.circMv / 10000 : null;
  
  // 判断状态
  const maArrangement = determineMAArrangement(ma5, ma10, ma20, ma60);
  const trend = determineTrend(kline, ma20);
  const volumeStatus = determineVolumeStatus(latest.volume, volMa5);
  const priceBreakout = determinePriceBreakout(latest.close, high20d, low20d);
  
  return {
    // 基础行情
    tradeDate: latest.date,
    close: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    preClose: preClose,
    pctChg: latest.pctChg,
    change: quote.change,
    
    // 派生指标
    amplitude,
    gapPct,
    amountBillion,
    volumeWanShou,
    
    // 均线
    ma5,
    ma10,
    ma20,
    ma60,
    
    // 均线关系
    closeVsMa5Pct,
    closeVsMa10Pct,
    closeVsMa20Pct,
    closeVsMa60Pct,
    maArrangement,
    
    // 成交量均线
    volMa5,
    volMa10,
    
    // 量能指标
    volumeRatio: quote.volumeRatio,
    turnoverRate: quote.turnoverRate,
    amtVsMa20Pct,
    
    // 分位数
    turnoverPercentile120,
    volumePercentile20,
    
    // 价格位置
    high20d,
    low20d,
    positionIn20d,
    distanceToHigh20dPct,
    distanceToLow20dPct,
    
    // 估值
    pe: valuation?.pe ?? null,
    peTtm: valuation?.peTtm ?? null,
    pb: valuation?.pb ?? null,
    totalMv: totalMvYi,
    circMv: circMvYi,
    
    // 股本
    totalShare: totalShareYi,
    floatShare: floatShareYi,
    freeShare: freeShareYi,
    floatRatio,
    freeFloatRatio,
    
    // 状态判断
    trend,
    volumeStatus,
    priceBreakout,
    aboveMa20: ma20 ? latest.close > ma20 : false,
    aboveMa60: ma60 ? latest.close > ma60 : false,
  };
}

/**
 * 计算估值分位数
 * @param currentValue 当前估值
 * @param historicalValues 历史估值数组
 * @returns 分位数 (0-100)
 */
export function calculateValuationPercentile(
  currentValue: number | null,
  historicalValues: number[]
): number | null {
  if (currentValue == null || historicalValues.length === 0) return null;
  
  // 过滤掉异常值（如亏损时的PE）
  const validValues = historicalValues.filter(v => v > 0 && v < 1000);
  if (validValues.length === 0) return null;
  
  return calculatePercentile(currentValue, validValues);
}

/**
 * 计算历史估值窗口
 * 支持 1年/3年/5年 窗口
 */
export function calculateValuationWindow(
  dailyBasicHistory: DailyBasicItem[],
  years: 1 | 3 | 5 = 3
): {
  peTtmPercentile: number | null;
  pbPercentile: number | null;
  peTtmMin: number | null;
  peTtmMax: number | null;
  peTtmAvg: number | null;
  pbMin: number | null;
  pbMax: number | null;
  pbAvg: number | null;
} {
  // 根据年数计算需要的数据量（大约250个交易日/年）
  const daysNeeded = years * 250;
  const data = dailyBasicHistory.slice(-daysNeeded);
  
  if (data.length === 0) {
    return {
      peTtmPercentile: null,
      pbPercentile: null,
      peTtmMin: null,
      peTtmMax: null,
      peTtmAvg: null,
      pbMin: null,
      pbMax: null,
      pbAvg: null,
    };
  }
  
  const peTtmValues = data.map(d => d.peTtm).filter(v => v > 0 && v < 1000);
  const pbValues = data.map(d => d.pb).filter(v => v > 0 && v < 100);
  
  const latest = data[data.length - 1];
  
  const calcStats = (values: number[]) => {
    if (values.length === 0) return { min: null, max: null, avg: null };
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  };
  
  const peTtmStats = calcStats(peTtmValues);
  const pbStats = calcStats(pbValues);
  
  return {
    peTtmPercentile: calculateValuationPercentile(latest.peTtm, peTtmValues),
    pbPercentile: calculateValuationPercentile(latest.pb, pbValues),
    peTtmMin: peTtmStats.min,
    peTtmMax: peTtmStats.max,
    peTtmAvg: peTtmStats.avg,
    pbMin: pbStats.min,
    pbMax: pbStats.max,
    pbAvg: pbStats.avg,
  };
}
