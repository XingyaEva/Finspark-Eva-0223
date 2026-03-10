// 会员方案服务
// 提供会员方案查询、状态管理、权益检查等功能

import type { MembershipTier } from './user';

// ============ 类型定义 ============

export interface MembershipPlan {
  id: number;
  code: string;
  name: string;
  tier: MembershipTier;
  duration_months: number;
  original_price_cents: number;
  current_price_cents: number;
  currency: string;
  features: string[];
  highlight: string | null;
  is_recommended: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface MembershipOrder {
  id: number;
  user_id: number;
  order_no: string;
  plan_code: string;
  plan_name: string;
  tier: MembershipTier;
  duration_months: number;
  amount_cents: number;
  currency: string;
  payment_method: string | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id: string | null;
  payment_time: string | null;
  membership_start: string | null;
  membership_end: string | null;
  created_at: string;
}

export interface MembershipStatus {
  tier: MembershipTier;
  tierName: string;
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  usageToday: {
    analysis: number;
    pdfExport: number;
    aiComic: number;
  };
  limits: {
    analysis: number | null;
    pdfExport: number | null;
    aiComic: number | null;
    favorites: number | null;
  };
}

export interface FeatureLimit {
  feature: string;
  tier: MembershipTier;
  daily_limit: number | null;
  monthly_limit: number | null;
  is_enabled: boolean;
  description: string;
}

// ============ 常量定义 ============

export const TIER_NAMES: Record<MembershipTier, string> = {
  guest: '访客',
  free: '免费版',
  pro: 'Pro会员',
  elite: 'Elite会员',
};

export const TIER_COLORS: Record<MembershipTier, { bg: string; text: string; border: string }> = {
  guest: { bg: 'bg-gray-600', text: 'text-gray-300', border: 'border-gray-500' },
  free: { bg: 'bg-blue-600', text: 'text-blue-300', border: 'border-blue-500' },
  pro: { bg: 'bg-purple-600', text: 'text-purple-300', border: 'border-purple-500' },
  elite: { bg: 'bg-yellow-600', text: 'text-yellow-300', border: 'border-yellow-500' },
};

// ============ 会员服务类 ============

export class MembershipService {
  private db: D1Database;
  private cache: KVNamespace;
  
  constructor(db: D1Database, cache: KVNamespace) {
    this.db = db;
    this.cache = cache;
  }
  
  // ==================== 方案管理 ====================
  
  /**
   * 获取所有激活的会员方案
   */
  async getActivePlans(): Promise<MembershipPlan[]> {
    // 尝试从缓存获取
    const cacheKey = 'membership:plans:active';
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    
    const result = await this.db.prepare(`
      SELECT * FROM membership_plans 
      WHERE is_active = 1 
      ORDER BY sort_order ASC
    `).all<any>();
    
    const plans: MembershipPlan[] = (result.results || []).map(row => ({
      ...row,
      features: JSON.parse(row.features || '[]'),
      is_recommended: !!row.is_recommended,
      is_active: !!row.is_active,
    }));
    
    // 缓存1小时
    await this.cache.put(cacheKey, JSON.stringify(plans), { expirationTtl: 3600 });
    
    return plans;
  }
  
  /**
   * 根据代码获取方案
   */
  async getPlanByCode(code: string): Promise<MembershipPlan | null> {
    const result = await this.db.prepare(`
      SELECT * FROM membership_plans WHERE code = ?
    `).bind(code).first<any>();
    
    if (!result) return null;
    
    return {
      ...result,
      features: JSON.parse(result.features || '[]'),
      is_recommended: !!result.is_recommended,
      is_active: !!result.is_active,
    };
  }
  
  /**
   * 按等级获取方案
   */
  async getPlansByTier(tier: MembershipTier): Promise<MembershipPlan[]> {
    const result = await this.db.prepare(`
      SELECT * FROM membership_plans 
      WHERE tier = ? AND is_active = 1
      ORDER BY sort_order ASC
    `).bind(tier).all<any>();
    
    return (result.results || []).map(row => ({
      ...row,
      features: JSON.parse(row.features || '[]'),
      is_recommended: !!row.is_recommended,
      is_active: !!row.is_active,
    }));
  }
  
  // ==================== 会员状态 ====================
  
  /**
   * 获取用户会员状态
   */
  async getMembershipStatus(userId: number): Promise<MembershipStatus> {
    // 获取用户信息
    const user = await this.db.prepare(`
      SELECT membership_tier, membership_expires_at, daily_analysis_count, daily_analysis_date
      FROM users WHERE id = ?
    `).bind(userId).first<any>();
    
    if (!user) {
      return this.getGuestStatus();
    }
    
    const tier = this.getEffectiveTier(user.membership_tier, user.membership_expires_at);
    const expiresAt = user.membership_expires_at;
    
    // 计算剩余天数
    let daysRemaining: number | null = null;
    if (expiresAt && (tier === 'pro' || tier === 'elite')) {
      const expDate = new Date(expiresAt);
      const now = new Date();
      daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) daysRemaining = 0;
    }
    
    // 获取今日使用量
    const today = new Date().toISOString().split('T')[0];
    const usageResult = await this.db.prepare(`
      SELECT feature, usage_count FROM membership_usage_logs
      WHERE user_id = ? AND usage_date = ?
    `).bind(userId, today).all<any>();
    
    const usageMap: Record<string, number> = {};
    (usageResult.results || []).forEach(row => {
      usageMap[row.feature] = row.usage_count;
    });
    
    // 获取限额配置
    const limits = await this.getFeatureLimits(tier);
    
    return {
      tier,
      tierName: TIER_NAMES[tier],
      isActive: tier !== 'guest' && tier !== 'free',
      expiresAt,
      daysRemaining,
      usageToday: {
        analysis: user.daily_analysis_date === today ? user.daily_analysis_count : 0,
        pdfExport: usageMap['pdf_export'] || 0,
        aiComic: usageMap['ai_comic'] || 0,
      },
      limits: {
        analysis: limits.find(l => l.feature === 'analysis')?.daily_limit ?? null,
        pdfExport: limits.find(l => l.feature === 'pdf_export')?.daily_limit ?? null,
        aiComic: limits.find(l => l.feature === 'ai_comic')?.daily_limit ?? null,
        favorites: limits.find(l => l.feature === 'favorite')?.daily_limit ?? null,
      },
    };
  }
  
  /**
   * 获取访客状态
   */
  private getGuestStatus(): MembershipStatus {
    return {
      tier: 'guest',
      tierName: TIER_NAMES.guest,
      isActive: false,
      expiresAt: null,
      daysRemaining: null,
      usageToday: { analysis: 0, pdfExport: 0, aiComic: 0 },
      limits: { analysis: 3, pdfExport: 0, aiComic: 0, favorites: 0 },
    };
  }
  
  /**
   * 获取有效会员等级（考虑过期）
   */
  private getEffectiveTier(tier: MembershipTier | null, expiresAt: string | null): MembershipTier {
    if (!tier) return 'free';
    if (tier === 'guest' || tier === 'free') return tier;
    
    // 检查是否过期
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (expDate < new Date()) {
        return 'free'; // 会员过期降为免费
      }
    }
    
    return tier;
  }
  
  // ==================== 功能限额 ====================
  
  /**
   * 获取等级的功能限额配置
   */
  async getFeatureLimits(tier: MembershipTier): Promise<FeatureLimit[]> {
    const result = await this.db.prepare(`
      SELECT * FROM feature_limits WHERE tier = ?
    `).bind(tier).all<any>();
    
    return (result.results || []).map(row => ({
      ...row,
      is_enabled: !!row.is_enabled,
    }));
  }
  
  /**
   * 检查功能是否可用
   */
  async checkFeatureAvailable(userId: number, feature: string): Promise<{
    available: boolean;
    reason?: string;
    remaining?: number;
    limit?: number;
  }> {
    const status = await this.getMembershipStatus(userId);
    const limits = await this.getFeatureLimits(status.tier);
    const featureLimit = limits.find(l => l.feature === feature);
    
    if (!featureLimit || !featureLimit.is_enabled) {
      return {
        available: false,
        reason: `${TIER_NAMES[status.tier]}不支持此功能`,
      };
    }
    
    if (featureLimit.daily_limit === null) {
      return { available: true }; // 无限制
    }
    
    // 获取今日使用量
    const today = new Date().toISOString().split('T')[0];
    const usage = await this.db.prepare(`
      SELECT usage_count FROM membership_usage_logs
      WHERE user_id = ? AND feature = ? AND usage_date = ?
    `).bind(userId, feature, today).first<any>();
    
    const usedCount = usage?.usage_count || 0;
    const remaining = featureLimit.daily_limit - usedCount;
    
    if (remaining <= 0) {
      return {
        available: false,
        reason: '今日使用次数已达上限',
        remaining: 0,
        limit: featureLimit.daily_limit,
      };
    }
    
    return {
      available: true,
      remaining,
      limit: featureLimit.daily_limit,
    };
  }
  
  /**
   * 记录功能使用
   */
  async recordFeatureUsage(userId: number, feature: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await this.db.prepare(`
      INSERT INTO membership_usage_logs (user_id, feature, usage_date, usage_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id, feature, usage_date) 
      DO UPDATE SET usage_count = usage_count + 1, updated_at = datetime('now')
    `).bind(userId, feature, today).run();
  }
  
  // ==================== 订单管理 ====================
  
  /**
   * 获取用户订单历史
   */
  async getUserOrders(userId: number, options?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ orders: MembershipOrder[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (options?.status) {
      whereClause += ' AND payment_status = ?';
      params.push(options.status);
    }
    
    // 获取总数
    const countResult = await this.db.prepare(`
      SELECT COUNT(*) as count FROM membership_orders ${whereClause}
    `).bind(...params).first<any>();
    
    // 获取订单列表
    const result = await this.db.prepare(`
      SELECT * FROM membership_orders ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<any>();
    
    return {
      orders: result.results || [],
      total: countResult?.count || 0,
    };
  }
  
  /**
   * 创建订单（支付集成后使用）
   */
  async createOrder(userId: number, planCode: string): Promise<MembershipOrder | null> {
    const plan = await this.getPlanByCode(planCode);
    if (!plan || !plan.is_active) {
      return null;
    }
    
    // 生成订单号
    const orderNo = `MEM${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    await this.db.prepare(`
      INSERT INTO membership_orders (
        user_id, order_no, plan_code, plan_name, tier, duration_months,
        amount_cents, currency, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      userId, orderNo, plan.code, plan.name, plan.tier,
      plan.duration_months, plan.current_price_cents, plan.currency
    ).run();
    
    // 返回创建的订单
    const order = await this.db.prepare(`
      SELECT * FROM membership_orders WHERE order_no = ?
    `).bind(orderNo).first<MembershipOrder>();
    
    return order;
  }
  
  /**
   * 激活会员（手动或支付回调后调用）
   */
  async activateMembership(userId: number, orderId: number): Promise<boolean> {
    try {
      // 获取订单
      const order = await this.db.prepare(`
        SELECT * FROM membership_orders WHERE id = ? AND user_id = ?
      `).bind(orderId, userId).first<any>();
      
      if (!order || order.payment_status !== 'paid') {
        return false;
      }
      
      // 计算会员期限
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + order.duration_months);
      
      // 更新用户会员信息
      await this.db.prepare(`
        UPDATE users SET
          membership_tier = ?,
          membership_expires_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(order.tier, end.toISOString(), userId).run();
      
      // 更新订单
      await this.db.prepare(`
        UPDATE membership_orders SET
          membership_start = ?,
          membership_end = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(now.toISOString(), end.toISOString(), orderId).run();
      
      // 清除缓存
      await this.cache.delete(`user:permissions:${userId}`);
      
      return true;
    } catch (error) {
      console.error('Activate membership error:', error);
      return false;
    }
  }
  
  // ==================== 方案对比 ====================
  
  /**
   * 获取方案对比数据（用于前端展示）
   */
  async getPlansComparison(): Promise<{
    tiers: Array<{
      tier: MembershipTier;
      name: string;
      description: string;
      features: Array<{
        name: string;
        guest: string | boolean;
        free: string | boolean;
        pro: string | boolean;
        elite: string | boolean;
      }>;
    }>;
    plans: MembershipPlan[];
  }> {
    const plans = await this.getActivePlans();
    
    // 功能对比表
    const features = [
      { name: '每日分析次数', guest: '3次', free: '10次', pro: '50次', elite: '无限制' },
      { name: '完整分析报告', guest: false, free: true, pro: true, elite: true },
      { name: 'AI漫画解读', guest: false, free: false, pro: true, elite: true },
      { name: '专业风险评估', guest: false, free: false, pro: true, elite: true },
      { name: '行业对比分析', guest: false, free: false, pro: true, elite: true },
      { name: 'PDF导出', guest: false, free: '有水印', pro: '无水印', elite: '无水印' },
      { name: '收藏数量', guest: '0', free: '100', pro: '500', elite: '1000' },
      { name: '历史记录', guest: false, free: true, pro: true, elite: true },
      { name: '批量分析', guest: false, free: false, pro: false, elite: true },
      { name: 'API访问', guest: false, free: false, pro: false, elite: true },
      { name: '优先客服支持', guest: false, free: false, pro: false, elite: true },
    ];
    
    return {
      tiers: [
        { tier: 'free', name: '免费版', description: '基础财报分析功能', features },
        { tier: 'pro', name: 'Pro会员', description: '专业分析工具套件', features },
        { tier: 'elite', name: 'Elite会员', description: '企业级全功能套件', features },
      ],
      plans,
    };
  }
}

// ============ 工厂函数 ============

export function createMembershipService(db: D1Database, cache: KVNamespace): MembershipService {
  return new MembershipService(db, cache);
}
