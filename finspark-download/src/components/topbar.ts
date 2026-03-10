/**
 * 顶部导航栏组件
 * 
 * 基于 Figma 设计稿: 深色导航栏 + 金色 Logo + 搜索框 + 功能按钮 + 用户头像
 * 用于 mainLayout 中的 sidebar 布局页面
 */

export interface TopbarOptions {
  /** 页面标题 (可选, 不显示则仅显示 logo) */
  title?: string;
  /** 是否显示搜索框 */
  showSearch?: boolean;
  /** 右侧额外按钮 HTML */
  rightActions?: string;
}

/**
 * 生成顶部导航栏 HTML
 */
export function generateTopbar(options: TopbarOptions = {}): string {
  const { showSearch = true, rightActions = '' } = options;

  const searchHtml = showSearch ? `
    <div class="topbar-search" style="position: relative;">
      <i class="fas fa-search topbar-search-icon"></i>
      <input type="text" 
             id="topbarSearchInput"
             placeholder="搜索股票代码或名称..." 
             autocomplete="off"
             onkeyup="handleTopbarSearch(event)" />
      <div id="topbarSearchResults" class="topbar-search-dropdown" style="display: none;"></div>
    </div>` : '';

  return `
  <header class="app-topbar">
    <div class="topbar-left">
      <button class="mobile-menu-toggle" onclick="toggleSidebar()" aria-label="菜单">
        <i class="fas fa-bars"></i>
      </button>
      <a href="/" class="topbar-logo">
        <i class="fas fa-chart-line gold-text"></i>
        <span class="gold-gradient">FinSpark</span>
      </a>
    </div>

    ${searchHtml}

    <div class="topbar-right">
      ${rightActions}
      <button class="topbar-icon-btn" title="通知" onclick="showNotifications()">
        <i class="fas fa-bell"></i>
      </button>
      <div class="topbar-avatar" id="topbarAvatar" onclick="toggleTopbarUserMenu()" title="账户">
        <i class="fas fa-user" style="font-size: 14px;"></i>
      </div>
    </div>
  </header>`;
}

// 顶栏搜索下拉样式
export const topbarSearchStyles = `
  .topbar-search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-card);
    border: 1px solid var(--border-gold);
    border-radius: var(--radius-md);
    max-height: 360px;
    overflow-y: auto;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .topbar-search-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px var(--space-md);
    cursor: pointer;
    transition: background var(--transition-fast);
    border-bottom: 1px solid var(--border-default);
  }
  .topbar-search-item:last-child { border-bottom: none; }
  .topbar-search-item:hover {
    background: rgba(212, 175, 55, 0.08);
  }
  .topbar-search-item .stock-name {
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 500;
  }
  .topbar-search-item .stock-code {
    font-size: 12px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }
  .topbar-search-item .stock-market {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(59, 130, 246, 0.15);
    color: var(--color-info);
  }

  /* 顶栏用户下拉菜单 */
  .topbar-user-dropdown {
    position: absolute;
    top: calc(var(--topbar-height) - 4px);
    right: var(--space-lg);
    width: 220px;
    background: var(--bg-card);
    border: 1px solid var(--border-gold);
    border-radius: var(--radius-lg);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    z-index: 100;
    display: none;
    padding: var(--space-sm) 0;
  }
  .topbar-user-dropdown.active { display: block; }

  .topbar-user-dropdown-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px var(--space-md);
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-decoration: none;
  }
  .topbar-user-dropdown-item:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.04);
  }
  .topbar-user-dropdown-item i { width: 18px; text-align: center; }
  .topbar-user-dropdown-divider {
    height: 1px;
    background: var(--border-default);
    margin: var(--space-xs) 0;
  }
`;

// 顶栏客户端脚本
export const topbarScript = `
  let topbarSearchTimer = null;

  function handleTopbarSearch(event) {
    const query = event.target.value.trim();
    const resultsEl = document.getElementById('topbarSearchResults');
    
    if (!query || query.length < 1) {
      if (resultsEl) resultsEl.style.display = 'none';
      return;
    }

    // 防抖
    clearTimeout(topbarSearchTimer);
    topbarSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch('/api/search-stocks?q=' + encodeURIComponent(query));
        if (!res.ok) return;
        const data = await res.json();
        if (resultsEl && data.stocks && data.stocks.length > 0) {
          resultsEl.innerHTML = data.stocks.slice(0, 8).map(s => 
            '<div class="topbar-search-item" onclick="navigateToStock(\\'' + s.ts_code + '\\', \\'' + (s.name || '') + '\\')">' +
              '<div><div class="stock-name">' + (s.name || s.ts_code) + '</div>' +
              '<div class="stock-code">' + s.ts_code + '</div></div>' +
              '<span class="stock-market">' + (s.market || 'A股') + '</span>' +
            '</div>'
          ).join('');
          resultsEl.style.display = 'block';
        } else if (resultsEl) {
          resultsEl.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-dim); font-size: 13px;">未找到匹配的股票</div>';
          resultsEl.style.display = 'block';
        }
      } catch (e) {
        console.error('Search error:', e);
      }
    }, 300);

    // Enter 键直接搜索
    if (event.key === 'Enter' && query) {
      navigateToStock(query, '');
    }
  }

  function navigateToStock(code, name) {
    const resultsEl = document.getElementById('topbarSearchResults');
    if (resultsEl) resultsEl.style.display = 'none';
    window.location.href = '/analysis?code=' + encodeURIComponent(code) + (name ? '&name=' + encodeURIComponent(name) : '');
  }

  function showNotifications() {
    // 后续扩展: 通知中心
    alert('通知功能即将上线');
  }

  function toggleTopbarUserMenu() {
    const dropdown = document.getElementById('topbarUserDropdown');
    if (dropdown) {
      dropdown.classList.toggle('active');
    }
  }

  // 点击外部关闭菜单
  document.addEventListener('click', (e) => {
    // 关闭搜索下拉
    const searchInput = document.getElementById('topbarSearchInput');
    const searchResults = document.getElementById('topbarSearchResults');
    if (searchResults && searchInput && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.style.display = 'none';
    }
    // 关闭用户下拉
    const avatar = document.getElementById('topbarAvatar');
    const userDropdown = document.getElementById('topbarUserDropdown');
    if (userDropdown && avatar && !avatar.contains(e.target) && !userDropdown.contains(e.target)) {
      userDropdown.classList.remove('active');
    }
  });
`;

export default generateTopbar;
