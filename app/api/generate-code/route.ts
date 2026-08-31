import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClientForRequest } from '@/lib/user-llm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { elements, prompt, framework = 'react', model } = await req.json();

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
          { error: '请先配置个人大模型 API' },
          { status: 400 }
        );
      }
      throw authError;
    }

    const targetModel = model || config.defaultModel || config.models[0];

    const systemPrompt = `You are a frontend development assistant. Convert the given Excalidraw wireframe/elements structure into high quality ${framework} + Tailwind CSS code. Output ONLY the code without backticks or markdown if possible, or inside a single clean code block.`;

    const userContent = `Here are the diagram elements:\n${JSON.stringify(
      elements,
      null,
      2
    )}\n\nExtra instruction: ${prompt || 'Generate full responsive code.'}`;

    const completion = await client.chat.completions.create({
      model: targetModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: config.maxTokens || 4096,
    });

    const code = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ code });
  } catch (error: any) {
    console.error('Generate code error:', error);
    return NextResponse.json(
      { error: error.message || '生成代码失败，请检查模型配置' },
      { status: 500 }
    );
  }
}