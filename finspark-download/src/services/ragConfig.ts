/**
 * 配置管理服务 — services/ragConfig.ts
 *
 * 核心职责：
 * 1. 模型配置 CRUD（Embedding/LLM Provider + API Key 管理 + 连接测试）
 * 2. Prompt 模板 CRUD + 版本管理（更新 Prompt 自动创建新版本）
 * 3. 系统全局配置 CRUD（RAG 参数 + 安全策略 + 存储管理）
 *
 * 关联页面: P.11 模型配置, P.12 Prompt 模板管理, P.13 系统配置
 */

// ==================== 类型定义 ====================

export interface ModelConfig {
  id: number;
  usage: string;
  provider: string;
  model_name: string;
  api_key_ref: string | null;
  base_url: string | null;
  extra_config: string;
  is_active: number;
  updated_at: string;
}

export interface PromptTemplate {
  id: number;
  template_key: string;
  display_name: string;
  description: string | null;
  usage_context: string | null;
  variables: string;
  current_version_id: number | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: number;
  template_id: number;
  version_label: string;
  content: string;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SystemConfig {
  id: number;
  config_key: string;
  config_value: string;
  config_type: string;
  description: string | null;
  category: string;
  updated_at: string;
}

// ==================== Service 实现 ====================

export class ConfigService {
  constructor(
    private db: D1Database,
    private envKeys: Record<string, string> = {}   // env variable name → actual key value mapping
  ) {}

  // ============================================================
  // 模型配置
  // ============================================================

  async listModelConfigs(): Promise<ModelConfig[]> {
    try {
      const rows = await this.db.prepare(
        'SELECT * FROM rag_model_configs ORDER BY usage ASC'
      ).all();
      return (rows.results || []) as unknown as ModelConfig[];
    } catch {
      return [];
    }
  }

  async getModelConfig(usage: string): Promise<ModelConfig | null> {
    try {
      const row = await this.db.prepare(
        'SELECT * FROM rag_model_configs WHERE usage = ? AND is_active = 1'
      ).bind(usage).first();
      return row as unknown as ModelConfig | null;
    } catch {
      return null;
    }
  }

  async updateModelConfig(usage: string, data: {
    provider?: string;
    modelName?: string;
    apiKeyRef?: string;
    baseUrl?: string;
    extraConfig?: Record<string, unknown>;
  }): Promise<ModelConfig> {
    const updates: string[] = [];
    const binds: unknown[] = [];

    if (data.provider !== undefined) { updates.push('provider = ?'); binds.push(data.provider); }
    if (data.modelName !== undefined) { updates.push('model_name = ?'); binds.push(data.modelName); }
    if (data.apiKeyRef !== undefined) { updates.push('api_key_ref = ?'); binds.push(data.apiKeyRef); }
    if (data.baseUrl !== undefined) { updates.push('base_url = ?'); binds.push(data.baseUrl); }
    if (data.extraConfig !== undefined) { updates.push('extra_config = ?'); binds.push(JSON.stringify(data.extraConfig)); }
    updates.push("updated_at = datetime('now')");

    await this.db.prepare(
      `UPDATE rag_model_configs SET ${updates.join(', ')} WHERE usage = ?`
    ).bind(...binds, usage).run();

    const config = await this.getModelConfig(usage);
    if (!config) throw new Error(`Model config for ${usage} not found`);
    return config;
  }

  async testConnection(provider: string, baseUrl: string, apiKeyRef: string): Promise<{
    success: boolean;
    latencyMs: number;
    model?: string;
    error?: string;
  }> {
    const apiKey = this.envKeys[apiKeyRef] || apiKeyRef;
    const start = Date.now();

    try {
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return { success: false, latencyMs, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json() as any;
      const models = data.data?.map((m: any) => m.id).slice(0, 5) || [];

      return {
        success: true,
        latencyMs,
        model: models.join(', ') || provider,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: (error as Error).message,
      };
    }
  }

  // ============================================================
  // Prompt 模板管理
  // ============================================================

  async listPromptTemplates(): Promise<(PromptTemplate & { currentContent?: string })[]> {
    try {
      const rows = await this.db.prepare(
        `SELECT pt.*, pv.content as currentContent
         FROM rag_prompt_templates pt
         LEFT JOIN rag_prompt_versions pv ON pt.current_version_id = pv.id
         WHERE pt.is_active = 1
         ORDER BY pt.template_key ASC`
      ).all();
      return (rows.results || []) as unknown as (PromptTemplate & { currentContent?: string })[];
    } catch {
      return [];
    }
  }

  async getPromptTemplate(key: string): Promise<(PromptTemplate & { currentContent?: string; versions?: PromptVersion[] }) | null> {
    try {
      const row = await this.db.prepare(
        `SELECT pt.*, pv.content as currentContent
         FROM rag_prompt_templates pt
         LEFT JOIN rag_prompt_versions pv ON pt.current_version_id = pv.id
         WHERE pt.template_key = ?`
      ).bind(key).first();

      if (!row) return null;

      const template = row as unknown as (PromptTemplate & { currentContent?: string; versions?: PromptVersion[] });

      // Fetch version history
      const versionsRows = await this.db.prepare(
        'SELECT * FROM rag_prompt_versions WHERE template_id = ? ORDER BY id DESC LIMIT 20'
      ).bind(template.id).all();

      template.versions = (versionsRows.results || []) as unknown as PromptVersion[];

      return template;
    } catch {
      return null;
    }
  }

  async updatePromptTemplate(key: string, data: {
    content: string;
    changeNote?: string;
    userId?: string;
  }): Promise<PromptTemplate & { currentContent?: string }> {
    const template = await this.db.prepare(
      'SELECT * FROM rag_prompt_templates WHERE template_key = ?'
    ).bind(key).first();

    if (!template) throw new Error(`Prompt template ${key} not found`);

    // Count existing versions to generate label
    const countResult = await this.db.prepare(
      'SELECT COUNT(*) as cnt FROM rag_prompt_versions WHERE template_id = ?'
    ).bind(template.id).first();
    const versionNum = ((countResult?.cnt as number) || 0) + 1;
    const versionLabel = `v${Math.floor(versionNum / 10) + 1}.${versionNum % 10}`;

    // Create new version
    const vResult = await this.db.prepare(
      `INSERT INTO rag_prompt_versions (template_id, version_label, content, change_note, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(template.id, versionLabel, data.content, data.changeNote || null, data.userId || null).run();

    const newVersionId = vResult.meta?.last_row_id;

    // Update template's current version
    await this.db.prepare(
      "UPDATE rag_prompt_templates SET current_version_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(newVersionId, template.id).run();

    return (await this.getPromptTemplate(key))!;
  }

  async getPromptContent(key: string): Promise<string | null> {
    try {
      const row = await this.db.prepare(
        `SELECT pv.content
         FROM rag_prompt_templates pt
         JOIN rag_prompt_versions pv ON pt.current_version_id = pv.id
         WHERE pt.template_key = ? AND pt.is_active = 1`
      ).bind(key).first();
      return (row?.content as string) || null;
    } catch {
      return null;
    }
  }

  async getPromptVersions(key: string): Promise<PromptVersion[]> {
    try {
      const template = await this.db.prepare(
        'SELECT id FROM rag_prompt_templates WHERE template_key = ?'
      ).bind(key).first();
      if (!template) return [];

      const rows = await this.db.prepare(
        'SELECT * FROM rag_prompt_versions WHERE template_id = ? ORDER BY id DESC'
      ).bind(template.id).all();
      return (rows.results || []) as unknown as PromptVersion[];
    } catch {
      return [];
    }
  }

  async revertPromptVersion(key: string, versionId: number): Promise<void> {
    const template = await this.db.prepare(
      'SELECT id FROM rag_prompt_templates WHERE template_key = ?'
    ).bind(key).first();
    if (!template) throw new Error(`Prompt template ${key} not found`);

    await this.db.prepare(
      "UPDATE rag_prompt_templates SET current_version_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(versionId, template.id).run();
  }

  // ============================================================
  // 系统配置
  // ============================================================

  async listSystemConfigs(category?: string): Promise<SystemConfig[]> {
    try {
      if (category) {
        const rows = await this.db.prepare(
          'SELECT * FROM rag_system_configs WHERE category = ? ORDER BY config_key ASC'
        ).bind(category).all();
        return (rows.results || []) as unknown as SystemConfig[];
      }
      const rows = await this.db.prepare(
        'SELECT * FROM rag_system_configs ORDER BY category ASC, config_key ASC'
      ).all();
      return (rows.results || []) as unknown as SystemConfig[];
    } catch {
      return [];
    }
  }

  async getSystemConfig(key: string): Promise<string | null> {
    try {
      const row = await this.db.prepare(
        'SELECT config_value FROM rag_system_configs WHERE config_key = ?'
      ).bind(key).first();
      return (row?.config_value as string) || null;
    } catch {
      return null;
    }
  }

  async getSystemConfigTyped<T = string>(key: string, defaultValue: T): Promise<T> {
    const raw = await this.getSystemConfig(key);
    if (raw === null) return defaultValue;

    const meta = await this.db.prepare(
      'SELECT config_type FROM rag_system_configs WHERE config_key = ?'
    ).bind(key).first();

    const type = (meta?.config_type as string) || 'string';

    try {
      switch (type) {
        case 'number': return parseFloat(raw) as unknown as T;
        case 'boolean': return (raw === 'true') as unknown as T;
        case 'json': return JSON.parse(raw) as T;
        default: return raw as unknown as T;
      }
    } catch {
      return defaultValue;
    }
  }

  async setSystemConfig(key: string, value: string): Promise<void> {
    await this.db.prepare(
      `INSERT INTO rag_system_configs (config_key, config_value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(config_key)
       DO UPDATE SET config_value = ?, updated_at = datetime('now')`
    ).bind(key, value, value).run();
  }

  async setSystemConfigs(configs: Record<string, string>): Promise<number> {
    let updated = 0;
    for (const [key, value] of Object.entries(configs)) {
      try {
        await this.setSystemConfig(key, value);
        updated++;
      } catch (e) {
        console.error(`[Config] Failed to set ${key}:`, e);
      }
    }
    return updated;
  }

  // ============================================================
  // 存储统计
  // ============================================================

  async getStorageStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalConversations: number;
    totalMessageLogs: number;
    totalTestSets: number;
    totalEvaluations: number;
  }> {
    const safeCount = async (table: string): Promise<number> => {
      try {
        const r = await this.db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
        return (r?.cnt as number) || 0;
      } catch { return 0; }
    };

    const [totalDocuments, totalChunks, totalConversations, totalMessageLogs, totalTestSets, totalEvaluations] = await Promise.all([
      safeCount('rag_documents'),
      safeCount('rag_chunks'),
      safeCount('rag_conversations'),
      safeCount('rag_message_logs'),
      safeCount('rag_test_sets'),
      safeCount('rag_evaluations'),
    ]);

    return { totalDocuments, totalChunks, totalConversations, totalMessageLogs, totalTestSets, totalEvaluations };
  }
}

// ==================== 工厂函数 ====================

export function createConfigService(
  db: D1Database,
  envKeys?: Record<string, string>
): ConfigService {
  return new ConfigService(db, envKeys || {});
}
