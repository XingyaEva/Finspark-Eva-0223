/**
 * 分析人格系统
 * 
 * 定义不同的分析风格人格，影响 FINAL_CONCLUSION Agent 的输出风格。
 * 架构预留扩展能力，未来可扩展到其他 Agent。
 */

import type { AgentType } from './vectorengine';

// ============================================
// 类型定义
// ============================================

export type PersonalityId = 'prudent' | 'decisive' | 'risk_aware';

export interface PersonalityConfig {
  id: PersonalityId;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  description: string;
  descriptionEn: string;
  /** 适用场景说明 */
  suitableFor: string;
  suitableForEn: string;
  /** 按 Agent 类型定义的 Prompt 修饰词，预留扩展 */
  promptModifiers: Partial<Record<AgentType | '_global', string>>;
}

// ============================================
// 分析人格定义
// ============================================

export const ANALYSIS_PERSONALITIES: Record<PersonalityId, PersonalityConfig> = {
  /**
   * 冷静审慎型
   * 特点：强调风险、保守评估、谨慎措辞
   */
  prudent: {
    id: 'prudent',
    name: '冷静审慎型',
    nameEn: 'Prudent Analyst',
    icon: 'fa-shield-halved',
    color: '#3b82f6', // 蓝色
    description: '强调风险提示，保守评估，适合风险厌恶型投资者',
    descriptionEn: 'Emphasizes risk warnings and conservative assessments',
    suitableFor: '风险厌恶型投资者、长期价值投资者',
    suitableForEn: 'Risk-averse investors, long-term value investors',
    promptModifiers: {
      FINAL_CONCLUSION: `
## 分析风格要求：冷静审慎型

在生成投资结论时，请严格遵循以下风格要求：

1. **风险优先**
   - 优先识别并强调潜在风险和不确定性因素
   - 对每个投资观点都要思考"如果错了会怎样"
   - 风险提示要具体、可量化，避免泛泛而谈

2. **保守假设**
   - 估值判断采用保守假设，宁可低估不可高估
   - 对管理层指引和市场预期打折处理
   - 优先考虑下行风险情景

3. **审慎措辞**
   - 结论措辞谨慎，避免过度乐观的表述
   - 使用"可能"、"预计"、"存在风险"等审慎用语
   - 投资评级倾向于中性或谨慎

4. **前提明确**
   - 明确标注关键假设和前提条件
   - 说明结论成立的边界条件
   - 提示哪些情况下结论可能失效
`,
      // 预留：未来可扩展到其他 Agent
      // VALUATION: '估值时采用更保守的假设...',
      // FORECAST: '预测时偏向悲观情景...',
    },
  },

  /**
   * 决策导向型
   * 特点：结论明确、操作建议具体、高效直接
   */
  decisive: {
    id: 'decisive',
    name: '决策导向型',
    nameEn: 'Decision-Oriented',
    icon: 'fa-bullseye',
    color: '#f59e0b', // 橙色
    description: '直接给出明确建议，适合追求效率的投资者',
    descriptionEn: 'Provides clear and actionable recommendations',
    suitableFor: '追求效率的投资者、机构交易员',
    suitableForEn: 'Efficiency-focused investors, institutional traders',
    promptModifiers: {
      FINAL_CONCLUSION: `
## 分析风格要求：决策导向型

在生成投资结论时，请严格遵循以下风格要求：

1. **结论明确**
   - 避免模棱两可的表述，给出清晰的判断
   - 投资评级必须明确（买入/增持/持有/减持/卖出）
   - 核心观点用一句话概括，开门见山

2. **操作具体**
   - 给出具体的操作建议和时机判断
   - 如适用，提供明确的目标价位或区间
   - 说明建议的持有期限和仓位建议

3. **优先级清晰**
   - 按重要性排序投资要点
   - 突出最核心的 2-3 个决策因素
   - 区分"必须关注"和"可以关注"的因素

4. **简洁有力**
   - 简洁有力，突出核心观点
   - 减少铺垫和背景描述
   - 每个段落都要有明确的结论指向
`,
    },
  },

  /**
   * 风险提示强化型
   * 特点：合规导向、风险警示全面、免责声明完备
   */
  risk_aware: {
    id: 'risk_aware',
    name: '风险提示强化型',
    nameEn: 'Risk-Disclosure Enhanced',
    icon: 'fa-triangle-exclamation',
    color: '#ef4444', // 红色
    description: '每个结论都附带风险提示，适合机构合规需求',
    descriptionEn: 'Every conclusion includes risk disclosures, suitable for compliance',
    suitableFor: '机构投资者、合规要求高的场景',
    suitableForEn: 'Institutional investors, high-compliance scenarios',
    promptModifiers: {
      FINAL_CONCLUSION: `
## 分析风格要求：风险提示强化型

在生成投资结论时，请严格遵循以下风格要求：

1. **风险伴随**
   - 每个投资观点必须附带对应的风险提示
   - 正面观点后紧跟潜在风险说明
   - 使用"但需注意"、"风险在于"等过渡语

2. **不确定性标注**
   - 明确标注分析的局限性和不确定因素
   - 区分"高确定性"和"低确定性"的判断
   - 说明数据来源和时效性限制

3. **事实与判断分离**
   - 明确区分事实陈述和主观判断
   - 对主观判断使用"我们认为"、"分析显示"等表述
   - 避免将推测表述为确定性结论

4. **免责与提示**
   - 在适当位置添加必要的免责声明提示
   - 提醒读者本分析仅供参考，不构成投资建议
   - 建议投资者结合自身情况独立判断
`,
    },
  },
};

// ============================================
// 工具函数
// ============================================

/**
 * 获取人格配置
 */
export function getPersonality(personalityId: PersonalityId): PersonalityConfig | undefined {
  return ANALYSIS_PERSONALITIES[personalityId];
}

/**
 * 获取所有人格列表
 */
export function getAllPersonalities(): PersonalityConfig[] {
  return Object.values(ANALYSIS_PERSONALITIES);
}

/**
 * 获取人格的 Prompt 修饰词
 * @param personalityId 人格 ID
 * @param agentType Agent 类型
 * @returns Prompt 修饰词，如果没有则返回空字符串
 */
export function getPersonalityPromptModifier(
  personalityId: PersonalityId,
  agentType: AgentType
): string {
  const personality = ANALYSIS_PERSONALITIES[personalityId];
  if (!personality) return '';

  // 优先使用 Agent 专属修饰词，回退到全局修饰词
  return personality.promptModifiers[agentType] || personality.promptModifiers['_global'] || '';
}

/**
 * 将人格应用到 Prompt
 * @param basePrompt 基础 Prompt
 * @param personalityId 人格 ID
 * @param agentType Agent 类型
 * @returns 应用人格后的 Prompt
 */
export function applyPersonalityToPrompt(
  basePrompt: string,
  personalityId: PersonalityId | undefined,
  agentType: AgentType
): string {
  if (!personalityId) return basePrompt;

  const modifier = getPersonalityPromptModifier(personalityId, agentType);
  if (!modifier) return basePrompt;

  return `${basePrompt}\n\n${modifier}`;
}

/**
 * 检查人格是否支持指定的 Agent
 * @param personalityId 人格 ID
 * @param agentType Agent 类型
 * @returns 是否支持
 */
export function isPersonalitySupportedForAgent(
  personalityId: PersonalityId,
  agentType: AgentType
): boolean {
  const personality = ANALYSIS_PERSONALITIES[personalityId];
  if (!personality) return false;

  return !!(personality.promptModifiers[agentType] || personality.promptModifiers['_global']);
}

/**
 * 获取支持人格选择的 Agent 列表
 * 当前仅 FINAL_CONCLUSION 支持，未来可扩展
 */
export function getPersonalitySupportedAgents(): AgentType[] {
  // 遍历所有人格，收集支持的 Agent
  const supportedAgents = new Set<AgentType>();
  
  for (const personality of Object.values(ANALYSIS_PERSONALITIES)) {
    for (const key of Object.keys(personality.promptModifiers)) {
      if (key !== '_global') {
        supportedAgents.add(key as AgentType);
      }
    }
  }
  
  return Array.from(supportedAgents);
}

// ============================================
// 默认导出
// ============================================

export default {
  ANALYSIS_PERSONALITIES,
  getPersonality,
  getAllPersonalities,
  getPersonalityPromptModifier,
  applyPersonalityToPrompt,
  isPersonalitySupportedForAgent,
  getPersonalitySupportedAgents,
};
