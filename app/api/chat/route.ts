import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClientForRequest } from '@/lib/user-llm';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are a professional UI/UX designer and Excalidraw diagram architect.

CRITICAL DESIGN & CONTRAST RULES:
1. ALWAYS start with the OUTER PHONE FRAME (Chassis):
   - Element[0] MUST BE: { "type": "rectangle", "x": 100, "y": 80, "width": 390, "height": 844, "strokeColor": "#09090b", "strokeWidth": 3, "backgroundColor": "#ffffff", "roughness": 0, "roundness": { "type": 3 } }
2. ALWAYS include the TOP STATUS BAR:
   - Dynamic island / notch: { "type": "rectangle", "x": 235, "y": 95, "width": 120, "height": 30, "backgroundColor": "#09090b", "strokeColor": "#09090b", "roundness": { "type": 3 } }
   - Time text: { "type": "text", "x": 130, "y": 100, "text": "9:41", "fontSize": 14, "strokeColor": "#09090b" }
3. ALWAYS include the MANDATORY BOTTOM NAVIGATION TAB BAR (底部导航栏):
   - Tab bar container: { "type": "rectangle", "x": 100, "y": 840, "width": 390, "height": 84, "backgroundColor": "#ffffff", "strokeColor": "#e2e8f0", "strokeWidth": 1.5, "roundness": { "type": 3 } }
   - Divider top line: { "type": "line", "x": 100, "y": 840, "width": 390, "height": 0, "points": [[0,0], [390,0]], "strokeColor": "#cbd5e1", "strokeWidth": 1 }
   - Tab items (e.g. 世界时钟, 闹钟, 秒表, 计时器): generate horizontal text labels across the tab bar with one active tab highlighted in blue/orange.
4. Component Contrast:
   - Cards / Rows: "backgroundColor": "#f8fafc" or "#ffffff", "strokeColor": "#cbd5e1", "strokeWidth": 1.5, "roundness": { "type": 3 }.
   - Main text: "#0f172a", Subtext: "#64748b", Active toggles: "#22c55e" or "#f97316".
   - Roughness MUST BE 0 for clean modern UI.

OUTPUT FORMAT:
1. The output MUST START with \`\`\`json on the VERY FIRST LINE.
2. Inside, output a JSON array of elements with accurate coordinates fitting inside the 390x844 frame.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, model, temperature, maxTokens } = await req.json();

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
        return NextResponse.json(
          {
            error: '未配置大模型',
            code: 'NO_LLM_CONFIG',
            message: '您尚未配置个人大模型 API，请点击设置进行配置。',
          },
          { status: 400 }
        );
      }
      throw authError;
    }

    const targetModel = model || config.defaultModel || config.models[0];
    const targetMaxTokens = maxTokens || config.maxTokens || 8192;
    const targetTemperature = temperature ?? 0.2;

    const stream = await client.chat.completions.create({
      model: targetModel,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: targetTemperature,
      max_tokens: targetMaxTokens,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (streamError) {
          controller.error(streamError);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || '模型生成失败，请检查网络或配置' },
      { status: 500 }
    );
  }
}