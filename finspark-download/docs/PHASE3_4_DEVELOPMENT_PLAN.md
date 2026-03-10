# Finspark 阶段三、四开发计划

> **版本**: v2.1  
> **更新日期**: 2026-01-10  
> **前置条件**: 阶段二已完成 ✅  
> **排除功能**: 微信登录、支付宝登录、第三方支付集成

---

## 📊 功能现状排查

### 已完成功能（无需开发）

| 功能模块 | 后端API | 前端UI | 权限检查 | 文件位置 |
|----------|---------|--------|----------|----------|
| 智能问数助手(Text-to-SQL) | ✅ 7个API | ✅ 3个页面 | ✅ | `src/routes/assistant.tsx` (957行) |
| 行业对比分析 | ✅ 2个API | ✅ ECharts图表 | ❌ 待添加 | `src/routes/api.ts` |
| AI漫画解读 | ✅ 完成 | ✅ 完成 | 部分 | `src/services/comic.ts` |
| 风险评估详情 | ✅ 完成 | ✅ 完成 | 部分 | `src/agents/prompts.ts` |

### 智能问数助手现有实现（已完成 ~3246 行代码）

| 组件 | 文件 | 行数 | 功能 |
|------|------|------|------|
| 后端API | `src/routes/assistant.tsx` | 957 | 7个端点：chat、query、interpret、identify-stocks、kline、analyze-trend、smart-query |
| 全屏页面 | `src/pages/assistant.ts` | 731 | K线图表、多轮对话、SQL展示、CSV导出 |
| 悬浮球Widget | `src/pages/assistantWidget.ts` | 883 | 侧边栏问答入口 |
| 悬浮助手组件 | `src/components/floatingAssistant.ts` | 675 | 分析页悬浮球 |

**智能问数助手 API 端点**:
- `POST /api/assistant/chat` - 通用对话
- `POST /api/assistant/query` - Text-to-SQL 执行
- `POST /api/assistant/interpret` - 数据解读
- `POST /api/assistant/identify-stocks` - 股票识别
- `POST /api/assistant/kline` - K线数据
- `POST /api/assistant/analyze-trend` - 走势分析
- `POST /api/assistant/smart-query` - 智能问数

---

## 🎯 阶段三：会员体系完善（预估 7-9 小时）

> 已有权限系统基础，重点是前端展示和水印功能

### 3.1 会员方案系统

**时长**: 2-3 小时  
**优先级**: P0

#### 数据库变更

```sql
-- migrations/0012_membership_plans.sql
CREATE TABLE IF NOT EXISTS membership_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  original_price_cents INTEGER NOT NULL,
  current_price_cents INTEGER NOT NULL,
  features TEXT NOT NULL,
  is_recommended INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/membership/plans` | 获取方案列表 |
| GET | `/api/membership/current` | 当前会员状态 |
| GET | `/api/membership/orders` | 订单历史 |

#### 任务清单

- [ ] T3.1.1 创建迁移文件 `0012_membership_plans.sql`
- [ ] T3.1.2 创建会员服务 `src/services/membership.ts`
- [ ] T3.1.3 创建会员路由 `src/routes/membership.ts`

---

### 3.2 前端会员中心页

**时长**: 2-3 小时  
**优先级**: P0

#### 页面结构

```
/membership
├── 当前会员状态卡片（等级、到期时间、权益）
├── 方案对比表格（Free/Pro/Elite + "即将推出"标识）
├── 订单历史（空状态处理）
└── FAQ 手风琴组件
```

#### 任务清单

- [ ] T3.2.1 创建 `/membership` 页面路由
- [ ] T3.2.2 实现会员状态卡片
- [ ] T3.2.3 实现方案对比表格
- [ ] T3.2.4 添加 FAQ 组件

---

### 3.3 PDF 水印系统

**时长**: 2-3 小时  
**优先级**: P1

#### 水印规则

| 用户类型 | 水印 | 导出限制 |
|----------|------|----------|
| 访客 | 禁止导出 | - |
| Free | 显示水印 | 3次/日 |
| Pro/Elite | 无水印 | 50次/无限 |

#### 任务清单

- [ ] T3.3.1 PDF服务添加水印功能
- [ ] T3.3.2 实现对角线水印渲染
- [ ] T3.3.3 添加导出权限检查
- [ ] T3.3.4 前端水印预览提示

---

### 3.4 功能锁定与升级引导

**时长**: 1-2 小时  
**优先级**: P1

#### 任务清单

- [ ] T3.4.1 完善 requireFeature 中间件
- [ ] T3.4.2 实现功能锁定 UI 样式
- [ ] T3.4.3 创建通用升级引导弹窗

---

## 🚀 阶段四：产品功能扩展（预估 9-12 小时）

> AI对话问答已有完善实现（智能问数助手），可复用增强

### 4.1 智能问数助手增强（基于现有实现）

**时长**: 2-3 小时  
**优先级**: P1

#### 现有功能（已完成）
- ✅ 自然语言 → SQL 生成
- ✅ K线图表展示
- ✅ 走势分析解读
- ✅ 多轮对话支持
- ✅ CSV 数据导出
- ✅ 悬浮球入口
- ✅ 全屏问数页面

#### 待增强功能

| 增强项 | 描述 | 工作量 |
|--------|------|--------|
| 报告上下文绑定 | 在分析报告页追问时自动带入报告上下文 | 1h |
| 预置问题库 | 按行业/角色提供示例问题 | 0.5h |
| 问题收藏 | 收藏常用问题，一键复用 | 1h |
| 可视化增强 | 自动生成折线/柱状图 | 待定 |

#### 任务清单

- [ ] T4.1.1 报告页面集成问数入口（带上下文）
- [ ] T4.1.2 添加预置问题列表
- [ ] T4.1.3 实现问题收藏功能

---

### 4.2 历史报告对比功能

**时长**: 2-3 小时  
**优先级**: P1

#### 功能描述
- 同一公司不同财报期对比（季度/年度）
- 关键指标变化趋势可视化
- AI自动生成对比分析结论

#### API 设计

```
GET /api/reports/:id/compare?compareWith=:reportId
```

#### 任务清单

- [ ] T4.2.1 设计对比数据结构
- [ ] T4.2.2 创建报告对比 API
- [ ] T4.2.3 实现对比可视化图表
- [ ] T4.2.4 添加 AI 对比分析

---

### 4.3 行业对比分析权限检查

**时长**: 0.5-1 小时  
**优先级**: P1

#### 现状说明
行业对比分析的**后端API和前端UI已100%完成**，仅需添加权限检查：
- 后端: `GET /api/stock/industry-comparison/:code`
- 后端: `GET /api/analyze/industry-comparison/:code`
- 前端: ECharts雷达图、柱状图、对标公司卡片

#### 任务清单

| 任务 | 工作内容 | 时长 |
|------|----------|------|
| T4.3.1 | 后端API添加中间件 `optionalAuth()` + `requireFeature('industry_comparison')` | 15min |
| T4.3.2 | 前端处理403响应，显示升级弹窗 | 20min |
| T4.3.3 | 测试验证（Guest/Free/Pro体验） | 15min |

**代码变更**:
```typescript
// src/routes/api.ts - 添加2行中间件
api.get('/stock/industry-comparison/:code', optionalAuth(), requireFeature('industry_comparison'), async (c) => {...});
api.get('/analyze/industry-comparison/:code', optionalAuth(), requireFeature('industry_comparison'), async (c) => {...});
```

---

### 4.4 PDF 报告优化

**时长**: 2-3 小时  
**优先级**: P1

#### 功能描述
- 专业排版设计
- 封面、目录生成
- 图表高清导出

#### 任务清单

- [ ] T4.4.1 设计 PDF 报告模板
- [ ] T4.4.2 添加封面和目录
- [ ] T4.4.3 优化图表清晰度

---

### 4.5 分享功能

**时长**: 1-2 小时  
**优先级**: P2

#### 功能描述
- 生成分享链接
- Open Graph 预览卡片
- 分享统计

#### 任务清单

- [ ] T4.5.1 创建分享链接 API
- [ ] T4.5.2 实现分享页面
- [ ] T4.5.3 添加 OG 元标签

---

### 4.6 用户偏好设置

**时长**: 1-2 小时  
**优先级**: P2

#### 任务清单

- [ ] T4.6.1 扩展偏好设置表
- [ ] T4.6.2 创建偏好 API
- [ ] T4.6.3 账号页面增加设置

---

## 📅 综合开发排期

### 阶段三排期（约 3-4 天）

| 天数 | 任务 | 时长 | 优先级 |
|------|------|------|--------|
| Day 1 | T3.1.x 会员方案系统（数据库+API） | 2-3h | P0 |
| Day 2 | T3.2.x 前端会员中心页 | 2-3h | P0 |
| Day 3 | T3.3.x PDF 水印系统 | 2-3h | P1 |
| Day 4 | T3.4.x 功能锁定与升级引导 | 1-2h | P1 |

### 阶段四排期（约 5 天）

| 天数 | 任务 | 时长 | 优先级 |
|------|------|------|--------|
| Day 5 | T4.1.x 智能问数助手增强 | 2-3h | P1 |
| Day 6 | T4.2.x 历史报告对比 | 2-3h | P1 |
| Day 7 上午 | **T4.3.x 行业对比分析权限检查** | 0.5-1h | P1 |
| Day 7 下午 | T4.4.x PDF 报告优化 | 2-3h | P1 |
| Day 8 | T4.5.x 分享功能 | 1-2h | P2 |
| Day 8 | T4.6.x 用户偏好设置 | 1-2h | P2 |

---

## ⏱️ 总工时估算

| 阶段 | 工时 | 工作日（按3h/天） |
|------|------|------------------|
| 阶段三 | 7-9h | 3-4天 |
| 阶段四 | 9-12h | 4-5天 |
| **合计** | **16-21h** | **7-9天** |

> 注：原计划阶段四 AI对话问答 4-5h 已大幅缩减，因智能问数助手已实现核心功能

---

## 🔮 后续功能（暂缓/远期）

| 功能 | 原因 | 备选时间 |
|------|------|----------|
| 微信/支付宝登录 | 需要企业资质 | 待定 |
| 支付集成 | 需要完整资质流程 | 待定 |
| 港股/美股支持 | 数据源成本高 | 3-6月后 |
| API 开放平台 | 需要鉴权和限流 | 6月后 |
| RAG 财报原文 | 技术复杂度高 | 6月后 |

---

## ✅ 验收清单

### 阶段三验收

- [ ] **T3.1** 会员方案页面显示 Free/Pro/Elite 对比
- [ ] **T3.2** 当前会员状态准确显示
- [ ] **T3.3** Free 用户 PDF 有水印，Pro/Elite 无水印
- [ ] **T3.4** 功能锁定 UI 和升级弹窗正常工作

### 阶段四验收

- [ ] **T4.1** 分析页问数入口可带入报告上下文
- [ ] **T4.2** 历史报告对比功能正常
- [ ] **T4.3** 行业对比分析对 Free 用户显示升级提示
- [ ] **T4.4** PDF 报告有封面和目录
- [ ] **T4.5** 分享链接可正常访问
- [ ] **T4.6** 用户偏好设置可保存

---

## 📋 任务总览表

| 编号 | 任务名称 | 时长 | 优先级 | 阶段 |
|------|----------|------|--------|------|
| T3.1 | 会员方案系统 | 2-3h | P0 | 阶段三 |
| T3.2 | 前端会员中心页 | 2-3h | P0 | 阶段三 |
| T3.3 | PDF 水印系统 | 2-3h | P1 | 阶段三 |
| T3.4 | 功能锁定与升级引导 | 1-2h | P1 | 阶段三 |
| T4.1 | 智能问数助手增强 | 2-3h | P1 | 阶段四 |
| T4.2 | 历史报告对比 | 2-3h | P1 | 阶段四 |
| T4.3 | 行业对比权限检查 | 0.5-1h | P1 | 阶段四 |
| T4.4 | PDF 报告优化 | 2-3h | P1 | 阶段四 |
| T4.5 | 分享功能 | 1-2h | P2 | 阶段四 |
| T4.6 | 用户偏好设置 | 1-2h | P2 | 阶段四 |

---

*文档版本: v2.1*  
*最后更新: 2026-01-10*
