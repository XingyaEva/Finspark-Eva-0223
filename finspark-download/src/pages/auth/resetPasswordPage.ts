/**
 * 重置密码页 (Reset Password Page)
 * 
 * 通过 URL 中的 token 参数重置密码
 * 同风格左右分栏布局
 */

import { generateAuthPage, icons } from './authLayout';

const resetPasswordFormHtml = `
  <h2 class="auth-form-title">设置新密码</h2>
  <p class="auth-form-subtitle">请输入你的新密码</p>

  <!-- 错误提示 -->
  <div id="resetError" class="auth-error-box">
    ${icons.alertCircle}
    <span class="auth-error-text"></span>
  </div>

  <!-- 成功提示 -->
  <div id="resetSuccess" class="auth-success-box">
    ${icons.checkCircle}
    <span class="auth-success-text"></span>
  </div>

  <form id="resetForm" novalidate>
    <!-- 新密码 -->
    <div class="auth-field">
      <label for="resetPassword">新密码</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.lock}</span>
        <input 
          type="password" 
          id="resetPassword" 
          name="password" 
          class="auth-input" 
          placeholder="至少 8 位字符"
          autocomplete="new-password"
          minlength="8"
          required
        >
        <button type="button" class="auth-input-toggle" onclick="togglePasswordVisibility('resetPassword', this)">
          ${icons.eye}
        </button>
      </div>
      <div class="auth-field-error" id="resetPasswordError">密码至少需要 8 位字符</div>
    </div>

    <!-- 确认新密码 -->
    <div class="auth-field">
      <label for="resetPasswordConfirm">确认新密码</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.lock}</span>
        <input 
          type="password" 
          id="resetPasswordConfirm" 
          name="passwordConfirm" 
          class="auth-input" 
          placeholder="再次输入新密码"
          autocomplete="new-password"
          required
        >
        <button type="button" class="auth-input-toggle" onclick="togglePasswordVisibility('resetPasswordConfirm', this)">
          ${icons.eye}
        </button>
      </div>
      <div class="auth-field-error" id="resetPasswordConfirmError">两次输入的密码不一致</div>
    </div>

    <!-- 提交按钮 -->
    <button type="submit" class="auth-submit-btn" id="resetBtn" style="margin-top: 8px;">
      <span class="btn-text">重置密码</span>
      <span class="btn-loading">
        <span class="auth-spinner"></span>
        重置中...
      </span>
    </button>
  </form>

  <!-- 返回登录 -->
  <p class="auth-switch-text" style="margin-top: 24px;">
    <a href="/login" class="auth-switch-link">返回登录</a>
  </p>
`;

const resetPasswordPageScript = `
  // --- 检查 token ---
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');

  if (!resetToken) {
    showError('resetError', '无效的重置链接，请重新申请密码重置');
    document.getElementById('resetForm').style.display = 'none';
  }

  // --- 实时校验 ---
  document.getElementById('resetPassword')?.addEventListener('blur', function() {
    const errEl = document.getElementById('resetPasswordError');
    if (this.value && this.value.length < 8) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  document.getElementById('resetPasswordConfirm')?.addEventListener('blur', function() {
    const errEl = document.getElementById('resetPasswordConfirmError');
    const pw = document.getElementById('resetPassword').value;
    if (this.value && this.value !== pw) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  // --- 提交重置密码 ---
  document.getElementById('resetForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError('resetError');

    const password = document.getElementById('resetPassword').value;
    const passwordConfirm = document.getElementById('resetPasswordConfirm').value;
    const btn = document.getElementById('resetBtn');

    if (!password || password.length < 8) {
      showError('resetError', '密码至少需要 8 位字符');
      return;
    }
    if (password !== passwordConfirm) {
      showError('resetError', '两次输入的密码不一致');
      return;
    }
    if (!resetToken) {
      showError('resetError', '无效的重置链接');
      return;
    }

    setLoading(btn, true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: password })
      });
      const data = await response.json();

      if (data.success) {
        document.getElementById('resetForm').style.display = 'none';
        showSuccess('resetSuccess', '密码重置成功！正在跳转到登录页...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        showError('resetError', data.error || '重置失败，链接可能已过期，请重新申请');
      }
    } catch (error) {
      showError('resetError', '网络错误，请稍后重试');
    } finally {
      setLoading(btn, false);
    }
  });
`;

export function generateResetPasswordPage(): string {
  return generateAuthPage({
    title: '重置密码',
    heroTitle: 'AI 驱动的智能投资分析',
    heroSubtitle: '专为专业投资者打造的机构级金融分析平台，实时财报分析、市场趋势预测、智能风险评估，助你做出更明智的投资决策。',
    formHtml: resetPasswordFormHtml,
    pageScript: resetPasswordPageScript,
  });
}
