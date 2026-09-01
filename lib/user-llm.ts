import OpenAI from 'openai';
import { minioClient, BUCKET_NAME } from './minio';
import { getAuthUser } from './auth';
import { NextRequest } from 'next/server';

export interface UserLLMConfig {
  protocol?: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  defaultModel: string;
  maxTokens: number;
}

export interface OpenAIClientResult extends OpenAI {
  client: OpenAI;
  openai: OpenAI;
  config: UserLLMConfig & { [key: string]: any };
  user: any;
  model: string;
  maxTokens: number;
  apiKey: string;
  baseUrl: string;
}

const MASK_PREFIX = '••••••••';

// 判断是否为脱敏后的掩码字符串
export function isMaskedKey(key?: string): boolean {
  if (!key) return false;
  return key.startsWith('•••') || key.includes('••••') || key.includes('****');
}

// 对 API Key 进行安全掩码处理
export function maskKey(key?: string): string {
  if (!key) return '';
  if (key.length <= 8) return MASK_PREFIX;
  return `${MASK_PREFIX}${key.slice(-4)}`;
}

// 获取指定用户的 LLM 配置
export async function getUserLLMConfig(userId: string = 'default-user'): Promise<UserLLMConfig | null> {
  const objectName = `users/${userId}/llm-config.json`;

  try {
    const stream = await minioClient.getObject(BUCKET_NAME, objectName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const dataStr = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(dataStr);
  } catch (err: any) {
    return null;
  }
}

export const getLLMConfig = getUserLLMConfig;

// 保存指定用户的 LLM 配置到 MinIO
export async function saveUserLLMConfig(
  userId: string = 'default-user',
  config: UserLLMConfig
): Promise<boolean> {
  const objectName = `users/${userId}/llm-config.json`;
  const buffer = Buffer.from(JSON.stringify(config, null, 2), 'utf-8');

  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    }

    await minioClient.putObject(
      BUCKET_NAME,
      objectName,
      buffer,
      buffer.length,
      { 'Content-Type': 'application/json' }
    );
    return true;
  } catch (err) {
    console.error('保存用户大模型配置到 MinIO 失败:', err);
    return false;
  }
}

// 为请求构造 OpenAI 客户端实例与配置参数
export async function getOpenAIClientForRequest(
  req?: NextRequest | Request,
  bodyConfig?: Partial<UserLLMConfig>
): Promise<OpenAIClientResult> {
  let currentUser: any = { id: 'default-user', username: 'admin', role: 'superadmin' };
  if (req) {
    try {
      const user = await getAuthUser(req as any);
      if (user?.id) currentUser = user;
    } catch {}
  }

  const userId = currentUser.id || 'default-user';
  const savedConfig = await getUserLLMConfig(userId);

  let apiKey = bodyConfig?.apiKey?.trim() || '';
  if (!apiKey || isMaskedKey(apiKey)) {
    apiKey = savedConfig?.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
  }

  const baseUrl = (
    bodyConfig?.baseUrl ||
    savedConfig?.baseUrl ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  ).replace(/\/+$/, '');

  const model =
    bodyConfig?.defaultModel ||
    (bodyConfig as any)?.model ||
    savedConfig?.defaultModel ||
    'qwen3.7-plus';

  const maxTokens =
    Number(bodyConfig?.maxTokens) ||
    Number(savedConfig?.maxTokens) ||
    4096;

  const client = new OpenAI({
    apiKey: apiKey || 'dummy-key',
    baseURL: baseUrl,
  });

  const configObj: UserLLMConfig & { [key: string]: any } = {
    protocol: bodyConfig?.protocol || savedConfig?.protocol || 'openai_compatible (OpenAI 兼容协议)',
    baseUrl,
    apiKey,
    models: bodyConfig?.models || savedConfig?.models || 'deepseek-v4-pro,deepseek-v4-flash,qwen3.7-plus,glm-5.2',
    defaultModel: model,
    maxTokens,
  };

  return Object.assign(client, {
    client,
    openai: client,
    config: configObj,
    user: currentUser,
    model,
    maxTokens,
    apiKey,
    baseUrl,
  }) as OpenAIClientResult;
}

// 测试接口连通性
export async function testLLMConnection(
  config: UserLLMConfig
): Promise<{ success: boolean; error?: string }> {
  const cleanBaseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model =
    config.defaultModel ||
    (config.models ? config.models.split(/[,，\n]/)[0].trim() : 'qwen3.7-plus');

  try {
    const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 404 || response.status === 400) {
      const modelsRes = await fetch(`${cleanBaseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      });

      if (modelsRes.ok) {
        return { success: true };
      }
    }

    const errText = await response.text();
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = JSON.parse(errText);
      errorDetail = errJson.error?.message || errJson.message || errorDetail;
    } catch {
      if (errText) errorDetail = errText.slice(0, 100);
    }

    return {
      success: false,
      error: `接口连接失败 (${errorDetail})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `网络连接异常: ${err.message || '无法访问该 Base URL'}`,
    };
  }
}