/**
 * 股票走势解读规则库
 * 纯规则驱动，不依赖 LLM
 * 
 * 规则分类：
 * 1. 趋势规则 (trend) - 判断价格趋势和均线关系
 * 2. 量能规则 (momentum) - 判断成交量和资金流向
 * 3. 波动规则 (volatility) - 判断振幅和价格变动
 * 4. 触发规则 (trigger) - 关键位置和信号
 */

import type { MarketFeatures } from './marketFeatures';

// ========== 规则类型定义 ==========

export interface InsightRule {
  id: string;
  category: 'trend' | 'momentum' | 'volatility' | 'trigger';
  priority: number;  // 1-10，越高越重要
  condition: (f: MarketFeatures) => boolean;
  conclusion: (f: MarketFeatures) => string;
  evidence: (f: MarketFeatures) => string[];
  meaning?: (f: MarketFeatures) => string;  // 可选的解读说明
}

// ========== 趋势规则 ==========

export const trendRules: InsightRule[] = [
  // 多头排列
  {
    id: 'trend_bullish_arrangement',
    category: 'trend',
    priority: 8,
    condition: (f) => f.maArrangement === 'bullish' && f.aboveMa20,
    conclusion: () => '均线呈多头排列，趋势向好',
    evidence: (f) => [
      `MA5(${f.ma5?.toFixed(2)}) > MA10(${f.ma10?.toFixed(2)}) > MA20(${f.ma20?.toFixed(2)})`,
      `收盘价站上20日均线`,
    ],
    meaning: () => '多头排列表明短期、中期均线依次向上发散，市场处于上升趋势中，持股者成本优势明显',
  },
  
  // 空头排列
  {
    id: 'trend_bearish_arrangement',
    category: 'trend',
    priority: 8,
    condition: (f) => f.maArrangement === 'bearish' && !f.aboveMa20,
    conclusion: () => '均线呈空头排列，趋势偏弱',
    evidence: (f) => [
      `MA5(${f.ma5?.toFixed(2)}) < MA10(${f.ma10?.toFixed(2)}) < MA20(${f.ma20?.toFixed(2)})`,
      `收盘价位于20日均线下方`,
    ],
    meaning: () => '空头排列表明短期均线向下压制，持股者普遍被套，反弹时可能面临抛压',
  },
  
  // 站上20日均线
  {
    id: 'trend_above_ma20',
    category: 'trend',
    priority: 6,
    condition: (f) => f.aboveMa20 && f.closeVsMa20Pct !== null && f.closeVsMa20Pct > 0 && f.closeVsMa20Pct < 5,
    conclusion: () => '股价站稳20日均线上方',
    evidence: (f) => [
      `当前价格${f.close.toFixed(2)}，高于MA20(${f.ma20?.toFixed(2)})`,
      `偏离度${f.closeVsMa20Pct?.toFixed(2)}%`,
    ],
  },
  
  // 跌破20日均线
  {
    id: 'trend_below_ma20',
    category: 'trend',
    priority: 6,
    condition: (f) => !f.aboveMa20 && f.closeVsMa20Pct !== null && f.closeVsMa20Pct < -3,
    conclusion: () => '股价跌破20日均线，短期承压',
    evidence: (f) => [
      `当前价格${f.close.toFixed(2)}，低于MA20(${f.ma20?.toFixed(2)})`,
      `偏离度${f.closeVsMa20Pct?.toFixed(2)}%`,
    ],
  },
  
  // 站上60日均线
  {
    id: 'trend_above_ma60',
    category: 'trend',
    priority: 7,
    condition: (f) => f.aboveMa60 && f.closeVsMa60Pct !== null && f.closeVsMa60Pct > 0,
    conclusion: () => '股价站稳60日均线，中期趋势向好',
    evidence: (f) => [
      `当前价格高于MA60(${f.ma60?.toFixed(2)})`,
      `偏离度${f.closeVsMa60Pct?.toFixed(2)}%`,
    ],
  },
  
  // 跌破60日均线
  {
    id: 'trend_below_ma60',
    category: 'trend',
    priority: 7,
    condition: (f) => f.ma60 !== null && !f.aboveMa60 && f.closeVsMa60Pct !== null && f.closeVsMa60Pct < -5,
    conclusion: () => '股价跌破60日均线，中期趋势转弱',
    evidence: (f) => [
      `当前价格低于MA60(${f.ma60?.toFixed(2)})`,
      `偏离度${f.closeVsMa60Pct?.toFixed(2)}%`,
    ],
  },
  
  // 近20日高位
  {
    id: 'trend_near_20d_high',
    category: 'trend',
    priority: 5,
    condition: (f) => f.positionIn20d !== null && f.positionIn20d >= 80,
    conclusion: () => '股价处于近20日高位区间',
    evidence: (f) => [
      `当前位置在20日区间的${f.positionIn20d}%`,
      `距20日高点${f.distanceToHigh20dPct?.toFixed(2)}%`,
    ],
  },
  
  // 近20日低位
  {
    id: 'trend_near_20d_low',
    category: 'trend',
    priority: 5,
    condition: (f) => f.positionIn20d !== null && f.positionIn20d <= 20,
    conclusion: () => '股价处于近20日低位区间',
    evidence: (f) => [
      `当前位置在20日区间的${f.positionIn20d}%`,
      `距20日低点${f.distanceToLow20dPct?.toFixed(2)}%`,
    ],
  },
];

// ========== 量能规则 ==========

export const momentumRules: InsightRule[] = [
  // 放量上涨
  {
    id: 'momentum_volume_surge_up',
    category: 'momentum',
    priority: 9,
    condition: (f) => f.volumeStatus === 'surge' && f.pctChg > 2,
    conclusion: () => '放量上涨，资金积极入场',
    evidence: (f) => [
      `成交量较5日均量放大`,
      `涨幅${f.pctChg.toFixed(2)}%`,
      `成交额${f.amountBillion.toFixed(2)}亿元`,
    ],
    meaning: () => '放量上涨表明多方力量强劲，市场认可度高，上涨有量能支撑',
  },
  
  // 放量下跌
  {
    id: 'momentum_volume_surge_down',
    category: 'momentum',
    priority: 9,
    condition: (f) => f.volumeStatus === 'surge' && f.pctChg < -2,
    conclusion: () => '放量下跌，抛压较重',
    evidence: (f) => [
      `成交量较5日均量放大`,
      `跌幅${Math.abs(f.pctChg).toFixed(2)}%`,
      `成交额${f.amountBillion.toFixed(2)}亿元`,
    ],
    meaning: () => '放量下跌表明卖方力量强劲，可能有资金出逃，需警惕进一步调整',
  },
  
  // 缩量上涨
  {
    id: 'momentum_volume_shrink_up',
    category: 'momentum',
    priority: 6,
    condition: (f) => f.volumeStatus === 'shrink' && f.pctChg > 1,
    conclusion: () => '缩量上涨，上行动能不足',
    evidence: (f) => [
      `成交量较5日均量萎缩`,
      `涨幅${f.pctChg.toFixed(2)}%`,
    ],
    meaning: () => '缩量上涨表明追涨意愿不强，上涨持续性存疑',
  },
  
  // 缩量下跌
  {
    id: 'momentum_volume_shrink_down',
    category: 'momentum',
    priority: 5,
    condition: (f) => f.volumeStatus === 'shrink' && f.pctChg < -1,
    conclusion: () => '缩量下跌，抛压暂时可控',
    evidence: (f) => [
      `成交量较5日均量萎缩`,
      `跌幅${Math.abs(f.pctChg).toFixed(2)}%`,
    ],
  },
  
  // 换手率异常高
  {
    id: 'momentum_high_turnover',
    category: 'momentum',
    priority: 7,
    condition: (f) => f.turnoverPercentile120 !== null && f.turnoverPercentile120 >= 90,
    conclusion: () => '换手率处于120日高位，交投活跃',
    evidence: (f) => [
      `当前换手率${f.turnoverRate?.toFixed(2)}%`,
      `处于近120日的${f.turnoverPercentile120}%分位`,
    ],
    meaning: () => '高换手率表明市场分歧较大或有资金大幅进出，需关注后续走势验证方向',
  },
  
  // 换手率异常低
  {
    id: 'momentum_low_turnover',
    category: 'momentum',
    priority: 4,
    condition: (f) => f.turnoverPercentile120 !== null && f.turnoverPercentile120 <= 10,
    conclusion: () => '换手率处于120日低位，交投清淡',
    evidence: (f) => [
      `当前换手率${f.turnoverRate?.toFixed(2)}%`,
      `处于近120日的${f.turnoverPercentile120}%分位`,
    ],
  },
  
  // 量比异常
  {
    id: 'momentum_volume_ratio_high',
    category: 'momentum',
    priority: 6,
    condition: (f) => f.volumeRatio !== null && f.volumeRatio > 2,
    conclusion: () => '量比偏高，成交活跃度明显提升',
    evidence: (f) => [
      `当前量比${f.volumeRatio?.toFixed(2)}`,
      `表示成交量是近5日平均的${f.volumeRatio?.toFixed(2)}倍`,
    ],
  },
  
  // 成交额偏离
  {
    id: 'momentum_amount_deviation',
    category: 'momentum',
    priority: 5,
    condition: (f) => f.amtVsMa20Pct !== null && Math.abs(f.amtVsMa20Pct) > 50,
    conclusion: (f) => f.amtVsMa20Pct! > 0 
      ? '成交额显著高于20日均值'
      : '成交额显著低于20日均值',
    evidence: (f) => [
      `成交额${f.amountBillion.toFixed(2)}亿元`,
      `较20日均值偏离${f.amtVsMa20Pct?.toFixed(1)}%`,
    ],
  },
];

// ========== 波动规则 ==========

export const volatilityRules: InsightRule[] = [
  // 高振幅
  {
    id: 'volatility_high_amplitude',
    category: 'volatility',
    priority: 7,
    condition: (f) => f.amplitude > 5,
    conclusion: () => '日内振幅较大，波动加剧',
    evidence: (f) => [
      `振幅${f.amplitude.toFixed(2)}%`,
      `最高${f.high.toFixed(2)}，最低${f.low.toFixed(2)}`,
    ],
    meaning: () => '高振幅表明多空争夺激烈，短线交易者需注意风险控制',
  },
  
  // 跳空高开
  {
    id: 'volatility_gap_up',
    category: 'volatility',
    priority: 8,
    condition: (f) => f.gapPct > 2,
    conclusion: () => '跳空高开，市场情绪积极',
    evidence: (f) => [
      `开盘跳空${f.gapPct.toFixed(2)}%`,
      `开盘价${f.open.toFixed(2)}，昨收${f.preClose.toFixed(2)}`,
    ],
    meaning: () => '跳空高开通常反映利好消息或市场情绪突变，关注能否回补缺口',
  },
  
  // 跳空低开
  {
    id: 'volatility_gap_down',
    category: 'volatility',
    priority: 8,
    condition: (f) => f.gapPct < -2,
    conclusion: () => '跳空低开，市场情绪谨慎',
    evidence: (f) => [
      `开盘跳空${f.gapPct.toFixed(2)}%`,
      `开盘价${f.open.toFixed(2)}，昨收${f.preClose.toFixed(2)}`,
    ],
  },
  
  // 大涨
  {
    id: 'volatility_big_rise',
    category: 'volatility',
    priority: 9,
    condition: (f) => f.pctChg >= 5,
    conclusion: () => '股价大幅上涨',
    evidence: (f) => [
      `涨幅${f.pctChg.toFixed(2)}%`,
      `收盘价${f.close.toFixed(2)}`,
    ],
  },
  
  // 大跌
  {
    id: 'volatility_big_drop',
    category: 'volatility',
    priority: 9,
    condition: (f) => f.pctChg <= -5,
    conclusion: () => '股价大幅下跌',
    evidence: (f) => [
      `跌幅${Math.abs(f.pctChg).toFixed(2)}%`,
      `收盘价${f.close.toFixed(2)}`,
    ],
  },
  
  // 涨停
  {
    id: 'volatility_limit_up',
    category: 'volatility',
    priority: 10,
    condition: (f) => f.pctChg >= 9.5 && f.pctChg <= 10.5,
    conclusion: () => '涨停板',
    evidence: (f) => [
      `涨幅${f.pctChg.toFixed(2)}%`,
      `成交额${f.amountBillion.toFixed(2)}亿元`,
    ],
  },
  
  // 跌停
  {
    id: 'volatility_limit_down',
    category: 'volatility',
    priority: 10,
    condition: (f) => f.pctChg <= -9.5 && f.pctChg >= -10.5,
    conclusion: () => '跌停板',
    evidence: (f) => [
      `跌幅${Math.abs(f.pctChg).toFixed(2)}%`,
      `成交额${f.amountBillion.toFixed(2)}亿元`,
    ],
  },
];

// ========== 触发规则（关注位）==========

export const triggerRules: InsightRule[] = [
  // 突破20日高点
  {
    id: 'trigger_break_20d_high',
    category: 'trigger',
    priority: 9,
    condition: (f) => f.priceBreakout === 'breakHigh',
    conclusion: () => '突破20日高点，关注能否有效站稳',
    evidence: (f) => [
      `当前价格${f.close.toFixed(2)}`,
      `20日高点${f.high20d?.toFixed(2)}`,
    ],
    meaning: () => '突破近期高点是技术面的重要信号，若能有效站稳则打开上行空间',
  },
  
  // 跌破20日低点
  {
    id: 'trigger_break_20d_low',
    category: 'trigger',
    priority: 9,
    condition: (f) => f.priceBreakout === 'breakLow',
    conclusion: () => '跌破20日低点，短期支撑失守',
    evidence: (f) => [
      `当前价格${f.close.toFixed(2)}`,
      `20日低点${f.low20d?.toFixed(2)}`,
    ],
    meaning: () => '跌破近期低点表明空方占优，需关注下一支撑位',
  },
  
  // 逼近20日高点
  {
    id: 'trigger_near_resistance',
    category: 'trigger',
    priority: 6,
    condition: (f) => f.distanceToHigh20dPct !== null && f.distanceToHigh20dPct > 0 && f.distanceToHigh20dPct < 3,
    conclusion: () => '逼近20日高点压力位',
    evidence: (f) => [
      `距20日高点${f.distanceToHigh20dPct?.toFixed(2)}%`,
      `压力位参考${f.high20d?.toFixed(2)}`,
    ],
  },
  
  // 逼近20日低点
  {
    id: 'trigger_near_support',
    category: 'trigger',
    priority: 6,
    condition: (f) => f.distanceToLow20dPct !== null && f.distanceToLow20dPct > 0 && f.distanceToLow20dPct < 3,
    conclusion: () => '逼近20日低点支撑位',
    evidence: (f) => [
      `距20日低点${f.distanceToLow20dPct?.toFixed(2)}%`,
      `支撑位参考${f.low20d?.toFixed(2)}`,
    ],
  },
  
  // MA5金叉MA10
  {
    id: 'trigger_ma5_cross_ma10_up',
    category: 'trigger',
    priority: 7,
    condition: (f) => f.ma5 !== null && f.ma10 !== null && f.ma5 > f.ma10 && f.closeVsMa5Pct !== null && f.closeVsMa5Pct > 0,
    conclusion: () => 'MA5上穿MA10，短期趋势转强',
    evidence: (f) => [
      `MA5(${f.ma5?.toFixed(2)}) > MA10(${f.ma10?.toFixed(2)})`,
    ],
  },
];

// ========== 导出所有规则 ==========

export const ALL_RULES: InsightRule[] = [
  ...trendRules,
  ...momentumRules,
  ...volatilityRules,
  ...triggerRules,
];

/**
 * 按类别获取规则
 */
export function getRulesByCategory(category: InsightRule['category']): InsightRule[] {
  return ALL_RULES.filter(rule => rule.category === category);
}

/**
 * 获取匹配的规则
 */
export function getMatchedRules(features: MarketFeatures): InsightRule[] {
  return ALL_RULES.filter(rule => {
    try {
      return rule.condition(features);
    } catch {
      return false;
    }
  }).sort((a, b) => b.priority - a.priority);
}
