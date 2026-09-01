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

// 判断是否为掩码字符
export function isMaskedKey(key?: string): boolean {
  if (!key) return false;
  return key.startsWith('•••') || key.includes('••••') || key.includes('****');
}

// 脱敏函数
export function maskKey(key?: string): string {
  if (!key) return '';
  if (key.length <= 8) return MASK_PREFIX;
  return `${MASK_PREFIX}${key.slice(-4)}`;
}

// 获取用户在 MinIO 中的配置（支持 admin-1 / default-user 多级兜底）
export async function getUserLLMConfig(userId: string = 'admin-1'): Promise<UserLLMConfig | null> {
  const tryIds = [userId, 'admin-1', 'default-user'];

  for (const id of tryIds) {
    const objectName = `users/${id}/llm-config.json`;
    try {
      const stream = await minioClient.getObject(BUCKET_NAME, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const dataStr = Buffer.concat(chunks).toString('utf-8');
      const parsed = JSON.parse(dataStr);
      if (parsed && parsed.apiKey) {
        return parsed;
      }
    } catch (err) {}
  }

  return null;
}

export const getLLMConfig = getUserLLMConfig;

// 保存配置到 MinIO
export async function saveUserLLMConfig(
  userId: string = 'admin-1',
  config: UserLLMConfig
): Promise<boolean> {
  const uid = userId || 'admin-1';
  const objectName = `users/${uid}/llm-config.json`;
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

// 构造 OpenAI 客户端（优先使用 Body 传参，次之从 MinIO 读取，再次之从环境变量）
export async function getOpenAIClientForRequest(
  req?: NextRequest | Request,
  bodyConfig?: Partial<UserLLMConfig>
): Promise<OpenAIClientResult> {
  let currentUser: any = { id: 'admin-1', username: 'admin', role: 'superadmin' };
  if (req) {
    try {
      const user = await getAuthUser(req as any);
      if (user?.id) currentUser = user;
    } catch {}
  }

  const userId = currentUser.id || 'admin-1';
  const savedConfig = await getUserLLMConfig(userId);

  // 1. 提取有效 API Key
  let apiKey = bodyConfig?.apiKey?.trim() || '';
  if (!apiKey || isMaskedKey(apiKey)) {
    apiKey = savedConfig?.apiKey?.trim() || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
  }

  // 2. 提取 Base URL
  const baseUrl = (
    bodyConfig?.baseUrl?.trim() ||
    savedConfig?.baseUrl?.trim() ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  ).replace(/\/+$/, '');

  // 3. 提取 Model
  const model =
    bodyConfig?.defaultModel?.trim() ||
    (bodyConfig as any)?.model?.trim() ||
    savedConfig?.defaultModel?.trim() ||
    'qwen3.7-plus';

  // 4. 提取 Max Tokens
  const maxTokens =
    Number(bodyConfig?.maxTokens) ||
    Number(savedConfig?.maxTokens) ||
    4096;

  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const client = new OpenAI({
    apiKey: apiKey,
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

// 测试连通性
export async function testLLMConnection(
  config: UserLLMConfig
): Promise<{ success: boolean; error?: string }> {
  const cleanBaseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model =
    config.defaultModel ||
    (config.models ? config.models.split(/[,，\n]/)[0].trim() : 'qwen3.7-plus');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    // 1. 优先尝试轻量级 /models 接口
    try {
      const modelsRes = await fetch(`${cleanBaseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: controller.signal,
      });

      if (modelsRes.ok) {
        clearTimeout(timeoutId);
        return { success: true };
      }
    } catch {}

    // 2. 备选 chat/completions 验证
    const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true };
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
      error: `连通失败: ${errorDetail}`,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: '连接超时（12秒未响应），请检查 Base URL 与网络连通性' };
    }
    return {
      success: false,
      error: `网络异常: ${err.message || '无法连接该 Base URL'}`,
    };
  }
}