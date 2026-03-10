// 汉字转拼音服务 - 轻量级实现
// 用于股票搜索的拼音匹配

// 常用汉字拼音映射表（覆盖 A股上市公司名称常用字）
const PINYIN_MAP: Record<string, string> = {
  // 常见公司名称用字
  '中': 'zhong', '国': 'guo', '华': 'hua', '东': 'dong', '西': 'xi', '南': 'nan', '北': 'bei',
  '上': 'shang', '下': 'xia', '大': 'da', '小': 'xiao', '新': 'xin', '旧': 'jiu',
  '高': 'gao', '低': 'di', '长': 'chang', '短': 'duan', '深': 'shen', '浅': 'qian',
  '广': 'guang', '狭': 'xia', '远': 'yuan', '近': 'jin', '内': 'nei', '外': 'wai',
  
  // 行业相关
  '银': 'yin', '行': 'hang', '保': 'bao', '险': 'xian', '证': 'zheng', '券': 'quan',
  '基': 'ji', '金': 'jin', '投': 'tou', '资': 'zi', '信': 'xin', '托': 'tuo',
  '股': 'gu', '份': 'fen', '集': 'ji', '团': 'tuan', '公': 'gong', '司': 'si',
  '科': 'ke', '技': 'ji', '电': 'dian', '子': 'zi', '通': 'tong', '讯': 'xun',
  '网': 'wang', '络': 'luo', '软': 'ruan', '件': 'jian', '硬': 'ying', '数': 'shu',
  '据': 'ju', '云': 'yun', '智': 'zhi', '能': 'neng', '芯': 'xin', '片': 'pian',
  
  // 制造业
  '制': 'zhi', '造': 'zao', '机': 'ji', '械': 'xie', '设': 'she', '备': 'bei',
  '汽': 'qi', '车': 'che', '航': 'hang', '空': 'kong', '船': 'chuan', '舶': 'bo',
  '钢': 'gang', '铁': 'tie', '铝': 'lv', '铜': 'tong', '材': 'cai', '料': 'liao',
  
  // 消费行业
  '食': 'shi', '品': 'pin', '饮': 'yin', '料': 'liao', '酒': 'jiu', '茶': 'cha',
  '药': 'yao', '医': 'yi', '疗': 'liao', '健': 'jian', '康': 'kang', '生': 'sheng',
  '物': 'wu', '农': 'nong', '业': 'ye', '牧': 'mu', '渔': 'yu', '林': 'lin',
  
  // 地产建筑
  '房': 'fang', '地': 'di', '产': 'chan', '建': 'jian', '筑': 'zhu', '工': 'gong',
  '程': 'cheng', '城': 'cheng', '市': 'shi', '园': 'yuan', '区': 'qu', '港': 'gang',
  
  // 能源
  '能': 'neng', '源': 'yuan', '电': 'dian', '力': 'li', '水': 'shui', '气': 'qi',
  '油': 'you', '煤': 'mei', '矿': 'kuang', '石': 'shi', '化': 'hua', '核': 'he',
  '风': 'feng', '光': 'guang', '伏': 'fu', '储': 'chu', '氢': 'qing',
  
  // 常见字
  '一': 'yi', '二': 'er', '三': 'san', '四': 'si', '五': 'wu', '六': 'liu',
  '七': 'qi', '八': 'ba', '九': 'jiu', '十': 'shi', '百': 'bai', '千': 'qian',
  '万': 'wan', '亿': 'yi', '元': 'yuan', '美': 'mei', '德': 'de', '日': 'ri',
  '韩': 'han', '英': 'ying', '法': 'fa', '俄': 'e', '印': 'yin',
  
  // 白酒相关
  '贵': 'gui', '州': 'zhou', '茅': 'mao', '台': 'tai', '五': 'wu', '粮': 'liang',
  '液': 'ye', '泸': 'lu', '老': 'lao', '窖': 'jiao', '汾': 'fen', '洋': 'yang',
  '河': 'he', '古': 'gu', '井': 'jing', '贡': 'gong', '酱': 'jiang', '香': 'xiang',
  
  // 互联网/科技
  '阿': 'a', '里': 'li', '巴': 'ba', '腾': 'teng', '讯': 'xun', '百': 'bai',
  '度': 'du', '京': 'jing', '美': 'mei', '团': 'tuan', '滴': 'di', '快': 'kuai',
  '手': 'shou', '抖': 'dou', '字': 'zi', '节': 'jie', '跳': 'tiao', '动': 'dong',
  
  // 银行相关
  '工': 'gong', '商': 'shang', '农': 'nong', '建': 'jian', '交': 'jiao', '招': 'zhao',
  '浦': 'pu', '发': 'fa', '民': 'min', '兴': 'xing', '平': 'ping', '安': 'an',
  '邮': 'you', '储': 'chu', '蓄': 'xu',
  
  // 补充常用字
  '山': 'shan', '海': 'hai', '江': 'jiang', '湖': 'hu', '浙': 'zhe', '苏': 'su',
  '皖': 'wan', '闽': 'min', '赣': 'gan', '鲁': 'lu', '豫': 'yu', '鄂': 'e',
  '湘': 'xiang', '粤': 'yue', '桂': 'gui', '琼': 'qiong', '川': 'chuan', '蜀': 'shu',
  '黔': 'qian', '滇': 'dian', '藏': 'zang', '陕': 'shan', '甘': 'gan', '青': 'qing',
  '宁': 'ning', '蒙': 'meng', '疆': 'jiang', '台': 'tai', '港': 'gang', '澳': 'ao',
  
  // 更多补充
  '联': 'lian', '合': 'he', '创': 'chuang', '业': 'ye', '达': 'da', '成': 'cheng',
  '利': 'li', '润': 'run', '盈': 'ying', '亏': 'kui', '增': 'zeng', '减': 'jian',
  '升': 'sheng', '降': 'jiang', '涨': 'zhang', '跌': 'die', '红': 'hong', '绿': 'lv',
  '白': 'bai', '黑': 'hei', '蓝': 'lan', '黄': 'huang', '紫': 'zi', '橙': 'cheng',
  '正': 'zheng', '邦': 'bang', '泰': 'tai', '康': 'kang', '瑞': 'rui', '祥': 'xiang',
  '福': 'fu', '禄': 'lu', '寿': 'shou', '喜': 'xi', '财': 'cai', '宝': 'bao',
  '恒': 'heng', '永': 'yong', '久': 'jiu', '远': 'yuan', '明': 'ming', '亮': 'liang',
  '博': 'bo', '雅': 'ya', '思': 'si', '维': 'wei', '特': 'te', '斯': 'si',
  '尔': 'er', '森': 'sen', '林': 'lin', '木': 'mu', '竹': 'zhu', '花': 'hua',
  '草': 'cao', '虫': 'chong', '鱼': 'yu', '鸟': 'niao', '兽': 'shou', '龙': 'long',
  '凤': 'feng', '虎': 'hu', '豹': 'bao', '鹰': 'ying', '马': 'ma', '牛': 'niu',
  '羊': 'yang', '猪': 'zhu', '狗': 'gou', '鸡': 'ji', '鸭': 'ya', '鹅': 'e',
  
  // 半导体/芯片相关
  '半': 'ban', '导': 'dao', '体': 'ti', '晶': 'jing', '圆': 'yuan', '封': 'feng',
  '测': 'ce', '试': 'shi', '设': 'she', '计': 'ji', '代': 'dai', '工': 'gong',
  '台': 'tai', '积': 'ji', '电': 'dian', '联': 'lian', '发': 'fa', '海': 'hai',
  '思': 'si', '微': 'wei', '纳': 'na', '米': 'mi', '量': 'liang', '子': 'zi',
  '光': 'guang', '刻': 'ke', '曝': 'bao', '显': 'xian', '影': 'ying', '像': 'xiang',
  '传': 'chuan', '感': 'gan', '器': 'qi', '模': 'mo', '拟': 'ni', '混': 'hun',
  '频': 'pin', '射': 'she', '存': 'cun', '储': 'chu', '闪': 'shan', '读': 'du',
  '写': 'xie', '控': 'kong', '制': 'zhi', '处': 'chu', '理': 'li', '运': 'yun',
  '算': 'suan', '逻': 'luo', '辑': 'ji',
  
  // 国际相关
  '际': 'ji', '环': 'huan', '球': 'qiu', '世': 'shi', '界': 'jie', '全': 'quan',
  '亚': 'ya', '欧': 'ou', '非': 'fei', '洲': 'zhou', '太': 'tai', '洋': 'yang',
};

/**
 * 将中文转换为拼音
 */
export function toPinyin(text: string): string {
  if (!text) return '';
  
  let result = '';
  for (const char of text) {
    if (PINYIN_MAP[char]) {
      result += PINYIN_MAP[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char.toLowerCase();
    }
    // 其他字符（未知汉字）跳过
  }
  return result;
}

/**
 * 将中文转换为拼音首字母
 */
export function toPinyinAbbr(text: string): string {
  if (!text) return '';
  
  let result = '';
  for (const char of text) {
    if (PINYIN_MAP[char]) {
      result += PINYIN_MAP[char][0];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char.toLowerCase();
    }
    // 其他字符（未知汉字）跳过
  }
  return result;
}

/**
 * 计算两个字符串的编辑距离（Levenshtein距离）
 * 用于模糊匹配
 */
export function editDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  // 创建距离矩阵
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 初始化
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 计算距离
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * 计算字符串相似度（0-1之间，1表示完全相同）
 */
export function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = editDistance(s1.toLowerCase(), s2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * 常见错别字映射
 */
const TYPO_MAP: Record<string, string[]> = {
  '中芯': ['中心', '众芯', '中新'],
  '茅台': ['毛台', '茆台'],
  '五粮液': ['五娘液', '武粮液'],
  '汾酒': ['分酒', '芬酒'],
  '泸州': ['卢州', '庐州', '炉州'],
  '洋河': ['杨河', '阳河'],
  '海天': ['海添', '海甜'],
  '伊利': ['依利', '一利'],
  '蒙牛': ['萌牛', '猛牛'],
  '格力': ['格利', '隔力'],
  '美的': ['美地', '每的'],
  '比亚迪': ['比呀迪', '比雅迪'],
  '宁德': ['宁的', '柠德'],
  '隆基': ['龙基', '隆记'],
  '国际': ['国计', '国纪', '国记'],
};

/**
 * 修正可能的错别字
 */
export function correctTypo(text: string): string[] {
  const results = [text];
  
  for (const [correct, typos] of Object.entries(TYPO_MAP)) {
    for (const typo of typos) {
      if (text.includes(typo)) {
        results.push(text.replace(typo, correct));
      }
    }
    // 反向：如果输入正确的，也返回错误的变体（用于搜索匹配）
    if (text.includes(correct)) {
      // 不添加错误变体到结果，只修正错误
    }
  }
  
  return [...new Set(results)];
}
