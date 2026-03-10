/**
 * Agent Preset API 路由
 * 
 * 提供用户 Preset 管理、Agent 设置、官方 Preset 查询等接口
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { 
  createAgentPresetsService,
  type CreatePresetInput,
  type UpdatePresetInput,
  type UpdateAgentSettingsInput,
} from '../services/agentPresets';
import { 
  OFFICIAL_PRESETS, 
  AGENT_CONFIG_SCHEMAS,
  getActiveAgentTypes,
  getAgentsByLevel,
} from '../data/defaultPresets';
import type { Bindings } from '../types';
import type { AgentType, ModelPreference } from '../services/vectorengine';

// ============================================
// 类型定义
// ============================================

type Variables = {
  user: {
    id: number;
    email: string;
    name: string | null;
    tier: 'guest' | 'free' | 'pro' | 'elite';
  } | null;
};

const agentPresets = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================
// 中间件
// ============================================

// 检查数据库可用性
const requireDB = async (c: any, next: any) => {
  if (!c.env.DB) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  await next();
};

// ============================================
// Preset CRUD 路由
// ============================================

/**
 * GET /api/agent-presets
 * 获取用户所有 Preset
 */
agentPresets.get('/', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const agentType = c.req.query('agentType') as AgentType | undefined;
  const service = createAgentPresetsService(c.env.DB);
  
  const presets = await service.getUserPresets(user.id, agentType);
  
  return c.json({
    success: true,
    presets,
    count: presets.length,
  });
});

/**
 * GET /api/agent-presets/:agentType
 * 获取指定 Agent 的 Preset 列表
 */
agentPresets.get('/:agentType', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const agentType = c.req.param('agentType') as AgentType;
  
  // 验证 Agent 类型
  if (!OFFICIAL_PRESETS[agentType]) {
    return c.json({ success: false, error: '无效的 Agent 类型' }, 400);
  }

  const service = createAgentPresetsService(c.env.DB);
  const presets = await service.getUserPresets(user.id, agentType);
  const permission = service.checkPermission(agentType, user.tier);
  const official = OFFICIAL_PRESETS[agentType];
  const schema = AGENT_CONFIG_SCHEMAS[agentType];

  return c.json({
    success: true,
    agentType,
    presets,
    permission,
    official,
    schema,
  });
});

/**
 * POST /api/agent-presets
 * 创建新 Preset
 */
agentPresets.post('/', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const body = await c.req.json<CreatePresetInput>();
  
  // 验证必填字段
  if (!body.agentType || !body.presetName) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }

  // 验证 Agent 类型
  if (!OFFICIAL_PRESETS[body.agentType]) {
    return c.json({ success: false, error: '无效的 Agent 类型' }, 400);
  }

  const service = createAgentPresetsService(c.env.DB);

  // 检查权限
  const canCreate = await service.canCreatePreset(user.id, body.agentType, user.tier);
  if (!canCreate.allowed) {
    return c.json({ success: false, error: canCreate.reason }, 403);
  }

  // 检查是否允许自定义 Prompt
  const permission = service.checkPermission(body.agentType, user.tier);
  if (body.presetPromptText && !permission.canEditPrompt) {
    return c.json({ success: false, error: '当前会员等级无法自定义 Prompt' }, 403);
  }

  // 检查是否允许修改模型
  if (body.modelPreference && !permission.canChangeModel) {
    return c.json({ success: false, error: '当前会员等级无法修改模型偏好' }, 403);
  }

  try {
    const preset = await service.createPreset(user.id, body);
    return c.json({
      success: true,
      preset,
      message: 'Preset 创建成功',
    });
  } catch (error) {
    console.error('Create preset error:', error);
    return c.json({ success: false, error: '创建失败' }, 500);
  }
});

/**
 * PATCH /api/agent-presets/:id
 * 更新 Preset
 */
agentPresets.patch('/:id', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const presetId = parseInt(c.req.param('id'));
  if (isNaN(presetId)) {
    return c.json({ success: false, error: '无效的 Preset ID' }, 400);
  }

  const body = await c.req.json<UpdatePresetInput>();
  const service = createAgentPresetsService(c.env.DB);

  // 获取现有 Preset 以检查权限
  const existing = await service.getPreset(presetId);
  if (!existing) {
    return c.json({ success: false, error: 'Preset 不存在' }, 404);
  }

  if (existing.userId !== user.id) {
    return c.json({ success: false, error: '无权限修改此 Preset' }, 403);
  }

  // 检查权限
  const permission = service.checkPermission(existing.agentType, user.tier);
  if (!permission.canConfigure) {
    return c.json({ success: false, error: '当前会员等级无法配置此 Agent' }, 403);
  }

  if (body.presetPromptText !== undefined && !permission.canEditPrompt) {
    return c.json({ success: false, error: '当前会员等级无法自定义 Prompt' }, 403);
  }

  if (body.modelPreference !== undefined && !permission.canChangeModel) {
    return c.json({ success: false, error: '当前会员等级无法修改模型偏好' }, 403);
  }

  try {
    const preset = await service.updatePreset(presetId, user.id, body);
    return c.json({
      success: true,
      preset,
      message: 'Preset 更新成功',
    });
  } catch (error) {
    console.error('Update preset error:', error);
    return c.json({ success: false, error: '更新失败' }, 500);
  }
});

/**
 * DELETE /api/agent-presets/:id
 * 删除 Preset
 */
agentPresets.delete('/:id', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const presetId = parseInt(c.req.param('id'));
  if (isNaN(presetId)) {
    return c.json({ success: false, error: '无效的 Preset ID' }, 400);
  }

  const service = createAgentPresetsService(c.env.DB);

  try {
    const deleted = await service.deletePreset(presetId, user.id);
    if (!deleted) {
      return c.json({ success: false, error: 'Preset 不存在或无权限删除' }, 404);
    }

    return c.json({
      success: true,
      message: 'Preset 删除成功',
    });
  } catch (error) {
    console.error('Delete preset error:', error);
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});

/**
 * POST /api/agent-presets/:id/set-default
 * 设为默认 Preset
 */
agentPresets.post('/:id/set-default', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const presetId = parseInt(c.req.param('id'));
  if (isNaN(presetId)) {
    return c.json({ success: false, error: '无效的 Preset ID' }, 400);
  }

  const service = createAgentPresetsService(c.env.DB);

  try {
    const success = await service.setAsDefault(presetId, user.id);
    if (!success) {
      return c.json({ success: false, error: 'Preset 不存在或无权限' }, 404);
    }

    return c.json({
      success: true,
      message: '已设为默认 Preset',
    });
  } catch (error) {
    console.error('Set default error:', error);
    return c.json({ success: false, error: '设置失败' }, 500);
  }
});

/**
 * POST /api/agent-presets/:id/duplicate
 * 复制 Preset
 */
agentPresets.post('/:id/duplicate', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const presetId = parseInt(c.req.param('id'));
  if (isNaN(presetId)) {
    return c.json({ success: false, error: '无效的 Preset ID' }, 400);
  }

  const body = await c.req.json<{ newName: string }>();
  if (!body.newName) {
    return c.json({ success: false, error: '请提供新名称' }, 400);
  }

  const service = createAgentPresetsService(c.env.DB);

  // 获取原 Preset 检查权限
  const existing = await service.getPreset(presetId);
  if (!existing) {
    return c.json({ success: false, error: 'Preset 不存在' }, 404);
  }

  // 检查是否可以创建新 Preset
  const canCreate = await service.canCreatePreset(user.id, existing.agentType, user.tier);
  if (!canCreate.allowed) {
    return c.json({ success: false, error: canCreate.reason }, 403);
  }

  try {
    const preset = await service.duplicatePreset(presetId, user.id, body.newName);
    if (!preset) {
      return c.json({ success: false, error: '复制失败' }, 500);
    }

    return c.json({
      success: true,
      preset,
      message: 'Preset 复制成功',
    });
  } catch (error) {
    console.error('Duplicate preset error:', error);
    return c.json({ success: false, error: '复制失败' }, 500);
  }
});

// ============================================
// Agent Settings 路由
// ============================================

/**
 * GET /api/agent-settings
 * 获取用户所有 Agent 设置
 */
agentPresets.get('/settings/all', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const service = createAgentPresetsService(c.env.DB);
  const settings = await service.getAgentSettings(user.id);

  return c.json({
    success: true,
    settings,
  });
});

/**
 * GET /api/agent-settings/:agentType
 * 获取指定 Agent 的设置
 */
agentPresets.get('/settings/:agentType', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const agentType = c.req.param('agentType') as AgentType;
  
  if (!OFFICIAL_PRESETS[agentType]) {
    return c.json({ success: false, error: '无效的 Agent 类型' }, 400);
  }

  const service = createAgentPresetsService(c.env.DB);
  const settings = await service.getSingleAgentSettings(user.id, agentType);
  const permission = service.checkPermission(agentType, user.tier);

  return c.json({
    success: true,
    settings,
    permission,
  });
});

/**
 * PATCH /api/agent-settings/:agentType
 * 更新指定 Agent 的设置
 */
agentPresets.patch('/settings/:agentType', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }

  const agentType = c.req.param('agentType') as AgentType;
  
  if (!OFFICIAL_PRESETS[agentType]) {
    return c.json({ success: false, error: '无效的 Agent 类型' }, 400);
  }

  const body = await c.req.json<UpdateAgentSettingsInput>();
  const service = createAgentPresetsService(c.env.DB);

  // 检查权限
  const permission = service.checkPermission(agentType, user.tier);
  
  // 如果要修改模型偏好，检查权限
  if (body.modelPreference !== undefined && !permission.canChangeModel) {
    return c.json({ success: false, error: '当前会员等级无法修改模型偏好' }, 403);
  }

  try {
    const settings = await service.upsertAgentSettings(user.id, agentType, body);
    return c.json({
      success: true,
      settings,
      message: 'Agent 设置更新成功',
    });
  } catch (error) {
    console.error('Update agent settings error:', error);
    return c.json({ success: false, error: '更新失败' }, 500);
  }
});

// ============================================
// 官方 Preset 路由（只读）
// ============================================

/**
 * GET /api/agent-presets/official/list
 * 获取所有官方 Preset 列表
 */
agentPresets.get('/official/list', async (c) => {
  const activeAgents = getActiveAgentTypes();
  const presets = activeAgents.map(agentType => ({
    agentType,
    ...OFFICIAL_PRESETS[agentType],
  }));

  return c.json({
    success: true,
    presets,
    count: presets.length,
  });
});

/**
 * GET /api/agent-presets/official/:agentType
 * 获取指定 Agent 的官方 Preset
 */
agentPresets.get('/official/:agentType', async (c) => {
  const agentType = c.req.param('agentType') as AgentType;
  
  const preset = OFFICIAL_PRESETS[agentType];
  if (!preset) {
    return c.json({ success: false, error: '无效的 Agent 类型' }, 400);
  }

  const schema = AGENT_CONFIG_SCHEMAS[agentType];

  return c.json({
    success: true,
    preset,
    schema,
  });
});

/**
 * GET /api/agent-presets/schemas
 * 获取所有 Agent 的配置 Schema
 */
agentPresets.get('/schemas/all', async (c) => {
  return c.json({
    success: true,
    schemas: AGENT_CONFIG_SCHEMAS,
  });
});

/**
 * GET /api/agent-presets/levels
 * 按级别获取 Agent 列表
 */
agentPresets.get('/levels/all', async (c) => {
  return c.json({
    success: true,
    levels: {
      L0: getAgentsByLevel('L0'),
      L1: getAgentsByLevel('L1'),
      L2: getAgentsByLevel('L2'),
      L3: getAgentsByLevel('L3'),
    },
  });
});

// ============================================
// 分析配置获取（供 Orchestrator 使用）
// ============================================

/**
 * POST /api/agent-presets/analysis-config
 * 获取分析时的完整配置
 * 内部接口，供分析流程调用
 */
agentPresets.post('/analysis-config', authMiddleware(), requireDB, async (c) => {
  const user = c.get('user');
  
  const body = await c.req.json<{
    presetOverrides?: Record<AgentType, { presetId?: number; modelPreference?: ModelPreference }>;
  }>();

  const service = createAgentPresetsService(c.env.DB);
  
  try {
    const configs = await service.getAllAnalysisConfigs(
      user?.id || null,
      body.presetOverrides
    );

    return c.json({
      success: true,
      configs,
    });
  } catch (error) {
    console.error('Get analysis config error:', error);
    return c.json({ success: false, error: '获取配置失败' }, 500);
  }
});

export default agentPresets;
