// 认证与权限中间件
// 用于保护API路由，验证用户身份和权限

import { Context, Next } from 'hono';
import { createAuthService, type TokenValidationResult, type JWTPayload } from '../services/auth';
import { createUserService, type UserPermissions, type MembershipTier, FEATURE_PERMISSIONS } from '../services/user';
import type { Bindings } from '../types';

// 扩展Context类型，添加用户信息
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthenticatedUser | null;
    guestFingerprint: string | null;
    permissions: UserPermissions;
  }
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string | null;
  tier: MembershipTier;
  isGuest: false;
}

export interface GuestUser {
  id: null;
  fingerprint: string;
  tier: 'guest';
  isGuest: true;
}

export type CurrentUser = AuthenticatedUser | GuestUser;

// ==================== 认证中间件 ====================

/**
 * 可选认证中间件
 * 尝试验证用户身份，但不强制要求登录
 * 适用于所有路由，用于识别用户身份
 */
export function optionalAuth() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const db = c.env.DB;
    const cache = c.env.CACHE;
    const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-me';
    
    if (!db || !cache) {
      c.set('user', null);
      c.set('guestFingerprint', null);
      await next();
      return;
    }
    
    const authService = createAuthService(db, jwtSecret);
    const userService = createUserService(db, cache);
    
    // 尝试从 Authorization header 获取 token
    const authHeader = c.req.header('Authorization');
    let user: AuthenticatedUser | null = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const validation = await authService.validateToken(token);
      
      if (validation.valid && validation.payload) {
        const fullUser = await userService.getUserById(validation.payload.sub);
        if (fullUser) {
          user = {
            id: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            tier: fullUser.membership_tier || 'free',
            isGuest: false,
          };
        }
      }
    }
    
    // 获取访客指纹
    let guestFingerprint: string | null = null;
    if (!user) {
      guestFingerprint = c.req.header('X-Guest-Fingerprint') || c.req.query('fingerprint') || null;
    }
    
    // 获取权限
    const permissions = await userService.getUserPermissions(
      user?.id || null,
      guestFingerprint || undefined
    );
    
    c.set('user', user);
    c.set('guestFingerprint', guestFingerprint);
    c.set('permissions', permissions);
    
    await next();
  };
}

/**
 * 必须认证中间件
 * 要求用户必须登录，否则返回401
 */
export function requireAuth() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const db = c.env.DB;
    const cache = c.env.CACHE;
    const jwtSecret = c.env.JWT_SECRET || 'default-secret-change-me';
    
    if (!db || !cache) {
      return c.json({ success: false, error: '服务配置错误', needLogin: true }, 500);
    }
    
    const authService = createAuthService(db, jwtSecret);
    const userService = createUserService(db, cache);
    
    // 从 Authorization header 获取 token
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: '请先登录',
        needLogin: true,
        loginPrompt: '登录后即可使用此功能',
      }, 401);
    }
    
    const token = authHeader.substring(7);
    const validation = await authService.validateToken(token);
    
    if (!validation.valid || !validation.payload) {
      return c.json({
        success: false,
        error: validation.error || '登录已过期',
        needLogin: true,
        loginPrompt: '登录已过期，请重新登录',
      }, 401);
    }
    
    const fullUser = await userService.getUserById(validation.payload.sub);
    if (!fullUser) {
      return c.json({
        success: false,
        error: '用户不存在',
        needLogin: true,
      }, 401);
    }
    
    const user: AuthenticatedUser = {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      tier: fullUser.membership_tier || 'free',
      isGuest: false,
    };
    
    const permissions = await userService.getUserPermissions(user.id, undefined);
    
    c.set('user', user);
    c.set('guestFingerprint', null);
    c.set('permissions', permissions);
    
    await next();
  };
}

/**
 * 功能权限检查中间件
 * 检查用户是否有权使用特定功能
 */
export function requireFeature(feature: string) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const permissions = c.get('permissions');
    const user = c.get('user');
    
    if (!permissions) {
      return c.json({ success: false, error: '权限检查失败' }, 500);
    }
    
    const allowedTiers = FEATURE_PERMISSIONS[feature];
    if (!allowedTiers || !allowedTiers.includes(permissions.tier)) {
      // 生成友好的升级提示
      const upgradeMessages: Record<string, string> = {
        ai_comic: '升级Pro会员，解锁AI漫画解读功能',
        risk_assessment: '升级Pro会员，解锁专业风险评估',
        industry_comparison: '升级Pro会员，解锁行业对比分析',
        pdf_no_watermark: '升级Pro会员，导出无水印PDF',
        batch_analysis: '升级Elite会员，解锁批量分析功能',
        api_access: '升级Elite会员，获取API访问权限',
        favorite: '登录后即可使用收藏功能',
        history: '登录后即可查看分析历史',
      };
      
      const isGuest = permissions.tier === 'guest';
      
      return c.json({
        success: false,
        error: '需要升级才能使用此功能',
        needUpgrade: true,
        needLogin: isGuest,
        currentTier: permissions.tier,
        requiredTiers: allowedTiers,
        upgradePrompt: upgradeMessages[feature] || permissions.upgradePrompt,
      }, 403);
    }
    
    await next();
  };
}

/**
 * 分析次数检查中间件
 * 检查用户是否还有剩余分析次数
 */
export function requireAnalysisQuota() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const permissions = c.get('permissions');
    const user = c.get('user');
    const guestFingerprint = c.get('guestFingerprint');
    
    if (!permissions) {
      return c.json({ success: false, error: '权限检查失败' }, 500);
    }
    
    if (!permissions.canAnalyze) {
      const isGuest = permissions.tier === 'guest';
      const isFree = permissions.tier === 'free';
      
      return c.json({
        success: false,
        error: '今日分析次数已用完',
        needUpgrade: true,
        needLogin: isGuest,
        currentTier: permissions.tier,
        remainingAnalysis: 0,
        maxDailyAnalysis: permissions.maxDailyAnalysis,
        upgradePrompt: isGuest 
          ? '注册即可获得更多分析次数' 
          : (isFree 
            ? '升级Pro会员，每日50次分析' 
            : (permissions.tier === 'pro' 
              ? '升级Elite会员，享受无限分析' 
              : '今日分析次数已用完，明天再来')),
      }, 403);
    }
    
    await next();
  };
}

// ==================== 工具函数 ====================

/**
 * 获取当前用户ID（登录用户返回ID，访客返回null）
 */
export function getCurrentUserId(c: Context): number | null {
  const user = c.get('user');
  return user?.id || null;
}

/**
 * 获取当前用户或访客标识
 */
export function getCurrentUserOrGuest(c: Context): { userId: number | null; guestFingerprint: string | null } {
  const user = c.get('user');
  const guestFingerprint = c.get('guestFingerprint');
  return {
    userId: user?.id || null,
    guestFingerprint: user ? null : guestFingerprint,
  };
}

/**
 * 检查用户是否已登录
 */
export function isAuthenticated(c: Context): boolean {
  const user = c.get('user');
  return user !== null;
}

/**
 * 获取用户会员等级
 */
export function getUserTier(c: Context): MembershipTier {
  const permissions = c.get('permissions');
  return permissions?.tier || 'guest';
}

/**
 * 检查是否有特定功能权限
 */
export function hasFeaturePermission(c: Context, feature: string): boolean {
  const permissions = c.get('permissions');
  if (!permissions) return false;
  
  const allowedTiers = FEATURE_PERMISSIONS[feature];
  return allowedTiers ? allowedTiers.includes(permissions.tier) : false;
}

// ==================== 兼容性导出 ====================
// 保留旧的函数名以兼容现有代码

/**
 * @deprecated 使用 requireAuth() 代替
 */
export function authMiddleware() {
  return requireAuth();
}

/**
 * @deprecated 使用 optionalAuth() 代替
 */
export function optionalAuthMiddleware() {
  return optionalAuth();
}
