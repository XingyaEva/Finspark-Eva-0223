/**
 * 巨潮资讯网 (CNInfo) 财报 PDF 检索与下载服务
 *
 * 使用巨潮资讯网公开 API 搜索上市公司公告/财报 PDF，并下载供 RAG 入库。
 * 
 * API 说明：
 * - 公告搜索：http://www.cninfo.com.cn/api/sysapi/p_sysapi1137 (已改为 new.cninfo.com.cn)
 * - 替代方案：http://www.cninfo.com.cn/new/hisAnnouncement/query (公开免费)
 * - PDF 下载：http://static.cninfo.com.cn/finalpage/{announcementId}.PDF
 *
 * 财报类型映射：
 * - 年报 → category: "category_ndbg_szsh" (年度报告)
 * - 半年报 → category: "category_bndbg_szsh" (半年度报告)
 * - 一季报 → category: "category_yjdbg_szsh" (第一季度报告)
 * - 三季报 → category: "category_sjdbg_szsh" (第三季度报告)
 */

// ==================== 类型 ====================

export interface CninfoConfig {
  /** 请求超时（ms），默认 15000 */
  timeoutMs?: number;
}

export interface CninfoAnnouncement {
  /** 公告ID (用于拼接下载链接) */
  announcementId: string;
  /** 公告标题 */
  announcementTitle: string;
  /** 公告时间 (YYYY-MM-DD) */
  announcementTime: string;
  /** 公告类型 */
  announcementType: string;
  /** 证券代码 */
  secCode: string;
  /** 证券简称 */
  secName: string;
  /** PDF 下载路径（相对路径） */
  adjunctUrl: string;
  /** 附件大小（字节） */
  adjunctSize?: number;
  /** 组织 ID */
  orgId?: string;
}

export interface CninfoSearchResult {
  /** 搜索到的公告列表 */
  announcements: CninfoAnnouncement[];
  /** 是否有更多结果 */
  hasMore: boolean;
  /** 总记录数 */
  totalCount: number;
}

export interface CninfoReportMeta {
  /** 股票代码 (如 "600519") */
  stockCode: string;
  /** 股票名称 */
  stockName: string;
  /** 报告类型 */
  reportType: 'annual' | 'semi_annual' | 'q1' | 'q3';
  /** 报告年份 */
  reportYear: number;
  /** 公告ID */
  announcementId: string;
  /** 公告标题 */
  title: string;
  /** PDF 下载 URL */
  pdfUrl: string;
  /** 发布日期 */
  publishDate: string;
  /** 文件大小 */
  fileSize?: number;
}

// ==================== Constants ====================

const CNINFO_BASE_URL = 'http://www.cninfo.com.cn';
const CNINFO_STATIC_URL = 'http://static.cninfo.com.cn';
const DEFAULT_TIMEOUT_MS = 15000;

/** 巨潮公告分类代码 */
const REPORT_CATEGORY_MAP: Record<string, string> = {
  annual: 'category_ndbg_szsh',      // 年度报告
  semi_annual: 'category_bndbg_szsh', // 半年度报告
  q1: 'category_yjdbg_szsh',          // 第一季度报告
  q3: 'category_sjdbg_szsh',          // 第三季度报告
};

/** 反向映射：从公告标题推断报告类型 */
function inferReportType(title: string): 'annual' | 'semi_annual' | 'q1' | 'q3' | null {
  if (/年度报告|年报/.test(title) && !/半年/.test(title)) return 'annual';
  if (/半年度报告|半年报/.test(title)) return 'semi_annual';
  if (/第一季度|一季报/.test(title)) return 'q1';
  if (/第三季度|三季报/.test(title)) return 'q3';
  return null;
}

/** 从公告标题提取报告年份 */
function inferReportYear(title: string, publishDate: string): number {
  // 尝试从标题中提取年份，如 "2024年年度报告"
  const yearMatch = title.match(/(\d{4})\s*年/);
  if (yearMatch) return parseInt(yearMatch[1], 10);
  
  // 否则从发布日期推断
  const pubYear = parseInt(publishDate.slice(0, 4), 10);
  // 年报通常在次年发布
  if (/年度报告|年报/.test(title)) return pubYear - 1;
  return pubYear;
}

// ==================== Service ====================

/**
 * 创建巨潮资讯 API 服务
 */
export function createCninfoService(config?: CninfoConfig) {
  const timeoutMs = config?.timeoutMs || DEFAULT_TIMEOUT_MS;

  /**
   * 搜索公告（使用巨潮公开 hisAnnouncement 接口）
   * 
   * @param stockCode 股票代码（如 "600519" 或 "000858"）
   * @param options 搜索选项
   */
  async function searchAnnouncements(
    stockCode: string,
    options?: {
      /** 报告类型 */
      reportType?: 'annual' | 'semi_annual' | 'q1' | 'q3';
      /** 搜索关键词（可选，额外过滤） */
      keyword?: string;
      /** 页码（从 1 开始） */
      page?: number;
      /** 每页数量 */
      pageSize?: number;
      /** 开始日期 YYYY-MM-DD */
      startDate?: string;
      /** 结束日期 YYYY-MM-DD */
      endDate?: string;
    }
  ): Promise<CninfoSearchResult> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;

    // 构建请求参数
    // 注意：巨潮 API 的 stock 参数不稳定，使用 searchkey 代替以确保可靠搜索
    const formData = new URLSearchParams();
    formData.append('searchkey', stockCode);
    formData.append('pageNum', String(page));
    formData.append('pageSize', String(pageSize));
    formData.append('tabName', 'fulltext'); // 全文搜索

    // 公告类别
    if (options?.reportType) {
      const category = REPORT_CATEGORY_MAP[options.reportType];
      if (category) {
        formData.append('category', category);
      }
    }

    // 日期范围
    if (options?.startDate) {
      formData.append('seDate', `${options.startDate}~${options.endDate || ''}`);
    }

    // 额外关键词
    if (options?.keyword) {
      // 追加到 searchkey
      formData.set('searchkey', `${stockCode} ${options.keyword}`);
    }

    console.log(`[CNInfo] Searching announcements for ${stockCode}, type=${options?.reportType || 'all'}`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(`${CNINFO_BASE_URL}/new/hisAnnouncement/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; Finspark/1.0)',
          'Accept': 'application/json',
        },
        body: formData.toString(),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        throw new Error(`CNInfo API error: ${resp.status}`);
      }

      const data = await resp.json() as any;
      
      const announcements: CninfoAnnouncement[] = (data.announcements || []).map((a: any) => ({
        announcementId: a.announcementId || '',
        announcementTitle: a.announcementTitle || '',
        announcementTime: formatCninfoDate(a.announcementTime),
        announcementType: a.announcementType || '',
        secCode: a.secCode || stockCode,
        secName: a.secName || '',
        adjunctUrl: a.adjunctUrl || '',
        adjunctSize: a.adjunctSize,
        orgId: a.orgId,
      }));

      return {
        announcements,
        hasMore: data.hasMore === true,
        totalCount: data.totalAnnouncement || announcements.length,
      };
    } catch (error) {
      console.error('[CNInfo] Search failed:', error);
      throw new Error(`巨潮公告搜索失败: ${error instanceof Error ? error.message : '网络错误'}`);
    }
  }

  /**
   * 搜索指定股票的财报 PDF
   * 
   * @param stockCode 股票代码
   * @param reportType 报告类型
   * @param year 可选，指定年份
   */
  async function searchFinancialReports(
    stockCode: string,
    reportType?: 'annual' | 'semi_annual' | 'q1' | 'q3',
    year?: number
  ): Promise<CninfoReportMeta[]> {
    // 搜索最近的公告
    const result = await searchAnnouncements(stockCode, {
      reportType,
      pageSize: 30,
      startDate: year ? `${year}-01-01` : undefined,
      endDate: year ? `${year + 1}-12-31` : undefined,
    });

    // 将公告转换为报告元数据
    const reports: CninfoReportMeta[] = [];

    for (const ann of result.announcements) {
      // 过滤：确保属于目标股票（searchkey 可能返回多只股票的结果）
      if (ann.secCode && ann.secCode !== stockCode) continue;

      const type = reportType || inferReportType(ann.announcementTitle);
      if (!type) continue; // 无法识别类型的跳过

      // 过滤掉摘要、更正、补充、英文版公告
      if (/摘要|更正|补充|取消|延期|修订|英文版/.test(ann.announcementTitle)) continue;

      const reportYear = year || inferReportYear(ann.announcementTitle, ann.announcementTime);
      
      // 构建 PDF 下载链接
      // adjunctUrl 格式: "finalpage/2025-04-03/1222993920.PDF" (已含 finalpage 前缀)
      const pdfUrl = ann.adjunctUrl
        ? `${CNINFO_STATIC_URL}/${ann.adjunctUrl}`
        : `${CNINFO_STATIC_URL}/finalpage/${ann.announcementId}.PDF`;

      reports.push({
        stockCode: ann.secCode || stockCode,
        stockName: ann.secName,
        reportType: type,
        reportYear,
        announcementId: ann.announcementId,
        title: ann.announcementTitle,
        pdfUrl,
        publishDate: ann.announcementTime,
        fileSize: ann.adjunctSize,
      });
    }

    // 按年份降序排列
    reports.sort((a, b) => b.reportYear - a.reportYear);

    console.log(`[CNInfo] Found ${reports.length} reports for ${stockCode}`);
    return reports;
  }

  /**
   * 下载 PDF 文件内容（返回 Base64）
   * 
   * @param pdfUrl PDF 下载链接
   * @param maxSizeMB 最大文件大小（MB），默认 100
   */
  async function downloadPdf(
    pdfUrl: string,
    maxSizeMB: number = 100
  ): Promise<{ base64: string; sizeBytes: number }> {
    console.log(`[CNInfo] Downloading PDF: ${pdfUrl}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000); // 60s timeout for download

    try {
      const resp = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Finspark/1.0)',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        throw new Error(`PDF 下载失败: HTTP ${resp.status}`);
      }

      const contentType = resp.headers.get('Content-Type') || '';
      if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
        console.warn(`[CNInfo] Unexpected content type: ${contentType}`);
      }

      const buffer = await resp.arrayBuffer();
      const sizeBytes = buffer.byteLength;
      const sizeMB = sizeBytes / (1024 * 1024);

      if (sizeMB > maxSizeMB) {
        throw new Error(`PDF 文件过大: ${sizeMB.toFixed(1)} MB (限制 ${maxSizeMB} MB)`);
      }

      // 转换为 Base64
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      console.log(`[CNInfo] Downloaded PDF: ${sizeMB.toFixed(1)} MB`);
      return { base64, sizeBytes };
    } catch (error) {
      clearTimeout(timer);
      throw new Error(`PDF 下载失败: ${error instanceof Error ? error.message : '网络错误'}`);
    }
  }

  /**
   * 检查 CNInfo API 可用性
   */
  async function checkHealth(): Promise<{ available: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${CNINFO_BASE_URL}/new/hisAnnouncement/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; Finspark/1.0)',
        },
        body: 'stock=600519&pageNum=1&pageSize=1&tabName=fulltext',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (resp.ok) {
        return { available: true, message: '巨潮资讯 API 可用' };
      }

      return { available: false, message: `巨潮资讯 API 返回 ${resp.status}` };
    } catch (error) {
      return {
        available: false,
        message: `巨潮资讯 API 不可达: ${(error as Error).message}`,
      };
    }
  }

  return {
    searchAnnouncements,
    searchFinancialReports,
    downloadPdf,
    checkHealth,
  };
}

// ==================== Utility ====================

/**
 * 格式化巨潮时间戳为 YYYY-MM-DD
 * 巨潮返回的时间可能是毫秒时间戳或日期字符串
 */
function formatCninfoDate(raw: any): string {
  if (!raw) return '';
  
  if (typeof raw === 'number') {
    return new Date(raw).toISOString().slice(0, 10);
  }
  
  if (typeof raw === 'string') {
    // 如果已经是 YYYY-MM-DD 格式
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    // 如果是时间戳字符串
    const ts = parseInt(raw, 10);
    if (!isNaN(ts) && ts > 1e12) return new Date(ts).toISOString().slice(0, 10);
  }
  
  return String(raw);
}

export type CninfoService = ReturnType<typeof createCninfoService>;
