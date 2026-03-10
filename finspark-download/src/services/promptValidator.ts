/**
 * Prompt 校验服务
 * 
 * 功能：
 * - 注入攻击检测
 * - 敏感词警告
 * - 长度限制校验
 * - 内容质量检查
 */

// 校验结果等级
export type ValidationSeverity = 'error' | 'warning' | 'info';

// 校验结果项
export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  details?: string;
  position?: { start: number; end: number };
}

// 校验结果
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  sanitizedPrompt: string | null;
  metadata: {
    originalLength: number;
    sanitizedLength: number;
    warningCount: number;
    errorCount: number;
  };
}

// 校验配置
export interface ValidationConfig {
  maxLength: number;
  allowMarkdown: boolean;
  strictMode: boolean;
  allowedLanguages: string[];
}

// 默认配置
export const DEFAULT_CONFIG: ValidationConfig = {
  maxLength: 500,
  allowMarkdown: true,
  strictMode: false,
  allowedLanguages: ['zh', 'en'],
};

// ============================================
// 注入攻击检测
// ============================================

// 注入攻击模式
const INJECTION_PATTERNS: Array<{ pattern: RegExp; code: string; message: string; severity: ValidationSeverity }> = [
  // 指令覆盖尝试
  {
    pattern: /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|context)/gi,
    code: 'INJECTION_IGNORE',
    message: '检测到指令覆盖尝试',
    severity: 'error',
  },
  {
    pattern: /forget\s+(everything|all|what\s+you\s+know)/gi,
    code: 'INJECTION_FORGET',
    message: '检测到记忆清除尝试',
    severity: 'error',
  },
  {
    pattern: /disregard\s+(all|the|any)\s+(previous|above|prior)/gi,
    code: 'INJECTION_DISREGARD',
    message: '检测到指令忽略尝试',
    severity: 'error',
  },

  // 角色劫持
  {
    pattern: /you\s+are\s+(now\s+)?a\s+/gi,
    code: 'INJECTION_ROLE_HIJACK',
    message: '检测到角色重定义尝试',
    severity: 'error',
  },
  {
    pattern: /act\s+as\s+(if\s+you\s+are|a)\s+/gi,
    code: 'INJECTION_ACT_AS',
    message: '检测到角色扮演指令',
    severity: 'warning',
  },
  {
    pattern: /pretend\s+(to\s+be|you\s+are)/gi,
    code: 'INJECTION_PRETEND',
    message: '检测到角色伪装尝试',
    severity: 'warning',
  },

  // 系统消息伪造
  {
    pattern: /system\s*:\s*$/gim,
    code: 'INJECTION_SYSTEM',
    message: '检测到系统消息伪造',
    severity: 'error',
  },
  {
    pattern: /assistant\s*:\s*$/gim,
    code: 'INJECTION_ASSISTANT',
    message: '检测到助手消息伪造',
    severity: 'error',
  },
  {
    pattern: /human\s*:\s*$/gim,
    code: 'INJECTION_HUMAN',
    message: '检测到用户消息伪造',
    severity: 'warning',
  },

  // 特殊指令格式
  {
    pattern: /\[INST\]|\[\/INST\]/gi,
    code: 'INJECTION_INST_TAG',
    message: '检测到指令标签',
    severity: 'error',
  },
  {
    pattern: /<<SYS>>|<<\/SYS>>/gi,
    code: 'INJECTION_SYS_TAG',
    message: '检测到系统标签',
    severity: 'error',
  },
  {
    pattern: /###\s*(instruction|system|assistant)/gi,
    code: 'INJECTION_SECTION_MARKER',
    message: '检测到段落标记',
    severity: 'warning',
  },

  // 输出操控
  {
    pattern: /output\s+only|respond\s+with\s+only/gi,
    code: 'INJECTION_OUTPUT_CONTROL',
    message: '检测到输出控制尝试',
    severity: 'warning',
  },
  {
    pattern: /do\s+not\s+(include|mention|say)\s+(any|the)/gi,
    code: 'INJECTION_NEGATIVE_CONTROL',
    message: '检测到输出限制尝试',
    severity: 'info',
  },

  // 边界探测
  {
    pattern: /<<<.*>>>/g,
    code: 'INJECTION_BOUNDARY',
    message: '检测到边界标记',
    severity: 'error',
  },
];

// ============================================
// 敏感词检测
// ============================================

// 敏感词类别
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; code: string; message: string; severity: ValidationSeverity }> = [
  // 财务相关敏感词
  {
    pattern: /内幕|内部消息|操纵股价|庄家/g,
    code: 'SENSITIVE_INSIDER',
    message: '涉及内幕交易相关词汇',
    severity: 'warning',
  },
  {
    pattern: /保证.*收益|稳赚不赔|百分之百/g,
    code: 'SENSITIVE_GUARANTEE',
    message: '涉及收益保证相关词汇',
    severity: 'warning',
  },

  // 潜在误导
  {
    pattern: /必须买入|赶紧买|现在卖出/g,
    code: 'SENSITIVE_URGENT',
    message: '涉及紧急交易建议',
    severity: 'warning',
  },

  // 规避审计提示
  {
    pattern: /绕过.*校验|跳过.*检查|无视.*限制/g,
    code: 'SENSITIVE_BYPASS',
    message: '涉及规避检查相关词汇',
    severity: 'error',
  },
];

// ============================================
// 内容质量检查
// ============================================

// 质量问题模式
const QUALITY_PATTERNS: Array<{ pattern: RegExp; code: string; message: string; severity: ValidationSeverity }> = [
  // 过度重复
  {
    pattern: /(.{10,})\1{2,}/g,
    code: 'QUALITY_REPETITION',
    message: '检测到内容重复',
    severity: 'warning',
  },

  // 过多特殊字符
  {
    pattern: /[!@#$%^&*]{5,}/g,
    code: 'QUALITY_SPECIAL_CHARS',
    message: '检测到过多特殊字符',
    severity: 'info',
  },

  // 全大写（英文）
  {
    pattern: /[A-Z]{20,}/g,
    code: 'QUALITY_ALL_CAPS',
    message: '检测到过长全大写文本',
    severity: 'info',
  },
];

// ============================================
// 主校验函数
// ============================================

/**
 * 校验用户输入的 Prompt
 */
export function validatePrompt(input: string, config: Partial<ValidationConfig> = {}): ValidationResult {
  const cfg: ValidationConfig = { ...DEFAULT_CONFIG, ...config };
  const issues: ValidationIssue[] = [];

  // 空输入检查
  if (!input || input.trim().length === 0) {
    return {
      valid: true,
      issues: [],
      sanitizedPrompt: '',
      metadata: {
        originalLength: 0,
        sanitizedLength: 0,
        warningCount: 0,
        errorCount: 0,
      },
    };
  }

  const originalLength = input.length;
  let sanitized = input;

  // 1. 长度校验
  if (input.length > cfg.maxLength) {
    issues.push({
      code: 'LENGTH_EXCEEDED',
      severity: 'error',
      message: `内容长度超出限制（${input.length}/${cfg.maxLength}）`,
      details: '请精简内容或删除部分文字',
    });
    sanitized = sanitized.substring(0, cfg.maxLength);
  } else if (input.length > cfg.maxLength * 0.9) {
    issues.push({
      code: 'LENGTH_WARNING',
      severity: 'warning',
      message: `内容长度接近上限（${input.length}/${cfg.maxLength}）`,
    });
  }

  // 2. 注入攻击检测
  INJECTION_PATTERNS.forEach(({ pattern, code, message, severity }) => {
    const matches = input.match(pattern);
    if (matches) {
      issues.push({
        code,
        severity,
        message,
        details: `检测到: "${matches[0].substring(0, 30)}${matches[0].length > 30 ? '...' : ''}"`,
      });

      // 清理危险内容
      if (severity === 'error') {
        sanitized = sanitized.replace(pattern, '[已过滤]');
      }
    }
  });

  // 3. 敏感词检测
  SENSITIVE_PATTERNS.forEach(({ pattern, code, message, severity }) => {
    const matches = input.match(pattern);
    if (matches) {
      issues.push({
        code,
        severity,
        message,
        details: `包含敏感词: "${matches.join('", "')}"`,
      });

      // 严格模式下清理敏感内容
      if (cfg.strictMode && severity === 'error') {
        sanitized = sanitized.replace(pattern, '[敏感词]');
      }
    }
  });

  // 4. 内容质量检查
  QUALITY_PATTERNS.forEach(({ pattern, code, message, severity }) => {
    if (pattern.test(input)) {
      issues.push({
        code,
        severity,
        message,
      });
    }
  });

  // 5. 计算统计信息
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  // 6. 确定是否有效
  const valid = cfg.strictMode ? errorCount === 0 && warningCount === 0 : errorCount === 0;

  return {
    valid,
    issues,
    sanitizedPrompt: valid ? sanitized.trim() : null,
    metadata: {
      originalLength,
      sanitizedLength: sanitized.trim().length,
      warningCount,
      errorCount,
    },
  };
}

/**
 * 快速检查 Prompt 是否安全（用于实时校验）
 */
export function quickValidate(input: string): { safe: boolean; message?: string } {
  if (!input || input.length === 0) {
    return { safe: true };
  }

  // 只检查严重的注入攻击
  const criticalPatterns = INJECTION_PATTERNS.filter((p) => p.severity === 'error');

  for (const { pattern, message } of criticalPatterns) {
    if (pattern.test(input)) {
      return { safe: false, message };
    }
  }

  return { safe: true };
}

/**
 * 清理 Prompt（移除所有检测到的问题内容）
 */
export function sanitizePrompt(input: string): string {
  if (!input) return '';

  let sanitized = input;

  // 移除注入攻击内容
  INJECTION_PATTERNS.forEach(({ pattern, severity }) => {
    if (severity === 'error') {
      sanitized = sanitized.replace(pattern, '');
    }
  });

  // 移除边界标记
  sanitized = sanitized.replace(/<<<[^>]*>>>/g, '');

  // 修剪空白
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n').trim();

  return sanitized;
}

/**
 * 格式化校验结果为用户友好的消息
 */
export function formatValidationMessage(result: ValidationResult): string {
  if (result.valid && result.issues.length === 0) {
    return '校验通过';
  }

  const messages: string[] = [];

  if (result.metadata.errorCount > 0) {
    messages.push(`发现 ${result.metadata.errorCount} 个错误`);
  }

  if (result.metadata.warningCount > 0) {
    messages.push(`发现 ${result.metadata.warningCount} 个警告`);
  }

  const topIssues = result.issues.slice(0, 3).map((i) => `• ${i.message}`);

  return [...messages, ...topIssues].join('\n');
}

export default {
  validatePrompt,
  quickValidate,
  sanitizePrompt,
  formatValidationMessage,
  DEFAULT_CONFIG,
};
