// IP角色管理 API 路由
// 提供角色集合列表、角色详情、角色推荐、内容风格等功能

import { Hono } from 'hono';
import { 
  characterService, 
  CHARACTER_SETS, 
  NEZHA_CHARACTERS, 
  BUSINESS_CHARACTERS,
  DEFAULT_CHARACTER_SET_ID,
  DEFAULT_CHARACTER_ID 
} from '../services/characters';
import { CONTENT_STYLES, getAvailableContentStyles, getContentStyleConfig } from '../services/comicPromptModules';
import type { Bindings, IPCharacter, IPCharacterSet, ComicContentStyle } from '../types';

const characters = new Hono<{ Bindings: Bindings }>();

// ============ 获取所有角色集列表 ============
characters.get('/sets', (c) => {
  try {
    const characterSets = characterService.getAllCharacterSets();
    
    // 返回角色集概览（不含完整角色列表）
    const overview = characterSets.map(set => ({
      id: set.id,
      name: set.name,
      description: set.description,
      source: set.source,
      defaultCharacterId: set.defaultCharacterId,
      characterCount: set.characters.length,
      // 只返回角色ID和名称列表
      characters: set.characters.map(char => ({
        id: char.id,
        name: char.name,
        displayName: char.displayName,
      })),
    }));
    
    return c.json({
      success: true,
      data: overview,
      defaultSetId: DEFAULT_CHARACTER_SET_ID,
      defaultCharacterId: DEFAULT_CHARACTER_ID,
    });
  } catch (error) {
    console.error('Get character sets error:', error);
    return c.json({ success: false, error: '获取角色集列表失败' }, 500);
  }
});

// ============ 获取指定角色集详情 ============
characters.get('/sets/:setId', (c) => {
  try {
    const setId = c.req.param('setId');
    const characterSet = characterService.getCharacterSet(setId);
    
    if (!characterSet) {
      return c.json({ success: false, error: '角色集不存在' }, 404);
    }
    
    return c.json({
      success: true,
      data: characterSet,
    });
  } catch (error) {
    console.error('Get character set error:', error);
    return c.json({ success: false, error: '获取角色集详情失败' }, 500);
  }
});

// ============ 获取指定角色详情 ============
characters.get('/sets/:setId/characters/:characterId', (c) => {
  try {
    const setId = c.req.param('setId');
    const characterId = c.req.param('characterId');
    
    const character = characterService.getCharacter(setId, characterId);
    
    if (!character) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }
    
    // 获取角色的对话风格
    const dialogueStyle = characterService.getDialogueStyle(character);
    
    return c.json({
      success: true,
      data: {
        ...character,
        dialogueStyle,
      },
    });
  } catch (error) {
    console.error('Get character error:', error);
    return c.json({ success: false, error: '获取角色详情失败' }, 500);
  }
});

// ============ 获取默认角色 ============
characters.get('/default', (c) => {
  try {
    const defaultCharacter = characterService.getDefaultCharacter();
    const defaultSet = characterService.getDefaultCharacterSet();
    const dialogueStyle = characterService.getDialogueStyle(defaultCharacter);
    
    return c.json({
      success: true,
      data: {
        character: {
          ...defaultCharacter,
          dialogueStyle,
        },
        set: {
          id: defaultSet.id,
          name: defaultSet.name,
          description: defaultSet.description,
        },
      },
    });
  } catch (error) {
    console.error('Get default character error:', error);
    return c.json({ success: false, error: '获取默认角色失败' }, 500);
  }
});

// ============ 根据行业推荐角色 ============
characters.get('/recommend', (c) => {
  try {
    const industry = c.req.query('industry');
    
    if (!industry) {
      return c.json({ success: false, error: '请提供行业参数' }, 400);
    }
    
    const recommendedCharacter = characterService.recommendCharacterByIndustry(industry);
    const dialogueStyle = characterService.getDialogueStyle(recommendedCharacter);
    
    // 查找该角色所属的角色集
    let characterSetId = DEFAULT_CHARACTER_SET_ID;
    for (const set of CHARACTER_SETS) {
      if (set.characters.some(c => c.id === recommendedCharacter.id)) {
        characterSetId = set.id;
        break;
      }
    }
    
    return c.json({
      success: true,
      data: {
        character: {
          ...recommendedCharacter,
          dialogueStyle,
        },
        characterSetId,
        industry,
        matchReason: recommendedCharacter.suitableFor?.find(i => 
          industry.includes(i) || i.includes(industry)
        ) || '默认推荐',
      },
    });
  } catch (error) {
    console.error('Recommend character error:', error);
    return c.json({ success: false, error: '推荐角色失败' }, 500);
  }
});

// ============ 获取所有角色（扁平列表）============
characters.get('/all', (c) => {
  try {
    const allCharacters: Array<IPCharacter & { setId: string; setName: string }> = [];
    
    for (const set of CHARACTER_SETS) {
      for (const character of set.characters) {
        allCharacters.push({
          ...character,
          setId: set.id,
          setName: set.name,
        });
      }
    }
    
    return c.json({
      success: true,
      data: allCharacters,
      total: allCharacters.length,
    });
  } catch (error) {
    console.error('Get all characters error:', error);
    return c.json({ success: false, error: '获取角色列表失败' }, 500);
  }
});

// ============ 构建角色图片提示词（预览用）============
characters.post('/build-prompt', async (c) => {
  try {
    const body = await c.req.json<{
      characterSetId: string;
      characterId: string;
      scene: string;
      action: string;
      mood: string;
    }>();
    
    const character = characterService.getCharacter(body.characterSetId, body.characterId);
    
    if (!character) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }
    
    const prompt = characterService.buildCharacterPrompt(
      character,
      body.scene || '办公室场景',
      body.action || '站立微笑',
      body.mood || '自信'
    );
    
    return c.json({
      success: true,
      data: {
        character: {
          id: character.id,
          name: character.name,
        },
        prompt,
      },
    });
  } catch (error) {
    console.error('Build prompt error:', error);
    return c.json({ success: false, error: '构建提示词失败' }, 500);
  }
});

// ============ 哪吒角色集快捷访问 ============
characters.get('/nezha', (c) => {
  return c.json({
    success: true,
    data: NEZHA_CHARACTERS,
  });
});

// ============ 商业角色集快捷访问 ============
characters.get('/business', (c) => {
  return c.json({
    success: true,
    data: BUSINESS_CHARACTERS,
  });
});

// ============ 内容风格相关 API ============

// 获取所有可用的内容风格
characters.get('/content-styles', (c) => {
  try {
    const styles = getAvailableContentStyles();
    
    // 返回风格概览（适合前端展示）
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

// 获取指定内容风格详情
characters.get('/content-styles/:styleId', (c) => {
  try {
    const styleId = c.req.param('styleId') as ComicContentStyle;
    const style = getContentStyleConfig(styleId);
    
    if (!style) {
      return c.json({ success: false, error: '内容风格不存在' }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        id: style.id,
        name: style.name,
        nameEn: style.nameEn,
        description: style.description,
        icon: style.icon,
        creativeFreedom: style.creativeFreedom,
        enforceSubPanels: style.enforceSubPanels,
        allowedLayouts: style.allowedLayouts,
      },
    });
  } catch (error) {
    console.error('Get content style error:', error);
    return c.json({ success: false, error: '获取内容风格详情失败' }, 500);
  }
});

// 获取组合配置（角色 + 风格）的推荐
characters.get('/comic-config', (c) => {
  try {
    const industry = c.req.query('industry');
    
    // 获取推荐角色
    const recommendedCharacter = industry 
      ? characterService.recommendCharacterByIndustry(industry)
      : characterService.getDefaultCharacter();
    
    // 查找角色集ID
    let characterSetId = DEFAULT_CHARACTER_SET_ID;
    for (const set of CHARACTER_SETS) {
      if (set.characters.some(ch => ch.id === recommendedCharacter.id)) {
        characterSetId = set.id;
        break;
      }
    }
    
    // 获取所有风格
    const styles = getAvailableContentStyles().map(s => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      description: s.description,
      creativeFreedom: s.creativeFreedom,
    }));
    
    return c.json({
      success: true,
      data: {
        recommendedConfig: {
          characterSetId,
          mainCharacterId: recommendedCharacter.id,
          contentStyle: 'creative' as ComicContentStyle,
          outputFormat: 'grid',
        },
        character: {
          id: recommendedCharacter.id,
          name: recommendedCharacter.name,
          displayName: recommendedCharacter.displayName,
          description: recommendedCharacter.description,
        },
        availableStyles: styles,
        availableFormats: [
          { id: 'grid', name: '网格布局', description: '8格漫画网格展示' },
          { id: 'vertical-scroll', name: '长图滚动', description: '微信公众号风格长图' },
        ],
      },
    });
  } catch (error) {
    console.error('Get comic config error:', error);
    return c.json({ success: false, error: '获取漫画配置失败' }, 500);
  }
});

export default characters;
