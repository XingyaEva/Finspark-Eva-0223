/**
 * Hero Section - 首页英雄区
 * 完全复刻 Figma: badge标签 + 标题 + 副标题 + 搜索框 + 行业标签 + 热门企业（带实时数据）
 */

export const heroSectionStyles = `
  .hero-section {
    padding-top: 120px;
    padding-bottom: 32px;
    text-align: center;
  }

  /* AI-Powered badge */
  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 24px;
    background: rgba(212, 175, 55, 0.08);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 100px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
    margin-bottom: 28px;
  }
  .hero-badge svg {
    width: 18px;
    height: 18px;
  }

  .hero-title {
    font-size: clamp(32px, 5vw, 52px);
    font-weight: 800;
    line-height: 1.15;
    margin-bottom: 16px;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: -0.5px;
  }
  .hero-title .gold {
    background: linear-gradient(135deg, #d4af37 0%, #f5d17e 50%, #d4af37 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-subtitle {
    font-size: clamp(15px, 2vw, 17px);
    color: rgba(255, 255, 255, 0.45);
    max-width: 500px;
    margin: 0 auto 56px;
    line-height: 1.6;
  }

  /* ---- 搜索框 ---- */
  .hero-search-wrapper {
    max-width: 720px;
    margin: 0 auto;
    position: relative;
  }
  .hero-search-box {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hero-search-input {
    flex: 1;
    padding: 18px 24px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    transition: all 0.3s;
    outline: none;
  }
  .hero-search-input:focus {
    border-color: rgba(212, 175, 55, 0.4);
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
    background: rgba(255, 255, 255, 0.06);
  }
  .hero-search-input::placeholder { color: rgba(255, 255, 255, 0.3); }
  .hero-search-btn {
    padding: 18px 32px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
    font-size: 15px;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .hero-search-btn svg {
    width: 18px;
    height: 18px;
  }
  .hero-search-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .hero-search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0; right: 0;
    background: rgba(21, 27, 40, 0.98);
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: 12px;
    backdrop-filter: blur(16px);
    overflow: hidden;
    z-index: 50;
    display: none;
    max-height: 360px;
    overflow-y: auto;
  }
  .hero-search-results.visible { display: block; }
  .hero-search-results .result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s;
  }
  .hero-search-results .result-item:last-child { border-bottom: none; }
  .hero-search-results .result-item:hover { background: rgba(255,255,255,0.06); }

  /* ---- 行业标签 ---- */
  .hero-industry-tags {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
  }
  .hero-industry-tag {
    padding: 10px 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    color: rgba(255, 255, 255, 0.55);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }
  .hero-industry-tag:hover {
    border-color: rgba(212, 175, 55, 0.3);
    color: rgba(255, 255, 255, 0.85);
    background: rgba(212, 175, 55, 0.06);
  }

  /* ---- 热门企业 section ---- */
  .hot-stocks-section {
    margin-top: 64px;
    text-align: left;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 24px;
  }
  .hot-stocks-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .hot-stocks-title-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hot-stocks-title {
    font-size: 24px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.95);
  }
  .hot-stocks-subtitle {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 8px;
  }
  .hot-stocks-view-all {
    padding: 10px 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .hot-stocks-view-all:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.06);
  }

  /* ---- 热门股票卡片网格 - 3列 ---- */
  .hot-stocks-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  /* 单张卡片 - 完全复刻 Figma */
  .hot-stock-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }
  .hot-stock-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(212, 175, 55, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  /* 卡片顶部: 名称 + 价格 */
  .hsc-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .hsc-name {
    font-size: 18px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }
  .hsc-price {
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    letter-spacing: -0.5px;
  }

  /* 代码 + 行业 badges + 涨跌幅 */
  .hsc-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .hsc-code-badge {
    padding: 3px 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: rgba(255, 255, 255, 0.5);
  }
  .hsc-industry-badge {
    padding: 3px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }
  .hsc-change {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  .hsc-change.up { color: #10B981; }
  .hsc-change.down { color: #EF4444; }
  .hsc-change svg { width: 16px; height: 16px; }

  /* 迷你走势图区域 */
  .hsc-sparkline {
    height: 60px;
    margin-bottom: 20px;
    position: relative;
  }
  .hsc-sparkline canvas {
    width: 100%;
    height: 100%;
  }

  /* 底部: 市值 + 市盈率 */
  .hsc-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }
  .hsc-metric-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    margin-bottom: 2px;
  }
  .hsc-metric-value {
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  .hsc-metric-right {
    text-align: right;
  }

  /* 加载骨架屏 */
  .hsc-skeleton {
    animation: hscPulse 1.8s infinite ease-in-out;
  }
  @keyframes hscPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
  .hsc-skeleton-bar {
    background: rgba(255, 255, 255, 0.06);
    border-radius: 6px;
  }

  @media (max-width: 1024px) {
    .hot-stocks-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 767px) {
    .hero-section { padding-top: 96px; padding-bottom: 24px; }
    .hero-search-box { flex-direction: column; }
    .hero-search-btn { width: 100%; justify-content: center; }
    .hero-industry-tags { gap: 8px; }
    .hero-industry-tag { padding: 8px 16px; font-size: 13px; }
    .hot-stocks-grid { grid-template-columns: 1fr; }
    .hot-stocks-section { padding: 0 16px; }
  }
`;

export function generateHeroSection(analysisConfigHtml: string): string {
  return `
  <section class="hero-section">
    <div class="public-container">
      <!-- AI Badge -->
      <div class="hero-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="#D4A017" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        AI-Powered Financial Intelligence
      </div>

      <h1 class="hero-title">
        <span class="gold">AI驱动的</span>智能财报分析
      </h1>
      <p class="hero-subtitle">多Agent协同分析，深度解读企业财务健康状况</p>

      <div class="hero-search-wrapper">
        <div class="hero-search-box">
          <input type="text" id="searchInput" class="hero-search-input" placeholder="输入公司名称、股票代码或行业关键词...">
          <button id="searchBtn" class="hero-search-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            搜索
          </button>
        </div>
        <div id="searchResults" class="hero-search-results"></div>

        <!-- 行业标签 -->
        <div class="hero-industry-tags">
          <span class="hero-industry-tag" onclick="searchByIndustry('科技')">科技</span>
          <span class="hero-industry-tag" onclick="searchByIndustry('金融')">金融</span>
          <span class="hero-industry-tag" onclick="searchByIndustry('医疗')">医疗</span>
          <span class="hero-industry-tag" onclick="searchByIndustry('能源')">能源</span>
          <span class="hero-industry-tag" onclick="searchByIndustry('消费')">消费</span>
          <span class="hero-industry-tag" onclick="searchByIndustry('制造')">制造</span>
        </div>

        ${analysisConfigHtml}
      </div>
    </div>

    <!-- 热门企业 Section -->
    <div class="hot-stocks-section">
      <div class="hot-stocks-header">
        <div class="hot-stocks-title-group">
          <h2 class="hot-stocks-title">
            🔥
            <span>热门企业</span>
          </h2>
          <p class="hot-stocks-subtitle">实时追踪市场热点与投资机会</p>
        </div>
        <a href="/analysis" class="hot-stocks-view-all">查看全部</a>
      </div>
      <div id="hotStocks" class="hot-stocks-grid">
        ${generateSkeletonCards(6)}
      </div>
    </div>
  </section>`;
}

function generateSkeletonCards(count: number): string {
  return Array.from({ length: count }, () => `
    <div class="hot-stock-card hsc-skeleton">
      <div class="hsc-top">
        <div class="hsc-skeleton-bar" style="width:80px;height:22px;"></div>
        <div class="hsc-skeleton-bar" style="width:100px;height:28px;"></div>
      </div>
      <div class="hsc-meta">
        <div class="hsc-skeleton-bar" style="width:72px;height:22px;"></div>
        <div class="hsc-skeleton-bar" style="width:40px;height:22px;"></div>
      </div>
      <div class="hsc-sparkline">
        <div class="hsc-skeleton-bar" style="width:100%;height:100%;"></div>
      </div>
      <div class="hsc-bottom">
        <div><div class="hsc-skeleton-bar" style="width:40px;height:14px;margin-bottom:4px;"></div><div class="hsc-skeleton-bar" style="width:60px;height:18px;"></div></div>
        <div><div class="hsc-skeleton-bar" style="width:40px;height:14px;margin-bottom:4px;margin-left:auto;"></div><div class="hsc-skeleton-bar" style="width:40px;height:18px;margin-left:auto;"></div></div>
      </div>
    </div>
  `).join('');
}

/**
 * Hero 搜索 + 热门股票渲染 JavaScript
 */
export const heroSearchScript = `
  // ============ 搜索相关 ============
  let selectedStock = null;
  let searchTimeout;
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  const searchBtn = document.getElementById('searchBtn');
  const hotStocksContainer = document.getElementById('hotStocks');

  // 搜索缓存
  const searchCache = {
    hot: null,
    results: new Map(),
    maxSize: 50,
    ttl: 5 * 60 * 1000,
    timestamps: new Map(),
    get(keyword) {
      const cached = this.results.get(keyword);
      const ts = this.timestamps.get(keyword);
      if (cached && ts && (Date.now() - ts < this.ttl)) return cached;
      return null;
    },
    set(keyword, results) {
      if (this.results.size >= this.maxSize) {
        const oldest = this.results.keys().next().value;
        this.results.delete(oldest);
        this.timestamps.delete(oldest);
      }
      this.results.set(keyword, results);
      this.timestamps.set(keyword, Date.now());
    }
  };

  // 行业搜索
  function searchByIndustry(industry) {
    searchInput.value = industry;
    searchStocks(industry);
    searchInput.focus();
  }

  // 格式化市值
  function formatMarketCap(mv) {
    if (!mv) return '--';
    // mv from tushare is in 万元
    const yi = mv / 10000;
    if (yi >= 10000) return (yi / 10000).toFixed(2) + '万亿';
    return yi.toFixed(0).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') + '亿';
  }

  // 绘制迷你走势图
  function drawSparkline(canvas, data, isUp) {
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / (data.length - 1);

    // 绘制渐变填充
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    if (isUp) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    }

    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h * 0.85) - h * 0.05;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制线条
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h * 0.85) - h * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 渲染热门股票卡片（带实时数据）
  function renderHotStockCards(stocks) {
    if (!hotStocksContainer) return;
    hotStocksContainer.innerHTML = stocks.map((s, idx) => {
      const isUp = (s.pct_chg || 0) >= 0;
      const changeStr = isUp ? '+' + (s.pct_chg || 0).toFixed(2) + '%' : (s.pct_chg || 0).toFixed(2) + '%';
      const changeClass = isUp ? 'up' : 'down';
      const changeIcon = isUp
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 18 L7 12 L12 15 L22 5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 6 L7 12 L12 9 L22 19"/></svg>';
      const priceStr = s.close ? '¥' + Number(s.close).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--';

      return '<div class="hot-stock-card" onclick="selectStock(\\'' + s.code + '\\', \\'' + s.name + '\\')">' +
        '<div class="hsc-top">' +
          '<div class="hsc-name">' + s.name + '</div>' +
          '<div class="hsc-price">' + priceStr + '</div>' +
        '</div>' +
        '<div class="hsc-meta">' +
          '<span class="hsc-code-badge">' + s.code + '</span>' +
          '<span class="hsc-industry-badge">' + (s.industry || '') + '</span>' +
          '<span class="hsc-change ' + changeClass + '">' + changeIcon + ' ' + changeStr + '</span>' +
        '</div>' +
        '<div class="hsc-sparkline"><canvas id="spark-' + idx + '"></canvas></div>' +
        '<div class="hsc-bottom">' +
          '<div><div class="hsc-metric-label">市值</div><div class="hsc-metric-value">' + formatMarketCap(s.total_mv) + '</div></div>' +
          '<div class="hsc-metric-right"><div class="hsc-metric-label">市盈率</div><div class="hsc-metric-value">' + (s.pe ? s.pe.toFixed(1) : '--') + '</div></div>' +
        '</div>' +
      '</div>';
    }).join('');

    // 绘制走势图
    requestAnimationFrame(() => {
      stocks.forEach((s, idx) => {
        const canvas = document.getElementById('spark-' + idx);
        if (canvas && s.sparkline && s.sparkline.length > 1) {
          drawSparkline(canvas, s.sparkline, (s.pct_chg || 0) >= 0);
        }
      });
    });
  }

  // 加载热门股票 - 尝试带详情的API，降级到基础API
  async function loadHotStocks() {
    try {
      // 先尝试新的详情接口
      const detailRes = await fetch('/api/stock/hot-detail');
      const detailData = await detailRes.json();
      if (detailData.success && detailData.data && detailData.data.length > 0) {
        searchCache.hot = detailData.data;
        renderHotStockCards(detailData.data);
        return;
      }
    } catch (e) {
      console.warn('Hot detail API failed, falling back:', e);
    }

    // 降级到基础接口
    try {
      const response = await fetch('/api/stock/hot');
      const data = await response.json();
      if (data.success) {
        searchCache.hot = data.data;
        renderHotStockCards(data.data.map(s => ({
          ...s,
          close: null,
          pct_chg: null,
          total_mv: null,
          pe: null,
          sparkline: null,
        })));
      }
    } catch (error) {
      console.error('Load hot stocks error:', error);
    }
  }

  // 搜索股票
  let searchAbortController = null;
  async function searchStocks(keyword) {
    keyword = keyword.trim();
    if (keyword.length < 1) { searchResults.classList.remove('visible'); return; }

    if (searchAbortController) searchAbortController.abort();
    searchAbortController = new AbortController();

    const codeMatch = keyword.match(/^(\\d{6})(\\.S[HZ])?$/i);
    if (codeMatch) {
      const code = codeMatch[1];
      const suffix = code.startsWith('6') ? '.SH' : '.SZ';
      const fullCode = codeMatch[2] ? keyword.toUpperCase() : code + suffix;
      searchResults.innerHTML = '<div class="result-item" onclick="selectStock(\\'' + fullCode + '\\', \\'' + fullCode + '\\')"><div><div style="font-weight:600;" class="gold-text"><i class="fas fa-check-circle" style="margin-right:8px;color:#10B981;"></i>' + fullCode + '</div><div style="font-size:13px;color:rgba(255,255,255,0.45);">点击直接使用此代码分析</div></div></div>';
      searchResults.classList.add('visible');
      try {
        const res = await fetch('/api/stock/search?q=' + encodeURIComponent(keyword), { signal: searchAbortController.signal });
        const data = await res.json();
        if (data.success && data.results.length > 0) { renderSearchResults(data.results); searchCache.set(keyword, data.results); }
      } catch(e) {}
      return;
    }

    const cached = searchCache.get(keyword);
    if (cached) { renderSearchResults(cached); return; }

    searchResults.innerHTML = '<div style="padding:12px;text-align:center;color:rgba(255,255,255,0.45);font-size:14px;"><i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>搜索中...</div>';
    searchResults.classList.add('visible');

    try {
      const res = await fetch('/api/stock/search?q=' + encodeURIComponent(keyword), { signal: searchAbortController.signal });
      const data = await res.json();
      if (data.success && data.results.length > 0) {
        searchCache.set(keyword, data.results);
        renderSearchResults(data.results);
      } else if (searchCache.hot && searchCache.hot.length > 0) {
        searchResults.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.04);"><i class="fas fa-info-circle" style="margin-right:4px;"></i>未找到 "' + keyword + '"，推荐热门：</div>' +
          searchCache.hot.slice(0, 5).map(s => '<div class="result-item" onclick="selectStock(\\'' + s.code + '\\', \\'' + s.name + '\\')"><div><div style="font-weight:500;">' + s.name + '</div><div style="font-size:13px;color:rgba(255,255,255,0.45);">' + s.code + '</div></div><div style="font-size:12px;color:rgba(255,255,255,0.3);">' + (s.industry||'') + '</div></div>').join('');
        searchResults.classList.add('visible');
      } else {
        searchResults.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(255,255,255,0.45);">暂无 "' + keyword + '" 相关结果</div>';
        searchResults.classList.add('visible');
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Search error:', e);
    }
  }

  function renderSearchResults(results) {
    searchResults.innerHTML = results.slice(0, 8).map(s =>
      '<div class="result-item" onclick="selectStock(\\'' + s.code + '\\', \\'' + s.name + '\\')"><div><div style="font-weight:500;">' + s.name + '</div><div style="font-size:13px;color:rgba(255,255,255,0.45);">' + s.code + '</div></div><div style="font-size:12px;color:rgba(255,255,255,0.3);">' + (s.industry||'') + '</div></div>'
    ).join('');
    searchResults.classList.add('visible');
  }

  function selectStock(code, name) {
    selectedStock = { code, name };
    searchInput.value = name === code ? code : name + ' (' + code + ')';
    searchResults.classList.remove('visible');
  }

  function startAnalysis() {
    if (!selectedStock) {
      const input = searchInput.value.trim();
      const codeMatch = input.match(/^(\\d{6})(\\.S[HZ])?$/i);
      if (codeMatch) {
        const code = codeMatch[1];
        const suffix = code.startsWith('6') ? '.SH' : '.SZ';
        const fullCode = codeMatch[2] ? input.toUpperCase() : code + suffix;
        selectedStock = { code: fullCode, name: fullCode };
      } else {
        alert('请选择一个股票或输入有效的6位股票代码（如 600519）');
        return;
      }
    }
    let configParams = '';
    if (typeof getAnalysisPresetOverrides === 'function') {
      const overrides = getAnalysisPresetOverrides();
      if (overrides && overrides.globalPresetId) configParams = '&presetId=' + overrides.globalPresetId;
      if (overrides && overrides.globalModelPreference) configParams += '&model=' + overrides.globalModelPreference;
    }
    window.location.href = '/analysis?code=' + selectedStock.code + '&name=' + encodeURIComponent(selectedStock.name) + configParams;
  }

  // 事件绑定
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchStocks(e.target.value), 150);
  });
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.length >= 2) searchResults.classList.add('visible');
  });
  searchBtn.addEventListener('click', startAnalysis);
  searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') startAnalysis(); });
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.remove('visible');
    }
  });
`;
