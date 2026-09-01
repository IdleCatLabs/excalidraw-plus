'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  FileText,
  Plus,
  Trash2,
  FolderPlus,
  Loader2,
  Edit2,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export interface BoardItem {
  id: string;
  projectId?: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  boards?: BoardItem[];
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardId?: string;
  currentProjectId?: string;
  projects?: ProjectItem[];
  onSelectBoard?: (boardId: string, title?: string, projectName?: string) => void;
  onRefreshProjects?: () => void | Promise<any>;
  onBoardRenamed?: (boardId: string, newTitle: string) => void;
  onBoardDeleted?: (boardId: string) => void;
  onProjectRenamed?: (projectId: string, newName: string) => void;
}

export function ProjectDrawer({
  isOpen,
  onClose,
  currentBoardId,
  currentProjectId,
  projects: propProjects,
  onSelectBoard,
  onRefreshProjects,
  onBoardRenamed,
  onBoardDeleted,
  onProjectRenamed,
}: DrawerProps) {
  const [internalProjects, setInternalProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 折叠状态记录
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  // 新建项目状态
  const [showCreateProject, setShowCreateProject] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');

  // 新建画板状态
  const [creatingBoardForProj, setCreatingBoardForProj] = useState<string | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState<string>('');

  // 项目重命名状态
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string>('');

  // 画板重命名状态
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardTitle, setEditingBoardTitle] = useState<string>('');

  // 获取项目与画板列表
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setInternalProjects(data.projects || []);
      }
    } catch (err) {
      console.error('获取项目列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (propProjects && propProjects.length > 0) {
        setInternalProjects(propProjects);
      }
      fetchProjects();
    }
  }, [isOpen, propProjects]);

  const projects = internalProjects.length > 0 ? internalProjects : (propProjects || []);

  const refreshAll = async () => {
    if (onRefreshProjects) {
      await onRefreshProjects();
    }
    await fetchProjects();
  };

  // 1. 新建项目
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });

      if (res.ok) {
        setNewProjectName('');
        setShowCreateProject(false);
        await refreshAll();
      }
    } catch (err) {
      console.error('创建项目失败:', err);
    }
  };

  // 2. 重命名项目
  const handleSaveProjectName = async (projectId: string) => {
    if (!editingProjectName.trim()) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, name: editingProjectName.trim() }),
      });

      if (res.ok) {
        onProjectRenamed?.(projectId, editingProjectName.trim());
        setEditingProjectId(null);
        await refreshAll();
      }
    } catch (err) {
      console.error('重命名项目失败:', err);
    }
  };

  // 3. 删除项目
  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      alert('至少需要保留一个项目');
      return;
    }

    if (!confirm('确定要删除该项目分组及其所有画板吗？此操作无法撤销。')) return;

    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await refreshAll();
      }
    } catch (err) {
      console.error('删除项目失败:', err);
    }
  };

  // 4. 新建画板
  const handleCreateBoard = async (projectId: string) => {
    if (!newBoardTitle.trim()) return;

    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: newBoardTitle.trim(),
          elements: [],
          appState: {},
          files: {},
        }),
      });

      if (res.ok) {
        const newBoard = await res.json();
        setNewBoardTitle('');
        setCreatingBoardForProj(null);
        await refreshAll();

        const project = projects.find((p) => p.id === projectId);
        if (onSelectBoard && newBoard?.id) {
          onSelectBoard(newBoard.id, newBoard.title || newBoardTitle, project?.name || '默认项目');
        }
      }
    } catch (err) {
      console.error('创建画板失败:', err);
    }
  };

  // 5. 重命名画板
  const handleSaveBoardTitle = async (boardId: string, projectId: string) => {
    if (!editingBoardTitle.trim()) return;

    try {
      const res = await fetch('/api/scenes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: boardId,
          projectId,
          title: editingBoardTitle.trim(),
        }),
      });

      if (res.ok) {
        onBoardRenamed?.(boardId, editingBoardTitle.trim());
        setEditingBoardId(null);
        await refreshAll();
      }
    } catch (err) {
      console.error('重命名画板失败:', err);
    }
  };

  // 6. 删除画板
  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!confirm('确定要删除该草图画板吗？此操作无法撤销。')) return;

    try {
      const res = await fetch(`/api/scenes?id=${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onBoardDeleted?.(boardId);
        await refreshAll();
      }
    } catch (err) {
      console.error('删除画板失败:', err);
    }
  };

  // 切换折叠状态
  const toggleCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* 抽屉容器 */}
      <div className="relative w-80 max-w-full bg-white h-full shadow-2xl z-10 flex flex-col border-r border-gray-200 animate-in slide-in-from-left duration-200 select-none">
        {/* 顶部标题栏 */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-gray-900 text-base">项目与画板</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 列表区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">加载项目中...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              暂无项目，点击下方按钮新建
            </div>
          ) : (
            projects.map((project) => {
              const isCollapsed = collapsedProjects[project.id];
              const isEditingProj = editingProjectId === project.id;

              return (
                <div key={project.id} className="bg-gray-50/60 rounded-2xl p-2 border border-gray-200/70 space-y-2">
                  {/* 项目头部 */}
                  <div className="flex items-center justify-between group px-1.5 py-1">
                    {isEditingProj ? (
                      <div className="flex items-center gap-1 flex-1 mr-1">
                        <input
                          type="text"
                          autoFocus
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveProjectName(project.id)}
                          className="w-full text-xs font-bold px-2 py-1 bg-white border border-indigo-400 rounded-lg outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveProjectName(project.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProjectId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          onClick={() => toggleCollapse(project.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer flex-1 truncate"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}
                          <Folder className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="truncate">{project.name}</span>
                        </div>

                        {/* 项目操作按键 */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingBoardForProj(project.id);
                              setCollapsedProjects((prev) => ({ ...prev, [project.id]: false }));
                            }}
                            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-md transition"
                            title="在此项目下新建画板"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProjectId(project.id);
                              setEditingProjectName(project.name);
                            }}
                            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-white rounded-md transition"
                            title="重命名项目"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition"
                            title="删除项目"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 新建画板输入框 */}
                  {creatingBoardForProj === project.id && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-indigo-200 rounded-xl shadow-2xs">
                      <input
                        type="text"
                        autoFocus
                        value={newBoardTitle}
                        onChange={(e) => setNewBoardTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard(project.id)}
                        placeholder="输入新画板标题..."
                        className="w-full text-xs px-2 py-1 outline-none font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateBoard(project.id)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0"
                      >
                        新建
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingBoardForProj(null);
                          setNewBoardTitle('');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* 画板列表 */}
                  {!isCollapsed && (
                    <div className="space-y-1 pl-1">
                      {project.boards && project.boards.length > 0 ? (
                        project.boards.map((board) => {
                          const isCurrent = board.id === currentBoardId;
                          const isEditingBoard = editingBoardId === board.id;

                          if (isEditingBoard) {
                            return (
                              <div
                                key={board.id}
                                className="flex items-center gap-1 px-2 py-1 bg-white border border-indigo-300 rounded-xl"
                              >
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingBoardTitle}
                                  onChange={(e) => setEditingBoardTitle(e.target.value)}
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' && handleSaveBoardTitle(board.id, project.id)
                                  }
                                  className="w-full text-xs px-1.5 py-0.5 outline-none font-medium text-gray-800"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveBoardTitle(board.id, project.id)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBoardId(null)}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={board.id}
                              onClick={() =>
                                onSelectBoard?.(board.id, board.title, project.name)
                              }
                              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer group transition ${
                                isCurrent
                                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-1">
                                <FileText
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isCurrent ? 'text-indigo-100' : 'text-indigo-500'
                                  }`}
                                />
                                <span className="truncate">{board.title || '未命名画板'}</span>
                              </div>

                              {/* 画板操作按键 */}
                              <div
                                className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition ${
                                  isCurrent ? 'text-white' : 'text-gray-400'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBoardId(board.id);
                                    setEditingBoardTitle(board.title || '');
                                  }}
                                  className={`p-1 rounded transition ${
                                    isCurrent ? 'hover:bg-indigo-700' : 'hover:bg-gray-200 hover:text-indigo-600'
                                  }`}
                                  title="重命名画板"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteBoard(e, board.id)}
                                  className={`p-1 rounded transition ${
                                    isCurrent ? 'hover:bg-indigo-700' : 'hover:bg-gray-200 hover:text-red-600'
                                  }`}
                                  title="删除画板"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[11px] text-gray-400 pl-4 py-2">
                          暂无画板，点击右上角 + 新建
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 抽屉底部：新建项目分组 */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/70">
          {showCreateProject ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="输入新项目名称..."
                className="w-full text-xs px-3 py-2 border border-indigo-300 rounded-xl outline-none bg-white font-medium shadow-2xs"
              />
              <button
                type="button"
                onClick={handleCreateProject}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-2xs"
              >
                新建
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateProject(false);
                  setNewProjectName('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateProject(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-200/80 rounded-xl text-xs font-bold text-gray-700 transition shadow-2xs"
            >
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              <span>新建项目分组</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDrawer;