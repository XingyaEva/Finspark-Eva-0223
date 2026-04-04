/**
 * Langfuse 可观测性服务
 * 
 * 为 FinSpark 12-Agent 编排器提供全链路追踪：
 * - Trace: 每次完整分析的根节点
 * - Span: Phase 分组（数据获取、Phase 1-4）
 * - Generation: 每个 Agent 的 LLM 调用（含 prompt/response/tokens/cost）
 * - Score: 质量评分（JSON 合规、字段完整率等）
 * 
 * @see https://langfuse.com/docs/observability/sdk/overview
 */

import Langfuse from 'langfuse';

// ============ 类型定义 ============

export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
}

export interface TraceContext {
  langfuse: Langfuse;
  trace: ReturnType<Langfuse['trace']>;
}

export interface GenerationInput {
  /** Agent 类型标识 */
  agentType: string;
  /** Agent 中文名 */
  agentName: string;
  /** 所属 Phase (0=数据获取, 1=三表, 2=深度, 3=高级, 4=结论) */
  phase: number;
  /** 使用的模型名 */
  model: string;
  /** System Prompt */
  systemPrompt: string;
  /** User Prompt */
  userPrompt: string;
}

export interface GenerationOutput {
  /** LLM 返回的原始内容 */
  content: string;
  /** Token 使用量 */
  usage?: {
    input: number;
    output: number;
    total: number;
  };
  /** JSON 解析是否成功 */
  jsonValid?: boolean;
  /** 字段完整率 (0-1) */
  fieldsCompleteRate?: number;
  /** 响应延迟 (ms) */
  latencyMs?: number;
  /** 错误信息 (如果有) */
  error?: string;
}

// ============ 初始化 ============

/**
 * 创建 Langfuse 客户端
 * 如果未配置密钥则返回 null（优雅降级）
 */
export function createLangfuseClient(config: LangfuseConfig): Langfuse | null {
  if (!config.secretKey || !config.publicKey) {
    console.log('[Langfuse] 未配置密钥，可观测性追踪已禁用');
    return null;
  }

  try {
    const client = new Langfuse({
      secretKey: config.secretKey,
      publicKey: config.publicKey,
      baseUrl: config.baseUrl || 'https://cloud.langfuse.com',
      // Cloudflare Workers 兼容配置
      flushAt: 5,        // 每积累 5 个事件发送一次
      flushInterval: 500, // 每 500ms 检查一次
    });
    console.log('[Langfuse] 可观测性追踪已启用');
    return client;
  } catch (error) {
    console.error('[Langfuse] 初始化失败:', error);
    return null;
  }
}

/**
 * 从 Cloudflare Workers Bindings 创建 Langfuse 客户端
 */
export function createLangfuseFromEnv(env: {
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_BASE_URL?: string;
}): Langfuse | null {
  if (!env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_PUBLIC_KEY) {
    return null;
  }
  return createLangfuseClient({
    secretKey: env.LANGFUSE_SECRET_KEY,
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    baseUrl: env.LANGFUSE_BASE_URL,
  });
}

// ============ Trace 操作 ============

/**
 * 创建分析 Trace（每次财报分析的根节点）
 */
export function createAnalysisTrace(
  langfuse: Langfuse | null,
  params: {
    reportId: number;
    companyCode: string;
    companyName: string;
    reportType: string;
    userId?: string;
    reportPeriod?: string;
  }
): TraceContext | null {
  if (!langfuse) return null;

  try {
    const trace = langfuse.trace({
      name: 'financial-analysis',
      metadata: {
        reportId: params.reportId,
        companyCode: params.companyCode,
        companyName: params.companyName,
        reportType: params.reportType,
        reportPeriod: params.reportPeriod || 'latest',
      },
      userId: params.userId,
      tags: [
        params.reportType,
        params.companyCode,
      ],
    });

    return { langfuse, trace };
  } catch (error) {
    console.error('[Langfuse] 创建 Trace 失败:', error);
    return null;
  }
}

/**
 * 创建 Phase Span（Agent 执行阶段分组）
 */
export function createPhaseSpan(
  ctx: TraceContext | null,
  phase: number,
  phaseName: string
) {
  if (!ctx) return null;

  try {
    return ctx.trace.span({
      name: `phase-${phase}-${phaseName}`,
      metadata: { phase, phaseName },
    });
  } catch (error) {
    console.error(`[Langfuse] 创建 Phase ${phase} Span 失败:`, error);
    return null;
  }
}

/**
 * 记录 Agent LLM 调用（Generation）
 * 在调用 LLM 之前调用，返回 generation 对象用于后续记录输出
 */
export function startGeneration(
  ctx: TraceContext | null,
  input: GenerationInput
) {
  if (!ctx) return null;

  try {
    return ctx.trace.generation({
      name: `agent-${input.agentType}`,
      model: input.model,
      input: {
        systemPrompt: input.systemPrompt.slice(0, 500) + (input.systemPrompt.length > 500 ? '...' : ''),
        userPrompt: input.userPrompt.slice(0, 2000) + (input.userPrompt.length > 2000 ? '...' : ''),
      },
      metadata: {
        agentType: input.agentType,
        agentName: input.agentName,
        phase: input.phase,
        systemPromptLength: input.systemPrompt.length,
        userPromptLength: input.userPrompt.length,
      },
    });
  } catch (error) {
    console.error(`[Langfuse] 创建 Generation 失败 (${input.agentType}):`, error);
    return null;
  }
}

/**
 * 结束 Agent LLM 调用记录
 */
export function endGeneration(
  generation: ReturnType<ReturnType<Langfuse['trace']>['generation']> | null,
  output: GenerationOutput
) {
  if (!generation) return;

  try {
    generation.end({
      output: output.content.slice(0, 5000) + (output.content.length > 5000 ? '...' : ''),
      usage: output.usage ? {
        input: output.usage.input,
        output: output.usage.output,
        total: output.usage.total,
      } : undefined,
      metadata: {
        jsonValid: output.jsonValid,
        fieldsCompleteRate: output.fieldsCompleteRate,
        latencyMs: output.latencyMs,
        contentLength: output.content.length,
      },
      level: output.error ? 'ERROR' : 'DEFAULT',
      statusMessage: output.error || undefined,
    });
  } catch (error) {
    console.error('[Langfuse] 结束 Generation 失败:', error);
  }
}

/**
 * 记录评分（质量指标）
 */
export function recordScore(
  ctx: TraceContext | null,
  params: {
    name: string;
    value: number;
    observationId?: string;
    comment?: string;
  }
) {
  if (!ctx) return;

  try {
    ctx.trace.score({
      name: params.name,
      value: params.value,
      comment: params.comment,
    });
  } catch (error) {
    console.error(`[Langfuse] 记录 Score 失败 (${params.name}):`, error);
  }
}

/**
 * 更新 Trace 最终结果
 */
export function finalizeTrace(
  ctx: TraceContext | null,
  result: {
    success: boolean;
    totalDurationMs: number;
    totalAgents: number;
    completedAgents: number;
    reportScore?: number;
    error?: string;
  }
) {
  if (!ctx) return;

  try {
    ctx.trace.update({
      output: {
        success: result.success,
        totalDurationMs: result.totalDurationMs,
        completedAgents: `${result.completedAgents}/${result.totalAgents}`,
        reportScore: result.reportScore,
      },
      metadata: {
        totalDurationMs: result.totalDurationMs,
        completedAgents: result.completedAgents,
        totalAgents: result.totalAgents,
        level: result.error ? 'ERROR' : 'DEFAULT',
        statusMessage: result.error || undefined,
      },
    });
  } catch (error) {
    console.error('[Langfuse] 更新 Trace 失败:', error);
  }
}

/**
 * 刷新 Langfuse 缓冲区（确保事件发送）
 * 在 Cloudflare Workers 中必须在 waitUntil 中调用
 */
export async function flushLangfuse(langfuse: Langfuse | null): Promise<void> {
  if (!langfuse) return;
  try {
    await langfuse.flushAsync();
  } catch (error) {
    console.error('[Langfuse] flush 失败:', error);
  }
}
