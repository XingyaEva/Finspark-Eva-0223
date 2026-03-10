# Finspark 数据库初始化指南

> 版本: 3.0.0 | 更新日期: 2026-01-16
> 
> **重大更新**: 支持全量 A 股数据同步 (5400+ 只)

## 快速开始

### 首次初始化（全量A股，推荐）

```bash
# 1. 安装依赖
npm install

# 2. 完整初始化 + 全量 A 股同步（5400+ 只股票）⭐推荐
npm run db:init:sync

# 3. 启动服务
npm run start
```

### 快速初始化（仅种子数据）

```bash
# 仅使用种子数据（169 只热门股票），速度快
npm run db:init:full
```

### 数据规模对比

| 初始化方式 | 股票数量 | 同步时间 | 适用场景 |
|-----------|---------|---------|---------|
| `db:init:full` | 169 只 | <10秒 | 快速测试/Demo |
| `db:init:sync` | 5400+ 只 | 60-90秒 | 生产环境/完整功能 |

### 股票市场分布 (全量同步后)

| 市场 | 数量 | 说明 |
|------|------|------|
| 主板 | ~3200 只 | 上交所/深交所主板 |
| 创业板 | ~1400 只 | 深交所创业板 |
| 科创板 | ~600 只 | 上交所科创板 |
| 北交所 | ~290 只 | 北京证券交易所 |
| **总计** | **5400+** | 全部 A 股上市公司 |

## 数据库命令一览

### 初始化命令

| 命令 | 说明 | 股票数量 |
|------|------|---------|
| `npm run db:init` | 自动检测状态并初始化 | - |
| `npm run db:init:full` | 快速初始化（仅种子数据） | 169 只 |
| `npm run db:init:sync` | 完整初始化 + 全量A股同步 ⭐ | 5400+ 只 |
| `npm run db:init:all` | 同上，别名 | 5400+ 只 |

### 迁移命令

| 命令 | 说明 |
|------|------|
| `npm run db:migrate:local` | 执行本地迁移（逐个文件） |
| `npm run db:migrate:all` | 执行合并迁移脚本（一次性） |
| `npm run db:migrate:prod` | 执行生产环境迁移 |

### 数据导入命令

| 命令 | 说明 |
|------|------|
| `npm run db:seed` | 导入基础种子数据（约200只） |
| `npm run db:seed:more` | 导入更多股票数据 |
| `npm run db:seed:all` | 导入所有种子数据 |

### 股票同步命令

| 命令 | 说明 | 数量 |
|------|------|------|
| `npm run sync:stocks:a` | 全量同步 A 股 ⭐推荐 | 5400+ 只 |
| `npm run sync:a-full` | 同上，别名 | 5400+ 只 |
| `npm run sync:stocks:hk` | 同步港股（需 Tushare 高级积分） | ~2500 只 |
| `npm run sync:stocks:all` | 同步 A股+港股 | ~7500+ 只 |
| `npm run sync:stocks:prod` | 生产环境全量同步 | 全部 |
| `npm run sync:dry-run` | 预览同步（不执行） | - |
| `npm run sync:stocks:prod` | 同步到生产环境 |
| `npm run sync:dry-run` | 预演模式（仅生成SQL不执行） |

### 状态查询命令

| 命令 | 说明 |
|------|------|
| `npm run db:status` | 查看股票数量 |
| `npm run db:tables` | 查看所有表 |
| `npm run db:console` | 打开数据库控制台 |

### 重置命令

| 命令 | 说明 |
|------|------|
| `npm run db:reset` | 重置数据库（本地） |
| `npm run db:reset:full` | 完整重置（使用合并迁移） |

## 数据表清单

### 核心表（4个）
- `stocks` - 股票基础信息
- `stocks_fts` - 全文搜索索引
- `users` - 用户账户
- `user_sessions` - 用户会话

### 分析报告（4个）
- `analysis_reports` - 分析报告
- `comic_reports` - 漫画报告
- `share_links` - 分享链接
- `share_access_logs` - 分享访问日志

### 财务数据（6个）
- `income_statements` - 利润表
- `balance_sheets` - 资产负债表
- `cash_flows` - 现金流量表
- `fina_indicators` - 财务指标
- `daily_quotes` - 日线行情
- `data_sync_logs` - 数据同步日志

### 用户功能（8个）
- `user_favorites` - 用户收藏
- `favorite_groups` - 收藏分组
- `saved_questions` - 保存的问题
- `user_preferences` - 用户偏好
- `user_preferences_history` - 偏好变更历史
- `user_activity_logs` - 活动日志
- `user_auth_bindings` - 第三方绑定
- `guest_sessions` - 访客会话
- `email_verification_codes` - 邮箱验证码

### 会员系统（4个）
- `membership_plans` - 会员方案
- `membership_orders` - 会员订单
- `membership_usage_logs` - 使用记录
- `feature_limits` - 功能权益

### 模型评估（5个）
- `model_configs` - 模型配置
- `model_evaluations` - 评估结果
- `model_comparison_tests` - 对比测试
- `model_statistics` - 统计汇总
- `user_model_preferences` - 用户偏好

### Agent 系统（2个）
- `user_agent_presets` - Agent 预设
- `user_agent_settings` - Agent 设置

## 常见问题

### Q: 迁移报错怎么办？

A: 尝试以下步骤：
```bash
# 1. 完整重置
npm run db:reset:full

# 2. 或者使用合并迁移
npm run db:migrate:all
```

### Q: 股票同步失败？

A: 检查网络连接和 Tushare API 权限：
```bash
# 预演模式测试
npm run sync:dry-run
```

### Q: 生产环境如何初始化？

A: 使用 `--prod` 参数：
```bash
node scripts/db-init.mjs --full --prod
```

### Q: 如何添加新的迁移？

A: 在 `migrations/` 目录创建新的 SQL 文件，命名格式：`XXXX_描述.sql`

## 文件说明

```
webapp/
├── migrations/           # 迁移文件目录
│   ├── 0001_stock_tables.sql
│   ├── 0002_user_features.sql
│   └── ...               # 共16个迁移文件
├── scripts/
│   ├── all_migrations.sql   # 合并的迁移脚本
│   ├── db-init.mjs          # 初始化脚本
│   └── sync_all_stocks.mjs  # 股票同步脚本
├── seed.sql              # 基础种子数据
└── seed_more_stocks.sql  # 更多股票数据
```

## 环境变量

确保 `.dev.vars` 文件包含以下配置：

```env
VECTORENGINE_API_KEY=your_api_key
TUSHARE_TOKEN=your_tushare_token
JWT_SECRET=your_jwt_secret
```

## 数据来源

- **A股数据**: Tushare Pro API（stock_basic）
- **港股数据**: Tushare Pro API（hk_basic）
- **热门标记**: 预定义的龙头股列表

---

如有问题，请查看脚本源码或联系开发团队。
