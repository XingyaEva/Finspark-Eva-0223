# RAG 上下文扩展 & 页码修复 — 架构设计与开发方案

> Date: 2026-04-06 | Author: AI Developer | Status: DRAFT

---

## 一、当前架构分析

### 1.1 数据流全貌

```
PDF 上传                    查询时
───────                    ──────
                                        ┌──────────────┐
MinerU PDF                              │  用户提问     │
    ↓                                   └──────┬───────┘
full_output.md (无页码标记)                     ↓
    ↓                               ① IntentService.classifyAndRewrite()
cleanMineruMarkdown()                          ↓
    ↓                               ② 并行检索 ──────────────────────────
extractStructuredBlocks()              │                                │
    ↓                          Vector (Vectorize ANN)           FTS5 / BM25
splitTextIntoChunks(500字, 100重叠)     topK×2                      topK×2
    ↓                                  │                                │
rag_chunks 表                          └──────────┬─────────────────────┘
(chunk_index, content,                            ↓
 page_range=全部是1,                    ③ mergeAndDedup()
 metadata={})                                     ↓
    ↓                               ④ [可选] LLM/BGE Rerank
Embedding → KV + Vectorize                        ↓
                                       ⑤ slice(0, topK=5)  ← 每个 chunk 500字
                                                  ↓
                                       ⑥ generateAnswer(question, 5 chunks)
                                                  ↓
                                              回答 + sources
```

### 1.2 当前缺陷总结

| # | 缺陷 | 影响 | 严重度 |
|---|------|------|--------|
| 1 | **chunk 孤立，无上下文扩展** | 500字 chunk 信息不完整，表格/段落被截断 | 🔴 高 |
| 2 | **页码全为 1** | 无法定位原文位置，reference_pages 无法标注 | 🔴 高 |
| 3 | **无 Parent-Child 层级** | 无法"小 chunk 精确检索 + 大 chunk 完整回答" | 🟡 中 |
| 4 | **reference_pages 全空** | Recall 评估不精确 | 🟡 中 |

### 1.3 受影响的文件清单

```
src/services/ragPipeline.ts      — 查询编排（核心修改）
src/services/ragPdfParser.ts     — MinerU ZIP 解析 + 页码注入
src/services/rag.ts              — ingestDocument + searchSimilar
src/services/ragAutoSync.ts      — 异步同步分块路径
src/services/ragTestSet.ts       — 评估配置传递
src/routes/rag-enhance.ts        — API 层 eval config 传递
migrations/                      — 新增 DB schema
```

---

## 二、设计方案

### 2.1 总体架构目标

```
                        ┌─ context_mode: "none"     (现状：直接用原始 chunks)
评估/查询 config ──────┤─ context_mode: "adjacent"  (相邻扩展：N-1, N, N+1)
                        ├─ context_mode: "parent"    (父子窗口：小检索大返回)
                        └─ context_mode: "sentence_window" (句子窗口)
```

**设计原则**：
1. **context_mode 是运行时参数**，不改变已有数据（向后兼容）
2. **评估可对比**：同一测试集可以用不同 context_mode 跑多轮评估
3. **渐进式实施**：先做 adjacent，再做 parent，最后 sentence_window

### 2.2 方案详解

---

#### 方案 A：Adjacent Chunk Expansion（相邻 chunk 扩展）

**原理**：检索到 chunk_index=N 后，自动拉取 N-w ~ N+w 的相邻 chunks 拼接

```
                检索命中
                  ↓
... [chunk N-2] [chunk N-1] [chunk N] [chunk N+1] [chunk N+2] ...
                ←─────────── window_size=1 ───────────────→
                  拼接后传给 LLM
```

**优势**：
- ✅ **零数据迁移** — 使用现有 `rag_chunks.chunk_index` 即可
- ✅ **实现简单** — 仅修改 `ragPipeline.ts` 的后处理逻辑
- ✅ **立即可评估** — 无需重新入库

**劣势**：
- ⚠️ 窗口是固定的，不感知语义边界（可能拉到不相关段落）
- ⚠️ 扩展后 token 消耗增加（每 chunk 从 500→1500 字，5 chunks = 7500 字）

**配置项**：
```typescript
interface EnhancedRAGConfig {
  // ... 现有字段
  contextMode: 'none' | 'adjacent' | 'parent' | 'sentence_window';
  adjacentWindow: number;  // adjacent 模式的窗口大小，默认 1（前后各1）
}
```

**实现修改点** (`ragPipeline.ts`)：

```
步骤 ⑤（取 topK）之后、⑥（LLM 生成）之前，插入新步骤：

⑤.5 Context Expansion
  for each chunk in finalChunks:
    if config.contextMode === 'adjacent':
      SELECT content FROM rag_chunks
      WHERE document_id = chunk.documentId
        AND chunk_index BETWEEN (chunk.chunkIndex - config.adjacentWindow)
                            AND (chunk.chunkIndex + config.adjacentWindow)
      ORDER BY chunk_index ASC
      → 拼接为 expandedContent
    chunk.content = expandedContent
```

**DB 查询开销**：
- topK=5 × 1 batch query = 1 次 D1 查询（WHERE document_id AND chunk_index IN(...)）
- ~5ms，可忽略

---

#### 方案 B：Parent-Child Chunk Architecture（父子分块架构）

**原理**：文档同时存 2 层 chunk — 小粒度用于检索，大粒度用于回答

```
Parent chunks (2000字):  [===P0===]  [===P1===]  [===P2===]  [===P3===]
Child chunks  (500字):   [C0][C1][C2][C3][C4][C5][C6][C7][C8][C9][C10]...
                          ↑       ↑
                       检索命中   检索命中
                          ↓       ↓
                       返回 P0    返回 P1（去重后传给 LLM）
```

**优势**：
- ✅ 小 chunk 检索精度高（500字更聚焦）
- ✅ 大 chunk 回答完整度高（2000字覆盖完整段落）
- ✅ 语义边界更合理（parent 在段落/章节边界切分）

**劣势**：
- ⚠️ **需要新增 DB 表 + 数据回填**
- ⚠️ Parent chunk 需要生成 embedding 或通过 child 间接关联
- ⚠️ 入库流程需要同时生成两层 chunks

**新增 Schema**：

```sql
-- Migration 0037: Parent-Child Chunk Architecture
CREATE TABLE IF NOT EXISTS rag_parent_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    parent_index INTEGER NOT NULL,      -- 父块在文档内的顺序
    content TEXT NOT NULL,               -- 父块完整文本（~2000字）
    content_length INTEGER DEFAULT 0,
    page_start INTEGER,                  -- 起始页码
    page_end INTEGER,                    -- 结束页码
    heading TEXT,                         -- 所属章节标题
    child_start_index INTEGER NOT NULL,  -- 第一个子 chunk 的 chunk_index
    child_end_index INTEGER NOT NULL,    -- 最后一个子 chunk 的 chunk_index
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_chunks_doc ON rag_parent_chunks(document_id);

-- 子 chunk 增加 parent 关联
ALTER TABLE rag_chunks ADD COLUMN parent_chunk_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_chunks_parent ON rag_chunks(parent_chunk_id);
```

**实现修改点**：

1. **入库时** (`rag.ts` / `ragAutoSync.ts`)：
   - `extractStructuredBlocks` 产出的 blocks 先按 ~2000字切为 parent chunks
   - 每个 parent 内部再按 500字切为 child chunks
   - 写入两张表并建立关联

2. **检索时** (`ragPipeline.ts`)：
   - 向量检索仍对 child chunks（保持检索精度）
   - 命中 child 后，通过 `parent_chunk_id` 查 parent content
   - 同一 parent 下多个 child 命中 → 去重为一个 parent
   - 传给 LLM 的是 parent content

3. **数据回填**：
   - 需要对已入库的 14 个文档 (~31K chunks) 重新生成 parent 层
   - 回填脚本从 `rag_chunks` 按 `document_id + chunk_index` 顺序读出，
    每 4 个相邻 child 合并为一个 parent

---

#### 方案 C：Sentence Window（句子窗口）

**原理**：入库时按句子级别切小 chunk（~100字），检索后动态向两边扩展到目标 token 数

```
入库: [s0][s1][s2][s3][s4][s5][s6][s7][s8][s9]...  (每句 ~100字)
                        ↑ 检索命中 s4
                  ←── 动态扩展到 2000字 ──→
              [s2][s3][s4][s5][s6] → 传给 LLM
```

**优势**：
- ✅ 检索精度最高（细粒度匹配）
- ✅ 上下文窗口可以动态调整

**劣势**：
- ⚠️ **需要全量重新入库**（当前 chunks 是 500字，不是句子级别）
- ⚠️ embedding 数量暴增 5倍（31K → 155K），KV/Vectorize 成本增加
- ⚠️ 实现复杂度最高

**结论**：暂不实施，留作 Phase 3 选项。

---

### 2.3 方案对比与推荐实施顺序

| | Adjacent (A) | Parent-Child (B) | Sentence Window (C) |
|---|---|---|---|
| **数据迁移** | ✅ 无需 | 🟡 需回填 parent 表 | 🔴 全量重入库 |
| **改动范围** | 小（1 文件） | 中（4 文件 + migration） | 大（全栈） |
| **检索精度提升** | 小（同 chunk 精度） | 中（child 精度 + parent 上下文） | 高 |
| **上下文完整度** | 中（固定窗口） | 高（语义 parent） | 高（动态窗口） |
| **评估可对比** | ✅ config 切换 | ✅ config 切换 | ✅ config 切换 |
| **实施时间** | ~2h | ~6h | ~16h |
| **推荐优先级** | 🥇 Phase 1 | 🥈 Phase 2 | 🥉 Phase 3 |

**推荐实施路线**：
```
Phase 1: Adjacent Expansion (立即可用, 0 数据迁移)
    ↓ 评估对比 none vs adjacent
Phase 2: Parent-Child (数据回填后可用)
    ↓ 评估对比 adjacent vs parent
Phase 3: 页码修复 (parallel, 可以和 Phase 1-2 同时)
```

---

## 三、Phase 1 详细设计：Adjacent Chunk Expansion

### 3.1 Config 变更

```typescript
// src/services/ragPipeline.ts
export interface EnhancedRAGConfig {
  enableBm25: boolean;
  enableRerank: boolean;
  topK: number;
  minScore: number;
  rerankWeight: number;
  documentIds?: number[];
  stockCode?: string;

  // === NEW: Context Expansion ===
  contextMode: 'none' | 'adjacent' | 'parent';  // 上下文扩展模式
  contextWindow: number;                          // adjacent 模式窗口大小（前后各 N 个 chunk）
}

export const DEFAULT_ENHANCED_CONFIG: EnhancedRAGConfig = {
  enableBm25: true,
  enableRerank: false,
  topK: 5,
  minScore: 0.25,
  rerankWeight: 0.7,
  contextMode: 'none',     // 默认关闭（向后兼容）
  contextWindow: 1,        // 默认前后各 1 个 chunk
};
```

### 3.2 Pipeline 修改 (`ragPipeline.ts`)

在 `enhancedQuery()` 的步骤 ⑤（取 topK）和 ⑥（LLM 生成）之间插入：

```typescript
// ⑤.5 Context Expansion（上下文扩展）
if (config.contextMode === 'adjacent' && config.contextWindow > 0) {
  finalChunks = await this.expandAdjacentContext(finalChunks, config.contextWindow);
}
```

新增私有方法：

```typescript
/**
 * 相邻 chunk 上下文扩展
 *
 * 对每个检索到的 chunk，查询其前后 N 个相邻 chunk，
 * 拼接为完整的上下文窗口传给 LLM。
 *
 * 优化：
 * - 同一文档的多个命中 chunk 合并为一次 DB 查询
 * - 相邻 chunk 窗口有重叠时自动去重、合并为连续区间
 */
private async expandAdjacentContext(
  chunks: MergedChunk[],
  windowSize: number
): Promise<MergedChunk[]> {

  // 1. 收集所有需要查询的 (document_id, chunk_index 范围) 对
  //    去重 + 合并重叠区间
  const rangesByDoc = new Map<number, Array<{min: number, max: number, origIdx: number}>>();

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const docId = c.documentId;
    const centerIdx = c.chunkIndex;  // 需要从 metadata 或 DB 获取
    const min = Math.max(0, centerIdx - windowSize);
    const max = centerIdx + windowSize;

    if (!rangesByDoc.has(docId)) rangesByDoc.set(docId, []);
    rangesByDoc.get(docId)!.push({ min, max, origIdx: i });
  }

  // 2. 合并同文档的重叠区间（减少 DB 查询 + 避免重复 chunks）
  //    例：chunk 5 (window 4-6) + chunk 7 (window 6-8) → 合并为 4-8

  // 3. 批量查询相邻 chunks
  //    SELECT content, chunk_index FROM rag_chunks
  //    WHERE document_id = ? AND chunk_index BETWEEN ? AND ?
  //    ORDER BY chunk_index ASC

  // 4. 拼接：将原始 chunk 的 content 替换为扩展后的连续文本
  //    保留原始的 score, source, pageRange 等元信息
  //    更新 content 和 contentLength

  return expandedChunks;
}
```

### 3.3 chunk_index 传递修复

当前 `mergeAndDedup()` 返回的对象缺少 `chunkIndex` 字段，需要补充：

```typescript
// mergeAndDedup() 返回类型新增 chunkIndex
{
  chunkId: number;
  chunkIndex: number;  // NEW: 用于 adjacent expansion
  documentId: number;
  // ...
}
```

向量检索路径 (`searchSimilarVectorize`) 已有 `chunk_index`，需要传递到合并结果。
BM25/FTS5 路径需要通过额外 DB 查询补充 `chunk_index`。

### 3.4 评估配置传递

```typescript
// src/services/ragTestSet.ts — EvalConfig 新增字段
export interface EvalConfig {
  searchStrategy: 'vector' | 'bm25' | 'hybrid';
  topK: number;
  minScore: number;
  enableRerank: boolean;
  rerankWeight: number;
  llmModel?: string;

  // === NEW ===
  contextMode?: 'none' | 'adjacent' | 'parent';
  contextWindow?: number;
}

// src/routes/rag-enhance.ts — ragQueryFn 传递新 config
const ragQueryFn = async (question: string, config: any) => {
  const result = await pipelineService.enhancedQuery({
    question,
    config: {
      enableBm25: config.searchStrategy !== 'vector',
      enableRerank: config.enableRerank || false,
      topK: config.topK || 5,
      minScore: config.minScore || 0.25,
      contextMode: config.contextMode || 'none',        // NEW
      contextWindow: config.contextWindow ?? 1,          // NEW
    },
  });
  // ...
};
```

### 3.5 评估对比使用方式

```bash
# 基线评估（无上下文扩展）
curl -X POST /api/rag/enhance/evaluations -d '{
  "testSetId": 1,
  "name": "baseline-no-expansion",
  "config": {
    "strategy": "hybrid", "topK": 5,
    "contextMode": "none"
  }
}'

# Adjacent 扩展 window=1
curl -X POST /api/rag/enhance/evaluations -d '{
  "testSetId": 1,
  "name": "adjacent-w1",
  "config": {
    "strategy": "hybrid", "topK": 5,
    "contextMode": "adjacent", "contextWindow": 1
  }
}'

# Adjacent 扩展 window=2
curl -X POST /api/rag/enhance/evaluations -d '{
  "testSetId": 1,
  "name": "adjacent-w2",
  "config": {
    "strategy": "hybrid", "topK": 5,
    "contextMode": "adjacent", "contextWindow": 2
  }
}'
```

---

## 四、Phase 2 详细设计：Parent-Child Architecture

### 4.1 DB Migration

```sql
-- Migration 0037: Parent-Child Chunk Architecture

-- 父块表
CREATE TABLE IF NOT EXISTS rag_parent_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    parent_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_length INTEGER DEFAULT 0,
    page_start TEXT,                     -- 起始页码（string，兼容 "12-13" 格式）
    page_end TEXT,                       -- 结束页码
    heading TEXT,                        -- 所属章节
    child_start_index INTEGER NOT NULL,  -- 对应子 chunk 的起始 chunk_index
    child_end_index INTEGER NOT NULL,    -- 对应子 chunk 的结束 chunk_index
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_chunks_doc ON rag_parent_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_parent_chunks_range ON rag_parent_chunks(document_id, child_start_index, child_end_index);

-- 子 chunk 增加 parent 关联（NULL 表示尚未关联）
ALTER TABLE rag_chunks ADD COLUMN parent_chunk_id INTEGER;
```

### 4.2 Parent 生成策略

```
Parent chunk 大小: ~2000 字（约 4 个 child chunk）
切分边界优先级:
  1. 章节标题（heading change）
  2. 双换行（段落边界）
  3. 硬切 2000 字

同一 parent 下的 child chunks 共享:
  - parent_chunk_id → rag_parent_chunks.id
  - 相同的 heading / page_range
```

### 4.3 回填脚本设计

```typescript
// scripts/backfill-parent-chunks.ts
// 1. 遍历每个 document_id
// 2. 按 chunk_index ASC 读出所有 child chunks
// 3. 每 4 个 child 合并为 1 个 parent（考虑 heading 变化则提前切断）
// 4. 写入 rag_parent_chunks
// 5. 更新 rag_chunks.parent_chunk_id
```

### 4.4 Pipeline 查询修改

```typescript
if (config.contextMode === 'parent') {
  // 检索仍用 child chunks（500字）
  // 命中后查询 parent:
  //   SELECT pc.content FROM rag_parent_chunks pc
  //   JOIN rag_chunks c ON c.parent_chunk_id = pc.id
  //   WHERE c.id IN (命中的 chunk ids)
  // 去重同一 parent → 直接用 parent content 传给 LLM
}
```

### 4.5 评估对比

```bash
# Parent 模式
curl -X POST /api/rag/enhance/evaluations -d '{
  "testSetId": 1,
  "name": "parent-child",
  "config": {
    "strategy": "hybrid", "topK": 5,
    "contextMode": "parent"
  }
}'
```

---

## 五、MinerU 页码修复方案

### 5.1 问题根因

```
MinerU ZIP 输出结构:
├── full_output.md          ← 当前只提取这个（无页码标记）
├── content_list.json       ← 包含 page_idx 字段（被忽略了！）
├── middle.json             ← 中间格式（包含详细 bbox）
└── images/                 ← 图片资源
```

`extractStructuredBlocks()` 依赖 `<!-- page: N -->` 注释追踪页码，
但 MinerU 的 markdown 不包含这种注释，所以 `currentPage` 永远是初始值 `1`。

### 5.2 修复方案

**核心思路**：从 `content_list.json` 读取 `page_idx`，注入到 markdown 中

#### 修改 1: `extractMarkdownFromZip()` 改为 `extractFromZip()`

```typescript
// ragPdfParser.ts — 返回 markdown + page_map
interface ZipExtractionResult {
  markdown: string;
  pageMap: Array<{ text: string; pageIdx: number }>; // from content_list.json
}

function extractFromZip(zipBytes: Uint8Array): ZipExtractionResult {
  const decompressed = unzipSync(zipBytes);

  // 1. 提取 markdown（同现有逻辑）
  let markdown = '';
  for (const [name, data] of Object.entries(decompressed)) {
    if (name.endsWith('.md')) { markdown = decode(data); break; }
  }

  // 2. 提取 content_list.json 中的 page_idx 映射
  let pageMap: Array<{ text: string; pageIdx: number }> = [];
  for (const [name, data] of Object.entries(decompressed)) {
    if (name.includes('content_list') && name.endsWith('.json')) {
      const list = JSON.parse(decode(data));
      pageMap = list
        .filter((item: any) => item.type === 'text' && item.text)
        .map((item: any) => ({
          text: item.text.trim().slice(0, 50),  // 取前50字作为匹配 key
          pageIdx: (item.page_idx ?? item.page_no ?? 0) + 1, // 0-based → 1-based
        }));
      break;
    }
  }

  return { markdown, pageMap };
}
```

#### 修改 2: `injectPageMarkers()` — 将 page_idx 注入 markdown

```typescript
function injectPageMarkers(markdown: string, pageMap: Array<{text: string, pageIdx: number}>): string {
  // 策略：对 pageMap 中每个条目，在 markdown 中找到对应文本位置，
  // 在其前面插入 <!-- page: N --> 注释
  // 使用贪心匹配 + 顺序遍历（pageMap 已按文档顺序排列）

  let result = markdown;
  let lastPage = 0;
  let searchOffset = 0;

  for (const entry of pageMap) {
    if (entry.pageIdx === lastPage) continue; // 同页不重复插入
    const idx = result.indexOf(entry.text.slice(0, 30), searchOffset);
    if (idx >= 0) {
      const marker = `\n<!-- page: ${entry.pageIdx} -->\n`;
      result = result.slice(0, idx) + marker + result.slice(idx);
      searchOffset = idx + marker.length + 10;
      lastPage = entry.pageIdx;
    }
  }

  return result;
}
```

#### 修改 3: 调用链更新

```typescript
// ragAutoSync.ts — parsePdf 之后
const { markdown, pageMap } = extractFromZip(zipBytes);
const markedMarkdown = injectPageMarkers(markdown, pageMap);
const cleanedMarkdown = cleanMineruMarkdown(markedMarkdown);
// → extractStructuredBlocks 现在能正确追踪 <!-- page: N --> 了
```

### 5.3 数据回填

页码修复后需要对已入库的 14 个文档重新提取页码信息。

**方案 A（推荐）**：重新从 MinerU 下载 ZIP → 提取 page_map → 回填 `rag_chunks.page_range`
**方案 B**：用 chunk 在文档中的位置估算 `page_range ≈ chunk_index / total_chunks * page_count`

---

## 六、评估对比矩阵

最终可运行的评估对比组合：

| 评估名称 | contextMode | contextWindow | 预期改进点 |
|----------|------------|---------------|-----------|
| `baseline-none` | none | - | 当前基线 |
| `adjacent-w1` | adjacent | 1 | 上下文完整度 +100% |
| `adjacent-w2` | adjacent | 2 | 上下文完整度 +200% |
| `parent-child` | parent | - | 精确检索 + 完整回答 |

每组评估的输出指标（5 维度）:
- Semantic Score（语义正确性）
- Faithfulness（忠实度）
- Exact Match（精确匹配）
- Recall（召回率）
- Citation（引用准确度）

**对比报告格式**：
```
                  none    adj-w1   adj-w2   parent
Factual (10Q)     75.2%   →?       →?       →?
Analytical (7Q)   78.6%   →?       →?       →?
Comparative (6Q)  64.8%   →?       →?       →?
```

---

## 七、实施计划

```
Phase 1: Adjacent Expansion           预计 2-3h
├── 1a. Config 变更 + 类型定义          30min
├── 1b. chunkIndex 传递修复             30min
├── 1c. expandAdjacentContext() 实现    60min
├── 1d. 评估配置传递                    30min
├── 1e. 部署 + 跑评估对比               30min
└── ✅ 可交付：none vs adjacent 对比数据

Phase 2: Parent-Child Architecture     预计 4-6h
├── 2a. DB Migration                   30min
├── 2b. 入库流程改造                    120min
├── 2c. 回填脚本                        60min
├── 2d. Pipeline 查询改造               60min
├── 2e. 部署 + 跑评估对比               60min
└── ✅ 可交付：adjacent vs parent 对比数据

Phase 3: MinerU 页码修复               预计 2-3h (可并行)
├── 3a. extractFromZip() 改造          60min
├── 3b. injectPageMarkers() 实现       60min
├── 3c. 页码回填脚本                    60min
└── ✅ 可交付：正确的 page_range 数据

Phase 4: reference_pages 标注          预计 1-2h (依赖 Phase 3)
├── 4a. LLM 辅助标注脚本               60min
├── 4b. Recall 评估精确化               30min
└── ✅ 可交付：精确 recall 评估
```

---

## 八、风险与注意事项

1. **Token 成本增加**：adjacent-w2 使每个 context 从 500字 → 2500字，
   5 chunks = 12500字 input，注意 LLM 调用成本
2. **Workers CPU 限制**：额外 DB 查询需控制在 30ms 以内
3. **向后兼容**：`contextMode: 'none'` 为默认值，不影响现有行为
4. **评估可重复性**：同一 testSet + 同一 config 应产出一致结果
   （LLM 生成有随机性，但 temperature=0.3 + 同一 seed 可控）
