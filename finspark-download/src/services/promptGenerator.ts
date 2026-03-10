/**
 * Prompt 生成器服务
 * 
 * 功能：
 * - System Prompt 与用户 Prompt 隔离
 * - 安全边界标记
 * - Prompt 组装逻辑
 * - 人格修饰词应用
 */

import { ANALYSIS_PERSONALITIES, applyPersonalityToPrompt } from './analysisPersonality';

// Prompt 分段标记
export const PROMPT_BOUNDARIES = {
  SYSTEM_START: '<<<SYSTEM_PROMPT_START>>>',
  SYSTEM_END: '<<<SYSTEM_PROMPT_END>>>',
  USER_START: '<<<USER_REQUIREMENTS_START>>>',
  USER_END: '<<<USER_REQUIREMENTS_END>>>',
  CONTEXT_START: '<<<CONTEXT_DATA_START>>>',
  CONTEXT_END: '<<<CONTEXT_DATA_END>>>',
};

// System Prompt 模板（核心逻辑，不可被用户覆盖）
export const SYSTEM_PROMPTS: Record<string, string> = {
  // 核心分析框架
  ANALYSIS_FRAMEWORK: `你是一个专业的财务分析助手。请严格按照以下要求进行分析：
1. 所有数据必须基于提供的财报原文
2. 结论必须有数据支撑，不得捏造数据
3. 涉及预测时必须标明假设条件
4. 风险提示必须客观呈现
5. 不得给出具体的买卖建议或目标价（除非配置允许）`,

  // 输出格式要求
  OUTPUT_FORMAT: `输出格式要求：
- 使用 Markdown 格式
- 关键数据使用表格呈现
- 重要结论使用加粗标记
- 风险提示使用引用块`,

  // 数据准确性要求
  DATA_ACCURACY: `数据准确性要求：
- 财务数据必须与原文一致
- 计算结果需可验证
- 不确定信息需标注
- 无法获取的数据标注为"暂无数据"`,
};

// Agent 专属 System Prompt
export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  PLANNING: `作为分析规划 Agent，你的任务是制定完整的分析计划。请确定需要分析的维度、数据需求和分析顺序。`,

  PROFITABILITY: `作为盈利能力分析 Agent，重点分析：
- 收入结构和增长趋势
- 毛利率和净利率变化
- 成本结构和效率
- 盈利质量和可持续性`,

  BALANCE_SHEET: `作为资产负债分析 Agent，重点分析：
- 资产质量和结构
- 负债水平和偿债能力
- 流动性和营运资本
- 财务杠杆和风险`,

  CASH_FLOW: `作为现金流分析 Agent，重点分析：
- 经营活动现金流质量
- 自由现金流水平
- 现金转化效率
- 资本开支和投资回报`,

  EARNINGS_QUALITY: `作为盈余质量分析 Agent，重点分析：
- 利润与现金流匹配度
- 应收账款质量
- 会计政策变更影响
- 潜在财务风险信号`,

  TREND_INTERPRETATION: `作为趋势解读 Agent，重点分析：
- 历史趋势和周期性
- 季节性因素
- 拐点识别
- 行业背景下的趋势意义`,

  RISK: `作为风险评估 Agent，重点分析：
- 财务风险（杠杆、流动性）
- 经营风险（业务集中度、客户依赖）
- 行业风险（周期性、政策影响）
- 宏观风险（汇率、利率敏感性）`,

  BUSINESS_INSIGHT: `作为商业洞察 Agent，重点分析：
- 主营业务构成和变化
- 市场地位和竞争优势
- 业务增长驱动因素
- 潜在增长机会`,

  BUSINESS_MODEL: `作为商业模式分析 Agent，重点分析：
- 价值创造方式
- 盈利模式和收入来源
- 竞争壁垒和护城河
- 可持续性和可扩展性`,

  INDUSTRY_COMPARISON: `作为行业对比分析 Agent，重点分析：
- 关键指标横向对比
- 行业地位评估
- 相对优劣势
- 估值合理性`,

  FORECAST: `作为业绩预测 Agent，重点分析：
- 历史增长规律
- 关键驱动因素假设
- 多情景预测
- 预测置信度说明
注意：所有预测必须明确标注假设条件和不确定性。`,

  VALUATION: `作为估值评估 Agent，重点分析：
- 多种估值方法交叉验证
- 估值假设和敏感性
- 与历史估值对比
- 与同业估值对比
注意：估值结果仅供参考，不构成投资建议。`,

  FINAL_CONCLUSION: `作为投资结论 Agent，需要：
- 综合所有分析结果
- 给出清晰的投资评级
- 总结关键要点
- 明确风险提示
注意：结论必须基于分析证据，并附带完整风险提示。`,
};

// Prompt 组装接口
export interface PromptAssemblyOptions {
  agentType: string;
  basePrompt?: string;
  userCustomPrompt?: string | null;
  personalityId?: string;
  contextData?: string;
  configOverrides?: Record<string, unknown>;
}

// Prompt 组装结果
export interface AssembledPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
  metadata: {
    hasUserCustomization: boolean;
    personalityApplied: string | null;
    boundariesUsed: boolean;
  };
}

/**
 * 组装完整的 Prompt
 * 
 * 结构：
 * 1. System Prompt（不可被用户覆盖）
 *    - 核心分析框架
 *    - Agent 专属指令
 *    - 输出格式要求
 * 
 * 2. User Requirements（用户自定义，被边界隔离）
 *    - 用户自定义 Prompt
 *    - 人格修饰词
 * 
 * 3. Context Data（运行时注入）
 *    - 公司信息
 *    - 财报数据
 *    - 配置参数
 */
export function assemblePrompt(options: PromptAssemblyOptions): AssembledPrompt {
  const {
    agentType,
    basePrompt = '',
    userCustomPrompt,
    personalityId,
    contextData = '',
    configOverrides = {},
  } = options;

  // 1. 构建 System Prompt（核心，不可被覆盖）
  const systemParts: string[] = [
    PROMPT_BOUNDARIES.SYSTEM_START,
    SYSTEM_PROMPTS.ANALYSIS_FRAMEWORK,
    '',
    AGENT_SYSTEM_PROMPTS[agentType] || '',
    '',
    SYSTEM_PROMPTS.DATA_ACCURACY,
    '',
    SYSTEM_PROMPTS.OUTPUT_FORMAT,
    PROMPT_BOUNDARIES.SYSTEM_END,
  ];
  const systemPrompt = systemParts.filter(Boolean).join('\n');

  // 2. 构建用户部分
  const userParts: string[] = [];

  // 2.1 基础 Prompt（官方默认）
  if (basePrompt) {
    userParts.push(basePrompt);
  }

  // 2.2 用户自定义 Prompt（安全隔离）
  if (userCustomPrompt && userCustomPrompt.trim()) {
    userParts.push('');
    userParts.push(PROMPT_BOUNDARIES.USER_START);
    userParts.push('--- 用户自定义要求 ---');
    userParts.push(sanitizeUserPrompt(userCustomPrompt));
    userParts.push(PROMPT_BOUNDARIES.USER_END);
  }

  // 2.3 应用人格修饰词
  let personalityApplied: string | null = null;
  if (personalityId && agentType === 'FINAL_CONCLUSION') {
    const modifier = applyPersonalityToPrompt(agentType, '', personalityId);
    if (modifier) {
      userParts.push('');
      userParts.push('--- 分析风格要求 ---');
      userParts.push(modifier);
      personalityApplied = personalityId;
    }
  }

  const userPrompt = userParts.join('\n');

  // 3. 上下文数据（运行时注入）
  const contextPart = contextData ? [
    '',
    PROMPT_BOUNDARIES.CONTEXT_START,
    contextData,
    PROMPT_BOUNDARIES.CONTEXT_END,
  ].join('\n') : '';

  // 4. 组装完整 Prompt
  const fullPrompt = [systemPrompt, userPrompt, contextPart].filter(Boolean).join('\n\n');

  return {
    systemPrompt,
    userPrompt,
    fullPrompt,
    metadata: {
      hasUserCustomization: Boolean(userCustomPrompt && userCustomPrompt.trim()),
      personalityApplied,
      boundariesUsed: true,
    },
  };
}

/**
 * 清理用户输入的 Prompt
 * 移除可能干扰系统指令的内容
 */
export function sanitizeUserPrompt(input: string): string {
  if (!input) return '';

  let sanitized = input;

  // 移除边界标记（防止用户伪造边界）
  Object.values(PROMPT_BOUNDARIES).forEach((boundary) => {
    sanitized = sanitized.replace(new RegExp(boundary.replace(/[<>]/g, '\\$&'), 'gi'), '');
  });

  // 移除可能的系统指令覆盖尝试
  const dangerousPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi,
    /forget\s+(everything|all|what)/gi,
    /you\s+are\s+now\s+a/gi,
    /new\s+instructions?:/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /\[INST\]/gi,
    /<<SYS>>/gi,
  ];

  dangerousPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[已过滤]');
  });

  // 限制长度
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  return sanitized.trim();
}

/**
 * 验证 Prompt 是否安全
 */
export function isPromptSafe(prompt: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // 检查是否包含边界标记
  Object.values(PROMPT_BOUNDARIES).forEach((boundary) => {
    if (prompt.includes(boundary)) {
      warnings.push('检测到系统边界标记');
    }
  });

  // 检查危险模式
  const dangerousPatterns = [
    { pattern: /ignore\s+(all\s+)?(previous|above)/i, message: '检测到指令覆盖尝试' },
    { pattern: /forget\s+everything/i, message: '检测到指令覆盖尝试' },
    { pattern: /you\s+are\s+now/i, message: '检测到角色重定义尝试' },
    { pattern: /system\s*:/i, message: '检测到系统消息伪造尝试' },
  ];

  dangerousPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(prompt)) {
      warnings.push(message);
    }
  });

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * 获取 Agent 的默认 Base Prompt
 */
export function getAgentBasePrompt(agentType: string, config: Record<string, unknown> = {}): string {
  const depth = config.analysisDepth as string || 'standard';
  const depthModifiers: Record<string, string> = {
    quick: '请快速给出核心结论，简明扼要，控制在 300 字以内。',
    standard: '请进行标准深度分析，平衡全面性和简洁性。',
    deep: '请进行深度分析，详细阐述各个维度，提供完整论证。',
  };

  return depthModifiers[depth] || depthModifiers.standard;
}

export default {
  PROMPT_BOUNDARIES,
  SYSTEM_PROMPTS,
  AGENT_SYSTEM_PROMPTS,
  assemblePrompt,
  sanitizeUserPrompt,
  isPromptSafe,
  getAgentBasePrompt,
};
