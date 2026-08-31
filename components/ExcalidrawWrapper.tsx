'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false }
);

export interface ExcalidrawRef {
  getSceneData: () => { elements: any[]; appState: any; files: any };
  getSceneElements: () => any[];
  getSelectedElements: () => any[];
  getAppState: () => any;
  getFiles: () => any;
  updateScene: (sceneData: {
    elements?: any[];
    appState?: any;
    files?: any;
    commitToHistory?: boolean;
  }) => void;
  scrollToContent: (target?: any, opts?: { fitToViewport?: boolean; animate?: boolean }) => void;
  resetScene: () => void;
  exportSelectedToImage: (opts?: any) => Promise<string>;
  excalidrawAPI: any;
  [key: string]: any;
}

interface ExcalidrawWrapperProps {
  initialData?: any;
  onChange?: (elements: any[], appState: any, files: any) => void;
  [key: string]: any;
}

const ExcalidrawWrapper = forwardRef<ExcalidrawRef, ExcalidrawWrapperProps>(
  ({ initialData, onChange, ...props }, ref) => {
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        getSceneData: () => {
          if (!excalidrawAPI) return { elements: [], appState: {}, files: {} };
          return {
            elements: typeof excalidrawAPI.getSceneElements === 'function' ? excalidrawAPI.getSceneElements() : [],
            appState: typeof excalidrawAPI.getAppState === 'function' ? excalidrawAPI.getAppState() : {},
            files: typeof excalidrawAPI.getFiles === 'function' ? excalidrawAPI.getFiles() : {},
          };
        },
        getSceneElements: () => {
          return excalidrawAPI && typeof excalidrawAPI.getSceneElements === 'function'
            ? excalidrawAPI.getSceneElements()
            : [];
        },
        getSelectedElements: () => {
          if (!excalidrawAPI) return [];
          const elements = excalidrawAPI.getSceneElements() || [];
          const appState = excalidrawAPI.getAppState() || {};
          const selectedIds = appState.selectedElementIds || {};
          const selected = elements.filter((el: any) => selectedIds[el.id] && !el.isDeleted);
          return selected.length > 0 ? selected : elements.filter((el: any) => !el.isDeleted);
        },
        getAppState: () => {
          return excalidrawAPI && typeof excalidrawAPI.getAppState === 'function'
            ? excalidrawAPI.getAppState()
            : {};
        },
        getFiles: () => {
          return excalidrawAPI && typeof excalidrawAPI.getFiles === 'function'
            ? excalidrawAPI.getFiles()
            : {};
        },
        updateScene: (sceneData) => {
          if (excalidrawAPI && typeof excalidrawAPI.updateScene === 'function') {
            excalidrawAPI.updateScene(sceneData);
          }
        },
        scrollToContent: (target, opts) => {
          if (excalidrawAPI && typeof excalidrawAPI.scrollToContent === 'function') {
            excalidrawAPI.scrollToContent(target || excalidrawAPI.getSceneElements(), {
              fitToViewport: true,
              animate: true,
              ...opts,
            });
          }
        },
        resetScene: () => {
          if (excalidrawAPI && typeof excalidrawAPI.resetScene === 'function') {
            excalidrawAPI.resetScene();
          }
        },
        // 导出选区/画布为 Base64 PNG 供 AI 代码生成器读取
        exportSelectedToImage: async (opts?: any): Promise<string> => {
          if (!excalidrawAPI) {
            throw new Error('Excalidraw 画板实例尚未初始化完成');
          }

          const elements = excalidrawAPI.getSceneElements() || [];
          const appState = excalidrawAPI.getAppState() || {};
          const files = excalidrawAPI.getFiles() || {};

          const selectedIds = appState.selectedElementIds || {};
          let targetElements = elements.filter((el: any) => selectedIds[el.id] && !el.isDeleted);

          // 若未框选任何元素，则默认导出整个画布内有效元素
          if (targetElements.length === 0) {
            targetElements = elements.filter((el: any) => !el.isDeleted);
          }

          if (targetElements.length === 0) {
            throw new Error('画板内暂无有效图元，请先绘制图表后再生成代码');
          }

          const { exportToBlob } = await import('@excalidraw/excalidraw');
          const blob = await exportToBlob({
            elements: targetElements,
            appState: {
              ...appState,
              exportWithDarkMode: false,
              exportBackground: true,
              viewBackgroundColor: '#ffffff',
            },
            files,
            mimeType: 'image/png',
            ...opts,
          });

          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        },
        excalidrawAPI,
      }),
      [excalidrawAPI]
    );

    const mergedInitialData = {
      ...initialData,
      appState: {
        viewBackgroundColor: '#f5f5f7',
        currentItemFontFamily: 1,
        ...initialData?.appState,
      },
    };

    useEffect(() => {
      if (!excalidrawAPI) return;

      (window as any).__EXCALIDRAW_API__ = excalidrawAPI;

      const handleCustomDrawAction = (e: CustomEvent) => {
        const { mode, elements } = e.detail || {};
        if (!Array.isArray(elements) || elements.length === 0) return;

        let finalElements = elements;
        if (mode === 'append' && typeof excalidrawAPI.getSceneElements === 'function') {
          const currentElements = excalidrawAPI.getSceneElements() || [];
          finalElements = [...currentElements, ...elements];
        }

        excalidrawAPI.updateScene({
          elements: finalElements,
          appState: { viewBackgroundColor: '#f5f5f7' },
          commitToHistory: true,
        });

        setTimeout(() => {
          if (typeof excalidrawAPI.scrollToContent === 'function') {
            excalidrawAPI.scrollToContent(elements, {
              fitToViewport: true,
              animate: true,
            });
          }
        }, 150);
      };

      window.addEventListener('excalidraw:apply-scene' as any, handleCustomDrawAction);

      return () => {
        window.removeEventListener('excalidraw:apply-scene' as any, handleCustomDrawAction);
      };
    }, [excalidrawAPI]);

    return (
      <div className="w-full h-full relative bg-[#f5f5f7]">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={mergedInitialData}
          onChange={onChange}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
            },
          }}
          {...props}
        />
      </div>
    );
  }
);

ExcalidrawWrapper.displayName = 'ExcalidrawWrapper';

export default ExcalidrawWrapper;