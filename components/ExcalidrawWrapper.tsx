'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Save, Settings, Folder } from 'lucide-react';

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white text-gray-400 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs">画板引擎初始化中...</span>
      </div>
    ),
  }
);

export interface SceneData {
  id?: string;
  title?: string;
  elements?: readonly any[];
  appState?: any;
  files?: any;
}

interface ExcalidrawWrapperProps {
  boardId: string;
  boardTitle: string;
  projectName: string;
  sceneData?: SceneData | null;
  currentUser?: any;
  onApiReady?: (api: any) => void;
  onChange?: (elements: readonly any[], appState: any, files: any) => void;
  onSave?: () => void;
  onOpenProjectDrawer?: () => void;
  onOpenModelConfig?: () => void;
  onOpenCodeGen?: () => void;
  onToggleAiSidebar?: () => void;
  onOpenMemberManage?: () => void;
  onOpenShareModal?: () => void;
}

export default function ExcalidrawWrapper({
  boardId,
  boardTitle,
  projectName,
  sceneData,
  currentUser,
  onApiReady,
  onChange,
  onSave,
  onOpenProjectDrawer,
  onOpenModelConfig,
  onOpenCodeGen,
  onToggleAiSidebar,
  onOpenMemberManage,
  onOpenShareModal,
}: ExcalidrawWrapperProps) {
  const apiRef = useRef<any>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);
  const [ExcalidrawUI, setExcalidrawUI] = useState<{ MainMenu: any } | null>(null);
  const lastLoadedKeyRef = useRef<string | null>(null);

  const onApiReadyRef = useRef(onApiReady);
  onApiReadyRef.current = onApiReady;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    import('@excalidraw/excalidraw').then((mod) => {
      setExcalidrawUI({
        MainMenu: mod.MainMenu,
      });
    });
  }, []);

  const handleExcalidrawAPI = useCallback((api: any) => {
    if (apiRef.current !== api) {
      apiRef.current = api;
      setIsApiReady(true);
      if (typeof window !== 'undefined') {
        (window as any).__EXCALIDRAW_API__ = api;
      }
      onApiReadyRef.current?.(api);
    }
  }, []);

  // 严格按画板 ID 同步远端数据并保护 AppState
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !sceneData) return;

    const currentKey = `${boardId}_${sceneData.elements?.length || 0}`;
    if (lastLoadedKeyRef.current !== currentKey) {
      lastLoadedKeyRef.current = currentKey;

      try {
        const elements = sceneData.elements || [];
        const appState = sceneData.appState || {};
        const files = sceneData.files || {};
        const currentAppState = typeof api.getAppState === 'function' ? api.getAppState() : {};

        api.updateScene({
          elements,
          appState: {
            ...currentAppState,
            ...appState,
            collaborators: new Map(),
          },
          files,
          commitToHistory: false,
        });

        if (elements.length > 0) {
          setTimeout(() => {
            if (typeof api.scrollToContent === 'function') {
              try {
                api.scrollToContent(elements, {
                  fitToContent: true,
                  animate: true,
                });
              } catch (e) {}
            }
          }, 80);
        }
      } catch (err) {
        console.error('更新画板数据失败:', err);
      }
    }
  }, [isApiReady, sceneData, boardId]);

  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    onChangeRef.current?.(elements, appState, files);
  }, []);

  const MainMenu = ExcalidrawUI?.MainMenu;

  return (
    <div className="w-full h-full relative">
      <Excalidraw
        excalidrawAPI={handleExcalidrawAPI}
        onChange={handleChange}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            saveToActiveFile: false,
            export: { saveFileToDisk: true },
            toggleTheme: true,
          },
        }}
      >
        {MainMenu && (
          <MainMenu>
            {onSave && (
              <MainMenu.Item
                onSelect={onSave}
                icon={<Save className="w-4 h-4" />}
              >
                保存画板到云端
              </MainMenu.Item>
            )}
            {onOpenProjectDrawer && (
              <MainMenu.Item
                onSelect={onOpenProjectDrawer}
                icon={<Folder className="w-4 h-4" />}
              >
                切换项目画板
              </MainMenu.Item>
            )}
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        )}
      </Excalidraw>
    </div>
  );
}