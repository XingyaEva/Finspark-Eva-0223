/**
 * 忘记密码页 (Forgot Password Page)
 * 
 * 输入邮箱 → 发送重置链接
 * 同风格左右分栏布局
 */

import { generateAuthPage, icons } from './authLayout';

const forgotPasswordFormHtml = `
  <h2 class="auth-form-title">忘记密码？</h2>
  <p class="auth-form-subtitle">输入你的注册邮箱，我们将发送密码重置链接</p>

  <!-- 错误提示 -->
  <div id="forgotError" class="auth-error-box">
    ${icons.alertCircle}
    <span class="auth-error-text"></span>
  </div>

  <!-- 成功提示 -->
  <div id="forgotSuccess" class="auth-success-box">
    ${icons.checkCircle}
    <span class="auth-success-text"></span>
  </div>

  <form id="forgotForm" novalidate>
    <!-- 邮箱 -->
    <div class="auth-field">
      <label for="forgotEmail">邮箱地址</label>
      <div class="auth-input-wrapper">
        <span class="auth-input-icon">${icons.mail}</span>
        <input 
          type="email" 
          id="forgotEmail" 
          name="email" 
          class="auth-input" 
          placeholder="your.email@example.com"
          autocomplete="email"
          required
        >
      </div>
      <div class="auth-field-error" id="forgotEmailError">请输入有效的邮箱地址</div>
    </div>

    <!-- 提交按钮 -->
    <button type="submit" class="auth-submit-btn" id="forgotBtn" style="margin-top: 8px;" aria-label="发送重置链接">
      <span class="btn-text">发送重置链接</span>
      <span class="btn-loading">
        <span class="auth-spinner"></span>
        发送中...
      </span>
    </button>
  </form>

  <!-- 返回登录 -->
  <p class="auth-switch-text" style="margin-top: 24px;">
    想起密码了？<a href="/login" class="auth-switch-link">返回登录</a>
  </p>
`;

const forgotPasswordPageScript = `
  // --- 实时校验 ---
  document.getElementById('forgotEmail')?.addEventListener('blur', function() {
    const errEl = document.getElementById('forgotEmailError');
    if (this.value && !isValidEmail(this.value)) {
      this.classList.add('error');
      if (errEl) errEl.classList.add('visible');
    } else {
      this.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  // --- 提交忘记密码 ---
  document.getElementById('forgotForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError('forgotError');

    const email = document.getElementById('forgotEmail').value.trim();
    const btn = document.getElementById('forgotBtn');

    if (!email || !isValidEmail(email)) {
      showError('forgotError', '请输入有效的邮箱地址');
      return;
    }

    setLoading(btn, true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();

      if (data.success) {
        // 不论邮箱是否存在都显示成功（安全考虑）
        document.getElementById('forgotForm').style.display = 'none';
        showSuccess('forgotSuccess', data.message || '如果该邮箱已注册，你将收到一封密码重置邮件。请检查你的收件箱（包括垃圾邮件文件夹）。');
      } else {
        showError('forgotError', data.error || '发送失败，请稍后重试');
      }
    } catch (error) {
      showError('forgotError', '网络错误，请稍后重试');
    } finally {
      setLoading(btn, false);
    }
  });
`;

export function generateForgotPasswordPage(): string {
  return generateAuthPage({
    title: '忘记密码',
    heroTitle: 'AI 驱动的智能投资分析',
    heroSubtitle: '专为专业投资者打造的机构级金融分析平台，实时财报分析、市场趋势预测、智能风险评估，助你做出更明智的投资决策。',
    formHtml: forgotPasswordFormHtml,
    pageScript: forgotPasswordPageScript,
  });
}
