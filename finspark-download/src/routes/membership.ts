// 会员系统 API 路由
// 提供会员方案查询、状态查看、订单管理等接口

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createMembershipService, TIER_NAMES, TIER_COLORS } from '../services/membership';
import { optionalAuth, requireAuth } from '../middleware/auth';

const membership = new Hono<{ Bindings: Bindings }>();

// ==================== 公开接口 ====================

/**
 * 获取所有会员方案
 * GET /api/membership/plans
 */
membership.get('/plans', async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  
  if (!db || !cache) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  try {
    const membershipService = createMembershipService(db, cache);
    const plans = await membershipService.getActivePlans();
    
    return c.json({
      success: true,
      plans,
      tierInfo: {
        names: TIER_NAMES,
        colors: TIER_COLORS,
      },
    });
  } catch (error) {
    console.error('Get plans error:', error);
    return c.json({ success: false, error: '获取方案列表失败' }, 500);
  }
});

/**
 * 获取方案对比数据
 * GET /api/membership/comparison
 */
membership.get('/comparison', async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  
  if (!db || !cache) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  try {
    const membershipService = createMembershipService(db, cache);
    const comparison = await membershipService.getPlansComparison();
    
    return c.json({
      success: true,
      ...comparison,
    });
  } catch (error) {
    console.error('Get comparison error:', error);
    return c.json({ success: false, error: '获取对比数据失败' }, 500);
  }
});

/**
 * 获取单个方案详情
 * GET /api/membership/plans/:code
 */
membership.get('/plans/:code', async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  const code = c.req.param('code');
  
  if (!db || !cache) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  try {
    const membershipService = createMembershipService(db, cache);
    const plan = await membershipService.getPlanByCode(code);
    
    if (!plan) {
      return c.json({ success: false, error: '方案不存在' }, 404);
    }
    
    return c.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Get plan error:', error);
    return c.json({ success: false, error: '获取方案详情失败' }, 500);
  }
});

// ==================== 需要认证的接口 ====================

/**
 * 获取当前用户会员状态
 * GET /api/membership/current
 */
membership.get('/current', optionalAuth(), async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  const user = c.get('user');
  
  if (!db || !cache) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  try {
    const membershipService = createMembershipService(db, cache);
    
    // 未登录用户返回访客状态
    if (!user) {
      return c.json({
        success: true,
        isLoggedIn: false,
        status: {
          tier: 'guest',
          tierName: TIER_NAMES.guest,
          isActive: false,
          expiresAt: null,
          daysRemaining: null,
          usageToday: { analysis: 0, pdfExport: 0, aiComic: 0 },
          limits: { analysis: 3, pdfExport: 0, aiComic: 0, favorites: 0 },
        },
      });
    }
    
    const status = await membershipService.getMembershipStatus(user.id);
    
    return c.json({
      success: true,
      isLoggedIn: true,
      status,
    });
  } catch (error) {
    console.error('Get membership status error:', error);
    return c.json({ success: false, error: '获取会员状态失败' }, 500);
  }
});

/**
 * 获取用户订单历史
 * GET /api/membership/orders
 */
membership.get('/orders', requireAuth(), async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  const user = c.get('user');
  
  if (!db || !cache || !user) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status');
    
    const membershipService = createMembershipService(db, cache);
    const { orders, total } = await membershipService.getUserOrders(user.id, {
      page,
      limit,
      status,
    });
    
    return c.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return c.json({ success: false, error: '获取订单历史失败' }, 500);
  }
});

/**
 * 检查功能可用性
 * GET /api/membership/check-feature/:feature
 */
membership.get('/check-feature/:feature', optionalAuth(), async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  const user = c.get('user');
  const feature = c.req.param('feature');
  
  if (!db || !cache) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  // 未登录用户
  if (!user) {
    return c.json({
      success: true,
      available: false,
      reason: '请先登录',
      needLogin: true,
    });
  }
  
  try {
    const membershipService = createMembershipService(db, cache);
    const result = await membershipService.checkFeatureAvailable(user.id, feature);
    
    return c.json({
      success: true,
      ...result,
      needUpgrade: !result.available && result.reason !== '请先登录',
    });
  } catch (error) {
    console.error('Check feature error:', error);
    return c.json({ success: false, error: '检查功能可用性失败' }, 500);
  }
});

/**
 * 创建订单（暂时返回即将推出提示）
 * POST /api/membership/create-order
 */
membership.post('/create-order', requireAuth(), async (c) => {
  const db = c.env.DB;
  const cache = c.env.CACHE;
  const user = c.get('user');
  
  if (!db || !cache || !user) {
    return c.json({ success: false, error: '服务配置错误' }, 500);
  }
  
  try {
    const body = await c.req.json();
    const { planCode } = body;
    
    if (!planCode) {
      return c.json({ success: false, error: '请选择会员方案' }, 400);
    }
    
    const membershipService = createMembershipService(db, cache);
    const plan = await membershipService.getPlanByCode(planCode);
    
    if (!plan) {
      return c.json({ success: false, error: '方案不存在' }, 404);
    }
    
    // 暂时返回即将推出提示
    return c.json({
      success: false,
      error: '支付功能即将推出',
      comingSoon: true,
      plan: {
        code: plan.code,
        name: plan.name,
        price: (plan.current_price_cents / 100).toFixed(2),
        currency: plan.currency,
      },
      message: '会员订阅功能正在开发中，敬请期待！您可以先体验免费版功能。',
    });
    
    // 支付集成后启用以下代码
    // const order = await membershipService.createOrder(user.id, planCode);
    // return c.json({ success: true, order });
  } catch (error) {
    console.error('Create order error:', error);
    return c.json({ success: false, error: '创建订单失败' }, 500);
  }
});

/**
 * 获取FAQ列表
 * GET /api/membership/faq
 */
membership.get('/faq', async (c) => {
  const faqs = [
    {
      question: '会员有什么特权？',
      answer: 'Pro会员可享受每日50次分析、AI漫画解读、专业风险评估、行业对比分析等高级功能。Elite会员更可享受无限分析次数、批量分析、API访问权限等企业级功能。',
    },
    {
      question: '如何升级会员？',
      answer: '会员订阅功能正在开发中，敬请期待！目前您可以免费体验基础版功能。',
    },
    {
      question: '会员可以退款吗？',
      answer: '会员订阅一旦生效，原则上不支持退款。如有特殊情况，请联系客服处理。',
    },
    {
      question: '会员到期后会怎样？',
      answer: '会员到期后，您的账户将自动降级为免费版，但您的分析历史和收藏数据会保留（超出免费版限额的收藏将无法新增，但不会删除）。',
    },
    {
      question: '免费版有什么限制？',
      answer: '免费版每日可分析10家公司，支持查看完整报告、收藏100只股票、查看历史记录。AI漫画、风险评估、行业对比等高级功能需要升级Pro会员才能使用。',
    },
    {
      question: '年付和月付有什么区别？',
      answer: '年付方案相比月付可节省约40%的费用，且一次性开通更加便捷。功能权益完全相同，仅是计费周期不同。',
    },
  ];
  
  return c.json({
    success: true,
    faqs,
  });
});

export default membership;
