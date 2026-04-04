/**
 * BM25 检索服务 — services/ragBm25.ts
 *
 * 基于 D1 倒排索引实现 BM25Okapi 关键词检索。
 * 分词方案：Intl.Segmenter('zh-CN', { granularity: 'word' }) — Workers 原生支持，无需第三方依赖。
 *
 * 主要职责：
 * 1. 中文分词 + 停用词过滤
 * 2. 为指定文档构建 BM25 倒排索引（写入 rag_bm25_tokens 表）
 * 3. BM25Okapi 检索 + 排序
 * 4. 索引生命周期管理（构建/删除/元数据更新）
 */

// ==================== 类型定义 ====================

export interface BM25Config {
  k1: number;   // TF 饱和参数，默认 1.5
  b: number;    // 长度归一化参数，默认 0.75
}

export interface BM25SearchResult {
  chunkId: number;
  documentId: number;
  score: number;
  content: string;
  matchedTokens: string[];
}

export interface BM25IndexStats {
  tokenCount: number;
  chunkCount: number;
}

// ==================== 停用词表 ====================
// 高频中文停用词 + 英文停用词 + 标点 (~200 个)

const STOP_WORDS = new Set([
  // 高频虚词
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
  '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
  '们', '那', '些', '什么', '多', '为', '所以', '对', '出', '来',
  '把', '个', '从', '以', '但', '却', '因为', '所', '向', '与',
  '如果', '而', '被', '能', '让', '它', '还', '虽然', '只是',
  '已经', '没', '又', '或者', '这个', '那个', '这些', '那些',
  '之', '等', '其', '只', '于', '将', '已', '可以', '并', '该',
  '而且', '更', '比', '如', '下', '其他', '各', '按', '或',
  '关于', '通过', '还是', '不是', '可能', '因此', '之后', '主要',
  '进行', '以及', '此外', '由于', '应该', '但是', '如何',
  '目前', '其中', '然后', '需要', '使用', '以下', '相关',
  '根据', '包括', '那么', '这样', '同时', '如下',
  // 英文停用词
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'or', 'if', 'while', 'about', 'up', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom',
  // 金融领域常见但无检索意义的词
  '公司', '报告', '数据', '情况', '方面',
]);

// 金融领域高频专有复合词（用于补充分词质量）
const FINANCIAL_TERMS = new Set([
  '营业收入', '净利润', '毛利率', '净利率', '营收增速',
  '总资产', '净资产', '资产负债率', '流动比率', '速动比率',
  '每股收益', '市盈率', '市净率', '股息率', '分红',
  '经营现金流', '现金流量', '资本支出', '自由现金流',
  '应收账款', '存货', '商誉', '无形资产', '长期借款',
  '短期借款', '研发费用', '管理费用', '销售费用', '财务费用',
  '贵州茅台', '五粮液', '泸州老窖', '洋河股份',
  '年报', '半年报', '季报', '年度报告', '招股说明书',
  '同比增长', '环比增长', '同比下降', '环比下降',
]);

// ==================== BM25 Service ====================

export class BM25Service {
  private db: D1Database;
  private config: BM25Config;
  private segmenter: Intl.Segmenter;

  constructor(db: D1Database, config?: Partial<BM25Config>) {
    this.db = db;
    this.config = {
      k1: config?.k1 ?? 1.5,
      b: config?.b ?? 0.75,
    };
    this.segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  }

  // ==================== 分词 ====================

  /**
   * 中文分词：Intl.Segmenter + 停用词过滤 + 金融专有词补充
   *
   * 策略：
   * 1. Intl.Segmenter 基础分词（isWordLike 过滤标点/空格）
   * 2. 过滤停用词 + 长度 < 2 的 token
   * 3. 扫描金融专有复合词（如"营业收入"），若原文包含则额外追加
   */
  tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    const normalizedText = text.toLowerCase().trim();

    // 基础分词
    const segments = this.segmenter.segment(normalizedText);
    const tokens: string[] = [];

    for (const seg of segments) {
      if (!seg.isWordLike) continue;
      const token = seg.segment.trim();
      // 过滤：停用词、长度 < 2（单字中文无检索意义）、纯数字保留但过滤单位符号
      if (token.length < 2) continue;
      if (STOP_WORDS.has(token)) continue;
      tokens.push(token);
    }

    // 补充金融专有复合词
    for (const term of FINANCIAL_TERMS) {
      if (normalizedText.includes(term) && !tokens.includes(term)) {
        tokens.push(term);
      }
    }

    return tokens;
  }

  // ==================== 索引构建 ====================

  /**
   * 为指定文档构建 BM25 倒排索引
   * 分批 INSERT 避免 D1 并发写入锁
   */
  async buildIndexForDocument(documentId: number): Promise<BM25IndexStats> {
    // 1. 清理旧索引
    await this.deleteIndexForDocument(documentId);

    // 2. 获取文档所有 Chunk
    const chunksResult = await this.db.prepare(
      'SELECT id, content FROM rag_chunks WHERE document_id = ?'
    ).bind(documentId).all();

    const chunks = chunksResult.results || [];
    if (chunks.length === 0) {
      return { tokenCount: 0, chunkCount: 0 };
    }

    // 3. 分批构建索引
    const BATCH_SIZE = 50;
    let pendingValues: Array<{
      token: string;
      chunkId: number;
      documentId: number;
      frequency: number;
      source: string;
    }> = [];
    let totalTokenCount = 0;

    for (const chunk of chunks) {
      const content = chunk.content as string;
      const tokens = this.tokenize(content);

      // 计算词频
      const freq = new Map<string, number>();
      for (const t of tokens) {
        freq.set(t, (freq.get(t) || 0) + 1);
      }

      for (const [token, count] of freq) {
        pendingValues.push({
          token,
          chunkId: chunk.id as number,
          documentId,
          frequency: count,
          source: 'content',
        });
        totalTokenCount++;

        if (pendingValues.length >= BATCH_SIZE) {
          await this.batchInsertTokens(pendingValues);
          pendingValues = [];
        }
      }
    }

    // 剩余批次
    if (pendingValues.length > 0) {
      await this.batchInsertTokens(pendingValues);
    }

    // 4. 更新文档级元数据
    await this.updateDocumentMeta(documentId, chunks.length);

    // 5. 更新全局元数据
    await this.rebuildGlobalMeta();

    return { tokenCount: totalTokenCount, chunkCount: chunks.length };
  }

  /**
   * 批量 INSERT token 记录
   */
  private async batchInsertTokens(
    values: Array<{
      token: string;
      chunkId: number;
      documentId: number;
      frequency: number;
      source: string;
    }>
  ): Promise<void> {
    if (values.length === 0) return;

    // D1 批量 INSERT：使用多条 prepare + batch
    const stmts = values.map((v) =>
      this.db
        .prepare(
          'INSERT INTO rag_bm25_tokens (token, chunk_id, document_id, frequency, source) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(v.token, v.chunkId, v.documentId, v.frequency, v.source)
    );

    // D1 batch 执行（一次 round-trip）
    await this.db.batch(stmts);
  }

  /**
   * 删除指定文档的 BM25 索引
   */
  async deleteIndexForDocument(documentId: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM rag_bm25_tokens WHERE document_id = ?')
      .bind(documentId)
      .run();

    await this.db
      .prepare('DELETE FROM rag_bm25_meta WHERE document_id = ?')
      .bind(documentId)
      .run();
  }

  /**
   * 更新指定文档的 BM25 元数据
   */
  private async updateDocumentMeta(
    documentId: number,
    chunkCount: number
  ): Promise<void> {
    // 计算该文档所有 chunk 的平均 token 数
    const result = await this.db
      .prepare(
        `SELECT AVG(total_freq) as avg_length 
         FROM (
           SELECT chunk_id, SUM(frequency) as total_freq 
           FROM rag_bm25_tokens 
           WHERE document_id = ? AND source = 'content' 
           GROUP BY chunk_id
         )`
      )
      .bind(documentId)
      .first<{ avg_length: number }>();

    const avgLength = result?.avg_length || 0;

    // UPSERT 文档元数据
    await this.db
      .prepare(
        `INSERT INTO rag_bm25_meta (document_id, source, total_docs, avg_doc_length, last_built)
         VALUES (?, 'content', ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET 
           total_docs = excluded.total_docs,
           avg_doc_length = excluded.avg_doc_length,
           last_built = datetime('now')`
      )
      .bind(documentId, chunkCount, avgLength)
      .run();
  }

  /**
   * 重建全局索引元数据（统计所有已索引的 chunk 数量和平均长度）
   */
  async rebuildGlobalMeta(): Promise<void> {
    // 总 chunk 数（已构建 BM25 索引的）
    const totalResult = await this.db
      .prepare(
        `SELECT COUNT(DISTINCT chunk_id) as total_docs 
         FROM rag_bm25_tokens WHERE source = 'content'`
      )
      .first<{ total_docs: number }>();

    // 平均 chunk token 长度
    const avgResult = await this.db
      .prepare(
        `SELECT AVG(total_freq) as avg_length
         FROM (
           SELECT chunk_id, SUM(frequency) as total_freq 
           FROM rag_bm25_tokens 
           WHERE source = 'content' 
           GROUP BY chunk_id
         )`
      )
      .first<{ avg_length: number }>();

    const totalDocs = totalResult?.total_docs || 0;
    const avgLength = avgResult?.avg_length || 0;

    // 删除旧的全局记录后插入新的
    await this.db
      .prepare(`DELETE FROM rag_bm25_meta WHERE document_id IS NULL AND source = 'content'`)
      .run();

    await this.db
      .prepare(
        `INSERT INTO rag_bm25_meta (document_id, source, total_docs, avg_doc_length, last_built)
         VALUES (NULL, 'content', ?, ?, datetime('now'))`
      )
      .bind(totalDocs, avgLength)
      .run();
  }

  // ==================== BM25 检索 ====================

  /**
   * BM25Okapi 检索
   *
   * score(q, D) = Σ IDF(t) × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × dl/avgdl))
   *
   * 其中:
   * - IDF(t) = ln((N - n(t) + 0.5) / (n(t) + 0.5) + 1)
   * - N = 总文档(chunk)数
   * - n(t) = 包含 token t 的文档(chunk)数
   * - tf = token 在当前文档(chunk)中的词频
   * - dl = 当前文档(chunk)的 token 总数
   * - avgdl = 所有文档(chunk)的平均 token 数
   */
  async search(
    query: string,
    options: {
      topK?: number;
      documentIds?: number[];
      stockCode?: string;
      minScore?: number;
    } = {}
  ): Promise<BM25SearchResult[]> {
    const { topK = 10, documentIds, stockCode, minScore = 0.0 } = options;

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    // 1. 获取全局元数据
    const meta = await this.db
      .prepare(
        `SELECT total_docs, avg_doc_length FROM rag_bm25_meta 
         WHERE document_id IS NULL AND source = 'content' LIMIT 1`
      )
      .first<{ total_docs: number; avg_doc_length: number }>();

    if (!meta || meta.total_docs === 0) return [];

    const N = meta.total_docs;
    const avgdl = meta.avg_doc_length;
    const { k1, b } = this.config;

    // 2. 查询所有匹配的 token 记录
    const placeholders = queryTokens.map(() => '?').join(',');
    let sql = `
      SELECT bt.chunk_id, bt.document_id, bt.token, bt.frequency
      FROM rag_bm25_tokens bt
      WHERE bt.token IN (${placeholders}) AND bt.source = 'content'
    `;
    const bindParams: any[] = [...queryTokens];

    if (documentIds && documentIds.length > 0) {
      const docPlaceholders = documentIds.map(() => '?').join(',');
      sql += ` AND bt.document_id IN (${docPlaceholders})`;
      bindParams.push(...documentIds);
    }

    if (stockCode) {
      sql += ` AND bt.document_id IN (SELECT id FROM rag_documents WHERE stock_code = ?)`;
      bindParams.push(stockCode);
    }

    const tokenResult = await this.db
      .prepare(sql)
      .bind(...bindParams)
      .all();

    const tokenRecords = tokenResult.results || [];
    if (tokenRecords.length === 0) return [];

    // 3. 计算每个 token 的 IDF（文档频率）
    const tokenDF = new Map<string, number>(); // token → 出现在多少个 chunk 中
    const chunkTokens = new Map<number, Map<string, number>>(); // chunkId → { token → freq }
    const chunkDocMap = new Map<number, number>(); // chunkId → documentId

    for (const rec of tokenRecords) {
      const token = rec.token as string;
      const chunkId = rec.chunk_id as number;
      const freq = rec.frequency as number;

      chunkDocMap.set(chunkId, rec.document_id as number);

      if (!chunkTokens.has(chunkId)) {
        chunkTokens.set(chunkId, new Map());
      }
      chunkTokens.get(chunkId)!.set(token, freq);

      // DF 统计（去重：每个 chunk 只计一次）
      // 简化：统计返回的不同 chunk 数即为 DF（因为 SQL 已按 token 过滤）
    }

    // 需要额外查询每个 token 的文档频率（在全索引范围内）
    const uniqueTokens = [...new Set(queryTokens)];
    const dfPlaceholders = uniqueTokens.map(() => '?').join(',');
    const dfResult = await this.db
      .prepare(
        `SELECT token, COUNT(DISTINCT chunk_id) as df
         FROM rag_bm25_tokens
         WHERE token IN (${dfPlaceholders}) AND source = 'content'
         GROUP BY token`
      )
      .bind(...uniqueTokens)
      .all();

    for (const row of dfResult.results || []) {
      tokenDF.set(row.token as string, row.df as number);
    }

    // 4. 获取每个 chunk 的文档长度（token 总频次）
    const chunkIds = [...chunkTokens.keys()];
    if (chunkIds.length === 0) return [];

    const chunkIdPlaceholders = chunkIds.map(() => '?').join(',');
    const dlResult = await this.db
      .prepare(
        `SELECT chunk_id, SUM(frequency) as doc_length
         FROM rag_bm25_tokens
         WHERE chunk_id IN (${chunkIdPlaceholders}) AND source = 'content'
         GROUP BY chunk_id`
      )
      .bind(...chunkIds)
      .all();

    const chunkDocLength = new Map<number, number>();
    for (const row of dlResult.results || []) {
      chunkDocLength.set(row.chunk_id as number, row.doc_length as number);
    }

    // 5. 计算 BM25 分数
    const chunkScores = new Map<
      number,
      { score: number; matchedTokens: string[]; documentId: number }
    >();

    for (const [chunkId, tokenFreqMap] of chunkTokens) {
      let score = 0;
      const matchedTokens: string[] = [];
      const dl = chunkDocLength.get(chunkId) || 1;

      for (const [token, tf] of tokenFreqMap) {
        const df = tokenDF.get(token) || 0;
        // IDF = ln((N - df + 0.5) / (df + 0.5) + 1)
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        // TF normalization
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgdl)));
        score += idf * tfNorm;
        matchedTokens.push(token);
      }

      if (score >= minScore) {
        chunkScores.set(chunkId, {
          score,
          matchedTokens,
          documentId: chunkDocMap.get(chunkId) || 0,
        });
      }
    }

    // 6. 排序取 Top-K
    const sortedChunks = [...chunkScores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topK);

    if (sortedChunks.length === 0) return [];

    // 7. 获取 Chunk 内容
    const resultChunkIds = sortedChunks.map(([id]) => id);
    const contentPlaceholders = resultChunkIds.map(() => '?').join(',');
    const contentResult = await this.db
      .prepare(
        `SELECT id, content FROM rag_chunks WHERE id IN (${contentPlaceholders})`
      )
      .bind(...resultChunkIds)
      .all();

    const contentMap = new Map<number, string>();
    for (const row of contentResult.results || []) {
      contentMap.set(row.id as number, row.content as string);
    }

    // 8. 组装结果
    return sortedChunks.map(([chunkId, info]) => ({
      chunkId,
      documentId: info.documentId,
      score: Math.round(info.score * 1000) / 1000,
      content: contentMap.get(chunkId) || '',
      matchedTokens: info.matchedTokens,
    }));
  }

  // ==================== 辅助方法 ====================

  /**
   * 检查 BM25 索引是否已构建
   */
  async isIndexReady(): Promise<boolean> {
    const meta = await this.db
      .prepare(
        `SELECT total_docs FROM rag_bm25_meta 
         WHERE document_id IS NULL AND source = 'content' LIMIT 1`
      )
      .first<{ total_docs: number }>();

    return (meta?.total_docs || 0) > 0;
  }

  /**
   * 获取索引统计信息
   */
  async getIndexStats(): Promise<{
    totalIndexedChunks: number;
    totalTokens: number;
    avgDocLength: number;
    lastBuilt: string | null;
  }> {
    const meta = await this.db
      .prepare(
        `SELECT total_docs, avg_doc_length, last_built FROM rag_bm25_meta 
         WHERE document_id IS NULL AND source = 'content' LIMIT 1`
      )
      .first<{ total_docs: number; avg_doc_length: number; last_built: string }>();

    const tokenCount = await this.db
      .prepare(`SELECT COUNT(*) as count FROM rag_bm25_tokens WHERE source = 'content'`)
      .first<{ count: number }>();

    return {
      totalIndexedChunks: meta?.total_docs || 0,
      totalTokens: tokenCount?.count || 0,
      avgDocLength: meta?.avg_doc_length || 0,
      lastBuilt: meta?.last_built || null,
    };
  }

  /**
   * 重建所有文档的 BM25 索引（批量操作）
   * 用于初始化或修复索引
   */
  async reindexAllDocuments(): Promise<{
    documentsProcessed: number;
    totalTokens: number;
    totalChunks: number;
    errors: Array<{ documentId: number; error: string }>;
  }> {
    const docsResult = await this.db
      .prepare("SELECT id FROM rag_documents WHERE status = 'completed' ORDER BY id")
      .all();

    const docs = docsResult.results || [];
    let totalTokens = 0;
    let totalChunks = 0;
    const errors: Array<{ documentId: number; error: string }> = [];

    for (const doc of docs) {
      const documentId = doc.id as number;
      try {
        const stats = await this.buildIndexForDocument(documentId);
        totalTokens += stats.tokenCount;
        totalChunks += stats.chunkCount;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[BM25] Failed to reindex document ${documentId}:`, msg);
        errors.push({ documentId, error: msg });
      }
    }

    return {
      documentsProcessed: docs.length,
      totalTokens,
      totalChunks,
      errors,
    };
  }
}

// ==================== 工厂函数 ====================

export function createBM25Service(
  db: D1Database,
  config?: Partial<BM25Config>
): BM25Service {
  return new BM25Service(db, config);
}
