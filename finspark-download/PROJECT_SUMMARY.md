# Finspark 投资分析系统 - 项目总结文档

> 文档生成时间: 2026-01-16  
> 当前版本: Latest (commit: 7bafa28)  
> 分支: genspark_ai_developer

---

## 一、项目概览

### 1.1 项目定位
Finspark 是一个基于 **Multi-Agent 协同架构** 的智能财报分析平台，旨在为投资者提供专业、全面的企业财务健康状况分析及行业竞争地位评估。

### 1.2 核心特点
- **12大AI Agent** 并行/串行混合编排，深度解读企业财务数据
- **多数据源整合**：Tushare金融数据 + AkShare港股数据 + VectorEngine AI分析
- **完整用户系统**：认证、收藏、报告管理、会员订阅
- **创新功能**：AI漫画生成、IP角色系统、智能问数助手

### 1.3 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **前端** | 原生JS + TailwindCSS + ECharts | 黑金风格UI设计 |
| **后端** | Hono + TypeScript | 轻量级、高性能 |
| **部署** | Cloudflare Pages | 边缘计算，全球加速 |
| **数据库** | Cloudflare D1 (SQLite) | Serverless数据库 |
| **缓存** | Cloudflare KV | 分布式缓存 |
| **AI模型** | VectorEngine API (GPT-5.1) | 大模型分析能力 |
| **A股数据** | Tushare Pro API | 专业金融数据接口 |
| **港股数据** | AkShare (待接入) | 免费开源，无需API Key |

---

## 二、系统架构

### 2.1 Multi-Agent 编排架构

```
Financial Analysis Orchestrator (编排器)
│ 
├── Phase 1: 并行执行 (Promise.all)
│   ├── Profitability Agent (利润表分析)
│   ├── Balance Sheet Agent (资产负债表分析)
│   └── Cash Flow Agent (现金流量表分析)
│ 
├── Phase 1.5: 趋势解读
│   └── Trend Interpretation Agent (趋势解读)
│ 
├── Phase 2: 依赖执行
│   ├── Earnings Quality Agent (三表联动分析)
│   ├── Risk & Leverage Agent (风险评估)
│   └── Business Insight Agent (业务洞察)
│ 
├── Phase 3: 可选执行 + 估值
│   ├── Business Model Agent (商业模式分析)
│   ├── Forecast Agent (业绩预测)
│   └── Valuation Agent (估值评估)
│ 
├── Phase 4: 行业对比 (独立模块)
│   └── Industry Comparison Agent (行业对比分析)
│ 
└── Final Phase: 汇总
    └── Final Investment Conclusion Agent (投资结论)
```

### 2.2 核心Agent说明

| Agent | 功能 | 数据来源 |
|-------|------|----------|
| **Profitability** | 盈利能力分析 | 利润表 + 财务指标 |
| **Balance Sheet** | 资产负债分析 | 资产负债表 + 偿债指标 |
| **Cash Flow** | 现金流分析 | 现金流量表 + FCFF/FCFE |
| **Earnings Quality** | 三表联动分析 | 综合三表数据 |
| **Risk** | 风险评估 | 负债率、流动性指标 |
| **Business Insight** | 业务洞察 | 主营业务构成 |
| **Business Model** | 商业模式分析 | 业务结构 + 护城河 |
| **Forecast** | 业绩预测 | 业绩预告 + 快报 |
| **Valuation** | 估值评估 | PE/PB/PS + 市场数据 |
| **Trend Interpretation** | 趋势解读 | 7大核心指标趋势 |
| **Industry Comparison** | 行业对比 | 同行业对标数据 |
| **Final Conclusion** | 投资结论 | 综合所有分析 |

### 2.3 项目目录结构

```
finspark-download/
├── src/
│   ├── agents/              # Agent系统核心
│   │   ├── orchestrator.ts  # 编排器 (1400+ 行)
│   │   └── prompts.ts       # Agent Prompts (1000+ 行)
│   ├── services/            # 服务层 (20+ 服务文件)
│   │   ├── vectorengine.ts  # VectorEngine AI API
│   │   ├── tushare.ts       # Tushare 金融数据 API
│   │   ├── stockdb.ts       # D1 股票数据库操作
│   │   ├── auth.ts          # 用户认证服务
│   │   ├── favorites.ts     # 收藏服务
│   │   ├── reports.ts       # 报告服务
│   │   ├── comic.ts         # 漫画生成服务
│   │   ├── characters.ts    # IP角色服务
│   │   ├── membership.ts    # 会员服务
│   │   ├── pdf.ts           # PDF导出服务
│   │   └── ...
│   ├── routes/              # API路由 (15+ 路由文件)
│   │   ├── api.ts           # 主API路由
│   │   ├── auth.ts          # 认证路由
│   │   ├── favorites.ts     # 收藏路由
│   │   ├── reports.ts       # 报告路由
│   │   └── ...
│   ├── pages/               # 页面模块
│   │   ├── assistant.ts     # 智能问数助手
│   │   ├── membership.ts    # 会员中心
│   │   ├── settings.ts      # 设置页面
│   │   └── ...
│   ├── components/          # UI组件
│   │   ├── analysisConfig.ts
│   │   ├── floatingAssistant.ts
│   │   └── stockMarketPanel.ts
│   ├── types/               # TypeScript类型定义
│   └── index.tsx            # 主入口 (11,400+ 行)
├── migrations/              # 数据库迁移 (16个文件)
├── public/                  # 静态资源
├── docs/                    # 技术文档 (25+ 文档)
├── scripts/                 # 工具脚本
├── seed.sql                 # 初始数据 (5472家A股公司)
├── package.json             # 项目配置
├── wrangler.jsonc           # Cloudflare配置
└── ecosystem.config.cjs     # PM2配置
```

---

## 三、功能模块详解

### 3.1 用户认证系统

| 功能 | 接口 | 方法 | 说明 |
|------|------|------|------|
| 用户注册 | `/api/auth/register` | POST | 邮箱+密码+用户名 |
| 用户登录 | `/api/auth/login` | POST | JWT Token签发 |
| Token刷新 | `/api/auth/refresh` | POST | 续期机制 |
| 获取用户 | `/api/auth/me` | GET | 当前用户信息 |
| 修改密码 | `/api/auth/change-password` | POST | 安全密码更新 |
| 登出 | `/api/auth/logout` | POST | 支持单/多设备 |

### 3.2 股票搜索系统

- **本地优先搜索**：D1数据库 LIKE + FTS5全文搜索
- **Tushare降级策略**：本地无数据时调用API
- **自动缓存**：新发现股票自动入库
- **支持搜索**：代码、中文名、行业、拼音首字母

### 3.3 财报分析功能

| 功能 | 说明 |
|------|------|
| **开始分析** | 提交股票代码，触发Multi-Agent分析流程 |
| **流式进度** | SSE实时推送Agent执行状态 |
| **分析报告** | 结构化JSON格式的完整分析结果 |
| **PDF导出** | 黑金风格专业排版报告 |
| **AI漫画** | 多种风格的财报漫画生成 |

### 3.4 IP角色系统

#### 哪吒电影角色集 (nezha-movie)
| 角色ID | 名称 | 适合行业 |
|--------|------|----------|
| nezha | 小哪吒 | 科技/互联网/新能源 |
| aobing | 敖丙 | 金融/银行/保险 |
| taiyi | 太乙真人 | 食品饮料/消费 |
| shen-gongbao | 申公豹 | 房地产/建筑 |
| li-jing | 李靖 | 制造业/重工 |
| yin-shi | 殷夫人 | 医疗/健康 |

#### 商业经典角色集 (business-classic)
| 角色ID | 名称 | 适合行业 |
|--------|------|----------|
| finance-butler | 金币先生 | 银行/金融 |
| tech-robot | 科技小智 | 科技/AI |
| wine-master | 酒仙翁 | 白酒/饮料 |
| medicine-doc | 药丸博士 | 医疗/制药 |

### 3.5 会员系统

| 等级 | 功能权限 |
|------|----------|
| Free | 基础分析、每日3次 |
| Pro | 完整分析、无限次数、漫画生成 |
| Enterprise | 全部功能、API接入、定制服务 |

---

## 四、数据库设计

### 4.1 核心表（共33个）

#### 基础数据表
- `stocks` - 股票基础信息 (5472条 A股数据)
- `stocks_fts` - FTS5全文搜索索引
- `users` - 用户账户
- `user_sessions` - 用户会话

#### 财务数据表
- `income_statements` - 利润表
- `balance_sheets` - 资产负债表
- `cash_flows` - 现金流量表
- `fina_indicators` - 财务指标
- `daily_quotes` - 日线行情

#### 报告表
- `analysis_reports` - 分析报告
- `comic_reports` - 漫画报告
- `share_links` - 分享链接

#### 用户功能表
- `user_favorites` - 用户收藏
- `favorite_groups` - 收藏分组
- `saved_questions` - 保存问题
- `user_preferences` - 用户偏好

#### 会员表
- `membership_plans` - 会员方案
- `membership_orders` - 会员订单
- `feature_limits` - 功能权益

#### Agent配置表
- `user_agent_presets` - Agent预设
- `user_agent_settings` - Agent设置
- `model_configs` - 模型配置

### 4.2 迁移文件列表

```
migrations/
├── 0001_stock_tables.sql       # 股票基础表
├── 0002_user_features.sql      # 用户功能
├── 0003_search_optimization.sql # 搜索优化
├── 0004_comic_ip_character.sql # 漫画IP角色
├── 0005_pinyin_search.sql      # 拼音搜索
├── 0006_model_evaluation.sql   # 模型评估
├── 0007_model_evaluation_content_metrics.sql
├── 0008_financial_data_tables.sql # 财务数据表
├── 0009_comic_content_style.sql   # 漫画内容风格
├── 0010_user_system_v2.sql     # 用户系统V2
├── 0011_favorite_groups.sql    # 收藏分组
├── 0012_membership_plans.sql   # 会员计划
├── 0013_share_links.sql        # 分享链接
├── 0014_user_preferences.sql   # 用户偏好
├── 0015_saved_questions.sql    # 保存问题
└── 0016_agent_presets.sql      # Agent预设
```

---

## 五、API接口文档

### 5.1 股票相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stock/search?q=` | GET | 搜索股票 |
| `/api/stock/basic/:code` | GET | 股票基本信息 |
| `/api/stock/daily/:code` | GET | 日线数据 |
| `/api/stock/financial/:code/:type` | GET | 财务数据 |
| `/api/stock/hot` | GET | 热门股票推荐 |
| `/api/stock/industries` | GET | 行业列表 |
| `/api/stock/by-industry/:industry` | GET | 按行业获取股票 |
| `/api/stock/industry-peers/:code` | GET | 同行业对标公司 |
| `/api/stock/industry-comparison/:code` | GET | 行业对比数据 |

### 5.2 分析相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/analyze/start` | POST | 开始分析 |
| `/api/analyze/status/:id` | GET | 查询状态 |
| `/api/analyze/result/:id` | GET | 获取结果 |
| `/api/analyze/stream/:id` | GET | 流式进度(SSE) |
| `/api/analyze/industry-comparison/:code` | GET | AI行业对比 |
| `/api/analyze/trend-interpretation/:code` | GET | 趋势解读 |

### 5.3 报告相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/reports/my` | GET | 我的报告列表 |
| `/api/reports/recent` | GET | 最近公开报告 |
| `/api/reports/:id` | GET | 报告详情 |
| `/api/reports/:id` | DELETE | 删除报告 |
| `/api/reports/:id/pdf` | GET | 导出PDF |
| `/api/reports/:id/comic` | POST | 生成漫画 |
| `/api/reports/:id/comic` | GET | 获取漫画 |

### 5.4 IP角色相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/characters/sets` | GET | 所有角色集列表 |
| `/api/characters/default` | GET | 默认角色 |
| `/api/characters/recommend` | GET | 推荐角色 |
| `/api/characters/:setId/:characterId` | GET | 角色详情 |

---

## 六、环境配置

### 6.1 必需的环境变量

```env
# VectorEngine AI API密钥
VECTORENGINE_API_KEY=your_vectorengine_api_key

# Tushare股票数据API Token
TUSHARE_TOKEN=your_tushare_token

# JWT认证密钥 (至少32字符)
JWT_SECRET=your_jwt_secret_min_32_chars
```

### 6.2 开发命令

```bash
# 安装依赖
npm install

# 数据库初始化
npm run db:migrate:local
npm run db:seed

# 构建
npm run build

# 开发模式
npm run dev:sandbox

# 生产部署
npm run deploy:prod
```

### 6.3 本地启动方式

```bash
# 方式1: 使用npm脚本
npm run start

# 方式2: 使用wrangler
npx wrangler pages dev dist --d1=genspark-financial-db --ip 0.0.0.0 --port 3000

# 方式3: 使用PM2
npm run build && pm2 start ecosystem.config.cjs
```

---

## 七、测试环境

### 7.1 当前测试环境

| 项目 | 状态 | 说明 |
|------|------|------|
| **访问地址** | https://3000-ipuvjhjux7iduhbnjzxnh-cbeee0f9.sandbox.novita.ai | 公网可访问 |
| **Web服务** | ✅ 运行中 | Wrangler Pages Dev |
| **D1数据库** | ✅ 已初始化 | 16个迁移已应用 |
| **股票数据** | ✅ 5472条 | 全量A股 (主板+创业板+科创板+北交所) |

### 7.2 测试命令

```bash
# 健康检查
curl https://3000-ipuvjhjux7iduhbnjzxnh-cbeee0f9.sandbox.novita.ai/api/health

# 搜索股票
curl "https://3000-ipuvjhjux7iduhbnjzxnh-cbeee0f9.sandbox.novita.ai/api/stock/search?q=茅台"

# 热门股票
curl https://3000-ipuvjhjux7iduhbnjzxnh-cbeee0f9.sandbox.novita.ai/api/stock/hot

# 数据库状态
curl https://3000-ipuvjhjux7iduhbnjzxnh-cbeee0f9.sandbox.novita.ai/api/db/status
```

---

## 八、后续开发建议

### 8.1 待优化事项

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 高 | FTS5中文分词优化 | 提升搜索准确性 |
| 高 | 分析结果缓存策略 | 减少重复分析 |
| 中 | 更多股票数据导入 | 扩展覆盖范围 |
| 中 | 用户订阅等级功能 | 会员权益差异化 |
| 低 | 更多漫画风格支持 | 丰富输出形式 |
| 低 | 自定义IP角色上传 | 用户个性化 |

### 8.2 架构扩展点

1. **增强模块区块** - 已预留舆情分析、竞品追踪、政策解读Agent位置
2. **模型评估系统** - 已有model_evaluation相关表，可扩展A/B测试
3. **Agent Presets** - 支持用户自定义Prompt注入
4. **行业对比** - 可增加更多对比维度

### 8.3 技术债务

- `pinyin.ts` 重复键警告（非致命，可优化）
- `membership_plans` 需要初始化默认数据
- 部分旧代码文件可清理 (`.backup`, `.bak`)

---

## 九、技术文档索引

### 核心文档
- `README.md` - 项目主文档
- `FINSPARK_README.md` - 完整包说明
- `QUICKSTART.md` - 快速开始指南
- `DB_INIT_GUIDE.md` - 数据库初始化指南

### 技术文档 (docs/)
- `Agent_Prompt_Optimization_Report.md` - Agent Prompt优化报告
- `multi-agent-prompts-and-dataflow.md` - Multi-Agent提示词与数据流
- `preset_prompt_injection_plan.md` - Preset Prompt注入计划
- `MODEL_SELECTION_GUIDE.md` - 模型选择指南
- `PHASE2_3_DEVELOPMENT_PLAN.md` - 开发计划
- `PRODUCT_REVIEW.md` - 产品复盘

### 数据文档
- `Tushare_API字段详情.xlsx` - Tushare API字段说明
- `Tushare_5000积分接口权限.xlsx` - Tushare权限说明
- `Agent配置文档.xlsx` - Agent配置详解

---

## 十、联系与支持

### 技术资源
- **Hono框架**: https://hono.dev
- **Cloudflare Workers**: https://developers.cloudflare.com/workers
- **Cloudflare D1**: https://developers.cloudflare.com/d1
- **Tushare Pro**: https://tushare.pro
- **VectorEngine**: https://vectorengine.ai

### 项目信息
- **代码包时间**: 2026-01-16
- **最新提交**: 7bafa28
- **开发分支**: genspark_ai_developer

---

*本文档由AI自动生成，最后更新: 2026-01-16*
