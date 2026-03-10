// 认证相关 API 路由
// 支持邮箱注册/登录、访客转化、用户信息管理

import { Hono } from 'hono';
import { createAuthService } from '../services/auth';
import { createUserService, type MembershipTier } from '../services/user';
import { requireAuth, optionalAuth, getCurrentUserId, getCurrentUserOrGuest } from '../middleware/auth';
import type { Bindings } from '../types';

const auth = new Hono<{ Bindings: Bindings }>();

// ============ 用户注册 ============
auth.post('/register', optionalAuth(), async (c) => {
  try {
    const body = await c.req.json<{
      email: string;
      password: string;
      name?: string;
      guestFingerprint?: string;
    }>();
    
    if (!body.email || !body.password) {
      return c.json({ success: false, error: '请提供邮箱和密码' }, 400);
    }
    
    if (!c.env.DB || !c.env.JWT_SECRET || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    const result = await authService.register(body.email, body.password, body.name);
    
    if (!result.success || !result.user) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    // 如果有访客会话 ID，迁移访客数据到新用户
    const guestSessionId = body.guestFingerprint || c.get('guestFingerprint');
    let migrationResult = null;
    if (guestSessionId && result.user.id) {
      migrationResult = await userService.migrateGuestToUser(guestSessionId, result.user.id);
    }
    
    // 记录登录活动
    await userService.recordLogin(
      result.user.id,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      c.req.header('User-Agent')
    );
    
    // 获取用户权限
    const permissions = await userService.getUserPermissions(result.user.id);
    
    return c.json({
      success: true,
      user: {
        ...result.user,
        permissions,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      migration: migrationResult,
    });
  } catch (error) {
    console.error('Register route error:', error);
    return c.json({ success: false, error: '注册失败' }, 500);
  }
});

// ============ 用户登录 ============
auth.post('/login', optionalAuth(), async (c) => {
  try {
    const body = await c.req.json<{
      email: string;
      password: string;
      guestFingerprint?: string;
    }>();
    
    if (!body.email || !body.password) {
      return c.json({ success: false, error: '请提供邮箱和密码' }, 400);
    }
    
    if (!c.env.DB || !c.env.JWT_SECRET || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    const result = await authService.login(body.email, body.password);
    
    if (!result.success || !result.user) {
      return c.json({ success: false, error: result.error }, 401);
    }
    
    // 如果有访客会话 ID，迁移访客数据到新用户
    const guestSessionId = body.guestFingerprint || c.get('guestFingerprint');
    let migrationResult = null;
    if (guestSessionId && result.user.id) {
      migrationResult = await userService.migrateGuestToUser(guestSessionId, result.user.id);
    }
    
    // 记录登录活动
    await userService.recordLogin(
      result.user.id,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      c.req.header('User-Agent')
    );
    
    // 获取用户权限
    const permissions = await userService.getUserPermissions(result.user.id);
    
    return c.json({
      success: true,
      user: {
        ...result.user,
        permissions,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      migration: migrationResult,
    });
  } catch (error) {
    console.error('Login route error:', error);
    return c.json({ success: false, error: '登录失败' }, 500);
  }
});

// ============ 刷新令牌 ============
auth.post('/refresh', async (c) => {
  try {
    const body = await c.req.json<{ refreshToken: string }>();
    
    if (!body.refreshToken) {
      return c.json({ success: false, error: '请提供刷新令牌' }, 400);
    }
    
    if (!c.env.DB || !c.env.JWT_SECRET || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    const result = await authService.refreshAccessToken(body.refreshToken);
    
    if (!result.success || !result.user) {
      return c.json({ success: false, error: result.error, needLogin: true }, 401);
    }
    
    // 获取用户权限
    const permissions = await userService.getUserPermissions(result.user.id);
    
    return c.json({
      success: true,
      user: {
        ...result.user,
        permissions,
      },
      accessToken: result.accessToken,
    });
  } catch (error) {
    console.error('Refresh route error:', error);
    return c.json({ success: false, error: '刷新令牌失败', needLogin: true }, 500);
  }
});

// ============ 登出 ============
auth.post('/logout', async (c) => {
  try {
    const body = await c.req.json<{ refreshToken: string }>();
    
    if (!body.refreshToken) {
      return c.json({ success: true });
    }
    
    if (!c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ success: true });
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    await authService.logout(body.refreshToken);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Logout route error:', error);
    return c.json({ success: true }); // 登出总是返回成功
  }
});

// ============ 获取当前用户信息 ============
auth.get('/me', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const permissions = c.get('permissions');
    
    if (!user || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const fullUser = await userService.getUserById(user.id);
    
    if (!fullUser) {
      return c.json({ success: false, error: '用户不存在' }, 404);
    }
    
    return c.json({ 
      success: true, 
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.name,
        nickname: fullUser.nickname,
        avatar_url: fullUser.avatar_url,
        membership_tier: fullUser.membership_tier,
        membership_expires_at: fullUser.membership_expires_at,
        total_analysis_count: fullUser.total_analysis_count,
        is_verified: fullUser.is_verified,
        created_at: fullUser.created_at,
      },
      permissions,
    });
  } catch (error) {
    console.error('Get me route error:', error);
    return c.json({ success: false, error: '获取用户信息失败' }, 500);
  }
});

// ============ 更新用户信息 ============
auth.put('/me', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json<{
      name?: string;
      nickname?: string;
      avatar_url?: string;
      phone?: string;
    }>();
    
    if (!user || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.updateProfile(user.id, body);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Update me route error:', error);
    return c.json({ success: false, error: '更新用户信息失败' }, 500);
  }
});

// ============ 修改密码 ============
auth.post('/change-password', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json<{
      oldPassword: string;
      newPassword: string;
    }>();
    
    if (!body.oldPassword || !body.newPassword) {
      return c.json({ success: false, error: '请提供当前密码和新密码' }, 400);
    }
    
    if (!user || !c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    const result = await authService.changePassword(user.id, body.oldPassword, body.newPassword);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ 
      success: true, 
      message: '密码修改成功，请重新登录',
      needRelogin: true,
    });
  } catch (error) {
    console.error('Change password route error:', error);
    return c.json({ success: false, error: '修改密码失败' }, 500);
  }
});

// ============ 登出所有设备 ============
auth.post('/logout-all', requireAuth(), async (c) => {
  try {
    const user = c.get('user');
    
    if (!user || !c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    await authService.logoutAllDevices(user.id);
    
    return c.json({ 
      success: true, 
      message: '已登出所有设备',
    });
  } catch (error) {
    console.error('Logout all route error:', error);
    return c.json({ success: false, error: '操作失败' }, 500);
  }
});

// ============ 获取权限信息（支持访客） ============
auth.get('/permissions', optionalAuth(), async (c) => {
  try {
    const permissions = c.get('permissions');
    const user = c.get('user');
    
    return c.json({
      success: true,
      isLoggedIn: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      } : null,
      permissions,
    });
  } catch (error) {
    console.error('Get permissions route error:', error);
    return c.json({ success: false, error: '获取权限信息失败' }, 500);
  }
});

// ============ 忘记密码 ============
auth.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json<{ email: string }>();
    
    if (!body.email) {
      return c.json({ success: false, error: '请提供邮箱地址' }, 400);
    }
    
    if (!c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    const result = await authService.requestPasswordReset(body.email);
    
    return c.json(result);
  } catch (error) {
    console.error('Forgot password route error:', error);
    return c.json({ success: false, error: '请求失败' }, 500);
  }
});

// ============ 重置密码 ============
auth.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json<{ token: string; newPassword: string }>();
    
    if (!body.token || !body.newPassword) {
      return c.json({ success: false, error: '请提供重置令牌和新密码' }, 400);
    }
    
    if (!c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const authService = createAuthService(c.env.DB, c.env.JWT_SECRET);
    const result = await authService.resetPassword(body.token, body.newPassword);
    
    return c.json(result);
  } catch (error) {
    console.error('Reset password route error:', error);
    return c.json({ success: false, error: '重置失败' }, 500);
  }
});

// ============ 检查次数配额 ============
auth.get('/quota', optionalAuth(), async (c) => {
  try {
    const user = c.get('user');
    const guestFingerprint = c.get('guestFingerprint');
    const permissions = c.get('permissions');
    
    return c.json({
      success: true,
      tier: permissions?.tier || 'guest',
      canAnalyze: permissions?.canAnalyze ?? false,
      remainingAnalysis: permissions?.remainingAnalysis,
      maxDailyAnalysis: permissions?.maxDailyAnalysis,
      upgradePrompt: permissions?.upgradePrompt,
    });
  } catch (error) {
    console.error('Get quota route error:', error);
    return c.json({ success: false, error: '获取配额信息失败' }, 500);
  }
});

export default auth;
