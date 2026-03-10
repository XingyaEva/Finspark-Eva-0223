# 港股三表数据源调研报告

**调研日期**: 2026-01-17  
**调研目的**: 为 Finspark 港股分析功能寻找可用的财务三表（利润表、资产负债表、现金流量表）数据源

---

## 一、执行摘要

### 🎯 核心发现

**AKShare 已支持港股完整三大报表**，这是本次调研的重大发现！

| 数据源 | 港股三表支持 | 实测状态 | 推荐指数 |
|--------|-------------|----------|---------|
| **AKShare** | ✅ 完整支持 | ✅ 测试通过 | ⭐⭐⭐⭐⭐ |
| yfinance | ⚠️ 部分支持 | ⚠️ 利润表为空 | ⭐⭐⭐ |
| Financial Modeling Prep | ✅ 支持港股 | 🔒 需付费 | ⭐⭐⭐⭐ |
| Tushare Pro | ⚠️ 仅财务指标 | ⚠️ 无完整三表 | ⭐⭐ |
| 东方财富开放API | ✅ 支持 | 🔧 需自行封装 | ⭐⭐⭐ |

### 🏆 最终建议

**首选方案：AKShare `stock_financial_hk_report_em` 接口**

理由：
1. ✅ 免费、开源、无需注册
2. ✅ 数据完整，覆盖港股三大报表
3. ✅ 数据来源东方财富，质量有保证
4. ✅ 与现有 AKShare 行情接口统一，便于维护

---

## 二、各数据源详细调研

### 1. AKShare（推荐 ⭐⭐⭐⭐⭐）

#### 接口信息
- **接口名称**: `stock_financial_hk_report_em`
- **数据来源**: 东方财富
- **覆盖范围**: 全部港股上市公司
- **更新频率**: 跟随东方财富，财报发布后1-3天

#### 实测结果（2026-01-17）
```python
import akshare as ak

# 利润表 - ✅ 成功
df = ak.stock_financial_hk_report_em(stock="00700", symbol="利润表", indicator="年度")
# 返回 558 行数据，31 个财务项目

# 资产负债表 - ✅ 成功
df = ak.stock_financial_hk_report_em(stock="00700", symbol="资产负债表", indicator="年度")
# 返回 1069 行数据，69 个财务项目

# 现金流量表 - ✅ 成功
df = ak.stock_financial_hk_report_em(stock="00700", symbol="现金流量表", indicator="年度")
# 返回 914 行数据，60 个财务项目
```

#### 数据项覆盖

**利润表 (31项)**
- 营业额、其他营业收入、营运收入、营运支出
- 毛利、经营溢利、利息收入、融资成本
- 应占联营公司溢利、除税前溢利、税项
- 持续经营业务税后利润、除税后溢利
- 少数股东损益、股东应占溢利
- 每股基本盈利、每股摊薄盈利、每股股息 等

**资产负债表 (69项)**
- 物业厂房及设备、投资物业、无形资产、土地使用权
- 递延税项资产、联营公司权益、合营公司权益
- 存货、应收帐款、现金及等价物、短期存款
- 应付帐款、应付票据、应付税项、递延收入
- 非流动资产合计、流动资产合计、总资产
- 流动负债合计、非流动负债合计、负债合计
- 股本、储备、少数股东权益 等

**现金流量表 (60项)**
- 除税前溢利、利息收入、利息支出、投资收益
- 减值及拨备、折旧及摊销、汇兑收益
- 营运资金变动前经营溢利、存货增减、应收帐款增减
- 经营产生现金、已付税项、经营业务现金净额
- 已收利息、已收股息、存款增减
- 处置固定资产、购建固定资产、购建无形资产
- 出售附属公司、收购附属公司 等

#### 优势
- 免费、开源、无限制调用
- 数据全面，覆盖完整三表
- Python 原生支持，易于集成
- 与现有 AKShare 接口风格统一

#### 劣势
- 依赖东方财富网页数据，接口可能变化
- 无官方 SLA 保证
- 高频调用可能被限制

---

### 2. yfinance（备选 ⭐⭐⭐）

#### 接口信息
- **数据来源**: Yahoo Finance
- **覆盖范围**: 港股（.HK 后缀）
- **费用**: 免费

#### 实测结果（2026-01-17）
```python
import yfinance as yf
ticker = yf.Ticker("0700.HK")

# 利润表（年报）- ⚠️ 返回空数据
ticker.income_stmt  # 空

# 季报利润表 - ✅ 成功
ticker.quarterly_income_stmt  # 47行 x 6列

# 资产负债表 - ✅ 成功
ticker.balance_sheet  # 79行 x 4列

# 现金流量表 - ✅ 成功
ticker.cashflow  # 58行 x 4列
```

#### 优势
- 免费、全球知名
- 英文字段名，标准化
- 支持多市场（港股、美股、A股）

#### 劣势
- **年报利润表数据缺失**（关键问题）
- 港股数据不如A股完整
- Yahoo 官方 API 已停用，依赖非官方爬取
- 高频使用可能被封禁

---

### 3. Financial Modeling Prep（付费备选 ⭐⭐⭐⭐）

#### 接口信息
- **官网**: https://financialmodelingprep.com
- **覆盖范围**: 全球股票，包含港股
- **费用**: 免费版限制 250 次/天，付费版 $15-50/月

#### API 端点
```
# 利润表
GET /api/v3/income-statement/0700.HK?apikey=YOUR_KEY

# 资产负债表
GET /api/v3/balance-sheet-statement/0700.HK?apikey=YOUR_KEY

# 现金流量表
GET /api/v3/cash-flow-statement/0700.HK?apikey=YOUR_KEY
```

#### 优势
- 数据质量高，标准化程度好
- REST API 设计，文档完善
- 支持季报和年报
- 全球市场覆盖

#### 劣势
- **需要付费**才能正常使用
- 免费版有 API 调用限制
- 需注册获取 API Key

---

### 4. Tushare Pro（不推荐 ⭐⭐）

#### 接口信息
- **接口名称**: `hk_fina_indicator`
- **费用**: 需 15000 积分或单独开权限
- **数据范围**: 财务指标，非完整三表

#### 实测结果
Tushare Pro 提供的港股接口 `hk_fina_indicator` **仅包含财务指标**，而非完整的三大财务报表：

```python
# 可获取的数据
- EPS、每股净资产、PE、PB
- 营业收入、毛利润、归母净利润
- 毛利率、净利率、ROE、ROA
- 经营现金流、投资现金流、融资现金流
- 资产负债率、流动比率 等

# 缺失的数据
- 完整利润表（各科目明细）
- 完整资产负债表（各科目明细）
- 完整现金流量表（各科目明细）
```

#### 优势
- 数据质量稳定
- 有专业维护团队

#### 劣势
- **无完整三表接口**
- 需要积分/付费
- 港股数据能力有限

---

### 5. 东方财富直接爬取（技术备选 ⭐⭐⭐）

#### 数据来源
- 港股财务报表页面: `https://emweb.securities.eastmoney.com/PC_HKF10/FinancialAnalysis/index?type=web&code=00700`

#### 实现方式
- 方式1: 使用 AKShare（已封装好）
- 方式2: 使用 stock-open-api（GitHub 开源）
- 方式3: 自行爬取 API

#### 优势
- 数据是一手的
- 可定制化程度高

#### 劣势
- 需要自行维护
- 网页结构变化可能导致失效
- 反爬机制可能触发

---

## 三、与 Agent 模块的映射关系

基于 AKShare 港股三表数据，各 Agent 模块的数据支持情况如下：

| Agent 模块 | 所需数据 | AKShare 支持度 | 说明 |
|-----------|---------|---------------|------|
| PROFITABILITY | 利润表 | ✅ 完全支持 | 营业额、毛利、经营溢利、净利润 |
| BALANCE_SHEET | 资产负债表 | ✅ 完全支持 | 资产、负债、权益各科目 |
| CASH_FLOW | 现金流量表 | ✅ 完全支持 | 经营/投资/融资现金流 |
| EARNINGS_QUALITY | 三表交叉分析 | ✅ 完全支持 | 需结合三表数据 |
| RISK | 负债结构分析 | ✅ 完全支持 | 流动/非流动负债、资产结构 |
| VALUATION | 估值指标 | ✅ 完全支持 | 结合原有 AKShare 接口 |
| INDUSTRY_COMPARISON | 行业对比 | ✅ 完全支持 | 结合原有 AKShare 接口 |
| TREND_INTERPRETATION | 趋势解读 | ✅ 完全支持 | 历年财务数据趋势 |

---

## 四、实施建议

### 方案一：纯 AKShare 方案（推荐）

```
┌──────────────────────────────────────────────────────┐
│                    Finspark                          │
├──────────────────────────────────────────────────────┤
│                  AKShare Service                     │
│  ┌─────────────────┬────────────────────────────┐   │
│  │   港股行情数据   │      港股财务三表          │   │
│  │  stock_hk_hist  │  stock_financial_hk_report │   │
│  │  stock_hk_spot  │                            │   │
│  └─────────────────┴────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**优势**：
- 统一数据源，维护简单
- 无需额外付费
- 接口风格一致

**劣势**：
- 单点依赖风险
- 无 SLA 保证

### 方案二：主从冗余方案

```
┌──────────────────────────────────────────────────────┐
│                    Finspark                          │
├──────────────────────────────────────────────────────┤
│                  Data Router                         │
│           ┌──────────┬──────────────┐               │
│           │ Primary  │   Fallback   │               │
│           │ AKShare  │   yfinance   │               │
│           └──────────┴──────────────┘               │
└──────────────────────────────────────────────────────┘
```

**优势**：
- 有备份数据源
- 提高可用性

**劣势**：
- 需处理数据格式差异
- yfinance 利润表数据不完整

### 方案三：付费 + 免费混合方案

```
┌──────────────────────────────────────────────────────┐
│                    Finspark                          │
├──────────────────────────────────────────────────────┤
│                  Data Router                         │
│           ┌──────────────────────────┐              │
│           │   Financial Modeling     │  (付费)      │
│           │          Prep            │              │
│           └──────────────────────────┘              │
│           ┌──────────────────────────┐              │
│           │       AKShare            │  (免费备份)  │
│           └──────────────────────────┘              │
└──────────────────────────────────────────────────────┘
```

**优势**：
- 数据质量最高
- 有 SLA 保证

**劣势**：
- 需要付费（$15-50/月）
- 增加运维复杂度

---

## 五、下一步行动

### 立即可执行（推荐）

1. **新增 AKShare 港股三表服务**
   - 文件: `src/services/akshareHKFinancials.ts`
   - 实现 `getHKIncomeStatement()`, `getHKBalanceSheet()`, `getHKCashFlow()`

2. **修改 Python 代理服务**
   - 文件: `scripts/akshare_proxy.py`
   - 添加港股三表获取端点

3. **扩展数据库 Schema**
   - 添加 `hk_income`, `hk_balance`, `hk_cashflow` 表

4. **修改 Agent Prompts**
   - 适配港股财务数据字段名

### 示例实现代码

```python
# akshare_proxy.py 新增端点
@app.route('/hk/financials/<stock_code>/<report_type>')
def get_hk_financials(stock_code, report_type):
    """
    获取港股财务报表
    report_type: income|balance|cashflow
    """
    import akshare as ak
    
    symbol_map = {
        'income': '利润表',
        'balance': '资产负债表',
        'cashflow': '现金流量表'
    }
    
    df = ak.stock_financial_hk_report_em(
        stock=stock_code, 
        symbol=symbol_map[report_type], 
        indicator='年度'
    )
    
    return df.to_json(orient='records')
```

---

## 六、附录

### A. AKShare 港股三表接口完整参数

```python
stock_financial_hk_report_em(
    stock: str,      # 股票代码，如 "00700"
    symbol: str,     # 报表类型: "资产负债表" | "利润表" | "现金流量表"
    indicator: str   # 时间维度: "年度" | "报告期"
) -> pd.DataFrame
```

### B. 测试脚本

```python
# scripts/test_akshare_hk_financials.py
import akshare as ak

def test_hk_financials(stock_code='00700'):
    reports = ['利润表', '资产负债表', '现金流量表']
    
    for report in reports:
        print(f"\n测试 {report}...")
        try:
            df = ak.stock_financial_hk_report_em(
                stock=stock_code, 
                symbol=report, 
                indicator='年度'
            )
            print(f"✅ 成功: {len(df)} 行, {len(df['STD_ITEM_NAME'].unique())} 个数据项")
        except Exception as e:
            print(f"❌ 失败: {e}")

if __name__ == '__main__':
    test_hk_financials()
```

---

**文档作者**: AI Assistant  
**版本**: v1.0  
**最后更新**: 2026-01-17
