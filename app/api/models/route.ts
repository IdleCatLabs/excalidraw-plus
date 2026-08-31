import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserLLMConfig, saveUserLLMConfig, UserLLMConfig } from '@/lib/user-llm';
import OpenAI from 'openai';

// GET: 获取当前用户的 LLM 配置和可用模型列表
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const config = await getUserLLMConfig(user.username);

    if (!config) {
      return NextResponse.json({
        configured: false,
        config: null,
        models: [],
      });
    }

    const maskedKey = config.apiKey
      ? config.apiKey.length > 8
        ? `${config.apiKey.slice(0, 3)}...${config.apiKey.slice(-4)}`
        : '******'
      : '';

    return NextResponse.json({
      configured: true,
      config: {
        ...config,
        apiKeyMasked: maskedKey,
      },
      models: config.models || [],
      defaultModel: config.defaultModel || config.models?.[0] || '',
    });
  } catch (error: any) {
    console.error('获取模型配置失败:', error);
    return NextResponse.json({ error: '获取模型配置失败' }, { status: 500 });
  }
}

// POST: 保存/更新用户的 LLM 配置
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { baseUrl, apiKey, models, defaultModel, maxTokens, temperature, testConnection } = body;

    if (!baseUrl?.trim()) {
      return NextResponse.json({ error: 'Base URL 不能为空' }, { status: 400 });
    }

    let finalApiKey = apiKey?.trim();
    const existingConfig = await getUserLLMConfig(user.username);
    if (finalApiKey && finalApiKey.includes('...') && existingConfig) {
      finalApiKey = existingConfig.apiKey;
    }

    if (!finalApiKey) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }

    const modelList = Array.isArray(models)
      ? models
      : typeof models === 'string'
      ? models.split(/[\n,]+/).map((m: string) => m.trim()).filter(Boolean)
      : [];

    if (modelList.length === 0) {
      return NextResponse.json({ error: '请至少指定一个模型名称' }, { status: 400 });
    }

    const newConfig: UserLLMConfig = {
      providerType: 'openai_compatible',
      baseUrl: baseUrl.trim(),
      apiKey: finalApiKey,
      models: modelList,
      defaultModel: defaultModel || modelList[0],
      maxTokens: Number(maxTokens) || 4096,
      temperature: Number(temperature) ?? 0.7,
    };

    if (testConnection) {
      try {
        const testClient = new OpenAI({
          baseURL: newConfig.baseUrl,
          apiKey: newConfig.apiKey,
          timeout: 12000, // 严格限制连通性探测在 12 秒内返回
        });

        // 优先探测网关 /models 列表（无需生成 Token，秒级返回）
        try {
          await testClient.models.list();
        } catch {
          // 若网关未开放 models 路由，使用最小轻量请求探测
          await testClient.chat.completions.create({
            model: newConfig.defaultModel || newConfig.models[0],
            messages: [{ role: 'user', content: '1' }],
            max_tokens: 3,
          });
        }
      } catch (testError: any) {
        return NextResponse.json(
          {
            error: `测试连通失败: ${testError?.message || '无法访问该模型服务'}`,
            detail: testError?.toString(),
          },
          { status: 400 }
        );
      }
    }

    await saveUserLLMConfig(user.username, newConfig);

    return NextResponse.json({
      success: true,
      message: '大模型配置已保存',
      models: newConfig.models,
      defaultModel: newConfig.defaultModel,
    });
  } catch (error: any) {
    console.error('保存模型配置失败:', error);
    return NextResponse.json({ error: error.message || '保存模型配置失败' }, { status: 500 });
  }
}