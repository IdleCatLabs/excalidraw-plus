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
}

export function ProjectDrawer({
  isOpen,
  onClose,
  currentBoardId,
  currentProjectId,
  projects: propProjects,
  onSelectBoard,
  onRefreshProjects,
}: DrawerProps) {
  const [internalProjects, setInternalProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [showCreateProject, setShowCreateProject] = useState<boolean>(false);
  const [creatingBoardForProj, setCreatingBoardForProj] = useState<string | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState<string>('');

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
    if (isOpen && (!propProjects || propProjects.length === 0)) {
      fetchProjects();
    }
  }, [isOpen, propProjects]);

  const projects = propProjects && propProjects.length > 0 ? propProjects : internalProjects;

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
        if (onRefreshProjects) {
          await onRefreshProjects();
        } else {
          await fetchProjects();
        }
      }
    } catch (err) {
      console.error('创建项目失败:', err);
    }
  };

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
        if (onRefreshProjects) {
          await onRefreshProjects();
        } else {
          await fetchProjects();
        }

        const project = projects.find((p) => p.id === projectId);
        if (onSelectBoard && newBoard?.id) {
          onSelectBoard(newBoard.id, newBoard.title || newBoardTitle, project?.name || '默认项目');
        }
      }
    } catch (err) {
      console.error('创建画板失败:', err);
    }
  };

  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!confirm('确定要删除该画板吗？此操作无法撤销。')) return;

    try {
      const res = await fetch(`/api/scenes?id=${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (onRefreshProjects) {
          await onRefreshProjects();
        } else {
          await fetchProjects();
        }
      }
    } catch (err) {
      console.error('删除画板失败:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      <div className="relative w-80 max-w-full bg-white h-full shadow-2xl z-10 flex flex-col border-r border-gray-200 animate-in slide-in-from-left duration-200 select-none">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-gray-900 text-base">项目与画板</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">加载项目列表中...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              暂无项目，点击下方按钮新建
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="space-y-1.5">
                <div className="flex items-center justify-between group px-2 py-1.5 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="truncate max-w-[150px]">{project.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCreatingBoardForProj(project.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                    title="在此项目下新建画板"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {creatingBoardForProj === project.id && (
                  <div className="flex items-center gap-1 pl-4 pr-1 py-1">
                    <input
                      type="text"
                      autoFocus
                      value={newBoardTitle}
                      onChange={(e) => setNewBoardTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard(project.id)}
                      placeholder="输入画板名称..."
                      className="w-full text-xs px-2.5 py-1.5 border border-indigo-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateBoard(project.id)}
                      className="px-2 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium shrink-0 hover:bg-indigo-700 transition"
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingBoardForProj(null);
                        setNewBoardTitle('');
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-1 pl-3">
                  {project.boards && project.boards.length > 0 ? (
                    project.boards.map((board) => {
                      const isCurrent = board.id === currentBoardId;
                      return (
                        <div
                          key={board.id}
                          onClick={() =>
                            onSelectBoard?.(board.id, board.title, project.name)
                          }
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer group transition ${
                            isCurrent
                              ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 shadow-xs'
                              : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileText
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isCurrent ? 'text-indigo-600' : 'text-gray-400'
                              }`}
                            />
                            <span className="truncate">{board.title || '未命名画板'}</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteBoard(e, board.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="删除画板"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] text-gray-400 pl-3 py-1">暂无画板</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          {showCreateProject ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="新项目名称..."
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl outline-none focus:border-indigo-500 bg-white"
              />
              <button
                type="button"
                onClick={handleCreateProject}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 transition"
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
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 transition shadow-xs"
            >
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              <span>新建项目</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectDrawer;