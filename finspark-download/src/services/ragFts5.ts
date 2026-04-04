/**
 * FTS5 全文检索服务 — services/ragFts5.ts
 *
 * 替换 ragBm25.ts 的自建倒排索引。
 * 
 * 优势：
 * - SQLite FTS5 原生 BM25 评分，单次 MATCH 查询完成
 * - 触发器自动同步（INSERT/DELETE/UPDATE rag_chunks 时 FTS5 自动更新）
 * - 支持前缀查询、短语查询、布尔运算（AND/OR/NOT）
 * - 无需手动构建/维护倒排索引
 *
 * 限制：
 * - unicode61 tokenizer 对中文按字符切分（非词级别），查全率靠短语匹配补偿
 * - D1 export 不支持含虚拟表的数据库（需临时 DROP 后导出）
 */

// ==================== 类型定义 ====================

export interface FTS5SearchResult {
  chunkId: number;
  documentId: number;
  score: number;       // FTS5 bm25() 返回的相关性分数（已取绝对值）
  content: string;
  snippet: string;     // FTS5 snippet() 高亮片段
}

export interface FTS5IndexStats {
  totalRows: number;
  isReady: boolean;
}

// ==================== 金融领域短语词典 ====================
// 中文复合词在 unicode61 下会被按字拆分，短语匹配可保证精确度

const FINANCIAL_PHRASES = [
  '营业收入', '净利润', '毛利率', '净利率', '营收增速',
  '总资产', '净资产', '资产负债率', '流动比率', '速动比率',
  '每股收益', '市盈率', '市净率', '股息率',
  '经营现金流', '现金流量', '资本支出', '自由现金流',
  '应收账款', '存货', '商誉', '无形资产', '长期借款',
  '短期借款', '研发费用', '管理费用', '销售费用', '财务费用',
  '同比增长', '环比增长', '同比下降', '环比下降',
  '贵州茅台', '五粮液', '泸州老窖', '洋河股份',
  '年度报告', '招股说明书', '投资收益', '营业利润',
  '利润总额', '所得税', '少数股东', '归母净利润',
  '经营活动', '投资活动', '筹资活动', '货币资金',
  '固定资产', '在建工程', '长期股权投资', '其他应收款',
  '预付账款', '预收账款', '合同负债', '递延所得税',
];

// ==================== FTS5 Service ====================

export class FTS5Service {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // ==================== 全文检索 ====================

  /**
   * FTS5 全文检索
   *
   * 单次 SQL 完成：MATCH 查询 + bm25() 评分 + JOIN 获取元数据
   * 延迟：通常 <50ms（vs 旧 BM25 方案 4-5 次查询 >500ms）
   *
   * @param query 用户查询文本
   * @param options 检索选项
   */
  async search(
    query: string,
    options: {
      topK?: number;
      documentIds?: number[];
      stockCode?: string;
      minScore?: number;
    } = {}
  ): Promise<FTS5SearchResult[]> {
    const { topK = 10, documentIds, stockCode, minScore = 0.0 } = options;

    // 1. 构建 FTS5 MATCH 查询
    const ftsQuery = this.buildFTS5Query(query);
    if (!ftsQuery) return [];

    // 2. 单次 SQL：FTS5 MATCH + bm25() + JOIN chunk/document
    let sql = `
      SELECT
        f.rowid AS chunk_id,
        c.document_id,
        bm25(rag_chunks_fts) AS score,
        c.content,
        snippet(rag_chunks_fts, 0, '【', '】', '...', 32) AS snippet
      FROM rag_chunks_fts f
      JOIN rag_chunks c ON c.id = f.rowid
      JOIN rag_documents d ON d.id = c.document_id
      WHERE rag_chunks_fts MATCH ?
        AND d.status = 'completed'
    `;
    const binds: any[] = [ftsQuery];

    // 可选过滤条件
    if (documentIds && documentIds.length > 0) {
      const placeholders = documentIds.map(() => '?').join(',');
      sql += ` AND c.document_id IN (${placeholders})`;
      binds.push(...documentIds);
    }
    if (stockCode) {
      sql += ` AND d.stock_code = ?`;
      binds.push(stockCode);
    }

    // bm25() 返回负数（越小越相关），ORDER BY score ASC
    sql += ` ORDER BY score LIMIT ?`;
    binds.push(topK);

    try {
      const result = await this.db.prepare(sql).bind(...binds).all();
      
      return (result.results || [])
        .map((r: any) => ({
          chunkId: r.chunk_id as number,
          documentId: r.document_id as number,
          score: Math.abs(r.score as number),  // 转正数，与向量分数方向一致
          content: r.content as string,
          snippet: r.snippet as string,
        }))
        .filter(r => r.score >= minScore);
    } catch (error) {
      // FTS5 表可能不存在（未执行 migration）或查询语法错误
      console.error('[FTS5] Search failed:', error);
      return [];
    }
  }

  // ==================== 查询构建 ====================

  /**
   * 构建 FTS5 MATCH 查询表达式
   *
   * 策略：
   * 1. 清洗特殊字符（FTS5 语法保留字符）
   * 2. 识别金融复合词 → 用引号包裹做短语匹配
   * 3. 剩余词用空格连接（FTS5 默认隐式 AND）
   * 
   * 示例：
   *   "贵州茅台2024年净利润" → '"贵州茅台" "净利润" 2024年'
   *   "营业收入同比增长" → '"营业收入" "同比增长"'
   */
  private buildFTS5Query(query: string): string {
    if (!query || query.trim().length === 0) return '';

    // 清洗 FTS5 特殊字符（保留中文、字母、数字、空格、引号）
    let cleaned = query
      .replace(/[""'']/g, '"')      // 统一引号
      .replace(/[(){}[\]^~*:]/g, ' ') // 移除 FTS5 特殊运算符
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return '';

    // 识别并替换金融复合词为短语匹配
    for (const phrase of FINANCIAL_PHRASES) {
      if (cleaned.includes(phrase)) {
        // 替换为 FTS5 短语查询 "..."
        cleaned = cleaned.replace(phrase, `"${phrase}"`);
      }
    }

    // 确保结果不为空
    const result = cleaned.trim();
    if (!result) return '';

    return result;
  }

  // ==================== 索引管理 ====================

  /**
   * 检查 FTS5 索引是否可用
   */
  async isReady(): Promise<boolean> {
    try {
      const r = await this.db
        .prepare('SELECT COUNT(*) AS cnt FROM rag_chunks_fts')
        .first<{ cnt: number }>();
      return (r?.cnt || 0) > 0;
    } catch {
      // 表不存在或其他错误
      return false;
    }
  }

  /**
   * 获取 FTS5 索引统计信息
   */
  async getStats(): Promise<FTS5IndexStats> {
    try {
      const r = await this.db
        .prepare('SELECT COUNT(*) AS cnt FROM rag_chunks_fts')
        .first<{ cnt: number }>();
      const totalRows = r?.cnt || 0;
      return { totalRows, isReady: totalRows > 0 };
    } catch {
      return { totalRows: 0, isReady: false };
    }
  }

  /**
   * 手动重建 FTS5 索引（回填所有 rag_chunks 数据）
   * 用于 migration 后或索引损坏时
   */
  async rebuildIndex(): Promise<{ rowsInserted: number }> {
    try {
      // 清空现有 FTS5 数据
      await this.db.prepare("DELETE FROM rag_chunks_fts").run();

      // 回填
      const result = await this.db.prepare(`
        INSERT INTO rag_chunks_fts(rowid, content)
        SELECT id, content
        FROM rag_chunks
        WHERE content IS NOT NULL AND content != ''
      `).run();

      const rowsInserted = result.meta.changes || 0;
      console.log(`[FTS5] Index rebuilt: ${rowsInserted} rows inserted`);
      return { rowsInserted };
    } catch (error) {
      console.error('[FTS5] Rebuild failed:', error);
      throw error;
    }
  }

  /**
   * 优化 FTS5 索引（合并内部 b-tree 段）
   * 建议定期执行（如每周），减少碎片
   */
  async optimize(): Promise<void> {
    try {
      await this.db.prepare(
        "INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES ('optimize')"
      ).run();
      console.log('[FTS5] Index optimized');
    } catch (error) {
      console.error('[FTS5] Optimize failed:', error);
    }
  }
}

// ==================== 工厂函数 ====================

export function createFTS5Service(db: D1Database): FTS5Service {
  return new FTS5Service(db);
}
