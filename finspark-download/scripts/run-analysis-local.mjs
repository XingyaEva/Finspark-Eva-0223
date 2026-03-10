#!/usr/bin/env node
/**
 * 本地沙箱运行财报分析并导出到 Cloudflare D1
 * 
 * 解决 Cloudflare Workers 10ms CPU 时间限制问题
 * 在本地无时间限制环境中运行完整分析，然后将结果导出到远程 D1
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// 颜色输出
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
};

// 从 .dev.vars 读取环境变量
function loadDevVars() {
  try {
    const content = readFileSync('.dev.vars', 'utf-8');
    const vars = {};
    for (const line of content.split('\n')) {
      if (line.includes('=') && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        vars[key.trim()] = valueParts.join('=').trim();
      }
    }
    return vars;
  } catch {
    return {};
  }
}

// Tushare API 配置
const TUSHARE_PROXY_URL = 'https://tspro.matetrip.cn/dataapi';

// VectorEngine API 配置
const VECTORENGINE_URL = 'https://api.vectorengine.ai';

// 模型配置
const MODELS = {
  ANALYSIS: 'gpt-4.1',
};

async function fetchFromTushare(token, apiName, params) {
  const response = await fetch(TUSHARE_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_name: apiName,
      token: token,
      params: params,
      fields: '',
    }),
  });
  
  const data = await response.json();
  if (data.code !== 0) {
    console.log(colors.yellow(`[Tushare] ${apiName} 返回错误: ${data.msg}`));
    return [];
  }
  
  // 转换为对象数组
  const { fields, items } = data.data;
  return items.map(item => {
    const obj = {};
    fields.forEach((field, i) => {
      obj[field] = item[i];
    });
    return obj;
  });
}

async function callVectorEngine(apiKey, messages, temperature = 0.7) {
  const response = await fetch(`${VECTORENGINE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODELS.ANALYSIS,
      messages,
      temperature,
      max_tokens: 16384,
      stream: false,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VectorEngine API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// 提取 JSON 从响应中
function extractJSON(text) {
  // 尝试从 markdown 代码块提取
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    text = jsonMatch[1];
  }
  
  // 尝试解析
  try {
    return JSON.parse(text);
  } catch {
    // 尝试修复常见问题
    text = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return JSON.parse(text);
  }
}

// Agent 提示词
const AGENT_PROMPTS = {
  planning: `你是一位专业的财报分析规划师。请分析以下公司的财务数据，规划分析策略。

**输出格式**：严格JSON格式
{
  "company": { "name": "公司名称", "code": "股票代码", "industry": "行业" },
  "dataQuality": { "completeness": 0.9, "reliability": "high", "notes": ["数据完整性说明"] },
  "analysisStrategy": { "focus": ["重点分析领域"], "concerns": ["需关注问题"], "methodology": "分析方法论" }
}`,

  profitability: `你是一位专业的盈利能力分析师。请深度分析公司的盈利能力。

**输出格式**：严格JSON格式
{
  "metrics": {
    "grossMargin": { "current": 0, "trend": "stable/improving/declining", "industryComparison": "above/below/average" },
    "netMargin": { "current": 0, "trend": "stable/improving/declining" },
    "roe": { "current": 0, "trend": "stable/improving/declining" },
    "roa": { "current": 0, "trend": "stable/improving/declining" }
  },
  "revenueGrowth": { "rate": 0, "drivers": ["增长驱动因素"] },
  "profitGrowth": { "rate": 0, "sustainability": "可持续性评估" },
  "conclusion": "盈利能力总结",
  "rating": "excellent/good/average/poor"
}`,

  balanceSheet: `你是一位专业的资产负债分析师。请深度分析公司的资产负债状况。

**输出格式**：严格JSON格式
{
  "assetStructure": {
    "totalAssets": 0,
    "currentRatio": 0,
    "quickRatio": 0,
    "assetTurnover": 0
  },
  "liabilityStructure": {
    "debtRatio": 0,
    "shortTermDebt": 0,
    "longTermDebt": 0,
    "debtToEquity": 0
  },
  "workingCapital": { "value": 0, "trend": "stable/improving/declining" },
  "conclusion": "资产负债总结",
  "rating": "excellent/good/average/poor"
}`,

  cashFlow: `你是一位专业的现金流分析师。请深度分析公司的现金流状况。

**输出格式**：严格JSON格式
{
  "operatingCashFlow": {
    "value": 0,
    "trend": "stable/improving/declining",
    "quality": "现金流质量评估"
  },
  "investingCashFlow": {
    "value": 0,
    "capexRatio": 0,
    "purpose": "投资用途说明"
  },
  "financingCashFlow": {
    "value": 0,
    "dividendPayout": 0,
    "debtChanges": "债务变化说明"
  },
  "freeCashFlow": { "value": 0, "trend": "stable/improving/declining" },
  "conclusion": "现金流总结",
  "rating": "excellent/good/average/poor"
}`,

  earningsQuality: `你是一位专业的盈利质量分析师。请评估公司的盈利质量。

**输出格式**：严格JSON格式
{
  "accrualRatio": { "value": 0, "assessment": "应计比例评估" },
  "cashConversion": { "ratio": 0, "quality": "high/medium/low" },
  "revenueRecognition": { "risk": "low/medium/high", "notes": "收入确认风险说明" },
  "operatingLeverage": { "value": 0, "impact": "经营杠杆影响" },
  "sustainabilityScore": 0,
  "conclusion": "盈利质量总结",
  "rating": "excellent/good/average/poor"
}`,

  risk: `你是一位专业的风险评估师。请评估公司面临的主要风险。

**输出格式**：严格JSON格式
{
  "financialRisk": {
    "liquidityRisk": { "level": "low/medium/high", "factors": ["流动性风险因素"] },
    "debtRisk": { "level": "low/medium/high", "factors": ["债务风险因素"] },
    "marketRisk": { "level": "low/medium/high", "factors": ["市场风险因素"] }
  },
  "operationalRisk": {
    "supplyChain": { "level": "low/medium/high", "factors": ["供应链风险"] },
    "competition": { "level": "low/medium/high", "factors": ["竞争风险"] }
  },
  "overallRisk": "low/medium/high",
  "mitigationFactors": ["风险缓释因素"],
  "conclusion": "风险评估总结",
  "rating": "excellent/good/average/poor"
}`,

  businessInsight: `你是一位专业的商业洞察分析师。请分析公司的业务特点和竞争优势。

**输出格式**：严格JSON格式
{
  "businessModel": { "type": "商业模式类型", "characteristics": ["业务特点"] },
  "competitiveAdvantages": ["竞争优势列表"],
  "industryPosition": { "marketShare": "市场份额", "ranking": "行业排名" },
  "growthDrivers": ["增长驱动因素"],
  "challenges": ["面临挑战"],
  "conclusion": "商业洞察总结"
}`,

  valuation: `你是一位专业的估值分析师。请评估公司的估值水平。

**输出格式**：严格JSON格式
{
  "relativeValuation": {
    "peRatio": { "current": 0, "industryAvg": 0, "assessment": "估值评估" },
    "pbRatio": { "current": 0, "industryAvg": 0, "assessment": "估值评估" },
    "psRatio": { "current": 0, "assessment": "估值评估" }
  },
  "intrinsicValue": { "method": "估值方法", "estimate": "估值结果", "confidence": "high/medium/low" },
  "valuationConclusion": "undervalued/fairly_valued/overvalued",
  "targetPriceRange": { "low": 0, "high": 0 },
  "conclusion": "估值总结",
  "rating": "excellent/good/average/poor"
}`,

  conclusion: `你是一位资深的投资研究总监。请整合所有分析结果，给出最终投资建议。

**输出格式**：严格JSON格式
{
  "investmentRating": "strong_buy/buy/hold/sell/strong_sell",
  "summary": "投资评级理由概述（100字以内）",
  "keyStrengths": ["核心优势1", "核心优势2", "核心优势3"],
  "keyRisks": ["主要风险1", "主要风险2"],
  "catalysts": ["潜在催化剂"],
  "investmentThesis": "投资逻辑详述（200字以内）",
  "confidenceLevel": "high/medium/low"
}`
};

async function runAnalysis(companyCode, companyName, envVars) {
  const startTime = Date.now();
  const tushareToken = envVars.TUSHARE_TOKEN;
  const vectorEngineKey = envVars.VECTORENGINE_API_KEY;
  
  console.log(colors.bold(`\n🚀 开始分析: ${companyName} (${companyCode})\n`));
  
  // 1. 获取财务数据
  console.log(colors.cyan('[1/10] 获取财务数据...'));
  
  const [income, balance, cashFlow, dailyBasic, finaIndicator] = await Promise.all([
    fetchFromTushare(tushareToken, 'income', { ts_code: companyCode, period: '', limit: 12 }),
    fetchFromTushare(tushareToken, 'balancesheet', { ts_code: companyCode, period: '', limit: 12 }),
    fetchFromTushare(tushareToken, 'cashflow', { ts_code: companyCode, period: '', limit: 12 }),
    fetchFromTushare(tushareToken, 'daily_basic', { ts_code: companyCode, limit: 5 }),
    fetchFromTushare(tushareToken, 'fina_indicator', { ts_code: companyCode, limit: 12 }),
  ]);
  
  console.log(colors.green(`  ✓ 利润表: ${income.length} 条`));
  console.log(colors.green(`  ✓ 资产负债表: ${balance.length} 条`));
  console.log(colors.green(`  ✓ 现金流量表: ${cashFlow.length} 条`));
  console.log(colors.green(`  ✓ 每日基本面: ${dailyBasic.length} 条`));
  console.log(colors.green(`  ✓ 财务指标: ${finaIndicator.length} 条`));
  
  const financialDataStr = JSON.stringify({
    income: income.slice(0, 4),
    balance: balance.slice(0, 4),
    cashFlow: cashFlow.slice(0, 4),
    dailyBasic: dailyBasic.slice(0, 2),
    finaIndicator: finaIndicator.slice(0, 4),
  }, null, 2);
  
  // 2. 运行各个 Agent
  const results = {};
  
  // Planning Agent
  console.log(colors.cyan('[2/10] 运行规划 Agent...'));
  const planningResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.planning },
    { role: 'user', content: `请分析以下公司的财务数据：\n\n公司：${companyName} (${companyCode})\n\n${financialDataStr}` }
  ]);
  results.planning = extractJSON(planningResp);
  console.log(colors.green('  ✓ 规划完成'));
  
  // Profitability Agent
  console.log(colors.cyan('[3/10] 运行盈利能力分析 Agent...'));
  const profitResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.profitability },
    { role: 'user', content: `请分析以下公司的盈利能力：\n\n公司：${companyName}\n\n${financialDataStr}` }
  ]);
  results.profitability = extractJSON(profitResp);
  console.log(colors.green('  ✓ 盈利能力分析完成'));
  
  // Balance Sheet Agent
  console.log(colors.cyan('[4/10] 运行资产负债分析 Agent...'));
  const balanceResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.balanceSheet },
    { role: 'user', content: `请分析以下公司的资产负债状况：\n\n公司：${companyName}\n\n${financialDataStr}` }
  ]);
  results.balanceSheet = extractJSON(balanceResp);
  console.log(colors.green('  ✓ 资产负债分析完成'));
  
  // Cash Flow Agent
  console.log(colors.cyan('[5/10] 运行现金流分析 Agent...'));
  const cashResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.cashFlow },
    { role: 'user', content: `请分析以下公司的现金流状况：\n\n公司：${companyName}\n\n${financialDataStr}` }
  ]);
  results.cashFlow = extractJSON(cashResp);
  console.log(colors.green('  ✓ 现金流分析完成'));
  
  // Earnings Quality Agent
  console.log(colors.cyan('[6/10] 运行盈利质量分析 Agent...'));
  const eqResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.earningsQuality },
    { role: 'user', content: `请评估以下公司的盈利质量：\n\n公司：${companyName}\n\n财务数据：${financialDataStr}\n\n已完成的盈利分析：${JSON.stringify(results.profitability)}\n现金流分析：${JSON.stringify(results.cashFlow)}` }
  ]);
  results.earningsQuality = extractJSON(eqResp);
  console.log(colors.green('  ✓ 盈利质量分析完成'));
  
  // Risk Agent
  console.log(colors.cyan('[7/10] 运行风险评估 Agent...'));
  const riskResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.risk },
    { role: 'user', content: `请评估以下公司的风险：\n\n公司：${companyName}\n\n财务数据：${financialDataStr}\n\n已完成分析：\n- 资产负债：${JSON.stringify(results.balanceSheet)}\n- 现金流：${JSON.stringify(results.cashFlow)}\n- 盈利质量：${JSON.stringify(results.earningsQuality)}` }
  ]);
  results.risk = extractJSON(riskResp);
  console.log(colors.green('  ✓ 风险评估完成'));
  
  // Business Insight Agent
  console.log(colors.cyan('[8/10] 运行商业洞察 Agent...'));
  const biResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.businessInsight },
    { role: 'user', content: `请分析以下公司的商业模式和竞争优势：\n\n公司：${companyName} (${companyCode})\n\n财务数据：${financialDataStr}\n\n盈利分析：${JSON.stringify(results.profitability)}` }
  ]);
  results.businessInsight = extractJSON(biResp);
  console.log(colors.green('  ✓ 商业洞察完成'));
  
  // Valuation Agent
  console.log(colors.cyan('[9/10] 运行估值分析 Agent...'));
  const valResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.valuation },
    { role: 'user', content: `请评估以下公司的估值：\n\n公司：${companyName}\n\n财务数据：${financialDataStr}\n\n每日基本面（PE/PB等）：${JSON.stringify(dailyBasic)}\n\n盈利分析：${JSON.stringify(results.profitability)}` }
  ]);
  results.valuation = extractJSON(valResp);
  console.log(colors.green('  ✓ 估值分析完成'));
  
  // Final Conclusion Agent
  console.log(colors.cyan('[10/10] 生成最终结论...'));
  const concResp = await callVectorEngine(vectorEngineKey, [
    { role: 'system', content: AGENT_PROMPTS.conclusion },
    { role: 'user', content: `请整合以下分析结果，给出最终投资建议：\n\n公司：${companyName} (${companyCode})\n\n各项分析结果：\n${JSON.stringify(results, null, 2)}` }
  ]);
  results.conclusion = extractJSON(concResp);
  console.log(colors.green('  ✓ 最终结论生成完成'));
  
  const executionTime = Date.now() - startTime;
  console.log(colors.bold(`\n✅ 分析完成! 耗时: ${(executionTime / 1000).toFixed(1)} 秒\n`));
  
  // 构建完整报告
  const report = {
    companyCode,
    companyName,
    reportType: 'annual',
    status: 'completed',
    analysisResult: JSON.stringify({
      planningResult: results.planning,
      profitabilityResult: results.profitability,
      balanceSheetResult: results.balanceSheet,
      cashFlowResult: results.cashFlow,
      earningsQualityResult: results.earningsQuality,
      riskResult: results.risk,
      businessInsightResult: results.businessInsight,
      valuationResult: results.valuation,
      finalConclusion: results.conclusion,
      dataSource: {
        provider: 'Tushare Pro',
        latestPeriod: income[0]?.end_date || '',
        apiUrl: 'https://tushare.pro',
      },
      executionTime,
    }),
    executionTime,
    createdAt: new Date().toISOString(),
  };
  
  return report;
}

async function exportToD1(report) {
  console.log(colors.cyan('\n📤 导出到 Cloudflare D1...\n'));
  
  // 准备 SQL - 注意列名是 result_json 而非 analysis_result
  const analysisResultEscaped = report.analysisResult.replace(/'/g, "''");
  
  const sql = `
    INSERT INTO analysis_reports (company_code, company_name, report_type, status, result_json, created_at)
    VALUES (
      '${report.companyCode}',
      '${report.companyName}',
      '${report.reportType}',
      '${report.status}',
      '${analysisResultEscaped}',
      '${report.createdAt}'
    )
    ON CONFLICT(company_code, report_type) DO UPDATE SET
      status = '${report.status}',
      result_json = '${analysisResultEscaped}',
      updated_at = '${report.createdAt}';
  `;
  
  // 写入临时文件
  const fs = await import('fs');
  fs.writeFileSync('/tmp/analysis_insert.sql', sql);
  
  // 执行 D1 命令
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  if (!cfToken || !cfAccount) {
    console.log(colors.yellow('⚠️ 未配置 Cloudflare 凭据，跳过 D1 导出'));
    console.log(colors.yellow('  设置环境变量: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID'));
    return false;
  }
  
  try {
    execSync(
      `CLOUDFLARE_API_TOKEN="${cfToken}" CLOUDFLARE_ACCOUNT_ID="${cfAccount}" npx wrangler d1 execute genspark-financial-db --remote --file=/tmp/analysis_insert.sql`,
      { stdio: 'inherit' }
    );
    console.log(colors.green('✅ 成功导出到 Cloudflare D1'));
    
    // 同时缓存到 KV
    const kvKey = `shared:analysis:${report.companyCode}:${report.reportType}`;
    execSync(
      `CLOUDFLARE_API_TOKEN="${cfToken}" CLOUDFLARE_ACCOUNT_ID="${cfAccount}" npx wrangler kv key put --namespace-id=285fe51274154c798eaccafd90489666 "${kvKey}" '${report.analysisResult}' --ttl=86400`,
      { stdio: 'inherit' }
    );
    console.log(colors.green('✅ 成功缓存到 Cloudflare KV'));
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ D1 导出失败: ${error.message}`));
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const companyCode = args[0] || '600519.SH';
  const companyName = args[1] || '贵州茅台';
  
  console.log(colors.bold('\n' + '='.repeat(60)));
  console.log(colors.bold('    Finspark 投资分析 - 本地沙箱运行'));
  console.log(colors.bold('='.repeat(60)));
  
  // 加载环境变量
  const envVars = loadDevVars();
  
  if (!envVars.VECTORENGINE_API_KEY || !envVars.TUSHARE_TOKEN) {
    console.log(colors.red('❌ 缺少必要的环境变量，请检查 .dev.vars 文件'));
    process.exit(1);
  }
  
  try {
    // 运行分析
    const report = await runAnalysis(companyCode, companyName, envVars);
    
    // 输出分析结果摘要
    const analysis = JSON.parse(report.analysisResult);
    console.log(colors.bold('\n📊 分析结果摘要:'));
    console.log(colors.cyan(`  投资评级: ${analysis.finalConclusion?.investmentRating || 'N/A'}`));
    console.log(colors.cyan(`  信心水平: ${analysis.finalConclusion?.confidenceLevel || 'N/A'}`));
    console.log(colors.cyan(`  核心观点: ${analysis.finalConclusion?.summary || 'N/A'}`));
    
    // 导出到 D1
    await exportToD1(report);
    
    // 保存本地备份
    const fs = await import('fs');
    const outputFile = `/home/user/webapp/analysis_${companyCode.replace('.', '_')}_${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(colors.green(`\n📁 本地备份: ${outputFile}`));
    
  } catch (error) {
    console.log(colors.red(`\n❌ 分析失败: ${error.message}`));
    console.error(error);
    process.exit(1);
  }
}

main();
