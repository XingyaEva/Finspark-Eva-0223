/**
 * 数据同步API路由
 * 管理Tushare数据到D1数据库的同步
 */
import { Hono } from 'hono';
import { createDataSyncService } from '../services/dataSync';

type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  TUSHARE_TOKEN: string;
};

const dataSync = new Hono<{ Bindings: Bindings }>();

/**
 * 获取股票数据同步状态
 * GET /api/data-sync/status/:tsCode
 */
dataSync.get('/status/:tsCode', async (c) => {
  const { env } = c;
  const tsCode = c.req.param('tsCode');
  
  try {
    const syncService = createDataSyncService(env.DB, env.TUSHARE_TOKEN, env.CACHE);
    const status = await syncService.getSyncStatus(tsCode);
    
    // 获取各表的记录数
    const [incomeCount, balanceCount, cashflowCount, finaCount, dailyCount] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as cnt FROM income_statements WHERE ts_code = ?').bind(tsCode).first(),
      env.DB.prepare('SELECT COUNT(*) as cnt FROM balance_sheets WHERE ts_code = ?').bind(tsCode).first(),
      env.DB.prepare('SELECT COUNT(*) as cnt FROM cash_flows WHERE ts_code = ?').bind(tsCode).first(),
      env.DB.prepare('SELECT COUNT(*) as cnt FROM fina_indicators WHERE ts_code = ?').bind(tsCode).first(),
      env.DB.prepare('SELECT COUNT(*) as cnt FROM daily_quotes WHERE ts_code = ?').bind(tsCode).first(),
    ]);
    
    return c.json({
      success: true,
      tsCode,
      syncStatus: status,
      dataCount: {
        income_statements: (incomeCount as any)?.cnt || 0,
        balance_sheets: (balanceCount as any)?.cnt || 0,
        cash_flows: (cashflowCount as any)?.cnt || 0,
        fina_indicators: (finaCount as any)?.cnt || 0,
        daily_quotes: (dailyCount as any)?.cnt || 0,
      }
    });
  } catch (error) {
    console.error('[DataSync] Status check failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取同步状态失败' 
    }, 500);
  }
});

/**
 * 同步单只股票的所有财务数据
 * POST /api/data-sync/stock/:tsCode
 */
dataSync.post('/stock/:tsCode', async (c) => {
  const { env } = c;
  const tsCode = c.req.param('tsCode');
  
  try {
    const syncService = createDataSyncService(env.DB, env.TUSHARE_TOKEN, env.CACHE);
    const results = await syncService.syncStockData(tsCode);
    
    const summary = {
      totalTypes: results.length,
      successCount: results.filter(r => r.success).length,
      totalRecords: results.reduce((sum, r) => sum + r.recordsCount, 0),
      details: results
    };
    
    return c.json({
      success: true,
      tsCode,
      message: `同步完成: ${summary.successCount}/${summary.totalTypes} 类型成功`,
      ...summary
    });
  } catch (error) {
    console.error('[DataSync] Sync failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '数据同步失败' 
    }, 500);
  }
});

/**
 * 批量同步多只股票 (热门/关注股票)
 * POST /api/data-sync/batch
 * Body: { stockCodes: string[] } 或 { type: 'hot' | 'recent' }
 */
dataSync.post('/batch', async (c) => {
  const { env } = c;
  const body = await c.req.json<{ stockCodes?: string[]; type?: 'hot' | 'recent' }>();
  
  try {
    let stockCodes: string[] = [];
    
    if (body.stockCodes && body.stockCodes.length > 0) {
      stockCodes = body.stockCodes.slice(0, 10); // 限制最多10只
    } else if (body.type === 'hot') {
      // 获取热门股票
      const hotStocks = await env.DB.prepare(`
        SELECT ts_code FROM stocks WHERE is_hot = 1 ORDER BY search_count DESC LIMIT 10
      `).all();
      stockCodes = (hotStocks.results as any[]).map(r => r.ts_code);
    } else if (body.type === 'recent') {
      // 获取最近搜索的股票
      const recentStocks = await env.DB.prepare(`
        SELECT ts_code FROM stocks ORDER BY search_count DESC LIMIT 10
      `).all();
      stockCodes = (recentStocks.results as any[]).map(r => r.ts_code);
    }
    
    if (stockCodes.length === 0) {
      return c.json({ success: false, error: '没有找到需要同步的股票' }, 400);
    }
    
    const syncService = createDataSyncService(env.DB, env.TUSHARE_TOKEN, env.CACHE);
    const allResults: Record<string, any> = {};
    
    for (const tsCode of stockCodes) {
      const results = await syncService.syncStockData(tsCode);
      allResults[tsCode] = {
        successCount: results.filter(r => r.success).length,
        totalRecords: results.reduce((sum, r) => sum + r.recordsCount, 0),
        details: results
      };
    }
    
    return c.json({
      success: true,
      message: `批量同步完成: ${stockCodes.length} 只股票`,
      stockCount: stockCodes.length,
      results: allResults
    });
  } catch (error) {
    console.error('[DataSync] Batch sync failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '批量同步失败' 
    }, 500);
  }
});

/**
 * 查询已同步的财务数据
 * GET /api/data-sync/query/:tsCode/:dataType
 * dataType: income | balance | cashflow | fina | daily
 */
dataSync.get('/query/:tsCode/:dataType', async (c) => {
  const { env } = c;
  const tsCode = c.req.param('tsCode');
  const dataType = c.req.param('dataType');
  const limit = parseInt(c.req.query('limit') || '20');
  
  const tableMap: Record<string, string> = {
    'income': 'income_statements',
    'balance': 'balance_sheets',
    'cashflow': 'cash_flows',
    'fina': 'fina_indicators',
    'daily': 'daily_quotes'
  };
  
  const table = tableMap[dataType];
  if (!table) {
    return c.json({ success: false, error: '无效的数据类型' }, 400);
  }
  
  try {
    const dateField = dataType === 'daily' ? 'trade_date' : 'end_date';
    const result = await env.DB.prepare(`
      SELECT * FROM ${table} WHERE ts_code = ? ORDER BY ${dateField} DESC LIMIT ?
    `).bind(tsCode, limit).all();
    
    return c.json({
      success: true,
      tsCode,
      dataType,
      count: result.results.length,
      data: result.results
    });
  } catch (error) {
    console.error('[DataSync] Query failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '查询失败' 
    }, 500);
  }
});

/**
 * 获取同步日志
 * GET /api/data-sync/logs/:tsCode?
 */
dataSync.get('/logs/:tsCode?', async (c) => {
  const { env } = c;
  const tsCode = c.req.param('tsCode');
  const limit = parseInt(c.req.query('limit') || '50');
  
  try {
    let query = 'SELECT * FROM data_sync_logs';
    const bindings: any[] = [];
    
    if (tsCode) {
      query += ' WHERE ts_code = ?';
      bindings.push(tsCode);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    bindings.push(limit);
    
    const result = await env.DB.prepare(query).bind(...bindings).all();
    
    return c.json({
      success: true,
      count: result.results.length,
      logs: result.results
    });
  } catch (error) {
    console.error('[DataSync] Get logs failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取日志失败' 
    }, 500);
  }
});

/**
 * 数据库统计信息
 * GET /api/data-sync/stats
 */
dataSync.get('/stats', async (c) => {
  const { env } = c;
  
  try {
    const [stocks, income, balance, cashflow, fina, daily, syncLogs] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as cnt FROM stocks').first(),
      env.DB.prepare('SELECT COUNT(*) as cnt, COUNT(DISTINCT ts_code) as stocks FROM income_statements').first(),
      env.DB.prepare('SELECT COUNT(*) as cnt, COUNT(DISTINCT ts_code) as stocks FROM balance_sheets').first(),
      env.DB.prepare('SELECT COUNT(*) as cnt, COUNT(DISTINCT ts_code) as stocks FROM cash_flows').first(),
      env.DB.prepare('SELECT COUNT(*) as cnt, COUNT(DISTINCT ts_code) as stocks FROM fina_indicators').first(),
      env.DB.prepare('SELECT COUNT(*) as cnt, COUNT(DISTINCT ts_code) as stocks FROM daily_quotes').first(),
      env.DB.prepare('SELECT COUNT(*) as cnt FROM data_sync_logs WHERE status = "success"').first(),
    ]);
    
    return c.json({
      success: true,
      stats: {
        stocks: { total: (stocks as any)?.cnt || 0 },
        income_statements: { records: (income as any)?.cnt || 0, stocks: (income as any)?.stocks || 0 },
        balance_sheets: { records: (balance as any)?.cnt || 0, stocks: (balance as any)?.stocks || 0 },
        cash_flows: { records: (cashflow as any)?.cnt || 0, stocks: (cashflow as any)?.stocks || 0 },
        fina_indicators: { records: (fina as any)?.cnt || 0, stocks: (fina as any)?.stocks || 0 },
        daily_quotes: { records: (daily as any)?.cnt || 0, stocks: (daily as any)?.stocks || 0 },
        sync_logs: { successful: (syncLogs as any)?.cnt || 0 }
      }
    });
  } catch (error) {
    console.error('[DataSync] Get stats failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取统计失败' 
    }, 500);
  }
});

export default dataSync;
