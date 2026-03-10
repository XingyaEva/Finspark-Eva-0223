// IP角色库服务 - 管理预设角色和自定义角色
// 默认使用哪吒电影角色

import type { IPCharacter, IPCharacterSet } from '../types';

// ============ 哪吒电影角色集 ============
export const NEZHA_CHARACTERS: IPCharacterSet = {
  id: 'nezha-movie',
  name: '哪吒之魔童降世',
  description: '国产动画电影《哪吒之魔童降世》角色，风格可爱又有个性',
  source: '哪吒之魔童降世 / 哪吒之魔童闹海',
  defaultCharacterId: 'nezha',
  characters: [
    {
      id: 'nezha',
      name: '哪吒',
      displayName: '小哪吒',
      description: '魔丸转世的小男孩，大眼睛、丸子头、烟熏妆，穿着红色肚兜和荷叶边短裤，脚踩风火轮',
      personality: '叛逆、勇敢、不服输、有正义感，喜欢说"我命由我不由天"',
      visualStyle: 'Cute Chinese animated style Nezha character, big round eyes with dark circles (smoky eye makeup), hair in two small buns, wearing red belly band (dudou) with lotus leaf hem shorts, holding Universe Ring, standing on Wind Fire Wheels, rebellious confident expression, chibi proportions',
      colorPalette: ['#E53935', '#FF7043', '#FFD54F', '#37474F'],
      catchphrase: '我命由我不由天！',
      source: '哪吒之魔童降世',
      suitableFor: ['科技', '互联网', '新能源', '创业公司'],
    },
    {
      id: 'aobing',
      name: '敖丙',
      displayName: '敖丙',
      description: '灵珠转世的龙族三太子，俊美的蓝发少年，头戴龙角发饰，穿着蓝白龙族服装，气质高贵温润',
      personality: '温柔、善良、重情重义、内心坚定',
      visualStyle: 'Elegant Chinese animated dragon prince Aobing, handsome young man with flowing blue-white hair, small dragon horn accessories, wearing blue and white dragon clan robes with flowing ribbons, gentle and noble expression, chibi style but elegant',
      colorPalette: ['#29B6F6', '#81D4FA', '#FFFFFF', '#0288D1'],
      catchphrase: '你是我唯一的朋友',
      source: '哪吒之魔童降世',
      suitableFor: ['金融', '银行', '保险', '高端消费'],
    },
    {
      id: 'taiyi',
      name: '太乙真人',
      displayName: '太乙真人',
      description: '胖乎乎的神仙，骑着猪，说着四川方言，憨态可掬又法力高强',
      personality: '搞笑、慈祥、智慧、有点糊涂但关键时刻靠谱',
      visualStyle: 'Chubby cute immortal Taiyi Zhenren from Chinese animation, fat round body, kind smiling face, Taoist robes, riding a flying pig, holding magical items, humorous expression, chibi cartoon style',
      colorPalette: ['#8D6E63', '#FFCC80', '#FFF8E1', '#5D4037'],
      catchphrase: '娃娃莫慌，师父来也！',
      source: '哪吒之魔童降世',
      suitableFor: ['医药', '健康', '食品', '教育'],
    },
    {
      id: 'shen-gongbao',
      name: '申公豹',
      displayName: '申公豹',
      description: '豹子精修炼成人形，穿着黑色道袍，表情阴险，是哪吒的对手',
      personality: '阴险、有野心、善于蛊惑人心',
      visualStyle: 'Stylish villain Shen Gongbao from Chinese animation, tall slender figure in black Taoist robes, leopard-like features with sharp eyes, cunning smile, dark mysterious aura, chibi villain style',
      colorPalette: ['#263238', '#455A64', '#78909C', '#9C27B0'],
      catchphrase: '（结巴）你...你...',
      source: '哪吒之魔童降世',
      suitableFor: ['科技', '竞争激烈行业'],
    },
    {
      id: 'li-jing',
      name: '李靖',
      displayName: '李靖',
      description: '哪吒的父亲，陈塘关总兵，正直威严但深爱儿子的好父亲',
      personality: '正直、威严、深沉、愿意为儿子牺牲一切',
      visualStyle: 'Noble Chinese general Li Jing from animation, tall dignified figure in traditional armor, stern but loving expression, protective father figure, military commander style, chibi proportions',
      colorPalette: ['#5D4037', '#795548', '#A1887F', '#FFB74D'],
      catchphrase: '他是我儿！',
      source: '哪吒之魔童降世',
      suitableFor: ['国企', '制造业', '建筑', '重工业'],
    },
    {
      id: 'yin-shi',
      name: '殷夫人',
      displayName: '殷夫人',
      description: '哪吒的母亲，穿着红色战甲的女将军，英姿飒爽又慈爱',
      personality: '英勇、慈爱、开朗、陪儿子踢毽子',
      visualStyle: 'Beautiful Chinese female warrior Yin Shi from animation, elegant lady in red armor, long black hair, warm motherly smile, holding sword, strong yet nurturing, chibi warrior princess style',
      colorPalette: ['#C62828', '#EF5350', '#FFCDD2', '#37474F'],
      catchphrase: '娘陪你玩！',
      source: '哪吒之魔童降世',
      suitableFor: ['零售', '消费品', '母婴', '时尚'],
    },
  ],
};

// ============ 经典商业角色集 ============
export const BUSINESS_CHARACTERS: IPCharacterSet = {
  id: 'business-classic',
  name: '商业经典角色',
  description: '适合各行业的经典商业拟人化角色',
  source: '原创',
  defaultCharacterId: 'finance-butler',
  characters: [
    {
      id: 'finance-butler',
      name: '金融管家',
      displayName: '金币先生',
      description: '穿着西装的金币形象管家，专业稳重',
      personality: '专业、稳重、值得信赖',
      visualStyle: 'Cute golden coin character in formal suit, friendly face with glasses, professional butler style, holding financial reports, warm golden glow, chibi business style',
      colorPalette: ['#FFD700', '#FFC107', '#37474F', '#FFFFFF'],
      source: '原创',
      suitableFor: ['金融', '银行', '保险', '证券'],
    },
    {
      id: 'tech-robot',
      name: '科技小智',
      displayName: '小智',
      description: '可爱的机器人助手，发光的芯片眼睛，科技感十足',
      personality: '智能、友好、创新、高效',
      visualStyle: 'Cute friendly robot character with glowing chip eyes, modern tech design, blue LED accents, holding holographic data, sleek futuristic style, chibi robot',
      colorPalette: ['#2196F3', '#03A9F4', '#E3F2FD', '#37474F'],
      source: '原创',
      suitableFor: ['科技', '互联网', 'AI', '软件'],
    },
    {
      id: 'wine-master',
      name: '酒仙',
      displayName: '酒仙翁',
      description: '穿着传统中式服装的酒瓶拟人，手持酒杯，仙风道骨',
      personality: '优雅、内敛、有品位、历史底蕴深厚',
      visualStyle: 'Elegant Chinese wine bottle anthropomorphic character, wearing traditional silk robes, holding wine cup, wise elderly sage appearance, golden aura, chibi Chinese style',
      colorPalette: ['#8B0000', '#FFD700', '#F5F5DC', '#5D4037'],
      source: '原创',
      suitableFor: ['白酒', '酒类', '高端消费品'],
    },
    {
      id: 'medicine-doc',
      name: '药博士',
      displayName: '药丸博士',
      description: '穿白大褂的药丸形象，手持分子结构，专业可爱',
      personality: '专业、关爱、科学、严谨',
      visualStyle: 'Cute pill-shaped doctor character in white lab coat, holding glowing molecule structure, friendly medical professional, blue and white theme, chibi scientist style',
      colorPalette: ['#FFFFFF', '#4CAF50', '#2196F3', '#E8F5E9'],
      source: '原创',
      suitableFor: ['医药', '生物科技', '医疗器械', '健康'],
    },
  ],
};

// ============ 角色集合列表 ============
export const CHARACTER_SETS: IPCharacterSet[] = [
  NEZHA_CHARACTERS,
  BUSINESS_CHARACTERS,
];

// ============ 默认角色集 ============
export const DEFAULT_CHARACTER_SET_ID = 'nezha-movie';
export const DEFAULT_CHARACTER_ID = 'nezha';

// ============ 角色服务类 ============
export class CharacterService {
  /**
   * 获取所有角色集
   */
  getAllCharacterSets(): IPCharacterSet[] {
    return CHARACTER_SETS;
  }

  /**
   * 获取角色集
   */
  getCharacterSet(setId: string): IPCharacterSet | undefined {
    return CHARACTER_SETS.find(set => set.id === setId);
  }

  /**
   * 获取默认角色集
   */
  getDefaultCharacterSet(): IPCharacterSet {
    return NEZHA_CHARACTERS;
  }

  /**
   * 获取角色
   */
  getCharacter(setId: string, characterId: string): IPCharacter | undefined {
    const set = this.getCharacterSet(setId);
    if (!set) return undefined;
    return set.characters.find(c => c.id === characterId);
  }

  /**
   * 获取默认角色
   */
  getDefaultCharacter(): IPCharacter {
    return NEZHA_CHARACTERS.characters[0]; // 哪吒
  }

  /**
   * 根据行业推荐角色
   */
  recommendCharacterByIndustry(industry: string): IPCharacter {
    // 遍历所有角色集寻找匹配的行业
    for (const set of CHARACTER_SETS) {
      for (const character of set.characters) {
        if (character.suitableFor?.some(i => 
          industry.includes(i) || i.includes(industry)
        )) {
          return character;
        }
      }
    }
    // 默认返回哪吒
    return this.getDefaultCharacter();
  }

  /**
   * 构建角色的图片生成prompt
   */
  buildCharacterPrompt(
    character: IPCharacter,
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
   * 根据角色生成对话风格
   */
  getDialogueStyle(character: IPCharacter): {
    greetingStyle: string;
    dataStyle: string;
    conclusionStyle: string;
  } {
    switch (character.id) {
      case 'nezha':
        return {
          greetingStyle: '嘿！我是{company}，让我给你讲讲我的实力！',
          dataStyle: '看好了！这就是我的{metric}：{value}！',
          conclusionStyle: '我命由我不由天！{conclusion}',
        };
      case 'aobing':
        return {
          greetingStyle: '你好，我是{company}。请容我为你展示...',
          dataStyle: '{metric}方面，数据显示为{value}',
          conclusionStyle: '综合来看，{conclusion}',
        };
      case 'taiyi':
        return {
          greetingStyle: '娃娃莫慌，{company}老夫来给你分析分析~',
          dataStyle: '这个{metric}嘛，数据是{value}，有点意思！',
          conclusionStyle: '老夫觉得嘛，{conclusion}',
        };
      default:
        return {
          greetingStyle: '大家好，我是{company}',
          dataStyle: '{metric}：{value}',
          conclusionStyle: '总结：{conclusion}',
        };
    }
  }
}

// 导出单例
export const characterService = new CharacterService();
