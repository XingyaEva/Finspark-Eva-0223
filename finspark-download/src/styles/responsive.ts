/**
 * 全局响应式样式系统
 * 
 * 断点设计：
 * - xs: < 640px   (手机竖屏)
 * - sm: 640-768px (手机横屏)
 * - md: 768-1024px (平板)
 * - lg: 1024-1280px (小笔记本)
 * - xl: 1280-1536px (桌面显示器)
 * - 2xl: > 1536px (大屏/4K)
 * 
 * 使用方式：在页面 <style> 中引入 ${responsiveStyles}
 */

export const responsiveStyles = `
  /* ============================================
   * 响应式容器系统
   * 替代现有的 max-w-5xl, max-w-7xl
   * ============================================ */
  .container-adaptive {
    width: 100%;
    margin-left: auto;
    margin-right: auto;
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  /* 平板 */
  @media (min-width: 768px) {
    .container-adaptive {
      padding-left: 1.5rem;
      padding-right: 1.5rem;
    }
  }
  
  /* 小笔记本 */
  @media (min-width: 1024px) {
    .container-adaptive {
      max-width: 1024px;
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }
  
  /* 桌面显示器 */
  @media (min-width: 1280px) {
    .container-adaptive {
      max-width: 1200px;
    }
  }
  
  /* 大屏 */
  @media (min-width: 1536px) {
    .container-adaptive {
      max-width: 1400px;
    }
  }
  
  /* 超大屏/4K */
  @media (min-width: 1920px) {
    .container-adaptive {
      max-width: 1600px;
    }
  }

  /* ============================================
   * 移动端/桌面端显示控制
   * ============================================ */
  .hide-on-mobile {
    display: block;
  }
  .hide-on-mobile-flex {
    display: flex;
  }
  .show-on-mobile {
    display: none;
  }
  
  @media (max-width: 767px) {
    .hide-on-mobile {
      display: none !important;
    }
    .hide-on-mobile-flex {
      display: none !important;
    }
    .show-on-mobile {
      display: block !important;
    }
    .show-on-mobile-flex {
      display: flex !important;
    }
  }

  /* ============================================
   * 移动端汉堡菜单样式
   * ============================================ */
  .mobile-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  }
  
  .mobile-menu-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 40;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }
  
  .mobile-menu-overlay.open {
    opacity: 1;
    visibility: visible;
  }
  
  .mobile-menu-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 280px;
    max-width: 80vw;
    background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%);
    border-left: 1px solid rgba(212, 175, 55, 0.2);
    z-index: 50;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    overflow-y: auto;
  }
  
  .mobile-menu-panel.open {
    transform: translateX(0);
  }
  
  .mobile-menu-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(212, 175, 55, 0.2);
  }
  
  .mobile-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    color: #e5e7eb;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.2s;
    text-decoration: none;
  }
  
  .mobile-menu-item:hover,
  .mobile-menu-item:active {
    background: rgba(212, 175, 55, 0.1);
  }
  
  .mobile-menu-item i {
    width: 20px;
    text-align: center;
    color: #d4af37;
  }
  
  .mobile-menu-divider {
    height: 1px;
    background: rgba(212, 175, 55, 0.2);
    margin: 8px 0;
  }
  
  .mobile-menu-section-title {
    padding: 12px 20px 8px;
    font-size: 12px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ============================================
   * 触摸优化
   * ============================================ */
  @media (hover: none) and (pointer: coarse) {
    /* 触摸设备上增大点击区域 */
    .touch-target {
      min-height: 44px;
      min-width: 44px;
    }
  }

  /* ============================================
   * 响应式网格辅助类
   * ============================================ */
  .grid-adaptive-2 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  @media (min-width: 640px) {
    .grid-adaptive-2 {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .grid-adaptive-3 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  @media (min-width: 640px) {
    .grid-adaptive-3 {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (min-width: 1024px) {
    .grid-adaptive-3 {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  .grid-adaptive-4 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  @media (min-width: 768px) {
    .grid-adaptive-4 {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  
  @media (min-width: 1024px) {
    .grid-adaptive-4 {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* ============================================
   * 响应式字体
   * ============================================ */
  .text-adaptive-hero {
    font-size: 1.75rem;
    line-height: 2.25rem;
  }
  
  @media (min-width: 768px) {
    .text-adaptive-hero {
      font-size: 2.5rem;
      line-height: 3rem;
    }
  }
  
  @media (min-width: 1024px) {
    .text-adaptive-hero {
      font-size: 3rem;
      line-height: 3.5rem;
    }
  }
  
  .text-adaptive-title {
    font-size: 1.25rem;
    line-height: 1.75rem;
  }
  
  @media (min-width: 768px) {
    .text-adaptive-title {
      font-size: 1.5rem;
      line-height: 2rem;
    }
  }

  /* ============================================
   * 响应式间距
   * ============================================ */
  .pt-adaptive-header {
    padding-top: 70px;
  }
  
  @media (min-width: 768px) {
    .pt-adaptive-header {
      padding-top: 80px;
    }
  }
  
  .py-adaptive-section {
    padding-top: 2rem;
    padding-bottom: 2rem;
  }
  
  @media (min-width: 768px) {
    .py-adaptive-section {
      padding-top: 3rem;
      padding-bottom: 3rem;
    }
  }
  
  @media (min-width: 1024px) {
    .py-adaptive-section {
      padding-top: 4rem;
      padding-bottom: 4rem;
    }
  }
  
  .mb-adaptive {
    margin-bottom: 1.5rem;
  }
  
  @media (min-width: 768px) {
    .mb-adaptive {
      margin-bottom: 2rem;
    }
  }
  
  @media (min-width: 1024px) {
    .mb-adaptive {
      margin-bottom: 3rem;
    }
  }

  /* ============================================
   * 响应式搜索框
   * ============================================ */
  .search-container-adaptive {
    width: 100%;
    max-width: 100%;
  }
  
  @media (min-width: 768px) {
    .search-container-adaptive {
      max-width: 600px;
    }
  }
  
  @media (min-width: 1024px) {
    .search-container-adaptive {
      max-width: 700px;
    }
  }
  
  @media (min-width: 1280px) {
    .search-container-adaptive {
      max-width: 800px;
    }
  }

  /* ============================================
   * 响应式卡片
   * ============================================ */
  .card-adaptive {
    padding: 1rem;
    border-radius: 0.75rem;
  }
  
  @media (min-width: 768px) {
    .card-adaptive {
      padding: 1.5rem;
      border-radius: 1rem;
    }
  }
  
  @media (min-width: 1024px) {
    .card-adaptive {
      padding: 2rem;
    }
  }

  /* ============================================
   * 响应式弹窗
   * ============================================ */
  .modal-adaptive {
    width: calc(100% - 2rem);
    max-width: 400px;
    margin: 1rem;
    max-height: calc(100vh - 2rem);
    overflow-y: auto;
  }
  
  @media (min-width: 768px) {
    .modal-adaptive {
      max-width: 500px;
      margin: 2rem;
      max-height: calc(100vh - 4rem);
    }
  }
`;

export default responsiveStyles;
