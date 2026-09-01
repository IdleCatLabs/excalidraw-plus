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
import { ModelConfigModal } from './ModelConfigModal';

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
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<any>(null);

  useEffect(() => {
    const savedWidth = localStorage.getItem('excalidraw_plus_ai_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 320 && parsed <= 900) {
        setSidebarWidth(parsed);
      }
    }
  }, []);

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

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.configured && data.models && data.models.length > 0) {
        setIsConfigured(true);
        setModels(data.models);
        setSelectedModel(data.defaultModel || data.models[0]);
      } else {
        setIsConfigured(false);
        setModels([]);
      }
    } catch (e) {
      console.error('加载模型列表失败:', e);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThread?.messages, loading]);

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
            appState: { viewBackgroundColor: '#f5f5f7' },
            commitToHistory: true,
          });
        }

        setTimeout(() => {
          if (typeof api.scrollToContent === 'function') {
            api.scrollToContent(validElements, {
              fitToViewport: true,
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...currentMsgs, userMsg].map((m) => ({ role: m.role, content: m.content })),
          model: selectedModel,
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
        className="relative h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col shrink-0 select-text transition-[width] duration-75 ease-out"
      >
        <div
          onMouseDown={handleMouseDown}
          className={`absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-col-resize z-50 group flex items-center justify-center hover:bg-indigo-500/20 transition ${
            isResizing ? 'bg-indigo-500/40' : ''
          }`}
          title="按住左右拖拽调节侧边栏宽度"
        >
          <div className="w-0.5 h-8 bg-zinc-300 dark:bg-zinc-700 group-hover:bg-indigo-500 rounded transition" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500"/>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">AI 绘图助手</h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistoryPanel((prev) => !prev)}
              title="历史会话列表"
              className={`p-1.5 rounded-md transition ${
                showHistoryPanel
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <History className="w-4 h-4"/>
            </button>
            <button
              onClick={handleCreateNewThread}
              title="新建会话 (+)"
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Plus className="w-4 h-4"/>
            </button>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              title="配置大模型"
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <Settings className="w-4 h-4"/>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md"
              >
                <X className="w-4 h-4"/>
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-1.5 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <button
            onClick={() => setShowHistoryPanel((prev) => !prev)}
            className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 max-w-[70%] font-medium truncate"
            title="点击展开会话历史"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-500"/>
            <span className="truncate">{currentThread?.title || '主设计会话'}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0"/>
          </button>
          <span className="text-[11px] text-zinc-400">
            共 {threads.length} 个会话
          </span>
        </div>

        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-500">当前模型:</span>
          {isConfigured && models.length > 0 ? (
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent font-medium text-zinc-800 dark:text-zinc-200 pr-5 appearance-none focus:outline-none cursor-pointer"
              >
                {models.map((m) => (
                  <option key={m} value={m} className="dark:bg-zinc-900">
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-0 top-0.5 text-zinc-400 pointer-events-none"/>
            </div>
          ) : (
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium hover:underline"
            >
              <AlertTriangle className="w-3 h-3"/>
              去配置模型
            </button>
          )}
        </div>

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
                className={`flex gap-3 text-sm ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role !== 'user' && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
                <div
                  className={`max-w-[90%] rounded-xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  ) : isCurrentGenerating && !detectedElements ? (
                    <div className="flex items-center gap-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
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
                        <div className="mt-1 p-2.5 bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/60 rounded-lg shadow-sm">
                          <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 font-medium mb-2">
                            <span className="flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-indigo-500" />
                              已构建 {detectedElements.length} 个标准图元
                            </span>
                            {isApplied && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-medium">
                                <Check className="w-3 h-3" /> 已自动上屏
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <button
                              onClick={() => applyElementsToCanvas(detectedElements, 'append', msgId)}
                              className="flex-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center justify-center gap-1 transition shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              追加到画布
                            </button>
                            <button
                              onClick={() => applyElementsToCanvas(detectedElements, 'replace', msgId)}
                              className="flex-1 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-xs font-medium flex items-center justify-center gap-1 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              覆盖画布
                            </button>
                          </div>

                          <button
                            onClick={() =>
                              setExpandedJsonIds((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
                            }
                            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                          >
                            <Code2 className="w-3 h-3" />
                            {isJsonExpanded ? '收起图元数据' : '查看图元 JSON 数据'}
                          </button>

                          {isJsonExpanded && (
                            <pre className="mt-2 p-2 bg-zinc-950 text-zinc-300 rounded text-[10px] overflow-x-auto max-h-40">
                              {JSON.stringify(detectedElements, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {showHistoryPanel && (
          <div className="absolute top-[88px] left-0 right-0 bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm z-30 flex flex-col border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                全部历史会话 ({threads.length})
              </span>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
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
                    className={`group flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-medium'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 pr-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`} />
                      <div className="truncate flex-1">
                        <p className="truncate font-medium">{t.title || '无标题会话'}</p>
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {msgCount} 条对话
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteCurrentOrTargetThread(e, t.id)}
                      title="删除该会话"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 rounded hover:bg-white dark:hover:bg-zinc-700 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
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
              className="flex-1 text-xs px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 disabled:opacity-60"
            />

            {loading ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                title="停止生成"
                className="p-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition flex items-center justify-center shrink-0 shadow-sm"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                title="发送"
                className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shrink-0 shadow-sm"
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