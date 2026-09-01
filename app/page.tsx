'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Code2,
  Cloud,
  Share2,
  Users,
  ShieldCheck,
  Loader2,
  PanelLeft,
  FolderOpen,
  Plus,
  Trash2,
  FileText,
  ChevronRight,
  Folder,
  X,
} from 'lucide-react';
import ExcalidrawWrapper from '@/components/ExcalidrawWrapper';
import { AiSidebar } from '@/components/AiSidebar';
import { CodeGenerationModal } from '@/components/CodeGenerationModal';

interface BoardItem {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
}

export default function WhiteboardPage() {
  const excalidrawRef = useRef<any>(null);

  // 项目分组与画板列表状态
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState<boolean>(false);
  const [folders, setFolders] = useState<string[]>(['默认项目', '移动端 UI 设计', '架构设计']);
  const [selectedFolder, setSelectedFolder] = useState<string>('默认项目');
  const [boards, setBoards] = useState<BoardItem[]>([
    { id: 'board-01', title: '未命名草图-01', folder: '默认项目', updatedAt: '刚刚' },
    { id: 'board-02', title: '闹钟App原型交互', folder: '移动端 UI 设计', updatedAt: '2小时前' },
  ]);

  const [currentBoardId, setCurrentBoardId] = useState<string>('board-01');
  const [boardTitle, setBoardTitle] = useState<string>('未命名草图-01');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);

  // 初始化或切换画板时从 MinIO 加载数据
  useEffect(() => {
    async function loadScene() {
      try {
        const res = await fetch(`/api/scenes?boardId=${currentBoardId}`);
        const data = await res.json();
        if (data.success && data.sceneData) {
          const api =
            excalidrawRef.current ||
            (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);

          if (api && typeof api.updateScene === 'function') {
            api.updateScene({
              elements: data.sceneData.elements || [],
              appState: data.sceneData.appState || { viewBackgroundColor: '#f5f5f7' },
              commitToHistory: false,
            });
          }
        }
      } catch (e) {
        console.warn('加载云端历史画板失败:', e);
      }
    }
    loadScene();
  }, [currentBoardId]);

  // 新建草图
  const handleCreateNewBoard = () => {
    const newId = `board-${Date.now().toString().slice(-6)}`;
    const newBoard: BoardItem = {
      id: newId,
      title: `新建草图-${boards.length + 1}`,
      folder: selectedFolder,
      updatedAt: '刚刚',
    };
    setBoards((prev) => [newBoard, ...prev]);
    setCurrentBoardId(newId);
    setBoardTitle(newBoard.title);

    // 清空当前画板
    const api =
      excalidrawRef.current ||
      (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);
    if (api && typeof api.resetScene === 'function') {
      api.resetScene();
    }
    setIsProjectDrawerOpen(false);
  };

  // 切换画板
  const handleSwitchBoard = (board: BoardItem) => {
    setCurrentBoardId(board.id);
    setBoardTitle(board.title);
    setIsProjectDrawerOpen(false);
  };

  // 保存画板到 MinIO
  const handleSaveToCloud = async () => {
    if (isSaving) return;

    const api =
      excalidrawRef.current ||
      (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);

    if (!api) {
      alert('画板尚未初始化完成');
      return;
    }

    setIsSaving(true);
    try {
      const elements =
        typeof api.getSceneElements === 'function'
          ? api.getSceneElements()
          : api.getSceneData?.()?.elements || [];

      const appState =
        typeof api.getAppState === 'function'
          ? api.getAppState()
          : api.getSceneData?.()?.appState || {};

      const files =
        typeof api.getFiles === 'function'
          ? api.getFiles()
          : api.getSceneData?.()?.files || {};

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

      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status} ${res.statusText}`);
      }

      // 更新列表中的标题与时间
      setBoards((prev) =>
        prev.map((b) =>
          b.id === currentBoardId ? { ...b, title: boardTitle, updatedAt: '刚刚' } : b
        )
      );

      alert('画板已成功持久化至云端！');
    } catch (err: any) {
      console.error('Save to Cloud Error:', err);
      alert(`保存失败: ${err.message || '网络连接异常'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5f5f7] dark:bg-zinc-950 font-sans relative">
      {/* 左侧项目分组抽屉遮罩 */}
      {isProjectDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsProjectDrawerOpen(false)}
        />
      )}

      {/* 左侧项目分组抽屉面板 */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-50 flex flex-col shadow-2xl transition-transform duration-200 ease-in-out ${
          isProjectDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 抽屉头部 */}
        <div className="h-12 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <span>项目与草图列表</span>
          </div>
          <button
            onClick={() => setIsProjectDrawerOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 分组切换 Tabs */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            项目分组
          </div>
          <div className="flex flex-col gap-1">
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedFolder === folder
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5" />
                  <span>{folder}</span>
                </div>
                <ChevronRight className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </div>
        </div>

        {/* 该分组下的草图列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
            <span>草图文件</span>
            <button
              onClick={handleCreateNewBoard}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
            >
              <Plus className="w-3 h-3" /> 新建
            </button>
          </div>

          {boards
            .filter((b) => b.folder === selectedFolder)
            .map((b) => {
              const isActive = b.id === currentBoardId;
              return (
                <div
                  key={b.id}
                  onClick={() => handleSwitchBoard(b)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                    <span className="truncate font-medium">{b.title}</span>
                  </div>
                  <span
                    className={`text-[10px] shrink-0 ml-2 ${
                      isActive ? 'text-indigo-200' : 'text-zinc-400'
                    }`}
                  >
                    {b.updatedAt}
                  </span>
                </div>
              );
            })}
        </div>

        {/* 抽屉底部新建草图按钮 */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleCreateNewBoard}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            新建空白草图
          </button>
        </div>
      </aside>

      {/* 主工作区 */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* 顶部主导航栏 */}
        <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 flex items-center justify-between z-20 shrink-0 select-none">
          {/* 左侧：抽屉触发按钮 + 项目分组 + 标题 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProjectDrawerOpen(true)}
              className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="展开项目分组与草图列表"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsProjectDrawerOpen(true)}
              className="px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>{selectedFolder}</span>
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

            <input
              type="text"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
              title="点击可直接重命名草图"
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