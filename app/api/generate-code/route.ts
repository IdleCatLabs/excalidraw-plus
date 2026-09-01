import { NextRequest, NextResponse } from 'next/server';
import { getUserLLMConfig, isMaskedKey } from '@/lib/user-llm';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const userId = user?.id || 'default-user';

    const body = await req.json();
    const { elements, framework = 'vue', llmConfig } = body;

    // 1. 获取已存的服务端配置作为兜底
    const savedConfig = await getUserLLMConfig(userId);

    // 2. 提取有效 API Key
    let apiKey = llmConfig?.apiKey?.trim();
    if (!apiKey || isMaskedKey(apiKey)) {
      apiKey = savedConfig?.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
    }

    // 3. 提取 Base URL、Model 与 Max Tokens
    const baseUrl = (
      llmConfig?.baseUrl ||
      savedConfig?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');

    const model =
      llmConfig?.model ||
      savedConfig?.defaultModel ||
      'qwen3.7-plus';

    const maxTokens =
      Number(llmConfig?.maxTokens) ||
      Number(savedConfig?.maxTokens) ||
      4096;

    if (!apiKey) {
      return NextResponse.json(
        { error: '未配置大模型，请在右上角设置中添加有效的 API Key' },
        { status: 400 }
      );
    }

    if (!elements || elements.length === 0) {
      return NextResponse.json(
        { error: '未提供选区元素数据，请先框选画板元素' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert full-stack UI engineer.
Convert the provided Excalidraw JSON canvas elements into a production-ready, beautiful, modern ${
      framework === 'vue'
        ? 'Vue 3 Single File Component (<template>, <script setup>, Tailwind CSS)'
        : 'React Component (with Tailwind CSS)'
    }.
Requirements:
1. Use Tailwind CSS for all layout, spacing, colors, and responsive design.
2. Ensure components are visually balanced and clean.
3. Return ONLY the component code enclosed inside markdown code blocks.`;

    const userPrompt = `Here is the Excalidraw elements JSON structure of the UI design:
\`\`\`json
${JSON.stringify(elements, null, 2)}
\`\`\`

Generate the corresponding ${framework === 'vue' ? 'Vue 3' : 'React'} component now.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `大模型接口返回错误 (${response.status}): ${errorText}`,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content || '';

    let code = rawContent;
    const match = rawContent.match(/```(?:vue|react|tsx|jsx|html)?([\s\S]*?)```/);
    if (match && match[1]) {
      code = match[1].trim();
    }

    return NextResponse.json({ code, framework });
  } catch (error: any) {
    console.error('generate-code API Error:', error);
    return NextResponse.json(
      { error: error.message || '服务端生成代码异常' },
      { status: 500 }
    );
  }
}