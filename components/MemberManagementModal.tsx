'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Trash2,
  Shield,
  Edit3,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
} from 'lucide-react';

export interface ProjectMember {
  id: string;
  username: string;
  email?: string;
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: string;
}

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  projectName?: string;
}

const DEFAULT_MEMBERS: ProjectMember[] = [
  {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@idlecatlabs.net',
    role: 'admin',
    joinedAt: '2026-01-01',
  },
  {
    id: 'user-demo1',
    username: 'designer_lily',
    email: 'lily@company.com',
    role: 'editor',
    joinedAt: '2026-03-12',
  },
  {
    id: 'user-demo2',
    username: 'viewer_tom',
    email: 'tom@company.com',
    role: 'viewer',
    joinedAt: '2026-05-20',
  },
];

export default function MemberManagementModal({
  isOpen,
  onClose,
  projectId = 'default-project',
  projectName = '默认项目',
}: MemberManagementModalProps) {
  const [members, setMembers] = useState<ProjectMember[]>(DEFAULT_MEMBERS);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newRole, setNewRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | null; text: string }>({
    type: null,
    text: '',
  });

  const storageKey = `project_members_${projectId}`;

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg({ type: null, text: '' });
    try {
      const local = localStorage.getItem(storageKey);
      if (local) {
        setMembers(JSON.parse(local));
      } else {
        setMembers(DEFAULT_MEMBERS);
      }
    } catch {
      setMembers(DEFAULT_MEMBERS);
    }
  }, [isOpen, storageKey]);

  const saveMembers = (updated: ProjectMember[]) => {
    setMembers(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const uname = newUsername.trim();
    if (!uname) {
      setStatusMsg({ type: 'error', text: '请输入成员用户名或邮箱' });
      return;
    }

    if (members.some((m) => m.username.toLowerCase() === uname.toLowerCase())) {
      setStatusMsg({ type: 'error', text: '该成员已存在于当前项目中' });
      return;
    }

    const newMem: ProjectMember = {
      id: `mem-${Date.now()}`,
      username: uname,
      email: uname.includes('@') ? uname : `${uname}@company.com`,
      role: newRole,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    const updated = [newMem, ...members];
    saveMembers(updated);
    setNewUsername('');
    setStatusMsg({ type: 'success', text: `已成功添加成员 ${uname}` });
    setTimeout(() => setStatusMsg({ type: null, text: '' }), 2500);
  };

  const handleRoleChange = (memberId: string, role: 'admin' | 'editor' | 'viewer') => {
    const updated = members.map((m) => (m.id === memberId ? { ...m, role } : m));
    saveMembers(updated);
  };

  const handleRemoveMember = (memberId: string, username: string) => {
    if (username === 'admin') {
      alert('不能移除默认主管理员');
      return;
    }
    if (!confirm(`确定要将成员 "${username}" 移出当前项目吗？`)) return;
    const updated = members.filter((m) => m.id !== memberId);
    saveMembers(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
        {/* 头部 */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                项目成员权限管理
                <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                  {projectName}
                </span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                管理当前项目中成员的协同编辑与只读访问权限
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 状态提示条 */}
        {statusMsg.type && (
          <div className="px-6 pt-3">
            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          </div>
        )}

        {/* 添加新成员表单 */}
        <div className="px-6 pt-4 pb-3 bg-gray-50/60 border-b border-gray-100">
          <form onSubmit={handleAddMember} className="flex items-center gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="输入用户名或邮箱添加成员..."
              className="flex-1 text-xs px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              className="text-xs px-3 py-2.5 bg-white border border-gray-300 rounded-xl outline-none text-gray-700 font-medium"
            >
              <option value="editor">编辑者（可编辑画板）</option>
              <option value="admin">管理员（完全权限）</option>
              <option value="viewer">浏览者（仅只读）</option>
            </select>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>添加成员</span>
            </button>
          </form>
        </div>

        {/* 成员列表主体 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 divide-y divide-gray-50">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            当前成员列表（共 {members.length} 人）
          </div>

          {members.map((member) => (
            <div
              key={member.id}
              className="pt-2.5 first:pt-0 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                  {member.username[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{member.username}</span>
                    {member.username === 'admin' && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">
                        拥有者
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono">{member.email}</p>
                </div>
              </div>

              {/* 权限选择与移除 */}
              <div className="flex items-center gap-2">
                <select
                  disabled={member.username === 'admin'}
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value as any)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold outline-none transition ${
                    member.role === 'admin'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : member.role === 'editor'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  } disabled:opacity-60`}
                >
                  <option value="admin">管理员</option>
                  <option value="editor">编辑者</option>
                  <option value="viewer">浏览者</option>
                </select>

                {member.username !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.id, member.username)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="移出项目"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 底部关闭 */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}