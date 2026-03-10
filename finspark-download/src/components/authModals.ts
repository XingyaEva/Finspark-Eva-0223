/**
 * 认证弹窗组件 (Auth Modals)
 * 
 * 包含登录、注册、升级弹窗
 * 从首页代码中提取的共享组件
 */

export const authModalsStyles = `
  /* 弹窗基础样式已在 theme.ts 的 baseStyles 中 */
  .modal-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #2a2a4e 100%);
    border: 1px solid var(--border-gold);
    border-radius: var(--radius-xl);
  }
`;

export const authModalsHtml = `
  <!-- 升级弹窗 -->
  <div id="upgradeModal" class="modal">
    <div class="modal-content rounded-xl p-8 max-w-lg w-full mx-4">
      <div class="flex justify-between items-center mb-6">
        <h3 class="text-xl font-bold gold-gradient">升级会员</h3>
        <button onclick="hideModal('upgradeModal')" class="text-gray-400 hover:text-white" style="background:none;border:none;cursor:pointer;font-size:16px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="padding:16px;border-radius:var(--radius-lg);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:500;color:#60a5fa;">Pro 会员</span>
            <span class="text-gray-400">¥29/月</span>
          </div>
          <ul style="list-style:none;padding:0;margin:0;font-size:14px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;">
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>每日50次分析</li>
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>收藏上限500个</li>
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>完整功能访问</li>
          </ul>
        </div>
        <div style="padding:16px;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(180,120,0,0.1),rgba(180,120,0,0.05));border:1px solid rgba(212,175,55,0.3);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:500;" class="gold-text">Elite 会员</span>
            <span class="text-gray-400">¥99/月</span>
          </div>
          <ul style="list-style:none;padding:0;margin:0;font-size:14px;color:var(--text-muted);display:flex;flex-direction:column;gap:4px;">
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>无限分析次数</li>
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>收藏上限1000个</li>
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>PDF无水印导出</li>
            <li><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>优先客服支持</li>
          </ul>
        </div>
        <p style="font-size:12px;color:var(--text-dim);text-align:center;padding-top:8px;">会员功能正在开发中，敬请期待</p>
      </div>
    </div>
  </div>
`;

/**
 * 认证相关 JavaScript
 * 包含: 访客会话、Token 管理、登录注册、弹窗控制
 */
export const authModalsScript = `
  // ============ 全局状态 ============
  let currentUser = null;
  let currentPermissions = null;
  let guestFingerprint = null;

  // ============ 访客会话 ID ============
  function generateGuestSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getOrCreateGuestSessionId() {
    const storageKey = 'guestSessionId';
    let sessionId = localStorage.getItem(storageKey);
    if (!sessionId) {
      sessionId = generateGuestSessionId();
      localStorage.setItem(storageKey, sessionId);
    }
    return sessionId;
  }

  async function generateFingerprint() {
    return getOrCreateGuestSessionId();
  }

  // ============ Token 管理 ============
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
  function setPermissions(perms) {
    currentPermissions = perms;
    localStorage.setItem('permissions', JSON.stringify(perms));
  }
  function getPermissions() {
    if (currentPermissions) return currentPermissions;
    const stored = localStorage.getItem('permissions');
    return stored ? JSON.parse(stored) : null;
  }

  // ============ 认证检查 ============
  async function checkAuth() {
    if (!guestFingerprint) {
      guestFingerprint = localStorage.getItem('guestSessionId') || localStorage.getItem('guestFingerprint');
      if (!guestFingerprint) {
        guestFingerprint = getOrCreateGuestSessionId();
      } else if (!localStorage.getItem('guestSessionId')) {
        localStorage.setItem('guestSessionId', guestFingerprint);
      }
    }
    const token = getToken();
    if (!token) {
      await initGuestSession();
      showGuestUI();
      return;
    }
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await response.json();
      if (data.success) {
        currentUser = data.user;
        setPermissions(data.permissions);
        localStorage.setItem('user', JSON.stringify(data.user));
        showUserUI(data.user);
      } else {
        clearTokens();
        await initGuestSession();
        showGuestUI();
      }
    } catch (error) {
      console.error('Auth check error:', error);
      await initGuestSession();
      showGuestUI();
    }
  }

  async function initGuestSession() {
    try {
      const response = await fetch('/api/user/guest/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: guestFingerprint })
      });
      const data = await response.json();
      if (data.success && data.permissions) {
        setPermissions(data.permissions);
      }
    } catch (error) {
      console.error('Guest init error:', error);
    }
  }

  // ============ UI 状态 ============
  function showGuestUI() {
    // Desktop
    const authBtns = document.getElementById('authButtons') || document.getElementById('homeAuthBtns');
    const userMenu = document.getElementById('userMenu') || document.getElementById('homeUserMenu');
    if (authBtns) authBtns.style.display = '';
    if (userMenu) userMenu.style.display = 'none';
    // Mobile
    if (typeof updateMobileAuthUI === 'function') updateMobileAuthUI();
    if (typeof updateQuotaDisplay === 'function') updateQuotaDisplay();
  }

  function showUserUI(user) {
    const authBtns = document.getElementById('authButtons') || document.getElementById('homeAuthBtns');
    const userMenu = document.getElementById('userMenu') || document.getElementById('homeUserMenu');
    if (authBtns) authBtns.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      const nameEl = document.getElementById('userName') || document.getElementById('homeUserName');
      if (nameEl) nameEl.textContent = user.nickname || user.name || user.email;
      const avatarEl = document.getElementById('homeUserAvatar');
      if (avatarEl) {
        const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
        avatarEl.textContent = initial;
      }
    }
    if (typeof updateTierBadge === 'function') updateTierBadge(user);
    if (typeof updateMobileAuthUI === 'function') updateMobileAuthUI();
    if (typeof updateQuotaDisplay === 'function') updateQuotaDisplay();
  }

  // ============ 弹窗控制 ============
  function showModal(id) { document.getElementById(id)?.classList.add('active'); }
  function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    const errEl = document.getElementById(id.replace('Modal', 'Error'));
    if (errEl) errEl.classList.add('hidden');
  }
  function switchModal(from, to) { hideModal(from); showModal(to); }

  // ============ 登录/注册 (已迁移到独立页面 /login, /register) ============
  // handleLogin / handleRegister 不再由弹窗调用，保留空函数以防其他引用
  async function handleLogin(e) { e.preventDefault(); window.location.href = '/login'; }
  async function handleRegister(e) { e.preventDefault(); window.location.href = '/register'; }

  // ============ 退出 ============
  async function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      }).catch(() => {});
    }
    clearTokens();
    currentUser = null;
    currentPermissions = null;
    await initGuestSession();
    showGuestUI();
  }

  // ============ 迁移提示 ============
  function showMigrationToast(migration) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:80px;right:16px;background:#10b981;color:white;padding:16px 24px;border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:200;display:flex;align-items:center;gap:12px;animation:slideIn 0.3s ease-out;';
    toast.innerHTML = '<i class="fas fa-check-circle" style="font-size:20px;"></i><div><div style="font-weight:500;">数据迁移成功</div><div style="font-size:14px;opacity:0.9;">' + migration.message + '</div></div><button onclick="this.parentElement.remove()" style="margin-left:16px;background:none;border:none;color:white;opacity:0.8;cursor:pointer;font-size:16px;"><i class="fas fa-times"></i></button>';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 5000);
  }

  // ============ 权限检查 ============
  function checkFeaturePermission(feature, showPrompt = true) {
    const perms = getPermissions();
    if (!perms) return false;
    const featureMap = {
      'ai_comic': perms.canViewAiComic,
      'risk_assessment': perms.canViewRiskAssessment,
      'industry_comparison': perms.canViewIndustryComparison,
      'pdf_export': perms.canExportPdf,
      'pdf_no_watermark': perms.canExportPdfWithoutWatermark,
      'favorite': perms.canFavorite,
      'history': perms.canViewHistory,
    };
    const hasPermission = featureMap[feature] ?? false;
    if (!hasPermission && showPrompt && perms.upgradePrompt) {
      showUpgradePrompt(perms.upgradePrompt, perms.tier === 'guest');
    }
    return hasPermission;
  }

  function showUpgradePrompt(message, needLogin = false) {
    const msgEl = document.getElementById('upgradeMessage');
    const actionBtn = document.getElementById('upgradeAction');
    if (!msgEl) {
      // 动态创建简易升级弹窗
      showModal('upgradeModal');
      return;
    }
    msgEl.textContent = message;
    if (needLogin) {
      actionBtn.textContent = '立即登录';
      actionBtn.onclick = () => { window.location.href = '/login'; };
    } else {
      actionBtn.textContent = '了解会员';
      actionBtn.onclick = () => { hideModal('upgradeModal'); window.location.href = '/membership'; };
    }
    showModal('upgradeModal');
  }
`;
