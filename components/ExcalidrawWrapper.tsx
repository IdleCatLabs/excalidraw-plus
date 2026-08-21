"use client";
import React, { forwardRef, useImperativeHandle, useState, useEffect, useRef } from "react";

export interface ExcalidrawRef {
  addElements: (elements: any[]) => boolean;
  getSceneData: () => { elements: any[]; appState: any };
  loadSceneData: (elements: any[]) => void;
}

// 构建 100% 原生合格的 Excalidraw 矢量图元（无需外部转换工具）
function createExcalidrawElement(raw: any, index: number): any {
  if (!raw || typeof raw !== "object") return null;

  let type = String(raw.type || "rectangle").toLowerCase();
  if (type === "circle") type = "ellipse";
  if (["box", "card", "button", "container", "frame", "navbar", "tabbar", "header", "footer", "modal", "badge"].includes(type)) {
    type = "rectangle";
  }
  if (["label", "heading", "title", "paragraph", "span", "subheading"].includes(type)) {
    type = "text";
  }

  const validTypes = ["rectangle", "ellipse", "diamond", "text", "arrow", "line"];
  const finalType = validTypes.includes(type) ? type : "rectangle";

  const strokeColor = raw.strokeColor || raw.color || (raw.backgroundColor === "#0f172a" ? "#64748b" : "#1e293b");
  const backgroundColor = raw.backgroundColor && raw.backgroundColor !== "transparent" ? raw.backgroundColor : "transparent";

  let x = Number(raw.x);
  if (isNaN(x)) x = 100;
  let y = Number(raw.y);
  if (isNaN(y)) y = 100;
  
  let width = Number(raw.width) || (finalType === "text" ? 140 : 200);
  let height = Number(raw.height) || (finalType === "text" ? 30 : 60);

  // 基础通用元数据
  const base: any = {
    id: raw.id || `el_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    type: finalType,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor,
    backgroundColor,
    fillStyle: backgroundColor !== "transparent" ? "solid" : "hachure",
    strokeWidth: Number(raw.strokeWidth) || 1.5,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: finalType === "rectangle" ? { type: 3 } : null,
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };

  // 文本专属字段
  if (finalType === "text") {
    const textContent = String(raw.text ?? raw.content ?? raw.label ?? "文本");
    const fontSize = Number(raw.fontSize) || 16;
    base.text = textContent;
    base.fontSize = fontSize;
    base.fontFamily = 1;
    base.textAlign = raw.textAlign || "left";
    base.verticalAlign = raw.verticalAlign || "top";
    base.baseline = fontSize;
    base.containerId = null;
    base.originalText = textContent;
    base.lineHeight = 1.25;
    // 根据文本长度自动预估宽高
    base.width = Math.max(textContent.length * (fontSize * 0.8), 30);
    base.height = fontSize * 1.4;
  }

  // 线条与箭头专属坐标点矩阵
  if (finalType === "line" || finalType === "arrow") {
    let points: [number, number][] = [[0, 0], [Math.max(width, 20), 0]];
    if (raw.x1 !== undefined && raw.x2 !== undefined) {
      const sx = Number(raw.x1) || 0;
      const sy = Number(raw.y1) || 0;
      const ex = Number(raw.x2) || 0;
      const ey = Number(raw.y2) || 0;
      base.x = sx;
      base.y = sy;
      points = [[0, 0], [ex - sx, ey - sy]];
      base.width = Math.max(Math.abs(ex - sx), 1);
      base.height = Math.max(Math.abs(ey - sy), 1);
    } else if (Array.isArray(raw.points) && raw.points.length >= 2) {
      points = raw.points;
    }
    base.points = points;
    base.lastCommittedPoint = null;
    base.startBinding = null;
    base.endBinding = null;
    base.startArrowhead = null;
    base.endArrowhead = finalType === "arrow" ? "arrow" : null;
  }

  return base;
}

const ExcalidrawWrapper = forwardRef<ExcalidrawRef, { boardId?: string }>((props, ref) => {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<any>(null);
  const apiRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    import("@excalidraw/excalidraw").then((mod) => {
      if (mounted) {
        setExcalidrawComponent(() => mod.Excalidraw);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      addElements: (newElements: any[]) => {
        const api = apiRef.current;
        if (!api) {
          console.error("[Excalidraw] 画布 API 尚未初始化完成");
          return false;
        }

        if (!Array.isArray(newElements) || newElements.length === 0) {
          return false;
        }

        // 1. 构建符合规范的图元对象
        const validList: any[] = [];
        newElements.forEach((raw, i) => {
          try {
            const el = createExcalidrawElement(raw, i);
            if (el) validList.push(el);
          } catch (e) {
            console.warn("[Excalidraw] 忽略单个异常图元:", e);
          }
        });

        if (validList.length === 0) return false;

        console.log(`[Excalidraw] 准备注入 ${validList.length} 个元素:`, validList);

        // 2. 直通 updateScene
        const currentElements = api.getSceneElements() || [];
        const nextElements = [...currentElements, ...validList];

        api.updateScene({
          elements: nextElements,
          commitToHistory: true,
        });

        // 3. 自动缩放并聚焦居中
        setTimeout(() => {
          if (api.scrollToContent) {
            api.scrollToContent(validList, { fitToContent: true, animate: true, duration: 300 });
          }
        }, 100);

        return true;
      },
      getSceneData: () => ({
        elements: apiRef.current ? apiRef.current.getSceneElements() : [],
        appState: apiRef.current ? apiRef.current.getAppState() : {},
      }),
      loadSceneData: (elements: any[]) => {
        if (apiRef.current) {
          apiRef.current.updateScene({ elements });
        }
      },
    }),
    []
  );

  if (!ExcalidrawComponent) {
    return <div className="h-full w-full flex items-center justify-center text-slate-400">正在载入画布引擎...</div>;
  }

  return (
    <div className="w-full h-full relative" style={{ height: "100%", width: "100%" }}>
      <ExcalidrawComponent
        excalidrawAPI={(api: any) => {
          apiRef.current = api;
          if (typeof window !== "undefined") {
            (window as any).__excalidrawAPI = api;
          }
        }}
        langCode="zh-CN"
        theme="light"
      />
    </div>
  );
});

ExcalidrawWrapper.displayName = "ExcalidrawWrapper";
export default ExcalidrawWrapper;