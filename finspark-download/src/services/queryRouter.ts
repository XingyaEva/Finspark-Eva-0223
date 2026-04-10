/**
 * QueryRouter — 智能问答路由器
 *
 * 职责：
 * 1. 分析用户问题，决定用哪条处理链路
 * 2. 支持四种路由类型：
 *    - 'rag'            → 知识库检索（财报文本，默认路径）
 *    - 'realtime'       → 实时行情数据（股价、PE/PB、市值等）
 *    - 'hybrid'         → 混合路由（先 RAG，不足时追加实时数据）
 *    - 'agent_report'   → 触发完整财报 Agent 分析（12 Agent DAG）
 *
 * 设计原则：
 * - 轻量优先：优先用正则快速匹配，避免每次都消耗 LLM 调用
 * - 向后兼容：若无法判断，默认走 'rag'
 * - 零侵入：不修改现有 RAG pipeline，只在入口层做分派
 */

// ==================== 类型定义 ====================

export type RouteType = 'rag' | 'realtime' | 'hybrid' | 'agent_report';

export interface RouteDecision {
  route: RouteType;
  /** 路由依据（用于日志/调试） */
  reason: string;
  /** 路由决策延迟（ms） */
  latencyMs: number;
  /** 从问题中识别出的实体（公司名/股票代码等） */
  detectedEntities?: string[];
}

// ==================== 路由规则（轻量正则，无需 LLM） ====================

/**
 * 实时数据关键词：命中则路由到 'realtime'
 * 覆盖：股价、涨跌幅、市值、PE/PB/PS、成交量、换手率、资金流向
 */
const REALTIME_KEYWORDS = [
  /今天|今日|当前|现在|实时|最新/,
  /股价|价格|涨跌|涨幅|跌幅|涨停|跌停/,
  /市值|总市值|流通市值/,
  /PE|PB|PS|市盈率|市净率|市销率/,
  /成交量|成交额|换手率|量比|振幅/,
  /主力资金|北向资金|外资/,
  /均线|MA5|MA10|MA20|MA60|MACD|KDJ|RSI/,
];

/**
 * 完整财报分析关键词：命中则路由到 'agent_report'
 * 覆盖：用户明确要求深度分析、全面报告等
 */
const AGENT_REPORT_KEYWORDS = [
  /全面分析|深度分析|完整分析|综合分析/,
  /财报分析|年报分析|季报分析/,
  /生成报告|出报告|写报告|分析报告/,
  /投资价值|值不值得买|买入建议|卖出建议/,
  /盈利质量|商业模式分析|估值分析|风险分析/,
];

/**
 * 混合路由关键词：需要财报内容 + 当前市场数据
 * 覆盖：结合当前市场/现在估值/当下投资等
 */
const HYBRID_KEYWORDS = [
  /结合.*(股价|市场|行情|估值)/,
  /(当前|现在|目前).*(估值|投资|值不值|划算)/,
  /(股价|市值).*(财报|业绩|利润)/,
];

// ==================== QueryRouter 类 ====================

export class QueryRouter {
  /**
   * 路由决策（纯规则，零 LLM 成本）
   *
   * 优先级：hybrid > agent_report > realtime > rag（默认）
   */
  decide(question: string, context?: { stockCode?: string; forceRoute?: RouteType }): RouteDecision {
    const start = Date.now();

    // 强制路由（测试/调试用）
    if (context?.forceRoute) {
      return {
        route: context.forceRoute,
        reason: `forced by caller: ${context.forceRoute}`,
        latencyMs: Date.now() - start,
      };
    }

    const q = question.trim();

    // 1. Hybrid 检测（优先级最高，因为它最特殊）
    if (HYBRID_KEYWORDS.some(re => re.test(q))) {
      return {
        route: 'hybrid',
        reason: 'detected market+report combined query',
        latencyMs: Date.now() - start,
      };
    }

    // 2. Agent 完整分析检测
    if (AGENT_REPORT_KEYWORDS.some(re => re.test(q))) {
      return {
        route: 'agent_report',
        reason: 'detected full report analysis request',
        latencyMs: Date.now() - start,
      };
    }

    // 3. 实时数据检测
    if (REALTIME_KEYWORDS.some(re => re.test(q))) {
      return {
        route: 'realtime',
        reason: 'detected realtime market data keywords',
        latencyMs: Date.now() - start,
      };
    }

    // 4. 默认：走 RAG 知识库检索
    return {
      route: 'rag',
      reason: 'default: no special route keywords matched',
      latencyMs: Date.now() - start,
    };
  }

  /**
   * 判断问题是否属于跨公司对比查询
   * 用于调整 RAG 检索策略（不传 stockCode，扩大检索范围）
   */
  isComparativeQuery(question: string): boolean {
    return /(?:和|与|vs\.?|比较|对比|差异).*(?:公司|股票|企业|集团|茅台|比亚迪|宁德|招行|平安|五粮液|海螺)/.test(question)
      || /(?:哪家|哪个|哪只).*(更|最|较)/.test(question)
      || /(?:茅台|五粮液|海螺|招行|比亚迪|宁德|北方华创|平安).*(茅台|五粮液|海螺|招行|比亚迪|宁德|北方华创|平安)/.test(question);
  }
}

// ==================== 工厂函数 ====================

export function createQueryRouter(): QueryRouter {
  return new QueryRouter();
}
