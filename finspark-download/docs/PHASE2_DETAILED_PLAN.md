# 阶段二详细开发计划

> **版本**: v1.0  
> **预估总时长**: 10-12 小时  
> **目标**: 完善收藏、历史、访客转化功能

---

## 📊 开发任务总览

| 任务编号 | 模块 | 任务名称 | 预估时长 | 依赖 |
|---------|------|----------|----------|------|
| T2.1.1 | 访客系统 | 简化访客标识生成（Session ID） | 1h | - |
| T2.1.2 | 访客系统 | 访客行为追踪 API | 1h | T2.1.1 |
| T2.1.3 | 访客系统 | 前端配额显示优化 | 0.5h | T2.1.1 |
| T2.2.1 | 收藏系统 | 收藏分组数据库迁移 | 0.5h | - |
| T2.2.2 | 收藏系统 | 收藏分组 API 开发 | 1.5h | T2.2.1 |
| T2.2.3 | 收藏系统 | 收藏搜索与排序 API | 1h | - |
| T2.2.4 | 收藏系统 | 前端收藏页面增强 | 1.5h | T2.2.2, T2.2.3 |
| T2.3.1 | 历史记录 | 历史记录筛选 API 增强 | 1h | - |
| T2.3.2 | 历史记录 | 批量删除 API | 0.5h | - |
| T2.3.3 | 历史记录 | 前端历史页面增强 | 1.5h | T2.3.1, T2.3.2 |
| T2.4.1 | 访客迁移 | 迁移逻辑完善 | 1h | T2.1.1 |
| T2.4.2 | 访客迁移 | 前端迁移提示 | 0.5h | T2.4.1 |

---

## 🔧 任务详细说明

### T2.1.1 简化访客标识生成（Session ID）

**目标**: 将设备指纹替换为简单的 UUID，降低复杂度

**现状分析**:
```javascript
// 当前代码位置: src/index.tsx 第 273-294 行
async function generateFingerprint() {
    // 使用 canvas + 浏览器信息生成指纹
    // 复杂且不稳定（隐私模式下可能不一致）
}
```

**改造方案**:
```javascript
// 新代码：简单可靠的 Session ID
function generateSessionId() {
    // 使用 crypto.randomUUID() 生成
    // 比指纹更简单、更稳定
    return crypto.randomUUID();
}

function getOrCreateGuestSession() {
    let sessionId = localStorage.getItem('guestSessionId');
    if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem('guestSessionId', sessionId);
    }
    return sessionId;
}
```

**修改文件**:
- `src/index.tsx` - 替换 `generateFingerprint` 函数
- 保持 `guestFingerprint` 变量名（后端兼容）或同步改名

**验收标准**:
- [ ] 新用户访问时生成 UUID 格式的 Session ID
- [ ] Session ID 持久化存储在 localStorage
- [ ] 现有访客数据不受影响（后端 fingerprint 字段兼容）

---

### T2.1.2 访客行为追踪 API

**目标**: 追踪访客关键行为，为后续分析提供数据

**新增 API**:
```
POST /api/guest/track
```

**请求体**:
```json
{
  "sessionId": "uuid-string",
  "action": "view_report | search | start_analysis | view_comic",
  "target": "600519.SH",
  "metadata": { "source": "hot_stocks" }
}
```

**响应**:
```json
{
  "success": true,
  "analysisCount": 2,
  "remainingAnalysis": 1
}
```

**新增文件**:
```typescript
// src/routes/guest.ts（新建）
import { Hono } from 'hono';
import { createUserService } from '../services/user';
import type { Bindings } from '../types';

const guest = new Hono<{ Bindings: Bindings }>();

// 追踪访客行为
guest.post('/track', async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    action: string;
    target?: string;
    metadata?: Record<string, any>;
  }>();
  
  if (!body.sessionId || !body.action) {
    return c.json({ success: false, error: '参数不完整' }, 400);
  }
  
  if (!c.env.DB || !c.env.CACHE) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  const userService = createUserService(c.env.DB, c.env.CACHE);
  
  // 记录行为日志
  await userService.logActivity(
    null,  // 无 userId
    body.sessionId,
    body.action,
    body.target,
    body.metadata
  );
  
  // 获取当前配额
  const permissions = await userService.getUserPermissions(null, body.sessionId);
  
  return c.json({
    success: true,
    analysisCount: permissions.maxDailyAnalysis 
      ? (permissions.maxDailyAnalysis - (permissions.remainingAnalysis || 0))
      : 0,
    remainingAnalysis: permissions.remainingAnalysis,
  });
});

export default guest;
```

**修改文件**:
- `src/index.tsx` - 添加路由挂载 `app.route('/api/guest', guest)`

**验收标准**:
- [ ] API 可正常接收和存储访客行为
- [ ] 返回当前配额信息
- [ ] 日志记录到 `user_activity_logs` 表

---

### T2.1.3 前端配额显示优化

**目标**: 优化配额显示，增加用完提示

**修改内容**:

1. **配额进度条**:
```html
<!-- 在导航栏用户菜单中添加 -->
<div id="quotaBar" class="px-4 py-2 border-b border-gray-700">
  <div class="flex justify-between text-xs text-gray-400 mb-1">
    <span>今日分析</span>
    <span id="quotaText">0/3</span>
  </div>
  <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
    <div id="quotaProgress" class="h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all"></div>
  </div>
</div>
```

2. **配额用尽提示**:
```javascript
function showQuotaExhaustedPrompt() {
  const isGuest = !currentUser;
  const message = isGuest 
    ? '免费分析次数已用完，注册即可获得更多次数'
    : '今日分析次数已用完，升级会员获取更多';
  
  showModal({
    title: '分析次数不足',
    content: message,
    confirmText: isGuest ? '立即注册' : '查看会员',
    onConfirm: () => isGuest ? openRegisterModal() : (window.location.href = '/membership')
  });
}
```

**验收标准**:
- [ ] 配额进度条正确显示
- [ ] 配额用尽时弹出友好提示
- [ ] 提示区分访客和登录用户

---

### T2.2.1 收藏分组数据库迁移

**目标**: 创建收藏分组表

**迁移文件**:
```sql
-- migrations/0011_favorite_groups.sql

-- 收藏分组表
CREATE TABLE IF NOT EXISTS favorite_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fav_groups_user ON favorite_groups(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_groups_unique ON favorite_groups(user_id, name);

-- 为 user_favorites 添加分组关联字段（如果不存在）
-- 注意：SQLite 的 ALTER TABLE 不支持 IF NOT EXISTS，需要先检查
-- 这里假设字段不存在，实际执行时可能需要条件判断
ALTER TABLE user_favorites ADD COLUMN group_id INTEGER REFERENCES favorite_groups(id) ON DELETE SET NULL;
ALTER TABLE user_favorites ADD COLUMN sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_favorites_group ON user_favorites(group_id);
```

**执行命令**:
```bash
npx wrangler d1 execute genspark-financial-db --local --file=migrations/0011_favorite_groups.sql
```

**验收标准**:
- [ ] `favorite_groups` 表创建成功
- [ ] `user_favorites` 表新增 `group_id` 和 `sort_order` 字段
- [ ] 索引创建成功

---

### T2.2.2 收藏分组 API 开发

**目标**: 实现分组的增删改查

**新增 API**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/favorites/groups` | 获取分组列表 |
| POST | `/api/user/favorites/groups` | 创建分组 |
| PUT | `/api/user/favorites/groups/:id` | 更新分组 |
| DELETE | `/api/user/favorites/groups/:id` | 删除分组 |
| PUT | `/api/user/favorites/:id/group` | 移动收藏到分组 |

**代码实现**:
```typescript
// src/routes/user.ts 新增

// ==================== 收藏分组相关 ====================

// 获取分组列表
user.get('/favorites/groups', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  if (!currentUser || !c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  // 获取分组及每个分组的收藏数量
  const groups = await c.env.DB.prepare(`
    SELECT 
      g.*,
      COUNT(f.id) as favorite_count
    FROM favorite_groups g
    LEFT JOIN user_favorites f ON f.group_id = g.id
    WHERE g.user_id = ?
    GROUP BY g.id
    ORDER BY g.sort_order ASC, g.created_at ASC
  `).bind(currentUser.id).all();
  
  // 获取未分组的收藏数量
  const ungrouped = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM user_favorites 
    WHERE user_id = ? AND (group_id IS NULL OR group_id = 0)
  `).bind(currentUser.id).first<{ count: number }>();
  
  return c.json({
    success: true,
    groups: groups.results || [],
    ungroupedCount: ungrouped?.count || 0,
  });
});

// 创建分组
user.post('/favorites/groups', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  const body = await c.req.json<{
    name: string;
    color?: string;
    icon?: string;
  }>();
  
  if (!currentUser || !c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  if (!body.name || body.name.trim().length === 0) {
    return c.json({ success: false, error: '请输入分组名称' }, 400);
  }
  
  if (body.name.length > 20) {
    return c.json({ success: false, error: '分组名称不能超过20个字符' }, 400);
  }
  
  // 检查分组数量限制
  const count = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM favorite_groups WHERE user_id = ?'
  ).bind(currentUser.id).first<{ count: number }>();
  
  if (count && count.count >= 20) {
    return c.json({ success: false, error: '分组数量已达上限(20)' }, 400);
  }
  
  // 检查名称是否重复
  const existing = await c.env.DB.prepare(
    'SELECT id FROM favorite_groups WHERE user_id = ? AND name = ?'
  ).bind(currentUser.id, body.name.trim()).first();
  
  if (existing) {
    return c.json({ success: false, error: '分组名称已存在' }, 400);
  }
  
  // 获取最大排序号
  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as max_order FROM favorite_groups WHERE user_id = ?'
  ).bind(currentUser.id).first<{ max_order: number }>();
  
  const result = await c.env.DB.prepare(`
    INSERT INTO favorite_groups (user_id, name, color, icon, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    currentUser.id,
    body.name.trim(),
    body.color || '#3B82F6',
    body.icon || 'folder',
    (maxOrder?.max_order || 0) + 1
  ).run();
  
  const group = await c.env.DB.prepare(
    'SELECT * FROM favorite_groups WHERE id = ?'
  ).bind(result.meta.last_row_id).first();
  
  return c.json({ success: true, group });
});

// 更新分组
user.put('/favorites/groups/:id', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  const groupId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{
    name?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }>();
  
  if (!currentUser || !c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  // 验证分组所有权
  const group = await c.env.DB.prepare(
    'SELECT * FROM favorite_groups WHERE id = ? AND user_id = ?'
  ).bind(groupId, currentUser.id).first();
  
  if (!group) {
    return c.json({ success: false, error: '分组不存在' }, 404);
  }
  
  // 构建更新语句
  const updates: string[] = [];
  const values: (string | number)[] = [];
  
  if (body.name !== undefined) {
    if (body.name.trim().length === 0) {
      return c.json({ success: false, error: '分组名称不能为空' }, 400);
    }
    updates.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.color !== undefined) {
    updates.push('color = ?');
    values.push(body.color);
  }
  if (body.icon !== undefined) {
    updates.push('icon = ?');
    values.push(body.icon);
  }
  if (body.sort_order !== undefined) {
    updates.push('sort_order = ?');
    values.push(body.sort_order);
  }
  
  if (updates.length === 0) {
    return c.json({ success: true, group });
  }
  
  updates.push('updated_at = datetime("now")');
  values.push(groupId);
  
  await c.env.DB.prepare(
    `UPDATE favorite_groups SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  const updatedGroup = await c.env.DB.prepare(
    'SELECT * FROM favorite_groups WHERE id = ?'
  ).bind(groupId).first();
  
  return c.json({ success: true, group: updatedGroup });
});

// 删除分组
user.delete('/favorites/groups/:id', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  const groupId = parseInt(c.req.param('id'), 10);
  
  if (!currentUser || !c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  // 验证分组所有权
  const group = await c.env.DB.prepare(
    'SELECT * FROM favorite_groups WHERE id = ? AND user_id = ?'
  ).bind(groupId, currentUser.id).first();
  
  if (!group) {
    return c.json({ success: false, error: '分组不存在' }, 404);
  }
  
  // 将该分组的收藏移到未分组
  await c.env.DB.prepare(
    'UPDATE user_favorites SET group_id = NULL WHERE group_id = ?'
  ).bind(groupId).run();
  
  // 删除分组
  await c.env.DB.prepare(
    'DELETE FROM favorite_groups WHERE id = ?'
  ).bind(groupId).run();
  
  return c.json({ success: true });
});

// 移动收藏到分组
user.put('/favorites/:id/group', requireAuth(), async (c) => {
  const currentUser = c.get('user');
  const favoriteId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json<{ groupId: number | null }>();
  
  if (!currentUser || !c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  // 验证收藏所有权
  const favorite = await c.env.DB.prepare(
    'SELECT * FROM user_favorites WHERE id = ? AND user_id = ?'
  ).bind(favoriteId, currentUser.id).first();
  
  if (!favorite) {
    return c.json({ success: false, error: '收藏不存在' }, 404);
  }
  
  // 如果指定了分组，验证分组所有权
  if (body.groupId) {
    const group = await c.env.DB.prepare(
      'SELECT id FROM favorite_groups WHERE id = ? AND user_id = ?'
    ).bind(body.groupId, currentUser.id).first();
    
    if (!group) {
      return c.json({ success: false, error: '分组不存在' }, 404);
    }
  }
  
  await c.env.DB.prepare(
    'UPDATE user_favorites SET group_id = ? WHERE id = ?'
  ).bind(body.groupId, favoriteId).run();
  
  return c.json({ success: true });
});
```

**验收标准**:
- [ ] 分组 CRUD 全部正常工作
- [ ] 分组数量限制为 20 个
- [ ] 删除分组时收藏自动移到未分组
- [ ] 分组名称唯一性校验

---

### T2.2.3 收藏搜索与排序 API

**目标**: 支持收藏列表的搜索和多维排序

**修改 API**:
```
GET /api/user/favorites?search=贵州&sortBy=created_at&sortOrder=desc&groupId=1
```

**参数说明**:
| 参数 | 类型 | 说明 |
|------|------|------|
| search | string | 搜索关键词（股票名/代码） |
| sortBy | string | 排序字段：created_at, stock_name, last_viewed_at |
| sortOrder | string | 排序方向：asc, desc |
| groupId | number | 分组 ID（0 或空表示未分组） |
| type | string | 收藏类型：stock, report |

**代码修改**:
```typescript
// src/routes/user.ts - 修改 GET /favorites

user.get('/favorites', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    // 解析查询参数
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const type = c.req.query('type') as 'stock' | 'report' | undefined;
    const search = c.req.query('search');
    const sortBy = c.req.query('sortBy') || 'created_at';
    const sortOrder = c.req.query('sortOrder') || 'desc';
    const groupId = c.req.query('groupId');
    
    // 构建查询
    let whereClause = 'WHERE user_id = ?';
    const params: (number | string)[] = [currentUser.id];
    
    if (type) {
      whereClause += ' AND favorite_type = ?';
      params.push(type);
    }
    
    if (search) {
      whereClause += ' AND (stock_name LIKE ? OR stock_code LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    if (groupId !== undefined) {
      if (groupId === '0' || groupId === '') {
        whereClause += ' AND (group_id IS NULL OR group_id = 0)';
      } else {
        whereClause += ' AND group_id = ?';
        params.push(parseInt(groupId, 10));
      }
    }
    
    // 排序
    const allowedSortFields = ['created_at', 'stock_name', 'last_viewed_at', 'is_pinned'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY is_pinned DESC, ${sortField} ${order}`;
    
    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM user_favorites ${whereClause}`
    ).bind(...params).first<{ count: number }>();
    
    // 获取列表
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    
    const favorites = await c.env.DB.prepare(`
      SELECT f.*, g.name as group_name, g.color as group_color
      FROM user_favorites f
      LEFT JOIN favorite_groups g ON f.group_id = g.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).bind(...params).all();
    
    return c.json({
      success: true,
      favorites: favorites.results || [],
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (countResult?.count || 0) > page * limit,
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    return c.json({ success: false, error: '获取收藏失败' }, 500);
  }
});
```

**验收标准**:
- [ ] 搜索功能正常（股票名、代码）
- [ ] 排序功能正常（时间、名称）
- [ ] 分组筛选正常
- [ ] 置顶项始终在前

---

### T2.2.4 前端收藏页面增强

**目标**: 增加分组管理、搜索、排序 UI

**UI 结构**:
```
/favorites 页面
├── 顶部工具栏
│   ├── 搜索框
│   ├── 排序下拉框
│   └── 新建分组按钮
├── 左侧分组列表
│   ├── 全部收藏
│   ├── 未分组
│   └── 用户分组列表
└── 右侧收藏列表
    └── 收藏卡片（支持拖拽到分组）
```

**关键代码片段**:
```html
<!-- 分组侧边栏 -->
<div class="w-64 border-r border-gray-800 p-4">
  <h3 class="text-sm font-semibold text-gray-400 mb-3">收藏分组</h3>
  <div id="groupList" class="space-y-1">
    <div class="group-item active" data-group-id="">
      <i class="fas fa-star mr-2"></i>
      全部收藏
      <span class="text-gray-500 text-xs ml-auto" id="totalCount">0</span>
    </div>
    <div class="group-item" data-group-id="0">
      <i class="fas fa-folder mr-2"></i>
      未分组
      <span class="text-gray-500 text-xs ml-auto" id="ungroupedCount">0</span>
    </div>
    <!-- 动态分组列表 -->
  </div>
  <button onclick="showCreateGroupModal()" class="mt-4 w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-yellow-500 hover:text-yellow-500 transition-colors">
    <i class="fas fa-plus mr-2"></i>新建分组
  </button>
</div>

<!-- 搜索和排序工具栏 -->
<div class="flex items-center gap-4 mb-4">
  <div class="relative flex-1 max-w-md">
    <input type="text" id="favoriteSearch" placeholder="搜索股票名称或代码..."
           class="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white">
    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
  </div>
  <select id="sortSelect" class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
    <option value="created_at:desc">最近添加</option>
    <option value="created_at:asc">最早添加</option>
    <option value="stock_name:asc">名称 A-Z</option>
    <option value="stock_name:desc">名称 Z-A</option>
    <option value="last_viewed_at:desc">最近查看</option>
  </select>
</div>
```

**JavaScript 核心逻辑**:
```javascript
// 加载分组列表
async function loadGroups() {
  const response = await fetch('/api/user/favorites/groups', {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  const data = await response.json();
  
  if (data.success) {
    renderGroups(data.groups, data.ungroupedCount);
  }
}

// 加载收藏列表（带筛选）
async function loadFavorites(options = {}) {
  const params = new URLSearchParams({
    page: options.page || 1,
    limit: 20,
    ...(options.search && { search: options.search }),
    ...(options.groupId !== undefined && { groupId: options.groupId }),
    ...(options.sortBy && { sortBy: options.sortBy }),
    ...(options.sortOrder && { sortOrder: options.sortOrder }),
  });
  
  const response = await fetch(`/api/user/favorites?${params}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  const data = await response.json();
  
  if (data.success) {
    renderFavorites(data.favorites);
    updatePagination(data.total, data.page, data.limit);
  }
}

// 创建分组
async function createGroup(name, color) {
  const response = await fetch('/api/user/favorites/groups', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, color })
  });
  
  const data = await response.json();
  if (data.success) {
    showToast('分组创建成功');
    loadGroups();
  } else {
    showToast(data.error, 'error');
  }
}

// 移动收藏到分组
async function moveFavoriteToGroup(favoriteId, groupId) {
  const response = await fetch(`/api/user/favorites/${favoriteId}/group`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ groupId })
  });
  
  if (response.ok) {
    loadFavorites(currentFilters);
    loadGroups();
  }
}
```

**验收标准**:
- [ ] 分组列表正确显示
- [ ] 点击分组可筛选收藏
- [ ] 搜索实时生效
- [ ] 排序切换正常
- [ ] 创建/编辑/删除分组正常

---

### T2.3.1 历史记录筛选 API 增强

**目标**: 支持日期、类型、状态等多维筛选

**增强后 API**:
```
GET /api/user/history?startDate=2024-01-01&endDate=2024-12-31&reportType=annual&status=completed&search=茅台&sortBy=created_at&sortOrder=desc
```

**参数说明**:
| 参数 | 类型 | 说明 |
|------|------|------|
| startDate | string | 开始日期 (YYYY-MM-DD) |
| endDate | string | 结束日期 (YYYY-MM-DD) |
| reportType | string | 报告类型：annual, quarterly |
| status | string | 状态：completed, processing, failed |
| search | string | 搜索关键词 |
| sortBy | string | 排序字段 |
| sortOrder | string | 排序方向 |

**代码修改**:
```typescript
// src/routes/user.ts - 修改 GET /history

user.get('/history', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 解析查询参数
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const reportType = c.req.query('reportType');
    const status = c.req.query('status');
    const search = c.req.query('search');
    const sortBy = c.req.query('sortBy') || 'created_at';
    const sortOrder = c.req.query('sortOrder') || 'desc';
    
    // 构建查询
    let whereClause = 'WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)';
    const params: (number | string)[] = [currentUser.id];
    
    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate + ' 00:00:00');
    }
    
    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }
    
    if (reportType) {
      whereClause += ' AND report_type = ?';
      params.push(reportType);
    }
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (search) {
      whereClause += ' AND (company_name LIKE ? OR company_code LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    // 排序
    const allowedSortFields = ['created_at', 'company_name', 'health_score', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // 获取总数
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM analysis_reports ${whereClause}`
    ).bind(...params).first<{ count: number }>();
    
    // 获取可用的筛选选项
    const reportTypes = await c.env.DB.prepare(`
      SELECT DISTINCT report_type FROM analysis_reports 
      WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
    `).bind(currentUser.id).all<{ report_type: string }>();
    
    const statuses = await c.env.DB.prepare(`
      SELECT DISTINCT status FROM analysis_reports 
      WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
    `).bind(currentUser.id).all<{ status: string }>();
    
    // 获取列表
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    
    const history = await c.env.DB.prepare(`
      SELECT id, company_code, company_name, report_type, report_period,
             status, health_score, key_conclusions, comic_status, 
             view_count, created_at
      FROM analysis_reports ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `).bind(...params).all();
    
    return c.json({
      success: true,
      history: history.results || [],
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: (countResult?.count || 0) > page * limit,
      filters: {
        reportTypes: reportTypes.results?.map(r => r.report_type).filter(Boolean) || [],
        statuses: statuses.results?.map(s => s.status).filter(Boolean) || [],
      },
    });
  } catch (error) {
    console.error('Get history error:', error);
    return c.json({ success: false, error: '获取历史记录失败' }, 500);
  }
});
```

**验收标准**:
- [ ] 日期范围筛选正常
- [ ] 报告类型筛选正常
- [ ] 状态筛选正常
- [ ] 搜索功能正常
- [ ] 返回可用的筛选选项

---

### T2.3.2 批量删除 API

**目标**: 支持批量删除历史记录

**新增 API**:
```
POST /api/user/history/batch-delete
```

**请求体**:
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**代码实现**:
```typescript
// src/routes/user.ts 新增

// 批量删除历史记录
user.post('/history/batch-delete', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json<{ ids: number[] }>();
    
    if (!currentUser || !c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return c.json({ success: false, error: '请选择要删除的记录' }, 400);
    }
    
    if (body.ids.length > 100) {
      return c.json({ success: false, error: '单次最多删除100条记录' }, 400);
    }
    
    // 验证所有 ID 都属于当前用户
    const placeholders = body.ids.map(() => '?').join(',');
    const existing = await c.env.DB.prepare(`
      SELECT id FROM analysis_reports 
      WHERE id IN (${placeholders}) AND user_id = ?
    `).bind(...body.ids, currentUser.id).all<{ id: number }>();
    
    const validIds = existing.results?.map(r => r.id) || [];
    
    if (validIds.length === 0) {
      return c.json({ success: false, error: '没有可删除的记录' }, 400);
    }
    
    // 执行软删除
    const updatePlaceholders = validIds.map(() => '?').join(',');
    await c.env.DB.prepare(`
      UPDATE analysis_reports 
      SET is_deleted = 1, deleted_at = datetime("now")
      WHERE id IN (${updatePlaceholders})
    `).bind(...validIds).run();
    
    return c.json({
      success: true,
      deletedCount: validIds.length,
      message: `已删除 ${validIds.length} 条记录`,
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});
```

**验收标准**:
- [ ] 批量删除正常工作
- [ ] 只能删除自己的记录
- [ ] 单次最多 100 条限制
- [ ] 返回实际删除数量

---

### T2.3.3 前端历史页面增强

**目标**: 增加筛选、搜索、批量操作 UI

**UI 结构**:
```
/my-reports 页面
├── 筛选工具栏
│   ├── 日期范围选择器
│   ├── 报告类型下拉框
│   ├── 状态下拉框
│   ├── 搜索框
│   └── 排序下拉框
├── 批量操作栏（选中时显示）
│   ├── 已选 X 项
│   ├── 全选按钮
│   └── 批量删除按钮
└── 报告列表
    └── 报告卡片（带复选框）
```

**关键代码片段**:
```html
<!-- 筛选工具栏 -->
<div class="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-900/50 rounded-lg">
  <!-- 日期范围 -->
  <div class="flex items-center gap-2">
    <input type="date" id="startDate" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
    <span class="text-gray-500">至</span>
    <input type="date" id="endDate" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
  </div>
  
  <!-- 报告类型 -->
  <select id="reportTypeFilter" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
    <option value="">所有类型</option>
    <option value="annual">年报</option>
    <option value="quarterly">季报</option>
  </select>
  
  <!-- 状态 -->
  <select id="statusFilter" class="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
    <option value="">所有状态</option>
    <option value="completed">已完成</option>
    <option value="processing">处理中</option>
    <option value="failed">失败</option>
  </select>
  
  <!-- 搜索 -->
  <div class="relative flex-1 max-w-xs">
    <input type="text" id="historySearch" placeholder="搜索公司..."
           class="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm">
    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
  </div>
  
  <!-- 重置筛选 -->
  <button onclick="resetFilters()" class="px-4 py-2 text-gray-400 hover:text-white transition-colors">
    <i class="fas fa-redo mr-1"></i>重置
  </button>
</div>

<!-- 批量操作栏 -->
<div id="batchActionBar" class="hidden flex items-center gap-4 mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
  <span class="text-yellow-500">已选择 <span id="selectedCount">0</span> 项</span>
  <button onclick="selectAll()" class="px-3 py-1 text-sm text-gray-300 hover:text-white">全选</button>
  <button onclick="cancelSelection()" class="px-3 py-1 text-sm text-gray-300 hover:text-white">取消</button>
  <button onclick="batchDelete()" class="ml-auto px-4 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">
    <i class="fas fa-trash mr-1"></i>删除选中
  </button>
</div>
```

**JavaScript 核心逻辑**:
```javascript
let selectedIds = new Set();
let currentFilters = {};

// 加载历史记录（带筛选）
async function loadHistory() {
  const params = new URLSearchParams({
    page: currentFilters.page || 1,
    limit: 20,
    ...(currentFilters.startDate && { startDate: currentFilters.startDate }),
    ...(currentFilters.endDate && { endDate: currentFilters.endDate }),
    ...(currentFilters.reportType && { reportType: currentFilters.reportType }),
    ...(currentFilters.status && { status: currentFilters.status }),
    ...(currentFilters.search && { search: currentFilters.search }),
    sortBy: currentFilters.sortBy || 'created_at',
    sortOrder: currentFilters.sortOrder || 'desc',
  });
  
  const response = await fetch(`/api/user/history?${params}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  const data = await response.json();
  
  if (data.success) {
    renderHistory(data.history);
    updatePagination(data.total, data.page, data.limit);
    updateFilterOptions(data.filters);
  }
}

// 批量删除
async function batchDelete() {
  if (selectedIds.size === 0) return;
  
  if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;
  
  const response = await fetch('/api/user/history/batch-delete', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: Array.from(selectedIds) })
  });
  
  const data = await response.json();
  if (data.success) {
    showToast(`已删除 ${data.deletedCount} 条记录`);
    selectedIds.clear();
    updateBatchActionBar();
    loadHistory();
  } else {
    showToast(data.error, 'error');
  }
}

// 切换选择
function toggleSelect(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateBatchActionBar();
  updateCheckboxUI(id);
}

// 更新批量操作栏显示
function updateBatchActionBar() {
  const bar = document.getElementById('batchActionBar');
  const countEl = document.getElementById('selectedCount');
  
  if (selectedIds.size > 0) {
    bar.classList.remove('hidden');
    countEl.textContent = selectedIds.size;
  } else {
    bar.classList.add('hidden');
  }
}
```

**验收标准**:
- [ ] 日期范围筛选生效
- [ ] 类型/状态下拉筛选生效
- [ ] 搜索实时生效
- [ ] 批量选择 UI 正常
- [ ] 批量删除功能正常

---

### T2.4.1 迁移逻辑完善

**目标**: 完善访客数据迁移，增加迁移统计

**修改文件**: `src/services/user.ts`

```typescript
// 完善 migrateGuestToUser 方法

async migrateGuestToUser(sessionId: string, userId: number): Promise<{
  success: boolean;
  migratedReports: number;
  migratedBehaviors: number;
  message: string;
}> {
  try {
    // 1. 检查是否已迁移
    const existingMigration = await this.db.prepare(`
      SELECT converted_at FROM guest_sessions 
      WHERE fingerprint = ? AND converted_to_user_id IS NOT NULL
    `).bind(sessionId).first();
    
    if (existingMigration?.converted_at) {
      return {
        success: true,
        migratedReports: 0,
        migratedBehaviors: 0,
        message: '数据已迁移',
      };
    }
    
    // 2. 统计待迁移数据
    const reportCount = await this.db.prepare(`
      SELECT COUNT(*) as count FROM analysis_reports 
      WHERE guest_fingerprint = ? AND user_id IS NULL
    `).bind(sessionId).first<{ count: number }>();
    
    const behaviorCount = await this.db.prepare(`
      SELECT COUNT(*) as count FROM user_activity_logs 
      WHERE guest_fingerprint = ? AND user_id IS NULL
    `).bind(sessionId).first<{ count: number }>();
    
    const migratedReports = reportCount?.count || 0;
    const migratedBehaviors = behaviorCount?.count || 0;
    
    // 3. 执行迁移 - 报告
    if (migratedReports > 0) {
      await this.db.prepare(`
        UPDATE analysis_reports SET user_id = ?
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(userId, sessionId).run();
    }
    
    // 4. 执行迁移 - 行为日志
    if (migratedBehaviors > 0) {
      await this.db.prepare(`
        UPDATE user_activity_logs SET user_id = ?
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(userId, sessionId).run();
    }
    
    // 5. 更新访客会话状态
    await this.db.prepare(`
      UPDATE guest_sessions SET 
        converted_to_user_id = ?,
        converted_at = datetime("now")
      WHERE fingerprint = ?
    `).bind(userId, sessionId).run();
    
    // 6. 记录转化日志
    await this.logActivity(userId, sessionId, 'guest_converted', null, {
      migratedReports,
      migratedBehaviors,
    });
    
    // 7. 生成友好提示
    let message = '欢迎加入！';
    if (migratedReports > 0) {
      message = `已成功迁移 ${migratedReports} 份分析报告到您的账户`;
    }
    
    return {
      success: true,
      migratedReports,
      migratedBehaviors,
      message,
    };
  } catch (error) {
    console.error('Migrate guest error:', error);
    return {
      success: false,
      migratedReports: 0,
      migratedBehaviors: 0,
      message: '数据迁移失败，请稍后重试',
    };
  }
}
```

**修改登录/注册路由**:
```typescript
// src/routes/auth.ts - 修改注册和登录路由

// 注册成功后
const migrationResult = await userService.migrateGuestToUser(guestFingerprint, result.user.id);

return c.json({
  success: true,
  user: { ...result.user, permissions },
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  migration: {
    migratedReports: migrationResult.migratedReports,
    message: migrationResult.message,
  },
});
```

**验收标准**:
- [ ] 报告数据正确迁移
- [ ] 行为日志正确迁移
- [ ] 防止重复迁移
- [ ] 返回迁移统计信息

---

### T2.4.2 前端迁移提示

**目标**: 登录/注册成功后显示迁移结果

**代码修改**:
```javascript
// src/index.tsx - handleLogin / handleRegister 函数

async function handleLogin(e) {
  e.preventDefault();
  // ... 现有登录逻辑
  
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      guestFingerprint: guestFingerprint  // 传递访客标识
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    // ... 现有成功处理
    
    // 显示迁移提示
    if (data.migration && data.migration.migratedReports > 0) {
      showMigrationToast(data.migration);
    }
  }
}

// 迁移提示 Toast
function showMigrationToast(migration) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-green-500/90 text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-slide-up';
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <i class="fas fa-check-circle text-2xl"></i>
      <div>
        <p class="font-semibold">数据迁移成功</p>
        <p class="text-sm opacity-90">${migration.message}</p>
      </div>
    </div>
  `;
  document.body.appendChild(toast);
  
  // 5秒后消失
  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
```

**验收标准**:
- [ ] 登录后显示迁移提示（如有迁移数据）
- [ ] 注册后显示迁移提示（如有迁移数据）
- [ ] Toast 样式美观
- [ ] 5秒后自动消失

---

## 📅 执行排期

### Day 1（约 4 小时）

| 时间段 | 任务 | 产出 |
|--------|------|------|
| 上午 | T2.1.1 简化访客标识 | Session ID 生成逻辑 |
| 上午 | T2.1.2 访客追踪 API | `/api/guest/track` 接口 |
| 下午 | T2.1.3 配额显示优化 | 配额进度条 UI |
| 下午 | T2.2.1 分组数据库迁移 | 0011_favorite_groups.sql |

### Day 2（约 4 小时）

| 时间段 | 任务 | 产出 |
|--------|------|------|
| 上午 | T2.2.2 分组 API 开发 | 分组 CRUD 接口 |
| 下午 | T2.2.3 收藏搜索排序 | 收藏列表 API 增强 |
| 下午 | T2.2.4 前端收藏页 (Part 1) | 分组侧边栏 |

### Day 3（约 4 小时）

| 时间段 | 任务 | 产出 |
|--------|------|------|
| 上午 | T2.2.4 前端收藏页 (Part 2) | 搜索排序 UI |
| 上午 | T2.3.1 历史筛选 API | 历史列表 API 增强 |
| 下午 | T2.3.2 批量删除 API | 批量删除接口 |
| 下午 | T2.3.3 前端历史页 | 筛选+批量操作 UI |

### Day 4（约 2 小时）

| 时间段 | 任务 | 产出 |
|--------|------|------|
| 上午 | T2.4.1 迁移逻辑完善 | 增强版迁移方法 |
| 上午 | T2.4.2 迁移提示 | Toast 提示组件 |
| 下午 | 集成测试 | 全流程测试 |

---

## ✅ 阶段二验收清单

### 功能验收

- [ ] **访客系统**
  - [ ] 新访客获得 UUID 格式的 Session ID
  - [ ] Session ID 持久化在 localStorage
  - [ ] 配额进度条正确显示
  - [ ] 配额用尽时弹出提示

- [ ] **收藏系统**
  - [ ] 可创建/编辑/删除分组
  - [ ] 可将收藏移动到分组
  - [ ] 搜索功能正常
  - [ ] 排序功能正常

- [ ] **历史记录**
  - [ ] 日期范围筛选正常
  - [ ] 类型/状态筛选正常
  - [ ] 搜索功能正常
  - [ ] 批量删除正常

- [ ] **访客迁移**
  - [ ] 注册后自动迁移数据
  - [ ] 登录后自动迁移数据
  - [ ] 显示迁移成功提示
  - [ ] 防止重复迁移

### 技术验收

- [ ] 所有新增 API 有错误处理
- [ ] 数据库迁移脚本可重复执行
- [ ] 前端无 console 报错
- [ ] 移动端适配正常

---

*文档版本: v1.0*  
*创建日期: 2025-01-10*
