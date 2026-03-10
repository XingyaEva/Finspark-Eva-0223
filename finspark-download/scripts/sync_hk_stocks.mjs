#!/usr/bin/env node
/**
 * Finspark 港股数据同步脚本
 * 
 * 功能：
 * 1. 从 AKShare 代理服务获取港股通成分股列表（约564只）
 * 2. 备选从 Tushare 获取港股数据
 * 3. 自动生成拼音索引
 * 4. 支持本地/生产环境
 * 
 * 使用方法：
 *   node scripts/sync_hk_stocks.mjs [options]
 * 
 * 选项：
 *   --full      全量更新（清空港股后重新导入）
 *   --hot       同时设置热门股票标记
 *   --dry-run   仅输出SQL不执行
 *   --prod      同步到生产环境
 *   --verbose   输出详细日志
 * 
 * 数据源优先级：
 *   1. AKShare 代理服务 (http://47.110.92.210:8000)
 *   2. Tushare API (需要更高积分)
 * 
 * @version 1.0.0
 * @date 2026-01-17
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// 配置
// ============================================

// AKShare 代理服务地址
const AKSHARE_PROXY_URL = process.env.AKSHARE_PROXY_URL || 'http://47.110.92.210:8000';

// Tushare API 配置（备用）
const TUSHARE_API_URL = 'https://tspro.matetrip.cn/dataapi';
const TUSHARE_TOKEN = '788627836620509184';

// 数据库配置
const DB_NAME = 'genspark-financial-db';

// 输出目录
const OUTPUT_DIR = join(__dirname, '../data');

// 港股热门股票列表
const HOT_STOCKS_HK = [
  '00700', '09988', '03690', '09618', '01024', '02318', '00941', '01810', '09999', '02020',
  '00005', '00388', '00001', '00016', '00883', '00939', '01299', '00027', '02628', '03988',
  '00669', '09888', '00981', '02382', '01211', '00175', '02269', '01177', '00288', '01928',
  '09961', '01898', '02899', '06098', '09626', '01378', '02015', '06618', '03968', '06060',
];

// ============================================
// 完整的汉字-拼音映射表
// ============================================

const PINYIN_MAP = {
  // 港股常用字
  '腾': 'teng', '讯': 'xun', '阿': 'a', '里': 'li', '巴': 'ba', '美': 'mei', '团': 'tuan',
  '京': 'jing', '东': 'dong', '小': 'xiao', '米': 'mi', '百': 'bai', '度': 'du', '网': 'wang', '易': 'yi',
  '拼': 'pin', '多': 'duo', '快': 'kuai', '手': 'shou', '哔': 'bi', '哩': 'li', '携': 'xie', '程': 'cheng',
  '贝': 'bei', '壳': 'ke', '知': 'zhi', '乎': 'hu', '微': 'wei', '博': 'bo', '唯': 'wei', '品': 'pin',
  '会': 'hui', '联': 'lian', '通': 'tong', '移': 'yi', '动': 'dong', '石': 'shi', '药': 'yao', '商': 'shang',
  '吉': 'ji', '利': 'li', '蔚': 'wei', '来': 'lai', '理': 'li', '想': 'xiang', '鹏': 'peng', '汽': 'qi',
  '长': 'chang', '城': 'cheng', '车': 'che', '风': 'feng', '集': 'ji',
  '建': 'jian', '银': 'yin', '农': 'nong', '工': 'gong', '邮': 'you', '储': 'chu',
  '太': 'tai', '平': 'ping', '洋': 'yang', '友': 'you', '邦': 'bang', '新': 'xin', '华': 'hua',
  '中': 'zhong', '国': 'guo', '安': 'an', '保': 'bao', '险': 'xian', '茂': 'mao',
  '比': 'bi', '亚': 'ya', '迪': 'di', '德': 'de', '时': 'shi', '代': 'dai', '天': 'tian', '齐': 'qi',
  '锂': 'li', '赣': 'gan', '锋': 'feng', '威': 'wei', '隆': 'long', '基': 'ji', '绿': 'lv',
  '能': 'neng', '阳': 'yang', '源': 'yuan', '环': 'huan', '莱': 'lai', '特': 'te',
  '电': 'dian', '科': 'ke', '技': 'ji', '蓝': 'lan', '谷': 'gu', '广': 'guang',
  '赛': 'sai', '力': 'li', '斯': 'si', '融': 'rong', '捷': 'jie',
  '明': 'ming', '康': 'kang', '云': 'yun', '恒': 'heng', '瑞': 'rui', '迈': 'mai',
  '医': 'yi', '疗': 'liao', '春': 'chun', '高': 'gao', '片': 'pian', '仔': 'zi', '癀': 'huang',
  '智': 'zhi', '飞': 'fei', '凯': 'kai', '英': 'ying', '泰': 'tai', '格': 'ge', '宝': 'bao',
  '和': 'he', '成': 'cheng', '爱': 'ai', '尔': 'er', '眼': 'yan', '乐': 'le', '普': 'pu',
  '海': 'hai', '芯': 'xin', '际': 'ji', '韦': 'wei', '股': 'gu', '份': 'fen',
  '控': 'kong', '港': 'gang', '股': 'gu', '信': 'xin', '达': 'da',
  '人': 'ren', '寿': 'shou', '生': 'sheng', '民': 'min', '兴': 'xing', '招': 'zhao',
  '地': 'di', '产': 'chan', '房': 'fang', '万': 'wan', '碧': 'bi', '桂': 'gui', '园': 'yuan',
  '金': 'jin', '融': 'rong', '投': 'tou', '资': 'zi', '证': 'zheng', '券': 'quan',
  '半': 'ban', '导': 'dao', '体': 'ti', '元': 'yuan', '封': 'feng', '测': 'ce', '试': 'shi',
  '网': 'wang', '络': 'luo', '游': 'you', '戏': 'xi', '娱': 'yu',
  '食': 'shi', '饮': 'yin', '料': 'liao', '酒': 'jiu', '啤': 'pi', '白': 'bai', '红': 'hong',
  '服': 'fu', '装': 'zhuang', '纺': 'fang', '织': 'zhi', '皮': 'pi', '革': 'ge',
  '物': 'wu', '流': 'liu', '运': 'yun', '输': 'shu', '航': 'hang', '空': 'kong',
  '零': 'ling', '售': 'shou', '超': 'chao', '市': 'shi', '便': 'bian', '店': 'dian',
  '教': 'jiao', '育': 'yu', '培': 'pei', '训': 'xun', '学': 'xue', '校': 'xiao',
  '酒': 'jiu', '店': 'dian', '旅': 'lv', '馆': 'guan', '度': 'du', '假': 'jia',
  '传': 'chuan', '媒': 'mei', '视': 'shi', '频': 'pin', '音': 'yin', '乐': 'yue',
  '材': 'cai', '料': 'liao', '钢': 'gang', '铁': 'tie', '铝': 'lv', '铜': 'tong',
  '化': 'hua', '学': 'xue', '塑': 'su', '橡': 'xiang', '胶': 'jiao',
  '机': 'ji', '械': 'xie', '设': 'she', '备': 'bei', '仪': 'yi', '器': 'qi',
  '电': 'dian', '子': 'zi', '元': 'yuan', '件': 'jian', '芯': 'xin', '片': 'pian',
  '软': 'ruan', '件': 'jian', '系': 'xi', '统': 'tong', '服': 'fu', '务': 'wu',
  '数': 'shu', '据': 'ju', '中': 'zhong', '心': 'xin', '算': 'suan',
  '光': 'guang', '伏': 'fu', '风': 'feng', '电': 'dian', '水': 'shui', '核': 'he',
  '煤': 'mei', '炭': 'tan', '油': 'you', '气': 'qi', '矿': 'kuang',
  '纸': 'zhi', '包': 'bao', '印': 'yin', '刷': 'shua',
  '建': 'jian', '筑': 'zhu', '工': 'gong', '程': 'cheng', '装': 'zhuang', '饰': 'shi',
  '农': 'nong', '林': 'lin', '牧': 'mu', '渔': 'yu', '种': 'zhong', '养': 'yang',
  '线': 'xian', '上': 'shang', '下': 'xia', '前': 'qian', '后': 'hou',
  '大': 'da', '小': 'xiao', '正': 'zheng', '负': 'fu', '好': 'hao', '坏': 'huai',
  '狮': 'shi', '虎': 'hu', '龙': 'long', '凤': 'feng', '鹰': 'ying', '雀': 'que',
  '山': 'shan', '河': 'he', '湖': 'hu', '江': 'jiang', '海': 'hai', '洋': 'yang',
  '峰': 'feng', '岭': 'ling', '谷': 'gu', '坡': 'po', '岸': 'an', '滩': 'tan',
  '北': 'bei', '南': 'nan', '西': 'xi', '东': 'dong', '左': 'zuo', '右': 'you',
  '春': 'chun', '夏': 'xia', '秋': 'qiu', '冬': 'dong', '年': 'nian', '月': 'yue', '日': 'ri',
  '红': 'hong', '黄': 'huang', '蓝': 'lan', '绿': 'lv', '紫': 'zi', '黑': 'hei', '白': 'bai',
  '金': 'jin', '银': 'yin', '铜': 'tong', '铁': 'tie', '玉': 'yu', '珠': 'zhu',
  '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu', '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
  '百': 'bai', '千': 'qian', '万': 'wan', '亿': 'yi',
  '的': 'de', '是': 'shi', '有': 'you', '不': 'bu', '了': 'le', '在': 'zai', '与': 'yu',
  '这': 'zhe', '它': 'ta', '们': 'men', '我': 'wo', '你': 'ni', '他': 'ta', '她': 'ta',
  '出': 'chu', '入': 'ru', '开': 'kai', '关': 'guan', '起': 'qi', '止': 'zhi',
  '先': 'xian', '进': 'jin', '退': 'tui', '行': 'xing', '走': 'zou', '跑': 'pao',
  '曹': 'cao', '操': 'cao', '相': 'xiang', '逢': 'feng', '峰': 'feng', '泉': 'quan',
  '耐': 'nai', '林': 'lin', '虹': 'hong', '岳': 'yue', '行': 'hang',
  '众': 'zhong', '创': 'chuang', '业': 'ye', '启': 'qi',
};

// ============================================
// 工具函数
// ============================================

const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
};

function log(message, type = 'info') {
  const prefix = {
    info: colors.cyan('[HK-SYNC]'),
    success: colors.green('[HK-SYNC]'),
    warn: colors.yellow('[HK-SYNC]'),
    error: colors.red('[HK-SYNC]'),
    verbose: colors.dim('[HK-SYNC]'),
  };
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

/**
 * 汉字转拼音
 */
function toPinyin(text) {
  if (!text) return { pinyin: '', abbr: '' };
  
  let pinyin = '';
  let abbr = '';
  
  for (const char of text) {
    if (PINYIN_MAP[char]) {
      pinyin += PINYIN_MAP[char];
      abbr += PINYIN_MAP[char][0];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      pinyin += char.toLowerCase();
      abbr += char.toLowerCase();
    } else if (/[\u4e00-\u9fa5]/.test(char)) {
      pinyin += '?';
      abbr += '?';
    }
  }
  
  return { pinyin, abbr };
}

/**
 * SQL 字符串转义
 */
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// ============================================
// 从 AKShare 代理获取港股数据
// ============================================

async function fetchHKStocksFromAkshare() {
  log(`从 AKShare 代理服务获取港股通成分股...`);
  log(`代理地址: ${AKSHARE_PROXY_URL}`);
  
  try {
    const response = await fetch(`${AKSHARE_PROXY_URL}/hk/stock_list`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    const stocks = result.data.map(s => ({
      ts_code: s.ts_code,
      symbol: s.symbol,
      name: s.name,
      area: '香港',
      industry: '港股',
      market: '港股主板',
      exchange: 'HKEX',
      list_date: '',
      list_status: 'L',
      stock_type: 'HK',
      hk_stock_connect: 1,  // 港股通
    }));

    log(`✅ 从 AKShare 获取 ${stocks.length} 只港股通成分股`, 'success');
    return stocks;
    
  } catch (error) {
    log(`从 AKShare 获取失败: ${error.message}`, 'error');
    return null;
  }
}

// ============================================
// 从 Tushare 获取港股数据（备用）
// ============================================

async function fetchHKStocksFromTushare() {
  log('尝试从 Tushare 获取港股数据（备用方案）...');
  
  try {
    const response = await fetch(TUSHARE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_name: 'hk_basic',
        token: TUSHARE_TOKEN,
        params: { list_status: 'L' },
        fields: 'ts_code,name,area,industry,market,list_date,list_status,enname',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || 'Tushare API error');
    }

    if (!result.data || !result.data.items) {
      return [];
    }

    const stocks = result.data.items.map(item => {
      const obj = {};
      result.data.fields.forEach((field, index) => {
        obj[field] = item[index];
      });
      
      return {
        ts_code: obj.ts_code,
        symbol: obj.ts_code ? obj.ts_code.replace('.HK', '') : '',
        name: obj.name,
        area: obj.area || '香港',
        industry: obj.industry || '港股',
        market: obj.market || '港股主板',
        exchange: 'HKEX',
        list_date: obj.list_date,
        list_status: obj.list_status || 'L',
        stock_type: 'HK',
        hk_stock_connect: 0,
      };
    });

    log(`✅ 从 Tushare 获取 ${stocks.length} 只港股`, 'success');
    return stocks;
    
  } catch (error) {
    log(`从 Tushare 获取失败: ${error.message}`, 'error');
    log('提示: 港股数据需要更高的 Tushare 积分权限', 'warn');
    return [];
  }
}

// ============================================
// 获取港股数据（优先 AKShare，备选 Tushare）
// ============================================

async function fetchHKStocks() {
  log('开始获取港股数据...');
  
  // 1. 优先从 AKShare 获取
  let stocks = await fetchHKStocksFromAkshare();
  
  // 2. 如果 AKShare 失败，尝试 Tushare
  if (!stocks || stocks.length === 0) {
    log('AKShare 获取失败，尝试 Tushare...', 'warn');
    stocks = await fetchHKStocksFromTushare();
  }
  
  if (!stocks || stocks.length === 0) {
    log('⚠️ 无法获取港股数据', 'error');
    return [];
  }
  
  log(`港股总计: ${stocks.length} 只`, 'success');
  return stocks;
}

// ============================================
// 生成 SQL
// ============================================

function generateSQL(stocks, options = {}) {
  const { fullUpdate = false, setHotStocks = true, verbose = false } = options;
  
  const lines = [];
  const timestamp = new Date().toISOString();
  
  const stats = {
    total: stocks.length,
    hot: 0,
    missingPinyin: 0,
  };
  
  lines.push('-- =====================================================================');
  lines.push('-- Finspark 港股数据 - 自动生成');
  lines.push(`-- 生成时间: ${timestamp}`);
  lines.push(`-- 数据统计: 港股 ${stats.total} 只`);
  lines.push('-- 同步脚本: scripts/sync_hk_stocks.mjs');
  lines.push('-- 数据来源: AKShare (东方财富) 港股通成分股');
  lines.push('-- =====================================================================');
  lines.push('');
  
  if (fullUpdate) {
    lines.push('-- 全量更新模式：清空港股数据');
    lines.push("DELETE FROM stocks WHERE stock_type = 'HK';");
    lines.push('');
  }
  
  lines.push('-- 开始插入港股数据');
  lines.push('');
  
  const hotStocksSet = new Set(HOT_STOCKS_HK);
  
  const batchSize = 50;
  let batchNum = 0;
  
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    batchNum++;
    
    lines.push(`-- 批次 ${batchNum}/${Math.ceil(stocks.length / batchSize)} (${i + 1} - ${Math.min(i + batchSize, stocks.length)})`);
    
    for (const stock of batch) {
      const { pinyin, abbr } = toPinyin(stock.name);
      const isHot = hotStocksSet.has(stock.symbol) ? 1 : 0;
      const hkConnect = stock.hk_stock_connect || 0;
      
      if (isHot) stats.hot++;
      if (pinyin.includes('?')) stats.missingPinyin++;
      
      const sql = `INSERT OR REPLACE INTO stocks (ts_code, symbol, name, area, industry, market, exchange, list_date, list_status, stock_type, pinyin, pinyin_abbr, is_hot, hk_stock_connect) VALUES (${escapeSql(stock.ts_code)}, ${escapeSql(stock.symbol)}, ${escapeSql(stock.name)}, ${escapeSql(stock.area)}, ${escapeSql(stock.industry)}, ${escapeSql(stock.market)}, ${escapeSql(stock.exchange)}, ${escapeSql(stock.list_date)}, ${escapeSql(stock.list_status)}, ${escapeSql(stock.stock_type)}, ${escapeSql(pinyin)}, ${escapeSql(abbr)}, ${isHot}, ${hkConnect});`;
      lines.push(sql);
    }
    
    lines.push('');
  }
  
  if (setHotStocks) {
    lines.push('-- 确保港股热门股票标记正确');
    lines.push(`UPDATE stocks SET is_hot = 1 WHERE symbol IN (${HOT_STOCKS_HK.map(s => escapeSql(s)).join(', ')}) AND stock_type = 'HK';`);
    lines.push('');
  }
  
  // 重建 FTS 索引
  lines.push('-- 重建 FTS 全文搜索索引（包含港股）');
  lines.push('DELETE FROM stocks_fts;');
  lines.push('INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)');
  lines.push("SELECT id, name, symbol, ts_code, industry, COALESCE(pinyin, ''), COALESCE(pinyin_abbr, '') FROM stocks WHERE list_status = 'L';");
  lines.push('');
  
  lines.push('-- =====================================================================');
  lines.push('-- 同步完成统计');
  lines.push(`-- 港股: ${stats.total} 只`);
  lines.push(`-- 热门: ${stats.hot} 只`);
  lines.push(`-- 拼音缺失: ${stats.missingPinyin} 只`);
  lines.push('-- =====================================================================');
  
  return { sql: lines.join('\n'), stats };
}

// ============================================
// 执行 SQL
// ============================================

function executeSQL(sql, options = {}) {
  const { dryRun = false, prod = false, verbose = false } = options;
  
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const sqlFile = join(OUTPUT_DIR, 'hk_stocks.sql');
  writeFileSync(sqlFile, sql);
  log(`SQL 文件已保存: ${sqlFile}`, 'success');
  
  if (dryRun) {
    log('Dry-run 模式，跳过数据库执行', 'warn');
    if (verbose) {
      console.log('\n--- SQL 预览 (前50行) ---');
      console.log(sql.split('\n').slice(0, 50).join('\n'));
      console.log('... (更多内容请查看 SQL 文件)');
    }
    return;
  }
  
  const envFlag = prod ? '--remote' : '--local';
  log(`执行 SQL 导入 (${prod ? '生产环境' : '本地环境'})...`);
  
  const lines = sql.split('\n').filter(line => 
    line.trim() && !line.trim().startsWith('--')
  );
  
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = lines.slice(i, i + BATCH_SIZE);
    const batchSql = batch.join('\n');
    
    const tempFile = join(OUTPUT_DIR, `hk_batch_${batchNum}.sql`);
    writeFileSync(tempFile, batchSql);
    
    try {
      execSync(`npx wrangler d1 execute ${DB_NAME} ${envFlag} --file=${tempFile}`, {
        stdio: 'pipe',
        cwd: join(__dirname, '..'),
        maxBuffer: 50 * 1024 * 1024,
      });
      successCount += batch.length;
      
      const progress = Math.round((batchNum / totalBatches) * 100);
      process.stdout.write(`\r[HK-SYNC] 进度: ${progress}% (批次 ${batchNum}/${totalBatches})`);
      
    } catch (error) {
      errorCount++;
      if (verbose) {
        log(`批次 ${batchNum} 失败: ${error.message}`, 'warn');
      }
    }
    
    try {
      require('fs').unlinkSync(tempFile);
    } catch (e) {}
  }
  
  console.log('');
  log(`SQL 执行完成: 成功 ${successCount} 条, 失败 ${errorCount} 批次`, 'success');
}

// ============================================
// 主程序
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const options = {
    fullUpdate: args.includes('--full'),
    setHotStocks: args.includes('--hot') || !args.includes('--no-hot'),
    dryRun: args.includes('--dry-run'),
    prod: args.includes('--prod'),
    verbose: args.includes('--verbose'),
  };

  console.log('');
  console.log(colors.bold('================================================'));
  console.log(colors.bold('  Finspark 港股数据同步工具 v1.0.0'));
  console.log(colors.bold('================================================'));
  console.log('');
  console.log(`  数据源: AKShare (优先) / Tushare (备用)`);
  console.log(`  代理地址: ${AKSHARE_PROXY_URL}`);
  console.log(`  环境: ${options.prod ? '生产环境' : '本地环境'}`);
  console.log(`  模式: ${options.fullUpdate ? '全量更新' : '增量更新'}`);
  console.log(`  热门标记: ${options.setHotStocks ? '是' : '否'}`);
  console.log(`  Dry-run: ${options.dryRun ? '是' : '否'}`);
  console.log('');
  
  try {
    // 1. 获取港股数据
    const stocks = await fetchHKStocks();
    
    if (stocks.length === 0) {
      log('没有获取到港股数据，退出', 'error');
      process.exit(1);
    }
    
    // 2. 生成 SQL
    log('生成 SQL 语句...');
    const { sql, stats } = generateSQL(stocks, options);
    
    console.log('');
    console.log(colors.bold('📊 数据统计:'));
    console.log(`   港股总数: ${stats.total} 只`);
    console.log(`   热门股票: ${stats.hot} 只`);
    console.log(`   拼音缺失: ${stats.missingPinyin} 只`);
    console.log('');
    
    // 3. 执行 SQL
    executeSQL(sql, options);
    
    console.log('');
    log('🎉 港股数据同步完成!', 'success');
    console.log('');
    console.log('  后续步骤:');
    console.log('  1. 运行 npm run dev 启动开发服务器');
    console.log('  2. 搜索测试: 00700 (腾讯), 09988 (阿里巴巴)');
    console.log('  3. 若需同步到生产环境: node scripts/sync_hk_stocks.mjs --prod');
    console.log('');
    
  } catch (error) {
    log(`同步失败: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

main();
