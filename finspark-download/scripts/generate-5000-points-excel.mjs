import ExcelJS from 'exceljs';

// 定义 5000 积分可访问的所有接口
const allInterfaces = {
  股票数据: [
    { api: 'daily', name: '日线行情', minPoints: 120, description: '全部历史，交易日每日15点～17点之间更新' },
    { api: 'weekly', name: '周线行情', minPoints: 2000, description: '全部历史，每周五15点～17点之间更新' },
    { api: 'monthly', name: '月线行情', minPoints: 2000, description: '全部历史，每月更新' },
    { api: 'pro_bar', name: '复权行情', minPoints: 2000, description: '全部历史，每月更新（分钟、指数、基金、期货除外）' },
    { api: 'daily_basic', name: '每日指标数据', minPoints: 2000, description: '交易日每日15点～17点之间更新' },
    { api: 'new_share', name: 'IPO新股列表', minPoints: 120, description: '每日19点更新' },
    { api: 'top_list', name: '龙虎榜每日明细', minPoints: 2000, description: '数据开始于2005年，每日晚8点更新' },
    { api: 'top_inst', name: '龙虎榜机构交易明细', minPoints: 2000, description: '数据开始于2005年，每日晚8点更新' },
    { api: 'pledge_detail', name: '股权质押明细', minPoints: 2000, description: '数据开始于2004年，每日晚9点更新' },
    { api: 'pledge_stat', name: '股权质押统计', minPoints: 2000, description: '数据开始于2014年，每日晚9点更新' },
    { api: 'margin', name: '融资融券交易汇总', minPoints: 2000, description: '数据开始于2010年，每日9点更新' },
    { api: 'margin_detail', name: '融资融交易明细', minPoints: 2000, description: '数据开始于2010年，每日9点更新' },
    { api: 'repurchase', name: '股票回购', minPoints: 2000, description: '数据开始于2011年，每日定时更新' },
    { api: 'share_float', name: '限售股解禁', minPoints: 3000, description: '定期更新' },
    { api: 'block_trade', name: '大宗交易', minPoints: 2000, description: '每日晚9点' },
    { api: 'stk_holdernumber', name: '股东人数', minPoints: 2000, description: '不定期更新' },
    { api: 'moneyflow', name: '个股资金流向', minPoints: 2000, description: '交易日19点' },
    { api: 'stk_holdertrade', name: '股东增减持', minPoints: 2000, description: '交易日19点' },
    { api: 'stk_limit', name: '每日涨跌停价格', minPoints: 2000, description: '交易日9点' },
    { api: 'hk_hold', name: '沪深股通持股明细', minPoints: 2000, description: '下个交易日8点' },
    { api: 'bak_basic', name: '股票历史列表', minPoints: 5000, description: '获取备用基础列表，数据从2016年开始' }
  ],
  财务数据: [
    { api: 'income', name: '利润表', minPoints: 2000, description: '全部历史，实时更新' },
    { api: 'income_vip', name: '利润表(VIP)', minPoints: 5000, description: '可获取某一季度全部上市公司数据' },
    { api: 'balancesheet', name: '资产负债表', minPoints: 2000, description: '全部历史，实时更新' },
    { api: 'balancesheet_vip', name: '资产负债表(VIP)', minPoints: 5000, description: '可获取某一季度全部上市公司数据' },
    { api: 'cashflow', name: '现金流量表', minPoints: 2000, description: '全部历史，实时更新' },
    { api: 'cashflow_vip', name: '现金流量表(VIP)', minPoints: 5000, description: '可获取某一季度全部上市公司数据' },
    { api: 'forecast', name: '业绩预告', minPoints: 2000, description: '全部历史，实时更新' },
    { api: 'express', name: '业绩快报', minPoints: 2000, description: '全部历史，实时更新' },
    { api: 'dividend', name: '分红送股', minPoints: 2000, description: '全部历史，实时更新' },
    { api: 'fina_indicator', name: '财务指标数据', minPoints: 2000, description: '全部历史，随财报实时更新' },
    { api: 'fina_indicator_vip', name: '财务指标数据(VIP)', minPoints: 5000, description: '可获取某一季度全部上市公司数据' },
    { api: 'fina_audit', name: '财务审计意见', minPoints: 2000, description: '全部历史，随财报实时更新' },
    { api: 'fina_mainbz', name: '主营业务构成', minPoints: 2000, description: '全部历史，随财报实时更新' },
    { api: 'fina_mainbz_vip', name: '主营业务构成(VIP)', minPoints: 5000, description: '可获取某一季度全部上市公司数据' },
    { api: 'disclosure_date', name: '财报披露计划', minPoints: 2000, description: '全部历史，定期更新' }
  ],
  基金数据: [
    { api: 'fund_basic', name: '公募基金列表', minPoints: 2000, description: '全部历史，定时更新' },
    { api: 'fund_company', name: '公募基金公司', minPoints: 2000, description: '全部历史，定时更新' },
    { api: 'fund_nav', name: '公募基金净值', minPoints: 2000, description: '全部历史，每日定期更新' },
    { api: 'fund_daily', name: '场内基金日线行情', minPoints: 2000, description: '全部历史，每日盘后更新' },
    { api: 'fund_div', name: '公募基金分红', minPoints: 2000, description: '全部历史，定期更新' },
    { api: 'fund_portfolio', name: '公募基金持仓数据', minPoints: 2000, description: '股票持仓数据，定期采集更新' },
    { api: 'fund_adj', name: '基金复权因子', minPoints: 5000, description: '基金复权因子，每日17点更新' }
  ],
  期货数据: [
    { api: 'fut_basic', name: '期货合约列表', minPoints: 2000, description: '全部历史' },
    { api: 'trade_cal', name: '期货交易日历', minPoints: 2000, description: '数据开始于1996年1月，定期更新' },
    { api: 'fut_daily', name: '期货日线行情', minPoints: 2000, description: '数据开始于1996年1月，每日盘后更新' },
    { api: 'fut_holding', name: '每日成交持仓排名', minPoints: 2000, description: '数据开始于2002年1月，每日盘后更新' },
    { api: 'fut_wsr', name: '仓单日报', minPoints: 2000, description: '数据开始于2006年1月，每日盘后更新' },
    { api: 'fut_settle', name: '结算参数', minPoints: 2000, description: '数据开始于2012年1月，每日盘后更新' },
    { api: 'index_daily', name: '南华期货指数行情', minPoints: 2000, description: '超过10年历史，每日盘后更新' }
  ],
  期权数据: [
    { api: 'opt_basic', name: '期权合约列表', minPoints: 2000, description: '全部历史，每日晚8点更新' },
    { api: 'opt_daily', name: '期权日线行情', minPoints: 5000, description: '全部历史，每日17点更新' }
  ],
  债券数据: [
    { api: 'cb_basic', name: '可转债基础信息', minPoints: 2000, description: '全部历史，每日更新' },
    { api: 'cb_issue', name: '可转债发行数据', minPoints: 2000, description: '全部历史，每日更新' },
    { api: 'cb_daily', name: '可转债日线数据', minPoints: 2000, description: '全部历史，每日17点更新' }
  ],
  外汇数据: [
    { api: 'fx_obasic', name: '外汇基础信息（海外）', minPoints: 2000, description: '全部历史，每日更新' },
    { api: 'fx_daily', name: '外汇日线行情', minPoints: 2000, description: '全部历史，每日更新' }
  ],
  指数数据: [
    { api: 'index_basic', name: '指数基本信息', minPoints: 2000, description: '每日更新' },
    { api: 'index_daily', name: '指数日线行情', minPoints: 2000, description: '全部历史，交易日15点～17点更新' },
    { api: 'index_weekly', name: '指数周线行情', minPoints: 2000, description: '每周盘后更新' },
    { api: 'index_monthly', name: '指数月线行情', minPoints: 2000, description: '每月盘后更新' },
    { api: 'index_weight', name: '指数成分和权重', minPoints: 2000, description: '月度成分和权重数据' },
    { api: 'index_dailybasic', name: '大盘指数每日指标', minPoints: 4000, description: '数据开始于2004年1月，每日盘后更新' },
    { api: 'index_classify', name: '申万行业分类', minPoints: 2000, description: '全部分类' },
    { api: 'index_member_all', name: '申万行业成分', minPoints: 2000, description: '全部数据' }
  ],
  港股数据: [
    { api: 'hk_basic', name: '港股列表', minPoints: 2000, description: '全部历史，每日更新' }
  ],
  行业特色: [
    { api: 'tmt_twincome', name: '台湾电子产业月营收', minPoints: 0, description: '数据开始于2011年，月度更新' },
    { api: 'tmt_twincomedetail', name: '台湾电子产业月营收明细', minPoints: 0, description: '数据开始于2011年，月度更新' },
    { api: 'bo_monthly', name: '电影月度票房', minPoints: 500, description: '数据开始于2008年，月度更新' },
    { api: 'bo_weekly', name: '电影周度票房', minPoints: 500, description: '数据开始于2008年，每周更新' },
    { api: 'bo_daily', name: '电影日度票房', minPoints: 500, description: '数据开始于2018年，每日更新' },
    { api: 'bo_cinema', name: '影院每日票房', minPoints: 500, description: '数据开始于2018年，每日更新' },
    { api: 'film_record', name: '全国电影剧本备案数据', minPoints: 120, description: '数据开始于2011年，定期更新' },
    { api: 'teleplay_record', name: '全国电视剧本备案数据', minPoints: 600, description: '数据开始于2009年，定期更新' }
  ],
  宏观经济: [
    { api: 'shibor', name: 'SHIBOR利率数据', minPoints: 2000, description: '数据开始于2006年，每日12点' },
    { api: 'shibor_quote', name: 'SHIBOR报价数据', minPoints: 2000, description: '数据开始于2006年，每日12点' },
    { api: 'shibor_lpr', name: 'LPR贷款基础利率', minPoints: 120, description: '数据开始于2013年，每日12点' },
    { api: 'libor', name: 'LIBOR拆借利率', minPoints: 120, description: '数据开始于1986年，每日12点' },
    { api: 'hibor', name: 'HIBOR拆借利率', minPoints: 120, description: '数据开始于2002年，每日12点' },
    { api: 'wz_index', name: '温州民间借贷利率', minPoints: 2000, description: '数据不定期更新' },
    { api: 'gz_index', name: '广州民间借贷利率', minPoints: 2000, description: '数据不定期更新' }
  ]
};

// 需要单独付费的接口（不在积分范畴内）
const paidInterfaces = [
  { type: '股票历史分钟', data: '1、5、15、30、60分钟', startDate: '2009年', cost: '2000元/年', frequency: '每分钟500次' },
  { type: '股票实时分钟', data: '1、5、15、30、60分钟', startDate: '实时', cost: '1000元/月', frequency: '每分钟500次' },
  { type: '股票实时日线', data: '当日实时日线成交情况', startDate: '每天9点半开始', cost: '200元/月', frequency: '每分钟50次' },
  { type: '指数实时日线', data: '指数实时成交情况', startDate: '每天9点半开始', cost: '200元/月', frequency: '每分钟50次' },
  { type: 'ETF实时日线', data: '当日ETF实时日线成交情况', startDate: '每天9点半开始', cost: '200元/月', frequency: '每分钟50次' },
  { type: '期货历史分钟', data: '1、5、15、30、60分钟', startDate: '2010年', cost: '2000元/年', frequency: '每分钟500次' },
  { type: '期货实时分钟', data: '1、5、15、30、60分钟', startDate: '实时', cost: '1000元/月', frequency: 'SDK/HTTP/WebSocket' },
  { type: '期权历史分钟', data: '1、5、15、30、60分钟', startDate: '2010年', cost: '2000元/年', frequency: '每分钟500次' },
  { type: '港股日线', data: '日线+复权行情', startDate: '全历史', cost: '1000元/年', frequency: '每分钟500次' },
  { type: '港股分钟', data: '分钟行情', startDate: '2015年', cost: '2000元/年', frequency: '每分钟500次' },
  { type: '港股财报', data: '财报数据', startDate: '2000年', cost: '500元或15000积分', frequency: '每分钟500次' },
  { type: '港股实时日线', data: '实时日线', startDate: '每天9点半开始', cost: '1000元/月', frequency: '每分钟50次' },
  { type: '美股日线', data: '日线+估值指标+复权行情', startDate: '全历史', cost: '2000元/年', frequency: '每分钟500次' },
  { type: '美股财报', data: '财报数据', startDate: '2000年', cost: '500元或15000积分', frequency: '每分钟500次' },
  { type: '新闻资讯', data: '快讯、长篇新闻、新闻联播', startDate: '3年以上', cost: '1000元/年', frequency: '每分钟400次' },
  { type: '公告信息', data: '股票、基金、固收公告', startDate: '10年以上', cost: '1000元/年', frequency: '每分钟500次' }
];

// 当前项目使用的接口
const projectUsedInterfaces = [
  { api: 'income', name: '利润表', usedByAgents: '利润表分析, 盈利质量分析', description: '获取利润表数据' },
  { api: 'balancesheet', name: '资产负债表', usedByAgents: '资产负债表分析, 风险分析', description: '获取资产负债表数据' },
  { api: 'cashflow', name: '现金流量表', usedByAgents: '现金流量表分析, 盈利质量分析', description: '获取现金流量表数据' },
  { api: 'fina_indicator', name: '财务指标数据', usedByAgents: '利润表分析, 预测分析, 估值分析', description: 'ROE、毛利率、净利率等比率指标' },
  { api: 'fina_mainbz', name: '主营业务构成', usedByAgents: '业务洞察, 业务模式分析', description: '按产品/地区的收入构成' },
  { api: 'forecast', name: '业绩预告', usedByAgents: '预测分析', description: '业绩预告数据' },
  { api: 'express', name: '业绩快报', usedByAgents: '预测分析', description: '业绩快报数据' },
  { api: 'daily_basic', name: '每日指标数据', usedByAgents: '估值分析', description: 'PE/PB/PS/市值等估值指标' }
];

async function generateExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tushare 接口权限分析';
  workbook.created = new Date();

  // ============ Sheet 1: 5000积分权限概览 ============
  const overviewSheet = workbook.addWorksheet('5000积分权限概览');
  
  // 标题
  overviewSheet.mergeCells('A1:F1');
  overviewSheet.getCell('A1').value = 'Tushare 5000积分权限概览';
  overviewSheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  overviewSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  overviewSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  // 权限说明
  const permissionData = [
    ['积分等级', '每分钟频次', '每天总量上限', '可访问接口比例', '备注'],
    ['120分', '50次', '8000次', '~10%', '仅股票非复权日线行情'],
    ['2000分', '200次', '100000次/API', '~60%', '大部分常规数据'],
    ['5000分', '500次', '常规数据无上限', '~90%', '绝大部分API可调取'],
    ['10000分', '1000次', '特色数据300次/分', '95%+', '包含特色数据权限'],
    ['15000分', '1000次', '特色数据无限制', '100%', '完整权限']
  ];
  
  let rowNum = 3;
  permissionData.forEach((row, idx) => {
    const excelRow = overviewSheet.getRow(rowNum + idx);
    row.forEach((cell, colIdx) => {
      excelRow.getCell(colIdx + 1).value = cell;
    });
    if (idx === 0) {
      excelRow.font = { bold: true };
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    }
    if (idx === 3) { // 5000分行高亮
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      excelRow.font = { bold: true };
    }
  });
  
  // 设置列宽
  overviewSheet.columns = [
    { width: 15 }, { width: 15 }, { width: 20 }, { width: 20 }, { width: 40 }
  ];

  // ============ Sheet 2: 当前项目使用接口 ============
  const projectSheet = workbook.addWorksheet('当前项目使用接口');
  
  projectSheet.mergeCells('A1:E1');
  projectSheet.getCell('A1').value = '当前财报分析项目使用的Tushare接口';
  projectSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  projectSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
  projectSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  const projectHeaders = ['API名称', '接口描述', '使用Agent', '数据说明', '最低积分要求'];
  const projectHeaderRow = projectSheet.getRow(3);
  projectHeaders.forEach((header, idx) => {
    projectHeaderRow.getCell(idx + 1).value = header;
  });
  projectHeaderRow.font = { bold: true };
  projectHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  
  projectUsedInterfaces.forEach((item, idx) => {
    const row = projectSheet.getRow(4 + idx);
    row.getCell(1).value = item.api;
    row.getCell(2).value = item.name;
    row.getCell(3).value = item.usedByAgents;
    row.getCell(4).value = item.description;
    row.getCell(5).value = item.api.includes('fina') || item.api === 'forecast' || item.api === 'express' ? '5000分' : '2000分';
  });
  
  projectSheet.columns = [
    { width: 18 }, { width: 18 }, { width: 35 }, { width: 40 }, { width: 15 }
  ];

  // ============ Sheet 3: 5000积分可访问接口完整列表 ============
  const fullListSheet = workbook.addWorksheet('5000积分可访问接口');
  
  fullListSheet.mergeCells('A1:E1');
  fullListSheet.getCell('A1').value = '5000积分可访问的所有接口（约90%的API）';
  fullListSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  fullListSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  fullListSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  const fullListHeaders = ['分类', 'API名称', '接口描述', '最低积分', '更新说明'];
  const fullListHeaderRow = fullListSheet.getRow(3);
  fullListHeaders.forEach((header, idx) => {
    fullListHeaderRow.getCell(idx + 1).value = header;
  });
  fullListHeaderRow.font = { bold: true };
  fullListHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } };
  
  let fullListRowNum = 4;
  Object.entries(allInterfaces).forEach(([category, interfaces]) => {
    interfaces.forEach(item => {
      if (item.minPoints <= 5000) {
        const row = fullListSheet.getRow(fullListRowNum);
        row.getCell(1).value = category;
        row.getCell(2).value = item.api;
        row.getCell(3).value = item.name;
        row.getCell(4).value = `${item.minPoints}分`;
        row.getCell(5).value = item.description;
        
        // 根据积分要求着色
        if (item.minPoints === 5000) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        } else if (item.minPoints >= 4000) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
        }
        fullListRowNum++;
      }
    });
  });
  
  fullListSheet.columns = [
    { width: 15 }, { width: 22 }, { width: 25 }, { width: 12 }, { width: 50 }
  ];

  // ============ Sheet 4: 各分类接口统计 ============
  const statsSheet = workbook.addWorksheet('各分类接口统计');
  
  statsSheet.mergeCells('A1:E1');
  statsSheet.getCell('A1').value = '5000积分各分类接口统计';
  statsSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  statsSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
  statsSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  const statsHeaders = ['分类', '可用接口数', '需5000分接口数', '需2000分接口数', '主要接口'];
  const statsHeaderRow = statsSheet.getRow(3);
  statsHeaders.forEach((header, idx) => {
    statsHeaderRow.getCell(idx + 1).value = header;
  });
  statsHeaderRow.font = { bold: true };
  statsHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2D0F2' } };
  
  let statsRowNum = 4;
  let totalAvailable = 0;
  let total5000 = 0;
  let total2000 = 0;
  
  Object.entries(allInterfaces).forEach(([category, interfaces]) => {
    const available = interfaces.filter(i => i.minPoints <= 5000);
    const need5000 = interfaces.filter(i => i.minPoints === 5000);
    const need2000 = interfaces.filter(i => i.minPoints <= 2000 && i.minPoints > 0);
    
    totalAvailable += available.length;
    total5000 += need5000.length;
    total2000 += need2000.length;
    
    const row = statsSheet.getRow(statsRowNum);
    row.getCell(1).value = category;
    row.getCell(2).value = available.length;
    row.getCell(3).value = need5000.length;
    row.getCell(4).value = need2000.length;
    row.getCell(5).value = available.slice(0, 3).map(i => i.name).join(', ') + (available.length > 3 ? '...' : '');
    statsRowNum++;
  });
  
  // 总计行
  const totalRow = statsSheet.getRow(statsRowNum);
  totalRow.getCell(1).value = '总计';
  totalRow.getCell(2).value = totalAvailable;
  totalRow.getCell(3).value = total5000;
  totalRow.getCell(4).value = total2000;
  totalRow.getCell(5).value = '';
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  
  statsSheet.columns = [
    { width: 15 }, { width: 15 }, { width: 18 }, { width: 18 }, { width: 50 }
  ];

  // ============ Sheet 5: 需要单独付费的接口 ============
  const paidSheet = workbook.addWorksheet('需单独付费接口');
  
  paidSheet.mergeCells('A1:E1');
  paidSheet.getCell('A1').value = '需要单独付费的接口（不在积分范畴内）';
  paidSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  paidSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } };
  paidSheet.getCell('A1').alignment = { horizontal: 'center' };
  
  paidSheet.mergeCells('A2:E2');
  paidSheet.getCell('A2').value = '⚠️ 这些接口需要单独购买，与积分无关';
  paidSheet.getCell('A2').font = { color: { argb: 'FFC00000' } };
  
  const paidHeaders = ['数据类型', '包含数据', '历史起始', '费用', '频次限制'];
  const paidHeaderRow = paidSheet.getRow(4);
  paidHeaders.forEach((header, idx) => {
    paidHeaderRow.getCell(idx + 1).value = header;
  });
  paidHeaderRow.font = { bold: true };
  paidHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
  
  paidInterfaces.forEach((item, idx) => {
    const row = paidSheet.getRow(5 + idx);
    row.getCell(1).value = item.type;
    row.getCell(2).value = item.data;
    row.getCell(3).value = item.startDate;
    row.getCell(4).value = item.cost;
    row.getCell(5).value = item.frequency;
  });
  
  paidSheet.columns = [
    { width: 18 }, { width: 30 }, { width: 18 }, { width: 20 }, { width: 20 }
  ];

  // ============ Sheet 6: 5000分专属接口 ============
  const exclusive5000Sheet = workbook.addWorksheet('5000分专属接口');
  
  exclusive5000Sheet.mergeCells('A1:D1');
  exclusive5000Sheet.getCell('A1').value = '必须达到5000积分才能访问的接口';
  exclusive5000Sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  exclusive5000Sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFED7D31' } };
  exclusive5000Sheet.getCell('A1').alignment = { horizontal: 'center' };
  
  const exclusive5000Headers = ['分类', 'API名称', '接口描述', '说明'];
  const exclusive5000HeaderRow = exclusive5000Sheet.getRow(3);
  exclusive5000Headers.forEach((header, idx) => {
    exclusive5000HeaderRow.getCell(idx + 1).value = header;
  });
  exclusive5000HeaderRow.font = { bold: true };
  exclusive5000HeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE5D6' } };
  
  let exclusive5000RowNum = 4;
  Object.entries(allInterfaces).forEach(([category, interfaces]) => {
    interfaces.filter(i => i.minPoints === 5000).forEach(item => {
      const row = exclusive5000Sheet.getRow(exclusive5000RowNum);
      row.getCell(1).value = category;
      row.getCell(2).value = item.api;
      row.getCell(3).value = item.name;
      row.getCell(4).value = item.description;
      exclusive5000RowNum++;
    });
  });
  
  exclusive5000Sheet.columns = [
    { width: 15 }, { width: 25 }, { width: 25 }, { width: 50 }
  ];

  // 保存文件
  const filePath = '/home/user/webapp/Tushare_5000积分接口权限.xlsx';
  await workbook.xlsx.writeFile(filePath);
  console.log(`Excel文件已生成: ${filePath}`);
  console.log(`总共统计了 ${totalAvailable} 个5000积分可访问的接口`);
  console.log(`其中 ${total5000} 个需要5000积分，${total2000} 个需要2000积分或更低`);
}

generateExcel().catch(console.error);
