'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, Key, Layers, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface LLMConfig {
  protocol: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  defaultModel: string;
  maxTokens: number;
}

export interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (config: LLMConfig) => void;
}

export const LOCAL_STORAGE_LLM_KEY = 'excalidraw_plus_llm_config';

const DEFAULT_CONFIG: LLMConfig = {
  protocol: 'openai_compatible (OpenAI 兼容协议)',
  baseUrl: 'https://khub.idlecatlabs.net/v1',
  apiKey: '',
  models: 'deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2',
  defaultModel: 'qwen3.7-plus',
  maxTokens: 4096,
};

export function ModelConfigModal({
  isOpen,
  onClose,
  onSaved,
}: ModelConfigModalProps) {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSavedKey, setHasSavedKey] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    if (!isOpen) return;

    setTestStatus({ type: null, message: '' });

    // 1. 读取本地存储
    let localSaved: Partial<LLMConfig> = {};
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_LLM_KEY);
      if (stored) {
        localSaved = JSON.parse(stored);
      }
    } catch (e) {}

    // 2. 从服务端获取已同步配置
    fetch('/api/models')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const remoteConfig = data?.config || {};
        const serverHasKey = Boolean(data?.hasKey);
        setHasSavedKey(serverHasKey || Boolean(localSaved.apiKey));

        setConfig({
          protocol: DEFAULT_CONFIG.protocol,
          baseUrl: localSaved.baseUrl || remoteConfig.baseUrl || DEFAULT_CONFIG.baseUrl,
          apiKey: localSaved.apiKey || remoteConfig.apiKey || '',
          models: localSaved.models || remoteConfig.models || DEFAULT_CONFIG.models,
          defaultModel:
            localSaved.defaultModel || remoteConfig.defaultModel || DEFAULT_CONFIG.defaultModel,
          maxTokens:
            localSaved.maxTokens || remoteConfig.maxTokens || DEFAULT_CONFIG.maxTokens,
        });
      })
      .catch(() => {
        if (localSaved.apiKey) setHasSavedKey(true);
        setConfig((prev) => ({ ...prev, ...localSaved }));
      });
  }, [isOpen]);

  if (!isOpen) return null;

  // 测试连通性
  const handleTestConnection = async () => {
    const rawKey = config.apiKey.trim();

    if (!config.baseUrl.trim()) {
      setTestStatus({ type: 'error', message: 'API Base URL 不能为空' });
      return;
    }

    if (!rawKey && !hasSavedKey) {
      setTestStatus({ type: 'error', message: 'API Key 不能为空，请输入有效的 API Key' });
      return;
    }

    setLoading(true);
    setTestStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          config: {
            ...config,
            baseUrl: config.baseUrl.trim(),
            apiKey: rawKey,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setHasSavedKey(true);
        // 若输入的是真实 Key，同步保存至 localStorage
        if (rawKey && !rawKey.startsWith('•••')) {
          localStorage.setItem(LOCAL_STORAGE_LLM_KEY, JSON.stringify(config));
        }

        setTestStatus({
          type: 'success',
          message: '测试连通成功并已保存！',
        });
        window.dispatchEvent(new Event('llm_config_updated'));
      } else {
        setTestStatus({
          type: 'error',
          message: data.error || '连通性测试未通过，请检查 Base URL 与 API Key',
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: err.message || '网络连接异常，无法完成连通性测试',
      });
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    const rawKey = config.apiKey.trim();

    if (!config.baseUrl.trim()) {
      setTestStatus({ type: 'error', message: 'API Base URL 不能为空' });
      return;
    }

    if (!rawKey && !hasSavedKey) {
      setTestStatus({ type: 'error', message: 'API Key 不能为空，请输入有效的 API Key' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          config: {
            ...config,
            baseUrl: config.baseUrl.trim(),
            apiKey: rawKey,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (rawKey && !rawKey.startsWith('•••')) {
          localStorage.setItem(LOCAL_STORAGE_LLM_KEY, JSON.stringify(config));
        }

        window.dispatchEvent(new Event('llm_config_updated'));
        if (onSaved) {
          onSaved(config);
        }
        onClose();
      } else {
        setTestStatus({
          type: 'error',
          message: data.error || '保存配置失败',
        });
      }
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: '保存失败: ' + (err.message || '网络异常'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">用户大模型配置</h3>
            <p className="text-sm text-gray-500 mt-1">
              配置您个人的 OpenAI 兼容接口（OpenAI Compatible）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {testStatus.type && (
          <div className="px-6 mb-2">
            <div
              className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                testStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {testStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{testStatus.message}</span>
            </div>
          </div>
        )}

        <div className="px-6 py-2 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              接口协议
            </label>
            <input
              type="text"
              disabled
              value={config.protocol}
              className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Base URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Globe className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) =>
                  setConfig({ ...config, baseUrl: e.target.value })
                }
                placeholder="https://khub.idlecatlabs.net/v1"
                className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                API Key <span className="text-red-500">*</span>
              </label>
              {hasSavedKey && (
                <span className="text-[11px] text-emerald-600 font-medium">
                  已配置有效 Key（输入可直接覆盖）
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) =>
                  setConfig({ ...config, apiKey: e.target.value })
                }
                placeholder={hasSavedKey ? '•••••••••••••••• (已保存，无需重复输入)' : 'sk-...'}
                className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              可用模型列表（用逗号或换行分隔） <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3.5 pointer-events-none text-gray-400">
                <Layers className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={config.models}
                onChange={(e) => setConfig({ ...config, models: e.target.value })}
                placeholder="deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2"
                className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                默认选用模型
              </label>
              <input
                type="text"
                value={config.defaultModel}
                onChange={(e) =>
                  setConfig({ ...config, defaultModel: e.target.value.trim() })
                }
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.maxTokens}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxTokens: parseInt(e.target.value, 10) || 4096,
                  })
                }
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 active:bg-gray-100 transition disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? '测试中...' : '测试连通性'}</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition disabled:opacity-50"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelConfigModal;