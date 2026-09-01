export type Role = 'superadmin' | 'admin' | 'editor' | 'viewer' | 'user';

export const ROLES = {
  SUPERADMIN: 'superadmin' as Role,
  ADMIN: 'admin' as Role,
  EDITOR: 'editor' as Role,
  VIEWER: 'viewer' as Role,
  USER: 'user' as Role,
};

export const PERMISSIONS = {
  // 用户管理
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',

  // 项目管理
  PROJECT_READ: 'project:read',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MANAGE: 'project:manage',

  // 成员管理
  MEMBER_READ: 'member:read',
  MEMBER_MANAGE: 'member:manage',

  // 画板场景
  SCENE_READ: 'scene:read',
  SCENE_WRITE: 'scene:write',
  SCENE_DELETE: 'scene:delete',

  // AI 与配置
  LLM_USE: 'llm:use',
  LLM_CONFIG: 'llm:config',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

// 角色与权限映射表
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  superadmin: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_MANAGE,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.MEMBER_MANAGE,
    PERMISSIONS.SCENE_READ,
    PERMISSIONS.SCENE_WRITE,
    PERMISSIONS.SCENE_DELETE,
    PERMISSIONS.LLM_USE,
    PERMISSIONS.LLM_CONFIG,
  ],
  editor: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.SCENE_READ,
    PERMISSIONS.SCENE_WRITE,
    PERMISSIONS.LLM_USE,
    PERMISSIONS.LLM_CONFIG,
  ],
  user: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.SCENE_READ,
    PERMISSIONS.SCENE_WRITE,
    PERMISSIONS.LLM_USE,
    PERMISSIONS.LLM_CONFIG,
  ],
  viewer: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.MEMBER_READ,
    PERMISSIONS.SCENE_READ,
  ],
};

// 核心校验方法：兼容接收 Role 或任意 string
export function hasPermission(
  role?: Role | string | null,
  permission?: Permission
): boolean {
  if (!role || !permission) return false;

  const normalizedRole = (role.toLowerCase() as Role);

  // superadmin 拥有所有权限
  if (normalizedRole === 'superadmin') return true;

  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;

  return permissions.includes(permission);
}

// 检查是否具备角色管理权限
export function canManageRole(operatorRole: Role | string, targetRole: Role | string): boolean {
  const op = operatorRole.toLowerCase();
  const target = targetRole.toLowerCase();

  if (op === 'superadmin') return true;
  if (op === 'admin') {
    return target !== 'superadmin' && target !== 'admin';
  }
  return false;
}