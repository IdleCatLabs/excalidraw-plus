import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClientForRequest } from '@/lib/user-llm';

export const runtime = 'nodejs';

const CODE_SYSTEM_PROMPT = `You are an expert Frontend Developer and UI Engineer.
Your task is to convert Excalidraw UI elements/diagram data into clean, production-ready frontend code.

REQUIREMENTS:
1. Tech Stack:
   - For Vue 3: Use <script setup lang="ts"> with Tailwind CSS. Single-File Component.
   - For React: Use React Functional Component with TypeScript and Tailwind CSS.
2. Design Fidelity:
   - Replicate the layout, card containers, status bar, navigation tab bar, typography, and colors specified in the elements.
   - Use Lucide icons where appropriate.
3. OUTPUT ONLY the raw component code. Do NOT wrap in conversational text. Start directly with \`\`\`vue or \`\`\`tsx and end with \`\`\`.`;

export async function POST(req: NextRequest) {
  try {
    const { elements, framework = 'vue3', model, prompt } = await req.json();

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return NextResponse.json({ error: '未检测到选区图元，请先框选画板组件' }, { status: 400 });
    }

    let client, config;
    try {
      const authResult = await getOpenAIClientForRequest();
      client = authResult.client;
      config = authResult.config;
    } catch (authError: any) {
      if (authError.message === 'UNAUTHORIZED') {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
      }
      if (authError.message === 'NO_LLM_CONFIG') {
        return NextResponse.json({ error: '未配置大模型，请在侧边栏设置中添加 API Key' }, { status: 400 });
      }
      throw authError;
    }

    const targetModel = model || config.defaultModel || config.models[0];

    // 精简图元数据，仅保留生成 UI 必需的几何与文字属性，极大节省 Token
    const simplifiedElements = elements.map((el: any) => ({
      type: el.type,
      text: el.text || undefined,
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: Math.round(el.width),
      height: Math.round(el.height),
      backgroundColor: el.backgroundColor,
      strokeColor: el.strokeColor,
      strokeWidth: el.strokeWidth,
    }));

    const userMessageContent = `Convert the following Excalidraw UI components into a complete ${framework === 'vue3' ? 'Vue 3 Single File Component' : 'React Component'} with Tailwind CSS.
${prompt ? `Additional Requirements: ${prompt}\n` : ''}
UI Elements Data:
\`\`\`json
${JSON.stringify(simplifiedElements, null, 2)}
\`\`\``;

    const response = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: CODE_SYSTEM_PROMPT },
        { role: 'user', content: userMessageContent },
      ],
      temperature: 0.1,
    });

    const rawCode = response.choices[0]?.message?.content || '';
    const cleanCode = rawCode
      .replace(/^```(?:vue|tsx|jsx|typescript|html)?\n?/i, '')
      .replace(/```$/i, '')
      .trim();

    return NextResponse.json({ code: cleanCode });
  } catch (error: any) {
    console.error('Generate Code Error:', error);
    return NextResponse.json(
      { error: error.message || '代码生成失败，请检查模型连接' },
      { status: 500 }
    );
  }
}