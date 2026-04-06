/**
 * RAG PDF Parser Service — MinerU 集成
 * 
 * 使用 MinerU (https://mineru.net) 的 API 解析 PDF 文件，提取文本内容用于 RAG 入库。
 * 
 * 支持两种 API：
 * 1. Precise Parse API (需要 Token, /api/v4/extract/task)
 *    - 文件大小 ≤ 200 MB
 *    - 页数 ≤ 600
 *    - 支持 OCR、公式、表格提取
 * 2. Agent Lightweight Parse API (无需 Token, IP 限流)
 *    - 文件大小 ≤ 10 MB
 *    - 页数 ≤ 20
 *    - 返回 Markdown CDN 链接
 * 
 * 流程：
 *   上传 PDF → 获取 file_url → 提交解析任务 → 轮询状态 → 下载 Markdown
 */

import { unzipSync } from 'fflate';

// ==================== Types ==

export interface MinerUConfig {
  apiKey: string;
  baseUrl?: string;
  /** 最大轮询等待时间（ms），默认 300000 (5 分钟) */
  maxWaitMs?: number;
  /** 轮询间隔（ms），默认 3000 */
  pollIntervalMs?: number;
}

export interface ParseTaskResult {
  taskId: string;
  batchId?: string;
  state: 'pending' | 'running' | 'done' | 'failed';
}

export interface ParsedPdfResult {
  /** 提取出的 Markdown 文本 */
  markdown: string;
  /** 原始文件名 */
  fileName: string;
  /** 页数（如可获得） */
  pageCount?: number;
  /** 解析耗时（ms） */
  parseDurationMs: number;
  /** 使用的解析模型 */
  model: string;
  /** 完整 ZIP 下载链接 */
  fullZipUrl?: string;
}

export interface PdfUploadProgress {
  stage: 'uploading' | 'submitted' | 'parsing' | 'downloading' | 'done' | 'failed';
  progress: number; // 0-100
  message: string;
  taskId?: string;
}

// ==================== Constants ====================

const MINERU_BASE_URL = 'https://mineru.net';
const DEFAULT_MAX_WAIT_MS = 15 * 60 * 1000;  // 15 min（大型年报可能需要 10+ 分钟）
const DEFAULT_POLL_INTERVAL_MS = 5000;        // 5 sec
const MAX_FILE_SIZE = 200 * 1024 * 1024;     // 200 MB
const MAX_PAGES = 600;

// ==================== Service ====================

/**
 * 创建 MinerU PDF 解析服务
 */
export function createPdfParserService(config: MinerUConfig) {
  const {
    apiKey,
    baseUrl = MINERU_BASE_URL,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = config;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // ---- 内部辅助 ----

  /**
   * 通过文件 URL 提交 MinerU 解析任务（Precise Parse API）
   */
  async function submitTaskByUrl(fileUrl: string, options?: {
    model?: string;
    enableOcr?: boolean;
    enableTable?: boolean;
    enableFormula?: boolean;
    language?: string[];
    pageRange?: string;
    dataId?: string;
  }): Promise<ParseTaskResult> {
    const model = options?.model || 'auto';
    
    const body: any = {
      url: fileUrl,
      is_ocr: options?.enableOcr !== false,  // 默认开启 OCR
      enable_table: options?.enableTable !== false,
      enable_formula: options?.enableFormula !== false,
      model: model,
    };

    if (options?.language?.length) {
      body.language = options.language;
    }
    if (options?.pageRange) {
      body.page_range = options.pageRange;
    }
    if (options?.dataId) {
      body.data_id = options.dataId;
    }

    console.log('[MinerU] Submitting task for URL:', fileUrl);

    const resp = await fetch(`${baseUrl}/api/v4/extract/task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MinerU submit failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as any;

    if (data.code !== 0) {
      throw new Error(`MinerU submit error: ${data.msg || JSON.stringify(data)}`);
    }

    return {
      taskId: data.data?.task_id || '',
      batchId: data.data?.batch_id,
      state: 'pending',
    };
  }

  /**
   * 通过 Base64 数据直接提交解析任务
   */
  async function submitTaskByFile(fileBase64: string, fileName: string, options?: {
    model?: string;
    enableOcr?: boolean;
  }): Promise<ParseTaskResult> {
    const body: any = {
      file: fileBase64,
      file_name: fileName,
      is_ocr: options?.enableOcr !== false,
      enable_table: true,
      enable_formula: true,
      model: options?.model || 'auto',
    };

    console.log('[MinerU] Submitting task with file data:', fileName);

    const resp = await fetch(`${baseUrl}/api/v4/extract/task`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MinerU submit failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as any;

    if (data.code !== 0) {
      throw new Error(`MinerU submit error: ${data.msg || JSON.stringify(data)}`);
    }

    return {
      taskId: data.data?.task_id || '',
      batchId: data.data?.batch_id,
      state: 'pending',
    };
  }

  /**
   * 通过 MinerU 的文件上传接口获取 file_url
   */
  async function uploadFileToMineru(fileBase64: string, fileName: string): Promise<string> {
    console.log('[MinerU] Uploading file to get URL:', fileName);
    
    // MinerU 批量上传接口
    const resp = await fetch(`${baseUrl}/api/v4/file-urls/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        files: [{ name: fileName, is_ocr: true }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MinerU file upload URL failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as any;
    if (data.code !== 0) {
      throw new Error(`MinerU file upload URL error: ${data.msg || JSON.stringify(data)}`);
    }

    // MinerU API 返回 file_urls 为 URL 字符串数组（预签名上传地址）
    const fileUrls = data.data?.file_urls;
    const presignedUrl = Array.isArray(fileUrls) ? fileUrls[0] : null;
    
    if (!presignedUrl || typeof presignedUrl !== 'string') {
      console.error('[MinerU] Unexpected file_urls format:', JSON.stringify(data.data));
      throw new Error('MinerU did not return a presigned upload URL');
    }

    console.log('[MinerU] Got presigned URL, uploading PDF...');

    // 使用预签名 URL 上传文件
    const fileBuffer = base64ToArrayBuffer(fileBase64);
    const uploadResp = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: fileBuffer,
    });

    if (!uploadResp.ok) {
      throw new Error(`MinerU file upload failed (${uploadResp.status})`);
    }

    // 返回不带查询参数的 URL 作为文件引用
    const fileUrl = presignedUrl.split('?')[0];
    console.log('[MinerU] File uploaded successfully:', fileUrl);
    return fileUrl;
  }

  /**
   * 轮询任务状态
   */
  async function pollTaskStatus(taskId: string): Promise<{
    state: string;
    fullZipUrl?: string;
    fullMarkdownUrl?: string;
    pageCount?: number;
  }> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await sleep(pollIntervalMs);

      const resp = await fetch(`${baseUrl}/api/v4/extract/task/${taskId}`, {
        method: 'GET',
        headers,
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.warn(`[MinerU] Poll failed (${resp.status}): ${text}`);
        continue;
      }

      const data = await resp.json() as any;

      if (data.code !== 0) {
        console.warn(`[MinerU] Poll error: ${data.msg}`);
        continue;
      }

      const state = data.data?.state || 'unknown';
      console.log(`[MinerU] Task ${taskId} state: ${state}`);

      if (state === 'done') {
        return {
          state: 'done',
          fullZipUrl: data.data?.full_zip_url,
          fullMarkdownUrl: data.data?.full_markdown_url,
          pageCount: data.data?.page_count,
        };
      }

      if (state === 'failed') {
        throw new Error(`MinerU task failed: ${data.data?.error_message || 'Unknown error'}`);
      }
    }

    throw new Error(`MinerU task ${taskId} timed out after ${maxWaitMs / 1000}s`);
  }

  /**
   * 下载 Markdown 结果
   */
  async function downloadMarkdown(url: string): Promise<string> {
    console.log('[MinerU] Downloading markdown from:', url);

    // 如果是 ZIP URL，需要特殊处理
    if (url.endsWith('.zip')) {
      return await downloadMarkdownFromZip(url);
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to download markdown (${resp.status})`);
    }

    return await resp.text();
  }

  /**
   * 从 ZIP 包中提取 Markdown 内容
   * MinerU 返回的 ZIP 包含 full_output.md 和其他文件
   */
  async function downloadMarkdownFromZip(zipUrl: string): Promise<string> {
    console.log('[MinerU] Downloading and extracting ZIP:', zipUrl);

    const resp = await fetch(zipUrl);
    if (!resp.ok) {
      throw new Error(`Failed to download ZIP (${resp.status})`);
    }

    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 简易 ZIP 解析：查找 .md 文件
    const markdown = extractMarkdownFromZip(bytes);

    if (!markdown) {
      throw new Error('No markdown file found in MinerU output ZIP');
    }

    return markdown;
  }

  // ---- 公开方法 ----

  /**
   * 解析 PDF 文件（完整流程）
   * 
   * 1. 提交解析任务（通过 file Base64 或 URL）
   * 2. 轮询等待完成
   * 3. 下载 Markdown 结果
   * 
   * @param fileData - PDF 文件的 Base64 编码数据
   * @param fileName - 原始文件名
   * @param options - 解析选项
   */
  async function parsePdf(
    fileData: string,
    fileName: string,
    options?: {
      model?: string;
      enableOcr?: boolean;
      enableTable?: boolean;
      enableFormula?: boolean;
      language?: string[];
      pageRange?: string;
      onProgress?: (progress: PdfUploadProgress) => void;
    },
  ): Promise<ParsedPdfResult> {
    const startTime = Date.now();
    const onProgress = options?.onProgress || (() => {});

    onProgress({ stage: 'uploading', progress: 5, message: '正在上传 PDF 到 MinerU...' });

    // Step 1: 提交任务
    let taskResult: ParseTaskResult;
    try {
      taskResult = await submitTaskByFile(fileData, fileName, {
        model: options?.model,
        enableOcr: options?.enableOcr,
      });
    } catch (submitError) {
      // 如果直接提交失败，尝试先上传获取 URL 再提交
      console.warn('[MinerU] Direct file submit failed, trying URL method:', submitError);
      onProgress({ stage: 'uploading', progress: 10, message: '正在通过 URL 方式上传...' });
      
      try {
        const fileUrl = await uploadFileToMineru(fileData, fileName);
        taskResult = await submitTaskByUrl(fileUrl, options);
      } catch (urlError) {
        throw new Error(`PDF 上传失败: ${urlError instanceof Error ? urlError.message : '未知错误'}`);
      }
    }

    onProgress({
      stage: 'submitted',
      progress: 15,
      message: '解析任务已提交，等待处理...',
      taskId: taskResult.taskId,
    });

    // Step 2: 轮询状态
    let pollCount = 0;
    const maxPolls = Math.ceil(maxWaitMs / pollIntervalMs);

    let finalResult: { state: string; fullZipUrl?: string; fullMarkdownUrl?: string; pageCount?: number } | null = null;
    const pollStartTime = Date.now();

    while (Date.now() - pollStartTime < maxWaitMs) {
      await sleep(pollIntervalMs);
      pollCount++;

      const progressPct = Math.min(15 + (pollCount / maxPolls) * 65, 80);
      onProgress({
        stage: 'parsing',
        progress: progressPct,
        message: `MinerU 正在解析 PDF... (${pollCount}/${maxPolls})`,
        taskId: taskResult.taskId,
      });

      try {
        const resp = await fetch(`${baseUrl}/api/v4/extract/task/${taskResult.taskId}`, {
          method: 'GET',
          headers,
        });

        if (!resp.ok) {
          console.warn(`[MinerU] Poll failed (${resp.status})`);
          continue;
        }

        const data = await resp.json() as any;

        if (data.code !== 0) {
          console.warn(`[MinerU] Poll error: ${data.msg}`);
          continue;
        }

        const state = data.data?.state || 'unknown';
        console.log(`[MinerU] Task ${taskResult.taskId} state: ${state} (poll #${pollCount})`);

        if (state === 'done') {
          finalResult = {
            state: 'done',
            fullZipUrl: data.data?.full_zip_url,
            fullMarkdownUrl: data.data?.full_markdown_url,
            pageCount: data.data?.page_count,
          };
          break;
        }

        if (state === 'failed') {
          throw new Error(`MinerU 解析失败: ${data.data?.error_message || '未知错误'}`);
        }
      } catch (pollError) {
        if (pollError instanceof Error && pollError.message.includes('MinerU 解析失败')) {
          throw pollError;
        }
        console.warn('[MinerU] Poll exception:', pollError);
      }
    }

    if (!finalResult || finalResult.state !== 'done') {
      throw new Error(`MinerU 解析超时（已等待 ${Math.round((Date.now() - pollStartTime) / 1000)} 秒）`);
    }

    // Step 3: 下载 Markdown
    onProgress({ stage: 'downloading', progress: 85, message: '正在下载解析结果...' });

    let markdown = '';
    const mdUrl = finalResult.fullMarkdownUrl || finalResult.fullZipUrl;

    if (!mdUrl) {
      throw new Error('MinerU 未返回结果下载链接');
    }

    markdown = await downloadMarkdown(mdUrl);

    if (!markdown || markdown.trim().length === 0) {
      throw new Error('MinerU 解析结果为空，可能是扫描件或图片 PDF');
    }

    onProgress({ stage: 'done', progress: 100, message: '解析完成' });

    return {
      markdown,
      fileName,
      pageCount: finalResult.pageCount,
      parseDurationMs: Date.now() - startTime,
      model: options?.model || 'auto',
      fullZipUrl: finalResult.fullZipUrl,
    };
  }

  /**
   * 使用 Agent Lightweight API 解析（无需 Token，适合小文件）
   */
  async function parsePdfLightweight(
    fileData: string,
    fileName: string,
    onProgress?: (progress: PdfUploadProgress) => void,
  ): Promise<ParsedPdfResult> {
    const startTime = Date.now();
    const notify = onProgress || (() => {});

    notify({ stage: 'uploading', progress: 10, message: '正在通过 Agent API 上传 PDF...' });

    // 构建 multipart form
    const fileBuffer = base64ToArrayBuffer(fileData);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const resp = await fetch(`${baseUrl}/api/v1/agent/parse/file`, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Agent parse failed (${resp.status}): ${text}`);
    }

    const data = await resp.json() as any;

    if (data.code !== 0) {
      throw new Error(`Agent parse error: ${data.msg || JSON.stringify(data)}`);
    }

    notify({ stage: 'parsing', progress: 50, message: '正在解析...' });

    // Agent API 可能返回直接的 markdown 或 url
    let markdown = '';

    if (data.data?.markdown) {
      markdown = data.data.markdown;
    } else if (data.data?.url) {
      notify({ stage: 'downloading', progress: 80, message: '正在下载结果...' });
      const mdResp = await fetch(data.data.url);
      if (mdResp.ok) {
        markdown = await mdResp.text();
      }
    }

    if (!markdown) {
      throw new Error('Agent API 未返回解析结果');
    }

    notify({ stage: 'done', progress: 100, message: '解析完成' });

    return {
      markdown,
      fileName,
      parseDurationMs: Date.now() - startTime,
      model: 'agent-lightweight',
    };
  }

  /**
   * 检查 MinerU API 可用性
   */
  async function checkHealth(): Promise<{ available: boolean; message: string }> {
    try {
      // 简单测试：调用 task status 接口（会返回 error 但证明连通性）
      const resp = await fetch(`${baseUrl}/api/v4/extract/task/test-health-check`, {
        method: 'GET',
        headers,
      });
      
      // 任何非网络错误的响应都说明 API 可达
      if (resp.status === 401) {
        return { available: false, message: 'MinerU API Key 无效或已过期' };
      }
      
      return { available: true, message: 'MinerU API 可用' };
    } catch (e) {
      return { available: false, message: `MinerU API 不可达: ${(e as Error).message}` };
    }
  }

  /**
   * 检查 MinerU 任务状态（单次，不轮询）
   * 用于 advance 模式下每次只检查一次状态
   */
  async function checkTaskOnce(taskId: string): Promise<{
    state: 'pending' | 'running' | 'done' | 'failed' | 'unknown';
    fullZipUrl?: string;
    fullMarkdownUrl?: string;
    pageCount?: number;
    errorMessage?: string;
  }> {
    try {
      const resp = await fetch(`${baseUrl}/api/v4/extract/task/${taskId}`, {
        method: 'GET',
        headers,
      });

      if (!resp.ok) {
        console.warn(`[MinerU] checkTaskOnce failed (${resp.status})`);
        return { state: 'unknown' };
      }

      const data = await resp.json() as any;
      if (data.code !== 0) {
        console.warn(`[MinerU] checkTaskOnce error: ${data.msg}`);
        return { state: 'unknown' };
      }

      const state = data.data?.state || 'unknown';
      return {
        state,
        fullZipUrl: data.data?.full_zip_url,
        fullMarkdownUrl: data.data?.full_markdown_url,
        pageCount: data.data?.page_count,
        errorMessage: data.data?.error_message,
      };
    } catch (e) {
      console.warn(`[MinerU] checkTaskOnce exception:`, e);
      return { state: 'unknown' };
    }
  }

  return {
    parsePdf,
    parsePdfLightweight,
    submitTaskByUrl,
    submitTaskByFile,
    pollTaskStatus,
    checkTaskOnce,
    downloadMarkdown,
    checkHealth,
  };
}

// ==================== Utility Functions ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // 移除可能的 data URI 前缀
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 简易 ZIP 解析器 — 从 ZIP 中提取 .md 文件内容
 * 
 * ZIP 文件格式说明：
 * - Local file header: PK\x03\x04
 * - Central directory: PK\x01\x02
 * - End of central directory: PK\x05\x06
 */
function extractMarkdownFromZip(zipBytes: Uint8Array): string | null {
  try {
    // 使用 fflate 解压 ZIP（支持 DEFLATE 压缩方法）
    const decompressed = unzipSync(zipBytes);
    
    const mdFiles: Array<{ name: string; content: string }> = [];
    
    for (const [fileName, fileData] of Object.entries(decompressed)) {
      if (fileName.endsWith('.md') && fileData.length > 0) {
        const content = new TextDecoder('utf-8').decode(fileData);
        mdFiles.push({ name: fileName, content });
        console.log(`[MinerU ZIP] Found .md file: ${fileName} (${fileData.length} bytes)`);
      }
    }
    
    if (mdFiles.length === 0) {
      console.warn('[MinerU ZIP] No .md files found. Files in ZIP:', Object.keys(decompressed).join(', '));
      return null;
    }

    // 优先返回 full_output.md 或最大的 .md 文件
    const fullOutput = mdFiles.find(f => f.name.includes('full_output') || f.name.includes('full'));
    if (fullOutput) return fullOutput.content;

    // 按大小排序，返回最大的
    mdFiles.sort((a, b) => b.content.length - a.content.length);
    return mdFiles[0].content;
  } catch (err) {
    console.error('[MinerU ZIP] Failed to decompress ZIP:', err);
    return null;
  }
}

/**
 * 清理 MinerU 返回的 Markdown，使其更适合 RAG 分块
 */
export function cleanMineruMarkdown(markdown: string): string {
  let cleaned = markdown;

  // 1. 移除多余的空行（保留最多2个连续空行）
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // 2. 清理表格周围的空行
  cleaned = cleaned.replace(/\n{3,}(\|)/g, '\n\n$1');
  cleaned = cleaned.replace(/(\|)\n{3,}/g, '$1\n\n');

  // 3. 标准化标题格式
  cleaned = cleaned.replace(/^(#{1,6})\s*\n+/gm, '$1 ');

  // 4. 移除 MinerU 插入的页码标记（但保留用于页码追踪的注释）
  // 注意：不再移除 <!-- page: N --> 注释，extractStructuredBlocks 需要它
  cleaned = cleaned.replace(/\[page\s*\d+\]/gi, '');

  // 5. 移除可能的图片占位符（保留图片描述）
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match: string, alt: string) => {
    if (alt && alt.trim()) {
      return `[图片: ${alt.trim()}]`;
    }
    return '';
  });

  // 6. 清理首尾空白
  cleaned = cleaned.trim();

  return cleaned;
}

// ==================== 结构化块提取（需求 ①②） ====================

/**
 * 结构化块类型
 */
export interface StructuredBlock {
  /** 块类型 */
  type: 'text' | 'table' | 'heading';
  /** 内容（text 和 heading 为原文，table 为 HTML） */
  content: string;
  /** Markdown 原文（table 保留原始 Markdown 用于对照） */
  rawMarkdown?: string;
  /** 估算起始页码 */
  pageStart?: number;
  /** 估算结束页码 */
  pageEnd?: number;
  /** 所属章节标题 */
  heading?: string;
  /** 章节层级 (1-6) */
  headingLevel?: number;
  /** 表格序号（在文档内的第几个表格，从 1 开始） */
  tableIndex?: number;
  /** 表格标题/说明（表格紧邻上方的文本行） */
  tableCaption?: string;
}

/**
 * 从 MinerU 的 Markdown 中提取结构化块
 *
 * 识别规则：
 * - 标题行：# / ## / ### ...
 * - 表格块：连续的 | 开头的行
 * - 文本块：其余内容
 * - 页码追踪：<!-- page: N --> 注释
 *
 * 每个块附带 page / heading 上下文，供后续分块时作为 metadata
 */
/**
 * 中文财报章节标题模式
 * 匹配 "第一节 重要提示"、"第二节  公司简介" 等（支持中文数字和阿拉伯数字）
 */
const CN_SECTION_REGEX = /^第[一二三四五六七八九十\d]+节\s*.+/;

/**
 * 中文子章节标题模式
 * 匹配 "一、"、"（一）"、"1、"、"1."、"（1）" 等常见编号模式
 */
const CN_SUBSECTION_REGEX = /^(?:[一二三四五六七八九十]+、|（[一二三四五六七八九十\d]+）|\d+[、.．]\s*\S)/;

/**
 * 检测行是否是 HTML 表格内容（MinerU 直接输出 HTML 表格而非 Markdown 管道格式）
 */
const HTML_TABLE_LINE_REGEX = /^\s*<\/?(?:table|tr|td|th|thead|tbody|tfoot)\b/i;

/**
 * 检测 HTML 表格开始标签
 */
const HTML_TABLE_START_REGEX = /^\s*<table\b/i;

/**
 * 检测 HTML 表格结束标签（可能在行中任意位置）
 */
const HTML_TABLE_END_REGEX = /<\/table\s*>/i;

export function extractStructuredBlocks(markdown: string): StructuredBlock[] {
  const lines = markdown.split('\n');
  const blocks: StructuredBlock[] = [];

  let currentPage = 1;
  let currentHeading = '';
  let currentHeadingLevel = 0;
  let tableCounter = 0;
  let hasPageMarkers = false;

  // 预扫描：检测是否有 MinerU 页码标记
  const totalChars = markdown.length;
  for (const line of lines) {
    if (/<!--\s*page\s*:\s*\d+\s*-->/i.test(line)) {
      hasPageMarkers = true;
      break;
    }
  }

  // 如果没有页码标记，使用字符位置估算页码（中文财报约 2000-3000 字/页）
  const CHARS_PER_PAGE = 2500;
  let charCounter = 0;

  let textBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let htmlTableBuffer: string[] = [];
  let htmlTableDepth = 0; // 追踪 <table> 嵌套深度
  let tableStartPage = 1;
  let textStartPage = 1;

  /** 估算当前页码 */
  function estimatePage(): number {
    if (hasPageMarkers) return currentPage;
    return Math.max(1, Math.ceil(charCounter / CHARS_PER_PAGE));
  }

  /** 刷新文本缓冲区 → 生成 text block */
  function flushText() {
    const text = textBuffer.join('\n').trim();
    if (text.length > 0) {
      blocks.push({
        type: 'text',
        content: text,
        pageStart: textStartPage,
        pageEnd: estimatePage(),
        heading: currentHeading || undefined,
        headingLevel: currentHeadingLevel || undefined,
      });
    }
    textBuffer = [];
    textStartPage = estimatePage();
  }

  /** 刷新 Markdown 管道表格缓冲区 → 生成 table block (HTML) */
  function flushMdTable() {
    if (tableBuffer.length === 0) return;

    const rawMd = tableBuffer.join('\n').trim();
    const html = markdownTableToHtml(rawMd);
    tableCounter++;

    const caption = findTableCaption();

    blocks.push({
      type: 'table',
      content: html,
      rawMarkdown: rawMd,
      pageStart: tableStartPage,
      pageEnd: estimatePage(),
      heading: currentHeading || undefined,
      headingLevel: currentHeadingLevel || undefined,
      tableIndex: tableCounter,
      tableCaption: caption || undefined,
    });

    tableBuffer = [];
  }

  /** 刷新 HTML 表格缓冲区（MinerU 直接输出的 HTML 表格） */
  function flushHtmlTable() {
    if (htmlTableBuffer.length === 0) return;

    const html = htmlTableBuffer.join('\n').trim();
    // 确保有完整的 <table> 标签
    const content = html.includes('<table') ? html : `<table>${html}</table>`;
    tableCounter++;

    const caption = findTableCaption();

    blocks.push({
      type: 'table',
      content,
      pageStart: tableStartPage,
      pageEnd: estimatePage(),
      heading: currentHeading || undefined,
      headingLevel: currentHeadingLevel || undefined,
      tableIndex: tableCounter,
      tableCaption: caption || undefined,
    });

    htmlTableBuffer = [];
    htmlTableDepth = 0;
  }

  /** 查找表格标题：表格上方紧邻的非空文本行 */
  function findTableCaption(): string {
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type === 'text') {
        const lastLine = blocks[i].content.split('\n').pop()?.trim() || '';
        if (lastLine && (
          /^[表图][\s\d]/.test(lastLine) ||
          /^Table\s/i.test(lastLine) ||
          /[：:]$/.test(lastLine) ||
          /单位[：:]/.test(lastLine) ||
          lastLine.length < 60
        )) {
          return lastLine;
        }
        break;
      }
    }
    return '';
  }

  /** 检测中文财报章节标题 */
  function detectChineseHeading(line: string): { level: number; text: string } | null {
    const trimmed = line.trim();
    if (CN_SECTION_REGEX.test(trimmed)) {
      return { level: 1, text: trimmed };
    }
    if (CN_SUBSECTION_REGEX.test(trimmed) && trimmed.length < 80) {
      // 避免将普通段落首句误判为标题
      return { level: 2, text: trimmed };
    }
    return null;
  }

  for (const line of lines) {
    charCounter += line.length + 1; // +1 for \n

    // ─── 1. 检测 MinerU 页码注释 <!-- page: N --> ───
    const pageMatch = line.match(/<!--\s*page\s*:\s*(\d+)\s*-->/i);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1], 10);
      continue;
    }

    // ─── 2. 如果在 HTML 表格收集中，继续收集直到 </table> ───
    if (htmlTableDepth > 0) {
      htmlTableBuffer.push(line);
      // 计算 <table> 和 </table> 标签来追踪嵌套
      const opens = (line.match(/<table\b/gi) || []).length;
      const closes = (line.match(/<\/table\s*>/gi) || []).length;
      htmlTableDepth += opens - closes;
      if (htmlTableDepth <= 0) {
        htmlTableDepth = 0;
        flushHtmlTable();
      }
      continue;
    }

    // ─── 3. 检测 HTML 表格开始 <table> ───
    if (HTML_TABLE_START_REGEX.test(line)) {
      // 先刷新文本和 Markdown 表格
      if (tableBuffer.length > 0) flushMdTable();
      flushText();
      tableStartPage = estimatePage();

      htmlTableBuffer.push(line);
      const opens = (line.match(/<table\b/gi) || []).length;
      const closes = (line.match(/<\/table\s*>/gi) || []).length;
      htmlTableDepth = opens - closes;

      if (htmlTableDepth <= 0) {
        // 整个表格在一行内（常见于 MinerU 输出）
        htmlTableDepth = 0;
        flushHtmlTable();
      }
      continue;
    }

    // ─── 4. 检测 Markdown # 标题行 ───
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (tableBuffer.length > 0) flushMdTable();
      flushText();

      currentHeadingLevel = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();

      blocks.push({
        type: 'heading',
        content: currentHeading,
        pageStart: estimatePage(),
        pageEnd: estimatePage(),
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      textStartPage = estimatePage();
      continue;
    }

    // ─── 5. 检测中文财报章节标题 ───
    const cnHeading = detectChineseHeading(line);
    if (cnHeading && tableBuffer.length === 0) {
      flushText();

      currentHeadingLevel = cnHeading.level;
      currentHeading = cnHeading.text;

      blocks.push({
        type: 'heading',
        content: currentHeading,
        pageStart: estimatePage(),
        pageEnd: estimatePage(),
        heading: currentHeading,
        headingLevel: currentHeadingLevel,
      });
      textStartPage = estimatePage();
      continue;
    }

    // ─── 6. 检测 Markdown 管道表格行 ───
    const isTableLine = /^\s*\|/.test(line);

    if (isTableLine) {
      if (tableBuffer.length === 0) {
        flushText();
        tableStartPage = estimatePage();
      }
      tableBuffer.push(line);
    } else {
      if (tableBuffer.length > 0) {
        flushMdTable();
      }
      if (textBuffer.length === 0) {
        textStartPage = estimatePage();
      }
      textBuffer.push(line);
    }
  }

  // 清空剩余缓冲区
  if (tableBuffer.length > 0) flushMdTable();
  if (htmlTableBuffer.length > 0) flushHtmlTable();
  flushText();

  console.log(`[StructuredBlocks] Extracted ${blocks.length} blocks: ` +
    `${blocks.filter(b => b.type === 'heading').length} headings, ` +
    `${blocks.filter(b => b.type === 'table').length} tables, ` +
    `${blocks.filter(b => b.type === 'text').length} text ` +
    `(pageMarkers=${hasPageMarkers})`);

  return blocks;
}

/**
 * 将 Markdown 表格转换为 HTML <table>
 *
 * 输入格式：
 *   | 列1 | 列2 | 列3 |
 *   |-----|-----|-----|
 *   | A   | B   | C   |
 *
 * 输出格式：
 *   <table><thead><tr><th>列1</th>...</tr></thead><tbody><tr><td>A</td>...</tr></tbody></table>
 */
export function markdownTableToHtml(mdTable: string): string {
  const lines = mdTable.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return `<table><tbody><tr><td>${mdTable}</td></tr></tbody></table>`;

  const parseRow = (line: string): string[] => {
    return line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map(cell => cell.trim());
  };

  // 检测对齐行（如 |---|:---:|---:|）
  const isSeparator = (line: string): boolean => {
    return /^\s*\|[\s\-:|]+\|\s*$/.test(line);
  };

  let headerRow: string[] | null = null;
  const bodyRows: string[][] = [];
  let foundSeparator = false;

  for (let i = 0; i < lines.length; i++) {
    if (isSeparator(lines[i])) {
      foundSeparator = true;
      // 第一行就是 header
      if (i > 0 && !headerRow) {
        headerRow = parseRow(lines[i - 1]);
      }
      continue;
    }

    if (foundSeparator || (i > 0 && headerRow)) {
      bodyRows.push(parseRow(lines[i]));
    } else if (i === 0) {
      // 暂存第一行，可能是 header
      headerRow = parseRow(lines[i]);
    } else if (!foundSeparator) {
      bodyRows.push(parseRow(lines[i]));
    }
  }

  // 如果没找到分隔线，第一行也当 body 处理
  if (!foundSeparator && headerRow) {
    bodyRows.unshift(headerRow);
    headerRow = null;
  }

  let html = '<table>';

  if (headerRow) {
    html += '<thead><tr>';
    for (const cell of headerRow) {
      html += `<th>${escapeHtmlStr(cell)}</th>`;
    }
    html += '</tr></thead>';
  }

  html += '<tbody>';
  for (const row of bodyRows) {
    html += '<tr>';
    for (const cell of row) {
      html += `<td>${escapeHtmlStr(cell)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  return html;
}

function escapeHtmlStr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 估算 PDF 文件大小是否在限制范围内
 */
export function validatePdfSize(base64Data: string): {
  valid: boolean;
  sizeBytes: number;
  sizeMB: number;
  error?: string;
} {
  // Base64 编码后大小约为原始的 4/3
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const sizeBytes = Math.ceil(cleanBase64.length * 3 / 4);
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      valid: false,
      sizeBytes,
      sizeMB,
      error: `PDF 文件大小 ${sizeMB.toFixed(1)} MB 超过限制 (${MAX_FILE_SIZE / 1024 / 1024} MB)`,
    };
  }

  return { valid: true, sizeBytes, sizeMB };
}
