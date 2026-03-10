# 港股三表数据源调研报告

> 调研日期: 2026-01-17
> 目标: 寻找港股财务三表（利润表、资产负债表、现金流量表）的数据替代来源，支持 Finspark Agent 模块

---

## 一、调研背景

### 1.1 当前问题
- 现有 AKShare 基础接口 **不包含港股三大财务报表**
- Tushare Pro 港股接口 **只有财务指标，没有完整三表**
- 导致以下 Agent 模块无法支持港股分析:
  - BALANCE_SHEET (资产负债表分析)
  - CASH_FLOW (现金流量表分析)
  - PROFITABILITY (需要完整利润表)
  - EARNINGS_QUALITY (需要三表交叉验证)

### 1.2 调研范围
| 数据源 | 类型 | 调研状态 |
|--------|------|----------|
| AKShare (stock_financial_hk_report_em) | Python库 | ✅ 已测试 |
| yfinance | Python库 | ✅ 已测试 |
| Financial Modeling Prep | REST API | ✅ 已调研 |
| Tushare Pro (hk_fina_indicator) | Python库 | ✅ 已调研 |
| 东方财富开放API (stock-open-api) | Python库 | ✅ 已调研 |
| 港交所披露易 (HKEXnews) | 网页/PDF | ✅ 已调研 |

---

## 二、数据源详细评估

### 2.1 AKShare - stock_financial_hk_report_em 🌟🌟🌟🌟🌟 (首选推荐)

#### 接口信息
```python
import akshare as ak

# 利润表
df = ak.stock_financial_hk_report_em(stock="00700", symbol="利润表", indicator="年度")

# 资产负债表  
df = ak.stock_financial_hk_report_em(stock="00700", symbol="资产负债表", indicator="年度")

# 现金流量表
df = ak.stock_financial_hk_report_em(stock="00700", symbol="现金流量表", indicator="年度")
```

#### 实测结果 (2026-01-17)
| 报表类型 | 数据行数 | 数据项数 | 状态 |
|----------|----------|----------|------|
| 利润表 | 558 | 31项 | ✅ 成功 |
| 资产负债表 | 1069 | 69项 | ✅ 成功 |
| 现金流量表 | 914 | 60项 | ✅ 成功 |

#### 利润表数据项 (31项)
- 营业额、其他营业收入、营运收入、营运支出
- 毛利、其他收益、销售及分销费用、行政开支
- 经营溢利、利息收入、融资成本
- 应占联营公司溢利、应占合营公司溢利
- 除税前溢利、税项、除税后溢利
- 少数股东损益、股东应占溢利
- 每股基本盈利、每股摊薄盈利、每股股息
- 其他全面收益、全面收益总额

#### 资产负债表数据项 (69项)
- **非流动资产**: 物业厂房及设备、投资物业、无形资产、土地使用权、在建工程、递延税项资产、联营公司权益、合营公司权益
- **流动资产**: 存货、应收帐款、现金及等价物、短期存款
- **流动负债**: 应付帐款、应付票据、应付税项、融资租赁负债
- **非流动负债**: 长期借款、递延税项负债
- **权益**: 股本、储备、留存收益

#### 现金流量表数据项 (60项)
- **经营活动**: 除税前溢利、折旧及摊销、营运资金变动、经营产生现金、已付税项
- **投资活动**: 已收利息、已收股息、处置固定资产、购建固定资产、收购/出售附属公司
- **融资活动**: 借款增加、偿还借款、已付股息、已付利息

#### 优势
- ✅ **免费无限制** - 无需 Token/积分
- ✅ **数据完整** - 三表全覆盖，字段丰富
- ✅ **数据源权威** - 来自东方财富
- ✅ **更新及时** - 财报发布后1-3天更新
- ✅ **易于集成** - Python 原生支持

#### 劣势
- ⚠️ 数据为长表格式 (需要 pivot 转换)
- ⚠️ 高频调用可能被限流
- ⚠️ 接口可能因东方财富网站变化而失效

---

### 2.2 yfinance 🌟🌟🌟 (备选方案)

#### 接口信息
```python
import yfinance as yf

ticker = yf.Ticker('0700.HK')

# 利润表 (年度)
income = ticker.income_stmt        # 返回空
income = ticker.quarterly_income_stmt  # 返回季度数据

# 资产负债表
balance = ticker.balance_sheet     # 79项 x 4年

# 现金流量表
cashflow = ticker.cashflow         # 58项 x 4年
```

#### 实测结果 (2026-01-17)
| 报表类型 | 数据行数 | 数据列数 | 状态 |
|----------|----------|----------|------|
| income_stmt (年度) | - | - | ❌ 空数据 |
| quarterly_income_stmt | 47 | 6 | ✅ 成功 |
| balance_sheet | 79 | 4 | ✅ 成功 |
| cashflow | 58 | 4 | ✅ 成功 |

#### 优势
- ✅ **免费** - 无需注册
- ✅ **国际标准格式** - 英文字段名，适合量化分析
- ✅ **宽表格式** - 直接可用，无需转换

#### 劣势
- ⚠️ **年度利润表返回空** - 港股支持不完整
- ⚠️ **历史数据有限** - 仅4年数据
- ⚠️ **易被封禁** - 高频调用会被 Yahoo 限制
- ⚠️ **数据延迟** - 可能落后于官方披露

---

### 2.3 Financial Modeling Prep API 🌟🌟🌟 (商业方案)

#### 接口信息
```
GET https://financialmodelingprep.com/api/v3/income-statement/0700.HK?apikey=YOUR_KEY
GET https://financialmodelingprep.com/api/v3/balance-sheet-statement/0700.HK?apikey=YOUR_KEY
GET https://financialmodelingprep.com/api/v3/cash-flow-statement/0700.HK?apikey=YOUR_KEY
```

#### 特点
- **覆盖范围**: 全球股票，包括港股
- **数据格式**: JSON，标准化字段
- **免费额度**: 250次/天
- **付费计划**: $14-$99/月

#### 优势
- ✅ **全球覆盖** - 支持港股、美股、欧股
- ✅ **标准化数据** - GAAP/IFRS 标准
- ✅ **API 稳定** - 商业级 SLA

#### 劣势
- ⚠️ **免费额度有限** - 250次/天不够用
- ⚠️ **需要 API Key** - 需要注册
- ⚠️ **付费才实用** - 生产环境需要付费

---

### 2.4 Tushare Pro - hk_fina_indicator 🌟🌟 (仅指标)

#### 接口信息
```python
import tushare as ts
pro = ts.pro_api('YOUR_TOKEN')

# 港股财务指标 (不是完整三表)
df = pro.hk_fina_indicator(ts_code='00700.HK', period='20241231')
```

#### 数据内容
- ✅ 每股指标: EPS、BPS、每股经营现金流
- ✅ 盈利指标: 毛利率、净利率、ROE、ROA
- ✅ 成长指标: 营收同比、净利同比
- ✅ 估值指标: PE、PB、总市值
- ❌ **无完整利润表明细**
- ❌ **无完整资产负债表明细**
- ❌ **无完整现金流量表明细**

#### 优势
- ✅ 数据质量高
- ✅ 指标计算准确

#### 劣势
- ⚠️ **不是完整三表** - 只有财务指标
- ⚠️ **需要积分** - 15000积分或单独开权限
- ⚠️ **每次最多200条** - 需要分批获取

---

### 2.5 东方财富开放API (stock-open-api) 🌟🌟🌟

#### 项目信息
- GitHub: https://github.com/mouday/stock-open-api
- 数据源: 东方财富

#### 港股接口
```python
from stock_open_api.api.eastmoney import hk_stock

# 公司资料
hk_stock.get_org_profile(code='00700')

# 证券资料
hk_stock.get_security_info(code='00700')
```

#### 特点
- 与 AKShare 使用相同数据源 (东方财富)
- 封装更底层，需要自行处理

#### 评估
- AKShare 已经封装好了相同数据源
- 不需要额外引入此库

---

### 2.6 港交所披露易 (HKEXnews) 🌟🌟 (原始数据)

#### 网站信息
- 官网: https://www.hkexnews.hk/
- 年报易览: https://are.hkex.com.hk/

#### 特点
- **原始披露文件** - PDF/HTML 格式年报
- **最权威** - 官方第一手数据
- **AI 年报易览** - 港交所新推出的 AI 搜索工具

#### 优势
- ✅ **最权威** - 官方数据源
- ✅ **最及时** - 第一时间披露
- ✅ **免费** - 公开信息

#### 劣势
- ⚠️ **非结构化** - PDF 需要解析
- ⚠️ **无 API** - 只能爬取或手动下载
- ⚠️ **格式不统一** - 各公司年报格式不同

---

## 三、数据源对比总结

| 维度 | AKShare | yfinance | FMP API | Tushare Pro | HKEX |
|------|---------|----------|---------|-------------|------|
| **免费** | ✅ | ✅ | ⚠️ 250次/天 | ⚠️ 需积分 | ✅ |
| **三表完整** | ✅ | ⚠️ 利润表空 | ✅ | ❌ 仅指标 | ✅ PDF |
| **数据格式** | 长表 | 宽表 | JSON | DataFrame | PDF |
| **字段丰富度** | 🌟🌟🌟🌟🌟 | 🌟🌟🌟 | 🌟🌟🌟🌟 | 🌟🌟🌟 | 🌟🌟🌟🌟🌟 |
| **历史深度** | 多年 | 4年 | 多年 | 多年 | 全部 |
| **更新及时** | 1-3天 | 延迟 | 1-3天 | 1-3天 | 即时 |
| **稳定性** | ⚠️ 可能变 | ⚠️ 易封 | ✅ 商业级 | ✅ 稳定 | ✅ 官方 |
| **集成难度** | 低 | 低 | 中 | 低 | 高 |

---

## 四、最终选型建议

### 4.1 推荐方案: AKShare 为主 + yfinance 为辅

```
┌─────────────────────────────────────────────────────────┐
│                    港股财务数据架构                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │   AKShare   │    │  yfinance   │    │  Tushare  │  │
│   │  (主数据源)  │    │  (备份源)    │    │  (指标源)  │  │
│   └──────┬──────┘    └──────┬──────┘    └─────┬─────┘  │
│          │                  │                  │        │
│          ▼                  ▼                  ▼        │
│   ┌─────────────────────────────────────────────────┐  │
│   │              HK Stock Data Service               │  │
│   │  - 三大报表: AKShare stock_financial_hk_report_em│  │
│   │  - 备份验证: yfinance balance_sheet/cashflow     │  │
│   │  - 财务指标: Tushare hk_fina_indicator          │  │
│   │  - 日线行情: AKShare stock_hk_hist              │  │
│   └─────────────────────────────────────────────────┘  │
│                          │                              │
│                          ▼                              │
│   ┌─────────────────────────────────────────────────┐  │
│   │                  Agent 模块                      │  │
│   │  ✅ PROFITABILITY  ✅ BALANCE_SHEET             │  │
│   │  ✅ CASH_FLOW      ✅ EARNINGS_QUALITY          │  │
│   │  ✅ RISK           ✅ VALUATION                 │  │
│   │  ✅ TREND          ✅ INDUSTRY_COMPARISON       │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 实施优先级

| 优先级 | 任务 | 数据源 | 复杂度 |
|--------|------|--------|--------|
| P0 | 港股三大报表接入 | AKShare stock_financial_hk_report_em | 中 |
| P1 | 数据格式转换 | 长表 → 宽表，对齐 A股字段 | 中 |
| P2 | Agent 模块适配 | 修改 Agent 支持港股数据结构 | 高 |
| P3 | 备份数据源 | yfinance 作为 fallback | 低 |
| P4 | 数据缓存 | Redis/KV 缓存财报数据 | 中 |

### 4.3 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| AKShare 接口变更 | 中 | 高 | 监控接口状态，准备 yfinance 备份 |
| 东方财富限流 | 中 | 中 | 增加缓存，降低调用频率 |
| 数据格式不一致 | 高 | 中 | 建立字段映射表，统一数据结构 |
| 港股字段与 A股不同 | 高 | 中 | 创建港股专用 Agent Prompt |

---

## 五、下一步行动

### 5.1 立即可做
1. **创建 AKShare 港股三表服务** (`src/services/akshareHK.ts`)
2. **实现数据格式转换** (长表 → 标准宽表)
3. **建立字段映射表** (港股中文 → 标准英文)

### 5.2 短期计划 (1-2周)
1. **适配 PROFITABILITY Agent** - 使用港股利润表
2. **适配 BALANCE_SHEET Agent** - 使用港股资产负债表
3. **适配 CASH_FLOW Agent** - 使用港股现金流量表
4. **测试验证** - 选取 5-10 只港股进行完整分析测试

### 5.3 中期计划 (2-4周)
1. **添加 yfinance 备份源**
2. **实现数据校验逻辑**
3. **优化缓存策略**
4. **完善错误处理**

---

## 六、附录

### A. AKShare 港股三表字段映射 (待完善)

```javascript
// 利润表字段映射
const incomeMapping = {
  '营业额': 'total_revenue',
  '毛利': 'gross_profit',
  '经营溢利': 'operating_profit',
  '除税前溢利': 'profit_before_tax',
  '除税后溢利': 'profit_after_tax',
  '股东应占溢利': 'net_income_attr_parent',
  '每股基本盈利': 'basic_eps',
  // ... 更多映射
};

// 资产负债表字段映射
const balanceMapping = {
  '总资产': 'total_assets',
  '非流动资产合计': 'non_current_assets',
  '流动资产合计': 'current_assets',
  '现金及等价物': 'cash_and_equivalents',
  '存货': 'inventory',
  '应收帐款': 'accounts_receivable',
  // ... 更多映射
};

// 现金流量表字段映射
const cashflowMapping = {
  '经营业务现金净额': 'net_cashflow_operating',
  '投资活动现金净额': 'net_cashflow_investing',
  '融资活动现金净额': 'net_cashflow_financing',
  // ... 更多映射
};
```

### B. 测试代码

```python
import akshare as ak

# 测试港股三大报表
def test_hk_financial_reports(stock_code='00700'):
    reports = ['利润表', '资产负债表', '现金流量表']
    
    for report in reports:
        try:
            df = ak.stock_financial_hk_report_em(
                stock=stock_code, 
                symbol=report, 
                indicator='年度'
            )
            print(f'{report}: {len(df)} 行, {df["STD_ITEM_NAME"].nunique()} 个数据项')
        except Exception as e:
            print(f'{report}: 失败 - {e}')

if __name__ == '__main__':
    test_hk_financial_reports('00700')  # 腾讯
    test_hk_financial_reports('09988')  # 阿里巴巴
    test_hk_financial_reports('00941')  # 中国移动
```

---

**文档版本**: v1.0
**最后更新**: 2026-01-17
**作者**: Finspark AI Developer
