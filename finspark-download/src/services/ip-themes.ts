/**
 * IP主题系列系统
 * 
 * 核心理念：
 * 1. 每个主题包含多个角色，适合不同的漫画格子内容
 * 2. 大模型根据每格内容智能选择最合适的角色
 * 3. 角色有性格特点和适合的场景类型
 * 4. 8格漫画可以由同一主题的不同角色出演
 */

// ============ 角色性格类型 ============
export type CharacterPersonalityType = 
  | 'protagonist'      // 主角型：自信、有担当、适合开场和结论
  | 'mentor'           // 导师型：智慧、稳重、适合分析和解读
  | 'comic_relief'     // 搞笑型：幽默、活泼、适合轻松场景
  | 'rival'            // 对手型：冷峻、专业、适合风险和挑战
  | 'supporter'        // 支持型：温和、可靠、适合资产和稳健话题
  | 'expert'           // 专家型：专业、严谨、适合技术性分析
  | 'narrator'         // 旁白型：客观、全知、适合总结

// ============ 角色适合的面板类型 ============
export type PanelType = 
  | 'intro'            // 公司介绍（第1格）
  | 'profitability'    // 盈利能力（第2格）
  | 'balance_sheet'    // 资产负债（第3格）
  | 'cash_flow'        // 现金流（第4格）
  | 'earnings_quality' // 盈利质量（第5格）
  | 'risk'             // 风险评估（第6格）
  | 'moat'             // 竞争护城河（第7格）
  | 'conclusion'       // 投资结论（第8格）

// ============ 主题角色定义 ============
export interface ThemeCharacter {
  id: string;
  name: string;
  displayName: string;
  description: string;
  personality: string;
  personalityType: CharacterPersonalityType;
  visualStyle: string;           // 图片生成用的视觉描述
  colorPalette: string[];
  catchphrase?: string;          // 口头禅
  dialogueStyle: {
    greeting: string;            // 开场白模板
    analysis: string;            // 分析时的说话风格
    warning: string;             // 警告/风险时的说话风格
    conclusion: string;          // 结论时的说话风格
  };
  suitablePanels: PanelType[];   // 适合出现的面板类型
  panelPriority: number;         // 在适合的面板中的优先级（1最高）
}

// ============ IP主题定义 ============
export interface IPTheme {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  source: string;                // 版权/来源说明
  overallStyle: string;          // 整体艺术风格描述
  colorScheme: string[];         // 主题色系
  characters: ThemeCharacter[];
  defaultProtagonist: string;    // 默认主角ID
  suitableFor: string[];         // 适合的行业/公司类型
}

// ============ 哪吒系列主题 ============
export const NEZHA_THEME: IPTheme = {
  id: 'nezha-universe',
  name: '哪吒宇宙',
  nameEn: 'Nezha Universe',
  description: '来自《哪吒之魔童降世》的角色群，中国神话风格，适合国内上市公司分析',
  icon: '🔥',
  source: '哪吒之魔童降世 / 哪吒之魔童闹海',
  overallStyle: 'Chinese animated movie style, cute chibi proportions, vibrant colors, mythological elements, expressive characters',
  colorScheme: ['#E53935', '#FF7043', '#29B6F6', '#FFD54F', '#8D6E63'],
  defaultProtagonist: 'nezha',
  suitableFor: ['白酒', '消费', '国企', '制造业', '科技', '新能源'],
  characters: [
    {
      id: 'nezha',
      name: '哪吒',
      displayName: '小哪吒',
      description: '魔丸转世的小男孩，大眼睛、丸子头、烟熏妆，穿着红色肚兜',
      personality: '叛逆、勇敢、自信、不服输，喜欢说"我命由我不由天"',
      personalityType: 'protagonist',
      visualStyle: 'Cute Chinese animated Nezha, big round eyes with dark circles (smoky makeup), hair in two buns, red belly band (dudou), lotus shorts, Universe Ring, Wind Fire Wheels, rebellious confident expression, chibi style',
      colorPalette: ['#E53935', '#FF7043', '#FFD54F', '#37474F'],
      catchphrase: '我命由我不由天！',
      dialogueStyle: {
        greeting: '哼！我是{company}，让小爷我给你展示展示实力！',
        analysis: '看好了！{metric}就是{value}！厉不厉害？！',
        warning: '别慌！这点小问题对本大爷来说不算什么...',
        conclusion: '我命由我不由天！{company}的未来，由自己说了算！',
      },
      suitablePanels: ['intro', 'profitability', 'moat', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'aobing',
      name: '敖丙',
      displayName: '敖丙',
      description: '灵珠转世的龙族三太子，蓝发俊美，气质高贵温润',
      personality: '温柔、善良、冷静、重情义、内敛而坚定',
      personalityType: 'supporter',
      visualStyle: 'Elegant Chinese dragon prince Aobing, flowing blue-white hair, small dragon horns, blue and white dragon robes with ribbons, gentle noble expression, chibi but elegant style',
      colorPalette: ['#29B6F6', '#81D4FA', '#FFFFFF', '#0288D1'],
      catchphrase: '你是我唯一的朋友',
      dialogueStyle: {
        greeting: '你好，我是{company}。请容我为你详细介绍...',
        analysis: '从数据来看，{metric}为{value}，这说明...',
        warning: '这里需要特别留意...我来帮你分析风险点。',
        conclusion: '综合来看，{company}的价值...值得被认真对待。',
      },
      suitablePanels: ['balance_sheet', 'cash_flow', 'earnings_quality'],
      panelPriority: 1,
    },
    {
      id: 'taiyi',
      name: '太乙真人',
      displayName: '太乙真人',
      description: '胖乎乎的神仙，骑着猪，说着四川方言，憨态可掬',
      personality: '搞笑、慈祥、智慧、有点糊涂但关键时刻靠谱',
      personalityType: 'mentor',
      visualStyle: 'Chubby cute immortal Taiyi, fat round body, kind smiling face, Taoist robes, riding flying pig, holding magical items, humorous expression, chibi cartoon style',
      colorPalette: ['#8D6E63', '#FFCC80', '#FFF8E1', '#5D4037'],
      catchphrase: '娃娃莫慌，师父来也！',
      dialogueStyle: {
        greeting: '娃娃莫慌~老夫来给你扒一扒这个{company}！',
        analysis: '你看这个{metric}嘛，{value}！有点意思哦~',
        warning: '哎哟~这里有点小问题，不过莫慌，听老夫慢慢讲...',
        conclusion: '老夫掐指一算，这{company}嘛...嘿嘿~',
      },
      suitablePanels: ['profitability', 'earnings_quality', 'conclusion'],
      panelPriority: 2,
    },
    {
      id: 'shen-gongbao',
      name: '申公豹',
      displayName: '申公豹',
      description: '豹子精修炼成人形，黑色道袍，表情阴险但分析犀利',
      personality: '冷峻、专业、善于发现问题、目光敏锐',
      personalityType: 'rival',
      visualStyle: 'Stylish Shen Gongbao, tall slender figure in black Taoist robes, leopard features with sharp eyes, cunning analytical smile, dark mysterious aura, chibi villain style but professional',
      colorPalette: ['#263238', '#455A64', '#78909C', '#9C27B0'],
      catchphrase: '让...让我来看看问题在哪...',
      dialogueStyle: {
        greeting: '哼...{company}？让...让我来看看...',
        analysis: '有...有意思，这{metric}是{value}...但是...',
        warning: '我...我就知道！这里有问题：{risk}',
        conclusion: '别...别被表面迷惑了。真相是...',
      },
      suitablePanels: ['risk', 'earnings_quality'],
      panelPriority: 1,
    },
    {
      id: 'li-jing',
      name: '李靖',
      displayName: '李靖',
      description: '哪吒父亲，陈塘关总兵，正直威严的中年将军',
      personality: '正直、威严、稳重、责任感强、深沉的爱',
      personalityType: 'expert',
      visualStyle: 'Noble Chinese general Li Jing, dignified figure in traditional armor, stern but protective expression, military commander style, strong and reliable, chibi but authoritative',
      colorPalette: ['#5D4037', '#795548', '#A1887F', '#FFB74D'],
      catchphrase: '他是我儿！',
      dialogueStyle: {
        greeting: '我是{company}的守护者。让我来介绍这家公司的根基。',
        analysis: '{metric}达到{value}。这是实力的体现。',
        warning: '作为管理者，这些风险必须正视：{risk}',
        conclusion: '综合评估，{company}的根基...',
      },
      suitablePanels: ['intro', 'balance_sheet', 'moat'],
      panelPriority: 2,
    },
    {
      id: 'yin-shi',
      name: '殷夫人',
      displayName: '殷夫人',
      description: '哪吒母亲，穿着红色战甲的女将军，英姿飒爽又慈爱',
      personality: '英勇、慈爱、开朗、亲和力强',
      personalityType: 'supporter',
      visualStyle: 'Beautiful Chinese female warrior Yin Shi, elegant lady in red armor, long black hair, warm motherly smile, sword at side, strong yet nurturing, chibi warrior princess style',
      colorPalette: ['#C62828', '#EF5350', '#FFCDD2', '#37474F'],
      catchphrase: '娘陪你玩！',
      dialogueStyle: {
        greeting: '来~让我带你了解{company}这个大家庭！',
        analysis: '你看，{metric}有{value}呢！表现不错！',
        warning: '有些地方需要注意，但别担心，我们一起看看...',
        conclusion: '{company}就像一个健康的家庭，有潜力成长！',
      },
      suitablePanels: ['cash_flow', 'profitability'],
      panelPriority: 3,
    },
  ],
};

// ============ 疯狂动物城主题 ============
export const ZOOTOPIA_THEME: IPTheme = {
  id: 'zootopia',
  name: '疯狂动物城',
  nameEn: 'Zootopia',
  description: '来自迪士尼动画的动物角色，现代都市风格，适合各类公司分析',
  icon: '🦊',
  source: '迪士尼动画 Zootopia',
  overallStyle: 'Disney Zootopia style, anthropomorphic animals, modern urban setting, colorful and vibrant, professional yet fun',
  colorScheme: ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#607D8B'],
  defaultProtagonist: 'judy',
  suitableFor: ['互联网', '金融', '零售', '服务业', '物流', '科技'],
  characters: [
    {
      id: 'judy',
      name: '朱迪',
      displayName: '朱迪·霍普斯',
      description: '灰色兔子警官，穿着蓝色警服，充满正义感和乐观',
      personality: '乐观、勤奋、正义感强、永不放弃、充满热情',
      personalityType: 'protagonist',
      visualStyle: 'Disney Zootopia Judy Hopps, cute gray bunny in blue police uniform, big purple eyes, determined optimistic expression, badge visible, chibi Disney style',
      colorPalette: ['#607D8B', '#2196F3', '#9C27B0', '#E8EAF6'],
      catchphrase: 'I\'m gonna make the world a better place!',
      dialogueStyle: {
        greeting: '大家好！我是{company}的调查官朱迪！让我来为你揭开真相！',
        analysis: '调查发现，{metric}达到了{value}！这说明...',
        warning: '等等，这里有些线索需要仔细核查...',
        conclusion: '案件结论：{company}的表现...',
      },
      suitablePanels: ['intro', 'profitability', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'nick',
      name: '尼克',
      displayName: '尼克·王尔德',
      description: '橙色狐狸，穿着绿色夏威夷衬衫和领带，狡黠但善良',
      personality: '聪明、狡黠、幽默、外冷内热、善于分析',
      personalityType: 'mentor',
      visualStyle: 'Disney Zootopia Nick Wilde, sly red fox in green Hawaiian shirt and tie, half-lidded smug expression, clever smile, laid-back pose, chibi Disney style',
      colorPalette: ['#FF9800', '#4CAF50', '#795548', '#FFF8E1'],
      catchphrase: 'It\'s called a hustle, sweetheart.',
      dialogueStyle: {
        greeting: '嘿~让我这个老江湖来给你扒一扒{company}的底细...',
        analysis: '看这{metric}，{value}...哼，有点意思。',
        warning: '我的直觉告诉我，这里面有猫腻...',
        conclusion: '信我，{company}这笔买卖...',
      },
      suitablePanels: ['risk', 'earnings_quality', 'moat'],
      panelPriority: 1,
    },
    {
      id: 'chief-bogo',
      name: '博格局长',
      displayName: '博格局长',
      description: '非洲水牛警察局长，严肃专业的领导者',
      personality: '严肃、专业、公正、有领导力、实事求是',
      personalityType: 'expert',
      visualStyle: 'Disney Zootopia Chief Bogo, large African buffalo in police chief uniform, stern professional expression, authority figure, intimidating but fair, chibi style',
      colorPalette: ['#37474F', '#455A64', '#263238', '#90A4AE'],
      catchphrase: '事实就是事实。',
      dialogueStyle: {
        greeting: '我是博格局长。现在让我客观评估{company}。',
        analysis: '{metric}的数据是{value}。这是事实。',
        warning: '根据规定，这些风险必须披露：...',
        conclusion: '最终评估报告：{company}...',
      },
      suitablePanels: ['balance_sheet', 'conclusion'],
      panelPriority: 2,
    },
    {
      id: 'flash',
      name: '闪电',
      displayName: '闪电',
      description: '树懒公务员，动作超慢但极度认真',
      personality: '慢条斯理、认真仔细、一丝不苟、有耐心',
      personalityType: 'comic_relief',
      visualStyle: 'Disney Zootopia Flash the sloth, cute sloth at DMV desk, extremely slow smile forming, patient expression, wearing work vest, chibi Disney style, comedic timing',
      colorPalette: ['#8D6E63', '#BCAAA4', '#5D4037', '#FFF8E1'],
      catchphrase: '让...我...慢...慢...来...',
      dialogueStyle: {
        greeting: '欢...迎...来...到...{company}...的...分...析...',
        analysis: '这...个...{metric}...是...{value}...',
        warning: '慢...慢...来...风...险...也...要...慢...慢...看...',
        conclusion: '综...合...来...看...',
      },
      suitablePanels: ['cash_flow', 'earnings_quality'],
      panelPriority: 3,
    },
    {
      id: 'gazelle',
      name: '夏奇羊',
      displayName: '夏奇羊',
      description: '瞪羚歌星，优雅自信的明星角色',
      personality: '优雅、自信、有感染力、正能量、鼓舞人心',
      personalityType: 'narrator',
      visualStyle: 'Disney Zootopia Gazelle, elegant gazelle pop star, glamorous confident pose, sparkly outfit, beautiful horns, inspiring expression, chibi Disney style',
      colorPalette: ['#FFD700', '#F8BBD9', '#E1BEE7', '#FFFFFF'],
      catchphrase: 'Try everything!',
      dialogueStyle: {
        greeting: '嗨！让我用最闪亮的方式介绍{company}！',
        analysis: '看！{metric}达到{value}，简直太棒了！',
        warning: '每个明星都有低谷期，{company}也需要注意这些...',
        conclusion: 'Try everything! {company}的舞台精彩纷呈！',
      },
      suitablePanels: ['intro', 'profitability', 'moat'],
      panelPriority: 2,
    },
  ],
};

// ============ 英雄联盟主题 ============
export const LOL_THEME: IPTheme = {
  id: 'league-of-legends',
  name: '英雄联盟',
  nameEn: 'League of Legends',
  description: '来自英雄联盟的角色，战斗风格，适合科技、游戏、竞争激烈行业',
  icon: '⚔️',
  source: 'Riot Games - League of Legends',
  overallStyle: 'League of Legends art style, epic fantasy characters, dynamic poses, glowing effects, detailed armor and weapons, chibi version',
  colorScheme: ['#C9AA71', '#0A1428', '#0BC6E3', '#E84057', '#5B5A56'],
  defaultProtagonist: 'garen',
  suitableFor: ['游戏', '科技', '互联网', '半导体', '军工', '竞争激烈行业'],
  characters: [
    {
      id: 'garen',
      name: '盖伦',
      displayName: '盖伦',
      description: '德玛西亚之力，穿着蓝金色盔甲的正义骑士',
      personality: '正直、勇敢、坚定、领袖气质、保护弱者',
      personalityType: 'protagonist',
      visualStyle: 'League of Legends Garen, noble knight in blue and gold armor, large sword, determined heroic expression, Demacia emblem, epic pose, chibi LoL style',
      colorPalette: ['#C9AA71', '#0A1428', '#3B82F6', '#FFFFFF'],
      catchphrase: '德玛西亚！',
      dialogueStyle: {
        greeting: '德玛西亚！我是{company}的守护者，盖伦！',
        analysis: '以德玛西亚之名！{metric}达到{value}！',
        warning: '正义必胜，但也要警惕这些敌人...',
        conclusion: '为了德玛西亚！{company}值得我们守护！',
      },
      suitablePanels: ['intro', 'balance_sheet', 'moat', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'lux',
      name: '拉克丝',
      displayName: '光辉女郎',
      description: '德玛西亚的光法师，明亮乐观的魔法少女',
      personality: '乐观、聪明、善良、充满希望、光明磊落',
      personalityType: 'supporter',
      visualStyle: 'League of Legends Lux, bright mage girl in white and gold armor, glowing staff, radiant smile, light magic effects, chibi LoL style, sparkles',
      colorPalette: ['#FFEB3B', '#FFFFFF', '#E1BEE7', '#03A9F4'],
      catchphrase: '光芒万丈！',
      dialogueStyle: {
        greeting: '光芒万丈！让我照亮{company}的价值！',
        analysis: '看！{metric}闪耀着{value}的光芒！',
        warning: '即使有阴影，光明终将驱散黑暗...',
        conclusion: '相信光明！{company}的未来一片光明！',
      },
      suitablePanels: ['profitability', 'cash_flow', 'conclusion'],
      panelPriority: 2,
    },
    {
      id: 'yasuo',
      name: '亚索',
      displayName: '疾风剑豪',
      description: '流浪的剑客，背负着沉重过去但技艺超群',
      personality: '沉默、专注、高超技艺、内心复杂、追求真相',
      personalityType: 'expert',
      visualStyle: 'League of Legends Yasuo, wandering samurai with long hair, wind effects, katana sword, contemplative focused expression, Japanese-inspired outfit, chibi LoL style',
      colorPalette: ['#607D8B', '#37474F', '#00BCD4', '#8BC34A'],
      catchphrase: '死亡如风，常伴吾身。',
      dialogueStyle: {
        greeting: '...让我来分析{company}。',
        analysis: '风告诉我，{metric}是{value}。',
        warning: '风中有危险的气息...{risk}',
        conclusion: '追逐风的方向...{company}...',
      },
      suitablePanels: ['risk', 'earnings_quality'],
      panelPriority: 1,
    },
    {
      id: 'jinx',
      name: '金克丝',
      displayName: '暴走萝莉',
      description: '疯狂的爆破专家，蓝色长辫子，永远笑着搞破坏',
      personality: '疯狂、有趣、不可预测、破坏力强、活力四射',
      personalityType: 'comic_relief',
      visualStyle: 'League of Legends Jinx, crazy girl with long blue braids, manic grin, carrying big guns, pink eyes, chaotic energy, explosion effects background, chibi LoL style',
      colorPalette: ['#E91E63', '#00BCD4', '#FF5722', '#212121'],
      catchphrase: '砰砰砰！派对时间！',
      dialogueStyle: {
        greeting: '嘿嘿嘿！让我来炸开{company}的秘密！砰！',
        analysis: '哇哈哈！{metric}居然有{value}！爆炸好看！',
        warning: '嘻嘻~这里有好多好玩的风险等着爆炸~',
        conclusion: '砰！结论出炉！{company}...',
      },
      suitablePanels: ['profitability', 'moat'],
      panelPriority: 3,
    },
    {
      id: 'shen',
      name: '慎',
      displayName: '暮光之眼',
      description: '均衡教派的首领，冷静睿智的忍者大师',
      personality: '冷静、睿智、平衡、保护他人、深思熟虑',
      personalityType: 'mentor',
      visualStyle: 'League of Legends Shen, ninja master in blue outfit with spirit blade, calm wise expression, meditation pose, balance symbols, chibi LoL style',
      colorPalette: ['#3F51B5', '#7C4DFF', '#E8EAF6', '#1A237E'],
      catchphrase: '均衡，存乎万物。',
      dialogueStyle: {
        greeting: '万物皆有均衡。让我带你审视{company}。',
        analysis: '均衡之道显示，{metric}为{value}。',
        warning: '失衡之处必有风险。注意这些...',
        conclusion: '维持均衡，{company}方能长存。',
      },
      suitablePanels: ['balance_sheet', 'risk', 'conclusion'],
      panelPriority: 1,
    },
  ],
};

// ============ 迪士尼公主主题 ============
export const DISNEY_PRINCESS_THEME: IPTheme = {
  id: 'disney-princess',
  name: '迪士尼公主',
  nameEn: 'Disney Princess',
  description: '迪士尼经典公主角色，优雅梦幻风格，适合消费、时尚、美妆等行业',
  icon: '👑',
  source: 'Disney Princess Series',
  overallStyle: 'Disney Princess style, elegant and magical, soft pastel colors, sparkles and magic effects, fairy tale aesthetic, chibi Disney style',
  colorScheme: ['#E91E63', '#9C27B0', '#03A9F4', '#FFEB3B', '#4CAF50'],
  defaultProtagonist: 'belle',
  suitableFor: ['消费品', '美妆', '时尚', '零售', '奢侈品', '文化娱乐'],
  characters: [
    {
      id: 'belle',
      name: '贝儿',
      displayName: '贝儿',
      description: '《美女与野兽》女主角，聪明好学，穿着黄色舞裙',
      personality: '聪明、好学、独立、善良、有深度、爱阅读',
      personalityType: 'protagonist',
      visualStyle: 'Disney Princess Belle, beautiful brown hair with ribbon, yellow ball gown, holding book, intelligent kind expression, library background elements, chibi Disney princess style',
      colorPalette: ['#FFD700', '#8D6E63', '#FFF8E1', '#FFEB3B'],
      catchphrase: '我想要更多...',
      dialogueStyle: {
        greeting: '让我翻开{company}的故事书，为你讲述它的传奇...',
        analysis: '书中记载，{metric}达到了{value}，这意味着...',
        warning: '故事总有转折，这些风险值得我们关注...',
        conclusion: '合上书卷，{company}的故事告诉我们...',
      },
      suitablePanels: ['intro', 'profitability', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'elsa',
      name: '艾莎',
      displayName: '冰雪女王艾莎',
      description: '《冰雪奇缘》女王，拥有冰雪魔法，冷静而强大',
      personality: '冷静、强大、优雅、内敛、有责任感、逐渐开放',
      personalityType: 'expert',
      visualStyle: 'Disney Frozen Elsa, platinum blonde braid, ice blue dress with cape, ice magic effects, regal confident expression, snowflakes, chibi Disney style',
      colorPalette: ['#03A9F4', '#B3E5FC', '#FFFFFF', '#7C4DFF'],
      catchphrase: 'Let it go!',
      dialogueStyle: {
        greeting: '让我用冰雪之力，冻结{company}的核心数据。',
        analysis: '数据如冰晶般清晰：{metric}为{value}。',
        warning: '寒冬将至，这些风险如同暴风雪...',
        conclusion: '冰消雪融，{company}的真相显现...',
      },
      suitablePanels: ['balance_sheet', 'risk', 'earnings_quality'],
      panelPriority: 1,
    },
    {
      id: 'rapunzel',
      name: '长发公主',
      displayName: '乐佩',
      description: '《魔发奇缘》公主，金色长发有魔力，活泼好奇',
      personality: '活泼、好奇、乐观、有创造力、勇敢追梦',
      personalityType: 'comic_relief',
      visualStyle: 'Disney Tangled Rapunzel, extremely long golden magical hair, purple dress, big green eyes, curious excited expression, with Pascal chameleon, flowers in hair, chibi Disney style',
      colorPalette: ['#9C27B0', '#FFD700', '#4CAF50', '#FFC107'],
      catchphrase: '我有一个梦想！',
      dialogueStyle: {
        greeting: '哇！让我用魔法长发为你解开{company}的秘密！',
        analysis: '看！{metric}就像魔法一样达到了{value}！',
        warning: '冒险路上总有一些小麻烦，但别担心...',
        conclusion: '梦想成真！{company}的未来充满可能！',
      },
      suitablePanels: ['intro', 'cash_flow', 'moat'],
      panelPriority: 2,
    },
    {
      id: 'mulan',
      name: '花木兰',
      displayName: '花木兰',
      description: '代父从军的中国女英雄，穿着战甲，勇敢坚强',
      personality: '勇敢、坚强、聪明、有责任感、打破常规',
      personalityType: 'mentor',
      visualStyle: 'Disney Mulan, Chinese warrior girl in red and gold armor, sword, determined brave expression, Chinese elements, chibi Disney warrior princess style',
      colorPalette: ['#F44336', '#FFD700', '#4CAF50', '#212121'],
      catchphrase: '代父从军，谁说女子不如男！',
      dialogueStyle: {
        greeting: '让我像分析兵法一样，为你解读{company}的战略！',
        analysis: '{metric}如同战场优势，达到{value}！',
        warning: '知己知彼，百战不殆。这些风险必须重视...',
        conclusion: '胜败已分，{company}的实力...',
      },
      suitablePanels: ['balance_sheet', 'risk', 'moat', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'ariel',
      name: '小美人鱼',
      displayName: '爱丽儿',
      description: '海底公主，红发鱼尾，对人类世界充满好奇',
      personality: '好奇、热情、追求自由、有点冲动、充满梦想',
      personalityType: 'supporter',
      visualStyle: 'Disney Little Mermaid Ariel, red flowing hair, green mermaid tail or purple dress, curious excited expression, ocean elements, underwater treasures, chibi Disney style',
      colorPalette: ['#E91E63', '#4CAF50', '#03A9F4', '#9C27B0'],
      catchphrase: '我想成为人类世界的一部分！',
      dialogueStyle: {
        greeting: '来自海底的问候！让我带你探索{company}的宝藏！',
        analysis: '哇~{metric}就像珍珠一样闪耀，有{value}呢！',
        warning: '大海也有暗流，这些需要小心...',
        conclusion: '浮出水面，{company}的全貌终于清晰！',
      },
      suitablePanels: ['profitability', 'cash_flow', 'moat'],
      panelPriority: 2,
    },
  ],
};

// ============ 疯狂原始人主题 ============
export const CROODS_THEME: IPTheme = {
  id: 'the-croods',
  name: '疯狂原始人',
  nameEn: 'The Croods',
  description: '史前穴居人家族，原始有趣，适合传统行业、资源类、基础设施',
  icon: '🦴',
  source: 'DreamWorks Animation - The Croods',
  overallStyle: 'DreamWorks Croods style, prehistoric caveman aesthetic, vibrant warm colors, primitive but expressive characters, stone age elements, chibi cartoon style',
  colorScheme: ['#FF9800', '#8D6E63', '#4CAF50', '#FFEB3B', '#795548'],
  defaultProtagonist: 'eep',
  suitableFor: ['资源', '能源', '基础设施', '传统制造', '农业', '建筑'],
  characters: [
    {
      id: 'eep',
      name: '小伊',
      displayName: '小伊',
      description: '勇敢好奇的穴居少女，红发，充满冒险精神',
      personality: '勇敢、好奇、叛逆、渴望探索、活力四射',
      personalityType: 'protagonist',
      visualStyle: 'DreamWorks Croods Eep, red-haired cave girl in leopard print outfit, strong athletic build, curious adventurous expression, prehistoric setting, chibi style',
      colorPalette: ['#FF5722', '#FFAB91', '#8D6E63', '#4CAF50'],
      catchphrase: '我要去外面看看！',
      dialogueStyle: {
        greeting: '嘿！跟我一起探索{company}这片未知领域！',
        analysis: '哇！{metric}简直像发现新大陆！{value}！',
        warning: '前方有危险...但我们可以应对！',
        conclusion: '冒险结束！{company}的秘密被我发现了！',
      },
      suitablePanels: ['intro', 'profitability', 'moat'],
      panelPriority: 1,
    },
    {
      id: 'grug',
      name: '瓜哥',
      displayName: '瓜哥',
      description: '强壮的穴居人父亲，保守但爱护家人',
      personality: '保守、力量型、保护欲强、固执但有爱',
      personalityType: 'expert',
      visualStyle: 'DreamWorks Croods Grug, massive muscular caveman with brown beard, protective serious expression, animal skin clothing, club, chibi strong man style',
      colorPalette: ['#795548', '#5D4037', '#8D6E63', '#FF8A65'],
      catchphrase: '新事物是危险的！',
      dialogueStyle: {
        greeting: '让瓜哥来检查{company}够不够结实！',
        analysis: '嗯...{metric}有{value}。瓜哥觉得还行。',
        warning: '危险！这些风险瓜哥闻到了！',
        conclusion: '瓜哥说了算！{company}...',
      },
      suitablePanels: ['balance_sheet', 'risk'],
      panelPriority: 1,
    },
    {
      id: 'guy',
      name: '盖',
      displayName: '盖',
      description: '聪明的原始人发明家，带着小树懒',
      personality: '聪明、创新、适应性强、幽默、有远见',
      personalityType: 'mentor',
      visualStyle: 'DreamWorks Croods Guy, slender smart caveman with dark hair, holding torch/invention, clever confident smile, Belt the sloth on shoulder, chibi inventor style',
      colorPalette: ['#8BC34A', '#CDDC39', '#4CAF50', '#FF9800'],
      catchphrase: '我有一个想法！',
      dialogueStyle: {
        greeting: '让我用"想法"来分析{company}！',
        analysis: '根据我的发明...{metric}是{value}！',
        warning: '我的直觉告诉我，这里有陷阱...',
        conclusion: '新想法：{company}的未来方向是...',
      },
      suitablePanels: ['earnings_quality', 'moat', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'gran',
      name: '外婆',
      displayName: '外婆',
      description: '彪悍的穴居老太太，看似疯狂但生存能力超强',
      personality: '彪悍、幽默、生存智慧、不按常理出牌',
      personalityType: 'comic_relief',
      visualStyle: 'DreamWorks Croods Gran, tough elderly cavewoman with wild gray hair, missing teeth grin, feisty expression, unexpectedly agile, chibi funny grandma style',
      colorPalette: ['#9E9E9E', '#757575', '#8D6E63', '#FFC107'],
      catchphrase: '老娘还能再活500年！',
      dialogueStyle: {
        greeting: '嘿嘿！让老太婆来给你讲讲{company}！',
        analysis: '老娘活了这么久，{metric}有{value}...见多了！',
        warning: '哼！这点风险算什么，老娘见过更糟的！',
        conclusion: '听老太婆的，{company}...',
      },
      suitablePanels: ['cash_flow', 'risk'],
      panelPriority: 2,
    },
  ],
};

// ============ 米奇妙妙屋主题 ============
export const MICKEY_THEME: IPTheme = {
  id: 'mickey-clubhouse',
  name: '米奇妙妙屋',
  nameEn: 'Mickey Mouse Clubhouse',
  description: '迪士尼经典米老鼠角色，欢乐友好，适合儿童产品、教育、家庭消费',
  icon: '🐭',
  source: 'Disney Mickey Mouse',
  overallStyle: 'Classic Disney Mickey Mouse style, cheerful and friendly, bright primary colors, simple clean design, family-friendly aesthetic, chibi Disney style',
  colorScheme: ['#F44336', '#FFEB3B', '#212121', '#FFFFFF', '#2196F3'],
  defaultProtagonist: 'mickey',
  suitableFor: ['教育', '儿童产品', '家庭消费', '零售', '娱乐', '食品'],
  characters: [
    {
      id: 'mickey',
      name: '米奇',
      displayName: '米老鼠',
      description: '迪士尼标志性角色，永远乐观友好的小老鼠',
      personality: '乐观、友好、有领导力、永远积极向上',
      personalityType: 'protagonist',
      visualStyle: 'Classic Disney Mickey Mouse, iconic round ears, red shorts with white buttons, yellow shoes, white gloves, cheerful welcoming expression, chibi classic style',
      colorPalette: ['#F44336', '#FFEB3B', '#212121', '#FFFFFF'],
      catchphrase: 'Oh boy! 哦太棒了！',
      dialogueStyle: {
        greeting: 'Oh boy! 欢迎来到{company}妙妙屋！',
        analysis: '太棒了！{metric}达到了{value}！',
        warning: '哦哦，这里需要我们一起想想办法...',
        conclusion: '米奇妙妙屋，问题解决！{company}...',
      },
      suitablePanels: ['intro', 'profitability', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'minnie',
      name: '米妮',
      displayName: '米妮',
      description: '米奇的女朋友，优雅可爱，戴着标志性蝴蝶结',
      personality: '优雅、甜美、细心、有品位、温柔但有主见',
      personalityType: 'supporter',
      visualStyle: 'Classic Disney Minnie Mouse, polka dot dress and bow, long eyelashes, sweet elegant expression, white gloves, pink accents, chibi classic style',
      colorPalette: ['#E91E63', '#FFFFFF', '#212121', '#F8BBD9'],
      catchphrase: '太可爱了！',
      dialogueStyle: {
        greeting: '你好呀！让米妮带你参观{company}！',
        analysis: '哇~{metric}有{value}呢！真不错！',
        warning: '嗯...这里需要细心一点...',
        conclusion: '综合来看，{company}真的很棒呢！',
      },
      suitablePanels: ['cash_flow', 'profitability'],
      panelPriority: 2,
    },
    {
      id: 'donald',
      name: '唐老鸭',
      displayName: '唐老鸭',
      description: '穿着水手服的鸭子，脾气急躁但心地善良',
      personality: '急躁、容易生气、但很真诚、有时运气不好',
      personalityType: 'comic_relief',
      visualStyle: 'Classic Disney Donald Duck, blue sailor suit with red bow tie, orange bill and feet, grumpy but lovable expression, white feathers, chibi classic style',
      colorPalette: ['#2196F3', '#F44336', '#FF9800', '#FFFFFF'],
      catchphrase: '哇哇哇！气死我了！',
      dialogueStyle: {
        greeting: '哇哇哇！让我来看看{company}！',
        analysis: '什么！{metric}居然是{value}！',
        warning: '哇哇哇！这里有问题！我就知道！',
        conclusion: '哼！{company}还行吧...哇哇哇！',
      },
      suitablePanels: ['risk', 'earnings_quality'],
      panelPriority: 1,
    },
    {
      id: 'goofy',
      name: '高飞',
      displayName: '高飞',
      description: '笨拙但善良的大狗，总是搞出笑话',
      personality: '笨拙、善良、乐观、虽然经常犯错但很努力',
      personalityType: 'comic_relief',
      visualStyle: 'Classic Disney Goofy, tall lanky dog in green hat and orange shirt, buck teeth, clumsy lovable expression, big shoes, chibi classic style',
      colorPalette: ['#4CAF50', '#FF9800', '#212121', '#8D6E63'],
      catchphrase: 'Gawrsh! 天哪！',
      dialogueStyle: {
        greeting: 'Gawrsh！让高飞来介绍{company}！',
        analysis: '呃...{metric}是{value}...我理解对了吗？',
        warning: 'Gawrsh！这里好像有点问题...',
        conclusion: '总之...{company}...呃...还不错！',
      },
      suitablePanels: ['balance_sheet', 'cash_flow'],
      panelPriority: 2,
    },
    {
      id: 'scrooge',
      name: '史高治',
      displayName: '史高治叔叔',
      description: '唐老鸭的富豪叔叔，精明的商业大亨',
      personality: '精明、节俭、商业头脑超群、对金钱敏感',
      personalityType: 'expert',
      visualStyle: 'Disney Scrooge McDuck, wealthy elderly duck in top hat and coat, glasses, holding cane, shrewd business expression, gold coins around, chibi rich duck style',
      colorPalette: ['#FFD700', '#F44336', '#2196F3', '#212121'],
      catchphrase: '金币！我的金币！',
      dialogueStyle: {
        greeting: '让史高治叔叔来评估{company}的价值！',
        analysis: '根据我多年的商业经验，{metric}为{value}...',
        warning: '小心！这些风险可能让你损失金币！',
        conclusion: '作为亿万富翁，我的判断是：{company}...',
      },
      suitablePanels: ['balance_sheet', 'earnings_quality', 'moat', 'conclusion'],
      panelPriority: 1,
    },
  ],
};

// ============ 原创商业主题（保留兼容性）============
export const BUSINESS_THEME: IPTheme = {
  id: 'business-original',
  name: '商业原创角色',
  nameEn: 'Business Original',
  description: '原创商业拟人化角色，专业正式，适合各类正式场合',
  icon: '💼',
  source: 'Original',
  overallStyle: 'Professional business cartoon style, anthropomorphic business objects, clean modern design, corporate aesthetic, chibi professional style',
  colorScheme: ['#2196F3', '#FFD700', '#4CAF50', '#FF5722', '#607D8B'],
  defaultProtagonist: 'finance-butler',
  suitableFor: ['金融', '银行', '保险', '证券', '咨询', '专业服务'],
  characters: [
    {
      id: 'finance-butler',
      name: '金融管家',
      displayName: '金币先生',
      description: '穿着西装的金币形象管家，专业稳重',
      personality: '专业、稳重、值得信赖、礼貌周到',
      personalityType: 'protagonist',
      visualStyle: 'Cute golden coin character in formal suit, friendly face with glasses, professional butler style, holding financial reports, warm golden glow, chibi business style',
      colorPalette: ['#FFD700', '#FFC107', '#37474F', '#FFFFFF'],
      catchphrase: '为您服务！',
      dialogueStyle: {
        greeting: '您好，我是您的专属金融管家。让我为您解读{company}。',
        analysis: '{metric}的数据显示为{value}，这表明...',
        warning: '请注意，这些风险需要您的关注...',
        conclusion: '综上所述，我的专业建议是：{company}...',
      },
      suitablePanels: ['intro', 'profitability', 'earnings_quality', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'tech-robot',
      name: '科技小智',
      displayName: '小智',
      description: '可爱的机器人助手，发光的芯片眼睛',
      personality: '智能、友好、创新、高效、数据驱动',
      personalityType: 'expert',
      visualStyle: 'Cute friendly robot character with glowing chip eyes, modern tech design, blue LED accents, holding holographic data, sleek futuristic style, chibi robot',
      colorPalette: ['#2196F3', '#03A9F4', '#E3F2FD', '#37474F'],
      catchphrase: '数据分析完成！',
      dialogueStyle: {
        greeting: '系统启动~让我为您扫描{company}的数据。',
        analysis: '数据分析：{metric} = {value}。置信度：高。',
        warning: '警告：检测到以下风险因子...',
        conclusion: '分析完成。综合评估：{company}...',
      },
      suitablePanels: ['balance_sheet', 'cash_flow', 'risk'],
      panelPriority: 1,
    },
    {
      id: 'wine-master',
      name: '酒仙',
      displayName: '酒仙翁',
      description: '穿着传统中式服装的酒瓶拟人，仙风道骨',
      personality: '优雅、内敛、有品位、历史底蕴深厚',
      personalityType: 'mentor',
      visualStyle: 'Elegant Chinese wine bottle anthropomorphic character, wearing traditional silk robes, holding wine cup, wise elderly sage appearance, golden aura, chibi Chinese style',
      colorPalette: ['#8B0000', '#FFD700', '#F5F5DC', '#5D4037'],
      catchphrase: '酒中自有乾坤。',
      dialogueStyle: {
        greeting: '品酒如品股，让老夫为你解读{company}的韵味。',
        analysis: '观其色，{metric}呈现{value}之态...',
        warning: '酒香虽好，也需注意这些隐患...',
        conclusion: '此酒...{company}...值得细品。',
      },
      suitablePanels: ['intro', 'moat', 'conclusion'],
      panelPriority: 1,
    },
    {
      id: 'medicine-doc',
      name: '药博士',
      displayName: '药丸博士',
      description: '穿白大褂的药丸形象，手持分子结构',
      personality: '专业、关爱、科学、严谨、治愈系',
      personalityType: 'supporter',
      visualStyle: 'Cute pill-shaped doctor character in white lab coat, holding glowing molecule structure, friendly medical professional, blue and white theme, chibi scientist style',
      colorPalette: ['#FFFFFF', '#4CAF50', '#2196F3', '#E8F5E9'],
      catchphrase: '健康第一！',
      dialogueStyle: {
        greeting: '让药丸博士来为{company}做一次全面体检！',
        analysis: '检查结果：{metric}为{value}，属于健康范围。',
        warning: '需要注意这些潜在的健康风险...',
        conclusion: '体检报告：{company}的整体健康状况...',
      },
      suitablePanels: ['balance_sheet', 'cash_flow', 'risk'],
      panelPriority: 2,
    },
  ],
};

// ============ 所有主题列表 ============
export const ALL_IP_THEMES: IPTheme[] = [
  NEZHA_THEME,
  ZOOTOPIA_THEME,
  LOL_THEME,
  DISNEY_PRINCESS_THEME,
  CROODS_THEME,
  MICKEY_THEME,
  BUSINESS_THEME,
];

// ============ 默认主题 ============
export const DEFAULT_THEME_ID = 'nezha-universe';

// ============ 面板类型映射 ============
export const PANEL_INDEX_TO_TYPE: Record<number, PanelType> = {
  0: 'intro',
  1: 'profitability',
  2: 'balance_sheet',
  3: 'cash_flow',
  4: 'earnings_quality',
  5: 'risk',
  6: 'moat',
  7: 'conclusion',
};

// ============ 主题服务类 ============
export class IPThemeService {
  /**
   * 获取所有主题
   */
  getAllThemes(): IPTheme[] {
    return ALL_IP_THEMES;
  }

  /**
   * 获取主题
   */
  getTheme(themeId: string): IPTheme | undefined {
    return ALL_IP_THEMES.find(t => t.id === themeId);
  }

  /**
   * 获取默认主题
   */
  getDefaultTheme(): IPTheme {
    return NEZHA_THEME;
  }

  /**
   * 根据行业推荐主题
   */
  recommendThemeByIndustry(industry: string): IPTheme {
    for (const theme of ALL_IP_THEMES) {
      if (theme.suitableFor.some(i => industry.includes(i) || i.includes(industry))) {
        return theme;
      }
    }
    return this.getDefaultTheme();
  }

  /**
   * 获取主题中的角色
   */
  getCharacter(themeId: string, characterId: string): ThemeCharacter | undefined {
    const theme = this.getTheme(themeId);
    if (!theme) return undefined;
    return theme.characters.find(c => c.id === characterId);
  }

  /**
   * 为每个面板智能选择最佳角色
   * 这是核心算法：根据面板类型和角色适合度自动分配
   */
  selectCharactersForPanels(themeId: string): Map<number, ThemeCharacter> {
    const theme = this.getTheme(themeId);
    if (!theme) {
      return this.selectCharactersForPanels(DEFAULT_THEME_ID);
    }

    const result = new Map<number, ThemeCharacter>();
    const usedCharacters = new Set<string>();

    // 按面板顺序处理
    for (let panelIndex = 0; panelIndex < 8; panelIndex++) {
      const panelType = PANEL_INDEX_TO_TYPE[panelIndex];
      
      // 找出适合这个面板的所有角色，按优先级排序
      const candidates = theme.characters
        .filter(c => c.suitablePanels.includes(panelType))
        .sort((a, b) => a.panelPriority - b.panelPriority);

      // 优先选择还没使用过的角色
      let selected = candidates.find(c => !usedCharacters.has(c.id));
      
      // 如果所有合适的角色都用过了，允许重复使用优先级最高的
      if (!selected && candidates.length > 0) {
        selected = candidates[0];
      }

      // 如果这个面板没有专门适合的角色，使用默认主角
      if (!selected) {
        selected = theme.characters.find(c => c.id === theme.defaultProtagonist) || theme.characters[0];
      }

      result.set(panelIndex, selected);
      usedCharacters.add(selected.id);
    }

    return result;
  }

  /**
   * 构建角色的图片生成prompt（用于单个角色）
   */
  buildCharacterPrompt(
    character: ThemeCharacter,
    scene: string,
    action: string,
    mood: string
  ): string {
    return `${character.visualStyle}

Scene: ${scene}
Action: ${action}
Mood/Expression: ${mood}

Style requirements:
- Cute chibi proportions (big head, small body)
- Expressive large eyes
- Soft pastel gradient background
- Color palette: ${character.colorPalette.join(', ')}
- High quality digital illustration, 4K
- Clean minimal background with subtle financial/business elements`;
  }

  /**
   * 根据角色和面板类型生成对话
   */
  generateDialogue(
    character: ThemeCharacter,
    panelType: PanelType,
    data: { company: string; metric?: string; value?: string; risk?: string }
  ): string {
    let template: string;

    switch (panelType) {
      case 'intro':
        template = character.dialogueStyle.greeting;
        break;
      case 'risk':
        template = character.dialogueStyle.warning;
        break;
      case 'conclusion':
        template = character.dialogueStyle.conclusion;
        break;
      default:
        template = character.dialogueStyle.analysis;
    }

    // 替换模板变量
    return template
      .replace('{company}', data.company)
      .replace('{metric}', data.metric || '指标')
      .replace('{value}', data.value || '数值')
      .replace('{risk}', data.risk || '风险点');
  }
}

// 导出单例
export const ipThemeService = new IPThemeService();

export default {
  ALL_IP_THEMES,
  DEFAULT_THEME_ID,
  PANEL_INDEX_TO_TYPE,
  NEZHA_THEME,
  ZOOTOPIA_THEME,
  LOL_THEME,
  DISNEY_PRINCESS_THEME,
  CROODS_THEME,
  MICKEY_THEME,
  BUSINESS_THEME,
  ipThemeService,
};
