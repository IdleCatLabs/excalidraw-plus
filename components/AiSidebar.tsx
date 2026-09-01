'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Square,
  Settings,
  Bot,
  User,
  Sparkles,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Plus,
  Trash2,
  History,
  MessageSquare,
  X,
  Clock,
  RefreshCw,
  Check,
  Code2,
  Palette,
} from 'lucide-react';
import { ModelConfigModal, LOCAL_STORAGE_LLM_KEY, LLMConfig } from './ModelConfigModal';

export interface MessageItem {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number | string;
  [key: string]: any;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  messages: MessageItem[];
  [key: string]: any;
}

export interface AiSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  excalidrawAPI?: any;
  excalidrawRef?: any;
  threads?: ChatThread[];
  activeThreadId?: string;
  currentThreadId?: string;
  onSelectThread?: (id: string) => void;
  onNewThread?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onUpdateThreadTitle?: (id: string, title: string) => void;
  onUpdateMessages?: (
    threadId: string,
    updater: (prev: MessageItem[]) => MessageItem[]
  ) => void;
  boardName?: string;
  onInsertElements?: (elements: any[]) => void;
  onReplaceElements?: (elements: any[]) => void;
  [key: string]: any;
}

// 规范化 Excalidraw 图元数据结构
function normalizeExcalidrawElement(raw: any, index: number): any {
  const id = raw.id || `elem_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
  const type = raw.type || 'rectangle';
  const x = Number(raw.x) || 0;
  const y = Number(raw.y) || 0;
  const width = Number(raw.width) || 120;
  const height = Number(raw.height) || 60;
  const strokeColor = raw.strokeColor || '#09090b';
  const backgroundColor = raw.backgroundColor || (type === 'text' ? 'transparent' : '#ffffff');
  const fillStyle = raw.fillStyle || 'solid';
  const strokeWidth = Number(raw.strokeWidth) || (type === 'rectangle' ? 2 : 1.5);
  const strokeStyle = raw.strokeStyle || 'solid';
  const roughness = Number(raw.roughness) ?? 0;
  const opacity = Number(raw.opacity) || 100;
  const groupIds = Array.isArray(raw.groupIds) ? raw.groupIds : [];
  const roundness = raw.roundness || (type === 'rectangle' ? { type: 3 } : null);
  const seed = Number(raw.seed) || Math.floor(Math.random() * 100000);
  const version = Number(raw.version) || 1;
  const versionNonce = Number(raw.versionNonce) || Math.floor(Math.random() * 100000);

  const baseElement = {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor,
    backgroundColor,
    fillStyle,
    strokeWidth,
    strokeStyle,
    roughness,
    opacity,
    groupIds,
    frameId: null,
    roundness,
    seed,
    version,
    versionNonce,
    isDeleted: false,
    boundElements: Array.isArray(raw.boundElements) ? raw.boundElements : null,
    updated: Date.now(),
    link: null,
    locked: false,
  };

  if (type === 'text') {
    const text = String(raw.text || raw.rawText || raw.label || 'Text');
    const fontSize = Number(raw.fontSize) || 16;
    return {
      ...baseElement,
      text,
      fontSize,
      fontFamily: Number(raw.fontFamily) || 1,
      textAlign: raw.textAlign || 'left',
      verticalAlign: raw.verticalAlign || 'top',
      baseline: fontSize,
      containerId: raw.containerId || null,
      originalText: text,
      lineHeight: 1.25,
    };
  }

  if (type === 'arrow' || type === 'line') {
    const points =
      Array.isArray(raw.points) && raw.points.length > 0
        ? raw.points
        : [
            [0, 0],
            [width, height],
          ];
    return {
      ...baseElement,
      points,
      lastCommittedPoint: null,
      startBinding: raw.startBinding || null,
      endBinding: raw.endBinding || null,
      startArrowhead: type === 'arrow' ? raw.startArrowhead || null : null,
      endArrowhead: type === 'arrow' ? raw.endArrowhead || 'arrow' : null,
    };
  }

  return baseElement;
}

// 从大模型返回的内容中精准提取并修复 JSON 图元数据
function extractElementsFromContent(content: string): any[] | null {
  if (!content || typeof content !== 'string') return null;

  let rawJson = '';

  const codeBlockStart = content.search(/```(?:json)?/i);
  if (codeBlockStart !== -1) {
    const afterMarker = content.slice(codeBlockStart).replace(/^```(?:json)?\s*/i, '');
    const codeBlockEnd = afterMarker.indexOf('```');
    if (codeBlockEnd !== -1) {
      rawJson = afterMarker.slice(0, codeBlockEnd).trim();
    } else {
      rawJson = afterMarker.trim();
    }
  }

  if (!rawJson) {
    const firstBrace = content.indexOf('{');
    const firstBracket = content.indexOf('[');
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    if (startIdx !== -1) {
      const lastBrace = content.lastIndexOf('}');
      const lastBracket = content.lastIndexOf(']');
      const endIdx = Math.max(lastBrace, lastBracket);
      if (endIdx > startIdx) {
        rawJson = content.slice(startIdx, endIdx + 1).trim();
      } else {
        rawJson = content.slice(startIdx).trim();
      }
    }
  }

  if (!rawJson) return null;

  const getElements = (obj: any): any[] | null => {
    if (!obj) return null;
    if (Array.isArray(obj) && obj.length > 0) return obj;
    if (Array.isArray(obj.elements) && obj.elements.length > 0) return obj.elements;
    return null;
  };

  try {
    const parsed = JSON.parse(rawJson);
    const elems = getElements(parsed);
    if (elems) return elems.map(normalizeExcalidrawElement);
  } catch {}

  try {
    const cleaned = rawJson.replace(/,\s*([\]}])/g, '$1');
    const parsed = JSON.parse(cleaned);
    const elems = getElements(parsed);
    if (elems) return elems.map(normalizeExcalidrawElement);
  } catch {}

  try {
    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < rawJson.length; i++) {
      const ch = rawJson[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{' || ch === '[') {
          stack.push(ch);
        } else if (ch === '}' && stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
        } else if (ch === ']' && stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }

    let repaired = rawJson.trim().replace(/,\s*$/, '');
    if (inString) repaired += '"';

    while (stack.length > 0) {
      const top = stack.pop();
      if (top === '{') repaired += '}';
      else if (top === '[') repaired += ']';
    }

    const parsed = JSON.parse(repaired);
    const elems = getElements(parsed);
    if (elems) return elems.map(normalizeExcalidrawElement);
  } catch {}

  return null;
}

export const AiSidebar: React.FC<AiSidebarProps> = ({
  isOpen,
  onClose,
  excalidrawAPI,
  excalidrawRef,
  threads: externalThreads,
  activeThreadId,
  currentThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onUpdateThreadTitle,
  onUpdateMessages,
  onInsertElements,
  onReplaceElements,
}) => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  const [internalThreads, setInternalThreads] = useState<ChatThread[]>([
    {
      id: 'default',
      title: '主设计会话',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: '你好！支持文字对话与智能画图，请选择模型开始。',
          timestamp: Date.now(),
        },
      ],
    },
  ]);
  const [internalCurrentId, setInternalCurrentId] = useState<string>('default');
  const [showHistoryPanel, setShowHistoryPanel] = useState<boolean>(false);

  const threads = externalThreads || internalThreads;
  const currentActiveId = activeThreadId || currentThreadId || internalCurrentId;
  const currentThread =
    threads.find((t) => t.id === currentActiveId) || threads[0] || internalThreads[0];

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedMessageIds, setAppliedMessageIds] = useState<Record<string, boolean>>({});
  const [expandedJsonIds, setExpandedJsonIds] = useState<Record<string, boolean>>({});

  const abortControllerRef = useRef<any>(null);

  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('qwen3.7-plus');
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<any>(null);

  // 初始化加载侧边栏宽度
  useEffect(() => {
    const savedWidth = localStorage.getItem('excalidraw_plus_ai_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 320 && parsed <= 900) {
        setSidebarWidth(parsed);
      }
    }
  }, []);

  // 左右拖拽调节宽度处理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 320 && newWidth <= Math.min(900, window.innerWidth * 0.75)) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem('excalidraw_plus_ai_sidebar_width', sidebarWidth.toString());
    }
  }, [isResizing, sidebarWidth]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 核心修复：全面识别多种数据格式与 LocalStorage，解决“去配置模型”误报
  const fetchModels = async () => {
    try {
      let localConfig: Partial<LLMConfig> = {};
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_LLM_KEY);
        if (stored) localConfig = JSON.parse(stored);
      } catch {}

      const res = await fetch('/api/models');
      const data = await res.json();
      const config = data?.config || {};

      const hasValidKey = Boolean(
        localConfig.apiKey ||
        data?.hasKey ||
        data?.configured ||
        (config.apiKey && !config.apiKey.startsWith('•••'))
      );

      const rawModels =
        localConfig.models ||
        config.models ||
        data?.models ||
        'deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2';

      const modelArray: string[] = Array.isArray(rawModels)
        ? rawModels
        : typeof rawModels === 'string'
        ? rawModels.split(/[,，\n]/).map((m: string) => m.trim()).filter(Boolean)
        : [];

      if (hasValidKey && modelArray.length > 0) {
        setIsConfigured(true);
        setModels(modelArray);
        const def =
          localConfig.defaultModel ||
          config.defaultModel ||
          data?.defaultModel ||
          modelArray[0] ||
          'qwen3.7-plus';

        setSelectedModel((prev) => (prev && modelArray.includes(prev) ? prev : def));
      } else {
        setIsConfigured(hasValidKey);
        setModels(modelArray.length > 0 ? modelArray : ['qwen3.7-plus']);
      }
    } catch (e) {
      console.error('加载模型列表失败:', e);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    const handleStorage = () => fetchModels();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('llm_config_updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('llm_config_updated', handleStorage);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThread?.messages, loading]);

  // 将 AI 生成的图元自动追加或覆盖至画布
  const applyElementsToCanvas = async (
    rawElements: any[],
    mode: 'append' | 'replace' = 'append',
    msgId?: string
  ) => {
    if (!rawElements || rawElements.length === 0) return;

    try {
      const validElements = rawElements.map(normalizeExcalidrawElement);

      if (onInsertElements && mode === 'append') {
        onInsertElements(validElements);
      } else if (onReplaceElements && mode === 'replace') {
        onReplaceElements(validElements);
      }

      const api =
        excalidrawAPI ||
        excalidrawRef?.current?.excalidrawAPI ||
        excalidrawRef?.current ||
        (typeof window !== 'undefined' ? (window as any).__EXCALIDRAW_API__ : null);

      if (api) {
        let finalElements = validElements;
        if (mode === 'append' && typeof api.getSceneElements === 'function') {
          const currentElements = api.getSceneElements() || [];
          finalElements = [...currentElements, ...validElements];
        }

        if (typeof api.updateScene === 'function') {
          api.updateScene({
            elements: finalElements,
            appState: { viewBackgroundColor: '#ffffff' },
            commitToHistory: true,
          });
        }

        setTimeout(() => {
          if (typeof api.scrollToContent === 'function') {
            api.scrollToContent(validElements, {
              fitToContent: true,
              animate: true,
            });
          }
        }, 120);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('excalidraw:apply-scene', {
            detail: { mode, elements: validElements },
          })
        );
      }

      if (msgId) {
        setAppliedMessageIds((prev) => ({ ...prev, [msgId]: true }));
      }
    } catch (err) {
      console.error('上屏绘制失败:', err);
    }
  };

  const handleCreateNewThread = () => {
    setShowHistoryPanel(false);
    if (onNewThread) {
      onNewThread();
    } else {
      const newId = `thread_${Date.now()}`;
      const newThread: ChatThread = {
        id: newId,
        title: '新建对话',
        createdAt: new Date().toISOString(),
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            content: '你好！支持文字对话与智能画图，请选择模型开始。',
            timestamp: Date.now(),
          },
        ],
      };
      setInternalThreads((prev) => [newThread, ...prev]);
      setInternalCurrentId(newId);
    }
  };

  const handleSwitchThread = (id: string) => {
    if (onSelectThread) {
      onSelectThread(id);
    } else {
      setInternalCurrentId(id);
    }
    setShowHistoryPanel(false);
  };

  const handleDeleteCurrentOrTargetThread = (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation();
    if (onDeleteThread) {
      onDeleteThread(targetId);
    } else {
      setInternalThreads((prev) => {
        const filtered = prev.filter((t) => t.id !== targetId);
        if (filtered.length === 0) {
          const freshId = `thread_${Date.now()}`;
          return [
            {
              id: freshId,
              title: '主设计会话',
              createdAt: new Date().toISOString(),
              messages: [
                {
                  id: 'welcome',
                  role: 'assistant',
                  content: '你好！支持文字对话与智能画图，请选择模型开始。',
                  timestamp: Date.now(),
                },
              ],
            },
          ];
        }
        return filtered;
      });
      if (currentActiveId === targetId) {
        const remaining = threads.filter((t) => t.id !== targetId);
        if (remaining.length > 0) {
          setInternalCurrentId(remaining[0].id);
        }
      }
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!isConfigured) {
      setIsConfigModalOpen(true);
      return;
    }

    const trimmedInput = input.trim();
    const userMsg: MessageItem = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: Date.now(),
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const currentMsgs = currentThread?.messages || [];

    if (
      currentThread?.title === '新建对话' ||
      currentThread?.title === '主设计会话' ||
      currentThread?.title === '新会话'
    ) {
      const summaryTitle = trimmedInput.slice(0, 18);
      if (onUpdateThreadTitle) {
        onUpdateThreadTitle(currentActiveId, summaryTitle);
      } else {
        setInternalThreads((prev) =>
          prev.map((t) => (t.id === currentActiveId ? { ...t, title: summaryTitle } : t))
        );
      }
    }

    if (onUpdateMessages) {
      onUpdateMessages(currentActiveId, (prev) => [
        ...prev,
        userMsg,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
      ]);
    } else {
      setInternalThreads((prev) =>
        prev.map((t) =>
          t.id === currentActiveId
            ? {
                ...t,
                messages: [
                  ...t.messages,
                  userMsg,
                  { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
                ],
              }
            : t
        )
      );
    }

    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let localCfg: Partial<LLMConfig> = {};
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_LLM_KEY);
        if (stored) localCfg = JSON.parse(stored);
      } catch {}

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...currentMsgs, userMsg].map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
          llmConfig: localCfg,
        }),
      });

      if (!res.ok) {
        let errorMsg = `接口请求失败 (HTTP ${res.status})`;
        try {
          const rawText = await res.text();
          try {
            const errData = JSON.parse(rawText);
            if (errData.code === 'NO_LLM_CONFIG') {
              setIsConfigured(false);
              setIsConfigModalOpen(true);
            }
            errorMsg = errData.error || errData.message || errorMsg;
          } catch {
            const cleanText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            errorMsg = cleanText.slice(0, 200) || errorMsg;
          }
        } catch {}
        throw new Error(errorMsg);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          if (onUpdateMessages) {
            onUpdateMessages(currentActiveId, (prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m))
            );
          } else {
            setInternalThreads((prev) =>
              prev.map((t) =>
                t.id === currentActiveId
                  ? {
                      ...t,
                      messages: t.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, content: fullContent } : m
                      ),
                    }
                  : t
              )
            );
          }
        }
      } else {
        const json = await res.json();
        fullContent = json.reply || json.content || '';
        if (onUpdateMessages) {
          onUpdateMessages(currentActiveId, (prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m))
          );
        } else {
          setInternalThreads((prev) =>
            prev.map((t) =>
              t.id === currentActiveId
                ? {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: fullContent } : m
                    ),
                  }
                : t
            )
          );
        }
      }

      const detectedElements = extractElementsFromContent(fullContent);
      if (detectedElements && detectedElements.length > 0) {
        await applyElementsToCanvas(detectedElements, 'append', assistantMsgId);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errMsg = `出错了: ${err.message || '请检查模型配置与网络连通'}`;
        if (onUpdateMessages) {
          onUpdateMessages(currentActiveId, (prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: errMsg } : m))
          );
        } else {
          setInternalThreads((prev) =>
            prev.map((t) =>
              t.id === currentActiveId
                ? {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: errMsg } : m
                    ),
                  }
                : t
            )
          );
        }
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  if (isOpen === false) return null;

  return (
    <>
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="relative h-full bg-white border-l border-gray-200 shadow-xl flex flex-col shrink-0 select-text transition-[width] duration-75 ease-out"
      >
        {/* 左侧自由拖拽把手 */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-col-resize z-50 group flex items-center justify-center hover:bg-indigo-500/20 transition ${
            isResizing ? 'bg-indigo-500/40' : ''
          }`}
          title="按住左右拖拽调节侧边栏宽度"
        >
          <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-indigo-500 rounded transition" />
        </div>

        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600"/>
            <h2 className="font-bold text-gray-900 text-sm">AI 绘图助手</h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistoryPanel((prev) => !prev)}
              title="历史会话列表"
              className={`p-1.5 rounded-lg transition ${
                showHistoryPanel
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <History className="w-4 h-4"/>
            </button>
            <button
              onClick={handleCreateNewThread}
              title="新建会话 (+)"
              className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition"
            >
              <Plus className="w-4 h-4"/>
            </button>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              title="配置大模型"
              className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition"
            >
              <Settings className="w-4 h-4"/>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4"/>
              </button>
            )}
          </div>
        </div>

        {/* 会话切换指示条 */}
        <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs">
          <button
            onClick={() => setShowHistoryPanel((prev) => !prev)}
            className="flex items-center gap-1.5 text-gray-700 hover:text-indigo-600 max-w-[70%] font-semibold truncate"
            title="点击展开会话历史"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-600"/>
            <span className="truncate">{currentThread?.title || '主设计会话'}</span>
            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0"/>
          </button>
          <span className="text-[11px] text-gray-400">
            共 {threads.length} 个会话
          </span>
        </div>

        {/* 模型选择状态条 */}
        <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">当前模型:</span>
          {isConfigured && models.length > 0 ? (
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-gray-800 pr-6 outline-none focus:border-indigo-500 cursor-pointer"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="text-amber-600 hover:text-amber-700 flex items-center gap-1 font-semibold hover:underline"
            >
              <AlertTriangle className="w-3.5 h-3.5"/>
              去配置模型
            </button>
          )}
        </div>

        {/* 消息对话区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentThread?.messages.map((msg, index) => {
            const msgId = msg.id || index.toString();
            const isLastAssistant = msg.role === 'assistant' && index === currentThread.messages.length - 1;
            const isCurrentGenerating = loading && isLastAssistant;

            const isJsonStream =
              msg.role === 'assistant' &&
              (msg.content.includes('```json') ||
                msg.content.includes('"type":') ||
                msg.content.trim().startsWith('{') ||
                msg.content.trim().startsWith('['));

            const detectedElements = msg.role === 'assistant' ? extractElementsFromContent(msg.content) : null;
            const isApplied = appliedMessageIds[msgId];
            const isJsonExpanded = expandedJsonIds[msgId];

            const cleanText = msg.content
              .replace(/```(?:json)?[\s\S]*?(?:```|$)/gi, '')
              .replace(/\{[\s\S]*?\}/g, '')
              .trim();

            return (
              <div
                key={msgId}
                className={`flex gap-2.5 text-sm ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role !== 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800 border border-gray-200/80 shadow-2xs'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  ) : isCurrentGenerating && !detectedElements ? (
                    <div className="flex items-center gap-2 py-1 text-xs text-indigo-600 font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="animate-pulse">正在智能规划 UI 架构与图元组件...</span>
                    </div>
                  ) : (
                    <div>
                      {cleanText ? (
                        <div className="whitespace-pre-wrap break-words text-xs leading-relaxed mb-2">
                          {cleanText}
                        </div>
                      ) : !isJsonStream && msg.content ? (
                        <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                          {msg.content}
                        </div>
                      ) : null}

                      {detectedElements && detectedElements.length > 0 && (
                        <div className="mt-1 p-2.5 bg-white border border-indigo-100 rounded-xl shadow-xs">
                          <div className="flex items-center justify-between text-[11px] text-indigo-700 font-semibold mb-2">
                            <span className="flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-indigo-600" />
                              已构建 {detectedElements.length} 个标准图元
                            </span>
                            {isApplied && (
                              <span className="text-[10px] text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                                <Check className="w-3 h-3" /> 已上屏
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <button
                              onClick={() => applyElementsToCanvas(detectedElements, 'append', msgId)}
                              className="flex-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              追加到画布
                            </button>
                            <button
                              onClick={() => applyElementsToCanvas(detectedElements, 'replace', msgId)}
                              className="flex-1 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              覆盖画布
                            </button>
                          </div>

                          <button
                            onClick={() =>
                              setExpandedJsonIds((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
                            }
                            className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 font-medium"
                          >
                            <Code2 className="w-3 h-3" />
                            {isJsonExpanded ? '收起图元数据' : '查看图元 JSON 数据'}
                          </button>

                          {isJsonExpanded && (
                            <pre className="mt-2 p-2 bg-zinc-950 text-zinc-300 rounded-lg text-[10px] overflow-x-auto max-h-40 font-mono">
                              {JSON.stringify(detectedElements, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 历史会话抽屉面板 */}
        {showHistoryPanel && (
          <div className="absolute top-[88px] left-0 right-0 bottom-0 bg-white/95 backdrop-blur-xs z-30 flex flex-col border-t border-gray-200 animate-in fade-in duration-100">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                全部历史会话 ({threads.length})
              </span>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
              >
                返回
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {threads.map((t) => {
                const isActive = t.id === currentActiveId;
                const msgCount = t.messages?.length || 0;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSwitchThread(t.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                        : 'hover:bg-gray-100 text-gray-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 pr-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <div className="truncate flex-1">
                        <p className="truncate font-semibold">{t.title || '无标题会话'}</p>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {msgCount} 条对话
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteCurrentOrTargetThread(e, t.id)}
                      title="删除该会话"
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded hover:bg-white transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 底部输入框 */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (loading) {
                handleStopGeneration();
              } else {
                handleSend();
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                loading
                  ? 'AI 正在绘制图表中...'
                  : isConfigured
                  ? '输入想绘制的图表或 UI 原型...'
                  : '请先配置个人大模型'
              }
              className="flex-1 text-xs px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-gray-900 disabled:opacity-60 transition"
            />

            {loading ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                title="停止生成"
                className="p-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition flex items-center justify-center shrink-0 shadow-xs"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                title="发送"
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition shrink-0 shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>
      </div>

      <ModelConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaved={fetchModels}
      />
    </>
  );
};

export default AiSidebar;