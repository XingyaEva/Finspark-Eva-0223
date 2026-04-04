/**
 * RAG 平台侧边栏组件
 *
 * 基于 RAG_PLATFORM_UI_SPEC.md 的 17 页导航结构 (P.0 ~ P.16)
 * 左侧固定侧边栏，分组折叠，当前页高亮，徽章显示
 */

// ============================================================
// Types
// ============================================================

export interface RagSidebarItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  /** Phase 标记：P1=Phase 1 交付, P2/P3/P4=后续交付 */
  phase: 'P1' | 'P2' | 'P3' | 'P4';
  badge?: string;
  badgeType?: 'active' | 'soon' | 'new';
}

export interface RagSidebarGroup {
  id: string;
  label: string;
  icon: string;
  items: RagSidebarItem[];
}

// ============================================================
// Navigation Config — 17 Pages (P.0 ~ P.16)
// ============================================================

export const ragSidebarGroups: RagSidebarGroup[] = [
  // ---------- Top-level ----------
  {
    id: 'overview',
    label: '',
    icon: '',
    items: [
      { id: 'dashboard',       label: '仪表盘总览',       icon: 'fas fa-tachometer-alt',  href: '/rag/dashboard',         phase: 'P1', badge: 'P1', badgeType: 'active' },
    ],
  },

  // ---------- 数据管理 ----------
  {
    id: 'data',
    label: '数据管理',
    icon: 'fas fa-database',
    items: [
      { id: 'upload',          label: '文档上传与解析',   icon: 'fas fa-cloud-upload-alt', href: '/rag/upload',            phase: 'P1', badge: 'P1', badgeType: 'active' },
      { id: 'knowledge-base',  label: '知识库浏览器',     icon: 'fas fa-book-open',        href: '/rag/knowledge-base',    phase: 'P1', badge: 'P1', badgeType: 'active' },
      { id: 'chunk-enhance',   label: 'Chunk 质量增强',   icon: 'fas fa-magic',            href: '/rag/chunk-enhance',     phase: 'P3' },
      { id: 'knowledge-settle',label: '对话知识沉淀',     icon: 'fas fa-archive',          href: '/rag/knowledge-settle',  phase: 'P4' },
    ],
  },

  // ---------- 检索与问答 ----------
  {
    id: 'retrieval',
    label: '检索与问答',
    icon: 'fas fa-search',
    items: [
      { id: 'chat',            label: '对话助手',         icon: 'fas fa-comments',         href: '/rag/chat',              phase: 'P1', badge: 'P1', badgeType: 'active' },
      { id: 'retrieval-debug', label: '检索调试台',       icon: 'fas fa-flask',            href: '/rag/retrieval-debug',   phase: 'P2', badge: 'P2', badgeType: 'new' },
    ],
  },

  // ---------- 评测中心 ----------
  {
    id: 'evaluation',
    label: '评测中心',
    icon: 'fas fa-vial',
    items: [
      { id: 'test-sets',       label: '测试集管理',       icon: 'fas fa-clipboard-list',   href: '/rag/test-sets',         phase: 'P2' },
      { id: 'evaluation',      label: '批量评测与打分',   icon: 'fas fa-chart-bar',        href: '/rag/evaluation',        phase: 'P2' },
      { id: 'health-check',    label: '知识库健康度检查', icon: 'fas fa-heartbeat',        href: '/rag/health-check',      phase: 'P4' },
    ],
  },

  // ---------- 版本管理 ----------
  {
    id: 'versions',
    label: '版本管理',
    icon: 'fas fa-code-branch',
    items: [
      { id: 'versions',        label: '版本与性能对比',   icon: 'fas fa-code-branch',      href: '/rag/versions',          phase: 'P4' },
    ],
  },

  // ---------- 日志与追踪 ----------
  {
    id: 'logs',
    label: '日志与追踪',
    icon: 'fas fa-clipboard-list',
    items: [
      { id: 'logs-chat',       label: '对话日志',         icon: 'fas fa-history',          href: '/rag/logs/chat',         phase: 'P2', badge: 'P2', badgeType: 'new' },
      { id: 'logs-intent',     label: '意图识别日志',     icon: 'fas fa-crosshairs',       href: '/rag/logs/intent',       phase: 'P2', badge: 'P2', badgeType: 'new' },
      { id: 'logs-pipeline',   label: 'Pipeline 追踪',    icon: 'fas fa-stream',           href: '/rag/logs/pipeline',     phase: 'P2', badge: 'P2', badgeType: 'new' },
    ],
  },

  // ---------- 平台设置 ----------
  {
    id: 'settings',
    label: '平台设置',
    icon: 'fas fa-cog',
    items: [
      { id: 'settings-models', label: '模型与 Provider',  icon: 'fas fa-server',           href: '/rag/settings/models',   phase: 'P3' },
      { id: 'settings-prompts',label: 'Prompt 模板管理',  icon: 'fas fa-file-code',        href: '/rag/settings/prompts',  phase: 'P3' },
      { id: 'settings-system', label: '系统配置',         icon: 'fas fa-sliders-h',        href: '/rag/settings/system',   phase: 'P3' },
    ],
  },
];

// ============================================================
// CSS styles for the RAG sidebar
// ============================================================

export const ragSidebarStyles = `
/* ======== RAG Platform Layout ======== */
.rag-layout {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
}

/* ======== RAG Sidebar ======== */
.rag-sidebar {
  width: 260px;
  min-width: 260px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(148, 163, 184, 0.1);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 40;
  overflow-y: auto;
  overflow-x: hidden;
  transition: transform 0.3s ease;
}

.rag-sidebar::-webkit-scrollbar { width: 4px; }
.rag-sidebar::-webkit-scrollbar-track { background: transparent; }
.rag-sidebar::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.3); border-radius: 2px; }

/* Sidebar Header / Logo */
.rag-sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
  flex-shrink: 0;
}
.rag-sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}
.rag-sidebar-logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: white;
}
.rag-sidebar-logo-text {
  display: flex;
  flex-direction: column;
}
.rag-sidebar-logo-title {
  font-size: 15px;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.2;
}
.rag-sidebar-logo-subtitle {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
}

/* Back to main site */
.rag-sidebar-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 12px;
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s, background 0.2s;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
}
.rag-sidebar-back:hover {
  color: #d4af37;
  background: rgba(212, 175, 55, 0.05);
}

/* Sidebar Nav Groups */
.rag-sidebar-nav {
  flex: 1;
  padding: 8px 0;
}

.rag-sidebar-group {
  margin-bottom: 2px;
}

.rag-sidebar-group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  user-select: none;
}
.rag-sidebar-group-label i {
  font-size: 10px;
  opacity: 0.7;
}

/* Sidebar Item */
.rag-sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 20px;
  margin: 1px 8px;
  border-radius: 8px;
  font-size: 13px;
  color: #94a3b8;
  text-decoration: none;
  transition: all 0.15s ease;
  position: relative;
  cursor: pointer;
}
.rag-sidebar-item i:first-child {
  width: 18px;
  text-align: center;
  font-size: 13px;
  flex-shrink: 0;
}
.rag-sidebar-item:hover {
  color: #e2e8f0;
  background: rgba(148, 163, 184, 0.08);
}
.rag-sidebar-item.active {
  color: #d4af37;
  background: rgba(212, 175, 55, 0.1);
  font-weight: 600;
}
.rag-sidebar-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: #d4af37;
}

/* Phase Badges */
.rag-badge {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  flex-shrink: 0;
}
.rag-badge-active {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.rag-badge-soon {
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
}
.rag-badge-new {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

/* Sidebar Footer */
.rag-sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.08);
  flex-shrink: 0;
}
.rag-sidebar-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
}
.rag-sidebar-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

/* Main Content Area */
.rag-main {
  flex: 1;
  margin-left: 260px;
  min-height: 100vh;
  padding: 24px 32px 48px;
}

/* ======== Mobile ======== */
.rag-sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 35;
}

.rag-mobile-toggle {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 50;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  font-size: 18px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1023px) {
  .rag-sidebar {
    transform: translateX(-100%);
  }
  .rag-sidebar.open {
    transform: translateX(0);
  }
  .rag-sidebar-overlay.visible {
    display: block;
  }
  .rag-mobile-toggle {
    display: flex;
  }
  .rag-main {
    margin-left: 0;
    padding: 16px;
    padding-top: 60px;
  }
}
`;

// ============================================================
// HTML Generator
// ============================================================

/**
 * Generate the RAG platform sidebar HTML
 * @param activePath - current page route for highlighting
 */
export function generateRagSidebar(activePath: string): string {
  let navHtml = '';

  for (const group of ragSidebarGroups) {
    // Group label (skip for top-level with empty label)
    if (group.label) {
      navHtml += `
      <div class="rag-sidebar-group-label">
        <i class="${group.icon}"></i>
        ${group.label}
      </div>`;
    }

    for (const item of group.items) {
      const isActive = activePath === item.href ||
        (item.href !== '/rag' && activePath.startsWith(item.href + '/'));
      const activeClass = isActive ? ' active' : '';

      // Badge
      let badgeHtml = '';
      if (item.badge) {
        const cls = item.badgeType === 'active' ? 'rag-badge-active'
          : item.badgeType === 'new' ? 'rag-badge-new'
          : 'rag-badge-soon';
        badgeHtml = `<span class="rag-badge ${cls}">${item.badge}</span>`;
      }

      navHtml += `
      <a href="${item.href}" class="rag-sidebar-item${activeClass}" data-page="${item.id}">
        <i class="${item.icon}"></i>
        <span>${item.label}</span>
        ${badgeHtml}
      </a>`;
    }
  }

  return `
  <button class="rag-mobile-toggle" id="ragMobileToggle" onclick="toggleRagSidebar()">
    <i class="fas fa-bars"></i>
  </button>
  <aside class="rag-sidebar" id="ragSidebar">
    <!-- Header -->
    <div class="rag-sidebar-header">
      <a href="/rag/dashboard" class="rag-sidebar-logo">
        <div class="rag-sidebar-logo-icon">
          <i class="fas fa-brain"></i>
        </div>
        <div class="rag-sidebar-logo-text">
          <div class="rag-sidebar-logo-title">RAG 平台</div>
          <div class="rag-sidebar-logo-subtitle">智能知识库管理</div>
        </div>
      </a>
    </div>

    <!-- Back to main site -->
    <a href="/" class="rag-sidebar-back">
      <i class="fas fa-arrow-left"></i>
      返回 FinSpark 主站
    </a>

    <!-- Nav -->
    <nav class="rag-sidebar-nav">
      ${navHtml}
    </nav>

    <!-- Footer -->
    <div class="rag-sidebar-footer">
      <div class="rag-sidebar-status">
        <div class="rag-sidebar-status-dot"></div>
        <span>系统运行正常</span>
      </div>
    </div>
  </aside>
  <div class="rag-sidebar-overlay" id="ragSidebarOverlay" onclick="closeRagSidebar()"></div>`;
}

// ============================================================
// Client-side Scripts
// ============================================================

export const ragSidebarScript = `
  function toggleRagSidebar() {
    var sidebar = document.getElementById('ragSidebar');
    var overlay = document.getElementById('ragSidebarOverlay');
    if (sidebar && overlay) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('visible');
      document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }
  }
  function closeRagSidebar() {
    var sidebar = document.getElementById('ragSidebar');
    var overlay = document.getElementById('ragSidebarOverlay');
    if (sidebar && overlay) {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }
  window.addEventListener('resize', function() {
    if (window.innerWidth >= 1024) {
      closeRagSidebar();
    }
  });
`;

export default generateRagSidebar;
