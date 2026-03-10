// 报告相关 API 路由 - PDF 导出和漫画生成
// 支持IP角色系统和长图文输出格式

import { Hono } from 'hono';
import { createReportsService } from '../services/reports';
import { createComicService, type ComicGenerationConfig, ComicService, type ComicProgress, type ProgressCallback } from '../services/comic';
import { generatePrintableReport, type PDFReportOptions, shouldAddWatermark, getWatermarkText } from '../services/pdf';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { createAuthService } from '../services/auth';
import { createUserService, type MembershipTier } from '../services/user';
import type { Bindings, AnalysisReport } from '../types';

const reports = new Hono<{ Bindings: Bindings }>();

// ============ 漫画生成进度 API ============
reports.get('/:id/comic/progress', async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 从 KV 获取进度数据
    const progressKey = `comic:progress:${reportId}`;
    const progressData = await c.env.CACHE.get(progressKey);
    
    if (!progressData) {
      // 没有进度数据，可能还没开始或已完成
      return c.json({
        success: true,
        progress: null,
        message: '没有进行中的漫画生成任务',
      });
    }
    
    const progress: ComicProgress = JSON.parse(progressData);
    
    return c.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error('Get comic progress error:', error);
    return c.json({ success: false, error: '获取进度失败' }, 500);
  }
});

// ============ 获取报告列表 (需认证) ============
reports.get('/my', authMiddleware(), async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const list = await reportsService.getUserReports(userId, limit, offset);
    const total = await reportsService.getUserReportCount(userId);
    
    return c.json({
      success: true,
      data: list,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get my reports error:', error);
    return c.json({ success: false, error: '获取报告列表失败' }, 500);
  }
});

// ============ 获取可对比的历史报告列表 ============
reports.get('/:id/compare-options', async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    
    // 获取当前报告信息
    const currentReport = await reportsService.getReport(reportId);
    if (!currentReport) {
      return c.json({ success: false, error: '报告不存在' }, 404);
    }
    
    // 获取同公司的其他报告
    const compareOptions = await reportsService.getCompanyReports(
      currentReport.company_code, 
      reportId, // 排除当前报告
      10
    );
    
    return c.json({
      success: true,
      currentReport: {
        id: currentReport.id,
        company_code: currentReport.company_code,
        company_name: currentReport.company_name,
        created_at: currentReport.created_at
      },
      compareOptions
    });
  } catch (error) {
    console.error('Get compare options error:', error);
    return c.json({ success: false, error: '获取对比选项失败' }, 500);
  }
});

// ============ 对比两份报告 ============
reports.get('/:id/compare', async (c) => {
  try {
    const baseReportId = parseInt(c.req.param('id'));
    const compareWithId = parseInt(c.req.query('compareWith') || '0');
    
    if (isNaN(baseReportId) || isNaN(compareWithId) || compareWithId === 0) {
      return c.json({ success: false, error: '无效的报告ID参数' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    
    // 执行对比
    const comparison = await reportsService.compareReports(baseReportId, compareWithId);
    
    if (!comparison) {
      return c.json({ success: false, error: '无法获取报告数据进行对比' }, 404);
    }
    
    return c.json({
      success: true,
      comparison
    });
  } catch (error) {
    console.error('Compare reports error:', error);
    return c.json({ success: false, error: '报告对比失败' }, 500);
  }
});

// ============ 获取最近公开报告 ============
reports.get('/recent', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const code = c.req.query('code'); // 支持按股票代码过滤
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    
    // 如果指定了股票代码，按代码查询
    if (code) {
      const list = await c.env.DB.prepare(
        `SELECT id, company_code, company_name, report_type, status, created_at 
         FROM analysis_reports 
         WHERE company_code = ? AND status = 'completed'
         ORDER BY created_at DESC 
         LIMIT ?`
      ).bind(code, limit).all();
      
      return c.json({
        success: true,
        data: list.results || [],
      });
    }
    
    // 否则获取所有最近报告
    const list = await reportsService.getRecentPublicReports(limit);
    
    return c.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error('Get recent reports error:', error);
    return c.json({ success: false, error: '获取最近报告失败' }, 500);
  }
});

// ============ 获取报告详情 ============
reports.get('/:id', optionalAuthMiddleware(), async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const report = await reportsService.getReport(reportId);
    
    if (!report) {
      return c.json({ success: false, error: '报告不存在' }, 404);
    }
    
    // 获取完整结果
    const result = await reportsService.getReportResult(reportId);
    const progress = await reportsService.getProgress(reportId);
    
    return c.json({
      success: true,
      report: {
        id: report.id,
        companyCode: report.company_code,
        companyName: report.company_name,
        reportType: report.report_type,
        reportPeriod: report.report_period,
        status: report.status,
        comicStatus: report.comic_status,
        comicId: report.comic_id,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
        result,
        progress,
      },
    });
  } catch (error) {
    console.error('Get report error:', error);
    return c.json({ success: false, error: '获取报告失败' }, 500);
  }
});

// ============ 删除报告 (需认证) ============
reports.delete('/:id', authMiddleware(), async (c) => {
  try {
    const userId = c.get('userId');
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const deleted = await reportsService.deleteReport(reportId, userId);
    
    if (!deleted) {
      return c.json({ success: false, error: '删除报告失败或无权限' }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete report error:', error);
    return c.json({ success: false, error: '删除报告失败' }, 500);
  }
});

// ============ 导出 PDF 报告 ============
reports.get('/:id/pdf', async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    // 支持通过 query 参数选择是否包含漫画
    const includeComic = c.req.query('comic') === 'true';
    // 获取 token 参数用于识别用户等级
    const token = c.req.query('token');
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 识别用户等级，用于决定是否添加水印
    let userTier: MembershipTier = 'guest';
    if (token) {
      try {
        const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-me';
        const authService = createAuthService(c.env.DB, jwtSecret);
        const userService = createUserService(c.env.DB, c.env.CACHE);
        
        const validation = await authService.validateToken(token);
        if (validation.valid && validation.payload) {
          const user = await userService.getUserById(validation.payload.sub);
          if (user) {
            userTier = user.membership_tier || 'free';
          }
        }
      } catch (e) {
        console.warn('[PDF] Failed to validate token:', e);
      }
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const report = await reportsService.getReport(reportId);
    
    if (!report) {
      return c.json({ success: false, error: '报告不存在' }, 404);
    }
    
    if (report.status !== 'completed') {
      return c.json({ success: false, error: '报告尚未完成' }, 400);
    }
    
    const result = await reportsService.getReportResult(reportId);
    
    if (!result) {
      return c.json({ success: false, error: '无法获取报告结果' }, 500);
    }
    
    // 如果需要包含漫画，获取漫画数据
    let comicData = undefined;
    if (includeComic && report.comic_status === 'completed' && report.comic_id) {
      const comic = await c.env.DB.prepare(
        'SELECT * FROM comic_reports WHERE id = ?'
      ).bind(report.comic_id).first();
      
      if (comic) {
        const panels = comic.panels_json ? JSON.parse(comic.panels_json as string) : [];
        
        // 从KV恢复图片数据
        const panelsWithImages = await Promise.all(
          panels.map(async (panel: { imageUrl?: string; [key: string]: unknown }) => {
            if (panel.imageUrl && panel.imageUrl.startsWith('kv:')) {
              const imageKey = panel.imageUrl.replace('kv:', '');
              try {
                const imageData = await c.env.CACHE.get(imageKey);
                if (imageData) {
                  return { ...panel, imageUrl: imageData };
                }
              } catch (e) {
                console.error(`[PDF] Failed to restore image from KV:`, e);
              }
            }
            return panel;
          })
        );
        
        comicData = {
          summary: comic.summary as string,
          style: comic.style as 'business' | 'modern' | 'classic' | 'minimal',
          panels: panelsWithImages,
        };
      }
    }
    
    // 生成可打印的 HTML（根据用户等级添加水印）
    const needWatermark = shouldAddWatermark(userTier);
    const watermarkText = getWatermarkText(userTier);
    
    const options: PDFReportOptions = {
      companyName: report.company_name,
      companyCode: report.company_code,
      reportDate: new Date(report.created_at).toLocaleDateString('zh-CN'),
      reportPeriod: report.report_period,
      includeCharts: true,
      includeComic: includeComic && !!comicData,
      comicData: comicData,
      addWatermark: needWatermark,
      watermarkText: watermarkText,
      userTier: userTier,
    };
    
    const html = generatePrintableReport(result as Partial<AnalysisReport>, options);
    
    return c.html(html);
  } catch (error) {
    console.error('Export PDF error:', error);
    return c.json({ success: false, error: '导出报告失败' }, 500);
  }
});

// ============ 生成漫画（支持IP角色、长图文和内容风格）============
reports.post('/:id/comic', optionalAuthMiddleware(), async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    const userId = c.get('userId');
    
    // 支持完整的漫画生成配置参数
    const body = await c.req.json<{
      style?: 'business' | 'modern' | 'classic' | 'nezha' | 'custom';
      panelCount?: number;
      // IP角色系统参数（旧版，保留兼容）
      characterSetId?: string;       // 角色集ID（默认：nezha-movie）
      mainCharacterId?: string;      // 主角ID（默认：nezha）
      // 新版多角色主题系统
      themeId?: string;              // 主题ID（新版，如：nezha-universe, zootopia, disney-princess）
      useMultiCharacter?: boolean;   // 是否使用多角色模式（每格不同角色）
      letAIChooseCharacters?: boolean; // true: AI智能选择角色, false: 预设分配
      // 输出格式
      outputFormat?: 'grid' | 'vertical-scroll';  // 网格/长图滚动
      // 内容风格（新增）
      contentStyle?: 'structured' | 'creative' | 'academic' | 'story' | 'dashboard';
      // 强制重新生成
      forceRegenerate?: boolean;
    }>();
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE || !c.env.VECTORENGINE_API_KEY) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const report = await reportsService.getReport(reportId);
    
    if (!report) {
      return c.json({ success: false, error: '报告不存在' }, 404);
    }
    
    if (report.status !== 'completed') {
      return c.json({ success: false, error: '报告尚未完成，无法生成漫画' }, 400);
    }
    
    // 检查是否已有漫画（除非强制重新生成或主题/角色/风格变更）
    // 计算请求的 characterSetId、mainCharacterId 和 contentStyle（与后端缓存key保持一致）
    const useMultiCharacter = body.useMultiCharacter === true || body.themeId !== undefined;
    const requestedCharacterSetId = useMultiCharacter ? (body.themeId || 'nezha-universe') : (body.characterSetId || 'nezha-movie');
    const requestedMainCharacterId = useMultiCharacter ? 'multi' : (body.mainCharacterId || 'nezha');
    const requestedContentStyle = body.contentStyle || 'creative';
    
    if (!body.forceRegenerate && report.comic_status === 'completed' && report.comic_id) {
      // 返回现有漫画（但需要检查角色/主题/风格是否匹配）
      const existingComic = await c.env.DB.prepare(
        'SELECT * FROM comic_reports WHERE id = ?'
      ).bind(report.comic_id).first();
      
      if (existingComic) {
        // 检查主题/角色/内容风格是否变更
        const storedCharacterSetId = existingComic.character_set_id || 'nezha-movie';
        const storedMainCharacterId = existingComic.main_character_id || 'nezha';
        const storedContentStyle = (existingComic as any).content_style || 'creative';
        
        const characterChanged = storedCharacterSetId !== requestedCharacterSetId || 
                                storedMainCharacterId !== requestedMainCharacterId;
        const styleChanged = storedContentStyle !== requestedContentStyle;
        
        if (characterChanged || styleChanged) {
          // 主题/角色/风格变更，需要重新生成
          console.log(`[Comic POST] Config changed:`);
          console.log(`  - Character: ${storedCharacterSetId}/${storedMainCharacterId} -> ${requestedCharacterSetId}/${requestedMainCharacterId} (changed: ${characterChanged})`);
          console.log(`  - Style: ${storedContentStyle} -> ${requestedContentStyle} (changed: ${styleChanged})`);
          console.log(`[Comic POST] Will NOT return cache, proceeding to generate new comic...`);
          // 不返回缓存，继续执行下面的生成逻辑
        } else {
          // 主题/角色未变更，返回缓存
          // 从KV恢复图片数据
          const panels = existingComic.panels_json ? JSON.parse(existingComic.panels_json as string) : [];
          const panelsWithImages = await Promise.all(
            panels.map(async (panel: { imageUrl?: string; [key: string]: unknown }) => {
              if (panel.imageUrl && panel.imageUrl.startsWith('kv:')) {
                const imageKey = panel.imageUrl.replace('kv:', '');
                try {
                  const imageData = await c.env.CACHE.get(imageKey);
                  if (imageData) {
                    return { ...panel, imageUrl: imageData };
                  }
                } catch (e) {
                  console.error(`[Comic] Failed to restore image from KV:`, e);
                }
              }
              return panel;
            })
          );
          
          return c.json({
            success: true,
            comic: {
              id: existingComic.id,
              style: existingComic.style,
              summary: existingComic.summary,
              panels: panelsWithImages,
              status: existingComic.status,
              characterSetId: existingComic.character_set_id,
              mainCharacterId: existingComic.main_character_id,
            },
            cached: true,
          });
        }
      }
    }
    
    // 更新漫画生成状态
    await reportsService.updateComicStatus(reportId, 'generating');
    
    // 获取报告结果
    const result = await reportsService.getReportResult(reportId);
    
    if (!result) {
      await reportsService.updateComicStatus(reportId, 'failed');
      return c.json({ success: false, error: '无法获取报告结果' }, 500);
    }
    
    // 构建完整的漫画生成配置
    const comicService = createComicService(c.env.VECTORENGINE_API_KEY);
    const reportData = { ...result, companyName: report.company_name } as Partial<AnalysisReport>;
    
    // 创建进度回调函数 - 将进度存储到 KV
    const progressKey = `comic:progress:${reportId}`;
    const onProgress: ProgressCallback = async (progress: ComicProgress) => {
      try {
        // 存储进度到 KV（5分钟过期）
        await c.env.CACHE.put(progressKey, JSON.stringify(progress), { expirationTtl: 300 });
        console.log(`[Comic Progress] ${reportId}: ${progress.stage} - ${progress.percent}% - ${progress.message}`);
      } catch (e) {
        console.error('[Comic Progress] Failed to store progress:', e);
      }
    };
    
    // 配置对象 - 支持IP角色和输出格式
    const config: Partial<ComicGenerationConfig> = {
      apiKey: c.env.VECTORENGINE_API_KEY,
      onProgress, // 添加进度回调
    };
    
    // 样式
    if (body.style) config.style = body.style;
    
    // 面板数量
    if (body.panelCount) {
      config.minPanels = body.panelCount;
      config.maxPanels = body.panelCount;
    }
    
    // IP角色配置（默认使用哪吒）
    config.characterSetId = body.characterSetId || 'nezha-movie';
    config.mainCharacterId = body.mainCharacterId || 'nezha';
    
    // 输出格式
    config.outputFormat = body.outputFormat || 'grid';
    
    // 内容风格（默认使用自由创意）
    config.contentStyle = body.contentStyle || 'creative';
    
    // 新版多角色主题配置（useMultiCharacter 和 themeId 已在上面定义）
    const themeId = body.themeId || 'nezha-universe';
    const letAIChooseCharacters = body.letAIChooseCharacters !== false; // 默认让AI选择
    
    // 高质量模式选择
    const useNanoBanana = (body as { useNanoBanana?: boolean }).useNanoBanana === true;
    const usePromptBuilder = body.usePromptBuilder === true;
    
    console.log(`[Comic API] Generating comic for ${report.company_name}`);
    console.log(`[Comic API] Config: characterSet=${config.characterSetId}, character=${config.mainCharacterId}, format=${config.outputFormat}, contentStyle=${config.contentStyle}`);
    console.log(`[Comic API] Request body:`, JSON.stringify({ themeId: body.themeId, useMultiCharacter: body.useMultiCharacter, characterSetId: body.characterSetId, forceRegenerate: body.forceRegenerate }));
    console.log(`[Comic API] Mode: multiCharacter=${useMultiCharacter}, themeId=${themeId}, aiChoose=${letAIChooseCharacters}, nanoBanana=${useNanoBanana}, promptBuilder=${usePromptBuilder}`);
    console.log(`[Comic API] IMPORTANT: About to call generation with themeId='${themeId}' and useMultiCharacter=${useMultiCharacter}`);
    
    // 根据模式选择生成方法
    // 优先级：多角色主题 > PromptBuilder > NanoBanana > 默认
    let comicResult;
    if (useMultiCharacter) {
      // 使用新的多角色主题系统
      comicResult = await comicService.generateMultiCharacterComic(reportData, { 
        ...config, 
        themeId,
        useMultiCharacter: true,
        letAIChooseCharacters,
      });
    } else if (usePromptBuilder) {
      comicResult = await comicService.generateComicWithPromptBuilder(reportData, { ...config, usePromptBuilder: true } as ComicGenerationConfig & { usePromptBuilder?: boolean });
    } else if (useNanoBanana) {
      comicResult = await comicService.generateComicWithNanoBanana(reportData, { ...config, useNanoBanana: true } as ComicGenerationConfig & { useNanoBanana?: boolean });
    } else {
      comicResult = await comicService.generateComic(reportData, config);
    }
    
    if (!comicResult.success || !comicResult.comic) {
      await reportsService.updateComicStatus(reportId, 'failed');
      return c.json({ success: false, error: comicResult.error || '漫画生成失败' }, 500);
    }
    
    // 处理面板数据：将Base64图片存储到KV，数据库只存储引用
    // 这样避免 D1 的 SQLITE_TOOBIG 错误
    const processedPanels = await Promise.all(
      comicResult.comic.panels.map(async (panel, index) => {
        const imageUrl = panel.imageUrl;
        
        // 如果是Base64数据，存储到KV
        if (imageUrl && imageUrl.startsWith('data:image/')) {
          const imageKey = `comic:${reportId}:panel:${index}`;
          try {
            // 存储Base64图片到KV（7天过期）
            await c.env.CACHE.put(imageKey, imageUrl, { expirationTtl: 604800 });
            console.log(`[Comic] Stored panel ${index} image to KV: ${imageKey}`);
            
            // 返回KV引用而不是完整Base64
            return {
              ...panel,
              imageUrl: `kv:${imageKey}`,
              imageBase64Stored: true, // 标记图片已存储到KV
            };
          } catch (kvError) {
            console.error(`[Comic] Failed to store panel ${index} to KV:`, kvError);
            // KV存储失败时，截断Base64数据并使用占位符
            return {
              ...panel,
              imageUrl: `https://via.placeholder.com/512x512/1a1a2e/d4af37?text=Panel+${index + 1}`,
              imageStorageError: true,
            };
          }
        }
        
        return panel;
      })
    );
    
    // 保存漫画到数据库（不含Base64数据，包含IP角色/主题/风格信息）
    // 对于多角色模式，character_set_id 存储 themeId
    const characterSetIdToSave = useMultiCharacter ? themeId : (config.characterSetId || 'nezha-movie');
    const mainCharacterIdToSave = useMultiCharacter ? 'multi' : (config.mainCharacterId || 'nezha');
    const styleToSave = useMultiCharacter ? 'multi-character' : (comicResult.comic.style || 'modern');
    const contentStyleToSave = config.contentStyle || 'creative';
    
    const comicInsertResult = await c.env.DB.prepare(`
      INSERT INTO comic_reports (report_id, user_id, company_code, company_name, style, summary, panels_json, status, character_set_id, main_character_id, output_format, content_style)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
    `).bind(
      reportId,
      userId || null,
      report.company_code,
      report.company_name,
      styleToSave,
      comicResult.comic.summary || '',
      JSON.stringify(processedPanels),
      characterSetIdToSave,
      mainCharacterIdToSave,
      config.outputFormat || 'grid',
      contentStyleToSave
    ).run();
    
    const comicId = comicInsertResult.meta.last_row_id as number;
    
    // 更新报告的漫画状态
    await reportsService.updateComicStatus(reportId, 'completed', comicId);
    
    // 清除进度数据（漫画已生成完成）
    try {
      await c.env.CACHE.delete(progressKey);
    } catch (e) {
      // 忽略清除失败
    }
    
    // 返回图片 URL 而非 Base64 数据（优化传输大小）
    // 添加时间戳参数以破坏浏览器缓存（每次生成新漫画时图片URL都不同）
    const cacheVersion = Date.now();
    const panelsWithImages = processedPanels.map((panel, index) => {
      if (panel.imageUrl && panel.imageUrl.startsWith('kv:')) {
        // 图片已存储到 KV，返回带时间戳的 URL 以破坏浏览器缓存
        return { 
          ...panel, 
          imageUrl: `/api/images/comic/${reportId}/${index}?v=${cacheVersion}`,
        };
      }
      return panel;
    });
    
    // 统计失败面板信息
    const failedPanels = panelsWithImages.filter(p => 
      p.imageUrl && (p.imageUrl.startsWith('placeholder://error/') || p.imageUrl.includes('placeholder.com'))
    );
    const failedPanelIndices = failedPanels.map((_, idx) => {
      const panel = panelsWithImages.find(p => p === _);
      return panelsWithImages.indexOf(panel!);
    });
    
    // 解析失败原因
    const failureDetails = failedPanels.map(panel => {
      if (panel.imageUrl && panel.imageUrl.startsWith('placeholder://error/')) {
        const errorInfo = ComicService.parseErrorImage(panel.imageUrl);
        return errorInfo ? {
          panelIndex: errorInfo.panelIndex,
          errorType: errorInfo.errorType,
          friendlyMessage: ComicService.getFriendlyErrorMessage(errorInfo.errorType as 'api_error' | 'safety_filter' | 'no_image' | 'timeout' | 'quota_exceeded' | 'unknown'),
        } : null;
      }
      return null;
    }).filter(Boolean);
    
    // 构建响应数据
    const responseData: {
      success: boolean;
      comic: {
        id: number;
        style: string;
        summary: string;
        panels: typeof panelsWithImages;
        status: string;
        characterSetId: string;
        mainCharacterId: string;
        mainCharacter?: { name: string; description: string; personality: string };
        isMultiCharacter?: boolean;
        themeId?: string;
        charactersUsed?: Array<{ id: string; name: string; displayName: string }>;
      };
      scrollHtml?: string;
      generationStats?: {
        totalPanels: number;
        successPanels: number;
        failedPanels: number;
        failureDetails: typeof failureDetails;
      };
    } = {
      success: true,
      comic: {
        id: comicId,
        style: comicResult.comic.style || 'modern',
        summary: comicResult.comic.summary || '',
        panels: panelsWithImages,
        status: 'completed',
        // 多角色模式使用 themeId，单角色模式使用 characterSetId
        characterSetId: useMultiCharacter ? themeId : (config.characterSetId || 'nezha-movie'),
        mainCharacterId: useMultiCharacter ? 'multi' : (config.mainCharacterId || 'nezha'),
        mainCharacter: comicResult.comic.mainCharacter,
        // 新增：多角色模式标识和信息
        isMultiCharacter: useMultiCharacter,
        themeId: useMultiCharacter ? themeId : undefined,
        charactersUsed: (comicResult as any).script?.charactersUsed,
      },
      generationStats: {
        totalPanels: panelsWithImages.length,
        successPanels: panelsWithImages.length - failedPanels.length,
        failedPanels: failedPanels.length,
        failureDetails,
      },
    };
    
    // 如果请求长图文格式，返回HTML
    if (config.outputFormat === 'vertical-scroll' && comicResult.scrollHtml) {
      responseData.scrollHtml = comicResult.scrollHtml;
    }
    
    return c.json(responseData);
  } catch (error) {
    console.error('Generate comic error:', error);
    return c.json({ success: false, error: '生成漫画失败' }, 500);
  }
});

// ============ 获取漫画（支持 IP 角色/内容风格检测和过期自动重新生成）============
reports.get('/:id/comic', async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    // 从 query 参数获取请求的 IP 角色和内容风格信息
    const requestedCharacterSetId = c.req.query('characterSetId') || 'nezha-movie';
    const requestedMainCharacterId = c.req.query('mainCharacterId') || 'nezha';
    const requestedContentStyle = c.req.query('contentStyle') || 'creative';
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const comic = await c.env.DB.prepare(
      'SELECT * FROM comic_reports WHERE report_id = ? ORDER BY id DESC LIMIT 1'
    ).bind(reportId).first();
    
    if (!comic) {
      return c.json({ success: false, error: '漫画不存在', needGenerate: true }, 404);
    }
    
    // 检查 IP 角色和内容风格是否变化
    const storedCharacterSetId = comic.character_set_id || 'nezha-movie';
    const storedMainCharacterId = comic.main_character_id || 'nezha';
    const storedContentStyle = (comic as any).content_style || 'creative';
    
    const characterChanged = storedCharacterSetId !== requestedCharacterSetId || 
                            storedMainCharacterId !== requestedMainCharacterId;
    const styleChanged = storedContentStyle !== requestedContentStyle;
    
    if (characterChanged || styleChanged) {
      console.log(`[Comic GET] Config changed:`);
      console.log(`  - Character: ${storedCharacterSetId}/${storedMainCharacterId} -> ${requestedCharacterSetId}/${requestedMainCharacterId} (changed: ${characterChanged})`);
      console.log(`  - Style: ${storedContentStyle} -> ${requestedContentStyle} (changed: ${styleChanged})`);
      return c.json({ 
        success: false, 
        error: '漫画配置已变更，需要重新生成', 
        needRegenerate: true,
        reason: characterChanged ? 'character_changed' : 'style_changed',
        currentCharacter: { setId: storedCharacterSetId, characterId: storedMainCharacterId },
        requestedCharacter: { setId: requestedCharacterSetId, characterId: requestedMainCharacterId },
        currentStyle: storedContentStyle,
        requestedStyle: requestedContentStyle,
      }, 200); // 返回 200 让前端知道是正常的"需要重新生成"状态
    }
    
    // 解析面板数据 - 处理对象格式和数组格式
    let panels: Array<{ imageUrl?: string; order?: number; [key: string]: unknown }> = [];
    if (comic.panels_json) {
      const parsed = JSON.parse(comic.panels_json as string);
      // 如果是对象格式 {"0": {...}, "1": {...}}，转换为数组
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        panels = Object.values(parsed);
        // 按 order 字段排序
        panels.sort((a, b) => (a.order || 0) - (b.order || 0));
      } else if (Array.isArray(parsed)) {
        panels = parsed;
      }
    }
    
    // 检查图片是否过期，并生成图片 URL（不再返回 Base64）
    let hasExpiredImages = false;
    console.log(`[Comic GET] Processing ${panels.length} panels for report ${reportId}`);
    const panelsWithImages = await Promise.all(
      panels.map(async (panel: { imageUrl?: string; [key: string]: unknown }, index: number) => {
        console.log(`[Comic GET] Panel ${index} imageUrl prefix: ${panel.imageUrl?.substring(0, 30)}`);
        if (panel.imageUrl && panel.imageUrl.startsWith('kv:')) {
          const imageKey = panel.imageUrl.replace('kv:', '');
          try {
            // 只检查图片是否存在（使用 list 检查，避免读取完整数据）
            const imageData = await c.env.CACHE.get(imageKey, { type: 'text' });
            if (imageData) {
              // 返回图片 URL 而非 Base64 数据，添加漫画ID作为版本号以破坏缓存
              const cacheVersion = comic.id || Date.now();
              console.log(`[Comic GET] Panel ${index} returning URL: /api/images/comic/${reportId}/${index}?v=${cacheVersion}`);
              return { 
                ...panel, 
                imageUrl: `/api/images/comic/${reportId}/${index}?v=${cacheVersion}`,
              };
            }
            // KV中图片已过期
            console.log(`[Comic] Image expired in KV: ${imageKey}`);
            hasExpiredImages = true;
            return { 
              ...panel, 
              imageUrl: `https://via.placeholder.com/512x512/1a1a2e/d4af37?text=Image+Expired`,
              imageExpired: true,
            };
          } catch (e) {
            console.error(`[Comic] Failed to check image in KV:`, e);
            hasExpiredImages = true;
          }
        } else if (panel.imageUrl && panel.imageUrl.startsWith('data:image/')) {
          // 如果是直接存储的 Base64 数据（旧数据兼容），也返回 URL
          // 先存储到 KV
          const imageKey = `comic:${reportId}:panel:${index}`;
          try {
            await c.env.CACHE.put(imageKey, panel.imageUrl, { expirationTtl: 604800 });
            const cacheVersion = comic.id || Date.now();
            return { 
              ...panel, 
              imageUrl: `/api/images/comic/${reportId}/${index}?v=${cacheVersion}`,
            };
          } catch (e) {
            console.error(`[Comic] Failed to migrate Base64 to KV:`, e);
            // 如果存储失败，仍然返回原始 Base64（降级处理）
            return panel;
          }
        }
        return panel;
      })
    );
    
    // 判断是否为多角色漫画
    const isMultiCharacter = storedMainCharacterId === 'multi';
    
    // 从 panels 中提取使用的角色（多角色模式下）
    let charactersUsed: Array<{ id: string; name: string; displayName: string }> | undefined = undefined;
    if (isMultiCharacter && panelsWithImages.length > 0) {
      const charMap = new Map<string, { id: string; name: string; displayName: string }>();
      panelsWithImages.forEach((p: any) => {
        if (p.characterId && p.characterName) {
          charMap.set(p.characterId, { 
            id: p.characterId, 
            name: p.characterName, 
            displayName: p.characterName 
          });
        }
      });
      if (charMap.size > 0) {
        charactersUsed = Array.from(charMap.values());
      }
    }
    
    // 如果有过期图片，返回需要重新生成的标志
    if (hasExpiredImages) {
      console.log(`[Comic] Report ${reportId} has expired images, need regenerate`);
      return c.json({ 
        success: false, 
        error: '漫画图片已过期，需要重新生成', 
        needRegenerate: true,
        reason: 'images_expired',
        comic: {
          id: comic.id,
          style: comic.style,
          summary: comic.summary,
          panels: panelsWithImages,
          status: 'expired',
          characterSetId: storedCharacterSetId,
          mainCharacterId: storedMainCharacterId,
          createdAt: comic.created_at,
          // 新增多角色字段
          isMultiCharacter,
          themeId: isMultiCharacter ? storedCharacterSetId : undefined,
          charactersUsed,
        },
      }, 200);
    }
    
    return c.json({
      success: true,
      comic: {
        id: comic.id,
        style: comic.style,
        summary: comic.summary,
        panels: panelsWithImages,
        status: comic.status,
        characterSetId: storedCharacterSetId,
        mainCharacterId: storedMainCharacterId,
        createdAt: comic.created_at,
        // 新增多角色字段
        isMultiCharacter,
        themeId: isMultiCharacter ? storedCharacterSetId : undefined,
        charactersUsed,
      },
    });
  } catch (error) {
    console.error('Get comic error:', error);
    return c.json({ success: false, error: '获取漫画失败' }, 500);
  }
});

// ============ 生成漫画文字版（备选方案）============
reports.post('/:id/comic-text', async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE || !c.env.VECTORENGINE_API_KEY) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const report = await reportsService.getReport(reportId);
    
    if (!report) {
      return c.json({ success: false, error: '报告不存在' }, 404);
    }
    
    if (report.status !== 'completed') {
      return c.json({ success: false, error: '报告尚未完成' }, 400);
    }
    
    const result = await reportsService.getReportResult(reportId);
    
    if (!result) {
      return c.json({ success: false, error: '无法获取报告结果' }, 500);
    }
    
    const comicService = createComicService(c.env.VECTORENGINE_API_KEY);
    const comicText = await comicService.generateComicText(
      { ...result, companyName: report.company_name } as Partial<AnalysisReport>
    );
    
    return c.json({
      success: true,
      comicText,
    });
  } catch (error) {
    console.error('Generate comic text error:', error);
    return c.json({ success: false, error: '生成漫画文字失败' }, 500);
  }
});

// ============ 分享功能 API ============

// 生成短链接码
function generateShareCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 创建分享链接
reports.post('/:id/share', optionalAuthMiddleware(), async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const { expiresInDays = 7 } = await c.req.json().catch(() => ({}));
    
    const reportsService = createReportsService(c.env.DB, c.env.CACHE);
    const report = await reportsService.getReport(reportId);
    
    if (!report) {
      return c.json({ success: false, error: '报告不存在' }, 404);
    }
    
    if (report.status !== 'completed') {
      return c.json({ success: false, error: '只能分享已完成的报告' }, 400);
    }
    
    // 生成唯一的分享码
    let shareCode = generateShareCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM share_links WHERE share_code = ?'
      ).bind(shareCode).first();
      
      if (!existing) break;
      shareCode = generateShareCode();
      attempts++;
    }
    
    // 计算过期时间
    const expiresAt = expiresInDays > 0 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    
    // 获取用户ID (如果已登录)
    const user = c.get('user' as any);
    const userId = user?.id || null;
    
    // 创建分享链接
    await c.env.DB.prepare(`
      INSERT INTO share_links (report_id, share_code, created_by, expires_at, settings_json)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      reportId, 
      shareCode, 
      userId,
      expiresAt,
      JSON.stringify({ includeComic: true, showScore: true })
    ).run();
    
    // 获取基础URL
    const baseUrl = new URL(c.req.url).origin;
    const shareUrl = `${baseUrl}/share/${shareCode}`;
    
    return c.json({
      success: true,
      shareCode,
      shareUrl,
      expiresAt,
      report: {
        id: report.id,
        companyName: report.company_name,
        companyCode: report.company_code
      }
    });
  } catch (error) {
    console.error('Create share link error:', error);
    return c.json({ success: false, error: '创建分享链接失败' }, 500);
  }
});

// 获取分享链接信息
reports.get('/:id/share', async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 获取该报告的所有有效分享链接
    const links = await c.env.DB.prepare(`
      SELECT share_code, created_at, expires_at, view_count, is_active
      FROM share_links 
      WHERE report_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(reportId).all();
    
    const baseUrl = new URL(c.req.url).origin;
    
    return c.json({
      success: true,
      links: (links.results || []).map((link: any) => ({
        ...link,
        shareUrl: `${baseUrl}/share/${link.share_code}`,
        isExpired: link.expires_at && new Date(link.expires_at) < new Date()
      }))
    });
  } catch (error) {
    console.error('Get share links error:', error);
    return c.json({ success: false, error: '获取分享链接失败' }, 500);
  }
});

export default reports;
