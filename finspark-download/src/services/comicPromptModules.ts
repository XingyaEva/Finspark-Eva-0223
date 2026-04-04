/**
 * 模块化漫画提示词系统
 * 
 * 设计理念：
 * 1. 将提示词拆分为可组合的原子模块
 * 2. 每个模块专注于单一职责（布局、情绪、数据展示等）
 * 3. 通过智能组合减少冲突，让大模型自由发挥
 * 4. 打破固定的2x2格式，鼓励多样化的信息展示方式
 */

import type { IPCharacter } from '../types';

// ============ 基础结构模块 ============
export const BASE_MODULES = {
  // 信息图海报基础结构
  INFOGRAPHIC_BASE: `Create a professional financial infographic poster in cute cartoon style.
Canvas: Square format (1:1 aspect ratio, 1024x1024 pixels)
Overall style: Modern, clean, visually engaging financial education content
Target: Easy-to-understand financial insights for general audience`,

  // 中文优先渲染
  CHINESE_TEXT_PRIORITY: `=== CRITICAL: CHINESE TEXT RENDERING ===
- ALL Chinese text MUST be clearly rendered and fully readable
- Use proper Chinese fonts with high contrast
- Text hierarchy: Headlines large, subtext medium, details small
- NO blurred, cut-off, or illegible text allowed`,
};

// ============ 布局模块（突破2x2限制）============
export const LAYOUT_MODULES = {
  // 传统2x2网格（保留作为选项之一）
  GRID_2X2: {
    name: '2x2 Grid',
    description: 'Classic 4-card grid layout',
    prompt: `LAYOUT: 2x2 Grid of Information Cards
- 4 equal-sized cards arranged in 2 rows x 2 columns
- Each card has: number badge, title, key content, icon
- Consistent spacing and alignment
- Cards have rounded corners with subtle shadows`,
  },

  // 英雄横幅 + 列表
  HERO_LIST: {
    name: 'Hero + List',
    description: 'Large hero section with vertical list below',
    prompt: `LAYOUT: Hero Banner + Vertical List
- TOP: Large hero section (60% height) with key message and character
- BOTTOM: 3-4 horizontal list items with icons and brief text
- Hero section: Big number/metric prominently displayed
- List items: Icon on left, title + value on right
- Great for highlighting ONE key metric with supporting details`,
  },

  // 中心放射
  CENTER_RADIAL: {
    name: 'Center Radial',
    description: 'Central focus point with radiating elements',
    prompt: `LAYOUT: Central Focus with Radiating Elements
- CENTER: Large circular/hexagonal focal point with main metric or character
- AROUND: 4-6 smaller elements radiating outward like spokes
- Connected by subtle lines or arrows showing relationships
- Great for showing interconnected concepts or breakdown of components
- Central element is 40% of poster size, surrounding elements 15% each`,
  },

  // 时间线/流程
  TIMELINE_FLOW: {
    name: 'Timeline Flow',
    description: 'Horizontal or vertical flow showing progression',
    prompt: `LAYOUT: Timeline/Flow Diagram
- FLOW: 3-4 connected stages arranged horizontally or diagonally
- Each stage: Icon, title, brief description
- Connecting arrows or lines between stages showing progression
- Great for showing trends, processes, or sequential information
- Optional: Character at end giving commentary on the journey`,
  },

  // 仪表盘风格
  DASHBOARD: {
    name: 'Dashboard',
    description: 'Multi-widget dashboard with varied sizes',
    prompt: `LAYOUT: Dashboard Style with Mixed Widgets
- Multiple information widgets of VARYING sizes (not uniform!)
- 1 large widget (40% space) + 2-3 medium widgets (20% each) + 2-3 small widgets (10% each)
- Widgets can be: gauge meters, mini charts, stat cards, progress bars
- Asymmetric but balanced composition
- Great for showing multiple metrics at a glance`,
  },

  // 对比/对决
  VERSUS_COMPARISON: {
    name: 'Versus Comparison',
    description: 'Side-by-side comparison layout',
    prompt: `LAYOUT: Side-by-Side Comparison
- LEFT side vs RIGHT side comparison
- CENTER: Dividing line or VS symbol
- Each side: Title, 2-3 key points with icons
- Color coding: Left = one theme color, Right = contrasting color
- Great for showing strengths vs weaknesses, pros vs cons`,
  },

  // 故事面板
  NARRATIVE_PANELS: {
    name: 'Narrative Panels',
    description: 'Comic-style sequential panels',
    prompt: `LAYOUT: Sequential Narrative Panels
- 3 panels arranged in reading order (top to bottom or left to right)
- Each panel tells part of a story
- Panel sizes can vary (large establishing shot, medium action, small detail)
- Speech bubbles and thought clouds for character dialogue
- Great for explaining a concept step-by-step`,
  },

  // 金字塔/层级
  PYRAMID_HIERARCHY: {
    name: 'Pyramid Hierarchy',
    description: 'Hierarchical pyramid structure',
    prompt: `LAYOUT: Pyramid/Hierarchy Structure
- TOP: Single most important point (apex)
- MIDDLE: 2-3 supporting points
- BOTTOM: Foundation layer with 3-4 base elements
- Pyramid can be inverted for different emphasis
- Great for showing importance levels or building blocks`,
  },

  // 聚焦放大
  SPOTLIGHT_FOCUS: {
    name: 'Spotlight Focus',
    description: 'One main element with supporting details',
    prompt: `LAYOUT: Spotlight Focus
- CENTER/MAIN: One large, attention-grabbing element (60% of space)
  - Could be a big number, key finding, or character with speech
- CORNERS/EDGES: 4 smaller supporting details tucked in corners
- Background elements: Subtle related icons or patterns
- Great for emphasizing ONE key message with context`,
  },
};

// ============ 数据展示模块 ============
export const DATA_DISPLAY_MODULES = {
  // 指标卡片
  METRIC_CARDS: `DATA DISPLAY: Metric Cards
- Clean rectangular cards with rounded corners
- Each card shows: Label, Value, Trend indicator (arrow or sparkline)
- Color-coded: Green for positive, Red for negative, Blue for neutral
- Number badges (1, 2, 3...) for ordering if needed`,

  // 量表/仪表
  GAUGES: `DATA DISPLAY: Gauge Meters
- Circular or semi-circular gauge displays
- Needle or fill indicating current level
- Color zones: Red (danger), Yellow (caution), Green (good)
- Center shows numeric value or label`,

  // 迷你图表
  MINI_CHARTS: `DATA DISPLAY: Mini Charts
- Small inline charts embedded in the design
- Types: Sparklines, mini bar charts, trend arrows
- Used to show direction/trend without detailed axis
- Keep simple: 3-5 data points max`,

  // 进度条
  PROGRESS_BARS: `DATA DISPLAY: Progress Bars
- Horizontal bars showing completion or comparison
- Filled portion shows actual value
- Labels above or beside showing metric name and value
- Can stack multiple for comparison`,

  // 百分比环
  PERCENTAGE_RINGS: `DATA DISPLAY: Percentage Rings
- Circular progress indicators
- Shows percentage completion or ratio
- Number in center
- Can nest multiple rings for comparing categories`,

  // 对比柱状
  COMPARISON_BARS: `DATA DISPLAY: Comparison Bars
- Two horizontal bars facing each other (tug-of-war style)
- Or side-by-side vertical bars
- Great for showing two competing metrics
- Clear labels on each side`,

  // 数值气泡
  BUBBLE_NUMBERS: `DATA DISPLAY: Bubble Numbers
- Large numbers in circular or organic bubble shapes
- Size of bubble proportional to importance
- Labels below or beside
- Can float around character or in corners`,

  // 数据标签浮动
  FLOATING_LABELS: `DATA DISPLAY: Floating Data Labels
- Key metrics float in the scene as if hanging in air
- Connected to relevant elements by subtle lines
- Various sizes based on importance
- Creates dynamic, less rigid feel`,
};

// ============ 情绪/氛围模块 ============
export const MOOD_MODULES = {
  // 积极/增长
  POSITIVE_GROWTH: `MOOD & ATMOSPHERE: Positive/Growth
- Overall optimistic, celebratory atmosphere
- Color palette: Greens, golds, warm oranges
- Visual elements: Upward arrows, growing plants, sunshine, stars
- Character expression: Smiling, thumbs up, excited
- Background: Bright, warm gradients ascending`,

  // 稳健/专业
  STABLE_PROFESSIONAL: `MOOD & ATMOSPHERE: Stable/Professional
- Calm, confident, trustworthy atmosphere
- Color palette: Blues, silvers, clean whites
- Visual elements: Balanced scales, steady lines, solid foundations
- Character expression: Confident smile, professional pose
- Background: Clean gradients, geometric patterns`,

  // 谨慎/关注
  CAUTIOUS_ANALYTICAL: `MOOD & ATMOSPHERE: Cautious/Analytical
- Thoughtful, careful, analytical atmosphere
- Color palette: Soft blues, grays, muted tones
- Visual elements: Magnifying glass, checklist, thinking pose
- Character expression: Thoughtful, contemplative, focused
- Background: Subtle patterns, neutral tones
- NOTE: NOT alarming or scary - just careful and considered`,

  // 中性/平衡
  NEUTRAL_BALANCED: `MOOD & ATMOSPHERE: Neutral/Balanced
- Objective, informational atmosphere
- Color palette: Balanced mix of colors, pastels
- Visual elements: Balanced compositions, equal spacing
- Character expression: Neutral, informative pose
- Background: Soft gradients, clean layout`,

  // 活力/动态
  ENERGETIC_DYNAMIC: `MOOD & ATMOSPHERE: Energetic/Dynamic
- Vibrant, active, exciting atmosphere
- Color palette: Bright oranges, pinks, electric blues
- Visual elements: Motion lines, sparkles, dynamic angles
- Character expression: Energetic, animated, enthusiastic
- Background: Dynamic gradients, burst patterns`,
};

// ============ 安全约束模块 ============
export const SAFETY_MODULES = {
  // 标准安全约束
  STANDARD: `=== CONTENT SAFETY ===
- Professional, business-appropriate imagery only
- No offensive, violent, or inappropriate content
- Family-friendly and educational in nature`,

  // 风险面板专用安全约束（重要！）
  RISK_PANEL_SAFETY: `=== CRITICAL SAFETY FOR RISK/WARNING PANELS ===
IMPORTANT: This is a PROFESSIONAL FINANCIAL RISK ASSESSMENT panel.

DO NOT USE:
- Warning triangles, danger signs, or alert symbols
- Skull and crossbones or death imagery
- Fire, explosions, or destruction
- Scary creatures, monsters, or threatening figures
- Dark stormy clouds or ominous weather
- Red alarm lights or emergency signals
- Broken objects or falling/crashing elements

INSTEAD USE:
- Professional clipboard with checklist
- Calm analytical charts and graphs
- Shield icons suggesting protection/awareness
- Magnifying glass for examination
- Thoughtful character in "thinking" pose
- Balanced scale or comparison visuals
- Soft muted colors (not harsh reds)
- Corporate boardroom aesthetic

Think: "Quarterly business review" NOT "Emergency alarm"
The goal is INFORMED AWARENESS, not FEAR`,

  // 结论面板安全约束
  CONCLUSION_SAFETY: `=== SAFETY FOR CONCLUSION/RECOMMENDATION ===
- Include "AI生成，仅供参考" disclaimer visibly
- Balanced presentation (not overly bullish or bearish)
- Professional investment context
- No guaranteed returns or promises language`,
};

// ============ 角色互动模块 ============
export const CHARACTER_MODULES = {
  // 讲解者角色
  PRESENTER: (character: IPCharacter) => `CHARACTER: Presenter/Teacher
- Character: ${character.name} (${character.displayName})
- Visual style: ${character.visualStyle}
- Pose: Standing beside content, pointing or gesturing at information
- Expression: Friendly, knowledgeable, welcoming
- Size: 20-30% of poster space
- Position: Side of poster, not blocking main content
- Speech bubble: Brief commentary or explanation`,

  // 向导角色
  GUIDE: (character: IPCharacter) => `CHARACTER: Guide/Companion
- Character: ${character.name} (${character.displayName})
- Visual style: ${character.visualStyle}
- Pose: Walking through the information, leading viewer's eye
- Expression: Encouraging, helpful
- Size: 15-25% of poster space
- Position: Moving through the layout
- Speech bubble: Guiding questions or observations`,

  // 专家角色
  EXPERT: (character: IPCharacter) => `CHARACTER: Expert/Analyst
- Character: ${character.name} (${character.displayName})
- Visual style: ${character.visualStyle}
- Pose: Analytical, examining data closely
- Expression: Thoughtful, professional, focused
- Size: 25-35% of poster space
- Position: Central or prominent position
- Speech bubble: Expert insight or key finding`,

  // 庆祝角色
  CELEBRANT: (character: IPCharacter) => `CHARACTER: Celebrant (for positive results)
- Character: ${character.name} (${character.displayName})
- Visual style: ${character.visualStyle}
- Pose: Celebratory, arms raised, jumping, or dancing
- Expression: Very happy, excited, proud
- Size: 30-40% of poster space
- Position: Prominent, attention-grabbing
- Speech bubble: Celebration or achievement announcement`,

  // 思考者角色
  THINKER: (character: IPCharacter) => `CHARACTER: Thinker (for analytical panels)
- Character: ${character.name} (${character.displayName})
- Visual style: ${character.visualStyle}
- Pose: Hand on chin, looking at data thoughtfully
- Expression: Contemplative, curious, analytical
- Size: 20-30% of poster space
- Position: Beside key information
- Speech bubble: Thoughtful question or observation`,
};

// ============ 面板主题配置 ============
export interface PanelThemeConfig {
  index: number;
  name: string;
  agentSource: string;
  suggestedLayouts: string[];      // 建议的布局选项（让AI选择）
  dataDisplayStyles: string[];     // 建议的数据展示方式
  moodOptions: string[];           // 可选情绪
  characterRole: string;           // 角色扮演类型
  contentFocus: string;            // 内容重点描述
  creativeFreedom: string;         // 创意自由度指导
  safetyLevel: 'standard' | 'strict' | 'conclusion';
}

export const PANEL_THEMES: PanelThemeConfig[] = [
  {
    index: 0,
    name: '公司名片',
    agentSource: '基础信息',
    suggestedLayouts: ['HERO_LIST', 'SPOTLIGHT_FOCUS', 'CENTER_RADIAL'],
    dataDisplayStyles: ['METRIC_CARDS', 'BUBBLE_NUMBERS'],
    moodOptions: ['STABLE_PROFESSIONAL', 'POSITIVE_GROWTH'],
    characterRole: 'PRESENTER',
    contentFocus: '公司身份认同：股票代码、行业地位、核心业务、市场定位',
    creativeFreedom: `你可以自由选择如何展示公司介绍。可以是：
- 像名片一样简洁专业
- 像人物登场一样有戏剧感
- 像公司大门/总部的视觉
让角色用第一人称介绍自己`,
    safetyLevel: 'standard',
  },
  {
    index: 1,
    name: '盈利能力',
    agentSource: 'PROFITABILITY Agent',
    suggestedLayouts: ['DASHBOARD', 'GRID_2X2', 'TIMELINE_FLOW'],
    dataDisplayStyles: ['METRIC_CARDS', 'GAUGES', 'PROGRESS_BARS', 'MINI_CHARTS'],
    moodOptions: ['POSITIVE_GROWTH', 'STABLE_PROFESSIONAL', 'ENERGETIC_DYNAMIC'],
    characterRole: 'PRESENTER',
    contentFocus: '赚钱能力：营收增长、毛利率、净利率、盈利趋势',
    creativeFreedom: `展示公司赚钱能力。你可以：
- 用增长的树/阶梯比喻成长
- 用金币/宝箱比喻利润
- 用仪表盘展示各项指标
- 用对比图展示行业领先地位
选择最能体现"这家公司会赚钱"的方式`,
    safetyLevel: 'standard',
  },
  {
    index: 2,
    name: '资产负债',
    agentSource: 'BALANCE_SHEET Agent',
    suggestedLayouts: ['VERSUS_COMPARISON', 'PYRAMID_HIERARCHY', 'DASHBOARD'],
    dataDisplayStyles: ['COMPARISON_BARS', 'PERCENTAGE_RINGS', 'GAUGES'],
    moodOptions: ['STABLE_PROFESSIONAL', 'NEUTRAL_BALANCED'],
    characterRole: 'EXPERT',
    contentFocus: '家底厚度：资产负债率、流动比率、资产质量、财务健康',
    creativeFreedom: `展示公司财务结构。你可以：
- 用天平/秤比喻资产负债平衡
- 用城堡/金库比喻资产实力
- 用分层结构展示资产构成
- 用对比展示资产vs负债
选择最能体现"财务稳健"的方式`,
    safetyLevel: 'standard',
  },
  {
    index: 3,
    name: '现金流',
    agentSource: 'CASH_FLOW Agent',
    suggestedLayouts: ['TIMELINE_FLOW', 'CENTER_RADIAL', 'DASHBOARD'],
    dataDisplayStyles: ['MINI_CHARTS', 'FLOATING_LABELS', 'PROGRESS_BARS'],
    moodOptions: ['STABLE_PROFESSIONAL', 'POSITIVE_GROWTH'],
    characterRole: 'GUIDE',
    contentFocus: '现金循环：经营现金流、投资现金流、自由现金流、现金质量',
    creativeFreedom: `展示公司现金流动情况。你可以：
- 用河流/水流比喻现金流动
- 用管道系统展示现金来源和去向
- 用心脏/血液循环比喻现金是企业命脉
- 用入水口出水口展示收支
选择最能体现"现金流健康"的方式`,
    safetyLevel: 'standard',
  },
  {
    index: 4,
    name: '盈利质量',
    agentSource: 'EARNINGS_QUALITY Agent',
    suggestedLayouts: ['SPOTLIGHT_FOCUS', 'GRID_2X2', 'HERO_LIST'],
    dataDisplayStyles: ['GAUGES', 'METRIC_CARDS', 'PERCENTAGE_RINGS'],
    moodOptions: ['STABLE_PROFESSIONAL', 'CAUTIOUS_ANALYTICAL'],
    characterRole: 'EXPERT',
    contentFocus: '利润含金量：盈利可持续性、收入质量、现金转化率、会计质量',
    creativeFreedom: `展示利润的真实含金量。你可以：
- 用金矿/提纯比喻利润质量
- 用放大镜/检验比喻质量审查
- 用纯度计/成色标比喻含金量
- 用评级星星展示质量等级
选择最能体现"利润是真金白银"的方式`,
    safetyLevel: 'standard',
  },
  {
    index: 5,
    name: '风险评估',
    agentSource: 'RISK Agent',
    suggestedLayouts: ['HERO_LIST', 'NARRATIVE_PANELS', 'DASHBOARD'],
    dataDisplayStyles: ['METRIC_CARDS', 'GAUGES', 'PROGRESS_BARS'],
    moodOptions: ['CAUTIOUS_ANALYTICAL', 'NEUTRAL_BALANCED'],
    characterRole: 'THINKER',
    contentFocus: '风险识别：综合风险等级、主要风险点、风险应对能力',
    creativeFreedom: `展示需要关注的风险点。请注意：
- 这是专业的风险分析，不是恐怖警报
- 用清单/检查表风格，而非警报/危险风格
- 角色应该是"认真审视"而非"惊慌失措"
- 用盾牌/护甲比喻风险防范能力
- 用温和的提醒语气而非紧急警告
目标是让读者"知情"而非"恐惧"`,
    safetyLevel: 'strict',
  },
  {
    index: 6,
    name: '竞争护城河',
    agentSource: 'BUSINESS_INSIGHT + BUSINESS_MODEL Agent',
    suggestedLayouts: ['CENTER_RADIAL', 'PYRAMID_HIERARCHY', 'SPOTLIGHT_FOCUS'],
    dataDisplayStyles: ['BUBBLE_NUMBERS', 'FLOATING_LABELS', 'METRIC_CARDS'],
    moodOptions: ['POSITIVE_GROWTH', 'STABLE_PROFESSIONAL', 'ENERGETIC_DYNAMIC'],
    characterRole: 'CELEBRANT',
    contentFocus: '竞争优势：护城河、行业地位、商业模式、核心壁垒',
    creativeFreedom: `展示公司的竞争优势和护城河。你可以：
- 用城堡/护城河比喻竞争壁垒
- 用皇冠/奖杯比喻行业地位
- 用盾牌/铠甲比喻防御优势
- 用特殊能力/超能力比喻独特竞争力
选择最能体现"这家公司很难被超越"的方式`,
    safetyLevel: 'standard',
  },
  {
    index: 7,
    name: '投资结论',
    agentSource: 'FINAL_CONCLUSION Agent',
    suggestedLayouts: ['HERO_LIST', 'SPOTLIGHT_FOCUS', 'VERSUS_COMPARISON'],
    dataDisplayStyles: ['GAUGES', 'BUBBLE_NUMBERS', 'METRIC_CARDS'],
    moodOptions: ['STABLE_PROFESSIONAL', 'POSITIVE_GROWTH', 'NEUTRAL_BALANCED'],
    characterRole: 'EXPERT',
    contentFocus: '最终建议：综合评分、投资建议、核心优势、主要风险、免责声明',
    creativeFreedom: `给出最终投资结论。你可以：
- 用评分/打分展示综合评价
- 用红绿灯/信号灯比喻投资建议
- 用总结卡片归纳要点
- 必须包含"AI生成，仅供参考"提示
这是整个漫画的高潮和收尾，要有总结感`,
    safetyLevel: 'conclusion',
  },
];

// ============ 智能模块组合函数 ============
export interface PanelPromptBuildOptions {
  panelIndex: number;
  character: IPCharacter;
  analysisData: Record<string, unknown>;
  companyName: string;
  companyCode: string;
}

/**
 * 构建单个面板的提示词
 * 核心理念：给AI足够的自由度，同时提供清晰的方向
 */
export function buildModularPanelPrompt(options: PanelPromptBuildOptions): string {
  const { panelIndex, character, analysisData, companyName, companyCode } = options;
  const theme = PANEL_THEMES[panelIndex];
  
  if (!theme) {
    console.warn(`[ComicPrompt] No theme found for panel ${panelIndex}, using default`);
    return buildFallbackPrompt(options);
  }

  // 1. 基础结构
  const basePrompt = [
    BASE_MODULES.INFOGRAPHIC_BASE,
    BASE_MODULES.CHINESE_TEXT_PRIORITY,
  ].join('\n\n');

  // 2. 布局选项（让AI从中选择或混合）
  const layoutOptions = theme.suggestedLayouts
    .map(key => LAYOUT_MODULES[key as keyof typeof LAYOUT_MODULES])
    .filter(Boolean)
    .map(layout => `Option: ${layout.name}\n${layout.prompt}`)
    .join('\n\n---\n\n');

  const layoutSection = `=== LAYOUT OPTIONS (Choose one or creatively combine) ===
You may choose from these layouts OR create a hybrid that best serves the content:

${layoutOptions}

IMPORTANT: You are NOT limited to 4 equal boxes. Be creative with how you arrange information!`;

  // 3. 数据展示样式
  const dataDisplayOptions = theme.dataDisplayStyles
    .map(key => DATA_DISPLAY_MODULES[key as keyof typeof DATA_DISPLAY_MODULES])
    .filter(Boolean)
    .join('\n\n');

  const dataSection = `=== DATA DISPLAY STYLES (Mix and match) ===
${dataDisplayOptions}`;

  // 4. 情绪氛围
  const moodOption = theme.moodOptions[0]; // 使用第一个作为主要情绪
  const moodPrompt = MOOD_MODULES[moodOption as keyof typeof MOOD_MODULES] || MOOD_MODULES.NEUTRAL_BALANCED;

  // 5. 角色设定
  const characterPrompt = CHARACTER_MODULES[theme.characterRole as keyof typeof CHARACTER_MODULES]?.(character) || 
    CHARACTER_MODULES.PRESENTER(character);

  // 6. 安全约束
  let safetyPrompt = SAFETY_MODULES.STANDARD;
  if (theme.safetyLevel === 'strict') {
    safetyPrompt = SAFETY_MODULES.RISK_PANEL_SAFETY;
  } else if (theme.safetyLevel === 'conclusion') {
    safetyPrompt = SAFETY_MODULES.CONCLUSION_SAFETY;
  }

  // 7. 内容指导
  const contentGuidance = `=== PANEL ${panelIndex + 1}: ${theme.name} ===
Source: ${theme.agentSource}
Focus: ${theme.contentFocus}

=== CREATIVE GUIDANCE ===
${theme.creativeFreedom}

=== COMPANY CONTEXT ===
Company: ${companyName} (${companyCode})

=== KEY DATA TO VISUALIZE ===
${extractRelevantData(panelIndex, analysisData)}`;

  // 组合最终提示词
  return [
    basePrompt,
    contentGuidance,
    layoutSection,
    dataSection,
    moodPrompt,
    characterPrompt,
    safetyPrompt,
  ].join('\n\n');
}

/**
 * 从分析数据中提取面板相关的数据
 */
function extractRelevantData(panelIndex: number, data: Record<string, unknown>): string {
  const agentData = data as {
    profitability?: { summary?: string; metrics?: string[] };
    balanceSheet?: { summary?: string; metrics?: string[] };
    cashFlow?: { summary?: string; metrics?: string[] };
    earningsQuality?: { summary?: string; metrics?: string[] };
    risk?: { summary?: string; keyRisks?: string[]; overallLevel?: string };
    businessInsight?: { summary?: string; advantages?: string[] };
    businessModel?: { summary?: string; moat?: string };
    conclusion?: { score?: number; recommendation?: string; keyTakeaways?: string[] };
  };

  switch (panelIndex) {
    case 0: // 公司介绍
      return `基本信息面板 - 展示公司身份`;
    case 1: // 盈利能力
      return `Profitability Data:
${agentData.profitability?.summary || ''}
Metrics: ${agentData.profitability?.metrics?.slice(0, 4).join(', ') || 'N/A'}`;
    case 2: // 资产负债
      return `Balance Sheet Data:
${agentData.balanceSheet?.summary || ''}
Metrics: ${agentData.balanceSheet?.metrics?.slice(0, 4).join(', ') || 'N/A'}`;
    case 3: // 现金流
      return `Cash Flow Data:
${agentData.cashFlow?.summary || ''}
Metrics: ${agentData.cashFlow?.metrics?.slice(0, 4).join(', ') || 'N/A'}`;
    case 4: // 盈利质量
      return `Earnings Quality Data:
${agentData.earningsQuality?.summary || ''}
Metrics: ${agentData.earningsQuality?.metrics?.slice(0, 4).join(', ') || 'N/A'}`;
    case 5: // 风险评估
      return `Risk Assessment Data:
Overall Level: ${agentData.risk?.overallLevel || 'Medium'}
${agentData.risk?.summary || ''}
Key Risks: ${agentData.risk?.keyRisks?.slice(0, 4).join(', ') || 'N/A'}`;
    case 6: // 竞争护城河
      return `Competitive Advantage Data:
${agentData.businessInsight?.summary || ''}
Moat: ${agentData.businessModel?.moat || 'N/A'}
Advantages: ${agentData.businessInsight?.advantages?.slice(0, 3).join(', ') || 'N/A'}`;
    case 7: // 投资结论
      return `Investment Conclusion:
Score: ${agentData.conclusion?.score || 'N/A'}/100
Recommendation: ${agentData.conclusion?.recommendation || 'N/A'}
Key Points: ${agentData.conclusion?.keyTakeaways?.slice(0, 3).join(', ') || 'N/A'}`;
    default:
      return 'General financial information';
  }
}

/**
 * 备用提示词（当没有找到对应主题时）
 */
function buildFallbackPrompt(options: PanelPromptBuildOptions): string {
  return `${BASE_MODULES.INFOGRAPHIC_BASE}

${BASE_MODULES.CHINESE_TEXT_PRIORITY}

Create a professional financial infographic panel for ${options.companyName} (${options.companyCode}).

${LAYOUT_MODULES.GRID_2X2.prompt}

${MOOD_MODULES.NEUTRAL_BALANCED}

${CHARACTER_MODULES.PRESENTER(options.character)}

${SAFETY_MODULES.STANDARD}`;
}

/**
 * 生成完整漫画脚本的系统提示词
 */
export function buildComicScriptSystemPrompt(character: IPCharacter, companyInfo: { name: string; code: string }): string {
  return `你是一位创意十足的财经信息图表漫画创意总监。

## 核心任务
将财报分析数据转化为8格富有创意的信息图表漫画脚本。

## 创作自由度指南
你拥有很大的创作自由度。对于每一格漫画：

1. **布局不限于2x2格子**
   - 可以是英雄横幅+列表
   - 可以是中心放射结构
   - 可以是时间线流程
   - 可以是仪表盘风格
   - 可以是对比布局
   - 可以是自由组合

2. **数据展示方式灵活**
   - 卡片、仪表盘、进度条、气泡数字、迷你图表...
   - 大小不必相同
   - 位置可以不对称但要平衡

3. **让每格都有独特个性**
   - 避免8格都长得一样
   - 根据内容选择最合适的展示方式
   - 让读者感到"哇，这个设计很有趣"

## IP角色设定
- 角色名称: ${character.name} (${character.displayName})
- 角色描述: ${character.description}
- 性格特点: ${character.personality}
- 视觉风格: ${character.visualStyle}

## 公司信息
- 公司名称: ${companyInfo.name}
- 股票代码: ${companyInfo.code}

## 8格漫画结构
${PANEL_THEMES.map((theme, i) => `
### 第${i + 1}格：${theme.name} [来源: ${theme.agentSource}]
内容重点: ${theme.contentFocus}
创意指导: ${theme.creativeFreedom.split('\n')[0]}
`).join('')}

## 输出格式（JSON）
{
  "title": "漫画标题",
  "theme": "整体主题",
  "mainCharacter": {
    "name": "${character.displayName}",
    "description": "${character.description}",
    "personality": "${character.personality}"
  },
  "panels": [
    {
      "panelNumber": 1,
      "sectionTitle": "大标题（中文）",
      "agentSource": "来源Agent",
      "layoutChoice": "选择的布局类型（如HERO_LIST, DASHBOARD等）",
      "layoutDescription": "具体布局描述（150字，详细说明各元素位置和大小）",
      "dataElements": [
        {
          "type": "metric_card/gauge/bubble/progress_bar/etc",
          "label": "标签",
          "value": "数值",
          "position": "位置描述",
          "size": "large/medium/small"
        }
      ],
      "characterAction": "角色动作和表情",
      "dialogue": "角色台词",
      "caption": "说明文字",
      "mood": "积极/稳健/谨慎/中性",
      "imagePrompt": "详细的英文图片生成提示词（必须包含完整的布局、数据元素、角色和文字指令）",
      "creativeTwist": "这一格的创意亮点是什么"
    }
  ],
  "financialHighlights": ["亮点1", "亮点2", "亮点3"],
  "investmentMessage": "核心投资建议（一句话）",
  "overallCreativeVision": "整个漫画的创意愿景（如何让8格形成有趣的阅读体验）"
}

## 关键要求
1. 每格的layoutChoice和layoutDescription要清晰具体
2. dataElements要详细列出所有数据元素及其位置
3. imagePrompt必须完整，包含所有视觉指令
4. 8格之间要有视觉变化，避免单调
5. 最后一格必须包含"AI生成，仅供参考"`;
}

// ============ 内容风格系统 ============
/**
 * 漫画内容风格类型
 * - structured: 规范4步分析 - 每格固定4小格，结构统一清晰
 * - creative: 自由创意 - 布局灵活多变，模型自由发挥
 * - academic: 学术论文风格 - 严谨专业，数据图表为主
 * - story: 叙事故事风格 - 连贯叙事，情节化展示
 * - dashboard: 仪表盘风格 - 数据密集，可视化为主
 */
export type ComicContentStyle = 'structured' | 'creative' | 'academic' | 'story' | 'dashboard';

export interface ContentStyleConfig {
  id: ComicContentStyle;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  enforceSubPanels: boolean;        // 是否强制4小格
  allowedLayouts: string[];         // 允许的布局类型
  promptModifier: string;           // 提示词修饰
  outputGuidance: string;           // 输出格式指导
  creativeFreedom: 'low' | 'medium' | 'high';  // 创意自由度
}

export const CONTENT_STYLES: Record<ComicContentStyle, ContentStyleConfig> = {
  structured: {
    id: 'structured',
    name: '规范4步分析',
    nameEn: 'Structured 4-Step',
    description: '每格固定4小格，结构统一清晰，适合追求规范的用户',
    icon: '📊',
    enforceSubPanels: true,
    allowedLayouts: ['GRID_2X2'],
    creativeFreedom: 'low',
    promptModifier: `=== 布局约束：规范4步分析 ===
每一格必须严格遵循 2x2 网格布局：
- 精确包含 4 个等大小的信息卡片
- 卡片排列为 2行 × 2列
- 每个卡片包含：序号圆点、标题、核心数值/内容、图标
- 卡片之间间距一致，圆角统一
- 整体风格专业、规范、易读

禁止：
- 不规则布局
- 大小不一的元素
- 超过或少于4个卡片
- 任何偏离2x2网格的设计`,
    outputGuidance: `subPanels 字段必须包含恰好 4 个小格，格式如下：
"subPanels": [
  {"number": 1, "title": "标题1", "content": "内容1", "icon": "图标1"},
  {"number": 2, "title": "标题2", "content": "内容2", "icon": "图标2"},
  {"number": 3, "title": "标题3", "content": "内容3", "icon": "图标3"},
  {"number": 4, "title": "标题4", "content": "内容4", "icon": "图标4"}
]`,
  },

  creative: {
    id: 'creative',
    name: '自由创意',
    nameEn: 'Creative Freedom',
    description: '布局灵活多变，模型自由发挥，让每格都独特有趣',
    icon: '🎨',
    enforceSubPanels: false,
    allowedLayouts: ['HERO_LIST', 'CENTER_RADIAL', 'TIMELINE_FLOW', 'DASHBOARD', 'VERSUS_COMPARISON', 'NARRATIVE_PANELS', 'PYRAMID_HIERARCHY', 'SPOTLIGHT_FOCUS', 'GRID_2X2'],
    creativeFreedom: 'high',
    promptModifier: `=== 创意自由度：最大化 ===
你拥有完全的创意自由！请发挥想象力，让每一格都独特有趣：

布局可选择：
- 英雄横幅+列表：大面积展示核心数据，下方列表补充
- 中心放射：重点在中心，信息向四周辐射
- 时间线流程：展示趋势变化或分析步骤
- 仪表盘风格：多种大小不一的数据组件
- 对比布局：左右对比展示
- 金字塔层级：重要性分层展示
- 聚焦放大：突出单一重点

创意鼓励：
- 使用视觉比喻（如用金矿比喻利润、用城堡比喻护城河）
- 让角色与数据互动
- 打破传统表格思维
- 每格可以完全不同的风格

禁止：
- 8格都用同样的布局
- 死板无趣的表格展示
- 缺乏视觉创意`,
    outputGuidance: `不需要 subPanels，改用 dataElements 描述数据元素：
"layoutChoice": "HERO_LIST/CENTER_RADIAL/DASHBOARD/...",
"layoutDescription": "详细描述这一格的布局（150字以上）",
"dataElements": [
  {"type": "big_number/gauge/bubble/chart/progress_bar", "label": "标签", "value": "数值", "position": "位置", "size": "large/medium/small"}
],
"visualMetaphor": "视觉比喻描述",
"creativeTwist": "这格的创意亮点"`,
  },

  academic: {
    id: 'academic',
    name: '学术论文风格',
    nameEn: 'Academic Style',
    description: '严谨专业，数据图表为主，适合专业投资者',
    icon: '📚',
    enforceSubPanels: false,
    allowedLayouts: ['DASHBOARD', 'TIMELINE_FLOW', 'VERSUS_COMPARISON', 'GRID_2X2'],
    creativeFreedom: 'medium',
    promptModifier: `=== 风格：学术论文 ===
以学术研究报告的严谨风格呈现财务分析：

视觉风格：
- 使用专业图表：折线图、柱状图、饼图、散点图
- 数据标注精确，包含数值和单位
- 色彩克制，以蓝、灰、黑为主
- 排版整洁，类似学术期刊图表
- 可以有脚注或数据来源标注

内容呈现：
- 标题使用专业术语（如"ROE趋势分析"而非"赚钱效率"）
- 数据展示完整精确
- 强调同比、环比对比
- 可引用行业均值作为基准

角色定位：
- 角色扮演财务分析师/研究员
- 表情专业、冷静
- 对话使用专业术语
- 可以戴眼镜或手持报告

禁止：
- 过度卡通化
- 使用俚语或网络用语
- 缺乏数据支撑的结论`,
    outputGuidance: `使用图表为主的数据展示：
"layoutChoice": "DASHBOARD/TIMELINE_FLOW",
"dataElements": [
  {"type": "line_chart/bar_chart/pie_chart/data_table", "label": "图表标题", "value": "数据范围", "position": "位置", "footnote": "数据来源或备注"}
],
"academicNote": "专业术语解释或方法论说明"`,
  },

  story: {
    id: 'story',
    name: '叙事故事风格',
    nameEn: 'Storytelling Style',
    description: '连贯叙事，情节化展示，让财报变成有趣的故事',
    icon: '📖',
    enforceSubPanels: false,
    allowedLayouts: ['NARRATIVE_PANELS', 'HERO_LIST', 'SPOTLIGHT_FOCUS', 'TIMELINE_FLOW'],
    creativeFreedom: 'high',
    promptModifier: `=== 风格：叙事故事 ===
将财报分析讲述成一个引人入胜的故事：

叙事结构：
- 第1格：故事开场 - 介绍"主角"公司，设定背景
- 第2-4格：发展 - 展示公司的能力和资源
- 第5-6格：挑战 - 面临的风险和问题
- 第7格：转折 - 竞争优势如何应对挑战
- 第8格：结局 - 投资结论与展望

角色演绎：
- 角色是故事的讲述者/导游
- 不同场景切换，角色表情动作丰富
- 使用对话推动故事（不是干巴巴念数据）
- 可以有旁白/内心独白

视觉风格：
- 类似漫画连载的分镜感
- 每格有明确的场景设定
- 可以使用拟人化（如把公司比喻成人物）
- 注重情节连贯性

对话示例：
- "让我带你去看看这家公司的金库..." 
- "咦？这里有个隐藏的宝藏！"
- "小心！前方有些需要注意的地方..."`,
    outputGuidance: `强调叙事元素：
"scene": "详细的场景描述（地点、氛围、时间）",
"storyBeat": "这格在整体故事中的作用（开场/发展/高潮/结局）",
"dialogue": "角色对话（口语化、有情感）",
"narration": "旁白文字（如有）",
"emotionalTone": "情感基调（兴奋/紧张/轻松/严肃）"`,
  },

  dashboard: {
    id: 'dashboard',
    name: '数据仪表盘',
    nameEn: 'Data Dashboard',
    description: '数据密集，可视化为主，适合数据驱动型用户',
    icon: '📈',
    enforceSubPanels: false,
    allowedLayouts: ['DASHBOARD', 'CENTER_RADIAL', 'GRID_2X2'],
    creativeFreedom: 'medium',
    promptModifier: `=== 风格：数据仪表盘 ===
像专业BI仪表盘一样展示财务数据：

视觉组件：
- 仪表盘/速度表：展示比率类指标（如毛利率、负债率）
- 数字大屏：突出显示关键数值
- 迷你折线图：展示趋势
- 进度条：展示目标完成度或对比
- 环形图：展示构成比例
- KPI卡片：核心指标一目了然

布局特点：
- 信息密度高，一格展示5-8个数据点
- 大小层次分明（重要指标大，次要指标小）
- 色彩编码：绿色=好，红色=需关注，蓝色=中性
- 实时感/科技感的设计风格

数据呈现：
- 所有数值都要有明确标签
- 包含同比/环比变化箭头
- 可以有行业对比基准线
- 关键异常数据高亮显示

角色定位：
- 角色是数据分析师
- 可以指向特定数据讲解
- 表情专注、分析状态`,
    outputGuidance: `使用丰富的数据可视化组件：
"layoutChoice": "DASHBOARD",
"widgets": [
  {"type": "gauge", "metric": "毛利率", "value": "52.3%", "status": "good", "size": "large"},
  {"type": "kpi_card", "metric": "营收", "value": "646亿", "change": "+6.2%", "size": "medium"},
  {"type": "sparkline", "metric": "净利润趋势", "data": "描述趋势", "size": "small"},
  {"type": "progress_bar", "metric": "目标完成", "value": "85%", "size": "medium"}
],
"colorCoding": "green=positive, red=negative, blue=neutral"`,
  },
};

/**
 * 根据内容风格生成系统提示词
 */
export function buildStyledComicScriptSystemPrompt(
  character: IPCharacter, 
  companyInfo: { name: string; code: string },
  contentStyle: ComicContentStyle = 'creative'
): string {
  const styleConfig = CONTENT_STYLES[contentStyle];
  
  const basePrompt = `你是一位专业的财经信息图表漫画创意总监。

## 当前内容风格：${styleConfig.icon} ${styleConfig.name}
${styleConfig.description}

## IP角色设定
- 角色名称: ${character.name} (${character.displayName})
- 角色描述: ${character.description}
- 性格特点: ${character.personality}
- 视觉风格: ${character.visualStyle}

## 公司信息
- 公司名称: ${companyInfo.name}
- 股票代码: ${companyInfo.code}

${styleConfig.promptModifier}

## 8格漫画结构
${PANEL_THEMES.map((theme, i) => `
### 第${i + 1}格：${theme.name} [来源: ${theme.agentSource}]
内容重点: ${theme.contentFocus}
`).join('')}

## 输出格式指导
${styleConfig.outputGuidance}

## 完整JSON输出结构
{
  "title": "漫画标题",
  "theme": "整体主题",
  "contentStyle": "${contentStyle}",
  "mainCharacter": {
    "name": "${character.displayName}",
    "description": "${character.description}",
    "personality": "${character.personality}"
  },
  "panels": [
    {
      "panelNumber": 1,
      "sectionTitle": "大标题（中文）",
      "agentSource": "来源Agent",
      ${styleConfig.enforceSubPanels ? `"subPanels": [
        {"number": 1, "title": "标题", "content": "内容", "icon": "图标", "highlight": "高亮值"}
      ],` : `"layoutChoice": "布局类型",
      "layoutDescription": "布局详细描述（150字）",
      "dataElements": [...],`}
      "scene": "场景描述",
      "action": "动作描述",
      "dialogue": "角色台词",
      "caption": "说明文字",
      "visualMetaphor": "视觉比喻",
      "mood": "积极/稳健/谨慎/中性",
      "imagePrompt": "详细的英文图片生成提示词（必须包含完整布局、所有数据、角色和中文文字指令）"
    }
  ],
  "financialHighlights": ["亮点1", "亮点2", "亮点3"],
  "investmentMessage": "核心投资建议",
  "overallCreativeVision": "整体创意愿景"
}

## 关键要求
1. 严格遵循「${styleConfig.name}」风格的约束
2. imagePrompt 必须完整详细，包含所有中文文字渲染指令
3. 最后一格必须包含"AI生成，仅供参考"免责声明
4. 创意自由度: ${styleConfig.creativeFreedom === 'high' ? '高 - 尽情发挥创意！' : styleConfig.creativeFreedom === 'medium' ? '中等 - 在专业框架内创新' : '低 - 严格遵循结构规范'}`;

  return basePrompt;
}

/**
 * 根据内容风格生成用户提示词
 */
export function buildStyledUserPrompt(
  character: IPCharacter,
  companyInfo: { name: string; code: string; reportPeriod?: string },
  analysisDataJson: string,
  contentStyle: ComicContentStyle = 'creative'
): string {
  const styleConfig = CONTENT_STYLES[contentStyle];
  
  let styleSpecificGuidance = '';
  
  switch (contentStyle) {
    case 'structured':
      styleSpecificGuidance = `
### 规范4步分析 - 严格要求
每一格必须：
1. 包含精确的 4 个小格 (subPanels)
2. 使用 2x2 网格布局
3. 每个小格有：序号(1-4)、标题、内容、图标
4. imagePrompt 中明确描述 "2x2 grid of 4 equal information cards"`;
      break;
      
    case 'creative':
      styleSpecificGuidance = `
### 自由创意 - 发挥空间
- 每格可以选择完全不同的布局
- 鼓励使用视觉比喻和创意表达
- 数据元素大小可以不一致
- 让角色与内容有趣互动
- 避免8格都长得一样！`;
      break;
      
    case 'academic':
      styleSpecificGuidance = `
### 学术论文风格 - 专业严谨
- 使用专业图表（折线图、柱状图、表格）
- 数据标注精确完整
- 色彩克制专业
- 角色扮演分析师/研究员
- 可以有数据来源脚注`;
      break;
      
    case 'story':
      styleSpecificGuidance = `
### 叙事故事风格 - 情节化
- 8格形成完整故事弧：开场→发展→挑战→结局
- 角色是故事讲述者
- 对话口语化、有情感
- 每格有明确场景设定
- 注重情节连贯性`;
      break;
      
    case 'dashboard':
      styleSpecificGuidance = `
### 数据仪表盘风格 - 数据密集
- 使用仪表盘组件：gauge、KPI卡片、迷你图表、进度条
- 信息密度高（每格5-8个数据点）
- 色彩编码：绿=好，红=注意，蓝=中性
- 科技感/数据驱动风格`;
      break;
  }

  return `## 分析数据
${analysisDataJson}

## 创作任务
请为 **${companyInfo.name}** (${companyInfo.code}) 创作一个8格财报漫画脚本。
${companyInfo.reportPeriod ? `报告期间: ${companyInfo.reportPeriod}` : ''}

## 当前风格：${styleConfig.icon} ${styleConfig.name}
${styleConfig.description}

${styleSpecificGuidance}

## 角色设定
- **${character.displayName}** 作为讲解员
- 性格: ${character.personality}
- 视觉风格: ${character.visualStyle}

## 8格主题（不变）
1. 公司名片 - 我是谁？
2. 盈利能力 - 赚钱能力如何？
3. 资产负债 - 家底有多厚？
4. 现金流 - 现金流好不好？
5. 盈利质量 - 利润含金量？
6. 风险评估 - 有哪些风险？（专业分析，不要恐怖风格）
7. 竞争护城河 - 护城河在哪？
8. 投资结论 - 最终结论 + 免责声明

请严格按照「${styleConfig.name}」风格输出JSON！`;
}

/**
 * 根据内容风格构建图片生成提示词
 */
export function buildStyledImagePrompt(
  panel: {
    panelNumber: number;
    sectionTitle: string;
    subPanels?: Array<{ number: number; title: string; content: string; icon: string; highlight?: string }>;
    layoutChoice?: string;
    layoutDescription?: string;
    dataElements?: Array<{ type: string; label: string; value: string; position?: string; size?: string }>;
    dialogue?: string;
    caption?: string;
    mood?: string;
    visualMetaphor?: string;
    scene?: string;
  },
  character: IPCharacter,
  panelIndex: number,
  contentStyle: ComicContentStyle = 'creative'
): string {
  const styleConfig = CONTENT_STYLES[contentStyle];
  const theme = PANEL_THEMES[panelIndex];
  
  // 基础提示词
  let prompt = `Create a professional financial infographic poster in cute cartoon style.
Canvas: Square format (1:1 aspect ratio, 1024x1024 pixels)

=== PANEL ${panelIndex + 1}: ${panel.sectionTitle} ===
`;

  // 根据风格添加不同的布局指令
  if (styleConfig.enforceSubPanels && panel.subPanels) {
    // 规范4步分析 - 严格2x2网格
    prompt += `
=== LAYOUT: Strict 2x2 Grid ===
MUST create exactly 4 equal-sized information cards in a 2-row × 2-column grid.

CARD 1 (Top-Left):
- Number badge: ① 
- Title: ${panel.subPanels[0]?.title || ''}
- Content: ${panel.subPanels[0]?.content || ''}
- Icon: ${panel.subPanels[0]?.icon || ''}
${panel.subPanels[0]?.highlight ? `- Highlight: ${panel.subPanels[0].highlight}` : ''}

CARD 2 (Top-Right):
- Number badge: ②
- Title: ${panel.subPanels[1]?.title || ''}
- Content: ${panel.subPanels[1]?.content || ''}
- Icon: ${panel.subPanels[1]?.icon || ''}
${panel.subPanels[1]?.highlight ? `- Highlight: ${panel.subPanels[1].highlight}` : ''}

CARD 3 (Bottom-Left):
- Number badge: ③
- Title: ${panel.subPanels[2]?.title || ''}
- Content: ${panel.subPanels[2]?.content || ''}
- Icon: ${panel.subPanels[2]?.icon || ''}
${panel.subPanels[2]?.highlight ? `- Highlight: ${panel.subPanels[2].highlight}` : ''}

CARD 4 (Bottom-Right):
- Number badge: ④
- Title: ${panel.subPanels[3]?.title || ''}
- Content: ${panel.subPanels[3]?.content || ''}
- Icon: ${panel.subPanels[3]?.icon || ''}
${panel.subPanels[3]?.highlight ? `- Highlight: ${panel.subPanels[3].highlight}` : ''}

Card Style: Rounded corners, subtle shadows, consistent spacing, clean typography.
`;
  } else {
    // 其他风格 - 灵活布局
    const layoutType = panel.layoutChoice || theme?.suggestedLayouts[0] || 'HERO_LIST';
    const layoutModule = LAYOUT_MODULES[layoutType as keyof typeof LAYOUT_MODULES];
    
    prompt += `
=== LAYOUT: ${layoutType} ===
${layoutModule?.prompt || panel.layoutDescription || 'Flexible creative layout'}

${panel.layoutDescription ? `Layout Details: ${panel.layoutDescription}` : ''}
`;

    // 数据元素
    if (panel.dataElements && panel.dataElements.length > 0) {
      prompt += `
=== DATA ELEMENTS ===
`;
      panel.dataElements.forEach((elem, idx) => {
        prompt += `Element ${idx + 1}:
- Type: ${elem.type}
- Label: ${elem.label}
- Value: ${elem.value}
- Position: ${elem.position || 'auto'}
- Size: ${elem.size || 'medium'}
`;
      });
    }
  }

  // 角色
  prompt += `
=== CHARACTER ===
- Name: ${character.displayName}
- Visual: ${character.visualStyle}
- Pose: ${theme?.characterRole === 'CELEBRANT' ? 'Celebratory, excited' : 
         theme?.characterRole === 'THINKER' ? 'Thoughtful, analytical' :
         theme?.characterRole === 'EXPERT' ? 'Professional, confident' : 'Presenting, friendly'}
- Expression: Based on mood "${panel.mood || 'positive'}"
${panel.dialogue ? `- Speech bubble: "${panel.dialogue}"` : ''}
- Size: 25-30% of poster
- Position: Side or corner, not blocking main content
`;

  // 视觉比喻
  if (panel.visualMetaphor) {
    prompt += `
=== VISUAL METAPHOR ===
${panel.visualMetaphor}
`;
  }

  // 场景（故事风格）
  if (contentStyle === 'story' && panel.scene) {
    prompt += `
=== SCENE SETTING ===
${panel.scene}
`;
  }

  // 风格特定指令
  switch (contentStyle) {
    case 'academic':
      prompt += `
=== ACADEMIC STYLE ===
- Use professional chart styles (clean lines, proper axes)
- Muted, professional color palette (blues, grays)
- Include data labels and units
- Character dressed professionally (glasses, clipboard)
- Typography: Clean, sans-serif, hierarchical
`;
      break;
      
    case 'story':
      prompt += `
=== STORYTELLING STYLE ===
- Comic-panel aesthetic with dynamic composition
- Rich scene details and atmosphere
- Character emotionally engaged with content
- Visual narrative flow
- Speech bubbles prominent
`;
      break;
      
    case 'dashboard':
      prompt += `
=== DASHBOARD STYLE ===
- High information density
- Multiple widget types: gauges, KPIs, sparklines, progress bars
- Color coding: Green=positive, Red=negative, Blue=neutral
- Tech/modern aesthetic
- Data-first layout, character secondary
`;
      break;
  }

  // 安全约束
  if (panelIndex === 5) {
    prompt += `
=== SAFETY (Risk Panel) ===
Professional risk analysis aesthetic. NO warning triangles, danger signs, fire, or scary imagery.
Use: Clipboard, checklist, magnifying glass, calm analytical visuals.
`;
  }

  // 结论免责
  if (panelIndex === 7) {
    prompt += `
=== DISCLAIMER REQUIRED ===
Must include visible text: "AI生成，仅供参考" (AI-generated, for reference only)
`;
  }

  // 文字渲染
  prompt += `
=== CRITICAL: CHINESE TEXT RENDERING ===
- Header: "${panel.sectionTitle}" in large, bold Chinese font
- All Chinese text must be CLEARLY READABLE
- High contrast, proper font size
- NO blurred or cut-off text

=== OUTPUT ===
Style: Modern, clean, professional infographic
Resolution: 4K quality
Color scheme: ${(theme as any)?.colorScheme || 'Professional gradient'}
`;

  return prompt;
}

/**
 * 获取所有可用的内容风格
 */
export function getAvailableContentStyles(): ContentStyleConfig[] {
  return Object.values(CONTENT_STYLES);
}

/**
 * 获取内容风格配置
 */
export function getContentStyleConfig(style: ComicContentStyle): ContentStyleConfig {
  return CONTENT_STYLES[style] || CONTENT_STYLES.creative;
}

export default {
  BASE_MODULES,
  LAYOUT_MODULES,
  DATA_DISPLAY_MODULES,
  MOOD_MODULES,
  SAFETY_MODULES,
  CHARACTER_MODULES,
  PANEL_THEMES,
  CONTENT_STYLES,
  buildModularPanelPrompt,
  buildComicScriptSystemPrompt,
  buildStyledComicScriptSystemPrompt,
  buildStyledUserPrompt,
  buildStyledImagePrompt,
  getAvailableContentStyles,
  getContentStyleConfig,
};
