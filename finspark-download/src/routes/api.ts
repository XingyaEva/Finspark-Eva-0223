// API路由定义
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createVectorEngineService } from '../services/vectorengine';
import { createTushareService } from '../services/tushare';
import { createAkshareHKService } from '../services/akshareHK';
import { createStockDataService } from '../services/stockDataService';
import { createStockDBService } from '../services/stockdb';
import { createReportsService } from '../services/reports';
import { createComicService } from '../services/comic';
import { createDataSyncService } from '../services/dataSync';
import { createAgentPresetsService } from '../services/agentPresets';
import { createOrchestrator } from '../agents/orchestrator';
import { AGENT_PROMPTS, COMIC_PROMPTS } from '../agents/prompts';
import { optionalAuthMiddleware, optionalAuth, requireFeature } from '../middleware/auth';
import { generateTabInsights, getCachedInsights, cacheInsights, getInsightCacheTTL } from '../services/stockInsightAgent';
import { isHKStock } from '../utils/stockCode';
import { validateReportCompleteness, getValidationLogMessage } from '../utils/reportValidation';
import { createLangfuseFromEnv, createAnalysisTrace, flushLangfuse } from '../services/langfuse';
import type { Bindings, StartAnalysisRequest, AnalysisProgress, AnalysisReport, AgentType, ModelPreference, AgentPromptConfig } from '../types';

const api = new Hono<{ Bindings: Bindings }>();

// 启用CORS
api.use('/*', cors());

// ============ 健康检查 ============
api.get('/health', async (c) => {
  // 检查数据库状态
  let dbStatus = 'unknown';
  let stockCount = 0;
  
  try {
    if (c.env.DB) {
      const stockDB = createStockDBService({ db: c.env.DB });
      const stats = await stockDB.getStats();
      stockCount = stats.total;
      dbStatus = stats.total > 0 ? 'ready' : 'empty';
    } else {
      dbStatus = 'not_configured';
    }
  } catch (error) {
    dbStatus = 'error';
  }

  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
    stockCount,
  });
});

// ============ 数据库初始化状态 ============
api.get('/db/status', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ 
        success: false, 
        error: 'D1 数据库未配置',
        hint: '请在 wrangler.jsonc 中配置 d1_databases 绑定'
      }, 503);
    }

    const stockDB = createStockDBService({ db: c.env.DB });
    const stats = await stockDB.getStats();
    const isReady = stats.total > 0;

    return c.json({
      success: true,
      initialized: isReady,
      stats,
      message: isReady ? '数据库已就绪' : '数据库为空，需要初始化'
    });
  } catch (error) {
    console.error('DB status error:', error);
    return c.json({ success: false, error: '检查数据库状态失败' }, 500);
  }
});

// ============ 更新拼音字段（用于搜索增强）============
api.post('/db/update-pinyin', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ success: false, error: 'D1 数据库未配置' }, 503);
    }

    const stockDB = createStockDBService({ db: c.env.DB });
    const result = await stockDB.updatePinyinFields();
    
    return c.json({
      success: true,
      message: '拼音字段更新完成',
      ...result
    });
  } catch (error) {
    console.error('Update pinyin error:', error);
    return c.json({ success: false, error: '更新拼音字段失败' }, 500);
  }
});

// ============ 股票搜索接口 ============
api.get('/stock/search', async (c) => {
  const keyword = c.req.query('q')?.trim();
  
  if (!keyword || keyword.length < 1) {
    return c.json({ success: false, error: '请输入搜索关键词', results: [] }, 400);
  }

  try {
    // 创建 Tushare 服务（用于降级）
    const tushare = c.env.TUSHARE_TOKEN ? createTushareService({
      token: c.env.TUSHARE_TOKEN,
      cache: c.env.CACHE,
    }) : undefined;

    // 检查是否有 D1 数据库
    if (c.env.DB) {
      // 使用 D1 + Tushare 降级策略
      const stockDB = createStockDBService({
        db: c.env.DB,
        tushare,
        cache: c.env.CACHE,
      });

      const results = await stockDB.searchStocks(keyword, 20);
      
      return c.json({
        success: true,
        results: results.map(stock => ({
          code: stock.code,
          name: stock.name,
          industry: stock.industry,
          source: stock.source,
        })),
        source: 'hybrid',
      });
    } else {
      // 无 D1，直接使用 Tushare（降级模式）
      if (!tushare) {
        return c.json({ 
          success: false, 
          error: '数据服务未配置',
          results: []
        }, 503);
      }

      const results = await tushare.searchStock(keyword);
      
      return c.json({
        success: true,
        results: results.slice(0, 20).map(stock => ({
          code: stock.ts_code,
          name: stock.name,
          industry: stock.industry,
          source: 'tushare',
        })),
        source: 'tushare',
      });
    }
  } catch (error) {
    console.error('Stock search error:', error);
    return c.json({ success: false, error: '搜索失败，请稍后重试', results: [] }, 500);
  }
});

// ============ 股票基本信息 ============
api.get('/stock/basic/:code', async (c) => {
  const code = c.req.param('code');

  try {
    const tushare = createTushareService({
      token: c.env.TUSHARE_TOKEN,
      cache: c.env.CACHE,
    });

    // 如果有 D1，先从本地获取
    let localStock = null;
    if (c.env.DB) {
      const stockDB = createStockDBService({ db: c.env.DB });
      localStock = await stockDB.getStockByCode(code);
    }

    // 从 Tushare 获取详细信息（容错：API 不可用时降级到本地数据）
    let basic = null, company = null, dailyBasic: any[] = [];
    try {
      [basic, company, dailyBasic] = await Promise.all([
        tushare.getStockBasic(code),
        tushare.getCompanyInfo(code),
        tushare.getDailyBasic(code),
      ]);
    } catch (tushareError) {
      console.warn(`[Stock Basic] Tushare API unavailable for ${code}, falling back to local data:`, tushareError instanceof Error ? tushareError.message : tushareError);
    }

    if (!basic && !localStock) {
      return c.json({ success: false, error: '股票不存在' }, 404);
    }

    const latestDaily = dailyBasic?.[0];

    return c.json({
      success: true,
      data: {
        code: basic?.ts_code || localStock?.ts_code,
        name: basic?.name || localStock?.name,
        industry: basic?.industry || localStock?.industry,
        market: basic?.market || localStock?.market,
        listDate: basic?.list_date || localStock?.list_date,
        company: company ? {
          chairman: company.chairman,
          employees: company.employees,
          mainBusiness: company.main_business,
          website: company.website,
        } : null,
        valuation: latestDaily ? {
          pe: latestDaily.pe_ttm,
          pb: latestDaily.pb,
          marketCap: latestDaily.total_mv,
          close: latestDaily.close,
        } : null,
        source: basic ? 'tushare' : 'local',
      },
    });
  } catch (error) {
    console.error('Stock basic error:', error);
    return c.json({ success: false, error: '获取股票信息失败' }, 500);
  }
});

// ============ 日线数据 ============
api.get('/stock/daily/:code', async (c) => {
  const code = c.req.param('code');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');

  try {
    const tushare = createTushareService({
      token: c.env.TUSHARE_TOKEN,
      cache: c.env.CACHE,
    });

    const data = await tushare.getDailyData(code, startDate, endDate);

    return c.json({
      success: true,
      data: data.map(d => ({
        date: d.trade_date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.vol,
        change: d.change,
        changePercent: d.pct_chg,
      })),
    });
  } catch (error) {
    console.error('Daily data error:', error);
    return c.json({ success: false, error: '获取日线数据失败' }, 500);
  }
});

// ============ 股票走势面板 - 完整市场数据包 ============
// 用于前端股票走势面板一次性加载所有需要的数据
// 支持参数:
// - days: K线天数，默认180天（6个月）
// - withInsight: 是否包含解读数据，默认true
api.get('/stock/:code/market-data', async (c) => {
  const code = c.req.param('code');
  const daysParam = c.req.query('days');
  const withInsightParam = c.req.query('withInsight');
  const days = daysParam ? parseInt(daysParam) : 180; // 默认6个月
  const withInsight = withInsightParam !== 'false'; // 默认包含解读

  if (!code) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }

  try {
    // 判断是否为港股，使用不同的数据服务
    const isHK = isHKStock(code);
    
    let marketData;
    
    if (isHK) {
      // 港股使用 AKShare HK 服务
      const akshareHK = createAkshareHKService({
        cache: c.env.CACHE,
        pythonProxyUrl: c.env.AKSHARE_PROXY_URL || 'http://localhost:8000',
      });
      marketData = await akshareHK.getMarketDataPackage(code, days);
      console.log(`[Market Data] 港股数据: ${code}, K线数量: ${marketData.kline?.length || 0}`);
    } else {
      // A股使用 Tushare 服务
      const tushare = createTushareService({
        token: c.env.TUSHARE_TOKEN,
        cache: c.env.CACHE,
      });
      marketData = await tushare.getMarketDataPackage(code, days);
    }

    // 如果没有基本信息，说明股票不存在
    if (!marketData.basic) {
      return c.json({ success: false, error: '股票不存在或数据获取失败' }, 404);
    }

    // 如果需要解读数据
    if (withInsight) {
      try {
        const { generateMarketInsightPackage } = await import('../services/insightGenerator');
        const insightPackage = generateMarketInsightPackage(
          marketData,
          code,
          marketData.basic.name
        );
        
        return c.json({
          success: true,
          data: marketData,
          insight: insightPackage,
        });
      } catch (insightError) {
        console.warn('Generate insight error:', insightError);
        // 解读生成失败不影响主数据返回
        return c.json({
          success: true,
          data: marketData,
          insight: null,
          insightError: '解读数据生成失败',
        });
      }
    }

    return c.json({
      success: true,
      data: marketData,
    });
  } catch (error) {
    console.error('Market data error:', error);
    return c.json({ 
      success: false, 
      error: '获取市场数据失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// ============ 股票Tab智能解读（专业版+白话版）============
api.get('/stock/:code/tab-insights', async (c) => {
  const code = c.req.param('code');
  const forceRefresh = c.req.query('refresh') === 'true';

  if (!code) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }

  try {
    // 1. 检查缓存（非强制刷新时）
    if (!forceRefresh && c.env.CACHE) {
      const cached = await getCachedInsights(code, c.env.CACHE);
      if (cached) {
        console.log(`[StockInsightAgent] Cache hit for ${code}`);
        return c.json({
          success: true,
          data: cached,
          cached: true,
        });
      }
    }

    // 2. 判断是否为港股，获取行情数据
    const isHK = isHKStock(code);
    let marketData;
    
    if (isHK) {
      // 港股使用 AKShare HK 服务
      const akshareHK = createAkshareHKService({
        cache: c.env.CACHE,
        pythonProxyUrl: c.env.AKSHARE_PROXY_URL || 'http://localhost:8000',
      });
      marketData = await akshareHK.getMarketDataPackage(code, 30);
      console.log(`[StockInsightAgent] 港股数据: ${code}, K线数量: ${marketData.kline?.length || 0}`);
    } else {
      // A股使用 Tushare 服务
      const tushare = createTushareService({
        token: c.env.TUSHARE_TOKEN,
        cache: c.env.CACHE,
      });
      marketData = await tushare.getMarketDataPackage(code, 30);
    }
    
    if (!marketData.basic) {
      return c.json({ success: false, error: '股票不存在或数据获取失败' }, 404);
    }

    // 3. 生成基础解读数据
    const { generateMarketInsightPackage } = await import('../services/insightGenerator');
    const insightPackage = generateMarketInsightPackage(
      marketData,
      code,
      marketData.basic.name
    );

    // 4. 调用 StockInsightAgent 生成深度解读
    const vectorEngine = createVectorEngineService(c.env.VECTORENGINE_API_KEY);
    const tabInsights = await generateTabInsights(insightPackage, vectorEngine);

    // 5. 保存到缓存
    if (c.env.CACHE) {
      const ttl = getInsightCacheTTL();
      await cacheInsights(tabInsights, c.env.CACHE, ttl);
      console.log(`[StockInsightAgent] Cached insights for ${code}, TTL: ${ttl}s`);
    }

    return c.json({
      success: true,
      data: tabInsights,
      cached: false,
    });

  } catch (error) {
    console.error('[StockInsightAgent] Error:', error);
    return c.json({ 
      success: false, 
      error: '生成解读失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// ============ 财务数据 ============
api.get('/stock/financial/:code/:type', async (c) => {
  const code = c.req.param('code');
  const type = c.req.param('type');
  const period = c.req.query('period');

  try {
    const tushare = createTushareService({
      token: c.env.TUSHARE_TOKEN,
      cache: c.env.CACHE,
    });

    let data;
    switch (type) {
      case 'income':
        data = await tushare.getIncomeStatement(code, period);
        break;
      case 'balance':
        data = await tushare.getBalanceSheet(code, period);
        break;
      case 'cashflow':
        data = await tushare.getCashFlow(code, period);
        break;
      default:
        return c.json({ success: false, error: '无效的报表类型' }, 400);
    }

    return c.json({ success: true, data });
  } catch (error) {
    console.error('Financial data error:', error);
    return c.json({ success: false, error: '获取财务数据失败' }, 500);
  }
});

// ============ 开始财报分析 ============
api.post('/analyze/start', optionalAuthMiddleware(), async (c) => {
  try {
    const body = await c.req.json<StartAnalysisRequest>();
    
    if (!body.companyCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }

    // 获取可选的用户ID（从 optionalAuth 中间件设置的 user 对象中读取）
    const currentUser = c.get('user');
    const userId = currentUser?.id || null;
    const reportType = body.reportType || 'annual';
    
    // ============ 共享缓存检查 ============
    // 检查是否有最近24小时内该股票的分析结果（可直接复用）
    if (c.env.DB && c.env.CACHE) {
      const cacheKey = `shared:analysis:${body.companyCode}:${reportType}`;
      const cachedReportId = await c.env.CACHE.get(cacheKey);
      
      if (cachedReportId) {
        // 检查缓存的报告是否仍然有效
        const reportsService = createReportsService(c.env.DB, c.env.CACHE);
        const cachedReport = await reportsService.getReport(parseInt(cachedReportId));
        
        if (cachedReport && cachedReport.status === 'completed') {
          // 【重要】完整性校验 - 确保缓存报告包含所有必需字段
          const analysisResult = await reportsService.getReportResult(parseInt(cachedReportId));
          const validation = validateReportCompleteness(analysisResult as Partial<AnalysisReport>);
          
          console.log(getValidationLogMessage(cachedReportId, validation));
          
          if (validation.severity === 'critical') {
            // 严重不完整 - 必须重新分析，删除无效缓存
            console.log(`[Cache Invalid] Report ${cachedReportId} is critically incomplete, triggering re-analysis`);
            await c.env.CACHE.delete(cacheKey);
            // 继续执行新分析流程（不返回，跳出缓存检查）
          } else {
            // 完整或可接受 - 返回缓存报告
            console.log(`[Cache Hit] Reusing complete analysis ${cachedReportId} for ${body.companyCode}`);
            
            // 【关键】如果用户已登录，为其克隆一份报告记录，确保出现在"我的报告"中
            let userReportId = parseInt(cachedReportId);
            if (userId) {
              try {
                const clonedId = await reportsService.cloneForUser(parseInt(cachedReportId), userId);
                if (clonedId) {
                  userReportId = clonedId;
                  console.log(`[Cache Hit] Cloned report ${cachedReportId} -> ${clonedId} for user ${userId}`);
                }
              } catch (cloneErr) {
                console.error('[Cache Hit] Clone for user failed:', cloneErr);
              }
            }
            
            return c.json({
              success: true,
              reportId: userReportId,
              estimatedTime: 0, // 即时可用
              message: '使用已有分析结果（24小时内）',
              cached: true,
              complete: validation.isComplete,
              completenessPercent: validation.completenessPercent,
              useD1: true,
            });
          }
        }
      }
      
      // 检查是否有正在进行中的分析（避免重复分析）
      const pendingKey = `pending:analysis:${body.companyCode}:${reportType}`;
      const pendingReportId = await c.env.CACHE.get(pendingKey);
      
      if (pendingReportId) {
        const reportsService = createReportsService(c.env.DB, c.env.CACHE);
        const pendingReport = await reportsService.getReport(parseInt(pendingReportId));
        
        if (pendingReport && (pendingReport.status === 'pending' || pendingReport.status === 'processing')) {
          console.log(`[Pending Hit] Waiting for analysis ${pendingReportId} for ${body.companyCode}`);
          
          // 返回正在进行的分析ID，让前端轮询等待
          return c.json({
            success: true,
            reportId: parseInt(pendingReportId),
            estimatedTime: 45, // 预计剩余时间
            message: '其他用户正在分析此股票，请稍候...',
            pending: true,
            useD1: true,
          });
        }
      }
      
      // ============ 数据库回退检查 ============
      // 如果 KV 缓存中没有找到，直接从数据库查找最近的已完成报告
      const reportsService = createReportsService(c.env.DB, c.env.CACHE);
      const recentReport = await c.env.DB.prepare(
        `SELECT id, status, result_json FROM analysis_reports 
         WHERE company_code = ? AND report_type = ? AND status = 'completed' 
         ORDER BY id DESC LIMIT 1`
      ).bind(body.companyCode, reportType).first<{id: number, status: string, result_json: string}>();
      
      if (recentReport && recentReport.status === 'completed') {
        // 【重要】数据库回退也需要完整性校验
        let analysisResult: Partial<AnalysisReport> | null = null;
        try {
          analysisResult = recentReport.result_json ? JSON.parse(recentReport.result_json) : null;
        } catch (e) {
          console.warn(`[DB Fallback] Failed to parse result_json for report ${recentReport.id}`);
        }
        
        const validation = validateReportCompleteness(analysisResult);
        console.log(getValidationLogMessage(recentReport.id, validation));
        
        if (validation.severity === 'critical') {
          // 数据库中的报告也不完整，需要重新分析
          console.log(`[DB Fallback Invalid] Report ${recentReport.id} is incomplete, triggering re-analysis`);
          // 继续执行新分析流程
        } else {
          console.log(`[DB Fallback] Found complete report ${recentReport.id} for ${body.companyCode}`);
          
          // 重新设置 KV 缓存，以便下次快速命中
          const cacheKey = `shared:analysis:${body.companyCode}:${reportType}`;
          await c.env.CACHE.put(cacheKey, String(recentReport.id), { expirationTtl: 86400 }); // 24小时
          
          // 【关键】如果用户已登录，为其克隆一份报告记录
          let userReportId = recentReport.id;
          if (userId) {
            try {
              const clonedId = await reportsService.cloneForUser(recentReport.id, userId);
              if (clonedId) {
                userReportId = clonedId;
                console.log(`[DB Fallback] Cloned report ${recentReport.id} -> ${clonedId} for user ${userId}`);
              }
            } catch (cloneErr) {
              console.error('[DB Fallback] Clone for user failed:', cloneErr);
            }
          }
          
          return c.json({
            success: true,
            reportId: userReportId,
            estimatedTime: 0,
            message: '使用已有分析结果',
            cached: true,
            complete: validation.isComplete,
            completenessPercent: validation.completenessPercent,
            useD1: true,
          });
        }
      }
      // ============ 数据库回退检查结束 ============
    }
    // ============ 共享缓存检查结束 ============

    // 创建服务实例
    const vectorEngine = createVectorEngineService(c.env.VECTORENGINE_API_KEY);
    const tushare = createTushareService({
      token: c.env.TUSHARE_TOKEN,
      cache: c.env.CACHE,
    });

    // 获取公司名称 (支持 A股/港股)
    let companyName = body.companyName;
    const isHK = isHKStock(body.companyCode);
    
    if (!companyName) {
      // 优先从本地数据库获取 (仅 A股)
      if (c.env.DB && !isHK) {
        const stockDB = createStockDBService({ db: c.env.DB });
        const localStock = await stockDB.getStockByCode(body.companyCode);
        companyName = localStock?.name;
      }
      
      // 本地没有则从数据源获取 (A股用 Tushare，港股用 AKShare)
      if (!companyName) {
        const stockInfo = await tushare.getStockBasic(body.companyCode);
        companyName = stockInfo?.name || body.companyCode;
      }
    }
    
    // 记录市场类型
    console.log(`[API] 分析请求: ${body.companyCode} (${isHK ? '港股' : 'A股'}), 公司名称: ${companyName}`);

    // 创建分析记录 - 支持 D1 持久化和 KV 临时存储
    let reportId: number;
    let reportsService: ReturnType<typeof createReportsService> | null = null;
    
    if (c.env.DB && c.env.CACHE) {
      // 使用 D1 数据库持久化
      reportsService = createReportsService(c.env.DB, c.env.CACHE);
      reportId = await reportsService.createReport(
        body.companyCode,
        companyName,
        reportType,
        userId ?? undefined,
        body.reportPeriod
      );
      
      // 标记此股票正在分析中（10分钟过期）
      const pendingKey = `pending:analysis:${body.companyCode}:${reportType}`;
      await c.env.CACHE.put(pendingKey, String(reportId), { expirationTtl: 600 });
    } else {
      // 降级：仅使用 KV 临时存储
      reportId = Date.now();
    }

    // 保存缓存和服务引用供 waitUntil 使用
    const cache = c.env.CACHE;
    const db = c.env.DB;
    const vectorEngineApiKey = c.env.VECTORENGINE_API_KEY;
    const currentReportsService = reportsService;

    // ============ Phase 1: 加载用户 Preset 配置（模型偏好 + 自定义 Prompt）============
    let effectiveModelConfig = body.agentModelConfig || {};
    let effectivePromptConfig: AgentPromptConfig = {};
    
    // 如果有数据库和用户登录，加载用户的 Preset/Settings 配置
    if (db && userId) {
      try {
        const presetsService = createAgentPresetsService(db);
        const analysisConfigs = await presetsService.getAllAnalysisConfigs(
          userId,
          body.presetOverrides as Record<AgentType, { presetId?: number; modelPreference?: ModelPreference }>
        );
        
        // 将 Preset 配置转换为 AgentModelConfig 和 AgentPromptConfig
        for (const [agentType, config] of Object.entries(analysisConfigs)) {
          // 提取模型偏好
          if (config.modelPreference && !effectiveModelConfig[agentType as keyof typeof effectiveModelConfig]) {
            (effectiveModelConfig as any)[agentType] = config.modelPreference;
          }
          
          // 【新增】提取用户自定义 Prompt
          if (config.promptText && config.promptText.trim() !== '') {
            (effectivePromptConfig as any)[agentType] = config.promptText;
          }
        }
        
        // 统计加载情况
        const loadedModels = Object.keys(effectiveModelConfig).length;
        const loadedPrompts = Object.keys(effectivePromptConfig).length;
        console.log(`[Preset] Loaded user presets: ${loadedModels} model configs, ${loadedPrompts} custom prompts`);
        
        if (loadedPrompts > 0) {
          console.log(`[Preset] Agents with custom prompts: ${Object.keys(effectivePromptConfig).join(', ')}`);
        }
      } catch (presetError) {
        console.error('[Preset] Failed to load user presets:', presetError);
        // 继续使用默认配置
      }
    }

    // 创建统一数据服务 (支持 A股 + 港股自动路由)
    const dataService = createStockDataService({
      tushare: {
        token: c.env.TUSHARE_TOKEN,
        cache: c.env.CACHE,
      },
      akshareHK: {
        cache: c.env.CACHE,
        pythonProxyUrl: c.env.AKSHARE_PROXY_URL || 'http://localhost:8000',
      }
    });

    // ============ Langfuse 可观测性追踪 ============
    const langfuseClient = createLangfuseFromEnv(c.env);
    const langfuseTrace = createAnalysisTrace(langfuseClient, {
      reportId,
      companyCode: body.companyCode,
      companyName: companyName || body.companyCode,
      reportType,
      userId: userId ? String(userId) : undefined,
      reportPeriod: body.reportPeriod,
    });

    // 创建编排器并开始分析 - 带进度回调
    // Phase 0/1: 支持 Agent 独立模型配置 + Preset 系统
    // Phase 2: 支持用户自定义 Prompt 注入
    // Phase 3: 支持港股数据自动路由
    // Phase 4: 支持用户分析偏好（深度、风格）
    // Phase 5: 支持 Langfuse 全链路追踪
    const orchestrator = createOrchestrator({
      vectorEngine,
      dataService,  // 使用统一数据服务 (替代 tushare)
      cache,  // 用于趋势解读缓存
      agentModelConfig: effectiveModelConfig,  // 合并后的 Agent 模型配置
      agentPromptConfig: effectivePromptConfig,  // 【新增】用户自定义 Prompt 配置
      userPreferences: body.userPreferences,  // 【新增】用户分析偏好（深度、风格、模块开关）
      langfuseTrace,  // 【新增】Langfuse 全链路追踪
      // 【新增】OpenEvals 评估配置 (Langfuse + OpenEvals 联合测试)
      evalConfig: langfuseTrace ? {
        enabled: true,
        mode: 'sampling' as const,    // 抽样评估
        samplingRate: 0.3,            // 30% 抽样率 (P2 稳定化: 从 1.0 降至 0.3)
        judgeModel: 'gpt-4.1',        // 主 Judge 模型
        fallbackJudgeModel: 'gpt-4.1-mini',  // P2.3: 降级模型
        maxConcurrency: 2,            // P2.1: 最大并发 2，防止 CPU 超时
        judgeTimeoutMs: 15000,        // P2.1: 单次 Judge 超时 15s
        enableCrossConsistency: false, // P2.1: 默认关闭 Layer3 节省 CPU
        db: db || undefined,          // P2.4: D1 持久化
        reportId,                     // P2.4: 关联报告 ID
        kvCache: cache || undefined,  // P3.4: 动态采样率
      } : undefined,
      onProgress: async (progress) => {
        // 实时更新进度到 KV/D1
        if (currentReportsService) {
          await currentReportsService.updateProgress(reportId, progress);
          // 更新数据库状态为 processing
          if (progress.percentage > 0 && progress.percentage < 100) {
            await currentReportsService.updateStatus(reportId, 'processing');
          }
        } else {
          await cache.put(
            `analysis:${reportId}`,
            JSON.stringify({
              companyCode: body.companyCode,
              companyName,
              status: 'processing',
              progress,
            }),
            { expirationTtl: 3600 }
          );
        }
      },
    });

    // 使用 waitUntil 确保异步分析任务在响应返回后继续执行
    // 这是 Cloudflare Workers 中处理后台任务的正确方式
    const analysisTask = (async () => {
      try {
        // 更新状态为处理中
        if (currentReportsService) {
          await currentReportsService.updateStatus(reportId, 'processing');
        }

        // 执行分析
        // 注意：includeBusinessModel 和 includeForecast 已改为必选，不再从请求参数读取
        const result = await orchestrator.analyze({
          companyCode: body.companyCode,
          companyName: companyName!,
          reportType: body.reportType || 'annual',
          reportPeriod: body.reportPeriod,
          // 商业模式和业绩预测已改为必选，以下参数仅为向后兼容保留
          // includeBusinessModel: true,  // 已废弃，始终执行
          // includeForecast: true,       // 已废弃，始终执行
        });

        // 保存结果
        if (currentReportsService) {
          await currentReportsService.saveResult(reportId, result);
          
          // ============ 更新共享缓存 ============
          // 将此分析结果标记为共享可用（24小时有效）
          const cacheKey = `shared:analysis:${body.companyCode}:${body.reportType || 'annual'}`;
          await cache.put(cacheKey, String(reportId), { expirationTtl: 86400 });
          
          // 清除正在进行的标记
          const pendingKey = `pending:analysis:${body.companyCode}:${body.reportType || 'annual'}`;
          await cache.delete(pendingKey);
          
          console.log(`[Cache Update] Analysis ${reportId} for ${body.companyCode} cached for 24h`);
          
          // ============ 方案B: 漫画预生成 ============
          // 分析完成后自动在后台生成漫画，让后续用户可以立即查看
          try {
            console.log(`[Comic Pre-gen] Starting comic pre-generation for report ${reportId}`);
            
            const comicService = createComicService(vectorEngineApiKey);
            const reportData = { 
              ...result, 
              companyName: companyName,
              companyCode: body.companyCode,
            } as Partial<AnalysisReport>;
            
            const comicResult = await comicService.generateComic(reportData);
            
            if (comicResult.success && comicResult.comic) {
              // 处理面板数据：将Base64图片存储到KV
              const processedPanels = await Promise.all(
                comicResult.comic.panels.map(async (panel, index) => {
                  const imageUrl = panel.imageUrl;
                  
                  if (imageUrl && imageUrl.startsWith('data:image/')) {
                    const imageKey = `comic:${reportId}:panel:${index}`;
                    try {
                      await cache.put(imageKey, imageUrl, { expirationTtl: 604800 }); // 7天过期
                      return { ...panel, imageUrl: `kv:${imageKey}`, imageBase64Stored: true };
                    } catch (kvError) {
                      console.error(`[Comic Pre-gen] Failed to store panel ${index} to KV:`, kvError);
                      return { ...panel, imageUrl: `https://via.placeholder.com/512x512/1a1a2e/d4af37?text=Panel+${index + 1}` };
                    }
                  }
                  return panel;
                })
              );
              
              // 保存漫画到数据库
              if (db) {
                await db.prepare(`
                  INSERT INTO comic_reports (report_id, user_id, company_code, company_name, style, summary, panels_json, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
                `).bind(
                  reportId,
                  null, // userId
                  body.companyCode,
                  companyName,
                  comicResult.comic.style || 'business',
                  comicResult.comic.summary || '',
                  JSON.stringify({ ...processedPanels.map((p, i) => ({ ...p, order: i + 1 })) })
                ).run();
                
                // 更新报告的漫画状态
                await currentReportsService.updateComicStatus(reportId, 'completed');
                
                console.log(`[Comic Pre-gen] Comic pre-generated successfully for report ${reportId}, ${processedPanels.length} panels`);
              }
            } else {
              console.log(`[Comic Pre-gen] Comic generation failed for report ${reportId}: ${comicResult.error}`);
            }
          } catch (comicError) {
            // 漫画预生成失败不影响主流程
            console.error(`[Comic Pre-gen] Error pre-generating comic for report ${reportId}:`, comicError);
          }
        } else {
          await cache.put(
            `analysis:${reportId}`,
            JSON.stringify({ ...result, status: 'completed' }),
            { expirationTtl: 3600 }
          );
        }
        
        console.log(`Analysis completed for report ${reportId}`);

        // Langfuse: 刷新缓冲区确保所有事件发送
        await flushLangfuse(langfuseClient);
      } catch (error) {
        console.error(`Analysis failed for report ${reportId}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : '分析过程出错';
        
        if (currentReportsService) {
          await currentReportsService.markFailed(reportId, errorMessage);
          
          // 清除正在进行的标记
          const pendingKey = `pending:analysis:${body.companyCode}:${body.reportType || 'annual'}`;
          await cache.delete(pendingKey);
        } else {
          await cache.put(
            `analysis:${reportId}`,
            JSON.stringify({ status: 'failed', error: errorMessage }),
            { expirationTtl: 3600 }
          );
        }

        // Langfuse: 即使失败也要刷新缓冲区
        await flushLangfuse(langfuseClient);
      }
    })();

    // 使用 executionCtx.waitUntil 保持分析任务运行
    // 即使 HTTP 响应已返回，任务也会继续执行
    c.executionCtx.waitUntil(analysisTask);

    // 初始化状态（仅 KV 模式需要）
    if (!reportsService) {
      await c.env.CACHE.put(
        `analysis:${reportId}`,
        JSON.stringify({
          companyCode: body.companyCode,
          companyName,
          status: 'processing',
          progress: { currentPhase: '初始化', completedAgents: [], totalAgents: 10, percentage: 0 },
        }),
        { expirationTtl: 3600 }
      );
    }

    return c.json({
      success: true,
      reportId,
      estimatedTime: 60,
      message: '分析已开始',
      useD1: !!reportsService,
    });
  } catch (error) {
    console.error('Start analysis error:', error);
    return c.json({ success: false, error: '启动分析失败' }, 500);
  }
});

// ============ 查询分析状态 ============
api.get('/analyze/status/:id', async (c) => {
  const reportIdStr = c.req.param('id');
  const reportId = parseInt(reportIdStr);

  try {
    // 优先从 D1 查询（新的持久化报告）
    if (c.env.DB && c.env.CACHE && !isNaN(reportId)) {
      const reportsService = createReportsService(c.env.DB, c.env.CACHE);
      const report = await reportsService.getReport(reportId);
      
      if (report) {
        const progress = await reportsService.getProgress(reportId);
        return c.json({
          success: true,
          status: report.status,
          progress: progress || { currentPhase: report.status, completedAgents: [], totalAgents: 10, percentage: report.status === 'completed' ? 100 : 0 },
          source: 'd1',
        });
      }
    }
    
    // 降级：从 KV 查询（旧的临时报告）
    const cached = await c.env.CACHE.get(`analysis:${reportIdStr}`, 'json');
    
    if (!cached) {
      return c.json({ success: false, error: '分析报告不存在' }, 404);
    }

    const report = cached as { status: string; progress?: AnalysisProgress };

    return c.json({
      success: true,
      status: report.status,
      progress: report.progress,
      source: 'kv',
    });
  } catch (error) {
    console.error('Status check error:', error);
    return c.json({ success: false, error: '查询状态失败' }, 500);
  }
});

// ============ 获取分析结果 ============
api.get('/analyze/result/:id', async (c) => {
  const reportIdStr = c.req.param('id');
  const reportId = parseInt(reportIdStr);

  try {
    // 优先从 D1 查询（新的持久化报告）
    if (c.env.DB && c.env.CACHE && !isNaN(reportId)) {
      const reportsService = createReportsService(c.env.DB, c.env.CACHE);
      const report = await reportsService.getReport(reportId);
      
      if (report) {
        const result = await reportsService.getReportResult(reportId);
        const progress = await reportsService.getProgress(reportId);
        
        return c.json({
          success: true,
          report: {
            id: report.id,
            companyCode: report.company_code,
            companyName: report.company_name,
            status: report.status,
            comicStatus: report.comic_status || null,  // 添加漫画状态
            comicId: report.comic_id || null,          // 添加漫画ID
            progress: progress || { currentPhase: report.status, completedAgents: [], totalAgents: 10, percentage: report.status === 'completed' ? 100 : 0 },
            ...result,
          },
          source: 'd1',
        });
      }
    }
    
    // 降级：从 KV 查询（旧的临时报告）
    const cached = await c.env.CACHE.get(`analysis:${reportIdStr}`, 'json');
    
    if (!cached) {
      return c.json({ success: false, error: '分析报告不存在' }, 404);
    }

    return c.json({
      success: true,
      report: cached,
      source: 'kv',
    });
  } catch (error) {
    console.error('Get result error:', error);
    return c.json({ success: false, error: '获取结果失败' }, 500);
  }
});

// ============ 流式获取分析进度 (SSE) ============
api.get('/analyze/stream/:id', async (c) => {
  const reportId = c.req.param('id');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastStatus = '';

      const checkStatus = async () => {
        try {
          const cached = await c.env.CACHE.get(`analysis:${reportId}`, 'json');
          
          if (!cached) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: '报告不存在' })}\n\n`));
            controller.close();
            return;
          }

          const report = cached as { status: string; progress?: AnalysisProgress };
          const currentStatus = JSON.stringify(report);

          if (currentStatus !== lastStatus) {
            lastStatus = currentStatus;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...report })}\n\n`));
          }

          if (report.status === 'completed' || report.status === 'failed') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', ...report })}\n\n`));
            controller.close();
          } else {
            setTimeout(checkStatus, 2000);
          }
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: '状态检查失败' })}\n\n`));
          controller.close();
        }
      };

      checkStatus();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// ============ 检查分析缓存状态 ============
// 用于前端在用户搜索时预先显示缓存状态
api.get('/analyze/cache-status/:code', async (c) => {
  const companyCode = c.req.param('code');
  const reportType = c.req.query('type') || 'annual';
  
  if (!c.env.CACHE || !c.env.DB) {
    return c.json({ success: true, cached: false, pending: false });
  }
  
  try {
    // 检查是否有已完成的缓存
    const cacheKey = `shared:analysis:${companyCode}:${reportType}`;
    const cachedReportId = await c.env.CACHE.get(cacheKey);
    
    if (cachedReportId) {
      const reportsService = createReportsService(c.env.DB, c.env.CACHE);
      const cachedReport = await reportsService.getReport(parseInt(cachedReportId));
      
      if (cachedReport && cachedReport.status === 'completed') {
        return c.json({
          success: true,
          cached: true,
          pending: false,
          reportId: parseInt(cachedReportId),
          companyName: cachedReport.company_name,
          updatedAt: cachedReport.updated_at,
          message: '已有24小时内的分析结果，点击即可秒级查看',
        });
      }
    }
    
    // 检查是否有正在进行的分析
    const pendingKey = `pending:analysis:${companyCode}:${reportType}`;
    const pendingReportId = await c.env.CACHE.get(pendingKey);
    
    if (pendingReportId) {
      const reportsService = createReportsService(c.env.DB, c.env.CACHE);
      const pendingReport = await reportsService.getReport(parseInt(pendingReportId));
      
      if (pendingReport && (pendingReport.status === 'pending' || pendingReport.status === 'processing')) {
        const progress = await reportsService.getProgress(parseInt(pendingReportId));
        
        return c.json({
          success: true,
          cached: false,
          pending: true,
          reportId: parseInt(pendingReportId),
          companyName: pendingReport.company_name,
          progress: progress?.percentage || 0,
          message: '其他用户正在分析，可共享结果',
        });
      }
    }
    
    return c.json({ success: true, cached: false, pending: false });
  } catch (error) {
    console.error('Cache status check error:', error);
    return c.json({ success: true, cached: false, pending: false });
  }
});

// ============ 强制重新分析 ============
// 跳过缓存，强制执行新的分析
api.post('/analyze/force-reanalyze', optionalAuthMiddleware(), async (c) => {
  try {
    const body = await c.req.json<StartAnalysisRequest>();
    
    if (!body.companyCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }

    // 获取可选的用户ID（从 optionalAuth 中间件设置的 user 对象中读取）
    const currentUser = c.get('user');
    const userId = currentUser?.id || null;
    const reportType = body.reportType || 'annual';
    
    // 清除该股票的缓存标记（如果存在）
    if (c.env.CACHE) {
      const cacheKey = `shared:analysis:${body.companyCode}:${reportType}`;
      const pendingKey = `pending:analysis:${body.companyCode}:${reportType}`;
      await c.env.CACHE.delete(cacheKey);
      await c.env.CACHE.delete(pendingKey);
      console.log(`[Force Reanalyze] Cleared cache for ${body.companyCode}`);
    }

    // 创建服务实例
    const vectorEngine = createVectorEngineService(c.env.VECTORENGINE_API_KEY);
    const tushare = createTushareService({
      token: c.env.TUSHARE_TOKEN,
      cache: c.env.CACHE,
    });

    // 获取公司名称
    let companyName = body.companyName;
    if (!companyName) {
      if (c.env.DB) {
        const stockDB = createStockDBService({ db: c.env.DB });
        const localStock = await stockDB.getStockByCode(body.companyCode);
        companyName = localStock?.name;
      }
      if (!companyName) {
        const stockInfo = await tushare.getStockBasic(body.companyCode);
        companyName = stockInfo?.name || body.companyCode;
      }
    }

    // 创建新的分析记录
    let reportId: number;
    let reportsService: ReturnType<typeof createReportsService> | null = null;
    
    if (c.env.DB && c.env.CACHE) {
      reportsService = createReportsService(c.env.DB, c.env.CACHE);
      reportId = await reportsService.createReport(
        body.companyCode,
        companyName,
        reportType,
        userId ?? undefined,
        body.reportPeriod
      );
      
      // 标记正在分析
      const pendingKey = `pending:analysis:${body.companyCode}:${reportType}`;
      await c.env.CACHE.put(pendingKey, String(reportId), { expirationTtl: 600 });
    } else {
      reportId = Date.now();
    }

    const cache = c.env.CACHE;
    const db = c.env.DB;
    const vectorEngineApiKey = c.env.VECTORENGINE_API_KEY;
    const currentReportsService = reportsService;

    // ============ Phase 1: 加载用户 Preset 配置 ============
    let effectiveModelConfig = body.agentModelConfig || {};
    
    if (db && userId) {
      try {
        const presetsService = createAgentPresetsService(db);
        const analysisConfigs = await presetsService.getAllAnalysisConfigs(
          userId,
          body.presetOverrides as Record<AgentType, { presetId?: number; modelPreference?: ModelPreference }>
        );
        
        for (const [agentType, config] of Object.entries(analysisConfigs)) {
          if (config.modelPreference && !effectiveModelConfig[agentType as keyof typeof effectiveModelConfig]) {
            (effectiveModelConfig as any)[agentType] = config.modelPreference;
          }
        }
        
        console.log(`[Preset] Loaded user presets for force-reanalyze`);
      } catch (presetError) {
        console.error('[Preset] Failed to load user presets:', presetError);
      }
    }

    // 创建统一数据服务 (支持 A股 + 港股自动路由)
    const dataService = createStockDataService({
      tushare: {
        token: c.env.TUSHARE_TOKEN,
        cache: c.env.CACHE,
      },
      akshareHK: {
        cache: c.env.CACHE,
        pythonProxyUrl: c.env.AKSHARE_PROXY_URL || 'http://localhost:8000',
      }
    });

    // ============ Langfuse 可观测性追踪 (force-reanalyze) ============
    const langfuseClient2 = createLangfuseFromEnv(c.env);
    const langfuseTrace2 = createAnalysisTrace(langfuseClient2, {
      reportId,
      companyCode: body.companyCode,
      companyName: companyName || body.companyCode,
      reportType: body.reportType || 'annual',
      userId: userId ? String(userId) : undefined,
      reportPeriod: body.reportPeriod,
    });

    // 创建编排器
    // Phase 0/1: 支持 Agent 独立模型配置 + Preset 系统
    // Phase 3: 支持港股数据自动路由
    // Phase 4: 支持用户分析偏好
    // Phase 5: 支持 Langfuse 全链路追踪
    const orchestrator = createOrchestrator({
      vectorEngine,
      dataService,  // 使用统一数据服务 (替代 tushare)
      cache,  // 用于趋势解读缓存
      agentModelConfig: effectiveModelConfig,  // 合并后的 Agent 模型配置
      userPreferences: body.userPreferences,  // 用户分析偏好
      langfuseTrace: langfuseTrace2,  // 【新增】Langfuse 全链路追踪
      // 【新增】OpenEvals 评估配置 (force-reanalyze 启用全量评估)
      evalConfig: langfuseTrace2 ? {
        enabled: true,
        mode: 'full' as const,         // 全量评估 (force-reanalyze 用于深度质检)
        judgeModel: 'gpt-4.1',
        fallbackJudgeModel: 'gpt-4.1-mini',  // P2.3: 降级模型
        maxConcurrency: 2,            // P2.1: 最大并发 2
        judgeTimeoutMs: 15000,        // P2.1: 单次 Judge 超时 15s
        enableCrossConsistency: true,  // force-reanalyze 保留 Layer3
        db: db || undefined,          // P2.4: D1 持久化
        reportId,                     // P2.4: 关联报告 ID
        kvCache: cache || undefined,  // P3.4: 动态采样率
      } : undefined,
      onProgress: async (progress) => {
        if (currentReportsService) {
          await currentReportsService.updateProgress(reportId, progress);
          if (progress.percentage > 0 && progress.percentage < 100) {
            await currentReportsService.updateStatus(reportId, 'processing');
          }
        } else {
          await cache.put(
            `analysis:${reportId}`,
            JSON.stringify({
              companyCode: body.companyCode,
              companyName,
              status: 'processing',
              progress,
            }),
            { expirationTtl: 3600 }
          );
        }
      },
    });

    // 执行分析任务
    const analysisTask = (async () => {
      try {
        if (currentReportsService) {
          await currentReportsService.updateStatus(reportId, 'processing');
        }

        console.log(`[Force Reanalyze] Starting analysis for ${body.companyCode} (all agents mandatory)`);
        
        // 注意：商业模式和业绩预测已改为必选，不再需要显式指定
        const result = await orchestrator.analyze({
          companyCode: body.companyCode,
          companyName: companyName!,
          reportType: body.reportType || 'annual',
          reportPeriod: body.reportPeriod,
        });

        console.log(`[Force Reanalyze] Analysis completed, businessModelResult: ${result.businessModelResult ? 'present' : 'missing'}, forecastResult: ${result.forecastResult ? 'present' : 'missing'}`);

        if (currentReportsService) {
          await currentReportsService.saveResult(reportId, result);
          
          // 更新缓存
          const cacheKey = `shared:analysis:${body.companyCode}:${body.reportType || 'annual'}`;
          await cache.put(cacheKey, String(reportId), { expirationTtl: 86400 });
          
          const pendingKey = `pending:analysis:${body.companyCode}:${body.reportType || 'annual'}`;
          await cache.delete(pendingKey);
          
          console.log(`[Force Reanalyze] Analysis ${reportId} saved and cached`);
          
          // 预生成漫画
          try {
            const comicService = createComicService(vectorEngineApiKey);
            const reportData = { 
              ...result, 
              companyName: companyName,
              companyCode: body.companyCode,
            } as Partial<AnalysisReport>;
            
            const comicResult = await comicService.generateComic(reportData);
            
            if (comicResult.success && comicResult.comic && db) {
              const processedPanels = await Promise.all(
                comicResult.comic.panels.map(async (panel, index) => {
                  const imageUrl = panel.imageUrl;
                  if (imageUrl && imageUrl.startsWith('data:image/')) {
                    const imageKey = `comic:${reportId}:panel:${index}`;
                    try {
                      await cache.put(imageKey, imageUrl, { expirationTtl: 604800 });
                      return { ...panel, imageUrl: `kv:${imageKey}`, imageBase64Stored: true };
                    } catch (kvError) {
                      return { ...panel, imageUrl: `https://via.placeholder.com/512x512/1a1a2e/d4af37?text=Panel+${index + 1}` };
                    }
                  }
                  return panel;
                })
              );
              
              await db.prepare(`
                INSERT INTO comic_reports (report_id, user_id, company_code, company_name, style, summary, panels_json, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
              `).bind(
                reportId,
                null,
                body.companyCode,
                companyName,
                comicResult.comic.style || 'business',
                comicResult.comic.summary || '',
                JSON.stringify({ ...processedPanels.map((p, i) => ({ ...p, order: i + 1 })) })
              ).run();
              
              await currentReportsService.updateComicStatus(reportId, 'completed');
            }
          } catch (comicError) {
            console.error(`[Force Reanalyze] Comic generation error:`, comicError);
          }
        } else {
          await cache.put(
            `analysis:${reportId}`,
            JSON.stringify({ ...result, status: 'completed' }),
            { expirationTtl: 3600 }
          );
        }
        
        console.log(`[Force Reanalyze] Completed for report ${reportId}`);
        await flushLangfuse(langfuseClient2);
      } catch (error) {
        console.error(`[Force Reanalyze] Failed for report ${reportId}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : '分析过程出错';
        
        if (currentReportsService) {
          await currentReportsService.markFailed(reportId, errorMessage);
          const pendingKey = `pending:analysis:${body.companyCode}:${body.reportType || 'annual'}`;
          await cache.delete(pendingKey);
        } else {
          await cache.put(
            `analysis:${reportId}`,
            JSON.stringify({ status: 'failed', error: errorMessage }),
            { expirationTtl: 3600 }
          );
        }
        await flushLangfuse(langfuseClient2);
      }
    })();

    c.executionCtx.waitUntil(analysisTask);

    if (!reportsService) {
      await c.env.CACHE.put(
        `analysis:${reportId}`,
        JSON.stringify({
          companyCode: body.companyCode,
          companyName,
          status: 'processing',
          progress: { currentPhase: '初始化', completedAgents: [], totalAgents: 11, percentage: 0 },
        }),
        { expirationTtl: 3600 }
      );
    }

    return c.json({
      success: true,
      reportId,
      estimatedTime: 60,
      message: '强制重新分析已开始',
      forceReanalyze: true,
    });
  } catch (error) {
    console.error('Force reanalyze error:', error);
    return c.json({ success: false, error: '启动重新分析失败' }, 500);
  }
});

// ============ 热门股票推荐 ============
api.get('/stock/hot', async (c) => {
  // 优先从 D1 数据库获取
  if (c.env.DB) {
    try {
      const stockDB = createStockDBService({ db: c.env.DB });
      const hotStocks = await stockDB.getHotStocks(8);
      
      return c.json({
        success: true,
        data: hotStocks.map(stock => ({
          code: stock.code,
          name: stock.name,
          industry: stock.industry,
        })),
        source: 'database',
      });
    } catch (error) {
      console.error('Get hot stocks from DB error:', error);
    }
  }

  // 降级：返回预设的热门股票列表
  const defaultHotStocks = [
    { code: '600519.SH', name: '贵州茅台', industry: '白酒' },
    { code: '000858.SZ', name: '五粮液', industry: '白酒' },
    { code: '601318.SH', name: '中国平安', industry: '保险' },
    { code: '600036.SH', name: '招商银行', industry: '银行' },
    { code: '000001.SZ', name: '平安银行', industry: '银行' },
    { code: '002594.SZ', name: '比亚迪', industry: '汽车' },
    { code: '300750.SZ', name: '宁德时代', industry: '电池' },
    { code: '603259.SH', name: '药明康德', industry: '医药' },
  ];

  return c.json({ success: true, data: defaultHotStocks, source: 'fallback' });
});

// ============ 热门股票详情（含实时行情）============
api.get('/stock/hot-detail', async (c) => {
  const CACHE_KEY = 'hot-stock-detail-v2';
  const CACHE_TTL = 600; // 10分钟缓存

  // 尝试从KV缓存读取
  if (c.env.CACHE) {
    try {
      const cached = await c.env.CACHE.get(CACHE_KEY, 'json');
      if (cached) {
        return c.json({ success: true, data: cached, source: 'cache' });
      }
    } catch (e) { /* ignore */ }
  }

  // 热门股票列表
  const hotList = [
    { code: '600000.SH', name: '浦发银行', industry: '银行' },
    { code: '600519.SH', name: '贵州茅台', industry: '白酒' },
    { code: '300750.SZ', name: '宁德时代', industry: '电池制造' },
    { code: '601318.SH', name: '中国平安', industry: '保险' },
    { code: '002594.SZ', name: '比亚迪', industry: '新能源汽车' },
    { code: '600036.SH', name: '招商银行', industry: '银行' },
  ];

  // 尝试从DB获取更多热门股票
  if (c.env.DB) {
    try {
      const stockDB = createStockDBService({ db: c.env.DB });
      const dbHot = await stockDB.getHotStocks(6);
      if (dbHot && dbHot.length >= 6) {
        hotList.length = 0;
        dbHot.forEach(s => hotList.push({ code: s.code, name: s.name, industry: s.industry || '' }));
      }
    } catch (e) { /* use default list */ }
  }

  // 尝试通过 Tushare 获取实时行情（先试中转站，失败再试官方API）
  if (c.env.TUSHARE_TOKEN) {
    // 依次尝试: 中转站(默认) -> 官方API
    let tushare: ReturnType<typeof createTushareService> | null = null;
    for (const useProxy of [true, false]) {
      try {
        const testService = createTushareService({
          token: c.env.TUSHARE_TOKEN,
          cache: c.env.CACHE,
          useProxy,
        });
        // 快速测试一下是否可用
        const testData = await testService.getDailyData('600519.SH', undefined, undefined);
        if (testData && testData.length > 0) {
          tushare = testService;
          console.log(`[hot-detail] Tushare ${useProxy ? '中转站' : '官方'} API 连通`);
          break;
        }
      } catch (e) {
        console.warn(`[hot-detail] Tushare ${useProxy ? '中转站' : '官方'} API 失败:`, e);
      }
    }

    if (tushare) try {

      // 获取最近交易日
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

      // 并行获取所有股票的日线和指标数据
      const results = await Promise.all(
        hotList.map(async (stock) => {
          try {
            // 获取近10天K线（用于sparkline）
            const endDate = dateStr;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 20);
            const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '');

            const [dailyData, basicData] = await Promise.all([
              tushare.getDailyData(stock.code, startStr, endDate),
              tushare.getDailyBasic(stock.code, undefined).catch(() => []),
            ]);

            // 取最新一天数据
            const latest = dailyData && dailyData.length > 0 ? dailyData[0] : null;
            const latestBasic = basicData && basicData.length > 0 ? basicData[0] : null;

            // 生成sparkline（最近5-8天收盘价）
            const sparkline = dailyData
              ? dailyData.slice(0, 8).reverse().map((d: any) => d.close)
              : null;

            return {
              code: stock.code,
              name: stock.name,
              industry: stock.industry,
              close: latest?.close ?? null,
              pct_chg: latest?.pct_chg ?? null,
              total_mv: latestBasic?.total_mv ?? null,
              pe: latestBasic?.pe_ttm ?? latestBasic?.pe ?? null,
              sparkline,
            };
          } catch (e) {
            console.warn(`[hot-detail] Failed for ${stock.code}:`, e);
            return {
              code: stock.code,
              name: stock.name,
              industry: stock.industry,
              close: null, pct_chg: null, total_mv: null, pe: null, sparkline: null,
            };
          }
        })
      );

      // 写入缓存
      if (c.env.CACHE) {
        try {
          await c.env.CACHE.put(CACHE_KEY, JSON.stringify(results), { expirationTtl: CACHE_TTL });
        } catch (e) { /* ignore */ }
      }

      return c.json({ success: true, data: results, source: 'tushare' });
    } catch (error) {
      console.error('[hot-detail] Tushare batch error:', error);
    }
  }

  // 降级：返回无行情数据的列表
  const fallback = hotList.map(s => ({
    ...s,
    close: null, pct_chg: null, total_mv: null, pe: null, sparkline: null,
  }));
  return c.json({ success: true, data: fallback, source: 'fallback' });
});

// ============ 行业相关 API ============

// 获取所有行业列表
api.get('/stock/industries', async (c) => {
  if (!c.env.DB) {
    return c.json({ success: false, error: '数据库未配置' }, 503);
  }

  try {
    const stockDB = createStockDBService({ db: c.env.DB });
    const industries = await stockDB.getAllIndustries();
    
    return c.json({
      success: true,
      data: industries,
      total: industries.length,
    });
  } catch (error) {
    console.error('Get industries error:', error);
    return c.json({ success: false, error: '获取行业列表失败' }, 500);
  }
});

// 获取同行业所有股票
api.get('/stock/by-industry/:industry', async (c) => {
  const industry = decodeURIComponent(c.req.param('industry'));
  const limit = parseInt(c.req.query('limit') || '50');

  if (!industry) {
    return c.json({ success: false, error: '请提供行业名称' }, 400);
  }

  if (!c.env.DB) {
    return c.json({ success: false, error: '数据库未配置' }, 503);
  }

  try {
    const stockDB = createStockDBService({ db: c.env.DB });
    const stocks = await stockDB.getStocksByIndustry(industry, limit);
    
    return c.json({
      success: true,
      industry,
      data: stocks,
      total: stocks.length,
    });
  } catch (error) {
    console.error('Get stocks by industry error:', error);
    return c.json({ success: false, error: '获取行业股票失败' }, 500);
  }
});

// 获取同行业对标公司（TOP5）
api.get('/stock/industry-peers/:code', async (c) => {
  const code = c.req.param('code');
  const limit = parseInt(c.req.query('limit') || '5');

  if (!code) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }

  if (!c.env.DB) {
    return c.json({ success: false, error: '数据库未配置' }, 503);
  }

  try {
    const stockDB = createStockDBService({ db: c.env.DB });
    const result = await stockDB.getIndustryPeers(code, limit);
    
    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Get industry peers error:', error);
    return c.json({ success: false, error: '获取同行业公司失败' }, 500);
  }
});

// 同步同行业公司财务数据（用于行业对比）
api.post('/stock/sync-industry-peers/:code', async (c) => {
  const code = c.req.param('code');
  
  if (!code) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }

  if (!c.env.DB || !c.env.TUSHARE_TOKEN) {
    return c.json({ success: false, error: '数据服务未配置' }, 503);
  }

  try {
    const stockDB = createStockDBService({ db: c.env.DB });
    
    // 获取同行业对标公司
    const peersResult = await stockDB.getIndustryPeers(code, 5);
    
    if (!peersResult.targetStock || peersResult.peers.length === 0) {
      return c.json({ success: false, error: '未找到同行业公司' }, 404);
    }
    
    // 准备需要同步的股票代码列表（目标公司 + 对标公司）
    const codesToSync = [
      peersResult.targetStock.code,
      ...peersResult.peers.map(p => p.code)
    ];
    
    // 创建数据同步服务
    const dataSync = createDataSyncService(c.env.DB, c.env.TUSHARE_TOKEN, c.env.CACHE);
    
    // 批量同步财务数据
    const syncResult = await dataSync.syncIndustryPeersData(codesToSync);
    
    return c.json({
      success: syncResult.success,
      targetStock: peersResult.targetStock,
      industry: peersResult.industry,
      peersCount: peersResult.peers.length,
      syncResult: {
        totalStocks: syncResult.totalStocks,
        syncedStocks: syncResult.syncedStocks,
        details: syncResult.details
      }
    });
  } catch (error) {
    console.error('Sync industry peers data error:', error);
    return c.json({ success: false, error: '同步行业数据失败' }, 500);
  }
});

// 获取行业对比数据（从D1读取已同步的财务数据）- 需要Pro会员
api.get('/stock/industry-comparison/:code', optionalAuth(), requireFeature('industry_comparison'), async (c) => {
  const code = c.req.param('code');
  const period = c.req.query('period'); // 可选，指定报告期
  
  if (!code) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }

  if (!c.env.DB || !c.env.TUSHARE_TOKEN) {
    return c.json({ success: false, error: '数据服务未配置' }, 503);
  }

  try {
    const stockDB = createStockDBService({ db: c.env.DB });
    
    // 获取同行业对标公司
    const peersResult = await stockDB.getIndustryPeers(code, 5);
    
    if (!peersResult.targetStock) {
      return c.json({ success: false, error: '未找到目标公司' }, 404);
    }
    
    // 准备股票代码列表
    const codesToCompare = [
      peersResult.targetStock.code,
      ...peersResult.peers.map(p => p.code)
    ];
    
    // 创建数据同步服务获取对比数据
    const dataSync = createDataSyncService(c.env.DB, c.env.TUSHARE_TOKEN, c.env.CACHE);
    const comparisonData = await dataSync.getIndustryComparisonData(codesToCompare, period);
    
    // 计算行业平均值和排名
    const metrics = calculateIndustryMetrics(comparisonData, peersResult.targetStock.code);
    
    return c.json({
      success: true,
      targetStock: peersResult.targetStock,
      industry: peersResult.industry,
      peers: peersResult.peers,
      comparisonData,
      metrics,
    });
  } catch (error) {
    console.error('Get industry comparison error:', error);
    return c.json({ success: false, error: '获取行业对比数据失败' }, 500);
  }
});

// 计算行业指标（排名、平均值、对比分析）
function calculateIndustryMetrics(
  data: { income: Record<string, any>; balance: Record<string, any>; fina: Record<string, any> },
  targetCode: string
) {
  const codes = Object.keys(data.fina);
  
  // 如果没有足够的数据，返回空
  if (codes.length < 2) {
    return { rankings: {}, averages: {}, comparisons: {} };
  }
  
  // 定义要比较的核心指标
  const finaMetrics = [
    { key: 'grossprofit_margin', name: '毛利率', higherBetter: true },
    { key: 'netprofit_margin', name: '净利率', higherBetter: true },
    { key: 'roe', name: 'ROE', higherBetter: true },
    { key: 'roa', name: 'ROA', higherBetter: true },
    { key: 'debt_to_assets', name: '资产负债率', higherBetter: false },
    { key: 'current_ratio', name: '流动比率', higherBetter: true },
    { key: 'netprofit_yoy', name: '净利润同比', higherBetter: true },
    { key: 'or_yoy', name: '营收同比', higherBetter: true },
  ];
  
  const rankings: Record<string, { rank: number; total: number; value: number }> = {};
  const averages: Record<string, number> = {};
  const comparisons: Record<string, { target: number; avg: number; diff: number; status: string }> = {};
  
  for (const metric of finaMetrics) {
    // 收集所有公司该指标的值
    const values: Array<{ code: string; value: number }> = [];
    let sum = 0;
    let count = 0;
    
    for (const code of codes) {
      const finaData = data.fina[code];
      if (finaData && finaData[metric.key] !== null && finaData[metric.key] !== undefined) {
        const val = parseFloat(finaData[metric.key]);
        if (!isNaN(val)) {
          values.push({ code, value: val });
          sum += val;
          count++;
        }
      }
    }
    
    if (count > 0) {
      // 计算平均值
      averages[metric.key] = sum / count;
      
      // 排序计算排名
      values.sort((a, b) => metric.higherBetter ? b.value - a.value : a.value - b.value);
      
      const targetEntry = values.find(v => v.code === targetCode);
      if (targetEntry) {
        const rank = values.findIndex(v => v.code === targetCode) + 1;
        rankings[metric.key] = {
          rank,
          total: values.length,
          value: targetEntry.value
        };
        
        // 与行业平均对比
        const diff = targetEntry.value - averages[metric.key];
        let status = '一般';
        if (metric.higherBetter) {
          if (diff > averages[metric.key] * 0.2) status = '优秀';
          else if (diff > 0) status = '良好';
          else if (diff < -averages[metric.key] * 0.2) status = '较差';
        } else {
          if (diff < -averages[metric.key] * 0.2) status = '优秀';
          else if (diff < 0) status = '良好';
          else if (diff > averages[metric.key] * 0.2) status = '较差';
        }
        
        comparisons[metric.key] = {
          target: targetEntry.value,
          avg: averages[metric.key],
          diff,
          status
        };
      }
    }
  }
  
  return { rankings, averages, comparisons };
}

// AI驱动的行业对比深度分析 - 需要Pro会员
api.get('/analyze/industry-comparison/:code', optionalAuth(), requireFeature('industry_comparison'), async (c) => {
  const code = c.req.param('code');
  const forceRefresh = c.req.query('refresh') === 'true';
  
  if (!code) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }

  if (!c.env.DB || !c.env.TUSHARE_TOKEN) {
    return c.json({ success: false, error: '数据服务未配置' }, 503);
  }
  
  if (!c.env.VECTORENGINE_API_KEY) {
    return c.json({ success: false, error: 'AI分析服务未配置' }, 503);
  }

  try {
    const cache = c.env.CACHE;
    const cacheKey = `industry_comparison_analysis:${code}`;
    
    // 检查缓存（7天有效期）
    if (cache && !forceRefresh) {
      const cached = await cache.get(cacheKey, 'json');
      if (cached) {
        console.log(`[IndustryComparison] 缓存命中: ${code}`);
        return c.json({
          success: true,
          fromCache: true,
          ...(cached as Record<string, unknown>),
        });
      }
    }
    
    const stockDB = createStockDBService({ db: c.env.DB });
    
    // 获取同行业对标公司
    const peersResult = await stockDB.getIndustryPeers(code, 5);
    
    if (!peersResult.targetStock) {
      return c.json({ success: false, error: '未找到目标公司' }, 404);
    }
    
    // 准备股票代码列表
    const codesToCompare = [
      peersResult.targetStock.code,
      ...peersResult.peers.map(p => p.code)
    ];
    
    // 获取对比数据
    const dataSync = createDataSyncService(c.env.DB, c.env.TUSHARE_TOKEN, c.env.CACHE);
    
    // 先确保数据已同步
    await dataSync.syncIndustryPeersData(codesToCompare);
    
    // 获取对比数据
    const comparisonData = await dataSync.getIndustryComparisonData(codesToCompare);
    
    // 计算基础指标
    const metrics = calculateIndustryMetrics(comparisonData, peersResult.targetStock.code);
    
    // 使用VectorEngine进行深度分析
    const vectorEngine = createVectorEngineService(c.env.VECTORENGINE_API_KEY);
    
    // 构建对比数据描述
    const peersDataDescription = codesToCompare.map(stockCode => {
      const income = comparisonData.income[stockCode];
      const fina = comparisonData.fina[stockCode];
      const peer = stockCode === peersResult.targetStock?.code 
        ? peersResult.targetStock 
        : peersResult.peers.find(p => p.code === stockCode);
      
      return `
【${peer?.name || stockCode}】(${stockCode})
- 营业收入: ${income?.total_revenue ? (income.total_revenue / 100000000).toFixed(2) + '亿元' : '未知'}
- 净利润: ${income?.n_income_attr_p ? (income.n_income_attr_p / 100000000).toFixed(2) + '亿元' : '未知'}
- 毛利率: ${fina?.grossprofit_margin ? fina.grossprofit_margin.toFixed(2) + '%' : '未知'}
- 净利率: ${fina?.netprofit_margin ? fina.netprofit_margin.toFixed(2) + '%' : '未知'}
- ROE: ${fina?.roe ? fina.roe.toFixed(2) + '%' : '未知'}
- ROA: ${fina?.roa ? fina.roa.toFixed(2) + '%' : '未知'}
- 资产负债率: ${fina?.debt_to_assets ? fina.debt_to_assets.toFixed(2) + '%' : '未知'}
- 流动比率: ${fina?.current_ratio ? fina.current_ratio.toFixed(2) : '未知'}
- 营收同比: ${fina?.or_yoy ? fina.or_yoy.toFixed(2) + '%' : '未知'}
- 净利润同比: ${fina?.netprofit_yoy ? fina.netprofit_yoy.toFixed(2) + '%' : '未知'}
      `;
    }).join('\n');
    
    const prompt = `
## 分析对象
目标公司：${peersResult.targetStock.name}（${peersResult.targetStock.code}）
行业：${peersResult.industry}
对标公司：${peersResult.peers.map(p => p.name).join('、')}

## 对比数据
${peersDataDescription}

## 已计算的排名和对比
${JSON.stringify(metrics, null, 2)}

请基于以上数据进行深度行业对比分析。
    `;
    
    // 调用AI进行深度分析（使用JSON专用方法确保格式正确）
    const aiAnalysis = await vectorEngine.analyzeFinancialReportJson(
      AGENT_PROMPTS.INDUSTRY_COMPARISON
        .replace('{targetCompany}', `${peersResult.targetStock?.name ?? ''}（${peersResult.targetStock?.code ?? ''}）`)
        .replace('{industry}', String(peersResult.industry))
        .replace('{peers}', peersResult.peers.map(p => `${p.name}（${p.code}）`).join('、'))
        .replace('{comparisonData}', peersDataDescription),
      prompt
    );
    
    // 使用统一的JSON解析工具
    const { parseAIJsonResponse } = await import('../utils/jsonParser');
    const parseResult = parseAIJsonResponse(aiAnalysis, {
      agentName: 'IndustryComparison',
      enableLogging: true
    });
    
    const analysisResult = parseResult.success 
      ? parseResult.data 
      : { rawAnalysis: aiAnalysis };
    
    const result = {
      targetStock: peersResult.targetStock,
      industry: peersResult.industry,
      peers: peersResult.peers,
      metrics,
      aiAnalysis: analysisResult,
      generatedAt: new Date().toISOString(),
    };
    
    // 缓存结果（7天）
    if (cache) {
      try {
        await cache.put(cacheKey, JSON.stringify(result), { expirationTtl: 7 * 24 * 60 * 60 });
      } catch (e) {
        console.warn('[IndustryComparison] 缓存保存失败:', e);
      }
    }
    
    return c.json({
      success: true,
      fromCache: false,
      ...result,
    });
  } catch (error) {
    console.error('Industry comparison analysis error:', error);
    return c.json({ 
      success: false, 
      error: '行业对比分析失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// ============ 趋势解读 API ============
// 按需生成/获取趋势解读（用于旧缓存报告补充解读）
// 支持 ?refresh=true 参数强制重新生成
api.get('/analyze/trend-interpretation/:code', async (c) => {
  const companyCode = c.req.param('code');
  const forceRefresh = c.req.query('refresh') === 'true';
  
  if (!companyCode) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }
  
  try {
    const cache = c.env.CACHE;
    
    // 创建服务
    const tushare = createTushareService({
      token: c.env.TUSHARE_TOKEN || '',
      cache: cache,
      useProxy: true,
    });
    
    const vectorEngine = createVectorEngineService(c.env.VECTORENGINE_API_KEY || '');
    
    // 获取股票基本信息
    const stockInfo = await tushare.getStockBasic(companyCode).catch(() => null);
    const companyName = stockInfo?.name || companyCode;
    const industry = stockInfo?.industry || 'default';
    
    // 获取财务数据
    const [income, finaIndicator] = await Promise.all([
      tushare.getIncomeStatement(companyCode).catch(() => []),
      tushare.getFinaIndicator(companyCode).catch(() => []),
    ]);
    
    // 获取最新报告期
    const periods: string[] = [];
    income.forEach((item: { end_date?: string }) => {
      if (item.end_date) periods.push(item.end_date);
    });
    finaIndicator.forEach((item: { end_date?: string }) => {
      if (item.end_date) periods.push(item.end_date);
    });
    const latestPeriod = periods.sort().reverse()[0] || '';
    
    // 检查缓存（除非强制刷新）
    const cacheKey = `trend_interpretation:${companyCode}:${latestPeriod}`;
    if (cache && !forceRefresh) {
      try {
        const cached = await cache.get(cacheKey, 'json');
        if (cached) {
          console.log(`[TrendInterpretation API] 缓存命中: ${companyCode}`);
          return c.json({
            success: true,
            fromCache: true,
            data: (cached as { interpretations?: unknown }).interpretations || cached,
          });
        }
      } catch (e) {
        console.warn('[TrendInterpretation API] 缓存读取失败:', e);
      }
    }
    
    // 合并数据
    const dataMap = new Map<string, Record<string, unknown>>();
    income.forEach((item: { end_date?: string; ann_date?: string; n_income_attr_p?: number; total_revenue?: number; basic_eps?: number; operate_profit?: number }) => {
      if (item.end_date) {
        dataMap.set(item.end_date, {
          end_date: item.end_date,
          ann_date: item.ann_date,
          n_income_attr_p: item.n_income_attr_p,
          total_revenue: item.total_revenue,
          basic_eps: item.basic_eps,
          operate_profit: item.operate_profit,  // 营业利润
        });
      }
    });
    finaIndicator.forEach((item: { end_date?: string; gross_margin?: number; netprofit_margin?: number; roe?: number; debt_to_assets?: number; netprofit_yoy?: number; or_yoy?: number; eps?: number; op_yoy?: number }) => {
      if (item.end_date) {
        const existing = dataMap.get(item.end_date) || { end_date: item.end_date };
        dataMap.set(item.end_date, {
          ...existing,
          gross_margin: item.gross_margin,
          netprofit_margin: item.netprofit_margin,
          roe: item.roe,
          debt_to_assets: item.debt_to_assets,
          netprofit_yoy: item.netprofit_yoy,
          or_yoy: item.or_yoy,
          op_yoy: item.op_yoy,  // 营业利润同比
          eps: item.eps || (existing as { basic_eps?: number }).basic_eps,
        });
      }
    });
    
    const mergedData = Array.from(dataMap.values())
      .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)))
      .slice(-12);
    
    // 构建 Prompt 并调用 AI (AGENT_PROMPTS 已在文件顶部静态导入)
    
    // 默认行业配置
    const defaultIndustryConfig = {
      description: '综合分析该公司的财务表现',
      benchmarks: { grossMargin: 30, netMargin: 10, roe: 15 },
      keyFactors: ['盈利能力', '成长性', '财务健康', '行业地位'],
      risks: ['宏观经济', '行业竞争', '经营风险'],
    };
    
    // 获取行业配置，如果没有则使用默认配置
    const industryCharacteristics = COMIC_PROMPTS.INDUSTRY_CHARACTERISTICS as unknown as Record<string, typeof defaultIndustryConfig> | undefined;
    const industryConfig = industryCharacteristics?.[industry] || industryCharacteristics?.['default'] || defaultIndustryConfig;
    
    const prompt = `
## 公司信息
- 公司名称：${companyName}
- 股票代码：${companyCode}
- 所属行业：${industry}

## 行业特征
${industryConfig.description || '综合分析该公司的财务表现'}

## 行业基准值参考
- 毛利率基准: ${industryConfig.benchmarks?.grossMargin ?? '无'}%
- 净利率基准: ${industryConfig.benchmarks?.netMargin ?? '无'}%
- ROE基准: ${industryConfig.benchmarks?.roe ?? '无'}%

## 财务数据（最近12期）
${JSON.stringify(mergedData, null, 2)}

请根据以上信息，为8个核心指标（netProfit, revenue, operatingProfit, eps, grossMargin, netMargin, roe, debtRatio）生成专业的趋势解读。
注意：operatingProfit（营业利润）数据在 operate_profit 字段中。
`;

    const result = await vectorEngine.analyzeFinancialReportJson(
      COMIC_PROMPTS.TREND_INTERPRETATION,
      prompt
    );
    
    // 使用统一的JSON解析工具
    const { parseAIJsonResponse } = await import('../utils/jsonParser');
    const parseResult = parseAIJsonResponse(result, {
      agentName: 'TrendInterpretation',
      enableLogging: true
    });
    
    let interpretations = parseResult.success ? parseResult.data : {};
    
    // 标准化数据结构：处理 AI 可能返回的不同格式
    // 格式1: { trend_analysis: { netProfit: {...}, ... } } => 提取 trend_analysis
    // 格式2: { netProfit: {...}, ... } => 直接使用
    if (interpretations && interpretations.trend_analysis && typeof interpretations.trend_analysis === 'object') {
      console.log('[TrendInterpretation API] 检测到 trend_analysis 嵌套结构，提取内部数据');
      interpretations = interpretations.trend_analysis as Record<string, unknown>;
    }
    
    console.log('[TrendInterpretation API] 解析完成，指标数量:', Object.keys(interpretations || {}).length);
    
    // 写入缓存
    if (cache && interpretations) {
      const cacheData = {
        companyCode,
        companyName,
        industry,
        latestPeriod,
        interpretations,
        generatedAt: new Date().toISOString(),
      };
      await cache.put(cacheKey, JSON.stringify(cacheData), {
        expirationTtl: 90 * 24 * 60 * 60, // 90天
      }).catch(e => console.warn('[TrendInterpretation API] 缓存写入失败:', e));
    }
    
    return c.json({
      success: true,
      fromCache: false,
      data: interpretations,
    });
  } catch (error) {
    console.error('[TrendInterpretation API] Error:', error);
    return c.json({ 
      success: false, 
      error: '生成趋势解读失败',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============ 获取图表数据 ============
// 为财务分析图表提供结构化的历史数据
api.get('/chart/financial/:code', async (c) => {
  const companyCode = c.req.param('code');
  
  if (!companyCode) {
    return c.json({ success: false, error: '请提供股票代码' }, 400);
  }
  
  try {
    // 判断是否为港股
    const isHK = isHKStock(companyCode);
    
    let income: any[] = [];
    let balanceSheet: any[] = [];
    let cashFlow: any[] = [];
    let finaIndicator: any[] = [];
    let dailyBasic: any[] = [];
    let stockInfo: any = null;
    
    if (isHK) {
      // 港股使用 AKShare HK 服务
      const akshareHK = createAkshareHKService({
        cache: c.env.CACHE,
        pythonProxyUrl: c.env.AKSHARE_PROXY_URL || 'http://localhost:8000',
      });
      
      console.log(`[Chart Financial] 港股数据请求: ${companyCode}`);
      
      // 并行获取港股财务数据
      [income, balanceSheet, cashFlow, finaIndicator, dailyBasic, stockInfo] = await Promise.all([
        akshareHK.getIncomeStatement(companyCode).catch((e) => { console.error('HK income error:', e); return []; }),
        akshareHK.getBalanceSheet(companyCode).catch((e) => { console.error('HK balance error:', e); return []; }),
        akshareHK.getCashFlow(companyCode).catch((e) => { console.error('HK cashflow error:', e); return []; }),
        akshareHK.getFinaIndicator(companyCode).catch(() => []),
        akshareHK.getDailyBasic(companyCode).catch(() => []),
        akshareHK.getStockBasic(companyCode).catch(() => null),
      ]);
      
      console.log(`[Chart Financial] 港股数据获取完成: income=${income.length}, balance=${balanceSheet.length}, cashflow=${cashFlow.length}`);
    } else {
      // A股使用 Tushare 服务
      const tushare = createTushareService({
        token: c.env.TUSHARE_TOKEN || '',
        cache: c.env.CACHE,
        useProxy: true,
      });
      
      // 并行获取多种财务数据
      [income, balanceSheet, cashFlow, finaIndicator, dailyBasic] = await Promise.all([
        tushare.getIncomeStatement(companyCode).catch(() => []),
        tushare.getBalanceSheet(companyCode).catch(() => []),
        tushare.getCashFlow(companyCode).catch(() => []),
        tushare.getFinaIndicator(companyCode).catch(() => []),
        tushare.getDailyBasic(companyCode).catch(() => []),
      ]);
      
      // 获取股票基本信息
      stockInfo = await tushare.getStockBasic(companyCode).catch(() => null);
    }
    
    return c.json({
      success: true,
      data: {
        companyCode,
        companyName: stockInfo?.name || companyCode,
        industry: stockInfo?.industry || '',
        income: income.slice(0, 20), // 最近20期
        balanceSheet: balanceSheet.slice(0, 20),
        cashFlow: cashFlow.slice(0, 20),
        finaIndicator: finaIndicator.slice(0, 20),
        dailyBasic: dailyBasic.slice(0, 5), // 最近5个交易日
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get chart data error:', error);
    return c.json({ 
      success: false, 
      error: '获取图表数据失败',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============ 漫画图片服务 API ============
// 从 KV 存储中读取图片并返回，支持浏览器缓存
api.get('/images/comic/:reportId/:panelIndex', async (c) => {
  try {
    const reportId = c.req.param('reportId');
    const panelIndex = c.req.param('panelIndex');
    
    if (!reportId || !panelIndex) {
      return c.json({ success: false, error: '无效的参数' }, 400);
    }
    
    if (!c.env.CACHE) {
      return c.json({ success: false, error: 'KV存储未配置' }, 503);
    }
    
    const imageKey = `comic:${reportId}:panel:${panelIndex}`;
    const imageData = await c.env.CACHE.get(imageKey);
    
    if (!imageData) {
      // 返回占位图片
      return c.redirect('https://via.placeholder.com/512x512/1a1a2e/d4af37?text=Image+Expired');
    }
    
    // 解析 Base64 数据
    // 格式: data:image/jpeg;base64,/9j/4AAQ...
    const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return c.json({ success: false, error: '无效的图片数据' }, 500);
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const binaryData = Uint8Array.from(atob(base64Data), char => char.charCodeAt(0));
    
    // 设置缓存头，让浏览器缓存图片
    return new Response(binaryData, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=604800', // 7天浏览器缓存
        'ETag': `"${reportId}-${panelIndex}"`,
      },
    });
  } catch (error) {
    console.error('[Image API] Error:', error);
    return c.redirect('https://via.placeholder.com/512x512/1a1a2e/ff0000?text=Error');
  }
});

// ============ 港股数据同步 API ============
// 用于服务端自动同步港股数据到D1数据库
api.post('/admin/sync-hk-stocks', async (c) => {
  try {
    // 简单的 API Key 验证（可选）
    const apiKey = c.req.header('X-Admin-Key');
    const expectedKey = c.env.ADMIN_API_KEY || 'finspark-hk-sync-2026';
    
    if (apiKey && apiKey !== expectedKey) {
      return c.json({ success: false, error: '无效的 API Key' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: 'D1 数据库未配置' }, 503);
    }
    
    const akshareProxyUrl = c.env.AKSHARE_PROXY_URL || 'http://47.110.92.210:8000';
    
    // 1. 从 AKShare 代理获取港股通成分股列表
    console.log('[HK Sync] 从 AKShare 代理获取港股列表...');
    const response = await fetch(`${akshareProxyUrl}/hk/stock_connect_list`);
    
    if (!response.ok) {
      return c.json({ success: false, error: `获取港股列表失败: ${response.status}` }, 500);
    }
    
    const result = await response.json() as { success: boolean; data?: Array<{code: string; name: string}>; count?: number; error?: string };
    
    if (!result.success || !result.data) {
      return c.json({ success: false, error: result.error || '无法获取港股数据' }, 500);
    }
    
    const hkStocks = result.data;
    console.log(`[HK Sync] 获取到 ${hkStocks.length} 只港股`);
    
    // 2. 港股热门列表
    const hotStocksHK = new Set([
      '00700', '09988', '03690', '09618', '01024', '02318', '00941', '01810', '09999', '02020',
      '00005', '00388', '00001', '00016', '00883', '00939', '01299', '00027', '02628', '03988',
      '00669', '09888', '00981', '02382', '01211', '00175', '02269', '01177', '00288', '01928',
      '09961', '01898', '02899', '06098', '09626', '01378', '02015', '06618', '03968', '06060',
    ]);
    
    // 3. 基础拼音映射表
    const pinyinMap: Record<string, string> = {
      '腾': 'teng', '讯': 'xun', '阿': 'a', '里': 'li', '巴': 'ba', '美': 'mei', '团': 'tuan',
      '京': 'jing', '东': 'dong', '小': 'xiao', '米': 'mi', '百': 'bai', '度': 'du', '网': 'wang', '易': 'yi',
      '中': 'zhong', '国': 'guo', '平': 'ping', '安': 'an', '银': 'yin', '行': 'hang',
      '建': 'jian', '工': 'gong', '农': 'nong', '商': 'shang', '招': 'zhao', '信': 'xin',
      '保': 'bao', '险': 'xian', '人': 'ren', '寿': 'shou', '太': 'tai', '洋': 'yang',
      '华': 'hua', '夏': 'xia', '新': 'xin', '天': 'tian', '地': 'di', '产': 'chan',
      '海': 'hai', '科': 'ke', '技': 'ji', '电': 'dian', '子': 'zi', '通': 'tong',
      '医': 'yi', '药': 'yao', '汽': 'qi', '车': 'che', '能': 'neng', '源': 'yuan',
      '金': 'jin', '融': 'rong', '投': 'tou', '资': 'zi', '控': 'kong', '股': 'gu',
      '集': 'ji', '发': 'fa', '展': 'zhan', '业': 'ye', '物': 'wu', '流': 'liu',
      '联': 'lian', '想': 'xiang', '比': 'bi', '亚': 'ya', '迪': 'di', '宁': 'ning',
    };
    
    function toPinyin(name: string): { pinyin: string; abbr: string } {
      let pinyin = '';
      let abbr = '';
      for (const char of name) {
        const py = pinyinMap[char];
        if (py) {
          pinyin += py;
          abbr += py[0];
        } else if (/[a-zA-Z0-9]/.test(char)) {
          pinyin += char.toLowerCase();
          abbr += char.toLowerCase();
        }
      }
      return { pinyin: pinyin || name, abbr: abbr || name };
    }
    
    // 4. 批量插入港股数据
    let insertedCount = 0;
    let errorCount = 0;
    
    // 先删除现有港股数据（全量更新）
    await c.env.DB.prepare("DELETE FROM stocks WHERE stock_type = 'HK'").run();
    console.log('[HK Sync] 已清空现有港股数据');
    
    // 分批插入
    const batchSize = 50;
    for (let i = 0; i < hkStocks.length; i += batchSize) {
      const batch = hkStocks.slice(i, i + batchSize);
      
      const statements = batch.map(stock => {
        const symbol = stock.code.padStart(5, '0');
        const { pinyin, abbr } = toPinyin(stock.name);
        const isHot = hotStocksHK.has(symbol) ? 1 : 0;
        
        return c.env.DB.prepare(`
          INSERT OR REPLACE INTO stocks 
          (ts_code, symbol, name, area, industry, market, exchange, list_status, stock_type, pinyin, pinyin_abbr, is_hot, hk_stock_connect)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `${symbol}.HK`,
          symbol,
          stock.name,
          '香港',
          '港股',
          '港股主板',
          'HKEX',
          'L',
          'HK',
          pinyin,
          abbr,
          isHot,
          1
        );
      });
      
      try {
        await c.env.DB.batch(statements);
        insertedCount += batch.length;
        console.log(`[HK Sync] 批次 ${Math.floor(i / batchSize) + 1}: 插入 ${batch.length} 条`);
      } catch (error) {
        errorCount += batch.length;
        console.error(`[HK Sync] 批次 ${Math.floor(i / batchSize) + 1} 失败:`, error);
      }
    }
    
    // 5. 重建 FTS 索引
    console.log('[HK Sync] 重建 FTS 索引...');
    try {
      await c.env.DB.prepare('DELETE FROM stocks_fts').run();
      await c.env.DB.prepare(`
        INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)
        SELECT id, name, symbol, ts_code, industry, COALESCE(pinyin, ''), COALESCE(pinyin_abbr, '')
        FROM stocks WHERE list_status = 'L'
      `).run();
      console.log('[HK Sync] FTS 索引重建完成');
    } catch (ftsError) {
      console.error('[HK Sync] FTS 索引重建失败:', ftsError);
    }
    
    // 6. 获取最终统计
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stock_type = 'HK' THEN 1 ELSE 0 END) as hk_count,
        SUM(CASE WHEN stock_type != 'HK' THEN 1 ELSE 0 END) as a_count
      FROM stocks
    `).first<{ total: number; hk_count: number; a_count: number }>();
    
    return c.json({
      success: true,
      message: '港股数据同步完成',
      syncResult: {
        inserted: insertedCount,
        errors: errorCount,
        source: 'AKShare 代理',
        proxyUrl: akshareProxyUrl,
      },
      databaseStats: {
        total: stats?.total || 0,
        hkStocks: stats?.hk_count || 0,
        aStocks: stats?.a_count || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HK Sync] 同步失败:', error);
    return c.json({ 
      success: false, 
      error: '港股数据同步失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, 500);
  }
});

// 获取数据库统计信息
api.get('/admin/db-stats', async (c) => {
  if (!c.env.DB) {
    return c.json({ success: false, error: 'D1 数据库未配置' }, 503);
  }
  
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN stock_type = 'HK' THEN 1 ELSE 0 END) as hk_count,
        SUM(CASE WHEN stock_type != 'HK' OR stock_type IS NULL THEN 1 ELSE 0 END) as a_count,
        SUM(CASE WHEN is_hot = 1 THEN 1 ELSE 0 END) as hot_count
      FROM stocks WHERE list_status = 'L'
    `).first<{ total: number; hk_count: number; a_count: number; hot_count: number }>();
    
    const ftsCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM stocks_fts')
      .first<{ count: number }>();
    
    return c.json({
      success: true,
      stats: {
        total: stats?.total || 0,
        hkStocks: stats?.hk_count || 0,
        aStocks: stats?.a_count || 0,
        hotStocks: stats?.hot_count || 0,
        ftsIndexed: ftsCount?.count || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DB Stats] Error:', error);
    return c.json({ success: false, error: '获取统计失败' }, 500);
  }
});

export default api;
