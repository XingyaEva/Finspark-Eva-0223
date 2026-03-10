/**
 * FinSpark 设计令牌系统
 * 基于 Figma 设计稿提取的完整设计变量
 * 
 * 颜色体系: 深色主题 + 金色强调色
 * 字体: Inter / Noto Sans SC
 * 间距: 8px 基准网格
 */

// ============ CSS 变量定义 ============
export const themeVariables = `
  :root {
    /* ---- 背景色 ---- */
    --bg-primary: #0B0F19;
    --bg-secondary: #0D1117;
    --bg-card: #151B28;
    --bg-card-hover: #1A2235;
    --bg-sidebar: #0A0E17;
    --bg-topbar: #0D1117;
    --bg-input: rgba(255, 255, 255, 0.05);
    --bg-overlay: rgba(0, 0, 0, 0.8);

    /* ---- 金色强调色 ---- */
    --gold-primary: #D4A017;
    --gold-light: #F0B90B;
    --gold-pale: #F5D17E;
    --gold-gradient: linear-gradient(135deg, #D4A017, #F0B90B);
    --gold-gradient-text: linear-gradient(135deg, #d4af37 0%, #f5d17e 50%, #d4af37 100%);
    --gold-glow: rgba(212, 175, 55, 0.3);
    --gold-border: rgba(212, 175, 55, 0.2);
    --gold-border-hover: rgba(212, 175, 55, 0.5);

    /* ---- 文字色 ---- */
    --text-primary: #FFFFFF;
    --text-secondary: #E5E7EB;
    --text-muted: #9CA3AF;
    --text-dim: #6B7280;

    /* ---- 功能色 ---- */
    --color-success: #10B981;
    --color-danger: #EF4444;
    --color-warning: #F59E0B;
    --color-info: #3B82F6;
    --color-purple: #8B5CF6;

    /* ---- 边框 ---- */
    --border-default: rgba(255, 255, 255, 0.06);
    --border-light: rgba(255, 255, 255, 0.1);
    --border-gold: rgba(212, 175, 55, 0.2);
    --border-gold-hover: rgba(212, 175, 55, 0.5);

    /* ---- 间距 ---- */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --space-xl: 32px;
    --space-2xl: 48px;
    --space-3xl: 64px;

    /* ---- 圆角 ---- */
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;

    /* ---- 阴影 ---- */
    --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.3);
    --shadow-card-hover: 0 8px 40px rgba(0, 0, 0, 0.4);
    --shadow-gold: 0 5px 20px rgba(212, 175, 55, 0.4);
    --shadow-sidebar: 4px 0 24px rgba(0, 0, 0, 0.3);

    /* ---- 布局 ---- */
    --sidebar-width: 240px;
    --sidebar-collapsed-width: 64px;
    --topbar-height: 56px;
    --content-max-width: 1400px;

    /* ---- 字体 ---- */
    --font-primary: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

    /* ---- 动效 ---- */
    --transition-fast: 0.15s ease;
    --transition-normal: 0.3s ease;
    --transition-slow: 0.5s ease;
  }
`;

// ============ 共享基础样式 ============
export const baseStyles = `
  ${themeVariables}

  * { box-sizing: border-box; }

  body {
    font-family: var(--font-primary);
    background: var(--bg-primary);
    color: var(--text-primary);
    margin: 0;
    padding: 0;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  a { color: inherit; text-decoration: none; }

  /* ---- 金色文字 ---- */
  .gold-text { color: var(--gold-primary); }
  .gold-gradient {
    background: var(--gold-gradient-text);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ---- 按钮 ---- */
  .btn-gold {
    background: var(--gold-gradient);
    color: #0a0a0a;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all var(--transition-normal);
  }
  .btn-gold:hover {
    transform: scale(1.02);
    box-shadow: var(--shadow-gold);
  }

  .btn-outline {
    border: 1px solid var(--border-gold-hover);
    color: var(--gold-primary);
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-normal);
  }
  .btn-outline:hover {
    background: rgba(212, 175, 55, 0.1);
  }

  /* ---- 卡片 ---- */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-gold);
    border-radius: var(--radius-lg);
    transition: all var(--transition-normal);
  }
  .card:hover {
    border-color: var(--border-gold-hover);
  }

  /* ---- 弹窗 ---- */
  .modal {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg-overlay);
    z-index: 100;
  }
  .modal.active {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ---- 输入框 ---- */
  .input-field {
    background: var(--bg-input);
    border: 1px solid var(--border-light);
    color: var(--text-primary);
    transition: border-color var(--transition-normal);
  }
  .input-field:focus {
    border-color: var(--gold-primary);
    outline: none;
  }

  /* ---- 进度条 ---- */
  .progress-bar {
    background: linear-gradient(90deg, var(--gold-primary) 0%, var(--gold-pale) 100%);
  }

  /* ---- 加载动画 ---- */
  .loading-spinner {
    border: 3px solid rgba(212, 175, 55, 0.2);
    border-top-color: var(--gold-primary);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

  /* ---- 滚动条 ---- */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

export default baseStyles;
