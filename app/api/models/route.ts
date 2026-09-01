import { NextRequest, NextResponse } from 'next/server';
import {
  getUserLLMConfig,
  saveUserLLMConfig,
  testLLMConnection,
  maskKey,
  isMaskedKey,
  UserLLMConfig,
} from '@/lib/user-llm';
import { getAuthUser } from '@/lib/auth';

// 默认大模型配置项
const DEFAULT_CONFIG: UserLLMConfig = {
  protocol: 'openai_compatible (OpenAI 兼容协议)',
  baseUrl: 'https://khub.idlecatlabs.net/v1',
  apiKey: '',
  models: 'deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2',
  defaultModel: 'qwen3.7-plus',
  maxTokens: 4096,
};

// GET: 获取当前用户的 LLM 配置（API Key 返回掩码）
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const userId = user?.id || 'default-user';

    const savedConfig = await getUserLLMConfig(userId);
    const activeConfig = savedConfig || DEFAULT_CONFIG;

    return NextResponse.json({
      config: {
        ...activeConfig,
        apiKey: activeConfig.apiKey ? maskKey(activeConfig.apiKey) : '',
      },
      hasKey: Boolean(activeConfig.apiKey),
    });
  } catch (error: any) {
    console.error('获取 LLM 配置异常:', error);
    return NextResponse.json({ config: DEFAULT_CONFIG, hasKey: false });
  }
}

// POST: 测试连通性或保存配置
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const userId = user?.id || 'default-user';

    const body = await req.json();
    const { action, config } = body as { action: 'test' | 'save'; config: UserLLMConfig };

    if (!config || !config.baseUrl) {
      return NextResponse.json(
        { success: false, error: 'API Base URL 不能为空' },
        { status: 400 }
      );
    }

    // 获取当前数据库/存储中已有的配置
    const existingConfig = await getUserLLMConfig(userId);

    // 智能解析 API Key：如果前端传来的是脱敏掩码，则还原为已存的真实 Key
    let realApiKey = config.apiKey ? config.apiKey.trim() : '';
    if (isMaskedKey(realApiKey)) {
      realApiKey = existingConfig?.apiKey || '';
    }

    // 若无论如何都拿不到真实 Key，则提示不能为空
    if (!realApiKey) {
      return NextResponse.json(
        { success: false, error: 'API Key 不能为空，请输入有效的 API Key' },
        { status: 400 }
      );
    }

    const targetConfig: UserLLMConfig = {
      protocol: config.protocol || DEFAULT_CONFIG.protocol,
      baseUrl: config.baseUrl.trim(),
      apiKey: realApiKey,
      models: config.models?.trim() || DEFAULT_CONFIG.models,
      defaultModel: config.defaultModel?.trim() || DEFAULT_CONFIG.defaultModel,
      maxTokens: Number(config.maxTokens) || 4096,
    };

    // 1. 执行连通性测试
    if (action === 'test') {
      const testResult = await testLLMConnection(targetConfig);
      if (!testResult.success) {
        return NextResponse.json(
          { success: false, error: testResult.error || '连通性测试未通过' },
          { status: 400 }
        );
      }

      // 测试通过后顺带保存，确保配置即时生效
      await saveUserLLMConfig(userId, targetConfig);

      return NextResponse.json({
        success: true,
        message: '测试连通成功并已保存！',
      });
    }

    // 2. 执行保存
    if (action === 'save') {
      const ok = await saveUserLLMConfig(userId, targetConfig);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: '保存配置到云端失败' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        config: {
          ...targetConfig,
          apiKey: maskKey(targetConfig.apiKey),
        },
      });
    }

    return NextResponse.json({ success: false, error: '未知操作指令' }, { status: 400 });
  } catch (error: any) {
    console.error('LLM 配置接口处理异常:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器内部处理异常' },
      { status: 500 }
    );
  }
}