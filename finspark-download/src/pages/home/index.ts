/**
 * 首页组装器 (Home Page Assembler)
 * 
 * 将各个 section 组件组合成完整的 Landing Page
 * 使用 publicLayout 包裹（无侧边栏）
 */

import { wrapWithPublicLayout } from '../../layouts/publicLayout';
import { homeNavbarStyles, generateHomeNavbar, homeNavbarScript } from '../../components/homeNavbar';
import { authModalsStyles, authModalsHtml, authModalsScript } from '../../components/authModals';
import { heroSectionStyles, generateHeroSection, heroSearchScript } from './heroSection';
import { featureCardsStyles, generateFeatureCards } from './featureCards';
import { marketOverviewStyles, generateMarketOverview } from './marketOverview';
import { ctaFooterStyles, generateCtaSection, generateFooter } from './ctaFooter';
import { analysisConfigStyles, analysisConfigHtml, analysisConfigScript } from '../../components/analysisConfig';
import { floatingAssistantStyles, floatingAssistantHtml, floatingAssistantScript } from '../../components/floatingAssistant';

export function generateHomePage(): string {
  // 1. 组合所有 CSS
  const allStyles = `
    ${homeNavbarStyles}
    ${authModalsStyles}
    ${heroSectionStyles}
    ${featureCardsStyles}
    ${marketOverviewStyles}
    ${ctaFooterStyles}
    ${analysisConfigStyles}
    ${floatingAssistantStyles}

    /* ---- 页面过渡动画 ---- */
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-up {
      animation: fadeUp 0.6s ease-out;
    }
  `;

  // 2. 组合所有 Body HTML
  // 注意: floatingAssistantScript 自带 <script> 标签，需放在 body 而非 scripts 中
  const body = `
    ${generateHomeNavbar()}
    ${authModalsHtml}
    ${generateHeroSection(analysisConfigHtml)}
    ${generateMarketOverview()}
    ${generateFeatureCards()}
    ${generateCtaSection()}
    ${generateFooter()}
    ${floatingAssistantHtml}
    ${floatingAssistantScript}
  `;

  // 3. 组合所有 Scripts (纯 JS，不含 <script> 标签)
  const scripts = `
    ${authModalsScript}
    ${homeNavbarScript}
    ${heroSearchScript}
    ${analysisConfigScript}

    // ---- 初始化 ----
    checkAuth();
    loadHotStocks();
    loadAnalysisConfig();
  `;

  return wrapWithPublicLayout({
    title: 'FinSpark 投资分析系统 - AI 驱动的智能财报分析',
    styles: allStyles,
    body,
    scripts,
  });
}
