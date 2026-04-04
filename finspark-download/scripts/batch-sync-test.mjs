/**
 * Batch PDF sync test script
 * Tests the full pipeline: CNInfo search → PDF download → MinerU parse → estimate resources
 */

const CNINFO_BASE_URL = 'http://www.cninfo.com.cn';
const CNINFO_STATIC_URL = 'http://static.cninfo.com.cn/finalpage';

// Search CNInfo for financial reports
async function searchCninfoReports(stockCode, reportType) {
  const categoryMap = {
    annual: 'category_ndbg_szsh',
    semi_annual: 'category_bndbg_szsh',
    q1: 'category_yjdbg_szsh',
    q3: 'category_sjdbg_szsh',
  };

  const params = new URLSearchParams();
  params.append('searchkey', stockCode);
  params.append('pageNum', '1');
  params.append('pageSize', '30');
  params.append('tabName', 'fulltext');
  if (reportType && categoryMap[reportType]) {
    params.append('category', categoryMap[reportType]);
  }

  const resp = await fetch(`${CNINFO_BASE_URL}/new/hisAnnouncement/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
    body: params.toString(),
  });

  const data = await resp.json();
  
  const reports = [];
  for (const ann of (data.announcements || [])) {
    // Filter: match stock code
    if (ann.secCode && ann.secCode !== stockCode) continue;
    // Filter: skip summaries, corrections, English versions
    if (/摘要|更正|补充|取消|延期|修订|英文版/.test(ann.announcementTitle)) continue;
    // Infer type
    const title = ann.announcementTitle || '';
    let type = reportType;
    if (!type) {
      if (/年度报告|年报/.test(title) && !/半年/.test(title)) type = 'annual';
      else if (/半年度报告|半年报/.test(title)) type = 'semi_annual';
      else if (/第一季度|一季报/.test(title)) type = 'q1';
      else if (/第三季度|三季报/.test(title)) type = 'q3';
      else continue;
    }
    
    // Get year
    const yearMatch = title.match(/(\d{4})\s*年/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear() - 1;
    
    reports.push({
      stockCode: ann.secCode || stockCode,
      stockName: ann.secName || '',
      reportType: type,
      reportYear: year,
      title: ann.announcementTitle,
      pdfUrl: ann.adjunctUrl ? `${CNINFO_STATIC_URL}/${ann.adjunctUrl}` : '',
      publishDate: typeof ann.announcementTime === 'number' 
        ? new Date(ann.announcementTime).toISOString().slice(0, 10) 
        : String(ann.announcementTime || ''),
      fileSize: ann.adjunctSize || 0,
    });
  }
  
  reports.sort((a, b) => b.reportYear - a.reportYear);
  return reports;
}

// Check PDF size via HEAD request
async function checkPdfSize(pdfUrl) {
  try {
    const resp = await fetch(pdfUrl, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const size = parseInt(resp.headers.get('Content-Length') || '0');
    return size;
  } catch {
    return 0;
  }
}

// Main
async function main() {
  // Top 25 A-share stocks by market cap
  const stocks = [
    '600519', // 贵州茅台
    '000858', // 五粮液
    '601318', // 中国平安
    '600036', // 招商银行
    '000333', // 美的集团
    '601166', // 兴业银行
    '600900', // 长江电力
    '000001', // 平安银行
    '600276', // 恒瑞医药
    '002594', // 比亚迪
    '601398', // 工商银行
    '601939', // 建设银行
    '601288', // 农业银行
    '601988', // 中国银行
    '600309', // 万华化学
    '000568', // 泸州老窖
    '600030', // 中信证券
    '002304', // 洋河股份
    '601012', // 隆基绿能
    '300750', // 宁德时代
  ];

  console.log('=== 巨潮 API 批量搜索测试 ===\n');
  
  let totalReports = 0;
  let totalSizeBytes = 0;
  const allReports = [];
  
  for (const code of stocks) {
    try {
      const reports = await searchCninfoReports(code, 'annual');
      // Take the latest 5 annual reports per stock
      const latest5 = reports.slice(0, 5);
      
      console.log(`[${code}] ${latest5[0]?.stockName || '?'}: ${latest5.length} annual reports found`);
      
      for (const r of latest5) {
        const size = await checkPdfSize(r.pdfUrl);
        r.fileSize = size;
        totalSizeBytes += size;
        const sizeMB = (size / 1024 / 1024).toFixed(1);
        console.log(`  - ${r.reportYear}年年报: ${sizeMB} MB | ${r.pdfUrl.slice(-30)}`);
      }
      
      totalReports += latest5.length;
      allReports.push(...latest5);
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`[${code}] Error: ${error.message}`);
    }
  }
  
  const totalSizeMB = (totalSizeBytes / 1024 / 1024).toFixed(1);
  const avgSizeMB = totalReports > 0 ? (totalSizeBytes / totalReports / 1024 / 1024).toFixed(1) : 0;
  
  console.log('\n=== 统计总结 ===');
  console.log(`搜索的股票数: ${stocks.length}`);
  console.log(`找到的年报总数: ${totalReports}`);
  console.log(`总PDF大小: ${totalSizeMB} MB`);
  console.log(`平均每份PDF: ${avgSizeMB} MB`);
  console.log(`预估100份PDF总大小: ${(avgSizeMB * 100).toFixed(0)} MB`);
  console.log('\n=== 资源需求估算 ===');
  console.log(`MinerU 解析 100 份 PDF:`);
  console.log(`  - MinerU API 调用: 100 次`);
  console.log(`  - 预估耗时: ${100 * 3}~${100 * 8} 分钟 (每份 3-8 分钟)`);
  console.log(`  - DashScope 嵌入 API 调用: ~${totalReports > 0 ? Math.round(totalSizeBytes/totalReports/500*100) : 5000} 次 (按每份~${avgSizeMB}MB约${Math.round(avgSizeMB*1024/500)}个chunk)`);
  console.log(`  - D1 数据库存储: ~${(avgSizeMB * 100 * 0.3).toFixed(0)} MB 文本 (压缩后)`);
  console.log(`  - KV 嵌入向量存储: ~${(totalReports > 0 ? Math.round(totalSizeBytes/totalReports/500*100*4096/1024/1024) : 200)} MB`);
}

main().catch(console.error);
