/**
 * IP主题管理 API 路由
 * 
 * 提供新的多角色主题系统接口
 * - 主题列表
 * - 主题详情
 * - 角色预分配预览
 * - 主题推荐
 */

import { Hono } from 'hono';
import { 
  ipThemeService, 
  ALL_IP_THEMES, 
  DEFAULT_THEME_ID,
  PANEL_INDEX_TO_TYPE,
} from '../services/ip-themes';
import {
  getThemeListOverview,
  getThemeDetail,
  getThemeCharacterPreview,
  getSimplifiedCharacterAssignment,
} from '../services/multi-character-comic';
import { CONTENT_STYLES, getAvailableContentStyles } from '../services/comicPromptModules';
import type { Bindings } from '../types';

const themes = new Hono<{ Bindings: Bindings }>();

// ============ 获取所有主题列表 ============
themes.get('/', (c) => {
  try {
    const themeList = getThemeListOverview();
    
    return c.json({
      success: true,
      data: themeList,
      defaultThemeId: DEFAULT_THEME_ID,
      total: themeList.length,
    });
  } catch (error) {
    console.error('Get themes error:', error);
    return c.json({ success: false, error: '获取主题列表失败' }, 500);
  }
});

// ============ 获取主题详情 ============
themes.get('/:themeId', (c) => {
  try {
    const themeId = c.req.param('themeId');
    const theme = getThemeDetail(themeId);
    
    if (!theme) {
      return c.json({ success: false, error: '主题不存在' }, 404);
    }
    
    return c.json({
      success: true,
      data: theme,
    });
  } catch (error) {
    console.error('Get theme detail error:', error);
    return c.json({ success: false, error: '获取主题详情失败' }, 500);
  }
});

// ============ 获取主题的角色预分配预览 ============
themes.get('/:themeId/preview', (c) => {
  try {
    const themeId = c.req.param('themeId');
    const theme = ipThemeService.getTheme(themeId);
    
    if (!theme) {
      return c.json({ success: false, error: '主题不存在' }, 404);
    }
    
    const preview = getThemeCharacterPreview(themeId);
    
    return c.json({
      success: true,
      data: {
        themeId: theme.id,
        themeName: theme.name,
        themeIcon: theme.icon,
        panels: preview,
      },
    });
  } catch (error) {
    console.error('Get theme preview error:', error);
    return c.json({ success: false, error: '获取预览失败' }, 500);
  }
});

// ============ 获取简化的角色分配 ============
themes.get('/:themeId/assignment', (c) => {
  try {
    const themeId = c.req.param('themeId');
    const theme = ipThemeService.getTheme(themeId);
    
    if (!theme) {
      return c.json({ success: false, error: '主题不存在' }, 404);
    }
    
    const assignment = getSimplifiedCharacterAssignment(themeId);
    
    return c.json({
      success: true,
      data: {
        themeId: theme.id,
        themeName: theme.name,
        assignment,
      },
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    return c.json({ success: false, error: '获取角色分配失败' }, 500);
  }
});

// ============ 根据行业推荐主题 ============
themes.get('/recommend/by-industry', (c) => {
  try {
    const industry = c.req.query('industry');
    
    if (!industry) {
      return c.json({ success: false, error: '请提供行业参数' }, 400);
    }
    
    const recommendedTheme = ipThemeService.recommendThemeByIndustry(industry);
    const preview = getThemeCharacterPreview(recommendedTheme.id);
    
    return c.json({
      success: true,
      data: {
        theme: {
          id: recommendedTheme.id,
          name: recommendedTheme.name,
          icon: recommendedTheme.icon,
          description: recommendedTheme.description,
        },
        industry,
        matchReason: recommendedTheme.suitableFor.find(i => 
          industry.includes(i) || i.includes(industry)
        ) || '默认推荐',
        previewPanels: preview.slice(0, 3), // 只返回前3个面板预览
      },
    });
  } catch (error) {
    console.error('Recommend theme error:', error);
    return c.json({ success: false, error: '推荐主题失败' }, 500);
  }
});

// ============ 获取主题中的指定角色 ============
themes.get('/:themeId/characters/:characterId', (c) => {
  try {
    const themeId = c.req.param('themeId');
    const characterId = c.req.param('characterId');
    
    const character = ipThemeService.getCharacter(themeId, characterId);
    
    if (!character) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }
    
    return c.json({
      success: true,
      data: character,
    });
  } catch (error) {
    console.error('Get character error:', error);
    return c.json({ success: false, error: '获取角色详情失败' }, 500);
  }
});

// ============ 获取漫画配置（主题 + 风格组合）============
themes.get('/:themeId/comic-config', (c) => {
  try {
    const themeId = c.req.param('themeId');
    const theme = ipThemeService.getTheme(themeId);
    
    if (!theme) {
      return c.json({ success: false, error: '主题不存在' }, 404);
    }
    
    // 获取所有风格
    const styles = getAvailableContentStyles().map(s => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      creativeFreedom: s.creativeFreedom,
    }));
    
    // 获取角色预分配
    const characterAssignment = getSimplifiedCharacterAssignment(themeId);
    
    return c.json({
      success: true,
      data: {
        theme: {
          id: theme.id,
          name: theme.name,
          icon: theme.icon,
          description: theme.description,
          source: theme.source,
          overallStyle: theme.overallStyle,
        },
        characters: theme.characters.map(c => ({
          id: c.id,
          name: c.name,
          displayName: c.displayName,
          personalityType: c.personalityType,
          suitablePanels: c.suitablePanels,
        })),
        characterAssignment,
        availableStyles: styles,
        availableFormats: [
          { id: 'grid', name: '网格布局', description: '8格漫画网格展示' },
          { id: 'vertical-scroll', name: '长图滚动', description: '微信公众号风格长图' },
        ],
        defaultConfig: {
          themeId: theme.id,
          contentStyle: 'creative',
          outputFormat: 'grid',
          useMultiCharacter: true,
        },
      },
    });
  } catch (error) {
    console.error('Get comic config error:', error);
    return c.json({ success: false, error: '获取漫画配置失败' }, 500);
  }
});

// ============ 获取所有可用的内容风格 ============
themes.get('/config/content-styles', (c) => {
  try {
    const styles = getAvailableContentStyles();
    
    const styleList = styles.map(style => ({
      id: style.id,
      name: style.name,
      nameEn: style.nameEn,
      description: style.description,
      icon: style.icon,
      creativeFreedom: style.creativeFreedom,
      enforceSubPanels: style.enforceSubPanels,
    }));
    
    return c.json({
      success: true,
      data: styleList,
      defaultStyle: 'creative',
      total: styleList.length,
    });
  } catch (error) {
    console.error('Get content styles error:', error);
    return c.json({ success: false, error: '获取内容风格列表失败' }, 500);
  }
});

// ============ 兼容旧API：获取角色集（映射到主题）============
themes.get('/legacy/character-sets', (c) => {
  try {
    // 将新主题格式转换为旧的角色集格式以保持兼容性
    const legacySets = ALL_IP_THEMES.map(theme => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      source: theme.source,
      defaultCharacterId: theme.defaultProtagonist,
      characters: theme.characters.map(char => ({
        id: char.id,
        name: char.name,
        displayName: char.displayName,
        description: char.description,
        personality: char.personality,
        visualStyle: char.visualStyle,
        colorPalette: char.colorPalette,
        catchphrase: char.catchphrase,
        source: theme.source,
        suitableFor: theme.suitableFor,
      })),
    }));
    
    return c.json({
      success: true,
      data: legacySets,
      defaultSetId: DEFAULT_THEME_ID,
      defaultCharacterId: ipThemeService.getDefaultTheme().defaultProtagonist,
      _notice: '此API已弃用，请使用 /api/themes 获取新的主题系统',
    });
  } catch (error) {
    console.error('Get legacy character sets error:', error);
    return c.json({ success: false, error: '获取角色集列表失败' }, 500);
  }
});

export default themes;
