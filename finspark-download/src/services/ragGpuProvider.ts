/**
 * GPU 服务提供者配置 — services/ragGpuProvider.ts
 *
 * 核心职责：
 * 1. 自托管 GPU 服务器（SGLang + BGE-M3 + BGE-Reranker）的统一配置
 * 2. 双模式路由：self-hosted (GPU) vs cloud (VectorEngine/DashScope)
 * 3. 健康检查 + 自动降级
 * 4. A/B 测试支持（RAG 回答生成：Qwen vs GPT）
 *
 * GPU 服务器架构（已从 vLLM 迁移到 SGLang）：
 *   SGLang (Qwen3-14B-AWQ)    → :8000  OpenAI-compatible /v1/chat/completions
 *     - 更高吞吐量（RadixAttention + 连续批处理）
 *     - 支持 reasoning-parser qwen3（思考模式）
 *     - chat_template_kwargs 在请求体顶层传递
 *   BGE-M3 Embedding          → :8001  /v1/embeddings
 *   BGE-Reranker-v2-m3        → :8002  /v1/rerank
 *
 * SGLang vs vLLM 关键差异：
 *   - 启动命令: python -m sglang.launch_server (替代 vllm.entrypoints.openai.api_server)
 *   - 思考模式: chat_template_kwargs 在请求体顶层 (SGLang) vs extra_body 内 (OpenAI SDK)
 *   - 量化: 支持 awq_marlin 加速 (比 awq 更快)
 *   - 缓存: RadixAttention 自动前缀缓存（无需额外配置）
 */

// ==================== 类型定义 ====================

/** GPU 服务器配置 */
export interface GpuServerConfig {
  /** 
   * GPU 服务器统一入口 URL
   * 通过 Nginx 反向代理，所有服务共用同一个 URL：
   * - /v1/chat/completions → SGLang (Qwen3-14B)
   * - /v1/embeddings → BGE-M3
   * - /v1/rerank → BGE-Reranker-v2-m3
   * 示例: https://u39-xxxx.region.seetacloud.com:8443
   */
  baseUrl: string;
  /** LLM 模型名称 (默认 qwen3-14b) */
  llmModel: string;
  /** Embedding 模型名称 (默认 bge-m3) */
  embeddingModel: string;
  /** Embedding 维度 (BGE-M3 默认 1024) */
  embeddingDimensions: number;
  /** 是否启用 GPU 服务 */
  enabled: boolean;
  /** GPU 代理认证 Token (用于 SSH 隧道代理的 X-GPU-Auth 头) */
  proxyAuthToken?: string;
  /** 后端推理引擎 (sglang 或 vllm) */
  backendEngine: 'sglang' | 'vllm';
}

/** 各任务使用的模型来源配置 */
export interface ModelRouting {
  /** 意图识别 + Query 改写 (简单任务 → GPU) */
  intent: 'gpu' | 'cloud';
  /** LLM 重排 → 替换为专用 BGE-Reranker (GPU) */
  rerank: 'gpu' | 'cloud';
  /** RAG 回答生成 (关键任务 → 可选 A/B 测试) */
  answer: 'gpu' | 'cloud' | 'ab_test';
  /** HyDE 问题生成 (简单任务 → GPU) */
  hyde: 'gpu' | 'cloud';
  /** Chunk 摘要 (简单任务 → GPU) */
  summary: 'gpu' | 'cloud';
  /** NER 实体标注 (简单任务 → GPU) */
  entity: 'gpu' | 'cloud';
  /** 知识提取 (中等任务 → GPU) */
  knowledge: 'gpu' | 'cloud';
  /** 知识合并 (中等任务 → GPU) */
  knowledgeMerge: 'gpu' | 'cloud';
  /** Embedding 生成 */
  embedding: 'gpu' | 'cloud';
}

/** 服务健康状态 */
export interface GpuHealthStatus {
  llm: { healthy: boolean; latencyMs: number; error?: string };
  embedding: { healthy: boolean; latencyMs: number; error?: string };
  reranker: { healthy: boolean; latencyMs: number; error?: string };
  gpuMemoryUsed?: string;
  timestamp: string;
}

/** A/B 测试结果记录 */
export interface ABTestResult {
  questionId: string;
  question: string;
  gpuAnswer: string;
  cloudAnswer: string;
  gpuModel: string;
  cloudModel: string;
  gpuLatencyMs: number;
  cloudLatencyMs: number;
  gpuTokens: { input: number; output: number };
  cloudTokens: { input: number; output: number };
  selectedAnswer: 'gpu' | 'cloud';  // 实际返回给用户的答案
  timestamp: string;
}

// ==================== 默认配置 ====================

export const DEFAULT_GPU_CONFIG: GpuServerConfig = {
  baseUrl: '',
  llmModel: 'qwen3-14b',
  embeddingModel: 'bge-m3',
  embeddingDimensions: 1024,
  enabled: false,
  backendEngine: 'sglang',
};

/** 
 * 推荐的模型路由配置（方案一：GPU 处理后台任务，Cloud 处理关键生成）
 * - 任务 ①-⑤: 简单任务 → GPU (Qwen3-14B)
 * - 任务 ②: LLM 重排 → GPU (BGE-Reranker，不使用 LLM)
 * - 任务 ⑥-⑦: 中等任务 → GPU (Qwen3-14B，90-95% of GPT-4.1)
 * - 任务 ⑧: 关键任务 → Cloud (GPT-4.1) 或 A/B 测试
 */
export const RECOMMENDED_ROUTING: ModelRouting = {
  intent: 'gpu',
  rerank: 'gpu',
  answer: 'cloud',       // 关键任务保持 Cloud，可改为 'ab_test' 做对比
  hyde: 'gpu',
  summary: 'gpu',
  entity: 'gpu',
  knowledge: 'gpu',
  knowledgeMerge: 'gpu',
  embedding: 'gpu',
};

/** 全部使用 GPU（全自主方案） */
export const ALL_GPU_ROUTING: ModelRouting = {
  intent: 'gpu',
  rerank: 'gpu',
  answer: 'gpu',
  hyde: 'gpu',
  summary: 'gpu',
  entity: 'gpu',
  knowledge: 'gpu',
  knowledgeMerge: 'gpu',
  embedding: 'gpu',
};

/** 全部使用 Cloud（现有方案） */
export const ALL_CLOUD_ROUTING: ModelRouting = {
  intent: 'cloud',
  rerank: 'cloud',
  answer: 'cloud',
  hyde: 'cloud',
  summary: 'cloud',
  entity: 'cloud',
  knowledge: 'cloud',
  knowledgeMerge: 'cloud',
  embedding: 'cloud',
};

// ==================== GPU Provider 类 ====================

export class GpuProvider {
  private config: GpuServerConfig;
  private routing: ModelRouting;
  private cloudApiKey: string;
  private cloudBaseUrl: string;

  constructor(
    config: GpuServerConfig,
    routing: ModelRouting,
    cloudApiKey: string,
    cloudBaseUrl: string = 'https://api.vectorengine.ai/v1'
  ) {
    this.config = config;
    this.routing = routing;
    this.cloudApiKey = cloudApiKey;
    this.cloudBaseUrl = cloudBaseUrl;
  }

  // ============ URL 构建器 ============

  /** 获取 GPU 服务 API 端点（统一入口，Nginx 按路径路由） */
  getGpuUrl(): string {
    // 确保 baseUrl 不以 / 结尾
    return this.config.baseUrl.replace(/\/+$/, '');
  }

  // ============ 任务路由解析 ============

  /**
   * 根据任务类型获取对应的 LLM 配置
   * 返回 { baseUrl, apiKey, model } 供各 service 使用
   */
  getLlmConfig(task: keyof ModelRouting): {
    baseUrl: string;
    apiKey: string;
    model: string;
    provider: 'gpu' | 'cloud';
    extraHeaders?: Record<string, string>;
  } {
    const mode = this.routing[task];
    
    if (mode === 'gpu' && this.config.enabled) {
      return {
        baseUrl: this.getGpuUrl(),
        apiKey: 'not-needed',  // 自托管 SGLang 不需要 API Key
        model: this.config.llmModel,
        provider: 'gpu',
        extraHeaders: this.getGpuHeaders(),
      };
    }

    // Cloud 或 GPU 未启用时降级到 Cloud
    return {
      baseUrl: this.cloudBaseUrl,
      apiKey: this.cloudApiKey,
      model: task === 'answer' ? 'gpt-4.1' : 'gpt-4.1-mini',
      provider: 'cloud',
    };
  }

  /**
   * 获取 Embedding 配置
   */
  getEmbeddingConfig(): {
    baseUrl: string;
    apiKey: string;
    model: string;
    dimensions: number;
    provider: 'gpu' | 'cloud';
  } {
    if (this.routing.embedding === 'gpu' && this.config.enabled) {
      return {
        baseUrl: this.getGpuUrl(),
        apiKey: 'not-needed',
        model: this.config.embeddingModel,
        dimensions: this.config.embeddingDimensions,
        provider: 'gpu',
      };
    }

    // 降级到 Cloud（DashScope 或 VectorEngine）
    return {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: this.cloudApiKey,
      model: 'text-embedding-v4',
      dimensions: 1024,
      provider: 'cloud',
    };
  }

  /**
   * 获取 Reranker 配置
   * GPU 模式使用专用 BGE-Reranker（非 LLM 重排）
   */
  getRerankerConfig(): {
    type: 'dedicated' | 'llm';
    baseUrl: string;
    apiKey: string;
    model: string;
    provider: 'gpu' | 'cloud';
  } {
    if (this.routing.rerank === 'gpu' && this.config.enabled) {
      return {
        type: 'dedicated',  // 专用 Reranker，不是 LLM 重排
        baseUrl: this.getGpuUrl(),
        apiKey: 'not-needed',
        model: 'bge-reranker-v2-m3',
        provider: 'gpu',
      };
    }

    return {
      type: 'llm',  // 继续用 LLM 重排
      baseUrl: this.cloudBaseUrl,
      apiKey: this.cloudApiKey,
      model: 'gpt-4.1-mini',
      provider: 'cloud',
    };
  }

  /**
   * 检查是否需要 A/B 测试
   */
  isABTest(task: keyof ModelRouting): boolean {
    return this.routing[task] === 'ab_test' && this.config.enabled;
  }

  /**
   * 获取当前配置信息
   */
  getInfo(): {
    gpuEnabled: boolean;
    gpuBaseUrl: string;
    routing: ModelRouting;
    llmModel: string;
    embeddingModel: string;
    backendEngine: 'sglang' | 'vllm';
  } {
    return {
      gpuEnabled: this.config.enabled,
      gpuBaseUrl: this.config.baseUrl,
      routing: this.routing,
      llmModel: this.config.llmModel,
      embeddingModel: this.config.embeddingModel,
      backendEngine: this.config.backendEngine,
    };
  }

  // ============ 健康检查 ============

  /**
   * 全面健康检查（检测 LLM / Embedding / Reranker 三个服务）
   */
  async healthCheck(): Promise<GpuHealthStatus> {
    if (!this.config.enabled || !this.config.baseUrl) {
      return {
        llm: { healthy: false, latencyMs: 0, error: 'GPU not enabled' },
        embedding: { healthy: false, latencyMs: 0, error: 'GPU not enabled' },
        reranker: { healthy: false, latencyMs: 0, error: 'GPU not enabled' },
        timestamp: new Date().toISOString(),
      };
    }

    const gpuUrl = this.getGpuUrl();
    const [llm, embedding, reranker] = await Promise.all([
      this.checkService(`${gpuUrl}/health/llm`),
      this.checkService(`${gpuUrl}/health/embedding`),
      this.checkService(`${gpuUrl}/health/reranker`),
    ]);

    return {
      llm,
      embedding,
      reranker,
      timestamp: new Date().toISOString(),
    };
  }

  /** 获取 GPU 请求额外头 (代理认证等) */
  getGpuHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.proxyAuthToken) {
      headers['X-GPU-Auth'] = this.config.proxyAuthToken;
    }
    return headers;
  }

  private async checkService(url: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: this.getGpuHeaders(),
      });
      const latencyMs = Date.now() - start;
      if (resp.ok) {
        return { healthy: true, latencyMs };
      }
      return { healthy: false, latencyMs, error: `HTTP ${resp.status}` };
    } catch (e) {
      return { healthy: false, latencyMs: Date.now() - start, error: (e as Error).message };
    }
  }

  // ============ 专用 Reranker 调用 ============

  /**
   * 调用专用 BGE-Reranker 进行文档重排
   * 比 LLM 重排更快（<50ms vs 1-2s）、更精准、更省 VRAM
   */
  async dedicatedRerank(
    query: string,
    documents: string[],
    topN: number = 10
  ): Promise<Array<{ index: number; score: number; text: string }>> {
    const rerankerConfig = this.getRerankerConfig();
    
    if (rerankerConfig.type !== 'dedicated') {
      throw new Error('Dedicated reranker not available, use LLM rerank instead');
    }

    const response = await fetch(`${rerankerConfig.baseUrl}/rerank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getGpuHeaders(),
      },
      body: JSON.stringify({ query, documents, top_n: topN }),
    });

    if (!response.ok) {
      throw new Error(`Reranker API error: ${response.status}`);
    }

    const result = await response.json() as {
      results: Array<{ index: number; score: number; text: string }>;
      latency_ms: number;
    };

    return result.results;
  }

  // ============ A/B 测试 ============

  /**
   * 执行 A/B 测试：同时调用 GPU 和 Cloud LLM，比较结果
   * 默认返回 Cloud 结果（保守策略），同时记录 GPU 结果用于评估
   */
  async abTestLlmCall(
    messages: Array<{ role: string; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      preferGpu?: boolean;  // true = 返回 GPU 结果
    } = {}
  ): Promise<{
    answer: string;
    selectedProvider: 'gpu' | 'cloud';
    gpuResult?: { answer: string; latencyMs: number; tokens: { input: number; output: number } };
    cloudResult?: { answer: string; latencyMs: number; tokens: { input: number; output: number } };
  }> {
    const temperature = options.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? 2048;

    // 并行调用 GPU 和 Cloud
    const [gpuResult, cloudResult] = await Promise.allSettled([
      this.callLlm(this.getGpuUrl(), 'not-needed', this.config.llmModel, messages, temperature, maxTokens),
      this.callLlm(this.cloudBaseUrl, this.cloudApiKey, 'gpt-4.1', messages, temperature, maxTokens),
    ]);

    const gpuOk = gpuResult.status === 'fulfilled' ? gpuResult.value : null;
    const cloudOk = cloudResult.status === 'fulfilled' ? cloudResult.value : null;

    // 决定返回哪个结果
    const preferGpu = options.preferGpu ?? false;
    
    if (preferGpu && gpuOk) {
      return {
        answer: gpuOk.answer,
        selectedProvider: 'gpu',
        gpuResult: gpuOk,
        cloudResult: cloudOk || undefined,
      };
    }
    
    if (cloudOk) {
      return {
        answer: cloudOk.answer,
        selectedProvider: 'cloud',
        gpuResult: gpuOk || undefined,
        cloudResult: cloudOk,
      };
    }

    // Cloud 也失败了，尝试 GPU
    if (gpuOk) {
      return {
        answer: gpuOk.answer,
        selectedProvider: 'gpu',
        gpuResult: gpuOk,
      };
    }

    throw new Error('Both GPU and Cloud LLM failed');
  }

  private async callLlm(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxTokens: number
  ): Promise<{ answer: string; latencyMs: number; tokens: { input: number; output: number } }> {
    const start = Date.now();
    
    const gpuHeaders = apiKey === 'not-needed' ? this.getGpuHeaders() : {};
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey !== 'not-needed' ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...gpuHeaders,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        // Qwen3 SGLang: 关闭 thinking 模式，直接输出答案（节省 tokens 和延迟）
        // SGLang 中 chat_template_kwargs 在请求体顶层传递（不同于 OpenAI SDK 的 extra_body）
        ...(apiKey === 'not-needed' ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    let answer = result.choices?.[0]?.message?.content || '';
    
    // 处理 Qwen3 的 thinking tags — 移除 <think>...</think> 包裹的思考内容（兜底）
    // SGLang 配合 --reasoning-parser qwen3 会将思考内容分离到 reasoning_content 字段
    answer = answer.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();

    return {
      answer,
      latencyMs: Date.now() - start,
      tokens: {
        input: result.usage?.prompt_tokens || 0,
        output: result.usage?.completion_tokens || 0,
      },
    };
  }
}

// ==================== 工厂函数 ====================

/**
 * 从环境变量创建 GPU Provider
 * 
 * 需要的环境变量:
 * - GPU_SERVER_URL: GPU 服务统一入口 (如 https://u39-xxxx.region.seetacloud.com:8443)
 * - GPU_LLM_MODEL: LLM 模型名 (默认 qwen3-14b)
 * - GPU_ROUTING_MODE: 路由模式 recommended/all_gpu/all_cloud (默认 recommended)
 */
export function createGpuProvider(params: {
  gpuServerUrl?: string;
  gpuLlmModel?: string;
  gpuRoutingMode?: string;
  gpuProxyAuthToken?: string;
  gpuBackendEngine?: 'sglang' | 'vllm';
  cloudApiKey: string;
  cloudBaseUrl?: string;
}): GpuProvider {
  const enabled = !!params.gpuServerUrl;

  const config: GpuServerConfig = {
    baseUrl: params.gpuServerUrl || '',
    llmModel: params.gpuLlmModel || 'qwen3-14b',
    embeddingModel: 'bge-m3',
    embeddingDimensions: 1024,
    enabled,
    proxyAuthToken: params.gpuProxyAuthToken,
    backendEngine: params.gpuBackendEngine || 'sglang',
  };

  // 选择路由策略
  let routing: ModelRouting;
  switch (params.gpuRoutingMode) {
    case 'all_gpu':
      routing = ALL_GPU_ROUTING;
      break;
    case 'all_cloud':
      routing = ALL_CLOUD_ROUTING;
      break;
    case 'recommended':
    default:
      routing = enabled ? RECOMMENDED_ROUTING : ALL_CLOUD_ROUTING;
      break;
  }

  return new GpuProvider(
    config,
    routing,
    params.cloudApiKey,
    params.cloudBaseUrl || 'https://api.vectorengine.ai/v1'
  );
}
