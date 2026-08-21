"use client";
import React, { useState, useEffect } from "react";
import { 
  FolderPlus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Clock, 
  Layers, 
  Loader2, 
  ChevronLeft,
  FileText,
  Search
} from "lucide-react";

export interface BoardSummary {
  boardId: string;
  name: string;
  updatedAt: string;
  elementCount: number;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onNewBoard: () => void;
}

export default function ProjectDrawer({
  isOpen,
  onClose,
  currentBoardId,
  onSelectBoard,
  onNewBoard,
}: DrawerProps) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchKey] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // 加载画板列表
  const fetchBoards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scenes");
      const data = await res.json();
      if (data.boards) {
        setBoards(data.boards);
      }
    } catch (e) {
      console.error("加载草图列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBoards();
    }
  }, [isOpen]);

  // 重命名草图
  const handleRename = async (boardId: string, currentData: any) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      // 先获取原数据以保留 elements
      const getRes = await fetch(`/api/scenes?boardId=${boardId}`);
      const detail = await getRes.json();

      await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          name: editName.trim(),
          data: detail.data || { elements: [] },
        }),
      });

      setBoards((prev) =>
        prev.map((b) => (b.boardId === boardId ? { ...b, name: editName.trim() } : b))
      );
    } catch (e) {
      alert("重命名失败");
    } finally {
      setEditingId(null);
    }
  };

  // 删除草图
  const handleDelete = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除此草图吗？此操作无法撤销。")) return;

    try {
      const res = await fetch(`/api/scenes?boardId=${boardId}`, { method: "DELETE" });
      if (res.ok) {
        setBoards((prev) => prev.filter((b) => b.boardId !== boardId));
        if (currentBoardId === boardId) {
          onNewBoard();
        }
      }
    } catch (e) {
      alert("删除失败");
    }
  };

  const filteredBoards = boards.filter((b) =>
    b.name.toLowerCase().includes(searchKey.toLowerCase())
  );

  return (
    <>
      {/* 遮罩背景 */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* 侧边滑出抽屉 */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-80 bg-white border-r border-slate-200 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 抽屉头部 */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>项目草图库</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* 顶部操作：新建草图 + 搜索 */}
        <div className="p-3 border-b border-slate-100 space-y-2.5">
          <button
            onClick={() => {
              onNewBoard();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 px-3 rounded-lg shadow-xs transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>新建空白草图</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              placeholder="搜索草图名称..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-slate-800 transition-colors"
            />
          </div>
        </div>

        {/* 草图列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>加载 MinIO 草图库...</span>
            </div>
          ) : filteredBoards.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
              <FileText className="w-6 h-6 text-slate-300 mb-1" />
              <span>暂无匹配的草图</span>
            </div>
          ) : (
            filteredBoards.map((b) => {
              const isActive = b.boardId === currentBoardId;
              const isEditing = editingId === b.boardId;

              return (
                <div
                  key={b.boardId}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectBoard(b.boardId);
                      onClose();
                    }
                  }}
                  className={`group relative p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isActive
                      ? "bg-indigo-50/70 border-indigo-200 shadow-xs"
                      : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(b.boardId, b);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 text-xs border border-indigo-300 rounded px-1.5 py-0.5 outline-none bg-white text-slate-800"
                        />
                        <button
                          onClick={() => handleRename(b.boardId, b)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`font-medium truncate flex-1 ${isActive ? "text-indigo-900 font-semibold" : "text-slate-700"}`}>
                          {b.name}
                        </span>

                        {/* 悬停操作按钮 */}
                        <div className="hidden group-hover:flex items-center gap-1 text-slate-400">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(b.boardId);
                              setEditName(b.name);
                            }}
                            title="重命名"
                            className="p-1 hover:text-slate-600 hover:bg-slate-200/60 rounded"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, b.boardId)}
                            title="删除"
                            className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 元数据：元素数与更新时间 */}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Layers className="w-2.5 h-2.5" />
                      {b.elementCount} 个图元
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(b.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}