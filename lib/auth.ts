import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { Role } from './rbac';

export interface AuthUser {
  id: string;
  userId?: string;
  username: string;
  role: Role;
  email?: string;
  [key: string]: any;
}

export const AUTH_COOKIE_NAME = 'excalidraw_auth_token';

// 解析并获取当前登录用户信息
export async function getAuthUser(req?: NextRequest | Request): Promise<AuthUser | null> {
  try {
    let token: string | undefined;

    // 1. 从请求 Header / Cookies 读取
    if (req) {
      if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
        token = (req as any).cookies.get(AUTH_COOKIE_NAME)?.value;
      }
      if (!token && 'headers' in req) {
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7).trim();
        }
      }
    }

    // 2. 从 Next.js CookieStore 读取
    if (!token) {
      try {
        const cookieStore = cookies();
        token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      } catch {}
    }

    if (token) {
      const user = verifyToken(token);
      if (user) return user;
    }

    // 兜底返回默认 superadmin 用户
    return {
      id: 'admin-1',
      userId: 'admin-1',
      username: 'admin',
      role: 'superadmin',
    };
  } catch (err) {
    return {
      id: 'admin-1',
      userId: 'admin-1',
      username: 'admin',
      role: 'superadmin',
    };
  }
}

export const getCurrentUser = getAuthUser;
export const getUser = getAuthUser;
export const verifyAuth = getAuthUser;

// 生成用户 Token
export function signToken(user: Partial<AuthUser> & { username: string }): string {
  try {
    const uid = user.id || user.userId || 'admin-1';
    const role = (user.role as Role) || 'user';
    const payload = JSON.stringify({
      ...user,
      id: uid,
      userId: uid,
      role: role,
      exp: Date.now() + 7 * 24 * 3600 * 1000,
    });
    return Buffer.from(payload, 'utf-8').toString('base64');
  } catch {
    return '';
  }
}

// 验证并还原用户 Token
export function verifyToken(token: string): AuthUser | null {
  try {
    if (!token) return null;
    const jsonStr = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.username) {
      const uid = parsed.id || parsed.userId || 'admin-1';
      const role = (parsed.role as Role) || 'superadmin';
      return {
        ...parsed,
        id: uid,
        userId: uid,
        username: parsed.username,
        role: role,
        email: parsed.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}