/**
 * 意图识别服务 — services/ragIntent.ts
 *
 * 通过单次 LLM 调用实现：
 * 1. 意图分类 (number/name/boolean/comparative/open/string)
 * 2. Query 改写（补全公司全称、规范化指标名称、补充时间范围）
 * 3. 实体提取（公司名、指标、时间等）
 * 4. 比较题拆分（comparative 类型拆为多个子查询）
 *
 * Temperature: 0.1（高确定性任务）
 * 预期延迟: ~100-200ms
 */

// ==================== 类型定义 ====================

export type IntentType = 'number' | 'name' | 'boolean' | 'comparative' | 'open' | 'string';

export interface IntentResult {
  type: IntentType;
  confidence: number;
  entities: string[];
  rewrittenQuery: string | null;
  subQueries?: string[];        // 比较题拆分后的子查询
  latencyMs: number;
}

// ==================== Prompt 模板 ====================

const INTENT_SYSTEM_PROMPT = `你是一个专业的金融问答意图分析器。分析用户问题并返回 JSON 格式的分析结果。

你需要分析以下内容：
1. 意图类型 (type)
2. 置信度 (confidence: 0.0-1.0)
3. 实体列表 (entities)
4. 改写后的查询 (rewritten_query)
5. 子查询列表 (sub_queries, 仅 comparative 类型)

意图类型定义：
- number: 查询具体数值（营收、利润、增长率、PE、净资产等）
- name: 查询名称/名字（CEO、子公司、产品名、审计师等）
- boolean: 是/否判断（是否盈利、是否超过、是否通过等）
- comparative: 多公司/多指标/多时间段对比（A和B谁更好、同比变化等）
- open: 开放性分析（竞争优势、行业分析、前景展望等）
- string: 其他文本查询（不属于以上分类的通用查询）

改写规则：
- 补全公司全称（"茅台" → "贵州茅台"）
- 规范化指标名称（"赚了多少" → "净利润"）
- 补充时间范围（默认最新年报）
- 如果原 Query 已经清晰，rewritten_query 设为 null

仅返回合法 JSON，不要添加任何 markdown 格式或额外解释。

示例输入: "茅台去年营收增速多少？"
示例输出:
{
  "type": "number",
  "confidence": 0.95,
  "entities": ["贵州茅台", "营业收入增长率"],
  "rewritten_query": "贵州茅台最近一个完整财年的营业收入同比增长率",
  "sub_queries": null
}

示例输入: "茅台和五粮液谁的毛利率更高？"
示例输出:
{
  "type": "comparative",
  "confidence": 0.92,
  "entities": ["贵州茅台", "五粮液", "毛利率"],
  "rewritten_query": "对比贵州茅台和五粮液最近财年的毛利率",
  "sub_queries": ["贵州茅台最近财年毛利率", "五粮液最近财年毛利率"]
}`;

// ==================== Intent Service ====================

export class IntentService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private extraHeaders: Record<string, string>;

  constructor(apiKey: string, baseUrl?: string, model?: string, extraHeaders?: Record<string, string>) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.vectorengine.ai/v1';
    this.model = model || 'gpt-4.1';
    this.extraHeaders = extraHeaders || {};
  }

  /**
   * 分类意图 + 改写 Query + 提取实体（单次 LLM 调用）
   */
  async classifyAndRewrite(query: string): Promise<IntentResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey !== 'not-needed' ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          ...this.extraHeaders,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: INTENT_SYSTEM_PROMPT },
            { role: 'user', content: query },
          ],
          temperature: 0.1,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[IntentService] LLM API error:', response.status, errorText);
        return this.fallbackResult(query, startTime);
      }

      const result = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        return this.fallbackResult(query, startTime);
      }

      // 解析 JSON 响应
      const parsed = this.parseIntentJSON(content);
      const latencyMs = Date.now() - startTime;

      return {
        type: parsed.type || 'string',
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || [],
        rewrittenQuery: parsed.rewritten_query || null,
        subQueries: parsed.sub_queries || undefined,
        latencyMs,
      };
    } catch (error) {
      console.error('[IntentService] Error:', error);
      return this.fallbackResult(query, startTime);
    }
  }

  /**
   * 解析 LLM 返回的 JSON
   * 处理可能的格式问题（markdown 代码块、多余空格等）
   */
  private parseIntentJSON(content: string): {
    type?: IntentType;
    confidence?: number;
    entities?: string[];
    rewritten_query?: string | null;
    sub_queries?: string[] | null;
  } {
    // 处理 Qwen3 thinking tags（自托管 GPU 模型可能返回 <think>...</think>）
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    
    try {
      // 尝试直接解析
      return JSON.parse(cleaned);
    } catch {
      // 尝试提取 JSON 块
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // ignore
        }
      }
    }

    // 解析失败返回空
    console.warn('[IntentService] Failed to parse LLM response:', content.substring(0, 200));
    return {};
  }

  /**
   * Fallback：当 LLM 调用失败时，使用规则匹配进行基础分类
   */
  private fallbackResult(query: string, startTime: number): IntentResult {
    const latencyMs = Date.now() - startTime;
    const type = this.ruleBasedClassify(query);

    return {
      type,
      confidence: 0.3, // 低置信度标识为 fallback
      entities: this.extractBasicEntities(query),
      rewrittenQuery: null,
      latencyMs,
    };
  }

  /**
   * 基于规则的简单意图分类（fallback）
   */
  private ruleBasedClassify(query: string): IntentType {
    const q = query.toLowerCase();

    // 数值类
    if (/多少|增长率|营收|利润|净利|毛利|收入|市值|股价|PE|市盈率|每股/.test(q)) {
      return 'number';
    }

    // 名称类
    if (/谁是|CEO|董事长|总经理|审计|子公司|产品/.test(q)) {
      return 'name';
    }

    // 布尔类
    if (/是否|是不是|有没有|能不能/.test(q)) {
      return 'boolean';
    }

    // 比较类
    if (/对比|比较|和.*谁|哪个.*更|排名/.test(q)) {
      return 'comparative';
    }

    // 开放性
    if (/分析|前景|优势|风险|建议|展望|策略/.test(q)) {
      return 'open';
    }

    return 'string';
  }

  /**
   * 基础实体提取（fallback，基于简单正则）
   */
  private extractBasicEntities(query: string): string[] {
    const entities: string[] = [];

    // 股票代码
    const stockCodes = query.match(/\d{6}\.[A-Z]{2}/g);
    if (stockCodes) entities.push(...stockCodes);

    // 年份
    const years = query.match(/20\d{2}年?/g);
    if (years) entities.push(...years);

    // 常见公司简称
    const companies = [
      '茅台', '五粮液', '泸州老窖', '洋河', '汾酒',
      '腾讯', '阿里', '百度', '字节', '美团',
      '中国平安', '工商银行', '建设银行', '招商银行',
    ];
    for (const co of companies) {
      if (query.includes(co)) entities.push(co);
    }

    return [...new Set(entities)];
  }
}

// ==================== 工厂函数 ====================

export function createIntentService(
  apiKey: string,
  baseUrl?: string,
  model?: string,
  extraHeaders?: Record<string, string>
): IntentService {
  return new IntentService(apiKey, baseUrl, model, extraHeaders);
}
