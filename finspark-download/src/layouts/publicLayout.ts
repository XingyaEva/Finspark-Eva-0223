/**
 * 公开页面布局 (Public Layout)
 * 
 * 用于首页 Landing Page、登录页等无侧边栏的公开页面
 * 与 mainLayout 共享 theme 设计令牌，但不包含 sidebar
 */

import { baseStyles } from '../styles/theme';
import { responsiveStyles } from '../styles/responsive';

export interface PublicLayoutOptions {
  title: string;
  head?: string;
  styles?: string;
  body: string;
  scripts?: string;
}

export function wrapWithPublicLayout(options: PublicLayoutOptions): string {
  const { title, head = '', styles = '', body, scripts = '' } = options;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
  ${head}
  <style>
    ${baseStyles}
    ${responsiveStyles}

    /* 公开页专属: 全屏渐变背景 */
    body {
      background: linear-gradient(180deg, #0B0F19 0%, #0D1321 40%, #111827 100%);
    }
    .public-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }
    @media (max-width: 767px) {
      .public-container { padding: 0 16px; }
    }

    ${styles}
  </style>
</head>
<body>
  ${body}
  <script>
    // 通用认证
    function getToken() { return localStorage.getItem('accessToken'); }
    function setTokens(access, refresh) {
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
    }
    function clearTokens() {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
    }
    function getAuthHeaders() {
      const t = getToken();
      return t ? { 'Authorization': 'Bearer ' + t } : {};
    }
    ${scripts}
  </script>
</body>
</html>`;
}

export default wrapWithPublicLayout;
