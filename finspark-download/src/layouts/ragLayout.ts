/**
 * RAG 平台布局 (RAG Platform Layout)
 *
 * 用于 RAG 子平台的所有页面 (/rag/*)
 * 结构: RAG 侧边栏 + 内容区（无顶栏，侧边栏自带 Logo）
 *
 * 使用方式:
 *   import { wrapWithRagLayout } from '../layouts/ragLayout';
 *   const html = wrapWithRagLayout({
 *     title: 'Dashboard',
 *     activePath: '/rag/dashboard',
 *     body: '<h1>Dashboard Content</h1>',
 *   });
 */

import { generateRagSidebar, ragSidebarStyles, ragSidebarScript } from '../components/ragSidebar';
import { ragCommonStyles } from '../components/ragCommon';

export interface RagLayoutOptions {
  /** Browser tab title */
  title: string;
  /** Current route path for sidebar highlighting */
  activePath: string;
  /** Extra <head> tags (CDN, meta, etc.) */
  head?: string;
  /** Page-specific CSS */
  styles?: string;
  /** Page main body HTML */
  body: string;
  /** Page-specific JavaScript */
  scripts?: string;
}

/**
 * Wrap page content with the RAG platform layout
 */
export function wrapWithRagLayout(options: RagLayoutOptions): string {
  const {
    title,
    activePath,
    head = '',
    styles = '',
    body,
    scripts = '',
  } = options;

  const sidebar = generateRagSidebar(activePath);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - RAG 平台 - FinSpark</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap" rel="stylesheet">
  ${head}
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      color: #e2e8f0;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.4); border-radius: 3px; }

    ${ragSidebarStyles}
    ${ragCommonStyles}
    ${styles}
  </style>
</head>
<body>
  <div class="rag-layout">
    ${sidebar}
    <main class="rag-main">
      ${body}
    </main>
  </div>

  <script>
    // RAG sidebar controls
    ${ragSidebarScript}

    // Auth helpers
    function getToken() { return localStorage.getItem('auth_token') || localStorage.getItem('accessToken'); }
    function getAuthHeaders() {
      var token = getToken();
      return token ? { 'Authorization': 'Bearer ' + token } : {};
    }

    // Page scripts
    ${scripts}
  </script>
</body>
</html>`;
}

export default wrapWithRagLayout;
