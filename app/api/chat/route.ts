import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClientForRequest } from '@/lib/user-llm';

export const runtime = 'nodejs';

// Excalidraw 绘图系统 Prompt：约束大模型生成标准 UI 图元与自然语言解释
const SYSTEM_PROMPT = `You are an expert UI/UX designer and whiteboard visual architect.
When the user asks you to design or draw a UI interface, whiteboard diagram, flowchart, or wireframe:
1. First, provide a concise explanation in Markdown text.
2. Then, output a single \`\`\`json\`\`\` code block containing the complete array of Excalidraw elements or an object with an "elements" array.

Excalidraw Element Schema:
- rectangle: { "type": "rectangle", "x": number, "y": number, "width": number, "height": number, "strokeColor": string, "backgroundColor": string, "fillStyle": "solid", "strokeWidth": number, "roundness": { "type": 3 } }
- text: { "type": "text", "x": number, "y": number, "text": string, "fontSize": number, "strokeColor": string }
- ellipse: { "type": "ellipse", "x": number, "y": number, "width": number, "height": number, "strokeColor": string, "backgroundColor": string }
- line / arrow: { "type": "arrow" | "line", "x": number, "y": number, "width": number, "height": number, "points": [[0, 0], [dx, dy]], "strokeColor": string }

Design Rules:
- For mobile app wireframes (e.g., iPhone), create an outer container (e.g., width 360, height 720), status bar, navigation bar, cards, buttons, and clear text labels.
- Use pleasing colors (e.g. "#4f46e5", "#10b981", "#f3f4f6", "#ffffff", "#1f2937").
- Calculate relative coordinates properly so elements do not overlap improperly.
- Output clean JSON without comments inside the code block.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages = [], model, llmConfig } = body;

    // 1. 获取已绑定的 OpenAI Client 实例与鉴权 Key
    let clientWrapper: any;
    try {
      clientWrapper = await getOpenAIClientForRequest(req, {
        ...(llmConfig || {}),
        defaultModel: model || llmConfig?.defaultModel,
      });
    } catch (authError: any) {
      if (authError.message === 'MISSING_API_KEY') {
        return NextResponse.json(
          {
            error: '未配置有效的大模型 API Key，请点击右上角设置配置您的个人 API Key。',
            code: 'NO_LLM_CONFIG',
          },
          { status: 401 }
        );
      }
      throw authError;
    }

    const { openai, apiKey, baseUrl, model: resolvedModel } = clientWrapper;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'API Key 不能为空，请在侧边栏设置中添加 API Key。',
          code: 'NO_LLM_CONFIG',
        },
        { status: 401 }
      );
    }

    // 2. 构造对话消息队列
    const formattedMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || '',
      })),
    ];

    // 3. 请求大模型流式生成
    const responseStream = await openai.chat.completions.create({
      model: resolvedModel || 'qwen3.7-plus',
      messages: formattedMessages as any,
      temperature: 0.3,
      stream: true,
    });

    // 4. 以 ReadableStream 实时向前端输出流数据
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (streamErr: any) {
          console.error('流输出异常:', streamErr);
          controller.error(streamErr);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);

    // 捕获下游大模型 401 报错并返回清晰描述
    const status = error.status || (error.message?.includes('401') ? 401 : 500);
    const errorMessage =
      error.message || '大模型请求异常，请检查 Base URL 与 API Key 是否有效。';

    return NextResponse.json(
      { error: errorMessage, code: status === 401 ? 'NO_LLM_CONFIG' : 'API_ERROR' },
      { status }
    );
  }
}