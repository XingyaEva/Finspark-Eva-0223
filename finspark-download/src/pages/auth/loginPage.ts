/**
 * 登录页 (Login Page)
 * 
 * 基于 Figma 设计稿高保真还原
 * 左右分栏: 品牌面板 + 登录表单
 */

import { generateAuthPage, icons } from './authLayout';

const loginFormHtml = `
  <h2 class="auth-form-title">欢迎回来</h2>
  <p class="auth-form-subtitle">登录你的 FinSpark 账户</p>

  <!-- 错误提示 -->
  <div id="loginError" class="auth-error-box">
    ${icons.alertCircle}
    <span class="auth-error-text"></span>
  </div>

  <form id="loginForm" novalidate>
    <!-- 邮箱 -->
    <div class="auth-field">
      <label for="loginEmail">邮箱地址</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.mail}</span>
        <input 
          type="email" 
          id="loginEmail" 
          name="email" 
          class="auth-input" 
          placeholder="your.email@example.com"
          autocomplete="email"
          required
        >
      </div>
      <div class="auth-field-error" id="loginEmailError">请输入有效的邮箱地址</div>
    </div>

    <!-- 密码 -->
    <div class="auth-field">
      <label for="loginPassword">密码</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.lock}</span>
        <input 
          type="password" 
          id="loginPassword" 
          name="password" 
          class="auth-input" 
          placeholder="••••••••"
          autocomplete="current-password"
          required
        >
        <button type="button" class="auth-input-toggle" onclick="togglePasswordVisibility('loginPassword', this)">
          ${icons.eye}
        </button>
      </div>
    </div>

    <!-- 记住我 / 忘记密码 -->
    <div class="auth-options-row">
      <label class="auth-checkbox-label">
        <input type="checkbox" class="auth-checkbox" id="rememberMe">
        记住我
      </label>
      <a href="/forgot-password" class="auth-forgot-link">忘记密码？</a>
    </div>

    <!-- 登录按钮 -->
    <button type="submit" class="auth-submit-btn" id="loginBtn">
      <span class="btn-text">登录</span>
      <span class="btn-loading">
        <span class="auth-spinner"></span>
        登录中...
      </span>
    </button>
  </form>

  <!-- 分隔线 -->
  <div class="auth-divider">
    <span class="auth-divider-line"></span>
    <span class="auth-divider-text">或使用第三方登录</span>
    <span class="auth-divider-line"></span>
  </div>

  <!-- 社交登录 -->
  <div class="auth-social-row">
    <button class="auth-social-btn" onclick="alert('Google 登录功能即将上线')">
      ${icons.google}
      Google
    </button>
    <button class="auth-social-btn" onclick="alert('GitHub 登录功能即将上线')">
      ${icons.github}
      GitHub
    </button>
  </div>

  <!-- 切换到注册 -->
  <p class="auth-switch-text">
    还没有账户？<a href="/register" class="auth-switch-link">立即注册</a>
  </p>
`;

const loginPageScript = `
  // --- 记住我: 回填邮箱 ---
  (function() {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      const emailInput = document.getElementById('loginEmail');
      const rememberCheck = document.getElementById('rememberMe');
      if (emailInput) emailInput.value = savedEmail;
      if (rememberCheck) rememberCheck.checked = true;
    }
  })();

  // --- 实时校验 ---
  document.getElementById('loginEmail')?.addEventListener('blur', function() {
    const errEl = document.getElementById('loginEmailError');
    if (this.value && !isValidEmail(this.value)) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  // --- 登录提交 ---
  document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError('loginError');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const btn = document.getElementById('loginBtn');

    // 前端校验
    if (!email || !isValidEmail(email)) {
      showError('loginError', '请输入有效的邮箱地址');
      return;
    }
    if (!password) {
      showError('loginError', '请输入密码');
      return;
    }

    setLoading(btn, true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, guestFingerprint })
      });
      const data = await response.json();

      if (data.success) {
        setTokens(data.accessToken, data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.permissions) {
          localStorage.setItem('permissions', JSON.stringify(data.user.permissions));
        }

        // 记住我
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }

        // 跳转: 如果有 redirect 参数则跳转，否则回首页
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect') || '/';
        window.location.href = redirect;
      } else {
        showError('loginError', data.error || '登录失败，请检查邮箱和密码');
      }
    } catch (error) {
      showError('loginError', '网络错误，请稍后重试');
    } finally {
      setLoading(btn, false);
    }
  });
`;

export function generateLoginPage(): string {
  return generateAuthPage({
    title: '登录',
    heroTitle: 'AI 驱动的智能投资分析',
    heroSubtitle: '专为专业投资者打造的机构级金融分析平台，实时财报分析、市场趋势预测、智能风险评估，助你做出更明智的投资决策。',
    formHtml: loginFormHtml,
    pageScript: loginPageScript,
  });
}
