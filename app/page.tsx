'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ExcalidrawWrapper from '@/components/ExcalidrawWrapper';
import ProjectDrawer, { BoardItem, ProjectItem } from '@/components/ProjectDrawer';
import AiSidebar from '@/components/AiSidebar';
import ModelConfigModal, { LOCAL_STORAGE_LLM_KEY, LLMConfig } from '@/components/ModelConfigModal';
import CodePreviewModal from '@/components/CodePreviewModal';
import MemberManagementModal from '@/components/MemberManagementModal';
import {
  Folder,
  Code2,
  Save,
  PanelLeft,
  Sparkles,
  Users,
  Share2,
  Loader2,
  ChevronDown,
  Copy,
  Check,
  X,
  LogOut,
  Shield,
} from 'lucide-react';

export interface UserProfile {
  id: string;
  username: string;
  role: 'superadmin' | 'admin' | 'editor' | 'viewer';
  avatar?: string;
}

function MainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 1. 用户与鉴权状态
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 2. 项目与画板管理状态
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('default-project');
  const [currentProjectName, setCurrentProjectName] = useState<string>('默认项目');
  const [currentBoardId, setCurrentBoardId] = useState<string>('default-board');
  const [currentBoardTitle, setCurrentBoardTitle] = useState<string>('12号');
  const [sceneData, setSceneData] = useState<any>(null);
  const [loadingScene, setLoadingScene] = useState<boolean>(false);

  // 3. Excalidraw 实例与画板元素选择状态
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [selectedElements, setSelectedElements] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSaveToast, setShowSaveToast] = useState<boolean>(false);
  const selectedIdsKeyRef = useRef<string>('');

  // 4. 大模型配置状态
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    protocol: 'openai_compatible (OpenAI 兼容协议)',
    baseUrl: 'https://khub.idlecatlabs.net/v1',
    apiKey: '',
    models: 'deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2',
    defaultModel: 'qwen3.7-plus',
    maxTokens: 4096,
  });

  // 5. 模态框与抽屉控制
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState<boolean>(false);
  const [isModelConfigOpen, setIsModelConfigOpen] = useState<boolean>(false);
  const [isCodeGenOpen, setIsCodeGenOpen] = useState<boolean>(false);
  const [isMemberManageOpen, setIsMemberManageOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // 分享链接状态
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const initializedRef = useRef<boolean>(false);

  // 点击外部收起用户下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 加载本地持久化配置
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_LLM_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLlmConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('读取本地配置失败:', e);
    }
  }, []);

  // 鉴权检查
  useEffect(() => {
    fetch('/api/auth')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser({
            id: 'admin-1',
            username: 'admin',
            role: 'superadmin',
          });
        }
      })
      .catch(() => {
        setCurrentUser({
          id: 'admin-1',
          username: 'admin',
          role: 'superadmin',
        });
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [router]);

  // 退出登录
  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (e) {
      console.error('退出登录异常:', e);
    } finally {
      localStorage.removeItem('current_board_id');
      localStorage.removeItem('current_project_id');
      router.push('/login');
    }
  };

  // 从云端加载画板内容
  const loadScene = useCallback(async (boardId: string) => {
    setLoadingScene(true);
    try {
      const res = await fetch(`/api/scenes?id=${encodeURIComponent(boardId)}&boardId=${encodeURIComponent(boardId)}`);
      if (res.ok) {
        const data = await res.json();
        setSceneData({
          id: boardId,
          title: data.title || '12号',
          elements: data.elements || [],
          appState: data.appState || {},
          files: data.files || {},
        });
        if (data.title) {
          setCurrentBoardTitle(data.title);
        }
      }
    } catch (err) {
      console.error('加载画板失败:', err);
    } finally {
      setLoadingScene(false);
    }
  }, []);

  // 刷新项目列表
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const projectList: ProjectItem[] = data.projects || [];
        setProjects(projectList);
        return projectList;
      }
    } catch (err) {
      console.error('拉取项目列表失败:', err);
    }
    return [];
  }, []);

  // 页面初始化
  useEffect(() => {
    if (authLoading || initializedRef.current) return;
    initializedRef.current = true;

    fetchProjects().then((projectList) => {
      const urlBoardId = searchParams.get('id') || localStorage.getItem('current_board_id') || 'default-board';
      const urlProjectId = searchParams.get('projectId') || localStorage.getItem('current_project_id');

      let targetProj = projectList.find((p) => p.id === urlProjectId) || projectList[0];
      let targetBoard: BoardItem | undefined;

      if (targetProj) {
        setCurrentProjectId(targetProj.id);
        setCurrentProjectName(targetProj.name);
        targetBoard = targetProj.boards?.find((b) => b.id === urlBoardId) || targetProj.boards?.[0];
      }

      if (targetBoard) {
        setCurrentBoardId(targetBoard.id);
        setCurrentBoardTitle(targetBoard.title || '12号');
        loadScene(targetBoard.id);
      } else {
        setCurrentBoardId(urlBoardId);
        loadScene(urlBoardId);
      }
    });
  }, [authLoading, fetchProjects, loadScene, searchParams]);

  // 保存画板到云端
  const handleSaveScene = async () => {
    if (!excalidrawAPI || isSaving) return;

    setIsSaving(true);
    try {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      const files = excalidrawAPI.getFiles();

      const payload = {
        id: currentBoardId,
        boardId: currentBoardId,
        projectId: currentProjectId,
        title: currentBoardTitle,
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files,
      };

      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        localStorage.setItem('current_board_id', currentBoardId);
        localStorage.setItem('current_project_id', currentProjectId);
        localStorage.setItem('current_board_title', currentBoardTitle);
        setShowSaveToast(true);
        fetchProjects();
      } else {
        const errData = await res.json();
        alert('保存画板失败: ' + (errData.error || '未知错误'));
      }
    } catch (err: any) {
      console.error('保存画板异常:', err);
      alert('保存异常: ' + (err.message || '网络连接失败'));
    } finally {
      setIsSaving(false);
    }
  };

  // 切换画板
  const handleSelectBoard = (boardId: string, title?: string, projectName?: string) => {
    setCurrentBoardId(boardId);
    if (title) {
      setCurrentBoardTitle(title);
      localStorage.setItem('current_board_title', title);
    }
    if (projectName) {
      setCurrentProjectName(projectName);
    }

    localStorage.setItem('current_board_id', boardId);
    loadScene(boardId);
    setIsDrawerOpen(false);
  };

  const handleBoardRenamed = (boardId: string, newTitle: string) => {
    if (boardId === currentBoardId) {
      setCurrentBoardTitle(newTitle);
      localStorage.setItem('current_board_title', newTitle);
    }
  };

  const handleBoardDeleted = (boardId: string) => {
    if (boardId === currentBoardId) {
      setCurrentBoardId('default-board');
      setCurrentBoardTitle('12号');
      loadScene('default-board');
    }
  };

  const handleProjectRenamed = (projectId: string, newName: string) => {
    if (projectId === currentProjectId) {
      setCurrentProjectName(newName);
    }
  };

  const handleElementsChange = useCallback((elements: readonly any[], appState: any) => {
    const selectedObj = appState?.selectedElementIds || {};
    const keys = Object.keys(selectedObj).filter((k) => selectedObj[k]).sort().join(',');

    if (keys !== selectedIdsKeyRef.current) {
      selectedIdsKeyRef.current = keys;
      if (!keys) {
        setSelectedElements([]);
      } else {
        const selected = elements.filter((el) => selectedObj[el.id]);
        setSelectedElements(selected);
      }
    }
  }, []);

  const handleApiReady = useCallback((api: any) => {
    setExcalidrawAPI(api);
  }, []);

  const handleOpenCodeGen = () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const selected = elements.filter(
      (el: any) => appState.selectedElementIds && appState.selectedElementIds[el.id]
    );
    setSelectedElements(selected.length > 0 ? selected : elements);
    setIsCodeGenOpen(true);
  };

  const handleOpenShare = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setShareUrl(`${origin}/share/${currentBoardId}`);
    setIsShareModalOpen(true);
  };

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleModelConfigSaved = (newConfig: LLMConfig) => {
    setLlmConfig(newConfig);
    localStorage.setItem(LOCAL_STORAGE_LLM_KEY, JSON.stringify(newConfig));
    window.dispatchEvent(new Event('llm_config_updated'));
  };

  if (authLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-600 gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">正在载入工作空间...</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#fafafa] select-none">
      {/* 顶部全局导航栏 */}
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-20 shrink-0 shadow-xs">
        {/* 左侧：抽屉按钮、项目名、画板标题 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl text-gray-700 transition"
            title="打开项目抽屉"
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 transition shadow-2xs"
          >
            <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate max-w-[130px]">{currentProjectName}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          <div className="h-4 w-[1px] bg-gray-200 mx-0.5" />

          <input
            type="text"
            value={currentBoardTitle}
            onChange={(e) => setCurrentBoardTitle(e.target.value)}
            placeholder="未命名画板"
            className="font-bold text-gray-800 text-sm px-2.5 py-1.5 rounded-lg border border-transparent hover:border-gray-300 focus:border-indigo-500 focus:bg-white outline-none transition max-w-[200px]"
          />

          {loadingScene && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 ml-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px] font-medium">同步画板中...</span>
            </div>
          )}
        </div>

        {/* 右侧按指定顺序排列：保存 / 分享 / 项目成员 / 选区生成代码 / AI助手 / 用户信息 */}
        <div className="flex items-center gap-2">
          {/* 1. 保存 */}
          <button
            type="button"
            onClick={handleSaveScene}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? '保存中' : '保存'}</span>
          </button>

          {/* 2. 分享 */}
          <button
            type="button"
            onClick={handleOpenShare}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
            title="分享此画板"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* 3. 项目成员 */}
          <button
            type="button"
            onClick={() => setIsMemberManageOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
            title="项目成员权限管理"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* 4. 选区生成代码 */}
          <button
            type="button"
            onClick={handleOpenCodeGen}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1e8354] hover:bg-[#186c45] active:bg-[#135737] text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Code2 className="w-4 h-4" />
            <span>选区生成代码</span>
            {selectedElements.length > 0 && (
              <span className="bg-emerald-950/40 text-emerald-100 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {selectedElements.length}
              </span>
            )}
          </button>

          {/* 5. AI助手 */}
          <button
            type="button"
            onClick={() => setIsAiSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              isAiSidebarOpen
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 助手</span>
          </button>

          <div className="h-4 w-[1px] bg-gray-200 mx-1" />

          {/* 用户信息与纯退出登录菜单 */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl hover:bg-gray-100 transition border border-transparent hover:border-gray-200"
            >
              <div className="w-7 h-7 rounded-full bg-linear-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {currentUser?.username ? currentUser.username[0] : 'U'}
              </div>
              <span className="text-xs font-semibold text-gray-700 max-w-[80px] truncate">
                {currentUser?.username || '用户'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {currentUser?.username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Shield className="w-2.5 h-2.5 mr-1" />
                      {currentUser?.role === 'superadmin' ? '管理员' : '项目成员'}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 画布与自带拖拽调宽的完整 AI 侧边栏 */}
      <div className="flex-1 w-full h-full flex overflow-hidden relative">
        <main className="flex-1 h-full w-full relative">
          <ExcalidrawWrapper
            boardId={currentBoardId}
            boardTitle={currentBoardTitle}
            projectName={currentProjectName}
            sceneData={sceneData}
            currentUser={currentUser}
            onApiReady={handleApiReady}
            onChange={handleElementsChange}
            onSave={handleSaveScene}
            onOpenProjectDrawer={() => setIsDrawerOpen(true)}
            onOpenCodeGen={handleOpenCodeGen}
            onToggleAiSidebar={() => setIsAiSidebarOpen((prev) => !prev)}
            onOpenMemberManage={() => setIsMemberManageOpen(true)}
            onOpenShareModal={handleOpenShare}
          />
        </main>

        {isAiSidebarOpen && (
          <AiSidebar
            isOpen={isAiSidebarOpen}
            onClose={() => setIsAiSidebarOpen(false)}
            excalidrawAPI={excalidrawAPI}
          />
        )}
      </div>

      {/* 项目抽屉 */}
      <ProjectDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projects={projects}
        currentProjectId={currentProjectId}
        currentBoardId={currentBoardId}
        onSelectBoard={handleSelectBoard}
        onRefreshProjects={fetchProjects}
        onBoardRenamed={handleBoardRenamed}
        onBoardDeleted={handleBoardDeleted}
        onProjectRenamed={handleProjectRenamed}
      />

      {/* 大模型配置弹窗 */}
      <ModelConfigModal
        isOpen={isModelConfigOpen}
        onClose={() => setIsModelConfigOpen(false)}
        onSaved={handleModelConfigSaved}
      />

      {/* 选区代码生成与预览模态框 */}
      <CodePreviewModal
        isOpen={isCodeGenOpen}
        onClose={() => setIsCodeGenOpen(false)}
        selectedElements={selectedElements}
        llmConfig={llmConfig}
      />

      {/* 项目成员权限管理模态框 */}
      <MemberManagementModal
        isOpen={isMemberManageOpen}
        onClose={() => setIsMemberManageOpen(false)}
        projectId={currentProjectId}
        projectName={currentProjectName}
      />

      {/* 分享弹窗 */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">分享此画板</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3 mb-2">
              获得此链接的用户均可免登录以只读模式实时查阅此画板：
            </p>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 mb-4">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-xs text-gray-700 flex-1 outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleCopyShareUrl}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0 transition"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    复制
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 保存成功 Toast 弹窗 */}
      {showSaveToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center border border-gray-100">
            <h4 className="text-base font-bold text-gray-900 mb-6">
              画板已成功持久化至云端！
            </h4>
            <button
              type="button"
              onClick={() => setShowSaveToast(false)}
              className="w-full py-2.5 bg-[#4a4214] hover:bg-[#3b3510] text-white rounded-xl font-medium text-sm transition shadow-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MainPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-600 gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">正在载入工作空间...</p>
        </div>
      }
    >
      <MainContent />
    </Suspense>
  );
}