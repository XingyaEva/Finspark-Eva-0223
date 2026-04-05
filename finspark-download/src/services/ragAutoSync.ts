/**
 * RAG 财报自动同步服务 — services/ragAutoSync.ts
 *
 * 核心功能：
 * 1. 当用户查询某只股票时，自动检查 RAG 知识库是否已有该股票的财报
 * 2. 如果没有，异步触发：巨潮搜索 → PDF 下载 → MinerU 解析 → RAG 入库
 * 3. 通过 rag_sync_tasks 表追踪同步状态，避免重复同步
 * 4. 提供同步状态查询 API，前端可展示同步进度
 *
 * 同步策略：
 * - 首次查询：如果没有任何该股票的文档，触发异步同步最新年报/半年报
 * - 缓存命中：如果已有文档，直接使用
 * - 同步中：如果正在同步，返回提示"财报正在同步中"
 * - 失败重试：失败的任务可以手动/自动重试
 */

import type { CninfoReportMeta } from './ragCninfo';

// ==================== 类型 ====================

export interface SyncTask {
  id?: number;
  stockCode: string;
  stockName?: string;
  reportType: 'annual' | 'semi_annual' | 'q1' | 'q3';
  reportYear: number;
  status: 'pending' | 'searching' | 'downloading' | 'parsing' | 'ingesting' | 'completed' | 'failed';
  /** 同步进度 0-100 */
  progress: number;
  /** 关联的巨潮公告 ID */
  announcementId?: string;
  /** PDF 下载 URL */
  pdfUrl?: string;
  /** 入库后的文档 ID */
  documentId?: number;
  /** 入库后的切片数 */
  chunkCount?: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 重试次数 */
  retryCount: number;
  /** MinerU 解析任务 ID */
  mineruTaskId?: string;
  /** MinerU 解析结果下载 URL（markdown 或 zip） */
  mineruResultUrl?: string;
  /** 任务创建时间 */
  createdAt?: string;
  /** 最后更新时间 */
  updatedAt?: string;
}

/**
 * advanceSyncTask 的返回值
 */
export interface AdvanceResult {
  /** 任务 ID */
  taskId: number;
  /** 执行前状态 */
  previousStatus: string;
  /** 执行后状态 */
  currentStatus: string;
  /** 当前进度 */
  progress: number;
  /** 本次推进的描述 */
  action: string;
  /** 是否需要继续调用 advance */
  needsMoreAdvance: boolean;
  /** 错误信息（如有） */
  error?: string;
}

export interface SyncStatus {
  stockCode: string;
  /** 知识库中已有的文档数 */
  existingDocCount: number;
  /** 进行中的同步任务 */
  activeTasks: SyncTask[];
  /** 是否有数据可用 */
  dataAvailable: boolean;
  /** 建议：'ready' | 'syncing' | 'no_data' */
  recommendation: 'ready' | 'syncing' | 'no_data';
}

export interface AutoSyncConfig {
  /** 是否自动同步（默认 true） */
  autoSyncEnabled: boolean;
  /** 默认同步的报告类型 */
  defaultReportTypes: Array<'annual' | 'semi_annual' | 'q1' | 'q3'>;
  /** 同步的最近 N 年报告 */
  syncRecentYears: number;
  /** 最大并发同步任务 */
  maxConcurrentTasks: number;
  /** 最大重试次数 */
  maxRetries: number;
}

export const DEFAULT_SYNC_CONFIG: AutoSyncConfig = {
  autoSyncEnabled: true,
  defaultReportTypes: ['annual'],            // 默认只同步年报
  syncRecentYears: 2,                         // 最近 2 年
  maxConcurrentTasks: 3,
  maxRetries: 2,
};

// ==================== Service ====================

/**
 * 创建自动同步服务
 */
export function createAutoSyncService(
  db: D1Database,
  kv: KVNamespace,
  /** VectorEngine API Key */
  apiKey: string,
) {
  /**
   * 检查指定股票的数据状态
   * 查询 rag_documents 和 rag_sync_tasks 判断是否有可用数据
   */
  async function checkStockDataStatus(stockCode: string): Promise<SyncStatus> {
    // 1. 查询知识库中是否已有该股票的文档
    const docsResult = await db.prepare(
      `SELECT COUNT(*) as count FROM rag_documents 
       WHERE stock_code = ? AND status = 'completed'`
    ).bind(stockCode).first<{ count: number }>();

    const existingDocCount = docsResult?.count || 0;

    // 2. 查询是否有正在进行的同步任务
    const tasksResult = await db.prepare(
      `SELECT * FROM rag_sync_tasks 
       WHERE stock_code = ? AND status NOT IN ('completed', 'failed')
       ORDER BY created_at DESC`
    ).bind(stockCode).all();

    const activeTasks: SyncTask[] = (tasksResult.results || []).map(rowToSyncTask);

    // 3. 判断状态
    let recommendation: 'ready' | 'syncing' | 'no_data';
    if (existingDocCount > 0) {
      recommendation = 'ready';
    } else if (activeTasks.length > 0) {
      recommendation = 'syncing';
    } else {
      recommendation = 'no_data';
    }

    return {
      stockCode,
      existingDocCount,
      activeTasks,
      dataAvailable: existingDocCount > 0,
      recommendation,
    };
  }

  /**
   * 检查某个特定的报告是否已入库
   */
  async function isReportIngested(
    stockCode: string,
    reportType: string,
    reportYear: number
  ): Promise<boolean> {
    // 在 rag_documents 中搜索匹配的文档
    const result = await db.prepare(
      `SELECT COUNT(*) as count FROM rag_documents 
       WHERE stock_code = ? AND status = 'completed'
       AND (title LIKE ? OR title LIKE ? OR file_name LIKE ?)`
    ).bind(
      stockCode,
      `%${reportYear}%年报%`,
      `%${reportYear}%${reportType}%`,
      `%${stockCode}%${reportYear}%`
    ).first<{ count: number }>();

    return (result?.count || 0) > 0;
  }

  /**
   * 检查是否有正在进行的同步任务（避免重复触发）
   */
  async function hasActiveSync(
    stockCode: string,
    reportType?: string,
    reportYear?: number
  ): Promise<boolean> {
    let sql = `SELECT COUNT(*) as count FROM rag_sync_tasks 
               WHERE stock_code = ? AND status NOT IN ('completed', 'failed')`;
    const binds: any[] = [stockCode];

    if (reportType) {
      sql += ' AND report_type = ?';
      binds.push(reportType);
    }
    if (reportYear) {
      sql += ' AND report_year = ?';
      binds.push(reportYear);
    }

    const result = await db.prepare(sql).bind(...binds).first<{ count: number }>();
    return (result?.count || 0) > 0;
  }

  /**
   * 创建同步任务记录
   */
  async function createSyncTask(params: {
    stockCode: string;
    stockName?: string;
    reportType: 'annual' | 'semi_annual' | 'q1' | 'q3';
    reportYear: number;
    announcementId?: string;
    pdfUrl?: string;
  }): Promise<number> {
    const result = await db.prepare(
      `INSERT INTO rag_sync_tasks (stock_code, stock_name, report_type, report_year, 
       status, progress, announcement_id, pdf_url, retry_count)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, 0)`
    ).bind(
      params.stockCode,
      params.stockName || null,
      params.reportType,
      params.reportYear,
      params.announcementId || null,
      params.pdfUrl || null,
    ).run();

    return (result.meta.last_row_id as number) || 0;
  }

  /**
   * 更新同步任务状态
   */
  async function updateSyncTask(
    taskId: number,
    updates: Partial<Pick<SyncTask, 'status' | 'progress' | 'announcementId' | 'pdfUrl' | 'documentId' | 'chunkCount' | 'errorMessage' | 'retryCount' | 'mineruTaskId' | 'mineruResultUrl'>>
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = datetime(\'now\')'];
    const binds: any[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      binds.push(updates.status);
    }
    if (updates.progress !== undefined) {
      setClauses.push('progress = ?');
      binds.push(updates.progress);
    }
    if (updates.announcementId !== undefined) {
      setClauses.push('announcement_id = ?');
      binds.push(updates.announcementId);
    }
    if (updates.pdfUrl !== undefined) {
      setClauses.push('pdf_url = ?');
      binds.push(updates.pdfUrl);
    }
    if (updates.documentId !== undefined) {
      setClauses.push('document_id = ?');
      binds.push(updates.documentId);
    }
    if (updates.chunkCount !== undefined) {
      setClauses.push('chunk_count = ?');
      binds.push(updates.chunkCount);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push('error_message = ?');
      binds.push(updates.errorMessage);
    }
    if (updates.retryCount !== undefined) {
      setClauses.push('retry_count = ?');
      binds.push(updates.retryCount);
    }
    if (updates.mineruTaskId !== undefined) {
      setClauses.push('mineru_task_id = ?');
      binds.push(updates.mineruTaskId);
    }
    if (updates.mineruResultUrl !== undefined) {
      setClauses.push('mineru_result_url = ?');
      binds.push(updates.mineruResultUrl);
    }

    await db.prepare(
      `UPDATE rag_sync_tasks SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...binds, taskId).run();
  }

  /**
   * 触发异步同步流程
   * 
   * 完整流程：
   * 1. 搜索巨潮公告找到 PDF
   * 2. 下载 PDF
   * 3. MinerU 解析
   * 4. 结构感知分块入库
   * 
   * 注意：此函数启动后台任务，不阻塞调用方
   * 在 Cloudflare Workers 中使用 ctx.waitUntil() 或 scheduled event 执行
   */
  async function triggerSync(params: {
    stockCode: string;
    stockName?: string;
    reportType: 'annual' | 'semi_annual' | 'q1' | 'q3';
    reportYear: number;
    /** 如果已知巨潮报告信息，可以直接传入 */
    reportMeta?: CninfoReportMeta;
  }): Promise<{ taskId: number; status: string }> {
    // 检查是否已经有同类型的同步任务
    const hasActive = await hasActiveSync(params.stockCode, params.reportType, params.reportYear);
    if (hasActive) {
      return { taskId: 0, status: 'already_syncing' };
    }

    // 检查是否已入库
    const ingested = await isReportIngested(params.stockCode, params.reportType, params.reportYear);
    if (ingested) {
      return { taskId: 0, status: 'already_ingested' };
    }

    // 创建同步任务
    const taskId = await createSyncTask({
      stockCode: params.stockCode,
      stockName: params.stockName,
      reportType: params.reportType,
      reportYear: params.reportYear,
      announcementId: params.reportMeta?.announcementId,
      pdfUrl: params.reportMeta?.pdfUrl,
    });

    console.log(`[AutoSync] Created sync task #${taskId}: ${params.stockCode} ${params.reportType} ${params.reportYear}`);

    return { taskId, status: 'created' };
  }

  /**
   * 执行同步任务的实际流程（需要在后台调用）
   * 
   * 此函数包含完整的同步逻辑，应在 background 或 scheduled 中调用
   * 需要传入所需的服务实例
   */
  async function executeSyncTask(
    taskId: number,
    services: {
      cninfo: import('./ragCninfo').CninfoService;
      pdfParser: ReturnType<typeof import('./ragPdfParser').createPdfParserService>;
      ragService: import('./rag').RAGService;
      bm25Service: import('./ragBm25').BM25Service;
    }
  ): Promise<void> {
    // 获取任务信息
    const task = await db.prepare(
      'SELECT * FROM rag_sync_tasks WHERE id = ?'
    ).bind(taskId).first();

    if (!task) {
      console.error(`[AutoSync] Task #${taskId} not found`);
      return;
    }

    const stockCode = task.stock_code as string;
    const reportType = task.report_type as string;
    const reportYear = task.report_year as number;

    try {
      // Step 1: 搜索巨潮公告
      await updateSyncTask(taskId, { status: 'searching', progress: 10 });

      let pdfUrl = task.pdf_url as string;

      if (!pdfUrl) {
        const reports = await services.cninfo.searchFinancialReports(
          stockCode,
          reportType as any,
          reportYear
        );

        if (reports.length === 0) {
          throw new Error(`未找到 ${stockCode} ${reportYear} 年${reportType === 'annual' ? '年报' : '财报'}`);
        }

        const targetReport = reports[0];
        pdfUrl = targetReport.pdfUrl;
        await updateSyncTask(taskId, {
          announcementId: targetReport.announcementId,
          pdfUrl,
          progress: 20,
        });
      }

      // Step 2+3: MinerU 解析
      // 优化：直接将 CNInfo PDF URL 提交给 MinerU，避免下载+重新上传的开销
      await updateSyncTask(taskId, { status: 'parsing', progress: 30 });
      console.log(`[AutoSync] Submitting PDF URL directly to MinerU: ${pdfUrl}`);
      
      let parseResult;
      try {
        // 优先使用 URL 直接提交（MinerU 支持从公网 URL 抓取 PDF）
        const submitStartTime = Date.now();
        const taskSubmitResult = await services.pdfParser.submitTaskByUrl(pdfUrl, {
          enableOcr: true,
          enableTable: true,
          enableFormula: true,
        });
        
        await updateSyncTask(taskId, { progress: 40 });
        console.log(`[AutoSync] MinerU task submitted: ${taskSubmitResult.taskId}`);
        
        // pollTaskStatus 内部自带循环和超时
        const finalState = await services.pdfParser.pollTaskStatus(taskSubmitResult.taskId);
        
        await updateSyncTask(taskId, { progress: 55 });
        
        // 下载 Markdown 结果
        const mdUrl = finalState.fullZipUrl || finalState.fullMarkdownUrl || '';
        const markdown = await services.pdfParser.downloadMarkdown(mdUrl);
        
        parseResult = {
          markdown,
          pageCount: finalState.pageCount,
          duration: Date.now() - submitStartTime,
        };
        
      } catch (urlError) {
        // URL 直传失败时回退到下载+上传方式
        console.warn(`[AutoSync] Direct URL submit failed, falling back to download+upload:`, urlError);
        await updateSyncTask(taskId, { status: 'downloading', progress: 35 });
        
        const { base64, sizeBytes } = await services.cninfo.downloadPdf(pdfUrl);
        console.log(`[AutoSync] Downloaded PDF: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB`);
        await updateSyncTask(taskId, { progress: 45 });
        
        await updateSyncTask(taskId, { status: 'parsing', progress: 50 });
        parseResult = await services.pdfParser.parsePdf(base64, `${stockCode}_${reportYear}_${reportType}.pdf`, {
          enableOcr: true,
          enableTable: true,
          enableFormula: true,
        });
      }

      // 清理 Markdown 并提取结构化块
      const { cleanMineruMarkdown, extractStructuredBlocks } = await import('./ragPdfParser');
      const cleanedMarkdown = cleanMineruMarkdown(parseResult.markdown);
      const structuredBlocks = extractStructuredBlocks(cleanedMarkdown);

      await updateSyncTask(taskId, { progress: 70 });

      // Step 4: 入库
      await updateSyncTask(taskId, { status: 'ingesting', progress: 75 });

      // 注入 BM25 回调
      services.ragService.setBM25BuildCallback(async (docId: number) => {
        await services.bm25Service.buildIndexForDocument(docId);
      });

      const reportTypeLabel = reportType === 'annual' ? '年报' : reportType === 'semi_annual' ? '半年报' : reportType === 'q1' ? '一季报' : '三季报';
      const docTitle = `${task.stock_name || stockCode} ${reportYear}年${reportTypeLabel}`;

      const ingestResult = await services.ragService.ingestDocument({
        title: docTitle,
        content: cleanedMarkdown,
        fileName: `${stockCode}_${reportYear}_${reportType}.pdf`,
        fileType: 'pdf',
        stockCode: stockCode,
        stockName: task.stock_name as string || undefined,
        category: reportType === 'annual' ? 'annual_report' : 'quarterly_report',
        tags: [reportType, String(reportYear), stockCode],
        chunkSize: 500,
        chunkOverlap: 100,
        structuredBlocks,
      });

      // Step 5: 完成
      await updateSyncTask(taskId, {
        status: 'completed',
        progress: 100,
        documentId: ingestResult.documentId,
        chunkCount: ingestResult.chunkCount,
      });

      console.log(`[AutoSync] Completed: ${docTitle} → docId=${ingestResult.documentId}, chunks=${ingestResult.chunkCount}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '同步失败';
      console.error(`[AutoSync] Task #${taskId} failed:`, errorMsg);

      const currentRetry = (task.retry_count as number) || 0;
      await updateSyncTask(taskId, {
        status: 'failed',
        errorMessage: errorMsg,
        retryCount: currentRetry + 1,
      });
    }
  }

  /**
   * 在用户查询时自动判断是否需要同步
   * 
   * 调用时机：pipeline enhancedQuery 开始时
   * 返回：当前股票的数据状态，以及是否已触发同步
   */
  async function ensureReportsAvailable(
    stockCode: string,
    stockName?: string,
    config: Partial<AutoSyncConfig> = {}
  ): Promise<{
    status: SyncStatus;
    syncTriggered: boolean;
    newTaskIds: number[];
  }> {
    const cfg = { ...DEFAULT_SYNC_CONFIG, ...config };

    if (!cfg.autoSyncEnabled) {
      const status = await checkStockDataStatus(stockCode);
      return { status, syncTriggered: false, newTaskIds: [] };
    }

    const status = await checkStockDataStatus(stockCode);

    // 如果已有数据或正在同步，直接返回
    if (status.recommendation === 'ready' || status.recommendation === 'syncing') {
      return { status, syncTriggered: false, newTaskIds: [] };
    }

    // 没有数据，触发同步
    const currentYear = new Date().getFullYear();
    const newTaskIds: number[] = [];

    for (const reportType of cfg.defaultReportTypes) {
      for (let yearOffset = 0; yearOffset < cfg.syncRecentYears; yearOffset++) {
        const year = currentYear - 1 - yearOffset; // 年报是往年的

        const { taskId, status: taskStatus } = await triggerSync({
          stockCode,
          stockName,
          reportType,
          reportYear: year,
        });

        if (taskId > 0) {
          newTaskIds.push(taskId);
          console.log(`[AutoSync] Triggered sync: ${stockCode} ${reportType} ${year} → task #${taskId}`);
        } else {
          console.log(`[AutoSync] Skip: ${stockCode} ${reportType} ${year} → ${taskStatus}`);
        }
      }
    }

    // 重新获取状态
    const updatedStatus = await checkStockDataStatus(stockCode);

    return {
      status: updatedStatus,
      syncTriggered: newTaskIds.length > 0,
      newTaskIds,
    };
  }

  /**
   * 分步推进同步任务（状态机模式）
   * 
   * 设计原理：
   * - Cloudflare Workers waitUntil 仅在客户端断开后给 30 秒
   * - MinerU 解析大型年报 PDF 需要 5-15 分钟
   * - 不可能在单次 HTTP 请求中完成整个流程
   * 
   * 解决方案：每次调用 advance 只执行当前状态的下一步：
   *   pending    → searching: 搜索巨潮公告，找到 PDF URL
   *   searching  → parsing:   提交 MinerU 解析任务
   *   parsing    → parsing:   轮询 MinerU 一次（未完成则仍为 parsing）
   *   parsing    → ingesting: MinerU 完成 → 下载 markdown
   *   ingesting  → completed: 分块 + embedding + 入库
   * 
   * 外部调用方只需循环调用 advance 直到 completed/failed
   */
  async function advanceSyncTask(
    taskId: number,
    services: {
      cninfo: import('./ragCninfo').CninfoService;
      pdfParser: ReturnType<typeof import('./ragPdfParser').createPdfParserService>;
      ragService: import('./rag').RAGService;
      bm25Service: import('./ragBm25').BM25Service;
    }
  ): Promise<AdvanceResult> {
    const task = await db.prepare(
      'SELECT * FROM rag_sync_tasks WHERE id = ?'
    ).bind(taskId).first();

    if (!task) {
      return {
        taskId,
        previousStatus: 'unknown',
        currentStatus: 'unknown',
        progress: 0,
        action: 'task_not_found',
        needsMoreAdvance: false,
        error: `Task #${taskId} not found`,
      };
    }

    const status = task.status as string;
    const stockCode = task.stock_code as string;
    const reportType = task.report_type as string;
    const reportYear = task.report_year as number;

    // 终态：不需要推进
    if (status === 'completed' || status === 'failed') {
      return {
        taskId,
        previousStatus: status,
        currentStatus: status,
        progress: (task.progress as number) || 0,
        action: 'already_terminal',
        needsMoreAdvance: false,
      };
    }

    try {
      // ==================== Step: pending → searching ====================
      if (status === 'pending') {
        await updateSyncTask(taskId, { status: 'searching', progress: 10 });

        let pdfUrl = task.pdf_url as string;
        if (!pdfUrl) {
          const reports = await services.cninfo.searchFinancialReports(
            stockCode,
            reportType as any,
            reportYear
          );

          if (reports.length === 0) {
            throw new Error(`未找到 ${stockCode} ${reportYear} 年${reportType === 'annual' ? '年报' : '财报'}`);
          }

          const targetReport = reports[0];
          pdfUrl = targetReport.pdfUrl;
          await updateSyncTask(taskId, {
            announcementId: targetReport.announcementId,
            pdfUrl,
            progress: 20,
          });
        }

        // 立刻进入下一步：提交 MinerU
        console.log(`[AutoSync:advance] Task #${taskId}: submitting to MinerU: ${pdfUrl}`);
        const taskSubmitResult = await services.pdfParser.submitTaskByUrl(pdfUrl, {
          enableOcr: true,
          enableTable: true,
          enableFormula: true,
        });

        await updateSyncTask(taskId, {
          status: 'parsing',
          progress: 40,
          mineruTaskId: taskSubmitResult.taskId,
        });

        return {
          taskId,
          previousStatus: 'pending',
          currentStatus: 'parsing',
          progress: 40,
          action: `cninfo_search_done_mineru_submitted (mineru_task=${taskSubmitResult.taskId})`,
          needsMoreAdvance: true,
        };
      }

      // ==================== Step: searching → parsing ====================
      // (此状态说明上次提交 MinerU 之前中断了)
      if (status === 'searching') {
        let pdfUrl = task.pdf_url as string;
        if (!pdfUrl) {
          const reports = await services.cninfo.searchFinancialReports(
            stockCode,
            reportType as any,
            reportYear
          );
          if (reports.length === 0) {
            throw new Error(`未找到 ${stockCode} ${reportYear} 年${reportType === 'annual' ? '年报' : '财报'}`);
          }
          pdfUrl = reports[0].pdfUrl;
          await updateSyncTask(taskId, {
            announcementId: reports[0].announcementId,
            pdfUrl,
          });
        }

        const mineruTaskId = task.mineru_task_id as string;
        if (mineruTaskId) {
          // 已有 MinerU 任务，直接进入 polling
          await updateSyncTask(taskId, { status: 'parsing', progress: 40 });
          return {
            taskId,
            previousStatus: 'searching',
            currentStatus: 'parsing',
            progress: 40,
            action: `resumed_existing_mineru_task (${mineruTaskId})`,
            needsMoreAdvance: true,
          };
        }

        // 提交新的 MinerU 任务
        const taskSubmitResult = await services.pdfParser.submitTaskByUrl(pdfUrl, {
          enableOcr: true,
          enableTable: true,
          enableFormula: true,
        });

        await updateSyncTask(taskId, {
          status: 'parsing',
          progress: 40,
          mineruTaskId: taskSubmitResult.taskId,
        });

        return {
          taskId,
          previousStatus: 'searching',
          currentStatus: 'parsing',
          progress: 40,
          action: `mineru_submitted (mineru_task=${taskSubmitResult.taskId})`,
          needsMoreAdvance: true,
        };
      }

      // ==================== Step: downloading → parsing ====================
      // (旧流程遗留状态，等同于 searching)
      if (status === 'downloading') {
        const pdfUrl = task.pdf_url as string;
        if (!pdfUrl) {
          throw new Error('No PDF URL found for downloading task');
        }

        const mineruTaskId = task.mineru_task_id as string;
        if (mineruTaskId) {
          await updateSyncTask(taskId, { status: 'parsing', progress: 40 });
          return {
            taskId,
            previousStatus: 'downloading',
            currentStatus: 'parsing',
            progress: 40,
            action: `resumed_existing_mineru_task (${mineruTaskId})`,
            needsMoreAdvance: true,
          };
        }

        const taskSubmitResult = await services.pdfParser.submitTaskByUrl(pdfUrl, {
          enableOcr: true,
          enableTable: true,
          enableFormula: true,
        });

        await updateSyncTask(taskId, {
          status: 'parsing',
          progress: 40,
          mineruTaskId: taskSubmitResult.taskId,
        });

        return {
          taskId,
          previousStatus: 'downloading',
          currentStatus: 'parsing',
          progress: 40,
          action: `mineru_submitted (mineru_task=${taskSubmitResult.taskId})`,
          needsMoreAdvance: true,
        };
      }

      // ==================== Step: parsing → 检查 MinerU 状态 ====================
      if (status === 'parsing') {
        const mineruTaskId = task.mineru_task_id as string;
        
        if (!mineruTaskId) {
          // 没有 MinerU 任务 ID（旧流程卡住的任务），需要重新提交
          const pdfUrl = task.pdf_url as string;
          if (!pdfUrl) {
            throw new Error('Task in parsing state but no PDF URL or MinerU task ID');
          }

          console.log(`[AutoSync:advance] Task #${taskId}: no MinerU task ID, re-submitting`);
          const taskSubmitResult = await services.pdfParser.submitTaskByUrl(pdfUrl, {
            enableOcr: true,
            enableTable: true,
            enableFormula: true,
          });

          await updateSyncTask(taskId, {
            progress: 40,
            mineruTaskId: taskSubmitResult.taskId,
          });

          return {
            taskId,
            previousStatus: 'parsing',
            currentStatus: 'parsing',
            progress: 40,
            action: `resubmitted_to_mineru (mineru_task=${taskSubmitResult.taskId})`,
            needsMoreAdvance: true,
          };
        }

        // 已有 MinerU 任务，检查一次状态（不轮询，立即返回）
        console.log(`[AutoSync:advance] Task #${taskId}: checking MinerU task ${mineruTaskId}`);
        
        // 使用 pdfParser 的 checkTaskOnce（单次检查，非轮询）
        const mineruCheckResult = await services.pdfParser.checkTaskOnce(mineruTaskId);
        const mineruState = mineruCheckResult.state;
        console.log(`[AutoSync:advance] Task #${taskId}: MinerU state = ${mineruState}`);

        if (mineruState === 'done') {
          // MinerU 完成！保存结果 URL，进入 ingesting
          const resultUrl = mineruCheckResult.fullZipUrl || mineruCheckResult.fullMarkdownUrl || '';
          const pageCount = mineruCheckResult.pageCount;
          
          await updateSyncTask(taskId, {
            status: 'ingesting',
            progress: 60,
            mineruResultUrl: resultUrl,
          });

          return {
            taskId,
            previousStatus: 'parsing',
            currentStatus: 'ingesting',
            progress: 60,
            action: `mineru_done (pages=${pageCount || '?'}, url=${resultUrl ? 'yes' : 'no'})`,
            needsMoreAdvance: true,
          };
        }

        if (mineruState === 'failed') {
          const errorMsg = mineruCheckResult.errorMessage || 'MinerU task failed';
          throw new Error(`MinerU 解析失败: ${errorMsg}`);
        }

        // 仍在处理中（pending / running）
        return {
          taskId,
          previousStatus: 'parsing',
          currentStatus: 'parsing',
          progress: Math.min((task.progress as number) || 40, 55),
          action: `mineru_still_processing (state=${mineruState})`,
          needsMoreAdvance: true,
        };
      }

      // ==================== Step: ingesting → completed (分阶段) ====================
      // 
      // Phase 1 (progress 60-75): 下载 markdown + 创建文档 + 分块存储(无 embedding)
      // Phase 2 (progress 76-95): 每次 advance 嵌入一批 chunks
      // Phase 3 (progress 96-100): 更新文档状态 + BM25 索引 → completed
      //
      if (status === 'ingesting') {
        const currentProgress = (task.progress as number) || 60;
        const documentId = task.document_id as number;

        // ---- Phase 1: 下载 + 分块 (无 embedding) ----
        if (currentProgress < 76) {
          const mineruResultUrl = (task.mineru_result_url as string) || '';
          if (!mineruResultUrl) {
            throw new Error('Task in ingesting state but no MinerU result URL');
          }

          // 下载 markdown
          console.log(`[AutoSync:advance] Task #${taskId}: downloading markdown from ${mineruResultUrl}`);
          const markdown = await services.pdfParser.downloadMarkdown(mineruResultUrl);
          if (!markdown || markdown.trim().length === 0) {
            throw new Error('MinerU 解析结果为空');
          }

          // 清理 + 分块
          const { cleanMineruMarkdown, extractStructuredBlocks } = await import('./ragPdfParser');
          const { splitTextIntoChunks } = await import('./rag');
          const cleanedMarkdown = cleanMineruMarkdown(markdown);
          const structuredBlocks = extractStructuredBlocks(cleanedMarkdown);

          const reportTypeLabel = reportType === 'annual' ? '年报' : reportType === 'semi_annual' ? '半年报' : reportType === 'q1' ? '一季报' : '三季报';
          const docTitle = `${task.stock_name || stockCode} ${reportYear}年${reportTypeLabel}`;

          // 创建文档记录（或复用已有的 processing 文档）
          let docId = documentId;
          if (!docId) {
            // 检查是否已存在 processing 状态的文档
            const existingDoc = await db.prepare(
              `SELECT id FROM rag_documents WHERE stock_code = ? AND title LIKE ? AND status = 'processing' ORDER BY id DESC LIMIT 1`
            ).bind(stockCode, `%${reportYear}%${reportTypeLabel}%`).first<{ id: number }>();
            
            if (existingDoc) {
              docId = existingDoc.id;
              console.log(`[AutoSync:advance] Task #${taskId}: reusing existing doc ${docId}`);
            } else {
              const embeddingModelName = `vectorengine/text-embedding-3-small`;
              const docResult = await db.prepare(`
                INSERT INTO rag_documents (title, file_name, file_type, file_size, stock_code, stock_name, category, tags, embedding_model, status)
                VALUES (?, ?, 'pdf', ?, ?, ?, ?, ?, ?, 'processing')
              `).bind(
                docTitle, `${stockCode}_${reportYear}_${reportType}.pdf`, cleanedMarkdown.length,
                stockCode, task.stock_name || null,
                reportType === 'annual' ? 'annual_report' : 'quarterly_report',
                JSON.stringify([reportType, String(reportYear), stockCode]),
                embeddingModelName
              ).run();
              docId = docResult.meta.last_row_id as number;
              console.log(`[AutoSync:advance] Task #${taskId}: created doc ${docId}`);
            }
          }

          // 清除旧 chunks（防止重复）
          await db.prepare('DELETE FROM rag_chunks WHERE document_id = ?').bind(docId).run();

          // 分块（使用结构感知）
          const chunks: Array<{ text: string; meta: Record<string, any> }> = [];
          for (const block of structuredBlocks) {
            if (block.type === 'heading') continue;
            
            const blockContent = block.content.trim();
            if (!blockContent) continue;

            if (block.type === 'table') {
              // 表格作为整块
              chunks.push({
                text: blockContent,
                meta: {
                  chunkType: 'table',
                  heading: block.heading,
                  pageStart: block.pageStart,
                  pageEnd: block.pageEnd,
                  tableCaption: block.tableCaption,
                  tableIndex: block.tableIndex,
                },
              });
            } else {
              // 文本按大小切分
              const subChunks = splitTextIntoChunks(blockContent, { chunkSize: 500, chunkOverlap: 100 });
              for (const sc of subChunks) {
                chunks.push({
                  text: sc,
                  meta: {
                    chunkType: 'text',
                    heading: block.heading,
                    pageStart: block.pageStart,
                    pageEnd: block.pageEnd,
                  },
                });
              }
            }
          }

          console.log(`[AutoSync:advance] Task #${taskId}: storing ${chunks.length} chunks (no embeddings)`);

          // 批量写入 D1（不含 embedding，后续 phase 2 补充）
          const BATCH = 50;
          for (let i = 0; i < chunks.length; i += BATCH) {
            const batch = chunks.slice(i, i + BATCH);
            const stmts = batch.map((c, idx) => {
              const chunkIdx = i + idx;
              const pageRange = c.meta.pageStart
                ? (c.meta.pageEnd && c.meta.pageEnd !== c.meta.pageStart
                  ? `${c.meta.pageStart}-${c.meta.pageEnd}` : `${c.meta.pageStart}`)
                : null;
              return db.prepare(`
                INSERT INTO rag_chunks (document_id, chunk_index, content, content_length, embedding_key, has_embedding, metadata, chunk_type, page_range)
                VALUES (?, ?, ?, ?, '', 0, ?, ?, ?)
              `).bind(
                docId, chunkIdx, c.text, c.text.length,
                JSON.stringify(c.meta), c.meta.chunkType || 'text', pageRange
              );
            });
            await db.batch(stmts);
          }

          await updateSyncTask(taskId, {
            progress: 76,
            documentId: docId,
            chunkCount: chunks.length,
          });

          return {
            taskId,
            previousStatus: 'ingesting',
            currentStatus: 'ingesting',
            progress: 76,
            action: `chunks_stored (docId=${docId}, chunks=${chunks.length}, no_embeddings_yet)`,
            needsMoreAdvance: true,
          };
        }

        // ---- Phase 2: 逐批嵌入 ----
        if (currentProgress >= 76 && currentProgress < 96) {
          if (!documentId) {
            throw new Error('No document ID for embedding phase');
          }

          // 找到下一批未嵌入的 chunks
          const EMBED_BATCH = 20;
          const unembeddedChunks = await db.prepare(
            `SELECT id, chunk_index, content FROM rag_chunks 
             WHERE document_id = ? AND has_embedding = 0 
             ORDER BY chunk_index LIMIT ?`
          ).bind(documentId, EMBED_BATCH).all();

          const chunksToEmbed = unembeddedChunks.results || [];
          
          if (chunksToEmbed.length === 0) {
            // 所有 chunks 已嵌入，进入 phase 3
            await updateSyncTask(taskId, { progress: 96 });
            return {
              taskId,
              previousStatus: 'ingesting',
              currentStatus: 'ingesting',
              progress: 96,
              action: 'all_chunks_embedded',
              needsMoreAdvance: true,
            };
          }

          // 生成 embeddings
          const { generateEmbeddings, createEmbeddingConfig } = await import('./rag');
          const embeddingConfig = createEmbeddingConfig({
            vectorengineApiKey: apiKey,
          });

          const texts = chunksToEmbed.map(c => c.content as string);
          const embeddings = await generateEmbeddings(texts, embeddingConfig);

          // 存储 embeddings 到 KV + 更新 D1
          const updateStmts: D1PreparedStatement[] = [];
          for (let i = 0; i < chunksToEmbed.length; i++) {
            const chunk = chunksToEmbed[i];
            const chunkIndex = chunk.chunk_index as number;
            const embeddingKey = `rag:emb:${documentId}:${chunkIndex}`;
            
            await kv.put(embeddingKey, JSON.stringify(embeddings[i]));
            
            updateStmts.push(
              db.prepare(
                `UPDATE rag_chunks SET embedding_key = ?, has_embedding = 1 WHERE id = ?`
              ).bind(embeddingKey, chunk.id)
            );
          }
          
          if (updateStmts.length > 0) {
            await db.batch(updateStmts);
          }

          // 计算进度：76 + (已嵌入/总数) * 20
          const totalChunks = (task.chunk_count as number) || 1;
          const embeddedCountResult = await db.prepare(
            `SELECT COUNT(*) as cnt FROM rag_chunks WHERE document_id = ? AND has_embedding = 1`
          ).bind(documentId).first<{ cnt: number }>();
          const embeddedCount = embeddedCountResult?.cnt || 0;
          const embeddingProgress = Math.min(76 + Math.floor((embeddedCount / totalChunks) * 20), 95);

          await updateSyncTask(taskId, { progress: embeddingProgress });

          return {
            taskId,
            previousStatus: 'ingesting',
            currentStatus: 'ingesting',
            progress: embeddingProgress,
            action: `embedded_batch (${embeddedCount}/${totalChunks} chunks done)`,
            needsMoreAdvance: true,
          };
        }

        // ---- Phase 3: 收尾 — 更新文档状态 + BM25 ----
        if (currentProgress >= 96) {
          if (!documentId) {
            throw new Error('No document ID for finalization phase');
          }

          // 获取实际 chunk 数
          const chunkCountResult = await db.prepare(
            `SELECT COUNT(*) as cnt FROM rag_chunks WHERE document_id = ? AND has_embedding = 1`
          ).bind(documentId).first<{ cnt: number }>();
          const finalChunkCount = chunkCountResult?.cnt || 0;

          // 更新文档状态
          await db.prepare(`
            UPDATE rag_documents SET status = 'completed', chunk_count = ?, updated_at = datetime('now') WHERE id = ?
          `).bind(finalChunkCount, documentId).run();

          // BM25 索引
          try {
            await services.bm25Service.buildIndexForDocument(documentId);
            console.log(`[AutoSync:advance] Task #${taskId}: BM25 index built for doc ${documentId}`);
          } catch (bm25Err) {
            console.warn(`[AutoSync:advance] Task #${taskId}: BM25 index failed (non-fatal):`, bm25Err);
          }

          await updateSyncTask(taskId, {
            status: 'completed',
            progress: 100,
            chunkCount: finalChunkCount,
          });

          console.log(`[AutoSync:advance] Task #${taskId}: COMPLETED → docId=${documentId}, chunks=${finalChunkCount}`);

          return {
            taskId,
            previousStatus: 'ingesting',
            currentStatus: 'completed',
            progress: 100,
            action: `completed (docId=${documentId}, chunks=${finalChunkCount})`,
            needsMoreAdvance: false,
          };
        }
      }

      // 未知状态
      return {
        taskId,
        previousStatus: status,
        currentStatus: status,
        progress: (task.progress as number) || 0,
        action: `unknown_status`,
        needsMoreAdvance: false,
        error: `Unhandled status: ${status}`,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '推进失败';
      console.error(`[AutoSync:advance] Task #${taskId} failed at ${status}:`, errorMsg);

      const currentRetry = (task.retry_count as number) || 0;
      await updateSyncTask(taskId, {
        status: 'failed',
        errorMessage: errorMsg,
        retryCount: currentRetry + 1,
      });

      return {
        taskId,
        previousStatus: status,
        currentStatus: 'failed',
        progress: (task.progress as number) || 0,
        action: 'error',
        needsMoreAdvance: false,
        error: errorMsg,
      };
    }
  }

  /**
   * 重置卡住/失败的任务以便重新推进
   * 
   * 策略：
   * - failed 任务 → 回退到适当状态重新开始
   * - 长时间停滞的 parsing/ingesting 任务 → 也可以重置
   */
  async function resetTaskForRetry(
    taskId: number,
    options?: { force?: boolean }
  ): Promise<{ success: boolean; message: string; newStatus?: string }> {
    const task = await db.prepare(
      'SELECT * FROM rag_sync_tasks WHERE id = ?'
    ).bind(taskId).first();

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    const status = task.status as string;
    const retryCount = (task.retry_count as number) || 0;

    if (status === 'completed') {
      return { success: false, message: 'Task already completed' };
    }

    // 如果已有 MinerU 任务且状态是 parsing，重置到 parsing 让 advance 重新检查
    const mineruTaskId = task.mineru_task_id as string;
    const pdfUrl = task.pdf_url as string;

    let newStatus: string;
    let newProgress: number;

    if (mineruTaskId && pdfUrl) {
      // 有 MinerU 任务 ID 和 PDF URL → 回到 parsing 状态让 advance 检查 MinerU
      newStatus = 'parsing';
      newProgress = 40;
    } else if (pdfUrl) {
      // 有 PDF URL 但没有 MinerU 任务 → 回到 searching 让 advance 重新提交
      newStatus = 'searching';
      newProgress = 20;
    } else {
      // 什么都没有 → 回到 pending 从头开始
      newStatus = 'pending';
      newProgress = 0;
    }

    await updateSyncTask(taskId, {
      status: newStatus as any,
      progress: newProgress,
      errorMessage: `Reset for retry (previous: ${status}, retry #${retryCount + 1})`,
    });

    console.log(`[AutoSync:reset] Task #${taskId}: ${status} → ${newStatus}`);

    return {
      success: true,
      message: `Task reset from ${status} to ${newStatus}`,
      newStatus,
    };
  }

  /**
   * 批量重置长时间停滞的任务
   * 
   * @param staleMinutes 超过多少分钟没更新视为停滞（默认 10 分钟）
   */
  async function resetStaleTasks(staleMinutes: number = 10): Promise<{
    resetCount: number;
    tasks: Array<{ id: number; oldStatus: string; newStatus: string }>;
  }> {
    const result = await db.prepare(
      `SELECT * FROM rag_sync_tasks 
       WHERE status NOT IN ('completed', 'failed')
       AND updated_at < datetime('now', ? || ' minutes')
       ORDER BY id`
    ).bind(`-${staleMinutes}`).all();

    const tasks: Array<{ id: number; oldStatus: string; newStatus: string }> = [];

    for (const row of (result.results || [])) {
      const taskId = row.id as number;
      const oldStatus = row.status as string;
      const resetResult = await resetTaskForRetry(taskId);
      if (resetResult.success && resetResult.newStatus) {
        tasks.push({ id: taskId, oldStatus, newStatus: resetResult.newStatus });
      }
    }

    return { resetCount: tasks.length, tasks };
  }

  /**
   * 获取同步任务列表
   */
  async function listSyncTasks(params?: {
    stockCode?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: SyncTask[]; total: number }> {
    const { stockCode, status, limit = 20, offset = 0 } = params || {};

    let where = 'WHERE 1=1';
    const binds: any[] = [];

    if (stockCode) {
      where += ' AND stock_code = ?';
      binds.push(stockCode);
    }
    if (status) {
      where += ' AND status = ?';
      binds.push(status);
    }

    const listResult = await db.prepare(
      `SELECT * FROM rag_sync_tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM rag_sync_tasks ${where}`
    ).bind(...binds).first<{ total: number }>();

    return {
      tasks: (listResult.results || []).map(rowToSyncTask),
      total: countResult?.total || 0,
    };
  }

  /**
   * 获取特定同步任务详情
   */
  async function getSyncTask(taskId: number): Promise<SyncTask | null> {
    const row = await db.prepare(
      'SELECT * FROM rag_sync_tasks WHERE id = ?'
    ).bind(taskId).first();

    return row ? rowToSyncTask(row) : null;
  }

  return {
    checkStockDataStatus,
    isReportIngested,
    hasActiveSync,
    createSyncTask,
    updateSyncTask,
    triggerSync,
    executeSyncTask,
    advanceSyncTask,
    resetTaskForRetry,
    resetStaleTasks,
    ensureReportsAvailable,
    listSyncTasks,
    getSyncTask,
  };
}

// ==================== Helper ====================

function rowToSyncTask(row: Record<string, unknown>): SyncTask {
  return {
    id: row.id as number,
    stockCode: row.stock_code as string,
    stockName: row.stock_name as string | undefined,
    reportType: row.report_type as SyncTask['reportType'],
    reportYear: row.report_year as number,
    status: row.status as SyncTask['status'],
    progress: (row.progress as number) || 0,
    announcementId: row.announcement_id as string | undefined,
    pdfUrl: row.pdf_url as string | undefined,
    documentId: row.document_id as number | undefined,
    chunkCount: row.chunk_count as number | undefined,
    errorMessage: row.error_message as string | undefined,
    retryCount: (row.retry_count as number) || 0,
    mineruTaskId: row.mineru_task_id as string | undefined,
    mineruResultUrl: row.mineru_result_url as string | undefined,
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

export type AutoSyncService = ReturnType<typeof createAutoSyncService>;
