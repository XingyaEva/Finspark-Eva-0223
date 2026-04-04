/**
 * 首页导航栏组件
 * 完全复刻 Figma 设计：深色导航 + 金色 Logo + 居中导航链接 + 登录/注册按钮（含图标）
 * 包含移动端汉堡菜单和侧滑面板
 */

export const homeNavbarStyles = `
  /* ---- 桌面导航栏 ---- */
  .home-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 64px;
    background: rgba(13, 17, 23, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 48px;
  }

  /* Logo: 趋势线图标 + FinSpark */
  .home-nav-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    font-weight: 700;
    text-decoration: none;
    flex-shrink: 0;
  }
  .home-nav-logo svg {
    width: 24px;
    height: 24px;
  }
  .home-nav-logo-text {
    background: linear-gradient(135deg, #d4af37 0%, #f5d17e 50%, #d4af37 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-family: 'Inter', 'Noto Sans SC', sans-serif;
    letter-spacing: 0.5px;
  }

  /* 导航链接 - 居中 */
  .home-nav-links {
    display: flex;
    align-items: center;
    gap: 40px;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }
  .home-nav-links a {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.65);
    transition: color 0.2s;
    text-decoration: none;
    font-weight: 400;
    white-space: nowrap;
  }
  .home-nav-links a:hover {
    color: rgba(255, 255, 255, 0.95);
  }
  .home-nav-links a.active {
    color: rgba(255, 255, 255, 0.95);
  }

  /* 锁定的导航项（即将推出） */
  .home-nav-links .nav-locked,
  .home-mobile-link.nav-locked {
    color: rgba(255, 255, 255, 0.3) !important;
    cursor: not-allowed !important;
    pointer-events: auto;
    position: relative;
    user-select: none;
  }
  .home-nav-links .nav-locked:hover {
    color: rgba(255, 255, 255, 0.3) !important;
  }
  .home-nav-links .nav-locked .nav-lock-icon {
    display: inline-block;
    margin-left: 4px;
    font-size: 11px;
    opacity: 0.7;
    vertical-align: middle;
  }
  .home-mobile-link.nav-locked .nav-lock-icon {
    display: inline-block;
    margin-left: 4px;
    font-size: 11px;
    opacity: 0.7;
  }
  /* 悬浮提示气泡 */
  .home-nav-links .nav-locked .nav-locked-tooltip {
    display: none;
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #1e2432;
    color: rgba(255, 255, 255, 0.75);
    font-size: 12px;
    padding: 6px 14px;
    border-radius: 6px;
    white-space: nowrap;
    border: 1px solid rgba(212, 175, 55, 0.2);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    pointer-events: none;
    z-index: 60;
  }
  .home-nav-links .nav-locked .nav-locked-tooltip::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 5px solid #1e2432;
  }
  .home-nav-links .nav-locked:hover .nav-locked-tooltip {
    display: block;
  }
  .home-mobile-link.nav-locked:hover,
  .home-mobile-link.nav-locked:active {
    background: transparent !important;
    color: rgba(255, 255, 255, 0.3) !important;
  }

  /* 右侧按钮区 */
  .home-nav-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  /* 登录按钮 - Figma: 深色填充 + 边框 + 箭头图标 */
  .home-nav-btn-login {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .home-nav-btn-login svg {
    width: 16px;
    height: 16px;
    opacity: 0.7;
  }
  .home-nav-btn-login:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  /* 注册按钮 - Figma: 金色渐变填充 + 人物图标 */
  .home-nav-btn-register {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 20px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
    border: 1px solid rgba(212, 175, 55, 0.3);
    background: linear-gradient(135deg, #D4A017, #F0B90B);
    color: #0a0a0a;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .home-nav-btn-register svg {
    width: 16px;
    height: 16px;
  }
  .home-nav-btn-register:hover {
    box-shadow: 0 4px 20px rgba(212, 175, 55, 0.35);
    transform: translateY(-1px);
  }

  /* 已登录用户头像 */
  .home-nav-user {
    display: none;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 8px;
    transition: background 0.2s;
    position: relative;
  }
  .home-nav-user:hover { background: rgba(255,255,255,0.04); }
  .home-nav-user-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #D4A017, #F0B90B);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: #0a0a0a;
  }
  .home-nav-user-name {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }

  /* 用户下拉菜单 */
  .home-user-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: #151B28;
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: 12px;
    min-width: 200px;
    padding: 8px 0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 100;
  }
  .home-user-dropdown.active { display: block; }
  .home-user-dropdown a, .home-user-dropdown button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }
  .home-user-dropdown a:hover, .home-user-dropdown button:hover {
    background: rgba(255,255,255,0.04);
    color: rgba(255, 255, 255, 0.9);
  }
  .home-user-dropdown .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 4px 0;
  }

  /* ---- 移动端汉堡按钮 ---- */
  .home-nav-mobile-toggle {
    display: none;
    background: none; border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 20px;
    cursor: pointer; padding: 8px;
  }

  /* ---- 移动端侧滑菜单 ---- */
  .home-mobile-overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 200;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .home-mobile-overlay.open {
    display: block;
    opacity: 1;
  }
  .home-mobile-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 280px;
    max-width: 80vw;
    background: #151B28;
    z-index: 201;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    overflow-y: auto;
  }
  .home-mobile-panel.open {
    transform: translateX(0);
  }
  .home-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .home-mobile-header span {
    font-size: 16px;
    font-weight: 600;
  }
  .home-mobile-header button {
    background: none; border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 18px;
    cursor: pointer; padding: 6px;
  }
  .home-mobile-user {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }
  .home-mobile-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    transition: all 0.15s;
  }
  .home-mobile-link:hover, .home-mobile-link:active {
    background: rgba(255,255,255,0.04);
    color: rgba(255, 255, 255, 0.9);
  }
  .home-mobile-link i { width: 20px; text-align: center; }
  .home-mobile-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 4px 0;
  }

  /* ---- 响应式 ---- */
  @media (max-width: 767px) {
    .home-nav { padding: 0 16px; }
    .home-nav-links { display: none; }
    .home-nav-mobile-toggle { display: block; }
    .home-nav-btn-login, .home-nav-btn-register { display: none; }
    .home-nav-user { display: none !important; }
  }
  @media (min-width: 768px) and (max-width: 1024px) {
    .home-nav { padding: 0 24px; }
    .home-nav-links { gap: 28px; }
  }
`;

export function generateHomeNavbar(): string {
  return `
  <nav class="home-nav">
    <a href="/" class="home-nav-logo">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17L9 11L13 15L21 7" stroke="url(#logoGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 7H21V11" stroke="url(#logoGrad2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <defs>
          <linearGradient id="logoGrad" x1="3" y1="7" x2="21" y2="17" gradientUnits="userSpaceOnUse">
            <stop stop-color="#d4af37"/>
            <stop offset="1" stop-color="#f5d17e"/>
          </linearGradient>
          <linearGradient id="logoGrad2" x1="17" y1="7" x2="21" y2="11" gradientUnits="userSpaceOnUse">
            <stop stop-color="#d4af37"/>
            <stop offset="1" stop-color="#f5d17e"/>
          </linearGradient>
        </defs>
      </svg>
      <span class="home-nav-logo-text">FinSpark</span>
    </a>

    <div class="home-nav-links">
      <a href="/">首页</a>
      <span class="nav-locked" onclick="event.preventDefault();">市场分析<i class="fas fa-lock nav-lock-icon"></i><span class="nav-locked-tooltip">🔒 即将推出</span></span>
      <a href="/my-reports">AI研报</a>
      <a href="/membership">关于我们</a>
    </div>

    <div class="home-nav-right">
      <div id="homeAuthBtns" style="display:flex;align-items:center;gap:12px;">
        <a href="/login" class="home-nav-btn-login" style="text-decoration:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          登录
        </a>
        <a href="/register" class="home-nav-btn-register" style="text-decoration:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          注册
        </a>
      </div>
      <div id="homeUserMenu" class="home-nav-user">
        <div class="home-nav-user-avatar" id="homeUserAvatar"><i class="fas fa-user" style="font-size:14px"></i></div>
        <span class="home-nav-user-name" id="homeUserName"></span>
        <div class="home-user-dropdown" id="homeUserDropdown">
          <a href="/account"><i class="fas fa-user-circle gold-text"></i>个人中心</a>
          <a href="/my-reports"><i class="fas fa-file-alt gold-text"></i>我的报告</a>
          <a href="/favorites"><i class="fas fa-heart gold-text"></i>我的收藏</a>
          <div class="divider"></div>
          <a href="/settings/agents"><i class="fas fa-robot gold-text"></i>Agent 配置</a>
          <a href="/settings"><i class="fas fa-cog gold-text"></i>设置</a>
          <a href="/membership"><i class="fas fa-crown gold-text"></i>会员中心</a>
          <div class="divider"></div>
          <button onclick="logout()" style="color:#EF4444;"><i class="fas fa-sign-out-alt"></i>退出登录</button>
        </div>
      </div>
      <button class="home-nav-mobile-toggle" onclick="toggleHomeMobileMenu()" aria-label="菜单">
        <i class="fas fa-bars"></i>
      </button>
    </div>
  </nav>

  <!-- 移动端遮罩 -->
  <div id="homeMobileOverlay" class="home-mobile-overlay" onclick="closeHomeMobileMenu()"></div>

  <!-- 移动端侧滑菜单 -->
  <div id="homeMobilePanel" class="home-mobile-panel">
    <div class="home-mobile-header">
      <span class="gold-gradient">菜单</span>
      <button onclick="closeHomeMobileMenu()" aria-label="关闭"><i class="fas fa-times"></i></button>
    </div>
    <div class="home-mobile-user">
      <div id="mobileAuthButtons" style="display:flex;flex-direction:column;gap:12px;">
        <a href="/login" class="btn-outline" style="width:100%;padding:12px;border-radius:8px;font-size:15px;display:block;text-align:center;text-decoration:none;">登录</a>
        <a href="/register" class="btn-gold" style="width:100%;padding:12px;border-radius:8px;font-size:15px;display:block;text-align:center;text-decoration:none;">注册</a>
      </div>
      <div id="mobileUserInfo" style="display:none;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#D4A017,#F0B90B);display:flex;align-items:center;justify-content:center;font-weight:600;color:#0a0a0a;">
            <i class="fas fa-user" style="font-size:16px"></i>
          </div>
          <div>
            <div id="mobileUserName" style="font-weight:500;font-size:14px;color:rgba(255,255,255,0.9);"></div>
            <span id="mobileTierBadge" style="font-size:12px;padding:2px 8px;border-radius:4px;background:#3b82f6;color:white;">免费</span>
          </div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);">今日分析：<span id="mobileQuotaDisplay" class="gold-text">--</span></div>
      </div>
    </div>
    <a href="/" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-home"></i>首页</a>
    <span class="home-mobile-link nav-locked" onclick="event.preventDefault();event.stopPropagation();"><i class="fas fa-lock" style="opacity:0.5"></i>市场分析<span class="nav-lock-icon" style="font-size:11px;opacity:0.5;margin-left:4px;">即将推出</span></span>
    <a href="/my-reports" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-file-alt"></i>AI研报</a>
    <a href="/favorites" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-heart"></i>我的收藏</a>
    <div class="home-mobile-divider"></div>
    <a href="/account" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-user-circle"></i>个人中心</a>
    <a href="/settings/agents" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-robot"></i>Agent 配置</a>
    <a href="/settings" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-cog"></i>设置</a>
    <a href="/membership" class="home-mobile-link" onclick="closeHomeMobileMenu()"><i class="fas fa-crown"></i>会员中心</a>
    <div id="mobileLogoutSection" style="display:none;">
      <div class="home-mobile-divider"></div>
      <button onclick="logout();closeHomeMobileMenu();" class="home-mobile-link" style="width:100%;color:#EF4444;background:none;border:none;cursor:pointer;">
        <i class="fas fa-sign-out-alt"></i>退出登录
      </button>
    </div>
  </div>`;
}

export const homeNavbarScript = `
  // ---- 移动端菜单 ----
  function toggleHomeMobileMenu() {
    document.getElementById('homeMobileOverlay')?.classList.add('open');
    document.getElementById('homeMobilePanel')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeHomeMobileMenu() {
    document.getElementById('homeMobileOverlay')?.classList.remove('open');
    document.getElementById('homeMobilePanel')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---- 桌面端用户下拉 ----
  document.getElementById('homeUserMenu')?.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('homeUserDropdown')?.classList.toggle('active');
  });
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#homeUserMenu')) {
      document.getElementById('homeUserDropdown')?.classList.remove('active');
    }
  });

  // ---- 更新移动端认证 UI ----
  function updateMobileAuthUI() {
    const mobileAuthBtns = document.getElementById('mobileAuthButtons');
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    const mobileLogout = document.getElementById('mobileLogoutSection');
    if (!mobileAuthBtns || !mobileUserInfo) return;

    if (currentUser) {
      mobileAuthBtns.style.display = 'none';
      mobileUserInfo.style.display = 'block';
      if (mobileLogout) mobileLogout.style.display = 'block';
      const nameEl = document.getElementById('mobileUserName');
      if (nameEl) nameEl.textContent = currentUser.nickname || currentUser.name || currentUser.email;
      const tierBadge = document.getElementById('mobileTierBadge');
      if (tierBadge) {
        const tierMap = { free:'免费', pro:'Pro', elite:'Elite' };
        const colorMap = { free:'#3b82f6', pro:'#7c3aed', elite:'#d4af37' };
        tierBadge.textContent = tierMap[currentUser.membership_tier] || '免费';
        tierBadge.style.background = colorMap[currentUser.membership_tier] || '#3b82f6';
      }
      const quotaEl = document.getElementById('mobileQuotaDisplay');
      const mainQuota = document.getElementById('quotaDisplay');
      if (quotaEl && mainQuota) quotaEl.textContent = mainQuota.textContent;
    } else {
      mobileAuthBtns.style.display = 'flex';
      mobileUserInfo.style.display = 'none';
      if (mobileLogout) mobileLogout.style.display = 'none';
    }
  }

  function updateQuotaDisplay() {}
  function updateTierBadge(user) {}
  function updateFeatureLockUI() {}
`;
