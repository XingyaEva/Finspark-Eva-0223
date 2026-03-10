// 用户服务 - 完整的用户体系管理
// 支持访客/Free/Pro/Elite四类身份，次数限制，收藏，历史等功能

import type { Bindings } from '../types';

// ============ 类型定义 ============

export type MembershipTier = 'guest' | 'free' | 'pro' | 'elite';

export interface User {
  id: number;
  email: string;
  name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  avatar_type: 'default' | 'upload' | 'wechat' | 'alipay';
  phone: string | null;
  membership_tier: MembershipTier;
  membership_expires_at: string | null;
  daily_analysis_count: number;
  daily_analysis_date: string | null;
  total_analysis_count: number;
  last_login_at: string | null;
  login_count: number;
  is_verified: number;
  created_at: string;
  updated_at: string;
}

export interface GuestSession {
  id: number;
  fingerprint: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  analysis_count: number;
  last_analysis_at: string | null;
  first_visit_at: string;
  last_visit_at: string;
  converted_to_user_id: number | null;
  converted_at: string | null;
}

export interface UserPermissions {
  tier: MembershipTier;
  tierName: string;
  canAnalyze: boolean;
  remainingAnalysis: number | null;  // null = unlimited
  maxDailyAnalysis: number | null;
  canFavorite: boolean;
  canViewHistory: boolean;
  canExportPdf: boolean;
  canExportPdfWithoutWatermark: boolean;
  canViewFullReport: boolean;
  canViewAiComic: boolean;
  canViewRiskAssessment: boolean;
  canViewIndustryComparison: boolean;
  upgradePrompt: string | null;
}

export interface FavoriteGroup {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_default: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: number;
  user_id: number;
  favorite_type: 'stock' | 'report';
  stock_code: string;
  stock_name: string;
  report_id: number | null;
  group_id: number | null;
  notes: string | null;
  tags: string[] | null;
  is_pinned: number;
  sort_order: number;
  last_viewed_at: string | null;
  created_at: string;
}

// 收藏查询选项
export interface FavoriteQueryOptions {
  type?: 'stock' | 'report';
  groupId?: number;
  search?: string;
  sortBy?: 'created_at' | 'stock_name' | 'sort_order';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AnalysisHistory {
  id: number;
  company_code: string;
  company_name: string;
  report_type: string;
  report_period: string | null;
  status: string;
  health_score: number | null;
  key_conclusions: string | null;
  comic_status: string | null;
  view_count: number;
  created_at: string;
}

// 历史记录查询选项
export interface HistoryQueryOptions {
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
  startDate?: string;
  endDate?: string;
  reportType?: string;
  status?: string;
  search?: string;
  sortBy?: 'created_at' | 'company_name' | 'health_score' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// 历史记录查询结果
export interface HistoryQueryResult {
  history: AnalysisHistory[];
  total: number;
  filters: {
    reportTypes: string[];
    statuses: string[];
  };
}

// ============ 权限配置 ============

export const PERMISSION_LEVELS: Record<MembershipTier, number> = {
  guest: 0,
  free: 1,
  pro: 2,
  elite: 3,
};

export const TIER_NAMES: Record<MembershipTier, string> = {
  guest: '访客',
  free: '免费用户',
  pro: 'Pro会员',
  elite: 'Elite会员',
};

// 每日分析次数限制
export const DAILY_LIMITS: Record<MembershipTier, number | null> = {
  guest: 3,    // 访客3次
  free: 10,    // 免费用户10次/天
  pro: 50,     // Pro用户50次/天
  elite: null, // Elite无限制
};

// 功能权限矩阵
export const FEATURE_PERMISSIONS: Record<string, MembershipTier[]> = {
  basic_analysis: ['guest', 'free', 'pro', 'elite'],      // 基础分析
  full_report: ['free', 'pro', 'elite'],                  // 完整报告
  ai_comic: ['pro', 'elite'],                             // AI漫画
  risk_assessment: ['pro', 'elite'],                      // 风险评估
  industry_comparison: ['pro', 'elite'],                  // 行业对比
  pdf_export: ['free', 'pro', 'elite'],                   // PDF导出
  pdf_no_watermark: ['pro', 'elite'],                     // PDF无水印
  favorite: ['free', 'pro', 'elite'],                     // 收藏功能
  history: ['free', 'pro', 'elite'],                      // 历史记录
  batch_analysis: ['elite'],                              // 批量分析
  api_access: ['elite'],                                  // API访问
  
  // Phase 1: Agent Preset 权限
  preset_create: ['pro', 'elite'],                        // 创建自定义 Preset
  preset_l1_config: ['pro', 'elite'],                     // L1 参数化配置
  preset_l2_config: ['pro', 'elite'],                     // L2 模型偏好配置
  preset_l2_prompt: ['elite'],                            // L2 高级 Prompt 编辑
  preset_l3_config: ['elite'],                            // L3 Agent 完整配置
  model_preference: ['pro', 'elite'],                     // 修改模型偏好
};

// 升级提示消息
export const UPGRADE_PROMPTS: Record<MembershipTier, string | null> = {
  guest: '注册即可解锁完整报告、收藏和历史记录功能',
  free: '升级Pro会员，解锁AI漫画解读、风险评估等高级功能',
  pro: '升级Elite会员，享受无限分析、批量导出等专业功能',
  elite: null,
};

// ============ 用户服务类 ============

export class UserService {
  private db: D1Database;
  private cache: KVNamespace;
  
  constructor(db: D1Database, cache: KVNamespace) {
    this.db = db;
    this.cache = cache;
  }
  
  // ==================== 用户身份识别 ====================
  
  /**
   * 获取或创建访客会话
   */
  async getOrCreateGuestSession(fingerprint: string, ipAddress?: string, userAgent?: string): Promise<GuestSession> {
    // 尝试获取现有会话
    let session = await this.db.prepare(
      'SELECT * FROM guest_sessions WHERE fingerprint = ?'
    ).bind(fingerprint).first<GuestSession>();
    
    if (session) {
      // 更新最后访问时间
      await this.db.prepare(
        'UPDATE guest_sessions SET last_visit_at = datetime("now"), ip_address = ?, user_agent = ? WHERE id = ?'
      ).bind(ipAddress || null, userAgent || null, session.id).run();
      return session;
    }
    
    // 创建新会话
    const deviceType = this.detectDeviceType(userAgent || '');
    const result = await this.db.prepare(`
      INSERT INTO guest_sessions (fingerprint, ip_address, user_agent, device_type, analysis_count)
      VALUES (?, ?, ?, ?, 0)
    `).bind(fingerprint, ipAddress || null, userAgent || null, deviceType).run();
    
    session = await this.db.prepare(
      'SELECT * FROM guest_sessions WHERE id = ?'
    ).bind(result.meta.last_row_id).first<GuestSession>();
    
    return session!;
  }
  
  /**
   * 检测设备类型
   */
  private detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    const ua = userAgent.toLowerCase();
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
    if (/windows|macintosh|linux/i.test(ua)) return 'desktop';
    return 'unknown';
  }
  
  /**
   * 获取用户（通过ID）
   */
  async getUserById(userId: number): Promise<User | null> {
    return await this.db.prepare(`
      SELECT id, email, name, nickname, avatar_url, avatar_type, phone,
             membership_tier, membership_expires_at, daily_analysis_count,
             daily_analysis_date, total_analysis_count, last_login_at,
             login_count, is_verified, created_at, updated_at
      FROM users WHERE id = ?
    `).bind(userId).first<User>();
  }
  
  /**
   * 获取用户权限
   */
  async getUserPermissions(userId: number | null, guestFingerprint?: string): Promise<UserPermissions> {
    let tier: MembershipTier = 'guest';
    let remainingAnalysis: number | null = null;
    
    if (userId) {
      const user = await this.getUserById(userId);
      if (user) {
        tier = this.getEffectiveTier(user);
        remainingAnalysis = await this.getRemainingAnalysis(user);
      }
    } else if (guestFingerprint) {
      const session = await this.getOrCreateGuestSession(guestFingerprint);
      tier = 'guest';
      const limit = DAILY_LIMITS.guest!;
      remainingAnalysis = Math.max(0, limit - session.analysis_count);
    }
    
    const maxDaily = DAILY_LIMITS[tier];
    
    return {
      tier,
      tierName: TIER_NAMES[tier],
      canAnalyze: remainingAnalysis === null || remainingAnalysis > 0,
      remainingAnalysis,
      maxDailyAnalysis: maxDaily,
      canFavorite: this.hasPermission(tier, 'favorite'),
      canViewHistory: this.hasPermission(tier, 'history'),
      canExportPdf: this.hasPermission(tier, 'pdf_export'),
      canExportPdfWithoutWatermark: this.hasPermission(tier, 'pdf_no_watermark'),
      canViewFullReport: this.hasPermission(tier, 'full_report'),
      canViewAiComic: this.hasPermission(tier, 'ai_comic'),
      canViewRiskAssessment: this.hasPermission(tier, 'risk_assessment'),
      canViewIndustryComparison: this.hasPermission(tier, 'industry_comparison'),
      upgradePrompt: UPGRADE_PROMPTS[tier],
    };
  }
  
  /**
   * 获取用户的有效会员等级（考虑过期）
   */
  private getEffectiveTier(user: User): MembershipTier {
    const tier = user.membership_tier || 'free';
    
    // 检查会员是否过期
    if ((tier === 'pro' || tier === 'elite') && user.membership_expires_at) {
      const expiresAt = new Date(user.membership_expires_at);
      if (expiresAt < new Date()) {
        return 'free';  // 会员过期，降为免费用户
      }
    }
    
    return tier;
  }
  
  /**
   * 检查功能权限
   */
  hasPermission(tier: MembershipTier, feature: string): boolean {
    const allowedTiers = FEATURE_PERMISSIONS[feature];
    return allowedTiers ? allowedTiers.includes(tier) : false;
  }
  
  /**
   * 获取剩余分析次数
   */
  async getRemainingAnalysis(user: User): Promise<number | null> {
    const tier = this.getEffectiveTier(user);
    const limit = DAILY_LIMITS[tier];
    
    if (limit === null) return null;  // 无限制
    
    // 检查日期是否需要重置
    const today = new Date().toISOString().split('T')[0];
    if (user.daily_analysis_date !== today) {
      // 重置每日计数
      await this.db.prepare(
        'UPDATE users SET daily_analysis_count = 0, daily_analysis_date = ? WHERE id = ?'
      ).bind(today, user.id).run();
      return limit;
    }
    
    return Math.max(0, limit - user.daily_analysis_count);
  }
  
  // ==================== 分析次数管理 ====================
  
  /**
   * 消费一次分析次数
   */
  async consumeAnalysis(userId: number | null, guestFingerprint?: string): Promise<{ success: boolean; remaining: number | null; error?: string }> {
    if (userId) {
      return await this.consumeUserAnalysis(userId);
    } else if (guestFingerprint) {
      return await this.consumeGuestAnalysis(guestFingerprint);
    }
    return { success: false, remaining: 0, error: '无法识别用户身份' };
  }
  
  private async consumeUserAnalysis(userId: number): Promise<{ success: boolean; remaining: number | null; error?: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      return { success: false, remaining: 0, error: '用户不存在' };
    }
    
    const tier = this.getEffectiveTier(user);
    const limit = DAILY_LIMITS[tier];
    
    if (limit === null) {
      // Elite用户无限制，但仍记录总次数
      await this.db.prepare(
        'UPDATE users SET total_analysis_count = total_analysis_count + 1 WHERE id = ?'
      ).bind(userId).run();
      return { success: true, remaining: null };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const currentCount = user.daily_analysis_date === today ? user.daily_analysis_count : 0;
    
    if (currentCount >= limit) {
      return { 
        success: false, 
        remaining: 0, 
        error: tier === 'guest' 
          ? '注册即可获得更多分析次数' 
          : (tier === 'free' ? '升级Pro会员，解锁更多分析次数' : '今日分析次数已用完')
      };
    }
    
    await this.db.prepare(`
      UPDATE users SET 
        daily_analysis_count = ?,
        daily_analysis_date = ?,
        total_analysis_count = total_analysis_count + 1
      WHERE id = ?
    `).bind(currentCount + 1, today, userId).run();
    
    return { success: true, remaining: limit - currentCount - 1 };
  }
  
  private async consumeGuestAnalysis(fingerprint: string): Promise<{ success: boolean; remaining: number | null; error?: string }> {
    const session = await this.getOrCreateGuestSession(fingerprint);
    const limit = DAILY_LIMITS.guest!;
    
    if (session.analysis_count >= limit) {
      return { 
        success: false, 
        remaining: 0, 
        error: '注册即可获得更多分析次数，还能解锁收藏和历史记录功能'
      };
    }
    
    await this.db.prepare(`
      UPDATE guest_sessions SET 
        analysis_count = analysis_count + 1,
        last_analysis_at = datetime("now")
      WHERE id = ?
    `).bind(session.id).run();
    
    return { success: true, remaining: limit - session.analysis_count - 1 };
  }
  
  // ==================== 收藏管理 ====================
  
  /**
   * 添加收藏
   */
  async addFavorite(
    userId: number, 
    type: 'stock' | 'report',
    stockCode: string,
    stockName: string,
    reportId?: number,
    notes?: string
  ): Promise<{ success: boolean; favorite?: Favorite; error?: string }> {
    try {
      // 检查是否已收藏
      const existing = await this.db.prepare(
        'SELECT id FROM user_favorites WHERE user_id = ? AND stock_code = ? AND favorite_type = ?'
      ).bind(userId, stockCode, type).first();
      
      if (existing) {
        return { success: false, error: '已经收藏过了' };
      }
      
      // 检查收藏数量限制
      const count = await this.db.prepare(
        'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?'
      ).bind(userId).first<{ count: number }>();
      
      const user = await this.getUserById(userId);
      const tier = user ? this.getEffectiveTier(user) : 'free';
      const maxFavorites = tier === 'elite' ? 1000 : (tier === 'pro' ? 500 : 100);
      
      if (count && count.count >= maxFavorites) {
        return { success: false, error: `收藏数量已达上限(${maxFavorites})，升级会员可增加收藏数量` };
      }
      
      // 添加收藏
      const result = await this.db.prepare(`
        INSERT INTO user_favorites (user_id, favorite_type, stock_code, stock_name, report_id, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, type, stockCode, stockName, reportId || null, notes || null).run();
      
      const favorite = await this.db.prepare(
        'SELECT * FROM user_favorites WHERE id = ?'
      ).bind(result.meta.last_row_id).first<Favorite>();
      
      // 更新报告的收藏计数
      if (reportId) {
        await this.db.prepare(
          'UPDATE analysis_reports SET favorite_count = favorite_count + 1 WHERE id = ?'
        ).bind(reportId).run();
      }
      
      return { success: true, favorite: favorite! };
    } catch (error) {
      console.error('Add favorite error:', error);
      return { success: false, error: '收藏失败' };
    }
  }
  
  /**
   * 取消收藏
   */
  async removeFavorite(userId: number, favoriteId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const favorite = await this.db.prepare(
        'SELECT * FROM user_favorites WHERE id = ? AND user_id = ?'
      ).bind(favoriteId, userId).first<Favorite>();
      
      if (!favorite) {
        return { success: false, error: '收藏不存在' };
      }
      
      await this.db.prepare(
        'DELETE FROM user_favorites WHERE id = ?'
      ).bind(favoriteId).run();
      
      // 更新报告的收藏计数
      if (favorite.report_id) {
        await this.db.prepare(
          'UPDATE analysis_reports SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?'
        ).bind(favorite.report_id).run();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Remove favorite error:', error);
      return { success: false, error: '取消收藏失败' };
    }
  }
  
  /**
   * 获取用户收藏列表
   */
  async getFavorites(userId: number, options?: {
    type?: 'stock' | 'report';
    page?: number;
    limit?: number;
  }): Promise<{ favorites: Favorite[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE user_id = ?';
    const params: (number | string)[] = [userId];
    
    if (options?.type) {
      whereClause += ' AND favorite_type = ?';
      params.push(options.type);
    }
    
    // 获取总数
    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM user_favorites ${whereClause}`
    ).bind(...params).first<{ count: number }>();
    
    // 获取列表
    params.push(limit, offset);
    const favorites = await this.db.prepare(`
      SELECT * FROM user_favorites ${whereClause}
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params).all<Favorite>();
    
    return {
      favorites: favorites.results || [],
      total: countResult?.count || 0,
    };
  }
  
  /**
   * 获取收藏列表（增强版 - 支持分组、搜索、排序）
   */
  async getFavoritesEnhanced(userId: number, options?: FavoriteQueryOptions): Promise<{
    favorites: Favorite[];
    total: number;
    groups: FavoriteGroup[];
  }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = options?.sortBy || 'created_at';
    const sortOrder = options?.sortOrder || 'desc';
    
    let whereClause = 'WHERE user_id = ?';
    const params: (number | string)[] = [userId];
    
    if (options?.type) {
      whereClause += ' AND favorite_type = ?';
      params.push(options.type);
    }
    
    if (options?.groupId !== undefined) {
      if (options.groupId === 0) {
        whereClause += ' AND (group_id IS NULL OR group_id = 0)';
      } else {
        whereClause += ' AND group_id = ?';
        params.push(options.groupId);
      }
    }
    
    if (options?.search) {
      whereClause += ' AND (stock_code LIKE ? OR stock_name LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // 获取总数
    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM user_favorites ${whereClause}`
    ).bind(...params).first<{ count: number }>();
    
    // 构建排序子句
    let orderClause = 'ORDER BY is_pinned DESC, ';
    switch (sortBy) {
      case 'stock_name':
        orderClause += `stock_name ${sortOrder.toUpperCase()}`;
        break;
      case 'sort_order':
        orderClause += `sort_order ${sortOrder.toUpperCase()}, created_at DESC`;
        break;
      default:
        orderClause += `created_at ${sortOrder.toUpperCase()}`;
    }
    
    // 获取列表
    params.push(limit, offset);
    const favorites = await this.db.prepare(`
      SELECT * FROM user_favorites ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).bind(...params).all<Favorite>();
    
    // 获取分组列表
    const groups = await this.db.prepare(`
      SELECT * FROM favorite_groups WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC
    `).bind(userId).all<FavoriteGroup>();
    
    return {
      favorites: favorites.results || [],
      total: countResult?.count || 0,
      groups: groups.results || [],
    };
  }
  
  // ==================== 收藏分组管理 ====================
  
  /**
   * 创建收藏分组
   */
  async createFavoriteGroup(userId: number, data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<{ success: boolean; group?: FavoriteGroup; error?: string }> {
    try {
      // 检查分组名是否重复
      const existing = await this.db.prepare(
        'SELECT id FROM favorite_groups WHERE user_id = ? AND name = ?'
      ).bind(userId, data.name).first();
      
      if (existing) {
        return { success: false, error: '分组名称已存在' };
      }
      
      // 获取最大排序值
      const maxOrder = await this.db.prepare(
        'SELECT MAX(sort_order) as max_order FROM favorite_groups WHERE user_id = ?'
      ).bind(userId).first<{ max_order: number | null }>();
      
      const sortOrder = (maxOrder?.max_order || 0) + 1;
      
      const result = await this.db.prepare(`
        INSERT INTO favorite_groups (user_id, name, description, color, icon, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        data.name,
        data.description || null,
        data.color || '#d4af37',
        data.icon || 'folder',
        sortOrder
      ).run();
      
      const group = await this.db.prepare(
        'SELECT * FROM favorite_groups WHERE id = ?'
      ).bind(result.meta.last_row_id).first<FavoriteGroup>();
      
      return { success: true, group: group! };
    } catch (error) {
      console.error('Create favorite group error:', error);
      return { success: false, error: '创建分组失败' };
    }
  }
  
  /**
   * 更新收藏分组
   */
  async updateFavoriteGroup(userId: number, groupId: number, data: {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
  }): Promise<{ success: boolean; group?: FavoriteGroup; error?: string }> {
    try {
      // 检查分组是否存在
      const existing = await this.db.prepare(
        'SELECT * FROM favorite_groups WHERE id = ? AND user_id = ?'
      ).bind(groupId, userId).first<FavoriteGroup>();
      
      if (!existing) {
        return { success: false, error: '分组不存在' };
      }
      
      // 如果修改名称，检查是否重复
      if (data.name && data.name !== existing.name) {
        const duplicate = await this.db.prepare(
          'SELECT id FROM favorite_groups WHERE user_id = ? AND name = ? AND id != ?'
        ).bind(userId, data.name, groupId).first();
        
        if (duplicate) {
          return { success: false, error: '分组名称已存在' };
        }
      }
      
      const updates: string[] = [];
      const params: (string | number)[] = [];
      
      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }
      if (data.color !== undefined) {
        updates.push('color = ?');
        params.push(data.color);
      }
      if (data.icon !== undefined) {
        updates.push('icon = ?');
        params.push(data.icon);
      }
      
      if (updates.length === 0) {
        return { success: true, group: existing };
      }
      
      updates.push('updated_at = datetime("now")');
      params.push(groupId, userId);
      
      await this.db.prepare(`
        UPDATE favorite_groups SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
      `).bind(...params).run();
      
      const group = await this.db.prepare(
        'SELECT * FROM favorite_groups WHERE id = ?'
      ).bind(groupId).first<FavoriteGroup>();
      
      return { success: true, group: group! };
    } catch (error) {
      console.error('Update favorite group error:', error);
      return { success: false, error: '更新分组失败' };
    }
  }
  
  /**
   * 删除收藏分组
   */
  async deleteFavoriteGroup(userId: number, groupId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查分组是否存在
      const existing = await this.db.prepare(
        'SELECT * FROM favorite_groups WHERE id = ? AND user_id = ?'
      ).bind(groupId, userId).first<FavoriteGroup>();
      
      if (!existing) {
        return { success: false, error: '分组不存在' };
      }
      
      // 不能删除默认分组
      if (existing.is_default) {
        return { success: false, error: '不能删除默认分组' };
      }
      
      // 将该分组内的收藏移到未分组
      await this.db.prepare(
        'UPDATE user_favorites SET group_id = NULL WHERE group_id = ? AND user_id = ?'
      ).bind(groupId, userId).run();
      
      // 删除分组
      await this.db.prepare(
        'DELETE FROM favorite_groups WHERE id = ? AND user_id = ?'
      ).bind(groupId, userId).run();
      
      return { success: true };
    } catch (error) {
      console.error('Delete favorite group error:', error);
      return { success: false, error: '删除分组失败' };
    }
  }
  
  /**
   * 获取收藏分组列表
   */
  async getFavoriteGroups(userId: number): Promise<FavoriteGroup[]> {
    const result = await this.db.prepare(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM user_favorites WHERE group_id = g.id) as item_count
      FROM favorite_groups g 
      WHERE g.user_id = ? 
      ORDER BY g.sort_order ASC, g.created_at ASC
    `).bind(userId).all<FavoriteGroup>();
    
    return result.results || [];
  }
  
  /**
   * 移动收藏到分组
   */
  async moveFavoriteToGroup(userId: number, favoriteId: number, groupId: number | null): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查收藏是否存在
      const favorite = await this.db.prepare(
        'SELECT id FROM user_favorites WHERE id = ? AND user_id = ?'
      ).bind(favoriteId, userId).first();
      
      if (!favorite) {
        return { success: false, error: '收藏不存在' };
      }
      
      // 如果指定了分组，检查分组是否存在
      if (groupId) {
        const group = await this.db.prepare(
          'SELECT id FROM favorite_groups WHERE id = ? AND user_id = ?'
        ).bind(groupId, userId).first();
        
        if (!group) {
          return { success: false, error: '分组不存在' };
        }
      }
      
      await this.db.prepare(
        'UPDATE user_favorites SET group_id = ? WHERE id = ? AND user_id = ?'
      ).bind(groupId, favoriteId, userId).run();
      
      return { success: true };
    } catch (error) {
      console.error('Move favorite to group error:', error);
      return { success: false, error: '移动失败' };
    }
  }
  
  /**
   * 批量移动收藏到分组
   */
  async batchMoveFavoritesToGroup(userId: number, favoriteIds: number[], groupId: number | null): Promise<{ success: boolean; movedCount: number; error?: string }> {
    try {
      if (!favoriteIds || favoriteIds.length === 0) {
        return { success: false, movedCount: 0, error: '请选择要移动的收藏' };
      }
      
      // 如果指定了分组，检查分组是否存在
      if (groupId) {
        const group = await this.db.prepare(
          'SELECT id FROM favorite_groups WHERE id = ? AND user_id = ?'
        ).bind(groupId, userId).first();
        
        if (!group) {
          return { success: false, movedCount: 0, error: '分组不存在' };
        }
      }
      
      // 批量更新
      const placeholders = favoriteIds.map(() => '?').join(',');
      const result = await this.db.prepare(`
        UPDATE user_favorites SET group_id = ? 
        WHERE id IN (${placeholders}) AND user_id = ?
      `).bind(groupId, ...favoriteIds, userId).run();
      
      return { 
        success: true, 
        movedCount: result.meta.changes || 0 
      };
    } catch (error) {
      console.error('Batch move favorites error:', error);
      return { success: false, movedCount: 0, error: '批量移动失败' };
    }
  }
  
  /**
   * 检查是否已收藏
   */
  async isFavorited(userId: number, stockCode: string): Promise<boolean> {
    const result = await this.db.prepare(
      'SELECT id FROM user_favorites WHERE user_id = ? AND stock_code = ?'
    ).bind(userId, stockCode).first();
    return !!result;
  }
  
  // ==================== 历史记录管理 ====================
  
  /**
   * 获取用户分析历史（增强版 - 支持多维筛选）
   */
  async getAnalysisHistory(userId: number, options?: HistoryQueryOptions): Promise<HistoryQueryResult> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;
    
    // 构建 WHERE 条件
    const conditions: string[] = ['user_id = ?'];
    const params: (number | string)[] = [userId];
    
    // 软删除过滤
    if (!options?.includeDeleted) {
      conditions.push('(is_deleted = 0 OR is_deleted IS NULL)');
    }
    
    // 日期范围筛选
    if (options?.startDate) {
      conditions.push('created_at >= ?');
      params.push(options.startDate + ' 00:00:00');
    }
    if (options?.endDate) {
      conditions.push('created_at <= ?');
      params.push(options.endDate + ' 23:59:59');
    }
    
    // 报告类型筛选
    if (options?.reportType) {
      conditions.push('report_type = ?');
      params.push(options.reportType);
    }
    
    // 状态筛选
    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    
    // 搜索（公司名称或代码）
    if (options?.search) {
      conditions.push('(company_name LIKE ? OR company_code LIKE ?)');
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    const whereClause = 'WHERE ' + conditions.join(' AND ');
    
    // 排序处理
    const allowedSortFields = ['created_at', 'company_name', 'health_score', 'status'];
    const sortField = allowedSortFields.includes(options?.sortBy || '') 
      ? options!.sortBy 
      : 'created_at';
    const sortOrder = options?.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${sortField} ${sortOrder}`;
    
    // 查询总数
    const countResult = await this.db.prepare(
      `SELECT COUNT(*) as count FROM analysis_reports ${whereClause}`
    ).bind(...params).first<{ count: number }>();
    
    // 查询可用的筛选选项（供前端下拉框使用）
    const [reportTypesResult, statusesResult] = await Promise.all([
      this.db.prepare(`
        SELECT DISTINCT report_type FROM analysis_reports 
        WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND report_type IS NOT NULL
      `).bind(userId).all<{ report_type: string }>(),
      this.db.prepare(`
        SELECT DISTINCT status FROM analysis_reports 
        WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND status IS NOT NULL
      `).bind(userId).all<{ status: string }>(),
    ]);
    
    // 查询数据列表
    const listParams = [...params, limit, offset];
    const history = await this.db.prepare(`
      SELECT id, company_code, company_name, report_type, report_period,
             status, health_score, key_conclusions, comic_status, 
             view_count, created_at
      FROM analysis_reports 
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).bind(...listParams).all<AnalysisHistory>();
    
    return {
      history: history.results || [],
      total: countResult?.count || 0,
      filters: {
        reportTypes: reportTypesResult.results?.map(r => r.report_type).filter(Boolean) || [],
        statuses: statusesResult.results?.map(s => s.status).filter(Boolean) || [],
      },
    };
  }
  
  /**
   * 批量删除分析报告（软删除）
   */
  async batchDeleteAnalysisReports(userId: number, reportIds: number[]): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      if (!reportIds || reportIds.length === 0) {
        return { success: false, deletedCount: 0, error: '请选择要删除的记录' };
      }
      
      if (reportIds.length > 100) {
        return { success: false, deletedCount: 0, error: '单次最多删除 100 条记录' };
      }
      
      // 过滤无效 ID
      const validIds = reportIds.filter(id => Number.isInteger(id) && id > 0);
      if (validIds.length === 0) {
        return { success: false, deletedCount: 0, error: '无效的记录 ID' };
      }
      
      // 验证所有 ID 属于当前用户
      const placeholders = validIds.map(() => '?').join(',');
      const existingRecords = await this.db.prepare(`
        SELECT id FROM analysis_reports 
        WHERE id IN (${placeholders}) AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      `).bind(...validIds, userId).all<{ id: number }>();
      
      const ownedIds = existingRecords.results?.map(r => r.id) || [];
      
      if (ownedIds.length === 0) {
        return { success: false, deletedCount: 0, error: '没有可删除的记录' };
      }
      
      // 执行软删除
      const updatePlaceholders = ownedIds.map(() => '?').join(',');
      await this.db.prepare(`
        UPDATE analysis_reports 
        SET is_deleted = 1, deleted_at = datetime("now")
        WHERE id IN (${updatePlaceholders})
      `).bind(...ownedIds).run();
      
      return { success: true, deletedCount: ownedIds.length };
    } catch (error) {
      console.error('Batch delete error:', error);
      return { success: false, deletedCount: 0, error: '删除失败' };
    }
  }
  
  /**
   * 软删除分析报告
   */
  async deleteAnalysisReport(userId: number, reportId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.db.prepare(
        'UPDATE analysis_reports SET is_deleted = 1, deleted_at = datetime("now") WHERE id = ? AND user_id = ?'
      ).bind(reportId, userId).run();
      
      if (result.meta.changes === 0) {
        return { success: false, error: '报告不存在或无权删除' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Delete report error:', error);
      return { success: false, error: '删除失败' };
    }
  }
  
  // ==================== 用户资料管理 ====================
  
  /**
   * 更新用户资料
   */
  async updateProfile(userId: number, updates: {
    nickname?: string;
    name?: string;
    avatar_url?: string;
    phone?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const fields: string[] = [];
      const values: (string | null)[] = [];
      
      if (updates.nickname !== undefined) {
        fields.push('nickname = ?');
        values.push(updates.nickname || null);
      }
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name || null);
      }
      if (updates.avatar_url !== undefined) {
        fields.push('avatar_url = ?');
        values.push(updates.avatar_url || null);
      }
      if (updates.phone !== undefined) {
        fields.push('phone = ?');
        values.push(updates.phone || null);
      }
      
      if (fields.length === 0) {
        const user = await this.getUserById(userId);
        return { success: true, user: user || undefined };
      }
      
      fields.push('updated_at = datetime("now")');
      values.push(String(userId));
      
      await this.db.prepare(`
        UPDATE users SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values).run();
      
      const user = await this.getUserById(userId);
      return { success: true, user: user || undefined };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: '更新资料失败' };
    }
  }
  
  /**
   * 记录用户登录
   */
  async recordLogin(userId: number, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.db.prepare(`
      UPDATE users SET 
        last_login_at = datetime("now"),
        login_count = login_count + 1
      WHERE id = ?
    `).bind(userId).run();
    
    // 记录活动日志
    await this.logActivity(userId, null, 'login', undefined, { ip: ipAddress, ua: userAgent });
  }
  
  /**
   * 记录用户活动
   */
  async logActivity(
    userId: number | null,
    guestFingerprint: string | null,
    actionType: string,
    actionTarget?: string,
    actionDetail?: Record<string, any>
  ): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO user_activity_logs (user_id, guest_fingerprint, action_type, action_target, action_detail)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        userId,
        guestFingerprint,
        actionType,
        actionTarget || null,
        actionDetail ? JSON.stringify(actionDetail) : null
      ).run();
    } catch (error) {
      console.error('Log activity error:', error);
    }
  }
  
  // ==================== 访客转化 ====================
  
  /**
   * 将访客数据迁移到新注册用户
   * @returns 迁移结果，包括成功状态、迁移的报告数量和消息
   */
  async migrateGuestToUser(sessionId: string, userId: number): Promise<{
    success: boolean;
    migratedReports: number;
    migratedLogs: number;
    message: string;
  }> {
    try {
      // 检查是否已经迁移过（防重复迁移）
      const existingSession = await this.db.prepare(`
        SELECT converted_to_user_id FROM guest_sessions WHERE fingerprint = ?
      `).bind(sessionId).first<{ converted_to_user_id: number | null }>();
      
      if (existingSession?.converted_to_user_id) {
        return {
          success: false,
          migratedReports: 0,
          migratedLogs: 0,
          message: '访客数据已迁移到其他账户'
        };
      }
      
      // 统计待迁移的报告数量
      const reportCount = await this.db.prepare(`
        SELECT COUNT(*) as count FROM analysis_reports 
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(sessionId).first<{ count: number }>();
      
      const reportsToMigrate = reportCount?.count || 0;
      
      // 统计待迁移的行为日志数量
      const logCount = await this.db.prepare(`
        SELECT COUNT(*) as count FROM user_activity_logs 
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(sessionId).first<{ count: number }>();
      
      const logsToMigrate = logCount?.count || 0;
      
      // 更新访客会话
      await this.db.prepare(`
        UPDATE guest_sessions SET 
          converted_to_user_id = ?,
          converted_at = datetime("now")
        WHERE fingerprint = ?
      `).bind(userId, sessionId).run();
      
      // 将访客的分析报告关联到用户
      const reportResult = await this.db.prepare(`
        UPDATE analysis_reports SET user_id = ?
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(userId, sessionId).run();
      
      // 将访客的行为日志关联到用户
      const logResult = await this.db.prepare(`
        UPDATE user_activity_logs SET user_id = ?
        WHERE guest_fingerprint = ? AND user_id IS NULL
      `).bind(userId, sessionId).run();
      
      // 记录转化活动
      await this.logActivity(userId, sessionId, 'guest_converted', 'migration', JSON.stringify({
        migratedReports: reportsToMigrate,
        migratedLogs: logsToMigrate
      }));
      
      const messages = [];
      if (reportsToMigrate > 0) {
        messages.push(`${reportsToMigrate}份分析报告`);
      }
      if (logsToMigrate > 0) {
        messages.push(`${logsToMigrate}条浏览记录`);
      }
      
      return {
        success: true,
        migratedReports: reportsToMigrate,
        migratedLogs: logsToMigrate,
        message: messages.length > 0 
          ? `已成功迁移: ${messages.join('、')}` 
          : '没有需要迁移的数据'
      };
    } catch (error) {
      console.error('Migrate guest error:', error);
      return {
        success: false,
        migratedReports: 0,
        migratedLogs: 0,
        message: '数据迁移失败，请稍后重试'
      };
    }
  }
}

// ============ 创建服务实例 ============

export function createUserService(db: D1Database, cache: KVNamespace): UserService {
  return new UserService(db, cache);
}
