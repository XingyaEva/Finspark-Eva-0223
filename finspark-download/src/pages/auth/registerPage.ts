/**
 * 注册页 (Register Page)
 * 
 * 基于 Figma 设计稿高保真还原
 * 左右分栏: 品牌面板 + 注册表单
 */

import { generateAuthPage, icons } from './authLayout';

const registerFormHtml = `
  <h2 class="auth-form-title">创建你的 FinSpark 账户</h2>
  <p class="auth-form-subtitle">开始使用机构级投资分析平台</p>

  <!-- 错误提示 -->
  <div id="registerError" class="auth-error-box">
    ${icons.alertCircle}
    <span class="auth-error-text"></span>
  </div>

  <form id="registerForm" novalidate>
    <!-- 昵称 -->
    <div class="auth-field">
      <label for="regName">昵称</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.user}</span>
        <input 
          type="text" 
          id="regName" 
          name="name" 
          class="auth-input" 
          placeholder="张三"
          autocomplete="name"
          required
        >
      </div>
    </div>

    <!-- 邮箱 -->
    <div class="auth-field">
      <label for="regEmail">邮箱地址</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.mail}</span>
        <input 
          type="email" 
          id="regEmail" 
          name="email" 
          class="auth-input" 
          placeholder="your.email@example.com"
          autocomplete="email"
          required
        >
      </div>
      <div class="auth-field-error" id="regEmailError">请输入有效的邮箱地址</div>
    </div>

    <!-- 密码 -->
    <div class="auth-field">
      <label for="regPassword">密码</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.lock}</span>
        <input 
          type="password" 
          id="regPassword" 
          name="password" 
          class="auth-input" 
          placeholder="至少 8 位字符"
          autocomplete="new-password"
          minlength="8"
          required
        >
        <button type="button" class="auth-input-toggle" onclick="togglePasswordVisibility('regPassword', this)">
          ${icons.eye}
        </button>
      </div>
      <div class="auth-field-error" id="regPasswordError">密码至少需要 8 位字符</div>
      <!-- 密码强度指示器 -->
      <div class="auth-password-strength" id="passwordStrength" style="display:none;">
        <div class="auth-strength-bars">
          <span class="auth-strength-bar" id="strengthBar1"></span>
          <span class="auth-strength-bar" id="strengthBar2"></span>
          <span class="auth-strength-bar" id="strengthBar3"></span>
          <span class="auth-strength-bar" id="strengthBar4"></span>
        </div>
        <span class="auth-strength-text" id="strengthText"></span>
      </div>
    </div>

    <!-- 确认密码 -->
    <div class="auth-field">
      <label for="regPasswordConfirm">确认密码</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.lock}</span>
        <input 
          type="password" 
          id="regPasswordConfirm" 
          name="passwordConfirm" 
          class="auth-input" 
          placeholder="再次输入密码"
          autocomplete="new-password"
          required
        >
        <button type="button" class="auth-input-toggle" onclick="togglePasswordVisibility('regPasswordConfirm', this)">
          ${icons.eye}
        </button>
      </div>
      <div class="auth-field-error" id="regPasswordConfirmError">两次输入的密码不一致</div>
    </div>

    <!-- 同意条款 -->
    <div class="auth-terms-row">
      <input type="checkbox" class="auth-checkbox" id="agreeTerms">
      <span class="auth-terms-text">
        我已阅读并同意 <a href="/terms" target="_blank">服务条款</a> 和 <a href="/privacy" target="_blank">隐私政策</a>
      </span>
    </div>

    <!-- 注册按钮 -->
    <button type="submit" class="auth-submit-btn" id="registerBtn" aria-label="创建账户">
      <span class="btn-text">创建账户</span>
      <span class="btn-loading">
        <span class="auth-spinner"></span>
        创建中...
      </span>
    </button>
  </form>

  <!-- 分隔线 -->
  <div class="auth-divider">
    <span class="auth-divider-line"></span>
    <span class="auth-divider-text">或使用第三方注册</span>
    <span class="auth-divider-line"></span>
  </div>

  <!-- 社交登录 -->
  <div class="auth-social-row">
    <button class="auth-social-btn" onclick="alert('Google 登录功能即将上线')" aria-label="Google 注册">
      ${icons.google}
      Google
    </button>
    <button class="auth-social-btn" onclick="alert('GitHub 登录功能即将上线')" aria-label="GitHub 注册">
      ${icons.github}
      GitHub
    </button>
  </div>

  <!-- 切换到登录 -->
  <p class="auth-switch-text">
    已有账户？<a href="/login" class="auth-switch-link">立即登录</a>
  </p>
`;

const registerPageScript = `
  // --- 密码强度检测 ---
  function checkPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, text: '弱', color: '#EF4444' };
    if (score <= 2) return { level: 2, text: '较弱', color: '#F59E0B' };
    if (score <= 3) return { level: 3, text: '中等', color: '#F59E0B' };
    return { level: 4, text: '强', color: '#10B981' };
  }

  document.getElementById('regPassword')?.addEventListener('input', function() {
    const container = document.getElementById('passwordStrength');
    const textEl = document.getElementById('strengthText');
    if (!this.value) {
      if (container) container.style.display = 'none';
      return;
    }
    if (container) container.style.display = 'flex';
    const strength = checkPasswordStrength(this.value);
    const colors = ['', '', '', ''];
    for (let i = 0; i < 4; i++) {
      const bar = document.getElementById('strengthBar' + (i + 1));
      if (bar) {
        bar.style.background = i < strength.level ? strength.color : 'rgba(255,255,255,0.08)';
      }
    }
    if (textEl) {
      textEl.textContent = strength.text;
      textEl.style.color = strength.color;
    }
  });

  // --- 实时校验 ---
  document.getElementById('regEmail')?.addEventListener('blur', function() {
    const errEl = document.getElementById('regEmailError');
    if (this.value && !isValidEmail(this.value)) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  document.getElementById('regPassword')?.addEventListener('blur', function() {
    const errEl = document.getElementById('regPasswordError');
    if (this.value && this.value.length < 8) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  document.getElementById('regPasswordConfirm')?.addEventListener('blur', function() {
    const errEl = document.getElementById('regPasswordConfirmError');
    const pw = document.getElementById('regPassword').value;
    if (this.value && this.value !== pw) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  // --- 注册提交 ---
  document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError('registerError');

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    const btn = document.getElementById('registerBtn');

    // 前端校验
    if (!name) {
      showError('registerError', '请输入昵称');
      return;
    }
    if (!email || !isValidEmail(email)) {
      showError('registerError', '请输入有效的邮箱地址');
      return;
    }
    if (!password || password.length < 8) {
      showError('registerError', '密码至少需要 8 位字符');
      return;
    }
    if (password !== passwordConfirm) {
      showError('registerError', '两次输入的密码不一致');
      return;
    }
    if (!agreeTerms) {
      showError('registerError', '请阅读并同意服务条款和隐私政策');
      return;
    }

    setLoading(btn, true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, guestFingerprint })
      });
      const data = await response.json();

      if (data.success) {
        setTokens(data.accessToken, data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.user.permissions) {
          localStorage.setItem('permissions', JSON.stringify(data.user.permissions));
        }

        // 跳转首页
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect') || '/';
        window.location.href = redirect;
      } else {
        showError('registerError', data.error || '注册失败，请稍后重试');
      }
    } catch (error) {
      showError('registerError', '网络错误，请稍后重试');
    } finally {
      setLoading(btn, false);
    }
  });
`;

export function generateRegisterPage(): string {
  return generateAuthPage({
    title: '注册',
    heroTitle: '开启你的智能投资之旅',
    heroSubtitle: '加入 FinSpark，获取 AI 驱动的专业投资分析工具，实时市场洞察，机构级风险管理，让数据驱动你的每一个投资决策。',
    formHtml: registerFormHtml,
    pageScript: registerPageScript,
  });
}
