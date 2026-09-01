'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Eye, Code, Smartphone, Tablet, Monitor, RotateCcw, Loader2 } from 'lucide-react';

interface CodeGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  excalidrawRef: any;
}

export const CodeGenerationModal: React.FC<CodeGenerationModalProps> = ({
  isOpen,
  onClose,
  excalidrawRef,
}) => {
  const [framework, setFramework] = useState<'vue3' | 'react'>('vue3');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [deviceSize, setDeviceSize] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const generateCode = async () => {
    if (!excalidrawRef?.current) {
      setError('画板尚未就绪');
      return;
    }

    let targetElements: any[] = [];
    if (typeof excalidrawRef.current.getSelectedElements === 'function') {
      targetElements = excalidrawRef.current.getSelectedElements();
    } else if (typeof excalidrawRef.current.getSceneElements === 'function') {
      targetElements = excalidrawRef.current.getSceneElements();
    }

    if (!targetElements || targetElements.length === 0) {
      setError('画板内暂无图元，请先框选组件或绘制图表');
      return;
    }

    setLoading(true);
    setError(null);
    setCode('');

    try {
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elements: targetElements,
          framework,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '代码生成请求失败');
      }

      setCode(data.code || '');
    } catch (err: any) {
      console.error('Code Generation Error:', err);
      setError(err.message || '生成失败，请检查大模型网络连通');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      generateCode();
    } else {
      setCode('');
      setError(null);
    }
  }, [isOpen, framework]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            {/* 视图切换 */}
            <div className="flex bg-zinc-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                  viewMode === 'preview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                实时预览
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                  viewMode === 'code'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                查看源码
              </button>
            </div>

            {/* 尺寸切换 */}
            {viewMode === 'preview' && (
              <div className="flex bg-zinc-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setDeviceSize('mobile')}
                  className={`p-1.5 rounded-md transition ${
                    deviceSize === 'mobile' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="移动端"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeviceSize('tablet')}
                  className={`p-1.5 rounded-md transition ${
                    deviceSize === 'tablet' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="平板端"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeviceSize('desktop')}
                  className={`p-1.5 rounded-md transition ${
                    deviceSize === 'desktop' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="桌面端"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={generateCode}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-md"
                  title="重新生成"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 框架选择 */}
            <div className="flex bg-zinc-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setFramework('vue3')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  framework === 'vue3' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Vue 3
              </button>
              <button
                onClick={() => setFramework('react')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  framework === 'react' ? 'bg-cyan-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                React
              </button>
            </div>

            <button
              onClick={handleCopy}
              disabled={!code}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已复制' : '复制代码'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden bg-zinc-950 flex items-center justify-center p-6 relative">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-zinc-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span>AI 正在将选区图元解析转换为 {framework === 'vue3' ? 'Vue 3' : 'React'} 组件代码...</span>
            </div>
          ) : error ? (
            <div className="max-w-md p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs text-center leading-relaxed">
              {error}
            </div>
          ) : viewMode === 'code' ? (
            <pre className="w-full h-full p-4 font-mono text-xs text-zinc-200 overflow-auto bg-zinc-900/60 rounded-xl border border-zinc-800/80">
              <code>{code}</code>
            </pre>
          ) : (
            /* 预览容器 */
            <div
              className={`h-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col transition-all duration-300 ${
                deviceSize === 'mobile'
                  ? 'w-[390px]'
                  : deviceSize === 'tablet'
                  ? 'w-[768px]'
                  : 'w-full'
              }`}
            >
              <div className="flex-1 overflow-auto p-4 flex flex-col justify-center items-center">
                <div className="w-full h-full bg-slate-50 dark:bg-zinc-900 rounded-xl p-4 overflow-y-auto border border-zinc-200 dark:border-zinc-800">
                  <div className="text-center text-xs text-zinc-400 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    代码已生成完毕，切换到「查看源码」可获取完整单文件组件
                  </div>
                  <pre className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {code.slice(0, 1200)}...
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};