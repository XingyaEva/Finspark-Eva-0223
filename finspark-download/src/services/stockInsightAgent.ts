/**
 * Stock Insight Agent - 股票面板 Tab 解读生成服务
 * 
 * 职责：基于股票实时行情数据，为各 Tab 生成专业版和白话版的解读
 * 
 * Tab 覆盖：
 * - 交易活跃 (Trading): 换手率、量比、成交额分析
 * - 估值分析 (Valuation): PE/PB 分位分析
 * - 股本市值 (Shares): 市值、股本结构分析
 */

import { VectorEngineService } from './vectorengine';

// ========== 类型定义 ==========

export interface TabInsight {
  /** 专业版解读（分析师风格，100-150字） */
  professional: string;
  /** 白话版解读（通俗易懂，80-120字） */
  simple: string;
  /** 情绪倾向 */
  sentiment: 'bullish' | 'bearish' | 'neutral';
  /** 关键要点（3-5个） */
  keyPoints: Array<{
    text: string;
    type: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface StockTabInsights {
  stockCode: string;
  stockName: string;
  /** 交易活跃解读 */
  trading: TabInsight;
  /** 估值分析解读 */
  valuation: TabInsight;
  /** 股本市值解读 */
  shares: TabInsight;
}

export interface TabInsightsResponse {
  success: boolean;
  data?: {
    insights: StockTabInsights;
    generatedAt: string;
    cached: boolean;
  };
  error?: string;
}

// ========== 输入数据类型 ==========

interface TradingData {
  turnoverRate: number;          // 换手率 %
  turnoverPercentile120: number; // 换手率120日分位 %
  turnoverActivityLevel: string; // 活跃度级别
  volumeRatio: number;           // 量比
  volumePercentile20: number;    // 量比20日分位 %
  amount: number;                // 成交额（元）
  avgAmount20: number;           // 20日平均成交额
}

interface ValuationData {
  pe: number;                    // PE
  peTtm: number;                 // PE-TTM
  pb: number;                    // PB
  peTtmPercentile: number;       // PE-TTM 分位 %
  pbPercentile: number;          // PB 分位 %
  valuationLevel: string;        // 估值水平
  peTtmRange: { min: number; max: number; avg: number };
  pbRange: { min: number; max: number; avg: number };
}

interface SharesData {
  totalMv: number;               // 总市值（亿）
  circMv: number;                // 流通市值（亿）
  totalShare: number;            // 总股本（亿股）
  floatShare: number;            // 流通股本（亿股）
  freeShare: number;             // 自由流通股（亿股）
  floatRatio: number;            // 流通占比 %
  marketCapLevel: string;        // 市值级别
}

export interface StockInsightInput {
  stockCode: string;
  stockName: string;
  trading: TradingData;
  valuation: ValuationData;
  shares: SharesData;
}

// ========== 提示词模板 ==========

const STOCK_INSIGHT_PROMPT = `你是一位资深的证券分析师，专注于为投资者提供专业且易懂的股票分析解读。

## 任务
基于以下股票的实时数据，为三个分析维度分别生成**专业版**和**白话版**两种解读。

## 股票信息
- 股票代码：{stockCode}
- 股票名称：{stockName}

## 交易活跃数据
- 换手率：{turnoverRate}%（120日分位：{turnoverPercentile120}%，活跃度：{turnoverActivityLevel}）
- 量比：{volumeRatio}（20日分位：{volumePercentile20}%）
- 成交额：{amount}亿元（20日均值：{avgAmount20}亿元）

## 估值数据
- PE-TTM：{peTtm}（分位：{peTtmPercentile}%，范围：{peTtmMin}~{peTtmMax}）
- PB：{pb}（分位：{pbPercentile}%，范围：{pbMin}~{pbMax}）
- 估值水平：{valuationLevel}

## 股本市值数据
- 总市值：{totalMv}亿元
- 流通市值：{circMv}亿元
- 总股本：{totalShare}亿股
- 流通股本：{floatShare}亿股
- 自由流通股：{freeShare}亿股
- 流通占比：{floatRatio}%
- 市值级别：{marketCapLevel}

## 输出要求

请严格按照以下 JSON 格式输出：

\`\`\`json
{
  "trading": {
    "professional": "专业版解读（100-150字，使用专业术语，分析交易活跃度、资金关注度、量价关系等）",
    "simple": "白话版解读（80-120字，通俗易懂，帮助初学者理解当前交易情况）",
    "sentiment": "bullish/bearish/neutral",
    "keyPoints": [
      {"text": "关键点1", "type": "positive/negative/neutral"},
      {"text": "关键点2", "type": "positive/negative/neutral"},
      {"text": "关键点3", "type": "positive/negative/neutral"}
    ]
  },
  "valuation": {
    "professional": "专业版解读（100-150字，分析估值水平、历史分位、投资价值等）",
    "simple": "白话版解读（80-120字，用简单的话解释股票是贵还是便宜）",
    "sentiment": "bullish/bearish/neutral",
    "keyPoints": [
      {"text": "关键点1", "type": "positive/negative/neutral"},
      {"text": "关键点2", "type": "positive/negative/neutral"},
      {"text": "关键点3", "type": "positive/negative/neutral"}
    ]
  },
  "shares": {
    "professional": "专业版解读（100-150字，分析市值规模、股本结构、流动性等）",
    "simple": "白话版解读（80-120字，用简单的话解释公司规模和流通情况）",
    "sentiment": "bullish/bearish/neutral",
    "keyPoints": [
      {"text": "关键点1", "type": "positive/negative/neutral"},
      {"text": "关键点2", "type": "positive/negative/neutral"},
      {"text": "关键点3", "type": "positive/negative/neutral"}
    ]
  }
}
\`\`\`

## 解读风格指南

### 专业版
- 使用专业金融术语
- 分析数据背后的含义
- 提供投资参考建议
- 关注风险提示

### 白话版
- 避免专业术语，用日常语言
- 打比方帮助理解
- 直接说明是好是坏
- 给出简单的建议

### sentiment 判断标准
- bullish: 数据整体偏正面，利好因素较多
- bearish: 数据整体偏负面，风险因素较多
- neutral: 数据中性，无明显偏向

### keyPoints 要求
- 每个维度 3-5 个关键点
- 正面因素标记为 positive
- 负面因素标记为 negative
- 中性信息标记为 neutral

请直接输出 JSON，不要有其他说明文字。`;

// ========== 服务实现 ==========

export class StockInsightAgent {
  private vectorEngine: VectorEngineService;
  private cache: KVNamespace | null;
  
  // 缓存 TTL（秒）
  private readonly CACHE_TTL_TRADING_HOURS = 15 * 60;  // 盘中 15 分钟
  private readonly CACHE_TTL_AFTER_HOURS = 60 * 60;    // 盘后 60 分钟
  
  constructor(config: {
    vectorEngine: VectorEngineService;
    cache?: KVNamespace;
  }) {
    this.vectorEngine = config.vectorEngine;
    this.cache = config.cache || null;
  }
  
  /**
   * 生成股票 Tab 解读
   */
  async generateInsights(input: StockInsightInput): Promise<TabInsightsResponse> {
    const cacheKey = `tab-insights:${input.stockCode}`;
    
    // 尝试读取缓存
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          console.log('[StockInsightAgent] 使用缓存数据:', input.stockCode);
          return {
            success: true,
            data: {
              insights: JSON.parse(cached),
              generatedAt: new Date().toISOString(),
              cached: true,
            },
          };
        }
      } catch (e) {
        console.warn('[StockInsightAgent] 缓存读取失败:', e);
      }
    }
    
    // 构建提示词
    const prompt = this.buildPrompt(input);
    
    try {
      console.log('[StockInsightAgent] 开始生成解读:', input.stockCode);
      
      // 调用 LLM
      const response = await this.vectorEngine.chat({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'deepseek-chat',  // 使用 DeepSeek 模型
        temperature: 0.7,
        max_tokens: 2000,
      });
      
      // 解析响应
      const content = response.choices?.[0]?.message?.content || '';
      const insights = this.parseResponse(content, input);
      
      if (!insights) {
        throw new Error('解析响应失败');
      }
      
      // 写入缓存
      if (this.cache) {
        const ttl = this.getCacheTTL();
        try {
          await this.cache.put(cacheKey, JSON.stringify(insights), { expirationTtl: ttl });
          console.log('[StockInsightAgent] 缓存写入成功, TTL:', ttl);
        } catch (e) {
          console.warn('[StockInsightAgent] 缓存写入失败:', e);
        }
      }
      
      console.log('[StockInsightAgent] 解读生成成功:', input.stockCode);
      
      return {
        success: true,
        data: {
          insights,
          generatedAt: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      console.error('[StockInsightAgent] 生成失败:', error);
      
      // 返回降级的本地解读
      const fallbackInsights = this.generateFallbackInsights(input);
      
      return {
        success: true,
        data: {
          insights: fallbackInsights,
          generatedAt: new Date().toISOString(),
          cached: false,
        },
      };
    }
  }
  
  /**
   * 构建提示词
   */
  private buildPrompt(input: StockInsightInput): string {
    const { stockCode, stockName, trading, valuation, shares } = input;
    
    return STOCK_INSIGHT_PROMPT
      .replace('{stockCode}', stockCode)
      .replace('{stockName}', stockName)
      // Trading
      .replace('{turnoverRate}', trading.turnoverRate?.toFixed(2) || '--')
      .replace('{turnoverPercentile120}', trading.turnoverPercentile120?.toFixed(0) || '50')
      .replace('{turnoverActivityLevel}', trading.turnoverActivityLevel || '正常')
      .replace('{volumeRatio}', trading.volumeRatio?.toFixed(2) || '--')
      .replace('{volumePercentile20}', trading.volumePercentile20?.toFixed(0) || '50')
      .replace('{amount}', ((trading.amount || 0) / 1e8).toFixed(2))
      .replace('{avgAmount20}', ((trading.avgAmount20 || 0) / 1e8).toFixed(2))
      // Valuation
      .replace('{peTtm}', valuation.peTtm?.toFixed(2) || '--')
      .replace('{peTtmPercentile}', valuation.peTtmPercentile?.toFixed(0) || '50')
      .replace('{peTtmMin}', valuation.peTtmRange?.min?.toFixed(2) || '--')
      .replace('{peTtmMax}', valuation.peTtmRange?.max?.toFixed(2) || '--')
      .replace('{pb}', valuation.pb?.toFixed(2) || '--')
      .replace('{pbPercentile}', valuation.pbPercentile?.toFixed(0) || '50')
      .replace('{pbMin}', valuation.pbRange?.min?.toFixed(2) || '--')
      .replace('{pbMax}', valuation.pbRange?.max?.toFixed(2) || '--')
      .replace('{valuationLevel}', valuation.valuationLevel || '合理')
      // Shares
      .replace('{totalMv}', shares.totalMv?.toFixed(2) || '--')
      .replace('{circMv}', shares.circMv?.toFixed(2) || '--')
      .replace('{totalShare}', shares.totalShare?.toFixed(2) || '--')
      .replace('{floatShare}', shares.floatShare?.toFixed(2) || '--')
      .replace('{freeShare}', shares.freeShare?.toFixed(2) || '--')
      .replace('{floatRatio}', shares.floatRatio?.toFixed(2) || '--')
      .replace('{marketCapLevel}', shares.marketCapLevel || '中盘股');
  }
  
  /**
   * 解析 LLM 响应
   */
  private parseResponse(content: string, input: StockInsightInput): StockTabInsights | null {
    try {
      // 提取 JSON 块
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[StockInsightAgent] 未找到 JSON 块');
        return null;
      }
      
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // 验证结构
      if (!parsed.trading || !parsed.valuation || !parsed.shares) {
        console.error('[StockInsightAgent] JSON 结构不完整');
        return null;
      }
      
      return {
        stockCode: input.stockCode,
        stockName: input.stockName,
        trading: this.validateTabInsight(parsed.trading),
        valuation: this.validateTabInsight(parsed.valuation),
        shares: this.validateTabInsight(parsed.shares),
      };
    } catch (e) {
      console.error('[StockInsightAgent] JSON 解析失败:', e);
      return null;
    }
  }
  
  /**
   * 验证并补全 TabInsight 结构
   */
  private validateTabInsight(insight: any): TabInsight {
    return {
      professional: insight.professional || '数据分析中...',
      simple: insight.simple || '数据分析中...',
      sentiment: ['bullish', 'bearish', 'neutral'].includes(insight.sentiment) ? insight.sentiment : 'neutral',
      keyPoints: Array.isArray(insight.keyPoints) ? insight.keyPoints.map((p: any) => ({
        text: p.text || '',
        type: ['positive', 'negative', 'neutral'].includes(p.type) ? p.type : 'neutral',
      })) : [],
    };
  }
  
  /**
   * 生成降级的本地解读（当 LLM 调用失败时）
   */
  private generateFallbackInsights(input: StockInsightInput): StockTabInsights {
    const { stockCode, stockName, trading, valuation, shares } = input;
    
    // 交易活跃降级解读
    const tradingLevel = trading.turnoverPercentile120 > 70 ? 'active' : (trading.turnoverPercentile120 < 30 ? 'quiet' : 'normal');
    const tradingSentiment = tradingLevel === 'active' ? 'bullish' : (tradingLevel === 'quiet' ? 'bearish' : 'neutral');
    
    // 估值降级解读
    const valSentiment = valuation.valuationLevel === 'undervalued' ? 'bullish' : (valuation.valuationLevel === 'overvalued' ? 'bearish' : 'neutral');
    
    // 股本降级解读
    const sharesSentiment = shares.floatRatio >= 100 ? 'bullish' : 'neutral';
    
    return {
      stockCode,
      stockName,
      trading: {
        professional: `当前换手率${trading.turnoverRate?.toFixed(2)}%，处于近120日的${trading.turnoverPercentile120?.toFixed(0)}%分位。量比${trading.volumeRatio?.toFixed(2)}，成交额${((trading.amount || 0) / 1e8).toFixed(2)}亿元。整体交投${trading.turnoverActivityLevel || '正常'}。`,
        simple: `今天股票的交易${tradingLevel === 'active' ? '比较活跃，有很多人在买卖' : tradingLevel === 'quiet' ? '比较冷清，买卖的人不多' : '表现正常，不温不火'}。`,
        sentiment: tradingSentiment,
        keyPoints: [
          { text: `换手率${trading.turnoverPercentile120 > 70 ? '较高' : trading.turnoverPercentile120 < 30 ? '较低' : '正常'}`, type: tradingLevel === 'active' ? 'positive' : tradingLevel === 'quiet' ? 'negative' : 'neutral' },
          { text: `量比${trading.volumeRatio > 1.5 ? '放大' : trading.volumeRatio < 0.8 ? '萎缩' : '持平'}`, type: trading.volumeRatio > 1.5 ? 'positive' : trading.volumeRatio < 0.8 ? 'negative' : 'neutral' },
        ],
      },
      valuation: {
        professional: `当前PE-TTM为${valuation.peTtm?.toFixed(2)}倍，处于近期${valuation.peTtmPercentile?.toFixed(0)}%分位。PB为${valuation.pb?.toFixed(2)}倍，处于${valuation.pbPercentile?.toFixed(0)}%分位。整体估值${valuation.valuationLevel === 'undervalued' ? '偏低' : valuation.valuationLevel === 'overvalued' ? '偏高' : '合理'}。`,
        simple: `从估值角度看，这只股票目前${valuation.valuationLevel === 'undervalued' ? '相对便宜，可能被低估了' : valuation.valuationLevel === 'overvalued' ? '相对贵一些，要小心' : '价格合理，不贵也不便宜'}。`,
        sentiment: valSentiment,
        keyPoints: [
          { text: `PE分位${valuation.peTtmPercentile?.toFixed(0)}%`, type: valuation.peTtmPercentile < 30 ? 'positive' : valuation.peTtmPercentile > 70 ? 'negative' : 'neutral' },
          { text: `PB分位${valuation.pbPercentile?.toFixed(0)}%`, type: valuation.pbPercentile < 30 ? 'positive' : valuation.pbPercentile > 70 ? 'negative' : 'neutral' },
        ],
      },
      shares: {
        professional: `总市值${shares.totalMv?.toFixed(2)}亿元，流通市值${shares.circMv?.toFixed(2)}亿元，属于${shares.marketCapLevel || '中盘股'}。流通股占比${shares.floatRatio?.toFixed(2)}%，自由流通股${shares.freeShare?.toFixed(2)}亿股。`,
        simple: `这是一家${shares.marketCapLevel === 'large' ? '大公司' : shares.marketCapLevel === 'small' ? '小公司' : '中等规模的公司'}，市值${shares.totalMv?.toFixed(0)}亿。${shares.floatRatio >= 100 ? '股票全部可以自由交易，流动性好' : '有部分股票暂时不能交易'}。`,
        sentiment: sharesSentiment,
        keyPoints: [
          { text: shares.marketCapLevel === 'large' ? '大盘股' : shares.marketCapLevel === 'small' ? '小盘股' : '中盘股', type: 'neutral' },
          { text: `流通占比${shares.floatRatio?.toFixed(0)}%`, type: shares.floatRatio >= 100 ? 'positive' : 'neutral' },
        ],
      },
    };
  }
  
  /**
   * 获取缓存 TTL（基于当前时间判断是否在交易时段）
   */
  private getCacheTTL(): number {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 60 + minute;
    
    // 交易时段: 9:30-11:30, 13:00-15:00
    const isTradingHours = 
      (time >= 9 * 60 + 30 && time <= 11 * 60 + 30) ||
      (time >= 13 * 60 && time <= 15 * 60);
    
    // 工作日判断（简化版，不考虑节假日）
    const dayOfWeek = now.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (isWeekday && isTradingHours) {
      return this.CACHE_TTL_TRADING_HOURS;
    }
    return this.CACHE_TTL_AFTER_HOURS;
  }
}

/**
 * 创建 StockInsightAgent 实例
 */
export function createStockInsightAgent(config: {
  vectorEngine: VectorEngineService;
  cache?: KVNamespace;
}): StockInsightAgent {
  return new StockInsightAgent(config);
}

// ========== API 路由辅助函数 ==========

/**
 * 从 insightPackage 生成 Tab 解读
 */
export async function generateTabInsights(
  insightPackage: any,
  vectorEngine: VectorEngineService
): Promise<{
  insights: StockTabInsights;
  generatedAt: string;
}> {
  const stockCode = insightPackage.stockCode || '';
  const stockName = insightPackage.stockName || '';
  
  // 从 insightPackage 提取数据
  const trading = insightPackage.tradingActivity || {};
  const valuation = insightPackage.valuationInsight || {};
  const shares = insightPackage.sharesInsight || {};
  
  // 构建输入
  const input: StockInsightInput = {
    stockCode,
    stockName,
    trading: {
      turnoverRate: trading.turnoverRate || 0,
      turnoverPercentile120: trading.turnoverPercentile120 || 50,
      turnoverActivityLevel: trading.activityLevel || '正常',
      volumeRatio: trading.volumeRatio || 1,
      volumePercentile20: trading.volumePercentile20 || 50,
      amount: trading.amount || 0,
      avgAmount20: trading.avgAmount20 || 0,
    },
    valuation: {
      pe: valuation.pe || 0,
      peTtm: valuation.peTtm || 0,
      pb: valuation.pb || 0,
      peTtmPercentile: valuation.peTtmPercentile || 50,
      pbPercentile: valuation.pbPercentile || 50,
      valuationLevel: valuation.valuationLevel || 'fair',
      peTtmRange: valuation.peTtmRange || { min: 0, max: 0, avg: 0 },
      pbRange: valuation.pbRange || { min: 0, max: 0, avg: 0 },
    },
    shares: {
      totalMv: parseFloat(shares.totalMv) || 0,
      circMv: parseFloat(shares.circMv) || 0,
      totalShare: parseFloat(shares.totalShare) || 0,
      floatShare: parseFloat(shares.floatShare) || 0,
      freeShare: parseFloat(shares.freeShare) || 0,
      floatRatio: parseFloat(shares.floatRatio) || 0,
      marketCapLevel: shares.marketCapLevel || 'mid',
    },
  };
  
  // 创建 Agent 并生成解读
  const agent = new StockInsightAgent({ vectorEngine });
  const result = await agent.generateInsights(input);
  
  if (result.success && result.data) {
    return {
      insights: result.data.insights,
      generatedAt: result.data.generatedAt,
    };
  }
  
  // 降级处理
  const fallbackAgent = new StockInsightAgent({ vectorEngine });
  return {
    insights: (fallbackAgent as any).generateFallbackInsights(input),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 获取缓存的解读数据
 */
export async function getCachedInsights(
  stockCode: string,
  cache: KVNamespace
): Promise<{ insights: StockTabInsights; generatedAt: string } | null> {
  try {
    const cacheKey = `tab-insights:${stockCode}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[StockInsightAgent] Cache read error:', e);
  }
  return null;
}

/**
 * 缓存解读数据
 */
export async function cacheInsights(
  data: { insights: StockTabInsights; generatedAt: string },
  cache: KVNamespace,
  ttl: number
): Promise<void> {
  try {
    const cacheKey = `tab-insights:${data.insights.stockCode}`;
    await cache.put(cacheKey, JSON.stringify(data), { expirationTtl: ttl });
  } catch (e) {
    console.warn('[StockInsightAgent] Cache write error:', e);
  }
}

/**
 * 获取缓存 TTL
 */
export function getInsightCacheTTL(): number {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const time = hour * 60 + minute;
  
  // 交易时段: 9:30-11:30, 13:00-15:00
  const isTradingHours = 
    (time >= 9 * 60 + 30 && time <= 11 * 60 + 30) ||
    (time >= 13 * 60 && time <= 15 * 60);
  
  // 工作日判断
  const dayOfWeek = now.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  if (isWeekday && isTradingHours) {
    return 15 * 60;  // 盘中 15 分钟
  }
  return 60 * 60;    // 盘后 60 分钟
}
