# 用户 Preset Prompt 注入功能 - 详细开发方案

**文档版本**: v1.1.0  
**创建日期**: 2026-01-12  
**更新日期**: 2026-01-12  
**负责人**: AI Developer  
**状态**: ✅ 已完成

---

## 📋 完成摘要

| 任务 | 状态 | 说明 |
|------|------|------|
| T1: AgentPromptConfig 类型定义 | ✅ | /src/types/index.ts |
| T2: OrchestratorConfig 扩展 | ✅ | 新增 agentPromptConfig 字段 |
| T3: mergeSystemPrompt 函数 | ✅ | 带长度限制和分隔标记 |
| T4-T8: 13个 Agent 改造 | ✅ | PLANNING ~ TREND_INTERPRETATION |
| T9: API 层数据提取 | ✅ | 提取 promptText 并传递 |
| T10: 日志和错误处理 | ✅ | 完善的日志输出 |
| T11: 单元测试 | ✅ | 17 tests passed |
| INDUSTRY_COMPARISON | ⏳ | 独立 API，后续迭代处理 |

---

## 原始开发方案

**预计工期**: 3-4 个工作日（已提前完成）

---

## 一、问题背景

### 1.1 现状分析

当前系统存在以下问题：

| 功能模块 | 实现状态 | 说明 |
|----------|----------|------|
| Preset 数据存储 | ✅ 已完成 | `AgentPresetsService` 支持存储 `presetPromptText` |
| Preset UI 界面 | ✅ 已完成 | 用户可以在设置页面编辑 Prompt |
| 模型偏好注入 | ✅ 已完成 | `modelPreference` 已正确传递到 Orchestrator |
| **Prompt 注入** | ❌ 未完成 | `presetPromptText` 未合并到实际 LLM 调用中 |

### 1.2 核心问题

在 `/src/routes/api.ts` 第 440-464 行，虽然加载了用户 Preset 配置：

```typescript
const analysisConfigs = await presetsService.getAllAnalysisConfigs(userId, body.presetOverrides);

// 目前只提取了 modelPreference
for (const [agentType, config] of Object.entries(analysisConfigs)) {
  if (config.modelPreference) {
    effectiveModelConfig[agentType] = config.modelPreference;
  }
}
// ❌ 未提取和传递 promptText
```

在 `/src/agents/orchestrator.ts` 中，各 Agent 直接使用静态 Prompt：

```typescript
const result = await this.vectorEngine.analyzeFinancialReport(
  AGENT_PROMPTS.PROFITABILITY,  // ← 静态 System Prompt，未合并用户 Prompt
  userPrompt,
  { model: this.getModelForAgent('PROFITABILITY') }
);
```

### 1.3 影响范围

涉及 **13 个 Agent**：
- PLANNING, PROFITABILITY, BALANCE_SHEET, CASH_FLOW
- EARNINGS_QUALITY, RISK, BUSINESS_INSIGHT, BUSINESS_MODEL
- FORECAST, VALUATION, FINAL_CONCLUSION
- TREND_INTERPRETATION, INDUSTRY_COMPARISON

---

## 二、技术方案设计

### 2.1 注入策略选择

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| **A. 追加到 System Prompt** | 用户 Prompt 追加到 System Prompt 末尾 | 实现简单，用户定制优先级高 | 可能覆盖核心指令 |
| **B. 独立 User Message** | 作为独立的 user 消息插入 | 清晰分离，不影响原有逻辑 | 需要修改消息结构 |
| **C. 合并到 User Prompt** | 在 User Prompt 前/后追加 | 实现简单 | 可能与数据混淆 |
| **D. 条件替换** | 完全替换 System Prompt | 灵活性最高 | 风险大，可能破坏格式 |

**推荐方案：A + 保护机制**

将用户 Prompt 追加到 System Prompt 末尾，并添加明确的分隔标记，同时保留原有 JSON 输出格式约束。

```
[原始 System Prompt]

---
## 用户自定义指令（优先遵循）
[用户 presetPromptText]
---

请确保输出格式严格遵循上述 JSON 结构。
```

### 2.2 数据流设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API 层 (api.ts)                              │
├─────────────────────────────────────────────────────────────────────┤
│  1. 接收分析请求                                                      │
│  2. 调用 presetsService.getAllAnalysisConfigs(userId)               │
│  3. 提取 modelPreference → effectiveModelConfig                      │
│  4. 【新增】提取 promptText → effectivePromptConfig                   │
│  5. 传递两个配置到 Orchestrator                                       │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    Orchestrator 层 (orchestrator.ts)                 │
├─────────────────────────────────────────────────────────────────────┤
│  constructor 接收:                                                    │
│  - agentModelConfig: Record<AgentType, ModelPreference>             │
│  - 【新增】agentPromptConfig: Record<AgentType, string | null>       │
│                                                                      │
│  各 runXxxAgent 方法:                                                 │
│  - 获取静态 System Prompt: AGENT_PROMPTS.XXX                         │
│  - 【新增】合并用户 Prompt: mergePrompt(staticPrompt, userPrompt)    │
│  - 调用 vectorEngine.analyzeFinancialReport(mergedPrompt, ...)      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 接口变更

#### 2.3.1 OrchestratorConfig 扩展

```typescript
// /src/agents/orchestrator.ts

export interface OrchestratorConfig {
  vectorEngine: VectorEngineService;
  tushare: TushareService;
  cache?: KVNamespace;
  onProgress?: (progress: AnalysisProgress) => void;
  agentModelConfig?: AgentModelConfig;
  // 新增
  agentPromptConfig?: AgentPromptConfig;  // Agent 自定义 Prompt 配置
}

// 新增类型定义
export type AgentPromptConfig = Partial<Record<AgentType, string | null>>;
```

#### 2.3.2 Prompt 合并函数

```typescript
// /src/agents/orchestrator.ts

/**
 * 合并系统 Prompt 与用户自定义 Prompt
 * @param systemPrompt 原始系统 Prompt
 * @param userCustomPrompt 用户自定义 Prompt（可选）
 * @returns 合并后的 Prompt
 */
private mergeSystemPrompt(systemPrompt: string, userCustomPrompt?: string | null): string {
  if (!userCustomPrompt || userCustomPrompt.trim() === '') {
    return systemPrompt;
  }

  return `${systemPrompt}

---
## 用户自定义分析指令（请优先遵循以下要求）

${userCustomPrompt.trim()}

---

**重要提醒**：请确保输出格式严格遵循上述 JSON 结构要求。
`;
}
```

#### 2.3.3 API 层数据提取

```typescript
// /src/routes/api.ts - 第 440-464 行附近

// ============ Phase 1: 加载用户 Preset 配置 ============
let effectiveModelConfig: AgentModelConfig = body.agentModelConfig || {};
let effectivePromptConfig: AgentPromptConfig = {};  // 新增

if (db && userId) {
  try {
    const presetsService = createAgentPresetsService(db);
    const analysisConfigs = await presetsService.getAllAnalysisConfigs(
      userId,
      body.presetOverrides
    );
    
    for (const [agentType, config] of Object.entries(analysisConfigs)) {
      // 提取模型偏好
      if (config.modelPreference && !effectiveModelConfig[agentType]) {
        effectiveModelConfig[agentType] = config.modelPreference;
      }
      // 新增：提取自定义 Prompt
      if (config.promptText) {
        effectivePromptConfig[agentType] = config.promptText;
      }
    }
    
    console.log(`[Preset] Loaded ${Object.keys(effectivePromptConfig).length} custom prompts`);
  } catch (presetError) {
    console.error('[Preset] Failed to load user presets:', presetError);
  }
}

// 创建编排器
const orchestrator = createOrchestrator({
  vectorEngine,
  tushare,
  cache,
  agentModelConfig: effectiveModelConfig,
  agentPromptConfig: effectivePromptConfig,  // 新增
  onProgress: async (progress) => { /* ... */ },
});
```

### 2.4 各 Agent 调用改造

以 `runProfitabilityAgent` 为例：

**改造前**：
```typescript
const result = await this.vectorEngine.analyzeFinancialReport(
  AGENT_PROMPTS.PROFITABILITY,
  prompt,
  { model: this.getModelForAgent('PROFITABILITY') }
);
```

**改造后**：
```typescript
const mergedSystemPrompt = this.mergeSystemPrompt(
  AGENT_PROMPTS.PROFITABILITY,
  this.agentPromptConfig?.PROFITABILITY
);

const result = await this.vectorEngine.analyzeFinancialReport(
  mergedSystemPrompt,
  prompt,
  { model: this.getModelForAgent('PROFITABILITY') }
);
```

---

## 三、详细开发任务

### 3.1 任务分解

| 任务 ID | 任务名称 | 预计工时 | 依赖 | 优先级 |
|---------|----------|----------|------|--------|
| T1 | 定义 AgentPromptConfig 类型 | 0.5h | - | P0 |
| T2 | 实现 mergeSystemPrompt 函数 | 1h | T1 | P0 |
| T3 | 扩展 OrchestratorConfig 接口 | 0.5h | T1 | P0 |
| T4 | 修改 Orchestrator 构造函数 | 0.5h | T3 | P0 |
| T5 | 改造 13 个 Agent 调用方法 | 3h | T2, T4 | P0 |
| T6 | 修改 API 层数据提取逻辑 | 1h | T3 | P0 |
| T7 | 添加日志和监控 | 0.5h | T5, T6 | P1 |
| T8 | 编写单元测试 | 2h | T5 | P1 |
| T9 | 集成测试 | 1h | T6, T7 | P1 |
| T10 | 更新 API 文档 | 0.5h | T9 | P2 |

**总计预估工时**：10.5 小时（约 1.5 个工作日实现 + 0.5 天测试）

### 3.2 文件改动清单

| 文件路径 | 改动类型 | 改动内容 |
|----------|----------|----------|
| `/src/agents/orchestrator.ts` | 修改 | 新增类型、合并函数、改造 13 个 Agent 方法 |
| `/src/routes/api.ts` | 修改 | 提取 promptText 并传递 |
| `/src/types/index.ts` | 新增 | 导出 AgentPromptConfig 类型 |
| `/src/agents/orchestrator.test.ts` | 新增 | 单元测试 |

### 3.3 代码改动详情

#### 文件 1: `/src/agents/orchestrator.ts`

**新增代码**（约 50 行）：

```typescript
// 1. 新增类型定义（第 35 行附近）
import type { AgentType } from '../services/vectorengine';

export type AgentPromptConfig = Partial<Record<AgentType, string | null>>;

// 2. 扩展 OrchestratorConfig（第 38-45 行）
export interface OrchestratorConfig {
  vectorEngine: VectorEngineService;
  tushare: TushareService;
  cache?: KVNamespace;
  onProgress?: (progress: AnalysisProgress) => void;
  agentModelConfig?: AgentModelConfig;
  agentPromptConfig?: AgentPromptConfig;  // 新增
}

// 3. 构造函数新增属性（第 76 行附近）
private agentPromptConfig: AgentPromptConfig;

constructor(config: OrchestratorConfig) {
  // ... 原有代码 ...
  this.agentPromptConfig = config.agentPromptConfig || {};  // 新增
}

// 4. 新增合并函数（第 100 行附近）
/**
 * 合并系统 Prompt 与用户自定义 Prompt
 */
private mergeSystemPrompt(
  systemPrompt: string, 
  userCustomPrompt?: string | null
): string {
  if (!userCustomPrompt || userCustomPrompt.trim() === '') {
    return systemPrompt;
  }

  // 对用户输入进行基本清理
  const cleanedUserPrompt = userCustomPrompt
    .trim()
    .slice(0, 2000);  // 限制长度，防止注入过长内容

  return `${systemPrompt}

---
## 用户自定义分析指令（请优先遵循以下要求）

${cleanedUserPrompt}

---

**重要提醒**：请确保最终输出格式严格遵循上述 JSON 结构要求，不要遗漏任何必填字段。
`;
}
```

**改造各 Agent 方法**（每个方法约改动 3-5 行）：

```typescript
// 以 runProfitabilityAgent 为例
private async runProfitabilityAgent(data: FinancialData): Promise<ProfitabilityResult> {
  // ... 准备数据的代码保持不变 ...
  
  // 合并用户自定义 Prompt
  const mergedSystemPrompt = this.mergeSystemPrompt(
    AGENT_PROMPTS.PROFITABILITY,
    this.agentPromptConfig.PROFITABILITY
  );
  
  const result = await this.vectorEngine.analyzeFinancialReport(
    mergedSystemPrompt,  // 使用合并后的 Prompt
    prompt,
    { model: this.getModelForAgent('PROFITABILITY') }
  );
  
  // ... 后续代码保持不变 ...
}
```

#### 文件 2: `/src/routes/api.ts`

**改动代码**（约 15 行）：

```typescript
// 第 440-490 行附近
import type { AgentPromptConfig } from '../agents/orchestrator';

// ============ Phase 1: 加载用户 Preset 配置 ============
let effectiveModelConfig: AgentModelConfig = body.agentModelConfig || {};
let effectivePromptConfig: AgentPromptConfig = {};  // 新增

if (db && userId) {
  try {
    const presetsService = createAgentPresetsService(db);
    const analysisConfigs = await presetsService.getAllAnalysisConfigs(
      userId,
      body.presetOverrides
    );
    
    for (const [agentType, config] of Object.entries(analysisConfigs)) {
      // 提取模型偏好
      if (config.modelPreference && !effectiveModelConfig[agentType]) {
        (effectiveModelConfig as any)[agentType] = config.modelPreference;
      }
      // 新增：提取自定义 Prompt
      if (config.promptText) {
        (effectivePromptConfig as any)[agentType] = config.promptText;
      }
    }
    
    console.log(`[Preset] Loaded configs: ${Object.keys(effectiveModelConfig).length} models, ${Object.keys(effectivePromptConfig).length} prompts`);
  } catch (presetError) {
    console.error('[Preset] Failed to load user presets:', presetError);
  }
}

// 创建编排器
const orchestrator = createOrchestrator({
  vectorEngine,
  tushare,
  cache,
  agentModelConfig: effectiveModelConfig,
  agentPromptConfig: effectivePromptConfig,  // 新增
  onProgress: async (progress) => { /* ... */ },
});
```

---

## 四、排期计划

### 4.1 开发排期

| 阶段 | 日期 | 任务 | 交付物 |
|------|------|------|--------|
| **Day 1** | 2026-01-13 | T1-T4: 基础架构 | 类型定义、合并函数、接口扩展 |
| **Day 2** | 2026-01-14 | T5: Agent 改造 | 13 个 Agent 方法改造完成 |
| **Day 3** | 2026-01-15 | T6-T7: API 集成 | API 层集成、日志监控 |
| **Day 3** | 2026-01-15 | T8-T9: 测试 | 单元测试 + 集成测试 |
| **Day 4** | 2026-01-16 | T10 + 上线 | 文档更新、部署上线 |

### 4.2 风险评估

| 风险项 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 用户 Prompt 注入攻击 | 中 | 高 | 限制长度、清理特殊字符、添加格式保护 |
| 合并后 Prompt 过长 | 低 | 中 | 设置最大长度限制（2000 字符） |
| JSON 输出格式破坏 | 中 | 高 | 末尾追加格式强调、保留原有校验逻辑 |
| 性能影响 | 低 | 低 | Prompt 合并为内存操作，影响可忽略 |

### 4.3 上线检查清单

- [ ] 所有 13 个 Agent 方法已改造
- [ ] API 层正确提取和传递 promptText
- [ ] 合并函数包含长度限制（2000 字符）
- [ ] 合并函数包含格式保护声明
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过（至少测试 3 个 Agent）
- [ ] 日志记录用户自定义 Prompt 使用情况
- [ ] 错误处理：promptText 为空时回退到原始 Prompt
- [ ] 文档更新完成

---

## 五、测试用例

### 5.1 单元测试

```typescript
// /src/agents/orchestrator.test.ts

describe('mergeSystemPrompt', () => {
  const orchestrator = new AnalysisOrchestrator({ /* mock config */ });
  
  test('should return original prompt when userPrompt is null', () => {
    const result = orchestrator['mergeSystemPrompt']('Original prompt', null);
    expect(result).toBe('Original prompt');
  });
  
  test('should return original prompt when userPrompt is empty', () => {
    const result = orchestrator['mergeSystemPrompt']('Original prompt', '  ');
    expect(result).toBe('Original prompt');
  });
  
  test('should merge prompts correctly', () => {
    const result = orchestrator['mergeSystemPrompt'](
      'Original prompt',
      '请特别关注现金流'
    );
    expect(result).toContain('Original prompt');
    expect(result).toContain('用户自定义分析指令');
    expect(result).toContain('请特别关注现金流');
    expect(result).toContain('JSON 结构要求');
  });
  
  test('should truncate long user prompts', () => {
    const longPrompt = 'A'.repeat(3000);
    const result = orchestrator['mergeSystemPrompt']('Original', longPrompt);
    // 验证用户 Prompt 被截断到 2000 字符
    expect(result.length).toBeLessThan(2500);
  });
});
```

### 5.2 集成测试

```typescript
// /src/routes/api.test.ts

describe('Preset Prompt Injection', () => {
  test('should use user preset prompt in analysis', async () => {
    // 1. 创建用户 Preset
    await presetsService.createPreset(userId, {
      agentType: 'PROFITABILITY',
      presetName: 'Test Preset',
      presetPromptText: '请特别关注毛利率变化趋势',
    });
    
    // 2. 设置为默认 Preset
    await presetsService.updateSettings(userId, 'PROFITABILITY', {
      defaultPresetId: presetId,
    });
    
    // 3. 发起分析请求
    const response = await api.post('/analyze/start', {
      companyCode: '600519.SH',
      reportType: 'quarterly',
    });
    
    // 4. 验证分析结果包含相关内容
    // (实际验证需要检查 AI 输出是否关注了毛利率)
    expect(response.status).toBe(200);
  });
});
```

---

## 六、后续优化建议

### 6.1 短期优化（1-2 周）

1. **Prompt 模板系统**：提供预置的 Prompt 模板供用户选择
2. **Prompt 历史版本**：记录用户 Prompt 的历史修改
3. **效果预览**：在设置页面提供 Prompt 效果预览

### 6.2 中期优化（1-2 月）

1. **Prompt 市场**：用户可分享和发现优质 Prompt
2. **A/B 测试**：支持同时运行多个 Prompt 版本对比效果
3. **智能推荐**：根据分析结果自动优化 Prompt

### 6.3 长期优化（3-6 月）

1. **Prompt 评分系统**：基于分析质量反馈自动评估 Prompt 效果
2. **自动化 Prompt 优化**：使用 AI 自动改进 Prompt
3. **多语言支持**：支持英文等多语言 Prompt

---

## 七、附录

### 7.1 相关代码文件

| 文件 | 职责 |
|------|------|
| `/src/agents/orchestrator.ts` | Agent 编排和执行 |
| `/src/agents/prompts.ts` | 静态 System Prompt 定义 |
| `/src/services/agentPresets.ts` | Preset 数据服务 |
| `/src/routes/api.ts` | API 路由和请求处理 |
| `/src/services/vectorengine.ts` | LLM 调用封装 |

### 7.2 数据库表结构

```sql
-- agent_presets 表
CREATE TABLE agent_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_type TEXT NOT NULL,
  preset_name TEXT NOT NULL,
  preset_config_json TEXT,
  preset_prompt_text TEXT,  -- 用户自定义 Prompt
  model_preference TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

**文档结束**

*如有疑问，请联系开发团队。*
