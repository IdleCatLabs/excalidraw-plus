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
  XCircle 
} from "lucide-react";
import { ExcalidrawRef } from "./ExcalidrawWrapper";

interface ModelOption {
  label: string;
  value: string;
}

interface MessageItem {
  role: "user" | "assistant";
  content: string;
  isDraw?: boolean;
  reasoning?: string;
  duration?: string;
  tokens?: number;
}

export default function AiSidebar({ excalidrawRef }: { excalidrawRef: React.RefObject<ExcalidrawRef> }) {
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("deepseek-v4-flash");
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  
  const [width, setWidth] = useState<number>(380);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [openReasoningIdx, setOpenReasoningIdx] = useState<number | null>(null);

  const [messages, setMessages] = useState<MessageItem[]>([
    { role: "assistant", content: "你好！支持文字对话与智能画图，请选择模型开始。" }
  ]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "已中止本次生成。" },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt;
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText, model: selectedModel }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `请求失败: ${data.error}` }]);
        return;
      }

      let elements = data.elements || [];
      let summary = data.summary || "";

      // 容错匹配
      if ((!elements || elements.length === 0) && typeof data.reply === "string" && data.reply.includes('"elements"')) {
        try {
          const match = data.reply.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.elements)) {
              elements = parsed.elements;
              summary = parsed.summary || "";
            }
          }
        } catch (e) {}
      }

      if (elements && elements.length > 0) {
        const success = excalidrawRef.current?.addElements(elements);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: success 
              ? `【${selectedModel}】绘制完成：${summary || `已生成 ${elements.length} 个矢量图形`}`
              : `【${selectedModel}】解析出 ${elements.length} 个元素，但画布渲染未成功`,
            isDraw: true,
            reasoning: data.reasoning,
            duration: data.duration,
            tokens: data.usage?.total_tokens,
          },
        ]);
      } else {
        setMessages((prev) => [
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
      setMessages((prev) => [...prev, { role: "assistant", content: "网络请求异常，请检查服务状态。" }]);
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

      <div className="p-3 border-b bg-white flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium text-slate-800 text-sm">
            <Bot className="w-4 h-4 text-indigo-600" />
            <span>AI 画布助手</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1.5 rounded border border-slate-200">
          <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          {loadingModels ? (
            <span className="text-xs text-slate-400">拉取 OpenCode 官方模型...</span>
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
              <span>AI 正在思考并计算布局...</span>
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
          placeholder={loading ? "AI 正在回答中，可随时中止..." : "输入绘图指令或对话..."}
          className="flex-1 border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
        />
        
        {loading ? (
          <button
            type="button"
            onClick={handleAbort}
            title="中止生成"
            className="bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 transition-colors flex items-center justify-center gap-1 text-xs font-medium shrink-0"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>停止</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={loadingModels || !prompt.trim()}
            title="发送指令"
            className="bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    </div>
  );
}