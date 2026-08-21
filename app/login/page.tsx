"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, User, Sparkles, ArrowRight, Loader2 } from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("请填写用户名和密码");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        router.push(from);
        router.refresh();
      } else {
        setErrorMsg(data.error || "登录失败，请检查账号密码");
      }
    } catch {
      setErrorMsg("网络请求异常，请检查服务状态");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Excalidraw Plus</h1>
        <p className="text-xs text-slate-400 mt-1">AI 驱动的智能架构草图与多项目工作台</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">账号名称</label>
          <div className="relative flex items-center">
            <User className="w-4 h-4 text-slate-500 absolute left-3" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名（如：admin）"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">登录密码</label>
          <div className="relative flex items-center">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入登录密码"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>正在验证登录...</span>
            </>
          ) : (
            <>
              <span>进入工作台</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-[11px] text-slate-500">
        可使用管理员账号或新用户名登录，系统将自动分配隔离存储空间
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 p-4 select-none relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <Suspense fallback={<div className="text-slate-400 text-xs">正在载入登录页...</div>}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}