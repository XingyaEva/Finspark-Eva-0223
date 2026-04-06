/**
 * RAG (Retrieval-Augmented Generation) 知识库服务
 * 
 * 完整的RAG管线实现，包括：
 * 1. 文档处理 - 解析、清洗文本
 * 2. 文本分块 - 递归字符分割（Recursive Character Splitter）
 * 3. Embedding生成 - 支持多Provider：DashScope (通义千问) / VectorEngine (OpenAI)
 * 4. 向量存储 - 使用KV存储embedding向量
 * 5. 相似度检索 - 余弦相似度（Cosine Similarity）
 * 6. 增强生成 - 检索上下文注入LLM对话
 * 
 * 本实现等价于Python中 LangChain/LlamaIndex 的RAG管线：
 * - RecursiveCharacterTextSplitter → splitTextIntoChunks()
 * - OpenAIEmbeddings → generateEmbedding() (多Provider支持)
 * - FAISS/Chroma vector store → KV + cosine similarity
 * - RetrievalQA chain → ragQuery()
 * 
 * Embedding Provider 配置：
 * - dashscope (默认): 阿里云百炼 text-embedding-v4, 1024维, 中文优化
 * - vectorengine (备选): VectorEngine text-embedding-3-small, 1536维, 英文优化
 * 
 * ⚠️ 注意：切换Provider后维度不同，已有向量需要重新生成
 */

// ==================== Embedding Provider 配置 ====================

/**
 * Embedding Provider 类型
 * - dashscope: 阿里云百炼（通义千问 Qwen3-Embedding）
 * - vectorengine: VectorEngine（OpenAI text-embedding-3-small）
 */
export type EmbeddingProvider = 'dashscope' | 'vectorengine';

/**
 * Embedding 配置接口
 */
export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  dimensions: number;
  batchSize: number;   // 每批最大文本数
}

/**
 * 预定义的 Embedding Provider 配置
 */
export const EMBEDDING_PROVIDERS: Record<EmbeddingProvider, Omit<EmbeddingConfig, 'apiKey'>> = {
  dashscope: {
    provider: 'dashscope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'text-embedding-v4',
    dimensions: 1024,  // Qwen3-Embedding 默认 1024，可选 2048/1536/1024/768/512/256/128/64
    batchSize: 10,     // DashScope 每批最多 10 条
  },
  vectorengine: {
    provider: 'vectorengine',
    baseUrl: 'https://api.vectorengine.ai/v1',
    model: 'text-embedding-3-small',
    dimensions: 1536,  // OpenAI text-embedding-3-small 默认 1536
    batchSize: 20,     // VectorEngine 支持更大批次
  },
};

/**
 * 创建 Embedding 配置
 * 优先使用 DashScope (text-embedding-v4)，如果没有配置则回退到 VectorEngine
 */
export function createEmbeddingConfig(params: {
  dashscopeApiKey?: string;
  vectorengineApiKey?: string;
  preferredProvider?: EmbeddingProvider;
  dimensions?: number;
}): EmbeddingConfig {
  const { dashscopeApiKey, vectorengineApiKey, preferredProvider, dimensions } = params;

  // 根据偏好和可用性选择 Provider
  let provider: EmbeddingProvider;
  let apiKey: string;

  if (preferredProvider === 'dashscope' && dashscopeApiKey) {
    provider = 'dashscope';
    apiKey = dashscopeApiKey;
  } else if (preferredProvider === 'vectorengine' && vectorengineApiKey) {
    provider = 'vectorengine';
    apiKey = vectorengineApiKey;
  } else if (dashscopeApiKey) {
    // 默认优先 DashScope
    provider = 'dashscope';
    apiKey = dashscopeApiKey;
  } else if (vectorengineApiKey) {
    // 回退到 VectorEngine
    provider = 'vectorengine';
    apiKey = vectorengineApiKey;
  } else {
    throw new Error('未配置任何 Embedding API Key（需要 DASHSCOPE_API_KEY 或 VECTORENGINE_API_KEY）');
  }

  const providerConfig = EMBEDDING_PROVIDERS[provider];
  return {
    ...providerConfig,
    apiKey,
    dimensions: dimensions ?? providerConfig.dimensions,
  };
}

// ==================== 类型定义 ====================

export interface RAGDocument {
  id?: number;
  userId?: number | null;
  title: string;
  fileName: string;
  fileType: 'text' | 'pdf' | 'markdown' | 'html';
  fileSize: number;
  stockCode?: string;
  stockName?: string;
  category: 'annual_report' | 'quarterly_report' | 'research' | 'announcement' | 'general';
  tags: string[];
  chunkCount: number;
  embeddingModel?: string;
  embeddingProvider?: EmbeddingProvider;
  embeddingDimensions?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface RAGChunk {
  id?: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  contentLength: number;
  embeddingKey?: string;
  hasEmbedding: boolean;
  metadata: Record<string, unknown>;
}

/**
 * 切片元数据接口
 * 每个 chunk 携带的结构化来源信息，用于检索后精确溯源
 */
export interface ChunkMetadata {
  /** 起始页码 */
  pageStart?: number;
  /** 结束页码 */
  pageEnd?: number;
  /** 所属章节标题 */
  heading?: string;
  /** 章节层级 (1-6) */
  headingLevel?: number;
  /** 块类型: text / table / heading */
  chunkType: 'text' | 'table' | 'heading';
  /** 表格序号（文档内第几个表格） */
  tableIndex?: number;
  /** 表格标题/说明 */
  tableCaption?: string;
  /** 原始文件名 */
  sourceFile?: string;
  /** 关联股票代码 */
  stockCode?: string;
  /** 文档分类 */
  category?: string;
  /** 在文档中的位置比例 (0-1) */
  positionRatio?: number;
}

export interface ChunkWithScore {
  chunk: RAGChunk;
  score: number;
  documentTitle?: string;
  documentId: number;
}

export interface RAGQueryResult {
  answer: string;
  sources: Array<{
    documentId: number;
    documentTitle: string;
    chunkContent: string;
    relevanceScore: number;
    /** 页码范围 (如 "12-13") */
    pageRange?: string;
    /** 所属章节标题 */
    heading?: string;
    /** 切片类型 (text / table / heading) */
    chunkType?: string;
    /** 原始文件名 */
    sourceFile?: string;
  }>;
  sessionId: string;
}

// ==================== 文本分块器 ====================
// 等价于 Python langchain.text_splitter.RecursiveCharacterTextSplitter

export interface ChunkConfig {
  chunkSize: number;       // 每块最大字符数（默认500）
  chunkOverlap: number;    // 块之间重叠字符数（默认100）
  separators: string[];    // 分隔符优先级列表
}

const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 500,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '。', '！', '？', '；', '.', '!', '?', ';', ' ', ''],
};

/**
 * 递归字符文本分割
 * 等价于 Python: RecursiveCharacterTextSplitter
 * 
 * 策略：按优先级尝试不同分隔符，优先在段落边界切分，
 * 保证每个chunk不超过chunkSize，相邻chunk有overlap重叠
 */
export function splitTextIntoChunks(
  text: string,
  config: Partial<ChunkConfig> = {}
): string[] {
  const cfg = { ...DEFAULT_CHUNK_CONFIG, ...config };
  
  // 预处理：清理多余空白
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  
  if (cleanText.length <= cfg.chunkSize) {
    return cleanText.length > 0 ? [cleanText] : [];
  }
  
  return recursiveSplit(cleanText, cfg.separators, cfg);
}

function recursiveSplit(text: string, separators: string[], config: ChunkConfig): string[] {
  const chunks: string[] = [];
  
  if (text.length <= config.chunkSize) {
    return text.trim().length > 0 ? [text.trim()] : [];
  }
  
  // 找到当前最合适的分隔符
  let separator = '';
  for (const sep of separators) {
    if (sep === '') {
      separator = sep;
      break;
    }
    if (text.includes(sep)) {
      separator = sep;
      break;
    }
  }
  
  // 按分隔符切分
  const splits = separator ? text.split(separator) : Array.from(text);
  
  let currentChunk = '';
  
  for (const split of splits) {
    const piece = separator ? split + separator : split;
    
    if ((currentChunk + piece).length <= config.chunkSize) {
      currentChunk += piece;
    } else {
      // 当前chunk已满
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      // 如果单个piece就超过chunkSize，需要进一步切分
      if (piece.length > config.chunkSize) {
        const remainingSeparators = separators.slice(separators.indexOf(separator) + 1);
        if (remainingSeparators.length > 0) {
          const subChunks = recursiveSplit(piece, remainingSeparators, config);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          // 最后手段：硬切
          for (let i = 0; i < piece.length; i += config.chunkSize - config.chunkOverlap) {
            const hardChunk = piece.slice(i, i + config.chunkSize).trim();
            if (hardChunk.length > 0) {
              chunks.push(hardChunk);
            }
          }
          currentChunk = '';
        }
      } else {
        // 新chunk加overlap
        if (config.chunkOverlap > 0 && currentChunk.length > config.chunkOverlap) {
          const overlapText = currentChunk.slice(-config.chunkOverlap);
          currentChunk = overlapText + piece;
        } else {
          currentChunk = piece;
        }
      }
    }
  }
  
  // 处理最后一个chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// ==================== Embedding生成 ====================
// 等价于 Python: OpenAIEmbeddings / HuggingFaceEmbeddings
// 支持多 Provider：DashScope (通义千问 text-embedding-v4) / VectorEngine (OpenAI text-embedding-3-small)
// 两者都兼容 OpenAI Embedding API 格式，仅 base URL / model / dimensions 不同

/**
 * 生成文本的embedding向量
 * 通过配置的 Provider API (OpenAI兼容格式) 调用embedding模型
 * 等价于 Python: embeddings.embed_query(text)
 * 
 * @param text - 待向量化的文本
 * @param config - Embedding配置（包含provider、apiKey、baseUrl等）
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<number[]> {
  const requestBody: Record<string, unknown> = {
    model: config.model,
    input: text,
    encoding_format: 'float',
  };

  // DashScope 支持指定维度
  if (config.provider === 'dashscope') {
    requestBody.dimensions = config.dimensions;
  }

  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`[${config.provider}] Embedding API error: ${response.status} - ${error}`);
  }
  
  const result = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  
  return result.data[0].embedding;
}

/**
 * 批量生成embedding
 * 等价于 Python: embeddings.embed_documents(texts)
 * 
 * 注意：DashScope 每批最多 10 条，VectorEngine 支持更多
 * 函数内部会按 config.batchSize 自动分批
 * 
 * @param texts - 待向量化的文本数组
 * @param config - Embedding配置
 */
export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  // 如果文本数量超过批次限制，分批处理
  if (texts.length > config.batchSize) {
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += config.batchSize) {
      const batch = texts.slice(i, i + config.batchSize);
      const batchResult = await generateEmbeddingsBatch(batch, config);
      allEmbeddings.push(...batchResult);
    }
    return allEmbeddings;
  }

  return generateEmbeddingsBatch(texts, config);
}

/**
 * 单批次 embedding 生成（内部函数）
 */
async function generateEmbeddingsBatch(
  texts: string[],
  config: EmbeddingConfig
): Promise<number[][]> {
  const requestBody: Record<string, unknown> = {
    model: config.model,
    input: texts,
    encoding_format: 'float',
  };

  // DashScope 支持指定维度
  if (config.provider === 'dashscope') {
    requestBody.dimensions = config.dimensions;
  }

  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`[${config.provider}] Embedding API error: ${response.status} - ${error}`);
  }
  
  const result = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  
  // 按index排序返回
  return result.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}

// ==================== 兼容旧接口（向后兼容） ====================
// 为了不破坏现有调用方，保留旧签名的适配器

/**
 * @deprecated 请使用 generateEmbedding(text, config) 新签名
 * 保留兼容：使用 apiKey 字符串时自动创建 VectorEngine 配置
 */
export function generateEmbeddingLegacy(
  text: string,
  apiKey: string
): Promise<number[]> {
  const config = createEmbeddingConfig({ vectorengineApiKey: apiKey, preferredProvider: 'vectorengine' });
  return generateEmbedding(text, config);
}

/**
 * @deprecated 请使用 generateEmbeddings(texts, config) 新签名
 */
export function generateEmbeddingsLegacy(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const config = createEmbeddingConfig({ vectorengineApiKey: apiKey, preferredProvider: 'vectorengine' });
  return generateEmbeddings(texts, config);
}

// ==================== 向量相似度计算 ====================
// 等价于 Python: cosine_similarity / numpy.dot

/**
 * 余弦相似度计算
 * 等价于 Python: 1 - cosine(vec1, vec2) 或 np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

// ==================== RAG 知识库服务类 ====================

export class RAGService {
  private db: D1Database;
  private kv: KVNamespace;
  private apiKey: string;  // VectorEngine API Key (用于LLM Chat)
  private embeddingConfig: EmbeddingConfig;
  private bm25BuildCallback?: (documentId: number) => Promise<void>;
  private vectorize?: Vectorize;  // Cloudflare Vectorize 向量数据库（可选，替代 KV 全扫）
  
  constructor(db: D1Database, kv: KVNamespace, apiKey: string, embeddingConfig?: EmbeddingConfig, vectorize?: Vectorize) {
    this.db = db;
    this.kv = kv;
    this.apiKey = apiKey;
    // 如果未提供 embeddingConfig，使用 VectorEngine 作为默认（向后兼容）
    this.embeddingConfig = embeddingConfig || createEmbeddingConfig({
      vectorengineApiKey: apiKey,
      preferredProvider: 'vectorengine',
    });
    this.vectorize = vectorize;
  }

  /**
   * 设置 BM25 索引构建回调（在文档 ingest 完成后自动调用）
   * 由 Pipeline 层注入，实现松耦合
   */
  setBM25BuildCallback(callback: (documentId: number) => Promise<void>): void {
    this.bm25BuildCallback = callback;
  }
  
  /**
   * 获取当前 Embedding 配置信息（用于日志/调试）
   */
  getEmbeddingInfo(): { provider: EmbeddingProvider; model: string; dimensions: number } {
    return {
      provider: this.embeddingConfig.provider,
      model: this.embeddingConfig.model,
      dimensions: this.embeddingConfig.dimensions,
    };
  }
  
  // ========== 文档管理 ==========
  
  /**
   * 上传并处理文档
   * 等价于 Python: document_loader.load() → text_splitter.split() → vectorstore.add_documents()
   * 
   * 支持两种模式：
   * 1. 普通模式（structuredBlocks 未提供）：传统的文本分块
   * 2. 结构感知模式（structuredBlocks 已提供）：保留表格HTML、携带页码/标题等元数据
   */
  async ingestDocument(params: {
    title: string;
    fileName: string;
    content: string;
    fileType?: 'text' | 'pdf' | 'markdown' | 'html';
    stockCode?: string;
    stockName?: string;
    category?: string;
    tags?: string[];
    userId?: number;
    chunkSize?: number;
    chunkOverlap?: number;
    /** 结构化块（来自 extractStructuredBlocks），提供后使用结构感知分块 */
    structuredBlocks?: import('../services/ragPdfParser').StructuredBlock[];
  }): Promise<{ documentId: number; chunkCount: number }> {
    const {
      title, fileName, content, fileType = 'text',
      stockCode, stockName, category = 'general',
      tags = [], userId, chunkSize = 500, chunkOverlap = 100,
      structuredBlocks,
    } = params;
    
    // 记录使用的 embedding 模型信息
    const embeddingModelName = `${this.embeddingConfig.provider}/${this.embeddingConfig.model}`;
    console.log(`[RAG] Ingesting document with embedding: ${embeddingModelName} (${this.embeddingConfig.dimensions}d)`);
    if (structuredBlocks) {
      console.log(`[RAG] Structure-aware mode: ${structuredBlocks.length} blocks (tables: ${structuredBlocks.filter(b => b.type === 'table').length})`);
    }
    
    // 1. 创建文档记录
    const docResult = await this.db.prepare(`
      INSERT INTO rag_documents (user_id, title, file_name, file_type, file_size, stock_code, stock_name, category, tags, embedding_model, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')
    `).bind(
      userId || null, title, fileName, fileType, content.length,
      stockCode || null, stockName || null, category,
      JSON.stringify(tags), embeddingModelName
    ).run();
    
    const documentId = docResult.meta.last_row_id as number;
    
    try {
      // 2. 构建带元数据的分块列表
      let chunksWithMeta: Array<{ text: string; meta: ChunkMetadata }>;

      if (structuredBlocks && structuredBlocks.length > 0) {
        // ========== 结构感知分块 ==========
        chunksWithMeta = this.buildStructuredChunks(structuredBlocks, {
          chunkSize, chunkOverlap, fileName, stockCode, category,
        });
      } else {
        // ========== 传统分块（向后兼容） ==========
        const cleanContent = this.preprocessText(content, fileType);
        const plainChunks = splitTextIntoChunks(cleanContent, { chunkSize, chunkOverlap });
        chunksWithMeta = plainChunks.map((text, idx) => ({
          text,
          meta: {
            chunkType: 'text' as const,
            sourceFile: fileName,
            stockCode,
            category,
            positionRatio: plainChunks.length > 1 ? idx / (plainChunks.length - 1) : 0,
          },
        }));
      }
      
      if (chunksWithMeta.length === 0) {
        throw new Error('文档内容为空或无法分块');
      }
      
      // 3. 批量生成embedding（按Provider的batchSize分批）
      const BATCH_SIZE = this.embeddingConfig.batchSize;
      let processedCount = 0;
      const totalChunks = chunksWithMeta.length;
      console.log(`[RAG] Starting embedding for ${totalChunks} chunks (batch size: ${BATCH_SIZE}, ~${Math.ceil(totalChunks / BATCH_SIZE)} batches)`);
      
      for (let batchStart = 0; batchStart < chunksWithMeta.length; batchStart += BATCH_SIZE) {
        const batchItems = chunksWithMeta.slice(batchStart, batchStart + BATCH_SIZE);
        const batchTexts = batchItems.map(item => item.text);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        
        // 生成embedding（使用配置的Provider）
        const embeddings = await generateEmbeddings(batchTexts, this.embeddingConfig);
        
        // 4. 批量存储chunk和embedding（使用D1 batch提高效率）
        const statements: D1PreparedStatement[] = [];
        
        for (let i = 0; i < batchItems.length; i++) {
          const chunkIndex = batchStart + i;
          const embeddingKey = `rag:emb:${documentId}:${chunkIndex}`;
          const item = batchItems[i];
          const meta = item.meta;
          
          // 存embedding到KV
          await this.kv.put(embeddingKey, JSON.stringify(embeddings[i]));
          
          // 计算 page_range 字符串
          const pageRange = meta.pageStart
            ? (meta.pageEnd && meta.pageEnd !== meta.pageStart
              ? `${meta.pageStart}-${meta.pageEnd}`
              : `${meta.pageStart}`)
            : null;
          
          // 准备批量D1插入语句
          statements.push(
            this.db.prepare(`
              INSERT INTO rag_chunks (document_id, chunk_index, content, content_length, embedding_key, has_embedding, metadata, chunk_type, page_range)
              VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
            `).bind(
              documentId, chunkIndex, item.text, item.text.length, embeddingKey,
              JSON.stringify(meta),
              meta.chunkType || 'text',
              pageRange
            )
          );
          
          processedCount++;
        }
        
        // D1 batch 写入（比逐条写入快很多）
        if (statements.length > 0) {
          await this.db.batch(statements);
        }

        // 4b. 同步写入 Vectorize（双写，如果 Vectorize 可用）
        if (this.vectorize) {
          try {
            const vectors: VectorizeVector[] = batchItems.map((item, i) => ({
              id: `${documentId}:${batchStart + i}`,
              values: embeddings[i],
              metadata: {
                document_id: documentId,
                chunk_index: batchStart + i,
                stock_code: stockCode || '',
                category: category || 'general',
              },
            }));
            await this.vectorize.upsert(vectors);
          } catch (vecError) {
            // Vectorize 写入失败不阻塞入库（KV 仍可作为降级检索路径）
            console.warn(`[RAG] Vectorize upsert failed for batch ${batchNum}:`, vecError);
          }
        }
        
        if (batchNum % 5 === 0 || batchStart + BATCH_SIZE >= totalChunks) {
          console.log(`[RAG] Embedding progress: ${processedCount}/${totalChunks} chunks (batch ${batchNum})${this.vectorize ? ' [+Vectorize]' : ''}`);
        }
      }
      
      // 5. 更新文档状态
      await this.db.prepare(`
        UPDATE rag_documents 
        SET status = 'completed', chunk_count = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(processedCount, documentId).run();

      // 6. 构建 BM25 索引（如果已注入回调）
      if (this.bm25BuildCallback) {
        try {
          await this.bm25BuildCallback(documentId);
          console.log(`[RAG] BM25 index built for document ${documentId}`);
        } catch (bm25Error) {
          console.error(`[RAG] BM25 index build failed for document ${documentId}:`, bm25Error);
          // BM25 索引构建失败不阻塞文档入库
        }
      }
      
      return { documentId, chunkCount: processedCount };
      
    } catch (error) {
      // 处理失败，记录错误
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      await this.db.prepare(`
        UPDATE rag_documents SET status = 'failed', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(errorMsg, documentId).run();
      
      throw error;
    }
  }

  /**
   * 结构感知分块：将 extractStructuredBlocks 的输出转换为带元数据的切片
   * 
   * 规则：
   * - table 块：整块保留为一个 chunk（HTML 格式），不做二次切分
   * - heading 块：与后续 text 合并
   * - text 块：按 chunkSize/chunkOverlap 正常切分，每个子块继承父块的页码/标题
   */
  private buildStructuredChunks(
    blocks: import('../services/ragPdfParser').StructuredBlock[],
    opts: { chunkSize: number; chunkOverlap: number; fileName?: string; stockCode?: string; category?: string }
  ): Array<{ text: string; meta: ChunkMetadata }> {
    const result: Array<{ text: string; meta: ChunkMetadata }> = [];
    const totalBlocks = blocks.length;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const baseMeta: ChunkMetadata = {
        chunkType: block.type,
        pageStart: block.pageStart,
        pageEnd: block.pageEnd,
        heading: block.heading,
        headingLevel: block.headingLevel,
        sourceFile: opts.fileName,
        stockCode: opts.stockCode,
        category: opts.category,
        positionRatio: totalBlocks > 1 ? i / (totalBlocks - 1) : 0,
      };

      if (block.type === 'table') {
        // 表格块：整块保留（HTML 内容），不二次分割
        result.push({
          text: block.content, // 已是 HTML
          meta: {
            ...baseMeta,
            tableIndex: block.tableIndex,
            tableCaption: block.tableCaption,
          },
        });
      } else if (block.type === 'heading') {
        // heading 块通常很短，跳过单独成块（会作为后续 text 的 heading 属性保留）
        // 但如果 heading 内容本身有价值（如目录条目），可以保留
        if (block.content.length > 10) {
          result.push({ text: block.content, meta: baseMeta });
        }
      } else {
        // text 块：按配置大小切分，每个子块继承元数据
        if (block.content.length <= opts.chunkSize) {
          result.push({ text: block.content, meta: baseMeta });
        } else {
          const subChunks = splitTextIntoChunks(block.content, {
            chunkSize: opts.chunkSize,
            chunkOverlap: opts.chunkOverlap,
          });
          for (const sub of subChunks) {
            result.push({ text: sub, meta: { ...baseMeta } });
          }
        }
      }
    }

    return result;
  }
  
  /**
   * 文本预处理
   */
  private preprocessText(content: string, fileType: string): string {
    let text = content;
    
    // 根据文件类型处理
    switch (fileType) {
      case 'html':
        // 简单的HTML标签移除
        text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        text = text.replace(/<[^>]+>/g, '\n');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&amp;/g, '&');
        break;
        
      case 'markdown':
        // 保留markdown文本，移除图片标记
        text = text.replace(/!\[.*?\]\(.*?\)/g, '');
        break;
    }
    
    // 通用清理
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');  // 最多两个连续换行
    text = text.replace(/[ \t]{2,}/g, ' ');   // 多余空格
    text = text.trim();
    
    return text;
  }
  
  // ========== 检索 ==========
  
  /**
   * 向量相似度检索 — 统一入口
   * 优先使用 Cloudflare Vectorize（ANN ~10ms），失败时自动降级到 KV 全扫
   * 等价于 Python: vectorstore.similarity_search_with_score(query, k=top_k)
   */
  async searchSimilar(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      stockCode?: string;  // 限定特定股票
      documentIds?: number[]; // 限定特定文档
      category?: string;
    } = {}
  ): Promise<ChunkWithScore[]> {
    // 优先走 Vectorize 路径
    if (this.vectorize) {
      try {
        const results = await this.searchSimilarVectorize(query, options);
        if (results.length > 0) {
          console.log(`[RAG] Vectorize search: ${results.length} results, top score=${results[0]?.score.toFixed(3)}`);
          return results;
        }
        console.log('[RAG] Vectorize returned 0 results, falling back to KV scan');
      } catch (error) {
        console.warn('[RAG] Vectorize search failed, falling back to KV scan:', error);
      }
    }
    
    // 降级：KV 全扫路径（旧方案）
    return this.searchSimilarKV(query, options);
  }

  /**
   * Vectorize 向量检索（新方案，ANN 近似最近邻）
   * 
   * 优势：
   * - 单次 API 调用完成 ANN 搜索，~10ms 延迟
   * - 支持 metadata filter（stock_code / document_id / category）
   * - 无需从 KV 逐条加载 embedding
   * 
   * 限制：
   * - topK 最大 100（不返回 values），50（返回 metadata）
   * - 需要先通过 ingest 或 migrate 将向量写入 Vectorize
   */
  private async searchSimilarVectorize(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      stockCode?: string;
      documentIds?: number[];
      category?: string;
    } = {}
  ): Promise<ChunkWithScore[]> {
    const { topK = 5, minScore = 0.3, stockCode, documentIds, category } = options;
    
    if (!this.vectorize) return [];

    // 1. 生成查询向量
    const queryEmbedding = await generateEmbedding(query, this.embeddingConfig);

    // 2. 构建 metadata filter
    //    Vectorize filter 语法: { property: value } 或 { property: { $in: [...] } }
    const filter: Record<string, any> = {};
    if (stockCode) {
      filter.stock_code = stockCode;
    }
    if (category) {
      filter.category = category;
    }
    // 注意：documentIds 过滤通过 metadata filter 的 $in 操作符
    // Vectorize 支持 $in 过滤，但 document_id 是 number 类型
    if (documentIds && documentIds.length > 0) {
      filter.document_id = { $in: documentIds };
    }

    // 3. Vectorize 查询（ANN，~10ms）
    const matches = await this.vectorize.query(queryEmbedding, {
      topK: Math.min(topK * 2, 50), // 多取一些以备 minScore 过滤
      returnMetadata: 'all',
      ...(Object.keys(filter).length > 0 ? { filter } : {}),
    });

    if (!matches.matches || matches.matches.length === 0) {
      return [];
    }

    // 4. 过滤低分结果
    const validMatches = matches.matches.filter(m => (m.score ?? 0) >= minScore);
    if (validMatches.length === 0) return [];

    // 5. 从 D1 获取 chunk 完整内容（Vectorize 只存 metadata，不存全文）
    //    向量 ID 格式: "documentId:chunkIndex"
    const chunkKeys = validMatches.map(m => {
      const [docId, chunkIdx] = m.id.split(':');
      return { docId: parseInt(docId), chunkIdx: parseInt(chunkIdx), score: m.score ?? 0, metadata: m.metadata };
    });

    // 用 chunk 的 document_id + chunk_index 批量查询
    // 构建 (document_id, chunk_index) IN (...) 查询
    const whereConditions = chunkKeys.map(() => '(c.document_id = ? AND c.chunk_index = ?)').join(' OR ');
    const bindParams: any[] = [];
    for (const ck of chunkKeys) {
      bindParams.push(ck.docId, ck.chunkIdx);
    }

    const sql = `
      SELECT c.id, c.document_id, c.chunk_index, c.content, c.content_length, c.embedding_key, c.metadata,
             d.title as document_title
      FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      WHERE (${whereConditions})
        AND d.status = 'completed'
    `;

    const result = await this.db.prepare(sql).bind(...bindParams).all();
    const chunkMap = new Map<string, any>();
    for (const row of result.results || []) {
      const key = `${row.document_id}:${row.chunk_index}`;
      chunkMap.set(key, row);
    }

    // 6. 组装结果（按 Vectorize 返回的分数排序）
    const scoredChunks: ChunkWithScore[] = [];
    for (const ck of chunkKeys) {
      const key = `${ck.docId}:${ck.chunkIdx}`;
      const row = chunkMap.get(key);
      if (!row) continue;

      scoredChunks.push({
        chunk: {
          id: row.id as number,
          documentId: row.document_id as number,
          chunkIndex: row.chunk_index as number,
          content: row.content as string,
          contentLength: row.content_length as number,
          embeddingKey: row.embedding_key as string,
          hasEmbedding: true,
          metadata: JSON.parse((row.metadata as string) || '{}'),
        },
        score: ck.score,
        documentTitle: row.document_title as string,
        documentId: row.document_id as number,
      });
    }

    // 已按 Vectorize 分数排序，取 topK
    return scoredChunks.slice(0, topK);
  }

  /**
   * 两阶段混合检索（替代原 KV 全扫方案）
   * 
   * Stage 1: FTS5 全文检索预筛选候选 chunk（~10ms，返回 topK*10 条）
   * Stage 2: 对候选 chunk 生成 query embedding + 从 KV 加载 chunk embedding，
   *          计算 cosine similarity 并重排序
   * 
   * 优势：
   * - 避免全扫 31K+ chunks，KV 读取 <100 次
   * - 完全在 Workers CPU/Memory 限制内运行
   * - 兼顾关键词匹配（BM25）和语义相似度（向量）
   * 
   * 降级策略：
   * - FTS5 失败时回退到有限 D1 查询（LIMIT 200）
   */
  private async searchSimilarKV(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      stockCode?: string;
      documentIds?: number[];
      category?: string;
    } = {}
  ): Promise<ChunkWithScore[]> {
    const { topK = 5, minScore = 0.25, stockCode, documentIds, category } = options;
    
    // 1. 生成查询的embedding（使用配置的Provider）
    const queryEmbedding = await generateEmbedding(query, this.embeddingConfig);
    
    // 2. Stage 1: FTS5 预筛选候选 chunk IDs
    const FTS_CANDIDATE_LIMIT = Math.max(topK * 10, 50); // 至少取50个候选
    let candidates: any[] = [];
    
    try {
      // 构建 FTS5 查询：清洗特殊字符
      const ftsQuery = query
        .replace(/[""'']/g, '"')
        .replace(/[(){}[\]^~*:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (ftsQuery) {
        let ftsSql = `
          SELECT 
            f.rowid AS chunk_id,
            c.id, c.document_id, c.chunk_index, c.content, c.content_length, 
            c.embedding_key, c.metadata,
            d.title as document_title,
            bm25(rag_chunks_fts) AS bm25_score
          FROM rag_chunks_fts f
          JOIN rag_chunks c ON c.id = f.rowid
          JOIN rag_documents d ON d.id = c.document_id
          WHERE rag_chunks_fts MATCH ?
            AND c.has_embedding = 1 
            AND d.status = 'completed'
        `;
        const ftsBinds: any[] = [ftsQuery];
        
        if (stockCode) {
          ftsSql += ' AND d.stock_code = ?';
          ftsBinds.push(stockCode);
        }
        if (documentIds && documentIds.length > 0) {
          ftsSql += ` AND c.document_id IN (${documentIds.map(() => '?').join(',')})`;
          ftsBinds.push(...documentIds);
        }
        if (category) {
          ftsSql += ' AND d.category = ?';
          ftsBinds.push(category);
        }
        
        ftsSql += ` ORDER BY bm25_score LIMIT ?`;
        ftsBinds.push(FTS_CANDIDATE_LIMIT);
        
        const ftsResult = await this.db.prepare(ftsSql).bind(...ftsBinds).all();
        candidates = ftsResult.results || [];
        console.log(`[RAG] FTS5 pre-filter: ${candidates.length} candidates for query "${query.slice(0, 30)}"`);
      }
    } catch (ftsError) {
      console.warn('[RAG] FTS5 pre-filter failed, falling back to D1 LIMIT query:', ftsError);
    }
    
    // 降级：FTS5 失败或无结果时，使用 D1 带 LIMIT 查询（随机取一批 chunk）
    if (candidates.length === 0) {
      const D1_FALLBACK_LIMIT = Math.max(topK * 20, 200);
      let sql = `
        SELECT c.id, c.document_id, c.chunk_index, c.content, c.content_length, c.embedding_key, c.metadata,
               d.title as document_title
        FROM rag_chunks c
        JOIN rag_documents d ON c.document_id = d.id
        WHERE c.has_embedding = 1 AND d.status = 'completed'
      `;
      const bindParams: any[] = [];
      
      if (stockCode) {
        sql += ' AND d.stock_code = ?';
        bindParams.push(stockCode);
      }
      if (documentIds && documentIds.length > 0) {
        sql += ` AND c.document_id IN (${documentIds.map(() => '?').join(',')})`;
        bindParams.push(...documentIds);
      }
      if (category) {
        sql += ' AND d.category = ?';
        bindParams.push(category);
      }
      
      sql += ` LIMIT ?`;
      bindParams.push(D1_FALLBACK_LIMIT);
      
      const stmt = this.db.prepare(sql).bind(...bindParams);
      const result = await stmt.all();
      candidates = result.results || [];
      console.log(`[RAG] D1 fallback: ${candidates.length} candidates`);
    }
    
    if (candidates.length === 0) {
      return [];
    }
    
    // 3. Stage 2: 从 KV 加载 embedding 并计算 cosine similarity
    const scoredChunks: ChunkWithScore[] = [];
    
    // 并行获取embedding（最多50个一批）
    const FETCH_BATCH = 50;
    for (let i = 0; i < candidates.length; i += FETCH_BATCH) {
      const batch = candidates.slice(i, i + FETCH_BATCH);
      
      const embeddingPromises = batch.map(async (candidate: any) => {
        const embeddingKey = candidate.embedding_key;
        if (!embeddingKey) return null;
        
        const embeddingStr = await this.kv.get(embeddingKey);
        if (!embeddingStr) return null;
        
        const chunkEmbedding = JSON.parse(embeddingStr) as number[];
        const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
        
        if (score >= minScore) {
          return {
            chunk: {
              id: candidate.id as number,
              documentId: candidate.document_id as number,
              chunkIndex: candidate.chunk_index as number,
              content: candidate.content as string,
              contentLength: candidate.content_length as number,
              embeddingKey: embeddingKey as string,
              hasEmbedding: true,
              metadata: JSON.parse((candidate.metadata as string) || '{}'),
            },
            score,
            documentTitle: candidate.document_title as string,
            documentId: candidate.document_id as number,
          } as ChunkWithScore;
        }
        return null;
      });
      
      const batchResults = await Promise.all(embeddingPromises);
      scoredChunks.push(...batchResults.filter((r): r is ChunkWithScore => r !== null));
    }
    
    // 4. 按 cosine similarity 排序，取 topK
    scoredChunks.sort((a, b) => b.score - a.score);
    console.log(`[RAG] Hybrid search: ${scoredChunks.length} results above minScore=${minScore}, returning top ${topK}`);
    return scoredChunks.slice(0, topK);
  }
  
  // ========== RAG问答 ==========
  
  /**
   * RAG增强问答
   * 等价于 Python: RetrievalQA.from_chain_type(llm, retriever, chain_type="stuff")
   */
  async ragQuery(params: {
    question: string;
    sessionId?: string;
    stockCode?: string;
    documentIds?: number[];
    conversationHistory?: Array<{ role: string; content: string }>;
    topK?: number;
    userId?: number;
  }): Promise<RAGQueryResult> {
    const {
      question, stockCode, documentIds,
      conversationHistory = [], topK = 5, userId,
    } = params;
    
    const sessionId = params.sessionId || `rag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // 1. 检索相关文档块
    const relevantChunks = await this.searchSimilar(question, {
      topK,
      stockCode,
      documentIds,
      minScore: 0.25,
    });
    
    // 2. 构建上下文
    let context = '';
    const sources: RAGQueryResult['sources'] = [];
    
    if (relevantChunks.length > 0) {
      context = '以下是从知识库中检索到的相关文档内容：\n\n';
      
      relevantChunks.forEach((item, index) => {
        const meta = (item.chunk.metadata || {}) as Partial<ChunkMetadata>;
        const pageInfo = meta.pageStart ? ` (P.${meta.pageStart}${meta.pageEnd && meta.pageEnd !== meta.pageStart ? '-' + meta.pageEnd : ''})` : '';
        const headingInfo = meta.heading ? ` [${meta.heading}]` : '';
        context += `【来源${index + 1}: ${item.documentTitle}${pageInfo}${headingInfo}】\n${item.chunk.content}\n\n`;
        sources.push({
          documentId: item.documentId,
          documentTitle: item.documentTitle || `文档${item.documentId}`,
          chunkContent: item.chunk.content.slice(0, 200) + (item.chunk.content.length > 200 ? '...' : ''),
          relevanceScore: Math.round(item.score * 100) / 100,
          pageRange: meta.pageStart ? `${meta.pageStart}${meta.pageEnd && meta.pageEnd !== meta.pageStart ? '-' + meta.pageEnd : ''}` : undefined,
          heading: meta.heading,
          chunkType: meta.chunkType,
          sourceFile: meta.sourceFile,
        });
      });
    }
    
    // 3. 构建系统提示词
    const systemPrompt = `你是Finspark AI财报知识库助手。你可以基于知识库中的公司财报文档回答用户问题。

${context ? '【知识库检索结果】\n' + context : '当前知识库中没有找到与问题高度相关的文档。'}

回答规则：
1. 优先基于知识库中的文档内容来回答
2. 如果知识库中有相关信息，请引用具体来源（包括文档名称和页码）
3. 如果知识库中没有足够信息，可以基于你的金融知识补充，但要说明哪些是文档中的信息，哪些是补充分析
4. 使用专业但易懂的中文回答
5. 如果涉及投资建议，需要声明"仅供参考，不构成投资建议"
6. 在回答末尾标注参考来源，格式如：📄 文档名称 · 第X页 · 章节名`;
    
    // 4. 调用LLM生成回答
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: question },
    ];
    
    const response = await fetch('https://api.vectorengine.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }
    
    const llmResult = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    
    const answer = llmResult.choices?.[0]?.message?.content || '抱歉，无法生成回答。';
    
    // 5. 保存对话记录
    try {
      await this.db.prepare(`
        INSERT INTO rag_conversations (user_id, session_id, role, content, sources)
        VALUES (?, ?, 'user', ?, '[]')
      `).bind(userId || null, sessionId, question).run();
      
      await this.db.prepare(`
        INSERT INTO rag_conversations (user_id, session_id, role, content, sources)
        VALUES (?, ?, 'assistant', ?, ?)
      `).bind(userId || null, sessionId, answer, JSON.stringify(sources)).run();
    } catch (e) {
      console.error('[RAG] Failed to save conversation:', e);
    }
    
    return { answer, sources, sessionId };
  }
  
  // ========== 文档管理API ===========
  
  /**
   * 获取文档列表
   */
  async listDocuments(params: {
    userId?: number;
    stockCode?: string;
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: any[]; total: number }> {
    const { userId, stockCode, category, status, limit = 20, offset = 0 } = params;
    
    let where = 'WHERE 1=1';
    const bindParams: any[] = [];
    
    if (userId !== undefined) {
      where += ' AND (user_id = ? OR user_id IS NULL)';
      bindParams.push(userId);
    }
    if (stockCode) {
      where += ' AND stock_code = ?';
      bindParams.push(stockCode);
    }
    if (category) {
      where += ' AND category = ?';
      bindParams.push(category);
    }
    if (status) {
      where += ' AND status = ?';
      bindParams.push(status);
    }
    
    // 获取列表
    const listSQL = `SELECT * FROM rag_documents ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const listResult = await this.db.prepare(listSQL).bind(...bindParams, limit, offset).all();
    
    // 获取总数
    const countSQL = `SELECT COUNT(*) as total FROM rag_documents ${where}`;
    const countResult = await this.db.prepare(countSQL).bind(...bindParams).first() as { total: number } | null;
    
    return {
      documents: listResult.results || [],
      total: countResult?.total || 0,
    };
  }
  
  /**
   * 删除文档及其所有chunks和embeddings（KV + Vectorize）
   */
  async deleteDocument(documentId: number): Promise<void> {
    // 1. 获取所有 chunk 信息（embedding keys + chunk_index 用于 Vectorize 清理）
    const chunks = await this.db.prepare(
      'SELECT embedding_key, chunk_index FROM rag_chunks WHERE document_id = ? AND has_embedding = 1'
    ).bind(documentId).all();
    
    // 2. 删除KV中的embedding
    for (const chunk of (chunks.results || [])) {
      const key = chunk.embedding_key as string;
      if (key) {
        await this.kv.delete(key);
      }
    }

    // 2b. 删除 Vectorize 中的向量
    if (this.vectorize && chunks.results && chunks.results.length > 0) {
      try {
        const vectorIds = chunks.results.map(c => `${documentId}:${c.chunk_index}`);
        // Vectorize deleteByIds 不限制批次大小
        await this.vectorize.deleteByIds(vectorIds);
        console.log(`[RAG] Vectorize: deleted ${vectorIds.length} vectors for document ${documentId}`);
      } catch (vecError) {
        console.warn(`[RAG] Vectorize delete failed for document ${documentId}:`, vecError);
      }
    }
    
    // 3. 删除D1中的chunks（FTS5 触发器会自动清理 FTS 索引）
    await this.db.prepare('DELETE FROM rag_chunks WHERE document_id = ?').bind(documentId).run();
    
    // 4. 删除D1中的document
    await this.db.prepare('DELETE FROM rag_documents WHERE id = ?').bind(documentId).run();
  }
  
  /**
   * 获取文档详情
   */
  async getDocument(documentId: number): Promise<any> {
    const doc = await this.db.prepare(
      'SELECT * FROM rag_documents WHERE id = ?'
    ).bind(documentId).first();
    
    if (!doc) return null;
    
    const chunks = await this.db.prepare(
      'SELECT id, chunk_index, content, content_length, has_embedding FROM rag_chunks WHERE document_id = ? ORDER BY chunk_index'
    ).bind(documentId).all();
    
    return {
      ...doc,
      chunks: chunks.results || [],
    };
  }
  
  /**
   * 获取知识库统计信息
   */
  async getStats(userId?: number): Promise<{
    totalDocuments: number;
    completedDocuments: number;
    totalChunks: number;
    categories: Array<{ category: string; count: number }>;
  }> {
    const userFilter = userId !== undefined ? 'AND (user_id = ? OR user_id IS NULL)' : '';
    const bindParams = userId !== undefined ? [userId] : [];
    
    const totalResult = await this.db.prepare(
      `SELECT COUNT(*) as total FROM rag_documents WHERE 1=1 ${userFilter}`
    ).bind(...bindParams).first() as { total: number } | null;
    
    const completedResult = await this.db.prepare(
      `SELECT COUNT(*) as total FROM rag_documents WHERE status = 'completed' ${userFilter}`
    ).bind(...bindParams).first() as { total: number } | null;
    
    const chunksResult = await this.db.prepare(
      `SELECT COUNT(*) as total FROM rag_chunks c JOIN rag_documents d ON c.document_id = d.id WHERE d.status = 'completed' ${userFilter ? 'AND (d.user_id = ? OR d.user_id IS NULL)' : ''}`
    ).bind(...bindParams).first() as { total: number } | null;
    
    const categoryResult = await this.db.prepare(
      `SELECT category, COUNT(*) as count FROM rag_documents WHERE status = 'completed' ${userFilter} GROUP BY category ORDER BY count DESC`
    ).bind(...bindParams).all();
    
    return {
      totalDocuments: totalResult?.total || 0,
      completedDocuments: completedResult?.total || 0,
      totalChunks: chunksResult?.total || 0,
      categories: (categoryResult.results || []) as Array<{ category: string; count: number }>,
    };
  }

  // ========== Chunk CRUD（Phase 1 新增）==========

  /**
   * 获取 Chunk 列表（分页/筛选）
   */
  async listChunks(params: {
    documentId?: number;
    chunkType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ chunks: any[]; total: number }> {
    const { documentId, chunkType, search, limit = 20, offset = 0 } = params;

    let where = 'WHERE 1=1';
    const bindParams: any[] = [];

    if (documentId !== undefined) {
      where += ' AND c.document_id = ?';
      bindParams.push(documentId);
    }
    if (chunkType) {
      where += ' AND c.chunk_type = ?';
      bindParams.push(chunkType);
    }
    if (search) {
      where += ' AND c.content LIKE ?';
      bindParams.push(`%${search}%`);
    }

    const listSQL = `
      SELECT c.id, c.document_id, c.chunk_index, c.content, c.content_length, 
             c.has_embedding, c.chunk_type, c.page_range, c.summary, c.entities, c.keywords,
             d.title as document_title
      FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      ${where}
      ORDER BY c.document_id DESC, c.chunk_index ASC
      LIMIT ? OFFSET ?
    `;
    const listResult = await this.db
      .prepare(listSQL)
      .bind(...bindParams, limit, offset)
      .all();

    const countSQL = `
      SELECT COUNT(*) as total FROM rag_chunks c
      JOIN rag_documents d ON c.document_id = d.id
      ${where}
    `;
    const countResult = (await this.db
      .prepare(countSQL)
      .bind(...bindParams)
      .first()) as { total: number } | null;

    return {
      chunks: listResult.results || [],
      total: countResult?.total || 0,
    };
  }

  /**
   * 获取 Chunk 详情
   */
  async getChunk(chunkId: number): Promise<any> {
    return await this.db
      .prepare(
        `SELECT c.*, d.title as document_title, d.stock_code, d.category
         FROM rag_chunks c
         JOIN rag_documents d ON c.document_id = d.id
         WHERE c.id = ?`
      )
      .bind(chunkId)
      .first();
  }

  /**
   * 编辑 Chunk 内容 → 重新生成 Embedding
   */
  async updateChunk(
    chunkId: number,
    content: string
  ): Promise<{ embeddingKey: string }> {
    // 获取旧 chunk 信息
    const chunk = await this.db
      .prepare('SELECT id, document_id, chunk_index, embedding_key FROM rag_chunks WHERE id = ?')
      .bind(chunkId)
      .first<{ id: number; document_id: number; chunk_index: number; embedding_key: string }>();

    if (!chunk) {
      throw new Error('Chunk 不存在');
    }

    // 生成新的 Embedding
    const newEmbedding = await generateEmbedding(content, this.embeddingConfig);
    const embeddingKey = chunk.embedding_key || `rag:emb:${chunk.document_id}:${chunk.chunk_index}`;

    // 更新 KV 中的 Embedding
    await this.kv.put(embeddingKey, JSON.stringify(newEmbedding));

    // 更新 D1 中的 Chunk 内容
    await this.db
      .prepare(
        `UPDATE rag_chunks 
         SET content = ?, content_length = ?, embedding_key = ?, has_embedding = 1
         WHERE id = ?`
      )
      .bind(content, content.length, embeddingKey, chunkId)
      .run();

    return { embeddingKey };
  }

  /**
   * 删除 Chunk（清理向量 + BM25 索引）
   */
  async deleteChunk(chunkId: number): Promise<void> {
    // 获取 chunk 信息
    const chunk = await this.db
      .prepare('SELECT embedding_key, document_id FROM rag_chunks WHERE id = ?')
      .bind(chunkId)
      .first<{ embedding_key: string; document_id: number }>();

    if (!chunk) return;

    // 删除 KV 中的 Embedding
    if (chunk.embedding_key) {
      await this.kv.delete(chunk.embedding_key);
    }

    // 删除 BM25 索引记录
    await this.db
      .prepare('DELETE FROM rag_bm25_tokens WHERE chunk_id = ?')
      .bind(chunkId)
      .run();

    // 删除 Chunk
    await this.db
      .prepare('DELETE FROM rag_chunks WHERE id = ?')
      .bind(chunkId)
      .run();

    // 更新文档的 chunk_count
    await this.db
      .prepare(
        `UPDATE rag_documents 
         SET chunk_count = (SELECT COUNT(*) FROM rag_chunks WHERE document_id = ?),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(chunk.document_id, chunk.document_id)
      .run();
  }

  /**
   * 仪表盘聚合统计
   * 
   * 使用 try/catch 包装各查询，确保即使 migration 未执行（表不存在）也能返回部分数据。
   */
  async getDashboardStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalConversations: number;
    weeklyNewDocs: number;
    weeklyNewChunks: number;
    weeklyNewConversations: number;
    avgLatencyMs: number;
    categories: Array<{ category: string; count: number }>;
    recentConversations: Array<{
      sessionId: string;
      question: string;
      time: string;
      status: string;
    }>;
    systemStatus: {
      embeddingProvider: string;
      model: string;
      dimensions: number;
      bm25Ready: boolean;
    };
    trends: {
      dates: string[];
      conversations: number[];
    };
    retrievalAccuracy: number;
  }> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    // Helper: run query with fallback for missing tables
    const safeFirst = async <T>(sql: string, ...args: any[]): Promise<T | null> => {
      try {
        const stmt = args.length > 0
          ? this.db.prepare(sql).bind(...args)
          : this.db.prepare(sql);
        return await stmt.first<T>();
      } catch (e) {
        console.warn('[Dashboard] Query failed (table may not exist):', (e as Error).message?.slice(0, 100));
        return null;
      }
    };

    const safeAll = async (sql: string, ...args: any[]): Promise<any[]> => {
      try {
        const stmt = args.length > 0
          ? this.db.prepare(sql).bind(...args)
          : this.db.prepare(sql);
        const result = await stmt.all();
        return result.results || [];
      } catch (e) {
        console.warn('[Dashboard] Query failed (table may not exist):', (e as Error).message?.slice(0, 100));
        return [];
      }
    };

    // 并行查询（每个都安全包装）
    const [
      totalDocsResult,
      totalChunksResult,
      totalConvResult,
      weeklyDocsResult,
      weeklyChunksResult,
      weeklyConvResult,
      avgLatencyResult,
      categoryResults,
      recentConvResults,
      bm25MetaResult,
      trendResults,
      accuracyResult,
    ] = await Promise.all([
      safeFirst<{ c: number }>("SELECT COUNT(*) as c FROM rag_documents WHERE status = 'completed'"),
      safeFirst<{ c: number }>('SELECT COUNT(*) as c FROM rag_chunks'),
      safeFirst<{ c: number }>("SELECT COUNT(*) as c FROM rag_conversations WHERE role = 'user'"),
      safeFirst<{ c: number }>("SELECT COUNT(*) as c FROM rag_documents WHERE created_at >= ? AND status = 'completed'", oneWeekAgo),
      safeFirst<{ c: number }>('SELECT COUNT(*) as c FROM rag_chunks WHERE created_at >= ?', oneWeekAgo),
      safeFirst<{ c: number }>("SELECT COUNT(*) as c FROM rag_conversations WHERE created_at >= ? AND role = 'user'", oneWeekAgo),
      safeFirst<{ avg: number }>("SELECT AVG(total_latency_ms) as avg FROM rag_message_logs WHERE status = 'success'"),
      safeAll("SELECT category, COUNT(*) as count FROM rag_documents WHERE status = 'completed' GROUP BY category ORDER BY count DESC"),
      safeAll(
        `SELECT session_id, content as question, created_at as time 
         FROM rag_conversations WHERE role = 'user' 
         ORDER BY created_at DESC LIMIT 10`
      ),
      safeFirst<{ total_docs: number }>(
        "SELECT total_docs FROM rag_bm25_meta WHERE document_id IS NULL AND source = 'content' LIMIT 1"
      ),
      // 7天问答量趋势 (from rag_message_logs)
      safeAll(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM rag_message_logs
         WHERE created_at >= datetime('now', '-7 days')
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      ),
      // 检索准确率（成功且有检索结果的比例）
      safeFirst<{ total: number; with_results: number }>(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN (vector_results_count > 0 OR bm25_results_count > 0) AND status = 'success' THEN 1 ELSE 0 END) as with_results
         FROM rag_message_logs`
      ),
    ]);

    // Build 7-day trend data with zero-filling for missing dates
    const trendMap = new Map<string, number>();
    for (const row of trendResults) {
      trendMap.set(row.date as string, row.count as number);
    }
    const trendDates: string[] = [];
    const trendConversations: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const shortDate = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      trendDates.push(shortDate);
      trendConversations.push(trendMap.get(dateStr) || 0);
    }

    // Calculate retrieval accuracy percentage
    const accTotal = accuracyResult?.total || 0;
    const accWithResults = accuracyResult?.with_results || 0;
    const retrievalAccuracy = accTotal > 0 ? Math.round((accWithResults / accTotal) * 100) : 0;

    return {
      totalDocuments: totalDocsResult?.c || 0,
      totalChunks: totalChunksResult?.c || 0,
      totalConversations: totalConvResult?.c || 0,
      weeklyNewDocs: weeklyDocsResult?.c || 0,
      weeklyNewChunks: weeklyChunksResult?.c || 0,
      weeklyNewConversations: weeklyConvResult?.c || 0,
      avgLatencyMs: Math.round(avgLatencyResult?.avg || 0),
      categories: categoryResults as Array<{
        category: string;
        count: number;
      }>,
      recentConversations: recentConvResults.map((r: any) => ({
        sessionId: r.session_id,
        question: r.question,
        time: r.time,
        status: 'success',
      })),
      systemStatus: {
        embeddingProvider: this.embeddingConfig.provider,
        model: this.embeddingConfig.model,
        dimensions: this.embeddingConfig.dimensions,
        bm25Ready: (bm25MetaResult?.total_docs || 0) > 0,
      },
      trends: {
        dates: trendDates,
        conversations: trendConversations,
      },
      retrievalAccuracy,
    };
  }

  /**
   * 切片预览（不入库，仅返回分块结果用于前端展示）
   */
  previewChunking(
    content: string,
    config: { chunkSize: number; chunkOverlap: number }
  ): {
    chunks: string[];
    stats: {
      count: number;
      avgLength: number;
      maxLength: number;
      minLength: number;
    };
  } {
    const cleanContent = this.preprocessText(content, 'text');
    const chunks = splitTextIntoChunks(cleanContent, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });

    const lengths = chunks.map((c) => c.length);
    return {
      chunks,
      stats: {
        count: chunks.length,
        avgLength: lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
        maxLength: lengths.length > 0 ? Math.max(...lengths) : 0,
        minLength: lengths.length > 0 ? Math.min(...lengths) : 0,
      },
    };
  }
}

/**
 * 工厂函数 - 创建RAG服务实例
 * 
 * @param db - D1 数据库实例
 * @param kv - KV 命名空间
 * @param apiKey - VectorEngine API Key (用于LLM Chat)
 * @param embeddingConfig - Embedding 配置（可选，默认使用 VectorEngine）
 */
export function createRAGService(
  db: D1Database,
  kv: KVNamespace,
  apiKey: string,
  embeddingConfig?: EmbeddingConfig,
  vectorize?: Vectorize
): RAGService {
  return new RAGService(db, kv, apiKey, embeddingConfig, vectorize);
}
