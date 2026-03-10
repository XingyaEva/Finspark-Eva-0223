// 用户偏好设置 API 路由
import { Hono } from 'hono';
import { createPreferencesService, DEFAULT_PREFERENCES } from '../services/preferences';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import type { Bindings } from '../types';

const preferences = new Hono<{ Bindings: Bindings }>();

// 获取当前用户偏好设置
preferences.get('/', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const prefsService = createPreferencesService(c.env.DB);
    const preferences = await prefsService.getUserPreferences(user.id);
    
    return c.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return c.json({ success: false, error: '获取偏好设置失败' }, 500);
  }
});

// 获取默认偏好设置（无需登录）
preferences.get('/defaults', async (c) => {
  return c.json({
    success: true,
    defaults: DEFAULT_PREFERENCES
  });
});

// 更新用户偏好设置
preferences.patch('/', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const updates = await c.req.json();
    
    // 验证更新字段
    const allowedFields = [
      'defaultReportType', 'analysisDepth', 'includeComic', 'includeForecast', 
      'includeIndustryCompare', 'theme', 'language', 'chartColorScheme',
      'emailNotifications', 'reportCompleteNotify', 'weeklyDigest', 'marketingEmails',
      'favoriteStocks', 'recentSearches', 'pinnedReports', 'exportFormat'
    ];
    
    const validUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      return c.json({ success: false, error: '没有有效的更新字段' }, 400);
    }
    
    const prefsService = createPreferencesService(c.env.DB);
    const preferences = await prefsService.updateUserPreferences(user.id, validUpdates);
    
    return c.json({
      success: true,
      preferences,
      updated: Object.keys(validUpdates)
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return c.json({ success: false, error: '更新偏好设置失败' }, 500);
  }
});

// 重置偏好设置为默认值
preferences.post('/reset', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const prefsService = createPreferencesService(c.env.DB);
    const preferences = await prefsService.resetUserPreferences(user.id);
    
    return c.json({
      success: true,
      preferences,
      message: '偏好设置已重置为默认值'
    });
  } catch (error) {
    console.error('Reset preferences error:', error);
    return c.json({ success: false, error: '重置偏好设置失败' }, 500);
  }
});

// 获取偏好变更历史
preferences.get('/history', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const limit = parseInt(c.req.query('limit') || '50');
    
    const prefsService = createPreferencesService(c.env.DB);
    const history = await prefsService.getPreferencesHistory(user.id, limit);
    
    return c.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Get preferences history error:', error);
    return c.json({ success: false, error: '获取变更历史失败' }, 500);
  }
});

// 添加常用股票
preferences.post('/favorite-stocks', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const { stockCode } = await c.req.json();
    
    if (!stockCode) {
      return c.json({ success: false, error: '请提供股票代码' }, 400);
    }
    
    const prefsService = createPreferencesService(c.env.DB);
    const favorites = await prefsService.addFavoriteStock(user.id, stockCode);
    
    return c.json({
      success: true,
      favoriteStocks: favorites
    });
  } catch (error) {
    console.error('Add favorite stock error:', error);
    return c.json({ success: false, error: '添加常用股票失败' }, 500);
  }
});

// 移除常用股票
preferences.delete('/favorite-stocks/:code', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    const stockCode = c.req.param('code');
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const prefsService = createPreferencesService(c.env.DB);
    const favorites = await prefsService.removeFavoriteStock(user.id, stockCode);
    
    return c.json({
      success: true,
      favoriteStocks: favorites
    });
  } catch (error) {
    console.error('Remove favorite stock error:', error);
    return c.json({ success: false, error: '移除常用股票失败' }, 500);
  }
});

// 清除搜索历史
preferences.delete('/recent-searches', authMiddleware(), async (c) => {
  try {
    const user = c.get('user' as any);
    
    if (!user || !user.id) {
      return c.json({ success: false, error: '未登录' }, 401);
    }
    
    if (!c.env.DB) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const prefsService = createPreferencesService(c.env.DB);
    await prefsService.clearRecentSearches(user.id);
    
    return c.json({
      success: true,
      message: '搜索历史已清除'
    });
  } catch (error) {
    console.error('Clear recent searches error:', error);
    return c.json({ success: false, error: '清除搜索历史失败' }, 500);
  }
});

export default preferences;
