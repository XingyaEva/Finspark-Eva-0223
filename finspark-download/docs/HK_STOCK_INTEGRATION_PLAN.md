# 港股数据接入开发计划

> 版本: v1.0
> 日期: 2026-01-17
> 目标: 无缝集成港股三大财务报表数据，支持全部 Agent 分析

---

## 一、核心需求确认

### 1.1 关键约束
1. ✅ **不影响现有代码运行** - A股分析流程保持不变
2. ✅ **无缝衔接** - 港股分析复用现有前后端接口
3. ✅ **自动路由** - 根据股票代码自动判断 A股/港股
4. ✅ **返回格式一致** - Agent 输出结构与 A股完全兼容

### 1.2 数据流设计
```
用户输入股票代码
       │
       ▼
┌─────────────────┐
│  股票类型识别   │  ← isHKStock(code): 00700.HK / 00700 → 港股
│  (工具函数)     │  ← 600519.SH / 600519 → A股
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 A 股       港 股
    │         │
    ▼         ▼
TushareService  AkshareHKService  ← 新增服务
    │         │
    ▼         ▼
┌─────────────────┐
│  数据格式统一   │  ← 港股数据转换为 A股兼容格式
│ (Adapter Layer) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrator   │  ← 现有编排器，无需修改
│  (Agent 编排)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  各 Agent 分析  │  ← 现有 Agent，无需修改
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  前端展示      │  ← 现有前端，无需修改
└─────────────────┘
```

---

## 二、分阶段开发计划

### Phase 1: 基础设施层 (预计 2-3 小时)

#### 1.1 创建港股识别工具函数
**文件**: `src/utils/stockCode.ts` (新建)

```typescript
/**
 * 股票代码类型识别与标准化
 */

export type MarketType = 'A' | 'HK' | 'US';

/**
 * 判断是否为港股代码
 * 规则:
 * - 00700.HK, 00700 (5位数字开头)
 * - 港股代码: 00001-09999 (主板), 08001-08999 (创业板)
 */
export function isHKStock(code: string): boolean {
  const normalized = code.toUpperCase().replace('.HK', '');
  // 港股代码为5位数字，或以.HK结尾
  if (code.toUpperCase().includes('.HK')) return true;
  // 纯数字且长度为5位
  if (/^\d{5}$/.test(normalized)) return true;
  return false;
}

/**
 * 判断是否为A股代码
 * 规则:
 * - 600xxx.SH (上交所主板)
 * - 601xxx.SH (上交所主板)
 * - 603xxx.SH (上交所主板)
 * - 688xxx.SH (科创板)
 * - 000xxx.SZ (深交所主板)
 * - 002xxx.SZ (中小板)
 * - 300xxx.SZ (创业板)
 */
export function isAStock(code: string): boolean {
  const normalized = code.toUpperCase();
  // 已包含后缀
  if (normalized.includes('.SH') || normalized.includes('.SZ')) return true;
  // 6位数字代码
  if (/^(600|601|603|688|000|001|002|003|300|301)\d{3}$/.test(normalized)) return true;
  return false;
}

/**
 * 标准化股票代码
 * A股: 600519 → 600519.SH
 * 港股: 00700 → 00700.HK
 */
export function normalizeStockCode(code: string): { code: string; market: MarketType } {
  const upper = code.toUpperCase().trim();
  
  // 已有后缀
  if (upper.includes('.SH')) return { code: upper, market: 'A' };
  if (upper.includes('.SZ')) return { code: upper, market: 'A' };
  if (upper.includes('.HK')) return { code: upper, market: 'HK' };
  
  // 港股识别 (5位数字)
  if (/^\d{5}$/.test(upper)) {
    return { code: `${upper}.HK`, market: 'HK' };
  }
  
  // A股识别 (6位数字)
  if (/^\d{6}$/.test(upper)) {
    const prefix = upper.substring(0, 1);
    const suffix = prefix === '6' ? '.SH' : '.SZ';
    return { code: `${upper}${suffix}`, market: 'A' };
  }
  
  // 默认返回原代码
  return { code: upper, market: 'A' };
}

/**
 * 获取市场类型
 */
export function getMarketType(code: string): MarketType {
  return normalizeStockCode(code).market;
}
```

#### 1.2 创建 AKShare 港股数据服务
**文件**: `src/services/akshareHK.ts` (新建)

```typescript
/**
 * AKShare 港股财务数据服务
 * 
 * 功能:
 * 1. 获取港股三大财务报表 (利润表/资产负债表/现金流量表)
 * 2. 将港股数据格式转换为 A股兼容格式 (供 Orchestrator 使用)
 * 3. 支持缓存策略
 * 
 * 数据来源: AKShare stock_financial_hk_report_em (东方财富)
 */

import type { 
  IncomeData, 
  BalanceData, 
  CashFlowData,
  DailyData,
  StockBasic,
  FinaIndicatorData,
  DailyBasicData,
  MarketDataPackage
} from './tushare';

export interface AkshareHKConfig {
  cache?: KVNamespace;
  pythonProxyUrl?: string;  // Python 代理服务地址
}

// 缓存配置
const CACHE_TTL = {
  FINANCIAL: 24 * 3600,      // 财务报表: 24小时
  KLINE: 5 * 60,             // K线数据: 5分钟
  STOCK_BASIC: 7 * 24 * 3600, // 股票基本信息: 7天
};

/**
 * AKShare 港股服务类
 */
export class AkshareHKService {
  private cache?: KVNamespace;
  private pythonProxyUrl: string;

  constructor(config: AkshareHKConfig) {
    this.cache = config.cache;
    // Python 代理服务默认地址
    this.pythonProxyUrl = config.pythonProxyUrl || 'http://localhost:8000';
  }

  // ========== 核心财务报表接口 ==========

  /**
   * 获取港股利润表 (转换为 Tushare IncomeData 格式)
   */
  async getIncomeStatement(stockCode: string): Promise<IncomeData[]> {
    // 实现详见 Phase 1
  }

  /**
   * 获取港股资产负债表 (转换为 Tushare BalanceData 格式)
   */
  async getBalanceSheet(stockCode: string): Promise<BalanceData[]> {
    // 实现详见 Phase 1
  }

  /**
   * 获取港股现金流量表 (转换为 Tushare CashFlowData 格式)
   */
  async getCashFlow(stockCode: string): Promise<CashFlowData[]> {
    // 实现详见 Phase 1
  }

  // ========== 数据格式转换器 ==========
  
  /**
   * 将 AKShare 港股利润表长表转换为 Tushare IncomeData 宽表
   */
  private transformIncomeData(rawData: AkshareIncomeRaw[]): IncomeData[] {
    // 字段映射与转换逻辑
  }
}
```

---

### Phase 2: 数据适配层 (预计 3-4 小时)

#### 2.1 创建统一数据服务代理
**文件**: `src/services/stockDataService.ts` (新建)

```typescript
/**
 * 统一股票数据服务
 * 
 * 作用: 根据股票类型自动路由到对应数据源
 * - A股 → TushareService
 * - 港股 → AkshareHKService
 * 
 * 设计原则:
 * 1. 对外接口与 TushareService 完全一致
 * 2. 内部自动判断股票类型并路由
 * 3. 返回数据格式统一 (兼容现有 Orchestrator)
 */

import { TushareService, TushareConfig } from './tushare';
import { AkshareHKService, AkshareHKConfig } from './akshareHK';
import { isHKStock, normalizeStockCode } from '../utils/stockCode';
import type { 
  IncomeData, 
  BalanceData, 
  CashFlowData,
  // ... 其他类型
} from './tushare';

export interface StockDataServiceConfig {
  tushare: TushareConfig;
  akshareHK?: AkshareHKConfig;
}

export class StockDataService {
  private tushare: TushareService;
  private akshareHK: AkshareHKService;

  constructor(config: StockDataServiceConfig) {
    this.tushare = new TushareService(config.tushare);
    this.akshareHK = new AkshareHKService(config.akshareHK || { cache: config.tushare.cache });
  }

  /**
   * 获取利润表 (自动路由)
   */
  async getIncomeStatement(tsCode: string, period?: string): Promise<IncomeData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股利润表: ${code}`);
      return this.akshareHK.getIncomeStatement(code.replace('.HK', ''));
    }
    
    return this.tushare.getIncomeStatement(code, period);
  }

  /**
   * 获取资产负债表 (自动路由)
   */
  async getBalanceSheet(tsCode: string, period?: string): Promise<BalanceData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股资产负债表: ${code}`);
      return this.akshareHK.getBalanceSheet(code.replace('.HK', ''));
    }
    
    return this.tushare.getBalanceSheet(code, period);
  }

  /**
   * 获取现金流量表 (自动路由)
   */
  async getCashFlow(tsCode: string, period?: string): Promise<CashFlowData[]> {
    const { code, market } = normalizeStockCode(tsCode);
    
    if (market === 'HK') {
      console.log(`[StockDataService] 港股现金流量表: ${code}`);
      return this.akshareHK.getCashFlow(code.replace('.HK', ''));
    }
    
    return this.tushare.getCashFlow(code, period);
  }

  // ... 其他方法使用相同模式
}

/**
 * 创建统一数据服务实例
 */
export function createStockDataService(config: StockDataServiceConfig): StockDataService {
  return new StockDataService(config);
}
```

---

### Phase 3: Orchestrator 适配 (预计 2 小时)

#### 3.1 修改 Orchestrator 构造函数
**文件**: `src/agents/orchestrator.ts` (修改)

**修改点**: 将 `TushareService` 替换为 `StockDataService`

```typescript
// 修改前
import { TushareService } from '../services/tushare';

export interface OrchestratorConfig {
  vectorEngine: VectorEngineService;
  tushare: TushareService;  // ← 原有
  // ...
}

// 修改后
import { StockDataService } from '../services/stockDataService';

export interface OrchestratorConfig {
  vectorEngine: VectorEngineService;
  dataService: StockDataService;  // ← 新名称，统一数据服务
  // 兼容性保留
  tushare?: TushareService;  // 已废弃，保留向后兼容
  // ...
}
```

#### 3.2 修改 fetchFinancialData 方法
```typescript
// 修改前
private async fetchFinancialData(tsCode: string, period?: string): Promise<FinancialData> {
  const [income, balance, cashFlow, ...] = await Promise.all([
    this.tushare.getIncomeStatement(tsCode, period),
    this.tushare.getBalanceSheet(tsCode, period),
    this.tushare.getCashFlow(tsCode, period),
    // ...
  ]);
}

// 修改后
private async fetchFinancialData(tsCode: string, period?: string): Promise<FinancialData> {
  // 使用统一数据服务，自动路由到 A股/港股数据源
  const dataService = this.dataService || this.tushare;  // 向后兼容
  
  const [income, balance, cashFlow, ...] = await Promise.all([
    dataService.getIncomeStatement(tsCode, period),
    dataService.getBalanceSheet(tsCode, period),
    dataService.getCashFlow(tsCode, period),
    // ...
  ]);
}
```

---

### Phase 4: API 路由层适配 (预计 1-2 小时)

#### 4.1 修改 api.ts 创建服务的逻辑
**文件**: `src/routes/api.ts` (修改)

```typescript
// 修改前
const tushare = createTushareService({
  token: c.env.TUSHARE_TOKEN,
  cache: c.env.CACHE,
});

// 修改后
import { createStockDataService } from '../services/stockDataService';

const dataService = createStockDataService({
  tushare: {
    token: c.env.TUSHARE_TOKEN,
    cache: c.env.CACHE,
  },
  akshareHK: {
    cache: c.env.CACHE,
    pythonProxyUrl: c.env.AKSHARE_PROXY_URL,  // 可选配置
  }
});
```

---

### Phase 5: Python 代理服务 (预计 2-3 小时)

#### 5.1 创建 AKShare Python 代理服务
**文件**: `scripts/akshare_proxy.py` (新建)

由于 AKShare 是 Python 库，而 Finspark 后端是 TypeScript/Cloudflare Workers，需要创建一个轻量级 Python 代理服务。

```python
"""
AKShare 港股数据代理服务
提供 REST API 供 TypeScript 后端调用
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import akshare as ak
import pandas as pd
from typing import Optional
import json

app = FastAPI(title="AKShare HK Stock Proxy")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/hk/financial/{stock_code}/{report_type}")
async def get_hk_financial(
    stock_code: str, 
    report_type: str,  # income, balance, cashflow
    indicator: str = "年度"
):
    """
    获取港股财务报表
    
    Args:
        stock_code: 港股代码 (如 00700)
        report_type: 报表类型 (income/balance/cashflow)
        indicator: 年度/报告期
    """
    symbol_map = {
        "income": "利润表",
        "balance": "资产负债表",
        "cashflow": "现金流量表"
    }
    
    if report_type not in symbol_map:
        raise HTTPException(400, "Invalid report_type")
    
    try:
        df = ak.stock_financial_hk_report_em(
            stock=stock_code,
            symbol=symbol_map[report_type],
            indicator=indicator
        )
        return {
            "success": True,
            "data": df.to_dict(orient="records")
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/hk/kline/{stock_code}")
async def get_hk_kline(
    stock_code: str,
    days: int = 180,
    adjust: str = "qfq"
):
    """获取港股K线数据"""
    try:
        df = ak.stock_hk_hist(
            symbol=stock_code,
            period="daily",
            adjust=adjust
        )
        # 取最近N天
        df = df.tail(days)
        return {
            "success": True,
            "data": df.to_dict(orient="records")
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

### Phase 6: 测试与验证 (预计 2 小时)

#### 6.1 单元测试
```typescript
// src/services/akshareHK.test.ts
describe('AkshareHKService', () => {
  it('should fetch HK income statement and convert to Tushare format', async () => {
    const service = new AkshareHKService({ cache: undefined });
    const income = await service.getIncomeStatement('00700');
    
    // 验证返回格式与 TushareService 一致
    expect(income[0]).toHaveProperty('ts_code');
    expect(income[0]).toHaveProperty('total_revenue');
    expect(income[0]).toHaveProperty('n_income_attr_p');
  });
});
```

#### 6.2 集成测试
```typescript
// 测试完整分析流程
describe('HK Stock Analysis', () => {
  it('should analyze HK stock using same orchestrator', async () => {
    const result = await orchestrator.analyze({
      companyCode: '00700.HK',
      companyName: '腾讯控股',
      reportType: 'annual',
    });
    
    // 验证分析结果结构一致
    expect(result.profitabilityResult).toBeDefined();
    expect(result.balanceSheetResult).toBeDefined();
    expect(result.cashFlowResult).toBeDefined();
  });
});
```

---

## 三、关键技术决策

### 3.1 数据格式映射表

#### 利润表字段映射 (港股 → A股)
| 港股字段 (AKShare) | A股字段 (Tushare) | 说明 |
|-------------------|------------------|------|
| 营业额 | total_revenue | 营业收入 |
| 毛利 | - | 需计算 |
| 经营溢利 | operate_profit | 营业利润 |
| 除税前溢利 | - | 税前利润 |
| 除税后溢利 | n_income | 净利润 |
| 股东应占溢利 | n_income_attr_p | 归母净利润 |
| 每股基本盈利 | basic_eps | 基本每股收益 |

#### 资产负债表字段映射
| 港股字段 | A股字段 | 说明 |
|---------|--------|------|
| 总资产 | total_assets | 资产总计 |
| 非流动资产合计 | - | 非流动资产 |
| 流动资产合计 | - | 流动资产 |
| 现金及等价物 | money_cap | 货币资金 |
| 存货 | inventories | 存货 |
| 应收帐款 | accounts_receiv | 应收账款 |

### 3.2 向后兼容策略
1. **保留旧接口**: `OrchestratorConfig.tushare` 仍可用
2. **新接口优先**: 优先使用 `dataService`
3. **运行时判断**: 根据 `dataService` 是否存在决定使用哪个

---

## 四、风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| AKShare 接口变更 | 港股数据获取失败 | 添加接口监控，备用 yfinance |
| Python 代理服务宕机 | 港股分析不可用 | 部署多实例，健康检查 |
| 数据格式不一致 | Agent 分析错误 | 完善单元测试，数据校验 |
| 港股财务报表字段缺失 | 部分 Agent 结果不完整 | 默认值填充，跳过非必须字段 |

---

## 五、验收标准

### 5.1 功能验收
- [ ] 搜索 "腾讯" 返回港股 00700.HK
- [ ] 分析 00700.HK 完成全部 Agent 流程
- [ ] 分析结果格式与 A股一致
- [ ] 前端正常展示港股分析报告

### 5.2 兼容性验收
- [ ] A股 600519.SH 分析流程不受影响
- [ ] 现有 API 接口响应格式不变
- [ ] 前端无需任何修改

### 5.3 性能验收
- [ ] 港股分析耗时 < 120秒
- [ ] 缓存命中时 < 5秒

---

## 六、开发时间估算

| Phase | 任务 | 预估时间 | 状态 |
|-------|-----|---------|------|
| Phase 1 | 基础设施层 (工具函数 + AKShare 服务) | 2-3小时 | ✅ 已完成 |
| Phase 2 | 数据适配层 (统一数据服务) | 3-4小时 | ✅ 已完成 |
| Phase 3 | Orchestrator 适配 | 2小时 | ✅ 已完成 |
| Phase 4 | API 路由层适配 | 1-2小时 | ✅ 已完成 |
| Phase 5 | Python 代理服务 | 2-3小时 | ✅ 已完成 |
| Phase 6 | 测试与验证 | 2小时 | ⏳ 待部署测试 |
| **总计** | | **12-16小时** | |

---

## 七、文件变更清单

### 新增文件 (已完成)
1. `src/utils/stockCode.ts` - 股票代码识别工具 ✅
2. `src/services/akshareHK.ts` - AKShare 港股服务 ✅
3. `src/services/stockDataService.ts` - 统一数据服务代理 ✅
4. `scripts/akshare_proxy.py` - Python 代理服务 ✅

### 修改文件 (最小化改动，已完成)
1. `src/agents/orchestrator.ts` - 添加 dataService 支持 ✅
2. `src/routes/api.ts` - 创建服务时使用统一数据服务 ✅
3. `src/types/index.ts` - 添加 AKSHARE_PROXY_URL 环境变量类型 ✅

### 不修改的文件 (保持稳定)
1. `src/agents/prompts.ts` - Agent Prompt 不变
2. `src/services/tushare.ts` - Tushare 服务不变
3. `src/index.tsx` - 前端代码不变

---

## 八、部署与运行

### 8.1 Python 代理服务部署

```bash
# 安装依赖
pip install fastapi uvicorn akshare pandas

# 启动服务
cd scripts
python akshare_proxy.py

# 服务地址: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

### 8.2 Cloudflare 环境变量配置

在 `wrangler.jsonc` 或 Cloudflare Dashboard 中添加：

```
AKSHARE_PROXY_URL=http://your-akshare-proxy-host:8000
```

### 8.3 验证步骤

1. 启动 Python 代理服务
2. 访问 http://localhost:8000/health 确认服务正常
3. 访问 http://localhost:8000/hk/financial/00700/income 确认数据获取正常
4. 启动前端服务，搜索 "00700" 或 "腾讯"
5. 进行港股分析，验证全流程正常

---

**文档版本**: v2.0
**最后更新**: 2026-01-17
**作者**: Finspark AI Developer
**开发状态**: 核心代码已完成，待部署测试
