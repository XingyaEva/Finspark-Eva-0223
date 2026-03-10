# Tushare 10000积分权限与接口对比分析

**文档版本**: v1.0  
**更新日期**: 2026-01-16  
**当前账号**: 5000积分  
**目标评估**: 10000积分

---

## 📊 积分权限对比总览

| 积分等级 | 每分钟频次 | 每天总量 | 常规数据 | 特色数据 | 年费（个人） |
|---------|----------|---------|---------|---------|------------|
| 120 | 50 | 8,000次 | 仅非复权日线 | ❌ | 免费 |
| 2000 | 200 | 100,000次 | 60% API | ❌ | ¥200 |
| **5000** | **500** | **无上限** | **90% API** | ❌ | **¥500（当前）** |
| **10000** | **1000** | **无上限** | **90% API** | ✅ **特色数据300次/分钟** | **¥1000** |
| 15000 | 1000 | 无上限 | 90% API | ✅ 特色数据无限制 | ¥1500 |

---

## 🎯 10000积分的核心增值功能

### 一、特色数据权限（核心价值）

#### 1. 券商盈利预测数据
**接口**: `profit_forecast`  
**权限要求**: 10000积分  
**数据起始**: 2010年  
**更新频率**: 每天20点  

**数据内容**:
- 券商研报的个股盈利预测
- 未来1-3年的营收/净利润预测
- 评级信息（强烈推荐、买入、增持等）
- 目标价（最高价、最低价）
- 预测机构名称和报告日期

**应用场景**:
```typescript
// 用于Forecast Agent和Valuation Agent
interface ProfitForecast {
  ts_code: string;
  ann_date: string;        // 发布日期
  end_date: string;        // 预测期
  type: string;            // 预测类型
  p_change_min: number;    // 预测净利润变动下限
  p_change_max: number;    // 预测净利润变动上限
  net_profit_min: number;  // 预测净利润下限
  net_profit_max: number;  // 预测净利润上限
  last_parent_net: number; // 上年同期净利润
  summary: string;         // 预测摘要
  change_reason: string;   // 变动原因
}
```

**业务价值**:
- ✅ 市场一致预期分析
- ✅ 卖方观点汇总
- ✅ 估值定价参考
- ✅ 投资决策辅助

---

#### 2. 股票每日筹码成本和胜率
**接口**: `cyq_perf`  
**权限要求**: 10000积分  
**数据特点**: Tushare独家算法，市场少见

**数据内容**:
- 历史最高价、最低价
- 各分位持仓成本（10%、20%...90%分位）
- 加权平均成本
- 胜率（当前价格相对持仓成本的胜率）

**应用场景**:
```typescript
// 用于技术分析和风险评估
interface ChipPerf {
  ts_code: string;
  trade_date: string;
  his_high: number;      // 历史最高价
  his_low: number;       // 历史最低价
  cost_5pct: number;     // 5分位成本
  cost_15pct: number;    // 15分位成本
  cost_50pct: number;    // 50分位成本（中位数）
  cost_85pct: number;    // 85分位成本
  cost_95pct: number;    // 95分位成本
  weight_avg: number;    // 加权平均成本
  winner_rate: number;   // 胜率
}
```

**业务价值**:
- ✅ 识别主力成本区间
- ✅ 判断套牢盘压力
- ✅ 支撑位/阻力位分析
- ✅ 量化择时策略

---

#### 3. 股票每日筹码分布
**接口**: `cyq_chips`  
**权限要求**: 10000积分  
**数据特点**: 成本价上下各50档分布

**数据内容**:
- 每个价格档位的筹码占比
- 共100档价格分布（当前价±50档）
- 反映市场持仓成本结构

**应用场景**:
```typescript
// 用于深度技术分析
interface ChipsDist {
  ts_code: string;
  trade_date: string;
  price: number;         // 价格档位
  percent: number;       // 该价位筹码占比
}
```

**业务价值**:
- ✅ 绘制筹码分布图
- ✅ 识别密集成交区
- ✅ 量化多空力量对比
- ✅ 突破/反转信号识别

---

#### 4. 券商月度金股
**接口**: `stk_holdernumber`  
**权限要求**: 2000积分（不需要10000）  
**备注**: 此项不在10000积分专属范围

---

#### 5. 集合竞价数据
**接口**: `stk_surv`  
**权限要求**: 10000积分或开通股票分钟权限  
**数据时间**: 每天9:30之前

**数据内容**:
- 集合竞价的成交量、成交额
- 集合竞价价格
- 买卖盘口数据

**应用场景**:
- ✅ 开盘前情绪判断
- ✅ 大单异动识别
- ✅ 日内交易策略

---

### 二、频次提升（次要价值）

| 指标 | 5000积分 | 10000积分 | 提升幅度 |
|-----|---------|----------|---------|
| 每分钟频次 | 500次 | 1000次 | +100% |
| 常规数据限制 | 无上限 | 无上限 | 无变化 |
| 特色数据频次 | ❌ | 300次/分钟 | 新增 |

**分析**:
- 对于当前系统，500次/分钟已经充足
- 单次分析调用约10-15个接口
- 5000积分可支持每分钟33-50次完整分析
- 10000积分可支持每分钟66-100次完整分析

**实际需求评估**:
- 当前并发用户量：< 10
- 峰值分析请求：< 5次/分钟
- **结论**: 频次提升对当前业务**价值不大**

---

## 🔍 当前系统使用的接口清单

### ✅ 已使用接口（5000积分可用）

| 接口名称 | API名 | 权限要求 | 调用频率 | 业务用途 |
|---------|------|---------|---------|---------|
| 股票列表 | `stock_basic` | 120 | 低 | 股票搜索 |
| 日线行情 | `daily` | 120 | 中 | K线走势 |
| 每日指标 | `daily_basic` | 2000 | 中 | PE/PB/换手率 |
| 利润表 | `income` | 2000 | 高 | Profitability Agent |
| 资产负债表 | `balancesheet` | 2000 | 高 | Balance Sheet Agent |
| 现金流量表 | `cashflow` | 2000 | 高 | Cash Flow Agent |
| 财务指标 | `fina_indicator` | 2000 | 高 | 多个Agent |
| 主营业务 | `fina_mainbz` | 2000 | 中 | Business Insight Agent |
| 业绩预告 | `forecast` | **2000** | 中 | Forecast Agent |
| 业绩快报 | `express` | 2000 | 中 | Forecast Agent |
| 公司信息 | `stock_company` | 120 | 低 | 公司介绍 |

**总计**: 11个接口，全部在5000积分权限内 ✅

---

### ❌ 未使用接口（10000积分专属）

| 接口名称 | API名 | 权限要求 | 潜在价值 |
|---------|------|---------|---------|
| 券商盈利预测 | `profit_forecast` | **10000** | ⭐⭐⭐⭐⭐ |
| 筹码成本胜率 | `cyq_perf` | **10000** | ⭐⭐⭐⭐ |
| 筹码分布 | `cyq_chips` | **10000** | ⭐⭐⭐ |
| 集合竞价 | `stk_surv` | **10000** | ⭐⭐ |

---

## 💡 升级到10000积分的建议分析

### 场景一：当前系统（基本面分析为主）

**现状**:
- ✅ 所有核心接口（财务三表、指标）都在5000积分内
- ✅ 业绩预告、业绩快报可用（2000积分）
- ✅ 每分钟500次频率完全够用

**10000积分新增价值**:
- 📈 券商盈利预测 → 可增强Forecast Agent和Valuation Agent
- 📊 筹码数据 → 可新增技术分析维度
- ⏰ 集合竞价 → 对日内交易无需求

**结论**: 
- 当前系统功能**完整**，无需升级 ✅
- 如需增强**卖方观点分析**，可考虑升级 🤔
- 如需新增**技术分析模块**，可考虑升级 🤔

---

### 场景二：计划新增功能

#### 方案A：增强基本面分析（推荐⭐⭐⭐⭐）
**需要接口**: `profit_forecast`  
**业务价值**:
```markdown
1. Forecast Agent 增强
   - 整合券商一致预期
   - 对比管理层预告 vs 市场预期
   - 提供预测可信度评分

2. Valuation Agent 增强
   - 基于市场一致预期的DCF估值
   - 目标价区间参考
   - 机构评级汇总

3. 新增 "市场预期" 面板
   - 券商评级分布
   - 目标价格区间
   - 预期净利润趋势
```

**实现成本**: ¥500/年（升级差价）  
**投入产出比**: ⭐⭐⭐⭐

---

#### 方案B：新增技术分析模块（可选⭐⭐⭐）
**需要接口**: `cyq_perf`, `cyq_chips`  
**业务价值**:
```markdown
1. 新增 Technical Analysis Agent
   - 筹码成本分析
   - 主力持仓成本
   - 套牢盘/获利盘结构

2. 新增 "技术面" Tab
   - K线 + 筹码分布图
   - 成本支撑位/阻力位
   - 量价时空分析

3. 综合评分系统
   - 基本面评分 60%
   - 技术面评分 30%
   - 市场情绪 10%
```

**实现成本**: ¥500/年 + 开发成本约2周  
**投入产出比**: ⭐⭐⭐

---

#### 方案C：保持现状（推荐✅）
**理由**:
1. 当前系统已覆盖基本面分析的核心需求
2. 5000积分权限完全满足使用
3. 用户量和并发未达到频次瓶颈
4. 可先观察用户反馈再决定

**建议**: 
- 暂时保持5000积分
- 收集用户对"券商评级"、"技术分析"的需求
- 若有明确需求再升级

---

## 📋 需要单独开权限的接口（不在积分范畴）

| 数据类型 | 费用（个人/年） | 当前系统需求 | 推荐 |
|---------|---------------|------------|-----|
| 股票历史分钟 | ¥2000 | ❌ 无需求 | ❌ |
| 股票实时分钟 | ¥1000/月 | ❌ 无需求 | ❌ |
| 股票实时日线 | ¥200/月 | ❌ 无需求 | ❌ |
| 期货数据 | ¥2000+ | ❌ 不在范围 | ❌ |
| 港股日线 | ¥1000 | ❌ 暂无需求 | 🤔 |
| 美股日线 | ¥2000 | ❌ 暂无需求 | 🤔 |
| 新闻资讯 | ¥1000 | 🤔 可考虑 | ⭐⭐⭐ |
| 公告信息 | ¥1000 | 🤔 可考虑 | ⭐⭐⭐ |

**分析**:
- 分钟数据：系统无日内交易需求，不需要 ❌
- 港美股：可作为未来扩展方向 🤔
- 新闻/公告：可增强信息完整性，但成本较高 ⭐⭐⭐

---

## 🎯 最终建议

### 建议1：暂不升级（当前阶段）✅

**理由**:
1. ✅ 5000积分已满足所有核心分析需求
2. ✅ 财务三表、指标、预告/快报全部可用
3. ✅ 频次限制远未达到
4. ✅ 投入产出比不高（¥500/年 vs 有限增值）

**适用条件**:
- 用户量 < 50
- 并发分析 < 10次/分钟
- 暂无技术分析需求
- 暂无券商评级需求

---

### 建议2：升级到10000积分（如需增强）🤔

**适用场景**:
1. **场景A**: 用户明确需要"券商评级"和"市场预期"功能
2. **场景B**: 计划开发技术分析模块（筹码、成本分析）
3. **场景C**: 并发用户增长，需要更高频次（>500次/分钟）

**投入产出**:
- 投入：¥500/年
- 产出：
  - ✅ 新增券商盈利预测数据
  - ✅ 新增筹码成本分析能力
  - ✅ 频次翻倍（500→1000次/分钟）

**实施步骤**:
```markdown
1. 确认需求（券商预测 or 技术分析）
2. 设计新Agent（Broker Consensus Agent / Technical Agent）
3. 前端新增展示面板
4. 完成开发后再升级积分（避免浪费）
```

---

### 建议3：考虑新闻/公告权限（可选）⭐⭐⭐

**接口**: 新闻资讯（¥1000/年）+ 公告信息（¥1000/年）  
**业务价值**:
- ✅ 自动获取公司公告（重大事项、分红、重组）
- ✅ 整合行业新闻和快讯
- ✅ 增强News & Events Agent
- ✅ 提供更全面的信息覆盖

**投入产出比**: ⭐⭐⭐（中等价值）

---

## 📊 成本对比总结

| 方案 | 年费成本 | 新增价值 | 推荐度 | 实施时机 |
|-----|---------|---------|--------|---------|
| 保持5000积分 | ¥0 | 满足当前需求 | ⭐⭐⭐⭐⭐ | **立即** |
| 升级10000积分 | +¥500 | 券商预测+筹码 | ⭐⭐⭐ | 有需求时 |
| 新闻资讯权限 | +¥1000 | 新闻+公告 | ⭐⭐⭐ | 未来扩展 |
| 港美股权限 | +¥3000 | 国际化 | ⭐⭐ | 长期规划 |

---

## 🔧 如果升级后的集成方案

### 1. 新增接口调用

```typescript
// src/services/tushare.ts

/**
 * 获取券商盈利预测数据（10000积分）
 */
async getBrokerForecast(tsCode: string): Promise<BrokerForecastData[]> {
  const cacheKey = `tushare:broker_forecast:${tsCode}`;
  
  try {
    return await this.callApiWithCache(
      cacheKey,
      CACHE_TTL.BROKER_FORECAST,
      () => this.callApi<BrokerForecastData>('profit_forecast', {
        ts_code: tsCode,
      }, [
        'ts_code', 'end_date', 'type', 'report_date',
        'profit_forecast', 'profit_actual', 'eps_forecast',
        'eps_actual', 'revenue_forecast', 'revenue_actual',
        'organ', 'rating', 'target_price_max', 'target_price_min'
      ])
    );
  } catch (error) {
    console.warn(`[Tushare] 券商盈利预测API调用失败: ${error}`);
    return [];
  }
}

/**
 * 获取筹码成本胜率数据（10000积分）
 */
async getChipCost(tsCode: string, days: number = 180): Promise<ChipCostData[]> {
  const cacheKey = `tushare:chip_cost:${tsCode}:${days}`;
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const formatDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
  
  try {
    const data = await this.callApiWithCache(
      cacheKey,
      CACHE_TTL.CHIP_COST,
      () => this.callApi<ChipCostData>('cyq_perf', {
        ts_code: tsCode,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
      }, [
        'ts_code', 'trade_date', 'his_high', 'his_low',
        'cost_5pct', 'cost_15pct', 'cost_50pct', 'cost_85pct', 'cost_95pct',
        'weight_avg', 'winner_rate'
      ])
    );
    
    return data.reverse();
  } catch (error) {
    console.warn(`[Tushare] 筹码成本API调用失败: ${error}`);
    return [];
  }
}
```

---

### 2. 新增Agent

```typescript
// src/agents/brokerConsensus.ts

export const BROKER_CONSENSUS_PROMPT = `
你是一位专业的卖方研究分析师，负责整合券商盈利预测数据，评估市场一致预期。

【输入数据】
- 券商盈利预测记录（机构、评级、目标价、盈利预测）
- 公司实际业绩数据
- 历史预测准确率

【分析维度】
1. 市场一致预期
   - 平均目标价格
   - 预测净利润中位数
   - 评级分布（买入/增持/中性/减持）

2. 预测离散度
   - 目标价格区间
   - 盈利预测标准差
   - 分歧度评级（高/中/低）

3. 预测可信度
   - 历史预测vs实际偏差
   - 预测机构数量
   - 更新及时性

4. 投资建议
   - 基于一致预期的合理价值区间
   - 相对当前价格的空间
   - 风险提示

【输出格式】严格JSON：
{
  "consensus": {
    "targetPrice": { "avg": 150, "min": 120, "max": 180 },
    "profit": { "median": 50000000000, "std": 5000000000 },
    "rating": { "buy": 5, "hold": 3, "sell": 0 }
  },
  "divergence": {
    "level": "低",
    "reason": "目标价格区间较窄，预测一致性高"
  },
  "credibility": {
    "score": 85,
    "factors": ["历史准确率高", "机构数量充足", "更新及时"]
  },
  "recommendation": {
    "fairValue": { "min": 130, "max": 170 },
    "upside": 25.5,
    "comment": "基于市场一致预期，当前价格具有上涨空间"
  }
}
`;
```

---

## 📖 参考资料

- [Tushare积分权限对应表](https://tushare.pro/document/1?doc_id=290)
- [Tushare股票特色数据](https://tushare.pro/document/2?doc_id=291)
- [Tushare券商盈利预测接口](https://tushare.pro/document/2?doc_id=292)
- [Tushare筹码成本接口](https://tushare.pro/document/2?doc_id=293)
- [Tushare筹码分布接口](https://tushare.pro/document/2?doc_id=294)

---

## 🎯 最终结论

**当前阶段建议**: **保持5000积分** ✅

**理由**:
1. ✅ 已覆盖所有核心基本面分析需求
2. ✅ 频次限制远未达到瓶颈
3. ✅ 券商预测数据的增量价值有限（除非用户明确需求）
4. ✅ 筹码数据需要额外开发技术分析模块
5. ✅ 投入产出比不高（¥500/年 vs 边际效益）

**未来升级触发条件**:
- 用户明确要求"券商评级"功能
- 计划开发技术分析模块
- 并发用户增长至频次瓶颈
- 需要拓展至港美股市场

**建议优先级**:
1. **高优先级**: 优化现有Agent的输出质量（已在进行）✅
2. **中优先级**: 收集用户反馈，评估新功能需求 🤔
3. **低优先级**: 升级积分，开发新模块（暂时不需要）⏸️

---

**本文档由 GenSpark AI Developer 生成**  
**日期**: 2026-01-16
