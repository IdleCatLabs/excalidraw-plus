"use client";
import React, { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ExcalidrawWrapper, { ExcalidrawRef } from "@/components/ExcalidrawWrapper";
import AiSidebar, { ChatThread, MessageItem } from "@/components/AiSidebar";
import CodePreviewModal from "@/components/CodePreviewModal";
import ProjectDrawer from "@/components/ProjectDrawer";
import UserManagementModal from "@/components/UserManagementModal";
import { Save, Share2, Menu, Code2, Check, Cloud, User, LogOut, Users, Shield } from "lucide-react";

function createDefaultThread(title = "主设计会话"): ChatThread {
  return {
    id: `thread_${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    messages: [
      { role: "assistant", content: "你好！支持文字对话与智能画图，请选择模型开始。" },
    ],
  };
}

export default function WorkspacePage() {
  const router = useRouter();
  const excalidrawRef = useRef<ExcalidrawRef>(null);
  
  const [currentUser, setCurrentUser] = useState<{ userId: string; username: string; role: "admin" | "user" } | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // 草图与分组状态
  const [boardId, setBoardId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("proj_default"); // 默认关联默认项目
  const [boardName, setBoardName] = useState<string>("未命名草图-01");
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const [threads, setThreads] = useState<ChatThread[]>([createDefaultThread()]);
  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0].id);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [framework, setFramework] = useState<"vue3" | "react">("vue3");

  useEffect(() => {
    const initBoardId = `board_${Date.now()}`;
    setBoardId(initBoardId);

    fetch("/api/auth")
      .then((res) => {
        if (!res.ok) {
          router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(console.error);
  }, [router]);

  const handleLogout = async () => {
    if (!confirm("确定要退出登录吗？")) return;
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  };

  const handleSaveToCloud = async () => {
    try {
      if (!excalidrawRef.current) {
        alert('画板尚未加载完成');
        return;
      }

      // 1. 获取完整画布数据
      const elements = excalidrawRef.current.getSceneElements?.() || [];
      const appState = excalidrawRef.current.getAppState?.() || {};
      const files = excalidrawRef.current.getFiles?.() || {};

      const payload = {
        boardId: currentBoardId || 'default-board',
        sceneData: {
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor || '#f5f5f7',
          },
          files,
        },
      };

      // 2. 发起保存请求
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status} ${res.statusText}`);
      }

      alert('保存成功！');
    } catch (err: any) {
      console.error('Save to Cloud Error:', err);
      // 抛出真实的底层异常信息
      alert(`保存失败: ${err.message || '网络连接异常'}`);
    }
  };

  const handleSelectBoard = async (selectedId: string) => {
    try {
      const res = await fetch(`/api/scenes?boardId=${selectedId}`);
      if (!res.ok) return;
      const data = await res.json();
      setBoardId(data.boardId);
      setProjectId(data.projectId || "proj_default");
      setBoardName(data.name || "未命名草图");

      if (data.data?.elements) {
        excalidrawRef.current?.loadSceneData(data.data.elements);
      } else {
        excalidrawRef.current?.loadSceneData([]);
      }

      if (data.data?.threads && Array.isArray(data.data.threads) && data.data.threads.length > 0) {
        setThreads(data.data.threads);
        setActiveThreadId(data.data.activeThreadId || data.data.threads[0].id);
      } else {
        const initial = createDefaultThread();
        setThreads([initial]);
        setActiveThreadId(initial.id);
      }
    } catch {}
  };

  const handleNewBoard = (targetProjectId: string = "proj_default") => {
    const newId = `board_${Date.now()}`;
    setBoardId(newId);
    setProjectId(targetProjectId);
    setBoardName(`未命名草图-${new Date().toLocaleDateString()}`);
    excalidrawRef.current?.loadSceneData([]);
    const initial = createDefaultThread();
    setThreads([initial]);
    setActiveThreadId(initial.id);
  };

  const handleNewThread = () => {
    const newThread = createDefaultThread(`会话 #${threads.length + 1}`);
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  const handleDeleteThread = (threadId: string) => {
    if (threads.length <= 1) return;
    const filtered = threads.filter((t) => t.id !== threadId);
    setThreads(filtered);
    if (activeThreadId === threadId) setActiveThreadId(filtered[0].id);
  };

  const handleUpdateMessages = (threadId: string, updater: (prev: MessageItem[]) => MessageItem[]) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const next = updater(t.messages);
        let newTitle = t.title;
        if (t.title.startsWith("主设计会话") || t.title.startsWith("会话 #")) {
          const first = next.find((m) => m.role === "user");
          if (first) newTitle = first.content.slice(0, 16);
        }
        return { ...t, title: newTitle, messages: next };
      })
    );
  };

  const handleShare = async () => {
    await handleSave();
    const shareUrl = `${window.location.origin}/share/${boardId}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`🎉 只读分享链接已生成并复制到剪贴板！\n\n${shareUrl}`);
  };

  const handleGenerateCode = async (targetFramework: "vue3" | "react" = framework) => {
    if (!excalidrawRef.current) return;
    setIsCodeModalOpen(true);
    setCodeLoading(true);
    try {
      const img = await excalidrawRef.current.exportSelectedToImage();
      if (!img) {
        alert("画布上暂无图元！");
        setIsCodeModalOpen(false);
        return;
      }
      const res = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: img, framework: targetFramework, model: "deepseek-v4-pro" }),
      });
      const data = await res.json();
      setGeneratedCode(data.codeText || `// 错误: ${data.error}`);
    } catch (e: any) {
      setGeneratedCode(`// 异常: ${e.message}`);
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* 顶部主工具栏 */}
      <header className="h-12 border-b bg-white flex items-center justify-between px-3 z-10 shrink-0">
        
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            title="打开项目草图库"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
          >
            <Menu className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">项目草图</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1 shrink-0" />

          <input
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            className="font-medium text-slate-800 text-xs sm:text-sm border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-slate-50/60 focus:outline-none px-2 py-0.5 rounded transition-all w-[280px] sm:w-[460px] md:w-[600px] truncate"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleGenerateCode(framework)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">选区生成代码</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              savedSuccess
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>已存至云端</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5" />
                <span>{saving ? "保存中..." : "保存到云端"}</span>
              </>
            )}
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>只读分享</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-1" />

          {/* 仅管理员可见的「成员管理」按钮 */}
          {currentUser?.role === "admin" && (
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">成员管理</span>
            </button>
          )}

          {/* 用户角色与退出 */}
          <div className="flex items-center gap-1.5 bg-slate-100 pl-2 pr-1.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-700">
            {currentUser?.role === "admin" ? (
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <User className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span className="font-medium max-w-[90px] truncate">{currentUser?.username || "已登录"}</span>
            <button
              onClick={handleLogout}
              title="退出登录"
              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors ml-0.5"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </header>

      {/* 工作区 */}
      <div className="flex-1 flex overflow-hidden relative w-full h-[calc(100vh-48px)]">
        <div className="flex-1 h-full w-full relative">
          <ExcalidrawWrapper ref={excalidrawRef} />
        </div>
        <AiSidebar
          excalidrawRef={excalidrawRef}
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={(id) => setActiveThreadId(id)}
          onNewThread={handleNewThread}
          onDeleteThread={handleDeleteThread}
          onUpdateMessages={handleUpdateMessages}
          boardName={boardName}
        />
      </div>

      {/* 项目库抽屉 */}
      <ProjectDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentBoardId={boardId}
        onSelectBoard={handleSelectBoard}
        onNewBoard={handleNewBoard}
      />

      {/* 代码预览弹窗 */}
      <CodePreviewModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        codeText={generatedCode}
        framework={framework}
        onFrameworkChange={(fw) => {
          setFramework(fw);
          handleGenerateCode(fw);
        }}
        loading={codeLoading}
      />

      {/* 成员管理弹窗 (Admin 专属) */}
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />
    </div>
  );
}