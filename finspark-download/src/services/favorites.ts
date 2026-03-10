// 用户收藏服务 - 股票收藏管理

export interface FavoriteRecord {
  id: number;
  user_id: number;
  stock_code: string;
  stock_name: string;
  notes: string | null;
  created_at: string;
}

export interface FavoriteWithStock extends FavoriteRecord {
  industry?: string;
  market?: string;
}

export class FavoritesService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * 添加收藏
   */
  async addFavorite(userId: number, stockCode: string, stockName: string, notes?: string): Promise<{ success: boolean; favorite?: FavoriteRecord; error?: string }> {
    try {
      // 检查是否已收藏
      const existing = await this.db.prepare(
        'SELECT id FROM user_favorites WHERE user_id = ? AND stock_code = ?'
      ).bind(userId, stockCode).first();
      
      if (existing) {
        return { success: false, error: '该股票已在收藏中' };
      }
      
      const result = await this.db.prepare(`
        INSERT INTO user_favorites (user_id, stock_code, stock_name, notes)
        VALUES (?, ?, ?, ?)
      `).bind(userId, stockCode, stockName, notes || null).run();
      
      const favorite = await this.db.prepare(
        'SELECT * FROM user_favorites WHERE id = ?'
      ).bind(result.meta.last_row_id).first<FavoriteRecord>();
      
      return { success: true, favorite: favorite || undefined };
    } catch (error) {
      console.error('Add favorite error:', error);
      return { success: false, error: '添加收藏失败' };
    }
  }
  
  /**
   * 移除收藏
   */
  async removeFavorite(userId: number, stockCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.db.prepare(
        'DELETE FROM user_favorites WHERE user_id = ? AND stock_code = ?'
      ).bind(userId, stockCode).run();
      
      if (result.meta.changes === 0) {
        return { success: false, error: '收藏不存在' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Remove favorite error:', error);
      return { success: false, error: '移除收藏失败' };
    }
  }
  
  /**
   * 获取用户所有收藏
   */
  async getUserFavorites(userId: number): Promise<FavoriteWithStock[]> {
    try {
      const result = await this.db.prepare(`
        SELECT f.*, s.industry, s.market
        FROM user_favorites f
        LEFT JOIN stocks s ON f.stock_code = s.ts_code
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
      `).bind(userId).all<FavoriteWithStock>();
      
      return result.results || [];
    } catch (error) {
      console.error('Get favorites error:', error);
      return [];
    }
  }
  
  /**
   * 检查是否已收藏
   */
  async isFavorite(userId: number, stockCode: string): Promise<boolean> {
    try {
      const result = await this.db.prepare(
        'SELECT id FROM user_favorites WHERE user_id = ? AND stock_code = ?'
      ).bind(userId, stockCode).first();
      return !!result;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 更新收藏备注
   */
  async updateNotes(userId: number, stockCode: string, notes: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.db.prepare(
        'UPDATE user_favorites SET notes = ? WHERE user_id = ? AND stock_code = ?'
      ).bind(notes, userId, stockCode).run();
      
      if (result.meta.changes === 0) {
        return { success: false, error: '收藏不存在' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Update notes error:', error);
      return { success: false, error: '更新备注失败' };
    }
  }
  
  /**
   * 获取收藏数量
   */
  async getFavoriteCount(userId: number): Promise<number> {
    try {
      const result = await this.db.prepare(
        'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?'
      ).bind(userId).first<{ count: number }>();
      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }
}

export function createFavoritesService(db: D1Database): FavoritesService {
  return new FavoritesService(db);
}
