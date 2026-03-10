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
      <a href="${item.href}" class="sidebar-item${activeClass}" data-page="${item.id}">
        <i class="${item.icon}"></i>
        <span>${item.label}</span>
        ${badgeHtml}
      </a>`;
  }

  return `
  <aside class="app-sidebar" id="appSidebar">
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

  // 响应式: 窗口变化时自动关闭侧边栏
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      closeSidebar();
    }
  });
`;

export default generateSidebar;
