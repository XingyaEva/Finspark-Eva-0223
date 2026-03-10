/**
 * Auth Layout - 认证页面共享布局
 * 
 * 左右分栏：左侧品牌展示面板 + 右侧表单内容槽
 * 基于 Figma 设计稿高保真还原
 */

import { wrapWithPublicLayout } from '../../layouts/publicLayout';

export interface AuthPageOptions {
  title: string;
  /** 左侧面板主标题 */
  heroTitle: string;
  /** 左侧面板副标题 */
  heroSubtitle: string;
  /** 右侧表单卡片 HTML */
  formHtml: string;
  /** 页面专属脚本（纯 JS，不含 <script> 标签） */
  pageScript: string;
  /** 页面专属样式（可选） */
  pageStyles?: string;
}

// ============ 左侧品牌面板样式 ============
const authLayoutStyles = `
  /* --- Auth 两栏布局 --- */
  .auth-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .auth-navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 40px;
    position: relative;
    z-index: 10;
  }

  .auth-navbar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }

  .auth-navbar-logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #F59E0B, #D97706);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .auth-navbar-logo-icon svg {
    width: 20px;
    height: 20px;
    color: white;
  }

  .auth-navbar-logo-text {
    font-size: 20px;
    font-weight: 700;
    color: #F59E0B;
    letter-spacing: -0.5px;
  }

  .auth-navbar-back {
    color: #9CA3AF;
    text-decoration: none;
    font-size: 14px;
    transition: color 0.2s;
  }

  .auth-navbar-back:hover {
    color: #F59E0B;
  }

  .auth-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 40px 40px;
    gap: 60px;
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
  }

  /* --- 左侧品牌面板 --- */
  .auth-brand-panel {
    flex: 1;
    max-width: 560px;
  }

  .auth-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #F59E0B;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 6px 16px;
    border-radius: 20px;
    margin-bottom: 24px;
  }

  .auth-badge svg {
    width: 14px;
    height: 14px;
  }

  .auth-hero-title {
    font-size: 38px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1.25;
    margin-bottom: 16px;
    letter-spacing: -0.5px;
  }

  .auth-hero-subtitle {
    font-size: 16px;
    color: #9CA3AF;
    line-height: 1.7;
    margin-bottom: 40px;
  }

  /* --- 特性卡片 --- */
  .auth-features {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 32px;
  }

  .auth-feature-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    transition: all 0.3s ease;
    animation: authFeatureFadeIn 0.5s ease-out backwards;
  }

  .auth-feature-card:nth-child(1) { animation-delay: 0.1s; }
  .auth-feature-card:nth-child(2) { animation-delay: 0.2s; }
  .auth-feature-card:nth-child(3) { animation-delay: 0.3s; }

  @keyframes authFeatureFadeIn {
    from {
      opacity: 0;
      transform: translateX(-12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .auth-feature-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .auth-feature-icon {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .auth-feature-icon.blue {
    background: rgba(59, 130, 246, 0.15);
    color: #60A5FA;
  }

  .auth-feature-icon.orange {
    background: rgba(245, 158, 11, 0.15);
    color: #F59E0B;
  }

  .auth-feature-icon.green {
    background: rgba(16, 185, 129, 0.15);
    color: #34D399;
  }

  .auth-feature-icon svg {
    width: 20px;
    height: 20px;
  }

  .auth-feature-text h4 {
    color: #F9FAFB;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .auth-feature-text p {
    color: #6B7280;
    font-size: 13px;
    margin: 0;
  }

  /* --- 底部数据指标 --- */
  .auth-metrics {
    display: flex;
    gap: 12px;
  }

  .auth-metric-card {
    flex: 1;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    transition: border-color 0.3s ease;
  }

  .auth-metric-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .auth-metric-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .auth-metric-label svg {
    width: 14px;
    height: 14px;
  }

  .auth-metric-value {
    font-size: 24px;
    font-weight: 700;
    color: #FFFFFF;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .auth-metric-value .unit {
    font-size: 14px;
    font-weight: 400;
    color: #6B7280;
  }

  .auth-metric-bar {
    height: 4px;
    border-radius: 2px;
    margin-top: 10px;
    overflow: hidden;
  }

  .auth-metric-bar-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  .auth-metric-bar-row .auth-metric-bar {
    margin-top: 0;
    flex: none;
  }

  .auth-trend-arrow {
    color: #10B981;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }

  .auth-metric-bar.green {
    background: linear-gradient(90deg, #F59E0B 0%, #10B981 70%, transparent 100%);
  }

  .auth-metric-bar.orange {
    background: linear-gradient(90deg, #F59E0B 0%, #D97706 70%, transparent 100%);
  }

  .auth-metric-bar.purple {
    display: flex;
    gap: 4px;
    background: none;
    height: 8px;
    align-items: center;
  }

  .auth-metric-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    opacity: 0.5;
  }

  .auth-metric-dot.lg {
    width: 10px;
    height: 10px;
    opacity: 0.85;
  }

  /* --- 右侧表单卡片 --- */
  .auth-form-panel {
    width: 420px;
    flex-shrink: 0;
  }

  .auth-form-card {
    background: rgba(17, 24, 39, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 40px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: authCardFadeIn 0.5s ease-out;
  }

  /* --- 入场动画 --- */
  @keyframes authCardFadeIn {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes authBrandFadeIn {
    from {
      opacity: 0;
      transform: translateX(-16px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .auth-brand-panel {
    animation: authBrandFadeIn 0.5s ease-out;
  }

  .auth-form-title {
    font-size: 26px;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 8px;
  }

  .auth-form-subtitle {
    font-size: 14px;
    color: #9CA3AF;
    margin-bottom: 28px;
  }

  /* --- 表单元素 --- */
  .auth-field {
    margin-bottom: 20px;
  }

  .auth-field label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #E5E7EB;
    margin-bottom: 8px;
  }

  .auth-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .auth-input-icon {
    position: absolute;
    left: 14px;
    color: #6B7280;
    pointer-events: none;
    display: flex;
    align-items: center;
  }

  .auth-input-icon svg {
    width: 18px;
    height: 18px;
  }

  .auth-input {
    width: 100%;
    padding: 12px 14px 12px 42px;
    background: #1F2937;
    border: 1px solid #374151;
    border-radius: 10px;
    color: #F9FAFB;
    font-size: 14px;
    font-family: var(--font-primary);
    outline: none;
    transition: all 0.2s;
  }

  .auth-input::placeholder {
    color: #6B7280;
  }

  .auth-input:focus {
    border-color: #F59E0B;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  .auth-input.error {
    border-color: #EF4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .auth-input-toggle {
    position: absolute;
    right: 14px;
    background: none;
    border: none;
    color: #6B7280;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    transition: color 0.2s;
  }

  .auth-input-toggle:hover {
    color: #9CA3AF;
  }

  .auth-input-toggle svg {
    width: 18px;
    height: 18px;
  }

  .auth-field-error {
    font-size: 12px;
    color: #EF4444;
    margin-top: 6px;
    display: none;
  }

  .auth-field-error.visible {
    display: block;
  }

  /* --- 密码强度指示器 --- */
  .auth-password-strength {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }

  .auth-strength-bars {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .auth-strength-bar {
    height: 4px;
    flex: 1;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.08);
    transition: background 0.3s ease;
  }

  .auth-strength-text {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    transition: color 0.3s ease;
  }

  /* --- 记住我 / 忘记密码行 --- */
  .auth-options-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .auth-checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #9CA3AF;
    cursor: pointer;
    user-select: none;
  }

  .auth-checkbox {
    width: 16px;
    height: 16px;
    border: 1px solid #374151;
    border-radius: 4px;
    background: #1F2937;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
  }

  .auth-checkbox:checked {
    background: #F59E0B;
    border-color: #F59E0B;
  }

  .auth-checkbox:checked::after {
    content: '';
    position: absolute;
    left: 4.5px;
    top: 1.5px;
    width: 5px;
    height: 9px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .auth-forgot-link {
    font-size: 14px;
    color: #F59E0B;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .auth-forgot-link:hover {
    color: #FBBF24;
  }

  /* --- 同意条款 --- */
  .auth-terms-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 24px;
  }

  .auth-terms-row .auth-checkbox {
    margin-top: 2px;
  }

  .auth-terms-text {
    font-size: 14px;
    color: #9CA3AF;
    line-height: 1.5;
  }

  .auth-terms-text a {
    color: #F59E0B;
    text-decoration: none;
    font-weight: 500;
  }

  .auth-terms-text a:hover {
    color: #FBBF24;
    text-decoration: underline;
  }

  /* --- 主按钮 --- */
  .auth-submit-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #F59E0B, #D97706);
    border: none;
    border-radius: 10px;
    color: #FFFFFF;
    font-size: 16px;
    font-weight: 600;
    font-family: var(--font-primary);
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }

  .auth-submit-btn:hover {
    background: linear-gradient(135deg, #FBBF24, #F59E0B);
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
    transform: translateY(-1px);
  }

  .auth-submit-btn:active {
    transform: translateY(0);
  }

  .auth-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .auth-submit-btn .btn-loading {
    display: none;
  }

  .auth-submit-btn.loading .btn-text {
    visibility: hidden;
  }

  .auth-submit-btn.loading .btn-loading {
    display: flex;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .auth-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: auth-spin 0.6s linear infinite;
  }

  @keyframes auth-spin {
    to { transform: rotate(360deg); }
  }

  /* --- 分隔线 --- */
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 24px 0;
  }

  .auth-divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .auth-divider-text {
    font-size: 13px;
    color: #6B7280;
    white-space: nowrap;
  }

  /* --- 社交登录 --- */
  .auth-social-row {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .auth-social-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    color: #E5E7EB;
    font-size: 14px;
    font-weight: 500;
    font-family: var(--font-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .auth-social-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .auth-social-btn svg {
    width: 18px;
    height: 18px;
  }

  /* --- 底部切换链接 --- */
  .auth-switch-text {
    text-align: center;
    font-size: 14px;
    color: #9CA3AF;
  }

  .auth-switch-link {
    color: #F59E0B;
    text-decoration: none;
    font-weight: 600;
  }

  .auth-switch-link:hover {
    color: #FBBF24;
    text-decoration: underline;
  }

  /* --- 错误提示框 --- */
  .auth-error-box {
    display: none;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    color: #F87171;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .auth-error-box.visible {
    display: flex;
  }

  .auth-error-box svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  /* --- 成功提示框 --- */
  .auth-success-box {
    display: none;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 10px;
    color: #34D399;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .auth-success-box.visible {
    display: flex;
  }

  .auth-success-box svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  /* --- 响应式 --- */
  @media (max-width: 1024px) {
    .auth-content {
      gap: 40px;
      padding: 0 24px 24px;
    }
    .auth-hero-title {
      font-size: 32px;
    }
    .auth-form-panel {
      width: 380px;
    }
  }

  @media (max-width: 768px) {
    .auth-brand-panel {
      display: none;
      animation: none;
    }
    .auth-content {
      padding: 20px 16px 40px;
    }
    .auth-form-panel {
      width: 100%;
      max-width: 440px;
    }
    .auth-form-card {
      padding: 32px 24px;
    }
    .auth-navbar {
      padding: 12px 16px;
    }
  }
`;

// ============ SVG 图标 ============
const icons = {
  sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M18 14l.67 2.33L21 17l-2.33.67L18 20l-.67-2.33L15 17l2.33-.67L18 14z" opacity="0.6"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 2a7.5 7.5 0 015 13v3a2 2 0 01-2 2h-6a2 2 0 01-2-2v-3A7.5 7.5 0 0112 2z" opacity="0.3"/><path d="M9 10h6M9 14h6"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.4 5.7 21l2.3-7L2 9.4h7.6L12 2z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4L12 13 2 4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  google: `<svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.43 3.44 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`,
  logoChart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 16 8 11 12 14 20 6"/><polyline points="16 6 20 6 20 10"/></svg>`,
};

export { icons };

// ============ 左侧品牌面板 HTML 生成 ============
function generateBrandPanel(heroTitle: string, heroSubtitle: string): string {
  return `
    <div class="auth-brand-panel">
      <div class="auth-badge">
        ${icons.sparkles}
        AI-POWERED PLATFORM
      </div>

      <h1 class="auth-hero-title">${heroTitle}</h1>
      <p class="auth-hero-subtitle">${heroSubtitle}</p>

      <div class="auth-features">
        <div class="auth-feature-card">
          <div class="auth-feature-icon blue">${icons.brain}</div>
          <div class="auth-feature-text">
            <h4>AI 驱动的智能分析</h4>
            <p>基于深度学习的财报分析、市场趋势预测与风险评估</p>
          </div>
        </div>
        <div class="auth-feature-card">
          <div class="auth-feature-icon orange">${icons.zap}</div>
          <div class="auth-feature-text">
            <h4>实时市场数据</h4>
            <p>毫秒级数据更新，把握每一个投资机会</p>
          </div>
        </div>
        <div class="auth-feature-card">
          <div class="auth-feature-icon green">${icons.shield}</div>
          <div class="auth-feature-text">
            <h4>机构级安全保障</h4>
            <p>银行级加密标准，确保你的数据和资产安全</p>
          </div>
        </div>
      </div>

      <div class="auth-metrics">
        <div class="auth-metric-card">
          <div class="auth-metric-label">
            ${icons.trend}
            TREND
          </div>
          <div class="auth-metric-value" style="color:#10B981;">+12.5%</div>
          <div class="auth-metric-bar-row">
            <div class="auth-metric-bar green" style="width:75%;"></div>
            <span class="auth-trend-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </div>
        <div class="auth-metric-card">
          <div class="auth-metric-label">
            ${icons.star}
            AI SCORE
          </div>
          <div class="auth-metric-value" style="color:#F59E0B;">87.3 <span class="unit">/100</span></div>
          <div class="auth-metric-bar orange" style="width:87%;"></div>
        </div>
        <div class="auth-metric-card">
          <div class="auth-metric-label">
            ${icons.chart}
            VOLUME
          </div>
          <div class="auth-metric-value">2.4 <span class="unit">B</span></div>
          <div class="auth-metric-bar purple">
            <span class="auth-metric-dot" style="background:#8B5CF6;"></span>
            <span class="auth-metric-dot" style="background:#A78BFA;"></span>
            <span class="auth-metric-dot lg" style="background:#8B5CF6;"></span>
            <span class="auth-metric-dot" style="background:#7C3AED;"></span>
            <span class="auth-metric-dot lg" style="background:#A78BFA;"></span>
            <span class="auth-metric-dot" style="background:#8B5CF6;"></span>
            <span class="auth-metric-dot lg" style="background:#7C3AED;"></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============ 共享脚本（Token 管理、表单工具） ============
const authSharedScript = `
  // --- Token 管理 ---
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

  // --- Guest fingerprint ---
  function getOrCreateGuestSessionId() {
    const key = 'guestSessionId';
    let id = localStorage.getItem(key);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      localStorage.setItem(key, id);
    }
    return id;
  }
  const guestFingerprint = getOrCreateGuestSessionId();

  // --- 表单工具 ---
  function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
      ? '${icons.eyeOff.replace(/'/g, "\\'")}'
      : '${icons.eye.replace(/'/g, "\\'")}';
  }

  function showError(boxId, message) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const textEl = box.querySelector('.auth-error-text');
    if (textEl) textEl.textContent = message;
    box.classList.add('visible');
  }

  function hideError(boxId) {
    const box = document.getElementById(boxId);
    if (box) box.classList.remove('visible');
  }

  function showSuccess(boxId, message) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const textEl = box.querySelector('.auth-success-text');
    if (textEl) textEl.textContent = message;
    box.classList.add('visible');
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // --- 邮箱验证 ---
  function isValidEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
  }

  // --- 已登录则跳转首页 ---
  (function() {
    const token = getToken();
    const isResetPage = window.location.pathname === '/reset-password';
    if (token && !isResetPage) {
      // 已登录，跳回首页
      // window.location.href = '/';
    }
  })();
`;

// ============ 组装页面 ============
export function generateAuthPage(options: AuthPageOptions): string {
  const { title, heroTitle, heroSubtitle, formHtml, pageScript, pageStyles = '' } = options;

  const body = `
    <div class="auth-page">
      <nav class="auth-navbar">
        <a href="/" class="auth-navbar-logo">
          <div class="auth-navbar-logo-icon">${icons.logoChart}</div>
          <span class="auth-navbar-logo-text">FinSpark</span>
        </a>
        <a href="/" class="auth-navbar-back">返回首页</a>
      </nav>
      <div class="auth-content">
        ${generateBrandPanel(heroTitle, heroSubtitle)}
        <div class="auth-form-panel">
          <div class="auth-form-card">
            ${formHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  const scripts = `
    ${authSharedScript}
    ${pageScript}
  `;

  return wrapWithPublicLayout({
    title: `${title} - FinSpark`,
    styles: `${authLayoutStyles}\n${pageStyles}`,
    body,
    scripts,
  });
}
