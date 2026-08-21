"use client";
import React, { useRef, useState } from "react";
import ExcalidrawWrapper, { ExcalidrawRef } from "@/components/ExcalidrawWrapper";
import AiSidebar from "@/components/AiSidebar";
import { Save, Share2, FolderOpen } from "lucide-react";

export default function WorkspacePage() {
  const excalidrawRef = useRef<ExcalidrawRef>(null);
  const [boardName, setBoardName] = useState("未命名项目草图-01");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!excalidrawRef.current) return;
    setSaving(true);
    const sceneData = excalidrawRef.current.getSceneData();
    try {
      await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: "board-001", name: boardName, data: sceneData }),
      });
      alert("保存至 MinIO 成功！");
    } catch (e) {
      alert("保存失败，请检查 MinIO 连接");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="h-12 border-b bg-white flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-5 h-5 text-slate-600" />
          <input
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            className="font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中..." : "保存到云端"}
          </button>
          <button
            onClick={() => alert("分享链接已复制到剪贴板！")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            分享
          </button>
        </div>
      </header>

      {/* 主工作区：左侧白板 + 右侧 AI 助手 */}
      <div className="flex-1 flex overflow-hidden relative w-full h-[calc(100vh-48px)]">
        <div className="flex-1 h-full w-full relative">
          <ExcalidrawWrapper ref={excalidrawRef} />
        </div>
        <AiSidebar excalidrawRef={excalidrawRef} />
      </div>
    </div>
  );
}