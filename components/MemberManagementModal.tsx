'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Check,
  Copy,
  Crown,
  ShieldCheck,
  Eye,
  Edit3,
} from 'lucide-react';

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  avatarColor: string;
  joinedAt: string;
  isCurrentUser?: boolean;
}

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 升级缓存 Key 版本，自动覆盖清理旧的 Mock 用户
const STORAGE_KEY_MEMBERS = 'excalidraw_plus_members_v2';

// 仅保留当前登录账户
const INITIAL_MEMBERS: Member[] = [
  {
    id: 'm-1',
    name: 'admin (我)',
    email: 'admin@idlecatlabs.net',
    role: 'owner',
    avatarColor: 'bg-indigo-600',
    joinedAt: '2026-08-01',
    isCurrentUser: true,
  },
];

const ROLE_CONFIG: Record<MemberRole, { label: string; icon: any; color: string; desc: string }> = {
  owner: {
    label: '创建者 (所有者)',
    icon: Crown,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    desc: '拥有最高权限，可管理项目与删除空间',
  },
  admin: {
    label: '管理员',
    icon: ShieldCheck,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    desc: '可管理所有画板、成员权限与邀请新成员',
  },
  editor: {
    label: '编辑者',
    icon: Edit3,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    desc: '可实时协作绘制、保存草图与使用 AI 助手',
  },
  viewer: {
    label: '只读访客',
    icon: Eye,
    color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
    desc: '仅可查看与缩放浏览画布，不可修改内容',
  },
};

const RANDOM_COLORS = [
  'bg-blue-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-teal-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-emerald-600',
];

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [members, setMembers] = useState<Member[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return INITIAL_MEMBERS;
  });

  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('editor');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
    }
  }, [members]);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;

    if (members.some((m) => m.email.toLowerCase() === trimmed.toLowerCase())) {
      alert('该邮箱用户已在成员列表中');
      return;
    }

    const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
    const username = trimmed.split('@')[0];

    const newMember: Member = {
      id: `m-${Date.now()}`,
      name: username,
      email: trimmed,
      role: inviteRole,
      avatarColor: randomColor,
      joinedAt: '刚刚',
    };

    setMembers((prev) => [...prev, newMember]);
    setInviteEmail('');
  };

  const handleRoleChange = (memberId: string, nextRole: MemberRole) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: nextRole } : m))
    );
  };

  const handleRemoveMember = (member: Member) => {
    if (member.role === 'owner') {
      alert('不可移除空间创建者');
      return;
    }
    if (confirm(`确定将成员「${member.name} (${member.email})」移出团队吗？`)) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    }
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}?invite=${Math.random().toString(36).slice(2, 10)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                团队成员与协作权限
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                管理协作空间的成员角色分配与访问权限 (共 {members.length} 人)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 邀请栏 */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="输入协作者邮箱 (如 user@company.com)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MemberRole)}
              className="px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-700 dark:text-zinc-200 font-medium"
            >
              <option value="editor">编辑者 (可协作绘制)</option>
              <option value="admin">管理员 (可管理成员)</option>
              <option value="viewer">只读访客 (仅查看)</option>
            </select>

            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              添加成员
            </button>
          </form>

          <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-500">
            <span>通过专属链接邀请协作者：</span>
            <button
              onClick={handleCopyInviteLink}
              className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copiedLink ? '邀请链接已复制' : '复制快捷邀请链接'}
            </button>
          </div>
        </div>

        {/* 成员列表 */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {members.map((member) => {
            const roleInfo = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
            const RoleIcon = roleInfo.icon;

            return (
              <div
                key={member.id}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                {/* 头像与信息 */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full ${member.avatarColor} text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {member.name}
                      </span>
                      {member.isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">
                          当前账户
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">{member.email}</p>
                  </div>
                </div>

                {/* 角色与操作 */}
                <div className="flex items-center gap-3 shrink-0">
                  {member.role === 'owner' ? (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${roleInfo.color}`}>
                      <RoleIcon className="w-3.5 h-3.5" />
                      <span>{roleInfo.label}</span>
                    </div>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as MemberRole)}
                      className="px-2.5 py-1 text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200 font-medium"
                    >
                      <option value="admin">管理员</option>
                      <option value="editor">编辑者</option>
                      <option value="viewer">只读访客</option>
                    </select>
                  )}

                  {!member.isCurrentUser && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      title="移出团队"
                      className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            团队协作与权限控制已生效
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-medium transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberManagementModal;