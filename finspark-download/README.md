# Genspark 财报分析系统

## 项目概览
- **名称**: Genspark Financial Analysis System
- **目标**: 基于多Agent协同架构的智能财报分析平台
- **特点**: 12大Agent并行/串行混合编排，深度解读企业财务健康状况及行业竞争地位

## 当前测试环境

### 访问地址
- **测试环境URL**: https://3000-ibkkiwxzgdsok7jesa2f2-5634da27.sandbox.novita.ai
- **健康检查**: https://3000-ibkkiwxzgdsok7jesa2f2-5634da27.sandbox.novita.ai/api/health

### 环境状态
| 组件 | 状态 | 说明 |
|------|------|------|
| Web服务 | ✅ 运行中 | PM2守护进程 (端口3000) |
| D1数据库 | ✅ 已初始化 | 169家A股公司数据 |
| 数据迁移 | ✅ 完成 | 4个迁移文件已应用 |
| 初始数据 | ✅ 已导入 | 169条股票记录 |

### 测试命令
```bash
# 检查服务健康状态
curl https://3000-ibkkiwxzgdsok7jesa2f2-5634da27.sandbox.novita.ai/api/health

# 获取热门股票
curl https://3000-ibkkiwxzgdsok7jesa2f2-5634da27.sandbox.novita.ai/api/stock/hot

# 检查数据库状态
curl https://3000-ibkkiwxzgdsok7jesa2f2-5634da27.sandbox.novita.ai/api/db/status
```

## 系统架构

### Multi-Agent 协同架构 (12个Agent)
```
Financial Analysis Orchestrator
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

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | 原生JS + TailwindCSS + Chart.js |
| 后端 | Hono + TypeScript |
| 部署 | Cloudflare Pages |
| 数据库 | Cloudflare D1 (SQLite) |
| 缓存 | Cloudflare KV |
| AI模型 | VectorEngine API (GPT-5.1) |
| 股票数据 | Tushare Pro API |

## 已完成功能

### 用户认证系统 (JWT)
- [x] 用户注册（邮箱/密码/用户名）
- [x] 用户登录（JWT Token 签发）
- [x] Token 刷新机制
- [x] 用户信息获取与更新
- [x] 登出（单设备/所有设备）
- [x] 密码修改

### D1 数据库集成
- [x] 股票基础信息表 (`stocks`)
- [x] 全文搜索索引 (`stocks_fts` - FTS5)
- [x] 用户表 (`users`)
- [x] 分析报告表 (`analysis_reports`)
- [x] 用户收藏表 (`user_favorites`)
- [x] 漫画数据表 (`comic_reports`)
- [x] 用户会话表 (`user_sessions`)

### 股票搜索
- [x] 本地优先搜索（D1 LIKE 模糊匹配）
- [x] Tushare API 降级策略
- [x] 自动缓存新发现股票到本地
- [x] 支持中文名、代码、行业搜索
- [x] 预置 169 家 A 股上市公司

### 用户收藏功能
- [x] 添加/移除收藏
- [x] 收藏列表查询
- [x] 收藏备注功能
- [x] 收藏状态检查

### PDF 报告导出
- [x] 可打印 HTML 报告生成
- [x] 黑金风格专业排版
- [x] 投资建议摘要
- [x] 盈利能力分析
- [x] 风险评估详情
- [x] 关键要点总结

### AI 漫画生成
- [x] 漫画脚本生成（Gemini 2.5 Flash）
- [x] 漫画面板图片生成（Gemini 3 Pro Image Preview）
- [x] 文字版漫画备选方案
- [x] 多种漫画风格（modern/classic/minimal）
- [x] 漫画数据持久化
- [x] **IP角色系统** - 支持自定义IP角色演绎财报
- [x] **多角色集** - 哪吒电影角色(6个) + 商业经典角色(4个)
- [x] **长图文格式** - 支持微信公众号长图文输出
- [x] **数据库记录IP角色** - 漫画报告关联使用的角色信息

### 行业对比分析 (新增)
- [x] 同行业公司列表API (`/api/stock/by-industry/:industry`)
- [x] 同行业对标公司TOP5 (`/api/stock/industry-peers/:code`)
- [x] 同行业财务数据批量同步 (`/api/stock/sync-industry-peers/:code`)
- [x] 行业对比数据API（指标排名、行业均值、评价）
- [x] AI深度行业对比分析 (`/api/analyze/industry-comparison/:code`)
- [x] 行业对比Agent提示词 (`INDUSTRY_COMPARISON`)
- [x] 前端行业对比面板（表格对比、雷达图、对标公司列表）
- [x] ECharts雷达图可视化

### 增强模块 (UI层扩展)
- [x] **增强模块区块** - 在主Agent进度卡片下方独立显示
- [x] **行业对比Agent进度卡片** - 实时显示行业对比分析进度（待执行/分析中/已完成/失败）
- [x] **进度条动画** - 渐进式进度更新（10% → 30% → 60% → 80% → 90% → 100%）
- [x] **预留扩展位** - 舆情分析、竞品追踪、政策解读Agent（敬请期待）
- [x] **独立于主编排** - 不影响核心分析流程，纯UI层增强

### 前端页面
- [x] 首页（黑金风格，股票搜索，热门企业）
- [x] 分析页面（12大Agent进度显示，分析结果展示）
- [x] **增强模块区块**（行业对比Agent进度卡片 + 未来扩展预留）
- [x] 行业对比面板（新增，在估值评估之后）
- [x] 登录/注册弹窗
- [x] 用户状态管理
- [x] 我的报告页面
- [x] 我的收藏页面
- [x] PDF 导出按钮
- [x] AI 漫画生成按钮

## API 接口

### 股票相关
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/stock/search?q=` | GET | 搜索股票 |
| `/api/stock/basic/:code` | GET | 股票基本信息 |
| `/api/stock/daily/:code` | GET | 日线数据 |
| `/api/stock/financial/:code/:type` | GET | 财务数据 |
| `/api/stock/hot` | GET | 热门股票推荐 |
| `/api/stock/industries` | GET | 获取所有行业列表 |
| `/api/stock/by-industry/:industry` | GET | 按行业获取股票 |
| `/api/stock/industry-peers/:code` | GET | 获取同行业对标公司(TOP5) |
| `/api/stock/sync-industry-peers/:code` | POST | 同步同行业公司财务数据 |
| `/api/stock/industry-comparison/:code` | GET | 获取行业对比分析数据 |

### 分析相关
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/analyze/start` | POST | 开始分析 |
| `/api/analyze/status/:id` | GET | 查询状态 |
| `/api/analyze/result/:id` | GET | 获取结果 |
| `/api/analyze/stream/:id` | GET | 流式进度(SSE) |
| `/api/analyze/industry-comparison/:code` | GET | AI深度行业对比分析 |
| `/api/analyze/trend-interpretation/:code` | GET | 趋势解读分析 |

### 认证相关
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/refresh` | POST | 刷新令牌 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/auth/me` | PUT | 更新用户信息 |
| `/api/auth/change-password` | POST | 修改密码 |

### 收藏相关
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/favorites` | GET | 获取收藏列表 |
| `/api/favorites` | POST | 添加收藏 |
| `/api/favorites/check/:code` | GET | 检查收藏状态 |
| `/api/favorites/:code` | PUT | 更新收藏备注 |
| `/api/favorites/:code` | DELETE | 移除收藏 |

### 报告相关
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/reports/my` | GET | 获取我的报告列表 |
| `/api/reports/recent` | GET | 获取最近公开报告 |
| `/api/reports/:id` | GET | 获取报告详情 |
| `/api/reports/:id` | DELETE | 删除报告 |
| `/api/reports/:id/pdf` | GET | 导出 PDF |
| `/api/reports/:id/comic` | POST | 生成漫画（支持IP角色参数） |
| `/api/reports/:id/comic` | GET | 获取漫画 |
| `/api/reports/:id/comic-text` | POST | 生成文字漫画 |

### IP角色系统
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/characters/sets` | GET | 获取所有角色集列表 |
| `/api/characters/default` | GET | 获取默认角色（哪吒） |
| `/api/characters/recommend` | GET | 根据行业推荐角色 |
| `/api/characters/:setId/:characterId` | GET | 获取指定角色详情 |

### 系统相关
| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 服务健康状态 |
| `/api/db/status` | GET | 数据库状态 |

## 数据库结构

### D1 表结构
| 表名 | 描述 |
|------|------|
| `stocks` | 股票基础信息（169家预置） |
| `stocks_fts` | 全文搜索索引(FTS5) |
| `users` | 用户数据 |
| `analysis_reports` | 分析报告 |
| `user_favorites` | 用户收藏 |
| `comic_reports` | 漫画数据（含 IP 角色字段） |
| `user_sessions` | 用户会话/刷新令牌 |

### comic_reports 表字段
| 字段 | 类型 | 描述 |
|------|------|------|
| `character_set_id` | TEXT | IP角色集ID (nezha-movie/business-classic) |
| `main_character_id` | TEXT | 主角色ID (nezha/aobing/finance-butler等) |
| `output_format` | TEXT | 输出格式 (grid/vertical-scroll) |

## 本地开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 初始化数据库（首次）
npm run db:migrate:local
npm run db:seed

# 启动开发服务器
pm2 start ecosystem.config.cjs

# 查看日志
pm2 logs --nostream

# 重置数据库（清空重建）
npm run db:reset
```

## 环境变量

1. **复制环境变量模板**:
```bash
cp .dev.vars.example .dev.vars
```

2. **编辑 `.dev.vars` 文件并填入真实的API密钥**:
```
VECTORENGINE_API_KEY=your-api-key        # VectorEngine AI API
TUSHARE_TOKEN=your-tushare-token         # Tushare股票数据API
JWT_SECRET=your-jwt-secret-32chars+      # JWT加密密钥(至少32字符)
```

> 注意: `.dev.vars` 文件已在 `.gitignore` 中，不会被提交到 Git

## 部署

```bash
# 构建并部署到Cloudflare Pages
npm run deploy:prod

# 创建生产 D1 数据库
wrangler d1 create genspark-financial-db

# 应用迁移
npm run db:migrate:prod

# 设置生产环境密钥
wrangler pages secret put VECTORENGINE_API_KEY
wrangler pages secret put TUSHARE_TOKEN
wrangler pages secret put JWT_SECRET
```

## 项目结构

```
webapp/
├── src/
│   ├── agents/              # Agent系统
│   │   ├── orchestrator.ts  # 编排器
│   │   └── prompts.ts       # Agent提示词
│   ├── services/            # 服务层
│   │   ├── vectorengine.ts  # AI API
│   │   ├── tushare.ts       # Tushare API
│   │   ├── stockdb.ts       # D1 股票数据库
│   │   ├── auth.ts          # 用户认证
│   │   ├── favorites.ts     # 收藏服务
│   │   ├── reports.ts       # 报告服务
│   │   ├── comic.ts         # 漫画生成服务
│   │   ├── characters.ts    # IP角色服务
│   │   └── pdf.ts           # PDF 导出
│   ├── routes/              # API路由
│   │   ├── api.ts           # 主API路由
│   │   ├── auth.ts          # 认证路由
│   │   ├── favorites.ts     # 收藏路由
│   │   ├── reports.ts       # 报告路由
│   │   └── characters.ts    # IP角色路由
│   ├── middleware/          # 中间件
│   │   └── auth.ts          # 认证中间件
│   ├── types/               # TypeScript类型
│   │   └── index.ts
│   └── index.tsx            # 主入口+前端页面
├── migrations/              # D1 数据库迁移
│   ├── 0001_stock_tables.sql
│   ├── 0002_user_features.sql
│   ├── 0003_search_optimization.sql
│   └── 0004_comic_ip_character.sql
├── seed.sql                 # 股票初始数据
├── ecosystem.config.cjs     # PM2配置
├── wrangler.jsonc           # Cloudflare配置
└── package.json
```

## IP角色系统

### 支持的角色集

#### 哪吒电影角色 (nezha-movie)
| 角色ID | 名称 | 适合行业 |
|--------|------|----------|
| nezha | 小哪吒 | 科技/互联网/新能源/创业公司 |
| aobing | 敖丙 | 金融/银行/保险/证券 |
| taiyi | 太乙真人 | 食品饮料/消费/零售 |
| shen-gongbao | 申公豹 | 房地产/建筑/材料 |
| li-jing | 李靖 | 制造业/重工/工业 |
| yin-shi | 殷夫人 | 医疗/美容/健康 |

#### 商业经典角色 (business-classic)
| 角色ID | 名称 | 适合行业 |
|--------|------|----------|
| finance-butler | 金币先生 | 银行/金融/保险 |
| tech-robot | 科技小智 | 科技/AI/互联网 |
| wine-master | 酒仙翁 | 白酒/饮料/食品 |
| medicine-doc | 药丸博士 | 医疗/制药/生物 |

### 生成漫画API参数

```json
POST /api/reports/:id/comic
{
  "characterSetId": "nezha-movie",    // 角色集ID
  "mainCharacterId": "nezha",          // 主角色ID
  "outputFormat": "grid",              // 输出格式: grid(网格) / vertical-scroll(长图文)
  "forceRegenerate": false             // 是否强制重新生成
}
```

## 待优化事项
- [ ] 搜索性能优化（FTS5 中文分词）
- [ ] 更多股票数据批量导入
- [ ] 用户订阅等级功能
- [ ] 分析结果缓存策略优化
- [ ] 更多漫画风格支持
- [ ] 自定义IP角色上传功能

## 许可证

MIT License

---
*最后更新: 2025-12-21*
