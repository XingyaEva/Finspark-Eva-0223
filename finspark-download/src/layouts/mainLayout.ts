/**
 * 主布局 (Main Layout)
 * 
 * 用于应用内页 (Dashboard, Markets, Analysis, Reports 等)
 * 结构: 顶栏 + 侧边栏 + 内容区
 * 
 * 使用方式:
 *   import { wrapWithMainLayout } from '../layouts/mainLayout';
 *   const html = wrapWithMainLayout({
 *     title: '页面标题',
 *     activePath: '/analysis',
 *     head: '额外 <head> 内容',
 *     styles: '页面专属 CSS',
 *     body: '页面主体 HTML',
 *     scripts: '页面专属 JS',
 *   });
 */

import { baseStyles } from '../styles/theme';
import { layoutStyles } from '../styles/layout';
import { responsiveStyles } from '../styles/responsive';
import { generateSidebar, sidebarScript } from '../components/sidebar';
import { generateTopbar, topbarSearchStyles, topbarScript } from '../components/topbar';

export interface MainLayoutOptions {
  /** 浏览器标签页标题 */
  title: string;
  /** 当前路由路径 (用于侧边栏高亮) */
  activePath: string;
  /** 额外 <head> 标签 (CDN, meta 等) */
  head?: string;
  /** 页面专属 CSS (注入到 <style> 中) */
  styles?: string;
  /** 页面主体 HTML (注入到 .app-main 中) */
  body: string;
  /** 页面专属 JavaScript (注入到 <script> 中) */
  scripts?: string;
  /** 顶栏右侧额外按钮 HTML */
  topbarActions?: string;
  /** 是否显示搜索框, 默认 true */
  showSearch?: boolean;
}

/**
 * 将页面内容包裹到主布局中
 */
export function wrapWithMainLayout(options: MainLayoutOptions): string {
  const {
    title,
    activePath,
    head = '',
    styles = '',
    body,
    scripts = '',
    topbarActions = '',
    showSearch = true,
  } = options;

  const topbar = generateTopbar({ showSearch, rightActions: topbarActions });
  const sidebar = generateSidebar(activePath);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FinSpark</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
  ${head}
  <style>
    ${baseStyles}
    ${layoutStyles}
    ${topbarSearchStyles}
    ${responsiveStyles}
    ${styles}
  </style>
</head>
<body>
  <div class="app-shell">
    ${topbar}
    ${sidebar}
    <main class="app-main">
      <div class="app-main-inner page-enter">
        ${body}
      </div>
    </main>
  </div>

  <!-- 用户下拉菜单 (在 body 层以避免 overflow 裁剪) -->
  <div class="topbar-user-dropdown" id="topbarUserDropdown">
    <a class="topbar-user-dropdown-item" href="/account">
      <i class="fas fa-user-circle"></i> 个人中心
    </a>
    <a class="topbar-user-dropdown-item" href="/settings">
      <i class="fas fa-cog"></i> 设置
    </a>
    <a class="topbar-user-dropdown-item" href="/membership">
      <i class="fas fa-crown"></i> 会员中心
    </a>
    <div class="topbar-user-dropdown-divider"></div>
    <a class="topbar-user-dropdown-item" href="#" onclick="logoutFromApp(); return false;" style="color: var(--color-danger);">
      <i class="fas fa-sign-out-alt"></i> 退出登录
    </a>
  </div>

  <script>
    // ---- 侧边栏控制 ----
    ${sidebarScript}

    // ---- 顶栏控制 ----
    ${topbarScript}

    // ---- 通用认证逻辑 ----
    function getToken() {
      return localStorage.getItem('auth_token');
    }
    function setTokens(token, refreshToken) {
      localStorage.setItem('auth_token', token);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    }
    function clearTokens() {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
    function getAuthHeaders() {
      const token = getToken();
      return token ? { 'Authorization': 'Bearer ' + token } : {};
    }
    function logoutFromApp() {
      clearTokens();
      window.location.href = '/';
    }

    // 检查登录状态并更新 UI
    async function checkLayoutAuth() {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch('/api/user/profile', {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            // 更新顶栏头像
            const avatar = document.getElementById('topbarAvatar');
            if (avatar && data.user.name) {
              avatar.textContent = data.user.name.charAt(0).toUpperCase();
            }
            // 更新侧边栏用户信息
            if (typeof updateSidebarUser === 'function') {
              updateSidebarUser({
                name: data.user.name,
                email: data.user.email,
                tier: data.user.subscription_tier || data.user.subscriptionTier || 'free'
              });
            }
          }
        }
      } catch (e) {
        console.warn('Auth check failed:', e);
      }
    }

    // 初始化
    document.addEventListener('DOMContentLoaded', () => {
      checkLayoutAuth();
      // 恢复侧边栏折叠状态
      if (typeof initSidebarCollapse === 'function') {
        initSidebarCollapse();
      }
    });

    // ---- 页面专属脚本 ----
    ${scripts}
  </script>
</body>
</html>`;
}

export default wrapWithMainLayout;
