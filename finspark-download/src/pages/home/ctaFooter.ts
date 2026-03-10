/**
 * CTA Section + Footer
 */

export const ctaFooterStyles = `
  /* ---- CTA ---- */
  .cta-section {
    padding: 64px 0;
    text-align: center;
  }
  .cta-box {
    background: linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 100%);
    border: 1px solid var(--border-gold);
    border-radius: var(--radius-xl);
    padding: 48px 32px;
  }
  .cta-title {
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 700;
    margin-bottom: 12px;
  }
  .cta-desc {
    font-size: 15px;
    color: var(--text-muted);
    max-width: 480px;
    margin: 0 auto 28px;
    line-height: 1.6;
  }
  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 36px;
    background: var(--gold-gradient);
    color: #0a0a0a;
    font-weight: 700;
    font-size: 16px;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.2s;
  }
  .cta-btn:hover {
    box-shadow: var(--shadow-gold);
    transform: translateY(-2px);
  }

  /* ---- Footer ---- */
  .home-footer {
    border-top: 1px solid var(--border-default);
    padding: 32px 0;
    text-align: center;
    color: var(--text-dim);
    font-size: 13px;
  }
  .home-footer a {
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.2s;
  }
  .home-footer a:hover { color: var(--gold-primary); }
  .footer-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-bottom: 12px;
  }

  @media (max-width: 767px) {
    .cta-box { padding: 32px 20px; }
    .footer-links { gap: 16px; font-size: 12px; }
  }
`;

export function generateCtaSection(): string {
  return `
  <section class="cta-section">
    <div class="public-container">
      <div class="cta-box">
        <h2 class="cta-title"><span class="gold-gradient">开始您的智能投资之旅</span></h2>
        <p class="cta-desc">免费注册即可体验 AI 财报分析，让专业的投资分析不再遥不可及</p>
        <button class="cta-btn" onclick="showModal('registerModal')">
          <i class="fas fa-rocket"></i>
          立即免费体验
        </button>
      </div>
    </div>
  </section>`;
}

export function generateFooter(): string {
  return `
  <footer class="home-footer">
    <div class="public-container">
      <div class="footer-links">
        <a href="/membership">会员中心</a>
        <a href="/settings">帮助中心</a>
        <a href="#">隐私政策</a>
        <a href="#">服务条款</a>
      </div>
      <p>&copy; 2025 FinSpark 投资分析系统 | Powered by VectorEngine AI</p>
    </div>
  </footer>`;
}
