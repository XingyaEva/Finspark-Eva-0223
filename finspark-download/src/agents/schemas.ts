/**
 * Agent JSON Schemas — 用于 response_format.json_schema
 *
 * 为每个分析 Agent 定义 JSON Schema，结合 VectorEngine API 的 response_format 参数，
 * 保证 LLM 输出 100% 符合指定结构，彻底消灭 JSON 解析失败问题。
 *
 * 设计原则：
 * 1. Schema 必须设置 additionalProperties: false（json_schema strict 模式要求）
 * 2. 所有属性必须列入 required（strict 模式要求）
 * 3. 嵌套对象也需要完整声明 properties/required/additionalProperties
 * 4. 使用 enum 约束有限取值集合（如风险等级、评分等级）
 */

import type { ResponseFormat } from '../services/vectorengine';

// ============ Helper: 构建 response_format 对象 ============

function buildJsonSchemaFormat(name: string, schema: Record<string, unknown>): ResponseFormat {
  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema,
    },
  };
}

function buildJsonObjectFormat(): ResponseFormat {
  return { type: 'json_object' };
}

// ============ Shared schema fragments ============

const keyMetricItem = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const },
    value: { type: 'string' as const },
    benchmark: { type: 'string' as const },
    status: { type: 'string' as const },
  },
  required: ['name', 'value', 'benchmark', 'status'] as const,
  additionalProperties: false,
};

// ============ 1. Planning Agent Schema ============

const planningSchema = {
  type: 'object' as const,
  properties: {
    reportType: { type: 'string' as const },
    dataQuality: { type: 'string' as const },
    keyHighlights: { type: 'array' as const, items: { type: 'string' as const } },
    riskFlags: { type: 'array' as const, items: { type: 'string' as const } },
    analysisSequence: { type: 'array' as const, items: { type: 'string' as const } },
    estimatedTime: { type: 'number' as const },
  },
  required: ['reportType', 'dataQuality', 'keyHighlights', 'riskFlags', 'analysisSequence', 'estimatedTime'] as const,
  additionalProperties: false,
};

// ============ 2. Profitability Agent Schema ============

const profitabilitySchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        revenueGrowth: { type: 'string' as const },
        grossMargin: { type: 'string' as const },
        netMargin: { type: 'string' as const },
        profitTrend: { type: 'string' as const },
        sustainability: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['revenueGrowth', 'grossMargin', 'netMargin', 'profitTrend', 'sustainability', 'oneSentence'] as const,
      additionalProperties: false,
    },
    detailedAnalysis: {
      type: 'object' as const,
      properties: {
        revenueAnalysis: {
          type: 'object' as const,
          properties: {
            trend: { type: 'string' as const },
            drivers: { type: 'string' as const },
            quality: { type: 'string' as const },
          },
          required: ['trend', 'drivers', 'quality'] as const,
          additionalProperties: false,
        },
        profitabilityAnalysis: {
          type: 'object' as const,
          properties: {
            grossMarginTrend: { type: 'string' as const },
            netMarginTrend: { type: 'string' as const },
            costControl: { type: 'string' as const },
          },
          required: ['grossMarginTrend', 'netMarginTrend', 'costControl'] as const,
          additionalProperties: false,
        },
        competitivePosition: {
          type: 'object' as const,
          properties: {
            industryComparison: { type: 'string' as const },
            pricingPower: { type: 'string' as const },
            moat: { type: 'string' as const },
          },
          required: ['industryComparison', 'pricingPower', 'moat'] as const,
          additionalProperties: false,
        },
      },
      required: ['revenueAnalysis', 'profitabilityAnalysis', 'competitivePosition'] as const,
      additionalProperties: false,
    },
    keyMetrics: { type: 'array' as const, items: keyMetricItem },
    risks: { type: 'array' as const, items: { type: 'string' as const } },
    opportunities: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'detailedAnalysis', 'keyMetrics', 'risks', 'opportunities'] as const,
  additionalProperties: false,
};

// ============ 3. Balance Sheet Agent Schema ============

const balanceSheetSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        debtRatio: { type: 'string' as const },
        currentRatio: { type: 'string' as const },
        quickRatio: { type: 'string' as const },
        financialHealth: { type: 'string' as const },
        leverageRisk: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['debtRatio', 'currentRatio', 'quickRatio', 'financialHealth', 'leverageRisk', 'oneSentence'] as const,
      additionalProperties: false,
    },
    detailedAnalysis: {
      type: 'object' as const,
      properties: {
        assetStructure: {
          type: 'object' as const,
          properties: {
            composition: { type: 'string' as const },
            quality: { type: 'string' as const },
            efficiency: { type: 'string' as const },
          },
          required: ['composition', 'quality', 'efficiency'] as const,
          additionalProperties: false,
        },
        liabilityStructure: {
          type: 'object' as const,
          properties: {
            composition: { type: 'string' as const },
            repaymentPressure: { type: 'string' as const },
            financingCost: { type: 'string' as const },
          },
          required: ['composition', 'repaymentPressure', 'financingCost'] as const,
          additionalProperties: false,
        },
        capitalStructure: {
          type: 'object' as const,
          properties: {
            equityRatio: { type: 'string' as const },
            retainedEarnings: { type: 'string' as const },
            capitalEfficiency: { type: 'string' as const },
          },
          required: ['equityRatio', 'retainedEarnings', 'capitalEfficiency'] as const,
          additionalProperties: false,
        },
      },
      required: ['assetStructure', 'liabilityStructure', 'capitalStructure'] as const,
      additionalProperties: false,
    },
    keyMetrics: { type: 'array' as const, items: keyMetricItem },
    risks: { type: 'array' as const, items: { type: 'string' as const } },
    strengths: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'detailedAnalysis', 'keyMetrics', 'risks', 'strengths'] as const,
  additionalProperties: false,
};

// ============ 4. Cash Flow Agent Schema ============

const cashFlowSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        operatingCashFlow: { type: 'string' as const },
        freeCashFlow: { type: 'string' as const },
        cashQuality: { type: 'string' as const },
        selfFunding: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['operatingCashFlow', 'freeCashFlow', 'cashQuality', 'selfFunding', 'oneSentence'] as const,
      additionalProperties: false,
    },
    detailedAnalysis: {
      type: 'object' as const,
      properties: {
        operatingCashFlow: {
          type: 'object' as const,
          properties: {
            trend: { type: 'string' as const },
            profitCashRatio: { type: 'string' as const },
            quality: { type: 'string' as const },
          },
          required: ['trend', 'profitCashRatio', 'quality'] as const,
          additionalProperties: false,
        },
        investingCashFlow: {
          type: 'object' as const,
          properties: {
            trend: { type: 'string' as const },
            capitalExpenditure: { type: 'string' as const },
            investmentStrategy: { type: 'string' as const },
          },
          required: ['trend', 'capitalExpenditure', 'investmentStrategy'] as const,
          additionalProperties: false,
        },
        financingCashFlow: {
          type: 'object' as const,
          properties: {
            trend: { type: 'string' as const },
            dividendPolicy: { type: 'string' as const },
            debtManagement: { type: 'string' as const },
          },
          required: ['trend', 'dividendPolicy', 'debtManagement'] as const,
          additionalProperties: false,
        },
        cashCycle: {
          type: 'object' as const,
          properties: {
            analysis: { type: 'string' as const },
            workingCapital: { type: 'string' as const },
          },
          required: ['analysis', 'workingCapital'] as const,
          additionalProperties: false,
        },
      },
      required: ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'cashCycle'] as const,
      additionalProperties: false,
    },
    keyMetrics: { type: 'array' as const, items: keyMetricItem },
    risks: { type: 'array' as const, items: { type: 'string' as const } },
    highlights: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'detailedAnalysis', 'keyMetrics', 'risks', 'highlights'] as const,
  additionalProperties: false,
};

// ============ 5. Earnings Quality Agent Schema ============

const earningsQualitySchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        profitCashMatch: { type: 'string' as const },
        receivableRisk: { type: 'string' as const },
        inventoryRisk: { type: 'string' as const },
        earningsGrade: { type: 'string' as const },
        realProfit: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['profitCashMatch', 'receivableRisk', 'inventoryRisk', 'earningsGrade', 'realProfit', 'oneSentence'] as const,
      additionalProperties: false,
    },
    detailedAnalysis: {
      type: 'object' as const,
      properties: {
        profitVsCash: {
          type: 'object' as const,
          properties: {
            comparison: { type: 'string' as const },
            discrepancyReasons: { type: 'string' as const },
            sustainabilityAssessment: { type: 'string' as const },
          },
          required: ['comparison', 'discrepancyReasons', 'sustainabilityAssessment'] as const,
          additionalProperties: false,
        },
        workingCapitalQuality: {
          type: 'object' as const,
          properties: {
            receivables: { type: 'string' as const },
            inventory: { type: 'string' as const },
            payables: { type: 'string' as const },
          },
          required: ['receivables', 'inventory', 'payables'] as const,
          additionalProperties: false,
        },
        earningsManipulationRisk: {
          type: 'object' as const,
          properties: {
            revenueRecognition: { type: 'string' as const },
            expenseCapitalization: { type: 'string' as const },
            relatedPartyTransactions: { type: 'string' as const },
            overallRisk: { type: 'string' as const },
          },
          required: ['revenueRecognition', 'expenseCapitalization', 'relatedPartyTransactions', 'overallRisk'] as const,
          additionalProperties: false,
        },
      },
      required: ['profitVsCash', 'workingCapitalQuality', 'earningsManipulationRisk'] as const,
      additionalProperties: false,
    },
    redFlags: { type: 'array' as const, items: { type: 'string' as const } },
    greenFlags: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'detailedAnalysis', 'redFlags', 'greenFlags'] as const,
  additionalProperties: false,
};

// ============ 6. Risk Agent Schema ============

const riskMatrixItem = {
  type: 'object' as const,
  properties: {
    risk: { type: 'string' as const },
    probability: { type: 'string' as const },
    impact: { type: 'string' as const },
    priority: { type: 'string' as const },
  },
  required: ['risk', 'probability', 'impact', 'priority'] as const,
  additionalProperties: false,
};

const riskSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        debtRisk: { type: 'string' as const },
        liquidityRisk: { type: 'string' as const },
        operationalRisk: { type: 'string' as const },
        overallRisk: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['debtRisk', 'liquidityRisk', 'operationalRisk', 'overallRisk', 'oneSentence'] as const,
      additionalProperties: false,
    },
    detailedAnalysis: {
      type: 'object' as const,
      properties: {
        debtRisk: {
          type: 'object' as const,
          properties: {
            level: { type: 'string' as const },
            analysis: { type: 'string' as const },
            keyIndicators: { type: 'array' as const, items: { type: 'string' as const } },
            outlook: { type: 'string' as const },
          },
          required: ['level', 'analysis', 'keyIndicators', 'outlook'] as const,
          additionalProperties: false,
        },
        liquidityRisk: {
          type: 'object' as const,
          properties: {
            level: { type: 'string' as const },
            analysis: { type: 'string' as const },
            keyIndicators: { type: 'array' as const, items: { type: 'string' as const } },
            stressTest: { type: 'string' as const },
          },
          required: ['level', 'analysis', 'keyIndicators', 'stressTest'] as const,
          additionalProperties: false,
        },
        operationalRisk: {
          type: 'object' as const,
          properties: {
            level: { type: 'string' as const },
            analysis: { type: 'string' as const },
            keyFactors: { type: 'array' as const, items: { type: 'string' as const } },
            mitigations: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['level', 'analysis', 'keyFactors', 'mitigations'] as const,
          additionalProperties: false,
        },
        marketRisk: {
          type: 'object' as const,
          properties: {
            cyclicality: { type: 'string' as const },
            competition: { type: 'string' as const },
            regulatory: { type: 'string' as const },
          },
          required: ['cyclicality', 'competition', 'regulatory'] as const,
          additionalProperties: false,
        },
      },
      required: ['debtRisk', 'liquidityRisk', 'operationalRisk', 'marketRisk'] as const,
      additionalProperties: false,
    },
    riskMatrix: { type: 'array' as const, items: riskMatrixItem },
    recommendations: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'detailedAnalysis', 'riskMatrix', 'recommendations'] as const,
  additionalProperties: false,
};

// ============ 7. Business Insight Agent Schema ============

const businessInsightSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        businessTrend: { type: 'string' as const },
        industryPosition: { type: 'string' as const },
        competitiveAdvantage: { type: 'string' as const },
        growthDriver: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
        coreBusinessContribution: { type: 'string' as const },
      },
      required: ['businessTrend', 'industryPosition', 'competitiveAdvantage', 'growthDriver', 'oneSentence', 'coreBusinessContribution'] as const,
      additionalProperties: false,
    },
    businessStructureAnalysis: {
      type: 'object' as const,
      properties: {
        revenueBreakdown: {
          type: 'object' as const,
          properties: {
            byProduct: { type: 'string' as const },
            byChannel: { type: 'string' as const },
            byRegion: { type: 'string' as const },
          },
          required: ['byProduct', 'byChannel', 'byRegion'] as const,
          additionalProperties: false,
        },
        profitabilityBySegment: {
          type: 'object' as const,
          properties: {
            highMarginBusiness: { type: 'string' as const },
            lowMarginBusiness: { type: 'string' as const },
            marginTrend: { type: 'string' as const },
          },
          required: ['highMarginBusiness', 'lowMarginBusiness', 'marginTrend'] as const,
          additionalProperties: false,
        },
        structureEvolution: {
          type: 'object' as const,
          properties: {
            trend: { type: 'string' as const },
            strategicDirection: { type: 'string' as const },
          },
          required: ['trend', 'strategicDirection'] as const,
          additionalProperties: false,
        },
      },
      required: ['revenueBreakdown', 'profitabilityBySegment', 'structureEvolution'] as const,
      additionalProperties: false,
    },
    detailedAnalysis: {
      type: 'object' as const,
      properties: {
        businessModel: {
          type: 'object' as const,
          properties: {
            description: { type: 'string' as const },
            revenueStreams: { type: 'string' as const },
            profitDrivers: { type: 'string' as const },
          },
          required: ['description', 'revenueStreams', 'profitDrivers'] as const,
          additionalProperties: false,
        },
        competitiveAnalysis: {
          type: 'object' as const,
          properties: {
            marketPosition: { type: 'string' as const },
            competitiveAdvantages: { type: 'array' as const, items: { type: 'string' as const } },
            competitiveThreats: { type: 'array' as const, items: { type: 'string' as const } },
            moatStrength: { type: 'string' as const },
          },
          required: ['marketPosition', 'competitiveAdvantages', 'competitiveThreats', 'moatStrength'] as const,
          additionalProperties: false,
        },
        industryAnalysis: {
          type: 'object' as const,
          properties: {
            industryTrend: { type: 'string' as const },
            marketSize: { type: 'string' as const },
            keyDrivers: { type: 'string' as const },
          },
          required: ['industryTrend', 'marketSize', 'keyDrivers'] as const,
          additionalProperties: false,
        },
        growthAnalysis: {
          type: 'object' as const,
          properties: {
            historicalGrowth: { type: 'string' as const },
            futureDrivers: { type: 'array' as const, items: { type: 'string' as const } },
            growthSustainability: { type: 'string' as const },
          },
          required: ['historicalGrowth', 'futureDrivers', 'growthSustainability'] as const,
          additionalProperties: false,
        },
      },
      required: ['businessModel', 'competitiveAnalysis', 'industryAnalysis', 'growthAnalysis'] as const,
      additionalProperties: false,
    },
    swot: {
      type: 'object' as const,
      properties: {
        strengths: { type: 'array' as const, items: { type: 'string' as const } },
        weaknesses: { type: 'array' as const, items: { type: 'string' as const } },
        opportunities: { type: 'array' as const, items: { type: 'string' as const } },
        threats: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['strengths', 'weaknesses', 'opportunities', 'threats'] as const,
      additionalProperties: false,
    },
  },
  required: ['summary', 'businessStructureAnalysis', 'detailedAnalysis', 'swot'] as const,
  additionalProperties: false,
};

// ============ 8. Business Model Agent Schema ============

const secondaryMoatItem = {
  type: 'object' as const,
  properties: {
    type: { type: 'string' as const },
    strength: { type: 'string' as const },
    description: { type: 'string' as const },
  },
  required: ['type', 'strength', 'description'] as const,
  additionalProperties: false,
};

const businessModelSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        modelType: { type: 'string' as const },
        moatType: { type: 'string' as const },
        moatStrength: { type: 'string' as const },
        moatDurability: { type: 'string' as const },
        cultureScore: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['modelType', 'moatType', 'moatStrength', 'moatDurability', 'cultureScore', 'oneSentence'] as const,
      additionalProperties: false,
    },
    moatAnalysis: {
      type: 'object' as const,
      properties: {
        primaryMoat: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const },
            strength: { type: 'string' as const },
            description: { type: 'string' as const },
            evidence: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['type', 'strength', 'description', 'evidence'] as const,
          additionalProperties: false,
        },
        secondaryMoats: { type: 'array' as const, items: secondaryMoatItem },
        moatThreats: { type: 'array' as const, items: { type: 'string' as const } },
        moatTrend: { type: 'string' as const },
        moatConclusion: { type: 'string' as const },
      },
      required: ['primaryMoat', 'secondaryMoats', 'moatThreats', 'moatTrend', 'moatConclusion'] as const,
      additionalProperties: false,
    },
    businessModel: {
      type: 'object' as const,
      properties: {
        valueProposition: {
          type: 'object' as const,
          properties: {
            core: { type: 'string' as const },
            description: { type: 'string' as const },
            differentiation: { type: 'string' as const },
          },
          required: ['core', 'description', 'differentiation'] as const,
          additionalProperties: false,
        },
        revenueModel: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const },
            description: { type: 'string' as const },
            pricingPower: { type: 'string' as const },
          },
          required: ['type', 'description', 'pricingPower'] as const,
          additionalProperties: false,
        },
        scalability: {
          type: 'object' as const,
          properties: {
            level: { type: 'string' as const },
            description: { type: 'string' as const },
            marginalCost: { type: 'string' as const },
          },
          required: ['level', 'description', 'marginalCost'] as const,
          additionalProperties: false,
        },
        sustainability: {
          type: 'object' as const,
          properties: {
            level: { type: 'string' as const },
            description: { type: 'string' as const },
          },
          required: ['level', 'description'] as const,
          additionalProperties: false,
        },
      },
      required: ['valueProposition', 'revenueModel', 'scalability', 'sustainability'] as const,
      additionalProperties: false,
    },
    cultureAndGovernance: {
      type: 'object' as const,
      properties: {
        corporateCulture: {
          type: 'object' as const,
          properties: {
            type: { type: 'string' as const },
            description: { type: 'string' as const },
            strengths: { type: 'array' as const, items: { type: 'string' as const } },
            concerns: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['type', 'description', 'strengths', 'concerns'] as const,
          additionalProperties: false,
        },
        management: {
          type: 'object' as const,
          properties: {
            founderInfluence: { type: 'string' as const },
            trackRecord: { type: 'string' as const },
            alignment: { type: 'string' as const },
            succession: { type: 'string' as const },
          },
          required: ['founderInfluence', 'trackRecord', 'alignment', 'succession'] as const,
          additionalProperties: false,
        },
        governance: {
          type: 'object' as const,
          properties: {
            quality: { type: 'string' as const },
            highlights: { type: 'array' as const, items: { type: 'string' as const } },
            concerns: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: ['quality', 'highlights', 'concerns'] as const,
          additionalProperties: false,
        },
      },
      required: ['corporateCulture', 'management', 'governance'] as const,
      additionalProperties: false,
    },
    investmentImplication: {
      type: 'object' as const,
      properties: {
        moatPremium: { type: 'string' as const },
        longTermHolding: { type: 'string' as const },
        keyMonitoringPoints: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['moatPremium', 'longTermHolding', 'keyMonitoringPoints'] as const,
      additionalProperties: false,
    },
  },
  required: ['summary', 'moatAnalysis', 'businessModel', 'cultureAndGovernance', 'investmentImplication'] as const,
  additionalProperties: false,
};

// ============ 9. Forecast Agent Schema ============

const scenarioItem = {
  type: 'object' as const,
  properties: {
    scenario: { type: 'string' as const },
    growth: { type: 'string' as const },
    probability: { type: 'string' as const },
  },
  required: ['scenario', 'growth', 'probability'] as const,
  additionalProperties: false,
};

const forecastSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        revenueOutlook: { type: 'string' as const },
        profitOutlook: { type: 'string' as const },
        growthRate: { type: 'string' as const },
        confidence: { type: 'string' as const },
        keyRisks: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
        forecastBasis: { type: 'string' as const },
      },
      required: ['revenueOutlook', 'profitOutlook', 'growthRate', 'confidence', 'keyRisks', 'oneSentence', 'forecastBasis'] as const,
      additionalProperties: false,
    },
    managementGuidance: {
      type: 'object' as const,
      properties: {
        hasGuidance: { type: 'boolean' as const },
        guidanceType: { type: 'string' as const },
        expectedChange: { type: 'string' as const },
        changeReason: { type: 'string' as const },
        guidanceReliability: { type: 'string' as const },
      },
      required: ['hasGuidance', 'guidanceType', 'expectedChange', 'changeReason', 'guidanceReliability'] as const,
      additionalProperties: false,
    },
    detailedForecast: {
      type: 'object' as const,
      properties: {
        shortTerm: {
          type: 'object' as const,
          properties: {
            period: { type: 'string' as const },
            revenueGrowth: { type: 'string' as const },
            profitGrowth: { type: 'string' as const },
            keyAssumptions: { type: 'array' as const, items: { type: 'string' as const } },
            confidenceLevel: { type: 'string' as const },
          },
          required: ['period', 'revenueGrowth', 'profitGrowth', 'keyAssumptions', 'confidenceLevel'] as const,
          additionalProperties: false,
        },
        mediumTerm: {
          type: 'object' as const,
          properties: {
            period: { type: 'string' as const },
            growthTrajectory: { type: 'string' as const },
            structuralChanges: { type: 'string' as const },
            sustainabilityAnalysis: { type: 'string' as const },
          },
          required: ['period', 'growthTrajectory', 'structuralChanges', 'sustainabilityAnalysis'] as const,
          additionalProperties: false,
        },
        scenarioAnalysis: {
          type: 'object' as const,
          properties: {
            bullCase: scenarioItem,
            baseCase: scenarioItem,
            bearCase: scenarioItem,
          },
          required: ['bullCase', 'baseCase', 'bearCase'] as const,
          additionalProperties: false,
        },
      },
      required: ['shortTerm', 'mediumTerm', 'scenarioAnalysis'] as const,
      additionalProperties: false,
    },
    catalysts: {
      type: 'object' as const,
      properties: {
        positive: { type: 'array' as const, items: { type: 'string' as const } },
        negative: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['positive', 'negative'] as const,
      additionalProperties: false,
    },
    forecastRisks: { type: 'array' as const, items: { type: 'string' as const } },
    dataQuality: {
      type: 'object' as const,
      properties: {
        hasPerformanceForecast: { type: 'boolean' as const },
        hasExpressReport: { type: 'boolean' as const },
        dataCompleteness: { type: 'string' as const },
        forecastConfidenceExplanation: { type: 'string' as const },
      },
      required: ['hasPerformanceForecast', 'hasExpressReport', 'dataCompleteness', 'forecastConfidenceExplanation'] as const,
      additionalProperties: false,
    },
  },
  required: ['summary', 'managementGuidance', 'detailedForecast', 'catalysts', 'forecastRisks', 'dataQuality'] as const,
  additionalProperties: false,
};

// ============ 10. Valuation Agent Schema ============

const valuationSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        currentPE: { type: 'string' as const },
        currentPB: { type: 'string' as const },
        currentPS: { type: 'string' as const },
        marketCap: { type: 'string' as const },
        overallAssessment: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['currentPE', 'currentPB', 'currentPS', 'marketCap', 'overallAssessment', 'oneSentence'] as const,
      additionalProperties: false,
    },
    relativeValuation: {
      type: 'object' as const,
      properties: {
        peAnalysis: {
          type: 'object' as const,
          properties: {
            current: { type: 'string' as const },
            historicalAvg: { type: 'string' as const },
            industryAvg: { type: 'string' as const },
            assessment: { type: 'string' as const },
            isAttractive: { type: 'boolean' as const },
          },
          required: ['current', 'historicalAvg', 'industryAvg', 'assessment', 'isAttractive'] as const,
          additionalProperties: false,
        },
        pbAnalysis: {
          type: 'object' as const,
          properties: {
            current: { type: 'string' as const },
            historicalAvg: { type: 'string' as const },
            industryAvg: { type: 'string' as const },
            assessment: { type: 'string' as const },
            isAttractive: { type: 'boolean' as const },
          },
          required: ['current', 'historicalAvg', 'industryAvg', 'assessment', 'isAttractive'] as const,
          additionalProperties: false,
        },
        psAnalysis: {
          type: 'object' as const,
          properties: {
            current: { type: 'string' as const },
            historicalAvg: { type: 'string' as const },
            industryAvg: { type: 'string' as const },
            assessment: { type: 'string' as const },
            isAttractive: { type: 'boolean' as const },
          },
          required: ['current', 'historicalAvg', 'industryAvg', 'assessment', 'isAttractive'] as const,
          additionalProperties: false,
        },
      },
      required: ['peAnalysis', 'pbAnalysis', 'psAnalysis'] as const,
      additionalProperties: false,
    },
    intrinsicValue: {
      type: 'object' as const,
      properties: {
        dcfEstimate: { type: 'string' as const },
        marginOfSafety: { type: 'string' as const },
        fairValueRange: { type: 'string' as const },
        assessment: { type: 'string' as const },
      },
      required: ['dcfEstimate', 'marginOfSafety', 'fairValueRange', 'assessment'] as const,
      additionalProperties: false,
    },
    marketSentiment: {
      type: 'object' as const,
      properties: {
        turnoverRate: { type: 'string' as const },
        volumeRatio: { type: 'string' as const },
        sentiment: { type: 'string' as const },
        analysis: { type: 'string' as const },
      },
      required: ['turnoverRate', 'volumeRatio', 'sentiment', 'analysis'] as const,
      additionalProperties: false,
    },
    investmentImplication: {
      type: 'object' as const,
      properties: {
        entryPointAssessment: { type: 'string' as const },
        suggestedAction: { type: 'string' as const },
        priceTarget: { type: 'string' as const },
        upside: { type: 'string' as const },
        timeHorizon: { type: 'string' as const },
      },
      required: ['entryPointAssessment', 'suggestedAction', 'priceTarget', 'upside', 'timeHorizon'] as const,
      additionalProperties: false,
    },
    risks: { type: 'array' as const, items: { type: 'string' as const } },
    catalysts: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'relativeValuation', 'intrinsicValue', 'marketSentiment', 'investmentImplication', 'risks', 'catalysts'] as const,
  additionalProperties: false,
};

// ============ 11. Final Conclusion Agent Schema ============

const riskItem = {
  type: 'object' as const,
  properties: {
    risk: { type: 'string' as const },
    probability: { type: 'string' as const },
    impact: { type: 'string' as const },
  },
  required: ['risk', 'probability', 'impact'] as const,
  additionalProperties: false,
};

const finalConclusionSchema = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        recommendation: { type: 'string' as const },
        suitableInvestorType: { type: 'string' as const },
        targetPriceRange: { type: 'string' as const },
        oneSentence: { type: 'string' as const },
      },
      required: ['score', 'recommendation', 'suitableInvestorType', 'targetPriceRange', 'oneSentence'] as const,
      additionalProperties: false,
    },
    companyQuality: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const },
        grade: { type: 'string' as const },
        assessment: { type: 'string' as const },
        keyStrengths: { type: 'array' as const, items: { type: 'string' as const } },
        keyWeaknesses: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'grade', 'assessment', 'keyStrengths', 'keyWeaknesses'] as const,
      additionalProperties: false,
    },
    investmentValue: {
      type: 'object' as const,
      properties: {
        hasLongTermValue: { type: 'boolean' as const },
        assessment: { type: 'string' as const },
        valuationAssessment: { type: 'string' as const },
        expectedReturn: { type: 'string' as const },
      },
      required: ['hasLongTermValue', 'assessment', 'valuationAssessment', 'expectedReturn'] as const,
      additionalProperties: false,
    },
    riskAssessment: {
      type: 'object' as const,
      properties: {
        overallRiskLevel: { type: 'string' as const },
        isAcceptable: { type: 'boolean' as const },
        assessment: { type: 'string' as const },
        keyRisks: { type: 'array' as const, items: riskItem },
      },
      required: ['overallRiskLevel', 'isAcceptable', 'assessment', 'keyRisks'] as const,
      additionalProperties: false,
    },
    recommendation: {
      type: 'object' as const,
      properties: {
        action: { type: 'string' as const },
        rationale: { type: 'string' as const },
        suitableFor: { type: 'string' as const },
        holdingPeriod: { type: 'string' as const },
        positionSizing: { type: 'string' as const },
      },
      required: ['action', 'rationale', 'suitableFor', 'holdingPeriod', 'positionSizing'] as const,
      additionalProperties: false,
    },
    keyTakeaways: { type: 'array' as const, items: { type: 'string' as const } },
    monitoringPoints: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['summary', 'companyQuality', 'investmentValue', 'riskAssessment', 'recommendation', 'keyTakeaways', 'monitoringPoints'] as const,
  additionalProperties: false,
};

// ============ 12. Trend Interpretation Agent Schema ============

const trendIndicatorItem = {
  type: 'object' as const,
  properties: {
    latestValue: { type: 'string' as const },
    latestPeriod: { type: 'string' as const },
    yoyChange: { type: 'string' as const },
    yoyDirection: { type: 'string' as const },
    trend: { type: 'string' as const },
    trendLabel: { type: 'string' as const },
    trendPeriods: { type: 'string' as const },
    peakInfo: { type: 'string' as const },
    insight: { type: 'string' as const },
    concerns: { type: 'string' as const },
  },
  required: ['latestValue', 'latestPeriod', 'yoyChange', 'yoyDirection', 'trend', 'trendLabel', 'trendPeriods', 'peakInfo', 'insight', 'concerns'] as const,
  additionalProperties: false,
};

const trendInterpretationSchema = {
  type: 'object' as const,
  properties: {
    netProfit: trendIndicatorItem,
    revenue: trendIndicatorItem,
    operatingProfit: trendIndicatorItem,
    eps: trendIndicatorItem,
    grossMargin: trendIndicatorItem,
    netMargin: trendIndicatorItem,
    roe: trendIndicatorItem,
    debtRatio: trendIndicatorItem,
  },
  required: ['netProfit', 'revenue', 'operatingProfit', 'eps', 'grossMargin', 'netMargin', 'roe', 'debtRatio'] as const,
  additionalProperties: false,
};

// ============ Export: Agent → ResponseFormat 映射 ============

/**
 * 获取指定 Agent 的 response_format 配置
 *
 * 策略：
 * - 支持 json_schema 的模型 → 使用 strict schema（100% 结构合规）
 * - 其他模型 → 降级为 json_object（保证输出是合法 JSON，但不保证 schema）
 *
 * @param agentType Agent 类型
 * @param useStrictSchema 是否使用 json_schema 模式（默认 true）
 */
export function getAgentResponseFormat(
  agentType: string,
  useStrictSchema: boolean = true
): ResponseFormat {
  if (!useStrictSchema) {
    return buildJsonObjectFormat();
  }

  const schemaMap: Record<string, { name: string; schema: Record<string, unknown> }> = {
    PLANNING: { name: 'planning_analysis', schema: planningSchema },
    PROFITABILITY: { name: 'profitability_analysis', schema: profitabilitySchema },
    BALANCE_SHEET: { name: 'balance_sheet_analysis', schema: balanceSheetSchema },
    CASH_FLOW: { name: 'cash_flow_analysis', schema: cashFlowSchema },
    EARNINGS_QUALITY: { name: 'earnings_quality_analysis', schema: earningsQualitySchema },
    RISK: { name: 'risk_analysis', schema: riskSchema },
    BUSINESS_INSIGHT: { name: 'business_insight_analysis', schema: businessInsightSchema },
    BUSINESS_MODEL: { name: 'business_model_analysis', schema: businessModelSchema },
    FORECAST: { name: 'forecast_analysis', schema: forecastSchema },
    VALUATION: { name: 'valuation_analysis', schema: valuationSchema },
    FINAL_CONCLUSION: { name: 'final_conclusion', schema: finalConclusionSchema },
    TREND_INTERPRETATION: { name: 'trend_interpretation', schema: trendInterpretationSchema },
  };

  const agentSchema = schemaMap[agentType];
  if (!agentSchema) {
    // 未知 Agent → 降级为 json_object
    console.warn(`[AgentSchemas] No schema defined for agent: ${agentType}, falling back to json_object`);
    return buildJsonObjectFormat();
  }

  return buildJsonSchemaFormat(agentSchema.name, agentSchema.schema);
}

/**
 * 检查模型是否支持 json_schema 模式
 * 基于测试结果：gpt-4.1, gpt-4.1-mini, deepseek-chat 均支持
 */
export function supportsJsonSchema(model: string): boolean {
  // 已测试验证支持 json_schema 的模型前缀
  const supportedPrefixes = [
    'gpt-4.1',          // GPT-4.1 系列 ✅ 已测试
    'gpt-4.1-mini',     // GPT-4.1 Mini ✅ 已测试
    'gpt-4o',           // GPT-4o 系列
    'gpt-4o-mini',      // GPT-4o Mini
    'gpt-5',            // GPT-5 系列
    'deepseek-chat',    // DeepSeek Chat ✅ 已测试
    'deepseek-reasoner',// DeepSeek Reasoner
    'gemini-2',         // Gemini 2.x 系列（支持 response_schema）
    'gemini-3',         // Gemini 3.x 系列
    'claude-',          // Claude 系列（支持 structured output）
  ];

  return supportedPrefixes.some(prefix => model.startsWith(prefix));
}

/**
 * 获取模型感知的 response_format
 * 自动根据模型选择 json_schema 或 json_object
 */
export function getModelAwareResponseFormat(
  agentType: string,
  model: string
): ResponseFormat {
  const useStrict = supportsJsonSchema(model);
  return getAgentResponseFormat(agentType, useStrict);
}
