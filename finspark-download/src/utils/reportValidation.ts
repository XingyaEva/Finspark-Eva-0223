/**
 * 报告完整性校验工具
 * 
 * 用于验证缓存报告是否包含所有必需的 Agent 分析结果
 * 防止返回不完整的缓存报告给用户
 */

import type { AnalysisReport } from '../types';

export interface ReportValidationResult {
  /** 报告是否完整 */
  isComplete: boolean;
  /** 缺失的字段列表 */
  missingFields: string[];
  /** 严重程度：critical-必须重新分析，warning-可用但不完整，ok-完全完整 */
  severity: 'critical' | 'warning' | 'ok';
  /** 完整性百分比 */
  completenessPercent: number;
}

/**
 * 必须存在的核心 Agent 结果字段
 * 这些是财报分析的基础模块，缺失任何一个都会导致报告不可用
 */
const REQUIRED_CORE_FIELDS: (keyof AnalysisReport)[] = [
  'planningResult',         // 分析规划
  'profitabilityResult',    // 盈利能力分析
  'balanceSheetResult',     // 资产负债表分析
  'cashFlowResult',         // 现金流分析
  'earningsQualityResult',  // 盈利质量分析
  'riskResult',             // 风险分析
  'businessInsightResult',  // 业务洞察（必选）
  'finalConclusion',        // 最终结论
];

/**
 * 必须存在的扩展字段（改为必选后新增）
 * 商业模式和业绩预测改为强制执行
 */
const REQUIRED_EXTENDED_FIELDS: (keyof AnalysisReport)[] = [
  'businessModelResult',    // 商业模式分析（必选）
  'forecastResult',         // 业绩预测（必选）
  'valuationResult',        // 估值评估（必选）
];

/**
 * 所有必需字段（核心 + 扩展）
 */
const ALL_REQUIRED_FIELDS = [...REQUIRED_CORE_FIELDS, ...REQUIRED_EXTENDED_FIELDS];

/**
 * 验证报告完整性
 * 
 * @param report 分析报告对象（可能来自缓存）
 * @returns 校验结果，包含完整性状态和缺失字段
 * 
 * @example
 * const validation = validateReportCompleteness(cachedReport);
 * if (validation.severity === 'critical') {
 *   // 必须重新分析
 * } else if (validation.severity === 'warning') {
 *   // 可用但建议补充
 * }
 */
export function validateReportCompleteness(
  report: Partial<AnalysisReport> | null | undefined
): ReportValidationResult {
  // 空报告直接返回不完整
  if (!report) {
    return {
      isComplete: false,
      missingFields: [...ALL_REQUIRED_FIELDS],
      severity: 'critical',
      completenessPercent: 0,
    };
  }

  const missingFields: string[] = [];
  const missingCoreFields: string[] = [];
  const missingExtendedFields: string[] = [];

  // 检查核心字段
  for (const field of REQUIRED_CORE_FIELDS) {
    const value = report[field];
    if (value === undefined || value === null) {
      missingFields.push(field);
      missingCoreFields.push(field);
    }
  }

  // 检查扩展字段
  for (const field of REQUIRED_EXTENDED_FIELDS) {
    const value = report[field];
    if (value === undefined || value === null) {
      missingFields.push(field);
      missingExtendedFields.push(field);
    }
  }

  // 计算完整性百分比
  const totalRequired = ALL_REQUIRED_FIELDS.length;
  const presentCount = totalRequired - missingFields.length;
  const completenessPercent = Math.round((presentCount / totalRequired) * 100);

  // 判断严重程度
  let severity: 'critical' | 'warning' | 'ok';
  
  if (missingCoreFields.length > 0 || missingExtendedFields.length > 0) {
    // 缺少任何必需字段 - 严重不完整，必须重新分析
    severity = 'critical';
  } else {
    // 完全完整
    severity = 'ok';
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    severity,
    completenessPercent,
  };
}

/**
 * 快速检查报告是否可用（宽松模式）
 * 仅检查核心字段，用于降级场景
 * 
 * @param report 分析报告对象
 * @returns 是否可用（至少包含核心字段）
 */
export function isReportUsable(
  report: Partial<AnalysisReport> | null | undefined
): boolean {
  if (!report) return false;

  // 检查核心字段是否存在
  for (const field of REQUIRED_CORE_FIELDS) {
    if (report[field] === undefined || report[field] === null) {
      return false;
    }
  }

  return true;
}

/**
 * 获取缺失字段的中文描述
 * 用于生成用户友好的提示信息
 */
export function getMissingFieldsDescription(missingFields: string[]): string[] {
  const fieldNames: Record<string, string> = {
    planningResult: '分析规划',
    profitabilityResult: '盈利能力分析',
    balanceSheetResult: '资产负债表分析',
    cashFlowResult: '现金流分析',
    earningsQualityResult: '盈利质量分析',
    riskResult: '风险分析',
    businessInsightResult: '业务洞察',
    businessModelResult: '商业模式分析',
    forecastResult: '业绩预测',
    valuationResult: '估值评估',
    finalConclusion: '最终结论',
    trendInterpretations: '趋势解读',
  };

  return missingFields.map(field => fieldNames[field] || field);
}

/**
 * 生成完整性校验的日志消息
 */
export function getValidationLogMessage(
  reportId: number | string,
  validation: ReportValidationResult
): string {
  if (validation.isComplete) {
    return `[Report Validation] Report ${reportId} is complete (100%)`;
  }

  const missingDesc = getMissingFieldsDescription(validation.missingFields);
  return `[Report Validation] Report ${reportId} is ${validation.severity} incomplete (${validation.completenessPercent}%), missing: ${missingDesc.join(', ')}`;
}
