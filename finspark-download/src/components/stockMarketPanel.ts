/**
 * 股票走势面板组件
 * 
 * 功能：
 * 1. 全局行情报价条（跨Tab常驻）
 * 2. Tab1: 行情走势 - K线图 + 解读侧栏
 * 3. Tab2: 交易活跃 - 换手率/量比分析
 * 4. Tab3: 估值分析 - PE/PB分位数
 * 5. Tab4: 股本市值 - 股本结构可视化
 * 
 * 设计维度：
 * - 股民看盘效率：当日核心指标一目了然
 * - 金融指标表达：专业准确的数据展示
 * - ECharts交互性：支持缩放、时段切换、均线开关
 */

// ========== 样式定义 ==========
export const stockMarketPanelStyles = `
  /* 股票走势面板容器 */
  .stock-market-panel {
    display: block !important;
    background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(30, 30, 50, 0.95) 100%) !important;
    border: 1px solid rgba(212, 175, 55, 0.2) !important;
    border-radius: 16px !important;
    padding: 20px !important;
    margin-bottom: 24px !important;
    position: relative !important;
  }
  
  .stock-market-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #d4af37, #f0d78c, #d4af37);
    border-radius: 16px 16px 0 0;
  }
  
  /* 面板标题区 */
  .smp-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 16px;
  }
  
  .smp-title {
    display: flex !important;
    align-items: center !important;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
    color: #f0f0f0;
  }
  
  .smp-title-icon {
    font-size: 20px;
  }
  
  .smp-data-source {
    font-size: 12px;
    color: #6b7280;
    display: flex !important;
    align-items: center !important;
    gap: 6px;
  }
  
  .smp-data-source .source-tag {
    background: rgba(212, 175, 55, 0.15);
    color: #d4af37;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
  }
  
  /* 全局行情报价条 - 紧凑布局 */
  .smp-quote-bar {
    background: rgba(0, 0, 0, 0.3) !important;
    border-radius: 12px !important;
    padding: 16px 20px !important;
    margin-bottom: 20px !important;
    display: grid !important;
    grid-template-columns: auto 1fr !important;
    align-items: center !important;
    gap: 24px !important;
  }
  
  .quote-main {
    display: flex !important;
    align-items: center !important;
    gap: 16px;
  }
  
  .quote-price {
    font-size: 36px;
    font-weight: 700;
    font-family: 'Roboto Mono', monospace;
    line-height: 1;
  }
  
  .quote-price.rise { color: #ef4444; }
  .quote-price.fall { color: #22c55e; }
  .quote-price.flat { color: #9ca3af; }
  
  .quote-change {
    display: flex !important;
    align-items: center !important;
    gap: 8px;
  }
  
  .quote-change-value {
    font-size: 18px;
    font-weight: 600;
  }
  
  .quote-change-pct {
    font-size: 14px;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 600;
  }
  
  .quote-change.rise .quote-change-value { color: #ef4444; }
  .quote-change.rise .quote-change-pct { 
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  .quote-change.fall .quote-change-value { color: #22c55e; }
  .quote-change.fall .quote-change-pct { 
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  .quote-change.flat .quote-change-value { color: #9ca3af; }
  .quote-change.flat .quote-change-pct { 
    background: rgba(156, 163, 175, 0.2);
    color: #9ca3af;
  }
  
  /* 行情指标组 - 紧凑横向排列 */
  .quote-metrics {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 12px 24px !important;
    justify-content: flex-end !important;
  }
  
  .quote-metric {
    display: flex !important;
    align-items: center !important;
    gap: 8px;
    white-space: nowrap;
  }
  
  .quote-metric-label {
    font-size: 12px;
    color: #6b7280;
  }
  
  .quote-metric-value {
    font-size: 14px;
    font-weight: 600;
    color: #e5e7eb;
    font-family: 'Roboto Mono', monospace;
  }
  
  /* 小型加载状态 */
  .smp-loading-small {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
  
  .smp-loading-spinner-small {
    width: 24px;
    height: 24px;
    border: 2px solid rgba(212, 175, 55, 0.2);
    border-top-color: #d4af37;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  /* Tab导航 */
  .smp-tabs {
    display: flex !important;
    gap: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    padding: 4px;
    margin-bottom: 20px;
  }
  
  .smp-tab {
    flex: 1;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    color: #9ca3af;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px;
  }
  
  .smp-tab:hover {
    color: #d4af37;
    background: rgba(212, 175, 55, 0.1);
  }
  
  .smp-tab.active {
    color: #1a1a2e;
    background: linear-gradient(135deg, #d4af37 0%, #f0d78c 100%);
    font-weight: 600;
  }
  
  .smp-tab-icon {
    font-size: 14px;
  }
  
  /* Tab内容区 */
  .smp-tab-content {
    display: none;
  }
  
  .smp-tab-content.active {
    display: block !important;
  }
  
  /* Tab1: K线图区域 */
  .kline-section {
    display: grid !important;
    grid-template-columns: 1fr 300px;
    gap: 20px;
  }
  
  @media (max-width: 1024px) {
    .kline-section {
      grid-template-columns: 1fr;
    }
  }
  
  .kline-chart-container {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    padding: 16px;
    min-height: 400px;
  }
  
  .kline-toolbar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .kline-period-btns {
    display: flex !important;
    gap: 4px;
  }
  
  .kline-period-btn {
    padding: 6px 12px;
    font-size: 12px;
    color: #9ca3af;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .kline-period-btn:hover {
    color: #d4af37;
    border-color: rgba(212, 175, 55, 0.3);
  }
  
  .kline-period-btn.active {
    color: #d4af37;
    background: rgba(212, 175, 55, 0.15);
    border-color: #d4af37;
  }
  
  .ma-toggles {
    display: flex !important;
    gap: 8px;
  }
  
  .ma-toggle {
    display: flex !important;
    align-items: center !important;
    gap: 4px;
    font-size: 12px;
    color: #9ca3af;
    cursor: pointer;
  }
  
  .ma-toggle input {
    accent-color: #d4af37;
  }
  
  .ma-toggle.ma5 { color: #f59e0b; }
  .ma-toggle.ma10 { color: #3b82f6; }
  .ma-toggle.ma20 { color: #8b5cf6; }
  .ma-toggle.ma60 { color: #ec4899; }
  
  .kline-chart {
    width: 100%;
    height: 350px;
  }
  
  /* 解读侧栏 */
  .insight-sidebar {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    padding: 16px;
    max-height: 450px;
    overflow-y: auto;
  }
  
  .insight-sidebar::-webkit-scrollbar {
    width: 6px;
  }
  
  .insight-sidebar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }
  
  .insight-sidebar::-webkit-scrollbar-thumb {
    background: rgba(212, 175, 55, 0.3);
    border-radius: 3px;
  }
  
  .insight-title {
    font-size: 15px;
    font-weight: 600;
    color: #d4af37;
    margin-bottom: 12px;
    display: flex !important;
    align-items: center !important;
    gap: 6px;
  }
  
  .insight-summary {
    background: rgba(212, 175, 55, 0.1);
    border-left: 3px solid #d4af37;
    padding: 12px;
    border-radius: 0 8px 8px 0;
    margin-bottom: 16px;
  }
  
  .insight-headline {
    font-size: 16px;
    font-weight: 600;
    color: #f0f0f0;
    margin-bottom: 8px;
  }
  
  .insight-sentiment {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px;
    font-size: 12px;
    padding: 3px 10px;
    border-radius: 4px;
  }
  
  .insight-sentiment.bullish {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  .insight-sentiment.bearish {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  .insight-sentiment.neutral {
    background: rgba(156, 163, 175, 0.2);
    color: #9ca3af;
  }
  
  .insight-items {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px;
  }
  
  .insight-item {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 10px 12px;
    border-left: 3px solid;
  }
  
  .insight-item.positive { border-color: #ef4444; }
  .insight-item.negative { border-color: #22c55e; }
  .insight-item.neutral { border-color: #6b7280; }
  
  .insight-conclusion {
    font-size: 13px;
    font-weight: 500;
    color: #e5e7eb;
    margin-bottom: 6px;
  }
  
  .insight-evidence {
    font-size: 11px;
    color: #9ca3af;
    line-height: 1.5;
  }
  
  .insight-category {
    font-size: 10px;
    color: #6b7280;
    margin-top: 4px;
  }
  
  /* Tab2: 交易活跃 */
  .trading-section {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
  }
  
  .trading-card {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    padding: 20px;
  }
  
  .trading-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #d4af37;
    margin-bottom: 16px;
    display: flex !important;
    align-items: center !important;
    gap: 8px;
  }
  
  .trading-gauge {
    position: relative;
    height: 120px;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  .trading-gauge-value {
    font-size: 28px;
    font-weight: 700;
    color: #f0f0f0;
  }
  
  .trading-gauge-label {
    font-size: 12px;
    color: #9ca3af;
    text-align: center;
    margin-top: 8px;
  }
  
  .trading-percentile {
    display: flex !important;
    align-items: center !important;
    gap: 8px;
    margin-top: 12px;
  }
  
  .percentile-bar {
    flex: 1;
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .percentile-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
  }
  
  .percentile-fill.high { background: linear-gradient(90deg, #ef4444, #f97316); }
  .percentile-fill.normal { background: linear-gradient(90deg, #3b82f6, #6366f1); }
  .percentile-fill.low { background: linear-gradient(90deg, #22c55e, #10b981); }
  
  .percentile-text {
    font-size: 12px;
    color: #9ca3af;
    min-width: 40px;
    text-align: right;
  }
  
  .activity-level {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    margin-top: 12px;
  }
  
  .activity-level.active {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  .activity-level.normal {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  
  .activity-level.quiet {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  /* Tab3: 估值分析 */
  .valuation-section {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  
  .valuation-card {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    padding: 20px;
  }
  
  .valuation-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    margin-bottom: 16px;
  }
  
  .valuation-title {
    font-size: 14px;
    font-weight: 600;
    color: #d4af37;
    display: flex !important;
    align-items: center !important;
    gap: 8px;
  }
  
  .valuation-level {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
  }
  
  .valuation-level.undervalued {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  .valuation-level.fair {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  
  .valuation-level.overvalued {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  .valuation-current {
    font-size: 36px;
    font-weight: 700;
    color: #f0f0f0;
    margin-bottom: 8px;
  }
  
  .valuation-range {
    display: flex !important;
    align-items: center !important;
    gap: 8px;
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 16px;
  }
  
  .valuation-percentile-bar {
    position: relative;
    height: 24px;
    background: linear-gradient(90deg, 
      rgba(34, 197, 94, 0.3) 0%, 
      rgba(59, 130, 246, 0.3) 50%, 
      rgba(239, 68, 68, 0.3) 100%
    );
    border-radius: 12px;
    overflow: visible;
  }
  
  .valuation-marker {
    position: absolute;
    top: -4px;
    width: 4px;
    height: 32px;
    background: #d4af37;
    border-radius: 2px;
    transform: translateX(-50%);
  }
  
  .valuation-labels {
    display: flex !important;
    justify-content: space-between !important;
    margin-top: 8px;
    font-size: 11px;
    color: #6b7280;
  }
  
  /* Tab4: 股本市值 */
  .shares-section {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
  }
  
  .shares-card {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    padding: 20px;
  }
  
  .shares-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #d4af37;
    margin-bottom: 16px;
    display: flex !important;
    align-items: center !important;
    gap: 8px;
  }
  
  .shares-pie-chart {
    width: 100%;
    height: 200px;
  }
  
  .shares-list {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px;
  }
  
  .shares-item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .shares-item:last-child {
    border-bottom: none;
  }
  
  .shares-item-label {
    font-size: 13px;
    color: #9ca3af;
    display: flex !important;
    align-items: center !important;
    gap: 8px;
  }
  
  .shares-item-value {
    font-size: 15px;
    font-weight: 600;
    color: #e5e7eb;
    font-family: 'Roboto Mono', monospace;
  }
  
  .market-cap-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    margin-top: 12px;
  }
  
  .market-cap-badge.large {
    background: rgba(212, 175, 55, 0.2);
    color: #d4af37;
  }
  
  .market-cap-badge.mid {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }
  
  .market-cap-badge.small {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  
  /* 加载状态 */
  .smp-loading {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 300px;
    gap: 16px;
  }
  
  .smp-loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(212, 175, 55, 0.2);
    border-top-color: #d4af37;
    border-radius: 50%;
    animation: smpSpin 1s linear infinite;
  }
  
  @keyframes smpSpin {
    to { transform: rotate(360deg); }
  }
  
  .smp-loading-text {
    font-size: 14px;
    color: #9ca3af;
  }
  
  /* 错误状态 */
  .smp-error {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 200px;
    gap: 12px;
    color: #ef4444;
  }
  
  .smp-error-icon {
    font-size: 32px;
  }
  
  .smp-error-text {
    font-size: 14px;
  }
  
  /* 更新时间 */
  .smp-update-time {
    text-align: right;
    font-size: 11px;
    color: #6b7280;
    margin-top: 16px;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 6px;
  }
  
  /* ========== Tab底部智能解读区域 ========== */
  .tab-insight-section {
    margin-top: 20px;
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(212, 175, 55, 0.02) 100%);
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: 12px;
  }
  
  .tab-insight-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    margin-bottom: 14px;
  }
  
  .tab-insight-title {
    display: flex !important;
    align-items: center !important;
    gap: 8px;
    color: #d4af37;
    font-weight: 600;
    font-size: 14px;
  }
  
  .tab-insight-title i {
    font-size: 16px;
  }
  
  /* 上下堆叠布局 - 专业版和白话版同时显示 */
  .tab-insight-content-stacked {
    display: flex !important;
    flex-direction: column !important;
    gap: 16px;
  }
  
  .insight-block {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 14px 16px;
    border-left: 3px solid #d4af37;
  }
  
  .insight-block.professional {
    border-left-color: #d4af37;
  }
  
  .insight-block.simple {
    border-left-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }
  
  .insight-block-label {
    display: flex !important;
    align-items: center !important;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    margin-bottom: 8px;
  }
  
  .insight-block.professional .insight-block-label {
    color: #d4af37;
  }
  
  .insight-block.simple .insight-block-label {
    color: #3b82f6;
  }
  
  .insight-text-area {
    font-size: 14px;
    line-height: 1.8;
    color: #e5e7eb;
  }
  
  .insight-block.professional .insight-text-area {
    font-family: 'Noto Serif SC', 'Noto Sans SC', serif;
    letter-spacing: 0.02em;
  }
  
  .insight-block.simple .insight-text-area {
    font-family: 'Noto Sans SC', sans-serif;
    color: #d1d5db;
  }
  
  .tab-insight-keypoints {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .keypoint-tag {
    padding: 4px 12px;
    font-size: 12px;
    background: rgba(212, 175, 55, 0.1);
    color: #d4af37;
    border-radius: 4px;
    font-weight: 500;
  }
  
  .keypoint-tag.bullish {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }
  
  .keypoint-tag.bearish {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }
  
  .keypoint-tag.neutral {
    background: rgba(156, 163, 175, 0.15);
    color: #9ca3af;
  }
  
  /* 解读加载状态 */
  .tab-insight-loading {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 10px;
    padding: 20px;
    color: #9ca3af;
    font-size: 13px;
  }
  
  .tab-insight-loading .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(212, 175, 55, 0.2);
    border-top-color: #d4af37;
    border-radius: 50%;
    animation: smpSpin 0.8s linear infinite;
  }
`;

// ========== HTML 模板 ==========
export const stockMarketPanelHtml = `
  <!-- 股票走势面板 -->
  <div id="stockMarketPanel" class="stock-market-panel" style="display: none;">
    <!-- 标题区 -->
    <div class="smp-header">
      <div class="smp-title">
        <span class="smp-title-icon">📈</span>
        <span>股票走势分析</span>
      </div>
      <div class="smp-data-source">
        <span>数据来源：</span>
        <span class="source-tag">Tushare</span>
        <span id="smpTradeDate"></span>
      </div>
    </div>
    
    <!-- 全局行情报价条 -->
    <div id="smpQuoteBar" class="smp-quote-bar">
      <div class="quote-main">
        <span id="quotePrice" class="quote-price flat">--</span>
        <div id="quoteChange" class="quote-change flat">
          <span class="quote-change-value">--</span>
          <span class="quote-change-pct">--</span>
        </div>
      </div>
      <div class="quote-metrics">
        <div class="quote-metric">
          <div class="quote-metric-label">开盘</div>
          <div id="quoteOpen" class="quote-metric-value">--</div>
        </div>
        <div class="quote-metric">
          <div class="quote-metric-label">最高</div>
          <div id="quoteHigh" class="quote-metric-value">--</div>
        </div>
        <div class="quote-metric">
          <div class="quote-metric-label">最低</div>
          <div id="quoteLow" class="quote-metric-value">--</div>
        </div>
        <div class="quote-metric">
          <div class="quote-metric-label">成交量</div>
          <div id="quoteVolume" class="quote-metric-value">--</div>
        </div>
        <div class="quote-metric">
          <div class="quote-metric-label">成交额</div>
          <div id="quoteAmount" class="quote-metric-value">--</div>
        </div>
        <div class="quote-metric">
          <div class="quote-metric-label">换手率</div>
          <div id="quoteTurnover" class="quote-metric-value">--</div>
        </div>
        <div class="quote-metric">
          <div class="quote-metric-label">振幅</div>
          <div id="quoteAmplitude" class="quote-metric-value">--</div>
        </div>
      </div>
    </div>
    
    <!-- Tab导航 -->
    <div class="smp-tabs">
      <button class="smp-tab active" data-tab="trend">
        <i class="fas fa-chart-line smp-tab-icon"></i>
        <span>行情走势</span>
      </button>
      <button class="smp-tab" data-tab="trading">
        <i class="fas fa-exchange-alt smp-tab-icon"></i>
        <span>交易活跃</span>
      </button>
      <button class="smp-tab" data-tab="valuation">
        <i class="fas fa-balance-scale smp-tab-icon"></i>
        <span>估值分析</span>
      </button>
      <button class="smp-tab" data-tab="shares">
        <i class="fas fa-chart-pie smp-tab-icon"></i>
        <span>股本市值</span>
      </button>
    </div>
    
    <!-- Tab1: 行情走势 -->
    <div id="tabTrend" class="smp-tab-content active">
      <div class="kline-section">
        <div class="kline-chart-container">
          <div class="kline-toolbar">
            <div class="kline-period-btns">
              <button class="kline-period-btn" data-days="7">1周</button>
              <button class="kline-period-btn" data-days="30">1月</button>
              <button class="kline-period-btn active" data-days="90">3月</button>
              <button class="kline-period-btn" data-days="180">6月</button>
              <button class="kline-period-btn" data-days="365">1年</button>
            </div>
            <div class="ma-toggles">
              <label class="ma-toggle ma5">
                <input type="checkbox" id="maToggle5" checked> MA5
              </label>
              <label class="ma-toggle ma10">
                <input type="checkbox" id="maToggle10" checked> MA10
              </label>
              <label class="ma-toggle ma20">
                <input type="checkbox" id="maToggle20" checked> MA20
              </label>
              <label class="ma-toggle ma60">
                <input type="checkbox" id="maToggle60"> MA60
              </label>
            </div>
          </div>
          <div id="klineChart" class="kline-chart"></div>
        </div>
        
        <div class="insight-sidebar">
          <div class="insight-title">
            <i class="fas fa-lightbulb"></i>
            <span>智能解读</span>
          </div>
          <div id="insightSummary" class="insight-summary">
            <div id="insightHeadline" class="insight-headline">加载中...</div>
            <span id="insightSentiment" class="insight-sentiment neutral">
              <i class="fas fa-minus-circle"></i>
              <span>分析中</span>
            </span>
          </div>
          <div id="insightItems" class="insight-items">
            <!-- 动态生成解读项 -->
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tab2: 交易活跃 -->
    <div id="tabTrading" class="smp-tab-content">
      <div class="trading-section">
        <div class="trading-card">
          <div class="trading-card-title">
            <i class="fas fa-sync-alt"></i>
            <span>换手率分析</span>
          </div>
          <div class="trading-gauge">
            <span id="turnoverValue" class="trading-gauge-value">--</span>
          </div>
          <div class="trading-gauge-label">当日换手率</div>
          <div class="trading-percentile">
            <div class="percentile-bar">
              <div id="turnoverPercentileFill" class="percentile-fill normal" style="width: 50%"></div>
            </div>
            <span id="turnoverPercentileText" class="percentile-text">--%</span>
          </div>
          <div id="turnoverActivityLevel" class="activity-level normal">
            <i class="fas fa-circle"></i>
            <span>交投正常</span>
          </div>
        </div>
        
        <div class="trading-card">
          <div class="trading-card-title">
            <i class="fas fa-tachometer-alt"></i>
            <span>量比分析</span>
          </div>
          <div class="trading-gauge">
            <span id="volumeRatioValue" class="trading-gauge-value">--</span>
          </div>
          <div class="trading-gauge-label">当日量比</div>
          <div class="trading-percentile">
            <div class="percentile-bar">
              <div id="volumePercentileFill" class="percentile-fill normal" style="width: 50%"></div>
            </div>
            <span id="volumePercentileText" class="percentile-text">--%</span>
          </div>
          <div id="volumeStatusText" class="activity-level normal">
            <i class="fas fa-circle"></i>
            <span>量能平稳</span>
          </div>
        </div>
        
        <div class="trading-card">
          <div class="trading-card-title">
            <i class="fas fa-coins"></i>
            <span>成交额对比</span>
          </div>
          <div id="amountChart" style="width: 100%; height: 200px;"></div>
        </div>
      </div>
      
      <!-- 交易活跃解读区域 -->
      <div class="tab-insight-section" id="tradingInsightSection">
        <div class="tab-insight-header">
          <div class="tab-insight-title">
            <i class="fas fa-user-tie"></i>
            <span>AI 专业分析师解读</span>
          </div>
        </div>
        <div class="tab-insight-content-stacked">
          <div class="insight-block professional">
            <div class="insight-block-label">
              <i class="fas fa-chart-line"></i>
              <span>专业版</span>
            </div>
            <div id="tradingInsightPro" class="insight-text-area">
              <div class="insight-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在生成专业解读...</span>
              </div>
            </div>
          </div>
          <div class="insight-block simple">
            <div class="insight-block-label">
              <i class="fas fa-comment-dots"></i>
              <span>白话版</span>
            </div>
            <div id="tradingInsightSimple" class="insight-text-area">
              <div class="insight-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在生成通俗解读...</span>
              </div>
            </div>
          </div>
        </div>
        <div id="tradingKeypoints" class="tab-insight-keypoints"></div>
        <div class="tab-insight-footer">
          <span id="tradingInsightTime" class="insight-update-time"></span>
        </div>
      </div>
    </div>
    
    <!-- Tab3: 估值分析 -->
    <div id="tabValuation" class="smp-tab-content">
      <div class="valuation-section">
        <div class="valuation-card">
          <div class="valuation-header">
            <div class="valuation-title">
              <i class="fas fa-chart-bar"></i>
              <span>市盈率 PE(TTM)</span>
            </div>
            <span id="peLevel" class="valuation-level fair">估值合理</span>
          </div>
          <div id="peValue" class="valuation-current">--</div>
          <div id="peRange" class="valuation-range">
            <span>3年区间：</span>
            <span id="peMin">--</span>
            <span>~</span>
            <span id="peMax">--</span>
          </div>
          <div class="valuation-percentile-bar">
            <div id="peMarker" class="valuation-marker" style="left: 50%"></div>
          </div>
          <div class="valuation-labels">
            <span>低估</span>
            <span>合理</span>
            <span>高估</span>
          </div>
        </div>
        
        <div class="valuation-card">
          <div class="valuation-header">
            <div class="valuation-title">
              <i class="fas fa-book"></i>
              <span>市净率 PB</span>
            </div>
            <span id="pbLevel" class="valuation-level fair">估值合理</span>
          </div>
          <div id="pbValue" class="valuation-current">--</div>
          <div id="pbRange" class="valuation-range">
            <span>3年区间：</span>
            <span id="pbMin">--</span>
            <span>~</span>
            <span id="pbMax">--</span>
          </div>
          <div class="valuation-percentile-bar">
            <div id="pbMarker" class="valuation-marker" style="left: 50%"></div>
          </div>
          <div class="valuation-labels">
            <span>低估</span>
            <span>合理</span>
            <span>高估</span>
          </div>
        </div>
      </div>
      
      <!-- 估值分析解读区域 -->
      <div class="tab-insight-section" id="valuationInsightSection">
        <div class="tab-insight-header">
          <div class="tab-insight-title">
            <i class="fas fa-user-tie"></i>
            <span>AI 专业分析师解读</span>
          </div>
        </div>
        <div class="tab-insight-content-stacked">
          <div class="insight-block professional">
            <div class="insight-block-label">
              <i class="fas fa-chart-line"></i>
              <span>专业版</span>
            </div>
            <div id="valuationInsightPro" class="insight-text-area">
              <div class="insight-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在生成专业解读...</span>
              </div>
            </div>
          </div>
          <div class="insight-block simple">
            <div class="insight-block-label">
              <i class="fas fa-comment-dots"></i>
              <span>白话版</span>
            </div>
            <div id="valuationInsightSimple" class="insight-text-area">
              <div class="insight-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在生成通俗解读...</span>
              </div>
            </div>
          </div>
        </div>
        <div id="valuationKeypoints" class="tab-insight-keypoints"></div>
        <div class="tab-insight-footer">
          <span id="valuationInsightTime" class="insight-update-time"></span>
        </div>
      </div>
    </div>
    
    <!-- Tab4: 股本市值 -->
    <div id="tabShares" class="smp-tab-content">
      <div class="shares-section">
        <div class="shares-card">
          <div class="shares-card-title">
            <i class="fas fa-building"></i>
            <span>市值概览</span>
          </div>
          <div class="shares-list">
            <div class="shares-item">
              <span class="shares-item-label">
                <i class="fas fa-landmark"></i>
                总市值
              </span>
              <span id="totalMvValue" class="shares-item-value">--</span>
            </div>
            <div class="shares-item">
              <span class="shares-item-label">
                <i class="fas fa-hand-holding-usd"></i>
                流通市值
              </span>
              <span id="circMvValue" class="shares-item-value">--</span>
            </div>
          </div>
          <div id="marketCapBadge" class="market-cap-badge large">
            <i class="fas fa-crown"></i>
            <span>大盘股</span>
          </div>
        </div>
        
        <div class="shares-card">
          <div class="shares-card-title">
            <i class="fas fa-users"></i>
            <span>股本结构</span>
          </div>
          <div id="sharesPieChart" class="shares-pie-chart"></div>
        </div>
        
        <div class="shares-card">
          <div class="shares-card-title">
            <i class="fas fa-list-ol"></i>
            <span>股本明细</span>
          </div>
          <div class="shares-list">
            <div class="shares-item">
              <span class="shares-item-label">总股本</span>
              <span id="totalShareValue" class="shares-item-value">--</span>
            </div>
            <div class="shares-item">
              <span class="shares-item-label">流通股本</span>
              <span id="floatShareValue" class="shares-item-value">--</span>
            </div>
            <div class="shares-item">
              <span class="shares-item-label">自由流通股</span>
              <span id="freeShareValue" class="shares-item-value">--</span>
            </div>
            <div class="shares-item">
              <span class="shares-item-label">流通占比</span>
              <span id="floatRatioValue" class="shares-item-value">--</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 股本市值解读区域 -->
      <div class="tab-insight-section" id="sharesInsightSection">
        <div class="tab-insight-header">
          <div class="tab-insight-title">
            <i class="fas fa-user-tie"></i>
            <span>AI 专业分析师解读</span>
          </div>
        </div>
        <div class="tab-insight-content-stacked">
          <div class="insight-block professional">
            <div class="insight-block-label">
              <i class="fas fa-chart-line"></i>
              <span>专业版</span>
            </div>
            <div id="sharesInsightPro" class="insight-text-area">
              <div class="insight-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在生成专业解读...</span>
              </div>
            </div>
          </div>
          <div class="insight-block simple">
            <div class="insight-block-label">
              <i class="fas fa-comment-dots"></i>
              <span>白话版</span>
            </div>
            <div id="sharesInsightSimple" class="insight-text-area">
              <div class="insight-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在生成通俗解读...</span>
              </div>
            </div>
          </div>
        </div>
        <div id="sharesKeypoints" class="tab-insight-keypoints"></div>
        <div class="tab-insight-footer">
          <span id="sharesInsightTime" class="insight-update-time"></span>
        </div>
      </div>
    </div>
    
    <!-- 更新时间 -->
    <div id="smpUpdateTime" class="smp-update-time">
      <i class="fas fa-clock"></i>
      <span>数据更新时间：--</span>
    </div>
  </div>
`;

// ========== JavaScript 逻辑 ==========
export const stockMarketPanelScript = `
  // 股票走势面板控制器
  window.StockMarketPanel = {
    initialized: false,
    chartInstance: null,
    amountChartInstance: null,
    sharesChartInstance: null,
    currentData: null,
    currentInsight: null,
    maSettings: { ma5: true, ma10: true, ma20: true, ma60: false },
    currentPeriod: 90, // 默认3个月
    
    // 安全设置元素属性的辅助函数
    safeSetText: function(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    },
    
    safeSetStyle: function(id, prop, value) {
      const el = document.getElementById(id);
      if (el) el.style[prop] = value;
    },
    
    safeSetClass: function(id, className) {
      const el = document.getElementById(id);
      if (el) el.className = className;
    },
    
    safeSetHtml: function(id, html) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    },
    
    // 初始化面板
    init: function() {
      if (this.initialized) return;
      
      // 绑定Tab切换
      document.querySelectorAll('.smp-tab').forEach(tab => {
        tab.addEventListener('click', (e) => this.switchTab(e.target.closest('.smp-tab').dataset.tab));
      });
      
      // 绑定周期切换
      document.querySelectorAll('.kline-period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const days = parseInt(e.target.dataset.days);
          this.changePeriod(days);
        });
      });
      
      // 绑定均线开关
      ['ma5', 'ma10', 'ma20', 'ma60'].forEach(ma => {
        const toggle = document.getElementById('maToggle' + ma.slice(2));
        if (toggle) {
          toggle.addEventListener('change', (e) => {
            this.maSettings[ma] = e.target.checked;
            this.updateKlineChart();
          });
        }
      });
      
      this.initialized = true;
      console.log('[StockMarketPanel] 初始化完成');
    },
    
    // 当前加载的股票代码（用于防止重复加载）
    currentStockCode: null,
    isLoading: false,
    
    // 加载股票数据
    loadData: async function(stockCode, days = 180) {
      // 防止重复加载同一股票
      if (this.currentStockCode === stockCode && this.currentData && !this.isLoading) {
        console.log('[StockMarketPanel] 股票已加载，跳过重复请求:', stockCode);
        return;
      }
      
      // 如果正在加载中，跳过
      if (this.isLoading) {
        console.log('[StockMarketPanel] 正在加载中，跳过请求:', stockCode);
        return;
      }
      
      const panel = document.getElementById('stockMarketPanel');
      if (!panel) {
        console.error('[StockMarketPanel] 面板元素未找到');
        return;
      }
      
      // 标记开始加载
      this.isLoading = true;
      this.currentStockCode = stockCode;
      
      // 强制显示面板（使用多种方式确保显示）
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
      panel.classList.remove('hidden');
      
      // 只有在没有数据时才显示加载状态（避免覆盖已渲染的图表）
      if (!this.currentData) {
        this.showLoading();
      }
      
      try {
        const response = await fetch('/api/stock/' + stockCode + '/market-data?days=' + days + '&withInsight=true');
        const result = await response.json();
        
        if (!result.success) {
          this.showError(result.error || '数据加载失败');
          this.isLoading = false;
          return;
        }
        
        this.currentData = result.data;
        this.currentInsight = result.insight;
        this.currentPeriod = days;
        
        // 渲染各部分数据
        this.renderQuoteBar();
        this.renderKlineChart();
        this.renderInsightSidebar();
        this.renderTradingTab();
        this.renderValuationTab();
        this.renderSharesTab();
        this.renderUpdateTime();
        
        console.log('[StockMarketPanel] 数据加载完成:', stockCode);
        
        // 标记加载完成
        this.isLoading = false;
        
        // 异步加载 Tab 解读（不阻塞主流程）
        this.loadTabInsights(stockCode);
      } catch (error) {
        console.error('[StockMarketPanel] 数据加载失败:', error);
        this.showError('网络错误，请稍后重试');
        this.isLoading = false;
      }
    },
    
    // 切换Tab
    switchTab: function(tabId) {
      // 更新Tab按钮状态
      document.querySelectorAll('.smp-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
      });
      
      // 更新内容区域
      document.querySelectorAll('.smp-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      const tabContent = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
      if (tabContent) {
        tabContent.classList.add('active');
        
        // 延迟resize图表
        setTimeout(() => {
          if (tabId === 'trend' && this.chartInstance) {
            this.chartInstance.resize();
          } else if (tabId === 'trading' && this.amountChartInstance) {
            this.amountChartInstance.resize();
          } else if (tabId === 'shares' && this.sharesChartInstance) {
            this.sharesChartInstance.resize();
          }
        }, 100);
      }
    },
    
    // 切换周期
    changePeriod: function(days) {
      document.querySelectorAll('.kline-period-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
      });
      
      if (this.currentData) {
        this.currentPeriod = days;
        this.updateKlineChart();
      }
    },
    
    // 渲染报价条
    renderQuoteBar: function() {
      if (!this.currentInsight || !this.currentInsight.quoteOverview) return;
      
      const quote = this.currentInsight.quoteOverview;
      const sentiment = quote.sentiment;
      
      // 价格
      const priceEl = document.getElementById('quotePrice');
      priceEl.textContent = quote.price.toFixed(2);
      priceEl.className = 'quote-price ' + sentiment;
      
      // 涨跌
      const changeEl = document.getElementById('quoteChange');
      changeEl.className = 'quote-change ' + sentiment;
      changeEl.querySelector('.quote-change-value').textContent = 
        (quote.change >= 0 ? '+' : '') + quote.change.toFixed(2);
      changeEl.querySelector('.quote-change-pct').textContent = 
        (quote.pctChg >= 0 ? '+' : '') + quote.pctChg.toFixed(2) + '%';
      
      // 其他指标
      document.getElementById('quoteOpen').textContent = quote.open.toFixed(2);
      document.getElementById('quoteHigh').textContent = quote.high.toFixed(2);
      document.getElementById('quoteLow').textContent = quote.low.toFixed(2);
      document.getElementById('quoteVolume').textContent = quote.volume;
      document.getElementById('quoteAmount').textContent = quote.amount;
      document.getElementById('quoteTurnover').textContent = quote.turnoverRate || '--';
      document.getElementById('quoteAmplitude').textContent = quote.amplitude;
      
      // 交易日期
      document.getElementById('smpTradeDate').textContent = this.formatDate(quote.tradeDate);
    },
    
    // 渲染K线图
    renderKlineChart: function() {
      console.log('[StockMarketPanel] renderKlineChart called', {
        hasCurrentData: !!this.currentData,
        hasKline: !!(this.currentData && this.currentData.kline),
        klineLength: this.currentData?.kline?.length
      });
      
      if (!this.currentData || !this.currentData.kline) {
        console.warn('[StockMarketPanel] No kline data available');
        return;
      }
      
      const chartDom = document.getElementById('klineChart');
      if (!chartDom) {
        console.error('[StockMarketPanel] klineChart element not found');
        return;
      }
      
      console.log('[StockMarketPanel] klineChart element found, size:', chartDom.offsetWidth, 'x', chartDom.offsetHeight);
      
      // 如果元素尺寸为0，延迟重试（等待DOM渲染完成）
      if (chartDom.offsetWidth === 0 || chartDom.offsetHeight === 0) {
        console.log('[StockMarketPanel] Chart container not visible, retrying in 200ms...');
        setTimeout(() => this.renderKlineChart(), 200);
        return;
      }
      
      // 检查ECharts是否加载
      if (typeof echarts === 'undefined') {
        console.error('[StockMarketPanel] ECharts未加载，等待重试...');
        chartDom.innerHTML = '<div class="smp-error"><i class="fas fa-exclamation-circle smp-error-icon"></i><div class="smp-error-text">图表库加载中，请稍候...</div></div>';
        
        // 延迟重试
        setTimeout(() => {
          if (typeof echarts !== 'undefined') {
            console.log('[StockMarketPanel] ECharts加载完成，重新渲染');
            this.renderKlineChart();
          } else {
            console.error('[StockMarketPanel] ECharts加载超时');
            chartDom.innerHTML = '<div class="smp-error"><i class="fas fa-exclamation-circle smp-error-icon"></i><div class="smp-error-text">图表加载失败，请刷新页面</div></div>';
          }
        }, 2000);
        return;
      }
      
      // 清除加载状态的HTML内容（重要：ECharts需要空的容器）
      chartDom.innerHTML = '';
      
      // 初始化或获取实例
      if (!this.chartInstance) {
        console.log('[StockMarketPanel] 初始化ECharts实例');
        this.chartInstance = echarts.init(chartDom);
      } else {
        // 如果已有实例，检查是否需要重新初始化
        try {
          this.chartInstance.getOption();
        } catch (e) {
          console.log('[StockMarketPanel] 重新初始化ECharts实例');
          this.chartInstance = echarts.init(chartDom);
        }
      }
      
      this.updateKlineChart();
      console.log('[StockMarketPanel] K线图渲染完成');
    },
    
    // 更新K线图
    updateKlineChart: function() {
      console.log('[StockMarketPanel] updateKlineChart called', {
        hasChartInstance: !!this.chartInstance,
        hasCurrentData: !!this.currentData,
        klineLength: this.currentData?.kline?.length
      });
      
      if (!this.chartInstance || !this.currentData) {
        console.warn('[StockMarketPanel] updateKlineChart: missing chartInstance or currentData');
        return;
      }
      
      const kline = this.currentData.kline || [];
      const maData = this.currentInsight?.maData || {};
      
      if (kline.length === 0) {
        console.warn('[StockMarketPanel] updateKlineChart: no kline data');
        return;
      }
      
      // 根据周期筛选数据
      const filteredKline = kline.slice(-this.currentPeriod);
      
      const dates = filteredKline.map(k => this.formatDate(k.date));
      const ohlc = filteredKline.map(k => [k.open, k.close, k.low, k.high]);
      const volumes = filteredKline.map(k => k.volume);
      
      // 构建均线系列
      const series = [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#ef4444',
            color0: '#22c55e',
            borderColor: '#ef4444',
            borderColor0: '#22c55e'
          }
        }
      ];
      
      // 添加均线
      if (this.maSettings.ma5 && maData.ma5) {
        series.push({
          name: 'MA5',
          type: 'line',
          data: maData.ma5.slice(-this.currentPeriod).map(d => d.value),
          smooth: true,
          lineStyle: { width: 1, color: '#f59e0b' },
          showSymbol: false
        });
      }
      
      if (this.maSettings.ma10 && maData.ma10) {
        series.push({
          name: 'MA10',
          type: 'line',
          data: maData.ma10.slice(-this.currentPeriod).map(d => d.value),
          smooth: true,
          lineStyle: { width: 1, color: '#3b82f6' },
          showSymbol: false
        });
      }
      
      if (this.maSettings.ma20 && maData.ma20) {
        series.push({
          name: 'MA20',
          type: 'line',
          data: maData.ma20.slice(-this.currentPeriod).map(d => d.value),
          smooth: true,
          lineStyle: { width: 1, color: '#8b5cf6' },
          showSymbol: false
        });
      }
      
      if (this.maSettings.ma60 && maData.ma60) {
        series.push({
          name: 'MA60',
          type: 'line',
          data: maData.ma60.slice(-this.currentPeriod).map(d => d.value),
          smooth: true,
          lineStyle: { width: 1, color: '#ec4899' },
          showSymbol: false
        });
      }
      
      const option = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          backgroundColor: 'rgba(26, 26, 46, 0.95)',
          borderColor: 'rgba(212, 175, 55, 0.3)',
          textStyle: { color: '#e5e7eb' }
        },
        legend: {
          data: series.map(s => s.name),
          top: 5,
          textStyle: { color: '#9ca3af' },
          itemStyle: { opacity: 0.8 }
        },
        grid: [
          { left: '8%', right: '8%', top: '12%', height: '55%' },
          { left: '8%', right: '8%', top: '75%', height: '18%' }
        ],
        xAxis: [
          { type: 'category', data: dates, axisLabel: { color: '#6b7280' }, axisLine: { lineStyle: { color: '#374151' } } },
          { type: 'category', data: dates, gridIndex: 1, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#374151' } } }
        ],
        yAxis: [
          { scale: true, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: '#6b7280' } },
          { scale: true, gridIndex: 1, splitLine: { show: false }, axisLabel: { color: '#6b7280' } }
        ],
        dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
          { type: 'slider', xAxisIndex: [0, 1], start: 50, end: 100, height: 20, bottom: 5 }
        ],
        series: [
          ...series,
          {
            name: '成交量',
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: volumes,
            itemStyle: {
              color: function(params) {
                return ohlc[params.dataIndex][1] >= ohlc[params.dataIndex][0] ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
              }
            }
          }
        ]
      };
      
      console.log('[StockMarketPanel] setOption with', {
        dates: dates.length,
        ohlc: ohlc.length,
        series: series.length
      });
      
      try {
        this.chartInstance.setOption(option, true);
        console.log('[StockMarketPanel] setOption success');
      } catch (e) {
        console.error('[StockMarketPanel] setOption error:', e);
      }
    },
    
    // 渲染解读侧栏
    renderInsightSidebar: function() {
      if (!this.currentInsight) return;
      
      const insight = this.currentInsight;
      
      // 摘要 - 添加空检查
      const headlineEl = document.getElementById('insightHeadline');
      if (headlineEl) {
        headlineEl.textContent = insight.summary?.headline || '数据分析中...';
      }
      
      // 情绪 - 添加空检查
      const sentimentEl = document.getElementById('insightSentiment');
      if (sentimentEl) {
        const sentimentText = insight.summary?.overallSentiment === 'bullish' ? '偏多'
          : insight.summary?.overallSentiment === 'bearish' ? '偏空' : '中性';
        sentimentEl.className = 'insight-sentiment ' + (insight.summary?.overallSentiment || 'neutral');
        sentimentEl.innerHTML = '<i class="fas fa-' + 
          (insight.summary?.overallSentiment === 'bullish' ? 'arrow-up' : 
           insight.summary?.overallSentiment === 'bearish' ? 'arrow-down' : 'minus') + 
          '"></i><span>' + sentimentText + '</span>';
      }
      
      // 解读项 - 添加空检查
      const itemsContainer = document.getElementById('insightItems');
      if (itemsContainer) {
        const allInsights = [
          ...(insight.trendInsight?.insights || []),
          ...(insight.momentumInsight?.insights || []),
          ...(insight.volatilityInsights || []),
          ...(insight.triggerInsights || [])
        ].sort((a, b) => b.priority - a.priority).slice(0, 8);
        
        const categoryLabels = {
          trend: '趋势',
          momentum: '量能',
          volatility: '波动',
          trigger: '信号'
        };
        
        itemsContainer.innerHTML = allInsights.map(item => {
          return '<div class="insight-item ' + item.sentiment + '">' +
            '<div class="insight-conclusion">' + item.conclusion + '</div>' +
            '<div class="insight-evidence">' + item.evidence.join(' | ') + '</div>' +
            '<div class="insight-category">' + (categoryLabels[item.category] || item.category) + '</div>' +
          '</div>';
        }).join('');
      }
    },
    
    // 渲染交易Tab
    renderTradingTab: function() {
      if (!this.currentInsight) return;
      
      const trading = this.currentInsight.tradingActivity;
      if (!trading) return;
      
      // 换手率
      this.safeSetText('turnoverValue', trading.turnoverRate ? trading.turnoverRate.toFixed(2) + '%' : '--');
      
      const turnoverPct = trading.turnoverPercentile120 || 50;
      this.safeSetStyle('turnoverPercentileFill', 'width', turnoverPct + '%');
      this.safeSetClass('turnoverPercentileFill', 'percentile-fill ' + (turnoverPct >= 70 ? 'high' : turnoverPct <= 30 ? 'low' : 'normal'));
      this.safeSetText('turnoverPercentileText', turnoverPct + '%分位');
      
      const activityLevel = document.getElementById('turnoverActivityLevel');
      if (activityLevel) {
        activityLevel.className = 'activity-level ' + trading.activityLevel;
        activityLevel.innerHTML = '<i class="fas fa-circle"></i><span>' + trading.activityText + '</span>';
      }
      
      // 量比
      this.safeSetText('volumeRatioValue', trading.volumeRatio ? trading.volumeRatio.toFixed(2) : '--');
      
      const volumePct = trading.volumePercentile20 || 50;
      this.safeSetStyle('volumePercentileFill', 'width', volumePct + '%');
      this.safeSetClass('volumePercentileFill', 'percentile-fill ' + (volumePct >= 70 ? 'high' : volumePct <= 30 ? 'low' : 'normal'));
      this.safeSetText('volumePercentileText', volumePct + '%分位');
      
      // 成交额图表（简化显示）
      this.renderAmountChart();
    },
    
    // 渲染成交额图表
    renderAmountChart: function() {
      const chartDom = document.getElementById('amountChart');
      if (!chartDom || typeof echarts === 'undefined') return;
      
      if (!this.amountChartInstance) {
        this.amountChartInstance = echarts.init(chartDom);
      }
      
      const kline = (this.currentData?.kline || []).slice(-20);
      const dates = kline.map(k => this.formatDate(k.date));
      const amounts = kline.map(k => (k.amount / 100000000).toFixed(2));
      
      this.amountChartInstance.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        grid: { left: '12%', right: '8%', top: '10%', bottom: '15%' },
        xAxis: { 
          type: 'category', 
          data: dates, 
          axisLabel: { color: '#6b7280', fontSize: 10 },
          axisLine: { lineStyle: { color: '#374151' } }
        },
        yAxis: { 
          type: 'value',
          name: '亿元',
          nameTextStyle: { color: '#6b7280' },
          axisLabel: { color: '#6b7280' },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
        },
        series: [{
          type: 'bar',
          data: amounts,
          itemStyle: {
            color: function(params) {
              const idx = params.dataIndex;
              const pctChg = kline[idx]?.pctChg || 0;
              return pctChg >= 0 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
            }
          }
        }]
      });
    },
    
    // 渲染估值Tab
    renderValuationTab: function() {
      if (!this.currentInsight) return;
      
      const val = this.currentInsight.valuationInsight;
      if (!val) return;
      
      // PE
      this.safeSetText('peValue', val.peTtm ? val.peTtm.toFixed(2) : '--');
      this.safeSetText('peMin', val.peTtmRange?.min?.toFixed(2) || '--');
      this.safeSetText('peMax', val.peTtmRange?.max?.toFixed(2) || '--');
      
      const pePct = val.peTtmPercentile || 50;
      this.safeSetStyle('peMarker', 'left', pePct + '%');
      
      const peLevel = document.getElementById('peLevel');
      if (peLevel) {
        peLevel.textContent = pePct <= 30 ? '估值偏低' : pePct >= 70 ? '估值偏高' : '估值合理';
        peLevel.className = 'valuation-level ' + (pePct <= 30 ? 'undervalued' : pePct >= 70 ? 'overvalued' : 'fair');
      }
      
      // PB
      this.safeSetText('pbValue', val.pb ? val.pb.toFixed(2) : '--');
      this.safeSetText('pbMin', val.pbRange?.min?.toFixed(2) || '--');
      this.safeSetText('pbMax', val.pbRange?.max?.toFixed(2) || '--');
      
      const pbPct = val.pbPercentile || 50;
      this.safeSetStyle('pbMarker', 'left', pbPct + '%');
      
      const pbLevel = document.getElementById('pbLevel');
      if (pbLevel) {
        pbLevel.textContent = pbPct <= 30 ? '估值偏低' : pbPct >= 70 ? '估值偏高' : '估值合理';
        pbLevel.className = 'valuation-level ' + (pbPct <= 30 ? 'undervalued' : pbPct >= 70 ? 'overvalued' : 'fair');
      }
    },
    
    // 渲染股本Tab
    renderSharesTab: function() {
      if (!this.currentInsight) return;
      
      const shares = this.currentInsight.sharesInsight;
      if (!shares) return;
      
      // 市值
      this.safeSetText('totalMvValue', shares.totalMv);
      this.safeSetText('circMvValue', shares.circMv);
      
      const badge = document.getElementById('marketCapBadge');
      if (badge) {
        badge.className = 'market-cap-badge ' + shares.marketCapLevel;
        badge.innerHTML = '<i class="fas fa-' + 
          (shares.marketCapLevel === 'large' ? 'crown' : shares.marketCapLevel === 'mid' ? 'gem' : 'seedling') + 
          '"></i><span>' + shares.marketCapText + '</span>';
      }
      
      // 股本明细
      this.safeSetText('totalShareValue', shares.totalShare);
      this.safeSetText('floatShareValue', shares.floatShare);
      this.safeSetText('freeShareValue', shares.freeShare);
      this.safeSetText('floatRatioValue', shares.floatRatio);
      
      // 股本饼图
      this.renderSharesPieChart();
    },
    
    // 渲染股本饼图
    renderSharesPieChart: function() {
      const chartDom = document.getElementById('sharesPieChart');
      if (!chartDom || typeof echarts === 'undefined') return;
      
      if (!this.sharesChartInstance) {
        this.sharesChartInstance = echarts.init(chartDom);
      }
      
      const features = this.currentInsight?.rawFeatures;
      if (!features) return;
      
      const totalShare = features.totalShare || 1;
      const freeShare = features.freeShare || 0;
      const floatShare = features.floatShare || 0;
      const lockedShare = totalShare - floatShare;
      const restrictedShare = floatShare - freeShare;
      
      this.sharesChartInstance.setOption({
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c}亿股 ({d}%)'
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          data: [
            { value: freeShare.toFixed(2), name: '自由流通股', itemStyle: { color: '#d4af37' } },
            { value: restrictedShare.toFixed(2), name: '受限流通股', itemStyle: { color: '#3b82f6' } },
            { value: lockedShare.toFixed(2), name: '限售股', itemStyle: { color: '#6b7280' } }
          ],
          label: {
            color: '#9ca3af',
            fontSize: 11
          }
        }]
      });
    },
    
    // 渲染更新时间
    renderUpdateTime: function() {
      const updateTime = this.currentData?.updateTime || this.currentInsight?.updateTime;
      if (updateTime) {
        this.safeSetHtml('smpUpdateTime', '<i class="fas fa-clock"></i><span>数据更新时间：' + new Date(updateTime).toLocaleString('zh-CN') + '</span>');
      }
    },
    
    // Tab 解读数据缓存
    tabInsightsData: null,
    tabInsightsLoading: false,
    
    // 加载 Tab 解读
    loadTabInsights: async function(stockCode) {
      if (this.tabInsightsLoading) return;
      this.tabInsightsLoading = true;
      
      console.log('[StockMarketPanel] 开始加载Tab解读:', stockCode);
      
      try {
        const response = await fetch('/api/stock/' + stockCode + '/tab-insights');
        const result = await response.json();
        
        if (result.success && result.data) {
          this.tabInsightsData = result.data;
          console.log('[StockMarketPanel] Tab解读加载成功');
          this.renderTabInsights();
        } else {
          console.warn('[StockMarketPanel] Tab解读加载失败:', result.error);
          this.showInsightError('解读生成失败');
        }
      } catch (error) {
        console.error('[StockMarketPanel] Tab解读网络错误:', error);
        this.showInsightError('网络错误，请稍后重试');
      } finally {
        this.tabInsightsLoading = false;
      }
    },
    
    // 渲染所有 Tab 解读
    renderTabInsights: function() {
      if (!this.tabInsightsData) return;
      
      const insights = this.tabInsightsData.insights;
      
      // 渲染交易活跃解读
      if (insights.trading) {
        this.renderSingleTabInsight('trading', insights.trading);
      }
      
      // 渲染估值分析解读
      if (insights.valuation) {
        this.renderSingleTabInsight('valuation', insights.valuation);
      }
      
      // 渲染股本市值解读
      if (insights.shares) {
        this.renderSingleTabInsight('shares', insights.shares);
      }
      
      // 更新时间
      if (this.tabInsightsData.generatedAt) {
        const timeStr = new Date(this.tabInsightsData.generatedAt).toLocaleString('zh-CN');
        ['tradingInsightTime', 'valuationInsightTime', 'sharesInsightTime'].forEach(id => {
          this.safeSetHtml(id, '<i class="fas fa-clock"></i> ' + timeStr);
        });
      }
    },
    
    // 渲染单个 Tab 解读（专业版和白话版上下布局）
    renderSingleTabInsight: function(tabName, insight) {
      // 专业版解读
      const proEl = document.getElementById(tabName + 'InsightPro');
      if (proEl && insight.professional) {
        proEl.innerHTML = this.formatInsightText(insight.professional);
      }
      
      // 白话版解读
      const simpleEl = document.getElementById(tabName + 'InsightSimple');
      if (simpleEl && insight.simple) {
        simpleEl.innerHTML = this.formatInsightText(insight.simple);
      }
      
      // 关键要点
      const keypointsEl = document.getElementById(tabName + 'Keypoints');
      if (keypointsEl && insight.keyPoints && insight.keyPoints.length > 0) {
        const keypointsHtml = insight.keyPoints.map(function(point) {
          const typeClass = point.type === 'positive' ? 'positive' : (point.type === 'negative' ? 'negative' : 'neutral');
          const icon = point.type === 'positive' ? 'arrow-up' : (point.type === 'negative' ? 'arrow-down' : 'minus');
          return '<span class="keypoint-tag ' + typeClass + '"><i class="fas fa-' + icon + '"></i> ' + point.text + '</span>';
        }).join('');
        keypointsEl.innerHTML = keypointsHtml;
      }
      
      // 情绪指示
      const section = document.getElementById(tabName + 'InsightSection');
      if (section && insight.sentiment) {
        section.dataset.sentiment = insight.sentiment;
      }
    },
    
    // 格式化解读文本（支持换行和重点标记）
    formatInsightText: function(text) {
      if (!text) return '';
      // 将换行符转换为 <br>
      var formatted = text.split('\\\\n').join('<br>').split('\\n').join('<br>');
      // 将 **文字** 转换为加粗（简化处理）
      var boldPattern = /\\*\\*([^*]+)\\*\\*/g;
      formatted = formatted.replace(boldPattern, '<strong>$1</strong>');
      return formatted;
    },
    
    // 显示解读错误
    showInsightError: function(message) {
      const errorHtml = '<div class="insight-error"><i class="fas fa-exclamation-triangle"></i><span>' + message + '</span></div>';
      ['tradingInsightPro', 'valuationInsightPro', 'sharesInsightPro'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errorHtml;
      });
      ['tradingInsightSimple', 'valuationInsightSimple', 'sharesInsightSimple'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errorHtml;
      });
    },
    
    // 格式化日期
    formatDate: function(dateStr) {
      if (!dateStr) return '--';
      if (dateStr.length === 8) {
        return dateStr.slice(4, 6) + '-' + dateStr.slice(6, 8);
      }
      return dateStr;
    },
    
    // 显示加载状态 - 只在klineChart内显示，不替换整个tabTrend结构
    showLoading: function() {
      const klineChart = document.getElementById('klineChart');
      if (klineChart) {
        klineChart.innerHTML = '<div class="smp-loading"><div class="smp-loading-spinner"></div><div class="smp-loading-text">正在加载行情数据...</div></div>';
      }
      // 同时更新解读区域
      const insightItems = document.getElementById('insightItems');
      if (insightItems) {
        insightItems.innerHTML = '<div class="smp-loading-small"><div class="smp-loading-spinner-small"></div></div>';
      }
    },
    
    // 显示错误 - 只在klineChart内显示
    showError: function(message) {
      const klineChart = document.getElementById('klineChart');
      if (klineChart) {
        klineChart.innerHTML = '<div class="smp-error"><i class="fas fa-exclamation-circle smp-error-icon"></i><div class="smp-error-text">' + message + '</div></div>';
      }
    },
    
    // 隐藏面板
    hide: function() {
      const panel = document.getElementById('stockMarketPanel');
      if (panel) {
        panel.style.display = 'none';
      }
    }
  };
  
  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.StockMarketPanel.init());
  } else {
    window.StockMarketPanel.init();
  }
`;

// 导出组件配置
export const stockMarketPanelConfig = {
  styles: stockMarketPanelStyles,
  html: stockMarketPanelHtml,
  script: stockMarketPanelScript,
};
