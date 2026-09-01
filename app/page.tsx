'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Sparkles,
  Code2,
  Cloud,
  Share2,
  Users,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { AiSidebar } from '@/components/AiSidebar';
import { CodeGenerationModal } from '@/components/CodeGenerationModal';

// 动态导入 Excalidraw 包装组件
const ExcalidrawWrapper = dynamic(
  () => import('@/components/ExcalidrawWrapper'),
  { ssr: false }
);

export default function WhiteboardPage() {
  const excalidrawRef = useRef<any>(null);

  const [boardId, setBoardId] = useState<string>('default-board');
  const [boardTitle, setBoardTitle] = useState<string>('未命名草图-01');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // 初始化加载云端已存草图
  useEffect(() => {
    async function loadScene() {
      try {
        const res = await fetch(`/api/scenes?boardId=${boardId}`);
        const data = await res.json();
        if (data.success && data.sceneData && excalidrawRef.current) {
          excalidrawRef.current.updateScene({
            elements: data.sceneData.elements || [],
            appState: data.sceneData.appState || { viewBackgroundColor: '#f5f5f7' },
            commitToHistory: false,
          });
        }
      } catch (e) {
        console.warn('加载云端历史画板失败或无历史数据:', e);
      }
    }
    loadScene();
  }, [boardId]);

  // 保存画板到 MinIO
  const handleSaveToCloud = async () => {
    if (isSaving) return;
    if (!excalidrawRef.current) {
      alert('画板尚未初始化完成');
      return;
    }

    setIsSaving(true);
    try {
      const elements =
        typeof excalidrawRef.current.getSceneElements === 'function'
          ? excalidrawRef.current.getSceneElements()
          : [];
      const appState =
        typeof excalidrawRef.current.getAppState === 'function'
          ? excalidrawRef.current.getAppState()
          : {};
      const files =
        typeof excalidrawRef.current.getFiles === 'function'
          ? excalidrawRef.current.getFiles()
          : {};

      const payload = {
        boardId: boardId || 'default-board',
        sceneData: {
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor || '#f5f5f7',
          },
          files,
        },
      };

      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status} ${res.statusText}`);
      }

      alert('画板已成功持久化至云端！');
    } catch (err: any) {
      console.error('Save to Cloud Error:', err);
      alert(`保存失败: ${err.message || '网络连接异常'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f5f7] dark:bg-zinc-950 font-sans">
      {/* 主工作区 */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* 顶部主导航栏 */}
        <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-4 flex items-center justify-between z-20 shrink-0 select-none">
          {/* 左侧：项目与标题 */}
          <div className="flex items-center gap-3">
            <button className="px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 transition">
              项目草图
            </button>
            <input
              type="text"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
            />
          </div>

          {/* 右侧：功能操作区 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCodeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
            >
              <Code2 className="w-3.5 h-3.5" />
              选区生成代码
            </button>

            <button
              onClick={handleSaveToCloud}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              {isSaving ? '保存中...' : '保存到云端'}
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('分享链接已复制到剪贴板！');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
            >
              <Share2 className="w-3.5 h-3.5" />
              只读分享
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium transition">
              <Users className="w-3.5 h-3.5" />
              成员管理
            </button>

            <div className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>admin</span>
            </div>

            <button
              onClick={() => setIsAiOpen(!isAiOpen)}
              className={`p-1.5 rounded-lg border transition ml-1 ${
                isAiOpen
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 text-indigo-600'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="切换 AI 绘图助手"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 画板绘制区域 */}
        <div className="flex-1 w-full h-[calc(100vh-48px)] relative">
          <ExcalidrawWrapper ref={excalidrawRef} />
        </div>
      </div>

      {/* AI 绘图助手侧边栏 */}
      {isAiOpen && (
        <AiSidebar
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          excalidrawRef={excalidrawRef}
        />
      )}

      {/* 选区生成代码弹窗 */}
      <CodeGenerationModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        excalidrawRef={excalidrawRef}
      />
    </div>
  );
}