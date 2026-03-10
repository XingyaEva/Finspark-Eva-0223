/**
 * 股票走势解读生成器
 * 基于规则引擎生成结构化解读内容
 * 
 * 输出结构：
 * 1. 行情概览（Tab1 头部）
 * 2. 趋势分析解读
 * 3. 量能分析解读
 * 4. 关键位置解读
 * 5. 综合建议
 */

import type { MarketFeatures } from './marketFeatures';
import type { MarketDataPackage } from './tushare';
import { calculateMarketFeatures, calculateValuationWindow } from './marketFeatures';
import { getMatchedRules, getRulesByCategory, type InsightRule } from './insightRules';

// ========== 类型定义 ==========

export interface InsightItem {
  ruleId: string;
  category: 'trend' | 'momentum' | 'volatility' | 'trigger';
  priority: number;
  conclusion: string;
  evidence: string[];
  meaning?: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface QuoteOverview {
  price: number;
  change: number;
  pctChg: number;
  open: number;
  high: number;
  low: number;
  preClose: number;
  volume: string;      // 格式化后的成交量（万手）
  amount: string;      // 格式化后的成交额（亿元）
  turnoverRate: string | null;
  volumeRatio: string | null;
  amplitude: string;
  sentiment: 'rise' | 'fall' | 'flat';
  tradeDate: string;
}

export interface TrendInsight {
  maArrangement: 'bullish' | 'bearish' | 'mixed';
  maArrangementText: string;
  aboveMa20: boolean;
  aboveMa60: boolean;
  positionIn20d: number | null;
  trend: 'up' | 'down' | 'sideways';
  trendText: string;
  insights: InsightItem[];
}

export interface MomentumInsight {
  volumeStatus: 'surge' | 'shrink' | 'normal';
  volumeStatusText: string;
  turnoverPercentile: number | null;
  turnoverLevel: 'high' | 'low' | 'normal';
  insights: InsightItem[];
}

export interface ValuationInsight {
  pe: number | null;
  peTtm: number | null;
  pb: number | null;
  peTtmPercentile: number | null;
  pbPercentile: number | null;
  valuationLevel: 'undervalued' | 'overvalued' | 'fair';
  valuationText: string;
  peTtmRange: { min: number | null; max: number | null; avg: number | null };
  pbRange: { min: number | null; max: number | null; avg: number | null };
}

export interface SharesInsight {
  totalMv: string;       // 总市值（亿元）
  circMv: string;        // 流通市值（亿元）
  totalShare: string;    // 总股本（亿股）
  floatShare: string;    // 流通股本（亿股）
  freeShare: string;     // 自由流通股本（亿股）
  floatRatio: string;    // 流通占比
  marketCapLevel: 'large' | 'mid' | 'small';
  marketCapText: string;
}

export interface MarketInsightPackage {
  stockCode: string;
  stockName: string;
  updateTime: string;
  
  // Tab1: 行情走势
  quoteOverview: QuoteOverview;
  trendInsight: TrendInsight;
  momentumInsight: MomentumInsight;
  triggerInsights: InsightItem[];
  volatilityInsights: InsightItem[];
  
  // Tab2: 交易活跃（扩展）
  tradingActivity: {
    turnoverRate: number | null;
    volumeRatio: number | null;
    turnoverPercentile120: number | null;
    volumePercentile20: number | null;
    activityLevel: 'active' | 'quiet' | 'normal';
    activityText: string;
  };
  
  // Tab3: 估值分析
  valuationInsight: ValuationInsight;
  
  // Tab4: 股本市值
  sharesInsight: SharesInsight;
  
  // 综合摘要
  summary: {
    headline: string;
    keyPoints: string[];
    overallSentiment: 'bullish' | 'bearish' | 'neutral';
  };
  
  // 原始特征数据（用于图表）
  rawFeatures: MarketFeatures;
  
  // K线数据（用于图表）
  klineData: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
    pctChg: number;
  }>;
  
  // 均线数据（用于图表叠加）
  maData: {
    ma5: Array<{ date: string; value: number | null }>;
    ma10: Array<{ date: string; value: number | null }>;
    ma20: Array<{ date: string; value: number | null }>;
    ma60: Array<{ date: string; value: number | null }>;
  };
}

// ========== 工具函数 ==========

/**
 * 格式化数字
 */
function formatNumber(num: number | null | undefined, decimals: number = 2): string {
  if (num == null) return '--';
  return num.toFixed(decimals);
}

/**
 * 判断情绪倾向
 */
function determineSentiment(rule: InsightRule, features: MarketFeatures): 'positive' | 'negative' | 'neutral' {
  const id = rule.id;
  
  // 正面规则
  if (
    id.includes('bullish') ||
    id.includes('above') ||
    id.includes('surge_up') ||
    id.includes('break_high') ||
    id.includes('gap_up') ||
    id.includes('big_rise') ||
    id.includes('limit_up') ||
    id.includes('cross_up')
  ) {
    return 'positive';
  }
  
  // 负面规则
  if (
    id.includes('bearish') ||
    id.includes('below') ||
    id.includes('surge_down') ||
    id.includes('break_low') ||
    id.includes('gap_down') ||
    id.includes('big_drop') ||
    id.includes('limit_down') ||
    id.includes('shrink_up')  // 缩量上涨是负面信号
  ) {
    return 'negative';
  }
  
  return 'neutral';
}

/**
 * 计算均线序列（用于图表）
 */
function calculateMASequence(
  kline: MarketDataPackage['kline'],
  period: number
): Array<{ date: string; value: number | null }> {
  return kline.map((item, index) => {
    if (index < period - 1) {
      return { date: item.date, value: null };
    }
    const slice = kline.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, k) => acc + k.close, 0);
    return { date: item.date, value: sum / period };
  });
}

/**
 * 生成综合摘要
 */
function generateSummary(
  features: MarketFeatures,
  insights: InsightItem[]
): { headline: string; keyPoints: string[]; overallSentiment: 'bullish' | 'bearish' | 'neutral' } {
  const positiveCount = insights.filter(i => i.sentiment === 'positive').length;
  const negativeCount = insights.filter(i => i.sentiment === 'negative').length;
  
  // 确定整体情绪
  let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (positiveCount > negativeCount + 1) {
    overallSentiment = 'bullish';
  } else if (negativeCount > positiveCount + 1) {
    overallSentiment = 'bearish';
  }
  
  // 生成标题
  let headline = '';
  const pctChg = features.pctChg;
  
  if (pctChg >= 5) {
    headline = '大幅上涨，多方占优';
  } else if (pctChg >= 2) {
    headline = '强势上涨，关注量能配合';
  } else if (pctChg >= 0.5) {
    headline = '小幅上涨，走势平稳';
  } else if (pctChg >= -0.5) {
    headline = '横盘震荡，多空均衡';
  } else if (pctChg >= -2) {
    headline = '小幅下跌，观望为主';
  } else if (pctChg >= -5) {
    headline = '明显下跌，注意风险';
  } else {
    headline = '大幅下跌，空方主导';
  }
  
  // 关键要点（取优先级最高的3-5条）
  const keyPoints = insights
    .slice(0, 5)
    .map(i => i.conclusion);
  
  return { headline, keyPoints, overallSentiment };
}

// ========== 主函数 ==========

/**
 * 生成完整的市场解读包
 */
export function generateMarketInsightPackage(
  marketData: MarketDataPackage,
  stockCode: string,
  stockName: string
): MarketInsightPackage | null {
  // 计算市场特征
  const features = calculateMarketFeatures(marketData);
  if (!features) {
    return null;
  }
  
  // 获取匹配的规则
  const matchedRules = getMatchedRules(features);
  
  // 转换为解读项
  const allInsights: InsightItem[] = matchedRules.map(rule => ({
    ruleId: rule.id,
    category: rule.category,
    priority: rule.priority,
    conclusion: rule.conclusion(features),
    evidence: rule.evidence(features),
    meaning: rule.meaning?.(features),
    sentiment: determineSentiment(rule, features),
  }));
  
  // 按类别分组
  const trendInsightItems = allInsights.filter(i => i.category === 'trend');
  const momentumInsightItems = allInsights.filter(i => i.category === 'momentum');
  const volatilityInsightItems = allInsights.filter(i => i.category === 'volatility');
  const triggerInsightItems = allInsights.filter(i => i.category === 'trigger');
  
  // 计算估值窗口
  const valuationWindow = calculateValuationWindow(marketData.dailyBasicHistory, 3);
  
  // 计算均线序列
  const maData = {
    ma5: calculateMASequence(marketData.kline, 5),
    ma10: calculateMASequence(marketData.kline, 10),
    ma20: calculateMASequence(marketData.kline, 20),
    ma60: calculateMASequence(marketData.kline, 60),
  };
  
  // 构建行情概览
  const quoteOverview: QuoteOverview = {
    price: features.close,
    change: features.change,
    pctChg: features.pctChg,
    open: features.open,
    high: features.high,
    low: features.low,
    preClose: features.preClose,
    volume: formatNumber(features.volumeWanShou, 2) + '万手',
    amount: formatNumber(features.amountBillion, 2) + '亿',
    turnoverRate: features.turnoverRate ? formatNumber(features.turnoverRate, 2) + '%' : null,
    volumeRatio: features.volumeRatio ? formatNumber(features.volumeRatio, 2) : null,
    amplitude: formatNumber(features.amplitude, 2) + '%',
    sentiment: features.pctChg > 0.1 ? 'rise' : features.pctChg < -0.1 ? 'fall' : 'flat',
    tradeDate: features.tradeDate,
  };
  
  // 趋势分析
  const trendInsight: TrendInsight = {
    maArrangement: features.maArrangement,
    maArrangementText: features.maArrangement === 'bullish' ? '多头排列' 
      : features.maArrangement === 'bearish' ? '空头排列' 
      : '均线交织',
    aboveMa20: features.aboveMa20,
    aboveMa60: features.aboveMa60,
    positionIn20d: features.positionIn20d,
    trend: features.trend,
    trendText: features.trend === 'up' ? '上升趋势' 
      : features.trend === 'down' ? '下降趋势' 
      : '横盘震荡',
    insights: trendInsightItems,
  };
  
  // 量能分析
  const momentumInsight: MomentumInsight = {
    volumeStatus: features.volumeStatus,
    volumeStatusText: features.volumeStatus === 'surge' ? '放量' 
      : features.volumeStatus === 'shrink' ? '缩量' 
      : '量能平稳',
    turnoverPercentile: features.turnoverPercentile120,
    turnoverLevel: features.turnoverPercentile120 
      ? (features.turnoverPercentile120 >= 80 ? 'high' 
        : features.turnoverPercentile120 <= 20 ? 'low' 
        : 'normal')
      : 'normal',
    insights: momentumInsightItems,
  };
  
  // 交易活跃度
  const tradingActivity = {
    turnoverRate: features.turnoverRate,
    volumeRatio: features.volumeRatio,
    turnoverPercentile120: features.turnoverPercentile120,
    volumePercentile20: features.volumePercentile20,
    activityLevel: features.turnoverPercentile120 
      ? (features.turnoverPercentile120 >= 70 ? 'active' as const
        : features.turnoverPercentile120 <= 30 ? 'quiet' as const
        : 'normal' as const)
      : 'normal' as const,
    activityText: features.turnoverPercentile120 
      ? (features.turnoverPercentile120 >= 70 ? '交投活跃'
        : features.turnoverPercentile120 <= 30 ? '交投清淡'
        : '交投正常')
      : '交投正常',
  };
  
  // 估值分析
  const valuationLevel = valuationWindow.peTtmPercentile 
    ? (valuationWindow.peTtmPercentile <= 30 ? 'undervalued' as const
      : valuationWindow.peTtmPercentile >= 70 ? 'overvalued' as const
      : 'fair' as const)
    : 'fair' as const;
  
  const valuationInsight: ValuationInsight = {
    pe: features.pe,
    peTtm: features.peTtm,
    pb: features.pb,
    peTtmPercentile: valuationWindow.peTtmPercentile,
    pbPercentile: valuationWindow.pbPercentile,
    valuationLevel,
    valuationText: valuationLevel === 'undervalued' ? '估值偏低'
      : valuationLevel === 'overvalued' ? '估值偏高'
      : '估值合理',
    peTtmRange: {
      min: valuationWindow.peTtmMin,
      max: valuationWindow.peTtmMax,
      avg: valuationWindow.peTtmAvg,
    },
    pbRange: {
      min: valuationWindow.pbMin,
      max: valuationWindow.pbMax,
      avg: valuationWindow.pbAvg,
    },
  };
  
  // 股本市值
  const totalMvYi = features.totalMv ?? 0;
  const marketCapLevel = totalMvYi >= 1000 ? 'large' as const
    : totalMvYi >= 100 ? 'mid' as const
    : 'small' as const;
  
  const sharesInsight: SharesInsight = {
    totalMv: formatNumber(features.totalMv, 2) + '亿',
    circMv: formatNumber(features.circMv, 2) + '亿',
    totalShare: formatNumber(features.totalShare, 2) + '亿股',
    floatShare: formatNumber(features.floatShare, 2) + '亿股',
    freeShare: formatNumber(features.freeShare, 2) + '亿股',
    floatRatio: formatNumber(features.floatRatio, 2) + '%',
    marketCapLevel,
    marketCapText: marketCapLevel === 'large' ? '大盘股'
      : marketCapLevel === 'mid' ? '中盘股'
      : '小盘股',
  };
  
  // 生成摘要
  const summary = generateSummary(features, allInsights);
  
  return {
    stockCode,
    stockName,
    updateTime: marketData.updateTime,
    
    quoteOverview,
    trendInsight,
    momentumInsight,
    triggerInsights: triggerInsightItems,
    volatilityInsights: volatilityInsightItems,
    
    tradingActivity,
    valuationInsight,
    sharesInsight,
    
    summary,
    rawFeatures: features,
    klineData: marketData.kline,
    maData,
  };
}

/**
 * 生成简化版解读（用于列表显示）
 */
export function generateQuickInsight(
  marketData: MarketDataPackage,
  stockCode: string,
  stockName: string
): {
  code: string;
  name: string;
  price: number;
  pctChg: number;
  headline: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
} | null {
  const features = calculateMarketFeatures(marketData);
  if (!features) return null;
  
  const matchedRules = getMatchedRules(features);
  const allInsights: InsightItem[] = matchedRules.map(rule => ({
    ruleId: rule.id,
    category: rule.category,
    priority: rule.priority,
    conclusion: rule.conclusion(features),
    evidence: rule.evidence(features),
    sentiment: determineSentiment(rule, features),
  }));
  
  const summary = generateSummary(features, allInsights);
  
  return {
    code: stockCode,
    name: stockName,
    price: features.close,
    pctChg: features.pctChg,
    headline: summary.headline,
    sentiment: summary.overallSentiment,
  };
}
