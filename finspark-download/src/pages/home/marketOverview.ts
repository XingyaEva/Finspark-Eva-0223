/**
 * Market Overview - 市场概览区 (新增功能)
 * 显示主要指数迷你卡片
 */

export const marketOverviewStyles = `
  .market-overview-section {
    padding: 0 0 48px;
  }
  .market-overview-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .market-overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .market-index-card {
    background: var(--bg-card);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: 20px;
    transition: all 0.3s;
  }
  .market-index-card:hover {
    border-color: var(--border-gold);
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  }
  .market-index-name {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .market-index-value {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .market-index-change {
    font-size: 13px;
    font-weight: 500;
  }
  .market-index-change.up { color: var(--color-danger); }
  .market-index-change.down { color: var(--color-success); }
  .market-index-change.flat { color: var(--text-dim); }

  @media (max-width: 767px) {
    .market-overview-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .market-index-value { font-size: 18px; }
  }
`;

export function generateMarketOverview(): string {
  return `
  <section class="market-overview-section">
    <div class="public-container">
      <h2 class="market-overview-title">
        <i class="fas fa-chart-line gold-text"></i>
        <span class="gold-gradient">市场概览</span>
      </h2>
      <div id="marketOverviewGrid" class="market-overview-grid">
        <!-- 静态 mock 数据，后续可接入 API -->
        <div class="market-index-card">
          <div class="market-index-name">上证指数</div>
          <div class="market-index-value">3,267.59</div>
          <div class="market-index-change up">+0.43% ↑</div>
        </div>
        <div class="market-index-card">
          <div class="market-index-name">深证成指</div>
          <div class="market-index-value">10,158.32</div>
          <div class="market-index-change up">+0.67% ↑</div>
        </div>
        <div class="market-index-card">
          <div class="market-index-name">创业板指</div>
          <div class="market-index-value">2,022.78</div>
          <div class="market-index-change down">-0.21% ↓</div>
        </div>
        <div class="market-index-card">
          <div class="market-index-name">科创50</div>
          <div class="market-index-value">989.45</div>
          <div class="market-index-change up">+1.12% ↑</div>
        </div>
      </div>
    </div>
  </section>`;
}
