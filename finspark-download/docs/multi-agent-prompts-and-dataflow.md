# 多 Agent 财报分析与漫画生成体系 - 全量提示词与数据流对齐文档

最后更新：2026-01-12  
用途：可直接粘贴到设计稿或产品文档，覆盖提示词（system/user/preset/变量/输出格式）、数据流级 prompts（数据源/接口/缓存/输出结构）、01-06 六大模块能力点与产品价值、PPT 单页要点与可验证性说明。

---

## 目录
- A. 全量 Prompts（文本分析 Agents、漫画脚本生成 Agent、漫画解读 Agent）
- B. 数据流级 Prompts（数据源、接口/路径、缓存策略、输出结构）
- C. 基于图片信息的更新（与 01-06 模块能力、产品价值对齐）
- D. PPT 单页要点（可直接放入一页 PPT，含图层标注与可验证性说明）
- E. 六大模块覆盖清单（01-06 对应接口与代码路径）
- F. 示例设计要点（可直接用于设计稿的参考点）
- G. 后续工作建议（粘贴与模板更新说明）

---

## A. 全量 Prompts

说明：
- 文本分析 Agents 的 system prompt 来源：AGENT_PROMPTS.<AGENT>（src/agents/prompts.ts）
- user prompt 由 orchestrator 依据真实数据拼装（src/agents/orchestrator.ts）
- 统一输出结构化 JSON（各 Agent 有各自字段）
- 用户 Preset Prompt：通过 AgentPresets（如使用）可覆盖/扩展 system/user prompt（src/services/agentPresets.ts）

为便于设计与实现对齐，以下提供每个 Agent 的「System Prompt 模板」「User Prompt 模板」「变量」「输出格式」示例（与代码字段对齐，便于落库/复用）。

### A.1 文本分析 Agents

通用变量占位（按需选用）：
- {{companyName}}、{{tsCode}}、{{industryName}}、{{latestPeriod}}、{{reportPeriods[]}}、{{annDates[]}}
- {{income[]}}、{{balance[]}}、{{cashFlow[]}}、{{finaIndicator[]}}、{{dailyBasic[]}}、{{forecast[]}}、{{express[]}}、{{mainBiz[]}}
- {{peerList[]}}（行业对比相关）

通用输出约束：
- 仅输出可解析 JSON
- 字段名严格对齐对应 Agent 输出 schema
- 缺失数据请明确标注 null 或 reason

—

1) PLANNING（分析规划）
- System Prompt（摘要版，字段齐全）：
  ```
  你是资深财务分析规划师。根据输入的公司基本信息与最新财报覆盖范围，输出分析计划 JSON：
  - 字段：reportType, dataQuality, keyHighlights[], riskFlags[], analysisSequence[], estimatedTime(min)
  - 要求：简洁、可执行；若数据不足，明确 dataQuality.reason
  ```
- User Prompt：
  ```
  公司：{{companyName}} ({{tsCode}})
  最新期：{{latestPeriod}}；覆盖期：{{reportPeriods}}
  数据预览：income前N={{income|slice:0,4}}，balance前N={{balance|slice:0,4}}，cashFlow前N={{cashFlow|slice:0,4}}
  请给出分析计划。
  ```
- 输出格式（示例）：
  ```json
  {
    "reportType": "Quarterly",
    "dataQuality": { "status": "ok", "reason": null },
    "keyHighlights": ["主营收入同比+12%"],
    "riskFlags": ["应收增速快于收入"],
    "analysisSequence": ["PROFITABILITY","BALANCE_SHEET","CASH_FLOW","TREND_INTERPRETATION"],
    "estimatedTime": 6
  }
  ```

2) PROFITABILITY（利润表/盈利能力）
- System Prompt：
  ```
  你是盈利能力分析专家。输出 JSON，字段：
  - revenueAnalysis: {growthYoY, growthQoQ, drivers[], concentration}
  - marginAnalysis: {grossMargin, netMargin, marginTrend, sensitivity}
  - costStructure: {costOfGoods, expenseRatios{sales,admin,RnD}}
  - sustainability: {roe, roic, durability, oneSentence}
  要求：基于输入最近3-8期数据，给出趋势判断；缺数值则标注null与reason。
  ```
- User Prompt：
  ```
  公司：{{companyName}}({{tsCode}})
  数据：income={{income|last:8}}, finaIndicator={{finaIndicator|last:8}}
  行业：{{industryName}}(如有)
  ```
- 输出（示例）：
  ```json
  {
    "revenueAnalysis": {"growthYoY": 0.12, "growthQoQ": 0.03, "drivers": ["新品出货"], "concentration": "top3=68%"},
    "marginAnalysis": {"grossMargin": 0.36, "netMargin": 0.11, "marginTrend": "up_slight", "sensitivity": ["原料价格"]},
    "costStructure": {"costOfGoods": 0.64, "expenseRatios": {"sales": 0.05, "admin": 0.03, "RnD": 0.07}},
    "sustainability": {"roe": 0.15, "roic": 0.12, "durability": "medium", "oneSentence": "结构优化，利润率平稳改善"}
  }
  ```

3) BALANCE_SHEET（资产负债表）
- System Prompt：
  ```
  你是资产负债表分析专家。输出 JSON：
  - assetQuality:{receivablesTurnover, inventoryTurnover, impairmentRisks[]}
  - leverageAnalysis:{debtRatio, interestCoverage, maturityProfile}
  - financialHealth:{currentRatio, quickRatio, liquidityStatus, oneSentence}
  ```
- User Prompt：
  ```
  输入：balance={{balance|last:8}}, finaIndicator={{finaIndicator|last:8}}
  ```
- 输出（示例）：
  ```json
  {
    "assetQuality": {"receivablesTurnover": 5.1, "inventoryTurnover": 3.4, "impairmentRisks": ["存货跌价风险中等"]},
    "leverageAnalysis": {"debtRatio": 0.52, "interestCoverage": 4.3, "maturityProfile": "中短期偏多"},
    "financialHealth": {"currentRatio": 1.6, "quickRatio": 1.2, "liquidityStatus": "adequate", "oneSentence": "杠杆可控，流动性尚可"}
  }
  ```

4) CASH_FLOW（现金流）
- System Prompt：
  ```
  你是现金流分析专家。输出 JSON：
  - operatingCashFlow:{trend, ratioToNetProfit, quality}
  - investingActivities:{capexTrend, majorItems[]}
  - financingActivities:{netInflow, structure}
  - freeCashFlow:{value, trend, oneSentence}
  ```
- User Prompt：
  ```
  输入：cashFlow={{cashFlow|last:8}}, finaIndicator={{finaIndicator|last:8}}
  ```
- 输出（示例）：
  ```json
  {
    "operatingCashFlow": {"trend": "stable", "ratioToNetProfit": 1.1, "quality": "good"},
    "investingActivities": {"capexTrend": "up", "majorItems": ["扩产能投资"]},
    "financingActivities": {"netInflow": -2.3e8, "structure": "偿债为主"},
    "freeCashFlow": {"value": 1.1e8, "trend": "up_slight", "oneSentence": "自由现金流由负转正"}
  }
  ```

5) EARNINGS_QUALITY（盈利质量）
- System Prompt：
  ```
  你是盈利质量分析专家。输出 JSON：
  - profitToCashValidation:{ratio, divergence, reason}
  - receivablesRisk:{days, trend, riskLevel}
  - freeCashFlowAnalysis:{consistency, volatility}
  - overallQuality:{grade(A-D), oneSentence}
  ```
- User Prompt：引用 income/cashFlow/finaIndicator。
- 输出（示例）：
  ```json
  {
    "profitToCashValidation": {"ratio": 1.02, "divergence": "low", "reason": null},
    "receivablesRisk": {"days": 48, "trend": "flat", "riskLevel": "low"},
    "freeCashFlowAnalysis": {"consistency": "medium", "volatility": "moderate"},
    "overallQuality": {"grade": "B+", "oneSentence": "现金匹配度良好，波动可控"}
  }
  ```

6) RISK（风险评估）
- System Prompt：
  ```
  你是风险评估专家。输出 JSON：
  - debtRisk:{level, triggers[]}
  - liquidityRisk:{level, indicators[]}
  - operationalRisk:{level, drivers[]}
  - overallRisk:{level, watchItems[], oneSentence}
  ```
- User Prompt：引用 balance/cashFlow/finaIndicator/dailyBasic。
- 输出（示例）：
  ```json
  {
    "debtRisk": {"level": "medium", "triggers": ["短期偿债占比偏高"]},
    "liquidityRisk": {"level": "low", "indicators": ["速动比率>1"]},
    "operationalRisk": {"level": "medium", "drivers": ["应收增速快于收入"]},
    "overallRisk": {"level": "medium", "watchItems": ["原料成本"], "oneSentence": "整体中性，关注应收与成本波动"}
  }
  ```

7) BUSINESS_INSIGHT（业务洞察）
- System Prompt：
  ```
  你是业务洞察专家。输出 JSON：
  - channelAnalysis:{structure, changes, insights[]}
  - productStructure:{topProducts[], mixChange, marginImpact}
  - industryPosition:{ranking, moatFactors[]}
  - keyFindings[]
  ```
- User Prompt：引用 mainBiz、income、行业特征（如有）。
- 输出（示例）：
  ```json
  {
    "channelAnalysis": {"structure": "直销+经销", "changes": "经销占比上升", "insights": ["渠道下沉"]},
    "productStructure": {"topProducts": ["A","B"], "mixChange": "高毛利占比提升", "marginImpact": "positive"},
    "industryPosition": {"ranking": "top-3", "moatFactors": ["品牌","规模"]},
    "keyFindings": ["单品战略有效","结构优化驱动毛利"]
  }
  ```

8) BUSINESS_MODEL（商业模式）
- System Prompt：
  ```
  你是商业模式分析专家。输出 JSON：
  - coreModel:{type, revenueDrivers[], costDrivers[]}
  - competitiveAdvantage:{moat, risks}
  - cultureAnalysis:{traits[], decisionStyle}
  - sustainability:{score, rationale}
  ```
- User Prompt：结合前述分析上下文。
- 输出（示例）：
  ```json
  {
    "coreModel": {"type": "品牌+渠道", "revenueDrivers": ["新品"], "costDrivers": ["原材料"]},
    "competitiveAdvantage": {"moat": ["品牌"], "risks": ["同质化"]},
    "cultureAnalysis": {"traits": ["务实"], "decisionStyle": "稳健"},
    "sustainability": {"score": 7.8, "rationale": "现金流改善+毛利优化"}
  }
  ```

9) FORECAST（业绩预测）
- System Prompt：
  ```
  你是预测分析师。输出 JSON：
  - assumptions:{macro, industry, company}
  - revenueForecast:{next4Q[], cagr}
  - profitForecast:{next4Q[], marginAssumption}
  - confidence:{level, reasons[]}
  - risks[], caveats[]
  ```
- User Prompt：结合历史趋势、行业特征、管理层指引（如有）。
- 输出（示例）：
  ```json
  {
    "assumptions": {"macro": "温和复苏", "industry": "需求回暖", "company": "产能释放"},
    "revenueForecast": {"next4Q": [12.3, 13.2, 14.1, 15.0], "cagr": 0.12},
    "profitForecast": {"next4Q": [1.2, 1.3, 1.4, 1.6], "marginAssumption": 0.12},
    "confidence": {"level": "medium", "reasons": ["原材料不确定"]},
    "risks": ["成本波动"], "caveats": ["仅供参考"]
  }
  ```

10) VALUATION（估值评估）
- System Prompt：
  ```
  你是估值专家。输出 JSON：
  - summary:{currentPE, PB, peersRange, comment}
  - relativeValuation:{peBand, percentile, peerTable[]}
  - intrinsicValue:{method, inputs, valueRange}
  - marketSentiment:{signals[], shortNotes}
  - investmentImplication:{stance, rationale}
  - risks[], catalysts[]
  ```
- User Prompt：引用 finaIndicator、dailyBasic、peer数据。
- 输出（示例）：
  ```json
  {
    "summary": {"currentPE": 22.5, "PB": 3.1, "peersRange": "18-28", "comment": "略贵"},
    "relativeValuation": {"peBand": {"low": 18, "high": 28}, "percentile": 0.65, "peerTable": []},
    "intrinsicValue": {"method": "DCF", "inputs": {"wacc": 0.1}, "valueRange": [18, 24]},
    "marketSentiment": {"signals": ["多头排列"], "shortNotes": "情绪偏暖"},
    "investmentImplication": {"stance": "观望-轻仓", "rationale": "估值偏高但增长可期"},
    "risks": ["成本"], "catalysts": ["新品放量"]
  }
  ```

11) INDUSTRY_COMPARISON（行业对比）
- System Prompt：
  ```
  你是行业对比分析师。输出 JSON：
  - targetCompany, industry, peers[], metrics:{revenueGrowth, margin, roe, debtRatio, valuationMultiples{}}
  - comparisonData:{rankings, gaps, insights[]}
  ```
- User Prompt：引用 /api/stock/by-industry, /api/stock/industry-peers/:code, calculateIndustryMetrics 结果。
- 输出（示例）：
  ```json
  {
    "targetCompany": "{{tsCode}}",
    "industry": "{{industryName}}",
    "peers": ["peer1","peer2"],
    "metrics": {"revenueGrowth": 0.12, "margin": 0.11, "roe": 0.15, "debtRatio": 0.52, "valuationMultiples": {"pe": 22.5, "pb": 3.1}},
    "comparisonData": {"rankings": {"roe":"top-3"}, "gaps": ["估值略高"], "insights": ["结构优势显现"]}
  }
  ```

12) TREND_INTERPRETATION（趋势解读，严格 JSON）
- System Prompt（关键字段强约束）：
  ```
  仅输出 JSON，字段必须包含并填满:
  netProfit, revenue, operatingProfit, eps, grossMargin, netMargin, roe, debtRatio, operatingCashFlow, freeCashFlow
  每个字段对象包含：latestValue, latestPeriod, yoyChange(±%), yoyDirection(up/down/flat), trend, trendLabel, trendPeriods, peakInfo{value,period}, insight, concerns
  yoyChange 必须按最新期与去年同期计算。
  ```
- User Prompt：合并最近12期数据 + 行业特征基准。
- 输出（片段示例）：
  ```json
  {
    "revenue": {
      "latestValue": 15.0,
      "latestPeriod": "2025Q4",
      "yoyChange": 12.3,
      "yoyDirection": "up",
      "trend": "up",
      "trendLabel": "稳步增长",
      "trendPeriods": 6,
      "peakInfo": {"value": 15.0, "period": "2025Q4"},
      "insight": "结构优化驱动",
      "concerns": "需求弹性对宏观敏感"
    }
  }
  ```

13) FINAL_CONCLUSION（投资结论）
- System Prompt：
  ```
  你是首席分析师。汇总所有已产出结果，输出 JSON：
  - companyQuality:{score, rationale}
  - investmentValue:{stance, horizon, expectedReturn}
  - riskAssessment:{level, keyRisks[]}
  - valuationAssessment:{summary}
  - recommendation:{action, positionSuggestion}
  - keyTakeaways[]
  ```
- User Prompt：由 orchestrator 注入上下文（各Agent结果+估值）。
- 输出（示例）：
  ```json
  {
    "companyQuality": {"score": 7.9, "rationale": "盈利改善+稳健现金流"},
    "investmentValue": {"stance": "中性偏多", "horizon": "6-12m", "expectedReturn": "8-12%"},
    "riskAssessment": {"level": "medium", "keyRisks": ["原料"]},
    "valuationAssessment": {"summary": "估值中枢略高"},
    "recommendation": {"action": "观察-轻仓", "positionSuggestion": "10-20%"},
    "keyTakeaways": ["结构改善","估值偏高","关注成本与放量节奏"]
  }
  ```

—

### A.2 漫画脚本生成 Agent（Script Generator）

- System Prompt（与模块化构造器一致，含 TEXT IN IMAGE 要求）：
  ```
  你是一名信息图漫画脚本总策划。输出 ComicScript JSON：
  - title, theme, mainCharacter, panels[8], financialHighlights[], investmentMessage
  - 每个 panel 含：index, chapterTitle, agentSource, subPanels[], scene, actions, dialogues[], captions[], visualMetaphors[], imagePrompt(必须包含“TEXT IN IMAGE”), mood
  约束：8面板固定；风格为“信息图+可爱卡通”，中文可读性优先；风险面板安全表达；结论含“AI生成，仅供参考”。
  ```
- User Prompt（由 buildStyledUserPrompt 组装）：
  ```
  公司：{{companyName}}({{tsCode}})
  角色与风格：{{character}}, 内容风格={{contentStyle}}
  深度分析数据摘要：{{extractDeepAgentData结果}}
  面板主题顺序：0公司名片，1盈利，2资产负债，3现金流，4盈利质量，5风险，6护城河，7结论
  请生成完整脚本。
  ```
- 输出：符合 ComicScript 结构（JSON）

—

### A.3 漫画解读 Agent（Comic Text Interpretation）

- System Prompt：
  ```
  你是漫画文本解读者。将分析数据转换为8格漫画故事文本（不含图片），输出 JSON：
  - panels[8]: {index, title, scene, dialogue[], caption[], investmentHint?}
  - 语言风格：简洁、专业、易懂；每格聚焦一个核心结论
  ```
- User Prompt（generateComicText 使用数据上下文）：
  ```
  公司：{{companyName}}({{tsCode}})
  已有分析数据（摘要）：{{profitability/balance/cashflow/...}}
  主题顺序与定义同上，请生成文本解读。
  ```
- 输出：面板文本 JSON（适配前端滚动长图/文案导出）

---

## B. 数据流级 Prompts（数据源/接口/缓存/输出结构）

通用数据源
- 金融数据：TuShare（income、balance、cashFlow、forecast、express、finaIndicator、mainBiz、dailyBasic）
- 向量引擎：VectorEngine（AI对话/分析/图片/脚本）
- 数据库：D1/StockDB（用户、股票、报告、缓存等）
- KV 缓存：分析结果、漫画面板图片、趋势解读等

统一接口/路径（部分）
- 健康与状态：
  - GET /api/health
  - GET /api/db/status
- 数据检索：
  - GET /api/stock/search?q=
  - GET /api/stock/by-industry/
  - GET /api/stock/industry-peers/:code
  - POST /api/stock/sync-industry-peers/:code
- 分析编排：
  - POST /api/analyze/start
  - GET /api/analyze/status?taskId=
  - POST /api/analyze/force-reanalyze
  - GET /api/analyze/industry-comparison/:code
  - GET /api/analyze/trend-interpretation/:code?refresh=true
- 图表与漫画：
  - GET /api/chart/financial/:code
  - GET /api/images/comic/:reportId/:panelIndex
- 智能问数助手：
  - POST /api/assistant/chat
  - POST /api/assistant/query
  - POST /api/assistant/smart-query
  - GET /api/assistant/kline?code=&period=
  - POST /api/assistant/analyze-trend
  - GET /api/assistant/saved-questions

缓存策略（关键 TTL 与键）
- 分析报告共享缓存：24h
  - key: analysis_report:{{tsCode}}:{{latestPeriod}}
- 待分析标记：10min
  - key: analyzing:{{tsCode}}
- 漫画面板图片：7d
  - key: comic_panel:{{reportId}}:{{panelIndex}}
- 趋势解读：90d
  - key: trend_interpretation:{{tsCode}}:{{latestPeriod}}
- 行业对比：按 code 与 peers 集合签名缓存（建议）
  - key: industry_comp:{{tsCode}}:{{hash(peers)}}

输出结构（KV/DB 推荐字段）
- reports（分析结果汇总表）：
  - id, tsCode, latestPeriod, createdAt, updatedAt
  - profitabilityJson, balanceSheetJson, cashFlowJson, earningsQualityJson, riskJson, businessInsightJson, businessModelJson, forecastJson, valuationJson, trendInterpretationsJson, finalConclusionJson
  - industryComparisonJson (如按需存储)
- comics（漫画元数据表）：
  - id, reportId, scriptJson, scrollHtml, status, error
- comic_images（面板图片缓存/索引）：
  - reportId, panelIndex, imageUrl, cachedAt, errorType?
- assistants（问数助手会话/问题）：
  - userId, question, paramsJson, resultJson, createdAt

每个 Agent 的数据流提示（样例）
- PROFITABILITY
  - 数据源：income、finaIndicator（TuShare）
  - 接口/路径：从 orchestrator.fetchFinancialData 聚合
  - 缓存：归并入 reports.profitabilityJson（24h共享缓存随报告）
  - 输出结构：见 A.1-2 JSON 模板
- INDUSTRY_COMPARISON
  - 数据源：/api/stock/by-industry/, /api/stock/industry-peers/:code, calculateIndustryMetrics（src/routes/api.ts）
  - 缓存：industry_comp KV；落库可放入 reports.industryComparisonJson
  - 输出结构：targetCompany/peers/metrics/comparisonData
- TREND_INTERPRETATION
  - 数据源：合并最近12期三表与指标
  - 缓存：90d（trend_interpretation:...）
  - 输出结构：严格JSON十个字段对象（见 A.1-12）

—

## C. 基于图片信息的更新（与 01-06 能力/价值对齐）

来自漫画服务实现（src/services/comic.ts、comicPromptModules.ts）之关键更新，映射到产品能力：

- 8 面板固定、两批并行绘制（批次大小 4）→ 提升生成速度与稳定性（价值：更快出图）
- 风格模块化（BASE/LAYOUT/DATA_DISPLAY/MOOD/SAFETY/CHARACTER 模块）→ 面板可定制、风格可控（价值：适配多场景演示）
- 安全约束（风险面板、结论免责声明）→ 合规与专业表达（价值：企业可用）
- 失败重试与错误占位图（明示 errorType）→ 健壮性与用户感知良好（价值：稳定体验）
- 深度数据抽取（extractDeepAgentData）对接分析结果 → 内容准确可复用（价值：一源多用，减少口径偏差）
- 滚动版 HTML 与文本导出 → 输出多样化（价值：运营/汇报便捷）

相应更新 01-06 能力点：
- 01 行业对比 2.0：将漫画第6格“护城河/对比”提示词纳入行业基准要素；在 imagePrompt 中加入对比元素（VERSUS_COMPARISON布局）
- 02 估值评估与趋势解读：趋势面板图形元素（MINI_CHARTS、PERCENTAGE_RINGS）与“TEXT IN IMAGE”数据标签强化
- 03 多 Agent 编排与 Preset：脚本生成/图片生成过程 onProgress 显示（script, images_batch_1/2, finalizing），并允许不同 contentStyle
- 04 数据与成本治理：失败分类（api_error、safety_filter、quota_exceeded 等）记录，便于成本与成功率跟踪；缓存策略（7d/90d）清晰
- 05 输出多样化与复用：ComicScript JSON、滚动HTML、图片URL 协同；PDF/漫画 KV 链接可扩展
- 06 智能问数助手 2.0：可调用漫画文本解读输出，生成问答摘要；支持 /assistant/analyze-trend 接口与图文结合

---

## D. PPT 单页要点（可直接放入一页，含图层标注）

标题：多 Agent 财报分析与漫画生成（01-06 能力全景）

- 01 行业对比能力 2.0
  - 数据/接口：/api/stock/by-industry/, /api/stock/industry-peers/:code, sync, calculateIndustryMetrics, /api/analyze/industry-comparison/:code
  - 价值：对标同业，识别差距与护城河
- 02 估值评估与趋势解读
  - 数据：DailyBasic/FinaIndicator
  - 接口：/api/analyze/trend-interpretation/:code?refresh=true；orchestrator.runValuationAgent
  - 价值：估值定位+趋势洞察，辅助仓位决策
- 03 多 Agent 编排 & Preset
  - 接口：/api/analyze/start、/status、/force-reanalyze；runFinalConclusionAgent
  - 价值：并行+分阶段的稳定产出；Preset 保障口径一致
- 04 数据与成本治理
  - 文档/脚本：DB_INIT_GUIDE.md v2.0.0、npm run db:init:full
  - 状态：/api/health、/api/db/status、/api/stock/search
  - 价值：数据可用性/健康可视，成本可控
- 05 输出多样化与复用
  - 接口：/api/chart/financial/:code
  - /api/images/comic/:reportId/:panelIndex
  - 价值：JSON/PDF/漫画多端复用，一源多用
- 06 智能问数助手 2.0
  - 接口：/api/assistant/chat、/query、/smart-query、/kline、/analyze-trend、/saved-questions
  - 价值：问数直达、趋势解读即取即用

图层标注建议：
- 顶部：标题 + 简短副标题（“并行DAG编排，90天趋势缓存，8面板信息图”）
- 中部六栅格：01-06 模块要点（每格含接口列表小号字）
- 右侧侧栏：Agent 流程（PHASE_1/2/3/4）、缓存TTL（24h/7d/90d）
- 底部：“输出形态”徽章（JSON、图表、漫画、HTML）
- 右下角 可验证性说明（示例接口/路径）：
  - /api/health
  - /api/db/status
  - src/routes/api.ts#calculateIndustryMetrics
  - /api/analyze/industry-comparison/:code
  - /api/chart/financial/:code

---

## E. 六大模块覆盖清单（接口与代码）

- 01 行业对比能力 2.0
  - /api/stock/by-industry/
  - /api/stock/industry-peers/:code
  - /api/stock/sync-industry-peers/:code
  - src/routes/api.ts → calculateIndustryMetrics
  - /api/analyze/industry-comparison/:code
- 02 估值评估与趋势解读
  - 数据源：DailyBasic/FinaIndicator
  - /api/analyze/trend-interpretation/:code?refresh=true
  - orchestrator.runValuationAgent（src/agents/orchestrator.ts）
- 03 多 Agent 编排与 用户 Preset 机制
  - /api/analyze/start、/api/analyze/status、/api/analyze/force-reanalyze
  - orchestrator.runFinalConclusionAgent（汇总结论）
  - Preset 服务：src/services/agentPresets.ts
- 04 数据与成本治理
  - DB_INIT_GUIDE.md v2.0.0、npm run db:init:full
  - /api/stock/search、/api/health、/api/db/status
- 05 输出多样化与复用
  - /api/chart/financial/:code
  - /api/images/comic/:reportId/:panelIndex
  - JSON 结构、PDF/漫画 KV 链接（可扩展）
- 06 智能问数助手 2.0
  - /api/assistant/chat、/api/assistant/query、/api/assistant/smart-query
  - /api/assistant/kline、/api/assistant/analyze-trend、/api/assistant/saved-questions

---

## F. 示例设计要点（可直接用于设计稿）

- src/routes/api.ts#calculateIndustryMetrics
  - 用途：按行业与同业股票计算对比指标（增长、利润率、ROE、杠杆、估值倍数等）
  - 设计注记：在行业对比面板（PANEL 6）以 VERSUS_COMPARISON 布局呈现
- /api/stock/industry-comparison/:code
  - 用途：AI 深度行业对比（Pro/AI 权限）
  - 设计注记：输出表格+要点（insights）并入漫画脚本数据源
- src/agents/orchestrator.ts
  - 用途：多 Agent DAG 编排、阶段并行、缓存与上下文拼装
  - 设计注记：流程图（PHASE_1/2/3/4）与 onProgress 状态映射
- /api/chart/financial/:code
  - 用途：财务图表 JSON
  - 设计注记：在信息图面板嵌入 MINI_CHARTS，TEXT IN IMAGE 显示数值
- src/routes/assistant.tsx（如存在前端路由）
  - 用途：问数助手 UI/交互
  - 设计注记：保留“直接跳转趋势解读”的快捷动作
- /api/health、/api/db/status
  - 用途：可用性与状态可视
  - 设计注记：PPT 右下角“可验证性说明”小字列出

---

## G. 后续工作建议

- 将本页粘贴至设计稿对应页面，保持 01-06 六栅格结构与右下角“可验证性说明”
- 若需产品文档长版：
  - 补充各 Agent 的字段字典（枚举/值域）、空值处理策略与展示规则
  - 增补 KV/DB 表结构与索引说明（reports/comics/comic_images）
- 若需演示素材：
  - 选择一个示例 tsCode，跑通 /api/analyze/start → /status → 生成漫画脚本与图片 → 导出滚动 HTML
  - 截图：PHASE 进度、趋势解读 JSON、行业对比表、漫画 8 面板拼图

---

## 附：三个关键 Agent 的“完整版”Prompt 一览（可直接落库/配置）

1) 文本分析 Aggregation（示例以 PROFITABILITY）
- System Prompt（最终版）：
  ```
  角色：盈利能力分析专家
  目标：基于最近3-8期财务数据，评估营收增长、利润率变化、成本结构与可持续性
  约束：
  - 仅输出 JSON
  - 字段：
    revenueAnalysis {growthYoY, growthQoQ, drivers[], concentration}
    marginAnalysis {grossMargin, netMargin, marginTrend, sensitivity[]}
    costStructure {costOfGoods, expenseRatios {sales, admin, RnD}}
    sustainability {roe, roic, durability, oneSentence}
  - 缺失值以 null + reason 说明；趋势用 up/down/flat/up_slight 等
  - 不编造历史，不输出额外文本
  ```
- User Prompt（最终版）：
  ```
  公司：{{companyName}} ({{tsCode}})
  期间：最新期 {{latestPeriod}}；覆盖 {{reportPeriods}}
  数据：
  - income(last 8): {{income|last:8}}
  - finaIndicator(last 8): {{finaIndicator|last:8}}
  行业：{{industryName|null}}
  要求：输出完整 JSON。
  ```

2) 漫画脚本生成（Script Generator）
- System Prompt（最终版）：
  ```
  角色：信息图漫画总策划
  目标：输出 ComicScript JSON（8面板）
  约束：
  - panels[0..7] 主题固定：公司名片/盈利/资产负债/现金流/盈利质量/风险/护城河/结论
  - 每个 panel 包含：index, chapterTitle, agentSource, subPanels[], scene, actions, dialogues[], captions[], visualMetaphors[], imagePrompt(必须包含“TEXT IN IMAGE”), mood
  - 中文可读性优先；风险面板安全表达；结论面板含“AI生成，仅供参考”
  - 不输出任何非 JSON 文本
  ```
- User Prompt（最终版）：
  ```
  公司：{{companyName}} ({{tsCode}})，行业：{{industryName}}
  角色：{{character.name}}，风格：{{contentStyle}}
  分析摘要（提取自 Agents）：{{deepAgentData}}
  参考布局与数据元素：{{suggestedLayoutsAndDataDisplays}}
  输出：完整 ComicScript JSON。
  ```

3) 漫画解读（Comic Text Interpretation）
- System Prompt（最终版）：
  ```
  角色：漫画文本解读者
  目标：将分析数据转换为8格漫画故事文本
  约束：
  - panels[8]：index, title, scene, dialogue[], caption[], investmentHint?
  - 每格仅保留1-2个核心观点；语言简洁专业
  - 输出严格为 JSON
  ```
- User Prompt（最终版）：
  ```
  公司：{{companyName}} ({{tsCode}})
  分析摘要：{{profitability/balance/cashflow/earningsQuality/risk/businessInsight/businessModel/forecast/valuation/final}}
  主题顺序固定（0..7）。输出 JSON。
  ```

---

可验证性说明（再次汇总，便于落到 PPT 右下角）：
- 健康/状态：/api/health、/api/db/status
- 行业对比与度量：src/routes/api.ts#calculateIndustryMetrics、/api/stock/industry-comparison/:code
- 趋势解读：/api/analyze/trend-interpretation/:code?refresh=true
- 图表/漫画：/api/chart/financial/:code、/api/images/comic/:reportId/:panelIndex
- 编排器：src/agents/orchestrator.ts（PHASES、缓存90天、并行执行）

如需，我可以将此 MD 直接导出为文件并提交至仓库指定位置，或按你的页面模板拆分成多页内容块。
