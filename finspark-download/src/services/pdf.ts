// PDF 报告导出服务
// 生成财报分析的 HTML 报告，包含完整专业解读，可用于打印或转换为 PDF

import type { AnalysisReport, FinalConclusionResult, ComicData, ValuationResult, ForecastResult, BusinessInsightResult } from '../types';

export interface PDFReportOptions {
  companyName: string;
  companyCode: string;
  reportDate: string;
  reportPeriod?: string;
  includeCharts?: boolean;
  includeComic?: boolean;
  comicData?: ComicData;
  // 水印相关选项
  addWatermark?: boolean;
  watermarkText?: string;
  userTier?: 'guest' | 'free' | 'pro' | 'elite';
}

/**
 * 生成可打印的 HTML 报告 - 完整专业版
 * 包含所有分析模块的专业深度解读
 */
export function generatePrintableReport(
  report: Partial<AnalysisReport>,
  options: PDFReportOptions
): string {
  const conclusion = report.finalConclusion;
  const profitability = report.profitabilityResult || {};
  const risk = report.riskResult || {};
  const balanceSheet = report.balanceSheetResult || {};
  const cashFlow = report.cashFlowResult || {};
  const earningsQuality = report.earningsQualityResult || {};
  const businessModel = report.businessModelResult || {};
  
  // 提取摘要和详细分析
  const pSummary = (profitability as any).summary || profitability;
  const pDetail = (profitability as any).detailedAnalysis || {};
  const bSummary = (balanceSheet as any).summary || balanceSheet;
  const bDetail = (balanceSheet as any).detailedAnalysis || {};
  const cSummary = (cashFlow as any).summary || cashFlow;
  const cDetail = (cashFlow as any).detailedAnalysis || {};
  const eqSummary = (earningsQuality as any).summary || earningsQuality;
  const eqDetail = (earningsQuality as any).detailedAnalysis || {};
  const rSummary = (risk as any).summary || risk;
  const rDetail = (risk as any).detailedAnalysis || {};
  
  // 商业模式分析数据
  const bmSummary = (businessModel as any).summary || {};
  const moatAnalysis = (businessModel as any).moatAnalysis || {};
  const model = (businessModel as any).businessModel || {};
  const culture = (businessModel as any).cultureAndGovernance || {};
  const investmentImpl = (businessModel as any).investmentImplication || {};
  const primaryMoat = moatAnalysis.primaryMoat || {};
  const valueProposition = model.valueProposition || {};
  const revenueModel = model.revenueModel || {};
  
  // 估值评估数据
  const valuation = report.valuationResult || {} as any;
  const vSummary = valuation.summary || {};
  const relativeVal = valuation.relativeValuation || {};
  const intrinsicVal = valuation.intrinsicValue || {};
  const marketSentiment = valuation.marketSentiment || {};
  const investmentTiming = valuation.investmentImplication || {};
  
  // 业绩预测数据
  const forecast = report.forecastResult || {} as any;
  const fSummary = (forecast as any).summary || {};
  const revenueForecast = forecast.revenueForecast || {};
  const profitForecast = forecast.profitForecast || {};
  const scenarioAnalysis = (forecast as any).scenarioAnalysis || {};
  
  // 业务洞察数据
  const businessInsight = report.businessInsightResult || {} as any;
  const biSummary = (businessInsight as any).summary || {};
  const channelAnalysis = businessInsight.channelAnalysis || (businessInsight as any).channel || {};
  const productAnalysis = businessInsight.productStructure || (businessInsight as any).product || {};
  const industryAnalysis = businessInsight.industryPosition || (businessInsight as any).industry || {};
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.companyName} 财报分析报告 - Finspark</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    
    @media print {
      body {
        padding: 15px;
        font-size: 11px;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      .avoid-break {
        page-break-inside: avoid;
      }
      h2 {
        page-break-after: avoid;
      }
      .watermark {
        position: fixed !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    
    /* 水印样式 */
    .watermark {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    }
    
    .watermark-text {
      position: absolute;
      transform: rotate(-45deg);
      font-size: 24px;
      color: rgba(200, 200, 200, 0.3);
      white-space: nowrap;
      user-select: none;
      font-weight: bold;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #d4af37;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #d4af37;
      margin-bottom: 10px;
    }
    
    h1 {
      font-size: 28px;
      color: #1a1a2e;
      margin-bottom: 10px;
    }
    
    .meta {
      color: #666;
      font-size: 14px;
    }
    
    h2 {
      font-size: 18px;
      color: #1a1a2e;
      border-left: 4px solid #d4af37;
      padding-left: 12px;
      margin: 25px 0 15px;
      background: linear-gradient(90deg, #f8f4e8 0%, transparent 100%);
      padding: 8px 12px;
    }
    
    h3 {
      font-size: 15px;
      color: #444;
      margin: 15px 0 10px;
      padding-bottom: 5px;
      border-bottom: 1px dashed #ddd;
    }
    
    h4 {
      font-size: 13px;
      color: #555;
      margin: 12px 0 8px;
    }
    
    .summary-box {
      background: linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%);
      color: #fff;
      padding: 25px;
      border-radius: 12px;
      margin: 20px 0;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      text-align: center;
    }
    
    .summary-item {
      padding: 12px;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
    }
    
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #d4af37;
    }
    
    .summary-label {
      font-size: 11px;
      color: #aaa;
      margin-top: 5px;
    }
    
    .card {
      background: #f9f9f9;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 15px;
      margin: 12px 0;
    }
    
    .card-title {
      font-weight: bold;
      color: #d4af37;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .detail-section {
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .detail-section.moat { border-left: 4px solid #f59e0b; }
    .detail-section.business { border-left: 4px solid #3b82f6; }
    .detail-section.profit { border-left: 4px solid #10b981; }
    .detail-section.balance { border-left: 4px solid #6366f1; }
    .detail-section.cashflow { border-left: 4px solid #8b5cf6; }
    .detail-section.earnings { border-left: 4px solid #f97316; }
    .detail-section.risk { border-left: 4px solid #ef4444; }
    
    .detail-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    }
    
    .detail-title.moat { color: #d97706; }
    .detail-title.business { color: #2563eb; }
    .detail-title.profit { color: #059669; }
    .detail-title.balance { color: #4f46e5; }
    .detail-title.cashflow { color: #7c3aed; }
    .detail-title.earnings { color: #ea580c; }
    .detail-title.risk { color: #dc2626; }
    
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 15px;
      font-size: 11px;
      font-weight: bold;
    }
    
    .badge-green { background: #d4edda; color: #155724; }
    .badge-yellow { background: #fff3cd; color: #856404; }
    .badge-red { background: #f8d7da; color: #721c24; }
    .badge-blue { background: #cce5ff; color: #004085; }
    .badge-purple { background: #e2d4f0; color: #563d7c; }
    .badge-orange { background: #ffe5d0; color: #c35a00; }
    
    .risk-indicator {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
    }
    
    .risk-low { background: #d4edda; color: #155724; }
    .risk-moderate { background: #fff3cd; color: #856404; }
    .risk-high { background: #f8d7da; color: #721c24; }
    .risk-critical { background: #721c24; color: #fff; }
    
    .recommendation {
      text-align: center;
      padding: 25px;
      background: #f5f5f5;
      border-radius: 12px;
      margin: 25px 0;
    }
    
    .rec-action {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .rec-buy { color: #28a745; }
    .rec-hold { color: #ffc107; }
    .rec-sell { color: #dc3545; }
    
    .takeaways {
      background: #fff8e1;
      border-left: 4px solid #d4af37;
      padding: 15px;
      margin: 15px 0;
    }
    
    .takeaways ul {
      margin-left: 20px;
    }
    
    .takeaways li {
      margin: 6px 0;
      font-size: 13px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12px;
    }
    
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    
    .metric-card {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    
    .metric-label {
      font-size: 11px;
      color: #6c757d;
      margin-bottom: 4px;
    }
    
    .metric-value {
      font-size: 16px;
      font-weight: bold;
      color: #495057;
    }
    
    .metric-value.positive { color: #28a745; }
    .metric-value.negative { color: #dc3545; }
    .metric-value.neutral { color: #ffc107; }
    
    .analysis-text {
      font-size: 13px;
      color: #555;
      line-height: 1.7;
      margin: 8px 0;
    }
    
    .highlight-box {
      background: #e8f4fd;
      border: 1px solid #b8daff;
      border-radius: 6px;
      padding: 12px;
      margin: 10px 0;
    }
    
    .warning-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 12px;
      margin: 10px 0;
    }
    
    .danger-box {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 6px;
      padding: 12px;
      margin: 10px 0;
    }
    
    .comic-section {
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
    }
    
    .comic-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    
    .comic-panel {
      border: 2px solid #e9ecef;
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }
    
    .comic-panel img {
      width: 100%;
      height: auto;
      display: block;
    }
    
    .comic-caption {
      padding: 10px;
      font-size: 12px;
      color: #555;
      background: #f8f9fa;
      text-align: center;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #999;
      font-size: 11px;
    }
    
    .print-btn {
      background: #d4af37;
      color: #1a1a2e;
      border: none;
      padding: 12px 30px;
      font-size: 16px;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
      margin: 20px auto;
      display: block;
    }
    
    .print-btn:hover {
      background: #c4a030;
    }
    
    .toc {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .toc h3 {
      border-bottom: none;
      margin-top: 0;
    }
    
    .toc ul {
      list-style: none;
      padding: 0;
    }
    
    .toc li {
      padding: 5px 0;
      border-bottom: 1px dotted #ddd;
    }
    
    .toc a {
      color: #1a1a2e;
      text-decoration: none;
    }
    
    .sub-section {
      margin-left: 15px;
      padding-left: 15px;
      border-left: 2px solid #e9ecef;
    }
    
    .data-source {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
      font-size: 12px;
    }
    
    .disclaimer {
      background: #fff8e1;
      border: 1px solid #ffecb3;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
      font-size: 11px;
      color: #666;
    }
  </style>
</head>
<body>
  ${options.addWatermark ? generateWatermarkHtml(options.watermarkText || 'Finspark 免费版 - 升级会员去除水印') : ''}
  
  <!-- 专业封面页 -->
  <div class="cover-page" style="page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; margin: -40px; padding: 60px 40px; position: relative;">
    <div style="position: absolute; top: 40px; right: 40px; font-size: 12px; color: rgba(255,255,255,0.5);">机密文件 · 仅供内部使用</div>
    
    <div style="margin-bottom: 60px;">
      <div style="font-size: 18px; letter-spacing: 8px; color: #d4af37; margin-bottom: 10px;">FINSPARK</div>
      <div style="font-size: 14px; color: rgba(255,255,255,0.6);">AI驱动的智能投资分析平台</div>
    </div>
    
    <div style="margin-bottom: 40px;">
      <h1 style="font-size: 42px; font-weight: 700; letter-spacing: 2px; margin-bottom: 20px; color: white; text-shadow: 2px 2px 10px rgba(0,0,0,0.3);">${options.companyName}</h1>
      <div style="font-size: 18px; color: #d4af37; letter-spacing: 4px;">${options.companyCode}</div>
    </div>
    
    <div style="width: 120px; height: 2px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin: 40px 0;"></div>
    
    <div style="margin-bottom: 60px;">
      <h2 style="font-size: 28px; font-weight: 500; color: white; letter-spacing: 6px;">财报分析报告</h2>
      <div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 15px;">${options.reportPeriod || '年度报告'} · 深度解读版</div>
    </div>
    
    <div style="padding: 20px 40px; border: 1px solid rgba(212,175,55,0.3); border-radius: 8px; background: rgba(212,175,55,0.05);">
      <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 8px;">报告生成日期</div>
      <div style="font-size: 18px; color: #d4af37; font-weight: 500;">${options.reportDate}</div>
    </div>
    
    <div style="position: absolute; bottom: 40px; font-size: 11px; color: rgba(255,255,255,0.4);">
      本报告由 Finspark AI 多智能体系统自动生成 · 数据来源于公开披露财务信息
    </div>
  </div>
  
  <!-- 报告正文头部 -->
  <div class="header" style="margin-top: 40px;">
    <div class="logo">📊 Finspark 财报分析专业报告</div>
    <h1>${options.companyName} (${options.companyCode})</h1>
    <div class="meta">
      财报分析报告 | 报告期: ${options.reportPeriod || '最新财报'} | 生成日期: ${options.reportDate}
    </div>
  </div>
  
  <button class="print-btn no-print" onclick="window.print()">
    🖨️ 打印 / 导出 PDF
  </button>
  
  <!-- 专业目录页 -->
  <div class="toc" style="page-break-after: always; padding: 40px; background: #fafafa; border-radius: 8px; margin-bottom: 30px;">
    <div style="display: flex; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #d4af37;">
      <div style="font-size: 24px; margin-right: 15px;">📑</div>
      <div>
        <h3 style="font-size: 20px; color: #333; margin: 0;">报告目录</h3>
        <div style="font-size: 12px; color: #888; margin-top: 4px;">Table of Contents</div>
      </div>
    </div>
    <ul style="list-style: none; padding: 0;">
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between;">
        <a href="#summary" style="color: #333; text-decoration: none; font-weight: 500;">1. 投资建议摘要</a>
        <span style="color: #888; font-size: 12px;">Executive Summary</span>
      </li>
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between;">
        <a href="#business-model" style="color: #333; text-decoration: none; font-weight: 500;">2. 商业模式与护城河分析</a>
        <span style="color: #888; font-size: 12px;">Business Model & Moat</span>
      </li>
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd;">
        <div style="display: flex; justify-content: space-between;">
          <a href="#financial" style="color: #333; text-decoration: none; font-weight: 500;">3. 财务报表分析</a>
          <span style="color: #888; font-size: 12px;">Financial Statements</span>
        </div>
        <ul style="margin: 8px 0 0 20px; padding: 0; list-style: disc; color: #666; font-size: 13px;">
          <li>3.1 利润表分析</li>
          <li>3.2 资产负债表分析</li>
          <li>3.3 现金流量表分析</li>
          <li>3.4 三表联动分析</li>
        </ul>
      </li>
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between;">
        <a href="#valuation" style="color: #333; text-decoration: none; font-weight: 500;">4. 估值评估</a>
        <span style="color: #888; font-size: 12px;">Valuation Analysis</span>
      </li>
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between;">
        <a href="#forecast" style="color: #333; text-decoration: none; font-weight: 500;">5. 业绩预测</a>
        <span style="color: #888; font-size: 12px;">Performance Forecast</span>
      </li>
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between;">
        <a href="#insight" style="color: #333; text-decoration: none; font-weight: 500;">6. 业务洞察</a>
        <span style="color: #888; font-size: 12px;">Business Insights</span>
      </li>
      <li style="padding: 12px 0; border-bottom: 1px dashed #ddd; display: flex; justify-content: space-between;">
        <a href="#risk" style="color: #333; text-decoration: none; font-weight: 500;">7. 风险评估</a>
        <span style="color: #888; font-size: 12px;">Risk Assessment</span>
      </li>
      <li style="padding: 12px 0; ${options.includeComic ? 'border-bottom: 1px dashed #ddd;' : ''} display: flex; justify-content: space-between;">
        <a href="#conclusion" style="color: #333; text-decoration: none; font-weight: 500;">8. 投资结论</a>
        <span style="color: #888; font-size: 12px;">Investment Conclusion</span>
      </li>
      ${options.includeComic ? `
      <li style="padding: 12px 0; display: flex; justify-content: space-between;">
        <a href="#comic" style="color: #333; text-decoration: none; font-weight: 500;">9. AI漫画解读</a>
        <span style="color: #888; font-size: 12px;">AI Comic Interpretation</span>
      </li>
      ` : ''}
    </ul>
    
    <!-- 快速指标概览 -->
    <div style="margin-top: 30px; padding: 20px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
      <div style="font-size: 14px; color: #666; margin-bottom: 15px; font-weight: 500;">📊 核心指标速览</div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
        <div style="padding: 15px; background: #f9fafb; border-radius: 6px;">
          <div style="font-size: 24px; font-weight: 700; color: #d4af37;">${conclusion?.companyQuality?.score || getSmartScore(report)}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">综合评分</div>
        </div>
        <div style="padding: 15px; background: #f9fafb; border-radius: 6px;">
          <div style="font-size: 16px; font-weight: 600; color: #333;">${formatRecommendation(conclusion?.recommendation?.action) || getSmartRecommendation(report)}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">投资建议</div>
        </div>
        <div style="padding: 15px; background: #f9fafb; border-radius: 6px;">
          <div style="font-size: 16px; font-weight: 600; color: #333;">${formatInvestor(conclusion?.recommendation?.targetInvestor) || getSmartInvestor(report)}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">适合投资者</div>
        </div>
        <div style="padding: 15px; background: #f9fafb; border-radius: 6px;">
          <div style="font-size: 16px; font-weight: 600; color: #333;">${formatValuation(conclusion?.investmentValue?.valuationAssessment) || getSmartValuation(report)}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">估值评估</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 投资建议摘要 -->
  <div id="summary">
    <h2>📈 1. 投资建议摘要</h2>
    <div class="summary-box">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${conclusion?.companyQuality?.score || getSmartScore(report)}</div>
          <div class="summary-label">综合评分</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${formatRecommendation(conclusion?.recommendation?.action) || getSmartRecommendation(report)}</div>
          <div class="summary-label">投资建议</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${formatInvestor(conclusion?.recommendation?.targetInvestor) || getSmartInvestor(report)}</div>
          <div class="summary-label">适合投资者</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${formatValuation(conclusion?.investmentValue?.valuationAssessment) || getSmartValuation(report)}</div>
          <div class="summary-label">估值评估</div>
        </div>
      </div>
    </div>
    
    <!-- 投资建议 -->
    <div class="recommendation">
      <div class="rec-action ${getRecClass(conclusion?.recommendation?.action)}">
        ${formatRecommendation(conclusion?.recommendation?.action) || getSmartRecommendation(report)}
      </div>
      <p class="analysis-text">${conclusion?.recommendation?.summary || ''}</p>
    </div>
    
    <!-- 关键要点 -->
    ${conclusion?.keyTakeaways?.length ? `
    <div class="takeaways">
      <h4>📌 关键投资要点</h4>
      <ul>
        ${conclusion.keyTakeaways.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <!-- 公司质量概述 -->
    ${conclusion?.companyQuality ? `
    <div class="card avoid-break">
      <div class="card-title">🏆 公司质量评估</div>
      <p class="analysis-text">
        <strong>健康状况:</strong> ${conclusion.companyQuality.isHealthy ? '✅ 财务健康' : '⚠️ 需关注'} | 
        <strong>评分:</strong> ${conclusion.companyQuality.score || '--'}/100
      </p>
      <p class="analysis-text">${conclusion.companyQuality.summary || ''}</p>
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <!-- 商业模式与护城河分析 -->
  <div id="business-model">
    <h2>🏰 2. 商业模式与护城河分析</h2>
    
    ${bmSummary.oneSentence || bmSummary.moatStrength ? `
    <!-- 护城河概览 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">护城河强度</div>
        <div class="metric-value ${getMoatColorClass(bmSummary.moatStrength)}">${bmSummary.moatStrength || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">护城河类型</div>
        <div class="metric-value">${bmSummary.moatType || primaryMoat.type || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">护城河持久性</div>
        <div class="metric-value">${bmSummary.moatDurability || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">商业模式</div>
        <div class="metric-value">${bmSummary.modelType || revenueModel.type || '--'}</div>
      </div>
    </div>
    
    ${bmSummary.oneSentence ? `
    <div class="highlight-box">
      <strong>核心结论：</strong>${bmSummary.oneSentence}
    </div>
    ` : ''}
    ` : '<p class="analysis-text">商业模式分析数据暂未生成</p>'}
    
    <!-- 护城河深度分析 -->
    ${primaryMoat.description || moatAnalysis.moatConclusion ? `
    <div class="detail-section moat avoid-break">
      <div class="detail-title moat">🛡️ 护城河深度分析</div>
      ${primaryMoat.description ? `<p class="analysis-text">${primaryMoat.description}</p>` : ''}
      
      ${primaryMoat.evidence && primaryMoat.evidence.length > 0 ? `
      <h4>支撑证据</h4>
      <ul>
        ${primaryMoat.evidence.map((e: string) => `<li class="analysis-text">✓ ${e}</li>`).join('')}
      </ul>
      ` : ''}
      
      ${moatAnalysis.secondaryMoats && moatAnalysis.secondaryMoats.length > 0 ? `
      <h4>次要护城河</h4>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${moatAnalysis.secondaryMoats.map((m: any) => `<span class="badge badge-yellow">${m.type}: ${m.strength}</span>`).join('')}
      </div>
      ` : ''}
      
      ${moatAnalysis.moatThreats && moatAnalysis.moatThreats.length > 0 ? `
      <div class="warning-box">
        <strong>⚠️ 护城河威胁</strong>
        <ul>
          ${moatAnalysis.moatThreats.map((t: string) => `<li>${t}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      ${moatAnalysis.moatConclusion ? `
      <div class="highlight-box">
        <strong>护城河结论：</strong>${moatAnalysis.moatConclusion}
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <!-- 商业模式深度分析 -->
    ${valueProposition.description || revenueModel.description || model.sustainability ? `
    <div class="detail-section business avoid-break">
      <div class="detail-title business">💼 商业模式深度分析</div>
      
      ${valueProposition.description ? `
      <h4>价值主张</h4>
      <p class="analysis-text">${valueProposition.description}</p>
      ${valueProposition.core ? `<p class="analysis-text"><strong>核心价值：</strong>「${valueProposition.core}」</p>` : ''}
      ` : ''}
      
      ${revenueModel.description ? `
      <h4>盈利模式</h4>
      <p class="analysis-text">${revenueModel.description}</p>
      ${revenueModel.pricingPower ? `<p class="analysis-text"><strong>定价权：</strong>${revenueModel.pricingPower}</p>` : ''}
      ` : ''}
      
      ${model.scalability?.description ? `
      <h4>可扩展性分析</h4>
      <p class="analysis-text">${model.scalability.description}</p>
      ${model.scalability.marginalCost ? `<p class="analysis-text"><strong>边际成本：</strong>${model.scalability.marginalCost}</p>` : ''}
      ` : ''}
      
      ${model.sustainability?.description ? `
      <div class="highlight-box">
        <strong>可持续性 (${model.sustainability.level || '--'})：</strong>${model.sustainability.description}
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <!-- 企业文化与治理 -->
    ${culture.corporateCulture || culture.management || culture.governance ? `
    <div class="detail-section avoid-break" style="border-left-color: #10b981;">
      <div class="detail-title" style="color: #059669;">👥 企业文化与治理</div>
      
      ${culture.corporateCulture?.description ? `
      <h4>企业文化</h4>
      <p class="analysis-text">${culture.corporateCulture.description}</p>
      ${culture.corporateCulture.strengths?.length ? `
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        ${culture.corporateCulture.strengths.map((s: string) => `<span class="badge badge-green">${s}</span>`).join('')}
      </div>
      ` : ''}
      ` : ''}
      
      ${culture.management?.trackRecord ? `
      <h4>管理层评估</h4>
      <p class="analysis-text">${culture.management.trackRecord}</p>
      ${culture.management.founderInfluence ? `<p class="analysis-text"><strong>创始人影响：</strong>${culture.management.founderInfluence}</p>` : ''}
      ` : ''}
      
      ${culture.governance?.quality ? `
      <p class="analysis-text"><strong>治理质量：</strong>${culture.governance.quality}</p>
      ` : ''}
    </div>
    ` : ''}
    
    <!-- 投资含义 -->
    ${investmentImpl.summary ? `
    <div class="card avoid-break">
      <div class="card-title">💡 投资含义</div>
      <p class="analysis-text">${investmentImpl.summary}</p>
      ${investmentImpl.positives?.length ? `
      <p class="analysis-text"><strong>积极因素：</strong>${investmentImpl.positives.join('、')}</p>
      ` : ''}
      ${investmentImpl.negatives?.length ? `
      <p class="analysis-text"><strong>风险因素：</strong>${investmentImpl.negatives.join('、')}</p>
      ` : ''}
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <!-- 财务报表分析 -->
  <div id="financial">
    <h2>📊 3. 财务报表分析</h2>
    
    <!-- 核心指标概览 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">营收增长</div>
        <div class="metric-value ${getGrowthColorClass(pSummary.revenueGrowth)}">${pSummary.revenueGrowth || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">资产负债率</div>
        <div class="metric-value">${bSummary.debtRatio || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">经营现金流</div>
        <div class="metric-value">${cSummary.operatingCashFlow || cSummary.cashFlowHealth || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">盈利质量</div>
        <div class="metric-value ${getQualityColorClass(eqSummary.overallQuality)}">${eqSummary.overallQuality || '--'}</div>
      </div>
    </div>

    <!-- 3.1 利润表分析 -->
    <h3>3.1 利润表分析</h3>
    <div class="detail-section profit avoid-break">
      <div class="detail-title profit">📈 利润表深度分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">毛利率</div>
          <div class="metric-value">${pSummary.grossMargin || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">净利率</div>
          <div class="metric-value">${pSummary.netMargin || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">盈利可持续性</div>
          <div class="metric-value">${pSummary.sustainability || '--'}</div>
        </div>
      </div>
      
      ${pSummary.oneSentence ? `
      <div class="highlight-box">
        <strong>核心结论：</strong>${pSummary.oneSentence}
      </div>
      ` : ''}
      
      ${pDetail.revenueAnalysis ? `
      <h4>营收分析</h4>
      ${pDetail.revenueAnalysis.trend ? `<p class="analysis-text">${pDetail.revenueAnalysis.trend}</p>` : ''}
      ${pDetail.revenueAnalysis.drivers ? `<p class="analysis-text"><strong>驱动因素：</strong>${pDetail.revenueAnalysis.drivers}</p>` : ''}
      ${pDetail.revenueAnalysis.quality ? `<p class="analysis-text"><strong>营收质量：</strong>${pDetail.revenueAnalysis.quality}</p>` : ''}
      ` : ''}
      
      ${pDetail.profitabilityAnalysis ? `
      <h4>盈利能力分析</h4>
      ${pDetail.profitabilityAnalysis.grossMarginTrend ? `<p class="analysis-text">${pDetail.profitabilityAnalysis.grossMarginTrend}</p>` : ''}
      ${pDetail.profitabilityAnalysis.netMarginTrend ? `<p class="analysis-text">${pDetail.profitabilityAnalysis.netMarginTrend}</p>` : ''}
      ${pDetail.profitabilityAnalysis.costControl ? `<p class="analysis-text"><strong>成本控制：</strong>${pDetail.profitabilityAnalysis.costControl}</p>` : ''}
      ` : ''}
      
      ${pDetail.competitivePosition ? `
      <h4>竞争地位</h4>
      ${pDetail.competitivePosition.industryComparison ? `<p class="analysis-text">${pDetail.competitivePosition.industryComparison}</p>` : ''}
      ${pDetail.competitivePosition.pricingPower ? `<p class="analysis-text"><strong>定价能力：</strong>${pDetail.competitivePosition.pricingPower}</p>` : ''}
      ` : ''}
    </div>

    <!-- 3.2 资产负债表分析 -->
    <h3>3.2 资产负债表分析</h3>
    <div class="detail-section balance avoid-break">
      <div class="detail-title balance">⚖️ 资产负债表深度分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">流动比率</div>
          <div class="metric-value">${bSummary.currentRatio || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">速动比率</div>
          <div class="metric-value">${bSummary.quickRatio || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">财务健康</div>
          <div class="metric-value ${getHealthColorClass(bSummary.financialHealth)}">${bSummary.financialHealth || '--'}</div>
        </div>
      </div>
      
      ${bSummary.oneSentence ? `
      <div class="highlight-box">
        <strong>核心结论：</strong>${bSummary.oneSentence}
      </div>
      ` : ''}
      
      ${bDetail.assetStructure ? `
      <h4>资产结构</h4>
      ${bDetail.assetStructure.composition ? `<p class="analysis-text">${bDetail.assetStructure.composition}</p>` : ''}
      ${bDetail.assetStructure.quality ? `<p class="analysis-text"><strong>资产质量：</strong>${bDetail.assetStructure.quality}</p>` : ''}
      ${bDetail.assetStructure.efficiency ? `<p class="analysis-text"><strong>周转效率：</strong>${bDetail.assetStructure.efficiency}</p>` : ''}
      ` : ''}
      
      ${bDetail.liabilityStructure ? `
      <h4>负债结构</h4>
      ${bDetail.liabilityStructure.composition ? `<p class="analysis-text">${bDetail.liabilityStructure.composition}</p>` : ''}
      ${bDetail.liabilityStructure.repaymentPressure ? `<p class="analysis-text"><strong>偿债压力：</strong>${bDetail.liabilityStructure.repaymentPressure}</p>` : ''}
      ${bDetail.liabilityStructure.financingCost ? `<p class="analysis-text"><strong>融资成本：</strong>${bDetail.liabilityStructure.financingCost}</p>` : ''}
      ` : ''}
      
      ${bDetail.capitalStructure ? `
      <h4>资本结构</h4>
      ${bDetail.capitalStructure.equityRatio ? `<p class="analysis-text"><strong>股东权益：</strong>${bDetail.capitalStructure.equityRatio}</p>` : ''}
      ${bDetail.capitalStructure.retainedEarnings ? `<p class="analysis-text"><strong>留存收益：</strong>${bDetail.capitalStructure.retainedEarnings}</p>` : ''}
      ${bDetail.capitalStructure.capitalEfficiency ? `<p class="analysis-text"><strong>资本效率：</strong>${bDetail.capitalStructure.capitalEfficiency}</p>` : ''}
      ` : ''}
    </div>

    <div class="page-break"></div>

    <!-- 3.3 现金流量表分析 -->
    <h3>3.3 现金流量表分析</h3>
    <div class="detail-section cashflow avoid-break">
      <div class="detail-title cashflow">💰 现金流量表深度分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">自由现金流</div>
          <div class="metric-value">${cSummary.freeCashFlow || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">现金流趋势</div>
          <div class="metric-value ${getTrendColorClass(cSummary.cashFlowTrend)}">${cSummary.cashFlowTrend || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">现金充裕度</div>
          <div class="metric-value">${cSummary.cashAdequacy || '--'}</div>
        </div>
      </div>
      
      ${cSummary.oneSentence ? `
      <div class="highlight-box">
        <strong>核心结论：</strong>${cSummary.oneSentence}
      </div>
      ` : ''}
      
      ${cDetail.operatingCashFlow ? `
      <h4>经营活动现金流</h4>
      ${cDetail.operatingCashFlow.trend ? `<p class="analysis-text">${cDetail.operatingCashFlow.trend}</p>` : ''}
      ${cDetail.operatingCashFlow.quality ? `<p class="analysis-text"><strong>现金流质量：</strong>${cDetail.operatingCashFlow.quality}</p>` : ''}
      ${cDetail.operatingCashFlow.sustainability ? `<p class="analysis-text"><strong>可持续性：</strong>${cDetail.operatingCashFlow.sustainability}</p>` : ''}
      ` : ''}
      
      ${cDetail.investingCashFlow ? `
      <h4>投资活动现金流</h4>
      ${cDetail.investingCashFlow.capexAnalysis ? `<p class="analysis-text"><strong>资本支出：</strong>${cDetail.investingCashFlow.capexAnalysis}</p>` : ''}
      ${cDetail.investingCashFlow.investmentStrategy ? `<p class="analysis-text"><strong>投资策略：</strong>${cDetail.investingCashFlow.investmentStrategy}</p>` : ''}
      ` : ''}
      
      ${cDetail.financingCashFlow ? `
      <h4>筹资活动现金流</h4>
      ${cDetail.financingCashFlow.dividendPolicy ? `<p class="analysis-text"><strong>分红政策：</strong>${cDetail.financingCashFlow.dividendPolicy}</p>` : ''}
      ${cDetail.financingCashFlow.debtManagement ? `<p class="analysis-text"><strong>债务管理：</strong>${cDetail.financingCashFlow.debtManagement}</p>` : ''}
      ` : ''}
      
      ${cDetail.freeCashFlowAnalysis ? `
      <div class="highlight-box">
        <strong>自由现金流分析：</strong>${cDetail.freeCashFlowAnalysis.trend || cDetail.freeCashFlowAnalysis}
        ${cDetail.freeCashFlowAnalysis.adequacy ? `<br><strong>充裕度：</strong>${cDetail.freeCashFlowAnalysis.adequacy}` : ''}
      </div>
      ` : ''}
    </div>

    <!-- 3.4 三表联动分析 -->
    <h3>3.4 三表联动分析（盈利质量验证）</h3>
    <div class="detail-section earnings avoid-break">
      <div class="detail-title earnings">🔗 三表联动深度分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">现金/利润匹配</div>
          <div class="metric-value ${getMatchColorClass(eqSummary.cashEarningsRatio || eqSummary.cashEarningsMatch)}">${eqSummary.cashEarningsRatio || eqSummary.cashEarningsMatch || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">营收质量</div>
          <div class="metric-value ${getQualityColorClass(eqSummary.revenueQuality)}">${eqSummary.revenueQuality || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">财务操纵风险</div>
          <div class="metric-value ${getRiskColorClass(eqSummary.financialManipulationRisk)}">${eqSummary.financialManipulationRisk || '--'}</div>
        </div>
      </div>
      
      ${eqSummary.oneSentence ? `
      <div class="highlight-box">
        <strong>核心结论：</strong>${eqSummary.oneSentence}
      </div>
      ` : ''}
      
      ${eqDetail.cashEarningsAnalysis ? `
      <h4>现金利润匹配分析</h4>
      ${eqDetail.cashEarningsAnalysis.ratio ? `<p class="analysis-text"><strong>现金利润比：</strong>${eqDetail.cashEarningsAnalysis.ratio}</p>` : ''}
      ${eqDetail.cashEarningsAnalysis.analysis ? `<p class="analysis-text">${eqDetail.cashEarningsAnalysis.analysis}</p>` : ''}
      ` : ''}
      
      ${eqDetail.revenueQualityAnalysis ? `
      <h4>营收质量分析</h4>
      ${eqDetail.revenueQualityAnalysis.receivablesAnalysis ? `<p class="analysis-text"><strong>应收账款：</strong>${eqDetail.revenueQualityAnalysis.receivablesAnalysis}</p>` : ''}
      ${eqDetail.revenueQualityAnalysis.concentration ? `<p class="analysis-text"><strong>客户集中度：</strong>${eqDetail.revenueQualityAnalysis.concentration}</p>` : ''}
      ` : ''}
      
      ${eqDetail.threeStatementLinkage ? `
      <h4>三表联动验证</h4>
      ${eqDetail.threeStatementLinkage.profitCashConsistency ? `<p class="analysis-text"><strong>利润现金一致性：</strong>${eqDetail.threeStatementLinkage.profitCashConsistency}</p>` : ''}
      ${eqDetail.threeStatementLinkage.assetLiabilityMatch ? `<p class="analysis-text"><strong>资产负债匹配：</strong>${eqDetail.threeStatementLinkage.assetLiabilityMatch}</p>` : ''}
      ${eqDetail.threeStatementLinkage.overallAssessment ? `
      <div class="highlight-box">
        <strong>整体评估：</strong>${eqDetail.threeStatementLinkage.overallAssessment}
      </div>
      ` : ''}
      ` : ''}
      
      ${(earningsQuality as any).redFlags && (earningsQuality as any).redFlags.length > 0 ? `
      <div class="danger-box">
        <strong>⚠️ 财务预警信号</strong>
        <ul>
          ${(earningsQuality as any).redFlags.map((f: string) => `<li>${f}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
  </div>

  <div class="page-break"></div>

  <!-- 估值评估 -->
  <div id="valuation">
    <h2>💰 4. 估值评估</h2>
    
    ${vSummary.currentPE || vSummary.overallAssessment ? `
    <!-- 估值核心指标 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">PE (市盈率)</div>
        <div class="metric-value">${vSummary.currentPE || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">PB (市净率)</div>
        <div class="metric-value">${vSummary.currentPB || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">PS (市销率)</div>
        <div class="metric-value">${vSummary.currentPS || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">估值结论</div>
        <div class="metric-value ${getValuationColorClass(vSummary.overallAssessment)}">${vSummary.overallAssessment || '--'}</div>
      </div>
    </div>
    
    ${vSummary.oneSentence ? `
    <div class="highlight-box">
      <strong>核心结论：</strong>${vSummary.oneSentence}
    </div>
    ` : ''}
    ` : '<p class="analysis-text">估值评估数据暂未生成</p>'}
    
    <!-- 相对估值分析 -->
    ${relativeVal.peAnalysis || relativeVal.pbAnalysis ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #8b5cf6;">
      <div class="detail-title" style="color: #7c3aed;">📊 相对估值分析</div>
      
      ${relativeVal.peAnalysis ? `
      <h4>PE估值分析</h4>
      <table>
        <tr>
          <th>指标</th>
          <th>当前值</th>
          <th>历史均值</th>
          <th>行业均值</th>
        </tr>
        <tr>
          <td>PE (市盈率)</td>
          <td>${relativeVal.peAnalysis.current || '--'}</td>
          <td>${relativeVal.peAnalysis.historicalAvg || '--'}</td>
          <td>${relativeVal.peAnalysis.industryAvg || '--'}</td>
        </tr>
      </table>
      ${relativeVal.peAnalysis.assessment ? `<p class="analysis-text">${relativeVal.peAnalysis.assessment}</p>` : ''}
      ` : ''}
      
      ${relativeVal.pbAnalysis ? `
      <h4>PB估值分析</h4>
      <table>
        <tr>
          <th>指标</th>
          <th>当前值</th>
          <th>历史均值</th>
          <th>行业均值</th>
        </tr>
        <tr>
          <td>PB (市净率)</td>
          <td>${relativeVal.pbAnalysis.current || '--'}</td>
          <td>${relativeVal.pbAnalysis.historicalAvg || '--'}</td>
          <td>${relativeVal.pbAnalysis.industryAvg || '--'}</td>
        </tr>
      </table>
      ${relativeVal.pbAnalysis.assessment ? `<p class="analysis-text">${relativeVal.pbAnalysis.assessment}</p>` : ''}
      ` : ''}
      
      ${relativeVal.psAnalysis ? `
      <h4>PS估值分析</h4>
      <table>
        <tr>
          <th>指标</th>
          <th>当前值</th>
          <th>历史均值</th>
          <th>行业均值</th>
        </tr>
        <tr>
          <td>PS (市销率)</td>
          <td>${relativeVal.psAnalysis.current || '--'}</td>
          <td>${relativeVal.psAnalysis.historicalAvg || '--'}</td>
          <td>${relativeVal.psAnalysis.industryAvg || '--'}</td>
        </tr>
      </table>
      ${relativeVal.psAnalysis.assessment ? `<p class="analysis-text">${relativeVal.psAnalysis.assessment}</p>` : ''}
      ` : ''}
    </div>
    ` : ''}
    
    <!-- 内在价值分析 -->
    ${intrinsicVal.dcfEstimate || intrinsicVal.fairValueRange ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #06b6d4;">
      <div class="detail-title" style="color: #0891b2;">💎 内在价值分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">DCF估值</div>
          <div class="metric-value">${intrinsicVal.dcfEstimate || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">合理价值区间</div>
          <div class="metric-value">${intrinsicVal.fairValueRange || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">安全边际</div>
          <div class="metric-value">${intrinsicVal.marginOfSafety || '--'}</div>
        </div>
      </div>
      
      ${intrinsicVal.assessment ? `
      <div class="highlight-box">
        <strong>内在价值评估：</strong>${intrinsicVal.assessment}
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <!-- 市场情绪分析 -->
    ${marketSentiment.sentiment || marketSentiment.analysis ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #f59e0b;">
      <div class="detail-title" style="color: #d97706;">📈 市场情绪分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">换手率</div>
          <div class="metric-value">${marketSentiment.turnoverRate || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">量比</div>
          <div class="metric-value">${marketSentiment.volumeRatio || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">市场情绪</div>
          <div class="metric-value ${getSentimentColorClass(marketSentiment.sentiment)}">${marketSentiment.sentiment || '--'}</div>
        </div>
      </div>
      
      ${marketSentiment.analysis ? `<p class="analysis-text">${marketSentiment.analysis}</p>` : ''}
    </div>
    ` : ''}
    
    <!-- 投资时机建议 -->
    ${investmentTiming.suggestedAction || investmentTiming.entryPointAssessment ? `
    <div class="card avoid-break">
      <div class="card-title">🎯 投资时机建议</div>
      <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="metric-card">
          <div class="metric-label">建议操作</div>
          <div class="metric-value ${getActionColorClass(investmentTiming.suggestedAction)}">${investmentTiming.suggestedAction || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">目标价</div>
          <div class="metric-value">${investmentTiming.priceTarget || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">上涨空间</div>
          <div class="metric-value">${investmentTiming.upside || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">投资周期</div>
          <div class="metric-value">${investmentTiming.timeHorizon || '--'}</div>
        </div>
      </div>
      ${investmentTiming.entryPointAssessment ? `<p class="analysis-text">${investmentTiming.entryPointAssessment}</p>` : ''}
    </div>
    ` : ''}
    
    <!-- 催化剂与风险 -->
    ${(valuation.catalysts && valuation.catalysts.length > 0) || (valuation.risks && valuation.risks.length > 0) ? `
    <div class="metrics-grid" style="grid-template-columns: repeat(2, 1fr);">
      ${valuation.catalysts && valuation.catalysts.length > 0 ? `
      <div class="highlight-box">
        <strong>📈 上涨催化剂</strong>
        <ul>
          ${valuation.catalysts.map((c: string) => `<li>${c}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      ${valuation.risks && valuation.risks.length > 0 ? `
      <div class="warning-box">
        <strong>⚠️ 估值风险</strong>
        <ul>
          ${valuation.risks.map((r: string) => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <!-- 业绩预测 -->
  <div id="forecast">
    <h2>🔮 5. 业绩预测</h2>
    
    ${fSummary.outlook || fSummary.confidence ? `
    <!-- 预测概览 -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">业绩展望</div>
        <div class="metric-value">${fSummary.outlook || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">增长预期</div>
        <div class="metric-value ${getGrowthColorClass(fSummary.growthExpectation)}">${fSummary.growthExpectation || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">预测置信度</div>
        <div class="metric-value">${forecast.confidence || fSummary.confidence || '--'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">管理层指引</div>
        <div class="metric-value">${fSummary.managementGuidance || '--'}</div>
      </div>
    </div>
    
    ${fSummary.oneSentence ? `
    <div class="highlight-box">
      <strong>核心结论：</strong>${fSummary.oneSentence}
    </div>
    ` : ''}
    ` : ''}
    
    <!-- 营收与利润预测 -->
    ${revenueForecast.nextQuarter || profitForecast.nextQuarter ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #10b981;">
      <div class="detail-title" style="color: #059669;">📊 财务预测</div>
      
      <h4>营收预测</h4>
      <table>
        <tr>
          <th>预测期间</th>
          <th>最低预期</th>
          <th>预期值</th>
          <th>最高预期</th>
        </tr>
        ${revenueForecast.nextQuarter ? `
        <tr>
          <td>下季度</td>
          <td>${revenueForecast.nextQuarter.min || '--'}</td>
          <td><strong>${revenueForecast.nextQuarter.expected || '--'}</strong></td>
          <td>${revenueForecast.nextQuarter.max || '--'}</td>
        </tr>
        ` : ''}
        ${revenueForecast.fullYear ? `
        <tr>
          <td>全年</td>
          <td>${revenueForecast.fullYear.min || '--'}</td>
          <td><strong>${revenueForecast.fullYear.expected || '--'}</strong></td>
          <td>${revenueForecast.fullYear.max || '--'}</td>
        </tr>
        ` : ''}
      </table>
      
      <h4>利润预测</h4>
      <table>
        <tr>
          <th>预测期间</th>
          <th>最低预期</th>
          <th>预期值</th>
          <th>最高预期</th>
        </tr>
        ${profitForecast.nextQuarter ? `
        <tr>
          <td>下季度</td>
          <td>${profitForecast.nextQuarter.min || '--'}</td>
          <td><strong>${profitForecast.nextQuarter.expected || '--'}</strong></td>
          <td>${profitForecast.nextQuarter.max || '--'}</td>
        </tr>
        ` : ''}
        ${profitForecast.fullYear ? `
        <tr>
          <td>全年</td>
          <td>${profitForecast.fullYear.min || '--'}</td>
          <td><strong>${profitForecast.fullYear.expected || '--'}</strong></td>
          <td>${profitForecast.fullYear.max || '--'}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    ` : '<p class="analysis-text">业绩预测数据暂未生成</p>'}
    
    <!-- 情景分析 -->
    ${scenarioAnalysis.optimistic || scenarioAnalysis.base || scenarioAnalysis.pessimistic ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #6366f1;">
      <div class="detail-title" style="color: #4f46e5;">🎭 情景分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        ${scenarioAnalysis.optimistic ? `
        <div class="card" style="background: #d4edda;">
          <div class="card-title" style="color: #155724;">📈 乐观情景</div>
          ${scenarioAnalysis.optimistic.probability ? `<p class="analysis-text"><strong>概率：</strong>${scenarioAnalysis.optimistic.probability}</p>` : ''}
          ${scenarioAnalysis.optimistic.description ? `<p class="analysis-text">${scenarioAnalysis.optimistic.description}</p>` : ''}
          ${scenarioAnalysis.optimistic.impact ? `<p class="analysis-text"><strong>影响：</strong>${scenarioAnalysis.optimistic.impact}</p>` : ''}
        </div>
        ` : ''}
        ${scenarioAnalysis.base ? `
        <div class="card" style="background: #fff3cd;">
          <div class="card-title" style="color: #856404;">📊 基准情景</div>
          ${scenarioAnalysis.base.probability ? `<p class="analysis-text"><strong>概率：</strong>${scenarioAnalysis.base.probability}</p>` : ''}
          ${scenarioAnalysis.base.description ? `<p class="analysis-text">${scenarioAnalysis.base.description}</p>` : ''}
          ${scenarioAnalysis.base.impact ? `<p class="analysis-text"><strong>影响：</strong>${scenarioAnalysis.base.impact}</p>` : ''}
        </div>
        ` : ''}
        ${scenarioAnalysis.pessimistic ? `
        <div class="card" style="background: #f8d7da;">
          <div class="card-title" style="color: #721c24;">📉 悲观情景</div>
          ${scenarioAnalysis.pessimistic.probability ? `<p class="analysis-text"><strong>概率：</strong>${scenarioAnalysis.pessimistic.probability}</p>` : ''}
          ${scenarioAnalysis.pessimistic.description ? `<p class="analysis-text">${scenarioAnalysis.pessimistic.description}</p>` : ''}
          ${scenarioAnalysis.pessimistic.impact ? `<p class="analysis-text"><strong>影响：</strong>${scenarioAnalysis.pessimistic.impact}</p>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}
    
    <!-- 预测假设与风险 -->
    ${(forecast.assumptions && forecast.assumptions.length > 0) || (forecast.risks && forecast.risks.length > 0) ? `
    <div class="metrics-grid" style="grid-template-columns: repeat(2, 1fr);">
      ${forecast.assumptions && forecast.assumptions.length > 0 ? `
      <div class="card avoid-break">
        <div class="card-title">📋 预测假设</div>
        <ul>
          ${forecast.assumptions.map((a: string) => `<li class="analysis-text">${a}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      ${forecast.risks && forecast.risks.length > 0 ? `
      <div class="warning-box">
        <strong>⚠️ 预测风险</strong>
        <ul>
          ${forecast.risks.map((r: string) => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    ${forecast.caveats && forecast.caveats.length > 0 ? `
    <div class="card avoid-break" style="background: #f0f0f0;">
      <div class="card-title">📝 注意事项</div>
      <ul>
        ${forecast.caveats.map((c: string) => `<li class="analysis-text">${c}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <!-- 业务洞察 -->
  <div id="insight">
    <h2>🔍 6. 业务洞察</h2>
    
    ${biSummary.oneSentence || businessInsight.keyFindings ? `
    ${biSummary.oneSentence ? `
    <div class="highlight-box">
      <strong>核心洞察：</strong>${biSummary.oneSentence}
    </div>
    ` : ''}
    ` : ''}
    
    <!-- 渠道分析 -->
    ${channelAnalysis.changes || channelAnalysis.description || channelAnalysis.trend ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #ec4899;">
      <div class="detail-title" style="color: #db2777;">🏪 渠道分析</div>
      
      ${channelAnalysis.description ? `<p class="analysis-text">${channelAnalysis.description}</p>` : ''}
      
      ${channelAnalysis.changes && channelAnalysis.changes.length > 0 ? `
      <h4>渠道变化</h4>
      <ul>
        ${channelAnalysis.changes.map((c: string) => `<li class="analysis-text">${c}</li>`).join('')}
      </ul>
      ` : ''}
      
      ${channelAnalysis.impact ? `
      <div class="highlight-box">
        <strong>影响评估：</strong>${channelAnalysis.impact}
      </div>
      ` : ''}
      
      ${channelAnalysis.trend ? `<p class="analysis-text"><strong>渠道趋势：</strong>${channelAnalysis.trend}</p>` : ''}
    </div>
    ` : ''}
    
    <!-- 产品分析 -->
    ${productAnalysis.changes || productAnalysis.description || productAnalysis.trend ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #14b8a6;">
      <div class="detail-title" style="color: #0d9488;">📦 产品结构分析</div>
      
      ${productAnalysis.description ? `<p class="analysis-text">${productAnalysis.description}</p>` : ''}
      
      ${productAnalysis.changes && productAnalysis.changes.length > 0 ? `
      <h4>产品变化</h4>
      <ul>
        ${productAnalysis.changes.map((c: string) => `<li class="analysis-text">${c}</li>`).join('')}
      </ul>
      ` : ''}
      
      ${productAnalysis.trend ? `
      <div class="highlight-box">
        <strong>产品趋势：</strong>${productAnalysis.trend}
      </div>
      ` : ''}
    </div>
    ` : ''}
    
    <!-- 行业分析 -->
    ${industryAnalysis.cyclicalImpact || industryAnalysis.competitivePosition || industryAnalysis.marketTrend ? `
    <div class="detail-section avoid-break" style="border-left: 4px solid #f97316;">
      <div class="detail-title" style="color: #ea580c;">🏭 行业地位分析</div>
      
      <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="metric-card">
          <div class="metric-label">周期影响</div>
          <div class="metric-value">${industryAnalysis.cyclicalImpact || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">竞争地位</div>
          <div class="metric-value">${industryAnalysis.competitivePosition || '--'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">市场趋势</div>
          <div class="metric-value">${industryAnalysis.marketTrend || '--'}</div>
        </div>
      </div>
      
      ${industryAnalysis.analysis ? `<p class="analysis-text">${industryAnalysis.analysis}</p>` : ''}
    </div>
    ` : ''}
    
    <!-- 关键发现 -->
    ${businessInsight.keyFindings && businessInsight.keyFindings.length > 0 ? `
    <div class="card avoid-break">
      <div class="card-title">💡 关键发现</div>
      <ul>
        ${businessInsight.keyFindings.map((f: string, i: number) => `<li class="analysis-text"><strong>${i + 1}.</strong> ${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <!-- 风险评估 -->
  <div id="risk">
    <h2>⚠️ 7. 风险评估</h2>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">综合风险</div>
        <div class="metric-value ${getRiskColorClass(parseRisk(rSummary.overallRisk))}">${parseRisk(rSummary.overallRisk)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">负债风险</div>
        <div class="metric-value ${getRiskColorClass(parseRisk(rSummary.debtRisk))}">${parseRisk(rSummary.debtRisk)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">流动性风险</div>
        <div class="metric-value ${getRiskColorClass(parseRisk(rSummary.liquidityRisk))}">${parseRisk(rSummary.liquidityRisk)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">运营风险</div>
        <div class="metric-value ${getRiskColorClass(parseRisk(rSummary.operationalRisk))}">${parseRisk(rSummary.operationalRisk)}</div>
      </div>
    </div>
    
    ${rSummary.oneSentence ? `
    <div class="warning-box">
      <strong>风险提示：</strong>${rSummary.oneSentence}
    </div>
    ` : ''}
    
    <div class="detail-section risk avoid-break">
      <div class="detail-title risk">🔍 风险详细分析</div>
      
      ${rDetail.debtRisk ? `
      <h4>负债风险详情</h4>
      ${rDetail.debtRisk.analysis ? `<p class="analysis-text">${rDetail.debtRisk.analysis}</p>` : ''}
      ${rDetail.debtRisk.debtToEquity ? `<p class="analysis-text"><strong>资产负债率：</strong>${rDetail.debtRisk.debtToEquity}</p>` : ''}
      ${rDetail.debtRisk.interestCoverage ? `<p class="analysis-text"><strong>利息保障倍数：</strong>${rDetail.debtRisk.interestCoverage}</p>` : ''}
      ` : ''}
      
      ${rDetail.liquidityRisk ? `
      <h4>流动性风险详情</h4>
      ${rDetail.liquidityRisk.analysis ? `<p class="analysis-text">${rDetail.liquidityRisk.analysis}</p>` : ''}
      ${rDetail.liquidityRisk.currentRatio ? `<p class="analysis-text"><strong>流动比率：</strong>${rDetail.liquidityRisk.currentRatio}</p>` : ''}
      ${rDetail.liquidityRisk.quickRatio ? `<p class="analysis-text"><strong>速动比率：</strong>${rDetail.liquidityRisk.quickRatio}</p>` : ''}
      ` : ''}
      
      ${rDetail.operationalRisk ? `
      <h4>运营风险详情</h4>
      ${rDetail.operationalRisk.analysis ? `<p class="analysis-text">${rDetail.operationalRisk.analysis}</p>` : ''}
      ${rDetail.operationalRisk.inventoryRisk ? `<p class="analysis-text"><strong>存货风险：</strong>${rDetail.operationalRisk.inventoryRisk}</p>` : ''}
      ${rDetail.operationalRisk.receivablesRisk ? `<p class="analysis-text"><strong>应收账款风险：</strong>${rDetail.operationalRisk.receivablesRisk}</p>` : ''}
      ` : ''}
      
      ${rDetail.marketRisk ? `
      <h4>市场风险</h4>
      ${rDetail.marketRisk.cyclicality ? `<p class="analysis-text"><strong>周期性：</strong>${rDetail.marketRisk.cyclicality}</p>` : ''}
      ${rDetail.marketRisk.competition ? `<p class="analysis-text"><strong>竞争风险：</strong>${rDetail.marketRisk.competition}</p>` : ''}
      ${rDetail.marketRisk.regulation ? `<p class="analysis-text"><strong>监管风险：</strong>${rDetail.marketRisk.regulation}</p>` : ''}
      ` : ''}
    </div>
    
    ${(risk as any).riskFactors && (risk as any).riskFactors.length > 0 ? `
    <div class="danger-box">
      <strong>⚠️ 主要风险因素</strong>
      <ul>
        ${(risk as any).riskFactors.map((f: string) => `<li>${f}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${(risk as any).riskMitigations && (risk as any).riskMitigations.length > 0 ? `
    <div class="highlight-box">
      <strong>✅ 风险缓释因素</strong>
      <ul>
        ${(risk as any).riskMitigations.map((m: string) => `<li>${m}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>

  <!-- 投资结论 -->
  <div id="conclusion">
    <h2>📋 8. 投资结论</h2>
    
    <div class="card avoid-break">
      <div class="card-title">💎 投资价值评估</div>
      <p class="analysis-text">
        <strong>长期价值：</strong> ${conclusion?.investmentValue?.hasLongTermValue ? '✅ 具有长期投资价值' : '⚠️ 价值有待验证'}
      </p>
      <p class="analysis-text">${conclusion?.investmentValue?.summary || ''}</p>
    </div>
    
    <div class="card avoid-break">
      <div class="card-title">⚖️ 风险收益评估</div>
      <p class="analysis-text">
        <strong>风险可接受度：</strong> ${conclusion?.riskAssessment?.isAcceptable ? '✅ 风险可接受' : '⚠️ 风险较高'}
      </p>
      ${conclusion?.riskAssessment?.mainRisks?.length ? `
      <p class="analysis-text"><strong>主要风险：</strong>${conclusion.riskAssessment.mainRisks.join('、')}</p>
      ` : ''}
      <p class="analysis-text">${conclusion?.riskAssessment?.summary || ''}</p>
    </div>
    
    <div class="recommendation">
      <div class="rec-action ${getRecClass(conclusion?.recommendation?.action)}">
        最终建议: ${formatRecommendation(conclusion?.recommendation?.action) || getSmartRecommendation(report)}
      </div>
      <p class="analysis-text">
        <strong>目标投资者：</strong>${formatInvestor(conclusion?.recommendation?.targetInvestor) || getSmartInvestor(report)} | 
        <strong>投资期限：</strong>${formatTimeHorizon(conclusion?.recommendation?.timeHorizon)}
      </p>
      <p class="analysis-text">${conclusion?.recommendation?.summary || ''}</p>
    </div>
  </div>

  ${options.includeComic && options.comicData ? `
  <div class="page-break"></div>
  
  <!-- AI漫画解读 -->
  <div id="comic">
    <h2>🎨 9. AI漫画解读</h2>
    
    <div class="comic-section">
      <p class="analysis-text" style="text-align: center; margin-bottom: 15px;">
        ${options.comicData.summary || '以漫画形式解读财报分析结果，让财务数据更易理解'}
      </p>
      
      <div class="comic-grid">
        ${options.comicData.panels.map((panel, index) => `
        <div class="comic-panel avoid-break">
          ${panel.imageUrl && !panel.imageUrl.includes('placeholder') ? 
            `<img src="${panel.imageUrl}" alt="Panel ${index + 1}" />` : 
            `<div style="background: #f0f0f0; height: 200px; display: flex; align-items: center; justify-content: center; color: #999;">图片加载中...</div>`
          }
          <div class="comic-caption">
            <strong>第${index + 1}页</strong>: ${panel.caption || ''}
            ${panel.dialogue ? `<br><em>"${panel.dialogue}"</em>` : ''}
          </div>
        </div>
        `).join('')}
      </div>
    </div>
  </div>
  ` : ''}

  <!-- 数据来源 -->
  <div class="data-source">
    <strong>📊 数据来源声明</strong>
    <p>本报告数据来源于以下渠道：</p>
    <ul>
      <li><strong>主要来源：</strong>上海证券交易所、深圳证券交易所、巨潮资讯网</li>
      <li><strong>数据接口：</strong>Tushare 金融数据接口 (tushare.pro)</li>
      <li><strong>分析引擎：</strong>VectorEngine AI 智能分析系统</li>
    </ul>
  </div>

  <!-- 免责声明 -->
  <div class="disclaimer">
    <strong>⚠️ 重要免责声明</strong>
    <p>本报告由 Finspark AI 财报分析系统自动生成，仅供投资参考，不构成任何投资建议。</p>
    <ul>
      <li>本报告基于公开财务数据进行分析，不保证数据的完整性和准确性</li>
      <li>投资决策应结合个人风险承受能力和投资目标</li>
      <li>过往业绩不代表未来表现，股市有风险，投资需谨慎</li>
      <li>AI分析结果仅供参考，最终投资决策应由投资者自行判断</li>
    </ul>
  </div>

  <div class="footer">
    <p>本报告由 Finspark AI 财报分析系统自动生成</p>
    <p>报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。</p>
    <p>© ${new Date().getFullYear()} Finspark Financial Analysis | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>
  `;
}

// ========== 辅助函数 ==========

function formatRecommendation(action?: string): string {
  const map: Record<string, string> = {
    strong_buy: '强烈买入',
    buy: '买入',
    hold: '持有',
    sell: '卖出',
    strong_sell: '强烈卖出',
  };
  return map[action || ''] || '';
}

function formatInvestor(type?: string): string {
  const map: Record<string, string> = {
    conservative: '稳健型',
    growth: '成长型',
    aggressive: '激进型',
  };
  return map[type || ''] || '';
}

function formatValuation(val?: string): string {
  const map: Record<string, string> = {
    undervalued: '低估',
    fair: '合理',
    overvalued: '高估',
  };
  return map[val || ''] || '';
}

function formatTimeHorizon(horizon?: string): string {
  const map: Record<string, string> = {
    short: '短期(3-6个月)',
    medium: '中期(6-12个月)',
    long: '长期(1年以上)',
  };
  return map[horizon || ''] || '中长期';
}

function getRecClass(action?: string): string {
  if (action === 'strong_buy' || action === 'buy') return 'rec-buy';
  if (action === 'hold') return 'rec-hold';
  return 'rec-sell';
}

function parseRisk(val?: string): string {
  if (!val) return '--';
  return val.replace(/^(负债风险|流动性风险|运营风险|综合风险评级)[：:]/g, '').trim();
}

// 智能推断函数 - 当数据缺失时提供合理默认值
function getSmartScore(report: Partial<AnalysisReport>): string {
  const risk = report.riskResult as any;
  if (risk?.summary?.overallRisk) {
    const riskLevel = parseRisk(risk.summary.overallRisk);
    if (riskLevel === '低' || riskLevel === '安全') return '80+';
    if (riskLevel === '中' || riskLevel === '适中') return '60-80';
    return '< 60';
  }
  return '--';
}

function getSmartRecommendation(report: Partial<AnalysisReport>): string {
  const risk = report.riskResult as any;
  const profitability = report.profitabilityResult as any;
  
  if (risk?.summary?.overallRisk) {
    const riskLevel = parseRisk(risk.summary.overallRisk);
    const sustainability = profitability?.summary?.sustainability;
    
    if (riskLevel === '低' || riskLevel === '安全') {
      return sustainability === '高' ? '买入' : '持有';
    }
    if (riskLevel === '中' || riskLevel === '适中') {
      return '持有';
    }
    return '谨慎';
  }
  return '--';
}

function getSmartInvestor(report: Partial<AnalysisReport>): string {
  const conclusion = report.finalConclusion;
  const risk = report.riskResult as any;
  
  if (conclusion?.companyQuality?.score) {
    if (conclusion.companyQuality.score >= 80) return '稳健型';
    if (conclusion.companyQuality.score >= 60) return '成长型';
    return '激进型';
  }
  
  if (risk?.summary?.overallRisk) {
    const riskLevel = parseRisk(risk.summary.overallRisk);
    if (riskLevel === '低' || riskLevel === '安全') return '稳健型';
    if (riskLevel === '中' || riskLevel === '适中') return '成长型';
    return '激进型';
  }
  return '--';
}

function getSmartValuation(report: Partial<AnalysisReport>): string {
  const profitability = report.profitabilityResult as any;
  const balanceSheet = report.balanceSheetResult as any;
  
  const sustainability = profitability?.summary?.sustainability;
  const financialHealth = balanceSheet?.summary?.financialHealth;
  
  if (sustainability === '高' && (financialHealth === '优秀' || financialHealth === '良好')) {
    return '合理';
  }
  if (sustainability === '低' || financialHealth === '较差') {
    return '高估';
  }
  return '--';
}

// 颜色样式函数
function getMoatColorClass(strength?: string): string {
  if (strength === '极强' || strength === '强') return 'positive';
  if (strength === '中等') return 'neutral';
  return 'negative';
}

function getGrowthColorClass(growth?: string): string {
  if (!growth) return '';
  if (growth.includes('+') || growth.includes('增长') || parseFloat(growth) > 0) return 'positive';
  if (growth.includes('-') || growth.includes('下降') || parseFloat(growth) < 0) return 'negative';
  return 'neutral';
}

function getQualityColorClass(quality?: string): string {
  if (quality === '高' || quality === '优秀' || quality === '真实') return 'positive';
  if (quality === '中' || quality === '良好') return 'neutral';
  return 'negative';
}

function getHealthColorClass(health?: string): string {
  if (health === '优秀' || health === '良好') return 'positive';
  if (health === '一般') return 'neutral';
  return 'negative';
}

function getTrendColorClass(trend?: string): string {
  if (trend === '改善' || trend === '上升') return 'positive';
  if (trend === '恶化' || trend === '下降') return 'negative';
  return 'neutral';
}

function getMatchColorClass(match?: string): string {
  if (match === '健康' || match === '匹配') return 'positive';
  if (match === '不匹配') return 'negative';
  return 'neutral';
}

function getRiskColorClass(level?: string): string {
  if (level === '低' || level === '安全') return 'positive';
  if (level === '中' || level === '适中') return 'neutral';
  return 'negative';
}

// 估值相关颜色函数
function getValuationColorClass(assessment?: string): string {
  if (assessment === '低估') return 'positive';
  if (assessment === '合理') return 'neutral';
  return 'negative';
}

function getSentimentColorClass(sentiment?: string): string {
  if (sentiment === '乐观') return 'positive';
  if (sentiment === '中性') return 'neutral';
  return 'negative';
}

function getActionColorClass(action?: string): string {
  if (action === '强烈买入' || action === '买入') return 'positive';
  if (action === '持有') return 'neutral';
  return 'negative';
}

// ========== 水印生成 ==========

/**
 * 生成对角线水印 HTML
 * 创建一个覆盖整个页面的水印层，水印文字沿对角线重复分布
 */
function generateWatermarkHtml(text: string): string {
  // 生成多个水印位置，覆盖整个页面
  const positions: string[] = [];
  const rows = 8;
  const cols = 4;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const top = 10 + row * 12; // 每行间隔 12%
      const left = -10 + col * 30; // 每列间隔 30%
      positions.push(
        `<span class="watermark-text" style="top: ${top}%; left: ${left}%;">${text}</span>`
      );
    }
  }
  
  return `
    <div class="watermark">
      ${positions.join('')}
    </div>
  `;
}

/**
 * 根据用户等级判断是否需要水印
 */
export function shouldAddWatermark(tier?: string): boolean {
  // Pro 和 Elite 用户不需要水印
  return tier !== 'pro' && tier !== 'elite';
}

/**
 * 获取水印文字
 */
export function getWatermarkText(tier?: string): string {
  if (tier === 'guest') {
    return 'Finspark 访客版 - 注册登录去除水印';
  }
  if (tier === 'free') {
    return 'Finspark 免费版 - 升级Pro去除水印';
  }
  return '';
}

// ========== 服务类 ==========

export class PDFService {
  /**
   * 生成报告 HTML
   */
  generateReport(report: Partial<AnalysisReport>, options: PDFReportOptions): string {
    return generatePrintableReport(report, options);
  }
  
  /**
   * 生成带权限控制的报告 HTML
   * 根据用户等级自动添加或移除水印
   */
  generateReportWithPermission(
    report: Partial<AnalysisReport>, 
    options: PDFReportOptions,
    userTier?: 'guest' | 'free' | 'pro' | 'elite'
  ): string {
    const needWatermark = shouldAddWatermark(userTier);
    const watermarkText = getWatermarkText(userTier);
    
    return generatePrintableReport(report, {
      ...options,
      addWatermark: needWatermark,
      watermarkText: watermarkText,
      userTier: userTier,
    });
  }
}

export function createPDFService(): PDFService {
  return new PDFService();
}
