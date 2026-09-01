'use client';

import React, { useState, useEffect } from 'react';
import {
  Eye,
  Code2,
  Smartphone,
  Tablet,
  Monitor,
  RotateCcw,
  Copy,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { LOCAL_STORAGE_LLM_KEY, LLMConfig } from './ModelConfigModal';

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElements: any[];
  llmConfig?: LLMConfig;
}

export default function CodePreviewModal({
  isOpen,
  onClose,
  selectedElements,
  llmConfig: propLlmConfig,
}: CodePreviewModalProps) {
  const [framework, setFramework] = useState<'vue' | 'react'>('vue');
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [deviceSize, setDeviceSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [loading, setLoading] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    } else {
      setCode('');
      setError('');
    }
  }, [isOpen, framework]);

  const handleGenerate = async () => {
    setError('');

    // 优先从 LocalStorage 或 Props 中提取有效 API Key
    let activeConfig: LLMConfig | null = propLlmConfig || null;
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_LLM_KEY);
      if (stored) {
        activeConfig = { ...activeConfig, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error(e);
    }

    if (!activeConfig || !activeConfig.apiKey) {
      setError('未配置大模型，请在侧边栏设置中添加 API Key');
      return;
    }

    if (!selectedElements || selectedElements.length === 0) {
      setError('请先在画板上框选需要生成代码的元素');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elements: selectedElements,
          framework,
          llmConfig: {
            baseUrl: activeConfig.baseUrl,
            apiKey: activeConfig.apiKey,
            model: activeConfig.defaultModel || 'qwen3.7-plus',
            maxTokens: activeConfig.maxTokens || 4096,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || '代码生成失败，请检查大模型接口配置');
      }

      setCode(data.code || '');
    } catch (err: any) {
      setError(err.message || '网络请求异常');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const generatePreviewDoc = () => {
    if (!code) return '';
    if (framework === 'vue') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
        </head>
        <body class="bg-gray-50 min-h-screen p-4 flex items-center justify-center">
          <div id="app" class="w-full"></div>
          <script>
            const { createApp } = Vue;
            const rawCode = ${JSON.stringify(code)};
            const templateMatch = rawCode.match(/<template>([\\s\\S]*?)<\\/template>/);
            const template = templateMatch ? templateMatch[1] : '<div class="p-4">' + rawCode + '</div>';
            createApp({ template }).mount('#app');
          </script>
        </body>
        </html>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 min-h-screen p-4 flex items-center justify-center">
        <div class="w-full max-w-xl mx-auto p-6 bg-white rounded-xl shadow">
          <pre class="text-xs overflow-auto text-gray-700 font-mono">${code.replace(/</g, '&lt;')}</pre>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full h-[90vh] max-w-6xl flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-zinc-800 rounded-xl p-1 border border-zinc-700/50">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                实时预览
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'code'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                查看源码
              </button>
            </div>

            {activeTab === 'preview' && (
              <div className="flex items-center gap-1 bg-zinc-800/80 rounded-xl p-1 border border-zinc-700/50 text-zinc-400">
                <button
                  type="button"
                  onClick={() => setDeviceSize('mobile')}
                  className={`p-1.5 rounded-lg hover:text-white transition ${
                    deviceSize === 'mobile' ? 'bg-zinc-700 text-white' : ''
                  }`}
                  title="手机尺寸"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceSize('tablet')}
                  className={`p-1.5 rounded-lg hover:text-white transition ${
                    deviceSize === 'tablet' ? 'bg-zinc-700 text-white' : ''
                  }`}
                  title="平板尺寸"
                >
                  <Tablet className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceSize('desktop')}
                  className={`p-1.5 rounded-lg hover:text-white transition ${
                    deviceSize === 'desktop' ? 'bg-zinc-700 text-white' : ''
                  }`}
                  title="桌面尺寸"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="p-1.5 rounded-lg hover:text-white transition ml-1"
                  title="重新生成"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-zinc-800 rounded-xl p-1 border border-zinc-700/50">
              <button
                type="button"
                onClick={() => setFramework('vue')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  framework === 'vue'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Vue 3
              </button>
              <button
                type="button"
                onClick={() => setFramework('react')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  framework === 'react'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                React
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!code || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-medium border border-zinc-700 transition disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  复制代码
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-950 p-6 overflow-hidden flex items-center justify-center relative">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">正在调用大模型生成代码中，请稍候...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm max-w-md text-center">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && activeTab === 'preview' && (
            <div
              className={`h-full bg-white rounded-xl shadow-2xl transition-all duration-300 overflow-hidden ${
                deviceSize === 'mobile'
                  ? 'w-[375px]'
                  : deviceSize === 'tablet'
                  ? 'w-[768px]'
                  : 'w-full'
              }`}
            >
              <iframe
                title="Code Preview"
                srcDoc={generatePreviewDoc()}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}

          {!loading && !error && activeTab === 'code' && (
            <div className="w-full h-full rounded-xl bg-zinc-900 border border-zinc-800 p-4 overflow-auto font-mono text-sm text-zinc-200">
              <pre className="whitespace-pre-wrap">{code}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}