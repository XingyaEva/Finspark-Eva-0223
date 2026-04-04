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
  /** 任务创建时间 */
  createdAt?: string;
  /** 最后更新时间 */
  updatedAt?: string;
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
    updates: Partial<Pick<SyncTask, 'status' | 'progress' | 'announcementId' | 'pdfUrl' | 'documentId' | 'chunkCount' | 'errorMessage' | 'retryCount'>>
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
    createdAt: row.created_at as string | undefined,
    updatedAt: row.updated_at as string | undefined,
  };
}

export type AutoSyncService = ReturnType<typeof createAutoSyncService>;
