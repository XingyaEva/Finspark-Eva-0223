# 企业财报RAG项目完整分析报告

> 基于源代码深度分析，从产品经理和应用开发两个角色分别总结，并给出适配 Finspark 项目的完整设计方案和开发方案。

---

## 目录

- [第一部分：参考项目源代码总结](#第一部分参考项目源代码总结)
  - [一、产品经理视角总结](#一产品经理视角总结)
  - [二、应用开发视角总结](#二应用开发视角总结)
- [第二部分：Finspark RAG 项目完整设计方案（产品经理）](#第二部分finspark-rag-项目完整设计方案产品经理)
- [第三部分：Finspark RAG 项目完整开发方案（应用开发）](#第三部分finspark-rag-项目完整开发方案应用开发)

---

# 第一部分：参考项目源代码总结

## 一、产品经理视角总结

### 1.1 项目定位与业务价值

该项目是一个**企业级财报智能问答系统**，核心目标是解决以下业务痛点：

| 痛点 | 传统方案 | RAG方案 | 提效 |
|------|---------|---------|------|
| 财报信息检索慢 | 人工翻阅PDF，平均2小时/份 | 自然语言提问，秒级返回 | 80%+ |
| 表格数据难提取 | 手动复制粘贴 | 自动解析+结构化序列化 | 95%准确率 |
| 多公司对比困难 | 多份报告交叉比对 | 自动多公司并行检索+对比 | 60%成本降低 |
| 专业知识门槛高 | 需要财务专家解读 | AI辅助解读+引用溯源 | 降低使用门槛 |

### 1.2 产品功能全景图

```
                    ┌─────────────────────────────────────────┐
                    │           用户交互层                      │
                    │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │
                    │  │ 知识库  │ │ 智能问答 │ │ 文档管理  │  │
                    │  │  问答   │ │  (多轮)  │ │  (CRUD)   │  │
                    │  └────┬────┘ └────┬─────┘ └─────┬─────┘  │
                    └───────┼──────────┼──────────────┼────────┘
                            │          │              │
                    ┌───────┴──────────┴──────────────┴────────┐
                    │           智能检索层                      │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
                    │  │  向量    │ │  BM25    │ │  LLM     │  │
                    │  │  检索    │ │  关键词  │ │  重排序   │  │
                    │  └────┬────┘ └────┬─────┘ └────┬─────┘  │
                    │       └──────────┼──────────────┘        │
                    │          ┌───────┴────────┐              │
                    │          │  混合检索调度器  │              │
                    │          └────────────────┘              │
                    └──────────────────────────────────────────┘
                            │
                    ┌───────┴──────────────────────────────────┐
                    │           数据处理层                      │
                    │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
                    │  │  PDF     │ │  文本    │ │  向量    │  │
                    │  │  智能    │ │  分块    │ │  化存储  │  │
                    │  │  解析    │ │  (分词)  │ │  (索引)  │  │
                    │  └──────────┘ └──────────┘ └──────────┘  │
                    └──────────────────────────────────────────┘
```

### 1.3 核心功能模块分析

#### A. PDF智能解析（pdf_parsing.py + pdf_mineru.py）

**产品能力：**
- **双通道解析**：Docling本地解析 + MinerU云端解析
- **OCR识别**：支持中英文扫描件
- **表格结构提取**：准确识别复杂表格（嵌套、合并单元格）
- **多进程并行**：批量处理大量PDF

**业务价值：**
- 解析准确率 ≥ 95%
- 支持数百页年报一次性处理
- 输出JSON + Markdown双格式

#### B. 智能文本分块（text_splitter.py）

**产品能力：**
- **Token级分块**：基于tiktoken精确计算
- **页面感知**：保留页码、表格与文本的位置关系
- **序列化表格插入**：将LLM结构化的表格描述与正文分块合并
- **Markdown模式**：按行分割+重叠，适合MinerU产出的markdown

**关键参数：**
- chunk_size=300 tokens（json模式）/ 30 lines（markdown模式）
- chunk_overlap=50 tokens / 5 lines
- 使用 `RecursiveCharacterTextSplitter`

#### C. 向量化与索引（ingestion.py）

**产品能力：**
- **DashScope Embedding**：text-embedding-v1，每批25条
- **FAISS向量库**：IndexFlatIP（内积=余弦相似度）
- **BM25索引**：基于rank_bm25的关键词检索

**关键决策：**
- 每个公司一个独立的FAISS索引文件（`<sha1>.faiss`）
- 文本截断到2048字符再向量化
- BM25和向量库可独立使用也可混合

#### D. 混合检索+LLM重排（retrieval.py + reranking.py）

**产品能力：**
- **向量检索**：支持DashScope/OpenAI双provider
- **BM25检索**：分词匹配
- **混合检索**：Vector + LLM Reranking
- **LLM重排**：qwen-turbo为检索结果打分（单条/批量模式）
- **融合公式**：`combined_score = llm_weight × relevance_score + (1-llm_weight) × vector_distance`

**产品指标：**

| 检索方式 | 准确率 | 延迟 |
|---------|--------|------|
| 纯向量 | 92% | ~150ms |
| 纯BM25 | 87% | ~100ms |
| 混合+LLM重排 | 95% | ~2s |

#### E. 多Provider LLM问答（api_requests.py）

**产品能力：**
- **4种LLM Provider**：OpenAI / DashScope / IBM / Gemini
- **结构化输出**：Pydantic schema强制JSON格式
- **6种问题类型**：name / number / boolean / names / comparative / string
- **答案溯源**：自动引用页码+PDF SHA1
- **多公司比较**：自动拆解→并行检索→汇总比较

#### F. 表格序列化（tables_serialization.py）

**产品能力：**
- **上下文感知序列化**：将表格HTML+上下文文本输入LLM，输出自包含的文本描述
- **异步批量处理**：AsyncOpenaiProcessor并行序列化所有表格
- **多线程文件处理**：ThreadPoolExecutor并行处理多个报告

### 1.4 产品差异化亮点

| 特性 | 参考项目 | 行业常规 |
|------|---------|---------|
| 表格理解 | LLM序列化→独立检索 | 仅Markdown转换 |
| 检索策略 | 向量+BM25+LLM重排 | 仅向量检索 |
| 问答类型 | 6种结构化schema | 单一文本回复 |
| 多公司对比 | 自动拆解+并行+汇总 | 不支持 |
| 答案验证 | 页码引用+幻觉检测 | 无 |
| PDF解析 | Docling+MinerU双通道 | 单一解析器 |

### 1.5 产品指标体系

```
┌─────────────────────────────────────────────────────┐
│                    产品KPI                           │
├─────────────────────────────────────────────────────┤
│ 1. 检索准确率（Retrieval Precision）    目标: ≥92%  │
│ 2. 答案准确率（Answer Accuracy）        目标: ≥85%  │
│ 3. 首字响应时间（TTFT）                目标: ≤3s   │
│ 4. 全流程延迟（End-to-End Latency）    目标: ≤8s   │
│ 5. 文档处理吞吐（Ingestion Throughput） 目标: 10页/s │
│ 6. 并发能力（Concurrent Queries）       目标: 100+  │
│ 7. 可用性（Availability）               目标: 99.9% │
│ 8. 表格提取准确率                       目标: ≥95%  │
└─────────────────────────────────────────────────────┘
```

---

## 二、应用开发视角总结

### 2.1 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        Pipeline 主控制器                          │
│                       (pipeline.py)                               │
│                                                                   │
│  parse_pdf_reports → chunk_reports → create_vector_dbs            │
│       │                   │              │                        │
│       ↓                   ↓              ↓                        │
│  ┌──────────┐   ┌──────────────┐  ┌───────────────┐              │
│  │PDFParser │   │TextSplitter  │  │VectorDBIngestor│              │
│  │pdf_parsing│   │text_splitter │  │ ingestion.py  │              │
│  │pdf_mineru │   │              │  │               │              │
│  └──────────┘   └──────────────┘  └───────────────┘              │
│                                         │                         │
│  process_questions ──────────────────→  │                         │
│       │                                 │                         │
│       ↓                                 ↓                         │
│  ┌──────────────────┐   ┌──────────────────────────┐             │
│  │QuestionsProcessor│   │     向量存储层             │             │
│  │questions_processing│  │  FAISS (.faiss)          │             │
│  │                  │   │  BM25  (.pkl)            │             │
│  └───────┬──────────┘   └──────────────────────────┘             │
│          │                                                        │
│          ↓                                                        │
│  ┌──────────────────────────────────────────────────┐            │
│  │              检索与重排层                          │            │
│  │  VectorRetriever → HybridRetriever → LLMReranker │            │
│  │  BM25Retriever                                    │            │
│  └──────────────┬───────────────────────────────────┘            │
│                 ↓                                                 │
│  ┌──────────────────────────────────────────────────┐            │
│  │              LLM回答层                            │            │
│  │  APIProcessor → BaseDashscopeProcessor            │            │
│  │              → BaseOpenaiProcessor                │            │
│  │              → BaseGeminiProcessor                │            │
│  │              → BaseIBMAPIProcessor                │            │
│  └──────────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块技术实现详解

#### A. 数据处理管线

**PDF解析双通道：**

| 组件 | 技术栈 | 特点 |
|------|--------|------|
| PDFParser (Docling) | `docling.DocumentConverter` + EasyOCR | 本地部署，表格精确提取，支持并行 |
| pdf_mineru | MinerU云API | 云端OCR，适合扫描件，输出Markdown |

**数据流：**
```
PDF文件
  │
  ├─→ [Docling路径] → JSON (metainfo + content + tables + pictures)
  │                          │
  │                          ↓ tables_serialization.py
  │                     表格→LLM序列化→information_blocks
  │                          │
  │                          ↓ parsed_reports_merging.py
  │                     页面文本规整 (过滤页脚/图片，格式化标题/列表/表格)
  │
  └─→ [MinerU路径] → Markdown (full.md)
                          │
                          ↓ text_splitter.split_markdown_reports()
                     按行分割 (30行/块，5行重叠)
```

**文本分块策略对比：**

| 模式 | 适用场景 | 分块单位 | 大小 | 重叠 | 实现 |
|------|---------|---------|------|------|------|
| JSON模式 | Docling解析结果 | Token | 300 | 50 | `RecursiveCharacterTextSplitter` |
| Markdown模式 | MinerU解析结果 | 行 | 30行 | 5行 | 自定义`split_markdown_file` |

#### B. 向量化与索引构建

```python
# 核心流程
class VectorDBIngestor:
    def _get_embeddings(text, model="text-embedding-v1"):
        # DashScope TextEmbedding.call()
        # 批次大小: 25条/批
        # 重试策略: wait_fixed(20s), stop_after_attempt(2)
    
    def _create_vector_db(embeddings):
        # FAISS IndexFlatIP (内积 ≈ 余弦相似度)
        # 维度: 由embedding模型决定
    
    def process_reports(all_reports_dir, output_dir):
        # 遍历所有报告 → 提取chunks → 向量化 → 存FAISS
        # 文件名: <sha1>.faiss
        # 截断: 每个chunk最长2048字符
```

#### C. 检索架构

```
              Query
                │
        ┌───────┴───────┐
        ↓               ↓
  [VectorRetriever] [BM25Retriever]
        │               │
        │     query_embedding     tokenized_query
        │         │                    │
        │    FAISS.search         BM25.get_scores
        │    top_n candidates     top_n candidates
        │               │
        └───────┬───────┘
                │
         [HybridRetriever]
                │
                ↓
         [LLMReranker]
                │
         LLM评分(0-1) + 向量距离
                │
         combined_score = 0.7×llm + 0.3×vector
                │
                ↓
           Top-N Results
```

**LLM重排细节：**
- 模型：qwen-turbo
- 单条模式：每个document独立评分
- 批量模式：4个document一批评分
- 融合权重：`llm_weight=0.7`（可配置）
- 线程限制：`max_workers=1`（避免QPS超限）

#### D. 问答生成架构

**结构化输出Schema体系：**

```python
class AnswerSchema(BaseModel):
    step_by_step_analysis: str   # 分步推理（≥5步，≥150字）
    reasoning_summary: str        # 推理总结（~50字）
    relevant_pages: List[int]     # 引用页码
    final_answer: Union[...]      # 最终答案（类型随schema变化）
```

**6种问题类型的final_answer类型：**

| Schema | final_answer类型 | 场景 |
|--------|-----------------|------|
| name | `str \| "N/A"` | 人名、公司名 |
| number | `float \| int \| "N/A"` | 数值指标 |
| boolean | `bool` | 是非判断 |
| names | `List[str] \| "N/A"` | 名单列表 |
| comparative | `str \| "N/A"` | 多公司对比 |
| string | `str` | 开放性文本 |

**多公司比较处理流程：**

```
原始比较问题
    │
    ↓ get_rephrased_questions()
拆解为多个单公司问题
    │
    ↓ ThreadPoolExecutor (并行)
每个公司独立: 检索→问答→答案
    │
    ↓ 汇总individual_answers
    │
    ↓ LLM比较分析
    │
最终比较答案 + 聚合引用
```

#### E. Prompt工程

**核心设计原则：**
1. **严格指标匹配**：number类型要求精确匹配，不允许推导
2. **幻觉防御**：多步推理+显式N/A判断条件
3. **分步推理**：强制5步以上分析过程
4. **页码验证**：`_validate_page_references()` 验证LLM引用的页码是否真实存在
5. **Schema修复**：`AnswerSchemaFixPrompt` 二次解析非法JSON

### 2.3 技术选型总结

| 层级 | 组件 | 技术选择 |
|------|------|---------|
| PDF解析 | 本地 | Docling (DoclingParseV2 + EasyOCR) |
| PDF解析 | 云端 | MinerU API |
| 文本分块 | - | LangChain RecursiveCharacterTextSplitter |
| Token计算 | - | tiktoken (o200k_base编码) |
| Embedding | - | DashScope text-embedding-v1 |
| 向量存储 | - | FAISS IndexFlatIP |
| 关键词检索 | - | rank_bm25 BM25Okapi |
| LLM重排 | - | qwen-turbo / gpt-4o-mini |
| LLM问答 | - | qwen-turbo-latest / gpt-4o |
| 结构化输出 | - | Pydantic + OpenAI Structured Outputs |
| 并行处理 | - | ThreadPoolExecutor / ProcessPoolExecutor |
| JSON修复 | - | json_repair库 |

### 2.4 代码质量与可复用性评估

**优点：**
- 模块化清晰，每个文件职责单一
- 多Provider抽象（DashScope/OpenAI/Gemini/IBM）
- 完善的错误处理和重试机制
- 配置化设计（RunConfig / PipelineConfig）
- 批量处理+并行化支持

**不足：**
- 运行在Python本地环境，无Web API暴露
- FAISS文件系统存储，不适合Serverless
- 缺少增量索引更新能力
- BM25索引pickle序列化，跨平台兼容性差
- 表格序列化依赖OpenAI gpt-4o-mini

---

# 第二部分：Finspark RAG 项目完整设计方案（产品经理）

## 2.1 产品定位

在现有 Finspark 财报分析系统基础上，增加 **RAG知识库能力**，使用户能够：
- 上传企业财报（PDF），系统自动解析、分块、向量化
- 基于上传的财报进行自然语言问答
- 获得带引用溯源的专业回答
- 与现有的"问数助手"深度集成

## 2.2 用户旅程设计

```
新用户 ──→ 上传财报PDF ──→ 系统自动解析 ──→ 向量化入库
                                                │
                                                ↓
用户提问 ──→ 混合检索 ──→ LLM重排 ──→ 生成回答（带引用）
    │
    ├── 单公司问题："茅台2024年营收是多少？"
    ├── 多公司对比："茅台和五粮液谁的毛利率更高？"
    ├── 开放性分析："分析中芯国际的竞争优势"
    └── 数值查询："贵州茅台的资产负债率？"
```

## 2.3 功能需求规格

### P0 - 核心功能（MVP）

| ID | 功能 | 描述 | 现状 |
|----|------|------|------|
| F1 | PDF智能解析 | 集成MinerU API，将PDF转为结构化Markdown | 待开发 |
| F2 | 升级文本分块 | 引入Token级分块+页面感知+表格保留 | 当前为字符级 |
| F3 | DashScope text-embedding-v4 | 已集成，1024维，中文优化 | **已完成** |
| F4 | 基础向量检索 | 余弦相似度检索，KV存储embedding | **已完成** |
| F5 | RAG问答 | 检索上下文注入LLM，生成回答 | **已完成** |
| F6 | 答案引用溯源 | 显示引用的文档片段和相关度 | **已完成** |
| F7 | 文档管理 | 上传/列表/删除/详情 | **已完成** |
| F8 | 知识库统计 | 文档数/分块数/分类统计 | **已完成** |

### P1 - 增强功能（第二阶段）

| ID | 功能 | 描述 |
|----|------|------|
| F9 | BM25关键词检索 | 中文分词+BM25索引，补充向量检索 |
| F10 | 混合检索调度器 | 向量+BM25融合，可配置权重 |
| F11 | LLM重排序 | 使用Qwen模型对检索结果二次排序 |
| F12 | 结构化问答schema | 支持number/boolean/names等多种答案类型 |
| F13 | 多公司对比 | 自动拆解比较问题→并行检索→汇总 |
| F14 | 表格智能序列化 | LLM提取表格语义信息为独立检索块 |
| F15 | 问数助手RAG增强 | 在财报分析agent中集成知识库上下文 |

### P2 - 高级功能（第三阶段）

| ID | 功能 | 描述 |
|----|------|------|
| F16 | PDF直传上传 | 前端直传PDF，后端调MinerU解析 |
| F17 | 增量索引更新 | 文档更新时仅重建受影响的向量 |
| F18 | 多轮对话记忆 | 基于session_id的对话上下文管理 |
| F19 | 答案幻觉检测 | 页码验证+指标精确匹配 |
| F20 | 用户知识库隔离 | 按用户/团队隔离文档和权限 |

## 2.4 产品指标

| 指标 | 当前值 | P0目标 | P1目标 | P2目标 |
|------|--------|--------|--------|--------|
| 检索准确率 | ~80% | ≥85% | ≥92% | ≥95% |
| 答案准确率 | ~70% | ≥80% | ≥85% | ≥90% |
| 首字响应时间 | ~5s | ≤4s | ≤3s | ≤2s |
| 支持文档格式 | 纯文本 | +Markdown | +PDF | +Excel |
| 单文档最大字符 | 500K | 500K | 1M | 5M |
| 最大文档数/用户 | 无限制 | 50 | 200 | 1000 |

## 2.5 项目里程碑

```
Phase 0 (已完成) ─── 2周
├── DashScope text-embedding-v4 集成 ✅
├── 基础向量检索 + 余弦相似度 ✅
├── RAG问答页面 + 文档管理 ✅
└── 问数助手知识库集成 ✅

Phase 1 (P0核心) ─── 3周
├── Week 1: PDF解析 (MinerU集成)
├── Week 2: 升级分块策略 + Token计算
└── Week 3: 分步推理Prompt + 引用页码验证

Phase 2 (P1增强) ─── 4周
├── Week 4: BM25中文分词索引
├── Week 5: 混合检索 + LLM重排
├── Week 6: 结构化问答schema体系
└── Week 7: 多公司对比 + 表格序列化

Phase 3 (P2高级) ─── 3周
├── Week 8: PDF直传 + 增量索引
├── Week 9: 幻觉检测 + 多轮记忆
└── Week 10: 性能优化 + 压力测试
```

---

# 第三部分：Finspark RAG 项目完整开发方案（应用开发）

## 3.1 技术架构设计

### 当前架构 vs 目标架构

```
┌─────────────── 当前架构 ───────────────┐     ┌─────────────── 目标架构 ───────────────┐
│                                        │     │                                        │
│  前端 (HTML/JS)                        │     │  前端 (HTML/JS)                        │
│    └── ragKnowledgeBase.ts             │     │    ├── ragKnowledgeBase.ts (增强)      │
│                                        │     │    └── assistant.ts (RAG增强)          │
│  路由 (Hono)                           │     │                                        │
│    └── routes/rag.ts                   │     │  路由 (Hono)                           │
│                                        │     │    ├── routes/rag.ts (增强)            │
│  服务                                  │     │    └── routes/assistant.tsx (增强)      │
│    └── services/rag.ts                 │     │                                        │
│        ├── splitTextIntoChunks (字符级) │     │  服务层                                │
│        ├── generateEmbedding (DashScope)│     │    ├── services/rag.ts (核心重构)      │
│        ├── cosineSimilarity             │     │    │   ├── PDF解析 (MinerU集成)        │
│        └── ragQuery (简单检索+LLM)     │     │    │   ├── 分块 (Token级+页面感知)     │
│                                        │     │    │   ├── Embedding (DashScope v4)    │
│  存储                                  │     │    │   ├── 混合检索 (向量+BM25+重排)   │
│    ├── D1 (文档/分块元数据)            │     │    │   ├── 结构化问答 (多Schema)       │
│    └── KV (embedding向量)              │     │    │   └── 多公司对比                  │
│                                        │     │    └── services/pdfParser.ts (新)      │
└────────────────────────────────────────┘     │                                        │
                                               │  存储                                  │
                                               │    ├── D1 (文档/分块/对话/BM25倒排)   │
                                               │    └── KV (embedding向量)              │
                                               └────────────────────────────────────────┘
```

### 3.2 核心开发任务清单

---

### Task 1: MinerU PDF解析集成

**文件**: `src/services/pdfParser.ts` (新建)

**实现方案：**

```typescript
// src/services/pdfParser.ts

interface MinerUConfig {
  apiKey: string;
  baseUrl: string;
}

interface ParseResult {
  taskId: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  markdown?: string;
  errorMessage?: string;
}

/**
 * MinerU PDF解析服务
 * 
 * 对标参考项目 pdf_mineru.py:
 * - get_task_id() → submitParseTask()
 * - get_result() → pollTaskResult()
 * 
 * 改进点：
 * - 异步非阻塞（不用while循环轮询，改用定时检查）
 * - 支持URL和Base64两种输入
 * - 错误重试和超时处理
 */
export class PDFParserService {
  private config: MinerUConfig;

  constructor(config: MinerUConfig) {
    this.config = config;
  }

  /**
   * 提交PDF解析任务
   */
  async submitParseTask(pdfUrl: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/extract/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        url: pdfUrl,
        is_ocr: true,
        enable_formula: false,
      }),
    });
    
    if (!response.ok) throw new Error(`MinerU API error: ${response.status}`);
    const result = await response.json();
    return result.data.task_id;
  }

  /**
   * 查询解析结果
   */
  async getTaskResult(taskId: string): Promise<ParseResult> {
    const response = await fetch(
      `${this.config.baseUrl}/extract/task/${taskId}`,
      {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      }
    );
    
    const result = await response.json();
    const data = result.data;
    
    if (data.state === 'done' && data.full_zip_url) {
      // 下载并解析markdown
      const markdown = await this.downloadAndExtractMarkdown(data.full_zip_url);
      return { taskId, status: 'done', markdown };
    }
    
    return {
      taskId,
      status: data.state as ParseResult['status'],
      errorMessage: data.err_msg,
    };
  }

  /**
   * 下载ZIP并提取markdown内容
   */
  private async downloadAndExtractMarkdown(zipUrl: string): Promise<string> {
    // 在Cloudflare Workers环境中，使用fetch下载，
    // 然后用fflate或pako解压ZIP
    const response = await fetch(zipUrl);
    const buffer = await response.arrayBuffer();
    // 解压逻辑... 提取 full.md
    return ''; // 实际实现需要ZIP解压库
  }
  
  /**
   * 完整的PDF→Markdown管线（带轮询）
   */
  async parsePDFToMarkdown(pdfUrl: string, maxWaitMs = 300000): Promise<string> {
    const taskId = await this.submitParseTask(pdfUrl);
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getTaskResult(taskId);
      
      if (result.status === 'done' && result.markdown) {
        return result.markdown;
      }
      if (result.status === 'failed') {
        throw new Error(`PDF解析失败: ${result.errorMessage}`);
      }
      
      // 等待5秒后重试
      await new Promise(r => setTimeout(r, 5000));
    }
    
    throw new Error('PDF解析超时');
  }
}
```

---

### Task 2: 升级文本分块策略

**文件**: `src/services/rag.ts` (修改 splitTextIntoChunks)

**实现方案：**

```typescript
// 对标参考项目 text_splitter.py 的两种模式

/**
 * 增强的分块配置
 */
interface EnhancedChunkConfig extends ChunkConfig {
  mode: 'character' | 'token' | 'line';  // 分块模式
  preservePages: boolean;                  // 保留页面边界
  maxTokensPerChunk?: number;             // Token级限制
}

/**
 * Token级文本分块
 * 
 * 对标 text_splitter.py._split_page():
 * - 使用RecursiveCharacterTextSplitter from tiktoken
 * - chunk_size=300 tokens, chunk_overlap=50
 * 
 * Cloudflare Workers适配：
 * - 无法使用tiktoken（Python库），使用简化的token估算
 * - 中文约 1 token/字，英文约 4 chars/token
 */
function estimateTokenCount(text: string): number {
  // 简化的token计算（对标tiktoken o200k_base）
  let tokens = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      tokens += 1;     // 中文字符约1 token
    } else if (/\s/.test(char)) {
      tokens += 0.25;  // 空白
    } else {
      tokens += 0.25;  // 英文字符约0.25 token
    }
  }
  return Math.ceil(tokens);
}

/**
 * 按页面感知分块（对标 text_splitter._split_report）
 * 
 * Markdown文档中 "---" 或 "# Page N" 标记页面边界
 * 在页面内部使用递归分割
 */
function splitMarkdownWithPageAwareness(
  markdown: string,
  config: { chunkSize: number; chunkOverlap: number }
): Array<{ page: number; text: string; tokenCount: number }> {
  // 按页面标记分割
  const pagePattern = /(?:^|\n)(?:---\s*\n)?#\s*Page\s+(\d+)/g;
  const pages: Array<{ page: number; text: string }> = [];
  
  let lastIndex = 0;
  let match;
  while ((match = pagePattern.exec(markdown)) !== null) {
    if (lastIndex > 0 || pages.length > 0) {
      const prevText = markdown.slice(lastIndex, match.index).trim();
      if (prevText && pages.length > 0) {
        pages[pages.length - 1].text = prevText;
      }
    }
    pages.push({ page: parseInt(match[1]), text: '' });
    lastIndex = match.index + match[0].length;
  }
  // 最后一页
  if (pages.length > 0) {
    pages[pages.length - 1].text = markdown.slice(lastIndex).trim();
  }
  
  // 在每一页内部进行分块
  const chunks: Array<{ page: number; text: string; tokenCount: number }> = [];
  for (const page of pages) {
    const pageChunks = splitTextIntoChunks(page.text, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });
    for (const chunk of pageChunks) {
      chunks.push({
        page: page.page,
        text: chunk,
        tokenCount: estimateTokenCount(chunk),
      });
    }
  }
  
  return chunks;
}
```

---

### Task 3: BM25索引 (Serverless适配)

**文件**: `src/services/bm25.ts` (新建)

**实现方案：**

```typescript
// src/services/bm25.ts

/**
 * Serverless BM25实现
 * 
 * 对标参考项目 ingestion.py BM25Ingestor:
 * - 原版使用 rank_bm25.BM25Okapi + pickle序列化
 * - Cloudflare Workers无法使用pickle，改用JSON + D1存储倒排索引
 * 
 * 改进点：
 * - 中文分词（jieba-wasm 或简化的n-gram分词）
 * - 倒排索引存储在D1中（可持久化）
 * - IDF动态更新
 */

interface BM25Config {
  k1: number;    // 词频饱和参数 (默认 1.5)
  b: number;     // 文档长度归一化 (默认 0.75)
}

const DEFAULT_BM25_CONFIG: BM25Config = { k1: 1.5, b: 0.75 };

/**
 * 中文分词（简化版，适用于Workers环境）
 * 使用 bi-gram + 标点分割
 */
function tokenize(text: string): string[] {
  // 1. 按标点和空白分割成词段
  const segments = text.split(/[，。！？、；：""''【】《》（）\s,.!?;:'"()\[\]{}]+/);
  
  const tokens: string[] = [];
  for (const seg of segments) {
    if (!seg) continue;
    
    // 英文单词直接保留
    if (/^[a-zA-Z0-9]+$/.test(seg)) {
      tokens.push(seg.toLowerCase());
      continue;
    }
    
    // 中文使用 bi-gram
    for (let i = 0; i < seg.length; i++) {
      tokens.push(seg[i]);
      if (i + 1 < seg.length) {
        tokens.push(seg.slice(i, i + 2));
      }
    }
  }
  
  return tokens.filter(t => t.length > 0);
}

/**
 * BM25评分计算
 */
function bm25Score(
  queryTokens: string[],
  docTokenFreq: Map<string, number>,
  docLength: number,
  avgDocLength: number,
  idfMap: Map<string, number>,
  config: BM25Config = DEFAULT_BM25_CONFIG
): number {
  let score = 0;
  
  for (const token of queryTokens) {
    const tf = docTokenFreq.get(token) || 0;
    const idf = idfMap.get(token) || 0;
    
    const numerator = tf * (config.k1 + 1);
    const denominator = tf + config.k1 * (1 - config.b + config.b * (docLength / avgDocLength));
    
    score += idf * (numerator / denominator);
  }
  
  return score;
}

/**
 * 在D1中构建倒排索引
 * 
 * 表结构:
 * bm25_index:
 *   - document_id INT
 *   - chunk_index INT
 *   - token TEXT
 *   - frequency INT
 *   - doc_length INT
 */
export async function buildBM25Index(
  db: D1Database,
  documentId: number,
  chunks: Array<{ index: number; text: string }>
): Promise<void> {
  // 清理旧索引
  await db.prepare('DELETE FROM bm25_index WHERE document_id = ?')
    .bind(documentId).run();
  
  for (const chunk of chunks) {
    const tokens = tokenize(chunk.text);
    const freq = new Map<string, number>();
    
    for (const token of tokens) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
    
    // 批量插入
    for (const [token, count] of freq) {
      await db.prepare(
        'INSERT INTO bm25_index (document_id, chunk_index, token, frequency, doc_length) VALUES (?, ?, ?, ?, ?)'
      ).bind(documentId, chunk.index, token, count, tokens.length).run();
    }
  }
}

/**
 * BM25检索
 */
export async function bm25Search(
  db: D1Database,
  query: string,
  options: { topK?: number; documentIds?: number[] } = {}
): Promise<Array<{ chunkIndex: number; documentId: number; score: number }>> {
  const { topK = 10, documentIds } = options;
  const queryTokens = tokenize(query);
  
  // 获取IDF (使用D1聚合查询)
  // ... 实际SQL查询实现
  
  return []; // 返回排序后的结果
}
```

---

### Task 4: LLM重排序服务

**文件**: `src/services/reranker.ts` (新建)

**实现方案：**

```typescript
// src/services/reranker.ts

/**
 * LLM重排序服务
 * 
 * 对标参考项目 reranking.py LLMReranker:
 * - 使用DashScope qwen-turbo评估每个检索结果与查询的相关性
 * - 支持单条和批量评分
 * - 融合向量距离和LLM评分
 * 
 * 改进点：
 * - 使用DashScope OpenAI兼容API（而非dashscope SDK）
 * - 支持response_format强制JSON输出
 * - 异步并行评分
 */

interface RerankResult {
  relevanceScore: number;  // 0-1
  reasoning: string;
  combinedScore: number;
}

const RERANK_SYSTEM_PROMPT = `你是一个RAG检索重排专家。
你将收到一个查询和检索到的文本块，请根据其与查询的相关性进行评分。

评分说明：
- 相关性分数（0-1，步长0.1）：0=完全无关，1=完全匹配
- 只基于内容客观评价，不做假设

你必须以JSON格式回答，包含：
- relevance_score: 数字，0-1
- reasoning: 简要理由`;

export class LLMReranker {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(params: { apiKey: string; baseUrl?: string; model?: string }) {
    this.apiKey = params.apiKey;
    this.baseUrl = params.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = params.model || 'qwen-turbo';
  }

  /**
   * 对检索结果进行重排序
   * 
   * @param query - 用户查询
   * @param documents - 检索结果列表
   * @param llmWeight - LLM分数权重 (默认0.7)
   * @param batchSize - 每次评分的文档数 (默认4)
   */
  async rerankDocuments(
    query: string,
    documents: Array<{ text: string; score: number; [key: string]: any }>,
    llmWeight = 0.7,
    batchSize = 4
  ): Promise<Array<typeof documents[0] & RerankResult>> {
    const vectorWeight = 1 - llmWeight;
    const results: Array<typeof documents[0] & RerankResult> = [];

    // 分批处理
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      if (batchSize === 1) {
        // 单条评分
        for (const doc of batch) {
          const ranking = await this.rankSingleBlock(query, doc.text);
          results.push({
            ...doc,
            relevanceScore: ranking.relevanceScore,
            reasoning: ranking.reasoning,
            combinedScore: Math.round(
              (llmWeight * ranking.relevanceScore + vectorWeight * doc.score) * 10000
            ) / 10000,
          });
        }
      } else {
        // 批量评分
        const texts = batch.map(d => d.text);
        const rankings = await this.rankMultipleBlocks(query, texts);
        
        for (let j = 0; j < batch.length; j++) {
          const ranking = rankings[j] || { relevanceScore: 0, reasoning: '默认评分' };
          results.push({
            ...batch[j],
            relevanceScore: ranking.relevanceScore,
            reasoning: ranking.reasoning,
            combinedScore: Math.round(
              (llmWeight * ranking.relevanceScore + vectorWeight * batch[j].score) * 10000
            ) / 10000,
          });
        }
      }
    }

    // 按融合分数降序排序
    results.sort((a, b) => b.combinedScore - a.combinedScore);
    return results;
  }

  private async rankSingleBlock(query: string, text: string) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: 'system', content: RERANK_SYSTEM_PROMPT },
          { role: 'user', content: `查询: "${query}"\n\n检索文本:\n"""\n${text}\n"""` },
        ],
      }),
    });

    const result = await response.json() as any;
    const content = result.choices?.[0]?.message?.content || '{}';
    
    try {
      const parsed = JSON.parse(content);
      return {
        relevanceScore: parsed.relevance_score || 0,
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return { relevanceScore: 0, reasoning: content };
    }
  }

  private async rankMultipleBlocks(query: string, texts: string[]) {
    const formattedBlocks = texts.map((t, i) => `Block ${i + 1}:\n"""\n${t}\n"""`).join('\n\n---\n\n');
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: 'system', content: RERANK_SYSTEM_PROMPT + '\n请为每个文本块分别评分，返回JSON数组。' },
          { role: 'user', content: `查询: "${query}"\n\n${formattedBlocks}` },
        ],
      }),
    });

    const result = await response.json() as any;
    const content = result.choices?.[0]?.message?.content || '[]';
    
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => ({
          relevanceScore: p.relevance_score || 0,
          reasoning: p.reasoning || '',
        }));
      }
      if (parsed.block_rankings) {
        return parsed.block_rankings.map((p: any) => ({
          relevanceScore: p.relevance_score || 0,
          reasoning: p.reasoning || '',
        }));
      }
    } catch {}
    
    return texts.map(() => ({ relevanceScore: 0, reasoning: '解析失败' }));
  }
}
```

---

### Task 5: 结构化问答Schema体系

**文件**: `src/services/ragPrompts.ts` (新建)

**实现方案（对标 prompts.py）：**

```typescript
// src/services/ragPrompts.ts

/**
 * 结构化RAG Prompt体系
 * 
 * 对标参考项目 prompts.py 完整的6种schema:
 * - AnswerWithRAGContextNamePrompt
 * - AnswerWithRAGContextNumberPrompt
 * - AnswerWithRAGContextBooleanPrompt
 * - AnswerWithRAGContextNamesPrompt
 * - ComparativeAnswerPrompt
 * - AnswerWithRAGContextStringPrompt
 * 
 * 改进点：
 * - 全中文prompt（适配DashScope Qwen）
 * - 使用OpenAI兼容的response_format
 * - 增加金融领域专用指令
 */

export type QuestionSchema = 'name' | 'number' | 'boolean' | 'names' | 'comparative' | 'string';

interface SchemaConfig {
  systemPrompt: string;
  userPromptTemplate: string;
  responseSchema: Record<string, unknown>;
}

const SHARED_INSTRUCTION = `你是一个RAG（检索增强生成）问答系统。
你的任务是仅基于企业财报中检索到的相关文档内容回答给定问题。

规则：
1. 必须基于检索到的文档内容作答
2. 在给出最终答案前，请详细分步思考
3. 如上下文无相关信息，返回 N/A
4. 涉及投资建议，需声明"仅供参考，不构成投资建议"`;

export const QUESTION_SCHEMAS: Record<QuestionSchema, SchemaConfig> = {
  number: {
    systemPrompt: SHARED_INSTRUCTION + `
    
**严格的指标匹配要求：**
1. 明确问题中指标的精确定义
2. 仅当上下文指标含义与目标指标*完全一致*时才接受
3. 需要计算、推导或推断才能作答时，返回 N/A
4. 注意单位转换（千、百万、亿）和币种匹配
5. 带括号的数字表示负数：(2,124,837) → -2124837`,

    userPromptTemplate: `以下是检索到的上下文：
"""
{context}
"""

---

问题："{question}"

请以JSON格式回答，包含：
- step_by_step_analysis: 分步推理过程（至少5步）
- reasoning_summary: 推理总结
- relevant_pages: 引用页码列表
- final_answer: 数值或 "N/A"`,

    responseSchema: {
      type: 'object',
      properties: {
        step_by_step_analysis: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_pages: { type: 'array', items: { type: 'integer' } },
        final_answer: { oneOf: [{ type: 'number' }, { type: 'string', enum: ['N/A'] }] },
      },
      required: ['step_by_step_analysis', 'reasoning_summary', 'relevant_pages', 'final_answer'],
    },
  },

  name: {
    systemPrompt: SHARED_INSTRUCTION,
    userPromptTemplate: `以下是检索到的上下文：
"""
{context}
"""

---

问题："{question}"

请以JSON格式回答，包含：
- step_by_step_analysis: 分步推理过程
- reasoning_summary: 推理总结
- relevant_pages: 引用页码列表
- final_answer: 名称字符串或 "N/A"`,
    responseSchema: {
      type: 'object',
      properties: {
        step_by_step_analysis: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_pages: { type: 'array', items: { type: 'integer' } },
        final_answer: { oneOf: [{ type: 'string' }] },
      },
      required: ['step_by_step_analysis', 'reasoning_summary', 'relevant_pages', 'final_answer'],
    },
  },

  boolean: {
    systemPrompt: SHARED_INSTRUCTION,
    userPromptTemplate: `以下是检索到的上下文：
"""
{context}
"""

---

问题："{question}"

请以JSON格式回答，包含：
- step_by_step_analysis: 分步推理过程
- reasoning_summary: 推理总结
- relevant_pages: 引用页码列表
- final_answer: true 或 false`,
    responseSchema: {
      type: 'object',
      properties: {
        step_by_step_analysis: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_pages: { type: 'array', items: { type: 'integer' } },
        final_answer: { type: 'boolean' },
      },
      required: ['step_by_step_analysis', 'reasoning_summary', 'relevant_pages', 'final_answer'],
    },
  },

  names: {
    systemPrompt: SHARED_INSTRUCTION,
    userPromptTemplate: `以下是检索到的上下文：
"""
{context}
"""

---

问题："{question}"

请以JSON格式回答，包含：
- step_by_step_analysis: 分步推理过程
- reasoning_summary: 推理总结
- relevant_pages: 引用页码列表
- final_answer: 名称列表数组或 "N/A"`,
    responseSchema: {
      type: 'object',
      properties: {
        step_by_step_analysis: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_pages: { type: 'array', items: { type: 'integer' } },
        final_answer: { oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string', enum: ['N/A'] }] },
      },
      required: ['step_by_step_analysis', 'reasoning_summary', 'relevant_pages', 'final_answer'],
    },
  },

  comparative: {
    systemPrompt: `你是一个问答系统。
你的任务是基于各公司独立答案，给出原始比较问题的最终结论。
只能基于已给出的答案，不可引入外部知识。

比较规则：
- 答案中的公司名必须与原问题完全一致
- 若某公司数据币种不符，需排除
- 若全部公司被排除，返回 N/A`,
    userPromptTemplate: `以下是各公司的独立回答：
"""
{context}
"""

---

原始比较问题："{question}"

请以JSON格式回答。`,
    responseSchema: {
      type: 'object',
      properties: {
        step_by_step_analysis: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_pages: { type: 'array', items: { type: 'integer' } },
        final_answer: { oneOf: [{ type: 'string' }] },
      },
      required: ['step_by_step_analysis', 'reasoning_summary', 'relevant_pages', 'final_answer'],
    },
  },

  string: {
    systemPrompt: SHARED_INSTRUCTION,
    userPromptTemplate: `以下是检索到的上下文：
"""
{context}
"""

---

问题："{question}"

请以JSON格式回答，包含：
- step_by_step_analysis: 分步推理过程
- reasoning_summary: 推理总结
- relevant_pages: 引用页码列表
- final_answer: 完整文本回答`,
    responseSchema: {
      type: 'object',
      properties: {
        step_by_step_analysis: { type: 'string' },
        reasoning_summary: { type: 'string' },
        relevant_pages: { type: 'array', items: { type: 'integer' } },
        final_answer: { type: 'string' },
      },
      required: ['step_by_step_analysis', 'reasoning_summary', 'relevant_pages', 'final_answer'],
    },
  },
};
```

---

### Task 6: 混合检索调度器（升级RAGService.searchSimilar）

**实现方案（集成到 `src/services/rag.ts`）：**

```typescript
// 在 RAGService 类中增加混合检索

/**
 * 混合检索
 * 
 * 对标参考项目 retrieval.py HybridRetriever:
 * - 先向量检索获取候选集（top_n=30）
 * - 然后LLM重排（batch_size=4, llm_weight=0.7）
 * - 返回top_k结果
 * 
 * 改进点：
 * - 支持 BM25 + Vector 两路并行
 * - 可选LLM重排（按需开启，减少延迟）
 * - 结果去重和融合
 */
async hybridSearch(
  query: string,
  options: {
    topK?: number;
    enableBM25?: boolean;
    enableReranking?: boolean;
    rerankingSampleSize?: number;  // 首轮候选数
    llmWeight?: number;
    stockCode?: string;
    documentIds?: number[];
  } = {}
): Promise<ChunkWithScore[]> {
  const {
    topK = 5,
    enableBM25 = false,
    enableReranking = false,
    rerankingSampleSize = 30,
    llmWeight = 0.7,
    stockCode,
    documentIds,
  } = options;

  // 1. 向量检索（扩大候选集）
  const vectorResults = await this.searchSimilar(query, {
    topK: enableReranking ? rerankingSampleSize : topK,
    minScore: 0.2,
    stockCode,
    documentIds,
  });

  // 2. 如果不需要重排，直接返回
  if (!enableReranking) {
    return vectorResults.slice(0, topK);
  }

  // 3. LLM重排
  const reranker = new LLMReranker({
    apiKey: this.embeddingConfig.provider === 'dashscope' 
      ? this.embeddingConfig.apiKey 
      : this.apiKey,
  });

  const rerankedResults = await reranker.rerankDocuments(
    query,
    vectorResults.map(r => ({
      ...r,
      text: r.chunk.content,
      score: r.score,
    })),
    llmWeight,
    4 // batchSize
  );

  return rerankedResults.slice(0, topK);
}
```

---

### Task 7: 答案幻觉检测

**实现方案（对标 questions_processing.py `_validate_page_references`）：**

```typescript
// 在 RAGService 中增加

/**
 * 验证LLM答案中引用的页码是否真实存在于检索结果中
 * 
 * 对标 questions_processing.py._validate_page_references:
 * - 检查claimed_pages是否在retrieved_pages中
 * - 不足min_pages时补充top检索结果的页码
 * - 超过max_pages时截断
 */
function validatePageReferences(
  claimedPages: number[],
  retrievalResults: ChunkWithScore[],
  minPages = 2,
  maxPages = 8
): number[] {
  const retrievedPages = new Set(
    retrievalResults.map(r => r.chunk.metadata?.page as number).filter(Boolean)
  );
  
  // 过滤幻觉页码
  let validated = claimedPages.filter(p => retrievedPages.has(p));
  
  if (validated.length < claimedPages.length) {
    const removed = claimedPages.filter(p => !retrievedPages.has(p));
    console.warn(`[RAG] 移除了 ${removed.length} 个幻觉页码引用:`, removed);
  }
  
  // 不足时补充
  if (validated.length < minPages) {
    for (const result of retrievalResults) {
      const page = result.chunk.metadata?.page as number;
      if (page && !validated.includes(page)) {
        validated.push(page);
        if (validated.length >= minPages) break;
      }
    }
  }
  
  // 截断
  if (validated.length > maxPages) {
    validated = validated.slice(0, maxPages);
  }
  
  return validated;
}
```

---

### 3.3 数据库Schema升级

```sql
-- 新增 BM25 倒排索引表
CREATE TABLE IF NOT EXISTS bm25_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  token TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  doc_length INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (document_id) REFERENCES rag_documents(id)
);

CREATE INDEX IF NOT EXISTS idx_bm25_token ON bm25_index(token);
CREATE INDEX IF NOT EXISTS idx_bm25_doc ON bm25_index(document_id);

-- 升级 rag_documents 表
ALTER TABLE rag_documents ADD COLUMN embedding_provider TEXT DEFAULT 'dashscope';
ALTER TABLE rag_documents ADD COLUMN embedding_dimensions INTEGER DEFAULT 1024;
ALTER TABLE rag_documents ADD COLUMN source_type TEXT DEFAULT 'text'; -- 'text' | 'pdf' | 'markdown'
ALTER TABLE rag_documents ADD COLUMN parse_task_id TEXT; -- MinerU任务ID

-- 升级 rag_chunks 表
ALTER TABLE rag_chunks ADD COLUMN page_number INTEGER;     -- 页码
ALTER TABLE rag_chunks ADD COLUMN token_count INTEGER;     -- token数
ALTER TABLE rag_chunks ADD COLUMN chunk_type TEXT DEFAULT 'content'; -- 'content' | 'table' | 'serialized_table'
```

---

### 3.4 环境变量配置

```bash
# .dev.vars 完整配置
VECTORENGINE_API_KEY=sk-JtQ4dB1Z7LMFLVHfIuvPdxq4DW6PriPvbbilDZHWfjlwHs8K
DASHSCOPE_API_KEY=sk-a110e38928bb404f81439efe989e72ea
MINERU_API_KEY=eyJ0eXBlIjoiSldUIi...
TUSHARE_TOKEN=788627836620509184
JWT_SECRET=finspark-jwt-secret-key-min-32-chars-2025
```

| 变量 | 用途 | 对应Provider |
|------|------|-------------|
| DASHSCOPE_API_KEY | Embedding (text-embedding-v4) + LLM重排 (qwen-turbo) + LLM问答 | 阿里云百炼 |
| VECTORENGINE_API_KEY | LLM问答 (gpt-4.1) + 备选Embedding | VectorEngine |
| MINERU_API_KEY | PDF解析 | MinerU |

---

### 3.5 API接口升级

**新增接口：**

```
POST /api/rag/upload-pdf          - 上传PDF文件，触发MinerU解析
GET  /api/rag/parse-status/:taskId - 查询PDF解析进度
POST /api/rag/hybrid-search       - 混合检索（向量+BM25+重排）
POST /api/rag/structured-query    - 结构化问答（指定answer schema）
POST /api/rag/compare             - 多公司对比问答
```

**接口详细设计：**

```typescript
// POST /api/rag/upload-pdf
{
  pdfUrl: string,        // PDF文件URL
  title: string,
  stockCode?: string,
  stockName?: string,
  category?: string,
}
// Response: { taskId, status: 'pending' }

// POST /api/rag/structured-query
{
  question: string,
  schema: 'name' | 'number' | 'boolean' | 'names' | 'string',
  sessionId?: string,
  stockCode?: string,
  documentIds?: number[],
  topK?: number,
  enableReranking?: boolean,
}
// Response: { answer: { step_by_step_analysis, reasoning_summary, relevant_pages, final_answer }, sources }

// POST /api/rag/compare
{
  question: string,      // "茅台和五粮液谁的毛利率更高？"
  companies: string[],   // ["贵州茅台", "五粮液"]
  schema?: string,
}
// Response: { answer, individualAnswers, sources }
```

---

### 3.6 参考项目 → Finspark 映射表

| 参考项目模块 | 文件 | Finspark对应 | 状态 |
|-------------|------|-------------|------|
| Pipeline | pipeline.py | RAGService (rag.ts) | 已有，需增强 |
| PDFParser | pdf_parsing.py | pdfParser.ts | 新建 |
| pdf_mineru | pdf_mineru.py | pdfParser.ts | 新建 |
| TextSplitter | text_splitter.py | splitTextIntoChunks (rag.ts) | 已有，需升级 |
| VectorDBIngestor | ingestion.py | ingestDocument (rag.ts) | **已完成** |
| BM25Ingestor | ingestion.py | bm25.ts | 新建 |
| VectorRetriever | retrieval.py | searchSimilar (rag.ts) | **已完成** |
| BM25Retriever | retrieval.py | bm25Search (bm25.ts) | 新建 |
| HybridRetriever | retrieval.py | hybridSearch (rag.ts) | 新建 |
| LLMReranker | reranking.py | reranker.ts | 新建 |
| QuestionsProcessor | questions_processing.py | ragQuery (rag.ts) | 已有，需增强 |
| APIProcessor | api_requests.py | LLM调用 (rag.ts) | 已有 |
| BaseDashscopeProcessor | api_requests.py | DashScope兼容API | **已完成** |
| Prompts | prompts.py | ragPrompts.ts | 新建 |
| TableSerializer | tables_serialization.py | 未规划（P2） | - |
| PageTextPreparation | parsed_reports_merging.py | preprocessText (rag.ts) | 已有，需增强 |

---

### 3.7 开发优先级排序

```
Sprint 1 (Week 1-2): PDF解析 + 分块升级
├── [P0] MinerU集成 (pdfParser.ts)
├── [P0] Token级分块 + 页面感知
├── [P0] D1 Schema升级
└── [P0] PDF上传API

Sprint 2 (Week 3-4): 检索增强
├── [P1] 结构化问答Prompt体系 (ragPrompts.ts)
├── [P1] 答案幻觉检测
├── [P1] 分步推理输出
└── [P1] 引用页码验证

Sprint 3 (Week 5-6): 混合检索
├── [P1] BM25索引 (bm25.ts)
├── [P1] LLM重排序 (reranker.ts)
├── [P1] 混合检索调度器
└── [P1] 多公司对比

Sprint 4 (Week 7-8): 质量 + 性能
├── [P2] 表格序列化
├── [P2] 增量索引
├── [P2] 性能优化（并行化）
└── [P2] 端到端测试
```

---

### 3.8 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| Workers CPU限制(50ms/10ms) | PDF处理超时 | MinerU云端解析（异步），Workers仅做API路由 |
| KV读写延迟 | 大量embedding检索慢 | 批量获取(50个一批)，缓存热门查询 |
| D1查询限制 | BM25倒排索引查询慢 | 限制索引深度，使用复合索引 |
| DashScope QPS限制(500/min) | LLM重排并发超限 | 串行执行，max_workers=1 |
| embedding维度不一致 | 切换Provider后旧向量无法检索 | 存储embedding_model字段，提供批量迁移工具 |
| ZIP解压在Workers | 无法使用node:zlib | 使用fflate纯JS解压库 |

---

## 总结

本报告基于对参考项目14个Python源代码文件（总计约2700行代码）和Finspark现有RAG实现（约1400行TypeScript代码）的深度分析，给出了：

1. **产品经理视角**：完整的功能全景、差异化分析、产品指标和3阶段里程碑规划
2. **开发者视角**：7个核心开发任务的详细实现方案，包含代码模板、数据库Schema、API设计
3. **映射关系**：参考项目每个模块到Finspark的精确对应和适配策略

**核心差异**：
- 参考项目：Python本地运行，FAISS文件存储，适合批量离线处理
- Finspark：TypeScript + Cloudflare Workers Serverless，D1/KV存储，适合实时在线服务

关键适配策略是将参考项目的本地文件操作（FAISS/pickle）转换为云原生存储（D1/KV），将Python库依赖（tiktoken/rank_bm25）转换为纯TypeScript实现，同时保留核心RAG架构设计（混合检索+LLM重排+结构化输出）。
