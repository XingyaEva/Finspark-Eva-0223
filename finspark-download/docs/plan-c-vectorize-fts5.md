# 方案C：Cloudflare Vectorize + D1 FTS5 混合检索升级

## 开发方案 & 详细计划

> **目标**：将现有 RAG 管线的两个性能瓶颈替换为 Cloudflare 原生方案，实现 10-50× 检索提速，零额外基础设施成本。
>
> **基线日期**：2026-04-04

---

## 一、现状分析（AS-IS）

### 1.1 当前架构

```
用户提问
  ↓
意图识别 (ragIntent)
  ↓
┌─────────────────┬──────────────────┐
│ 向量检索（KV 全扫）│ BM25检索（D1 倒排）│
│ rag.ts           │ ragBm25.ts        │
└────────┬────────┘└────────┬─────────┘
         ├─────合并去重──────┤
         ↓
     可选 Rerank
         ↓
     LLM 生成回答
         ↓
     日志/对话记录
```

### 1.2 瓶颈一览

| 组件 | 现实现 | 瓶颈描述 | 影响 |
|------|--------|----------|------|
| **向量检索** | KV 存 embedding → JS 遍历计算 cosine | 全量扫描所有 chunk 的 KV embedding，O(N)复杂度 | >1000 chunks 时延迟 >3s，>10k 时不可用 |
| **BM25 检索** | D1 自建倒排表 `rag_bm25_tokens` | 多次 SQL 查询（token匹配→DF统计→文档长度→内容获取），每次检索 4-5 轮 DB round-trip | >5000 token 记录时延迟 >1s |
| **中文分词** | `Intl.Segmenter('zh-CN')` | 基础分词质量有限，金融专业词靠硬编码补充 | 查全率偏低 |
| **入库写入** | embedding → KV → D1 chunks → D1 bm25_tokens | 双写链路长，bm25 倒排索引每 50 条一批 | 大文档入库慢 |

### 1.3 涉及文件清单（将被修改）

| 文件 | 行数 | 改动范围 |
|------|------|----------|
| `src/services/rag.ts` | 1506 | `searchSimilar()` 方法重写，`ingestDocument()` 新增 Vectorize 写入 |
| `src/services/ragBm25.ts` | 613 | 用 FTS5 替代全部自建倒排逻辑 |
| `src/services/ragPipeline.ts` | 1182 | `mergeAndDedup()` 适配新数据结构 |
| `src/types/index.ts` | ~640 | Bindings 接口新增 `VECTORIZE` |
| `wrangler.jsonc` | ~43 | 新增 vectorize binding |
| `migrations/` | 新增 2 个 | FTS5 虚拟表 + 数据迁移 SQL |

---

## 二、目标架构（TO-BE）

```
用户提问
  ↓
意图识别 (ragIntent)
  ↓
┌──────────────────────┬──────────────────────┐
│ Vectorize 向量检索     │ D1 FTS5 全文检索       │
│ env.VECTORIZE.query()│ SELECT ... MATCH ... │
│ ANN ~10ms            │ FTS5 BM25 ~5ms       │
└──────────┬───────────┘└──────────┬───────────┘
           ├──────合并去重──────────┤
           ↓
       可选 Rerank
           ↓
       LLM 生成回答
           ↓
       日志/对话记录
```

### 关键变化

| 维度 | AS-IS | TO-BE | 提升 |
|------|-------|-------|------|
| 向量检索 | KV 全扫 + JS cosine | Vectorize ANN | 100× 速度（3s → 30ms） |
| 全文检索 | 自建倒排 4-5次DB查询 | FTS5 单次 MATCH | 10× 速度（1s → 100ms） |
| 中文分词 | Intl.Segmenter + 硬编码词典 | FTS5 unicode61 + trigram 互补 | 查全率提升 |
| 入库 | KV + D1 bm25_tokens 双写 | Vectorize.upsert + FTS5 触发器 | 入库 3× 简化 |
| 月成本 | $0-5 (D1+KV) | $5 (Workers Paid 已含) | $0 增量 |

---

## 三、技术方案详设

### 3.1 Phase A — Cloudflare Vectorize 集成（向量检索替换）

#### 3.1.1 创建 Vectorize 索引

```bash
# DashScope text-embedding-v4 输出 1024 维
npx wrangler vectorize create finspark-rag-index \
  --dimensions=1024 \
  --metric=cosine

# 创建元数据索引（支持按股票代码/文档ID/分类过滤）
npx wrangler vectorize create-metadata-index finspark-rag-index \
  --property-name=stock_code --type=string

npx wrangler vectorize create-metadata-index finspark-rag-index \
  --property-name=document_id --type=number

npx wrangler vectorize create-metadata-index finspark-rag-index \
  --property-name=category --type=string
```

#### 3.1.2 wrangler.jsonc 配置

```jsonc
{
  // ... 现有配置 ...
  "vectorize": [
    {
      "binding": "VECTORIZE",
      "index_name": "finspark-rag-index"
    }
  ]
}
```

#### 3.1.3 Bindings 类型更新（src/types/index.ts）

```typescript
export interface Bindings {
  // ... 现有 bindings ...
  /** Vectorize 向量数据库（RAG 语义检索） */
  VECTORIZE?: Vectorize;
}
```

#### 3.1.4 rag.ts — searchSimilar() 重写

**现有逻辑**（将被替换）：
1. 生成 query embedding
2. D1 查询所有有 embedding 的 chunks
3. 逐个从 KV 取 embedding JSON
4. JS 循环计算 cosine similarity
5. 排序取 topK

**新逻辑**：
1. 生成 query embedding（保持不变）
2. 构建 Vectorize 查询（含 metadata filter）
3. 一次调用 `env.VECTORIZE.query()` 获取 topK 结果
4. 用返回的 chunk ID 从 D1 获取完整内容

```typescript
// 新增：Vectorize 向量检索（替换 KV 全扫）
async searchSimilarVectorize(
  query: string,
  vectorize: Vectorize,  // env.VECTORIZE
  options: { topK?, minScore?, stockCode?, documentIds?, category? }
): Promise<ChunkWithScore[]> {
  // 1. 生成查询向量
  const queryEmbedding = await generateEmbedding(query, this.embeddingConfig);

  // 2. 构建 metadata filter
  const filter: VectorizeVectorMetadataFilter = {};
  if (options.stockCode) filter.stock_code = options.stockCode;
  if (options.category) filter.category = options.category;

  // 3. Vectorize 查询（ANN 近似最近邻，~10ms）
  const matches = await vectorize.query(queryEmbedding, {
    topK: options.topK || 10,
    returnMetadata: 'all',
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  // 4. 从 D1 获取完整 chunk 内容
  const chunkIds = matches.matches.map(m => parseInt(m.id));
  // ... D1 batch 查询 chunk 内容 ...
}
```

#### 3.1.5 rag.ts — ingestDocument() 增强

在现有入库流程中，embedding 生成后新增一步 **同步写入 Vectorize**：

```typescript
// 现有：存 embedding 到 KV
await this.kv.put(embeddingKey, JSON.stringify(embeddings[i]));

// 新增：同步写入 Vectorize（batch upsert）
const vectors: VectorizeVector[] = batchItems.map((item, i) => ({
  id: `${documentId}:${batchStart + i}`,  // chunk 唯一 ID
  values: embeddings[i],
  metadata: {
    document_id: documentId,
    chunk_index: batchStart + i,
    stock_code: stockCode || '',
    category: category || 'general',
  },
}));
await vectorize.upsert(vectors);  // 每批最多 1000 个
```

#### 3.1.6 rag.ts — deleteDocument() 增强

删除文档时同步清理 Vectorize：

```typescript
// 现有：删除 KV embedding
// 新增：删除 Vectorize 向量
const chunkIds = chunks.results.map((c, i) => `${documentId}:${i}`);
await vectorize.deleteByIds(chunkIds);
```

#### 3.1.7 兼容策略

- **双写过渡期**：入库时同时写 KV 和 Vectorize，检索优先走 Vectorize，失败回退 KV
- **环境判断**：`if (env.VECTORIZE)` 走新路径，否则走旧路径（本地开发兼容）
- **渐进迁移**：提供 `/api/rag/ops/migrate-vectorize` 管理接口，批量迁移历史数据

---

### 3.2 Phase B — D1 FTS5 替换 BM25

#### 3.2.1 新建 FTS5 虚拟表（Migration 0033）

```sql
-- Migration 0033: D1 FTS5 全文检索（替换自建 BM25 倒排索引）

-- 创建 FTS5 虚拟表
-- tokenize: unicode61 对中英文都有基础支持
-- content 同步自 rag_chunks 表
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  content,                           -- 全文检索字段
  chunk_type,                        -- 块类型（用于权重区分）
  tokenize = 'unicode61 remove_diacritics 2',
  content = 'rag_chunks',            -- 关联 content table
  content_rowid = 'id'               -- 用 rag_chunks.id 作为 rowid
);

-- 触发器：INSERT 自动同步
CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_insert
AFTER INSERT ON rag_chunks
BEGIN
  INSERT INTO rag_chunks_fts(rowid, content, chunk_type)
  VALUES (NEW.id, NEW.content, NEW.chunk_type);
END;

-- 触发器：DELETE 自动同步
CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_delete
AFTER DELETE ON rag_chunks
BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content, chunk_type)
  VALUES ('delete', OLD.id, OLD.content, OLD.chunk_type);
END;

-- 触发器：UPDATE 自动同步
CREATE TRIGGER IF NOT EXISTS rag_chunks_fts_update
AFTER UPDATE ON rag_chunks
BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content, chunk_type)
  VALUES ('delete', OLD.id, OLD.content, OLD.chunk_type);
  INSERT INTO rag_chunks_fts(rowid, content, chunk_type)
  VALUES (NEW.id, NEW.content, NEW.chunk_type);
END;
```

#### 3.2.2 历史数据回填（Migration 0034）

```sql
-- Migration 0034: 回填 FTS5 索引（历史数据）
INSERT INTO rag_chunks_fts(rowid, content, chunk_type)
SELECT id, content, COALESCE(chunk_type, 'text')
FROM rag_chunks
WHERE id NOT IN (SELECT rowid FROM rag_chunks_fts);
```

#### 3.2.3 新建 ragFts5.ts 服务

```typescript
/**
 * FTS5 全文检索服务 — services/ragFts5.ts
 *
 * 替换 ragBm25.ts 的自建倒排索引
 * 优势：
 * - SQLite FTS5 原生 BM25 评分，单次查询完成
 * - 触发器自动同步，无需手动构建索引
 * - 支持前缀查询、短语查询、布尔运算
 */

export interface FTS5SearchResult {
  chunkId: number;
  documentId: number;
  score: number;       // FTS5 bm25() 返回的相关性分数
  content: string;
  snippet: string;     // FTS5 highlight/snippet 高亮片段
}

export class FTS5Service {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * FTS5 全文检索
   * 将用户查询转换为 FTS5 MATCH 语法
   *
   * FTS5 MATCH 语法:
   * - 空格 = AND
   * - OR 关键字
   * - "短语匹配"
   * - 前缀* 模式
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

    // 1. 构建 FTS5 查询词
    const ftsQuery = this.buildFTS5Query(query);
    if (!ftsQuery) return [];

    // 2. 单次 SQL 完成检索 + BM25 评分 + 内容获取
    let sql = `
      SELECT
        f.rowid AS chunk_id,
        c.document_id,
        bm25(rag_chunks_fts) AS score,
        c.content,
        snippet(rag_chunks_fts, 0, '<b>', '</b>', '...', 32) AS snippet
      FROM rag_chunks_fts f
      JOIN rag_chunks c ON c.id = f.rowid
      JOIN rag_documents d ON d.id = c.document_id
      WHERE rag_chunks_fts MATCH ?
        AND d.status = 'completed'
    `;
    const binds: any[] = [ftsQuery];

    if (documentIds?.length) {
      sql += ` AND c.document_id IN (${documentIds.map(() => '?').join(',')})`;
      binds.push(...documentIds);
    }
    if (stockCode) {
      sql += ` AND d.stock_code = ?`;
      binds.push(stockCode);
    }

    sql += ` ORDER BY score LIMIT ?`;  // bm25() 返回负数，越小越相关
    binds.push(topK);

    const result = await this.db.prepare(sql).bind(...binds).all();
    return (result.results || []).map((r: any) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      score: Math.abs(r.score),  // 转正数，与向量分数可比
      content: r.content,
      snippet: r.snippet,
    }));
  }

  /**
   * 构建 FTS5 MATCH 查询
   * 策略：对分词结果用空格连接（FTS5 默认 AND），
   *        金融专有词用引号包裹做短语匹配
   */
  private buildFTS5Query(query: string): string {
    // 清洗特殊字符
    const cleaned = query
      .replace(/[""'']/g, '"')
      .replace(/[^\u4e00-\u9fff\w\s"]/g, ' ')
      .trim();
    if (!cleaned) return '';

    // 金融高频复合词：短语匹配
    const FINANCIAL_PHRASES = [
      '营业收入', '净利润', '毛利率', '资产负债率',
      '每股收益', '经营现金流', '应收账款', '研发费用',
      '同比增长', '同比下降', '贵州茅台', '五粮液',
    ];

    let result = cleaned;
    for (const phrase of FINANCIAL_PHRASES) {
      if (result.includes(phrase)) {
        result = result.replace(phrase, `"${phrase}"`);
      }
    }

    return result;
  }

  /**
   * 检查 FTS5 索引是否可用
   */
  async isReady(): Promise<boolean> {
    try {
      const r = await this.db
        .prepare("SELECT COUNT(*) AS cnt FROM rag_chunks_fts")
        .first<{ cnt: number }>();
      return (r?.cnt || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * 获取索引统计
   */
  async getStats(): Promise<{ totalRows: number }> {
    const r = await this.db
      .prepare("SELECT COUNT(*) AS cnt FROM rag_chunks_fts")
      .first<{ cnt: number }>();
    return { totalRows: r?.cnt || 0 };
  }
}

export function createFTS5Service(db: D1Database): FTS5Service {
  return new FTS5Service(db);
}
```

#### 3.2.4 ragPipeline.ts 适配

- `PipelineService` 构造函数新增可选参数 `fts5Service?: FTS5Service`
- `enhancedQuery()` 检索分支：
  - 优先用 `fts5Service.search()`，失败降级用 `bm25Service.search()`
  - `mergeAndDedup()` 适配 FTS5 返回格式（`FTS5SearchResult` → 统一结构）

---

### 3.3 Phase C — 迁移工具 & 管理接口

#### 3.3.1 历史向量迁移接口

```
POST /api/rag/ops/migrate-vectorize
```

功能：
- 扫描 `rag_chunks` 中 `has_embedding=1` 的 chunk
- 从 KV 读取 embedding JSON
- 批量 upsert 到 Vectorize（每批 500 个）
- 记录进度到 KV，支持断点续传

#### 3.3.2 FTS5 重建接口

```
POST /api/rag/ops/rebuild-fts5
```

功能：
- 重新执行 FTS5 回填 SQL
- 返回受影响行数

#### 3.3.3 检索 A/B 对比接口

```
GET /api/rag/ops/search-compare?q=查询词&mode=all
```

功能：
- 同时执行 Vectorize / KV全扫 / FTS5 / BM25 四路检索
- 返回各路延迟和结果对比

---

## 四、开发计划（估时：4-6 个工作日）

### Day 1 — 基础设施 & Vectorize 接入

| 序号 | 任务 | 预计耗时 | 产出 |
|------|------|----------|------|
| D1.1 | 创建 Vectorize 索引 + metadata indexes | 0.5h | 索引创建成功 |
| D1.2 | 更新 `wrangler.jsonc` 添加 vectorize binding | 0.5h | binding 配置 |
| D1.3 | 更新 `Bindings` TypeScript 接口 | 0.5h | 类型安全 |
| D1.4 | 实现 `searchSimilarVectorize()` 新方法 | 2h | 向量检索新路径 |
| D1.5 | 实现 Vectorize 环境检测 + 降级逻辑 | 1h | 兼容双模式 |
| D1.6 | 单元测试（mock Vectorize binding） | 1.5h | 测试覆盖 |

### Day 2 — 入库链路 Vectorize 双写

| 序号 | 任务 | 预计耗时 | 产出 |
|------|------|----------|------|
| D2.1 | `ingestDocument()` 新增 Vectorize upsert | 2h | 双写入库 |
| D2.2 | `deleteDocument()` 新增 Vectorize 清理 | 1h | 完整生命周期 |
| D2.3 | 历史数据迁移工具 `/migrate-vectorize` | 2h | 批量迁移脚本 |
| D2.4 | 在 rag-ops.ts 注册迁移路由 | 0.5h | API 接入 |
| D2.5 | 集成测试：入库 → 检索端到端 | 1.5h | E2E 验证 |

### Day 3 — D1 FTS5 替换 BM25

| 序号 | 任务 | 预计耗时 | 产出 |
|------|------|----------|------|
| D3.1 | 编写 Migration 0033 (FTS5 虚拟表 + 触发器) | 1h | SQL migration |
| D3.2 | 编写 Migration 0034 (历史数据回填) | 0.5h | 回填脚本 |
| D3.3 | 实现 `ragFts5.ts` 服务 | 3h | FTS5 检索服务 |
| D3.4 | FTS5 查询构建器（金融词短语匹配） | 1h | 查询优化 |
| D3.5 | FTS5 服务单元测试 | 1.5h | 测试覆盖 |

### Day 4 — Pipeline 集成 & 管理接口

| 序号 | 任务 | 预计耗时 | 产出 |
|------|------|----------|------|
| D4.1 | `ragPipeline.ts` 集成 FTS5 + Vectorize | 2.5h | 管线升级 |
| D4.2 | `mergeAndDedup()` 适配新数据格式 | 1h | 合并逻辑 |
| D4.3 | 检索 A/B 对比接口 | 1.5h | 性能对比工具 |
| D4.4 | FTS5 重建管理接口 | 0.5h | 运维接口 |
| D4.5 | Pipeline 日志新增检索通道标记 | 0.5h | 可观测性 |

### Day 5 — 测试 & 部署

| 序号 | 任务 | 预计耗时 | 产出 |
|------|------|----------|------|
| D5.1 | 本地完整 build 验证 | 0.5h | 编译通过 |
| D5.2 | 部署到 Cloudflare Pages | 0.5h | 线上环境 |
| D5.3 | 执行 D1 migrations (0033, 0034) | 0.5h | FTS5 表就绪 |
| D5.4 | 执行历史向量迁移 | 1h | Vectorize 数据就绪 |
| D5.5 | 线上 A/B 对比验证 | 1h | 性能数据 |
| D5.6 | 监控 & 告警配置 | 1h | 稳定性保障 |
| D5.7 | 提交 PR & 合并 | 0.5h | 代码交付 |

### Day 6（Buffer）— 修复 & 优化

| 序号 | 任务 | 预计耗时 | 产出 |
|------|------|----------|------|
| D6.1 | 线上问题修复 | 2h | bug fix |
| D6.2 | 性能微调（topK、minScore 阈值） | 1h | 参数优化 |
| D6.3 | 旧 BM25 倒排表清理（可选） | 1h | 技术债清理 |
| D6.4 | 文档更新 | 1h | 运维文档 |

---

## 五、风险 & 缓解措施

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| Vectorize 索引维度限制（max 1536） | 低 | 当前用 DashScope 1024 维，在限制内 | 已确认兼容 |
| Vectorize 每索引 10M 向量限制 | 极低 | 当前远未到此量级 | 按 stock_code 做 namespace 分区 |
| FTS5 中文分词质量不足 | 中 | unicode61 对中文分词粒度粗 | 查询侧增加金融词短语匹配 + 前缀查询补偿 |
| D1 不支持导出含虚拟表的数据库 | 中 | 备份受限 | 导出前临时 DROP 虚拟表，导出后重建 |
| 迁移期间检索结果不一致 | 低 | 双写期间可能存在数据不同步 | 入库走双写，检索优先 Vectorize + 降级 |
| Vectorize upsert 异步延迟（数秒） | 中 | 刚入库的文档无法立即检索到 | 入库后仍保留 KV 写入作为即时查询后备 |

---

## 六、成本预算

| 项目 | 现成本 | 升级后 | 增量 |
|------|--------|--------|------|
| D1 数据库 | $5/mo (Workers Paid) | $5/mo | $0 |
| KV 存储 | 含在 Workers Paid | 含在 Workers Paid | $0 |
| Vectorize | — | 含在 Workers Paid ($5/mo) | **$0** |
| Embedding API | ~$2/mo (DashScope) | ~$2/mo（不变） | $0 |
| **总计** | **~$7/mo** | **~$7/mo** | **$0** |

> Vectorize 已包含在 Workers Paid 计划（$5/mo）中，无额外费用。

---

## 七、验收标准

### 7.1 功能验收

- [ ] 入库文档后，Vectorize 中能查到对应向量
- [ ] FTS5 全文检索能返回正确结果
- [ ] 管线 `enhancedQuery()` 正常工作，日志显示 vectorize/fts5 通道
- [ ] 删除文档后 Vectorize 和 FTS5 同步清理
- [ ] 无 Vectorize binding 时自动降级到 KV 路径

### 7.2 性能验收

- [ ] 向量检索延迟：<100ms（现 >1000ms）
- [ ] FTS5 检索延迟：<50ms（现 >500ms）
- [ ] 端到端问答延迟：<3s（现 >5s）
- [ ] 入库延迟：无明显增加

### 7.3 可观测性验收

- [ ] `rag_message_logs` 记录检索通道（vectorize / kv / fts5 / bm25）
- [ ] A/B 对比接口可用
- [ ] 迁移进度可查

---

## 八、后续演进

| 阶段 | 内容 | 时间线 |
|------|------|--------|
| v1.1 | 删除旧 BM25 倒排表，清理 ragBm25.ts | 上线稳定 2 周后 |
| v1.2 | 删除 KV embedding 存储，全量走 Vectorize | 上线稳定 1 月后 |
| v2.0 | HyDE（假设性文档嵌入）增强检索 | Q3 2026 |
| v3.0 | 如数据量突破 5 万 chunk，评估 Elasticsearch | 按需 |

---

## 附录：Cloudflare Vectorize 关键 API 速查

```typescript
// 插入（不覆盖已有）
await env.VECTORIZE.insert(vectors);

// 更新插入（覆盖已有）
await env.VECTORIZE.upsert(vectors);

// 查询
const matches = await env.VECTORIZE.query(queryVector, {
  topK: 10,
  returnMetadata: 'all',
  filter: { stock_code: '600519' },
});

// 删除
await env.VECTORIZE.deleteByIds(['docId:0', 'docId:1']);

// 索引信息
const info = await env.VECTORIZE.describe();
```

**向量格式**：
```typescript
{
  id: string,          // 唯一ID，如 "documentId:chunkIndex"
  values: number[],    // 1024 维浮点数组
  metadata: {          // 最大 10KB
    document_id: number,
    stock_code: string,
    category: string,
  }
}
```

**限制**：
- 每索引最多 10,000,000 向量
- 最大 1536 维
- 每批 upsert 最多 1000 个（Workers端）
- topK 最大 100（不返回 values），50（返回 values/metadata）
- 元数据索引最多 10 个
