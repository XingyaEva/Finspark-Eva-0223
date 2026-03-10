# 快速开始指南

## 🚀 测试环境已就绪

### 访问地址
- **主页**: https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai
- **API文档**: 见下方接口列表

---

## 📦 当前环境状态

| 组件 | 状态 | 详情 |
|------|------|------|
| Web服务 | ✅ 运行中 | PM2守护进程，端口3000 |
| Hono后端 | ✅ 就绪 | TypeScript + Vite编译 |
| D1数据库 | ✅ 已初始化 | 4个迁移文件已应用 |
| 股票数据 | ✅ 已导入 | 169家A股公司基础信息 |
| FTS5搜索 | ✅ 已启用 | 中文全文搜索索引 |

---

## 🔑 环境变量配置

### 当前缺失的环境变量
为了完整功能，需要配置以下API密钥：

```bash
# 创建 .dev.vars 文件
cp .dev.vars.example .dev.vars

# 编辑文件并填入真实密钥
vim .dev.vars
```

**必需的密钥**：
1. **VECTORENGINE_API_KEY** - AI分析功能（10大Agent）
2. **TUSHARE_TOKEN** - 实时股票数据获取
3. **JWT_SECRET** - 用户认证（至少32字符）

**获取方式**：
- VectorEngine: https://vectorengine.ai/
- Tushare: https://tushare.pro/register

---

## 🧪 功能测试

### 1. 健康检查
```bash
curl https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai/api/health
```

**预期返回**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-23T12:00:00.000Z",
  "database": "ready",
  "stockCount": 169
}
```

### 2. 搜索股票
```bash
# 搜索茅台
curl "https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai/api/stock/search?q=茅台"

# 搜索银行
curl "https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai/api/stock/search?q=银行"
```

### 3. 热门股票
```bash
curl https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai/api/stock/hot
```

### 4. 用户注册（测试认证系统）
```bash
curl -X POST https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456",
    "username": "测试用户"
  }'
```

### 5. 用户登录
```bash
curl -X POST https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
```

---

## 🎯 核心功能列表

### ✅ 已实现并可测试
1. **股票搜索系统**
   - 本地D1数据库优先
   - Tushare API降级策略
   - FTS5中文全文搜索
   - 支持代码/名称/行业搜索

2. **用户认证系统**
   - JWT令牌认证
   - 注册/登录/登出
   - Token刷新机制
   - 密码修改

3. **收藏功能**
   - 添加/移除收藏
   - 收藏列表查询
   - 收藏备注

4. **报告管理**
   - 报告列表查询
   - 报告详情获取
   - 报告删除

5. **IP角色系统**
   - 哪吒电影角色集（6个角色）
   - 商业经典角色集（4个角色）
   - 根据行业推荐角色

### ⚠️ 需要API密钥的功能
以下功能需要配置环境变量后才能使用：

1. **10大AI Agent财报分析**
   - 需要: `VECTORENGINE_API_KEY`
   - 接口: `POST /api/analyze/start`

2. **AI漫画生成**
   - 需要: `VECTORENGINE_API_KEY` (Gemini API)
   - 接口: `POST /api/reports/:id/comic`

3. **实时股票数据**
   - 需要: `TUSHARE_TOKEN`
   - 接口: `GET /api/stock/daily/:code`

---

## 🏗️ 项目架构

### Multi-Agent协同架构
```
Analysis Orchestrator (编排器)
│
├── Phase 1: 并行执行 (Promise.all)
│   ├── Profitability Agent (利润表分析)
│   ├── Balance Sheet Agent (资产负债表分析)
│   └── Cash Flow Agent (现金流量表分析)
│
├── Phase 2: 依赖执行
│   ├── Earnings Quality Agent (三表联动分析)
│   ├── Risk & Leverage Agent (风险评估)
│   └── Business Insight Agent (业务映射)
│
├── Phase 3: 可选执行
│   ├── Business Model Agent (商业模式分析)
│   └── Forecast Agent (业绩预测)
│
└── Final Phase: 汇总
    └── Final Investment Conclusion Agent (投资结论)
```

### 技术栈
- **前端**: 原生JS + TailwindCSS + ECharts
- **后端**: Hono + TypeScript
- **数据库**: Cloudflare D1 (SQLite)
- **缓存**: Cloudflare KV
- **AI**: VectorEngine API (GPT-5.1)
- **股票数据**: Tushare Pro API

---

## 📝 数据库结构

### 已创建的表
1. **stocks** - 股票基础信息（169条记录）
2. **stocks_fts** - FTS5全文搜索索引
3. **users** - 用户账户
4. **user_sessions** - 用户会话/刷新令牌
5. **analysis_reports** - 分析报告
6. **user_favorites** - 用户收藏
7. **comic_reports** - AI漫画数据

### 查询数据库
```bash
# 进入本地数据库控制台
cd /home/user/webapp && npm run db:console

# 查看股票数量
SELECT COUNT(*) FROM stocks;

# 查看所有表
SELECT name FROM sqlite_master WHERE type='table';

# 查看热门股票
SELECT code, name, industry FROM stocks WHERE is_hot = 1 LIMIT 10;
```

---

## 🔧 开发命令

### 服务管理
```bash
# 查看服务状态
pm2 list

# 查看日志
pm2 logs genspark-financial --nostream

# 重启服务（需要先清理端口）
fuser -k 3000/tcp 2>/dev/null || true
pm2 restart genspark-financial

# 停止服务
pm2 stop genspark-financial

# 删除服务
pm2 delete genspark-financial
```

### 数据库操作
```bash
# 重置数据库（清空+重新迁移+导入数据）
npm run db:reset

# 仅应用迁移
npm run db:migrate:local

# 仅导入数据
npm run db:seed

# 查看数据库状态
npm run db:status
```

### 构建与部署
```bash
# 重新构建
npm run build

# 完全重启（构建+清端口+启动）
npm run build && fuser -k 3000/tcp 2>/dev/null || true && pm2 restart genspark-financial
```

---

## 🎨 前端页面

访问以下页面测试UI：

1. **首页** - https://3000-impnztmdl9pncm6s5qgi2-0e616f0a.sandbox.novita.ai
   - 黑金风格设计
   - 股票搜索
   - 热门企业展示

2. **分析页面** - `/analysis.html?code=600519.SH`
   - 10大Agent进度显示
   - 实时分析状态
   - 结果可视化

3. **我的报告** - `/my-reports.html`
   - 历史报告列表
   - PDF导出
   - AI漫画生成

4. **我的收藏** - `/favorites.html`
   - 收藏的股票列表
   - 快速分析入口

---

## 📚 API接口文档

### 认证相关
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/refresh` | POST | 刷新令牌 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/auth/change-password` | POST | 修改密码 |

### 股票相关
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stock/search?q=keyword` | GET | 搜索股票 |
| `/api/stock/basic/:code` | GET | 股票基本信息 |
| `/api/stock/daily/:code` | GET | 日线数据 |
| `/api/stock/hot` | GET | 热门股票 |

### 分析相关（需要API密钥）
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/analyze/start` | POST | 开始分析 |
| `/api/analyze/status/:id` | GET | 查询状态 |
| `/api/analyze/result/:id` | GET | 获取结果 |
| `/api/analyze/stream/:id` | GET | SSE流式进度 |

### 报告相关
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/reports/my` | GET | 我的报告列表 |
| `/api/reports/:id` | GET | 报告详情 |
| `/api/reports/:id` | DELETE | 删除报告 |
| `/api/reports/:id/pdf` | GET | 导出PDF |
| `/api/reports/:id/comic` | POST | 生成AI漫画 |

### IP角色相关
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/characters/sets` | GET | 所有角色集 |
| `/api/characters/default` | GET | 默认角色 |
| `/api/characters/recommend?industry=xxx` | GET | 推荐角色 |

---

## 🐛 调试技巧

### 查看完整日志
```bash
pm2 logs genspark-financial
```

### 查看Wrangler详细输出
```bash
cd /home/user/webapp
npx wrangler pages dev dist --d1=genspark-financial-db --local --ip 0.0.0.0 --port 3000
```

### 测试数据库连接
```bash
cd /home/user/webapp
npm run db:console -- --command="SELECT COUNT(*) FROM stocks"
```

---

## 🎯 下一步建议

### 1. 配置API密钥
创建 `.dev.vars` 文件并填入真实密钥，解锁完整功能：
- 10大Agent财报分析
- AI漫画生成
- 实时股票数据

### 2. 测试完整分析流程
```bash
# 1. 注册用户
# 2. 搜索股票（如：茅台）
# 3. 开始分析
# 4. 查看分析进度
# 5. 查看最终报告
# 6. 生成AI漫画
# 7. 导出PDF
```

### 3. 数据库扩展
```bash
# 导入更多股票数据（可选）
cd /home/user/webapp
npm run db:console -- --file=./seed_more_stocks.sql
```

### 4. 前端定制
- 修改配色方案（黑金主题）
- 添加更多图表类型
- 优化移动端体验

---

## 📞 技术支持

如遇到问题，请检查：
1. PM2服务状态: `pm2 list`
2. 日志输出: `pm2 logs genspark-financial --nostream`
3. 数据库状态: `curl http://localhost:3000/api/db/status`
4. 环境变量: 确认 `.dev.vars` 文件存在且配置正确

---

*最后更新: 2025-12-23*
*测试环境: Sandbox (PM2 + Wrangler Local Dev)*
