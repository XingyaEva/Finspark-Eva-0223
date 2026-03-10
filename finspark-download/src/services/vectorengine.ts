// VectorEngine API 服务封装
// 基于 OpenAI 兼容协议

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 模型配置 - 基于评估结果优化（2026-01-07 更新）
export const MODELS = {
  // 财报分析主模型 - GPT-4.1（评估结果：速度快、质量高、成本效益好）
  ANALYSIS: 'gpt-4.1',
  // 深度思考模型（用于复杂分析）
  THINKING: 'gpt-4.1',
  // 图片生成模型
  IMAGE_GEN: 'gemini-3-pro-image-preview',
  // 快速模型（用于简单任务）
  FAST: 'gpt-4.1',
  // 漫画脚本生成模型（升级到 gemini-3-pro-preview 以获得更高质量脚本）
  COMIC_SCRIPT: 'gemini-3-pro-preview',
} as const;

// ==================== Agent 模型配置系统 ====================

/**
 * 模型偏好标签 → 实际模型映射
 * 用户只看到标签，不暴露实际模型名称
 */
export const MODEL_PREFERENCE_MAP = {
  // L1 级别 - 分析模式
  'standard': 'gpt-4.1',              // 标准模式（推荐）
  'fast': 'gpt-4.1-mini',             // 快速模式
  
  // L2/L3 级别 - 模型偏好
  'rigorous': 'gpt-4.1',              // 严谨分析型（推荐）
  'deep_reasoning': 'deepseek-reasoner', // 深度推理型
  'chinese_enhanced': 'deepseek-chat',   // 中文表达增强型
  'quick_gen': 'gemini-2.5-flash',       // 快速生成型
  'balanced': 'claude-sonnet-4-20250514', // 均衡型
} as const;

export type ModelPreference = keyof typeof MODEL_PREFERENCE_MAP;

/**
 * Agent 类型定义
 */
export type AgentType = 
  | 'PLANNING'
  | 'PROFITABILITY'
  | 'BALANCE_SHEET'
  | 'CASH_FLOW'
  | 'EARNINGS_QUALITY'
  | 'TREND_INTERPRETATION'
  | 'RISK'
  | 'BUSINESS_INSIGHT'
  | 'BUSINESS_MODEL'
  | 'FORECAST'
  | 'VALUATION'
  | 'FINAL_CONCLUSION'
  | 'INDUSTRY_COMPARISON';

/**
 * Agent 模型配置 - 每个 Agent 可独立配置模型偏好
 */
export interface AgentModelConfig {
  PLANNING?: ModelPreference;
  PROFITABILITY?: ModelPreference;
  BALANCE_SHEET?: ModelPreference;
  CASH_FLOW?: ModelPreference;
  EARNINGS_QUALITY?: ModelPreference;
  TREND_INTERPRETATION?: ModelPreference;
  RISK?: ModelPreference;
  BUSINESS_INSIGHT?: ModelPreference;
  BUSINESS_MODEL?: ModelPreference;
  FORECAST?: ModelPreference;
  VALUATION?: ModelPreference;
  FINAL_CONCLUSION?: ModelPreference;
  INDUSTRY_COMPARISON?: ModelPreference;
}

/**
 * 默认 Agent 模型配置
 */
export const DEFAULT_AGENT_MODEL_CONFIG: AgentModelConfig = {
  PLANNING: 'standard',
  PROFITABILITY: 'standard',
  BALANCE_SHEET: 'standard',
  CASH_FLOW: 'standard',
  EARNINGS_QUALITY: 'standard',
  TREND_INTERPRETATION: 'standard',
  RISK: 'standard',
  BUSINESS_INSIGHT: 'standard',
  BUSINESS_MODEL: 'standard',
  FORECAST: 'standard',
  VALUATION: 'standard',
  FINAL_CONCLUSION: 'standard',
  INDUSTRY_COMPARISON: 'standard',
};

/**
 * 根据模型偏好获取实际模型名称
 */
export function getModelFromPreference(preference: ModelPreference): string {
  return MODEL_PREFERENCE_MAP[preference] || MODELS.ANALYSIS;
}

/**
 * 根据 Agent 类型和配置获取实际模型
 */
export function getAgentModel(
  agentType: AgentType, 
  config?: AgentModelConfig
): string {
  const preference = config?.[agentType] || DEFAULT_AGENT_MODEL_CONFIG[agentType] || 'standard';
  return getModelFromPreference(preference);
}

export class VectorEngineService {
  private baseUrl: string = 'https://api.vectorengine.ai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 发送聊天请求
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || MODELS.ANALYSIS,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 16384, // 增加到16384以确保深度分析输出完整
        top_p: options.topP ?? 1,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`VectorEngine API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * 流式聊天请求
   */
  async *chatStream(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || MODELS.ANALYSIS,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 16384,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`VectorEngine API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  /**
   * 生成财报分析 - 深度版本
   * @param systemPrompt 系统提示词
   * @param userPrompt 用户提示词
   * @param options 配置选项，包含 model 参数用于指定不同 Agent 使用不同模型
   */
  async analyzeFinancialReport(
    systemPrompt: string,
    userPrompt: string,
    options: ChatOptions = {}
  ): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // 优先使用传入的 model，否则使用默认分析模型
    const model = options.model || MODELS.ANALYSIS;

    const response = await this.chat(messages, {
      temperature: 0.3, // 财报分析使用较低温度确保准确性
      maxTokens: 16384, // 增加到16384确保深度分析输出完整
      ...options,
      model, // 确保 model 参数生效
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 生成JSON格式的财报分析
   * 使用特殊提示确保AI返回纯JSON格式
   * @param systemPrompt 系统提示词
   * @param userPrompt 用户提示词
   * @param options 配置选项，包含 model 参数用于指定不同 Agent 使用不同模型
   */
  async analyzeFinancialReportJson(
    systemPrompt: string,
    userPrompt: string,
    options: ChatOptions = {}
  ): Promise<string> {
    // 在系统提示中强调 JSON 输出
    const jsonSystemPrompt = `${systemPrompt}

【输出格式强制要求】
你的回复必须且只能是一个有效的JSON对象：
1. 以 { 开头，以 } 结尾
2. 不要包含任何markdown标记（如 \`\`\`json）
3. 不要输出任何解释性文字、标题、分隔符
4. 确保所有字符串值正确转义
5. 不要在JSON前后添加任何内容`;

    const messages: Message[] = [
      { role: 'system', content: jsonSystemPrompt },
      { role: 'user', content: userPrompt + '\n\n请直接输出JSON，不要任何其他内容：' },
    ];

    // 优先使用传入的 model，否则使用默认分析模型
    const model = options.model || MODELS.ANALYSIS;

    const response = await this.chat(messages, {
      temperature: 0.2, // 更低温度确保格式稳定
      maxTokens: 16384,
      ...options,
      model, // 确保 model 参数生效
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 生成漫画脚本（使用专用创意模型）
   */
  async generateComicScript(analysisData: string, systemPrompt: string): Promise<string> {
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请根据以下财报分析数据，创作拟人化财务漫画脚本：\n\n${analysisData}` },
    ];

    const response = await this.chat(messages, {
      model: MODELS.COMIC_SCRIPT, // 漫画脚本使用专用创意模型
      temperature: 0.8, // 创意任务使用较高温度
      maxTokens: 16384,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * 使用 Gemini 3 Pro 生成图片
   * 通过 chat completions 接口，使用特殊的图片生成模型
   */
  async generateImage(prompt: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'user',
        content: `Generate an image: ${prompt}`,
      },
    ];

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: MODELS.IMAGE_GEN,
          messages,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Image generation error:', response.status, errorText);
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const result = await response.json() as ChatResponse;
      const content = result.choices[0]?.message?.content || '';
      
      // Gemini 图片生成模型返回的内容可能包含图片URL或base64
      // 尝试从返回内容中提取图片URL
      const urlMatch = content.match(/https?:\/\/[^\s"']+\.(png|jpg|jpeg|gif|webp)/i);
      if (urlMatch) {
        return urlMatch[0];
      }
      
      // 如果返回的是 markdown 格式的图片
      const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      if (mdMatch) {
        return mdMatch[1];
      }

      // 如果是 base64 格式，直接返回内容
      if (content.startsWith('data:image')) {
        return content;
      }

      // 返回原始内容让调用者处理
      return content;
    } catch (error) {
      console.error('generateImage error:', error);
      throw error;
    }
  }

  /**
   * 批量生成漫画图片
   */
  async generateComicImages(panels: Array<{ imagePrompt: string }>): Promise<string[]> {
    const imageUrls: string[] = [];
    
    for (const panel of panels) {
      try {
        const url = await this.generateImage(panel.imagePrompt);
        imageUrls.push(url);
      } catch (error) {
        console.error('Failed to generate panel image:', error);
        imageUrls.push(''); // 失败时添加空字符串
      }
    }
    
    return imageUrls;
  }
}

// 创建服务实例的工厂函数
export function createVectorEngineService(apiKey: string): VectorEngineService {
  return new VectorEngineService(apiKey);
}
