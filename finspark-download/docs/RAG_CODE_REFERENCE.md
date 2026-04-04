# RAG 模块代码深度分析与开发参考手册

> 版本：v1.0 | 日期：2026-03-30  
> 目的：深入分析四份 RAG 功能模块源码，提炼架构模式、核心算法和关键设计决策，作为后续 TypeScript 开发的参考蓝图。

---

## 一、总体技术栈与依赖关系

### 1.1 依赖库

```
dashscope==1.25.5      # 阿里百炼 SDK（DashScope Generation API 直调）
faiss_cpu==1.7.4       # Facebook AI 相似度搜索（FAISS 向量索引）
jieba==0.42.1          # 中文分词引擎
numpy==2.4.0           # 数值计算
openai==2.14.0         # OpenAI 兼容客户端（用于 DashScope 兼容模式）
pandas==2.3.3          # 数据分析
rank_bm25==0.2.2       # BM25 关键词检索算法
```

### 1.2 双客户端模式

代码中存在两种 API 调用模式，需要在 TypeScript 移植时统一：

| 模式 | 使用文件 | 调用方式 | 适用场景 |
|------|---------|---------|---------|
| **DashScope 原生 SDK** | 文件2、文件3 | `dashscope.Generation.call()` | 纯文本生成 |
| **OpenAI 兼容客户端** | 文件1、文件4 | `client.chat.completions.create()` + `client.embeddings.create()` | 文本生成 + Embedding |

> **开发建议**：TypeScript 实现统一使用 OpenAI 兼容模式（`base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1"`），同时支持 Embedding 和 Chat Completions。

### 1.3 公共模式

所有四个文件共享的代码模式：

```python
# 1. JSON 响应预处理（移除 markdown 代码块包裹）
def preprocess_json_response(response):
    if response.startswith('```json'): response = response[7:]
    elif response.startswith('```'): response = response[3:]
    if response.endswith('```'): response = response[:-3]
    return response.strip()

# 2. LLM 调用封装（统一 temperature 控制）
def get_completion(prompt, model="qwen-turbo-latest"):
    # temperature=0.7 用于生成多样化内容（文件1）
    # temperature=0.3 用于分析/判断任务（文件2/3/4）

# 3. 结构化 Prompt 模板（JSON 输出格式约束）
prompt = f"""
### 指令 ###
{instruction}
### 知识内容 ###
{content}
### 生成结果 ###
"""
```

---

## 二、文件 1：知识库问题生成与检索优化（BM25版本）

### 2.1 文件概览

| 项目 | 说明 |
|------|------|
| **文件名** | `1-知识库问题生成与检索优化-BM25.py` |
| **核心类** | `KnowledgeBaseOptimizer` |
| **核心思想** | Hypothetical Question Embedding (HyDE) 的变体——为每个知识切片生成"用户可能会问的问题"，构建"问题→原文"映射索引，检索时用户 Query 与问题匹配而非直接与原文匹配，提升检索精度 |
| **检索引擎** | BM25Okapi（关键词检索，非向量检索） |
| **LLM 模型** | qwen-turbo-latest (temperature=0.7) |

### 2.2 核心架构

```
                    ┌─────────────────────────────┐
                    │   KnowledgeBaseOptimizer     │
                    ├─────────────────────────────┤
                    │ knowledge_base: []           │ ← 原始知识库
                    │ content_bm25: BM25Okapi     │ ← 原文索引
                    │ question_bm25: BM25Okapi    │ ← 问题索引
                    │ content_documents: []        │ ← 分词后的原文文档
                    │ question_documents: []       │ ← 分词后的问题文档
                    │ content_metadata: []         │ ← 原文元数据
                    │ question_metadata: []        │ ← 问题元数据
                    ├─────────────────────────────┤
                    │ generate_questions_for_chunk()│
                    │ generate_diverse_questions() │
                    │ build_knowledge_index()      │
                    │ search_similar_chunks()      │
                    │ calculate_similarity()       │
                    │ evaluate_retrieval_methods() │
                    └─────────────────────────────┘
```

### 2.3 关键算法细节

#### A. 中文文本预处理 (`preprocess_text`)

```python
def preprocess_text(text):
    text = re.sub(r'[^\w\s]', '', text)          # 移除标点符号
    words = jieba.lcut(text)                       # jieba 精确模式分词
    stop_words = {'的', '了', '在', '是', ...}     # 28个中文停用词
    words = [w for w in words if len(w) > 1 and w not in stop_words]
    return words
```

> **TS 移植注意**：需引入 jieba-js 或 nodejieba，或在 Cloudflare Workers 环境中使用后端 API 分词。停用词表需完善（现有仅28个，生产环境建议使用百度/哈工大停用词表 ~1800 词）。

#### B. 双索引构建 (`build_knowledge_index`)

核心设计：为同一知识库构建**两套独立的 BM25 索引**：

| 索引 | 文档内容 | 匹配逻辑 | 元数据 |
|------|---------|---------|--------|
| `content_bm25` | 原始知识切片文本 | Query ↔ 原文 | chunk 引用 |
| `question_bm25` | `"内容：{原文} 问题：{问题}"` 拼接文本 | Query ↔ (原文+问题) | chunk 引用 + 问题详情 |

> **关键细节**：问题索引的文档不是纯问题文本，而是**原文+问题的拼接**（`combined_text = f"内容：{text} 问题：{question}"`），保持上下文连贯性。

#### C. BM25 分数归一化

```python
similarity = min(1.0, scores[idx] / 10.0)  # 硬编码除以10归一化
```

> **开发建议**：BM25 原始分数范围取决于文档集合，除以 10 的硬编码归一化不够鲁棒。生产环境建议使用 min-max 归一化：`(score - min) / (max - min)`。

#### D. LLM 问题生成的两种模式

| 方法 | 生成内容 | 用途 |
|------|---------|------|
| `generate_questions_for_chunk(chunk, n=5)` | 问题 + 类型 + 难度 | 用于构建检索索引 |
| `generate_diverse_questions(chunk, n=8)` | 问题 + 类型 + 难度 + **角度 + 可回答性 + 答案** | 用于质量评估和测试集生成 |

> `generate_diverse_questions` 的 Prompt 明确要求 5 维多样性：类型、表达方式、难度、角度、范围限制。

#### E. 检索评估方法 (`evaluate_retrieval_methods`)

评估框架的核心流程：

```
test_queries (含 correct_chunk 标注)
    ↓
├── 方法1: content BM25 搜索 → top-1 结果 → 与 correct_chunk 精确匹配
├── 方法2: question BM25 搜索 → top-1 结果 → 与 correct_chunk 精确匹配
    ↓
对比结果:
  - content_similarity: 原文检索是否正确
  - question_similarity: 问题检索是否正确
  - improvement: 问题检索比原文检索多对的
  - score_diff: 问题分数 - 原文分数
```

> **注意**：评估使用的是**精确内容匹配**（`best_match['content'] == correct_chunk`），不是语义相似度判断。生产环境应改为 chunk_id 匹配或 Top-K 命中率。

### 2.4 对 RAG 平台的价值映射

| 代码功能 | 平台页面 | UI 功能 |
|---------|---------|---------|
| `generate_questions_for_chunk` | P.3 Chunk 质量增强 | "问题改写"策略卡片 |
| `generate_diverse_questions` | P.3 / P.6 | 更丰富的问题生成（含角度、答案） |
| `build_knowledge_index` | P.2 知识库浏览器 | BM25 索引状态指示器 |
| `search_similar_chunks` | P.4 对话助手 / P.5 检索调试台 | BM25 检索结果展示 |
| `evaluate_retrieval_methods` | P.7 批量评测 | 原文 vs 问题检索对比评测 |
| `preprocess_text` + jieba | 全局 | 中文分词服务 |

---

## 三、文件 2：对话知识提取与沉淀

### 3.1 文件概览

| 项目 | 说明 |
|------|------|
| **文件名** | `2-对话知识沉淀.py` |
| **核心类** | `ConversationKnowledgeExtractor` |
| **核心思想** | 从用户-AI 对话中自动提取结构化知识点，过滤临时性信息，按类型分组后使用 LLM 合并相似知识，形成高质量知识沉淀 |
| **技术特色** | LLM-as-Extractor + LLM-as-Merger，两段式 LLM 调用 |
| **LLM 模型** | qwen-turbo-latest (temperature=0.3，分析任务用低温) |

### 3.2 核心架构

```
对话日志 → [LLM提取] → 知识点列表 → [过滤] → [LLM合并] → 知识沉淀
  │                         │             │           │           │
  │                         │             │           │           │
  多轮对话文本         提取5类知识    去除"需求"     按类型分组     输出合并后
                      (事实/需求/    和"问题"类型   LLM 智能合并   的高质量知识
                       问题/流程/    保留持久性知识
                       注意)
```

### 3.3 知识提取的 5 种类型

| 知识类型 | 说明 | 是否沉淀 | 示例 |
|---------|------|---------|------|
| **事实** | 地点、时间、价格、规则 | ✅ 沉淀 | "门票平日399元" |
| **需求** | 用户个人需求和偏好 | ❌ 过滤 | "我想带孩子去玩" |
| **问题** | 对话中出现的问题 | ❌ 过滤 | "停车费怎么收？" |
| **流程** | 操作步骤和方法 | ✅ 沉淀 | "地铁2号线→11号线→迪士尼站" |
| **注意** | 注意事项和提醒 | ✅ 沉淀 | "可携带密封零食，不可带玻璃瓶" |

> **关键设计决策**：`merge_similar_knowledge` 会**过滤掉"需求"和"问题"类型**，因为它们是临时的、个性化的，不适合沉淀到通用知识库中。

### 3.4 LLM 知识提取 Prompt 结构

提取输出的 JSON Schema：
```json
{
  "extracted_knowledge": [{
    "knowledge_type": "事实/需求/问题/流程/注意",
    "content": "知识内容",
    "confidence": 0.0-1.0,
    "source": "用户/AI/对话",
    "keywords": ["关键词"],
    "category": "分类"
  }],
  "conversation_summary": "对话摘要",
  "user_intent": "用户意图"
}
```

### 3.5 LLM 知识合并算法 (`merge_knowledge_with_llm`)

合并流程：
```
同类型知识点 → 构建合并 Prompt（含所有知识点的内容/置信度/分类/来源/关键词）
    ↓
LLM 合并 → 输出单个合并后的知识点
    ↓
容错：如果 JSON 解析失败 → 取置信度最高的知识点作为代表
```

合并 Prompt 的 5 条要求：
1. 保留所有重要信息，避免信息丢失
2. 消除重复内容，整合相似表述
3. 提高准确性和完整性
4. 保持逻辑清晰
5. 合并后置信度取最高值

### 3.6 频率统计机制

```python
self.knowledge_frequency = Counter()
# key 格式: "{knowledge_type}:{content前50字}"
key = f"{knowledge['knowledge_type']}:{knowledge['content'][:50]}"
self.knowledge_frequency[key] += 1
```

> **用途**：高频知识点 = 用户高频关注点，可用于 Dashboard 热度分析和知识库扩充优先级排序。

### 3.7 对 RAG 平台的价值映射

| 代码功能 | 平台页面 | UI 功能 |
|---------|---------|---------|
| `extract_knowledge_from_conversation` | **新增 P.14 对话知识沉淀** | 单次对话的知识提取面板 |
| `batch_extract_knowledge` | P.14 | 批量对话知识提取 |
| `merge_similar_knowledge` | P.14 | 知识合并与去重 |
| `knowledge_frequency` | P.0 仪表盘 / P.14 | 知识热度排行 |
| 知识类型过滤 | P.14 | 知识沉淀策略配置 |

---

## 四、文件 3：知识库健康度检查

### 4.1 文件概览

| 项目 | 说明 |
|------|------|
| **文件名** | `3-知识库健康度检查.py` |
| **核心类** | `KnowledgeBaseHealthChecker` |
| **核心思想** | 使用 LLM 作为三维"体检医生"，从覆盖率、新鲜度、一致性三个维度评估知识库的健康状态，生成结构化健康报告 |
| **技术特色** | 纯 LLM 驱动的质量评估（不依赖向量或 BM25） |
| **LLM 模型** | qwen-turbo-latest (temperature=0.3) |

### 4.2 三维健康度模型

```
                    ┌─────────────────────────┐
                    │   整体健康度评分 (0-1)    │
                    │   = 覆盖率×0.4           │
                    │   + 新鲜度×0.3           │
                    │   + 一致性×0.3           │
                    └───────┬─────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ↓               ↓               ↓
    ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
    │ 覆盖率 (40%)  │ │ 新鲜度 (30%) │ │ 一致性 (30%) │
    │               │ │              │ │              │
    │ check_missing │ │check_outdated│ │check_conflict│
    │ _knowledge()  │ │_knowledge()  │ │ing_knowledge │
    │               │ │              │ │()            │
    │ 输入:         │ │ 输入:        │ │ 输入:        │
    │ 知识库+测试集 │ │ 知识库       │ │ 知识库       │
    │               │ │ +当前日期    │ │              │
    │ 检查:         │ │ 检查:        │ │ 检查:        │
    │ - 能否回答    │ │ - 时间过期   │ │ - 同主题矛盾 │
    │ - 是否完整    │ │ - 价格过期   │ │ - 价格不一致 │
    │ - 需求覆盖    │ │ - 政策更新   │ │ - 时间冲突   │
    │ - 知识空白    │ │ - 活动过期   │ │ - 规则冲突   │
    │               │ │ - 联系过时   │ │ - 流程差异   │
    │               │ │ - 技术过时   │ │ - 联系差异   │
    └───────────────┘ └──────────────┘ └──────────────┘
```

### 4.3 各检查维度的 LLM Prompt 设计

#### A. 缺失知识检查

**输入**：知识库全文 + 测试查询（含期望答案）  
**输出 Schema**：
```json
{
  "missing_knowledge": [{
    "query": "触发缺失的查询",
    "missing_aspect": "缺少的知识方面",
    "importance": "高/中/低",
    "suggested_content": "建议补充的知识内容",
    "category": "知识分类"
  }],
  "coverage_score": 0.0-1.0,
  "completeness_analysis": "完整性分析文本"
}
```

#### B. 过期知识检查

**输入**：知识库内容（含 `last_updated` 时间戳）+ 当前日期  
**检查 6 个维度**：时间、价格、政策、活动、联系方式、技术  
**输出 Schema**：
```json
{
  "outdated_knowledge": [{
    "chunk_id": "ID",
    "content": "内容",
    "outdated_aspect": "过期方面",
    "severity": "高/中/低",
    "suggested_update": "建议更新",
    "last_verified": "最后验证时间"
  }],
  "freshness_score": 0.0-1.0,
  "update_recommendations": "更新建议"
}
```

#### C. 冲突知识检查

**输入**：知识库内容（按 ID + 内容列出）  
**检查 6 个维度**：同一主题不同说法、价格差异、时间不一致、规则冲突、流程差异、联系方式差异  
**输出 Schema**：
```json
{
  "conflicting_knowledge": [{
    "conflict_type": "冲突类型",
    "chunk_ids": ["相关ID"],
    "conflicting_content": ["冲突内容"],
    "severity": "高/中/低",
    "resolution_suggestion": "解决建议"
  }],
  "consistency_score": 0.0-1.0,
  "conflict_analysis": "冲突分析"
}
```

### 4.4 健康等级映射

```python
score >= 0.8  → "优秀"
score >= 0.6  → "良好"  
score >= 0.4  → "一般"
score <  0.4  → "需要改进"
```

### 4.5 自动改进建议生成

```python
def generate_recommendations(self, missing_result, outdated_result, conflicting_result):
    recommendations = []
    if missing_count > 0:
        recommendations.append(f"补充{missing_count}个缺少的知识点，提高覆盖率")
    if outdated_count > 0:
        recommendations.append(f"更新{outdated_count}个过期知识点，确保信息时效性")
    if conflicting_count > 0:
        recommendations.append(f"解决{conflicting_count}个知识冲突，提高一致性")
```

### 4.6 对 RAG 平台的价值映射

| 代码功能 | 平台页面 | UI 功能 |
|---------|---------|---------|
| `generate_health_report` | **新增 P.15 知识库健康度** | 一键生成健康报告 |
| `check_missing_knowledge` | P.15 | 覆盖率分析面板 |
| `check_outdated_knowledge` | P.15 | 新鲜度分析面板 |
| `check_conflicting_knowledge` | P.15 | 一致性分析面板 |
| `calculate_overall_health_score` | P.0 仪表盘 | 健康度指示灯/分数 |
| `generate_recommendations` | P.15 | 改进建议列表 |

---

## 五、文件 4：知识库版本管理与性能比较

### 5.1 文件概览

| 项目 | 说明 |
|------|------|
| **文件名** | `4-知识库版本管理与性能比较.py` |
| **核心类** | `KnowledgeBaseVersionManager` |
| **核心思想** | 为知识库实现 Git 风格的版本管理：创建快照 → 构建独立向量索引 → 版本间 diff 对比 → 性能评测 → 回归测试 |
| **技术特色** | FAISS 向量索引 + Embedding (text-embedding-v4) + 版本 diff + 性能基准测试 |
| **Embedding** | text-embedding-v4, 1024 维, DashScope |

### 5.2 核心架构

```
                    ┌──────────────────────────────────┐
                    │   KnowledgeBaseVersionManager     │
                    ├──────────────────────────────────┤
                    │ versions: {                       │
                    │   "v1.0": {                       │
                    │     knowledge_base,               │
                    │     metadata_store,               │
                    │     text_index (FAISS),           │
                    │     statistics,                   │
                    │     version_name, description,    │
                    │     created_date                  │
                    │   },                              │
                    │   "v2.0": { ... }                 │
                    │ }                                 │
                    ├──────────────────────────────────┤
                    │ create_version()                  │ ← 创建版本快照
                    │ build_vector_index()              │ ← 构建 FAISS 索引
                    │ compare_versions()                │ ← 版本 diff
                    │ detect_changes()                  │ ← 变更检测
                    │ evaluate_version_performance()    │ ← 性能评测
                    │ compare_version_performance()     │ ← 性能对比
                    │ generate_regression_test()        │ ← 回归测试
                    └──────────────────────────────────┘
```

### 5.3 版本创建与向量索引构建

```python
def create_version(self, knowledge_base, version_name, description):
    metadata_store, text_index = self.build_vector_index(knowledge_base)
    # 每个版本独立存储：知识库内容 + 元数据 + FAISS索引 + 统计信息
    version_info = {
        "version_name": version_name,
        "description": description,
        "created_date": datetime.now().isoformat(),
        "knowledge_base": knowledge_base,
        "metadata_store": metadata_store,     # [{id, content, chunk_id}, ...]
        "text_index": text_index,             # faiss.IndexIDMap(IndexFlatL2)
        "statistics": self.calculate_version_statistics(knowledge_base)
    }
```

FAISS 索引细节：
```python
text_index = faiss.IndexFlatL2(1024)                # L2 距离（欧氏距离）
text_index_map = faiss.IndexIDMap(text_index)         # 支持自定义 ID
text_index_map.add_with_ids(vectors, ids)             # 批量添加
```

> **开发注意**：这里使用 `IndexFlatL2`（L2距离），而项目其他部分使用 `IndexFlatIP`（内积/余弦相似度）。L2 距离越小越相似，IP 越大越相似。TS 版本需统一为内积（余弦相似度更直观）。

### 5.4 版本 Diff 算法 (`detect_changes`)

```
KB1 IDs                    KB2 IDs
{001, 002, 003}           {001, 002, 003, 004, 005}
        │                         │
        └──── 集合运算 ────────────┘
              │
    added   = KB2 - KB1 = {004, 005}    → 新增的切片
    removed = KB1 - KB2 = {}             → 删除的切片
    common  = KB1 ∩ KB2 = {001,002,003}  → 需逐一对比content
              │
    对 common 中的每个 ID:
      if content1 != content2 → modified_chunks
      else                    → unchanged_chunks
```

输出结构：
```json
{
  "added_chunks": [{"id": "kb_004", "content": "..."}],
  "removed_chunks": [],
  "modified_chunks": [{"id": "kb_001", "old_content": "...", "new_content": "..."}],
  "unchanged_chunks": ["kb_003"]
}
```

### 5.5 性能评测流程 (`evaluate_version_performance`)

```
test_queries (含 expected_answer)
    │
    ↓ 对每个 query:
    ├── 1. get_text_embedding(query)           ← 查询向量化
    ├── 2. text_index.search(query_vec, k=3)   ← FAISS Top-3 检索
    ├── 3. 距离→相似度转换: 1/(1+distance)     ← L2 距离归一化
    ├── 4. evaluate_retrieval_quality()        ← expected_answer 是否在 chunk 中
    └── 5. 记录 response_time                  ← 端到端延迟
    │
    ↓ 汇总:
    {
      accuracy: correct / total,
      avg_response_time: mean(times),
      total_queries, correct_answers
    }
```

> **检索质量评估**：使用简单的子串包含判断 (`expected_answer.lower() in content.lower()`)。生产环境应使用 LLM 语义评分。

### 5.6 版本性能对比 (`compare_version_performance`)

```
     Version 1                    Version 2
     ┌─────────┐                 ┌─────────┐
     │ accuracy │                 │ accuracy │
     │ avg_time │                 │ avg_time │
     └────┬────┘                 └────┬────┘
          │                           │
          └──────── 对比 ──────────────┘
                    │
    accuracy_improvement = acc2 - acc1
    time_improvement = time1 - time2  (时间改善为正值)
    │
    ↓ 生成建议
    if acc2 > acc1 and time2 <= time1:
        → "推荐版本2，准确率提升X%"
    elif acc2 > acc1 and time2 > time1:
        → "准确率更高但更慢，需权衡"
    elif acc2 < acc1 and time2 < time1:
        → "更快但准确率更低，需权衡"
    else:
        → "推荐版本1"
```

### 5.7 回归测试 (`generate_regression_test`)

简化版的性能评测，输出通过/失败列表和通过率：

```json
{
  "version_name": "v2.0",
  "test_date": "2026-03-30T...",
  "test_results": [
    {"query": "...", "expected": "...", "retrieved": 3, "passed": true},
    {"query": "...", "expected": "...", "retrieved": 3, "passed": false}
  ],
  "pass_rate": 0.80
}
```

### 5.8 版本统计信息

```python
{
    "total_chunks": 5,              # 知识切片总数
    "total_content_length": 2500,   # 总内容长度（字符）
    "average_chunk_length": 500.0   # 平均切片长度
}
```

### 5.9 对 RAG 平台的价值映射

| 代码功能 | 平台页面 | UI 功能 |
|---------|---------|---------|
| `create_version` | **新增 P.16 版本管理** | 创建版本快照 |
| `compare_versions` | P.16 | 版本 diff 对比视图 |
| `detect_changes` | P.16 | 变更检测（新增/删除/修改） |
| `evaluate_version_performance` | P.16 + P.7 | 版本性能评测 |
| `compare_version_performance` | P.16 | 双版本性能对比 |
| `generate_regression_test` | P.16 + P.7 | 回归测试 |
| `calculate_version_statistics` | P.16 | 版本统计面板 |

---

## 六、四个模块的交互关系图

```
┌──────────────────────────────────────────────────────────────────────┐
│                        RAG 平台全景交互图                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   文档上传 ──→ 知识库 ──→ 问题生成(文件1) ──→ 双索引构建            │
│     (P.1)      (P.2)      (P.3)                                     │
│                  │                                                   │
│                  │  ← 对话知识沉淀(文件2) ← 对话日志                 │
│                  │    从对话中提取知识          (P.8)                 │
│                  │    自动补充知识库                                  │
│                  │                                                   │
│                  ↓                                                   │
│            健康度检查(文件3) ──→ 发现问题 ──→ 改进建议               │
│              (P.15)             缺失/过期/冲突                       │
│                  │                                                   │
│                  ↓                                                   │
│            版本管理(文件4) ──→ 创建新版本 ──→ 性能对比               │
│              (P.16)           修复问题后       与旧版本               │
│                  │           创建快照          A/B 测试               │
│                  │                                                   │
│                  ↓                                                   │
│            回归测试 ──→ 确认无退化 ──→ 发布新版本                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

完整的知识库生命周期：

```
上传文档 → 分块 → 问题生成 → 构建索引 → 版本v1.0
    ↓
用户问答 → 对话日志 → 知识沉淀 → 补充知识库
    ↓
定期健康检查 → 发现问题(缺失/过期/冲突)
    ↓
修复知识 → 创建版本v2.0 → 性能对比v1 vs v2
    ↓
回归测试通过 → 发布v2.0 → 循环...
```

---

## 七、TypeScript 移植关键注意事项

### 7.1 BM25 实现

```typescript
// 选项1: 纯 JS 实现 (推荐，适合 Cloudflare Workers)
// 参考 wink-bm25-text-search 或自实现 BM25Okapi
// 选项2: 使用 D1 数据库实现倒排索引（已有 rag_bm25_index 表设计）
```

### 7.2 中文分词

```typescript
// 选项1: nodejieba（需 native addon，不适合 Workers）
// 选项2: jieba-wasm（推荐，WASM 编译，适合 Workers）
// 选项3: LLM 辅助分词（通过 API 调用，延迟较高）
// 选项4: 简单的正则分词 + 字典匹配
```

### 7.3 FAISS 替代方案

```typescript
// Cloudflare Workers 环境无法运行 FAISS
// 替代方案:
// 1. KV + 余弦相似度计算（当前项目已采用）
// 2. Cloudflare Vectorize（原生向量数据库）
// 3. 外部向量数据库 API（Pinecone / Weaviate / Qdrant）
```

### 7.4 JSON 解析鲁棒性

```typescript
// 所有 LLM 返回的 JSON 都需要:
// 1. 移除 markdown 代码块包裹
// 2. 使用 json_repair 库修复格式错误
// 3. Zod schema 验证结构完整性
// 4. 提供 fallback 默认值
```

### 7.5 Temperature 策略

| 任务类型 | Temperature | 原因 |
|---------|------------|------|
| 问题生成 | 0.7 | 需要多样性 |
| 知识提取/分析/评估 | 0.3 | 需要准确性和一致性 |
| 知识合并 | 0.3 | 需要忠实原文 |

---

## 八、数据库 Schema 扩展（新增表）

基于四个模块的分析，需要在原有 20 张表的基础上新增：

### 8.1 对话知识沉淀相关

```sql
-- 从对话中提取的知识点
CREATE TABLE rag_conversation_knowledge (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,          -- 关联的对话ID
    message_id TEXT,               -- 关联的消息ID
    knowledge_type TEXT,           -- 事实/流程/注意
    content TEXT,                  -- 知识内容
    confidence REAL,               -- 置信度 0-1
    source TEXT,                   -- 来源: user/ai/dialogue
    keywords TEXT,                 -- JSON数组: ["关键词"]
    category TEXT,                 -- 知识分类
    is_merged INTEGER DEFAULT 0,   -- 是否已被合并
    merged_into TEXT,              -- 合并到哪个知识ID
    frequency INTEGER DEFAULT 1,   -- 出现频率
    created_at TEXT,
    updated_at TEXT
);

-- 合并后的沉淀知识
CREATE TABLE rag_settled_knowledge (
    id TEXT PRIMARY KEY,
    knowledge_type TEXT,
    content TEXT,
    confidence REAL,
    keywords TEXT,                 -- JSON数组
    category TEXT,
    sources TEXT,                  -- JSON数组: 来源对话ID列表
    frequency INTEGER,             -- 总频率
    status TEXT DEFAULT 'active',  -- active/archived/rejected
    reviewed_by TEXT,              -- 人工审核者
    created_at TEXT,
    updated_at TEXT
);
```

### 8.2 知识库健康度相关

```sql
-- 健康度检查报告
CREATE TABLE rag_health_reports (
    id TEXT PRIMARY KEY,
    overall_score REAL,            -- 0-1 整体评分
    health_level TEXT,             -- 优秀/良好/一般/需要改进
    coverage_score REAL,           -- 覆盖率分数
    freshness_score REAL,          -- 新鲜度分数
    consistency_score REAL,        -- 一致性分数
    missing_count INTEGER,
    outdated_count INTEGER,
    conflicting_count INTEGER,
    report_data TEXT,              -- 完整JSON报告
    recommendations TEXT,          -- JSON数组: 改进建议
    test_queries_used TEXT,        -- JSON: 使用的测试查询
    created_at TEXT
);

-- 健康度问题明细
CREATE TABLE rag_health_issues (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    issue_type TEXT,               -- missing/outdated/conflicting
    severity TEXT,                 -- 高/中/低
    chunk_ids TEXT,                -- JSON数组: 相关chunk ID
    description TEXT,
    suggested_fix TEXT,
    status TEXT DEFAULT 'open',    -- open/fixed/ignored
    fixed_at TEXT,
    created_at TEXT
);
```

### 8.3 版本管理相关

```sql
-- 知识库版本
CREATE TABLE rag_kb_versions (
    id TEXT PRIMARY KEY,
    version_name TEXT UNIQUE,
    description TEXT,
    snapshot_data TEXT,            -- JSON: 完整知识库快照(或引用)
    total_chunks INTEGER,
    total_content_length INTEGER,
    avg_chunk_length REAL,
    embedding_model TEXT,
    embedding_dimensions INTEGER,
    parent_version_id TEXT,        -- 父版本ID
    status TEXT DEFAULT 'active',  -- active/archived/deprecated
    created_by TEXT,
    created_at TEXT
);

-- 版本差异记录
CREATE TABLE rag_kb_version_diffs (
    id TEXT PRIMARY KEY,
    version1_id TEXT,
    version2_id TEXT,
    added_chunks INTEGER,
    removed_chunks INTEGER,
    modified_chunks INTEGER,
    unchanged_chunks INTEGER,
    diff_data TEXT,                -- JSON: 详细变更内容
    created_at TEXT
);

-- 版本性能评测
CREATE TABLE rag_version_benchmarks (
    id TEXT PRIMARY KEY,
    version_id TEXT,
    test_set_id TEXT,             -- 关联测试集
    accuracy REAL,
    avg_response_time REAL,
    total_queries INTEGER,
    correct_answers INTEGER,
    query_results TEXT,           -- JSON: 逐题结果
    created_at TEXT
);

-- 版本性能对比
CREATE TABLE rag_version_comparisons (
    id TEXT PRIMARY KEY,
    version1_id TEXT,
    version2_id TEXT,
    accuracy_diff REAL,
    time_diff REAL,
    recommendation TEXT,
    comparison_data TEXT,          -- JSON: 详细对比
    created_at TEXT
);

-- 回归测试记录
CREATE TABLE rag_regression_tests (
    id TEXT PRIMARY KEY,
    version_id TEXT,
    test_set_id TEXT,
    pass_rate REAL,
    total_tests INTEGER,
    passed_tests INTEGER,
    test_results TEXT,            -- JSON: 逐题结果
    created_at TEXT
);
```

---

## 九、API 路由扩展

新增的 API 端点：

```
# 对话知识沉淀
POST   /api/rag/knowledge/extract        — 从对话中提取知识
POST   /api/rag/knowledge/batch-extract   — 批量提取
POST   /api/rag/knowledge/merge           — 合并相似知识
GET    /api/rag/knowledge/settled         — 获取已沉淀知识列表
PUT    /api/rag/knowledge/settled/:id     — 审核/编辑沉淀知识
POST   /api/rag/knowledge/apply           — 将沉淀知识应用到知识库

# 知识库健康度
POST   /api/rag/health/check              — 执行健康度检查
GET    /api/rag/health/reports            — 获取历史报告列表
GET    /api/rag/health/reports/:id        — 获取报告详情
GET    /api/rag/health/issues             — 获取问题列表
PUT    /api/rag/health/issues/:id         — 更新问题状态

# 版本管理
POST   /api/rag/versions                  — 创建新版本
GET    /api/rag/versions                  — 获取版本列表
GET    /api/rag/versions/:id              — 获取版本详情
DELETE /api/rag/versions/:id              — 删除版本
POST   /api/rag/versions/compare          — 对比两个版本
POST   /api/rag/versions/:id/evaluate     — 评测版本性能
POST   /api/rag/versions/compare-perf     — 对比版本性能
POST   /api/rag/versions/:id/regression   — 运行回归测试
POST   /api/rag/versions/:id/rollback     — 回滚到指定版本
```
