"use client";
import React, { useRef, useState } from "react";
import ExcalidrawWrapper, { ExcalidrawRef } from "@/components/ExcalidrawWrapper";
import AiSidebar from "@/components/AiSidebar";
import CodePreviewModal from "@/components/CodePreviewModal";
import { Save, Share2, FolderOpen, Code2 } from "lucide-react";

export default function WorkspacePage() {
  const excalidrawRef = useRef<ExcalidrawRef>(null);
  const [boardName, setBoardName] = useState("未命名项目草图-01");
  const [saving, setSaving] = useState(false);

  // 代码弹窗状态
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [framework, setFramework] = useState<"vue3" | "react">("vue3");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // 触发生成代码
  const handleGenerateCode = async (targetFramework: "vue3" | "react" = framework) => {
    if (!excalidrawRef.current) return;

    setIsCodeModalOpen(true);
    setCodeLoading(true);

    try {
      // 1. 抓取选区 / 全画布截图
      let img = capturedImage;
      if (!img) {
        img = await excalidrawRef.current.exportSelectedToImage();
        setCapturedImage(img);
      }

      if (!img) {
        alert("画布上没有图形，请先让 AI 画图或自行绘制草图！");
        setIsCodeModalOpen(false);
        return;
      }

      // 2. 调用多模态代码生成
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

  const handleFrameworkChange = (fw: "vue3" | "react") => {
    setFramework(fw);
    handleGenerateCode(fw);
  };

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
          {/* 一键生成代码核心按钮 */}
          <button
            onClick={() => {
              setCapturedImage(null);
              handleGenerateCode(framework);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shadow-sm"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>选区生成代码</span>
          </button>

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

      {/* 主工作区 */}
      <div className="flex-1 flex overflow-hidden relative w-full h-[calc(100vh-48px)]">
        <div className="flex-1 h-full w-full relative">
          <ExcalidrawWrapper ref={excalidrawRef} />
        </div>
        <AiSidebar excalidrawRef={excalidrawRef} />
      </div>

      {/* 代码预览弹窗 */}
      <CodePreviewModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        codeText={generatedCode}
        framework={framework}
        onFrameworkChange={handleFrameworkChange}
        loading={codeLoading}
      />
    </div>
  );
}