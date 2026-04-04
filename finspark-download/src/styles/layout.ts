/**
 * 布局样式系统
 * 侧边栏 + 顶栏 + 内容区的 CSS
 * 
 * 布局结构:
 * ┌──────────────────────────────────────────┐
 * │  topbar (fixed, full width, h=56px)      │
 * ├────────────┬─────────────────────────────┤
 * │  sidebar   │  main-content               │
 * │  w=240px   │  flex-1, scrollable         │
 * │  fixed     │  padding-top: 56px          │
 * │            │                             │
 * └────────────┴─────────────────────────────┘
 */

export const layoutStyles = `
  /* ============================================
   * 应用壳 - 顶层容器
   * ============================================ */
  .app-shell {
    display: flex;
    min-height: 100vh;
    background: var(--bg-primary);
  }

  /* ============================================
   * 顶栏
   * ============================================ */
  .app-topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--topbar-height);
    background: var(--bg-topbar);
    border-bottom: 1px solid var(--border-default);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-lg);
    z-index: 40;
    backdrop-filter: blur(12px);
  }

  .app-topbar .topbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .app-topbar .topbar-logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 18px;
    font-weight: 700;
    white-space: nowrap;
  }

  .app-topbar .topbar-search {
    flex: 1;
    max-width: 480px;
    margin: 0 var(--space-xl);
  }

  .app-topbar .topbar-search input {
    width: 100%;
    height: 36px;
    padding: 0 var(--space-md) 0 40px;
    background: var(--bg-input);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 14px;
    transition: border-color var(--transition-normal);
  }
  .app-topbar .topbar-search input:focus {
    border-color: var(--gold-primary);
    outline: none;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.15);
  }
  .app-topbar .topbar-search input::placeholder {
    color: var(--text-dim);
  }

  .app-topbar .topbar-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-dim);
    font-size: 14px;
    pointer-events: none;
  }

  .app-topbar .topbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .topbar-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    font-size: 13px;
    color: var(--text-muted);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-normal);
    white-space: nowrap;
  }
  .topbar-action-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-gold);
    background: rgba(212, 175, 55, 0.05);
  }

  .topbar-icon-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-normal);
    background: transparent;
    border: none;
  }
  .topbar-icon-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
  }

  .topbar-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--gold-primary), var(--gold-light));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: #0a0a0a;
    cursor: pointer;
    transition: box-shadow var(--transition-normal);
  }
  .topbar-avatar:hover {
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.4);
  }

  /* ============================================
   * 侧边栏
   * ============================================ */
  .app-sidebar {
    position: fixed;
    top: var(--topbar-height);
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border-default);
    display: flex;
    flex-direction: column;
    z-index: 30;
    overflow-y: auto;
    overflow-x: hidden;
    transition: width var(--transition-normal), transform var(--transition-normal);
  }

  .app-sidebar::-webkit-scrollbar { width: 4px; }
  .app-sidebar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }

  /* 侧边栏导航 */
  .sidebar-nav {
    flex: 1;
    padding: var(--space-md) var(--space-sm);
  }

  .sidebar-section-label {
    padding: var(--space-md) var(--space-md) var(--space-xs);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: 10px var(--space-md);
    margin: 2px 0;
    border-radius: var(--radius-md);
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
    text-decoration: none;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }

  .sidebar-item i {
    width: 20px;
    text-align: center;
    font-size: 15px;
    flex-shrink: 0;
  }

  .sidebar-item span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-item:hover {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.04);
  }

  .sidebar-item.active {
    color: var(--gold-primary);
    background: rgba(212, 175, 55, 0.08);
    font-weight: 500;
  }
  .sidebar-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--gold-primary);
    border-radius: 0 3px 3px 0;
  }

  .sidebar-item .badge {
    margin-left: auto;
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 10px;
    background: rgba(212, 175, 55, 0.15);
    color: var(--gold-primary);
  }
  .sidebar-item .badge-new {
    background: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }
  .sidebar-item .badge-soon {
    background: rgba(107, 114, 128, 0.2);
    color: var(--text-dim);
    font-size: 10px;
  }

  /* 侧边栏底部 */
  .sidebar-footer {
    padding: var(--space-md);
    border-top: 1px solid var(--border-default);
  }

  .sidebar-user {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-sm);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .sidebar-user:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .sidebar-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--gold-primary), var(--gold-light));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #0a0a0a;
    flex-shrink: 0;
  }

  .sidebar-user-info {
    flex: 1;
    min-width: 0;
  }
  .sidebar-user-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar-user-tier {
    font-size: 11px;
    color: var(--text-dim);
  }

  /* ============================================
   * 侧边栏折叠按钮
   * ============================================ */
  .sidebar-collapse-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-dim);
    cursor: pointer;
    transition: all var(--transition-fast);
    z-index: 5;
    border: 1px solid transparent;
    font-size: 12px;
  }
  .sidebar-collapse-toggle:hover {
    background: rgba(212, 175, 55, 0.12);
    color: var(--gold-primary);
    border-color: var(--border-gold);
  }

  /* ============================================
   * 侧边栏折叠状态
   * ============================================ */
  .app-sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }
  .app-sidebar.collapsed .sidebar-collapse-toggle {
    right: 50%;
    transform: translateX(50%);
    top: 8px;
  }
  .app-sidebar.collapsed .sidebar-nav {
    padding: var(--space-md) 6px;
  }
  .app-sidebar.collapsed .sidebar-section-label {
    opacity: 0;
    height: 0;
    padding: 0;
    margin: 0;
    overflow: hidden;
    transition: all var(--transition-fast);
  }
  .app-sidebar.collapsed .sidebar-item {
    justify-content: center;
    padding: 10px 0;
    margin: 2px 4px;
    position: relative;
  }
  .app-sidebar.collapsed .sidebar-item i {
    width: auto;
    font-size: 17px;
  }
  .app-sidebar.collapsed .sidebar-item .sidebar-item-label {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .app-sidebar.collapsed .sidebar-item .badge {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .app-sidebar.collapsed .sidebar-item.active::before {
    top: 8px;
    bottom: 8px;
  }

  /* 折叠状态 tooltip (hover 显示) */
  .app-sidebar.collapsed .sidebar-item::after {
    content: attr(data-tooltip);
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    padding: 6px 12px;
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-gold);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
    z-index: 50;
    pointer-events: none;
  }
  .app-sidebar.collapsed .sidebar-item:hover::after {
    opacity: 1;
    visibility: visible;
  }

  /* 折叠状态底部用户区 */
  .app-sidebar.collapsed .sidebar-footer {
    padding: var(--space-sm) 6px;
  }
  .app-sidebar.collapsed .sidebar-user {
    justify-content: center;
    padding: var(--space-sm) 0;
  }
  .app-sidebar.collapsed .sidebar-user-info {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }

  /* ============================================
   * 主内容区
   * ============================================ */
  .app-main {
    flex: 1;
    margin-left: var(--sidebar-width);
    margin-top: var(--topbar-height);
    min-height: calc(100vh - var(--topbar-height));
    padding: var(--space-lg);
    overflow-x: hidden;
    transition: margin-left var(--transition-normal);
  }
  .app-main.sidebar-collapsed {
    margin-left: var(--sidebar-collapsed-width);
  }

  .app-main-inner {
    max-width: var(--content-max-width);
    margin: 0 auto;
    width: 100%;
  }

  /* ============================================
   * 移动端响应式
   * ============================================ */

  /* 移动端侧边栏遮罩 */
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 25;
    opacity: 0;
    transition: opacity var(--transition-normal);
  }
  .sidebar-overlay.visible {
    display: block;
    opacity: 1;
  }

  /* 移动端汉堡按钮 */
  .mobile-menu-toggle {
    display: none;
    width: 36px;
    height: 36px;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    border-radius: var(--radius-md);
    cursor: pointer;
    background: transparent;
    border: none;
    font-size: 18px;
  }
  .mobile-menu-toggle:hover {
    color: var(--text-primary);
  }

  /* 平板 (< 1024px): 侧边栏可折叠 */
  @media (max-width: 1023px) {
    .mobile-menu-toggle {
      display: flex;
    }

    .sidebar-collapse-toggle {
      display: none;
    }

    .app-sidebar {
      transform: translateX(-100%);
      box-shadow: none;
      width: var(--sidebar-width);
    }
    .app-sidebar.collapsed {
      width: var(--sidebar-width);
    }
    .app-sidebar.open {
      transform: translateX(0);
      box-shadow: var(--shadow-sidebar);
    }

    .app-main {
      margin-left: 0;
    }
    .app-main.sidebar-collapsed {
      margin-left: 0;
    }

    .app-topbar .topbar-search {
      max-width: 300px;
      margin: 0 var(--space-md);
    }
  }

  /* 手机 (< 640px) */
  @media (max-width: 639px) {
    .app-topbar {
      padding: 0 var(--space-md);
    }
    .app-topbar .topbar-search {
      display: none;
    }
    .app-topbar .topbar-logo span {
      display: none;
    }
    .topbar-action-btn span {
      display: none;
    }
    .topbar-action-btn {
      padding: 6px 8px;
    }
    .app-main {
      padding: var(--space-md);
    }
    .app-sidebar {
      width: 280px;
    }
  }

  /* ============================================
   * 页面过渡
   * ============================================ */
  .page-enter {
    animation: pageEnter 0.3s ease;
  }
  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export default layoutStyles;
