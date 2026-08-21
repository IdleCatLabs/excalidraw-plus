"use client";
import React, { useState, useEffect } from "react";
import { User, UserPlus, Trash2, X, Shield, Users, Loader2 } from "lucide-react";

interface UserItem {
  userId: string;
  username: string;
  role: "admin" | "user";
  createdAt: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManagementModal({ isOpen, onClose }: ModalProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setErrorMsg("");
    }
  }, [isOpen]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setNewUsername("");
        setNewPassword("");
        fetchUsers();
      } else {
        setErrorMsg(data.error || "添加用户失败");
      }
    } catch {
      setErrorMsg("网络异常");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`确定要删除成员「${username}」吗？`)) return;

    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.userId !== userId));
      } else {
        const data = await res.json();
        alert(data.error || "删除失败");
      }
    } catch {
      alert("删除请求异常");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>团队成员权限管理</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 添加新成员表单 */}
        <form onSubmit={handleAddUser} className="p-4 border-b bg-slate-50/50 flex flex-col gap-2.5">
          <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
            <span>添加新普通成员 (user)</span>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-500 bg-rose-50 p-2 rounded-lg border border-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="新成员用户名"
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="初始密码"
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
            >
              {submitting ? "添加中..." : "确认添加"}
            </button>
          </div>
        </form>

        {/* 成员列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>正在获取成员名单...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">暂无团队成员</div>
          ) : (
            users.map((u) => {
              const isAdmin = u.role === "admin" || u.username.toLowerCase() === "admin";
              return (
                <div
                  key={u.userId}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${isAdmin ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-600"}`}>
                      {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{u.username}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-normal ${
                          isAdmin ? "bg-indigo-50 text-indigo-600 border border-indigo-200" : "bg-slate-200 text-slate-600"
                        }`}>
                          {isAdmin ? "超级管理员" : "普通成员"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        创建时间：{new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {!isAdmin && (
                    <button
                      onClick={() => handleDeleteUser(u.userId, u.username)}
                      title="删除该成员"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}