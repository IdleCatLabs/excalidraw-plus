"use client";
import React, { useState, useMemo } from "react";
import { 
  X, 
  Copy, 
  Check, 
  Code2, 
  Eye, 
  Smartphone, 
  Tablet, 
  Monitor, 
  RotateCcw,
  Sparkles 
} from "lucide-react";

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  codeText: string;
  framework: "vue3" | "react";
  onFrameworkChange: (fw: "vue3" | "react") => void;
  loading: boolean;
}

export default function CodePreviewModal({
  isOpen,
  onClose,
  codeText,
  framework,
  onFrameworkChange,
  loading,
}: CodeModalProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // 清洗纯代码文本
  const cleanCode = useMemo(() => {
    return codeText.replace(/```(vue|tsx|jsx|html|typescript|javascript)?\n?|```/g, "").trim();
  }, [codeText]);

  // 构建沙箱 HTML（内置 Tailwind CSS CDN、Lucide 图标与响应式渲染引擎）
  const previewSrcDoc = useMemo(() => {
    if (!cleanCode) return "";

    // React 组件挂载脚本生成
    const isReact = framework === "react";
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Lucide 图标 CDN -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <!-- 字体与基础样式 -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }
    /* 自定义美化滚动条 */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  </style>
  ${
    isReact
      ? `
    <!-- React & Babel Standalone CDN -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  `
      : `
    <!-- Vue 3 CDN -->
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  `
  }
</head>
<body class="min-h-screen flex items-center justify-center p-2 sm:p-4">
  <div id="app-root" class="w-full flex justify-center items-center"></div>

  ${
    isReact
      ? `
    <script type="text/babel">
      const { useState, useEffect, useRef } = React;

      // 提取并执行 React 组件
      try {
        ${cleanCode
          .replace(/import\s+.*?from\s+['"].*?['"];?/g, "") // 移除静态 import
          .replace(/export\s+default\s+/g, "const GeneratedComponent = ")} // 兼容 export default

        const TargetComp = typeof GeneratedComponent !== 'undefined' ? GeneratedComponent : (typeof App !== 'undefined' ? App : null);

        if (TargetComp) {
          ReactDOM.createRoot(document.getElementById('app-root')).render(<TargetComp />);
        } else {
          document.getElementById('app-root').innerHTML = '<div class="text-slate-400 text-xs p-4">无法识别组件入口，请查看源码。</div>';
        }
      } catch (err) {
        document.getElementById('app-root').innerHTML = '<div class="text-rose-400 text-xs p-4 bg-rose-950/30 rounded border border-rose-800">渲染异常: ' + err.message + '</div>';
      }

      setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
      }, 100);
    </script>
  `
      : `
    <script>
      // Vue 3 SFC 模板提取与挂载
      try {
        const rawCode = ${JSON.stringify(cleanCode)};
        const templateMatch = rawCode.match(/<template>([\\s\\S]*?)<\\/template>/);
        const scriptMatch = rawCode.match(/<script.*?>([\\s\\S]*?)<\\/script>/);
        
        let templateContent = templateMatch ? templateMatch[1] : rawCode;
        
        const { createApp, ref, reactive, computed, onMounted } = Vue;
        
        const app = createApp({
          template: '<div class="w-full flex justify-center">' + templateContent + '</div>',
          setup() {
            onMounted(() => {
              if (window.lucide) window.lucide.createIcons();
            });
            return {};
          }
        });
        
        app.mount('#app-root');
      } catch (err) {
        document.getElementById('app-root').innerHTML = '<div class="text-rose-400 text-xs p-4 bg-rose-950/30 rounded border border-rose-800">渲染异常: ' + err.message + '</div>';
      }
    </script>
  `
  }
</body>
</html>
`;
  }, [cleanCode, framework]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 设备视口宽度计算
  const getDeviceWidthClass = () => {
    switch (device) {
      case "mobile":
        return "w-[390px] h-[780px] rounded-[38px] border-[10px] border-slate-800 shadow-2xl my-auto";
      case "tablet":
        return "w-[768px] h-[85vh] rounded-2xl border-4 border-slate-800 shadow-2xl my-auto";
      case "desktop":
      default:
        return "w-full h-full rounded-lg border border-slate-800";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* 顶部主工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950 shrink-0">
          
          {/* 左侧：模式切换 (预览 / 代码) */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "preview"
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>实时预览</span>
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "code"
                    ? "bg-indigo-600 text-white font-medium shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>查看源码</span>
              </button>
            </div>

            {/* 实时预览模式下的视口切换 */}
            {activeTab === "preview" && (
              <div className="hidden sm:flex items-center bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/40 text-xs text-slate-400">
                <button
                  onClick={() => setDevice("mobile")}
                  title="移动端 iPhone 视图 (390px)"
                  className={`p-1.5 rounded transition-colors ${device === "mobile" ? "bg-slate-700 text-indigo-400" : "hover:text-white"}`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDevice("tablet")}
                  title="平板 iPad 视图 (768px)"
                  className={`p-1.5 rounded transition-colors ${device === "tablet" ? "bg-slate-700 text-indigo-400" : "hover:text-white"}`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDevice("desktop")}
                  title="桌面完整视图 (100%)"
                  className={`p-1.5 rounded transition-colors ${device === "desktop" ? "bg-slate-700 text-indigo-400" : "hover:text-white"}`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-3 bg-slate-700 mx-1" />
                <button
                  onClick={() => setIframeKey((k) => k + 1)}
                  title="重新加载渲染"
                  className="p-1.5 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 右侧：技术栈切换 + 复制 + 关闭 */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
              <button
                onClick={() => onFrameworkChange("vue3")}
                className={`px-2.5 py-1 rounded transition-all ${
                  framework === "vue3"
                    ? "bg-emerald-600 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Vue 3
              </button>
              <button
                onClick={() => onFrameworkChange("react")}
                className={`px-2.5 py-1 rounded transition-all ${
                  framework === "react"
                    ? "bg-cyan-600 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                React
              </button>
            </div>

            <button
              onClick={handleCopy}
              disabled={loading || !codeText}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors ml-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "已复制" : "复制代码"}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 主内容展示区 */}
        <div className="flex-1 overflow-hidden relative bg-slate-950/80 flex items-center justify-center p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="relative flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <Sparkles className="w-4 h-4 text-indigo-400 absolute animate-pulse" />
              </div>
              <span className="text-xs">多模态 AI 正在解析草图并实时构建页面...</span>
            </div>
          ) : activeTab === "preview" ? (
            /* 👁 实时交互预览沙箱 */
            <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
              <div className={`transition-all duration-300 overflow-hidden bg-slate-900 ${getDeviceWidthClass()}`}>
                <iframe
                  key={iframeKey}
                  srcDoc={previewSrcDoc}
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                  className="w-full h-full border-none bg-transparent"
                />
              </div>
            </div>
          ) : (
            /* 💻 源码展示与高亮 */
            <div className="w-full h-full overflow-auto p-4 font-mono text-xs leading-relaxed select-text bg-slate-900 rounded-lg border border-slate-800">
              <pre className="text-emerald-400 selection:bg-indigo-600 selection:text-white whitespace-pre-wrap">
                {cleanCode || "// 暂无生成代码"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}