# 阶段二详细开发计划 v2

> **版本**: v2.0  
> **预估总时长**: 10-12 小时  
> **优先级调整**: 历史记录 > 访客系统 > 收藏系统

---

## 📊 任务优先级重排

### 优先级说明
- 🔴 **P0 - 最高**: 历史记录模块（核心用户体验）
- 🟠 **P1 - 高**: 访客系统（转化漏斗关键）
- 🟡 **P2 - 中**: 收藏系统（增强功能）

### 任务总览（按优先级排序）

| 优先级 | 编号 | 模块 | 任务名称 | 时长 | 依赖 |
|--------|------|------|----------|------|------|
| 🔴 P0 | T2.3.1 | 历史记录 | 历史记录筛选 API 增强 | 1.5h | - |
| 🔴 P0 | T2.3.2 | 历史记录 | 批量删除 API | 0.5h | - |
| 🔴 P0 | T2.3.3 | 历史记录 | 前端历史页面增强 | 2h | T2.3.1, T2.3.2 |
| 🟠 P1 | T2.1.1 | 访客系统 | 简化访客标识（Session ID） | 1h | - |
| 🟠 P1 | T2.4.1 | 访客迁移 | 迁移逻辑完善 | 1h | T2.1.1 |
| 🟠 P1 | T2.4.2 | 访客迁移 | 前端迁移提示 | 0.5h | T2.4.1 |
| 🟠 P1 | T2.1.2 | 访客系统 | 配额显示与提示优化 | 0.5h | T2.1.1 |
| 🟡 P2 | T2.2.1 | 收藏系统 | 收藏分组数据库迁移 | 0.5h | - |
| 🟡 P2 | T2.2.2 | 收藏系统 | 收藏分组 API 开发 | 1.5h | T2.2.1 |
| 🟡 P2 | T2.2.3 | 收藏系统 | 收藏搜索与排序 API | 1h | - |
| 🟡 P2 | T2.2.4 | 收藏系统 | 前端收藏页面增强 | 1.5h | T2.2.2, T2.2.3 |

---

## 🔴 P0 - 历史记录模块（最高优先级）

### T2.3.1 历史记录筛选 API 增强

**目标**: 支持日期、类型、状态、搜索等多维筛选

**现状分析**:
```typescript
// 当前 src/services/user.ts 第 511-544 行
async getAnalysisHistory(userId: number, options?: {
  page?: number;
  limit?: number;
  includeDeleted?: boolean;  // 仅支持这3个参数
})
```

**增强后 API**:
```
GET /api/user/history
  ?page=1
  &limit=20
  &startDate=2024-01-01
  &endDate=2024-12-31
  &reportType=annual
  &status=completed
  &search=茅台
  &sortBy=created_at
  &sortOrder=desc
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| page | number | 否 | 页码，默认 1 | 1 |
| limit | number | 否 | 每页数量，默认 20，最大 100 | 20 |
| startDate | string | 否 | 开始日期 (YYYY-MM-DD) | 2024-01-01 |
| endDate | string | 否 | 结束日期 (YYYY-MM-DD) | 2024-12-31 |
| reportType | string | 否 | 报告类型 | annual / quarterly |
| status | string | 否 | 状态 | completed / processing / failed |
| search | string | 否 | 搜索关键词（公司名/代码） | 茅台 |
| sortBy | string | 否 | 排序字段，默认 created_at | created_at / company_name / health_score |
| sortOrder | string | 否 | 排序方向，默认 desc | asc / desc |

**响应格式**:
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "company_code": "600519.SH",
      "company_name": "贵州茅台",
      "report_type": "annual",
      "report_period": "2023",
      "status": "completed",
      "health_score": 85,
      "comic_status": "completed",
      "view_count": 12,
      "created_at": "2024-01-10T10:00:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 20,
  "hasMore": true,
  "filters": {
    "reportTypes": ["annual", "quarterly"],
    "statuses": ["completed", "processing", "failed"]
  }
}
```

**代码实现**:

```typescript
// ===== 文件: src/services/user.ts =====
// 替换原有的 getAnalysisHistory 方法

interface HistoryQueryOptions {
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
  startDate?: string;
  endDate?: string;
  reportType?: string;
  status?: string;
  search?: string;
  sortBy?: 'created_at' | 'company_name' | 'health_score' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface HistoryQueryResult {
  history: AnalysisHistory[];
  total: number;
  filters: {
    reportTypes: string[];
    statuses: string[];
  };
}

async getAnalysisHistory(userId: number, options?: HistoryQueryOptions): Promise<HistoryQueryResult> {
  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 20, 100);
  const offset = (page - 1) * limit;
  
  // 构建 WHERE 子句
  const conditions: string[] = ['user_id = ?'];
  const params: (number | string)[] = [userId];
  
  // 软删除过滤
  if (!options?.includeDeleted) {
    conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
  }
  
  // 日期范围
  if (options?.startDate) {
    conditions.push('created_at >= ?');
    params.push(options.startDate + ' 00:00:00');
  }
  if (options?.endDate) {
    conditions.push('created_at <= ?');
    params.push(options.endDate + ' 23:59:59');
  }
  
  // 报告类型
  if (options?.reportType) {
    conditions.push('report_type = ?');
    params.push(options.reportType);
  }
  
  // 状态
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  
  // 搜索
  if (options?.search) {
    conditions.push('(company_name LIKE ? OR company_code LIKE ?)');
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }
  
  const whereClause = 'WHERE ' + conditions.join(' AND ');
  
  // 排序
  const allowedSortFields = ['created_at', 'company_name', 'health_score', 'status'];
  const sortField = allowedSortFields.includes(options?.sortBy || '') 
    ? options!.sortBy 
    : 'created_at';
  const sortOrder = options?.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const orderClause = `ORDER BY ${sortField} ${sortOrder}`;
  
  // 查询总数
  const countResult = await this.db.prepare(
    `SELECT COUNT(*) as count FROM analysis_reports ${whereClause}`
  ).bind(...params).first<{ count: number }>();
  
  // 查询可用的筛选选项（用于前端下拉框）
  const [reportTypesResult, statusesResult] = await Promise.all([
    this.db.prepare(`
      SELECT DISTINCT report_type FROM analysis_reports 
      WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND report_type IS NOT NULL
    `).bind(userId).all<{ report_type: string }>(),
    this.db.prepare(`
      SELECT DISTINCT status FROM analysis_reports 
      WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND status IS NOT NULL
    `).bind(userId).all<{ status: string }>(),
  ]);
  
  // 查询数据列表
  const listParams = [...params, limit, offset];
  const history = await this.db.prepare(`
    SELECT id, company_code, company_name, report_type, report_period,
           status, health_score, key_conclusions, comic_status, 
           view_count, created_at
    FROM analysis_reports 
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `).bind(...listParams).all<AnalysisHistory>();
  
  return {
    history: history.results || [],
    total: countResult?.count || 0,
    filters: {
      reportTypes: reportTypesResult.results?.map(r => r.report_type).filter(Boolean) || [],
      statuses: statusesResult.results?.map(s => s.status).filter(Boolean) || [],
    },
  };
}
```

```typescript
// ===== 文件: src/routes/user.ts =====
// 替换原有的 GET /history 路由

user.get('/history', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    // 解析所有查询参数
    const options = {
      page: parseInt(c.req.query('page') || '1', 10),
      limit: Math.min(parseInt(c.req.query('limit') || '20', 10), 100),
      startDate: c.req.query('startDate') || undefined,
      endDate: c.req.query('endDate') || undefined,
      reportType: c.req.query('reportType') || undefined,
      status: c.req.query('status') || undefined,
      search: c.req.query('search') || undefined,
      sortBy: (c.req.query('sortBy') || 'created_at') as any,
      sortOrder: (c.req.query('sortOrder') || 'desc') as any,
    };
    
    const result = await userService.getAnalysisHistory(currentUser.id, options);
    
    return c.json({
      success: true,
      history: result.history,
      total: result.total,
      page: options.page,
      limit: options.limit,
      hasMore: result.total > options.page * options.limit,
      filters: result.filters,
    });
  } catch (error) {
    console.error('Get history error:', error);
    return c.json({ success: false, error: '获取历史记录失败' }, 500);
  }
});
```

**验收标准**:
- [ ] 日期范围筛选正确
- [ ] 报告类型筛选正确
- [ ] 状态筛选正确
- [ ] 搜索功能正确（公司名/代码）
- [ ] 排序功能正确
- [ ] 返回可用筛选选项

---

### T2.3.2 批量删除 API

**目标**: 支持一次删除多条历史记录

**API 设计**:
```
POST /api/user/history/batch-delete
Content-Type: application/json

{
  "ids": [1, 2, 3, 4, 5]
}
```

**响应**:
```json
{
  "success": true,
  "deletedCount": 5,
  "message": "已删除 5 条记录"
}
```

**代码实现**:

```typescript
// ===== 文件: src/routes/user.ts =====
// 在历史记录相关路由区域添加

// 批量删除历史记录
user.post('/history/batch-delete', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json<{ ids: number[] }>();
    
    if (!currentUser || !c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 参数校验
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return c.json({ success: false, error: '请选择要删除的记录' }, 400);
    }
    
    // 数量限制
    if (body.ids.length > 100) {
      return c.json({ success: false, error: '单次最多删除 100 条记录' }, 400);
    }
    
    // 过滤无效 ID
    const validIds = body.ids.filter(id => Number.isInteger(id) && id > 0);
    if (validIds.length === 0) {
      return c.json({ success: false, error: '无效的记录 ID' }, 400);
    }
    
    // 验证所有 ID 属于当前用户
    const placeholders = validIds.map(() => '?').join(',');
    const existingRecords = await c.env.DB.prepare(`
      SELECT id FROM analysis_reports 
      WHERE id IN (${placeholders}) AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
    `).bind(...validIds, currentUser.id).all<{ id: number }>();
    
    const ownedIds = existingRecords.results?.map(r => r.id) || [];
    
    if (ownedIds.length === 0) {
      return c.json({ success: false, error: '没有可删除的记录' }, 400);
    }
    
    // 执行软删除
    const updatePlaceholders = ownedIds.map(() => '?').join(',');
    await c.env.DB.prepare(`
      UPDATE analysis_reports 
      SET is_deleted = 1, deleted_at = datetime("now")
      WHERE id IN (${updatePlaceholders})
    `).bind(...ownedIds).run();
    
    return c.json({
      success: true,
      deletedCount: ownedIds.length,
      message: `已删除 ${ownedIds.length} 条记录`,
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
- [ ] 软删除（不物理删除）

---

### T2.3.3 前端历史页面增强

**目标**: 增加筛选栏、搜索框、批量操作 UI

**页面结构**:
```
/my-reports 页面
├── 筛选工具栏
│   ├── 日期范围选择器（开始日期 - 结束日期）
│   ├── 报告类型下拉框（全部/年报/季报）
│   ├── 状态下拉框（全部/已完成/处理中/失败）
│   ├── 搜索框（公司名称/代码）
│   ├── 排序下拉框
│   └── 重置按钮
├── 批量操作栏（选中时显示）
│   ├── 已选 X 项
│   ├── 全选/取消全选
│   └── 批量删除按钮
├── 报告列表
│   └── 报告卡片（带复选框）
└── 分页器
```

**HTML 模板**:
```html
<!-- 筛选工具栏 -->
<div class="filter-toolbar flex flex-wrap items-center gap-3 mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
  <!-- 日期范围 -->
  <div class="flex items-center gap-2">
    <label class="text-xs text-gray-500">日期范围</label>
    <input type="date" id="startDate" 
           class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
    <span class="text-gray-600">-</span>
    <input type="date" id="endDate" 
           class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
  </div>
  
  <!-- 报告类型 -->
  <select id="reportTypeFilter" 
          class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
    <option value="">全部类型</option>
    <option value="annual">年报</option>
    <option value="quarterly">季报</option>
  </select>
  
  <!-- 状态 -->
  <select id="statusFilter" 
          class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
    <option value="">全部状态</option>
    <option value="completed">已完成</option>
    <option value="processing">处理中</option>
    <option value="failed">失败</option>
  </select>
  
  <!-- 搜索框 -->
  <div class="relative flex-1 min-w-[200px] max-w-xs">
    <input type="text" id="historySearch" placeholder="搜索公司名称或代码..." 
           class="w-full px-4 py-1.5 pl-9 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
  </div>
  
  <!-- 排序 -->
  <select id="sortSelect" 
          class="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-yellow-500 focus:outline-none">
    <option value="created_at:desc">最新优先</option>
    <option value="created_at:asc">最早优先</option>
    <option value="company_name:asc">公司名 A-Z</option>
    <option value="company_name:desc">公司名 Z-A</option>
    <option value="health_score:desc">评分从高到低</option>
    <option value="health_score:asc">评分从低到高</option>
  </select>
  
  <!-- 重置按钮 -->
  <button onclick="resetFilters()" 
          class="px-3 py-1.5 text-gray-400 hover:text-yellow-500 transition-colors text-sm">
    <i class="fas fa-redo mr-1"></i>重置
  </button>
</div>

<!-- 批量操作栏 -->
<div id="batchActionBar" class="hidden mb-4">
  <div class="flex items-center gap-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
    <label class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll()" 
             class="w-4 h-4 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500">
      <span class="text-sm text-gray-300">全选</span>
    </label>
    <span class="text-yellow-500 text-sm">
      已选择 <span id="selectedCount" class="font-semibold">0</span> 项
    </span>
    <div class="flex-1"></div>
    <button onclick="cancelSelection()" 
            class="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors">
      取消选择
    </button>
    <button onclick="batchDelete()" 
            class="px-4 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30 transition-colors">
      <i class="fas fa-trash mr-1"></i>删除选中
    </button>
  </div>
</div>

<!-- 报告列表 -->
<div id="reportsList" class="space-y-3">
  <!-- 动态渲染报告卡片 -->
</div>

<!-- 分页器 -->
<div id="pagination" class="mt-6 flex items-center justify-center gap-2">
  <!-- 动态渲染分页按钮 -->
</div>

<!-- 空状态 -->
<div id="emptyState" class="hidden text-center py-16">
  <i class="fas fa-folder-open text-5xl text-gray-700 mb-4"></i>
  <p class="text-gray-500 mb-4">暂无分析记录</p>
  <a href="/" class="inline-block px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:shadow-lg transition-all">
    开始分析
  </a>
</div>
```

**JavaScript 核心逻辑**:
```javascript
// ===== 历史记录页面脚本 =====

// 状态管理
let currentPage = 1;
let totalPages = 1;
let selectedIds = new Set();
let currentFilters = {};
let debounceTimer = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initFilters();
  loadHistory();
});

// 初始化筛选器事件
function initFilters() {
  // 日期变化
  document.getElementById('startDate').addEventListener('change', applyFilters);
  document.getElementById('endDate').addEventListener('change', applyFilters);
  
  // 下拉框变化
  document.getElementById('reportTypeFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('sortSelect').addEventListener('change', applyFilters);
  
  // 搜索框（防抖）
  document.getElementById('historySearch').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyFilters();
    }, 300);
  });
}

// 应用筛选
function applyFilters() {
  currentPage = 1;
  selectedIds.clear();
  updateBatchActionBar();
  
  const [sortBy, sortOrder] = document.getElementById('sortSelect').value.split(':');
  
  currentFilters = {
    startDate: document.getElementById('startDate').value || undefined,
    endDate: document.getElementById('endDate').value || undefined,
    reportType: document.getElementById('reportTypeFilter').value || undefined,
    status: document.getElementById('statusFilter').value || undefined,
    search: document.getElementById('historySearch').value.trim() || undefined,
    sortBy,
    sortOrder,
  };
  
  loadHistory();
}

// 重置筛选
function resetFilters() {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('reportTypeFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('historySearch').value = '';
  document.getElementById('sortSelect').value = 'created_at:desc';
  
  currentFilters = {};
  currentPage = 1;
  selectedIds.clear();
  updateBatchActionBar();
  loadHistory();
}

// 加载历史记录
async function loadHistory() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    showNeedLogin();
    return;
  }
  
  // 显示加载状态
  document.getElementById('reportsList').innerHTML = `
    <div class="text-center py-8">
      <i class="fas fa-spinner fa-spin text-2xl text-yellow-500"></i>
      <p class="text-gray-500 mt-2">加载中...</p>
    </div>
  `;
  
  // 构建查询参数
  const params = new URLSearchParams({
    page: currentPage,
    limit: 20,
  });
  
  Object.entries(currentFilters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  
  try {
    const response = await fetch(`/api/user/history?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    if (data.success) {
      renderHistory(data.history);
      renderPagination(data.total, data.page, data.limit);
      updateFilterOptions(data.filters);
      
      // 空状态处理
      if (data.history.length === 0) {
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('reportsList').classList.add('hidden');
      } else {
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('reportsList').classList.remove('hidden');
      }
    } else {
      showError(data.error || '加载失败');
    }
  } catch (error) {
    console.error('Load history error:', error);
    showError('网络错误，请重试');
  }
}

// 渲染历史列表
function renderHistory(history) {
  const container = document.getElementById('reportsList');
  
  if (history.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = history.map(report => `
    <div class="report-card flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-yellow-500/30 transition-colors">
      <!-- 复选框 -->
      <input type="checkbox" 
             class="report-checkbox w-4 h-4 rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-yellow-500 cursor-pointer"
             data-id="${report.id}"
             ${selectedIds.has(report.id) ? 'checked' : ''}
             onchange="toggleSelect(${report.id})">
      
      <!-- 主要信息 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-semibold text-white truncate">${report.company_name}</h3>
          <span class="text-xs text-gray-500">${report.company_code}</span>
          <span class="px-2 py-0.5 text-xs rounded ${getReportTypeBadgeClass(report.report_type)}">
            ${report.report_type === 'annual' ? '年报' : '季报'}
          </span>
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-500">
          <span><i class="far fa-calendar mr-1"></i>${formatDate(report.created_at)}</span>
          ${report.report_period ? `<span>报告期: ${report.report_period}</span>` : ''}
          ${report.view_count ? `<span><i class="far fa-eye mr-1"></i>${report.view_count}</span>` : ''}
        </div>
      </div>
      
      <!-- 健康评分 -->
      ${report.health_score ? `
        <div class="text-center px-3">
          <div class="text-2xl font-bold ${getScoreColorClass(report.health_score)}">${report.health_score}</div>
          <div class="text-xs text-gray-500">健康评分</div>
        </div>
      ` : ''}
      
      <!-- 状态标签 -->
      <div class="px-3 py-1 rounded-full text-xs ${getStatusBadgeClass(report.status)}">
        ${getStatusText(report.status)}
      </div>
      
      <!-- 操作按钮 -->
      <div class="flex items-center gap-2">
        ${report.comic_status === 'completed' ? `
          <button onclick="viewComic(${report.id})" class="p-2 text-purple-400 hover:text-purple-300 transition-colors" title="查看漫画">
            <i class="fas fa-palette"></i>
          </button>
        ` : ''}
        <button onclick="viewReport('${report.company_code}', '${report.company_name}', ${report.id})" 
                class="p-2 text-yellow-500 hover:text-yellow-400 transition-colors" title="查看报告">
          <i class="fas fa-chart-line"></i>
        </button>
        <button onclick="deleteSingle(${report.id})" 
                class="p-2 text-gray-500 hover:text-red-400 transition-colors" title="删除">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// 渲染分页
function renderPagination(total, page, limit) {
  totalPages = Math.ceil(total / limit);
  const container = document.getElementById('pagination');
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  
  // 上一页
  html += `
    <button onclick="goToPage(${page - 1})" 
            class="px-3 py-1.5 rounded-lg ${page === 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}"
            ${page === 1 ? 'disabled' : ''}>
      <i class="fas fa-chevron-left"></i>
    </button>
  `;
  
  // 页码
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  
  if (startPage > 1) {
    html += `<button onclick="goToPage(1)" class="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">1</button>`;
    if (startPage > 2) html += `<span class="text-gray-600">...</span>`;
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button onclick="goToPage(${i})" 
              class="px-3 py-1.5 rounded-lg ${i === page ? 'bg-yellow-500 text-black font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}">
        ${i}
      </button>
    `;
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="text-gray-600">...</span>`;
    html += `<button onclick="goToPage(${totalPages})" class="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">${totalPages}</button>`;
  }
  
  // 下一页
  html += `
    <button onclick="goToPage(${page + 1})" 
            class="px-3 py-1.5 rounded-lg ${page === totalPages ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}"
            ${page === totalPages ? 'disabled' : ''}>
      <i class="fas fa-chevron-right"></i>
    </button>
  `;
  
  // 总数显示
  html += `<span class="ml-4 text-sm text-gray-500">共 ${total} 条</span>`;
  
  container.innerHTML = html;
}

// 跳转页码
function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 切换单个选择
function toggleSelect(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  updateBatchActionBar();
}

// 全选/取消全选
function toggleSelectAll() {
  const checkboxes = document.querySelectorAll('.report-checkbox');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  
  if (selectAllCheckbox.checked) {
    checkboxes.forEach(cb => {
      cb.checked = true;
      selectedIds.add(parseInt(cb.dataset.id));
    });
  } else {
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    selectedIds.clear();
  }
  updateBatchActionBar();
}

// 取消选择
function cancelSelection() {
  selectedIds.clear();
  document.querySelectorAll('.report-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('selectAllCheckbox').checked = false;
  updateBatchActionBar();
}

// 更新批量操作栏
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

// 批量删除
async function batchDelete() {
  if (selectedIds.size === 0) return;
  
  if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？此操作不可恢复。`)) return;
  
  const token = localStorage.getItem('accessToken');
  
  try {
    const response = await fetch('/api/user/history/batch-delete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: Array.from(selectedIds) })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`已删除 ${data.deletedCount} 条记录`, 'success');
      selectedIds.clear();
      updateBatchActionBar();
      loadHistory();
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (error) {
    console.error('Batch delete error:', error);
    showToast('网络错误，请重试', 'error');
  }
}

// 删除单条
async function deleteSingle(id) {
  if (!confirm('确定要删除这条记录吗？')) return;
  
  const token = localStorage.getItem('accessToken');
  
  try {
    const response = await fetch(`/api/user/history/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast('删除成功', 'success');
      loadHistory();
    } else {
      showToast(data.error || '删除失败', 'error');
    }
  } catch (error) {
    showToast('网络错误，请重试', 'error');
  }
}

// 查看报告
function viewReport(code, name, reportId) {
  window.location.href = `/analysis?code=${code}&name=${encodeURIComponent(name)}&reportId=${reportId}`;
}

// 工具函数
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getScoreColorClass(score) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function getStatusBadgeClass(status) {
  const classes = {
    completed: 'bg-green-500/20 text-green-400',
    processing: 'bg-blue-500/20 text-blue-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return classes[status] || 'bg-gray-500/20 text-gray-400';
}

function getStatusText(status) {
  const texts = { completed: '已完成', processing: '处理中', failed: '失败' };
  return texts[status] || status;
}

function getReportTypeBadgeClass(type) {
  return type === 'annual' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400';
}

function showToast(message, type = 'info') {
  // 实现 Toast 提示
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };
  
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

**验收标准**:
- [ ] 筛选工具栏正确显示
- [ ] 日期范围筛选实时生效
- [ ] 下拉筛选实时生效
- [ ] 搜索框输入防抖 300ms
- [ ] 排序切换正常
- [ ] 批量选择 UI 正常
- [ ] 全选/取消全选正常
- [ ] 批量删除功能正常
- [ ] 分页器正确渲染
- [ ] 空状态正确显示

---

## 🟠 P1 - 访客系统模块

### T2.1.1 简化访客标识（Session ID）

**目标**: 用 UUID 替换复杂的设备指纹

**现状代码** (src/index.tsx 第 273-294 行):
```javascript
async function generateFingerprint() {
    const canvas = document.createElement('canvas');
    // ... 复杂的指纹生成逻辑
}
```

**新方案**:
```javascript
// ===== 文件: src/index.tsx =====
// 替换 generateFingerprint 函数

// 生成访客会话 ID（简化版，使用 UUID）
function generateGuestSessionId() {
  // 优先使用 crypto.randomUUID()（现代浏览器支持）
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降级方案：手动生成 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 获取或创建访客会话 ID
function getOrCreateGuestSessionId() {
  const storageKey = 'guestSessionId';
  let sessionId = localStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = generateGuestSessionId();
    localStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}
```

**同步修改 checkAuth 函数**:
```javascript
async function checkAuth() {
  // 使用简化的 Session ID
  if (!guestFingerprint) {
    guestFingerprint = getOrCreateGuestSessionId();
  }
  
  // ... 其余逻辑不变
}
```

**验收标准**:
- [ ] 新访客获得 UUID 格式的 Session ID
- [ ] Session ID 正确存储到 localStorage
- [ ] 与后端 fingerprint 字段兼容
- [ ] 浏览器兼容性（支持旧浏览器降级）

---

### T2.4.1 迁移逻辑完善

**目标**: 完善访客数据迁移，增加统计反馈

**代码实现**:
```typescript
// ===== 文件: src/services/user.ts =====
// 完善 migrateGuestToUser 方法

interface MigrationResult {
  success: boolean;
  migratedReports: number;
  migratedBehaviors: number;
  message: string;
}

async migrateGuestToUser(sessionId: string, userId: number): Promise<MigrationResult> {
  try {
    // 1. 检查是否已迁移（防止重复）
    const existingMigration = await this.db.prepare(`
      SELECT converted_at FROM guest_sessions 
      WHERE fingerprint = ? AND converted_to_user_id IS NOT NULL
    `).bind(sessionId).first();
    
    if (existingMigration?.converted_at) {
      return {
        success: true,
        migratedReports: 0,
        migratedBehaviors: 0,
        message: '欢迎回来！',
      };
    }
    
    // 2. 统计待迁移数据
    const [reportCount, behaviorCount] = await Promise.all([
      this.db.prepare(`
        SELECT COUNT(*) as count FROM analysis_reports 
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(sessionId).first<{ count: number }>(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM user_activity_logs 
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(sessionId).first<{ count: number }>(),
    ]);
    
    const migratedReports = reportCount?.count || 0;
    const migratedBehaviors = behaviorCount?.count || 0;
    
    // 3. 执行迁移
    const migrations = [];
    
    if (migratedReports > 0) {
      migrations.push(
        this.db.prepare(`
          UPDATE analysis_reports SET user_id = ?
          WHERE guest_fingerprint = ? AND user_id IS NULL
        `).bind(userId, sessionId).run()
      );
    }
    
    if (migratedBehaviors > 0) {
      migrations.push(
        this.db.prepare(`
          UPDATE user_activity_logs SET user_id = ?
          WHERE guest_fingerprint = ? AND user_id IS NULL
        `).bind(userId, sessionId).run()
      );
    }
    
    // 更新访客会话状态
    migrations.push(
      this.db.prepare(`
        UPDATE guest_sessions SET 
          converted_to_user_id = ?,
          converted_at = datetime("now")
        WHERE fingerprint = ?
      `).bind(userId, sessionId).run()
    );
    
    await Promise.all(migrations);
    
    // 4. 记录转化日志
    await this.logActivity(userId, sessionId, 'guest_converted', null, {
      migratedReports,
      migratedBehaviors,
    });
    
    // 5. 生成友好消息
    let message = '欢迎加入 Finspark！';
    if (migratedReports > 0) {
      message = `🎉 已将您之前的 ${migratedReports} 份分析报告同步到账户`;
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
      message: '数据同步失败，请稍后重试',
    };
  }
}
```

**修改认证路由返回迁移信息**:
```typescript
// ===== 文件: src/routes/auth.ts =====
// 修改 register 和 login 路由

// 在注册/登录成功后
const migrationResult = await userService.migrateGuestToUser(
  guestFingerprint || '', 
  result.user.id
);

return c.json({
  success: true,
  user: { ...result.user, permissions },
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
  migration: migrationResult.migratedReports > 0 ? {
    migratedReports: migrationResult.migratedReports,
    message: migrationResult.message,
  } : undefined,
});
```

---

### T2.4.2 前端迁移提示

**代码实现**:
```javascript
// ===== 文件: src/index.tsx =====
// 添加迁移提示函数

function showMigrationSuccess(migration) {
  if (!migration || migration.migratedReports === 0) return;
  
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 max-w-sm bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 transform translate-y-full opacity-0 transition-all duration-300';
  toast.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
        <i class="fas fa-check text-xl"></i>
      </div>
      <div>
        <p class="font-semibold mb-1">数据同步成功</p>
        <p class="text-sm text-white/90">${migration.message}</p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white/60 hover:text-white">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // 动画显示
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-full', 'opacity-0');
  });
  
  // 5秒后自动消失
  setTimeout(() => {
    toast.classList.add('translate-y-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// 在 handleLogin 和 handleRegister 成功回调中调用
async function handleLogin(e) {
  // ... 现有逻辑
  
  if (data.success) {
    // ... 现有成功处理
    
    // 显示迁移提示
    if (data.migration) {
      showMigrationSuccess(data.migration);
    }
  }
}
```

---

### T2.1.2 配额显示与提示优化

**代码实现**:
```javascript
// ===== 文件: src/index.tsx =====
// 增强配额显示

function updateQuotaDisplay() {
  const perms = getPermissions();
  if (!perms) return;
  
  const quotaEl = document.getElementById('quotaDisplay');
  const quotaBar = document.getElementById('quotaProgress');
  
  if (quotaEl) {
    if (perms.remainingAnalysis === null) {
      quotaEl.textContent = '无限';
      quotaEl.className = 'text-yellow-400 font-semibold';
    } else {
      quotaEl.textContent = `${perms.remainingAnalysis}/${perms.maxDailyAnalysis}`;
      
      // 配额不足时变红
      if (perms.remainingAnalysis === 0) {
        quotaEl.className = 'text-red-400 font-semibold';
      } else if (perms.remainingAnalysis <= 2) {
        quotaEl.className = 'text-orange-400 font-semibold';
      } else {
        quotaEl.className = 'text-gray-400';
      }
    }
  }
  
  // 更新进度条
  if (quotaBar && perms.maxDailyAnalysis) {
    const percentage = ((perms.maxDailyAnalysis - (perms.remainingAnalysis || 0)) / perms.maxDailyAnalysis) * 100;
    quotaBar.style.width = `${percentage}%`;
    
    // 进度条颜色
    if (percentage >= 100) {
      quotaBar.className = 'h-full bg-red-500 transition-all';
    } else if (percentage >= 80) {
      quotaBar.className = 'h-full bg-orange-500 transition-all';
    } else {
      quotaBar.className = 'h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all';
    }
  }
}

// 配额用尽提示
function showQuotaExhaustedPrompt() {
  const isGuest = !currentUser;
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md mx-4 text-center">
      <div class="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-chart-line text-3xl text-yellow-500"></i>
      </div>
      <h3 class="text-xl font-bold text-white mb-2">今日分析次数已用完</h3>
      <p class="text-gray-400 mb-6">
        ${isGuest 
          ? '注册账户即可获得每日 10 次免费分析机会，还能保存您的分析历史' 
          : '升级 Pro 会员，享受每日 50 次分析，更有 AI 漫画解读等高级功能'}
      </p>
      <div class="flex gap-3 justify-center">
        <button onclick="this.closest('.fixed').remove()" 
                class="px-6 py-2 text-gray-400 hover:text-white transition-colors">
          稍后再说
        </button>
        <button onclick="${isGuest ? 'openRegisterModal()' : 'window.location.href=\\'/membership\\''};this.closest('.fixed').remove()" 
                class="px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:shadow-lg transition-all">
          ${isGuest ? '立即注册' : '查看会员'}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}
```

---

## 🟡 P2 - 收藏系统模块

### T2.2.1 收藏分组数据库迁移

**迁移文件**:
```sql
-- migrations/0011_favorite_groups.sql

-- 创建收藏分组表
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_fav_groups_user ON favorite_groups(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_groups_unique ON favorite_groups(user_id, name);

-- 为现有收藏表添加分组字段（如果不存在则添加）
-- SQLite 不支持 IF NOT EXISTS，需要检查后执行
ALTER TABLE user_favorites ADD COLUMN group_id INTEGER REFERENCES favorite_groups(id) ON DELETE SET NULL;
ALTER TABLE user_favorites ADD COLUMN sort_order INTEGER DEFAULT 0;

-- 分组字段索引
CREATE INDEX IF NOT EXISTS idx_favorites_group ON user_favorites(group_id);
```

---

### T2.2.2 收藏分组 API

> 代码实现参见原方案 T2.2.2，包含：
> - GET /api/user/favorites/groups
> - POST /api/user/favorites/groups
> - PUT /api/user/favorites/groups/:id
> - DELETE /api/user/favorites/groups/:id
> - PUT /api/user/favorites/:id/group

---

### T2.2.3 收藏搜索与排序

> 代码实现参见原方案 T2.2.3，增强 GET /api/user/favorites 支持 search、sortBy、sortOrder、groupId 参数

---

### T2.2.4 前端收藏页面增强

> UI 和代码实现参见原方案 T2.2.4

---

## 📅 执行排期（按优先级）

### Day 1（约 4 小时）- 历史记录模块

| 时间 | 任务 | 产出 |
|------|------|------|
| 09:00-10:30 | T2.3.1 历史记录筛选 API | 增强后的 /api/user/history |
| 10:30-11:00 | T2.3.2 批量删除 API | POST /api/user/history/batch-delete |
| 11:00-13:00 | T2.3.3 前端历史页面 Part 1 | 筛选工具栏 + 基础列表 |
| 14:00-15:00 | T2.3.3 前端历史页面 Part 2 | 批量操作 + 分页 |

### Day 2（约 3 小时）- 访客系统模块

| 时间 | 任务 | 产出 |
|------|------|------|
| 09:00-10:00 | T2.1.1 简化访客标识 | UUID 生成逻辑 |
| 10:00-11:00 | T2.4.1 迁移逻辑完善 | 增强版迁移方法 |
| 11:00-11:30 | T2.4.2 前端迁移提示 | Toast 组件 |
| 11:30-12:00 | T2.1.2 配额显示优化 | 进度条 + 提示弹窗 |

### Day 3（约 3.5 小时）- 收藏系统模块

| 时间 | 任务 | 产出 |
|------|------|------|
| 09:00-09:30 | T2.2.1 数据库迁移 | 0011_favorite_groups.sql |
| 09:30-11:00 | T2.2.2 分组 API | 分组 CRUD |
| 11:00-12:00 | T2.2.3 搜索排序 API | 收藏列表增强 |
| 14:00-15:30 | T2.2.4 前端收藏页面 | 分组侧边栏 + 搜索排序 |

### Day 4（约 1.5 小时）- 集成测试

| 时间 | 任务 | 产出 |
|------|------|------|
| 09:00-10:00 | 全流程测试 | 测试报告 |
| 10:00-10:30 | Bug 修复 | 修复后代码 |

---

## 🔑 关键技术变更汇总

### 1. 历史记录 API 增强

```diff
- GET /api/user/history?page=1&limit=20
+ GET /api/user/history?page=1&limit=20&startDate=&endDate=&reportType=&status=&search=&sortBy=&sortOrder=

+ POST /api/user/history/batch-delete
+   Body: { ids: number[] }
```

### 2. 访客标识简化

```diff
- async function generateFingerprint() {
-   // Canvas + 浏览器信息生成指纹
- }

+ function generateGuestSessionId() {
+   return crypto.randomUUID();
+ }
```

### 3. 数据迁移增强

```diff
- migrateGuestToUser(fingerprint, userId): Promise<void>
+ migrateGuestToUser(sessionId, userId): Promise<MigrationResult>
+   // 返回迁移统计信息
```

### 4. 收藏分组系统

```sql
+ CREATE TABLE favorite_groups (...)
+ ALTER TABLE user_favorites ADD COLUMN group_id
```

```
+ GET    /api/user/favorites/groups
+ POST   /api/user/favorites/groups
+ PUT    /api/user/favorites/groups/:id
+ DELETE /api/user/favorites/groups/:id
+ PUT    /api/user/favorites/:id/group
```

---

## ✅ 验收清单

### P0 - 历史记录（最高优先级）
- [ ] 日期范围筛选正确
- [ ] 报告类型筛选正确
- [ ] 状态筛选正确
- [ ] 搜索功能正确
- [ ] 排序功能正确
- [ ] 批量删除正确
- [ ] 分页器正确
- [ ] 前端 UI 完整

### P1 - 访客系统
- [ ] Session ID 生成正确
- [ ] 数据迁移正确
- [ ] 迁移提示显示
- [ ] 配额显示正确
- [ ] 配额用尽提示

### P2 - 收藏系统
- [ ] 分组 CRUD 正确
- [ ] 收藏移动到分组正确
- [ ] 搜索功能正确
- [ ] 排序功能正确

---

*文档版本: v2.0*  
*最后更新: 2025-01-10*
