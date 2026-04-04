/**
 * 侧边栏组件
 * 
 * 菜单项基于 UI0308 设计稿 + Figma 设计
 * 支持当前页面高亮、徽章显示、分组标签
 */

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string;
  badgeType?: 'default' | 'new' | 'soon';
  section?: string;
}

// 侧边栏菜单配置 — 基于 UI0308 最终定义
export const sidebarMenuItems: SidebarMenuItem[] = [
  // ---- 核心功能 ----
  { id: 'dashboard',  label: '仪表盘',     icon: 'fas fa-th-large',         href: '/dashboard',   section: '核心' },
  { id: 'markets',    label: '市场概览',   icon: 'fas fa-chart-area',       href: '/markets',     section: '核心', badge: 'New', badgeType: 'new' },
  { id: 'analysis',   label: 'AI 分析',    icon: 'fas fa-robot',            href: '/analysis',    section: '核心' },

  // ---- 我的 ----
  { id: 'my-reports', label: '我的报告',   icon: 'fas fa-file-alt',         href: '/my-reports',  section: '我的' },
  { id: 'favorites',  label: '我的收藏',   icon: 'fas fa-star',             href: '/favorites',   section: '我的' },
  { id: 'watchlist',  label: '自选股',     icon: 'fas fa-eye',              href: '/watchlist',   section: '我的', badge: 'Soon', badgeType: 'soon' },

  // ---- 工具 ----
  { id: 'rag',        label: 'RAG 知识库', icon: 'fas fa-brain',            href: '/rag/dashboard', section: '工具', badge: 'New', badgeType: 'new' },
  { id: 'screener',   label: '选股器',     icon: 'fas fa-filter',           href: '/screener',    section: '工具', badge: 'Soon', badgeType: 'soon' },
  { id: 'alerts',     label: '提醒',       icon: 'fas fa-bell',             href: '/alerts',      section: '工具', badge: 'Soon', badgeType: 'soon' },

  // ---- 系统 ----
  { id: 'settings',   label: '设置',       icon: 'fas fa-cog',              href: '/settings',    section: '系统' },
];

/**
 * 生成侧边栏 HTML
 * @param activePath - 当前页面路径，用于高亮对应菜单项
 */
export function generateSidebar(activePath: string): string {
  let currentSection = '';
  let menuHtml = '';

  for (const item of sidebarMenuItems) {
    // 分组标签
    if (item.section && item.section !== currentSection) {
      currentSection = item.section;
      menuHtml += `<div class="sidebar-section-label">${currentSection}</div>`;
    }

    // 判断是否高亮
    const isActive = activePath === item.href || 
                     (item.href !== '/' && activePath.startsWith(item.href));
    const activeClass = isActive ? ' active' : '';

    // 徽章
    let badgeHtml = '';
    if (item.badge) {
      const badgeClass = item.badgeType === 'new' ? 'badge badge-new' 
                       : item.badgeType === 'soon' ? 'badge badge-soon'
                       : 'badge';
      badgeHtml = `<span class="${badgeClass}">${item.badge}</span>`;
    }

    menuHtml += `
      <a href="${item.href}" class="sidebar-item${activeClass}" data-page="${item.id}" data-tooltip="${item.label}">
        <i class="${item.icon}"></i>
        <span class="sidebar-item-label">${item.label}</span>
        ${badgeHtml}
      </a>`;
  }

  return `
  <aside class="app-sidebar" id="appSidebar">
    <div class="sidebar-collapse-toggle" id="sidebarCollapseToggle" onclick="toggleSidebarCollapse()" title="收起/展开侧边栏">
      <i class="fas fa-chevron-left" id="sidebarCollapseIcon"></i>
    </div>
    <nav class="sidebar-nav">
      ${menuHtml}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebarUser" onclick="toggleSidebarUserMenu()">
        <div class="sidebar-user-avatar" id="sidebarUserAvatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name" id="sidebarUserName">未登录</div>
          <div class="sidebar-user-tier" id="sidebarUserTier">免费版</div>
        </div>
      </div>
    </div>
  </aside>
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>`;
}

// 侧边栏控制脚本 (客户端 JS)
export const sidebarScript = `
  function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('visible');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }
  }

  function closeSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }

  // ---- 侧边栏折叠/展开 ----
  function toggleSidebarCollapse() {
    // 仅桌面端 (>= 1024px) 生效
    if (window.innerWidth < 1024) return;

    const sidebar = document.getElementById('appSidebar');
    const mainContent = document.querySelector('.app-main');
    const collapseIcon = document.getElementById('sidebarCollapseIcon');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (mainContent) mainContent.classList.toggle('sidebar-collapsed', isCollapsed);
    if (collapseIcon) {
      collapseIcon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    }
    // 持久化状态
    localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
  }

  // 初始化折叠状态
  function initSidebarCollapse() {
    if (window.innerWidth < 1024) return;
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === '1') {
      const sidebar = document.getElementById('appSidebar');
      const mainContent = document.querySelector('.app-main');
      const collapseIcon = document.getElementById('sidebarCollapseIcon');
      if (sidebar) sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('sidebar-collapsed');
      if (collapseIcon) collapseIcon.className = 'fas fa-chevron-right';
    }
  }

  // 键盘快捷键 Ctrl+B / Cmd+B 切换折叠
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebarCollapse();
    }
  });

  function toggleSidebarUserMenu() {
    // 后续扩展: 弹出用户菜单
    window.location.href = '/settings';
  }

  // 侧边栏用户状态更新
  function updateSidebarUser(user) {
    const nameEl = document.getElementById('sidebarUserName');
    const tierEl = document.getElementById('sidebarUserTier');
    const avatarEl = document.getElementById('sidebarUserAvatar');
    if (nameEl && user) {
      nameEl.textContent = user.name || user.email || '用户';
      if (tierEl) {
        const tierMap = { free: '免费版', pro: 'Pro 会员', enterprise: '企业版' };
        tierEl.textContent = tierMap[user.tier] || '免费版';
      }
      if (avatarEl && user.name) {
        avatarEl.textContent = user.name.charAt(0).toUpperCase();
        avatarEl.innerHTML = user.name.charAt(0).toUpperCase();
      }
    }
  }

  // 响应式: 窗口变化时自动关闭侧边栏 & 恢复折叠
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      closeSidebar();
      // 恢复桌面折叠状态
      initSidebarCollapse();
    } else {
      // 移动端: 移除折叠类
      const sidebar = document.getElementById('appSidebar');
      const mainContent = document.querySelector('.app-main');
      if (sidebar) sidebar.classList.remove('collapsed');
      if (mainContent) mainContent.classList.remove('sidebar-collapsed');
    }
  });
`;

export default generateSidebar;
