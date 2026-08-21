import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { imageBase64, framework = "vue3", model = "deepseek-v4-pro" } = await req.json();
    const apiKey = (process.env.AI_API_KEY || "").trim();
    let baseUrl = (process.env.AI_BASE_URL || "https://opencode.ai/zen/go/v1").trim().replace(/\/+$/, "");

    if (!imageBase64) {
      return NextResponse.json({ error: "请先在画布上绘制草图" }, { status: 400 });
    }

    const endpoint = baseUrl.endsWith("/v1") 
      ? `${baseUrl}/chat/completions` 
      : `${baseUrl}/v1/chat/completions`;

    const systemPrompt = `你是一个顶级 UI 工程师与前端架构师。
你的任务是将用户提供的 Excalidraw 原型草图 1:1 高度还原为精美、现代化且可直接运行的组件代码。

【技术规范】：
1. 样式规范：全部使用 Tailwind CSS 类名，配色要具有现代感（推荐 slate/indigo/emerald/rose 配色，包含 hover/active/rounded-2xl/shadow/backdrop-blur 等精致细节）。
2. 图标规范：使用标准 Lucide 图标或 FontAwesome（如 <i data-lucide="bell"></i> 或 <i className="fa-solid fa-gear"></i>）。
3. 框架选择：
   - 若选择 React：输出标准的 React 18 函数组件 (如 function App() { ... })，包含 useState 交互状态（如开关切换、输入框双向绑定、Tab 激活高亮），并在文件末尾写 export default App;
   - 若选择 Vue 3：输出标准的单文件组件，包含 <template> 与 <script setup lang="ts">。
4. 输出要求：只输出代码块，用 \`\`\`${framework === "vue3" ? "vue" : "tsx"} 包裹，不要包含多余开场白。`;

    console.log(`[/api/generate-code] 正在生成 ${framework} 生产代码...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "Cline/3.0.0",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "请将这张草图还原为可直接交互的高颜值前端代码：" },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `上游模型报错: ${errText}` }, { status: 500 });
    }

    const resData = await response.json();
    const rawContent = resData.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      codeText: rawContent,
      framework,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}