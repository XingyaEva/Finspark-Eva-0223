/**
 * Feature Cards - 功能特点展示区
 */

export const featureCardsStyles = `
  .features-section {
    padding: 48px 0;
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .feature-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border-gold);
    border-radius: var(--radius-xl);
    padding: 32px;
    transition: all 0.3s;
  }
  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 40px rgba(212,175,55,0.15);
    border-color: var(--gold-primary);
  }
  .feature-icon {
    width: 48px; height: 48px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
    font-size: 20px;
    color: white;
  }
  .feature-card h3 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--gold-primary);
  }
  .feature-card p {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
  }

  @media (max-width: 767px) {
    .features-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .feature-card { padding: 24px; }
  }
`;

export function generateFeatureCards(): string {
  return `
  <section class="features-section">
    <div class="public-container">
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon" style="background: linear-gradient(135deg, #d4af37, #f0b90b);">
            <i class="fas fa-brain"></i>
          </div>
          <h3>10大Agent协同</h3>
          <p>利润表、资产负债表、现金流、三表联动等多维度智能分析</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" style="background: linear-gradient(135deg, #d4af37, #f0b90b);">
            <i class="fas fa-chart-bar"></i>
          </div>
          <h3>实时数据分析</h3>
          <p>接入Tushare数据源，获取最新财务报表和市场数据</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" style="background: linear-gradient(135deg, #d4af37, #f0b90b);">
            <i class="fas fa-palette"></i>
          </div>
          <h3>AI漫画解读</h3>
          <p>将复杂财报转化为生动有趣的漫画，让分析更易懂</p>
        </div>
      </div>
    </div>
  </section>`;
}
