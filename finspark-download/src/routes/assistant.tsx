import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createTushareService } from '../services/tushare';
import { authMiddleware } from '../middleware/auth';

const assistant = new Hono<{ Bindings: Bindings }>();

// K线数据接口类型
interface KlineData {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  pre_close: number;
  change: number;
  pct_chg: number;
  vol: number;
  amount: number;
}

// 股票识别结果
interface StockMatch {
  ts_code: string;
  name: string;
  symbol: string;
  industry?: string;
}

// 数据库Schema信息（用于Text-to-SQL）
const DB_SCHEMA = `
数据库包含以下表:

【基础信息表】
1. stocks (股票基础信息表):
   - id: 主键
   - ts_code: Tushare股票代码 (如 600519.SH)
   - symbol: 股票简码 (如 600519)
   - name: 股票名称
   - area: 地区
   - industry: 所属行业
   - market: 市场类型 (主板/创业板/科创板)
   - exchange: 交易所 (SSE上交所/SZSE深交所)
   - list_date: 上市日期
   - list_status: 上市状态 (L-上市, D-退市, P-暂停上市)
   - is_hot: 是否热门股票 (0/1)
   - search_count: 搜索次数

【财务报表数据】
2. income_statements (利润表):
   - ts_code: 股票代码
   - ann_date: 公告日期 (YYYYMMDD)
   - end_date: 报告期 (YYYYMMDD，如20241231表示2024年报)
   - report_type: 报告类型 (1-合并报表)
   - total_revenue: 营业总收入 (元)
   - revenue: 营业收入 (元)
   - total_cogs: 营业总成本 (元)
   - operate_cost: 营业成本 (元)
   - sell_exp: 销售费用 (元)
   - admin_exp: 管理费用 (元)
   - fin_exp: 财务费用 (元)
   - rd_exp: 研发费用 (元)
   - operate_profit: 营业利润 (元)
   - total_profit: 利润总额 (元)
   - income_tax: 所得税费用 (元)
   - n_income: 净利润 (元)
   - n_income_attr_p: 归属母公司净利润 (元)
   - basic_eps: 基本每股收益 (元)
   - diluted_eps: 稀释每股收益 (元)

3. balance_sheets (资产负债表):
   - ts_code: 股票代码
   - ann_date: 公告日期 (YYYYMMDD)
   - end_date: 报告期 (YYYYMMDD)
   - total_assets: 资产总计 (元)
   - total_cur_assets: 流动资产合计 (元)
   - money_cap: 货币资金 (元)
   - notes_receiv: 应收票据 (元)
   - accounts_receiv: 应收账款 (元)
   - inventories: 存货 (元)
   - total_nca: 非流动资产合计 (元)
   - fix_assets: 固定资产 (元)
   - intan_assets: 无形资产 (元)
   - goodwill: 商誉 (元)
   - total_liab: 负债合计 (元)
   - total_cur_liab: 流动负债合计 (元)
   - notes_payable: 应付票据 (元)
   - acct_payable: 应付账款 (元)
   - adv_receipts: 预收账款 (元)
   - total_ncl: 非流动负债合计 (元)
   - lt_borr: 长期借款 (元)
   - bond_payable: 应付债券 (元)
   - total_hldr_eqy_exc_min_int: 股东权益合计(不含少数) (元)
   - minority_int: 少数股东权益 (元)
   - total_hldr_eqy_inc_min_int: 股东权益合计(含少数) (元)

4. cash_flows (现金流量表):
   - ts_code: 股票代码
   - ann_date: 公告日期 (YYYYMMDD)
   - end_date: 报告期 (YYYYMMDD)
   - n_cashflow_act: 经营活动现金流量净额 (元)
   - c_fr_sale_sg: 销售商品收到的现金 (元)
   - c_paid_goods_s: 购买商品支付的现金 (元)
   - c_paid_to_for_empl: 支付给职工的现金 (元)
   - c_paid_for_taxes: 支付的各项税费 (元)
   - n_cashflow_inv_act: 投资活动现金流量净额 (元)
   - c_pay_acq_const_fiolta: 购建固定资产支付的现金 (元)
   - c_recp_disp_fiolta: 处置固定资产收到的现金 (元)
   - n_cash_flows_fnc_act: 筹资活动现金流量净额 (元)
   - c_recp_borrow: 取得借款收到的现金 (元)
   - c_prepay_amt_borr: 偿还债务支付的现金 (元)
   - c_pay_dist_dpcp_int_exp: 分配股利、偿付利息支付的现金 (元)
   - n_incr_cash_cash_equ: 现金及现金等价物净增加额 (元)
   - free_cashflow: 自由现金流 (元)

【财务指标数据】
5. fina_indicators (财务指标):
   - ts_code: 股票代码
   - ann_date: 公告日期 (YYYYMMDD)
   - end_date: 报告期 (YYYYMMDD)
   - grossprofit_margin: 毛利率 (%)
   - netprofit_margin: 净利率 (%)
   - roe: 净资产收益率 (%)
   - roe_dt: 净资产收益率(摊薄) (%)
   - roa: 总资产报酬率 (%)
   - netprofit_yoy: 净利润同比增长率 (%)
   - or_yoy: 营业收入同比增长率 (%)
   - op_yoy: 营业利润同比增长率 (%)
   - assets_yoy: 总资产同比增长率 (%)
   - debt_to_assets: 资产负债率 (%)
   - current_ratio: 流动比率
   - quick_ratio: 速动比率
   - assets_turn: 总资产周转率
   - inv_turn: 存货周转率
   - ar_turn: 应收账款周转率
   - eps: 每股收益 (元)
   - bps: 每股净资产 (元)
   - cfps: 每股经营现金流 (元)

【行情数据】
6. daily_quotes (日线行情):
   - ts_code: 股票代码
   - trade_date: 交易日期 (YYYYMMDD)
   - open: 开盘价 (元)
   - high: 最高价 (元)
   - low: 最低价 (元)
   - close: 收盘价 (元)
   - pre_close: 昨收价 (元)
   - change: 涨跌额 (元)
   - pct_chg: 涨跌幅 (%)
   - vol: 成交量 (手)
   - amount: 成交额 (千元)
   - turnover_rate: 换手率 (%)
   - pe: 市盈率
   - pe_ttm: 市盈率TTM
   - pb: 市净率
   - ps: 市销率
   - ps_ttm: 市销率TTM
   - total_share: 总股本 (万股)
   - float_share: 流通股本 (万股)
   - total_mv: 总市值 (万元)
   - circ_mv: 流通市值 (万元)

【分析报告】
7. analysis_reports (分析报告表):
   - id: 主键
   - company_code: 公司股票代码
   - company_name: 公司名称
   - report_type: 报告类型
   - status: 状态 (pending/completed/failed)
   - result_json: 完整分析结果JSON
   - created_at: 创建时间

8. user_favorites (用户收藏表):
   - id: 主键
   - user_id: 用户ID
   - stock_code: 股票代码
   - stock_name: 股票名称
   - notes: 用户备注
   - created_at: 创建时间

【常用查询示例】
- 查询某股票最近4期利润数据: SELECT end_date, revenue, operate_profit, n_income FROM income_statements WHERE ts_code = '600519.SH' ORDER BY end_date DESC LIMIT 4
- 查询净利润同比增长率: SELECT end_date, netprofit_yoy FROM fina_indicators WHERE ts_code = '600519.SH' ORDER BY end_date DESC
- 计算毛利率变化: SELECT end_date, grossprofit_margin FROM fina_indicators WHERE ts_code = '600519.SH' ORDER BY end_date DESC
- 查询资产负债率: SELECT end_date, total_liab, total_assets, (total_liab * 100.0 / total_assets) as debt_ratio FROM balance_sheets WHERE ts_code = '600519.SH'
- 查询最近30天股价: SELECT trade_date, close, pct_chg FROM daily_quotes WHERE ts_code = '600519.SH' ORDER BY trade_date DESC LIMIT 30
- 查询现金流: SELECT end_date, n_cashflow_act, free_cashflow FROM cash_flows WHERE ts_code = '600519.SH' ORDER BY end_date DESC
`;

// 侧边栏对话API - 简化版智能问答
assistant.post('/chat', async (c) => {
  const { env } = c;
  const apiKey = env.VECTORENGINE_API_KEY;
  const tushareToken = env.TUSHARE_TOKEN;
  
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 500);
  }
  
  try {
    const { message, stockCode, stockName, reportId, history = [] } = await c.req.json();
    
    if (!message) {
      return c.json({ success: false, error: '请输入问题' }, 400);
    }
    
    // 判断问题类型
    const isKlineQuery = /走势|K线|行情|涨跌|价格|股价|最新|今天|实时/i.test(message);
    const isAnalysisQuery = /分析|财报|盈利|利润|收入|增长|趋势解读/i.test(message);
    const isCompareQuery = /对比|比较|行业/i.test(message);
    
    // 如果是股价/行情查询且有股票代码
    if (isKlineQuery && stockCode) {
      try {
        const tushare = createTushareService(tushareToken || '', env.CACHE, true);
        const dailyData = await tushare.getDailyBasic(stockCode);
        
        if (dailyData && dailyData.length > 0) {
          const latest = dailyData[0];
          const pctChg = latest.pct_chg ? (latest.pct_chg > 0 ? '+' : '') + latest.pct_chg.toFixed(2) + '%' : '--';
          const vol = latest.vol ? (latest.vol / 10000).toFixed(2) + '万手' : '--';
          const amount = latest.amount ? (latest.amount / 100000000).toFixed(2) + '亿元' : '--';
          const turnover = latest.turnover_rate ? latest.turnover_rate.toFixed(2) + '%' : '--';
          const pe = latest.pe ? latest.pe.toFixed(2) : '--';
          const pb = latest.pb ? latest.pb.toFixed(2) : '--';
          const totalMv = latest.total_mv ? (latest.total_mv / 100000000).toFixed(2) + '亿元' : '--';
          
          const reply = '📊 **' + stockCode + ' 最新行情**\n\n' +
            '• 最新价：' + (latest.close || '--') + ' 元\n' +
            '• 涨跌幅：' + pctChg + '\n' +
            '• 成交量：' + vol + '\n' +
            '• 成交额：' + amount + '\n' +
            '• 换手率：' + turnover + '\n' +
            '• 市盈率：' + pe + '\n' +
            '• 市净率：' + pb + '\n' +
            '• 总市值：' + totalMv + '\n\n' +
            '*数据更新时间：' + (latest.trade_date || '最新交易日') + '*';
          
          return c.json({ success: true, reply });
        }
      } catch (e) {
        console.error('[Chat] 获取行情失败:', e);
      }
    }
    
    // 构建对话上下文
    const contextMessages = history.slice(-6).map((h: { role: string; content: string }) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    }));
    
    // 构建上下文信息
    const stockContext = stockCode 
      ? `当前用户正在查看股票：${stockName || stockCode} (${stockCode})${reportId ? '，已有完整的分析报告' : ''}`
      : '用户尚未选择特定股票';
    
    // 调用AI进行通用对话
    const response = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是Finspark智能问数助手，一个专业的金融数据分析AI助手。你可以帮助用户：
1. 查询股票行情和K线走势
2. 分析财报数据和企业表现
3. 对比行业内公司
4. 解读市场趋势

${stockContext}

请用简洁专业的语言回答问题。回答后，请在最后一行以JSON格式提供2-3个相关的跟进问题建议，格式为：
[FOLLOW_UP]{"questions":["问题1","问题2","问题3"]}[/FOLLOW_UP]

如果需要具体数据，建议用户点击"全屏模式"使用完整的问数功能。`
          },
          ...contextMessages,
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    });
    
    if (!response.ok) {
      throw new Error('API请求失败: ' + response.status);
    }
    
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    let replyContent = result.choices?.[0]?.message?.content || '抱歉，我暂时无法回答这个问题。';
    
    // 解析跟进问题
    let followUpQuestions: string[] = [];
    const followUpMatch = replyContent.match(/\[FOLLOW_UP\](.*?)\[\/FOLLOW_UP\]/s);
    if (followUpMatch) {
      try {
        const parsed = JSON.parse(followUpMatch[1]);
        followUpQuestions = parsed.questions || [];
        // 从回复中移除跟进问题标记
        replyContent = replyContent.replace(/\[FOLLOW_UP\].*?\[\/FOLLOW_UP\]/s, '').trim();
      } catch (e) {
        // 解析失败，忽略
      }
    }
    
    // 如果没有解析到跟进问题，根据上下文生成默认建议
    if (followUpQuestions.length === 0 && stockCode) {
      const stockDisplayName = stockName || stockCode;
      followUpQuestions = [
        `${stockDisplayName}的盈利能力如何？`,
        `${stockDisplayName}有哪些财务风险？`,
        `${stockDisplayName}的估值是否合理？`
      ];
    }
    
    return c.json({ success: true, reply: replyContent, followUpQuestions });
    
  } catch (error) {
    console.error('[Chat Error]', error);
    return c.json({ 
      success: false, 
      error: '处理请求时出错',
      reply: '抱歉，服务暂时不可用。请稍后重试或点击"全屏模式"使用完整功能。'
    });
  }
});

// Text-to-SQL API - 将自然语言转换为SQL并执行
assistant.post('/query', async (c) => {
  const { env } = c;
  const apiKey = env.VECTORENGINE_API_KEY;
  
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 500);
  }
  
  try {
    const { question, conversationHistory = [] } = await c.req.json();
    
    if (!question) {
      return c.json({ success: false, error: '请输入问题' }, 400);
    }
    
    // 构建Text-to-SQL提示词
    const systemPrompt = '你是一个专业的金融数据分析SQL专家。用户会用自然语言提问关于股票和财报数据的问题，你需要：\n\n' +
      '1. 分析用户问题的意图\n' +
      '2. 生成正确的SQLite SQL查询语句\n' +
      '3. SQL必须安全（只允许SELECT语句）\n\n' +
      DB_SCHEMA + '\n\n' +
      '重要规则：\n' +
      '- 只生成SELECT查询，禁止INSERT/UPDATE/DELETE\n' +
      '- 使用SQLite语法\n' +
      '- 如果问题无法用SQL回答，返回 {"canQuery": false, "reason": "原因"}\n' +
      '- 如果可以查询，返回 {"canQuery": true, "sql": "SQL语句", "explanation": "查询说明"}\n\n' +
      '只返回JSON，不要其他内容。';

    // 调用VectorEngine生成SQL
    const response = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-4),
          { role: 'user', content: question }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });
    
    const aiResult: any = await response.json();
    
    // 检查API错误
    if (!response.ok || aiResult.error) {
      const errorMsg = aiResult.error?.message_zh || aiResult.error?.message || 'API服务暂时不可用';
      console.error('[Assistant API Error]', aiResult.error);
      
      // 如果是负载问题，给出友好提示
      if (response.status === 429 || response.status === 503) {
        return c.json({
          success: true,
          type: 'chat',
          message: '🔄 AI服务繁忙，请稍后重试。\n\n提示：您也可以尝试更简单的问题，如"有多少只股票"、"列出白酒行业股票"等。'
        });
      }
      throw new Error('AI服务错误: ' + errorMsg);
    }
    
    const aiContent = aiResult.choices?.[0]?.message?.content || '';
    
    // 解析AI返回的JSON
    let parsedResult: any;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { canQuery: false, reason: '无法解析AI响应' };
    } catch (e) {
      parsedResult = { canQuery: false, reason: '无法解析AI响应' };
    }
    
    if (!parsedResult.canQuery) {
      return c.json({
        success: true,
        type: 'chat',
        message: parsedResult.reason || '这个问题无法通过数据库查询回答，请尝试其他问题。'
      });
    }
    
    // 安全检查SQL
    const sql = parsedResult.sql?.trim() || '';
    if (!sql.toUpperCase().startsWith('SELECT')) {
      return c.json({
        success: false,
        error: '只允许查询操作'
      }, 400);
    }
    
    // 执行SQL查询
    const db = env.DB;
    const queryResult = await db.prepare(sql).all();
    
    return c.json({
      success: true,
      type: 'query',
      sql: sql,
      explanation: parsedResult.explanation,
      data: queryResult.results,
      rowCount: queryResult.results?.length || 0
    });
    
  } catch (error) {
    console.error('[Assistant Query Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '查询执行失败'
    }, 500);
  }
});

// 数据解读API - 使用ChatGPT对查询结果进行解读
assistant.post('/interpret', async (c) => {
  const { env } = c;
  const apiKey = env.VECTORENGINE_API_KEY;
  
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 500);
  }
  
  try {
    const { question, sql, data, explanation } = await c.req.json();
    
    // 构建解读提示词
    const systemPrompt = '你是一个专业的金融数据分析师。用户执行了一个数据库查询，请对查询结果进行专业的解读和分析。\n\n' +
      '要求：\n' +
      '1. 用简洁专业的语言解读数据\n' +
      '2. 指出数据中的关键发现和趋势\n' +
      '3. 如果适用，给出投资相关的见解（但要声明仅供参考）\n' +
      '4. 回答要结构化，易于阅读\n' +
      '5. 使用中文回答';

    const userPrompt = '用户问题: ' + question + '\n\n' +
      '执行的SQL: ' + sql + '\n\n' +
      '查询说明: ' + explanation + '\n\n' +
      '查询结果 (共' + (data?.length || 0) + '条):\n' +
      JSON.stringify(data?.slice(0, 50), null, 2) + '\n\n' +
      '请对以上数据进行专业解读。';

    // 调用VectorEngine进行解读
    const response = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    const aiResult: any = await response.json();
    
    // 检查API错误
    if (!response.ok || aiResult.error) {
      console.error('[Interpret API Error]', aiResult.error);
      // 即使解读失败也返回成功，只是没有解读内容
      return c.json({
        success: true,
        interpretation: '⚠️ AI解读服务暂时繁忙，以上为原始查询结果。'
      });
    }
    
    const interpretation = aiResult.choices?.[0]?.message?.content || '暂无解读';
    
    return c.json({
      success: true,
      interpretation
    });
    
  } catch (error) {
    console.error('[Assistant Interpret Error]', error);
    // 解读失败不影响主流程
    return c.json({
      success: true,
      interpretation: '⚠️ 解读生成失败，请查看原始数据。'
    });
  }
});

// 股票识别API - 从问题中识别股票代码/名称
assistant.post('/identify-stocks', async (c) => {
  const { env } = c;
  const apiKey = env.VECTORENGINE_API_KEY;
  
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 500);
  }
  
  try {
    const { question } = await c.req.json();
    
    if (!question) {
      return c.json({ success: false, error: '请输入问题' }, 400);
    }
    
    // 首先尝试从数据库直接匹配股票
    const db = env.DB;
    const keywords = question.match(/[\u4e00-\u9fa5]+|[A-Za-z]+|\d{6}/g) || [];
    
    let matchedStocks: StockMatch[] = [];
    
    // 直接搜索常见股票关键词
    for (const keyword of keywords) {
      if (keyword.length >= 2) {
        const searchResult = await db.prepare(`
          SELECT ts_code, name, symbol, industry 
          FROM stocks 
          WHERE name LIKE ? OR symbol LIKE ? OR ts_code LIKE ?
          LIMIT 5
        `).bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`).all();
        
        if (searchResult.results && searchResult.results.length > 0) {
          matchedStocks.push(...(searchResult.results as StockMatch[]));
        }
      }
    }
    
    // 去重
    const uniqueStocks = matchedStocks.filter((stock, index, self) =>
      index === self.findIndex((s) => s.ts_code === stock.ts_code)
    ).slice(0, 5);
    
    // 如果数据库找到了，直接返回
    if (uniqueStocks.length > 0) {
      return c.json({
        success: true,
        stocks: uniqueStocks,
        method: 'database'
      });
    }
    
    // 如果数据库没找到，使用AI识别
    const systemPrompt = '你是一个股票识别专家。分析用户的问题，识别出其中提到的股票。\n\n' +
      '返回JSON格式：\n' +
      '{"stocks": [{"name": "股票名称", "ts_code": "代码.交易所"}]}\n\n' +
      '交易所后缀：上交所用.SH，深交所用.SZ\n' +
      '只返回JSON，不要其他内容。';
    
    const response = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      return c.json({
        success: true,
        stocks: [],
        method: 'none',
        message: '无法识别股票'
      });
    }
    
    const aiResult: any = await response.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '';
    
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { stocks: [] };
      return c.json({
        success: true,
        stocks: parsed.stocks || [],
        method: 'ai'
      });
    } catch (e) {
      return c.json({
        success: true,
        stocks: [],
        method: 'none'
      });
    }
    
  } catch (error) {
    console.error('[Identify Stocks Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '股票识别失败'
    }, 500);
  }
});

// K线数据获取API
assistant.post('/kline', async (c) => {
  const { env } = c;
  const tushareToken = env.TUSHARE_TOKEN;
  
  if (!tushareToken) {
    return c.json({ success: false, error: 'Tushare token not configured' }, 500);
  }
  
  try {
    const { stocks, startDate, endDate } = await c.req.json();
    
    if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }
    
    // 限制最多5只股票
    const stockCodes = stocks.slice(0, 5);
    
    // 默认日期范围：最近一年
    const end = endDate || new Date().toISOString().split('T')[0].replace(/-/g, '');
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const start = startDate || oneYearAgo.toISOString().split('T')[0].replace(/-/g, '');
    
    const tushare = createTushareService({ 
      token: tushareToken,
      cache: env.KV 
    });
    
    // 并行获取多只股票的K线数据
    const klinePromises = stockCodes.map(async (code: string) => {
      try {
        const dailyData = await tushare.getDailyData(code, start, end);
        return {
          ts_code: code,
          success: true,
          data: dailyData.map((d: any) => ({
            trade_date: d.trade_date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            pct_chg: d.pct_chg,
            vol: d.vol,
            amount: d.amount
          }))
        };
      } catch (error) {
        console.error(`[Kline Error] ${code}:`, error);
        return {
          ts_code: code,
          success: false,
          error: error instanceof Error ? error.message : '获取失败',
          data: []
        };
      }
    });
    
    const results = await Promise.all(klinePromises);
    
    return c.json({
      success: true,
      dateRange: { start, end },
      stocks: results
    });
    
  } catch (error) {
    console.error('[Kline API Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'K线数据获取失败'
    }, 500);
  }
});

// 股票走势AI解读API
assistant.post('/analyze-trend', async (c) => {
  const { env } = c;
  const apiKey = env.VECTORENGINE_API_KEY;
  
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 500);
  }
  
  try {
    const { stocks, klineData, question } = await c.req.json();
    
    if (!klineData || klineData.length === 0) {
      return c.json({ success: false, error: '无K线数据' }, 400);
    }
    
    // 构建走势分析提示词
    const systemPrompt = '你是一个专业的股票技术分析师。请对以下股票的K线走势进行专业分析。\n\n' +
      '分析要求：\n' +
      '1. 整体走势判断（上涨/下跌/震荡）\n' +
      '2. 关键支撑位和压力位\n' +
      '3. 成交量变化分析\n' +
      '4. 技术形态识别（如有）\n' +
      '5. 多只股票对比分析（如适用）\n' +
      '6. 短期走势预判（仅供参考）\n\n' +
      '注意：所有分析仅供参考，不构成投资建议。';
    
    // 准备数据摘要（最近30个交易日）
    const dataSummary = klineData.map((stock: any) => {
      const recentData = (stock.data || []).slice(0, 30);
      if (recentData.length === 0) return null;
      
      const closes = recentData.map((d: any) => d.close);
      const vols = recentData.map((d: any) => d.vol);
      const pctChgs = recentData.map((d: any) => d.pct_chg);
      
      const latest = recentData[0];
      const oldest = recentData[recentData.length - 1];
      const periodChange = ((latest.close - oldest.close) / oldest.close * 100).toFixed(2);
      
      return {
        code: stock.ts_code,
        latest_date: latest.trade_date,
        latest_close: latest.close,
        period_change: periodChange + '%',
        high_30d: Math.max(...closes).toFixed(2),
        low_30d: Math.min(...closes).toFixed(2),
        avg_vol_30d: Math.round(vols.reduce((a: number, b: number) => a + b, 0) / vols.length),
        max_daily_chg: Math.max(...pctChgs.map(Math.abs)).toFixed(2) + '%',
        data_points: recentData.length
      };
    }).filter(Boolean);
    
    const userPrompt = '用户问题: ' + (question || '请分析这些股票的走势') + '\n\n' +
      '股票列表: ' + stocks.map((s: any) => `${s.name}(${s.ts_code})`).join(', ') + '\n\n' +
      '近30个交易日数据摘要:\n' + JSON.stringify(dataSummary, null, 2) + '\n\n' +
      '请进行专业的技术分析和走势解读。';
    
    const response = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      const errorData: any = await response.json();
      console.error('[Trend Analysis API Error]', errorData);
      return c.json({
        success: true,
        analysis: '⚠️ AI分析服务暂时繁忙，请稍后重试。\n\n您可以先查看图表中的走势数据。'
      });
    }
    
    const aiResult: any = await response.json();
    const analysis = aiResult.choices?.[0]?.message?.content || '暂无分析';
    
    return c.json({
      success: true,
      analysis,
      dataSummary
    });
    
  } catch (error) {
    console.error('[Trend Analysis Error]', error);
    return c.json({
      success: true,
      analysis: '⚠️ 走势分析生成失败，请查看图表数据。'
    });
  }
});

// 综合股票问答API - 智能判断意图并执行
assistant.post('/smart-query', async (c) => {
  const { env } = c;
  const apiKey = env.VECTORENGINE_API_KEY;
  const tushareToken = env.TUSHARE_TOKEN;
  
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 500);
  }
  
  try {
    const { question, conversationHistory = [] } = await c.req.json();
    
    if (!question) {
      return c.json({ success: false, error: '请输入问题' }, 400);
    }
    
    // 判断问题类型
    const isKlineQuery = /走势|K线|行情|涨跌|对比|比较|价格|股价|趋势/i.test(question);
    const isStockQuery = /股票|上市|行业|热门|收藏/i.test(question);
    
    // 如果是K线/走势相关问题
    if (isKlineQuery && tushareToken) {
      // 1. 识别股票 - 先移除常见非股票关键词，再提取可能的股票名称
      const db = env.DB;
      const excludePatterns = /(走势|行情|涨跌|对比|比较|价格|股价|趋势|分析|怎么样|如何|最近|今天|昨天|表现|和|与|的|了|吗)/g;
      const cleanQuestion = question.replace(excludePatterns, ' ');
      const keywords = (cleanQuestion.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z]+|\d{6}/g) || [])
        .filter(kw => kw.length >= 2 && kw.length <= 10);
      
      console.log('[Smart Query] cleanQuestion:', cleanQuestion, 'keywords:', keywords);
      
      let matchedStocks: StockMatch[] = [];
      for (const keyword of keywords) {
        const searchResult = await db.prepare(`
          SELECT ts_code, name, symbol, industry 
          FROM stocks 
          WHERE name LIKE ? OR symbol LIKE ? OR ts_code LIKE ?
          LIMIT 3
        `).bind(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`).all();
        
        if (searchResult.results && searchResult.results.length > 0) {
          matchedStocks.push(...(searchResult.results as StockMatch[]));
        }
      }
      
      // 去重并限制数量
      const uniqueStocks = matchedStocks.filter((stock, index, self) =>
        index === self.findIndex((s) => s.ts_code === stock.ts_code)
      ).slice(0, 5);
      
      console.log('[Smart Query] matched stocks:', uniqueStocks.length);
      
      if (uniqueStocks.length > 0) {
        // 2. 获取K线数据
        const tushare = createTushareService({ 
          token: tushareToken,
          cache: env.KV 
        });
        
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const startDate = oneYearAgo.toISOString().split('T')[0].replace(/-/g, '');
        const endDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
        
        const klinePromises = uniqueStocks.map(async (stock) => {
          try {
            const dailyData = await tushare.getDailyData(stock.ts_code, startDate, endDate);
            return {
              ts_code: stock.ts_code,
              name: stock.name,
              success: true,
              data: dailyData.slice(0, 250) // 最近一年约250个交易日
            };
          } catch (error) {
            return {
              ts_code: stock.ts_code,
              name: stock.name,
              success: false,
              data: []
            };
          }
        });
        
        const klineResults = await Promise.all(klinePromises);
        
        // 3. AI分析走势
        let analysis = '';
        try {
          const trendResponse = await fetch(new URL('/api/assistant/analyze-trend', c.req.url).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stocks: uniqueStocks,
              klineData: klineResults,
              question
            })
          });
          // 由于是内部调用可能有问题，直接在这里生成分析
        } catch (e) {
          // 内部调用失败，直接用AI分析
        }
        
        // 直接调用AI进行分析
        const dataSummary = klineResults.map((stock: any) => {
          const recentData = (stock.data || []).slice(0, 30);
          if (recentData.length === 0) return null;
          
          const closes = recentData.map((d: any) => d.close);
          const latest = recentData[0];
          const oldest = recentData[recentData.length - 1];
          
          return {
            name: stock.name,
            code: stock.ts_code,
            latest_close: latest?.close,
            period_change: oldest?.close ? ((latest.close - oldest.close) / oldest.close * 100).toFixed(2) + '%' : 'N/A'
          };
        }).filter(Boolean);
        
        // 调用AI分析
        const analysisResponse = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [
              { 
                role: 'system', 
                content: '你是专业股票分析师。简要分析股票走势，包括：1)整体趋势 2)涨跌幅对比 3)简短预判(仅供参考)。回答控制在300字内。' 
              },
              { 
                role: 'user', 
                content: '问题: ' + question + '\n数据: ' + JSON.stringify(dataSummary) 
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
          })
        });
        
        if (analysisResponse.ok) {
          const analysisResult: any = await analysisResponse.json();
          analysis = analysisResult.choices?.[0]?.message?.content || '';
        }
        
        return c.json({
          success: true,
          type: 'kline',
          stocks: uniqueStocks,
          klineData: klineResults,
          analysis,
          dateRange: { startDate, endDate }
        });
      }
    }
    
    // 默认走Text-to-SQL流程
    const sqlResponse = await fetch(new URL('/api/assistant/query', c.req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, conversationHistory })
    });
    
    const sqlResult = await sqlResponse.json();
    return c.json(sqlResult);
    
  } catch (error) {
    console.error('[Smart Query Error]', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    }, 500);
  }
});

// ==================== 问题收藏功能 ====================

// 获取用户保存的问题列表
assistant.get('/saved-questions', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const category = c.req.query('category') || '';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    let query = `
      SELECT id, question, answer, context_stock_code, context_stock_name, 
             context_report_id, category, tags, is_pinned, use_count, 
             last_used_at, created_at
      FROM saved_questions 
      WHERE user_id = ?
    `;
    const params: any[] = [user.id];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await db.prepare(query).bind(...params).all();
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM saved_questions WHERE user_id = ?';
    const countParams: any[] = [user.id];
    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    
    const countResult = await db.prepare(countQuery).bind(...countParams).first() as { total: number };
    
    return c.json({
      success: true,
      questions: result.results || [],
      total: countResult?.total || 0,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('[Get Saved Questions Error]', error);
    return c.json({ success: false, error: '获取保存的问题失败' }, 500);
  }
});

// 保存问题
assistant.post('/saved-questions', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const { question, answer, stockCode, stockName, reportId, category = 'general', tags = [] } = await c.req.json();
    
    if (!question) {
      return c.json({ success: false, error: '问题内容不能为空' }, 400);
    }
    
    // 检查是否已存在相同问题
    const existing = await db.prepare(`
      SELECT id FROM saved_questions 
      WHERE user_id = ? AND question = ?
    `).bind(user.id, question).first();
    
    if (existing) {
      // 更新使用次数
      await db.prepare(`
        UPDATE saved_questions 
        SET use_count = use_count + 1, last_used_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(existing.id).run();
      
      return c.json({
        success: true,
        message: '问题已存在，已更新使用记录',
        questionId: existing.id
      });
    }
    
    // 插入新问题
    const result = await db.prepare(`
      INSERT INTO saved_questions (
        user_id, question, answer, context_stock_code, context_stock_name, 
        context_report_id, category, tags, use_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      user.id, 
      question, 
      answer || null, 
      stockCode || null, 
      stockName || null,
      reportId || null,
      category,
      JSON.stringify(tags)
    ).run();
    
    return c.json({
      success: true,
      message: '问题已保存',
      questionId: result.meta.last_row_id
    });
    
  } catch (error) {
    console.error('[Save Question Error]', error);
    return c.json({ success: false, error: '保存问题失败' }, 500);
  }
});

// 删除保存的问题
assistant.delete('/saved-questions/:id', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    const questionId = parseInt(c.req.param('id'));
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!questionId) {
      return c.json({ success: false, error: '无效的问题ID' }, 400);
    }
    
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 确保只能删除自己的问题
    const result = await db.prepare(`
      DELETE FROM saved_questions WHERE id = ? AND user_id = ?
    `).bind(questionId, user.id).run();
    
    if (result.meta.changes === 0) {
      return c.json({ success: false, error: '问题不存在或无权删除' }, 404);
    }
    
    return c.json({ success: true, message: '问题已删除' });
    
  } catch (error) {
    console.error('[Delete Saved Question Error]', error);
    return c.json({ success: false, error: '删除问题失败' }, 500);
  }
});

// 切换问题置顶状态
assistant.patch('/saved-questions/:id/pin', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    const questionId = parseInt(c.req.param('id'));
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!questionId) {
      return c.json({ success: false, error: '无效的问题ID' }, 400);
    }
    
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 获取当前状态
    const current = await db.prepare(`
      SELECT is_pinned FROM saved_questions WHERE id = ? AND user_id = ?
    `).bind(questionId, user.id).first() as { is_pinned: number } | null;
    
    if (!current) {
      return c.json({ success: false, error: '问题不存在或无权操作' }, 404);
    }
    
    // 切换置顶状态
    const newPinned = current.is_pinned === 1 ? 0 : 1;
    await db.prepare(`
      UPDATE saved_questions SET is_pinned = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(newPinned, questionId, user.id).run();
    
    return c.json({
      success: true,
      isPinned: newPinned === 1,
      message: newPinned === 1 ? '已置顶' : '已取消置顶'
    });
    
  } catch (error) {
    console.error('[Toggle Pin Error]', error);
    return c.json({ success: false, error: '操作失败' }, 500);
  }
});

// 使用保存的问题（记录使用次数）
assistant.post('/saved-questions/:id/use', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    const questionId = parseInt(c.req.param('id'));
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!questionId) {
      return c.json({ success: false, error: '无效的问题ID' }, 400);
    }
    
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 更新使用记录
    await db.prepare(`
      UPDATE saved_questions 
      SET use_count = use_count + 1, last_used_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(questionId, user.id).run();
    
    // 获取问题内容
    const question = await db.prepare(`
      SELECT question, context_stock_code, context_stock_name, context_report_id
      FROM saved_questions WHERE id = ? AND user_id = ?
    `).bind(questionId, user.id).first();
    
    return c.json({
      success: true,
      question
    });
    
  } catch (error) {
    console.error('[Use Saved Question Error]', error);
    return c.json({ success: false, error: '操作失败' }, 500);
  }
});

// 获取问题分类统计
assistant.get('/saved-questions/categories', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const result = await db.prepare(`
      SELECT category, COUNT(*) as count
      FROM saved_questions 
      WHERE user_id = ?
      GROUP BY category
      ORDER BY count DESC
    `).bind(user.id).all();
    
    // 分类名称映射
    const categoryNames: Record<string, string> = {
      general: '通用问题',
      analysis: '分析问题',
      comparison: '对比问题',
      trend: '走势问题',
      finance: '财务问题'
    };
    
    const categories = (result.results || []).map((item: any) => ({
      id: item.category,
      name: categoryNames[item.category] || item.category,
      count: item.count
    }));
    
    return c.json({
      success: true,
      categories
    });
    
  } catch (error) {
    console.error('[Get Categories Error]', error);
    return c.json({ success: false, error: '获取分类统计失败' }, 500);
  }
});

export default assistant;
