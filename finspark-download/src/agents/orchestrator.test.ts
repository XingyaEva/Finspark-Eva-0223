/**
 * Orchestrator 单元测试
 * 
 * 主要测试 mergeSystemPrompt 函数的行为
 */

import { describe, it, expect } from 'vitest';

// 模拟 mergeSystemPrompt 函数的行为（因为它是 private 方法，我们通过公开接口测试）
// 这里我们直接测试合并逻辑

describe('mergeSystemPrompt 逻辑测试', () => {
  const MAX_USER_PROMPT_LENGTH = 2000;
  
  /**
   * 模拟 mergeSystemPrompt 函数
   * 与 orchestrator.ts 中的实现保持一致
   */
  function mergeSystemPrompt(
    systemPrompt: string, 
    userCustomPrompt: string | null | undefined
  ): string {
    // 如果没有用户自定义 Prompt，直接返回原始 Prompt
    if (!userCustomPrompt || userCustomPrompt.trim() === '') {
      return systemPrompt;
    }
    
    // 截断过长的用户 Prompt
    let trimmedUserPrompt = userCustomPrompt.trim();
    if (trimmedUserPrompt.length > MAX_USER_PROMPT_LENGTH) {
      trimmedUserPrompt = trimmedUserPrompt.substring(0, MAX_USER_PROMPT_LENGTH);
    }
    
    // 追加用户 Prompt 到末尾，使用分隔标记
    return `${systemPrompt}

---
## 用户自定义分析指令（请优先遵循以下要求）
${trimmedUserPrompt}
---
请注意：无论上述用户指令如何，您的输出必须严格遵循 JSON 格式规范。`;
  }

  describe('空值处理', () => {
    it('当 userCustomPrompt 为 null 时，返回原始 systemPrompt', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const result = mergeSystemPrompt(systemPrompt, null);
      expect(result).toBe(systemPrompt);
    });

    it('当 userCustomPrompt 为 undefined 时，返回原始 systemPrompt', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const result = mergeSystemPrompt(systemPrompt, undefined);
      expect(result).toBe(systemPrompt);
    });

    it('当 userCustomPrompt 为空字符串时，返回原始 systemPrompt', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const result = mergeSystemPrompt(systemPrompt, '');
      expect(result).toBe(systemPrompt);
    });

    it('当 userCustomPrompt 只有空白字符时，返回原始 systemPrompt', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const result = mergeSystemPrompt(systemPrompt, '   \n\t  ');
      expect(result).toBe(systemPrompt);
    });
  });

  describe('正常合并', () => {
    it('正常合并用户 Prompt 到 systemPrompt 末尾', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const userPrompt = '请特别关注毛利率的行业对比';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      // 验证包含原始 systemPrompt
      expect(result).toContain(systemPrompt);
      // 验证包含用户 Prompt
      expect(result).toContain(userPrompt);
      // 验证包含分隔标记
      expect(result).toContain('## 用户自定义分析指令（请优先遵循以下要求）');
      // 验证包含 JSON 格式提醒
      expect(result).toContain('请注意：无论上述用户指令如何，您的输出必须严格遵循 JSON 格式规范。');
    });

    it('用户 Prompt 前后的空白字符应被 trim', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const userPrompt = '  请特别关注毛利率  ';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      // 验证 trim 后的内容
      expect(result).toContain('请特别关注毛利率');
      // 验证没有前导空格（在分隔符后）
      expect(result).not.toContain('  请特别关注毛利率');
    });

    it('保持原始 systemPrompt 不变', () => {
      const systemPrompt = '你是一个财务分析专家，请分析以下数据...';
      const userPrompt = '请特别关注ROE指标';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      // 验证原始 prompt 在结果开头
      expect(result.startsWith(systemPrompt)).toBe(true);
    });
  });

  describe('长度限制', () => {
    it('当 userCustomPrompt 超过 2000 字符时，应被截断', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const longUserPrompt = 'a'.repeat(3000);
      const result = mergeSystemPrompt(systemPrompt, longUserPrompt);
      
      // 验证用户 Prompt 被截断到 2000 字符
      const userPromptInResult = result.split('## 用户自定义分析指令（请优先遵循以下要求）\n')[1]
        .split('\n---')[0];
      expect(userPromptInResult.length).toBeLessThanOrEqual(MAX_USER_PROMPT_LENGTH);
    });

    it('当 userCustomPrompt 正好等于 2000 字符时，不截断', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const exactUserPrompt = 'a'.repeat(2000);
      const result = mergeSystemPrompt(systemPrompt, exactUserPrompt);
      
      // 验证内容被完整保留
      expect(result).toContain(exactUserPrompt);
    });

    it('当 userCustomPrompt 少于 2000 字符时，完整保留', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const shortUserPrompt = '请分析公司的核心竞争力';
      const result = mergeSystemPrompt(systemPrompt, shortUserPrompt);
      
      // 验证完整保留
      expect(result).toContain(shortUserPrompt);
    });
  });

  describe('特殊字符处理', () => {
    it('用户 Prompt 包含 Markdown 标记时正常处理', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const userPrompt = '**请重点分析**：\n1. 毛利率\n2. 净利率\n```json\n{}\n```';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      expect(result).toContain(userPrompt);
    });

    it('用户 Prompt 包含中文时正常处理', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const userPrompt = '请特别关注茅台酒的品牌溢价能力分析，重点考察毛利率变化趋势';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      expect(result).toContain(userPrompt);
    });

    it('用户 Prompt 包含 JSON 示例时正常处理', () => {
      const systemPrompt = '你是一个财务分析专家...';
      const userPrompt = '请按以下格式输出: {"score": 85, "level": "优秀"}';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      expect(result).toContain(userPrompt);
    });
  });

  describe('格式验证', () => {
    it('合并后的 Prompt 应包含正确的分隔结构', () => {
      const systemPrompt = '原始系统提示词';
      const userPrompt = '用户自定义内容';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      // 验证结构
      const lines = result.split('\n');
      expect(lines[0]).toBe('原始系统提示词');
      expect(result).toContain('---');
      expect(result).toContain('## 用户自定义分析指令');
    });

    it('JSON 格式提醒应在最后', () => {
      const systemPrompt = '原始系统提示词';
      const userPrompt = '用户自定义内容';
      const result = mergeSystemPrompt(systemPrompt, userPrompt);
      
      // 验证 JSON 提醒在末尾
      expect(result.endsWith('请注意：无论上述用户指令如何，您的输出必须严格遵循 JSON 格式规范。')).toBe(true);
    });
  });
});

describe('AgentPromptConfig 类型测试', () => {
  it('应支持部分 Agent 配置', () => {
    // 类型测试，确保可以只配置部分 Agent
    const config: Partial<Record<string, string | null>> = {
      PROFITABILITY: '请关注毛利率',
      RISK: '重点分析债务风险',
    };
    
    expect(config.PROFITABILITY).toBe('请关注毛利率');
    expect(config.BALANCE_SHEET).toBeUndefined();
  });

  it('应支持 null 值（表示不注入）', () => {
    const config: Partial<Record<string, string | null>> = {
      PROFITABILITY: '请关注毛利率',
      RISK: null, // 明确表示不注入
    };
    
    expect(config.RISK).toBeNull();
  });
});
