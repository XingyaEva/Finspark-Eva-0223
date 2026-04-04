/**
 * RAG 平台公共 UI 组件库
 *
 * 提供可复用的 HTML/CSS 组件生成函数，供所有 RAG 页面使用。
 * 包括：KPI 卡片、数据表格、Tab 导航、状态徽章、空状态、
 *       页头面包屑、加载骨架、通知提示等。
 *
 * 命名约定：
 *   - 函数名以 `rag` 前缀开头 → ragKpiCard / ragDataTable
 *   - CSS 类名以 `rc-` 前缀（rag-common）避免与主站冲突
 */

// ============================================================
// 1. 公共样式（注入到 <style> 中）
// ============================================================

export const ragCommonStyles = `
/* ======== RAG Common UI Components ======== */

/* ---------- Fonts & Reset ---------- */
.rag-layout * { font-family: 'Noto Sans SC', 'Inter', sans-serif; box-sizing: border-box; }

/* ---------- Page Header ---------- */
.rc-page-header {
  margin-bottom: 28px;
}
.rc-page-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.rc-page-title {
  font-size: 22px;
  font-weight: 700;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.rc-page-title i { color: #d4af37; }
.rc-page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.rc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.rc-breadcrumb a {
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.2s;
}
.rc-breadcrumb a:hover { color: #d4af37; }
.rc-breadcrumb-sep { opacity: 0.5; }

/* ---------- KPI Card ---------- */
.rc-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.rc-kpi-card {
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
}
.rc-kpi-card:hover {
  border-color: rgba(148, 163, 184, 0.2);
  transform: translateY(-2px);
}
.rc-kpi-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  margin-bottom: 12px;
}
.rc-kpi-icon.blue   { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.rc-kpi-icon.green  { background: rgba(34, 197, 94, 0.15);  color: #22c55e; }
.rc-kpi-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
.rc-kpi-icon.amber  { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.rc-kpi-icon.red    { background: rgba(239, 68, 68, 0.15);  color: #ef4444; }
.rc-kpi-icon.gold   { background: rgba(212, 175, 55, 0.15); color: #d4af37; }
.rc-kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.1;
}
.rc-kpi-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
.rc-kpi-trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
  padding: 2px 8px;
  border-radius: 4px;
}
.rc-kpi-trend.up   { background: rgba(34, 197, 94, 0.1);  color: #4ade80; }
.rc-kpi-trend.down { background: rgba(239, 68, 68, 0.1);  color: #f87171; }
.rc-kpi-trend.flat { background: rgba(148, 163, 184, 0.1); color: #94a3b8; }

/* ---------- Glass Card (generic) ---------- */
.rc-card {
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  padding: 20px;
}
.rc-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.rc-card-title i { color: #d4af37; font-size: 14px; }

/* ---------- Data Table ---------- */
.rc-table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.1);
}
.rc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rc-table th {
  text-align: left;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 12px;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.5);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  white-space: nowrap;
}
.rc-table td {
  padding: 10px 14px;
  color: #cbd5e1;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  vertical-align: middle;
}
.rc-table tbody tr {
  transition: background 0.15s;
}
.rc-table tbody tr:hover {
  background: rgba(148, 163, 184, 0.04);
}
.rc-table tbody tr:last-child td {
  border-bottom: none;
}

/* ---------- Tab Navigation ---------- */
.rc-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  margin-bottom: 20px;
}
.rc-tab {
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rc-tab:hover { color: #e2e8f0; }
.rc-tab.active {
  color: #d4af37;
  border-bottom-color: #d4af37;
  font-weight: 600;
}
.rc-tab-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

/* ---------- Status Badges ---------- */
.rc-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}
.rc-status-completed { background: rgba(34, 197, 94, 0.12); color: #4ade80; }
.rc-status-processing { background: rgba(245, 158, 11, 0.12); color: #fbbf24; }
.rc-status-pending    { background: rgba(148, 163, 184, 0.12); color: #94a3b8; }
.rc-status-failed     { background: rgba(239, 68, 68, 0.12);  color: #f87171; }
.rc-status-running    { background: rgba(59, 130, 246, 0.12);  color: #60a5fa; }

/* ---------- Buttons ---------- */
.rc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  text-decoration: none;
}
.rc-btn-primary {
  background: linear-gradient(135deg, #d4af37 0%, #f5d75e 100%);
  color: #1a1a2e;
  font-weight: 600;
}
.rc-btn-primary:hover {
  background: linear-gradient(135deg, #f5d75e 0%, #d4af37 100%);
  transform: translateY(-1px);
}
.rc-btn-outline {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}
.rc-btn-outline:hover {
  border-color: rgba(148, 163, 184, 0.4);
  color: #e2e8f0;
}
.rc-btn-sm {
  padding: 5px 12px;
  font-size: 12px;
}
.rc-btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.rc-btn-danger:hover {
  background: rgba(239, 68, 68, 0.25);
}

/* ---------- Empty State ---------- */
.rc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  text-align: center;
}
.rc-empty-icon {
  font-size: 48px;
  color: #334155;
  margin-bottom: 16px;
}
.rc-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 6px;
}
.rc-empty-desc {
  font-size: 13px;
  color: #64748b;
  max-width: 360px;
}

/* ---------- Loading Skeleton ---------- */
.rc-skeleton {
  background: linear-gradient(90deg, rgba(30, 41, 59, 0.5) 25%, rgba(51, 65, 85, 0.5) 50%, rgba(30, 41, 59, 0.5) 75%);
  background-size: 200% 100%;
  animation: rc-shimmer 1.5s infinite;
  border-radius: 6px;
}
@keyframes rc-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ---------- Coming Soon Page ---------- */
.rc-coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}
.rc-coming-soon-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(168, 85, 247, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: #d4af37;
  margin-bottom: 24px;
}
.rc-coming-soon-title {
  font-size: 24px;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 8px;
}
.rc-coming-soon-subtitle {
  font-size: 14px;
  color: #64748b;
  max-width: 420px;
  line-height: 1.6;
}
.rc-coming-soon-phase {
  margin-top: 20px;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(168, 85, 247, 0.12);
  color: #a855f7;
}

/* ---------- Grid utilities ---------- */
.rc-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.rc-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.rc-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
@media (max-width: 1023px) {
  .rc-grid-3 { grid-template-columns: repeat(2, 1fr); }
  .rc-grid-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 639px) {
  .rc-grid-2, .rc-grid-3, .rc-grid-4 { grid-template-columns: 1fr; }
  .rc-kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ---------- Chart placeholder ---------- */
.rc-chart-placeholder {
  width: 100%;
  height: 240px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px dashed rgba(148, 163, 184, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 13px;
}

/* ---------- Search Input ---------- */
.rc-search {
  position: relative;
  max-width: 320px;
}
.rc-search input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.5);
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.rc-search input:focus {
  border-color: rgba(212, 175, 55, 0.4);
}
.rc-search input::placeholder { color: #475569; }
.rc-search i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #475569;
  font-size: 13px;
}

/* ---------- Pagination ---------- */
.rc-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 12px;
  color: #64748b;
}
.rc-pagination-buttons {
  display: flex;
  gap: 4px;
}
.rc-pagination-btn {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.rc-pagination-btn:hover { border-color: rgba(148, 163, 184, 0.3); color: #e2e8f0; }
.rc-pagination-btn.active {
  background: rgba(212, 175, 55, 0.12);
  border-color: rgba(212, 175, 55, 0.3);
  color: #d4af37;
}
.rc-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---------- Preset button (chat) ---------- */
.rc-preset-btn {
  text-align: left;
  font-size: 11px;
  padding: 8px;
  background: rgba(71, 85, 105, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}
.rc-preset-btn:hover {
  background: rgba(71, 85, 105, 0.6);
  border-color: rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
}

/* ---------- Tooltip ---------- */
.rc-tooltip {
  position: relative;
}
.rc-tooltip::after {
  content: attr(data-tip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.rc-tooltip:hover::after { opacity: 1; }

/* ---------- Form elements ---------- */
.rc-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.5);
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.rc-input:focus { border-color: rgba(212, 175, 55, 0.4); }
.rc-input::placeholder { color: #475569; }

.rc-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.5);
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.rc-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 6px;
}
`;

// ============================================================
// 2. Component Generators (Server-side TypeScript → HTML strings)
// ============================================================

/** KPI Card */
export interface RagKpiCardProps {
  id?: string;
  icon: string;
  color: string;
  value: string;
  label: string;
  trend?: { direction: 'up' | 'down' | 'flat'; text: string };
}

export function ragKpiCard(props: RagKpiCardProps): string {
  const { icon, color, value, label, trend } = props;
  let trendHtml = '';
  if (trend) {
    const arrow = trend.direction === 'up' ? '<i class="fas fa-arrow-up"></i>'
                : trend.direction === 'down' ? '<i class="fas fa-arrow-down"></i>'
                : '<i class="fas fa-minus"></i>';
    trendHtml = `<div class="rc-kpi-trend ${trend.direction}">${arrow} ${trend.text}</div>`;
  }
  return `
  <div class="rc-kpi-card">
    <div class="rc-kpi-icon ${color}"><i class="${icon}"></i></div>
    <div class="rc-kpi-value">${value}</div>
    <div class="rc-kpi-label">${label}</div>
    ${trendHtml}
  </div>`;
}

/** Page Header with optional breadcrumb */
export function ragPageHeader(opts: {
  title: string;
  icon: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: string;
}): string {
  let bcHtml = '';
  if (opts.breadcrumbs && opts.breadcrumbs.length > 0) {
    const parts = opts.breadcrumbs.map((b, i) => {
      const isLast = i === opts.breadcrumbs!.length - 1;
      if (isLast || !b.href) return `<span>${b.label}</span>`;
      return `<a href="${b.href}">${b.label}</a><span class="rc-breadcrumb-sep">/</span>`;
    }).join('');
    bcHtml = `<div class="rc-breadcrumb">${parts}</div>`;
  }
  const subtitleHtml = opts.subtitle ? `<div class="rc-page-subtitle">${opts.subtitle}</div>` : '';
  const actionsHtml = opts.actions || '';
  return `
  <div class="rc-page-header">
    ${bcHtml}
    <div class="rc-page-header-row">
      <div>
        <h1 class="rc-page-title"><i class="${opts.icon}"></i> ${opts.title}</h1>
        ${subtitleHtml}
      </div>
      <div>${actionsHtml}</div>
    </div>
  </div>`;
}

/** Coming Soon placeholder */
export function ragComingSoon(opts: {
  title: string;
  icon: string;
  description: string;
  phase: string;
}): string {
  return `
  <div class="rc-coming-soon">
    <div class="rc-coming-soon-icon"><i class="${opts.icon}"></i></div>
    <div class="rc-coming-soon-title">${opts.title}</div>
    <div class="rc-coming-soon-subtitle">${opts.description}</div>
    <div class="rc-coming-soon-phase">计划于 ${opts.phase} 交付</div>
  </div>`;
}

/** Empty state */
export function ragEmptyState(opts: {
  icon: string;
  title: string;
  description?: string;
  action?: string;
}): string {
  return `
  <div class="rc-empty">
    <div class="rc-empty-icon"><i class="${opts.icon}"></i></div>
    <div class="rc-empty-title">${opts.title}</div>
    ${opts.description ? `<div class="rc-empty-desc">${opts.description}</div>` : ''}
    ${opts.action || ''}
  </div>`;
}

/** Status badge */
export function ragStatusBadge(status: string): string {
  const map: Record<string, string> = {
    completed: 'rc-status-completed',
    processing: 'rc-status-processing',
    pending: 'rc-status-pending',
    failed: 'rc-status-failed',
    running: 'rc-status-running',
  };
  const labels: Record<string, string> = {
    completed: '已完成',
    processing: '处理中',
    pending: '待处理',
    failed: '失败',
    running: '运行中',
  };
  const cls = map[status] || 'rc-status-pending';
  const label = labels[status] || status;
  return `<span class="rc-status ${cls}">${label}</span>`;
}
