/**
 * 数据同步服务
 * 将Tushare API数据同步到D1数据库，支持Text-to-SQL查询
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createTushareService } from './tushare';

export interface SyncResult {
  success: boolean;
  dataType: string;
  recordsCount: number;
  message: string;
}

// 辅助函数：安全获取值
const safeValue = (obj: any, ...keys: string[]): any => {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return null;
};

export class DataSyncService {
  private db: D1Database;
  private tushare: ReturnType<typeof createTushareService>;
  
  constructor(db: D1Database, tushareToken: string, cache?: KVNamespace) {
    this.db = db;
    this.tushare = createTushareService(tushareToken, cache, true);
  }
  
  /**
   * 同步单只股票的所有财务数据
   */
  async syncStockData(tsCode: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    
    // 1. 同步利润表
    results.push(await this.syncIncomeStatement(tsCode));
    
    // 2. 同步资产负债表
    results.push(await this.syncBalanceSheet(tsCode));
    
    // 3. 同步现金流量表
    results.push(await this.syncCashFlow(tsCode));
    
    // 4. 同步财务指标
    results.push(await this.syncFinaIndicator(tsCode));
    
    // 5. 同步日线行情 (最近30天)
    results.push(await this.syncDailyQuotes(tsCode, 30));
    
    return results;
  }
  
  /**
   * 同步利润表数据
   */
  async syncIncomeStatement(tsCode: string): Promise<SyncResult> {
    try {
      const data = await this.tushare.getIncomeStatement(tsCode);
      
      if (!data || data.length === 0) {
        return { success: false, dataType: 'income', recordsCount: 0, message: '无数据' };
      }
      
      let insertedCount = 0;
      for (const item of data as any[]) {
        try {
          await this.db.prepare(`
            INSERT OR REPLACE INTO income_statements 
            (ts_code, ann_date, end_date, report_type, total_revenue, revenue, 
             total_cogs, operate_cost, sell_exp, admin_exp, fin_exp, rd_exp,
             operate_profit, total_profit, income_tax, n_income, n_income_attr_p,
             basic_eps, diluted_eps, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            tsCode, 
            safeValue(item, 'ann_date'), 
            safeValue(item, 'end_date'), 
            safeValue(item, 'report_type') || '1',
            safeValue(item, 'total_revenue'), 
            safeValue(item, 'revenue'), 
            safeValue(item, 'total_cogs'), 
            safeValue(item, 'operate_cost', 'oper_cost'),
            safeValue(item, 'sell_exp'), 
            safeValue(item, 'admin_exp'), 
            safeValue(item, 'fin_exp'), 
            safeValue(item, 'rd_exp'),
            safeValue(item, 'operate_profit'), 
            safeValue(item, 'total_profit'), 
            safeValue(item, 'income_tax'),
            safeValue(item, 'n_income'), 
            safeValue(item, 'n_income_attr_p'), 
            safeValue(item, 'basic_eps'), 
            safeValue(item, 'diluted_eps')
          ).run();
          insertedCount++;
        } catch (e) {
          console.warn(`[DataSync] Insert income failed for ${item.end_date}:`, e);
        }
      }
      
      await this.logSync(tsCode, 'income', insertedCount, 'success');
      return { success: true, dataType: 'income', recordsCount: insertedCount, message: '同步成功' };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      await this.logSync(tsCode, 'income', 0, 'failed', msg);
      return { success: false, dataType: 'income', recordsCount: 0, message: msg };
    }
  }
  
  /**
   * 同步资产负债表数据
   */
  async syncBalanceSheet(tsCode: string): Promise<SyncResult> {
    try {
      const data = await this.tushare.getBalanceSheet(tsCode);
      
      if (!data || data.length === 0) {
        return { success: false, dataType: 'balance', recordsCount: 0, message: '无数据' };
      }
      
      let insertedCount = 0;
      for (const item of data as any[]) {
        try {
          await this.db.prepare(`
            INSERT OR REPLACE INTO balance_sheets 
            (ts_code, ann_date, end_date, report_type, total_assets, total_cur_assets,
             money_cap, notes_receiv, accounts_receiv, inventories, total_nca,
             fix_assets, intan_assets, goodwill, total_liab, total_cur_liab,
             notes_payable, acct_payable, adv_receipts, total_ncl, lt_borr,
             bond_payable, total_hldr_eqy_exc_min_int, minority_int, 
             total_hldr_eqy_inc_min_int, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            tsCode, 
            safeValue(item, 'ann_date'), 
            safeValue(item, 'end_date'), 
            safeValue(item, 'report_type') || '1',
            safeValue(item, 'total_assets'), 
            safeValue(item, 'total_cur_assets'), 
            safeValue(item, 'money_cap'),
            safeValue(item, 'notes_receiv'), 
            safeValue(item, 'accounts_receiv'), 
            safeValue(item, 'inventories'),
            safeValue(item, 'total_nca'), 
            safeValue(item, 'fix_assets'), 
            safeValue(item, 'intan_assets'), 
            safeValue(item, 'goodwill'),
            safeValue(item, 'total_liab'), 
            safeValue(item, 'total_cur_liab'), 
            safeValue(item, 'notes_payable'),
            safeValue(item, 'acct_payable', 'accounts_pay'), 
            safeValue(item, 'adv_receipts'), 
            safeValue(item, 'total_ncl'), 
            safeValue(item, 'lt_borr'),
            safeValue(item, 'bond_payable'), 
            safeValue(item, 'total_hldr_eqy_exc_min_int'),
            safeValue(item, 'minority_int'), 
            safeValue(item, 'total_hldr_eqy_inc_min_int')
          ).run();
          insertedCount++;
        } catch (e) {
          console.warn(`[DataSync] Insert balance failed for ${item.end_date}:`, e);
        }
      }
      
      await this.logSync(tsCode, 'balance', insertedCount, 'success');
      return { success: true, dataType: 'balance', recordsCount: insertedCount, message: '同步成功' };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      await this.logSync(tsCode, 'balance', 0, 'failed', msg);
      return { success: false, dataType: 'balance', recordsCount: 0, message: msg };
    }
  }
  
  /**
   * 同步现金流量表数据
   */
  async syncCashFlow(tsCode: string): Promise<SyncResult> {
    try {
      const data = await this.tushare.getCashFlow(tsCode);
      
      if (!data || data.length === 0) {
        return { success: false, dataType: 'cashflow', recordsCount: 0, message: '无数据' };
      }
      
      let insertedCount = 0;
      for (const item of data as any[]) {
        try {
          await this.db.prepare(`
            INSERT OR REPLACE INTO cash_flows 
            (ts_code, ann_date, end_date, report_type, n_cashflow_act, c_fr_sale_sg,
             c_paid_goods_s, c_paid_to_for_empl, c_paid_for_taxes, n_cashflow_inv_act,
             c_pay_acq_const_fiolta, c_recp_disp_fiolta, n_cash_flows_fnc_act,
             c_recp_borrow, c_prepay_amt_borr, c_pay_dist_dpcp_int_exp,
             n_incr_cash_cash_equ, free_cashflow, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            tsCode, 
            safeValue(item, 'ann_date'), 
            safeValue(item, 'end_date'), 
            safeValue(item, 'report_type') || '1',
            safeValue(item, 'n_cashflow_act'), 
            safeValue(item, 'c_fr_sale_sg'), 
            safeValue(item, 'c_paid_goods_s'),
            safeValue(item, 'c_paid_to_for_empl'), 
            safeValue(item, 'c_paid_for_taxes'), 
            safeValue(item, 'n_cashflow_inv_act'),
            safeValue(item, 'c_pay_acq_const_fiolta', 'c_pay_acq_const_fiam'), 
            safeValue(item, 'c_recp_disp_fiolta'),
            safeValue(item, 'n_cash_flows_fnc_act'), 
            safeValue(item, 'c_recp_borrow'), 
            safeValue(item, 'c_prepay_amt_borr'),
            safeValue(item, 'c_pay_dist_dpcp_int_exp'), 
            safeValue(item, 'n_incr_cash_cash_equ'), 
            safeValue(item, 'free_cashflow')
          ).run();
          insertedCount++;
        } catch (e) {
          console.warn(`[DataSync] Insert cashflow failed for ${item.end_date}:`, e);
        }
      }
      
      await this.logSync(tsCode, 'cashflow', insertedCount, 'success');
      return { success: true, dataType: 'cashflow', recordsCount: insertedCount, message: '同步成功' };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      await this.logSync(tsCode, 'cashflow', 0, 'failed', msg);
      return { success: false, dataType: 'cashflow', recordsCount: 0, message: msg };
    }
  }
  
  /**
   * 同步财务指标数据
   */
  async syncFinaIndicator(tsCode: string): Promise<SyncResult> {
    try {
      const data = await this.tushare.getFinaIndicator(tsCode);
      
      if (!data || data.length === 0) {
        return { success: false, dataType: 'fina', recordsCount: 0, message: '无数据' };
      }
      
      let insertedCount = 0;
      for (const item of data as any[]) {
        try {
          await this.db.prepare(`
            INSERT OR REPLACE INTO fina_indicators 
            (ts_code, ann_date, end_date, grossprofit_margin, netprofit_margin,
             roe, roe_dt, roa, netprofit_yoy, or_yoy, op_yoy, assets_yoy,
             debt_to_assets, current_ratio, quick_ratio, assets_turn,
             inv_turn, ar_turn, eps, bps, cfps, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            tsCode, 
            safeValue(item, 'ann_date'), 
            safeValue(item, 'end_date'),
            safeValue(item, 'grossprofit_margin'), 
            safeValue(item, 'netprofit_margin'), 
            safeValue(item, 'roe'), 
            safeValue(item, 'roe_dt'),
            safeValue(item, 'roa'), 
            safeValue(item, 'netprofit_yoy'), 
            safeValue(item, 'or_yoy'), 
            safeValue(item, 'op_yoy'), 
            safeValue(item, 'assets_yoy'),
            safeValue(item, 'debt_to_assets'), 
            safeValue(item, 'current_ratio'), 
            safeValue(item, 'quick_ratio'),
            safeValue(item, 'assets_turn'), 
            safeValue(item, 'inv_turn'), 
            safeValue(item, 'ar_turn'),
            safeValue(item, 'eps'), 
            safeValue(item, 'bps'), 
            safeValue(item, 'cfps')
          ).run();
          insertedCount++;
        } catch (e) {
          console.warn(`[DataSync] Insert fina failed for ${item.end_date}:`, e);
        }
      }
      
      await this.logSync(tsCode, 'fina', insertedCount, 'success');
      return { success: true, dataType: 'fina', recordsCount: insertedCount, message: '同步成功' };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      await this.logSync(tsCode, 'fina', 0, 'failed', msg);
      return { success: false, dataType: 'fina', recordsCount: 0, message: msg };
    }
  }
  
  /**
   * 同步日线行情数据
   */
  async syncDailyQuotes(tsCode: string, days: number = 30): Promise<SyncResult> {
    try {
      // 获取日线数据 
      const dailyData = await this.tushare.getDailyData(tsCode);
      // 获取每日指标
      const basicData = await this.tushare.getDailyBasic(tsCode);
      
      if (!dailyData || dailyData.length === 0) {
        return { success: false, dataType: 'daily', recordsCount: 0, message: '无日线数据' };
      }
      
      // 合并数据
      const basicMap = new Map(basicData?.map(b => [b.trade_date, b]) || []);
      
      let insertedCount = 0;
      const recentData = dailyData.slice(0, days);
      
      for (const item of recentData as any[]) {
        const basic = basicMap.get(item.trade_date) as any;
        try {
          await this.db.prepare(`
            INSERT OR REPLACE INTO daily_quotes 
            (ts_code, trade_date, open, high, low, close, pre_close, change, pct_chg,
             vol, amount, turnover_rate, pe, pe_ttm, pb, ps, ps_ttm,
             total_share, float_share, total_mv, circ_mv)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            tsCode, 
            safeValue(item, 'trade_date'), 
            safeValue(item, 'open'), 
            safeValue(item, 'high'), 
            safeValue(item, 'low'), 
            safeValue(item, 'close'),
            safeValue(item, 'pre_close'), 
            safeValue(item, 'change'), 
            safeValue(item, 'pct_chg'), 
            safeValue(item, 'vol'), 
            safeValue(item, 'amount'),
            basic ? safeValue(basic, 'turnover_rate') : null, 
            basic ? safeValue(basic, 'pe') : null, 
            basic ? safeValue(basic, 'pe_ttm') : null, 
            basic ? safeValue(basic, 'pb') : null,
            basic ? safeValue(basic, 'ps') : null, 
            basic ? safeValue(basic, 'ps_ttm') : null, 
            basic ? safeValue(basic, 'total_share') : null, 
            basic ? safeValue(basic, 'float_share') : null,
            basic ? safeValue(basic, 'total_mv') : null, 
            basic ? safeValue(basic, 'circ_mv') : null
          ).run();
          insertedCount++;
        } catch (e) {
          console.warn(`[DataSync] Insert daily failed for ${item.trade_date}:`, e);
        }
      }
      
      await this.logSync(tsCode, 'daily', insertedCount, 'success');
      return { success: true, dataType: 'daily', recordsCount: insertedCount, message: '同步成功' };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      await this.logSync(tsCode, 'daily', 0, 'failed', msg);
      return { success: false, dataType: 'daily', recordsCount: 0, message: msg };
    }
  }
  
  /**
   * 记录同步日志
   */
  private async logSync(
    tsCode: string, 
    dataType: string, 
    recordsCount: number, 
    status: string, 
    errorMessage?: string
  ) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await this.db.prepare(`
        INSERT INTO data_sync_logs (ts_code, data_type, sync_date, records_count, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(tsCode, dataType, today, recordsCount, status, errorMessage || null).run();
    } catch (e) {
      console.warn('[DataSync] Failed to log sync:', e);
    }
  }
  
  /**
   * 获取同步状态
   */
  async getSyncStatus(tsCode: string): Promise<Record<string, { lastSync: string; recordsCount: number }>> {
    const result = await this.db.prepare(`
      SELECT data_type, MAX(sync_date) as last_sync, SUM(records_count) as total_records
      FROM data_sync_logs 
      WHERE ts_code = ? AND status = 'success'
      GROUP BY data_type
    `).bind(tsCode).all();
    
    const status: Record<string, { lastSync: string; recordsCount: number }> = {};
    for (const row of result.results as any[]) {
      status[row.data_type] = {
        lastSync: row.last_sync,
        recordsCount: row.total_records
      };
    }
    return status;
  }
  
  /**
   * 检查是否需要同步
   */
  async needsSync(tsCode: string, dataType: string, maxAgeDays: number = 1): Promise<boolean> {
    const result = await this.db.prepare(`
      SELECT MAX(sync_date) as last_sync
      FROM data_sync_logs 
      WHERE ts_code = ? AND data_type = ? AND status = 'success'
    `).bind(tsCode, dataType).first() as { last_sync: string } | null;
    
    if (!result?.last_sync) return true;
    
    const lastSync = new Date(result.last_sync);
    const now = new Date();
    const diffDays = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24);
    
    return diffDays >= maxAgeDays;
  }
  
  /**
   * 批量同步同行业公司财务数据（用于行业对比）
   * @param stockCodes 需要同步的股票代码列表（通常是同行业TOP5）
   * @returns 同步结果汇总
   */
  async syncIndustryPeersData(stockCodes: string[]): Promise<{
    success: boolean;
    totalStocks: number;
    syncedStocks: number;
    details: Array<{
      code: string;
      results: SyncResult[];
    }>;
  }> {
    console.log(`[DataSync] 开始批量同步 ${stockCodes.length} 家公司财务数据`);
    
    const details: Array<{ code: string; results: SyncResult[] }> = [];
    let syncedCount = 0;
    
    for (const code of stockCodes) {
      try {
        // 检查是否需要同步（1天内已同步则跳过）
        const incomeNeedSync = await this.needsSync(code, 'income', 1);
        const balanceNeedSync = await this.needsSync(code, 'balance', 1);
        const finaNeedSync = await this.needsSync(code, 'fina', 1);
        
        const results: SyncResult[] = [];
        
        // 仅同步需要更新的数据类型
        if (incomeNeedSync) {
          results.push(await this.syncIncomeStatement(code));
        } else {
          results.push({ success: true, dataType: 'income', recordsCount: 0, message: '已是最新' });
        }
        
        if (balanceNeedSync) {
          results.push(await this.syncBalanceSheet(code));
        } else {
          results.push({ success: true, dataType: 'balance', recordsCount: 0, message: '已是最新' });
        }
        
        if (finaNeedSync) {
          results.push(await this.syncFinaIndicator(code));
        } else {
          results.push({ success: true, dataType: 'fina', recordsCount: 0, message: '已是最新' });
        }
        
        details.push({ code, results });
        syncedCount++;
        
        console.log(`[DataSync] 完成 ${code} 同步 (${syncedCount}/${stockCodes.length})`);
        
        // 避免API限流，每个请求间隔500ms
        if (stockCodes.indexOf(code) < stockCodes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`[DataSync] 同步 ${code} 失败:`, error);
        details.push({
          code,
          results: [{
            success: false,
            dataType: 'all',
            recordsCount: 0,
            message: error instanceof Error ? error.message : '未知错误'
          }]
        });
      }
    }
    
    return {
      success: syncedCount === stockCodes.length,
      totalStocks: stockCodes.length,
      syncedStocks: syncedCount,
      details
    };
  }
  
  /**
   * 获取行业对比财务数据（从D1数据库读取）
   * @param stockCodes 股票代码列表
   * @param period 报告期（如 '20231231'），可选，默认获取最新
   */
  async getIndustryComparisonData(stockCodes: string[], period?: string): Promise<{
    income: Record<string, any>;
    balance: Record<string, any>;
    fina: Record<string, any>;
  }> {
    const income: Record<string, any> = {};
    const balance: Record<string, any> = {};
    const fina: Record<string, any> = {};
    
    for (const code of stockCodes) {
      // 获取利润表数据（最新一期或指定期）
      const incomeQuery = period
        ? `SELECT * FROM income_statements WHERE ts_code = ? AND end_date = ? ORDER BY ann_date DESC LIMIT 1`
        : `SELECT * FROM income_statements WHERE ts_code = ? ORDER BY end_date DESC, ann_date DESC LIMIT 1`;
      
      const incomeResult = period
        ? await this.db.prepare(incomeQuery).bind(code, period).first()
        : await this.db.prepare(incomeQuery).bind(code).first();
      
      if (incomeResult) {
        income[code] = incomeResult;
      }
      
      // 获取资产负债表数据
      const balanceQuery = period
        ? `SELECT * FROM balance_sheets WHERE ts_code = ? AND end_date = ? ORDER BY ann_date DESC LIMIT 1`
        : `SELECT * FROM balance_sheets WHERE ts_code = ? ORDER BY end_date DESC, ann_date DESC LIMIT 1`;
      
      const balanceResult = period
        ? await this.db.prepare(balanceQuery).bind(code, period).first()
        : await this.db.prepare(balanceQuery).bind(code).first();
      
      if (balanceResult) {
        balance[code] = balanceResult;
      }
      
      // 获取财务指标数据
      const finaQuery = period
        ? `SELECT * FROM fina_indicators WHERE ts_code = ? AND end_date = ? ORDER BY ann_date DESC LIMIT 1`
        : `SELECT * FROM fina_indicators WHERE ts_code = ? ORDER BY end_date DESC, ann_date DESC LIMIT 1`;
      
      const finaResult = period
        ? await this.db.prepare(finaQuery).bind(code, period).first()
        : await this.db.prepare(finaQuery).bind(code).first();
      
      if (finaResult) {
        fina[code] = finaResult;
      }
    }
    
    return { income, balance, fina };
  }
}

export function createDataSyncService(db: D1Database, tushareToken: string, cache?: KVNamespace) {
  return new DataSyncService(db, tushareToken, cache);
}
