// AI 漫画生成服务 - 使用 VectorEngine API (Gemini)
// 将财报分析结果转化为信息图表风格漫画
// 支持IP角色系统，模块化提示词组合实现灵活多变的漫画布局
// 深度整合多Agent分析数据

import { COMIC_PROMPTS } from '../agents/prompts';
import type { AnalysisReport, ComicData, ComicPanel, IPCharacter, ComicGenerationOptions, ScrollComicData, ComicContentStyle } from '../types';
import { characterService, NEZHA_CHARACTERS, DEFAULT_CHARACTER_ID } from './characters';
import {
  buildModularPanelPrompt,
  buildComicScriptSystemPrompt,
  buildStyledComicScriptSystemPrompt,
  buildStyledUserPrompt,
  buildStyledImagePrompt,
  getContentStyleConfig,
  PANEL_THEMES,
  LAYOUT_MODULES,
  MOOD_MODULES,
  SAFETY_MODULES,
  BASE_MODULES,
  CONTENT_STYLES,
  type ComicContentStyle as ContentStyleType,
} from './comicPromptModules';

// 图片生成模型
const IMAGE_MODEL = 'gemini-3-pro-image-preview';
// 漫画脚本生成模型 - 升级到 gemini-3-pro-preview 以获得更高质量的脚本
const SCRIPT_MODEL = 'gemini-3-pro-preview';

// 进度回调类型定义
export type ComicProgressStage = 
  | 'init'              // 初始化
  | 'script'            // 脚本生成中
  | 'script_done'       // 脚本生成完成
  | 'images_batch_1'    // 图片批次1（面板1-4）
  | 'images_batch_2'    // 图片批次2（面板5-8）
  | 'finalizing'        // 最终处理
  | 'completed'         // 完成
  | 'failed';           // 失败

export interface ComicProgress {
  stage: ComicProgressStage;
  percent: number;        // 0-100
  message: string;
  currentPanel?: number;  // 当前正在生成的面板
  totalPanels?: number;   // 总面板数
  timestamp: number;
  // 增强进度信息
  characterName?: string;     // 当前面板使用的角色名
  panelTitle?: string;        // 当前面板的标题
  scriptSummary?: {           // 脚本生成完成后的摘要
    charactersUsed?: string[];  // 使用的角色列表
    totalPanels: number;        // 总面板数
    theme?: string;             // 主题
  };
}

export type ProgressCallback = (progress: ComicProgress) => void | Promise<void>;

export interface ComicGenerationConfig {
  apiKey: string;
  style?: 'business' | 'modern' | 'classic' | 'nezha' | 'custom';
  minPanels?: number;
  maxPanels?: number;
  characterSetId?: string;
  mainCharacterId?: string;
  customCharacter?: IPCharacter;
  outputFormat?: 'grid' | 'vertical-scroll';
  contentStyle?: ComicContentStyle;  // 内容风格
  onProgress?: ProgressCallback;     // 进度回调
}

export interface ComicScript {
  title: string;
  theme: string;
  mainCharacter: {
    name: string;
    description: string;
    personality: string;
  };
  panels: Array<{
    panelNumber: number;
    sectionTitle: string;      // 大标题
    agentSource: string;       // 来源Agent
    subPanels: Array<{         // 四小格内容
      number: number;
      title: string;
      content: string;
      icon: string;
      highlight?: string;
    }>;
    scene: string;
    action: string;
    dialogue?: string;
    caption: string;
    visualMetaphor: string;
    imagePrompt: string;
    mood: string;
  }>;
  financialHighlights: string[];
  investmentMessage: string;
}

export interface ComicGenerationResult {
  success: boolean;
  comic?: ComicData | ScrollComicData;
  script?: ComicScript;
  error?: string;
  scrollHtml?: string;
}

// 固定8格漫画
function determinePanelCount(_report: Partial<AnalysisReport>): { min: number; max: number; recommended: number } {
  return { min: 8, max: 8, recommended: 8 };
}

// 图片生成失败的详细信息
export interface ImageGenerationFailure {
  panelIndex: number;
  attempts: number;
  lastError: string;
  errorType: 'api_error' | 'safety_filter' | 'no_image' | 'timeout' | 'quota_exceeded' | 'unknown';
  timestamp: number;
}

// 重试配置 - 优化后的配置以减少总等待时间
// 前端超时为180秒，后端需要确保在150秒内完成或失败
const RETRY_CONFIG = {
  maxRetries: 2,           // 减少到2次重试（共3次尝试）
  retryDelayMs: 1000,      // 减少重试等待时间到1秒
  timeoutMs: 30000,        // 减少单次超时到30秒
  // 最坏情况：8面板 × (3次尝试 × 30秒 + 2秒等待) ÷ 4并发 ≈ 92秒 + 脚本生成30秒 ≈ 122秒
};

// 面板特定模板配置 - 为每种面板类型定义视觉元素和安全约束
interface PanelTemplate {
  visualElements: string[];
  layoutHints: string;
  iconStyle: string;
  emphasisStyle: string;
  backgroundTheme: string;
  characterPose: string;
  colorScheme: string;
  safetyConstraints?: string;
  avoidElements?: string[];
}

const PANEL_TEMPLATES: Record<number, PanelTemplate> = {
  0: { // 公司介绍
    visualElements: ['company_building_icon', 'industry_symbols', 'corporate_skyline'],
    layoutHints: 'Hero-style layout with company name prominent at top',
    iconStyle: 'corporate_modern_clean',
    emphasisStyle: 'brand_gold_highlight',
    backgroundTheme: 'corporate_blue_gradient_professional',
    characterPose: 'welcoming_presenting_gesture',
    colorScheme: 'navy blue and gold accent',
  },
  1: { // 盈利能力
    visualElements: ['bar_chart_growth', 'percentage_badges', 'upward_trend_arrows'],
    layoutHints: 'Data-focused with clear metric cards, growth emphasis',
    iconStyle: 'financial_charts_modern',
    emphasisStyle: 'green_positive_numbers',
    backgroundTheme: 'growth_green_gradient',
    characterPose: 'pointing_at_positive_chart',
    colorScheme: 'green gradient for growth metrics',
  },
  2: { // 资产负债
    visualElements: ['balance_scale_icon', 'pie_chart_structure', 'comparison_bars'],
    layoutHints: 'Balance comparison layout, asset vs liability visual',
    iconStyle: 'balance_structure_icons',
    emphasisStyle: 'blue_stability_highlight',
    backgroundTheme: 'structured_blue_orange',
    characterPose: 'analytical_balancing_gesture',
    colorScheme: 'blue and orange contrast',
  },
  3: { // 现金流
    visualElements: ['flow_arrows', 'waterfall_elements', 'cash_stream_icons'],
    layoutHints: 'Flow diagram style, directional cash movement',
    iconStyle: 'flow_direction_icons',
    emphasisStyle: 'teal_flow_highlight',
    backgroundTheme: 'flowing_teal_cyan',
    characterPose: 'explaining_flow_direction',
    colorScheme: 'teal and cyan flow colors',
  },
  4: { // 盈利质量
    visualElements: ['quality_badge', 'rating_stars', 'verification_checkmarks'],
    layoutHints: 'Quality assessment dashboard, rating emphasis',
    iconStyle: 'quality_rating_icons',
    emphasisStyle: 'purple_gold_quality',
    backgroundTheme: 'premium_purple_gold',
    characterPose: 'quality_inspector_pose',
    colorScheme: 'purple and gold quality theme',
  },
  5: { // 风险评估 - 特殊处理，添加安全约束
    visualElements: ['shield_protection_icon', 'gauge_meter', 'checklist_items', 'stability_chart'],
    layoutHints: 'PROFESSIONAL risk dashboard style - NOT warning/danger imagery. Think corporate board presentation.',
    iconStyle: 'professional_assessment_icons',
    emphasisStyle: 'neutral_blue_grey_highlight',
    backgroundTheme: 'professional_calm_grey_blue',
    characterPose: 'thoughtful_analytical_pose',
    colorScheme: 'professional navy blue and soft grey tones',
    safetyConstraints: `IMPORTANT SAFETY GUIDELINES FOR THIS PANEL:
- This is a PROFESSIONAL FINANCIAL RISK ASSESSMENT, not a warning or danger scene
- Use calm, business-appropriate imagery only
- Think "corporate boardroom presentation" not "emergency alert"
- Visualize risk as analytical data, not threatening imagery`,
    avoidElements: [
      'warning_signs', 'danger_symbols', 'red_alerts', 'skull_icons', 
      'fire_imagery', 'explosion', 'alarm_bells', 'emergency_lights',
      'threatening_imagery', 'dark_ominous_backgrounds', 'storm_clouds'
    ],
  },
  6: { // 竞争护城河
    visualElements: ['fortress_castle_icon', 'shield_emblem', 'moat_water', 'strength_indicators'],
    layoutHints: 'Fortress/castle metaphor, strength and protection theme',
    iconStyle: 'strength_fortress_icons',
    emphasisStyle: 'golden_strength_highlight',
    backgroundTheme: 'golden_fortress_theme',
    characterPose: 'confident_defending_pose',
    colorScheme: 'golden yellow fortress theme',
  },
  7: { // 投资结论
    visualElements: ['summary_badge', 'score_display', 'recommendation_icon', 'conclusion_checkmark'],
    layoutHints: 'Summary conclusion style, clear recommendation emphasis',
    iconStyle: 'conclusion_summary_icons',
    emphasisStyle: 'gradient_conclusion_highlight',
    backgroundTheme: 'conclusion_gradient_professional',
    characterPose: 'confident_recommendation_pose',
    colorScheme: 'gradient from analysis to conclusion',
  },
};

// 获取面板模板的辅助函数
function getPanelTemplate(panelIndex: number): PanelTemplate {
  return PANEL_TEMPLATES[panelIndex] || PANEL_TEMPLATES[1]; // 默认使用盈利能力模板
}

export class ComicService {
  private apiKey: string;
  private baseUrl = 'https://api.vectorengine.ai/v1';
  private currentCharacter: IPCharacter | null = null;
  // 记录图片生成失败的详细信息
  private generationFailures: Map<number, ImageGenerationFailure> = new Map();
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getRecommendedPanelCount(report: Partial<AnalysisReport>): number {
    return determinePanelCount(report).recommended;
  }

  private getIPCharacter(config: Partial<ComicGenerationConfig>): IPCharacter {
    if (config.customCharacter) return config.customCharacter;
    if (config.characterSetId && config.mainCharacterId) {
      const character = characterService.getCharacter(config.characterSetId, config.mainCharacterId);
      if (character) return character;
    }
    return characterService.getDefaultCharacter();
  }
  
  // 当前内容风格
  private currentContentStyle: ComicContentStyle = 'creative';

  /**
   * 发送进度更新
   */
  private async sendProgress(
    onProgress: ProgressCallback | undefined,
    stage: ComicProgressStage,
    percent: number,
    message: string,
    currentPanel?: number,
    totalPanels?: number,
    extra?: {
      characterName?: string;
      panelTitle?: string;
      scriptSummary?: {
        charactersUsed?: string[];
        totalPanels: number;
        theme?: string;
      };
    }
  ): Promise<void> {
    if (onProgress) {
      try {
        await onProgress({
          stage,
          percent,
          message,
          currentPanel,
          totalPanels,
          timestamp: Date.now(),
          ...extra,
        });
      } catch (e) {
        console.error('[Comic] Progress callback error:', e);
      }
    }
  }

  /**
   * 生成财报漫画 - 完整流程
   */
  async generateComic(
    report: Partial<AnalysisReport>,
    config: Partial<ComicGenerationConfig> = {}
  ): Promise<ComicGenerationResult> {
    const { onProgress } = config;
    
    try {
      // 初始化进度
      await this.sendProgress(onProgress, 'init', 0, '初始化漫画生成...');
      
      this.currentCharacter = this.getIPCharacter(config);
      this.currentContentStyle = config.contentStyle || 'creative';
      
      const styleConfig = getContentStyleConfig(this.currentContentStyle);
      console.log(`[Comic] Using character: ${this.currentCharacter.name} (${this.currentCharacter.id})`);
      console.log(`[Comic] Using content style: ${styleConfig.icon} ${styleConfig.name} (${this.currentContentStyle})`);
      
      const panelRange = determinePanelCount(report);
      const targetPanels = config.minPanels || config.maxPanels 
        ? Math.max(config.minPanels || panelRange.min, Math.min(config.maxPanels || panelRange.max, 8))
        : panelRange.recommended;
      
      console.log(`[Comic] Generating ${targetPanels} panels for ${report.companyName}`);
      
      // 脚本生成阶段
      await this.sendProgress(onProgress, 'script', 5, '正在生成漫画脚本...', undefined, targetPanels);
      
      // 生成漫画脚本（深度整合Agent数据，使用指定风格）
      const script = await this.generateEnhancedComicScript(report, targetPanels, this.currentCharacter, this.currentContentStyle);
      if (!script) {
        await this.sendProgress(onProgress, 'failed', 0, '生成漫画脚本失败');
        return { success: false, error: '生成漫画脚本失败' };
      }
      
      // 脚本完成，发送包含角色信息的进度
      const characterName = script.mainCharacter?.name || this.currentCharacter?.displayName || '财报解读官';
      await this.sendProgress(
        onProgress, 
        'script_done', 
        20, 
        `脚本生成完成！${characterName}准备开始绘制...`, 
        undefined, 
        script.panels.length,
        {
          characterName,
          scriptSummary: {
            charactersUsed: [characterName],
            totalPanels: script.panels.length,
            theme: script.theme,
          }
        }
      );
      
      console.log(`[Comic] Script generated with ${script.panels.length} panels`);
      console.log(`[Comic] Main character: ${script.mainCharacter?.name || 'Unknown'}`);
      
      // 并行生成图片（分批执行）
      const panels: ComicPanel[] = [];
      const batchSize = 4;
      
      for (let batchStart = 0; batchStart < script.panels.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, script.panels.length);
        const batchPanels = script.panels.slice(batchStart, batchEnd);
        const batchNumber = Math.floor(batchStart / batchSize) + 1;
        const totalBatches = Math.ceil(script.panels.length / batchSize);
        
        // 更新批次进度
        const batchStage = batchNumber === 1 ? 'images_batch_1' : 'images_batch_2' as ComicProgressStage;
        const batchStartPercent = 20 + (batchNumber - 1) * 35; // 20% -> 55% -> 90%
        await this.sendProgress(
          onProgress, 
          batchStage, 
          batchStartPercent, 
          `正在绘制第${batchStart + 1}-${batchEnd}页...`,
          batchStart + 1,
          script.panels.length
        );
        
        console.log(`[Comic] Processing batch ${batchNumber}/${totalBatches}, panels ${batchStart + 1}-${batchEnd}...`);
        
        const batchPromises = batchPanels.map(async (panelScript, batchIndex) => {
          const globalIndex = batchStart + batchIndex;
          console.log(`[Comic] Generating image for panel ${globalIndex + 1}/${script.panels.length}...`);
          
          // 使用风格化的图片提示词
          const fullPrompt = this.buildStyledImagePromptForPanel(panelScript, this.currentCharacter!, globalIndex, this.currentContentStyle);
          const imageUrl = await this.generateImageWithGemini(fullPrompt, globalIndex);
          
          // 更新单个面板进度，包含角色名和面板标题
          const panelPercent = batchStartPercent + ((batchIndex + 1) / batchSize) * 35;
          const panelTitle = panelScript.sectionTitle || panelScript.caption || `第${globalIndex + 1}页`;
          await this.sendProgress(
            onProgress,
            batchStage,
            Math.min(panelPercent, 90),
            `${characterName}正在绘制：${panelTitle}`,
            globalIndex + 1,
            script.panels.length,
            {
              characterName,
              panelTitle,
            }
          );
          
          return {
            imageUrl: imageUrl || '',
            caption: panelScript.caption,
            dialogue: panelScript.dialogue,
            scene: panelScript.scene,
            visualMetaphor: panelScript.visualMetaphor,
            mood: panelScript.mood,
            order: globalIndex + 1,
            // 扩展字段
            sectionTitle: panelScript.sectionTitle,
            subPanels: panelScript.subPanels,
          } as ComicPanel & { sectionTitle: string; subPanels: unknown[] };
        });
        
        const batchResults = await Promise.all(batchPromises);
        panels.push(...batchResults);
        console.log(`[Comic] Batch ${batchNumber} completed, ${batchResults.length} panels generated`);
        
        if (batchEnd < script.panels.length) {
          console.log(`[Comic] Waiting 1s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 最终处理阶段
      await this.sendProgress(onProgress, 'finalizing', 92, '正在整理漫画数据...');
      
      panels.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      const comicData: ComicData = {
        title: script.title,
        panels,
        summary: script.investmentMessage,
        style: config.style === 'nezha' ? 'modern' : (config.style || 'business') as 'business' | 'modern' | 'classic' | 'minimal',
        mainCharacter: script.mainCharacter,
        financialHighlights: script.financialHighlights,
      };
      
      let scrollHtml: string | undefined;
      if (config.outputFormat === 'vertical-scroll') {
        scrollHtml = this.generateScrollComicHtml(comicData, report.companyName || '财报分析');
      }
      
      // 完成
      await this.sendProgress(onProgress, 'completed', 100, '漫画生成完成！', script.panels.length, script.panels.length);
      
      return { success: true, comic: comicData, script, scrollHtml };
    } catch (error) {
      console.error('[Comic] Generate comic error:', error);
      return { success: false, error: error instanceof Error ? error.message : '生成漫画失败' };
    }
  }
  
  /**
   * 深度提取Agent分析数据 - 全面整合
   */
  private extractDeepAgentData(report: Partial<AnalysisReport>): {
    profitability: { summary: string; metrics: string[]; insights: string[]; risks: string[]; opportunities: string[] };
    balanceSheet: { summary: string; metrics: string[]; insights: string[]; risks: string[] };
    cashFlow: { summary: string; metrics: string[]; insights: string[]; risks: string[] };
    earningsQuality: { summary: string; metrics: string[]; insights: string[] };
    risk: { summary: string; keyRisks: string[]; overallLevel: string };
    businessInsight: { summary: string; advantages: string[]; position: string };
    businessModel: { summary: string; moat: string; drivers: string[] };
    forecast: { summary: string; targets: string[]; catalysts: string[] };
    valuation: { summary: string; metrics: string[]; assessment: string };
    conclusion: { score: number; recommendation: string; keyTakeaways: string[]; strengths: string[]; weaknesses: string[] };
  } {
    const data = {
      profitability: { summary: '', metrics: [] as string[], insights: [] as string[], risks: [] as string[], opportunities: [] as string[] },
      balanceSheet: { summary: '', metrics: [] as string[], insights: [] as string[], risks: [] as string[] },
      cashFlow: { summary: '', metrics: [] as string[], insights: [] as string[], risks: [] as string[] },
      earningsQuality: { summary: '', metrics: [] as string[], insights: [] as string[] },
      risk: { summary: '', keyRisks: [] as string[], overallLevel: '中' },
      businessInsight: { summary: '', advantages: [] as string[], position: '' },
      businessModel: { summary: '', moat: '', drivers: [] as string[] },
      forecast: { summary: '', targets: [] as string[], catalysts: [] as string[] },
      valuation: { summary: '', metrics: [] as string[], assessment: '' },
      conclusion: { score: 0, recommendation: '', keyTakeaways: [] as string[], strengths: [] as string[], weaknesses: [] as string[] },
    };

    // 盈利能力深度提取
    if (report.profitabilityResult) {
      const p = report.profitabilityResult;
      data.profitability.summary = p.summary?.oneSentence || '';
      if (p.keyMetrics) {
        data.profitability.metrics = p.keyMetrics.map((m: { name: string; value: string; status: string }) => 
          `${m.name}: ${m.value} (${m.status})`
        );
      }
      if (p.detailedAnalysis) {
        const da = p.detailedAnalysis;
        if (da.revenueAnalysis?.trend) data.profitability.insights.push(`营收趋势: ${da.revenueAnalysis.trend.substring(0, 100)}...`);
        if (da.profitabilityAnalysis?.grossMarginTrend) data.profitability.insights.push(`毛利率: ${da.profitabilityAnalysis.grossMarginTrend.substring(0, 100)}...`);
        if (da.competitivePosition?.moat) data.profitability.insights.push(`护城河: ${da.competitivePosition.moat.substring(0, 100)}...`);
      }
      data.profitability.risks = (p.risks || []).slice(0, 3);
      data.profitability.opportunities = (p.opportunities || []).slice(0, 3);
    }

    // 资产负债深度提取
    if (report.balanceSheetResult) {
      const b = report.balanceSheetResult;
      data.balanceSheet.summary = b.summary?.oneSentence || '';
      if (b.keyMetrics) {
        data.balanceSheet.metrics = b.keyMetrics.map((m: { name: string; value: string; status: string }) => 
          `${m.name}: ${m.value} (${m.status})`
        );
      }
      if (b.detailedAnalysis) {
        const da = b.detailedAnalysis;
        if (da.assetQuality?.assessment) data.balanceSheet.insights.push(`资产质量: ${da.assetQuality.assessment.substring(0, 100)}...`);
        if (da.liquidityAnalysis?.assessment) data.balanceSheet.insights.push(`流动性: ${da.liquidityAnalysis.assessment.substring(0, 100)}...`);
      }
      data.balanceSheet.risks = (b.risks || []).slice(0, 3);
    }

    // 现金流深度提取
    if (report.cashFlowResult) {
      const c = report.cashFlowResult;
      data.cashFlow.summary = c.summary?.oneSentence || '';
      if (c.keyMetrics) {
        data.cashFlow.metrics = c.keyMetrics.map((m: { name: string; value: string; status: string }) => 
          `${m.name}: ${m.value} (${m.status})`
        );
      }
      if (c.detailedAnalysis) {
        const da = c.detailedAnalysis;
        if (da.operatingCashFlow?.assessment) data.cashFlow.insights.push(`经营现金流: ${da.operatingCashFlow.assessment.substring(0, 100)}...`);
        if (da.freeCashFlow?.assessment) data.cashFlow.insights.push(`自由现金流: ${da.freeCashFlow.assessment.substring(0, 100)}...`);
      }
      data.cashFlow.risks = (c.risks || []).slice(0, 3);
    }

    // 盈利质量深度提取
    if (report.earningsQualityResult) {
      const e = report.earningsQualityResult;
      data.earningsQuality.summary = e.summary?.oneSentence || '';
      if (e.keyMetrics) {
        data.earningsQuality.metrics = e.keyMetrics.map((m: { name: string; value: string; status: string }) => 
          `${m.name}: ${m.value} (${m.status})`
        );
      }
      if (e.detailedAnalysis?.qualityAssessment) {
        data.earningsQuality.insights.push(e.detailedAnalysis.qualityAssessment.substring(0, 150));
      }
    }

    // 风险评估深度提取
    if (report.riskResult) {
      const r = report.riskResult;
      data.risk.summary = r.summary?.oneSentence || '';
      data.risk.overallLevel = r.summary?.overallRisk || '中';
      if (r.keyRisks) {
        data.risk.keyRisks = r.keyRisks.slice(0, 5);
      } else if (r.risks) {
        data.risk.keyRisks = r.risks.slice(0, 5);
      }
    }

    // 业务洞察深度提取
    if (report.businessInsightResult) {
      const bi = report.businessInsightResult;
      data.businessInsight.summary = bi.summary?.oneSentence || '';
      data.businessInsight.position = bi.summary?.industryPosition || '';
      if (bi.summary?.competitiveAdvantage) {
        data.businessInsight.advantages.push(bi.summary.competitiveAdvantage);
      }
      if (bi.detailedAnalysis?.competitiveAdvantages) {
        data.businessInsight.advantages.push(...bi.detailedAnalysis.competitiveAdvantages.slice(0, 3));
      }
    }

    // 商业模式深度提取
    if (report.businessModelResult) {
      const bm = report.businessModelResult;
      data.businessModel.summary = bm.summary?.oneSentence || '';
      data.businessModel.moat = bm.summary?.moatStrength || '';
      if (bm.detailedAnalysis?.growthDrivers && Array.isArray(bm.detailedAnalysis.growthDrivers)) {
        data.businessModel.drivers = bm.detailedAnalysis.growthDrivers.slice(0, 3);
      }
    }

    // 预测深度提取
    if (report.forecastResult) {
      const f = report.forecastResult;
      data.forecast.summary = f.summary?.oneSentence || '';
      if (f.targetPrices && typeof f.targetPrices === 'object') {
        data.forecast.targets = Object.entries(f.targetPrices).map(([k, v]) => `${k}: ${v}`);
      }
      if (f.catalysts && Array.isArray(f.catalysts)) {
        data.forecast.catalysts = f.catalysts.slice(0, 3);
      }
    }

    // 估值深度提取
    if (report.valuationResult) {
      const v = report.valuationResult;
      data.valuation.summary = v.summary?.oneSentence || '';
      data.valuation.assessment = v.summary?.valuationLevel || '';
      if (v.keyMetrics) {
        data.valuation.metrics = v.keyMetrics.map((m: { name: string; value: string }) => `${m.name}: ${m.value}`);
      }
    }

    // 最终结论深度提取
    if (report.finalConclusion) {
      const f = report.finalConclusion;
      data.conclusion.score = f.summary?.score || f.companyQuality?.score || 0;
      data.conclusion.recommendation = f.summary?.recommendation || f.recommendation?.action || '';
      data.conclusion.keyTakeaways = f.keyTakeaways || [];
      data.conclusion.strengths = f.companyQuality?.keyStrengths || [];
      data.conclusion.weaknesses = f.companyQuality?.keyWeaknesses || [];
    }

    return data;
  }

  /**
   * 生成增强版漫画脚本 - 模块化提示词组合
   * 支持多种内容风格：规范4步分析、自由创意、学术、叙事、仪表盘等
   */
  private async generateEnhancedComicScript(
    report: Partial<AnalysisReport>,
    targetPanels: number,
    character: IPCharacter,
    contentStyle: ComicContentStyle = 'creative'
  ): Promise<ComicScript | null> {
    // 深度提取Agent数据
    const agentData = this.extractDeepAgentData(report);
    
    // 构建详细的分析数据JSON
    const analysisDataJson = JSON.stringify({
      company: {
        name: report.companyName,
        code: report.companyCode,
        reportPeriod: report.reportPeriod,
      },
      agentAnalysis: agentData,
    }, null, 2);

    // 使用风格化的提示词系统
    const styleConfig = getContentStyleConfig(contentStyle);
    console.log(`[Comic] Using content style: ${styleConfig.icon} ${styleConfig.name}`);
    
    const systemPrompt = buildStyledComicScriptSystemPrompt(character, {
      name: report.companyName || '未知公司',
      code: report.companyCode || '000000',
    }, contentStyle);
    
    // 构建风格化的用户提示词
    const userPrompt = buildStyledUserPrompt(
      character,
      {
        name: report.companyName || '未知公司',
        code: report.companyCode || '000000',
        reportPeriod: report.reportPeriod,
      },
      analysisDataJson,
      contentStyle
    );

    try {
      console.log(`[Comic] Generating modular script for ${report.companyName}, using system prompt (${systemPrompt.length} chars) + user prompt (${userPrompt.length} chars)`);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: SCRIPT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8, // 稍高一点鼓励创意
          max_tokens: 16384,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Script generation API error:', response.status, errorText);
        return null;
      }
      
      const result = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      
      const content = result.choices[0]?.message?.content;
      if (!content) return null;
      
      // 解析JSON
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      
      try {
        return JSON.parse(jsonStr.trim());
      } catch (parseError) {
        console.error('Failed to parse comic script JSON:', parseError);
        const fixedJson = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .trim();
        return JSON.parse(fixedJson);
      }
    } catch (error) {
      console.error('Generate enhanced script error:', error);
      return null;
    }
  }

  /**
   * 构建增强版图片提示词 - 模块化组合
   * 根据脚本中的布局选择和数据元素动态生成
   */
  private buildEnhancedImagePrompt(
    panel: ComicScript['panels'][0] & {
      layoutChoice?: string;
      layoutDescription?: string;
      dataElements?: Array<{
        type: string;
        label: string;
        value: string;
        position?: string;
        size?: string;
        emphasis?: boolean;
      }>;
      creativeTwist?: string;
    },
    character: IPCharacter,
    panelIndex: number = 0
  ): string {
    const template = getPanelTemplate(panelIndex);
    const theme = PANEL_THEMES[panelIndex];
    
    // 获取脚本中指定的布局，或使用默认
    const layoutChoice = panel.layoutChoice || 'GRID_2X2';
    const layoutModule = LAYOUT_MODULES[layoutChoice as keyof typeof LAYOUT_MODULES];
    const layoutPrompt = layoutModule?.prompt || LAYOUT_MODULES.GRID_2X2.prompt;
    
    // 获取情绪模块
    const moodKey = panel.mood === '积极' ? 'POSITIVE_GROWTH' 
      : panel.mood === '谨慎' ? 'CAUTIOUS_ANALYTICAL'
      : panel.mood === '稳健' ? 'STABLE_PROFESSIONAL'
      : 'NEUTRAL_BALANCED';
    const moodPrompt = MOOD_MODULES[moodKey as keyof typeof MOOD_MODULES] || MOOD_MODULES.NEUTRAL_BALANCED;
    
    // 获取安全约束
    let safetyPrompt = SAFETY_MODULES.STANDARD;
    if (panelIndex === 5) { // 风险面板
      safetyPrompt = SAFETY_MODULES.RISK_PANEL_SAFETY;
    } else if (panelIndex === 7) { // 结论面板
      safetyPrompt = SAFETY_MODULES.CONCLUSION_SAFETY;
    }
    
    // 构建数据元素描述
    let dataElementsDescription = '';
    if (panel.dataElements && panel.dataElements.length > 0) {
      dataElementsDescription = `=== DATA ELEMENTS (As specified in script) ===\n` +
        panel.dataElements.map((el, idx) => {
          return `Element ${idx + 1}:
  - Type: ${el.type}
  - Label: "${el.label}"
  - Value: "${el.value}"
  - Position: ${el.position || 'auto'}
  - Size: ${el.size || 'medium'}
  ${el.emphasis ? '- EMPHASIZED (make this stand out!)' : ''}`;
        }).join('\n\n');
    }
    
    // 如果有传统 subPanels，也支持
    let subPanelsDescription = '';
    if (panel.subPanels && panel.subPanels.length > 0) {
      subPanelsDescription = `=== INFO CARDS (if using grid layout) ===\n` +
        panel.subPanels.map((sp, idx) => {
          return `Card ${idx + 1}:
  - Number badge: "${sp.number}"
  - Title: "${sp.title}"
  - Content: "${sp.content}"
  - Icon: ${sp.icon || '📊'}
  ${sp.highlight ? `- Highlight: "${sp.highlight}"` : ''}`;
        }).join('\n\n');
    }

    // 组合最终提示词
    return `${BASE_MODULES.INFOGRAPHIC_BASE}

=== PANEL ${panelIndex + 1}: ${theme?.name || 'Financial Info'} ===
Section Title (Chinese): "${panel.sectionTitle}"
Creative Twist: ${panel.creativeTwist || 'Professional financial infographic'}

=== LAYOUT ===
${panel.layoutDescription || layoutPrompt}

${dataElementsDescription}

${subPanelsDescription}

=== CHARACTER ===
Character: ${character.name} (${character.displayName})
Visual style: ${character.visualStyle}
Action: ${panel.action || panel.characterAction || 'presenting information'}
Expression: ${panel.mood === '积极' ? 'happy, enthusiastic' : panel.mood === '谨慎' ? 'thoughtful, careful' : 'professional, confident'}
Speech bubble: "${panel.dialogue || ''}"
Position: Integrated with layout, not blocking key information

${moodPrompt}

=== VISUAL STYLE ===
- Color palette: ${character.colorPalette.join(', ')}
- Background theme: ${template.backgroundTheme}
- Visual elements: ${template.visualElements.join(', ')}
- Visual metaphor: ${panel.visualMetaphor || 'financial analysis'}
- Scene: ${panel.scene}

${BASE_MODULES.CHINESE_TEXT_PRIORITY}

${safetyPrompt}

=== QUALITY ===
- 4K high quality digital illustration
- Clean, modern infographic design
- All text clearly readable
- Professional yet friendly aesthetic`;
  }

  /**
   * 构建风格化的图片提示词 - 根据内容风格生成不同的提示词
   */
  private buildStyledImagePromptForPanel(
    panel: {
      panelNumber: number;
      sectionTitle: string;
      subPanels?: Array<{ number: number; title: string; content: string; icon: string; highlight?: string }>;
      layoutChoice?: string;
      layoutDescription?: string;
      dataElements?: Array<{ type: string; label: string; value: string; position?: string; size?: string; emphasis?: boolean }>;
      dialogue?: string;
      caption?: string;
      mood?: string;
      visualMetaphor?: string;
      scene?: string;
      action?: string;
      characterAction?: string;
      creativeTwist?: string;
    },
    character: IPCharacter,
    panelIndex: number,
    contentStyle: ComicContentStyle
  ): string {
    // 使用模块化系统的风格化图片提示词
    return buildStyledImagePrompt(panel, character, panelIndex, contentStyle);
  }

  /**
   * 使用 Gemini 生成图片 - 带重试机制
   */
  private async generateImageWithGemini(prompt: string, panelIndex: number): Promise<string> {
    let lastError = '';
    let errorType: ImageGenerationFailure['errorType'] = 'unknown';
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        console.log(`[Comic] Panel ${panelIndex + 1}: Attempt ${attempt}/${RETRY_CONFIG.maxRetries} - Calling ${IMAGE_MODEL} (prompt length: ${prompt.length})...`);
        
        // 使用 AbortController 实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeoutMs);
        
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        console.log(`[Comic] Panel ${panelIndex + 1}: API response in ${elapsed}ms, status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Comic] Panel ${panelIndex + 1}: Image generation error:`, response.status, errorText.substring(0, 500));
          
          // 分析错误类型
          if (response.status === 400 && (errorText.includes('safety') || errorText.includes('blocked') || errorText.includes('policy'))) {
            errorType = 'safety_filter';
            lastError = `安全过滤：内容可能触发了安全策略 (HTTP ${response.status})`;
          } else if (response.status === 403 && (errorText.includes('insufficient_quota') || errorText.includes('quota'))) {
            // 配额不足错误 - 特殊处理
            errorType = 'quota_exceeded';
            lastError = `API配额不足，请联系管理员充值`;
            console.error(`[Comic] Panel ${panelIndex + 1}: Quota exceeded, skipping retries`);
            break; // 配额不足时不再重试
          } else if (response.status >= 500) {
            errorType = 'api_error';
            lastError = `服务器错误 (HTTP ${response.status})`;
          } else {
            errorType = 'api_error';
            lastError = `API错误 (HTTP ${response.status}): ${errorText.substring(0, 100)}`;
          }
          
          // 如果是安全过滤，不再重试（提示词需要调整）
          if (errorType === 'safety_filter') {
            console.warn(`[Comic] Panel ${panelIndex + 1}: Safety filter triggered, skipping retries`);
            break;
          }
          
          // 等待后重试
          if (attempt < RETRY_CONFIG.maxRetries) {
            const delay = RETRY_CONFIG.retryDelayMs * attempt;
            console.log(`[Comic] Panel ${panelIndex + 1}: Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          continue;
        }
        
        const result = await response.json() as {
          choices: Array<{ message: { content: string } }>;
          images?: Array<{ url: string }>;
        };
        
        // 检查是否直接返回图片URL
        if (result.images && result.images.length > 0) {
          console.log(`[Comic] Panel ${panelIndex + 1}: Success! Got image from images array`);
          this.generationFailures.delete(panelIndex); // 清除之前的失败记录
          return result.images[0].url;
        }
        
        // 从响应内容中提取图片URL
        const content = result.choices[0]?.message?.content || '';
        const imageUrl = this.extractImageUrl(content);
        
        if (imageUrl) {
          console.log(`[Comic] Panel ${panelIndex + 1}: Success! Extracted image URL (${imageUrl.substring(0, 50)}...)`);
          this.generationFailures.delete(panelIndex); // 清除之前的失败记录
          return imageUrl;
        }
        
        // 没有找到图片URL
        errorType = 'no_image';
        lastError = `模型未返回图片，响应内容: ${content.substring(0, 200)}...`;
        console.warn(`[Comic] Panel ${panelIndex + 1}: No image URL found, content preview: ${content.substring(0, 200)}...`);
        
        // 等待后重试
        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = RETRY_CONFIG.retryDelayMs * attempt;
          console.log(`[Comic] Panel ${panelIndex + 1}: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        const elapsed = Date.now() - startTime;
        
        if (error instanceof Error && error.name === 'AbortError') {
          errorType = 'timeout';
          lastError = `请求超时 (${RETRY_CONFIG.timeoutMs / 1000}秒)`;
          console.error(`[Comic] Panel ${panelIndex + 1}: Request timeout after ${elapsed}ms`);
        } else {
          errorType = 'unknown';
          lastError = `未知错误: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[Comic] Panel ${panelIndex + 1}: Generate image error:`, error);
        }
        
        // 等待后重试
        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = RETRY_CONFIG.retryDelayMs * attempt;
          console.log(`[Comic] Panel ${panelIndex + 1}: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试都失败了，记录详细信息
    const failure: ImageGenerationFailure = {
      panelIndex,
      attempts: RETRY_CONFIG.maxRetries,
      lastError,
      errorType,
      timestamp: Date.now(),
    };
    this.generationFailures.set(panelIndex, failure);
    
    console.error(`[Comic] Panel ${panelIndex + 1}: All ${RETRY_CONFIG.maxRetries} attempts failed. Error type: ${errorType}, Last error: ${lastError}`);
    
    // 返回带有错误信息的特殊标记（而不是普通的placeholder）
    return this.getErrorImage(panelIndex, errorType, lastError);
  }
  
  /**
   * 获取生成失败的面板信息
   */
  getGenerationFailures(): ImageGenerationFailure[] {
    return Array.from(this.generationFailures.values());
  }
  
  /**
   * 清除失败记录
   */
  clearGenerationFailures(): void {
    this.generationFailures.clear();
  }

  private extractImageUrl(content: string): string | null {
    // Base64格式优先
    const mdBase64Match = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
    if (mdBase64Match) return mdBase64Match[1];
    
    const mdUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    if (mdUrlMatch) return mdUrlMatch[1];
    
    const base64Match = content.match(/(data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+)/);
    if (base64Match) return base64Match[1];
    
    const httpsUrlMatch = content.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|gif|webp)[^\s"'<>]*/i);
    if (httpsUrlMatch) return httpsUrlMatch[0].replace(/["'>]+$/, '');
    
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
    
    const jsonUrlMatch = content.match(/["']url["']\s*:\s*["'](https?:\/\/[^"']+)["']/i);
    if (jsonUrlMatch) return jsonUrlMatch[1];
    
    const anyUrlMatch = content.match(/https?:\/\/[^\s"'<>]{10,}/i);
    if (anyUrlMatch) return anyUrlMatch[0];
    
    return null;
  }

  private getPlaceholderImage(panelIndex?: number): string {
    const colors = ['1a1a2e', '2d2d44', '3d3d5c', '16213e', '1f2937'];
    const color = colors[(panelIndex ?? 0) % colors.length];
    const text = panelIndex !== undefined && panelIndex >= 0 ? `Panel+${panelIndex + 1}` : 'Comic+Panel';
    return `https://via.placeholder.com/512x512/${color}/d4af37?text=${text}`;
  }
  
  /**
   * 获取错误提示图片 - 返回特殊标记的URL，前端可以根据此显示友好提示
   */
  private getErrorImage(panelIndex: number, errorType: ImageGenerationFailure['errorType'], errorMessage: string): string {
    // 使用data URI编码错误信息，前端可以解析并显示友好提示
    // 格式: placeholder://error/{panelIndex}/{errorType}/{base64ErrorMessage}
    const encodedMessage = btoa(encodeURIComponent(errorMessage));
    return `placeholder://error/${panelIndex}/${errorType}/${encodedMessage}`;
  }
  
  /**
   * 检查URL是否是错误标记
   */
  static isErrorImage(url: string): boolean {
    return url.startsWith('placeholder://error/');
  }
  
  /**
   * 解析错误图片URL，获取错误详情
   */
  static parseErrorImage(url: string): { panelIndex: number; errorType: string; errorMessage: string } | null {
    if (!ComicService.isErrorImage(url)) return null;
    
    const parts = url.replace('placeholder://error/', '').split('/');
    if (parts.length < 3) return null;
    
    try {
      return {
        panelIndex: parseInt(parts[0], 10),
        errorType: parts[1],
        errorMessage: decodeURIComponent(atob(parts[2])),
      };
    } catch {
      return null;
    }
  }
  
  /**
   * 获取用户友好的错误提示消息
   */
  static getFriendlyErrorMessage(errorType: ImageGenerationFailure['errorType']): string {
    const messages: Record<ImageGenerationFailure['errorType'], string> = {
      'api_error': '图片生成服务暂时不可用，请稍后重试',
      'safety_filter': '图片内容需要调整，正在优化中',
      'no_image': '图片生成未成功，请刷新重试',
      'timeout': '图片生成超时，请稍后重试',
      'quota_exceeded': 'API配额不足，请联系管理员充值后重试',
      'unknown': '图片生成遇到问题，请刷新重试',
    };
    return messages[errorType] || messages['unknown'];
  }

  /**
   * 生成长图文HTML
   */
  private generateScrollComicHtml(comic: ComicData, companyName: string): string {
    const panelHeight = 700;
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${comic.title || companyName + '财报漫画'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .comic-container {
      max-width: 750px;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 0 30px rgba(0,0,0,0.2);
    }
    .comic-header {
      background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .comic-header h1 {
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .comic-panel {
      position: relative;
      width: 100%;
      min-height: ${panelHeight}px;
      border-bottom: 3px solid #f0f0f0;
    }
    .panel-image {
      width: 100%;
      height: auto;
      min-height: 500px;
      object-fit: contain;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }
    .panel-content {
      padding: 20px;
      background: #fff;
    }
    .panel-caption {
      font-size: 18px;
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
      padding-left: 15px;
      border-left: 4px solid #8B5CF6;
    }
    .comic-footer {
      background: linear-gradient(135deg, #37474F 0%, #263238 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .disclaimer {
      font-size: 12px;
      color: rgba(255,255,255,0.7);
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="comic-container">
    <div class="comic-header">
      <h1>${comic.title || companyName + '财报漫画解读'}</h1>
      <p>AI财报分析 · 信息图表漫画</p>
    </div>
    ${comic.panels.map((panel, index) => `
    <div class="comic-panel">
      <img class="panel-image" src="${panel.imageUrl}" alt="Panel ${index + 1}">
      <div class="panel-content">
        ${panel.caption ? `<div class="panel-caption">${panel.caption}</div>` : ''}
      </div>
    </div>
    `).join('')}
    <div class="comic-footer">
      <p>${comic.summary || ''}</p>
      <div class="disclaimer">⚠️ AI生成内容，仅供参考，不构成投资建议</div>
    </div>
  </div>
</body>
</html>`;
  }

  // 兼容旧方法
  private prepareAnalysisData(report: Partial<AnalysisReport>): string {
    const agentData = this.extractDeepAgentData(report);
    return JSON.stringify(agentData, null, 2);
  }

  async generateComicText(report: Partial<AnalysisReport>): Promise<string> {
    const analysisData = this.prepareAnalysisData(report);
    
    const prompt = `你是一位幽默风趣的财经漫画家，请用文字描述一个8格漫画故事。

将以下财报分析转化为有趣的故事：
${analysisData}

要求：
1. 把公司拟人化为一个角色
2. 用生动的场景和对话展示财务状况
3. 每格包含：【场景描述】角色对话
4. 语言通俗易懂，带有适当的幽默感
5. 最后给出投资建议`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: SCRIPT_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 4096,
        }),
      });
      
      if (!response.ok) return '漫画生成失败，请稍后重试';
      
      const result = await response.json() as { choices: Array<{ message: { content: string } }> };
      return result.choices[0]?.message?.content || '漫画生成失败';
    } catch (error) {
      console.error('Generate comic text error:', error);
      return '漫画生成失败，请稍后重试';
    }
  }

  async generateScriptOnly(report: Partial<AnalysisReport>): Promise<ComicScript | null> {
    const character = characterService.getDefaultCharacter();
    return this.generateEnhancedComicScript(report, 8, character);
  }

  // ================================================================
  // 新版高质量JSON提示词方法 (参考公众号案例的Nano Banana格式)
  // ================================================================

  /**
   * 生成高质量信息图JSON提示词
   * 参考公众号文章中的Gemini高质量提示词结构
   */
  private buildNanoBananaPrompt(
    panel: ComicScript['panels'][0],
    character: IPCharacter,
    companyName: string,
    panelIndex: number
  ): string {
    // 定义8个面板的信息图类型映射
    const panelTypeMap: Record<number, string> = {
      0: 'INTRODUCTION',      // 公司介绍
      1: 'DATA_ANALYSIS',     // 盈利能力
      2: 'COMPARISON',        // 资产负债
      3: 'FLOW_DIAGRAM',      // 现金流
      4: 'EVALUATION',        // 盈利质量
      5: 'RISK_ASSESSMENT',   // 风险评估
      6: 'MOAT_ANALYSIS',     // 护城河
      7: 'CONCLUSION',        // 投资结论
    };

    // 定义每个面板的标题和副标题
    const panelTitles: Record<number, { title: string; subtitle: string }> = {
      0: { title: `${companyName}`, subtitle: '公司基本面概览' },
      1: { title: '盈利能力分析', subtitle: '营收与利润趋势' },
      2: { title: '资产负债健康度', subtitle: '财务结构评估' },
      3: { title: '现金流状况', subtitle: '资金流动性分析' },
      4: { title: '盈利质量评估', subtitle: '利润含金量检测' },
      5: { title: '风险因素识别', subtitle: '潜在风险预警' },
      6: { title: '竞争护城河', subtitle: '核心竞争优势' },
      7: { title: '投资结论', subtitle: '综合评估建议' },
    };

    // 使用共享的面板模板配置
    const template = getPanelTemplate(panelIndex);
    const colorScheme = template.colorScheme;

    // 定义心情映射到mood
    const moodMap: Record<string, string> = {
      '积极': 'positive',
      '谨慎': 'cautious',
      '紧张': 'tense',
      '中性': 'neutral',
    };

    const panelType = panelTypeMap[panelIndex] || 'DATA_ANALYSIS';
    const titles = panelTitles[panelIndex] || { title: panel.sectionTitle || '', subtitle: '' };
    const mood = moodMap[panel.mood || '中性'] || 'neutral';

    // 构建4个元素（来自subPanels）
    const elements = (panel.subPanels || []).slice(0, 4).map((sub, idx) => ({
      position: idx + 1,
      label: sub.title || `数据点${idx + 1}`,
      content: sub.content || '',
      icon: this.getIconSuggestion(sub.title || '', panelIndex),
      highlight: sub.highlight || '',
      mood: sub.highlight ? 'emphasized' : 'neutral',
      size: idx === 0 ? 'large' : 'medium',
    }));

    // 构建JSON提示词结构
    const jsonPrompt = {
      infographic_type: panelType,
      title: titles.title,
      subtitle: titles.subtitle,
      cultural_context: 'chinese_modern',
      era: 'Contemporary Finance',
      layout: {
        direction: 'TOP_TO_BOTTOM',
        sections: 4,
        grid: '2x2',
        character_position: 'bottom_right',
      },
      background_scene: this.getBackgroundScene(panelIndex, companyName),
      main_character: {
        name: character.name,
        style: character.style || 'chibi cartoon',
        appearance: character.appearance || `Cute ${character.name} character`,
        pose: this.getCharacterPose(panelIndex),
        expression: this.getCharacterExpression(mood),
        speech_bubble: panel.dialogue || '',
      },
      elements: elements,
      color_scheme: colorScheme,
      language_requirement: 'ALL text labels in Simplified Chinese',
      text_overlay: {
        content: titles.title,
        language: 'Chinese',
        style: 'Bold modern font',
        text_rules: 'Clear rendering, high contrast, readable at small sizes',
      },
      data_visualization: {
        type: this.getVisualizationType(panelIndex),
        show_numbers: true,
        highlight_key_metrics: true,
      },
      mood_atmosphere: {
        overall: mood,
        visual_metaphor: panel.visualMetaphor || '',
        scene_context: panel.scene || '',
      },
      style_requirements: {
        quality: '4K digital illustration',
        aesthetic: 'Clean modern infographic with cute character',
        visual_hierarchy: 'Clear size and color contrast',
        corners: 'Rounded, soft feel',
        background: 'Soft pastel gradient',
      },
      negative_prompt: `blurry text, incorrect characters, misspelled words, low quality, distorted faces, extra limbs, text errors${template.avoidElements ? ', ' + template.avoidElements.join(', ') : ''}`,
      safety: {
        content_rating: 'G',
        avoid: `violence, inappropriate content, misleading financial advice${template.avoidElements ? ', ' + template.avoidElements.join(', ') : ''}`,
      },
      panel_specific: {
        visual_elements: template.visualElements,
        layout_hints: template.layoutHints,
        icon_style: template.iconStyle,
        emphasis_style: template.emphasisStyle,
        background_theme: template.backgroundTheme,
        character_pose: template.characterPose,
      },
      format_requirements: {
        aspect_ratio: '1:1',
        resolution: '1024x1024',
        file_format: 'PNG',
      },
      text_generation_rules: {
        chinese_text: 'Must be correctly rendered with proper stroke order',
        numbers: 'Use standard digits, include % symbol where appropriate',
        alignment: 'Center-aligned titles, left-aligned content',
      },
    };

    // 生成完整的prompt
    return `Generate a high-quality financial infographic image based on this JSON specification:

\`\`\`json
${JSON.stringify(jsonPrompt, null, 2)}
\`\`\`

CRITICAL REQUIREMENTS:
1. Create a visually stunning infographic poster in 1:1 square format
2. The main title "${titles.title}" must be prominently displayed at the top
3. Include exactly 4 information cards arranged in a 2x2 grid:
${elements.map((e, i) => `   Card ${i + 1}: "${e.label}" - ${e.content}${e.highlight ? ` (highlight: ${e.highlight})` : ''}`).join('\n')}
4. Include the ${character.name} character in ${character.style || 'chibi'} style at the bottom-right
5. The character should have a speech bubble saying: "${panel.dialogue || ''}"
6. Use ${colorScheme} color palette
7. All Chinese text must be clearly readable and correctly rendered
8. Professional data visualization elements where appropriate
9. Modern, clean infographic design language
10. 4K quality digital illustration

PANEL-SPECIFIC VISUAL GUIDANCE:
- Visual Elements: ${template.visualElements.join(', ')}
- Layout: ${template.layoutHints}
- Icon Style: ${template.iconStyle}
- Background: ${template.backgroundTheme}
- Character Pose: ${template.characterPose}
${template.safetyConstraints ? `\n${template.safetyConstraints}` : ''}
${template.avoidElements ? `\nAVOID these elements: ${template.avoidElements.join(', ')}` : ''}

Generate the image now.`;
  }

  /**
   * 获取图标建议
   */
  private getIconSuggestion(label: string, panelIndex: number): string {
    const iconMap: Record<string, string> = {
      '营收增长': 'trending_up_chart',
      '毛利率': 'pie_chart_percentage',
      '净利率': 'money_bag',
      '净利增长': 'growth_arrow',
      '资产负债率': 'balance_scale',
      '流动比率': 'water_flow',
      '资产质量': 'diamond_quality',
      '流动性': 'cash_flow_icon',
      '经营现金流': 'business_cash',
      '自由现金流': 'free_cash',
      '现金转换率': 'convert_arrows',
      '盈利可持续性': 'sustainability_leaf',
      '综合风险': 'warning_shield',
      '护城河': 'fortress_wall',
      '评分': 'star_rating',
      '建议': 'recommendation_badge',
      '公司全称': 'company_building',
      '所属行业': 'industry_icon',
      '报告期间': 'calendar_report',
    };

    // 尝试匹配
    for (const [key, icon] of Object.entries(iconMap)) {
      if (label.includes(key)) return icon;
    }

    // 默认图标根据面板类型
    const defaultIcons: Record<number, string> = {
      0: 'info_card',
      1: 'profit_chart',
      2: 'balance_icon',
      3: 'cash_flow',
      4: 'quality_badge',
      5: 'risk_alert',
      6: 'shield_moat',
      7: 'conclusion_stamp',
    };

    return defaultIcons[panelIndex] || 'data_point';
  }

  /**
   * 获取背景场景描述
   */
  private getBackgroundScene(panelIndex: number, companyName: string): string {
    const scenes: Record<number, string> = {
      0: `Modern corporate office setting with ${companyName} logo elements, professional and welcoming atmosphere`,
      1: `Growth chart rising background with green accents, financial district skyline silhouette`,
      2: `Split screen showing assets and liabilities, architectural balance elements, blue tones`,
      3: `Flowing water or currency stream visual, representing cash movement, teal gradient`,
      4: `Quality inspection environment, gold coins and diamond elements, premium feel`,
      5: `Weather map with storm clouds and clear sky contrast, risk visualization`,
      6: `Castle fortress walls with protective moat, golden hour lighting`,
      7: `Summit achievement scene, investment success visualization, gradient from dark to bright`,
    };
    return scenes[panelIndex] || 'Abstract financial data visualization background';
  }

  /**
   * 获取角色姿势
   */
  private getCharacterPose(panelIndex: number): string {
    const poses: Record<number, string> = {
      0: 'welcoming gesture, arms open',
      1: 'pointing at chart, excited',
      2: 'thoughtful pose, hand on chin',
      3: 'counting money gesture',
      4: 'inspecting with magnifying glass',
      5: 'protective stance, alert',
      6: 'confident pose, arms crossed',
      7: 'thumbs up, celebratory',
    };
    return poses[panelIndex] || 'presenting information';
  }

  /**
   * 获取角色表情
   */
  private getCharacterExpression(mood: string): string {
    const expressions: Record<string, string> = {
      'positive': 'happy, smiling, confident',
      'cautious': 'thoughtful, slightly concerned, analytical',
      'tense': 'worried, alert, serious',
      'neutral': 'professional, calm, informative',
    };
    return expressions[mood] || 'friendly and informative';
  }

  /**
   * 获取数据可视化类型
   */
  private getVisualizationType(panelIndex: number): string {
    const types: Record<number, string> = {
      0: 'company_profile_card',
      1: 'bar_chart_with_trend_line',
      2: 'comparison_horizontal_bars',
      3: 'flow_sankey_diagram',
      4: 'gauge_meter_quality',
      5: 'risk_radar_chart',
      6: 'strength_pentagon',
      7: 'summary_scorecard',
    };
    return types[panelIndex] || 'data_cards';
  }

  /**
   * 使用高质量JSON提示词生成漫画
   * 这是一个实验性方法，可以通过配置启用
   */
  async generateComicWithNanoBanana(
    report: Partial<AnalysisReport>,
    config: ComicGenerationConfig & { useNanoBanana?: boolean }
  ): Promise<ComicGenerationResult> {
    const { onProgress } = config;
    console.log('[Comic] Starting Nano Banana style generation...');
    
    await this.sendProgress(onProgress, 'init', 0, '初始化 Nano Banana 模式...');
    
    const companyName = report.companyName || '未知公司';
    
    // 获取角色
    let character: IPCharacter;
    if (config.customCharacter) {
      character = config.customCharacter;
    } else if (config.characterSetId && config.mainCharacterId) {
      character = characterService.getCharacter(config.characterSetId, config.mainCharacterId)
        || characterService.getDefaultCharacter();
    } else {
      character = characterService.getDefaultCharacter();
    }

    const targetPanels = 8;
    
    await this.sendProgress(onProgress, 'script', 5, '正在生成漫画脚本...', undefined, targetPanels);
    
    // 生成增强脚本
    const script = await this.generateEnhancedComicScript(report, targetPanels, character);
    
    if (!script || !script.panels || script.panels.length === 0) {
      await this.sendProgress(onProgress, 'failed', 0, '生成漫画脚本失败');
      return { success: false, error: '生成漫画脚本失败' };
    }

    // 脚本完成，发送包含角色信息的进度
    const characterName = character.displayName || character.name || '财报解读官';
    await this.sendProgress(
      onProgress, 
      'script_done', 
      20, 
      `脚本生成完成！${characterName}准备开始绘制...`, 
      undefined, 
      script.panels.length,
      {
        characterName,
        scriptSummary: {
          charactersUsed: [characterName],
          totalPanels: script.panels.length,
          theme: script.theme,
        }
      }
    );
    console.log(`[Comic] Script generated with ${script.panels.length} panels, using Nano Banana prompts...`);

    // 使用Nano Banana格式生成图片
    const panels: ComicPanel[] = [];
    const batchSize = 4;
    
    for (let i = 0; i < script.panels.length; i += batchSize) {
      const batch = script.panels.slice(i, Math.min(i + batchSize, script.panels.length));
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batchStage = batchNumber === 1 ? 'images_batch_1' : 'images_batch_2' as ComicProgressStage;
      const batchStartPercent = 20 + (batchNumber - 1) * 35;
      
      await this.sendProgress(onProgress, batchStage, batchStartPercent, `正在绘制第${i + 1}-${i + batch.length}页...`, i + 1, script.panels.length);
      console.log(`[Comic] Processing batch ${batchNumber}, panels ${i + 1}-${i + batch.length}...`);
      
      const batchPromises = batch.map(async (scriptPanel, batchIndex) => {
        const panelIndex = i + batchIndex;
        
        // 使用新的Nano Banana提示词格式
        const prompt = this.buildNanoBananaPrompt(scriptPanel, character, companyName, panelIndex);
        
        const imageUrl = await this.generateImageWithGemini(prompt, panelIndex);
        
        // 更新面板进度，包含角色名和面板标题
        const panelPercent = batchStartPercent + ((batchIndex + 1) / batchSize) * 35;
        const panelTitle = scriptPanel.sectionTitle || scriptPanel.caption || `第${panelIndex + 1}页`;
        await this.sendProgress(
          onProgress, 
          batchStage, 
          Math.min(panelPercent, 90), 
          `${characterName}正在绘制：${panelTitle}`, 
          panelIndex + 1, 
          script.panels.length,
          {
            characterName,
            panelTitle,
          }
        );
        
        return {
          imageUrl,
          caption: scriptPanel.caption,
          dialogue: scriptPanel.dialogue,
          scene: scriptPanel.scene,
          visualMetaphor: scriptPanel.visualMetaphor,
          mood: scriptPanel.mood,
          order: panelIndex,
          sectionTitle: scriptPanel.sectionTitle,
          subPanels: scriptPanel.subPanels,
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      panels.push(...batchResults);
      
      if (i + batchSize < script.panels.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await this.sendProgress(onProgress, 'finalizing', 92, '正在整理漫画数据...');
    panels.sort((a, b) => (a.order || 0) - (b.order || 0));

    const comicData: ComicData = {
      title: script.title,
      panels,
      summary: script.investmentMessage || '',
      style: config.style || 'infographic',
      mainCharacter: character.name,
      financialHighlights: script.financialHighlights,
    };

    let scrollHtml: string | undefined;
    if (config.outputFormat === 'vertical-scroll') {
      scrollHtml = this.generateScrollComicHtml(comicData, companyName);
    }

    await this.sendProgress(onProgress, 'completed', 100, '漫画生成完成！', script.panels.length, script.panels.length);
    console.log(`[Comic] Nano Banana generation complete! ${panels.length} panels created.`);

    return {
      success: true,
      comic: comicData,
      script,
      scrollHtml,
    };
  }

  // ================================================================
  // Comic Prompt Builder 模式 - 参考 prompt.aigc.green 网站的JSON结构
  // 使用专业级摄影/设计参数生成更高质量的信息图表
  // ================================================================

  /**
   * 构建 Comic Prompt Builder 风格的JSON提示词
   * 参考 https://prompt.aigc.green/ 的结构
   */
  private buildPromptBuilderJSON(
    panel: ComicScript['panels'][0],
    character: IPCharacter,
    companyName: string,
    panelIndex: number
  ): string {
    // 定义8个面板的风格和主题映射
    const panelStyles: Record<number, { style: string; colorPalette: string[]; lighting: string; mood: string }> = {
      0: { 
        style: 'corporate-introduction', 
        colorPalette: ['navy blue', 'gold accent', 'warm white'],
        lighting: 'soft key light with warm fill, subtle rim light',
        mood: 'professional, welcoming, confident'
      },
      1: { 
        style: 'data-visualization-growth', 
        colorPalette: ['emerald green', 'lime accent', 'dark slate'],
        lighting: 'bright natural light, optimistic golden hour tones',
        mood: 'energetic, growth-oriented, analytical'
      },
      2: { 
        style: 'balance-sheet-comparison', 
        colorPalette: ['ocean blue', 'coral orange', 'neutral gray'],
        lighting: 'balanced studio lighting, soft shadows',
        mood: 'thoughtful, balanced, stable'
      },
      3: { 
        style: 'cash-flow-dynamic', 
        colorPalette: ['teal', 'cyan', 'deep blue'],
        lighting: 'flowing light effects, water-like reflections',
        mood: 'fluid, continuous, abundant'
      },
      4: { 
        style: 'quality-assessment', 
        colorPalette: ['royal purple', 'gold', 'pearl white'],
        lighting: 'premium studio lighting, diamond-like sparkle',
        mood: 'premium, quality-focused, scrutinizing'
      },
      5: { 
        style: 'risk-warning', 
        colorPalette: ['warning red', 'cautionary amber', 'storm gray'],
        lighting: 'dramatic contrast lighting, alert tones',
        mood: 'alert, cautious, protective'
      },
      6: { 
        style: 'fortress-moat', 
        colorPalette: ['golden yellow', 'bronze', 'stone gray'],
        lighting: 'epic golden hour, fortress-like solidity',
        mood: 'strong, defended, unassailable'
      },
      7: { 
        style: 'conclusion-verdict', 
        colorPalette: ['success green', 'confidence gold', 'professional navy'],
        lighting: 'triumphant spotlight with soft fill',
        mood: 'conclusive, confident, actionable'
      },
    };

    const panelTitles: Record<number, { title: string; subtitle: string }> = {
      0: { title: `${companyName}`, subtitle: '公司身份证' },
      1: { title: '赚钱能力', subtitle: '盈利能力分析' },
      2: { title: '家底厚度', subtitle: '资产负债健康度' },
      3: { title: '现金流量', subtitle: '资金流动性评估' },
      4: { title: '利润质量', subtitle: '盈利含金量检验' },
      5: { title: '风险预警', subtitle: '潜在风险因素' },
      6: { title: '护城河', subtitle: '竞争优势壁垒' },
      7: { title: '投资结论', subtitle: '综合评估建议' },
    };

    const styleConfig = panelStyles[panelIndex] || panelStyles[0];
    const titles = panelTitles[panelIndex] || { title: panel.sectionTitle || '', subtitle: '' };

    // 构建4个数据卡片
    const dataCards = (panel.subPanels || []).slice(0, 4).map((sub, idx) => ({
      position: idx + 1,
      label: sub.title || `数据${idx + 1}`,
      value: sub.content || '',
      highlight: sub.highlight || '',
      icon_suggestion: sub.icon || this.getIconSuggestion(sub.title || '', panelIndex),
      emphasis: idx === 0 ? 'primary' : 'secondary',
    }));

    // 构建精简的 Prompt Builder JSON 结构（参考 prompt.aigc.green 的核心字段）
    const promptBuilderJSON = {
      // 风格标签（参考 prompt.aigc.green）
      label: `financial-panel-${panelIndex + 1}-${styleConfig.style}`,
      tags: ['financial-infographic', 'magazine-cover', '4K-quality'],
      
      // 风格定义（核心）
      Style: 'Clean modern infographic poster, magazine editorial quality',
      
      // 主体角色（简化）
      Subject: `${character.name} mascot in ${character.style || 'chibi'} style, expressive, bottom-right corner`,
      
      // 布局（简化为字符串）
      Arrangement: `Square 1:1 poster: Title "${titles.title}" at top, 2x2 data grid in center, ${character.name} character bottom-right with speech bubble`,
      
      // 背景
      Background: this.getBackgroundScene(panelIndex, companyName),
      
      // 4个数据卡片（核心内容）
      DataCards: dataCards.map(c => `${c.label}: ${c.value}`),
      
      // 配色
      ColorPalette: styleConfig.colorPalette.join(', '),
      
      // 输出风格
      OutputStyle: `${styleConfig.mood}, professional data visualization`,
      
      // 角色对话
      Dialogue: panel.dialogue || '',
      
      // 负面提示
      NegativePrompt: 'blurry text, misspelled words, distorted faces, low quality'
    };

    // 生成精简但明确的提示词（参考 Nano Banana 的成功格式）
    return `Generate a high-quality financial infographic image.

\`\`\`json
${JSON.stringify(promptBuilderJSON, null, 2)}
\`\`\`

CRITICAL REQUIREMENTS:
1. Create a 1:1 square infographic poster
2. TITLE: "${titles.title}" prominently at top, subtitle "${titles.subtitle}" below
3. DATA CARDS (2x2 grid, 4 cards):
${dataCards.map((card, i) => `   ${i + 1}. ${card.label}: ${card.value}${card.highlight ? ` [KEY: ${card.highlight}]` : ''}`).join('\n')}
4. CHARACTER: ${character.name} in ${character.style || 'chibi'} style at bottom-right
5. SPEECH BUBBLE: "${panel.dialogue || ''}"
6. COLOR SCHEME: ${styleConfig.colorPalette.join(', ')}
7. MOOD: ${styleConfig.mood}
8. All Chinese text must be clearly readable and correctly rendered
9. 4K quality digital illustration
10. Clean, modern magazine-style layout

Generate the image now.`;
  }

  /**
   * 使用 Comic Prompt Builder 模式生成漫画
   * 参考 prompt.aigc.green 网站的专业JSON结构
   */
  async generateComicWithPromptBuilder(
    report: Partial<AnalysisReport>,
    config: ComicGenerationConfig & { usePromptBuilder?: boolean }
  ): Promise<ComicGenerationResult> {
    const { onProgress } = config;
    console.log('[Comic] Starting Comic Prompt Builder style generation...');
    
    await this.sendProgress(onProgress, 'init', 0, '初始化 Prompt Builder 模式...');
    
    const companyName = report.companyName || '未知公司';
    
    // 获取角色
    let character: IPCharacter;
    if (config.customCharacter) {
      character = config.customCharacter;
    } else if (config.characterSetId && config.mainCharacterId) {
      character = characterService.getCharacter(config.characterSetId, config.mainCharacterId)
        || characterService.getDefaultCharacter();
    } else {
      character = characterService.getDefaultCharacter();
    }

    const targetPanels = 8;
    
    await this.sendProgress(onProgress, 'script', 5, '正在生成漫画脚本...', undefined, targetPanels);
    
    // 生成增强脚本（复用已有的高质量脚本生成）
    const script = await this.generateEnhancedComicScript(report, targetPanels, character);
    
    if (!script || !script.panels || script.panels.length === 0) {
      await this.sendProgress(onProgress, 'failed', 0, '生成漫画脚本失败');
      return { success: false, error: '生成漫画脚本失败' };
    }

    // 脚本完成，发送包含角色信息的进度
    const characterName = character.displayName || character.name || '财报解读官';
    await this.sendProgress(
      onProgress, 
      'script_done', 
      20, 
      `脚本生成完成！${characterName}准备开始绘制...`, 
      undefined, 
      script.panels.length,
      {
        characterName,
        scriptSummary: {
          charactersUsed: [characterName],
          totalPanels: script.panels.length,
          theme: script.theme,
        }
      }
    );
    console.log(`[Comic] Script generated with ${script.panels.length} panels, using Prompt Builder format...`);

    // 使用 Prompt Builder 格式生成图片
    const panels: ComicPanel[] = [];
    const batchSize = 4;
    
    for (let i = 0; i < script.panels.length; i += batchSize) {
      const batch = script.panels.slice(i, Math.min(i + batchSize, script.panels.length));
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batchStage = batchNumber === 1 ? 'images_batch_1' : 'images_batch_2' as ComicProgressStage;
      const batchStartPercent = 20 + (batchNumber - 1) * 35;
      
      await this.sendProgress(onProgress, batchStage, batchStartPercent, `正在绘制第${i + 1}-${i + batch.length}页...`, i + 1, script.panels.length);
      console.log(`[Comic] Processing batch ${batchNumber}, panels ${i + 1}-${i + batch.length}...`);
      
      const batchPromises = batch.map(async (scriptPanel, batchIndex) => {
        const panelIndex = i + batchIndex;
        
        // 使用 Prompt Builder JSON 格式
        const prompt = this.buildPromptBuilderJSON(scriptPanel, character, companyName, panelIndex);
        
        const imageUrl = await this.generateImageWithGemini(prompt, panelIndex);
        
        // 更新面板进度，包含角色名和面板标题
        const panelPercent = batchStartPercent + ((batchIndex + 1) / batchSize) * 35;
        const panelTitle = scriptPanel.sectionTitle || scriptPanel.caption || `第${panelIndex + 1}页`;
        await this.sendProgress(
          onProgress, 
          batchStage, 
          Math.min(panelPercent, 90), 
          `${characterName}正在绘制：${panelTitle}`, 
          panelIndex + 1, 
          script.panels.length,
          {
            characterName,
            panelTitle,
          }
        );
        
        return {
          imageUrl,
          caption: scriptPanel.caption,
          dialogue: scriptPanel.dialogue,
          scene: scriptPanel.scene,
          visualMetaphor: scriptPanel.visualMetaphor,
          mood: scriptPanel.mood,
          order: panelIndex,
          sectionTitle: scriptPanel.sectionTitle,
          subPanels: scriptPanel.subPanels,
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      panels.push(...batchResults);
      
      if (i + batchSize < script.panels.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await this.sendProgress(onProgress, 'finalizing', 92, '正在整理漫画数据...');
    panels.sort((a, b) => (a.order || 0) - (b.order || 0));

    const comicData: ComicData = {
      title: script.title,
      panels,
      summary: script.investmentMessage || '',
      style: config.style || 'prompt-builder',
      mainCharacter: character.name,
      financialHighlights: script.financialHighlights,
    };

    let scrollHtml: string | undefined;
    if (config.outputFormat === 'vertical-scroll') {
      scrollHtml = this.generateScrollComicHtml(comicData, companyName);
    }

    await this.sendProgress(onProgress, 'completed', 100, '漫画生成完成！', script.panels.length, script.panels.length);
    console.log(`[Comic] Prompt Builder generation complete! ${panels.length} panels created.`);

    return {
      success: true,
      comic: comicData,
      script,
      scrollHtml,
    };
  }

  /**
   * 使用新的多角色主题系统生成漫画
   * 每格漫画可以使用不同的角色，由AI或预设规则决定
   */
  async generateMultiCharacterComic(
    report: Partial<AnalysisReport>,
    config: ComicGenerationConfig & { 
      themeId?: string;
      useMultiCharacter?: boolean;
      letAIChooseCharacters?: boolean;  // true: AI选择, false: 预设分配
    }
  ): Promise<ComicGenerationResult> {
    const { onProgress } = config;
    
    // 动态导入以避免循环依赖
    const { ipThemeService, PANEL_INDEX_TO_TYPE, DEFAULT_THEME_ID } = await import('./ip-themes');
    const { 
      buildMultiCharacterSystemPrompt, 
      buildMultiCharacterUserPrompt,
      buildMultiCharacterImagePrompt,
      getPresetCharacterAssignment,
    } = await import('./multi-character-comic');
    
    const themeId = config.themeId || DEFAULT_THEME_ID;
    const theme = ipThemeService.getTheme(themeId);
    
    if (!theme) {
      console.error(`[Comic] Theme not found: ${themeId}`);
      await this.sendProgress(onProgress, 'failed', 0, `主题不存在: ${themeId}`);
      return { success: false, error: `主题不存在: ${themeId}` };
    }
    
    await this.sendProgress(onProgress, 'init', 0, `初始化多角色主题: ${theme.name}...`);
    console.log(`[Comic] Starting multi-character generation with theme: ${theme.icon} ${theme.name}`);
    
    const companyName = report.companyName || '未知公司';
    const companyCode = report.companyCode || '000000';
    const contentStyle = config.contentStyle || 'creative';
    
    // 深度提取Agent数据
    const agentData = this.extractDeepAgentData(report);
    const analysisDataJson = JSON.stringify({
      company: { name: companyName, code: companyCode, reportPeriod: report.reportPeriod },
      agentAnalysis: agentData,
    }, null, 2);
    
    let script: any;
    
    await this.sendProgress(onProgress, 'script', 5, '正在生成多角色脚本...', undefined, 8);
    
    if (config.letAIChooseCharacters !== false) {
      // 让AI选择每格的角色
      console.log('[Comic] Letting AI choose characters for each panel...');
      
      const systemPrompt = buildMultiCharacterSystemPrompt(theme, { name: companyName, code: companyCode }, contentStyle);
      const userPrompt = buildMultiCharacterUserPrompt(
        theme,
        { name: companyName, code: companyCode, industry: report.industry, reportPeriod: report.reportPeriod },
        analysisDataJson,
        contentStyle
      );
      
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: SCRIPT_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 16384,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Comic] Multi-character script API error:', response.status, errorText);
          // 检查是否是配额不足错误
          const isQuotaError = errorText.includes('insufficient_quota') || errorText.includes('quota');
          const errorMessage = isQuotaError 
            ? 'API配额不足，请联系管理员充值后重试' 
            : '生成多角色脚本失败';
          await this.sendProgress(onProgress, 'failed', 0, errorMessage);
          return { success: false, error: errorMessage };
        }
        
        const result = await response.json() as { choices: Array<{ message: { content: string } }> };
        const content = result.choices[0]?.message?.content;
        
        if (!content) {
          await this.sendProgress(onProgress, 'failed', 0, '脚本内容为空');
          return { success: false, error: '脚本内容为空' };
        }
        
        // 解析JSON
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        
        try {
          script = JSON.parse(jsonStr.trim());
        } catch (parseError) {
          const fixedJson = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').trim();
          script = JSON.parse(fixedJson);
        }
        
        console.log(`[Comic] AI-generated script with ${script.panels?.length || 0} panels, characters: ${script.charactersUsed?.map((c: any) => c.displayName).join(', ')}`);
        
      } catch (error) {
        console.error('[Comic] Multi-character script generation error:', error);
        await this.sendProgress(onProgress, 'failed', 0, '生成多角色脚本异常');
        return { success: false, error: '生成多角色脚本异常' };
      }
    } else {
      // 使用预设角色分配，然后生成脚本
      console.log('[Comic] Using preset character assignment...');
      
      const characterAssignment = getPresetCharacterAssignment(themeId);
      
      // 构建带有预设角色的脚本（复用现有逻辑，但为每格指定角色）
      // 这里简化处理：使用默认主角生成脚本，然后替换角色信息
      const defaultCharacter = theme.characters.find(c => c.id === theme.defaultProtagonist) || theme.characters[0];
      
      // 转换为旧格式的IPCharacter
      const legacyCharacter = {
        id: defaultCharacter.id,
        name: defaultCharacter.name,
        displayName: defaultCharacter.displayName,
        description: defaultCharacter.description,
        personality: defaultCharacter.personality,
        visualStyle: defaultCharacter.visualStyle,
        colorPalette: defaultCharacter.colorPalette,
        catchphrase: defaultCharacter.catchphrase,
        source: theme.source,
        suitableFor: theme.suitableFor,
      };
      
      const baseScript = await this.generateEnhancedComicScript(report, 8, legacyCharacter as any, contentStyle);
      
      if (!baseScript) {
        await this.sendProgress(onProgress, 'failed', 0, '生成基础脚本失败');
        return { success: false, error: '生成基础脚本失败' };
      }
      
      // 将预设角色信息注入到每个面板
      script = {
        ...baseScript,
        themeId: theme.id,
        contentStyle,
        charactersUsed: [] as any[],
        panels: baseScript.panels.map((panel, index) => {
          const assignedChar = characterAssignment.get(index);
          if (!assignedChar) return panel;
          
          return {
            ...panel,
            panelType: PANEL_INDEX_TO_TYPE[index],
            character: {
              id: assignedChar.id,
              name: assignedChar.name,
              displayName: assignedChar.displayName,
              visualStyle: assignedChar.visualStyle,
              personality: assignedChar.personality,
              selectionReason: `预设分配: ${assignedChar.personalityType} 适合 ${PANEL_INDEX_TO_TYPE[index]}`,
            },
          };
        }),
      };
      
      // 收集使用的角色
      const usedChars = new Map<string, { id: string; name: string; displayName: string; panels: number[] }>();
      script.panels.forEach((panel: any, idx: number) => {
        if (panel.character) {
          const existing = usedChars.get(panel.character.id);
          if (existing) {
            existing.panels.push(idx + 1);
          } else {
            usedChars.set(panel.character.id, {
              id: panel.character.id,
              name: panel.character.name,
              displayName: panel.character.displayName,
              panels: [idx + 1],
            });
          }
        }
      });
      script.charactersUsed = Array.from(usedChars.values()).map(c => ({
        ...c,
        appearsInPanels: c.panels,
      }));
      
      console.log(`[Comic] Preset assignment script with ${script.panels.length} panels`);
    }
    
    // 提取所有使用的角色名
    const charactersUsed = script.charactersUsed?.map((c: any) => c.displayName || c.name) || [];
    const characterListStr = charactersUsed.length > 0 ? charactersUsed.join('、') : '多角色';
    
    await this.sendProgress(
      onProgress, 
      'script_done', 
      20, 
      `脚本完成！${charactersUsed.length}位角色准备就绪：${characterListStr}`, 
      undefined, 
      script.panels.length,
      {
        scriptSummary: {
          charactersUsed,
          totalPanels: script.panels.length,
          theme: theme.name,
        }
      }
    );
    
    // 生成图片
    const panels: ComicPanel[] = [];
    const batchSize = 4;
    
    for (let batchStart = 0; batchStart < script.panels.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, script.panels.length);
      const batchPanels = script.panels.slice(batchStart, batchEnd);
      const batchNumber = Math.floor(batchStart / batchSize) + 1;
      const batchStage = batchNumber === 1 ? 'images_batch_1' : 'images_batch_2' as ComicProgressStage;
      const batchStartPercent = 20 + (batchNumber - 1) * 35;
      
      await this.sendProgress(onProgress, batchStage, batchStartPercent, `正在绘制第${batchStart + 1}-${batchEnd}页...`, batchStart + 1, script.panels.length);
      console.log(`[Comic] Processing batch ${batchNumber}, panels ${batchStart + 1}-${batchEnd}...`);
      
      const batchPromises = batchPanels.map(async (panelScript: any, batchIndex: number) => {
        const globalIndex = batchStart + batchIndex;
        const panelCharacter = panelScript.character;
        
        console.log(`[Comic] Panel ${globalIndex + 1}: ${panelCharacter?.displayName || 'Unknown'} (${panelScript.sectionTitle})`);
        
        // 构建图片提示词 - 始终使用模块化构建以确保角色信息完整
        // 确保 panel.character 包含必要的字段
        if (!panelScript.character) {
          console.warn(`[Comic] Panel ${globalIndex + 1}: Missing character info, using theme default`);
          panelScript.character = {
            id: panelCharacter?.id || 'nezha',
            name: panelCharacter?.name || '哪吒',
            displayName: panelCharacter?.displayName || '小哪吒',
            visualStyle: '',
            personality: '',
            selectionReason: 'Default character',
          };
        }
        
        // 从主题中获取完整的角色视觉风格
        const fullCharacter = theme.characters.find(c => c.id === panelScript.character.id);
        if (fullCharacter && !panelScript.character.visualStyle) {
          panelScript.character.visualStyle = fullCharacter.visualStyle;
          panelScript.character.personality = fullCharacter.personality;
        }
        
        const imagePrompt = buildMultiCharacterImagePrompt(panelScript, theme, globalIndex, contentStyle);
        
        console.log(`[Comic] Panel ${globalIndex + 1}: Character ${panelScript.character.displayName} (${panelScript.character.id}), prompt length: ${imagePrompt.length}`);
        
        const imageUrl = await this.generateImageWithGemini(imagePrompt, globalIndex);
        
        // 更新面板进度，包含角色名和标题
        const panelPercent = batchStartPercent + ((batchIndex + 1) / batchSize) * 35;
        const panelTitle = panelScript.sectionTitle || panelScript.caption || `第${globalIndex + 1}页`;
        const charName = panelCharacter?.displayName || '角色';
        await this.sendProgress(
          onProgress, 
          batchStage, 
          Math.min(panelPercent, 90), 
          `${charName}正在演绎：${panelTitle}`, 
          globalIndex + 1, 
          script.panels.length,
          {
            characterName: charName,
            panelTitle,
          }
        );
        
        return {
          imageUrl: imageUrl || '',
          caption: panelScript.caption,
          dialogue: panelScript.dialogue,
          scene: panelScript.scene,
          visualMetaphor: panelScript.visualMetaphor,
          mood: panelScript.mood,
          order: globalIndex + 1,
          sectionTitle: panelScript.sectionTitle,
          subPanels: panelScript.subPanels,
          // 新增：记录使用的角色
          characterId: panelCharacter?.id,
          characterName: panelCharacter?.displayName,
        } as ComicPanel & { sectionTitle: string; subPanels: unknown[]; characterId: string; characterName: string };
      });
      
      const batchResults = await Promise.all(batchPromises);
      panels.push(...batchResults);
      
      if (batchEnd < script.panels.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    await this.sendProgress(onProgress, 'finalizing', 92, '正在整理漫画数据...');
    panels.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const comicData: ComicData = {
      title: script.title,
      panels,
      summary: script.investmentMessage || '',
      style: 'multi-character' as any,
      mainCharacter: theme.name,
      financialHighlights: script.financialHighlights,
      // 扩展字段
      themeId: theme.id,
      themeName: theme.name,
      charactersUsed: script.charactersUsed,
    } as any;
    
    let scrollHtml: string | undefined;
    if (config.outputFormat === 'vertical-scroll') {
      scrollHtml = this.generateScrollComicHtml(comicData, companyName);
    }
    
    await this.sendProgress(onProgress, 'completed', 100, '漫画生成完成！', script.panels.length, script.panels.length);
    console.log(`[Comic] Multi-character generation complete! ${panels.length} panels with ${script.charactersUsed?.length || 0} unique characters.`);
    
    return {
      success: true,
      comic: comicData,
      script,
      scrollHtml,
    };
  }
}

export function createComicService(apiKey: string): ComicService {
  return new ComicService(apiKey);
}
