"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Clock, Layers, Sparkles } from "lucide-react";

export default function ShareViewPage() {
  const params = useParams();
  const boardId = params?.boardId as string;

  const [loading, setLoading] = useState(true);
  const [boardData, setBoardData] = useState<any>(null);
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<any>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    import("@excalidraw/excalidraw").then((mod) => {
      if (mounted) setExcalidrawComponent(() => mod.Excalidraw);
    });

    if (boardId) {
      fetch(`/api/share/${boardId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) setBoardData(data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
    return () => {
      mounted = false;
    };
  }, [boardId]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 select-none">
      {/* 顶部只读提示栏 */}
      <header className="h-12 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 flex items-center justify-between text-slate-100 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[280px] sm:max-w-md">
              {boardData?.name || "分享草图"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          {boardData && (
            <>
              <span className="hidden sm:flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                {boardData.data?.elements?.length || 0} 图元
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {new Date(boardData.updatedAt).toLocaleDateString()}
              </span>
            </>
          )}
          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[11px] font-medium">
            <ShieldCheck className="w-3 h-3" /> 只读预览模式
          </span>
        </div>
      </header>

      {/* Excalidraw 只读渲染视口 */}
      <div className="flex-1 w-full h-[calc(100vh-48px)] relative bg-white">
        {loading || !ExcalidrawComponent ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>加载只读草图中...</span>
          </div>
        ) : (
          <ExcalidrawComponent
            excalidrawAPI={(api: any) => {
              apiRef.current = api;
              if (boardData?.data?.elements) {
                api.updateScene({ elements: boardData.data.elements });
                setTimeout(() => {
                  if (api.scrollToContent) {
                    api.scrollToContent(boardData.data.elements, { fitToContent: false, animate: true, duration: 250 });
                  }
                }, 100);
              }
            }}
            viewModeEnabled={true}
            zenModeEnabled={false}
            gridModeEnabled={true}
            theme="light"
            langCode="zh-CN"
          />
        )}
      </div>
    </div>
  );
}