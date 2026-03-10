#!/usr/bin/env node
/**
 * Finspark 投资分析 - A股全量 + 港股数据同步脚本
 * 
 * 功能：
 * 1. 从 Tushare 同步全部 A 股上市公司数据（约5000家）
 * 2. 从 Tushare 同步港股数据（约2500家）
 * 3. 支持增量更新和全量更新
 * 4. 自动生成拼音索引
 * 5. 支持本地/生产环境
 * 
 * 使用方法：
 *   node scripts/sync_all_stocks.mjs [options]
 * 
 * 选项：
 *   --full      全量更新（清空后重新导入）
 *   --a-stock   仅同步A股
 *   --hk-stock  仅同步港股
 *   --hot       同时设置热门股票标记
 *   --dry-run   仅输出SQL不执行
 *   --prod      同步到生产环境
 *   --verbose   输出详细日志
 * 
 * @version 2.0.0
 * @date 2026-01-12
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// 配置
// ============================================

// Tushare API 配置
const TUSHARE_API_URL = 'https://tspro.matetrip.cn/dataapi';  // 中转站（5000积分）
const TUSHARE_TOKEN = '788627836620509184';

// 数据库配置
const DB_NAME = 'genspark-financial-db';

// 输出目录
const OUTPUT_DIR = join(__dirname, '../data');

// 热门股票列表（代码）- A股和港股
const HOT_STOCKS_A = [
  // 白酒龙头
  '600519', '000858', '000568', '002304', '600809', '000596',
  // 银行股
  '601398', '601939', '601288', '601988', '600036', '000001', '601166', '002142', '600000',
  // 保险
  '601318', '601628', '601601',
  // 新能源
  '002594', '300750', '002466', '002460', '600438', '601012', '300274', '601127', '002129',
  // 医药
  '603259', '000538', '600276', '300760', '000661', '600436', '300122', '300015', '000963',
  // 科技
  '000063', '002230', '002415', '688981', '688012', '603501', '300124', '002475', '688036',
  // 消费
  '000333', '000651', '600887', '603288', '002714', '600690', '600887', '000568',
  // 地产/基建
  '000002', '600048', '601668', '601390', '601186', '600031',
  // 其他龙头
  '600900', '601857', '600028', '601088', '600104', '600585', '000725', '601899', '600309',
  // 半导体
  '688981', '688012', '002371', '603986', '600460', '688008', '002049',
];

const HOT_STOCKS_HK = [
  // 港股热门
  '00700', '09988', '03690', '09618', '01024', '02318', '00941', '01810', '09999', '02020',
  '00005', '00388', '00001', '00016', '00883', '00939', '01299', '00027', '02628', '03988',
  '00669', '09888', '00981', '02382', '01211', '00175', '02269', '01177', '00288', '01928',
];

// ============================================
// 完整的汉字-拼音映射表
// ============================================

const PINYIN_MAP = {
  // 基本汉字拼音映射（约2000常用字）
  // 以下是常见公司名称用字
  '贵': 'gui', '州': 'zhou', '茅': 'mao', '台': 'tai', '五': 'wu', '粮': 'liang', '液': 'ye',
  '泸': 'lu', '老': 'lao', '窖': 'jiao', '洋': 'yang', '河': 'he', '股': 'gu', '份': 'fen',
  '山': 'shan', '西': 'xi', '汾': 'fen', '酒': 'jiu', '今': 'jin', '世': 'shi', '缘': 'yuan',
  '水': 'shui', '井': 'jing', '坊': 'fang', '鬼': 'gui', '白': 'bai', '干': 'gan',
  '中': 'zhong', '国': 'guo', '平': 'ping', '安': 'an', '工': 'gong', '商': 'shang', '银': 'yin', '行': 'hang',
  '建': 'jian', '设': 'she', '农': 'nong', '业': 'ye', '招': 'zhao', '兴': 'xing', '民': 'min', '生': 'sheng',
  '光': 'guang', '大': 'da', '浦': 'pu', '发': 'fa', '宁': 'ning', '波': 'bo', '南': 'nan', '京': 'jing',
  '华': 'hua', '夏': 'xia', '北': 'bei',
  '人': 'ren', '寿': 'shou', '太': 'tai', '保': 'bao', '新': 'xin', '险': 'xian', '茂': 'mao',
  '比': 'bi', '亚': 'ya', '迪': 'di', '德': 'de', '时': 'shi', '代': 'dai', '天': 'tian', '齐': 'qi',
  '锂': 'li', '赣': 'gan', '锋': 'feng', '通': 'tong', '威': 'wei', '隆': 'long', '基': 'ji', '绿': 'lv',
  '能': 'neng', '阳': 'yang', '源': 'yuan', '环': 'huan', '莱': 'lai', '特': 'te', '长': 'chang',
  '电': 'dian', '科': 'ke', '技': 'ji', '蓝': 'lan', '谷': 'gu', '广': 'guang', '汽': 'qi', '车': 'che',
  '赛': 'sai', '力': 'li', '斯': 'si', '融': 'rong', '捷': 'jie',
  '药': 'yao', '明': 'ming', '康': 'kang', '云': 'yun', '恒': 'heng', '瑞': 'rui', '迈': 'mai',
  '医': 'yi', '疗': 'liao', '春': 'chun', '高': 'gao', '片': 'pian', '仔': 'zi', '癀': 'huang',
  '智': 'zhi', '飞': 'fei', '凯': 'kai', '英': 'ying', '泰': 'tai', '格': 'ge', '东': 'dong', '宝': 'bao',
  '和': 'he', '成': 'cheng', '爱': 'ai', '尔': 'er', '眼': 'yan', '乐': 'le', '普': 'pu',
  '讯': 'xun', '海': 'hai', '芯': 'xin', '际': 'ji', '韦': 'wei', '股': 'gu',
  '联': 'lian', '想': 'xiang', '阿': 'a', '里': 'li', '巴': 'ba', '美': 'mei', '团': 'tuan',
  '小': 'xiao', '米': 'mi', '百': 'bai', '度': 'du', '字': 'zi', '节': 'jie', '跳': 'tiao', '动': 'dong',
  '网': 'wang', '易': 'yi', '集': 'ji', '控': 'kong', '腾': 'teng',
  '的': 'de', '为': 'wei', '是': 'shi', '有': 'you', '不': 'bu', '了': 'le', '在': 'zai', '与': 'yu',
  '这': 'zhe', '上': 'shang', '下': 'xia', '它': 'ta', '们': 'men', '我': 'wo', '你': 'ni', '他': 'ta',
  '她': 'ta', '着': 'zhe', '个': 'ge', '到': 'dao', '说': 'shuo', '来': 'lai', '去': 'qu',
  '美': 'mei', '格': 'ge', '器': 'qi', '伊': 'yi', '利': 'li', '乳': 'ru', '蒙': 'meng', '牛': 'niu',
  '万': 'wan', '碧': 'bi', '桂': 'gui', '园': 'yuan', '房': 'fang', '产': 'chan',
  '石': 'shi', '油': 'you', '化': 'hua', '煤': 'mei', '炭': 'tan', '钢': 'gang', '铁': 'tie',
  '色': 'se', '金': 'jin', '属': 'shu', '证': 'zheng', '券': 'quan', '期': 'qi', '货': 'huo',
  '基': 'ji', '信': 'xin', '托': 'tuo', '租': 'zu', '赁': 'lin',
  '食': 'shi', '品': 'pin', '饮': 'yin', '料': 'liao', '服': 'fu', '装': 'zhuang', '纺': 'fang', '织': 'zhi',
  '零': 'ling', '售': 'shou', '店': 'dian', '餐': 'can', '旅': 'lv', '游': 'you',
  '传': 'chuan', '媒': 'mei', '互': 'hu', '软': 'ruan', '件': 'jian', '硬': 'ying',
  '半': 'ban', '导': 'dao', '体': 'ti', '元': 'yuan', '封': 'feng', '测': 'ce', '试': 'shi',
  '备': 'bei', '材': 'cai', '境': 'jing', '务': 'wu', '公': 'gong', '用': 'yong', '事': 'shi',
  '交': 'jiao', '运': 'yun', '输': 'shu', '航': 'hang', '空': 'kong', '港': 'gang', '口': 'kou',
  '物': 'wu', '流': 'liu', '快': 'kuai', '递': 'di', '教': 'jiao', '育': 'yu', '文': 'wen',
  '娱': 'yu', '戏': 'xi', '影': 'ying', '院': 'yuan', '出': 'chu', '版': 'ban', '告': 'gao',
  '营': 'ying', '销': 'xiao', '咨': 'zi', '询': 'xun', '资': 'zi', '综': 'zong', '合': 'he',
  '多': 'duo', '投': 'tou', '实': 'shi', '创': 'chuang',
  '徽': 'hui', '苏': 'su', '浙': 'zhe', '四': 'si', '川': 'chuan', '重': 'chong', '庆': 'qing',
  '湖': 'hu', '陕': 'shan', '福': 'fu', '粤': 'yue', '甘': 'gan', '皖': 'wan', '冀': 'ji', '豫': 'yu',
  '鲁': 'lu', '津': 'jin', '辽': 'liao', '吉': 'ji', '黑': 'hei', '蒙': 'meng',
  '深': 'shen', '圳': 'zhen', '珠': 'zhu', '杭': 'hang', '州': 'zhou', '苏': 'su', '宁': 'ning',
  '无': 'wu', '锡': 'xi', '常': 'chang', '昆': 'kun', '沪': 'hu',
  '整': 'zheng', '零': 'ling', '部': 'bu', '厂': 'chang', '机': 'ji', '械': 'xie',
  '红': 'hong', '蓝': 'lan', '黄': 'huang', '绿': 'lv', '青': 'qing', '紫': 'zi', '黑': 'hei', '白': 'bai',
  '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu', '六': 'liu', '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi',
  '百': 'bai', '千': 'qian', '万': 'wan', '亿': 'yi',
  '正': 'zheng', '邦': 'bang', '泰': 'tai', '达': 'da', '康': 'kang', '永': 'yong', '久': 'jiu', '瑞': 'rui',
  '祥': 'xiang', '福': 'fu', '庆': 'qing', '喜': 'xi', '吉': 'ji', '利': 'li', '顺': 'shun', '丰': 'feng',
  '富': 'fu', '贵': 'gui', '荣': 'rong', '华': 'hua', '盛': 'sheng', '昌': 'chang', '旺': 'wang',
  '鑫': 'xin', '源': 'yuan', '汇': 'hui', '聚': 'ju', '博': 'bo', '众': 'zhong', '达': 'da', '成': 'cheng',
  '志': 'zhi', '远': 'yuan', '卓': 'zhuo', '越': 'yue', '超': 'chao', '凡': 'fan', '非': 'fei',
  '雅': 'ya', '典': 'dian', '精': 'jing', '致': 'zhi', '尚': 'shang', '悦': 'yue', '优': 'you', '品': 'pin',
  '嘉': 'jia', '佳': 'jia', '好': 'hao', '美': 'mei', '善': 'shan', '良': 'liang', '真': 'zhen', '诚': 'cheng',
  '恩': 'en', '德': 'de', '惠': 'hui', '泽': 'ze', '润': 'run', '清': 'qing', '明': 'ming', '亮': 'liang',
  '星': 'xing', '辰': 'chen', '日': 'ri', '月': 'yue', '风': 'feng', '云': 'yun', '雨': 'yu', '雪': 'xue',
  '龙': 'long', '虎': 'hu', '凤': 'feng', '麒': 'qi', '麟': 'lin', '豹': 'bao', '狮': 'shi', '鹰': 'ying',
  '鹏': 'peng', '雁': 'yan', '鸿': 'hong', '翔': 'xiang', '飞': 'fei', '翼': 'yi', '羽': 'yu',
  '森': 'sen', '林': 'lin', '木': 'mu', '树': 'shu', '花': 'hua', '草': 'cao', '叶': 'ye', '竹': 'zhu',
  '松': 'song', '柏': 'bai', '梅': 'mei', '兰': 'lan', '菊': 'ju', '荷': 'he', '莲': 'lian',
  '江': 'jiang', '河': 'he', '湖': 'hu', '海': 'hai', '洋': 'yang', '溪': 'xi', '泉': 'quan', '潭': 'tan',
  '峰': 'feng', '岭': 'ling', '山': 'shan', '岳': 'yue', '崖': 'ya', '岩': 'yan', '石': 'shi',
  '东': 'dong', '西': 'xi', '南': 'nan', '北': 'bei', '中': 'zhong', '前': 'qian', '后': 'hou', '左': 'zuo', '右': 'you',
  '里': 'li', '外': 'wai', '内': 'nei', '边': 'bian', '旁': 'pang', '间': 'jian', '处': 'chu', '所': 'suo',
  '家': 'jia', '屋': 'wu', '楼': 'lou', '厦': 'sha', '城': 'cheng', '镇': 'zhen', '村': 'cun', '乡': 'xiang',
  '国': 'guo', '省': 'sheng', '市': 'shi', '县': 'xian', '区': 'qu', '街': 'jie', '道': 'dao', '路': 'lu',
  '门': 'men', '窗': 'chuang', '桥': 'qiao', '塔': 'ta', '亭': 'ting', '台': 'tai', '阁': 'ge', '殿': 'dian',
  '春': 'chun', '夏': 'xia', '秋': 'qiu', '冬': 'dong', '年': 'nian', '月': 'yue', '日': 'ri', '时': 'shi',
  '分': 'fen', '秒': 'miao', '刻': 'ke', '早': 'zao', '晚': 'wan', '晨': 'chen', '暮': 'mu', '午': 'wu',
  '今': 'jin', '昨': 'zuo', '明': 'ming', '古': 'gu', '现': 'xian', '新': 'xin', '旧': 'jiu', '先': 'xian',
  '后': 'hou', '始': 'shi', '终': 'zhong', '初': 'chu', '末': 'mo', '起': 'qi', '止': 'zhi', '开': 'kai', '关': 'guan',
  '大': 'da', '小': 'xiao', '长': 'chang', '短': 'duan', '高': 'gao', '低': 'di', '深': 'shen', '浅': 'qian',
  '宽': 'kuan', '窄': 'zhai', '厚': 'hou', '薄': 'bao', '重': 'zhong', '轻': 'qing', '快': 'kuai', '慢': 'man',
  '男': 'nan', '女': 'nv', '老': 'lao', '少': 'shao', '幼': 'you', '青': 'qing', '壮': 'zhuang', '弱': 'ruo',
  '强': 'qiang', '健': 'jian', '康': 'kang', '病': 'bing', '伤': 'shang', '死': 'si', '生': 'sheng', '活': 'huo',
  '心': 'xin', '脑': 'nao', '眼': 'yan', '耳': 'er', '口': 'kou', '鼻': 'bi', '手': 'shou', '脚': 'jiao',
  '头': 'tou', '身': 'shen', '血': 'xue', '肉': 'rou', '骨': 'gu', '皮': 'pi', '毛': 'mao', '发': 'fa',
  '父': 'fu', '母': 'mu', '子': 'zi', '女': 'nv', '兄': 'xiong', '弟': 'di', '姐': 'jie', '妹': 'mei',
  '夫': 'fu', '妻': 'qi', '友': 'you', '敌': 'di', '师': 'shi', '徒': 'tu', '官': 'guan', '兵': 'bing',
  '王': 'wang', '皇': 'huang', '帝': 'di', '君': 'jun', '臣': 'chen', '将': 'jiang', '相': 'xiang', '士': 'shi',
  '言': 'yan', '语': 'yu', '话': 'hua', '字': 'zi', '文': 'wen', '章': 'zhang', '书': 'shu', '画': 'hua',
  '诗': 'shi', '词': 'ci', '歌': 'ge', '曲': 'qu', '乐': 'yue', '舞': 'wu', '戏': 'xi', '剧': 'ju',
  '工': 'gong', '农': 'nong', '商': 'shang', '学': 'xue', '兵': 'bing', '政': 'zheng', '法': 'fa', '医': 'yi',
  '理': 'li', '数': 'shu', '物': 'wu', '化': 'hua', '生': 'sheng', '地': 'di', '史': 'shi', '哲': 'zhe',
  '经': 'jing', '济': 'ji', '社': 'she', '会': 'hui', '政': 'zheng', '治': 'zhi', '军': 'jun', '事': 'shi',
  '战': 'zhan', '争': 'zheng', '和': 'he', '平': 'ping', '胜': 'sheng', '败': 'bai', '攻': 'gong', '守': 'shou',
  '金': 'jin', '银': 'yin', '铜': 'tong', '铁': 'tie', '锡': 'xi', '铝': 'lv', '锌': 'xin', '铅': 'qian',
  '玉': 'yu', '珠': 'zhu', '宝': 'bao', '钻': 'zuan', '翡': 'fei', '翠': 'cui', '玛': 'ma', '瑙': 'nao',
  '酸': 'suan', '甜': 'tian', '苦': 'ku', '辣': 'la', '咸': 'xian', '淡': 'dan', '香': 'xiang', '臭': 'chou',
  '红': 'hong', '黄': 'huang', '蓝': 'lan', '绿': 'lv', '紫': 'zi', '黑': 'hei', '白': 'bai', '灰': 'hui',
  '棕': 'zong', '褐': 'he', '橙': 'cheng', '粉': 'fen', '金': 'jin', '银': 'yin',
  // 港股特有字
  '腾': 'teng', '讯': 'xun', '阿': 'a', '里': 'li', '巴': 'ba', '巴': 'ba', '美': 'mei', '团': 'tuan',
  '京': 'jing', '东': 'dong', '小': 'xiao', '米': 'mi', '百': 'bai', '度': 'du', '网': 'wang', '易': 'yi',
  '拼': 'pin', '多': 'duo', '快': 'kuai', '手': 'shou', '哔': 'bi', '哩': 'li', '携': 'xie', '程': 'cheng',
  '贝': 'bei', '壳': 'ke', '知': 'zhi', '乎': 'hu', '微': 'wei', '博': 'bo', '唯': 'wei', '品': 'pin',
  '会': 'hui', '联': 'lian', '通': 'tong', '移': 'yi', '动': 'dong', '石': 'shi', '药': 'yao', '商': 'shang',
  '吉': 'ji', '利': 'li', '蔚': 'wei', '来': 'lai', '理': 'li', '想': 'xiang', '鹏': 'peng', '汽': 'qi',
  '长': 'chang', '城': 'cheng', '汽': 'qi', '车': 'che', '东': 'dong', '风': 'feng', '集': 'ji', '团': 'tuan',
  '建': 'jian', '银': 'yin', '农': 'nong', '工': 'gong', '商': 'shang', '邮': 'you', '储': 'chu',
  '太': 'tai', '平': 'ping', '洋': 'yang', '友': 'you', '邦': 'bang', '新': 'xin', '华': 'hua',
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
    info: colors.cyan('[SYNC]'),
    success: colors.green('[SYNC]'),
    warn: colors.yellow('[SYNC]'),
    error: colors.red('[SYNC]'),
    verbose: colors.dim('[SYNC]'),
  };
  console.log(`${prefix[type] || prefix.info} ${message}`);
}

/**
 * 汉字转拼音
 * @param {string} text - 中文文本
 * @returns {{pinyin: string, abbr: string}} - 全拼和首字母缩写
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
      // 未知汉字，尝试使用简单的拼音猜测（保留问号以便后续检查）
      pinyin += '?';
      abbr += '?';
    }
    // 忽略其他字符
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
// Tushare API 调用
// ============================================

async function callTushareApi(apiName, params = {}, fields = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(TUSHARE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_name: apiName,
          token: TUSHARE_TOKEN,
          params,
          fields: fields.length > 0 ? fields.join(',') : '',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code !== 0) {
        throw new Error(result.msg || 'Unknown error');
      }

      // 转换为对象数组
      if (!result.data || !result.data.items) {
        return [];
      }

      return result.data.items.map(item => {
        const obj = {};
        result.data.fields.forEach((field, index) => {
          obj[field] = item[index];
        });
        return obj;
      });
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      log(`API调用失败，第${attempt}次重试: ${error.message}`, 'warn');
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

// ============================================
// 获取 A 股数据
// ============================================

async function fetchAStocks(verbose = false) {
  log('开始获取 A 股数据...');
  
  const stocks = [];
  
  // 获取所有 A 股（包括主板、创业板、科创板、北交所）
  const exchanges = [
    { exchange: 'SSE', name: '上交所', suffix: 'SH' },
    { exchange: 'SZSE', name: '深交所', suffix: 'SZ' },
  ];
  
  for (const { exchange, name, suffix } of exchanges) {
    try {
      log(`获取 ${name} 股票列表...`);
      
      const data = await callTushareApi('stock_basic', {
        exchange,
        list_status: 'L',  // 仅上市股票
      }, [
        'ts_code', 'symbol', 'name', 'area', 'industry', 
        'market', 'list_date', 'list_status', 'curr_type'
      ]);
      
      const processed = data.map(s => ({
        ts_code: s.ts_code,
        symbol: s.symbol,
        name: s.name,
        area: s.area,
        industry: s.industry,
        market: s.market || '主板',
        exchange: s.ts_code?.endsWith('.SH') ? 'SSE' : 'SZSE',
        list_date: s.list_date,
        list_status: s.list_status || 'L',
        stock_type: 'A',
      }));
      
      stocks.push(...processed);
      
      log(`${name}: 获取 ${processed.length} 只股票`, 'success');
      
      // 避免请求过快
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      log(`获取 ${name} 数据失败: ${error.message}`, 'error');
    }
  }
  
  // 获取北交所数据
  try {
    log('获取北交所股票列表...');
    
    const data = await callTushareApi('stock_basic', {
      exchange: 'BSE',
      list_status: 'L',
    }, [
      'ts_code', 'symbol', 'name', 'area', 'industry', 
      'market', 'list_date', 'list_status'
    ]);
    
    const processed = data.map(s => ({
      ts_code: s.ts_code,
      symbol: s.symbol,
      name: s.name,
      area: s.area,
      industry: s.industry,
      market: s.market || '北交所',
      exchange: 'BSE',
      list_date: s.list_date,
      list_status: s.list_status || 'L',
      stock_type: 'A',
    }));
    
    stocks.push(...processed);
    
    log(`北交所: 获取 ${processed.length} 只股票`, 'success');
    
  } catch (error) {
    log(`获取北交所数据失败: ${error.message}`, 'warn');
  }
  
  log(`A股总计: ${stocks.length} 只`, 'success');
  return stocks;
}

// ============================================
// 获取港股数据
// ============================================

async function fetchHKStocks(verbose = false) {
  log('开始获取港股数据...');
  
  try {
    const data = await callTushareApi('hk_basic', {
      list_status: 'L',
    }, [
      'ts_code', 'name', 'area', 'industry', 
      'market', 'list_date', 'list_status', 'enname'
    ]);
    
    // 港股 ts_code 格式: 00700.HK
    const stocks = data.map(s => ({
      ts_code: s.ts_code,
      symbol: s.ts_code ? s.ts_code.replace('.HK', '') : '',
      name: s.name,
      area: s.area || '香港',
      industry: s.industry,
      market: s.market || '港股主板',
      exchange: 'HKEX',
      list_date: s.list_date,
      list_status: s.list_status || 'L',
      stock_type: 'HK',
    }));
    
    log(`港股总计: ${stocks.length} 只`, 'success');
    return stocks;
    
  } catch (error) {
    log(`获取港股数据失败: ${error.message}`, 'error');
    log('提示: 港股数据需要更高的 Tushare 积分权限', 'warn');
    return [];
  }
}

// ============================================
// 生成 SQL
// ============================================

function generateSQL(stocks, options = {}) {
  const { fullUpdate = false, setHotStocks = true, verbose = false } = options;
  
  const lines = [];
  const timestamp = new Date().toISOString();
  
  // 统计信息
  const stats = {
    total: stocks.length,
    aStock: stocks.filter(s => s.stock_type === 'A').length,
    hkStock: stocks.filter(s => s.stock_type === 'HK').length,
    hot: 0,
    missingPinyin: 0,
  };
  
  lines.push('-- =====================================================================');
  lines.push('-- Finspark 股票数据 - 自动生成');
  lines.push(`-- 生成时间: ${timestamp}`);
  lines.push(`-- 数据统计: A股 ${stats.aStock} 只, 港股 ${stats.hkStock} 只, 总计 ${stats.total} 只`);
  lines.push('-- 同步脚本: scripts/sync_all_stocks.mjs');
  lines.push('-- =====================================================================');
  lines.push('');
  
  if (fullUpdate) {
    lines.push('-- 全量更新模式：清空现有数据');
    lines.push('DELETE FROM stocks;');
    lines.push('');
  }
  
  lines.push('-- 开始插入股票数据');
  lines.push('');
  
  // 确定热门股票
  const hotStocksSet = new Set([...HOT_STOCKS_A, ...HOT_STOCKS_HK]);
  
  // 分批插入（每批50条，避免SQL过长）
  const batchSize = 50;
  let batchNum = 0;
  
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    batchNum++;
    
    lines.push(`-- 批次 ${batchNum}/${Math.ceil(stocks.length / batchSize)} (${i + 1} - ${Math.min(i + batchSize, stocks.length)})`);
    
    for (const stock of batch) {
      const { pinyin, abbr } = toPinyin(stock.name);
      const isHot = hotStocksSet.has(stock.symbol) ? 1 : 0;
      
      if (isHot) stats.hot++;
      if (pinyin.includes('?')) stats.missingPinyin++;
      
      // INSERT OR REPLACE 确保幂等性
      const sql = `INSERT OR REPLACE INTO stocks (ts_code, symbol, name, area, industry, market, exchange, list_date, list_status, stock_type, pinyin, pinyin_abbr, is_hot) VALUES (${escapeSql(stock.ts_code)}, ${escapeSql(stock.symbol)}, ${escapeSql(stock.name)}, ${escapeSql(stock.area)}, ${escapeSql(stock.industry)}, ${escapeSql(stock.market)}, ${escapeSql(stock.exchange)}, ${escapeSql(stock.list_date)}, ${escapeSql(stock.list_status)}, ${escapeSql(stock.stock_type)}, ${escapeSql(pinyin)}, ${escapeSql(abbr)}, ${isHot});`;
      lines.push(sql);
    }
    
    lines.push('');
  }
  
  // 额外标记热门股票（以防漏标）
  if (setHotStocks) {
    lines.push('-- 确保热门股票标记正确');
    const allHot = [...HOT_STOCKS_A, ...HOT_STOCKS_HK];
    lines.push(`UPDATE stocks SET is_hot = 1 WHERE symbol IN (${allHot.map(s => escapeSql(s)).join(', ')});`);
    lines.push('');
  }
  
  // 重建 FTS 索引
  lines.push('-- 重建 FTS 全文搜索索引');
  lines.push('DELETE FROM stocks_fts;');
  lines.push('INSERT INTO stocks_fts(rowid, name, symbol, ts_code, industry, pinyin, pinyin_abbr)');
  lines.push("SELECT id, name, symbol, ts_code, industry, COALESCE(pinyin, ''), COALESCE(pinyin_abbr, '') FROM stocks WHERE list_status = 'L';");
  lines.push('');
  
  // 最终统计
  lines.push('-- =====================================================================');
  lines.push('-- 同步完成统计');
  lines.push(`-- A股: ${stats.aStock} 只`);
  lines.push(`-- 港股: ${stats.hkStock} 只`);
  lines.push(`-- 热门: ${stats.hot} 只`);
  lines.push(`-- 拼音缺失: ${stats.missingPinyin} 只`);
  lines.push(`-- 总计: ${stats.total} 只`);
  lines.push('-- =====================================================================');
  
  return { sql: lines.join('\n'), stats };
}

// ============================================
// 执行 SQL（分批执行避免缓冲区溢出）
// ============================================

function executeSQL(sql, options = {}) {
  const { dryRun = false, prod = false, verbose = false } = options;
  
  // 创建输出目录
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // 保存完整 SQL 文件（备份）
  const sqlFile = join(OUTPUT_DIR, 'all_stocks.sql');
  writeFileSync(sqlFile, sql);
  log(`SQL 文件已保存: ${sqlFile}`, 'success');
  
  if (dryRun) {
    log('Dry-run 模式，跳过数据库执行', 'warn');
    if (verbose) {
      console.log('\n--- SQL 预览 (前100行) ---');
      console.log(sql.split('\n').slice(0, 100).join('\n'));
      console.log('... (更多内容请查看 SQL 文件)');
    }
    return;
  }
  
  // 分批执行 SQL（每批 500 条语句，避免缓冲区溢出）
  const envFlag = prod ? '' : '--local';
  log(`执行 SQL 导入 (${prod ? '生产环境' : '本地环境'})...`);
  log('正在分批导入数据（约 5400+ 条记录）...');
  
  const lines = sql.split('\n').filter(line => 
    line.trim() && !line.trim().startsWith('--')
  );
  
  const BATCH_SIZE = 300;  // 每批执行 300 条 SQL
  const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = lines.slice(i, i + BATCH_SIZE);
    const batchSql = batch.join('\n');
    
    // 写入临时文件
    const tempFile = join(OUTPUT_DIR, `batch_${batchNum}.sql`);
    writeFileSync(tempFile, batchSql);
    
    try {
      execSync(`npx wrangler d1 execute ${DB_NAME} ${envFlag} --file=${tempFile}`, {
        stdio: 'pipe',
        cwd: join(__dirname, '..'),
        maxBuffer: 50 * 1024 * 1024,  // 50MB buffer
      });
      successCount += batch.length;
      
      // 显示进度
      const progress = Math.round((batchNum / totalBatches) * 100);
      process.stdout.write(`\r[SYNC] 进度: ${progress}% (批次 ${batchNum}/${totalBatches})`);
      
    } catch (error) {
      errorCount++;
      if (verbose) {
        log(`批次 ${batchNum} 失败: ${error.message}`, 'warn');
      }
    }
    
    // 删除临时文件
    try {
      require('fs').unlinkSync(tempFile);
    } catch (e) {}
  }
  
  console.log('');  // 换行
  log(`数据导入完成！成功: ${successCount} 条, 失败: ${errorCount} 批`, 'success');
}

// ============================================
// 验证数据
// ============================================

function verifyData(options = {}) {
  const { prod = false, verbose = false } = options;
  const envFlag = prod ? '' : '--local';
  
  log('验证导入数据...');
  
  try {
    const result = execSync(
      `npx wrangler d1 execute ${DB_NAME} ${envFlag} --command="SELECT stock_type, COUNT(*) as count FROM stocks GROUP BY stock_type;"`,
      { cwd: join(__dirname, '..'), encoding: 'utf-8' }
    );
    
    log('数据验证结果:', 'success');
    console.log(result);
    
    // 检查热门股票
    const hotResult = execSync(
      `npx wrangler d1 execute ${DB_NAME} ${envFlag} --command="SELECT COUNT(*) as count FROM stocks WHERE is_hot = 1;"`,
      { cwd: join(__dirname, '..'), encoding: 'utf-8' }
    );
    console.log('热门股票:', hotResult);
    
  } catch (error) {
    log(`数据验证失败: ${error.message}`, 'error');
  }
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('\n' + colors.bold('🚀 Finspark 股票数据同步工具 v2.0') + '\n');
  
  const args = process.argv.slice(2);
  const fullUpdate = args.includes('--full');
  const aStockOnly = args.includes('--a-stock');
  const hkStockOnly = args.includes('--hk-stock');
  const setHotStocks = args.includes('--hot') || true; // 默认设置热门
  const dryRun = args.includes('--dry-run');
  const prod = args.includes('--prod');
  const verbose = args.includes('--verbose');
  
  log(`配置信息:`);
  log(`  模式: ${fullUpdate ? '全量更新' : '增量更新'}`);
  log(`  范围: ${aStockOnly ? '仅A股' : hkStockOnly ? '仅港股' : 'A股+港股'}`);
  log(`  环境: ${prod ? '生产' : '本地'}`);
  log(`  Dry-run: ${dryRun ? '是' : '否'}`);
  console.log('');
  
  const stocks = [];
  
  // 获取 A 股数据
  if (!hkStockOnly) {
    const aStocks = await fetchAStocks(verbose);
    stocks.push(...aStocks);
  }
  
  // 获取港股数据
  if (!aStockOnly) {
    const hkStocks = await fetchHKStocks(verbose);
    stocks.push(...hkStocks);
  }
  
  if (stocks.length === 0) {
    log('没有获取到任何数据', 'error');
    process.exit(1);
  }
  
  log(`总计获取 ${stocks.length} 只股票`, 'success');
  console.log('');
  
  // 生成并执行 SQL
  const { sql, stats } = generateSQL(stocks, { fullUpdate, setHotStocks, verbose });
  executeSQL(sql, { dryRun, prod, verbose });
  
  // 验证数据
  if (!dryRun) {
    verifyData({ prod, verbose });
  }
  
  // 打印最终统计
  console.log('\n' + colors.bold('📊 同步统计:'));
  console.log(`   A股: ${colors.cyan(stats.aStock)} 只`);
  console.log(`   港股: ${colors.cyan(stats.hkStock)} 只`);
  console.log(`   总计: ${colors.green(stats.total)} 只`);
  console.log(`   热门: ${colors.yellow(stats.hot)} 只`);
  if (stats.missingPinyin > 0) {
    console.log(`   拼音缺失: ${colors.red(stats.missingPinyin)} 只 (需补充拼音映射)`);
  }
  console.log('');
  console.log(colors.dim(`SQL 文件: ${join(OUTPUT_DIR, 'all_stocks.sql')}`));
  console.log('');
}

// 运行
main().catch((error) => {
  log(`同步失败: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
