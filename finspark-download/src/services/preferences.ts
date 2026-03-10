// 用户偏好设置服务
// 管理用户的个性化设置

export interface UserPreferences {
  // 分析偏好
  defaultReportType: 'annual' | 'quarterly' | 'all';
  analysisDepth: 'quick' | 'standard' | 'deep';
  includeComic: boolean;
  includeForecast: boolean;
  includeIndustryCompare: boolean;
  
  // 界面主题
  theme: 'dark' | 'light' | 'auto';
  language: string;
  chartColorScheme: 'gold' | 'blue' | 'green' | 'purple';
  
  // 通知设置
  emailNotifications: boolean;
  reportCompleteNotify: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  
  // 快捷设置
  favoriteStocks: string[];
  recentSearches: string[];
  pinnedReports: number[];
  
  // 高级设置
  exportFormat: 'pdf' | 'html' | 'json';
}

export interface PreferencesUpdateInput {
  [key: string]: any;
}

// 默认偏好设置
export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultReportType: 'annual',
  analysisDepth: 'standard',
  includeComic: true,
  includeForecast: true,
  includeIndustryCompare: true,
  
  theme: 'dark',
  language: 'zh-CN',
  chartColorScheme: 'gold',
  
  emailNotifications: true,
  reportCompleteNotify: true,
  weeklyDigest: false,
  marketingEmails: false,
  
  favoriteStocks: [],
  recentSearches: [],
  pinnedReports: [],
  
  exportFormat: 'pdf'
};

// 数据库字段到接口字段的映射
const DB_TO_INTERFACE_MAP: Record<string, string> = {
  default_report_type: 'defaultReportType',
  analysis_depth: 'analysisDepth',
  include_comic: 'includeComic',
  include_forecast: 'includeForecast',
  include_industry_compare: 'includeIndustryCompare',
  theme: 'theme',
  language: 'language',
  chart_color_scheme: 'chartColorScheme',
  email_notifications: 'emailNotifications',
  report_complete_notify: 'reportCompleteNotify',
  weekly_digest: 'weeklyDigest',
  marketing_emails: 'marketingEmails',
  favorite_stocks: 'favoriteStocks',
  recent_searches: 'recentSearches',
  pinned_reports: 'pinnedReports',
  export_format: 'exportFormat'
};

const INTERFACE_TO_DB_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(DB_TO_INTERFACE_MAP).map(([k, v]) => [v, k])
);

export class PreferencesService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * 获取用户偏好设置
   */
  async getUserPreferences(userId: number): Promise<UserPreferences> {
    const row = await this.db.prepare(
      'SELECT * FROM user_preferences WHERE user_id = ?'
    ).bind(userId).first();
    
    if (!row) {
      // 返回默认设置
      return { ...DEFAULT_PREFERENCES };
    }
    
    return this.rowToPreferences(row);
  }
  
  /**
   * 更新用户偏好设置
   */
  async updateUserPreferences(
    userId: number, 
    updates: PreferencesUpdateInput
  ): Promise<UserPreferences> {
    // 检查是否已有偏好记录
    const existing = await this.db.prepare(
      'SELECT id FROM user_preferences WHERE user_id = ?'
    ).bind(userId).first();
    
    // 转换字段名
    const dbUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = INTERFACE_TO_DB_MAP[key] || key;
      
      // 处理数组类型
      if (Array.isArray(value)) {
        dbUpdates[dbKey] = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        dbUpdates[dbKey] = value ? 1 : 0;
      } else {
        dbUpdates[dbKey] = value;
      }
    }
    
    if (existing) {
      // 更新现有记录
      const setClause = Object.keys(dbUpdates)
        .map(k => `${k} = ?`)
        .join(', ');
      const values = [...Object.values(dbUpdates), userId];
      
      await this.db.prepare(`
        UPDATE user_preferences 
        SET ${setClause}, updated_at = datetime('now')
        WHERE user_id = ?
      `).bind(...values).run();
      
      // 记录变更历史
      for (const [key, value] of Object.entries(updates)) {
        await this.recordChange(userId, key, null, value);
      }
    } else {
      // 创建新记录
      const keys = ['user_id', ...Object.keys(dbUpdates)];
      const placeholders = keys.map(() => '?').join(', ');
      const values = [userId, ...Object.values(dbUpdates)];
      
      await this.db.prepare(`
        INSERT INTO user_preferences (${keys.join(', ')})
        VALUES (${placeholders})
      `).bind(...values).run();
    }
    
    return this.getUserPreferences(userId);
  }
  
  /**
   * 重置用户偏好为默认值
   */
  async resetUserPreferences(userId: number): Promise<UserPreferences> {
    await this.db.prepare(
      'DELETE FROM user_preferences WHERE user_id = ?'
    ).bind(userId).run();
    
    await this.recordChange(userId, 'all', 'custom', 'default');
    
    return { ...DEFAULT_PREFERENCES };
  }
  
  /**
   * 添加常用股票
   */
  async addFavoriteStock(userId: number, stockCode: string): Promise<string[]> {
    const prefs = await this.getUserPreferences(userId);
    const favorites = prefs.favoriteStocks || [];
    
    if (!favorites.includes(stockCode)) {
      favorites.unshift(stockCode);
      // 最多保留20个
      if (favorites.length > 20) {
        favorites.pop();
      }
      
      await this.updateUserPreferences(userId, { favoriteStocks: favorites });
    }
    
    return favorites;
  }
  
  /**
   * 移除常用股票
   */
  async removeFavoriteStock(userId: number, stockCode: string): Promise<string[]> {
    const prefs = await this.getUserPreferences(userId);
    const favorites = (prefs.favoriteStocks || []).filter(s => s !== stockCode);
    
    await this.updateUserPreferences(userId, { favoriteStocks: favorites });
    
    return favorites;
  }
  
  /**
   * 添加最近搜索
   */
  async addRecentSearch(userId: number, searchTerm: string): Promise<void> {
    const prefs = await this.getUserPreferences(userId);
    const recent = prefs.recentSearches || [];
    
    // 移除重复项
    const filtered = recent.filter(s => s !== searchTerm);
    filtered.unshift(searchTerm);
    
    // 最多保留50个
    if (filtered.length > 50) {
      filtered.pop();
    }
    
    await this.updateUserPreferences(userId, { recentSearches: filtered });
  }
  
  /**
   * 清除最近搜索
   */
  async clearRecentSearches(userId: number): Promise<void> {
    await this.updateUserPreferences(userId, { recentSearches: [] });
  }
  
  /**
   * 获取偏好变更历史
   */
  async getPreferencesHistory(userId: number, limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM user_preferences_history 
      WHERE user_id = ? 
      ORDER BY changed_at DESC 
      LIMIT ?
    `).bind(userId, limit).all();
    
    return result.results || [];
  }
  
  /**
   * 记录偏好变更
   */
  private async recordChange(
    userId: number, 
    key: string, 
    oldValue: any, 
    newValue: any
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO user_preferences_history (user_id, preference_key, old_value, new_value)
      VALUES (?, ?, ?, ?)
    `).bind(
      userId, 
      key, 
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    ).run();
  }
  
  /**
   * 将数据库行转换为偏好对象
   */
  private rowToPreferences(row: Record<string, any>): UserPreferences {
    const prefs = { ...DEFAULT_PREFERENCES };
    
    for (const [dbKey, interfaceKey] of Object.entries(DB_TO_INTERFACE_MAP)) {
      if (row[dbKey] !== undefined && row[dbKey] !== null) {
        const value = row[dbKey];
        
        // 处理JSON数组字段
        if (['favorite_stocks', 'recent_searches', 'pinned_reports'].includes(dbKey)) {
          try {
            (prefs as any)[interfaceKey] = typeof value === 'string' ? JSON.parse(value) : value;
          } catch {
            (prefs as any)[interfaceKey] = [];
          }
        }
        // 处理布尔字段
        else if (['include_comic', 'include_forecast', 'include_industry_compare', 
                  'email_notifications', 'report_complete_notify', 'weekly_digest', 
                  'marketing_emails'].includes(dbKey)) {
          (prefs as any)[interfaceKey] = value === 1 || value === true;
        }
        // 其他字段直接赋值
        else {
          (prefs as any)[interfaceKey] = value;
        }
      }
    }
    
    return prefs;
  }
}

export function createPreferencesService(db: D1Database): PreferencesService {
  return new PreferencesService(db);
}
