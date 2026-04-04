# Finspark RAG 平台 — 前后端总体开发方案与分阶段计划

> 版本：v1.0 | 日期：2026-03-30  
> 前置文档：`RAG_BACKEND_DEVELOPMENT_PLAN.md` | `RAG_PLATFORM_UI_SPEC.md` | `RAG_CODE_REFERENCE.md`  
> 技术栈：Hono + Cloudflare Workers (D1 / KV / R2) + TypeScript + Vite + 原生前端组件

---

## 一、项目全景

### 1.1 目标

将现有单页面三 Tab 的 RAG 知识库（问答 / 文档管理 / 上传）升级为 **企业级 RAG 工程平台**，覆盖数据处理、检索优化、评测运维、知识沉淀和版本管理的全生命周期。

### 1.2 现状 → 目标一览

| 维度 | 现状 (Baseline) | 目标 (Target) | 倍率 |
|------|-----------------|---------------|------|
| 前端页面数 | 1（三 Tab） | 17（独立页面 + 二级导航） | ×17 |
| 后端路由文件 | 1 (`rag.ts`) | 4 (`rag.ts` 扩展 + 3 个新建) | ×4 |
| 后端 Service 文件 | 1 (`rag.ts`) | 10 (1 扩展 + 9 新建) | ×10 |
| D1 数据表 | 3 | 27 (3 扩展 + 24 新建) | ×9 |
| API 端点 | 6 | 56+ | ×9 |
| DB Migration 文件 | 1 (`0019`) | 9 (`0019`~`0027`) | ×9 |
| 检索方式 | 纯向量 | 向量 + BM25 + LLM 重排 | ×3 |

### 1.3 技术架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                         前端 (TypeScript + Vite)                     │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ 数据管理 │  │检索与问答│  │ 评测中心 │  │ 版本管理 │  │ 平台设置 │  │
│  │P.0-P.3  │  │P.4-P.5  │  │P.6-P.7  │  │  P.16   │  │P.11-P.13│  │
│  │  P.14   │  │         │  │  P.15   │  │         │  │         │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  │
│       │            │            │            │            │         │
│       └────────────┴────────────┴────────────┴────────────┘         │
│                                 │                                    │
│                           fetch /api/rag/*                           │
├──────────────────────────────────────────────────────────────────────┤
│                      后端 API Routes (Hono)                          │
│                                                                      │
│  routes/rag.ts         核心数据 CRUD + 问答 + 统计                   │
│  routes/rag-enhance.ts 质量增强 + 检索调试 + 评测                    │
│  routes/rag-ops.ts     日志 + Pipeline + 配置                        │
│  routes/rag-knowledge.ts 知识沉淀 + 健康检查 + 版本管理              │
├──────────────────────────────────────────────────────────────────────┤
│                      Service Layer (10 modules)                      │
│                                                                      │
│  rag.ts(扩展) | ragBm25 | ragPipeline | ragEnhance | ragTestSet     │
│  ragKnowledge | ragHealth | ragVersion | ragIntent  | ragConfig      │
├──────────────────────────────────────────────────────────────────────┤
│                      Data Layer                                      │
│                                                                      │
│  Cloudflare D1 (27 表)   │  KV (向量/BM25/缓存)  │  R2 (PDF文件)    │
├──────────────────────────────────────────────────────────────────────┤
│                      External Services                               │
│                                                                      │
│  DashScope (Embedding + LLM) │ VectorEngine (LLM) │ MinerU (PDF OCR)│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 二、分阶段总体规划

### 2.1 Phase 划分原则

1. **每个 Phase 可独立发布**：每阶段结束时可对外展示完整功能闭环
2. **前后端同步推进**：每个 Phase 内前端页面与后端 API 同步开发、同步联调
3. **高价值优先**：优先实现用户直接使用的核心功能
4. **依赖前置**：数据库 Schema / 基础 Service 在每阶段初期完成

### 2.2 四阶段总览

```
Phase 1: 核心数据层（Week 1 ~ 3）
  前端 → P.1 文档上传 + P.2 知识库浏览器 + P.4 对话助手 + P.0 仪表盘
  后端 → DB 0020~0022 + Chunk CRUD + BM25 + 混合检索 + PDF 上传 + 意图识别

Phase 2: 运维评测层（Week 4 ~ 6）
  前端 → P.8 对话日志 + P.6 测试集管理 + P.7 批量评测 + P.9 意图日志
  后端 → DB 0023~0024 + 测试集 CRUD + 评测引擎 + 配置 CRUD + 日志查询

Phase 3: 智能增强层（Week 7 ~ 9）
  前端 → P.3 Chunk 增强 + P.5 检索调试台 + P.14 对话知识沉淀 + P.15 健康度检查
  后端 → DB 0025~0026 + 问题生成 + 知识提取/合并 + 三维健康检查引擎

Phase 4: 版本管控层（Week 10 ~ 12）
  前端 → P.16 版本管理 + P.10 Pipeline 追踪 + P.11 模型配置 + P.12 Prompt 管理 + P.13 系统配置
  后端 → DB 0027 + 版本快照/Diff/A-B 对比 + Cron 定时任务 + 全平台集成测试
```

---

## 三、Phase 1 — 核心数据层（Week 1 ~ 3）

> **目标**：完成文档上传增强 + Chunk 级操作 + 增强版问答 + 混合检索 + 仪表盘，构成用户可完整使用的最小闭环。

### 3.1 交付页面

| 页面 | 路由 | 优先级 | 核心功能 |
|------|------|--------|----------|
| P.1 文档上传与解析 | `/rag/upload` | P0 | PDF 上传 + MinerU 解析 + 多种切片策略 + 切片预览 + 4 步处理进度 |
| P.2 知识库浏览器 | `/rag/knowledge-base` | P0 | 文档列表 + Chunk 列表/详情/编辑/删除 + 筛选搜索 + 重建索引 |
| P.4 对话助手 | `/rag/chat` | P0 | 工作流可视化(意图→检索→重排→生成) + 右侧检索详情 + 实时配置调节 |
| P.0 仪表盘总览 | `/rag/dashboard` | P1 | 5 项 KPI 卡片 + 问答趋势图 + 分类占比 + 最近问答 + 系统状态 |

### 3.2 后端任务明细

#### Week 1：数据基础 + BM25

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 创建 DB Migration `0020_rag_chunks_enhance.sql` | 后端-DB | rag_chunks 扩展 + rag_chunk_questions 表 | 0.5d |
| 创建 DB Migration `0021_rag_bm25_index.sql` | 后端-DB | rag_bm25_tokens + rag_bm25_meta 表 | 0.5d |
| 创建 DB Migration `0022_rag_pipeline_logs.sql` | 后端-DB | rag_pipeline_tasks + rag_pipeline_steps + rag_message_logs | 0.5d |
| 实现 `services/ragBm25.ts` | 后端-Service | BM25 分词(Intl.Segmenter) + 索引构建 + 检索 + BM25Okapi 计算 | 2d |
| 扩展 `routes/rag.ts` — Chunk CRUD API | 后端-Route | GET/PUT/DELETE /api/rag/chunks + 分页/筛选 | 1d |
| 扩展 `services/rag.ts` — Chunk 编辑后重新向量化 | 后端-Service | 编辑 Chunk → 重新 Embedding → 更新 KV | 0.5d |

#### Week 2：混合检索 + 意图识别

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 实现 `services/ragIntent.ts` | 后端-Service | 意图分类 + Query 改写 + 比较题拆分 + 实体提取 | 1.5d |
| 实现 `services/ragPipeline.ts` | 后端-Service | Pipeline 任务创建/执行/步骤日志/进度更新 | 2d |
| 扩展 `routes/rag.ts` — 增强版问答 API | 后端-Route | POST /api/rag/query/enhanced (混合检索+重排) | 1d |
| 消息详细日志存储 | 后端-Service | 每次问答自动记录完整 Pipeline 各步骤到 rag_message_logs | 0.5d |

#### Week 3：PDF 上传 + 仪表盘

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 扩展 `routes/rag.ts` — PDF 上传 + MinerU 集成 | 后端-Route+Service | POST /api/rag/upload/pdf → R2 存储 → MinerU 异步解析 | 2d |
| 扩展 `routes/rag.ts` — 切片预览 API | 后端-Route | GET /api/rag/upload/preview (前端调参后实时预览) | 0.5d |
| 扩展 `routes/rag.ts` — 仪表盘聚合 API | 后端-Route | GET /api/rag/stats/dashboard (KPI + 趋势 + 分类) | 1d |
| R2 绑定启用 | 后端-配置 | wrangler.jsonc 取消 R2 注释 + PDF 存储路径规划 | 0.5d |

### 3.3 前端任务明细

#### Week 1：平台框架 + 导航

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| RAG 平台二级导航 sidebar 组件 | 前端-组件 | 6 组导航（数据管理/检索与问答/评测中心/版本管理/日志与追踪/平台设置） | 1d |
| RAG 平台路由注册（17 页面路由） | 前端-路由 | /rag/dashboard ~ /rag/versions 全部路由声明 | 0.5d |
| 主站侧边栏入口新增 "RAG 平台" | 前端-修改 | sidebar.ts 添加 RAG Platform 入口 | 0.5d |
| 公共 UI 组件库搭建 | 前端-组件 | KPI 卡片 / 进度条 / 可折叠面板 / 表格 / Tab 切换器 | 2d |

#### Week 2：P.1 文档上传 + P.2 知识库浏览器

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.1 文档上传页面 | 前端-页面 | PDF 拖拽上传 + 文本粘贴 Tab + 文档信息表单 + 切片参数配置 | 2d |
| P.1 切片预览 + 处理进度 | 前端-交互 | 实时切片预览列表 + 4 步处理进度条 + KV 轮询 | 1d |
| P.2 知识库浏览器 — 文档列表 | 前端-页面 | 左侧文档目录树 + 右侧文档元数据面板 + 操作按钮 | 1.5d |
| P.2 知识库浏览器 — Chunk 列表 | 前端-页面 | Chunk 卡片列表 + Tab 筛选(全部/文本/表格) + 分页 + 编辑/删除 | 1.5d |

#### Week 3：P.4 对话助手 + P.0 仪表盘

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.4 对话助手 — 对话界面 | 前端-页面 | 左侧对话区 + 消息列表 + 输入框 + Markdown 渲染 | 1.5d |
| P.4 对话助手 — 工作流可视化 | 前端-组件 | 4 步 Pipeline 面板(意图→检索→重排→生成) + 耗时标注 | 1.5d |
| P.4 对话助手 — 右侧检索面板 | 前端-组件 | 检索详情 + 引用来源卡片 + 实时检索配置调节器 | 1d |
| P.0 仪表盘 | 前端-页面 | 5 项 KPI 卡片 + 问答趋势折线图 + 分类饼图 + 最近问答列表 + 系统状态 | 1.5d |

### 3.4 Phase 1 联调与验收

| 联调项 | 前端页面 | 后端 API | 验收标准 |
|--------|---------|---------|---------|
| PDF 文件上传 | P.1 | POST /api/rag/upload/pdf | PDF 可上传 → MinerU 解析 → 自动分块 → 向量化 → BM25 索引 |
| 切片预览 | P.1 | GET /api/rag/upload/preview | 修改参数后实时刷新前 20 个 Chunk |
| Chunk 浏览 | P.2 | GET /api/rag/chunks | 按文档筛选、分页浏览、编辑后重新向量化 |
| 增强问答 | P.4 | POST /api/rag/query/enhanced | 混合检索(向量+BM25) + LLM 重排 + 完整工作流可视化 |
| 仪表盘 | P.0 | GET /api/rag/stats/dashboard | 5 项 KPI 正确展示 + 趋势图 |
| Pipeline 日志 | P.4 | rag_message_logs 表 | 每次问答自动记录各步骤耗时 |

### 3.5 Phase 1 验收检查清单

- [ ] PDF 文件可上传并自动解析、分块、向量化、BM25 索引
- [ ] Chunk 可浏览、编辑、删除、搜索
- [ ] 问答支持混合检索（向量 + BM25）+ 可选 LLM 重排
- [ ] 每条问答附带完整工作流可视化（4 步 Pipeline + 耗时）
- [ ] 仪表盘展示基础 KPI + 趋势图
- [ ] RAG 平台二级导航正常切换

---

## 四、Phase 2 — 运维评测层（Week 4 ~ 6）

> **目标**：完成测试集管理 + 批量评测 + 对话日志 + 基础配置，建立 RAG 质量度量体系。

### 4.1 交付页面

| 页面 | 路由 | 优先级 | 核心功能 |
|------|------|--------|----------|
| P.8 对话日志 | `/rag/logs/chat` | P1 | Pipeline 执行明细 + 时间线汇总 + 搜索筛选 + 统计概览 |
| P.6 测试集管理 | `/rag/test-sets` | P1 | 手动创建 + LLM 自动生成 + CSV 导入 + LLM 问题扩写 |
| P.7 批量评测与打分 | `/rag/evaluation` | P1 | 参数化评测 + 4 维打分 + 类型/难度分析 + 历史对比 |
| P.9 意图识别日志 | `/rag/logs/intent` | P2 | 意图分布统计 + 改写效果对比 + Query 拆分日志 |

### 4.2 后端任务明细

#### Week 4：DB + 测试集

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 创建 DB Migration `0023_rag_test_evaluation.sql` | 后端-DB | rag_test_sets + questions + variants + evaluations + results | 0.5d |
| 创建 DB Migration `0024_rag_platform_config.sql` | 后端-DB | rag_model_configs + prompt_templates + prompt_versions + system_configs | 0.5d |
| 实现 `services/ragTestSet.ts` — 测试集 CRUD | 后端-Service | 创建/查看/编辑/删除测试集 + 题目管理 | 1.5d |
| 实现 LLM 题目自动生成 | 后端-Service | 基于文档 Chunk 内容生成测试题(类型+难度+答案) | 1d |
| 实现 LLM 问题扩写 | 后端-Service | 对已有测试题生成同义改写变体 | 0.5d |

#### Week 5：评测引擎 + 打分

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 实现评测任务执行引擎 | 后端-Service | 批量问答 → 逐题记录检索结果+模型回答 → 进度更新 | 2d |
| 实现 4 维打分系统 | 后端-Service | 精确匹配 + LLM 语义 + Recall + 引用准确率 | 1.5d |
| 创建 `routes/rag-enhance.ts` — 评测相关 API | 后端-Route | POST /run + GET /:id + GET /history | 1d |
| 评测历史对比数据 API | 后端-Route | 同一测试集多次评测的分数趋势 | 0.5d |

#### Week 6：日志 + 配置

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 创建 `routes/rag-ops.ts` — 日志查询 API | 后端-Route | GET /logs/chat + /logs/chat/:id + /logs/intent + /logs/intent/stats | 1.5d |
| 实现 `services/ragConfig.ts` — 配置管理 | 后端-Service | 模型/Prompt/系统配置 CRUD + API Key 管理 + 连接测试 | 1.5d |
| 创建配置相关 API | 后端-Route | GET/PUT /settings/models + /settings/prompts + /settings/system | 1d |
| Prompt 版本管理 API | 后端-Route | 更新 Prompt 自动创建新版本 + 版本历史查询 | 0.5d |

### 4.3 前端任务明细

#### Week 4：P.8 对话日志

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.8 日志列表 + 搜索筛选 | 前端-页面 | 对话日志卡片列表 + 时间范围 + 状态筛选 + 关键词搜索 | 1.5d |
| P.8 Pipeline 执行明细展开 | 前端-组件 | 6 步 Pipeline 详情(意图→向量→BM25→去重→重排→生成) + 时间线汇总 | 2d |
| P.8 统计概览面板 | 前端-组件 | 今日问答数 / 平均耗时 / 成功率 / Token 消耗 | 0.5d |

#### Week 5：P.6 测试集管理 + P.7 批量评测

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.6 测试集列表 + 创建/编辑表单 | 前端-页面 | 测试集卡片 + 3 种创建方式 Tab(手动/LLM/CSV) | 2d |
| P.6 LLM 自动生成 + 问题扩写界面 | 前端-交互 | 生成配置 + 预览 + 逐题审核 + 扩写结果展示 | 1.5d |
| P.7 评测任务配置 + 进度 | 前端-页面 | RAG 参数配置面板 + 打分策略选择 + 实时进度条 | 1.5d |
| P.7 评测报告 + 历史对比 | 前端-页面 | 总分 + 4 维分数 + 类型/难度分析 + 逐题详情表 + 历史折线图 | 2d |

#### Week 6：P.9 意图日志

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.9 意图识别日志列表 | 前端-页面 | 日志卡片(意图类型+置信度+改写前后+效果) | 1.5d |
| P.9 统计面板 | 前端-组件 | 意图类型分布饼图 + 改写触发率 | 0.5d |

### 4.4 Phase 2 验收检查清单

- [ ] 可创建测试集（手动 / LLM 自动生成 / CSV 导入）
- [ ] 可运行批量评测并获取 4 维度分数 + 类型/难度分析
- [ ] 对话日志可搜索、筛选、查看完整 Pipeline 步骤详情
- [ ] 意图识别日志可查看改写前后对比 + 效果评估
- [ ] 模型和 Prompt 可在线配置（基础 CRUD）

---

## 五、Phase 3 — 智能增强层（Week 7 ~ 9）

> **目标**：完成 Chunk 质量增强 + 检索调试台 + 对话知识沉淀 + 健康度检查，构建 RAG 持续优化闭环。

### 5.1 交付页面

| 页面 | 路由 | 优先级 | 核心功能 |
|------|------|--------|----------|
| P.3 Chunk 质量增强 | `/rag/chunk-enhance` | P2 | HyDE 问题改写 + 摘要增强 + 实体标注 + 试运行 + 批量处理 |
| P.5 检索调试台 | `/rag/retrieval-debug` | P2 | 多策略并行检索对比 + Recall 计算 + 向量可视化 |
| P.14 对话知识沉淀 | `/rag/knowledge-settle` | P2 | 5 类知识提取 + 自动过滤 + LLM 合并 + 审核 + 应用入库 |
| P.15 知识库健康度检查 | `/rag/health-check` | P2 | 覆盖率×40% + 新鲜度×30% + 一致性×30% + 改进建议 + 趋势 |

### 5.2 后端任务明细

#### Week 7：DB + Chunk 增强

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 创建 DB Migration `0025_rag_knowledge_settle.sql` | 后端-DB | rag_conversation_knowledge + rag_settled_knowledge | 0.5d |
| 创建 DB Migration `0026_rag_health_check.sql` | 后端-DB | rag_health_reports + rag_health_issues | 0.5d |
| 实现 `services/ragEnhance.ts` — HyDE 问题生成 | 后端-Service | 单 Chunk 生成 + 批量生成 + 试运行(3 Chunk) | 1.5d |
| 实现摘要增强 + 实体标注 | 后端-Service | LLM 摘要生成 + 实体/关键词自动提取 | 1d |
| 问题 Embedding 生成 + 问题 BM25 索引构建 | 后端-Service | 生成的问题也建立向量和 BM25 索引 | 0.5d |

#### Week 8：检索调试 + 知识沉淀

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 扩展 `routes/rag-enhance.ts` — 检索调试 API | 后端-Route | POST /retrieval-debug (向量/BM25/混合 并行) | 1d |
| 实现 `services/ragKnowledge.ts` — 知识提取 | 后端-Service | 单次对话提取(5 类知识) + 批量提取 + 频率统计 | 1.5d |
| 实现知识过滤 + LLM 合并 | 后端-Service | 自动过滤需求/问题类型 + 按类型分组 + LLM 智能合并 | 1.5d |
| 创建 `routes/rag-knowledge.ts` — 知识沉淀 API | 后端-Route | extract/batch-extract/merge/review/apply/stats | 1d |

#### Week 9：健康检查 + 审核工作流

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 实现 `services/ragHealth.ts` — 三维健康检查 | 后端-Service | 覆盖率(LLM) + 新鲜度(LLM) + 一致性(LLM) + 加权评分 | 2d |
| 实现健康报告 + 问题追踪 + 改进建议 | 后端-Service | 报告存储 + issue CRUD + 自动建议生成 | 1d |
| 创建健康检查 API | 后端-Route | POST /health/run + GET /reports + POST /issues/:id/fix | 0.5d |
| 知识沉淀审核工作流完善 | 后端-Service | accept/reject + 应用到知识库(创建新 Chunk + 向量化) | 0.5d |

### 5.3 前端任务明细

#### Week 7：P.3 Chunk 质量增强

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.3 增强策略选择(3 张卡片) | 前端-页面 | 问题改写 / 摘要增强 / 自动标注 策略卡片 | 0.5d |
| P.3 配置面板 + Prompt 编辑器 | 前端-组件 | 目标文档选择 + LLM 模型 + 问题数 + Prompt 模板编辑 | 1d |
| P.3 试运行预览 + 质量评估 | 前端-交互 | 3 Chunk 试运行结果 + 三维星级评分 + 接受/重新生成/编辑 | 1d |
| P.3 批量处理进度 + 结果一览 | 前端-组件 | 实时进度条 + Token 消耗 + 文档级增强状态汇总表 | 1d |

#### Week 8：P.5 检索调试台 + P.14 知识沉淀

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.5 检索调试台 | 前端-页面 | Query 输入 + 3 列并行结果对比 + 重叠分析 + Recall | 2d |
| P.14 统计面板 + 单次提取界面 | 前端-页面 | 5 项统计卡片 + 对话选择 + 提取结果卡片(接受/编辑/拒绝) | 2d |
| P.14 批量提取进度 | 前端-组件 | 时间范围筛选 + 条件配置 + 实时进度 | 0.5d |

#### Week 9：P.14 合并审核 + P.15 健康检查

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.14 知识合并与沉淀 Tab | 前端-页面 | 按类型分组展示 + 合并前后对比 + 审核操作 + 已沉淀知识列表 | 2d |
| P.15 健康度总览 | 前端-页面 | 总分环形图 + 三维分数卡片 + 趋势折线图 + 检查配置 | 1.5d |
| P.15 详细报告 Tab | 前端-页面 | 覆盖率/新鲜度/一致性 3 个分析 Tab + 缺失/过期/冲突列表 + 改进建议 | 2d |
| P.15 历史报告列表 | 前端-组件 | 历史报告表格 + 分数对比 | 0.5d |

### 5.4 Phase 3 验收检查清单

- [ ] Chunk 可批量生成假设性问题并建立向量/BM25 双索引
- [ ] 检索调试台可并行对比向量 / BM25 / 混合+重排三种策略 + 重叠分析
- [ ] 对话日志可自动提取知识 → 过滤 → 合并 → 审核 → 入库
- [ ] 知识库可运行三维健康检查并生成结构化报告 + 改进建议
- [ ] 知识沉淀 → 知识库 → 健康检查的闭环打通

---

## 六、Phase 4 — 版本管控层（Week 10 ~ 12）

> **目标**：完成版本管理 + Pipeline 追踪 + 全平台配置管理，平台达到生产就绪。

### 6.1 交付页面

| 页面 | 路由 | 优先级 | 核心功能 |
|------|------|--------|----------|
| P.16 知识库版本管理 | `/rag/versions` | P2 | 版本时间线 + Diff 对比 + 性能 A/B + 回归测试 + 回滚 |
| P.10 Pipeline 追踪 | `/rag/logs/pipeline` | P3 | 后台任务列表 + 步骤进度条 + 失败重试 |
| P.11 模型配置 | `/rag/settings/models` | P3 | Embedding/LLM 模型 CRUD + API Key 管理 + 连接测试 |
| P.12 Prompt 模板管理 | `/rag/settings/prompts` | P3 | 模板列表 + 编辑器 + 版本历史 + 测试运行 |
| P.13 系统配置 | `/rag/settings/system` | P3 | 全局 RAG 参数 + 文档限制 + 安全策略 + 存储管理 |

### 6.2 后端任务明细

#### Week 10：DB + 版本创建/Diff

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 创建 DB Migration `0027_rag_version_mgmt.sql` | 后端-DB | rag_kb_versions + version_chunks + benchmarks + regression_tests | 0.5d |
| 实现 `services/ragVersion.ts` — 版本创建 | 后端-Service | 快照所有 Chunk 的 content_hash + metadata + 统计信息 | 1.5d |
| 实现版本 Diff 对比 | 后端-Service | 基于 content_hash 集合运算: 新增/删除/修改/未变 | 1.5d |
| 创建版本管理 API | 后端-Route | POST /versions + GET /versions + POST /compare | 1d |

#### Week 11：版本评测 + Pipeline 追踪

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| 实现版本性能评测 + A/B 对比 | 后端-Service | 对版本运行测试集 → 准确率+响应时间 → 双版本对比+推荐 | 2d |
| 实现回归测试 + 版本回滚 | 后端-Service | 通过/失败列表 + 通过率 + 回滚到指定版本 | 1d |
| Pipeline 追踪 API 完善 | 后端-Route | GET /logs/pipeline + /:id + POST /:id/retry | 1d |
| 版本评测 + 回归 API | 后端-Route | POST /:id/evaluate + /compare-performance + /:id/regression-test + /:id/rollback | 1d |

#### Week 12：配置完善 + 定时任务 + 集成测试

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| Prompt 版本管理完善 | 后端-Service | 更新 Prompt → 自动创建新版本 + 版本对比 + 回退 | 1d |
| Cloudflare Cron Trigger 定时任务 | 后端-配置 | 定时健康检查 (每周) + 定时统计报告 | 1d |
| 全平台集成测试 | 测试 | 核心链路端到端测试：上传→问答→日志→评测→知识沉淀→健康检查→版本 | 2d |
| 性能优化 + 文档更新 | 优化 | D1 查询优化 + KV 批量操作 + API 文档 | 1d |

### 6.3 前端任务明细

#### Week 10：P.16 版本管理

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.16 版本时间线 + 版本列表 | 前端-页面 | 时间线可视化 + 版本卡片(统计/评分/操作按钮) | 1.5d |
| P.16 版本 Diff 对比 | 前端-页面 | 变更概要(新增/删除/修改/未变) + 统计对比表 + 逐项变更明细 | 2d |
| P.16 性能对比 + 回归测试 | 前端-页面 | 性能指标对比表 + 逐题对比 + 回归测试结果 + 失败分析 | 2d |
| P.16 创建版本弹窗 | 前端-组件 | 版本名称/描述 + 创建方式选择 + 自动索引/测试选项 | 0.5d |

#### Week 11：P.10 Pipeline + P.11 模型配置

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.10 Pipeline 任务列表 | 前端-页面 | 任务卡片 + 步骤进度条 + 状态筛选 + 失败重试 | 1.5d |
| P.11 模型配置页面 | 前端-页面 | Embedding/LLM 配置表 + API Key 管理 + 连接测试 + 用量统计 | 2d |

#### Week 12：P.12 Prompt + P.13 系统配置 + 收尾

| 任务 | 类型 | 交付物 | 预计工作量 |
|------|------|--------|-----------|
| P.12 Prompt 模板管理 | 前端-页面 | 模板列表 + 代码编辑器 + 变量说明 + 版本历史 + 测试运行 | 2d |
| P.13 系统配置 | 前端-页面 | 全局参数表单 + 文档限制 + 安全策略 + 存储管理 + 调试模式 | 1.5d |
| 全平台 UI 打磨 + 一致性检查 | 前端-优化 | 统一样式 + 响应式适配 + 加载/空状态 + 错误处理 | 1.5d |

### 6.4 Phase 4 验收检查清单

- [ ] 知识库可创建版本快照并查看版本时间线
- [ ] 两个版本可 Diff 对比（新增/删除/修改/未变）
- [ ] 可运行性能 A/B 对比和回归测试 + 自动推荐建议
- [ ] 可回滚到历史版本
- [ ] Pipeline 任务可追踪执行步骤并重试失败步骤
- [ ] 模型/Prompt/系统配置可在线管理
- [ ] 全平台 17 个页面均可正常使用

---

## 七、页面 × API × Service × DB 全映射表

> 这张表是后续拆解每个页面开发任务的核心参考。

### 7.1 数据管理组

| 页面 | 路由文件 | Service 文件 | DB 表 | API 端点数 |
|------|---------|-------------|-------|-----------|
| **P.0** 仪表盘 | rag.ts | rag.ts | rag_documents/chunks/conversations/message_logs | 1 (stats/dashboard) |
| **P.1** 文档上传 | rag.ts | rag.ts + ragPipeline.ts | rag_documents + rag_chunks + rag_pipeline_tasks/steps | 3 (upload/pdf + upload/preview + 现有 upload) |
| **P.2** 知识库浏览器 | rag.ts | rag.ts + ragBm25.ts | rag_documents + rag_chunks | 6 (chunks CRUD + similar + reindex) |
| **P.14** 对话知识沉淀 | rag-knowledge.ts | ragKnowledge.ts | rag_conversation_knowledge + rag_settled_knowledge | 7 (extract + batch + merge + review + apply + stats + settled) |

### 7.2 检索与问答组

| 页面 | 路由文件 | Service 文件 | DB 表 | API 端点数 |
|------|---------|-------------|-------|-----------|
| **P.4** 对话助手 | rag.ts | rag.ts + ragBm25.ts + ragIntent.ts + ragPipeline.ts | rag_conversations + rag_message_logs | 2 (query/enhanced + 现有 query) |
| **P.5** 检索调试台 | rag-enhance.ts | rag.ts + ragBm25.ts | rag_chunks + rag_bm25_tokens | 1 (retrieval-debug) |

### 7.3 评测中心组

| 页面 | 路由文件 | Service 文件 | DB 表 | API 端点数 |
|------|---------|-------------|-------|-----------|
| **P.6** 测试集管理 | rag-enhance.ts | ragTestSet.ts | rag_test_sets + questions + variants | 7 (CRUD + generate + expand) |
| **P.7** 批量评测 | rag-enhance.ts | ragTestSet.ts | rag_evaluations + rag_evaluation_results | 3 (run + :id + history) |
| **P.15** 健康度检查 | rag-knowledge.ts | ragHealth.ts | rag_health_reports + rag_health_issues | 4 (run + reports + reports/:id + issues/:id/fix) |

### 7.4 版本管理组

| 页面 | 路由文件 | Service 文件 | DB 表 | API 端点数 |
|------|---------|-------------|-------|-----------|
| **P.16** 版本管理 | rag-knowledge.ts | ragVersion.ts | rag_kb_versions + version_chunks + benchmarks + regression_tests | 8 (CRUD + compare + evaluate + regression + rollback) |

### 7.5 日志与追踪组

| 页面 | 路由文件 | Service 文件 | DB 表 | API 端点数 |
|------|---------|-------------|-------|-----------|
| **P.8** 对话日志 | rag-ops.ts | ragPipeline.ts | rag_message_logs | 2 (logs/chat + /:id) |
| **P.9** 意图日志 | rag-ops.ts | ragIntent.ts | rag_message_logs | 2 (logs/intent + /stats) |
| **P.10** Pipeline 追踪 | rag-ops.ts | ragPipeline.ts | rag_pipeline_tasks + steps | 3 (list + /:id + /:id/retry) |

### 7.6 平台设置组

| 页面 | 路由文件 | Service 文件 | DB 表 | API 端点数 |
|------|---------|-------------|-------|-----------|
| **P.11** 模型配置 | rag-ops.ts | ragConfig.ts | rag_model_configs | 3 (list + /:usage + /test) |
| **P.12** Prompt 管理 | rag-ops.ts | ragConfig.ts | rag_prompt_templates + versions | 3 (list + /:key + PUT /:key) |
| **P.13** 系统配置 | rag-ops.ts | ragConfig.ts | rag_system_configs | 2 (GET + PUT) |

---

## 八、数据库 Migration 执行计划

| 迁移文件 | Phase | 新增/修改表 | 表数量 | 依赖 |
|---------|-------|-----------|-------|------|
| `0019_rag_knowledge_base.sql` ✅ | 已完成 | rag_documents + rag_chunks + rag_conversations | 3 | — |
| `0020_rag_chunks_enhance.sql` | Phase 1 W1 | 修改 rag_chunks + 新增 rag_chunk_questions | 1 新 + 1 改 | 0019 |
| `0021_rag_bm25_index.sql` | Phase 1 W1 | rag_bm25_tokens + rag_bm25_meta | 2 新 | 0019 |
| `0022_rag_pipeline_logs.sql` | Phase 1 W1 | rag_pipeline_tasks + rag_pipeline_steps + rag_message_logs | 3 新 | 0019 |
| `0023_rag_test_evaluation.sql` | Phase 2 W4 | rag_test_sets + questions + variants + evaluations + results | 5 新 | 0019 |
| `0024_rag_platform_config.sql` | Phase 2 W4 | rag_model_configs + prompt_templates + prompt_versions + system_configs | 4 新 | — |
| `0025_rag_knowledge_settle.sql` | Phase 3 W7 | rag_conversation_knowledge + rag_settled_knowledge | 2 新 | 0019, 0022 |
| `0026_rag_health_check.sql` | Phase 3 W7 | rag_health_reports + rag_health_issues | 2 新 | 0019 |
| `0027_rag_version_mgmt.sql` | Phase 4 W10 | rag_kb_versions + version_chunks + benchmarks + regression_tests | 4 新 | 0019, 0023 |

**总计**：8 个新增 Migration → 24 个新表 + 3 个现有表扩展 = 27 个表

---

## 九、文件创建清单

### 9.1 后端文件

| 文件路径 | Phase | 类型 | 行数估计 |
|---------|-------|------|---------|
| `migrations/0020_rag_chunks_enhance.sql` | 1 | DB Migration | ~30 |
| `migrations/0021_rag_bm25_index.sql` | 1 | DB Migration | ~30 |
| `migrations/0022_rag_pipeline_logs.sql` | 1 | DB Migration | ~60 |
| `migrations/0023_rag_test_evaluation.sql` | 2 | DB Migration | ~80 |
| `migrations/0024_rag_platform_config.sql` | 2 | DB Migration | ~50 |
| `migrations/0025_rag_knowledge_settle.sql` | 3 | DB Migration | ~40 |
| `migrations/0026_rag_health_check.sql` | 3 | DB Migration | ~40 |
| `migrations/0027_rag_version_mgmt.sql` | 4 | DB Migration | ~60 |
| `src/services/ragBm25.ts` | 1 | Service | ~300 |
| `src/services/ragPipeline.ts` | 1 | Service | ~250 |
| `src/services/ragIntent.ts` | 1 | Service | ~200 |
| `src/services/ragEnhance.ts` | 3 | Service | ~350 |
| `src/services/ragTestSet.ts` | 2 | Service | ~400 |
| `src/services/ragKnowledge.ts` | 3 | Service | ~350 |
| `src/services/ragHealth.ts` | 3 | Service | ~300 |
| `src/services/ragVersion.ts` | 4 | Service | ~350 |
| `src/services/ragConfig.ts` | 2 | Service | ~200 |
| `src/routes/rag-enhance.ts` | 2 | Route | ~300 |
| `src/routes/rag-ops.ts` | 2 | Route | ~250 |
| `src/routes/rag-knowledge.ts` | 3 | Route | ~300 |
| `src/routes/rag.ts` (扩展) | 1 | Route 扩展 | +200 |

### 9.2 前端文件

| 文件路径 | Phase | 类型 | 行数估计 |
|---------|-------|------|---------|
| `src/pages/ragDashboard.ts` | 1 | 页面 (P.0) | ~500 |
| `src/pages/ragUpload.ts` | 1 | 页面 (P.1) | ~800 |
| `src/pages/ragKnowledgeBrowser.ts` | 1 | 页面 (P.2) | ~700 |
| `src/pages/ragChunkEnhance.ts` | 3 | 页面 (P.3) | ~600 |
| `src/pages/ragChat.ts` | 1 | 页面 (P.4) | ~900 |
| `src/pages/ragRetrievalDebug.ts` | 3 | 页面 (P.5) | ~600 |
| `src/pages/ragTestSets.ts` | 2 | 页面 (P.6) | ~700 |
| `src/pages/ragEvaluation.ts` | 2 | 页面 (P.7) | ~700 |
| `src/pages/ragChatLogs.ts` | 2 | 页面 (P.8) | ~500 |
| `src/pages/ragIntentLogs.ts` | 2 | 页面 (P.9) | ~400 |
| `src/pages/ragPipelineLogs.ts` | 4 | 页面 (P.10) | ~400 |
| `src/pages/ragModelConfig.ts` | 4 | 页面 (P.11) | ~500 |
| `src/pages/ragPromptManager.ts` | 4 | 页面 (P.12) | ~600 |
| `src/pages/ragSystemConfig.ts` | 4 | 页面 (P.13) | ~400 |
| `src/pages/ragKnowledgeSettle.ts` | 3 | 页面 (P.14) | ~800 |
| `src/pages/ragHealthCheck.ts` | 3 | 页面 (P.15) | ~700 |
| `src/pages/ragVersions.ts` | 4 | 页面 (P.16) | ~800 |
| `src/components/ragSidebar.ts` | 1 | 组件 | ~200 |
| `src/components/ragCommon.ts` | 1 | 公共组件库 | ~400 |

---

## 十、关键技术方案摘要

### 10.1 BM25 在 D1 中的实现

```typescript
// 核心：Intl.Segmenter 中文分词 + D1 倒排索引 + 应用层 BM25Okapi 计算
tokenize(text) → Intl.Segmenter('zh-CN', {granularity: 'word'})
buildIndex(docId) → 分词 → 词频统计 → INSERT rag_bm25_tokens
search(query, topK) → 分词 → SQL 查匹配 token → 计算 BM25 分数 → 排序
```

### 10.2 混合检索 + LLM 重排 Pipeline

```
Query → 意图识别(12ms) → [向量检索(156ms) || BM25检索(42ms)] 
      → 去重合并(2ms) → LLM 重排(1230ms) → 生成回答(2100ms)
```

### 10.3 进度推送

```
方案：KV 轮询（与现有分析报告进度一致）
前端 → 定时 GET /api/rag/pipeline/status/:taskId (每 2 秒)
后端 → 每步完成时 KV.put(`pipeline:${taskId}`, progressJSON)
```

### 10.4 Workers 限制应对

| 限制 | 应对 |
|------|------|
| CPU 30s | `waitUntil()` 后台执行 + 分批处理 |
| D1 并发写入 | 批量 INSERT 每批 50 条 + delay |
| 无定时任务 | Cloudflare Cron Triggers |
| 无 WebSocket | KV 轮询 |
| 无 FAISS | KV + 余弦相似度计算（现有方案） |

### 10.5 Python → TypeScript 移植要点

| Python 依赖 | TypeScript 替代 |
|-------------|----------------|
| jieba | Intl.Segmenter (Workers 原生) |
| rank_bm25 | 自实现 BM25Okapi (基于 D1 倒排索引) |
| faiss_cpu | KV 存储 + 余弦相似度 (现有方案) |
| dashscope SDK | OpenAI 兼容 API (统一 base_url) |
| numpy | 原生 JS 数组运算 |
| pandas | 原生 JS 对象操作 |

---

## 十一、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| Workers CPU 30s 限制 | 批量操作超时 | 中 | `waitUntil()` + 任务分批 + Pipeline 异步化 |
| Intl.Segmenter 分词质量 | BM25 中文检索精度 | 中 | 预构建高频词典 + 停用词表扩展(28→1800) |
| MinerU API 可用性 | PDF 解析失败 | 低 | 纯文本提取回退 + 错误重试(3次) |
| D1 并发写入锁 | 批量索引构建卡顿 | 中 | 分批 INSERT(50条/批) + 适当延时 |
| 前端页面过多(17个) | 开发周期超预期 | 中 | 组件复用 + 公共样式库 + 渐进式交付 |
| LLM Token 消耗 | 成本超预算 | 低 | 试运行机制(先3个Chunk) + 批量 Token 统计 |

---

## 十二、质量保障

### 12.1 开发规范

| 规范 | 说明 |
|------|------|
| API 响应格式 | 统一 `{ success, data, message }` / `{ success, data, total, limit, offset }` / `{ success: false, error }` |
| LLM Temperature | 高确定性 0.1 / 结构化判断 0.3 / 创意生成 0.7 |
| Prompt 管理 | Phase 1~2 硬编码常量 → Phase 3~4 DB 存储+在线编辑 |
| Git 提交 | 每个功能点独立 commit → PR → Code Review |
| 文件命名 | services/ragXxx.ts, routes/rag-xxx.ts, pages/ragXxx.ts |

### 12.2 每 Phase 验收流程

```
开发完成 → 单元测试 → 前后端联调 → 端到端测试 → 内部 Demo → 发布
```

### 12.3 关键集成测试场景

1. **上传-问答链路**：上传 PDF → 自动分块 → 向量化 → BM25 索引 → 提问 → 混合检索 → 重排 → 生成回答
2. **评测链路**：创建测试集 → LLM 生成题目 → 运行评测 → 4 维打分 → 分数报告
3. **知识沉淀链路**：问答 → 对话日志 → 知识提取 → 过滤 → 合并 → 审核 → 入库
4. **健康检查链路**：运行三维检查 → 生成报告 → 修复问题 → 创建新版本
5. **版本管理链路**：创建版本 → Diff 对比 → A/B 评测 → 回归测试 → 发布/回滚

---

## 十三、总结与下一步行动

### 总体工程量

| 维度 | 数量 |
|------|------|
| 前端页面 | 17 个 |
| 后端 Service | 9 个新建 + 1 个扩展 |
| 后端 Route | 3 个新建 + 1 个扩展 |
| DB Migration | 8 个新增 |
| D1 表 | 24 个新增 + 3 个扩展 |
| API 端点 | 56+ 个 |
| 开发周期 | 12 周 (4 个 Phase) |
| 前端代码估计 | ~10,000 行 |
| 后端代码估计 | ~4,500 行 |

### Phase 1 立即启动清单

1. **立即**：创建 Phase 1 的 3 个 DB Migration SQL 文件 (0020~0022)
2. **Day 1-2**：实现 `services/ragBm25.ts` — BM25 核心检索能力
3. **Day 2-3**：扩展 `routes/rag.ts` — Chunk CRUD API
4. **Day 3-4**：搭建 RAG 平台二级导航 + 路由框架 + 公共组件
5. **Day 4-5**：实现 P.1 文档上传页面 + P.2 知识库浏览器
6. **Week 2**：实现混合检索 Pipeline + 意图识别 + P.4 对话助手
7. **Week 3**：PDF 上传 + MinerU + P.0 仪表盘 + 联调验收

### 后续 Phase 启动条件

| Phase | 启动条件 | 预期启动时间 |
|-------|---------|-------------|
| Phase 2 | Phase 1 全部页面联调通过 + 混合检索可用 | Week 4 |
| Phase 3 | Phase 2 测试集+评测可用 + 对话日志有数据积累 | Week 7 |
| Phase 4 | Phase 3 健康检查+知识沉淀可用 + 有多次版本变更需求 | Week 10 |

---

> **下一步**：确认本方案后，立即开始 Phase 1 Week 1 的开发工作——创建 DB Migration 文件并实现 BM25 核心服务。
