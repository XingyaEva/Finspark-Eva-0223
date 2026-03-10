/**
 * 统一的AI响应JSON解析工具
 * 用于解析VectorEngine等AI服务返回的JSON格式数据
 * 支持多种格式：纯JSON、markdown代码块、嵌套JSON等
 * 
 * @module utils/jsonParser
 */

export interface ParseJsonOptions {
  /** 解析失败时是否抛出错误，默认false */
  throwOnError?: boolean;
  /** 是否记录日志，默认true */
  enableLogging?: boolean;
  /** Agent名称，用于日志标识 */
  agentName?: string;
}

export interface ParseJsonResult<T = Record<string, unknown>> {
  /** 是否解析成功 */
  success: boolean;
  /** 解析后的数据 */
  data: T | null;
  /** 错误信息 */
  error?: string;
  /** 原始响应（仅在失败时返回） */
  rawResponse?: string;
  /** 使用的解析策略 */
  strategy?: string;
}

/**
 * 解析AI返回的JSON响应
 * 
 * 支持的格式：
 * 1. 纯JSON: {"key": "value"}
 * 2. Markdown代码块: ```json\n{"key": "value"}\n```
 * 3. 文本中包含JSON: Some text {"key": "value"} more text
 * 4. 多个JSON对象：自动选择最长的一个
 * 5. 带BOM和特殊字符的JSON
 * 
 * @param response AI返回的原始响应
 * @param options 解析选项
 * @returns 解析结果
 * 
 * @example
 * ```typescript
 * const result = parseAIJsonResponse(aiResponse, {
 *   agentName: 'IndustryComparison',
 *   enableLogging: true
 * });
 * 
 * if (result.success) {
 *   console.log('解析成功:', result.data);
 * } else {
 *   console.error('解析失败:', result.error);
 * }
 * ```
 */
export function parseAIJsonResponse<T = Record<string, unknown>>(
  response: string,
  options: ParseJsonOptions = {}
): ParseJsonResult<T> {
  const { throwOnError = false, enableLogging = true, agentName = 'Unknown' } = options;
  
  // 输入验证
  if (!response || typeof response !== 'string') {
    const error = 'Invalid response: empty or not a string';
    if (enableLogging) {
      console.error(`[${agentName}] ${error}`);
    }
    if (throwOnError) {
      throw new Error(error);
    }
    return { success: false, data: null, error, rawResponse: response };
  }

  if (enableLogging) {
    console.log(`[${agentName}] 开始解析JSON，响应长度: ${response.length}`);
    console.log(`[${agentName}] 响应预览: ${response.substring(0, 200).replace(/\n/g, '\\n')}${response.length > 200 ? '...' : ''}`);
  }

  // 策略1: 直接解析（最快，适用于规范的JSON）
  try {
    const data = JSON.parse(response) as T;
    if (enableLogging) {
      console.log(`[${agentName}] ✓ 策略1成功：直接解析`);
    }
    return { success: true, data, strategy: 'direct' };
  } catch (e1) {
    if (enableLogging) {
      console.log(`[${agentName}] ✗ 策略1失败：${(e1 as Error).message.substring(0, 50)}`);
    }
  }

  // 策略2: 提取markdown代码块（常见于AI输出）
  // 匹配 ```json 或 ``` 开头的代码块
  const markdownMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownMatch && markdownMatch[1]) {
    try {
      const cleaned = markdownMatch[1].trim();
      const data = JSON.parse(cleaned) as T;
      if (enableLogging) {
        console.log(`[${agentName}] ✓ 策略2成功：Markdown代码块提取`);
      }
      return { success: true, data, strategy: 'markdown' };
    } catch (e2) {
      if (enableLogging) {
        console.log(`[${agentName}] ✗ 策略2失败：${(e2 as Error).message.substring(0, 50)}`);
      }
    }
  }

  // 策略3: 提取所有可能的JSON对象，选择最大的
  // 使用非贪婪匹配避免匹配到多余内容
  const jsonObjectMatches = [...response.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
  
  if (jsonObjectMatches.length > 0) {
    // 按长度排序，优先解析最长的JSON（最可能是完整的）
    const sortedMatches = jsonObjectMatches
      .map(m => m[0])
      .sort((a, b) => b.length - a.length);
    
    if (enableLogging) {
      console.log(`[${agentName}] 找到 ${sortedMatches.length} 个JSON对象候选`);
    }
    
    for (let i = 0; i < sortedMatches.length; i++) {
      try {
        const data = JSON.parse(sortedMatches[i]) as T;
        if (enableLogging) {
          console.log(`[${agentName}] ✓ 策略3成功：第${i+1}个JSON对象（长度${sortedMatches[i].length}）`);
        }
        return { success: true, data, strategy: 'object-extraction' };
      } catch (e3) {
        if (enableLogging && i === 0) {
          console.log(`[${agentName}] ✗ 策略3第${i+1}次尝试失败：${(e3 as Error).message.substring(0, 50)}`);
        }
        // 继续尝试下一个候选
      }
    }
  }

  // 策略4: 清理特殊字符后重试
  // 移除BOM、控制字符等可能干扰解析的字符
  const cleaned = response
    .replace(/^\uFEFF/, '')  // BOM (Byte Order Mark)
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')  // 控制字符
    .trim();
  
  if (cleaned !== response) {
    try {
      const data = JSON.parse(cleaned) as T;
      if (enableLogging) {
        console.log(`[${agentName}] ✓ 策略4成功：清理特殊字符后解析`);
      }
      return { success: true, data, strategy: 'cleaned' };
    } catch (e4) {
      if (enableLogging) {
        console.log(`[${agentName}] ✗ 策略4失败：${(e4 as Error).message.substring(0, 50)}`);
      }
    }
  }

  // 所有策略都失败
  const error = 'All parsing strategies failed';
  if (enableLogging) {
    console.error(`[${agentName}] ✗ JSON解析完全失败`);
    console.error(`[${agentName}] 原始响应（前500字符）:\n${response.substring(0, 500)}`);
  }
  
  if (throwOnError) {
    throw new Error(`${error}: ${response.substring(0, 200)}`);
  }
  
  return { 
    success: false, 
    data: null, 
    error, 
    rawResponse: response,
    strategy: 'none'
  };
}

/**
 * 简化版：仅返回数据或null
 * 适用于不需要详细错误信息的场景
 * 
 * @param response AI返回的原始响应
 * @param agentName Agent名称，用于日志标识
 * @returns 解析后的数据，失败返回null
 * 
 * @example
 * ```typescript
 * const data = parseAIJson(aiResponse, 'IndustryComparison');
 * if (data) {
 *   // 使用数据
 * } else {
 *   // 处理解析失败
 * }
 * ```
 */
export function parseAIJson<T = Record<string, unknown>>(
  response: string,
  agentName: string = 'Unknown'
): T | null {
  const result = parseAIJsonResponse<T>(response, { 
    agentName, 
    throwOnError: false,
    enableLogging: true 
  });
  return result.data;
}

/**
 * 严格版：解析失败时抛出错误
 * 适用于必须成功解析的场景
 * 
 * @param response AI返回的原始响应
 * @param agentName Agent名称，用于日志标识
 * @returns 解析后的数据
 * @throws 解析失败时抛出错误
 * 
 * @example
 * ```typescript
 * try {
 *   const data = parseAIJsonStrict(aiResponse, 'IndustryComparison');
 *   // 使用数据
 * } catch (error) {
 *   console.error('解析失败:', error);
 * }
 * ```
 */
export function parseAIJsonStrict<T = Record<string, unknown>>(
  response: string,
  agentName: string = 'Unknown'
): T {
  const result = parseAIJsonResponse<T>(response, { 
    agentName, 
    throwOnError: true,
    enableLogging: true 
  });
  return result.data!;
}

/**
 * 静默版：不输出任何日志
 * 适用于高频调用或不需要日志的场景
 * 
 * @param response AI返回的原始响应
 * @returns 解析后的数据或null
 */
export function parseAIJsonSilent<T = Record<string, unknown>>(
  response: string
): T | null {
  const result = parseAIJsonResponse<T>(response, { 
    enableLogging: false,
    throwOnError: false 
  });
  return result.data;
}
