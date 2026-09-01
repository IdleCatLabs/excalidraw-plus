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
  Edit2,
  Check,
} from 'lucide-react';
import ExcalidrawWrapper from '@/components/ExcalidrawWrapper';
import { AiSidebar } from '@/components/AiSidebar';
import { CodeGenerationModal } from '@/components/CodeGenerationModal';
import { MemberManagementModal } from '@/components/MemberManagementModal';

interface BoardItem {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
}

export default function WhiteboardPage() {
  const excalidrawRef = useRef<any>(null);

  const [folders, setFolders] = useState<string[]>(['默认项目']);
  const [selectedFolder, setSelectedFolder] = useState<string>('默认项目');
  const [boards, setBoards] = useState<BoardItem[]>([
    { id: 'board-01', title: '新建草图', folder: '默认项目', updatedAt: '刚刚' },
  ]);

  const [currentBoardId, setCurrentBoardId] = useState<string>('board-01');
  const [boardTitle, setBoardTitle] = useState<string>('新建草图');

  // UI 状态
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(false);

  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderInput, setEditFolderInput] = useState<string>('');
  const [isAddingFolder, setIsAddingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editBoardTitleInput, setEditBoardTitleInput] = useState<string>('');

  // 1. 页面加载时从 MinIO 获取持久化工作区元数据
  useEffect(() => {
    async function initWorkspace() {
      try {
        const res = await fetch('/api/workspace');
        const json = await res.json();
        if (json.success && json.data) {
          if (Array.isArray(json.data.folders) && json.data.folders.length > 0) {
            setFolders(json.data.folders);
            setSelectedFolder(json.data.folders[0]);
          }
          if (Array.isArray(json.data.boards) && json.data.boards.length > 0) {
            setBoards(json.data.boards);
            setCurrentBoardId(json.data.boards[0].id);
            setBoardTitle(json.data.boards[0].title);
          }
        }
      } catch (e) {
        console.warn('从 MinIO 加载工作区元数据失败:', e);
      }
    }
    initWorkspace();
  }, []);

  // 同步工作区元数据到 MinIO
  const syncWorkspaceToMinio = async (updatedFolders: string[], updatedBoards: BoardItem[]) => {
    try {
      await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: updatedFolders, boards: updatedBoards }),
      });
    } catch (e) {
      console.error('同步工作区到 MinIO 失败:', e);
    }
  };

  // 渲染画板
  const renderElementsToCanvas = (elements: any[], appState?: any, files?: any) => {
    const api =
      excalidrawRef.current?.excalidrawAPI ||
      excalidrawRef.current ||
      (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);

    if (!api || typeof api.updateScene !== 'function') return;

    api.updateScene({
      elements: JSON.parse(JSON.stringify(elements)),
      appState: {
        viewBackgroundColor: '#f5f5f7',
        ...appState,
      },
      files: files || {},
      commitToHistory: false,
    });

    if (elements.length > 0) {
      setTimeout(() => {
        api.scrollToContent?.(elements, { fitToViewport: true });
      }, 100);
    }
  };

  // 2. 切换草图时精确从 MinIO 加载
  useEffect(() => {
    let isCancelled = false;

    async function loadScene() {
      try {
        const res = await fetch(`/api/scenes?boardId=${currentBoardId}`);
        const data = await res.json();

        if (isCancelled) return;

        if (
          data.success &&
          data.sceneData &&
          Array.isArray(data.sceneData.elements) &&
          data.sceneData.elements.length > 0
        ) {
          renderElementsToCanvas(data.sceneData.elements, data.sceneData.appState, data.sceneData.files);
        } else {
          const api =
            excalidrawRef.current?.excalidrawAPI ||
            excalidrawRef.current ||
            (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);
          if (api && typeof api.resetScene === 'function') {
            api.resetScene();
          }
        }
      } catch (e) {
        console.warn('从 MinIO 载入草图失败:', e);
      }
    }

    loadScene();

    return () => {
      isCancelled = true;
    };
  }, [currentBoardId]);

  // 3. 项目分组管理
  const handleAddFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || folders.includes(trimmed)) return;
    const nextFolders = [...folders, trimmed];
    setFolders(nextFolders);
    setSelectedFolder(trimmed);
    setNewFolderName('');
    setIsAddingFolder(false);
    syncWorkspaceToMinio(nextFolders, boards);
  };

  const handleStartRenameFolder = (e: React.MouseEvent, folder: string) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setEditFolderInput(folder);
  };

  const handleSaveRenameFolder = (oldFolder: string) => {
    const trimmed = editFolderInput.trim();
    if (!trimmed || trimmed === oldFolder) {
      setEditingFolder(null);
      return;
    }
    const nextFolders = folders.map((f) => (f === oldFolder ? trimmed : f));
    const nextBoards = boards.map((b) => (b.folder === oldFolder ? { ...b, folder: trimmed } : b));
    setFolders(nextFolders);
    setBoards(nextBoards);
    if (selectedFolder === oldFolder) setSelectedFolder(trimmed);
    setEditingFolder(null);
    syncWorkspaceToMinio(nextFolders, nextBoards);
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderToDelete: string) => {
    e.stopPropagation();
    if (folders.length <= 1) {
      alert('请至少保留一个项目分组');
      return;
    }
    if (confirm(`确定删除分组「${folderToDelete}」吗？名下草图将自动归入「默认项目」`)) {
      const fallback = folders.find((f) => f !== folderToDelete) || '默认项目';
      const nextFolders = folders.filter((f) => f !== folderToDelete);
      const nextBoards = boards.map((b) =>
        b.folder === folderToDelete ? { ...b, folder: fallback } : b
      );
      setFolders(nextFolders);
      setBoards(nextBoards);
      if (selectedFolder === folderToDelete) setSelectedFolder(fallback);
      syncWorkspaceToMinio(nextFolders, nextBoards);
    }
  };

  // 4. 草图文件管理
  const handleCreateNewBoard = () => {
    const newId = `board-${Date.now().toString().slice(-6)}`;
    const newBoard: BoardItem = {
      id: newId,
      title: `新建草图-${boards.length + 1}`,
      folder: selectedFolder,
      updatedAt: '刚刚',
    };
    const nextBoards = [newBoard, ...boards];
    setBoards(nextBoards);
    setCurrentBoardId(newId);
    setBoardTitle(newBoard.title);

    const api =
      excalidrawRef.current?.excalidrawAPI ||
      excalidrawRef.current ||
      (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);
    if (api && typeof api.resetScene === 'function') {
      api.resetScene();
    }
    setIsProjectDrawerOpen(false);
    syncWorkspaceToMinio(folders, nextBoards);
  };

  const handleSwitchBoard = (board: BoardItem) => {
    if (board.id === currentBoardId) {
      setIsProjectDrawerOpen(false);
      return;
    }
    setCurrentBoardId(board.id);
    setBoardTitle(board.title);
    setSelectedFolder(board.folder);
    setIsProjectDrawerOpen(false);
  };

  const handleStartRenameBoard = (e: React.MouseEvent, b: BoardItem) => {
    e.stopPropagation();
    setEditingBoardId(b.id);
    setEditBoardTitleInput(b.title);
  };

  const handleSaveRenameBoard = (boardId: string) => {
    const trimmed = editBoardTitleInput.trim();
    if (trimmed) {
      const nextBoards = boards.map((b) => (b.id === boardId ? { ...b, title: trimmed } : b));
      setBoards(nextBoards);
      if (currentBoardId === boardId) {
        setBoardTitle(trimmed);
      }
      syncWorkspaceToMinio(folders, nextBoards);
    }
    setEditingBoardId(null);
  };

  const handleDeleteBoard = (e: React.MouseEvent, boardToDelete: BoardItem) => {
    e.stopPropagation();
    if (confirm(`确定删除草图「${boardToDelete.title}」吗？`)) {
      const nextBoards = boards.filter((b) => b.id !== boardToDelete.id);
      setBoards(nextBoards);

      if (currentBoardId === boardToDelete.id) {
        if (nextBoards.length > 0) {
          const next = nextBoards[0];
          setCurrentBoardId(next.id);
          setBoardTitle(next.title);
          setSelectedFolder(next.folder);
        } else {
          handleCreateNewBoard();
          return;
        }
      }
      syncWorkspaceToMinio(folders, nextBoards);
    }
  };

  // 5. 保存画板到 MinIO
  const handleSaveToCloud = async () => {
    if (isSaving) return;

    const api =
      excalidrawRef.current?.excalidrawAPI ||
      excalidrawRef.current ||
      (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);

    if (!api) {
      alert('画板尚未初始化完成');
      return;
    }

    setIsSaving(true);
    try {
      const rawElements =
        typeof api.getSceneElements === 'function'
          ? api.getSceneElements()
          : api.getSceneData?.()?.elements || [];

      const elements = rawElements.filter((el: any) => !el.isDeleted);

      const appState =
        typeof api.getAppState === 'function'
          ? api.getAppState()
          : api.getSceneData?.()?.appState || {};

      const files =
        typeof api.getFiles === 'function'
          ? api.getFiles()
          : api.getSceneData?.()?.files || {};

      const sceneData = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor || '#f5f5f7',
        },
        files,
      };

      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: currentBoardId || 'default-board',
          sceneData,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status} ${res.statusText}`);
      }

      const nextBoards = boards.map((b) =>
        b.id === currentBoardId ? { ...b, title: boardTitle, updatedAt: '刚刚' } : b
      );
      setBoards(nextBoards);
      syncWorkspaceToMinio(folders, nextBoards);

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
      {/* 抽屉遮罩 */}
      {isProjectDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setIsProjectDrawerOpen(false)}
        />
      )}

      {/* 项目分组抽屉 */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-50 flex flex-col shadow-2xl transition-transform duration-200 ease-in-out ${
          isProjectDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-12 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-sm">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <span>项目与草图管理</span>
          </div>
          <button
            onClick={() => setIsProjectDrawerOpen(false)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 分组操作栏 */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            <span>项目分组</span>
            <button
              onClick={() => setIsAddingFolder(true)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 text-xs font-medium"
            >
              <Plus className="w-3 h-3" /> 新建分组
            </button>
          </div>

          {isAddingFolder && (
            <div className="flex items-center gap-1 mb-2">
              <input
                type="text"
                autoFocus
                placeholder="输入分组名称..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                className="flex-1 px-2 py-1 text-xs border border-indigo-300 rounded focus:outline-none dark:bg-zinc-800 dark:border-zinc-700"
              />
              <button
                onClick={handleAddFolder}
                className="p-1 bg-indigo-600 text-white rounded text-xs"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsAddingFolder(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {folders.map((folder) => {
              const isSelected = selectedFolder === folder;
              const isEditing = editingFolder === folder;

              return (
                <div
                  key={folder}
                  onClick={() => !isEditing && setSelectedFolder(folder)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={editFolderInput}
                        onChange={(e) => setEditFolderInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameFolder(folder)}
                        className="flex-1 px-1.5 py-0.5 text-xs border border-indigo-400 rounded dark:bg-zinc-800"
                      />
                      <button
                        onClick={() => handleSaveRenameFolder(folder)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate flex-1">
                        <Folder className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{folder}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => handleStartRenameFolder(e, folder)}
                          title="重命名分组"
                          className="p-1 text-zinc-400 hover:text-indigo-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteFolder(e, folder)}
                          title="删除分组"
                          className="p-1 text-zinc-400 hover:text-rose-500 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronRight className="w-3 h-3 opacity-40 ml-0.5" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 草图文件列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
            <span>「{selectedFolder}」草图</span>
            <button
              onClick={handleCreateNewBoard}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 text-xs font-medium"
            >
              <Plus className="w-3 h-3" /> 新建
            </button>
          </div>

          {boards
            .filter((b) => b.folder === selectedFolder)
            .map((b) => {
              const isActive = b.id === currentBoardId;
              const isEditing = editingBoardId === b.id;

              return (
                <div
                  key={b.id}
                  onClick={() => !isEditing && handleSwitchBoard(b)}
                  className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        autoFocus
                        value={editBoardTitleInput}
                        onChange={(e) => setEditBoardTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameBoard(b.id)}
                        className="flex-1 px-1.5 py-0.5 text-xs text-zinc-900 border border-indigo-400 rounded bg-white"
                      />
                      <button
                        onClick={() => handleSaveRenameBoard(b.id)}
                        className="p-1 text-emerald-600 bg-white hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate flex-1 pr-1">
                        <FileText
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-white' : 'text-zinc-400'
                          }`}
                        />
                        <span className="truncate font-medium">{b.title}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] shrink-0 mr-1 ${
                            isActive ? 'text-indigo-200' : 'text-zinc-400'
                          }`}
                        >
                          {b.updatedAt}
                        </span>

                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
                          <button
                            onClick={(e) => handleStartRenameBoard(e, b)}
                            title="重命名草图"
                            className={`p-1 rounded ${
                              isActive ? 'text-indigo-200 hover:text-white' : 'text-zinc-400 hover:text-indigo-600'
                            }`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteBoard(e, b)}
                            title="删除草图"
                            className={`p-1 rounded ${
                              isActive ? 'text-indigo-200 hover:text-white' : 'text-zinc-400 hover:text-rose-500'
                            }`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={handleCreateNewBoard}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            新建空白草图
          </button>
        </div>
      </aside>

      {/* 主画布区域 */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 flex items-center justify-between z-20 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProjectDrawerOpen(true)}
              className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="展开项目与草图管理"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsProjectDrawerOpen(true)}
              className="px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>{selectedFolder}</span>
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

            <input
              type="text"
              value={boardTitle}
              onChange={(e) => {
                const newTitle = e.target.value;
                setBoardTitle(newTitle);
                const nextBoards = boards.map((b) =>
                  b.id === currentBoardId ? { ...b, title: newTitle } : b
                );
                setBoards(nextBoards);
                syncWorkspaceToMinio(folders, nextBoards);
              }}
              placeholder="草图名称..."
              className="w-48 sm:w-64 md:w-80 px-2.5 py-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent focus:border-indigo-400 focus:bg-white dark:focus:bg-zinc-900 rounded-md transition focus:outline-none truncate"
              title="点击可直接编辑草图名称"
            />
          </div>

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

            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium transition"
            >
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

        <div className="flex-1 w-full h-[calc(100vh-48px)] relative">
          <ExcalidrawWrapper ref={excalidrawRef} />
        </div>
      </div>

      {isAiOpen && (
        <AiSidebar
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
          excalidrawRef={excalidrawRef}
        />
      )}

      <CodeGenerationModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        excalidrawRef={excalidrawRef}
      />

      <MemberManagementModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
      />
    </div>
  );
}