// 权限定义
export const PERMISSIONS = {
  // 用户管理权限
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",

  // 项目分组管理权限
  PROJECT_CREATE: "project:create",
  PROJECT_READ: "project:read",
  PROJECT_UPDATE: "project:update",
  PROJECT_DELETE: "project:delete",

  // 草图画板权限
  SCENE_CREATE: "scene:create",
  SCENE_READ: "scene:read",
  SCENE_UPDATE: "scene:update",
  SCENE_DELETE: "scene:delete",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type Role = "admin" | "user";

// 角色与权限映射表 (admin 拥有全量权限，user 仅拥有项目与草图权限)
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.SCENE_CREATE,
    PERMISSIONS.SCENE_READ,
    PERMISSIONS.SCENE_UPDATE,
    PERMISSIONS.SCENE_DELETE,
  ],
  user: [
    // 普通用户仅有项目与草图权限，无用户管理权限
    PERMISSIONS.PROJECT_CREATE,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_UPDATE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.SCENE_CREATE,
    PERMISSIONS.SCENE_READ,
    PERMISSIONS.SCENE_UPDATE,
    PERMISSIONS.SCENE_DELETE,
  ],
};

// 校验角色是否具备某权限
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}