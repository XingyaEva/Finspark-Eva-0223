// 用户收藏 API 路由
// 支持收藏管理、分组管理、搜索排序

import { Hono } from 'hono';
import { createUserService } from '../services/user';
import { requireAuth, requireFeature, getCurrentUserId } from '../middleware/auth';
import type { Bindings } from '../types';

const favorites = new Hono<{ Bindings: Bindings }>();

// ==================== 收藏列表相关 ====================

// 获取收藏列表（增强版）
favorites.get('/', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const query = c.req.query();
    const userService = createUserService(c.env.DB, c.env.CACHE);
    
    const result = await userService.getFavoritesEnhanced(currentUser.id, {
      type: query.type as 'stock' | 'report' | undefined,
      groupId: query.groupId ? parseInt(query.groupId) : undefined,
      search: query.search,
      sortBy: query.sortBy as 'created_at' | 'stock_name' | 'sort_order' | undefined,
      sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? Math.min(parseInt(query.limit), 100) : 20,
    });
    
    return c.json({
      success: true,
      favorites: result.favorites,
      total: result.total,
      groups: result.groups,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
      hasMore: result.total > ((query.page ? parseInt(query.page) : 1) * (query.limit ? parseInt(query.limit) : 20)),
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    return c.json({ success: false, error: '获取收藏列表失败' }, 500);
  }
});

// 添加收藏
favorites.post('/', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const body = await c.req.json<{
      type?: 'stock' | 'report';
      stockCode: string;
      stockName: string;
      reportId?: number;
      notes?: string;
      groupId?: number;
    }>();
    
    if (!body.stockCode || !body.stockName) {
      return c.json({ success: false, error: '请提供股票代码和名称' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
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
    
    // 如果指定了分组，移动到该分组
    if (body.groupId && result.favorite) {
      await userService.moveFavoriteToGroup(currentUser.id, result.favorite.id, body.groupId);
    }
    
    return c.json({
      success: true,
      favorite: result.favorite,
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    return c.json({ success: false, error: '添加收藏失败' }, 500);
  }
});

// 检查是否已收藏
favorites.get('/check/:code', requireAuth(), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const stockCode = c.req.param('code');
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const isFavorite = await userService.isFavorited(currentUser.id, stockCode);
    
    return c.json({
      success: true,
      isFavorite,
    });
  } catch (error) {
    console.error('Check favorite error:', error);
    return c.json({ success: false, error: '检查收藏状态失败' }, 500);
  }
});

// 移除收藏
favorites.delete('/:id', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const favoriteId = parseInt(c.req.param('id'));
    if (isNaN(favoriteId)) {
      return c.json({ success: false, error: '无效的收藏ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.removeFavorite(currentUser.id, favoriteId);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Remove favorite error:', error);
    return c.json({ success: false, error: '移除收藏失败' }, 500);
  }
});

// 移动收藏到分组
favorites.put('/:id/group', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const favoriteId = parseInt(c.req.param('id'));
    if (isNaN(favoriteId)) {
      return c.json({ success: false, error: '无效的收藏ID' }, 400);
    }
    
    const body = await c.req.json<{ groupId: number | null }>();
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.moveFavoriteToGroup(currentUser.id, favoriteId, body.groupId);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Move favorite to group error:', error);
    return c.json({ success: false, error: '移动失败' }, 500);
  }
});

// 批量移动收藏到分组
favorites.post('/batch/move', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const body = await c.req.json<{
      ids: number[];
      groupId: number | null;
    }>();
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return c.json({ success: false, error: '请选择要移动的收藏' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.batchMoveFavoritesToGroup(currentUser.id, body.ids, body.groupId);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ 
      success: true,
      movedCount: result.movedCount,
    });
  } catch (error) {
    console.error('Batch move favorites error:', error);
    return c.json({ success: false, error: '批量移动失败' }, 500);
  }
});

// ==================== 分组管理 ====================

// 获取分组列表
favorites.get('/groups', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const groups = await userService.getFavoriteGroups(currentUser.id);
    
    return c.json({
      success: true,
      groups,
    });
  } catch (error) {
    console.error('Get favorite groups error:', error);
    return c.json({ success: false, error: '获取分组列表失败' }, 500);
  }
});

// 创建分组
favorites.post('/groups', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const body = await c.req.json<{
      name: string;
      description?: string;
      color?: string;
      icon?: string;
    }>();
    
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ success: false, error: '请输入分组名称' }, 400);
    }
    
    if (body.name.length > 20) {
      return c.json({ success: false, error: '分组名称不能超过20个字符' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.createFavoriteGroup(currentUser.id, {
      name: body.name.trim(),
      description: body.description,
      color: body.color,
      icon: body.icon,
    });
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({
      success: true,
      group: result.group,
    });
  } catch (error) {
    console.error('Create favorite group error:', error);
    return c.json({ success: false, error: '创建分组失败' }, 500);
  }
});

// 更新分组
favorites.put('/groups/:id', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const groupId = parseInt(c.req.param('id'));
    if (isNaN(groupId)) {
      return c.json({ success: false, error: '无效的分组ID' }, 400);
    }
    
    const body = await c.req.json<{
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
    }>();
    
    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return c.json({ success: false, error: '分组名称不能为空' }, 400);
      }
      if (body.name.length > 20) {
        return c.json({ success: false, error: '分组名称不能超过20个字符' }, 400);
      }
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.updateFavoriteGroup(currentUser.id, groupId, {
      name: body.name?.trim(),
      description: body.description,
      color: body.color,
      icon: body.icon,
    });
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({
      success: true,
      group: result.group,
    });
  } catch (error) {
    console.error('Update favorite group error:', error);
    return c.json({ success: false, error: '更新分组失败' }, 500);
  }
});

// 删除分组
favorites.delete('/groups/:id', requireAuth(), requireFeature('favorite'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser?.id) {
      return c.json({ success: false, error: '用户未登录' }, 401);
    }
    
    const groupId = parseInt(c.req.param('id'));
    if (isNaN(groupId)) {
      return c.json({ success: false, error: '无效的分组ID' }, 400);
    }
    
    if (!c.env.DB || !c.env.CACHE) {
      return c.json({ success: false, error: '服务配置错误' }, 500);
    }
    
    const userService = createUserService(c.env.DB, c.env.CACHE);
    const result = await userService.deleteFavoriteGroup(currentUser.id, groupId);
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete favorite group error:', error);
    return c.json({ success: false, error: '删除分组失败' }, 500);
  }
});

export default favorites;
