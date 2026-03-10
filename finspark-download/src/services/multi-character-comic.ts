/**
 * 多角色漫画生成系统
 * 
 * 核心功能：
 * 1. 让大模型根据每格内容智能选择最合适的角色
 * 2. 生成包含多角色的漫画脚本
 * 3. 为每个面板生成针对特定角色的图片提示词
 */

import {
  IPTheme,
  ThemeCharacter,
  PanelType,
  PANEL_INDEX_TO_TYPE,
  ipThemeService,
  ALL_IP_THEMES,
} from './ip-themes';
import { PANEL_THEMES, CONTENT_STYLES, ComicContentStyle } from './comicPromptModules';

// ============ 多角色漫画脚本类型 ============
export interface MultiCharacterPanel {
  panelNumber: number;
  panelType: PanelType;
  sectionTitle: string;
  
  // 角色信息（由AI选择或预设）
  character: {
    id: string;
    name: string;
    displayName: string;
    visualStyle: string;
    personality: string;
    selectionReason: string;  // AI解释为什么选择这个角色
  };
  
  // 内容
  dialogue: string;
  caption: string;
  scene: string;
  action: string;
  mood: string;
  visualMetaphor?: string;
  
  // 布局和数据
  layoutChoice?: string;
  layoutDescription?: string;
  dataElements?: Array<{
    type: string;
    label: string;
    value: string;
    position?: string;
    size?: string;
  }>;
  subPanels?: Array<{
    number: number;
    title: string;
    content: string;
    icon: string;
    highlight?: string;
  }>;
  
  // 图片生成
  imagePrompt: string;
}

export interface MultiCharacterComicScript {
  title: string;
  theme: string;
  themeId: string;
  contentStyle: ComicContentStyle;
  
  // 角色使用情况
  charactersUsed: Array<{
    id: string;
    name: string;
    displayName: string;
    appearsInPanels: number[];
  }>;
  
  panels: MultiCharacterPanel[];
  
  financialHighlights: string[];
  investmentMessage: string;
  overallCreativeVision: string;
}

// ============ 系统提示词构建器 ============

/**
 * 构建多角色漫画脚本的系统提示词
 * 核心：让AI理解主题中的所有角色，并智能选择每格使用哪个角色
 */
export function buildMultiCharacterSystemPrompt(
  theme: IPTheme,
  companyInfo: { name: string; code: string },
  contentStyle: ComicContentStyle = 'creative'
): string {
  const styleConfig = CONTENT_STYLES[contentStyle];
  
  // 构建角色列表描述
  const characterDescriptions = theme.characters.map(char => `
### ${char.displayName} (${char.name})
- ID: ${char.id}
- 性格类型: ${char.personalityType}
- 性格描述: ${char.personality}
- 视觉风格: ${char.visualStyle}
- 适合的场景: ${char.suitablePanels.join(', ')}
- 口头禅: ${char.catchphrase || '无'}
- 对话风格示例:
  - 开场: "${char.dialogueStyle.greeting}"
  - 分析: "${char.dialogueStyle.analysis}"
  - 风险警告: "${char.dialogueStyle.warning}"
  - 结论: "${char.dialogueStyle.conclusion}"
`).join('\n');

  return `你是一位创意十足的财经漫画创意总监，专门创作多角色互动的财报分析漫画。

## 🎬 当前IP主题：${theme.icon} ${theme.name}
${theme.description}

来源: ${theme.source}
整体艺术风格: ${theme.overallStyle}

## 👥 可用角色库（共${theme.characters.length}个角色）
${characterDescriptions}

## 🎯 核心任务
为 **${companyInfo.name}** (${companyInfo.code}) 创作8格财报漫画。

**关键要求：每格漫画可以使用不同的角色！**
- 根据每格内容的性质，选择最合适的角色
- 角色选择要符合其性格和擅长领域
- 让不同角色的互动让漫画更生动有趣
- 可以在同一格中出现多个角色（如对话场景）

## 🎨 内容风格：${styleConfig.icon} ${styleConfig.name}
${styleConfig.description}

${styleConfig.promptModifier}

## 📊 8格漫画结构（每格选择最合适的角色）

${PANEL_THEMES.map((panelTheme, i) => {
  const panelType = PANEL_INDEX_TO_TYPE[i];
  const suitableChars = theme.characters
    .filter(c => c.suitablePanels.includes(panelType))
    .map(c => c.displayName)
    .join('、');
  
  return `### 第${i + 1}格：${panelTheme.name}
- 面板类型: ${panelType}
- 内容重点: ${panelTheme.contentFocus}
- 推荐角色: ${suitableChars || '任意角色'}
- 角色作用: ${panelTheme.characterRole}
`;
}).join('\n')}

## 📝 输出格式（JSON）

\`\`\`json
{
  "title": "漫画标题",
  "theme": "整体主题描述",
  "themeId": "${theme.id}",
  "contentStyle": "${contentStyle}",
  "charactersUsed": [
    {
      "id": "角色ID",
      "name": "角色名",
      "displayName": "显示名",
      "appearsInPanels": [1, 3, 8]
    }
  ],
  "panels": [
    {
      "panelNumber": 1,
      "panelType": "intro",
      "sectionTitle": "大标题（中文）",
      "character": {
        "id": "选中的角色ID",
        "name": "角色名",
        "displayName": "显示名",
        "visualStyle": "角色视觉描述",
        "personality": "角色性格",
        "selectionReason": "为什么选择这个角色来演绎这一格（50字以内）"
      },
      "dialogue": "角色台词（符合角色性格）",
      "caption": "说明文字",
      "scene": "场景描述（150字）",
      "action": "角色动作",
      "mood": "情绪氛围",
      "visualMetaphor": "视觉比喻（可选）",
      ${styleConfig.enforceSubPanels ? `"subPanels": [
        {"number": 1, "title": "标题", "content": "内容", "icon": "图标", "highlight": "高亮值"}
      ],` : `"layoutChoice": "布局类型",
      "layoutDescription": "布局详细描述",
      "dataElements": [
        {"type": "类型", "label": "标签", "value": "数值", "position": "位置", "size": "大小"}
      ],`}
      "imagePrompt": "完整的英文图片生成提示词（必须包含角色视觉描述、场景、布局、数据元素、中文文字渲染指令）"
    }
  ],
  "financialHighlights": ["亮点1", "亮点2", "亮点3"],
  "investmentMessage": "核心投资建议（一句话）",
  "overallCreativeVision": "整体创意愿景（如何让8格形成有趣的多角色故事）"
}
\`\`\`

## ⚠️ 重要约束

1. **角色选择逻辑**
   - 主角型角色(protagonist): 适合开场(intro)、亮点(profitability/moat)、结论(conclusion)
   - 导师型角色(mentor): 适合分析解读、提供智慧
   - 专家型角色(expert): 适合技术性分析(balance_sheet/earnings_quality)
   - 对手型角色(rival): 适合风险评估(risk)
   - 支持型角色(supporter): 适合稳健话题(cash_flow/balance_sheet)
   - 搞笑型角色(comic_relief): 适合轻松场景、缓解紧张气氛

2. **角色一致性**
   - 每个角色的对话必须符合其设定的性格
   - 使用角色特有的口头禅和说话方式
   - 角色视觉风格在imagePrompt中保持一致

3. **多角色互动（可选）**
   - 可以设计角色之间的对话场景
   - 角色可以"接力"讲述分析内容
   - 风险面板可以让"谨慎型"角色出场

4. **视觉指令**
   - imagePrompt必须包含完整的角色visualStyle
   - 中文文字必须清晰可读
   - 最后一格必须包含"AI生成，仅供参考"

5. **风险面板特殊处理（第6格）**
   - 使用专业分析风格，不要恐怖元素
   - 选择适合的角色（rival或expert类型）
   - 角色应表现为"认真审视"而非"惊慌失措"`;
}

/**
 * 构建用户提示词
 */
export function buildMultiCharacterUserPrompt(
  theme: IPTheme,
  companyInfo: { name: string; code: string; industry?: string; reportPeriod?: string },
  analysisDataJson: string,
  contentStyle: ComicContentStyle = 'creative'
): string {
  const styleConfig = CONTENT_STYLES[contentStyle];
  
  // 快速角色参考
  const quickCharacterRef = theme.characters.map(c => 
    `- ${c.displayName} (${c.id}): ${c.personalityType} - 适合 ${c.suitablePanels.slice(0, 3).join('/')}`
  ).join('\n');

  return `## 📈 分析数据
${analysisDataJson}

## 🏢 公司信息
- 公司名称: ${companyInfo.name}
- 股票代码: ${companyInfo.code}
${companyInfo.industry ? `- 所属行业: ${companyInfo.industry}` : ''}
${companyInfo.reportPeriod ? `- 报告期间: ${companyInfo.reportPeriod}` : ''}

## 🎬 创作任务
请使用「${theme.name}」主题的角色，为这家公司创作8格财报漫画。

## 👥 快速角色参考
${quickCharacterRef}

## 🎨 风格要求: ${styleConfig.icon} ${styleConfig.name}
${styleConfig.description}

## ✅ 创作检查清单
1. [ ] 每格都选择了合适的角色并说明原因
2. [ ] 角色对话符合其性格设定
3. [ ] imagePrompt包含完整的角色视觉描述
4. [ ] 8格之间有视觉变化和角色轮换
5. [ ] 第6格(风险)不使用恐怖元素
6. [ ] 第8格(结论)包含AI生成免责声明
7. [ ] 所有中文文字清晰可读

请输出完整的JSON脚本！`;
}

// ============ 图片提示词构建器 ============

/**
 * 为多角色漫画的单个面板构建图片提示词
 */
export function buildMultiCharacterImagePrompt(
  panel: MultiCharacterPanel,
  theme: IPTheme,
  panelIndex: number,
  contentStyle: ComicContentStyle = 'creative'
): string {
  const styleConfig = CONTENT_STYLES[contentStyle];
  const panelTheme = PANEL_THEMES[panelIndex];
  
  // 获取角色完整信息 - 增强匹配逻辑
  let character = theme.characters.find(c => c.id === panel.character.id);
  
  // 如果精确匹配失败，尝试模糊匹配
  if (!character && panel.character.id) {
    character = theme.characters.find(c => 
      c.id.toLowerCase() === panel.character.id.toLowerCase() ||
      c.name === panel.character.name ||
      c.displayName === panel.character.displayName
    );
  }
  
  // 如果还是没找到，使用主题默认角色
  if (!character) {
    console.warn(`[Comic] Character not found: ${panel.character.id}, using default protagonist`);
    character = theme.characters.find(c => c.id === theme.defaultProtagonist) || theme.characters[0];
  }
  
  const visualStyle = character?.visualStyle || panel.character.visualStyle || 'Cute animated character in chibi style';
  const colorPalette = character?.colorPalette || theme.colorScheme;
  
  console.log(`[Comic] Panel ${panelIndex + 1} using character: ${character?.displayName || panel.character.displayName} (visualStyle length: ${visualStyle?.length || 0})`);

  let prompt = `Create a professional financial infographic poster in ${theme.overallStyle}.
Canvas: Square format (1:1 aspect ratio, 1024x1024 pixels)

=== PANEL ${panelIndex + 1}: ${panel.sectionTitle} ===
Panel Type: ${panel.panelType}
Theme: ${theme.name}

=== CHARACTER ===
Character: ${panel.character.displayName}
Visual Style: ${visualStyle}
Personality: ${panel.character.personality}
Expression/Mood: ${panel.mood}
Action: ${panel.action}
${panel.dialogue ? `Speech Bubble: "${panel.dialogue}"` : ''}

Character Design Requirements:
- Must match the ${theme.name} art style
- Color palette: ${colorPalette.join(', ')}
- Chibi/cute proportions with expressive features
- Character size: 25-35% of poster space
- Position: ${panelTheme?.characterRole === 'EXPERT' ? 'Central, prominent' : 'Side or corner, complementing content'}

=== SCENE ===
${panel.scene}
${panel.visualMetaphor ? `Visual Metaphor: ${panel.visualMetaphor}` : ''}
`;

  // 根据内容风格添加布局指令
  if (styleConfig.enforceSubPanels && panel.subPanels) {
    prompt += `
=== LAYOUT: Strict 2x2 Grid ===
4 equal-sized information cards in 2x2 arrangement:
`;
    panel.subPanels.forEach((sp, idx) => {
      prompt += `
Card ${idx + 1} (${['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'][idx]}):
- Number: ${sp.number}
- Title: ${sp.title}
- Content: ${sp.content}
- Icon: ${sp.icon}
${sp.highlight ? `- Highlight: ${sp.highlight}` : ''}
`;
    });
  } else if (panel.layoutChoice) {
    prompt += `
=== LAYOUT: ${panel.layoutChoice} ===
${panel.layoutDescription || 'Flexible creative layout'}
`;
    
    if (panel.dataElements && panel.dataElements.length > 0) {
      prompt += `
=== DATA ELEMENTS ===
`;
      panel.dataElements.forEach((elem, idx) => {
        prompt += `Element ${idx + 1}: ${elem.type} - "${elem.label}: ${elem.value}" at ${elem.position || 'auto'} (${elem.size || 'medium'})
`;
      });
    }
  }

  // 风险面板特殊处理
  if (panelIndex === 5) {
    prompt += `
=== SAFETY: Risk Panel ===
IMPORTANT: Professional risk analysis aesthetic.
DO NOT use: Warning triangles, danger signs, fire, skulls, scary imagery
USE instead: Clipboard, checklist, magnifying glass, shield icons, calm analytical visuals
Character should look: Thoughtful, analytical, professional (NOT alarmed or scared)
`;
  }

  // 结论面板免责声明
  if (panelIndex === 7) {
    prompt += `
=== DISCLAIMER REQUIRED ===
Must include visible text in image: "AI生成，仅供参考" (AI-generated, for reference only)
`;
  }

  // 文字渲染要求
  prompt += `
=== CRITICAL: CHINESE TEXT RENDERING ===
- Main Title: "${panel.sectionTitle}" in large, bold Chinese font at top
- Caption: "${panel.caption || ''}" in smaller text
- All Chinese text MUST be clearly readable
- High contrast, proper font hierarchy
- NO blurred or cut-off text

=== STYLE & QUALITY ===
Overall style: ${theme.overallStyle}
Color scheme: ${theme.colorScheme.join(', ')}
Quality: 4K resolution, high detail
Background: Soft gradient or themed background matching ${theme.name}

=== OUTPUT ===
Generate a single cohesive infographic poster combining all elements above.`;

  return prompt;
}

// ============ 预设角色分配（不需要AI选择时使用）============

/**
 * 根据主题预设每个面板的角色
 * 使用 ipThemeService 的智能选择算法
 */
export function getPresetCharacterAssignment(themeId: string): Map<number, ThemeCharacter> {
  return ipThemeService.selectCharactersForPanels(themeId);
}

/**
 * 将预设角色分配转换为简化格式
 */
export function getSimplifiedCharacterAssignment(themeId: string): Array<{
  panelIndex: number;
  panelType: PanelType;
  characterId: string;
  characterName: string;
  displayName: string;
}> {
  const assignment = getPresetCharacterAssignment(themeId);
  const result: Array<{
    panelIndex: number;
    panelType: PanelType;
    characterId: string;
    characterName: string;
    displayName: string;
  }> = [];

  assignment.forEach((char, panelIndex) => {
    result.push({
      panelIndex,
      panelType: PANEL_INDEX_TO_TYPE[panelIndex],
      characterId: char.id,
      characterName: char.name,
      displayName: char.displayName,
    });
  });

  return result.sort((a, b) => a.panelIndex - b.panelIndex);
}

// ============ 主题列表API辅助 ============

/**
 * 获取主题列表概览（适合API返回）
 */
export function getThemeListOverview(): Array<{
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  source: string;
  characterCount: number;
  characters: Array<{
    id: string;
    name: string;
    displayName: string;
    personalityType: string;
  }>;
  suitableFor: string[];
}> {
  return ALL_IP_THEMES.map(theme => ({
    id: theme.id,
    name: theme.name,
    nameEn: theme.nameEn,
    description: theme.description,
    icon: theme.icon,
    source: theme.source,
    characterCount: theme.characters.length,
    characters: theme.characters.map(c => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      personalityType: c.personalityType,
    })),
    suitableFor: theme.suitableFor,
  }));
}

/**
 * 获取主题详情（包含完整角色信息）
 */
export function getThemeDetail(themeId: string): IPTheme | null {
  return ipThemeService.getTheme(themeId) || null;
}

/**
 * 获取主题的预设角色分配预览
 */
export function getThemeCharacterPreview(themeId: string): Array<{
  panelIndex: number;
  panelName: string;
  panelType: PanelType;
  character: {
    id: string;
    displayName: string;
    personality: string;
    sampleDialogue: string;
  };
}> {
  const theme = ipThemeService.getTheme(themeId);
  if (!theme) return [];

  const assignment = getPresetCharacterAssignment(themeId);
  const result: Array<{
    panelIndex: number;
    panelName: string;
    panelType: PanelType;
    character: {
      id: string;
      displayName: string;
      personality: string;
      sampleDialogue: string;
    };
  }> = [];

  assignment.forEach((char, panelIndex) => {
    const panelType = PANEL_INDEX_TO_TYPE[panelIndex];
    const panelTheme = PANEL_THEMES[panelIndex];
    
    // 根据面板类型选择合适的对话示例
    let sampleDialogue: string;
    switch (panelType) {
      case 'intro':
        sampleDialogue = char.dialogueStyle.greeting.replace('{company}', '示例公司');
        break;
      case 'risk':
        sampleDialogue = char.dialogueStyle.warning.replace('{risk}', '需关注的风险');
        break;
      case 'conclusion':
        sampleDialogue = char.dialogueStyle.conclusion.replace('{company}', '示例公司');
        break;
      default:
        sampleDialogue = char.dialogueStyle.analysis
          .replace('{metric}', '营收增长率')
          .replace('{value}', '15%');
    }

    result.push({
      panelIndex,
      panelName: panelTheme?.name || `面板${panelIndex + 1}`,
      panelType,
      character: {
        id: char.id,
        displayName: char.displayName,
        personality: char.personality,
        sampleDialogue,
      },
    });
  });

  return result;
}

export default {
  buildMultiCharacterSystemPrompt,
  buildMultiCharacterUserPrompt,
  buildMultiCharacterImagePrompt,
  getPresetCharacterAssignment,
  getSimplifiedCharacterAssignment,
  getThemeListOverview,
  getThemeDetail,
  getThemeCharacterPreview,
};
