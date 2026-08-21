"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Send, 
  Bot, 
  Loader2, 
  Cpu, 
  GripVertical, 
  ChevronDown, 
  ChevronRight, 
  Zap, 
  Clock, 
  Square,
  XCircle,
  MessageSquarePlus,
  History,
  Trash2
} from "lucide-react";
import { ExcalidrawRef } from "./ExcalidrawWrapper";

export interface MessageItem {
  role: "user" | "assistant";
  content: string;
  isDraw?: boolean;
  reasoning?: string;
  duration?: string;
  tokens?: number;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  messages: MessageItem[];
}

interface ModelOption {
  label: string;
  value: string;
}

interface AiSidebarProps {
  excalidrawRef: React.RefObject<ExcalidrawRef>;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => void;
  onUpdateMessages: (threadId: string, updater: (prev: MessageItem[]) => MessageItem[]) => void;
  boardName: string;
}

export default function AiSidebar({
  excalidrawRef,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onUpdateMessages,
  boardName,
}: AiSidebarProps) {
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("deepseek-v4-flash");
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  
  const [width, setWidth] = useState<number>(380);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [openReasoningIdx, setOpenReasoningIdx] = useState<number | null>(null);
  const [isThreadDropdownOpen, setIsThreadDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentThread = threads.find((t) => t.id === activeThreadId) || threads[0] || {
    id: "default",
    title: "默认会话",
    createdAt: new Date().toISOString(),
    messages: [],
  };

  const messages = currentThread.messages;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, openReasoningIdx, scrollToBottom]);

  useEffect(() => {
    const savedWidth = localStorage.getItem("ai_sidebar_width");
    if (savedWidth) setWidth(Number(savedWidth));

    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          const preferred = data.models.find((m: any) => m.value === "deepseek-v4-flash")?.value || data.models[0].value;
          setSelectedModel(preferred);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingModels(false));
  }, []);

  // 拖拽宽度调节
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const maxAllowed = Math.min(window.innerWidth * 0.65, 800);
      const newWidth = Math.max(300, Math.min(window.innerWidth - e.clientX, maxAllowed));
      setWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setWidth((w) => {
        localStorage.setItem("ai_sidebar_width", String(w));
        return w;
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    onUpdateMessages(currentThread.id, (prev) => [
      ...prev,
      { role: "assistant", content: "已中止本次生成。" },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt;
    setPrompt("");

    onUpdateMessages(currentThread.id, (prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. 提取当前画布上所有已有图元的精简快照
    const currentElements = excalidrawRef.current?.getCompactElements() || [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: userText, 
          model: selectedModel,
          currentElements, // 注入给大模型作为画布上下文
        }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (data.error) {
        onUpdateMessages(currentThread.id, (prev) => [...prev, { role: "assistant", content: `请求失败: ${data.error}` }]);
        return;
      }

      let elements = data.elements || [];
      let summary = data.summary || "";
      let mode = data.mode || "replace";

      if ((!elements || elements.length === 0) && typeof data.reply === "string" && data.reply.includes('"elements"')) {
        try {
          const match = data.reply.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.elements)) {
              elements = parsed.elements;
              summary = parsed.summary || "";
              mode = parsed.mode || "replace";
            }
          }
        } catch (e) {}
      }

      if (elements && elements.length > 0) {
        // 2. 根据 AI 判断的 replace 或 append 模式进行画布渲染
        const success = excalidrawRef.current?.addElements(elements, mode);
        onUpdateMessages(currentThread.id, (prev) => [
          ...prev,
          {
            role: "assistant",
            content: success 
              ? `【${selectedModel}】${summary || `已更新 ${elements.length} 个矢量图形`}`
              : `【${selectedModel}】解析出 ${elements.length} 个元素，但画布渲染未成功`,
            isDraw: true,
            reasoning: data.reasoning,
            duration: data.duration,
            tokens: data.usage?.total_tokens,
          },
        ]);
      } else {
        onUpdateMessages(currentThread.id, (prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || "收到。",
            isDraw: false,
            reasoning: data.reasoning,
            duration: data.duration,
            tokens: data.usage?.total_tokens,
          },
        ]);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      onUpdateMessages(currentThread.id, (prev) => [...prev, { role: "assistant", content: "网络请求异常，请检查服务状态。" }]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div style={{ width: `${width}px` }} className="relative h-full border-l bg-slate-50 flex flex-col z-10 shadow-lg shrink-0">
      <div
        onMouseDown={startResizing}
        title="按住拖动调整宽度"
        className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group flex items-center justify-center hover:bg-indigo-500/10 ${
          isDragging ? "bg-indigo-500/20" : ""
        }`}
      >
        <div className="w-1 h-8 bg-slate-300 group-hover:bg-indigo-500 rounded-full flex items-center justify-center">
          <GripVertical className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
        </div>
      </div>

      <div className="p-3 border-b bg-white flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setIsThreadDropdownOpen(!isThreadDropdownOpen)}
              className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs text-slate-700 font-medium transition-colors"
            >
              <div className="flex items-center gap-1.5 truncate">
                <History className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">{currentThread.title || "当前会话"}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isThreadDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isThreadDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsThreadDropdownOpen(false)} 
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30 max-h-56 overflow-y-auto">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    本草图下的历史会话 ({threads.length})
                  </div>
                  {threads.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        onSelectThread(t.id);
                        setIsThreadDropdownOpen(false);
                      }}
                      className={`group flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                        t.id === currentThread.id ? "bg-indigo-50 text-indigo-600 font-medium" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate flex-1">{t.title}</span>
                      {threads.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteThread(t.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              onNewThread();
              setIsThreadDropdownOpen(false);
            }}
            title="开启新会话（隔离并重置 Token）"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-medium rounded-lg transition-colors shrink-0 shadow-xs"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>新会话</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
          <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          {loadingModels ? (
            <span className="text-xs text-slate-400">加载官方模型...</span>
          ) : (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-xs text-slate-700 outline-none w-full cursor-pointer truncate"
            >
              {models.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, idx) => (
          <div key={idx} className="space-y-1">
            {m.reasoning && (
              <div className="border border-indigo-100 bg-indigo-50/50 rounded-lg p-2 text-xs mr-5">
                <button
                  onClick={() => setOpenReasoningIdx(openReasoningIdx === idx ? null : idx)}
                  className="flex items-center gap-1 font-medium text-indigo-700 hover:text-indigo-900 w-full text-left"
                >
                  {openReasoningIdx === idx ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>思考过程</span>
                </button>
                {openReasoningIdx === idx && (
                  <div className="mt-1.5 pt-1.5 border-t border-indigo-100/70 text-slate-600 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {m.reasoning}
                  </div>
                )}
              </div>
            )}

            <div
              className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600 text-white ml-5"
                  : "bg-white border border-slate-200 text-slate-800 mr-5 shadow-sm"
              }`}
            >
              {m.content}
            </div>

            {(m.duration || m.tokens) && (
              <div className="flex items-center gap-3 text-[10px] text-slate-400 px-1">
                {m.duration && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> {m.duration}
                  </span>
                )}
                {m.tokens !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 text-amber-500" /> {m.tokens} Tokens
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm mr-5">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>AI 正在分析现有图元并计算布局...</span>
            </div>
            <button
              onClick={handleAbort}
              className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors font-medium"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>中止</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-2.5 border-t bg-white flex gap-2 items-center">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={loading ? "AI 正在生成中..." : `在「${currentThread.title}」中发送指令...`}
          className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
        />
        
        {loading ? (
          <button
            type="button"
            onClick={handleAbort}
            title="中止生成"
            className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1 text-xs font-medium shrink-0"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>停止</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={loadingModels || !prompt.trim()}
            title="发送指令"
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    </div>
  );
}