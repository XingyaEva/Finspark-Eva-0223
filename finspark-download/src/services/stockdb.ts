// 股票数据库服务 - D1 本地优先 + Tushare 实时降级
// 提供统一的股票数据访问接口
// 支持拼音搜索、模糊匹配、错别字容错

import { TushareService, StockBasic } from './tushare';
import { toPinyin, toPinyinAbbr, similarity, correctTypo } from './pinyin';

export interface StockRecord {
  id: number;
  ts_code: string;
  symbol: string;
  name: string;
  area: string | null;
  industry: string | null;
  market: string | null;
  exchange: string | null;
  list_date: string | null;
  list_status: string;
  is_hot: number;
  search_count: number;
}

export interface StockSearchResult {
  code: string;
  name: string;
  industry: string | null;
  market: string | null;
  source: 'local' | 'tushare';
}

export interface StockDBConfig {
  db: D1Database;
  tushare?: TushareService;
  cache?: KVNamespace;
}

/**
 * 股票数据库服务
 * 实现本地 D1 优先 + Tushare API 降级的搜索策略
 */
export class StockDBService {
  private db: D1Database;
  private tushare?: TushareService;
  private cache?: KVNamespace;

  constructor(config: StockDBConfig) {
    this.db = config.db;
    this.tushare = config.tushare;
    this.cache = config.cache;
  }

  /**
   * 智能搜索股票 - 性能优化版
   * 1. 优先使用单次高效SQL查询
   * 2. 不再同步等待Tushare API（极大减少延迟）
   * 3. 后台异步补充数据
   */
  async searchStocks(keyword: string, limit: number = 20): Promise<StockSearchResult[]> {
    // 直接从本地 D1 快速搜索，不等待 Tushare
    const localResults = await this.searchFromDBFast(keyword, limit);
    
    // 如果本地没有结果，异步触发 Tushare 补充（不阻塞返回）
    if (localResults.length === 0 && this.tushare) {
      // 使用 setTimeout 确保不阻塞响应
      setTimeout(async () => {
        try {
          const tushareResults = await this.searchFromTushare(keyword, 10);
          if (tushareResults.length > 0) {
            await this.saveNewStocksToDB(tushareResults);
          }
        } catch (error) {
          console.error('Background Tushare fetch error:', error);
        }
      }, 0);
    }

    return localResults;
  }

  /**
   * 增强版本地搜索 - 支持拼音、模糊匹配、错别字容错
   */
  private async searchFromDBFast(keyword: string, limit: number): Promise<StockSearchResult[]> {
    try {
      // 预处理关键词
      const originalKeyword = keyword.trim();
      const likeKeyword = `%${originalKeyword}%`;
      const prefixKeyword = `${originalKeyword}%`;
      
      // 生成拼音变体
      const pinyinFull = toPinyin(originalKeyword);
      const pinyinAbbr = toPinyinAbbr(originalKeyword);
      const pinyinLike = `%${pinyinFull}%`;
      const pinyinAbbrLike = `%${pinyinAbbr}%`;
      
      // 错别字修正
      const correctedKeywords = correctTypo(originalKeyword);
      
      // 判断输入类型
      const isNumeric = /^\d+$/.test(originalKeyword);
      const hasChinese = /[\u4e00-\u9fa5]/.test(originalKeyword);
      const isAllLetter = /^[a-zA-Z]+$/.test(originalKeyword);
      
      let results: StockSearchResult[] = [];
      
      if (isNumeric) {
        // 纯数字：股票代码搜索
        results = await this.searchByCode(originalKeyword, prefixKeyword, limit);
      } else if (isAllLetter) {
        // 纯字母：拼音搜索
        results = await this.searchByPinyin(originalKeyword, pinyinLike, pinyinAbbrLike, limit);
      } else if (hasChinese) {
        // 包含中文：多策略搜索
        results = await this.searchByChinese(originalKeyword, likeKeyword, correctedKeywords, limit);
        
        // 如果直接搜索没有结果，尝试拼音搜索
        if (results.length === 0 && pinyinFull) {
          results = await this.searchByPinyin(pinyinFull, pinyinLike, pinyinAbbrLike, limit);
        }
      } else {
        // 混合搜索
        results = await this.searchMixed(originalKeyword, likeKeyword, prefixKeyword, pinyinLike, pinyinAbbrLike, limit);
      }
      
      // 如果还是没有结果，进行模糊匹配
      if (results.length === 0) {
        results = await this.searchFuzzy(originalKeyword, pinyinFull, limit);
      }
      
      return results;
    } catch (error) {
      console.error('DB enhanced search error:', error);
      return [];
    }
  }
  
  /**
   * 股票代码搜索
   */
  private async searchByCode(keyword: string, prefixKeyword: string, limit: number): Promise<StockSearchResult[]> {
    const query = `
      SELECT ts_code, name, industry, market, 
        CASE 
          WHEN symbol = ? THEN 100
          WHEN symbol LIKE ? THEN 80
          WHEN ts_code LIKE ? THEN 60
          ELSE 10
        END as relevance
      FROM stocks
      WHERE list_status = 'L'
        AND (symbol = ? OR symbol LIKE ? OR ts_code LIKE ?)
      ORDER BY relevance DESC, is_hot DESC, search_count DESC
      LIMIT ?
    `;
    const results = await this.db.prepare(query)
      .bind(keyword, prefixKeyword, prefixKeyword, keyword, prefixKeyword, prefixKeyword, limit)
      .all<{ ts_code: string; name: string; industry: string | null; market: string | null }>();
    
    return (results.results || []).map(r => ({
      code: r.ts_code, name: r.name, industry: r.industry, market: r.market, source: 'local' as const
    }));
  }
  
  /**
   * 拼音搜索
   */
  private async searchByPinyin(keyword: string, pinyinLike: string, pinyinAbbrLike: string, limit: number): Promise<StockSearchResult[]> {
    const keywordLower = keyword.toLowerCase();
    const query = `
      SELECT ts_code, name, industry, market,
        CASE 
          WHEN pinyin = ? THEN 100
          WHEN pinyin_abbr = ? THEN 90
          WHEN pinyin LIKE ? THEN 70
          WHEN pinyin_abbr LIKE ? THEN 60
          ELSE 10
        END as relevance
      FROM stocks
      WHERE list_status = 'L'
        AND (pinyin LIKE ? OR pinyin_abbr LIKE ?)
      ORDER BY relevance DESC, is_hot DESC, search_count DESC
      LIMIT ?
    `;
    const results = await this.db.prepare(query)
      .bind(keywordLower, keywordLower, pinyinLike, pinyinAbbrLike, pinyinLike, pinyinAbbrLike, limit)
      .all<{ ts_code: string; name: string; industry: string | null; market: string | null }>();
    
    return (results.results || []).map(r => ({
      code: r.ts_code, name: r.name, industry: r.industry, market: r.market, source: 'local' as const
    }));
  }
  
  /**
   * 中文搜索（支持错别字修正）
   */
  private async searchByChinese(keyword: string, likeKeyword: string, correctedKeywords: string[], limit: number): Promise<StockSearchResult[]> {
    // 构建多关键词的 OR 条件
    const allKeywords = [keyword, ...correctedKeywords.filter(k => k !== keyword)];
    const conditions = allKeywords.map(() => 'name LIKE ?').join(' OR ');
    const industryConditions = allKeywords.map(() => 'industry LIKE ?').join(' OR ');
    
    const query = `
      SELECT ts_code, name, industry, market,
        CASE 
          WHEN name = ? THEN 100
          WHEN name LIKE ? THEN 80
          WHEN industry LIKE ? THEN 40
          ELSE 10
        END as relevance
      FROM stocks
      WHERE list_status = 'L'
        AND ((${conditions}) OR (${industryConditions}))
      ORDER BY relevance DESC, is_hot DESC, search_count DESC
      LIMIT ?
    `;
    
    // 构建参数：先是 CASE 语句的参数，然后是 WHERE 条件的参数
    const params = [
      keyword, likeKeyword, likeKeyword,
      ...allKeywords.map(k => `%${k}%`),  // name LIKE 条件
      ...allKeywords.map(k => `%${k}%`),  // industry LIKE 条件
      limit
    ];
    
    const results = await this.db.prepare(query)
      .bind(...params)
      .all<{ ts_code: string; name: string; industry: string | null; market: string | null }>();
    
    return (results.results || []).map(r => ({
      code: r.ts_code, name: r.name, industry: r.industry, market: r.market, source: 'local' as const
    }));
  }
  
  /**
   * 混合搜索
   */
  private async searchMixed(keyword: string, likeKeyword: string, prefixKeyword: string, pinyinLike: string, pinyinAbbrLike: string, limit: number): Promise<StockSearchResult[]> {
    const query = `
      SELECT ts_code, name, industry, market,
        CASE 
          WHEN name = ? OR symbol = ? THEN 100
          WHEN name LIKE ? OR symbol LIKE ? THEN 80
          WHEN pinyin LIKE ? OR pinyin_abbr LIKE ? THEN 70
          WHEN ts_code LIKE ? THEN 60
          WHEN industry LIKE ? THEN 40
          ELSE 10
        END as relevance
      FROM stocks
      WHERE list_status = 'L'
        AND (name LIKE ? OR symbol LIKE ? OR ts_code LIKE ? OR industry LIKE ? OR pinyin LIKE ? OR pinyin_abbr LIKE ?)
      ORDER BY relevance DESC, is_hot DESC, search_count DESC
      LIMIT ?
    `;
    const results = await this.db.prepare(query)
      .bind(
        keyword, keyword, likeKeyword, prefixKeyword, pinyinLike, pinyinAbbrLike, prefixKeyword, likeKeyword,
        likeKeyword, prefixKeyword, prefixKeyword, likeKeyword, pinyinLike, pinyinAbbrLike,
        limit
      )
      .all<{ ts_code: string; name: string; industry: string | null; market: string | null }>();
    
    return (results.results || []).map(r => ({
      code: r.ts_code, name: r.name, industry: r.industry, market: r.market, source: 'local' as const
    }));
  }
  
  /**
   * 模糊匹配搜索（当精确搜索无结果时使用）
   * 基于相似度算法
   */
  private async searchFuzzy(keyword: string, pinyinKeyword: string, limit: number): Promise<StockSearchResult[]> {
    // 获取所有热门股票进行相似度比对
    const query = `
      SELECT ts_code, name, industry, market, pinyin, pinyin_abbr
      FROM stocks
      WHERE list_status = 'L'
      ORDER BY is_hot DESC, search_count DESC
      LIMIT 500
    `;
    const allStocks = await this.db.prepare(query).all<{
      ts_code: string;
      name: string;
      industry: string | null;
      market: string | null;
      pinyin: string | null;
      pinyin_abbr: string | null;
    }>();
    
    if (!allStocks.results || allStocks.results.length === 0) return [];
    
    // 计算相似度并排序
    const scored = allStocks.results.map(stock => {
      const nameSim = similarity(keyword, stock.name);
      const pinyinSim = pinyinKeyword && stock.pinyin ? similarity(pinyinKeyword, stock.pinyin) : 0;
      const abbrSim = pinyinKeyword && stock.pinyin_abbr ? similarity(pinyinKeyword, stock.pinyin_abbr) : 0;
      
      // 取最高相似度
      const maxSim = Math.max(nameSim, pinyinSim, abbrSim);
      
      return { stock, similarity: maxSim };
    });
    
    // 过滤相似度大于 0.3 的结果，并按相似度排序
    const filtered = scored
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return filtered.map(item => ({
      code: item.stock.ts_code,
      name: item.stock.name,
      industry: item.stock.industry,
      market: item.stock.market,
      source: 'local' as const
    }));
  }

  /**
   * 原始多步骤搜索（仅作为降级方案保留）
   */
  private async searchFromDB(keyword: string, limit: number): Promise<StockSearchResult[]> {
    return this.searchFromDBFast(keyword, limit);
  }

  /**
   * 从 Tushare API 实时搜索
   */
  private async searchFromTushare(keyword: string, limit: number): Promise<StockSearchResult[]> {
    if (!this.tushare) {
      return [];
    }

    try {
      const results = await this.tushare.searchStock(keyword);
      return results.slice(0, limit).map(r => ({
        code: r.ts_code,
        name: r.name,
        industry: r.industry,
        market: null,
        source: 'tushare' as const,
      }));
    } catch (error) {
      console.error('Tushare search error:', error);
      return [];
    }
  }

  /**
   * 合并本地和远程搜索结果，去重
   */
  private mergeResults(
    local: StockSearchResult[],
    remote: StockSearchResult[]
  ): StockSearchResult[] {
    const seen = new Set(local.map(r => r.code));
    const merged = [...local];
    
    for (const r of remote) {
      if (!seen.has(r.code)) {
        seen.add(r.code);
        merged.push(r);
      }
    }
    
    return merged;
  }

  /**
   * 保存新发现的股票到本地数据库
   */
  private async saveNewStocksToDB(stocks: StockSearchResult[]): Promise<void> {
    if (stocks.length === 0) return;

    for (const stock of stocks) {
      if (stock.source !== 'tushare') continue;
      
      try {
        // 检查是否已存在
        const existing = await this.db.prepare(
          'SELECT id FROM stocks WHERE ts_code = ?'
        ).bind(stock.code).first();
        
        if (!existing) {
          // 解析股票代码获取 symbol 和 exchange
          const [symbol, exchange] = stock.code.split('.');
          
          await this.db.prepare(`
            INSERT INTO stocks (ts_code, symbol, name, industry, exchange, list_status)
            VALUES (?, ?, ?, ?, ?, 'L')
          `).bind(stock.code, symbol, stock.name, stock.industry, exchange).run();
          
          console.log(`Saved new stock: ${stock.code} ${stock.name}`);
        }
      } catch (error) {
        // 忽略重复插入错误
        if (!String(error).includes('UNIQUE constraint')) {
          console.error('Save stock error:', error);
        }
      }
    }
  }

  /**
   * 根据代码获取股票详情
   */
  async getStockByCode(tsCode: string): Promise<StockRecord | null> {
    try {
      const result = await this.db.prepare(
        'SELECT * FROM stocks WHERE ts_code = ?'
      ).bind(tsCode).first<StockRecord>();
      
      if (result) {
        // 更新搜索计数
        await this.db.prepare(
          'UPDATE stocks SET search_count = search_count + 1 WHERE ts_code = ?'
        ).bind(tsCode).run();
      }
      
      return result;
    } catch (error) {
      console.error('Get stock error:', error);
      return null;
    }
  }

  /**
   * 获取热门股票
   */
  async getHotStocks(limit: number = 8): Promise<StockSearchResult[]> {
    try {
      const results = await this.db.prepare(`
        SELECT ts_code, name, industry, market
        FROM stocks
        WHERE list_status = 'L' AND is_hot = 1
        ORDER BY search_count DESC
        LIMIT ?
      `).bind(limit).all<{
        ts_code: string;
        name: string;
        industry: string | null;
        market: string | null;
      }>();

      return (results.results || []).map(r => ({
        code: r.ts_code,
        name: r.name,
        industry: r.industry,
        market: r.market,
        source: 'local' as const,
      }));
    } catch (error) {
      console.error('Get hot stocks error:', error);
      // 返回预设热门股票作为降级
      return [
        { code: '600519.SH', name: '贵州茅台', industry: '白酒', market: '主板', source: 'local' },
        { code: '000858.SZ', name: '五粮液', industry: '白酒', market: '主板', source: 'local' },
        { code: '601318.SH', name: '中国平安', industry: '保险', market: '主板', source: 'local' },
        { code: '600036.SH', name: '招商银行', industry: '银行', market: '主板', source: 'local' },
        { code: '000001.SZ', name: '平安银行', industry: '银行', market: '主板', source: 'local' },
        { code: '002594.SZ', name: '比亚迪', industry: '汽车整车', market: '主板', source: 'local' },
        { code: '300750.SZ', name: '宁德时代', industry: '电池', market: '创业板', source: 'local' },
        { code: '603259.SH', name: '药明康德', industry: '医药外包', market: '主板', source: 'local' },
      ];
    }
  }

  /**
   * 批量插入股票数据
   */
  async batchInsertStocks(stocks: Partial<StockRecord>[]): Promise<number> {
    let inserted = 0;
    
    for (const stock of stocks) {
      try {
        await this.db.prepare(`
          INSERT OR IGNORE INTO stocks (ts_code, symbol, name, area, industry, market, exchange, list_date, list_status, is_hot)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          stock.ts_code,
          stock.symbol,
          stock.name,
          stock.area || null,
          stock.industry || null,
          stock.market || null,
          stock.exchange || null,
          stock.list_date || null,
          stock.list_status || 'L',
          stock.is_hot || 0
        ).run();
        inserted++;
      } catch (error) {
        console.error('Insert stock error:', error);
      }
    }
    
    return inserted;
  }

  /**
   * 检查数据库是否已初始化
   */
  async isInitialized(): Promise<boolean> {
    try {
      const result = await this.db.prepare(
        'SELECT COUNT(*) as count FROM stocks'
      ).first<{ count: number }>();
      return (result?.count || 0) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<{ total: number; hot: number }> {
    try {
      const total = await this.db.prepare(
        'SELECT COUNT(*) as count FROM stocks'
      ).first<{ count: number }>();
      
      const hot = await this.db.prepare(
        'SELECT COUNT(*) as count FROM stocks WHERE is_hot = 1'
      ).first<{ count: number }>();
      
      return {
        total: total?.count || 0,
        hot: hot?.count || 0,
      };
    } catch (error) {
      return { total: 0, hot: 0 };
    }
  }
  
  /**
   * 更新股票的拼音字段
   * 用于支持拼音搜索
   */
  async updatePinyinFields(): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;
    
    try {
      // 获取所有没有拼音的股票
      const stocks = await this.db.prepare(
        'SELECT id, name FROM stocks WHERE pinyin IS NULL OR pinyin = ""'
      ).all<{ id: number; name: string }>();
      
      if (!stocks.results || stocks.results.length === 0) {
        console.log('[StockDB] 所有股票拼音已更新');
        return { updated: 0, errors: 0 };
      }
      
      console.log(`[StockDB] 需要更新拼音的股票数量: ${stocks.results.length}`);
      
      // 批量更新（每次 10 条）
      const batchSize = 10;
      for (let i = 0; i < stocks.results.length; i += batchSize) {
        const batch = stocks.results.slice(i, i + batchSize);
        
        // 使用事务批量更新
        const statements = batch.map(stock => {
          const pinyin = toPinyin(stock.name);
          const pinyinAbbr = toPinyinAbbr(stock.name);
          return this.db.prepare(
            'UPDATE stocks SET pinyin = ?, pinyin_abbr = ? WHERE id = ?'
          ).bind(pinyin, pinyinAbbr, stock.id);
        });
        
        try {
          await this.db.batch(statements);
          updated += batch.length;
        } catch (err) {
          console.error(`[StockDB] 批量更新拼音失败:`, err);
          errors += batch.length;
        }
      }
      
      console.log(`[StockDB] 拼音更新完成: 成功 ${updated}, 失败 ${errors}`);
      
      return { updated, errors };
    } catch (error) {
      console.error('[StockDB] 更新拼音字段失败:', error);
      return { updated, errors };
    }
  }

  /**
   * 获取同行业的所有股票
   * @param industry 行业名称
   * @param limit 限制数量
   */
  async getStocksByIndustry(industry: string, limit: number = 50): Promise<StockSearchResult[]> {
    try {
      const results = await this.db.prepare(`
        SELECT ts_code, name, industry, market
        FROM stocks
        WHERE list_status = 'L' AND industry = ?
        ORDER BY is_hot DESC, search_count DESC
        LIMIT ?
      `).bind(industry, limit).all<{
        ts_code: string;
        name: string;
        industry: string | null;
        market: string | null;
      }>();

      return (results.results || []).map(r => ({
        code: r.ts_code,
        name: r.name,
        industry: r.industry,
        market: r.market,
        source: 'local' as const,
      }));
    } catch (error) {
      console.error('Get stocks by industry error:', error);
      return [];
    }
  }

  /**
   * 获取指定股票的同行业对标公司（按市值/热度排序的TOP N）
   * @param tsCode 股票代码
   * @param limit 返回数量（默认5）
   */
  async getIndustryPeers(tsCode: string, limit: number = 5): Promise<{
    targetStock: StockSearchResult | null;
    industry: string | null;
    peers: StockSearchResult[];
  }> {
    try {
      // 1. 获取目标股票信息
      const targetResult = await this.db.prepare(`
        SELECT ts_code, name, industry, market
        FROM stocks
        WHERE ts_code = ?
      `).bind(tsCode).first<{
        ts_code: string;
        name: string;
        industry: string | null;
        market: string | null;
      }>();

      if (!targetResult || !targetResult.industry) {
        return {
          targetStock: targetResult ? {
            code: targetResult.ts_code,
            name: targetResult.name,
            industry: targetResult.industry,
            market: targetResult.market,
            source: 'local' as const,
          } : null,
          industry: targetResult?.industry || null,
          peers: [],
        };
      }

      // 2. 获取同行业其他公司（排除自己，按热度排序）
      const peersResult = await this.db.prepare(`
        SELECT ts_code, name, industry, market
        FROM stocks
        WHERE list_status = 'L' 
          AND industry = ? 
          AND ts_code != ?
        ORDER BY is_hot DESC, search_count DESC
        LIMIT ?
      `).bind(targetResult.industry, tsCode, limit).all<{
        ts_code: string;
        name: string;
        industry: string | null;
        market: string | null;
      }>();

      return {
        targetStock: {
          code: targetResult.ts_code,
          name: targetResult.name,
          industry: targetResult.industry,
          market: targetResult.market,
          source: 'local' as const,
        },
        industry: targetResult.industry,
        peers: (peersResult.results || []).map(r => ({
          code: r.ts_code,
          name: r.name,
          industry: r.industry,
          market: r.market,
          source: 'local' as const,
        })),
      };
    } catch (error) {
      console.error('Get industry peers error:', error);
      return {
        targetStock: null,
        industry: null,
        peers: [],
      };
    }
  }

  /**
   * 获取所有行业列表
   */
  async getAllIndustries(): Promise<{ industry: string; count: number }[]> {
    try {
      const results = await this.db.prepare(`
        SELECT industry, COUNT(*) as count
        FROM stocks
        WHERE list_status = 'L' AND industry IS NOT NULL AND industry != ''
        GROUP BY industry
        ORDER BY count DESC
      `).all<{ industry: string; count: number }>();

      return results.results || [];
    } catch (error) {
      console.error('Get all industries error:', error);
      return [];
    }
  }
}

/**
 * 创建股票数据库服务实例
 */
export function createStockDBService(config: StockDBConfig): StockDBService {
  return new StockDBService(config);
}
