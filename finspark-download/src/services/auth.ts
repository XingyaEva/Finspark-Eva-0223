// 用户认证服务 - JWT + D1 数据库
// 提供注册、登录、令牌验证等功能

import type { Bindings } from '../types';

// ============ 类型定义 ============
export interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface JWTPayload {
  sub: number;        // user id
  email: string;
  name: string;
  tier: string;
  iat: number;        // issued at
  exp: number;        // expiration
}

export interface AuthResult {
  success: boolean;
  user?: Omit<UserRecord, 'password_hash'>;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

// ============ 密码哈希 ============
// 使用 Web Crypto API (Cloudflare Workers 支持)

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // 生成随机盐
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 使用 PBKDF2 派生密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // 返回格式: salt$hash
  return `${saltHex}$${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, expectedHash] = storedHash.split('$');
  if (!saltHex || !expectedHash) return false;
  
  // 从十六进制还原盐
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === expectedHash;
}

// ============ JWT 工具函数 ============

function base64UrlEncode(data: Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    // 使用 TextEncoder 正确处理 Unicode 字符
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }
  
  // 手动进行 base64 编码以避免 btoa 的 Latin1 限制
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    
    result += base64Chars[b1 >> 2];
    result += base64Chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? base64Chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? base64Chars[b3 & 63] : '=';
  }
  
  // 转换为 URL 安全格式
  return result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToBytes(str: string): Uint8Array {
  // 转换回标准 base64
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = str.length % 4;
  if (padding) {
    str += '='.repeat(4 - padding);
  }
  
  // 手动解码 base64
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  
  for (let i = 0; i < str.length; i += 4) {
    const c1 = base64Chars.indexOf(str[i]);
    const c2 = base64Chars.indexOf(str[i + 1]);
    const c3 = str[i + 2] === '=' ? 0 : base64Chars.indexOf(str[i + 2]);
    const c4 = str[i + 3] === '=' ? 0 : base64Chars.indexOf(str[i + 3]);
    
    bytes.push((c1 << 2) | (c2 >> 4));
    if (str[i + 2] !== '=') bytes.push(((c2 & 15) << 4) | (c3 >> 2));
    if (str[i + 3] !== '=') bytes.push(((c3 & 3) << 6) | c4);
  }
  
  return new Uint8Array(bytes);
}

function base64UrlDecode(str: string): string {
  // 使用 TextDecoder 解码 UTF-8
  return new TextDecoder().decode(base64UrlDecodeToBytes(str));
}

async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresIn: number): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };
  
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const message = `${headerB64}.${payloadB64}`;
  
  // 使用 HMAC-SHA256 签名
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  
  return `${message}.${signatureB64}`;
}

async function verifyJWT(token: string, secret: string): Promise<TokenValidationResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: '无效的令牌格式' };
    }
    
    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;
    
    // 验证签名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // 还原签名 - 直接解码为字节数组
    const signature = base64UrlDecodeToBytes(signatureB64);
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(message)
    );
    
    if (!isValid) {
      return { valid: false, error: '签名验证失败' };
    }
    
    // 解析 payload
    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));
    
    // 检查过期
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: '令牌已过期' };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: '令牌解析失败' };
  }
}

// ============ 认证服务类 ============

export class AuthService {
  private db: D1Database;
  private jwtSecret: string;
  
  // 令牌有效期
  private readonly ACCESS_TOKEN_EXPIRY = 60 * 60;           // 1小时
  private readonly REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7天
  
  constructor(db: D1Database, jwtSecret: string) {
    this.db = db;
    this.jwtSecret = jwtSecret;
  }
  
  /**
   * 用户注册
   */
  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    // 验证邮箱格式
    if (!this.isValidEmail(email)) {
      return { success: false, error: '邮箱格式不正确' };
    }
    
    // 验证密码强度
    if (password.length < 6) {
      return { success: false, error: '密码长度至少6位' };
    }
    
    try {
      // 检查邮箱是否已存在
      const existing = await this.db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email.toLowerCase()).first();
      
      if (existing) {
        return { success: false, error: '该邮箱已被注册' };
      }
      
      // 哈希密码
      const passwordHash = await hashPassword(password);
      
      // 插入用户
      const result = await this.db.prepare(`
        INSERT INTO users (email, password_hash, name, subscription_tier)
        VALUES (?, ?, ?, 'free')
      `).bind(email.toLowerCase(), passwordHash, name || null).run();
      
      const userId = result.meta.last_row_id as number;
      
      // 获取用户信息
      const user = await this.getUserById(userId);
      if (!user) {
        return { success: false, error: '创建用户失败' };
      }
      
      // 生成令牌
      const { accessToken, refreshToken } = await this.generateTokens(user);
      
      // 保存刷新令牌
      await this.saveRefreshToken(userId, refreshToken);
      
      return {
        success: true,
        user,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: '注册失败，请稍后重试' };
    }
  }
  
  /**
   * 用户登录
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // 查找用户
      const user = await this.db.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(email.toLowerCase()).first<UserRecord>();
      
      if (!user) {
        return { success: false, error: '邮箱或密码错误' };
      }
      
      // 验证密码
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: '邮箱或密码错误' };
      }
      
      // 生成令牌
      const userWithoutPassword = this.stripPassword(user);
      const { accessToken, refreshToken } = await this.generateTokens(userWithoutPassword);
      
      // 保存刷新令牌
      await this.saveRefreshToken(user.id, refreshToken);
      
      return {
        success: true,
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '登录失败，请稍后重试' };
    }
  }
  
  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      // 验证刷新令牌
      const validation = await verifyJWT(refreshToken, this.jwtSecret);
      if (!validation.valid || !validation.payload) {
        return { success: false, error: validation.error || '无效的刷新令牌' };
      }
      
      // 检查数据库中的刷新令牌
      const session = await this.db.prepare(
        'SELECT * FROM user_sessions WHERE refresh_token = ? AND expires_at > datetime("now")'
      ).bind(refreshToken).first();
      
      if (!session) {
        return { success: false, error: '刷新令牌已失效' };
      }
      
      // 获取用户
      const user = await this.getUserById(validation.payload.sub);
      if (!user) {
        return { success: false, error: '用户不存在' };
      }
      
      // 生成新的访问令牌
      const accessToken = await signJWT(
        {
          sub: user.id,
          email: user.email,
          name: user.name || '',
          tier: user.subscription_tier,
        },
        this.jwtSecret,
        this.ACCESS_TOKEN_EXPIRY
      );
      
      return {
        success: true,
        user,
        accessToken,
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return { success: false, error: '刷新令牌失败' };
    }
  }
  
  /**
   * 验证访问令牌
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    return verifyJWT(token, this.jwtSecret);
  }
  
  /**
   * 登出（撤销刷新令牌）
   */
  async logout(refreshToken: string): Promise<boolean> {
    try {
      await this.db.prepare(
        'DELETE FROM user_sessions WHERE refresh_token = ?'
      ).bind(refreshToken).run();
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }
  
  /**
   * 登出所有设备
   */
  async logoutAllDevices(userId: number): Promise<boolean> {
    try {
      await this.db.prepare(
        'DELETE FROM user_sessions WHERE user_id = ?'
      ).bind(userId).run();
      return true;
    } catch (error) {
      console.error('Logout all error:', error);
      return false;
    }
  }
  
  /**
   * 更新用户信息
   */
  async updateUser(userId: number, updates: { name?: string; avatar_url?: string }): Promise<Omit<UserRecord, 'password_hash'> | null> {
    try {
      const fields: string[] = [];
      const values: (string | null)[] = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.avatar_url !== undefined) {
        fields.push('avatar_url = ?');
        values.push(updates.avatar_url);
      }
      
      if (fields.length === 0) return this.getUserById(userId);
      
      fields.push('updated_at = datetime("now")');
      values.push(String(userId));
      
      await this.db.prepare(`
        UPDATE users SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values).run();
      
      return this.getUserById(userId);
    } catch (error) {
      console.error('Update user error:', error);
      return null;
    }
  }
  
  /**
   * 修改密码
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.db.prepare(
        'SELECT password_hash FROM users WHERE id = ?'
      ).bind(userId).first<{ password_hash: string }>();
      
      if (!user) {
        return { success: false, error: '用户不存在' };
      }
      
      // 验证旧密码
      const isValid = await verifyPassword(oldPassword, user.password_hash);
      if (!isValid) {
        return { success: false, error: '当前密码错误' };
      }
      
      // 验证新密码
      if (newPassword.length < 6) {
        return { success: false, error: '新密码长度至少6位' };
      }
      
      // 更新密码
      const newHash = await hashPassword(newPassword);
      await this.db.prepare(
        'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(newHash, userId).run();
      
      // 撤销所有刷新令牌（强制重新登录）
      await this.logoutAllDevices(userId);
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: '修改密码失败' };
    }
  }
  
  /**
   * 请求密码重置（生成 reset token 存入 DB）
   * 出于安全考虑，不论邮箱是否存在都返回成功
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!this.isValidEmail(email)) {
      return { success: false, error: '邮箱格式不正确' };
    }

    try {
      const user = await this.db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email.toLowerCase()).first<{ id: number }>();

      if (user) {
        // 生成随机 token
        const resetToken = this.generateResetToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1小时有效

        await this.db.prepare(`
          UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?
        `).bind(resetToken, expiresAt, user.id).run();

        // TODO: 发送邮件（当前无邮件服务，仅存储 token）
        // 在控制台输出重置链接，方便调试
        console.log(`[PasswordReset] Token for ${email}: ${resetToken}`);
        console.log(`[PasswordReset] Reset URL: /reset-password?token=${resetToken}`);
      }

      // 无论邮箱是否存在都返回成功（防止邮箱枚举攻击）
      return {
        success: true,
        message: '如果该邮箱已注册，你将收到一封密码重置邮件。请检查你的收件箱。',
      };
    } catch (error) {
      console.error('Request password reset error:', error);
      return { success: false, error: '请求失败，请稍后重试' };
    }
  }

  /**
   * 使用 token 重置密码
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (!token) {
      return { success: false, error: '无效的重置令牌' };
    }

    if (newPassword.length < 8) {
      return { success: false, error: '密码长度至少8位' };
    }

    try {
      // 查找拥有该 token 且未过期的用户
      const user = await this.db.prepare(`
        SELECT id FROM users 
        WHERE reset_token = ? AND reset_token_expires > datetime('now')
      `).bind(token).first<{ id: number }>();

      if (!user) {
        return { success: false, error: '重置链接无效或已过期，请重新申请' };
      }

      // 哈希新密码
      const passwordHash = await hashPassword(newPassword);

      // 更新密码并清除 reset token
      await this.db.prepare(`
        UPDATE users 
        SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).bind(passwordHash, user.id).run();

      // 清除所有会话（安全起见，强制重新登录）
      await this.db.prepare(
        'DELETE FROM user_sessions WHERE user_id = ?'
      ).bind(user.id).run();

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: '重置密码失败，请稍后重试' };
    }
  }

  private generateResetToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // ============ 私有方法 ============
  
  private async getUserById(id: number): Promise<Omit<UserRecord, 'password_hash'> | null> {
    const user = await this.db.prepare(
      'SELECT id, email, name, avatar_url, subscription_tier, created_at, updated_at FROM users WHERE id = ?'
    ).bind(id).first<Omit<UserRecord, 'password_hash'>>();
    return user;
  }
  
  private stripPassword(user: UserRecord): Omit<UserRecord, 'password_hash'> {
    const { password_hash, ...rest } = user;
    return rest;
  }
  
  private async generateTokens(user: Omit<UserRecord, 'password_hash'>): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name || '',
      tier: user.subscription_tier,
    };
    
    const accessToken = await signJWT(payload, this.jwtSecret, this.ACCESS_TOKEN_EXPIRY);
    const refreshToken = await signJWT(payload, this.jwtSecret, this.REFRESH_TOKEN_EXPIRY);
    
    return { accessToken, refreshToken };
  }
  
  private async saveRefreshToken(userId: number, refreshToken: string, deviceInfo?: string, ipAddress?: string): Promise<void> {
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000).toISOString();
    
    await this.db.prepare(`
      INSERT INTO user_sessions (user_id, refresh_token, device_info, ip_address, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, refreshToken, deviceInfo || null, ipAddress || null, expiresAt).run();
  }
  
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

/**
 * 创建认证服务实例
 */
export function createAuthService(db: D1Database, jwtSecret: string): AuthService {
  return new AuthService(db, jwtSecret);
}
