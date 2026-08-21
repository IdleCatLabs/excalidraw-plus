"use client";
import React, { useRef, useState, useEffect } from "react";
import ExcalidrawWrapper, { ExcalidrawRef } from "@/components/ExcalidrawWrapper";
import AiSidebar, { ChatThread, MessageItem } from "@/components/AiSidebar";
import CodePreviewModal from "@/components/CodePreviewModal";
import ProjectDrawer from "@/components/ProjectDrawer";
import { Save, Share2, Menu, Code2, Check, Cloud } from "lucide-react";

function createDefaultThread(title = "主设计会话"): ChatThread {
  return {
    id: `thread_${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    messages: [
      {
        role: "assistant",
        content: "你好！支持文字对话与智能画图，请选择模型开始。",
      },
    ],
  };
}

export default function WorkspacePage() {
  const excalidrawRef = useRef<ExcalidrawRef>(null);
  
  // 草图元数据
  const [boardId, setBoardId] = useState<string>("");
  const [boardName, setBoardName] = useState<string>("未命名草图-01");
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // 1:N 核心：当前草图下的所有会话列表 + 当前激活的会话 ID
  const [threads, setThreads] = useState<ChatThread[]>([createDefaultThread()]);
  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0].id);

  // 抽屉与弹窗状态
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [framework, setFramework] = useState<"vue3" | "react">("vue3");

  useEffect(() => {
    const initBoardId = `board_${Date.now()}`;
    setBoardId(initBoardId);
  }, []);

  // 1. 保存当前草图、画板图形以及全部 1:N 会话到 MinIO
  const handleSave = async () => {
    if (!excalidrawRef.current || !boardId) return;
    setSaving(true);
    const sceneData = excalidrawRef.current.getSceneData();

    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          name: boardName,
          data: {
            ...sceneData,
            threads, // 序列化全部会话列表
            activeThreadId,
          },
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      } else {
        alert("保存失败，请检查 MinIO 连接");
      }
    } catch (e) {
      alert("保存网络异常");
    } finally {
      setSaving(false);
    }
  };

  // 2. 从 MinIO 还原草图及其名下的 1:N 完整会话结构
  const handleSelectBoard = async (selectedId: string) => {
    try {
      const res = await fetch(`/api/scenes?boardId=${selectedId}`);
      if (!res.ok) {
        alert("读取画板失败");
        return;
      }
      const data = await res.json();
      setBoardId(data.boardId);
      setBoardName(data.name || "未命名草图");

      if (data.data?.elements) {
        excalidrawRef.current?.loadSceneData(data.data.elements);
      } else {
        excalidrawRef.current?.loadSceneData([]);
      }

      // 还原 1:N 会话列表
      if (data.data?.threads && Array.isArray(data.data.threads) && data.data.threads.length > 0) {
        setThreads(data.data.threads);
        setActiveThreadId(data.data.activeThreadId || data.data.threads[0].id);
      } else {
        const initial = createDefaultThread();
        setThreads([initial]);
        setActiveThreadId(initial.id);
      }
    } catch (e) {
      alert("加载画板数据失败");
    }
  };

  // 3. 新建空白草图
  const handleNewBoard = () => {
    const newId = `board_${Date.now()}`;
    setBoardId(newId);
    setBoardName(`未命名草图-${new Date().toLocaleDateString()}`);
    excalidrawRef.current?.loadSceneData([]);
    
    // 初始化全新的会话
    const initial = createDefaultThread();
    setThreads([initial]);
    setActiveThreadId(initial.id);
  };

  // 4. 当前草图下：新建一个新会话（重置当前 Token，保留旧会话）
  const handleNewThread = () => {
    const threadCount = threads.length + 1;
    const newThread = createDefaultThread(`会话 #${threadCount}`);
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  // 5. 删除某个会话
  const handleDeleteThread = (threadId: string) => {
    if (threads.length <= 1) return;
    const filtered = threads.filter((t) => t.id !== threadId);
    setThreads(filtered);
    if (activeThreadId === threadId) {
      setActiveThreadId(filtered[0].id);
    }
  };

  // 6. 更新指定会话的消息流并自动提取标题
  const handleUpdateMessages = (threadId: string, updater: (prev: MessageItem[]) => MessageItem[]) => {
    setThreads((prevThreads) =>
      prevThreads.map((t) => {
        if (t.id !== threadId) return t;
        const nextMessages = updater(t.messages);
        
        // 自动用第一条用户指令作为会话标题
        let newTitle = t.title;
        if (t.title.startsWith("主设计会话") || t.title.startsWith("会话 #")) {
          const firstUserMsg = nextMessages.find((m) => m.role === "user");
          if (firstUserMsg) {
            newTitle = firstUserMsg.content.slice(0, 16);
          }
        }

        return {
          ...t,
          title: newTitle,
          messages: nextMessages,
        };
      })
    );
  };

  // 7. 选区生成代码
  const handleGenerateCode = async (targetFramework: "vue3" | "react" = framework) => {
    if (!excalidrawRef.current) return;

    setIsCodeModalOpen(true);
    setCodeLoading(true);

    try {
      const img = await excalidrawRef.current.exportSelectedToImage();
      if (!img) {
        alert("画布上暂无图元，请先在白板上绘制草图！");
        setIsCodeModalOpen(false);
        return;
      }

      const res = await fetch("/api/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: img,
          framework: targetFramework,
          model: "deepseek-v4-pro",
        }),
      });

      const data = await res.json();
      if (data.codeText) {
        setGeneratedCode(data.codeText);
      } else {
        setGeneratedCode(`// 生成失败: ${data.error || "未能获取有效代码"}`);
      }
    } catch (e: any) {
      setGeneratedCode(`// 请求异常: ${e.message}`);
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* 顶部工具栏 */}
      <header className="h-12 border-b bg-white flex items-center justify-between px-3 z-10 shrink-0">
        
        {/* 左侧：抽屉开关 + 画布标题 */}
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

          {/* 加宽并支持自适应展示完整标题 */}
          <input
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            placeholder="输入草图标题..."
            title="点击可编辑草图名称"
            className="font-medium text-slate-800 text-xs sm:text-sm border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-slate-50/60 focus:outline-none px-2 py-0.5 rounded transition-all w-[280px] sm:w-[460px] md:w-[600px] truncate"
          />
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("分享链接已复制！");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>分享</span>
          </button>
        </div>
      </header>

      {/* 主工作区 */}
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

      {/* 项目草图抽屉 */}
      <ProjectDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentBoardId={boardId}
        onSelectBoard={handleSelectBoard}
        onNewBoard={handleNewBoard}
      />

      {/* 代码实时预览弹窗 */}
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
    </div>
  );
}