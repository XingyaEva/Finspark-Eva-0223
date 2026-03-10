# Finspark 用户体系开发方案（精简版）

> **版本**: v2.0 (精简版)  
> **更新日期**: 2025-01-10  
> **说明**: 已移除设备指纹和微信/支付宝登录相关内容

---

## 📊 当前项目状态总览

### ✅ 已完成功能

| 模块 | 功能 | 文件位置 | 状态 |
|------|------|----------|------|
| **数据库** | 用户表扩展 | `migrations/0010_user_system_v2.sql` | ✅ |
| | user_auth_bindings 表 | 同上 | ✅ |
| | user_favorites 表扩展 | 同上 | ✅ |
| | guest_sessions 表 | 同上 | ✅ |
| | membership_orders 表 | 同上 | ✅ |
| | user_activity_logs 表 | 同上 | ✅ |
| | user_preferences 表 | 同上 | ✅ |
| **后端服务** | 认证服务 (JWT) | `src/services/auth.ts` | ✅ |
| | 用户服务 | `src/services/user.ts` | ✅ |
| | 认证中间件 | `src/middleware/auth.ts` | ✅ |
| **API 路由** | 认证 API | `src/routes/auth.ts` | ✅ |
| | 用户 API | `src/routes/user.ts` | ✅ |
| **前端页面** | 首页登录组件 | `src/index.tsx` | ✅ |
| | 我的报告页面 | `src/index.tsx` | ✅ |
| | 我的收藏页面 | `src/index.tsx` | ✅ |
| | 账号设置页面 | `src/index.tsx` | ✅ |

### 🔄 进行中

- 集成测试与部署
- 回归测试与问题验证

### 📝 待优化/增强（阶段二、三目标）

| 功能 | 优先级 | 阶段 |
|------|--------|------|
| 收藏分组、排序、搜索 | 高 | 阶段二 |
| 历史记录分页、筛选、导出 | 高 | 阶段二 |
| 访客数据迁移增强 | 中 | 阶段二 |
| 前端组件库完善 | 中 | 阶段二 |
| 会员方案系统 | 高 | 阶段三 |
| 权限检查全面接入 | 高 | 阶段三 |
| PDF 水印系统 | 中 | 阶段三 |
| 功能锁定与升级引导 | 中 | 阶段三 |

---

## 🎯 阶段二：核心用户功能（精简版）

**目标**: 完善收藏、历史、访客转化功能，提供完整的用户数据管理体验  
**预估时长**: 10-12 小时（原 15-18 小时，移除指纹相关）

### 模块 2.1 访客会话系统（简化版）

**时长**: 2-3 小时

#### 功能需求
- ✅ 访客行为追踪（基于 session ID，非设备指纹）
- ✅ 访客分析报告关联
- ✅ 访客配额管理（3次免费分析）
- ✅ 访客召回机制

#### 技术实现

**简化方案**: 使用随机生成的 Session ID 代替设备指纹

```typescript
// src/utils/guestSession.ts（新建）
export function generateGuestSessionId(): string {
  // 使用 crypto.randomUUID() 生成唯一标识
  return crypto.randomUUID();
}

// 存储到 localStorage
export function getOrCreateGuestSession(): string {
  let sessionId = localStorage.getItem('guestSessionId');
  if (!sessionId) {
    sessionId = generateGuestSessionId();
    localStorage.setItem('guestSessionId', sessionId);
  }
  return sessionId;
}
```

**数据库调整** (可选迁移):
```sql
-- 将 fingerprint 字段改为 session_id（语义更清晰）
-- 现有数据兼容：fingerprint 字段保留，逻辑上当作 session_id 使用
-- 无需数据库变更，只需前端生成方式变化
```

#### API 端点
| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | `/api/user/guest/init` | 初始化访客会话 | ✅ 已有 |
| GET | `/api/auth/quota` | 查询剩余配额 | ✅ 已有 |
| POST | `/api/guest/track` | 追踪访客行为 | 🔲 待开发 |

#### 待开发任务
- [ ] 前端生成 Session ID 替换指纹生成逻辑
- [ ] 添加访客行为追踪 API
- [ ] 完善访客配额提示 UI

---

### 模块 2.2 收藏系统完善

**时长**: 3-4 小时

#### 功能需求

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 基础收藏/取消收藏 | 高 | ✅ 已完成 |
| 收藏列表分页 | 高 | ✅ 已完成 |
| 收藏分组管理 | 中 | 🔲 待开发 |
| 收藏排序（时间/拼音） | 中 | 🔲 待开发 |
| 收藏搜索 | 中 | 🔲 待开发 |
| 批量操作 | 低 | 🔲 待开发 |
| 收藏数量限制检查 | 高 | ✅ 已完成 |

#### 数据库变更

```sql
-- migrations/0011_favorite_groups.sql

-- 收藏分组表
CREATE TABLE IF NOT EXISTS favorite_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',  -- 分组颜色
  icon TEXT DEFAULT 'folder',     -- 分组图标
  sort_order INTEGER DEFAULT 0,   -- 排序顺序
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fav_groups_user ON favorite_groups(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_groups_name ON favorite_groups(user_id, name);

-- 扩展 user_favorites 表（如果字段不存在）
-- 注：group_id 和 sort_order 已在 0010 中添加，如未添加则执行以下
-- ALTER TABLE user_favorites ADD COLUMN group_id INTEGER REFERENCES favorite_groups(id);
-- ALTER TABLE user_favorites ADD COLUMN sort_order INTEGER DEFAULT 0;
```

#### API 端点

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/api/user/favorites` | 获取收藏列表 | ✅ 已有 |
| POST | `/api/user/favorites` | 添加收藏 | ✅ 已有 |
| DELETE | `/api/user/favorites/:id` | 取消收藏 | ✅ 已有 |
| GET | `/api/user/favorites/check/:stockCode` | 检查收藏状态 | ✅ 已有 |
| GET | `/api/user/favorites/groups` | 获取分组列表 | 🔲 待开发 |
| POST | `/api/user/favorites/groups` | 创建分组 | 🔲 待开发 |
| PUT | `/api/user/favorites/groups/:id` | 更新分组 | 🔲 待开发 |
| DELETE | `/api/user/favorites/groups/:id` | 删除分组 | 🔲 待开发 |
| PUT | `/api/user/favorites/:id/move` | 移动到分组 | 🔲 待开发 |
| POST | `/api/user/favorites/batch` | 批量操作 | 🔲 待开发 |

#### 代码示例

```typescript
// src/routes/user.ts 扩展

// 获取收藏分组列表
user.get('/favorites/groups', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  if (!currentUser || !c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  const groups = await c.env.DB.prepare(`
    SELECT g.*, COUNT(f.id) as favorite_count
    FROM favorite_groups g
    LEFT JOIN user_favorites f ON f.group_id = g.id
    WHERE g.user_id = ?
    GROUP BY g.id
    ORDER BY g.sort_order ASC, g.created_at ASC
  `).bind(currentUser.id).all();
  
  return c.json({
    success: true,
    groups: groups.results || [],
  });
});

// 创建收藏分组
user.post('/favorites/groups', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  const body = await c.req.json<{ name: string; color?: string; icon?: string }>();
  
  if (!body.name || body.name.trim().length === 0) {
    return c.json({ success: false, error: '请输入分组名称' }, 400);
  }
  
  // 检查分组数量限制（最多20个）
  const count = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM favorite_groups WHERE user_id = ?'
  ).bind(currentUser.id).first<{ count: number }>();
  
  if (count && count.count >= 20) {
    return c.json({ success: false, error: '分组数量已达上限(20)' }, 400);
  }
  
  // 创建分组
  const result = await c.env.DB.prepare(`
    INSERT INTO favorite_groups (user_id, name, color, icon)
    VALUES (?, ?, ?, ?)
  `).bind(
    currentUser.id,
    body.name.trim(),
    body.color || '#3B82F6',
    body.icon || 'folder'
  ).run();
  
  const group = await c.env.DB.prepare(
    'SELECT * FROM favorite_groups WHERE id = ?'
  ).bind(result.meta.last_row_id).first();
  
  return c.json({ success: true, group });
});
```

---

### 模块 2.3 历史记录增强

**时长**: 3-4 小时

#### 功能需求

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 基础历史列表 | 高 | ✅ 已完成 |
| 分页加载 | 高 | ✅ 已完成 |
| 多维筛选（日期/类型/状态） | 中 | 🔲 待开发 |
| 搜索（公司名/代码） | 中 | 🔲 待开发 |
| 批量删除 | 中 | 🔲 待开发 |
| 导出功能（Excel/CSV） | 低 | 🔲 待开发 |
| 快速预览 | 低 | 🔲 待开发 |

#### API 端点

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/api/user/history` | 获取历史列表 | ✅ 已有（待增强） |
| DELETE | `/api/user/history/:id` | 删除单条 | ✅ 已有 |
| POST | `/api/user/history/batch-delete` | 批量删除 | 🔲 待开发 |
| GET | `/api/user/history/export` | 导出历史记录 | 🔲 待开发 |

#### 代码示例

```typescript
// src/services/user.ts 扩展 getAnalysisHistory

interface HistoryQueryOptions {
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
  startDate?: string;      // 新增：开始日期
  endDate?: string;        // 新增：结束日期
  reportType?: string;     // 新增：报告类型
  status?: string;         // 新增：状态筛选
  search?: string;         // 新增：搜索关键词
  sortBy?: 'created_at' | 'company_name' | 'health_score';  // 新增：排序字段
  sortOrder?: 'asc' | 'desc';  // 新增：排序方向
}

async getAnalysisHistory(userId: number, options?: HistoryQueryOptions): Promise<{
  history: AnalysisHistory[];
  total: number;
  filters: { reportTypes: string[]; statuses: string[] };
}> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE user_id = ?';
  const params: (number | string)[] = [userId];
  
  // 构建筛选条件
  if (!options?.includeDeleted) {
    whereClause += ' AND (is_deleted = 0 OR is_deleted IS NULL)';
  }
  
  if (options?.startDate) {
    whereClause += ' AND created_at >= ?';
    params.push(options.startDate);
  }
  
  if (options?.endDate) {
    whereClause += ' AND created_at <= ?';
    params.push(options.endDate + ' 23:59:59');
  }
  
  if (options?.reportType) {
    whereClause += ' AND report_type = ?';
    params.push(options.reportType);
  }
  
  if (options?.status) {
    whereClause += ' AND status = ?';
    params.push(options.status);
  }
  
  if (options?.search) {
    whereClause += ' AND (company_name LIKE ? OR company_code LIKE ?)';
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }
  
  // 排序
  const sortBy = options?.sortBy || 'created_at';
  const sortOrder = options?.sortOrder || 'desc';
  const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
  
  // 获取总数
  const countResult = await this.db.prepare(
    `SELECT COUNT(*) as count FROM analysis_reports ${whereClause}`
  ).bind(...params).first<{ count: number }>();
  
  // 获取可用的筛选选项
  const reportTypes = await this.db.prepare(
    `SELECT DISTINCT report_type FROM analysis_reports WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
  ).bind(userId).all<{ report_type: string }>();
  
  const statuses = await this.db.prepare(
    `SELECT DISTINCT status FROM analysis_reports WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
  ).bind(userId).all<{ status: string }>();
  
  // 获取列表
  params.push(limit, offset);
  const history = await this.db.prepare(`
    SELECT id, company_code, company_name, report_type, status,
           health_score, key_conclusions, comic_status, created_at
    FROM analysis_reports ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `).bind(...params).all<AnalysisHistory>();
  
  return {
    history: history.results || [],
    total: countResult?.count || 0,
    filters: {
      reportTypes: reportTypes.results?.map(r => r.report_type) || [],
      statuses: statuses.results?.map(s => s.status) || [],
    },
  };
}
```

---

### 模块 2.4 访客数据迁移

**时长**: 2-3 小时

#### 功能需求
- ✅ 注册/登录后自动关联访客数据
- 🔲 迁移历史报告到用户账户
- 🔲 显示迁移结果提示
- 🔲 防止重复迁移

#### 实现流程

```
访客使用系统 → 生成 Session ID → 产生分析报告（关联 guest_fingerprint）
                                       ↓
                               注册/登录
                                       ↓
              调用 migrateGuestToUser(sessionId, userId)
                                       ↓
              更新 analysis_reports.user_id（原 guest_fingerprint 匹配）
                                       ↓
              更新 guest_sessions.converted_to_user_id
                                       ↓
              前端显示迁移成功提示
```

#### 代码示例

```typescript
// src/services/user.ts 完善 migrateGuestToUser

async migrateGuestToUser(sessionId: string, userId: number): Promise<{
  success: boolean;
  migratedReports: number;
  message: string;
}> {
  try {
    // 检查是否已经迁移过
    const existingMigration = await this.db.prepare(
      'SELECT converted_at FROM guest_sessions WHERE fingerprint = ? AND converted_to_user_id = ?'
    ).bind(sessionId, userId).first();
    
    if (existingMigration?.converted_at) {
      return { success: true, migratedReports: 0, message: '数据已迁移' };
    }
    
    // 统计待迁移报告数量
    const countResult = await this.db.prepare(
      'SELECT COUNT(*) as count FROM analysis_reports WHERE guest_fingerprint = ? AND user_id IS NULL'
    ).bind(sessionId).first<{ count: number }>();
    
    const reportCount = countResult?.count || 0;
    
    // 迁移报告
    if (reportCount > 0) {
      await this.db.prepare(`
        UPDATE analysis_reports SET user_id = ?
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(userId, sessionId).run();
    }
    
    // 更新访客会话状态
    await this.db.prepare(`
      UPDATE guest_sessions SET 
        converted_to_user_id = ?,
        converted_at = datetime("now")
      WHERE fingerprint = ?
    `).bind(userId, sessionId).run();
    
    // 记录活动日志
    await this.logActivity(userId, sessionId, 'guest_converted', null, {
      migratedReports: reportCount,
    });
    
    return {
      success: true,
      migratedReports: reportCount,
      message: reportCount > 0 
        ? `已成功迁移 ${reportCount} 份分析报告到您的账户`
        : '欢迎注册！开始您的智能财报分析之旅',
    };
  } catch (error) {
    console.error('Migrate guest error:', error);
    return { success: false, migratedReports: 0, message: '数据迁移失败' };
  }
}
```

---

### 模块 2.5 前端组件优化

**时长**: 2-3 小时

#### 通用组件清单

| 组件 | 优先级 | 说明 |
|------|--------|------|
| `Pagination` | 高 | 分页控件 |
| `FilterBar` | 高 | 筛选栏 |
| `SearchInput` | 高 | 搜索输入框 |
| `EmptyState` | 高 | 空状态提示 |
| `LoadingCard` | 中 | 加载状态卡片 |
| `Toast` | 高 | 消息提示 |
| `ConfirmDialog` | 中 | 确认对话框 |

#### 业务组件清单

| 组件 | 优先级 | 说明 |
|------|--------|------|
| `ReportCard` | 高 | 报告卡片 |
| `FavoriteCard` | 高 | 收藏卡片 |
| `QuotaIndicator` | 高 | 配额指示器 |
| `UpgradePrompt` | 高 | 升级提示 |
| `LoginPrompt` | 高 | 登录提示 |

---

## 🎯 阶段三：会员体系（精简版）

**目标**: 实现 Pro/Elite 权益区分，完整的会员管理体验  
**预估时长**: 10-12 小时（原 12-15 小时，移除支付集成）

### 模块 3.1 会员方案系统

**时长**: 3-4 小时

#### 会员等级对比

| 功能 | 访客 (Guest) | 免费用户 (Free) | Pro 会员 | Elite 会员 |
|------|--------------|-----------------|----------|------------|
| 每日分析次数 | 3 | 10 | 50 | 无限 |
| 完整报告 | ❌ | ✅ | ✅ | ✅ |
| AI漫画解读 | ❌ | ❌ | ✅ | ✅ |
| 风险评估 | ❌ | ❌ | ✅ | ✅ |
| 行业对比 | ❌ | ❌ | ✅ | ✅ |
| PDF导出 | ❌ | ✅ (有水印) | ✅ | ✅ |
| 收藏上限 | - | 100 | 500 | 1000 |
| 批量分析 | ❌ | ❌ | ❌ | ✅ |
| API访问 | ❌ | ❌ | ❌ | ✅ |

#### 数据库设计

```sql
-- migrations/0012_membership_plans.sql

-- 会员方案表
CREATE TABLE IF NOT EXISTS membership_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- 方案代码：pro_monthly, elite_yearly
  name TEXT NOT NULL,                  -- 显示名称
  tier TEXT NOT NULL,                  -- pro / elite
  duration_months INTEGER NOT NULL,    -- 时长（月）
  original_price_cents INTEGER NOT NULL,  -- 原价（分）
  current_price_cents INTEGER NOT NULL,   -- 现价（分）
  features TEXT NOT NULL,              -- 功能列表 JSON
  is_recommended INTEGER DEFAULT 0,    -- 是否推荐
  is_active INTEGER DEFAULT 1,         -- 是否上架
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 预置会员方案
INSERT INTO membership_plans (code, name, tier, duration_months, original_price_cents, current_price_cents, features, is_recommended, sort_order)
VALUES 
  ('pro_monthly', 'Pro月度会员', 'pro', 1, 4900, 2900, '["每日50次分析","AI漫画解读","专业风险评估","行业对比分析","PDF无水印导出","500个收藏"]', 0, 1),
  ('pro_yearly', 'Pro年度会员', 'pro', 12, 58800, 29900, '["每日50次分析","AI漫画解读","专业风险评估","行业对比分析","PDF无水印导出","500个收藏","年省近300元"]', 1, 2),
  ('elite_monthly', 'Elite月度会员', 'elite', 1, 9900, 6900, '["无限分析次数","全部Pro功能","批量分析","API访问权限","1000个收藏","优先客服支持"]', 0, 3),
  ('elite_yearly', 'Elite年度会员', 'elite', 12, 118800, 69900, '["无限分析次数","全部Pro功能","批量分析","API访问权限","1000个收藏","优先客服支持","年省近600元"]', 0, 4);

CREATE INDEX IF NOT EXISTS idx_plans_tier ON membership_plans(tier);
CREATE INDEX IF NOT EXISTS idx_plans_active ON membership_plans(is_active);
```

#### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/membership/plans` | 获取会员方案列表 |
| GET | `/api/membership/current` | 获取当前会员状态 |
| POST | `/api/membership/upgrade` | 升级会员（预留） |
| GET | `/api/membership/orders` | 获取订单历史 |

---

### 模块 3.2 权限检查全面接入

**时长**: 2-3 小时

#### 需要权限保护的接口

| 功能 | 需要等级 | 中间件 |
|------|----------|--------|
| 发起分析 | guest+ | `requireAnalysisQuota()` |
| 生成漫画 | pro+ | `requireFeature('ai_comic')` |
| 风险评估 | pro+ | `requireFeature('risk_assessment')` |
| 行业对比 | pro+ | `requireFeature('industry_comparison')` |
| PDF导出 | free+ | `requireFeature('pdf_export')` |
| 批量分析 | elite | `requireFeature('batch_analysis')` |
| API访问 | elite | `requireFeature('api_access')` |

#### 代码示例

```typescript
// 在 reports.ts 中应用权限中间件

// 生成AI漫画
reports.post('/:id/comic', 
  optionalAuth(),
  requireFeature('ai_comic'),  // 添加功能权限检查
  async (c) => {
    // ... 原有逻辑
  }
);

// 风险评估
reports.post('/:id/risk-assessment',
  optionalAuth(),
  requireFeature('risk_assessment'),
  async (c) => {
    // ... 原有逻辑
  }
);
```

---

### 模块 3.3 前端会员中心页

**时长**: 3-4 小时

#### 页面结构

```
/membership
├── 当前会员状态卡片
│   ├── 会员等级徽章
│   ├── 到期时间（如有）
│   └── 续费/升级按钮
├── 方案对比表格
│   ├── 功能对比
│   └── 价格信息
├── 订单历史
│   └── 历史订单列表
└── 常见问题
    └── FAQ 手风琴
```

#### 关键交互

1. **方案切换**：月付/年付切换时显示价格差异
2. **升级提示**：点击升级按钮显示确认弹窗
3. **到期提醒**：会员即将到期时显示续费提示

---

### 模块 3.4 PDF 水印系统

**时长**: 2-3 小时

#### 水印规则

| 用户类型 | 水印显示 |
|----------|----------|
| 访客 | 不允许导出 |
| Free | 显示水印 + 升级提示 |
| Pro | 无水印 |
| Elite | 无水印 |

#### 实现方案

```typescript
// src/services/pdf.ts 扩展

interface PDFGenerateOptions {
  // ... 现有选项
  addWatermark?: boolean;
  watermarkText?: string;
}

function addWatermarkToPDF(pdf: PDFDocument, text: string) {
  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  
  for (const page of pages) {
    const { width, height } = page.getSize();
    
    // 对角线水印
    page.drawText(text, {
      x: width / 2 - 100,
      y: height / 2,
      size: 40,
      font,
      color: rgb(0.9, 0.9, 0.9),
      opacity: 0.3,
      rotate: degrees(-45),
    });
  }
}

// 导出时根据用户等级决定是否添加水印
async function exportPDF(reportId: number, user: User | null): Promise<Buffer> {
  const tier = user?.membership_tier || 'guest';
  const needWatermark = !['pro', 'elite'].includes(tier);
  
  // ... 生成 PDF
  
  if (needWatermark) {
    addWatermarkToPDF(pdf, 'Finspark 免费版 - 升级Pro移除水印');
  }
  
  return pdf.save();
}
```

---

### 模块 3.5 功能锁定与升级引导

**时长**: 2-3 小时

#### 锁定样式设计

```css
/* 功能锁定样式 */
.feature-locked {
  position: relative;
  pointer-events: none;
  opacity: 0.6;
}

.feature-locked::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0,0,0,0.1), transparent);
  border-radius: inherit;
}

.feature-lock-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  color: #666;
}

/* 升级引导按钮 */
.upgrade-btn {
  background: linear-gradient(135deg, #F59E0B, #D97706);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;
}

.upgrade-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}
```

#### 升级引导弹窗

```typescript
// 升级引导弹窗组件
function showUpgradePrompt(feature: string, currentTier: string) {
  const messages: Record<string, { title: string; description: string }> = {
    ai_comic: {
      title: 'AI漫画解读',
      description: '升级Pro会员，解锁AI漫画解读功能，让财报分析更有趣！'
    },
    risk_assessment: {
      title: '专业风险评估',
      description: '升级Pro会员，获取专业的风险评估报告，做出更明智的投资决策。'
    },
    batch_analysis: {
      title: '批量分析',
      description: '升级Elite会员，一键分析多家公司，大幅提升分析效率。'
    }
  };
  
  const message = messages[feature] || { title: '高级功能', description: '升级会员解锁更多功能' };
  
  // 显示弹窗
  showModal({
    title: `解锁${message.title}`,
    content: message.description,
    confirmText: '查看会员方案',
    cancelText: '稍后再说',
    onConfirm: () => {
      window.location.href = '/membership';
    }
  });
}
```

---

## 📅 开发排期总览

### 阶段二（10-12小时）

| 天数 | 模块 | 预估时长 | 交付物 |
|------|------|----------|--------|
| Day 1 | 2.1 访客会话系统（简化） | 2-3h | Session ID 生成、追踪API |
| Day 1-2 | 2.2 收藏系统完善 | 3-4h | 分组、排序、批量API |
| Day 2-3 | 2.3 历史记录增强 | 3-4h | 筛选、搜索、批量删除API |
| Day 3 | 2.4 访客数据迁移 | 2-3h | 迁移逻辑、前端提示 |

### 阶段三（10-12小时）

| 天数 | 模块 | 预估时长 | 交付物 |
|------|------|----------|--------|
| Day 4 | 3.1 会员方案系统 | 3-4h | 数据库、方案API |
| Day 4-5 | 3.2 权限检查全面接入 | 2-3h | 中间件集成 |
| Day 5-6 | 3.3 前端会员中心页 | 3-4h | 会员页面 |
| Day 6 | 3.4 PDF水印系统 | 2-3h | 水印逻辑 |
| Day 6-7 | 3.5 功能锁定与升级引导 | 2-3h | 锁定UI、引导弹窗 |

---

## 🚀 后续优化方向（暂缓）

以下功能已从当前方案中移除，作为后续优化方向：

1. **设备指纹系统** - 用于更精准的访客识别
2. **微信登录** - 一键微信授权登录
3. **支付宝登录** - 一键支付宝授权登录
4. **支付集成** - 微信支付、支付宝支付接入
5. **邮箱验证** - 邮箱验证码发送与校验
6. **手机号登录** - 短信验证码登录

---

## 📝 技术风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| Session ID 被清除 | 访客数据丢失 | 提示用户注册保留数据 |
| 权限检查遗漏 | 功能越权使用 | 使用统一中间件、代码审查 |
| PDF水印性能 | 导出速度慢 | 异步生成、缓存机制 |
| 会员过期判断 | 时区问题 | 统一使用UTC时间 |

---

## ✅ 验收清单

### 阶段二验收

- [ ] 访客可获得3次免费分析机会
- [ ] 注册/登录后访客数据自动迁移
- [ ] 收藏支持分组管理
- [ ] 历史记录支持筛选和搜索
- [ ] 配额用尽时显示升级提示

### 阶段三验收

- [ ] 会员方案页面正确显示价格
- [ ] 各功能权限检查正常工作
- [ ] Free用户导出PDF有水印
- [ ] Pro/Elite用户导出PDF无水印
- [ ] 功能锁定UI正确显示
- [ ] 升级引导弹窗可正常触发

---

*文档版本: v2.0*  
*最后更新: 2025-01-10*
