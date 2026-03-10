// 用户相关 API 路由
// 收藏、历史记录、用户偏好设置等

import { Hono } from 'hono';
import { createUserService } from '../services/user';
import { requireAuth, optionalAuth, requireFeature, getCurrentUserId, getCurrentUserOrGuest } from '../middleware/auth';
import type { Bindings } from '../types';

const user = new Hono<{ Bindings: Bindings }>();

// ==================== 收藏相关 ====================

// 获取收藏列表
user.get('/favorites', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const type = c.req.query('type') as 'stock' | 'report' | undefined;
    
    const result = await userService.getFavorites(currentUser.id, { page, limit, type });
    
    return c.json({
      success: true,
      favorites: result.favorites,
      total: result.total,
      page,
      limit,
      hasMore: result.total > page * limit,
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    return c.json({ success: false, error: '获取收藏失败' }, 500);
  }
});

// 添加收藏
user.post('/favorites', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json<{
      type: 'stock' | 'report';
      stockCode: string;
      stockName: string;
      reportId?: number;
      notes?: string;
    }>();
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    if (!body.stockCode || !body.stockName) {
      return c.json({ success: false, error: '请提供股票代码和名称' }, 400);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.addFavorite(
      currentUser.id,
      body.type || 'stock',
      body.stockCode,
      body.stockName,
      body.reportId,
      body.notes
    );
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({
      success: true,
      favorite: result.favorite,
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    return c.json({ success: false, error: '收藏失败' }, 500);
  }
});

// 取消收藏
user.delete('/favorites/:id', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    const favoriteId = parseInt(c.req.param('id'), 10);
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    if (isNaN(favoriteId)) {
      return c.json({ success: false, error: '无效的收藏ID' }, 400);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.removeFavorite(currentUser.id, favoriteId);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Remove favorite error:', error);
    return c.json({ success: false, error: '取消收藏失败' }, 500);
  }
});

// 检查是否已收藏
user.get('/favorites/check/:stockCode', optionalAuth(), async (c) => {
  try {
    const currentUser = c.get('user');
    const stockCode = c.req.param('stockCode');
    
    if (!currentUser) {
      return c.json({
        success: true,
        isFavorited: false,
        needLogin: true,
      });
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const isFavorited = await userService.isFavorited(currentUser.id, stockCode);
    
    return c.json({
      success: true,
      isFavorited,
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    return c.json({ success: false, error: '检查收藏状态失败' }, 500);
  }
});

// ==================== 历史记录相关 ====================

// 获取分析历史（增强版 - 支持多维筛选）
user.get('/history', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    // 解析所有查询参数
    const options = {
      page: parseInt(c.req.query('page') || '1', 10),
      limit: Math.min(parseInt(c.req.query('limit') || '20', 10), 100),
      startDate: c.req.query('startDate') || undefined,
      endDate: c.req.query('endDate') || undefined,
      reportType: c.req.query('reportType') || undefined,
      status: c.req.query('status') || undefined,
      search: c.req.query('search') || undefined,
      sortBy: (c.req.query('sortBy') || 'created_at') as 'created_at' | 'company_name' | 'health_score' | 'status',
      sortOrder: (c.req.query('sortOrder') || 'desc') as 'asc' | 'desc',
    };
    
    const result = await userService.getAnalysisHistory(currentUser.id, options);
    
    return c.json({
      success: true,
      history: result.history,
      total: result.total,
      page: options.page,
      limit: options.limit,
      hasMore: result.total > options.page * options.limit,
      filters: result.filters,
    });
  } catch (error) {
    console.error('Get history error:', error);
    return c.json({ success: false, error: '获取历史记录失败' }, 500);
  }
});

// 删除历史记录（软删除）
user.delete('/history/:id', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    const reportId = parseInt(c.req.param('id'), 10);
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    if (isNaN(reportId)) {
      return c.json({ success: false, error: '无效的报告ID' }, 400);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.deleteAnalysisReport(currentUser.id, reportId);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete history error:', error);
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});

// 批量删除历史记录
user.post('/history/batch-delete', requireAuth(), requireFeature('history'), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json<{ ids: number[] }>();
    
    if (!currentUser || !c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.batchDeleteAnalysisReports(currentUser.id, body.ids);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `已删除 ${result.deletedCount} 条记录`,
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});

// ==================== 统计信息 ====================

// 获取用户统计
user.get('/stats', requireAuth(), async (c) => {
  try {
    const currentUser = c.get('user');
    const permissions = c.get('permissions');
    
    if (!currentUser || !c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 获取收藏数量
    const favoritesCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?'
    ).bind(currentUser.id).first<{ count: number }>();
    
    // 获取历史记录数量
    const historyCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM analysis_reports WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)'
    ).bind(currentUser.id).first<{ count: number }>();
    
    // 获取漫画数量
    const comicCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM comic_reports WHERE user_id = ? AND status = "completed"'
    ).bind(currentUser.id).first<{ count: number }>();
    
    return c.json({
      success: true,
      stats: {
        favorites: favoritesCount?.count || 0,
        analyses: historyCount?.count || 0,
        comics: comicCount?.count || 0,
        tier: permissions?.tier || 'free',
        remainingAnalysis: permissions?.remainingAnalysis,
        maxDailyAnalysis: permissions?.maxDailyAnalysis,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ success: false, error: '获取统计信息失败' }, 500);
  }
});

// ==================== 用户偏好设置 ====================

// 获取用户偏好
user.get('/preferences', requireAuth(), async (c) => {
  try {
    const currentUser = c.get('user');
    
    if (!currentUser || !c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const preferences = await c.env.DB.prepare(
      'SELECT * FROM user_preferences WHERE user_id = ?'
    ).bind(currentUser.id).first();
    
    // 如果没有偏好设置，返回默认值
    if (!preferences) {
      return c.json({
        success: true,
        preferences: {
          theme: 'light',
          language: 'zh-CN',
          default_comic_style: 'creative',
          default_character_set: 'nezha-movie',
          notification_email: true,
          notification_analysis: true,
          notification_promotion: false,
        },
      });
    }
    
    return c.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return c.json({ success: false, error: '获取偏好设置失败' }, 500);
  }
});

// 更新用户偏好
user.put('/preferences', requireAuth(), async (c) => {
  try {
    const currentUser = c.get('user');
    const body = await c.req.json<{
      theme?: string;
      language?: string;
      default_comic_style?: string;
      default_character_set?: string;
      notification_email?: boolean;
      notification_analysis?: boolean;
      notification_promotion?: boolean;
    }>();
    
    if (!currentUser || !c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    // 检查是否已有偏好设置
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_preferences WHERE user_id = ?'
    ).bind(currentUser.id).first();
    
    if (existing) {
      // 更新现有设置
      const updates: string[] = [];
      const values: (string | number | null)[] = [];
      
      if (body.theme !== undefined) {
        updates.push('theme = ?');
        values.push(body.theme);
      }
      if (body.language !== undefined) {
        updates.push('language = ?');
        values.push(body.language);
      }
      if (body.default_comic_style !== undefined) {
        updates.push('default_comic_style = ?');
        values.push(body.default_comic_style);
      }
      if (body.default_character_set !== undefined) {
        updates.push('default_character_set = ?');
        values.push(body.default_character_set);
      }
      if (body.notification_email !== undefined) {
        updates.push('notification_email = ?');
        values.push(body.notification_email ? 1 : 0);
      }
      if (body.notification_analysis !== undefined) {
        updates.push('notification_analysis = ?');
        values.push(body.notification_analysis ? 1 : 0);
      }
      if (body.notification_promotion !== undefined) {
        updates.push('notification_promotion = ?');
        values.push(body.notification_promotion ? 1 : 0);
      }
      
      if (updates.length > 0) {
        updates.push('updated_at = datetime("now")');
        values.push(currentUser.id);
        
        await c.env.DB.prepare(
          `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`
        ).bind(...values).run();
      }
    } else {
      // 创建新设置
      await c.env.DB.prepare(`
        INSERT INTO user_preferences (
          user_id, theme, language, default_comic_style, default_character_set,
          notification_email, notification_analysis, notification_promotion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        currentUser.id,
        body.theme || 'light',
        body.language || 'zh-CN',
        body.default_comic_style || 'creative',
        body.default_character_set || 'nezha-movie',
        body.notification_email !== false ? 1 : 0,
        body.notification_analysis !== false ? 1 : 0,
        body.notification_promotion === true ? 1 : 0
      ).run();
    }
    
    // 返回更新后的设置
    const preferences = await c.env.DB.prepare(
      'SELECT * FROM user_preferences WHERE user_id = ?'
    ).bind(currentUser.id).first();
    
    return c.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return c.json({ success: false, error: '更新偏好设置失败' }, 500);
  }
});

// ==================== 访客相关 ====================

// 初始化访客会话
user.post('/guest/init', optionalAuth(), async (c) => {
  try {
    const body = await c.req.json<{
      fingerprint: string;
    }>();
    
    if (!body.fingerprint) {
      return c.json({ success: false, error: '请提供设备指纹' }, 400);
    }
    
    // 如果已经登录，返回用户信息
    const currentUser = c.get('user');
    if (currentUser) {
      const permissions = c.get('permissions');
      return c.json({
        success: true,
        isLoggedIn: true,
        user: currentUser,
        permissions,
      });
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    // 获取或创建访客会话
    const session = await userService.getOrCreateGuestSession(
      body.fingerprint,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      c.req.header('User-Agent')
    );
    
    // 获取访客权限
    const permissions = await userService.getUserPermissions(null, body.fingerprint);
    
    return c.json({
      success: true,
      isLoggedIn: false,
      guest: {
        fingerprint: session.fingerprint,
        analysisCount: session.analysis_count,
        firstVisit: session.first_visit_at,
      },
      permissions,
    });
  } catch (error) {
    console.error('Guest init error:', error);
    return c.json({ success: false, error: '初始化失败' }, 500);
  }
});

export default user;
