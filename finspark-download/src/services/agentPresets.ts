/**
 * Agent Preset 服务层
 * 
 * 提供用户 Preset 的 CRUD 操作、默认设置管理、使用统计等功能
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AgentType, ModelPreference } from './vectorengine';
import { 
  OFFICIAL_PRESETS, 
  getOfficialPreset, 
  canConfigureAgent,
  type OfficialPreset,
  type L1ConfigSchema,
} from '../data/defaultPresets';

// ============================================
// 类型定义
// ============================================

/**
 * 用户 Preset 实体
 */
export interface AgentPreset {
  id: number;
  userId: number;
  agentType: AgentType;
  presetName: string;
  presetConfigJson: L1ConfigSchema | null;
  presetPromptText: string | null;
  modelPreference: ModelPreference | null;
  isDefault: boolean;
  useCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 用户 Agent 设置实体
 */
export interface AgentSettings {
  id: number;
  userId: number;
  agentType: AgentType;
  modelPreference: ModelPreference | null;
  defaultPresetId: number | null;
  autoLoadPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建 Preset 输入
 */
export interface CreatePresetInput {
  agentType: AgentType;
  presetName: string;
  presetConfigJson?: L1ConfigSchema;
  presetPromptText?: string;
  modelPreference?: ModelPreference;
  isDefault?: boolean;
}

/**
 * 更新 Preset 输入
 */
export interface UpdatePresetInput {
  presetName?: string;
  presetConfigJson?: L1ConfigSchema;
  presetPromptText?: string;
  modelPreference?: ModelPreference | null;
  isDefault?: boolean;
}

/**
 * 更新 Agent 设置输入
 */
export interface UpdateAgentSettingsInput {
  modelPreference?: ModelPreference | null;
  defaultPresetId?: number | null;
  autoLoadPreset?: boolean;
}

/**
 * 分析时的 Preset 配置（用于传递给 Orchestrator）
 */
export interface AnalysisPresetConfig {
  agentType: AgentType;
  configJson: L1ConfigSchema;
  promptText: string | null;
  modelPreference: ModelPreference;
  source: 'user_preset' | 'user_settings' | 'official_default';
}

// ============================================
// 数据库行类型
// ============================================

interface PresetRow {
  id: number;
  user_id: number;
  agent_type: string;
  preset_name: string;
  preset_config_json: string | null;
  preset_prompt_text: string | null;
  model_preference: string | null;
  is_default: number;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SettingsRow {
  id: number;
  user_id: number;
  agent_type: string;
  model_preference: string | null;
  default_preset_id: number | null;
  auto_load_preset: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// 服务实现
// ============================================

export class AgentPresetsService {
  constructor(private db: D1Database) {}

  // ==================== Preset CRUD ====================

  /**
   * 创建新 Preset
   */
  async createPreset(userId: number, input: CreatePresetInput): Promise<AgentPreset> {
    const configJson = input.presetConfigJson ? JSON.stringify(input.presetConfigJson) : null;
    
    // 如果设置为默认，先清除该 Agent 的其他默认 Preset
    if (input.isDefault) {
      await this.clearDefaultPreset(userId, input.agentType);
    }

    const result = await this.db.prepare(`
      INSERT INTO user_agent_presets (
        user_id, agent_type, preset_name, preset_config_json, 
        preset_prompt_text, model_preference, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      input.agentType,
      input.presetName,
      configJson,
      input.presetPromptText || null,
      input.modelPreference || null,
      input.isDefault ? 1 : 0
    ).run();

    const presetId = result.meta.last_row_id as number;
    return this.getPreset(presetId) as Promise<AgentPreset>;
  }

  /**
   * 获取单个 Preset
   */
  async getPreset(presetId: number): Promise<AgentPreset | null> {
    const row = await this.db.prepare(`
      SELECT * FROM user_agent_presets WHERE id = ?
    `).bind(presetId).first<PresetRow>();

    return row ? this.rowToPreset(row) : null;
  }

  /**
   * 获取用户的所有 Preset
   */
  async getUserPresets(userId: number, agentType?: AgentType): Promise<AgentPreset[]> {
    let query = 'SELECT * FROM user_agent_presets WHERE user_id = ?';
    const params: any[] = [userId];

    if (agentType) {
      query += ' AND agent_type = ?';
      params.push(agentType);
    }

    query += ' ORDER BY is_default DESC, use_count DESC, updated_at DESC';

    const result = await this.db.prepare(query).bind(...params).all<PresetRow>();
    return (result.results || []).map(row => this.rowToPreset(row));
  }

  /**
   * 更新 Preset
   */
  async updatePreset(presetId: number, userId: number, updates: UpdatePresetInput): Promise<AgentPreset | null> {
    // 验证 Preset 属于该用户
    const existing = await this.getPreset(presetId);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.presetName !== undefined) {
      setClauses.push('preset_name = ?');
      params.push(updates.presetName);
    }

    if (updates.presetConfigJson !== undefined) {
      setClauses.push('preset_config_json = ?');
      params.push(JSON.stringify(updates.presetConfigJson));
    }

    if (updates.presetPromptText !== undefined) {
      setClauses.push('preset_prompt_text = ?');
      params.push(updates.presetPromptText);
    }

    if (updates.modelPreference !== undefined) {
      setClauses.push('model_preference = ?');
      params.push(updates.modelPreference);
    }

    if (updates.isDefault !== undefined) {
      if (updates.isDefault) {
        // 先清除该 Agent 的其他默认 Preset
        await this.clearDefaultPreset(userId, existing.agentType);
      }
      setClauses.push('is_default = ?');
      params.push(updates.isDefault ? 1 : 0);
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(presetId);

    await this.db.prepare(`
      UPDATE user_agent_presets SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...params).run();

    return this.getPreset(presetId);
  }

  /**
   * 删除 Preset
   */
  async deletePreset(presetId: number, userId: number): Promise<boolean> {
    // 验证 Preset 属于该用户
    const existing = await this.getPreset(presetId);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    // 如果有 Agent Settings 引用此 Preset，清除引用
    await this.db.prepare(`
      UPDATE user_agent_settings SET default_preset_id = NULL 
      WHERE default_preset_id = ? AND user_id = ?
    `).bind(presetId, userId).run();

    await this.db.prepare(`
      DELETE FROM user_agent_presets WHERE id = ? AND user_id = ?
    `).bind(presetId, userId).run();

    return true;
  }

  /**
   * 复制 Preset
   */
  async duplicatePreset(presetId: number, userId: number, newName: string): Promise<AgentPreset | null> {
    const existing = await this.getPreset(presetId);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    return this.createPreset(userId, {
      agentType: existing.agentType,
      presetName: newName,
      presetConfigJson: existing.presetConfigJson || undefined,
      presetPromptText: existing.presetPromptText || undefined,
      modelPreference: existing.modelPreference || undefined,
      isDefault: false, // 复制的不设为默认
    });
  }

  // ==================== 默认 Preset 管理 ====================

  /**
   * 设置为默认 Preset
   */
  async setAsDefault(presetId: number, userId: number): Promise<boolean> {
    const existing = await this.getPreset(presetId);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    // 清除该 Agent 的其他默认
    await this.clearDefaultPreset(userId, existing.agentType);

    // 设置当前为默认
    await this.db.prepare(`
      UPDATE user_agent_presets SET is_default = 1 WHERE id = ?
    `).bind(presetId).run();

    // 同时更新 Agent Settings
    await this.upsertAgentSettings(userId, existing.agentType, {
      defaultPresetId: presetId,
    });

    return true;
  }

  /**
   * 获取用户指定 Agent 的默认 Preset
   */
  async getDefaultPreset(userId: number, agentType: AgentType): Promise<AgentPreset | null> {
    const row = await this.db.prepare(`
      SELECT * FROM user_agent_presets 
      WHERE user_id = ? AND agent_type = ? AND is_default = 1
    `).bind(userId, agentType).first<PresetRow>();

    return row ? this.rowToPreset(row) : null;
  }

  /**
   * 清除指定 Agent 的默认 Preset
   */
  private async clearDefaultPreset(userId: number, agentType: AgentType): Promise<void> {
    await this.db.prepare(`
      UPDATE user_agent_presets SET is_default = 0 
      WHERE user_id = ? AND agent_type = ?
    `).bind(userId, agentType).run();
  }

  // ==================== Agent Settings 管理 ====================

  /**
   * 获取用户的 Agent 设置
   */
  async getAgentSettings(userId: number, agentType?: AgentType): Promise<AgentSettings[]> {
    let query = 'SELECT * FROM user_agent_settings WHERE user_id = ?';
    const params: any[] = [userId];

    if (agentType) {
      query += ' AND agent_type = ?';
      params.push(agentType);
    }

    const result = await this.db.prepare(query).bind(...params).all<SettingsRow>();
    return (result.results || []).map(row => this.rowToSettings(row));
  }

  /**
   * 获取单个 Agent 的设置
   */
  async getSingleAgentSettings(userId: number, agentType: AgentType): Promise<AgentSettings | null> {
    const row = await this.db.prepare(`
      SELECT * FROM user_agent_settings WHERE user_id = ? AND agent_type = ?
    `).bind(userId, agentType).first<SettingsRow>();

    return row ? this.rowToSettings(row) : null;
  }

  /**
   * 更新 Agent 设置（不存在则创建）
   */
  async upsertAgentSettings(
    userId: number, 
    agentType: AgentType, 
    updates: UpdateAgentSettingsInput
  ): Promise<AgentSettings> {
    const existing = await this.getSingleAgentSettings(userId, agentType);

    if (existing) {
      // 更新
      const setClauses: string[] = [];
      const params: any[] = [];

      if (updates.modelPreference !== undefined) {
        setClauses.push('model_preference = ?');
        params.push(updates.modelPreference);
      }

      if (updates.defaultPresetId !== undefined) {
        setClauses.push('default_preset_id = ?');
        params.push(updates.defaultPresetId);
      }

      if (updates.autoLoadPreset !== undefined) {
        setClauses.push('auto_load_preset = ?');
        params.push(updates.autoLoadPreset ? 1 : 0);
      }

      if (setClauses.length > 0) {
        params.push(existing.id);
        await this.db.prepare(`
          UPDATE user_agent_settings SET ${setClauses.join(', ')} WHERE id = ?
        `).bind(...params).run();
      }

      return this.getSingleAgentSettings(userId, agentType) as Promise<AgentSettings>;
    } else {
      // 创建
      await this.db.prepare(`
        INSERT INTO user_agent_settings (user_id, agent_type, model_preference, default_preset_id, auto_load_preset)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        userId,
        agentType,
        updates.modelPreference || null,
        updates.defaultPresetId || null,
        updates.autoLoadPreset !== false ? 1 : 0
      ).run();

      return this.getSingleAgentSettings(userId, agentType) as Promise<AgentSettings>;
    }
  }

  // ==================== 使用统计 ====================

  /**
   * 记录 Preset 使用
   */
  async recordUsage(presetId: number): Promise<void> {
    await this.db.prepare(`
      UPDATE user_agent_presets 
      SET use_count = use_count + 1, last_used_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(presetId).run();
  }

  // ==================== 分析时获取配置 ====================

  /**
   * 获取分析时的完整配置
   * 优先级：用户 Preset (is_default) > 用户 AgentSettings > 官方默认
   */
  async getAnalysisConfig(
    userId: number | null,
    agentType: AgentType,
    presetOverride?: { presetId?: number; modelPreference?: ModelPreference }
  ): Promise<AnalysisPresetConfig> {
    const officialPreset = getOfficialPreset(agentType);
    
    // 默认配置
    const defaultConfig: AnalysisPresetConfig = {
      agentType,
      configJson: officialPreset?.presetConfigJson || {},
      promptText: null,
      modelPreference: officialPreset?.modelPreference || 'standard',
      source: 'official_default',
    };

    if (!userId) {
      return defaultConfig;
    }

    // 1. 检查是否有 presetOverride（单次分析临时覆盖）
    if (presetOverride?.presetId) {
      const preset = await this.getPreset(presetOverride.presetId);
      if (preset && preset.userId === userId) {
        await this.recordUsage(preset.id);
        return {
          agentType,
          configJson: preset.presetConfigJson || defaultConfig.configJson,
          promptText: preset.presetPromptText,
          modelPreference: presetOverride.modelPreference || preset.modelPreference || defaultConfig.modelPreference,
          source: 'user_preset',
        };
      }
    }

    // 2. 检查用户默认 Preset
    const defaultPreset = await this.getDefaultPreset(userId, agentType);
    if (defaultPreset) {
      await this.recordUsage(defaultPreset.id);
      return {
        agentType,
        configJson: defaultPreset.presetConfigJson || defaultConfig.configJson,
        promptText: defaultPreset.presetPromptText,
        modelPreference: presetOverride?.modelPreference || defaultPreset.modelPreference || defaultConfig.modelPreference,
        source: 'user_preset',
      };
    }

    // 3. 检查用户 Agent Settings（单独的模型偏好设置）
    const settings = await this.getSingleAgentSettings(userId, agentType);
    if (settings?.modelPreference || presetOverride?.modelPreference) {
      return {
        agentType,
        configJson: defaultConfig.configJson,
        promptText: null,
        modelPreference: presetOverride?.modelPreference || settings?.modelPreference || defaultConfig.modelPreference,
        source: 'user_settings',
      };
    }

    // 4. 返回官方默认
    return defaultConfig;
  }

  /**
   * 批量获取所有 Agent 的分析配置
   */
  async getAllAnalysisConfigs(
    userId: number | null,
    presetOverrides?: Record<AgentType, { presetId?: number; modelPreference?: ModelPreference }>
  ): Promise<Record<AgentType, AnalysisPresetConfig>> {
    const agentTypes: AgentType[] = [
      'PLANNING', 'PROFITABILITY', 'BALANCE_SHEET', 'CASH_FLOW',
      'EARNINGS_QUALITY', 'TREND_INTERPRETATION', 'RISK', 'BUSINESS_INSIGHT',
      'BUSINESS_MODEL', 'INDUSTRY_COMPARISON', 'FORECAST', 'VALUATION', 'FINAL_CONCLUSION',
    ];

    const configs: Record<string, AnalysisPresetConfig> = {};
    
    for (const agentType of agentTypes) {
      configs[agentType] = await this.getAnalysisConfig(
        userId,
        agentType,
        presetOverrides?.[agentType]
      );
    }

    return configs as Record<AgentType, AnalysisPresetConfig>;
  }

  // ==================== 官方 Preset 查询 ====================

  /**
   * 获取所有官方 Preset
   */
  getOfficialPresets(): Record<AgentType, OfficialPreset> {
    return OFFICIAL_PRESETS;
  }

  /**
   * 获取单个官方 Preset
   */
  getOfficialPreset(agentType: AgentType): OfficialPreset | undefined {
    return getOfficialPreset(agentType);
  }

  // ==================== 权限检查 ====================

  /**
   * 检查用户是否可以创建/编辑指定 Agent 的 Preset
   */
  checkPermission(
    agentType: AgentType,
    userTier: 'guest' | 'free' | 'pro' | 'elite'
  ): { canConfigure: boolean; canEditPrompt: boolean; canChangeModel: boolean } {
    return canConfigureAgent(agentType, userTier);
  }

  /**
   * 获取用户的 Preset 数量限制
   */
  getPresetLimit(userTier: 'guest' | 'free' | 'pro' | 'elite'): number {
    switch (userTier) {
      case 'guest':
      case 'free':
        return 0;
      case 'pro':
        return 10; // 每个 Agent 10 个
      case 'elite':
        return 999; // 实际无限制
      default:
        return 0;
    }
  }

  /**
   * 检查用户是否可以创建新 Preset
   */
  async canCreatePreset(
    userId: number,
    agentType: AgentType,
    userTier: 'guest' | 'free' | 'pro' | 'elite'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const permission = this.checkPermission(agentType, userTier);
    if (!permission.canConfigure) {
      return { allowed: false, reason: '当前会员等级无法配置此 Agent' };
    }

    const limit = this.getPresetLimit(userTier);
    if (limit === 0) {
      return { allowed: false, reason: '当前会员等级无法创建 Preset' };
    }

    const existingPresets = await this.getUserPresets(userId, agentType);
    if (existingPresets.length >= limit) {
      return { allowed: false, reason: `已达到 Preset 数量上限 (${limit})` };
    }

    return { allowed: true };
  }

  // ==================== 私有方法 ====================

  private rowToPreset(row: PresetRow): AgentPreset {
    return {
      id: row.id,
      userId: row.user_id,
      agentType: row.agent_type as AgentType,
      presetName: row.preset_name,
      presetConfigJson: row.preset_config_json ? JSON.parse(row.preset_config_json) : null,
      presetPromptText: row.preset_prompt_text,
      modelPreference: row.model_preference as ModelPreference | null,
      isDefault: row.is_default === 1,
      useCount: row.use_count,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToSettings(row: SettingsRow): AgentSettings {
    return {
      id: row.id,
      userId: row.user_id,
      agentType: row.agent_type as AgentType,
      modelPreference: row.model_preference as ModelPreference | null,
      defaultPresetId: row.default_preset_id,
      autoLoadPreset: row.auto_load_preset === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ============================================
// 工厂函数
// ============================================

export function createAgentPresetsService(db: D1Database): AgentPresetsService {
  return new AgentPresetsService(db);
}
