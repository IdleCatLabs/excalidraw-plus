'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Globe, Layers, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ModelConfigModal: React.FC<ModelConfigModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [baseUrl, setBaseUrl] = useState('https://khub.idlecatlabs.net/v1');
  const [apiKey, setApiKey] = useState('');
  const [modelsText, setModelsText] = useState('deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2');
  const [defaultModel, setDefaultModel] = useState('deepseek-v4-flash');
  const [maxTokens, setMaxTokens] = useState('4096');
  const [temperature, setTemperature] = useState('0.7');

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.configured && data.config) {
        setBaseUrl(data.config.baseUrl || '');
        setApiKey(data.config.apiKeyMasked || '');
        setModelsText(data.config.models ? data.config.models.join(', ') : '');
        setDefaultModel(data.config.defaultModel || '');
        setMaxTokens(String(data.config.maxTokens || 4096));
        setTemperature(String(data.config.temperature ?? 0.7));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const parseModels = (): string[] => {
    return modelsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleSave = async (isTesting = false) => {
    const parsedModels = parseModels();
    if (!baseUrl.trim()) {
      setMsg({ type: 'error', text: 'Base URL 不能为空' });
      return;
    }
    if (!apiKey.trim()) {
      setMsg({ type: 'error', text: 'API Key 不能为空' });
      return;
    }
    if (parsedModels.length === 0) {
      setMsg({ type: 'error', text: '请至少填写一个模型名称' });
      return;
    }

    if (isTesting) {
      setTesting(true);
    } else {
      setLoading(true);
    }
    setMsg(null);

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          models: parsedModels,
          defaultModel: defaultModel || parsedModels[0],
          maxTokens: Number(maxTokens) || 4096,
          temperature: Number(temperature) || 0.7,
          testConnection: isTesting,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }

      setMsg({
        type: 'success',
        text: isTesting ? '测试连通成功并已保存！' : '模型配置已成功保存！',
      });
      if (onSaved) onSaved();
      if (!isTesting) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '操作失败' });
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              用户大模型配置
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              配置您个人的 OpenAI 兼容接口（OpenAI Compatible）
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {msg && (
            <div
              className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              接口协议
            </label>
            <input
              type="text"
              disabled
              value="openai_compatible (OpenAI 兼容协议)"
              className="w-full text-xs px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-md border border-zinc-300 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              API Base URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://khub.idlecatlabs.net/v1 或 https://api.deepseek.com/v1"
                className="w-full text-sm pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              API Key <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Key className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full text-sm pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              可用模型列表 (用逗号或换行分隔) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <textarea
                value={modelsText}
                onChange={(e) => setModelsText(e.target.value)}
                placeholder="deepseek-chat, qwen-max, gpt-4o"
                rows={2}
                className="w-full text-sm pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                默认选用模型
              </label>
              <input
                type="text"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="如 deepseek-chat"
                className="w-full text-sm px-3 py-2 bg-white dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Max Tokens
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                placeholder="4096"
                className="w-full text-sm px-3 py-2 bg-white dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={testing || loading}
            className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            测试连通性
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={loading || testing}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};