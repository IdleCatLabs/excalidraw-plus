"use client";
import React, { useState, useEffect } from "react";
import { 
  FolderPlus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Loader2, 
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  Search,
  Plus,
  FolderSymlink
} from "lucide-react";

export interface ProjectGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface BoardSummary {
  boardId: string;
  projectId: string;
  name: string;
  updatedAt: string;
  elementCount: number;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onNewBoard: (projectId?: string) => void;
}

export default function ProjectDrawer({
  isOpen,
  onClose,
  currentBoardId,
  onSelectBoard,
  onNewBoard,
}: DrawerProps) {
  const [projects, setProjects] = useState<ProjectGroup[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState("");
  
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState("");

  // 移动草图弹出框状态
  const [movingBoardId, setMovingBoardId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, boardRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/scenes"),
      ]);
      const projData = await projRes.json();
      const boardData = await boardRes.json();

      if (projData.projects) {
        setProjects(projData.projects);
        const exp: Record<string, boolean> = {};
        projData.projects.forEach((p: ProjectGroup) => { exp[p.id] = true; });
        setExpandedProjects(exp);
      }
      if (boardData.boards) {
        setBoards(boardData.boards);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setIsCreatingProject(false);
      return;
    }
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const data = await res.json();
      if (data.project) {
        setProjects((prev) => [...prev, data.project]);
        setExpandedProjects((prev) => ({ ...prev, [data.project.id]: true }));
      }
    } finally {
      setNewProjectName("");
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (projectId === "proj_default") {
      alert("默认项目不允许删除");
      return;
    }
    if (!confirm("确定删除该项目吗？组内草图将被归入默认项目。")) return;
    try {
      await fetch(`/api/projects?projectId=${projectId}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      fetchData();
    } catch {}
  };

  const handleRenameBoard = async (boardId: string) => {
    if (!editBoardName.trim()) {
      setEditingBoardId(null);
      return;
    }
    try {
      const detail = await (await fetch(`/api/scenes?boardId=${boardId}`)).json();
      await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...detail, name: editBoardName.trim() }),
      });
      setBoards((prev) => prev.map((b) => (b.boardId === boardId ? { ...b, name: editBoardName.trim() } : b)));
    } finally {
      setEditingBoardId(null);
    }
  };

  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除此草图吗？")) return;
    try {
      await fetch(`/api/scenes?boardId=${boardId}`, { method: "DELETE" });
      setBoards((prev) => prev.filter((b) => b.boardId !== boardId));
      if (currentBoardId === boardId) onNewBoard();
    } catch {}
  };

  // 移动草图至新项目
  const handleMoveBoard = async (boardId: string, targetProjectId: string) => {
    try {
      const res = await fetch("/api/scenes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, targetProjectId }),
      });
      if (res.ok) {
        setBoards((prev) =>
          prev.map((b) => (b.boardId === boardId ? { ...b, projectId: targetProjectId } : b))
        );
      }
    } finally {
      setMovingBoardId(null);
    }
  };

  const filteredBoards = boards.filter((b) =>
    b.name.toLowerCase().includes(searchKey.toLowerCase())
  );

  return (
    <>
      {isOpen && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs" />}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-80 bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Folder className="w-4 h-4 text-indigo-600" />
            <span>项目与草图库</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewBoard("proj_default"); // 默认新建在默认项目下
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建空白草图</span>
            </button>
            <button
              onClick={() => setIsCreatingProject(true)}
              title="新建项目分组"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span>新建分组</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder="快速搜索草图名称..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
            />
          </div>

          {isCreatingProject && (
            <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-lg border border-indigo-200">
              <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                  if (e.key === "Escape") setIsCreatingProject(false);
                }}
                placeholder="输入新项目名称..."
                className="flex-1 text-xs bg-transparent outline-none px-1 py-0.5 text-slate-800"
              />
              <button onClick={handleCreateProject} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setIsCreatingProject(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* 分组与草图列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>加载项目库...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs">暂无项目</div>
          ) : (
            projects.map((proj) => {
              const isExpanded = expandedProjects[proj.id] !== false;
              const projectBoards = filteredBoards.filter(
                (b) => b.projectId === proj.id || (!b.projectId && proj.id === "proj_default")
              );

              return (
                <div key={proj.id} className="rounded-lg border border-slate-100 bg-slate-50/50 overflow-hidden">
                  <div
                    onClick={() => toggleProject(proj.id)}
                    className="group flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1.5 truncate flex-1">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                      <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{proj.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({projectBoards.length})</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewBoard(proj.id);
                          onClose();
                        }}
                        title="在此项目下新建草图"
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {proj.id !== "proj_default" && (
                        <button
                          onClick={(e) => handleDeleteProject(e, proj.id)}
                          title="删除项目"
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-1 space-y-1 bg-white">
                      {projectBoards.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-slate-400">暂无草图</div>
                      ) : (
                        projectBoards.map((b) => {
                          const isActive = b.boardId === currentBoardId;
                          const isEditing = editingBoardId === b.boardId;
                          const isMoving = movingBoardId === b.boardId;

                          return (
                            <div
                              key={b.boardId}
                              onClick={() => {
                                if (!isEditing && !isMoving) {
                                  onSelectBoard(b.boardId);
                                  onClose();
                                }
                              }}
                              className={`group relative px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-all ${
                                isActive
                                  ? "bg-indigo-50/70 border-indigo-200"
                                  : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editBoardName}
                                      onChange={(e) => setEditBoardName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleRenameBoard(b.boardId);
                                        if (e.key === "Escape") setEditingBoardId(null);
                                      }}
                                      className="flex-1 text-xs border border-indigo-300 rounded px-1.5 py-0.5 outline-none bg-white"
                                    />
                                    <button onClick={() => handleRenameBoard(b.boardId)} className="text-emerald-600 p-0.5">
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setEditingBoardId(null)} className="text-slate-400 p-0.5">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5 truncate flex-1">
                                      <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                                      <span className={`truncate ${isActive ? "text-indigo-900 font-semibold" : "text-slate-700"}`}>
                                        {b.name}
                                      </span>
                                    </div>

                                    {/* 悬停操作工具 */}
                                    <div className="hidden group-hover:flex items-center gap-0.5 text-slate-400">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMovingBoardId(isMoving ? null : b.boardId);
                                        }}
                                        title="移动到其他项目"
                                        className="p-1 hover:text-indigo-600 rounded"
                                      >
                                        <FolderSymlink className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingBoardId(b.boardId);
                                          setEditBoardName(b.name);
                                        }}
                                        title="重命名"
                                        className="p-1 hover:text-slate-600 rounded"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteBoard(e, b.boardId)}
                                        title="删除"
                                        className="p-1 hover:text-rose-600 rounded"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* 移动草图下拉选择 */}
                              {isMoving && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1.5 p-1.5 bg-slate-50 border border-indigo-200 rounded-md text-[11px] space-y-1"
                                >
                                  <div className="text-[10px] text-slate-400 font-medium">移动至：</div>
                                  {projects.map((target) => (
                                    <button
                                      key={target.id}
                                      disabled={target.id === b.projectId}
                                      onClick={() => handleMoveBoard(b.boardId, target.id)}
                                      className={`w-full text-left px-2 py-1 rounded transition-colors truncate ${
                                        target.id === b.projectId
                                          ? "text-slate-300 cursor-not-allowed"
                                          : "text-slate-700 hover:bg-indigo-100 hover:text-indigo-700"
                                      }`}
                                    >
                                      {target.name} {target.id === b.projectId && "(当前)"}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}