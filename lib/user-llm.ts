import OpenAI from 'openai';
import * as Minio from 'minio';
import { getCurrentUser } from '@/lib/auth';

export interface UserLLMConfig {
  providerType: 'openai_compatible';
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
}

// 解析 MinIO 连接地址与端口
const rawEndpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || 'http://minio:9000';
let endPoint = 'minio';
let port = 9000;
let useSSL = false;

try {
  if (rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')) {
    const url = new URL(rawEndpoint);
    endPoint = url.hostname;
    port = url.port ? parseInt(url.port, 10) : url.protocol === 'https:' ? 443 : 80;
    useSSL = url.protocol === 'https:';
  } else {
    endPoint = rawEndpoint;
  }
} catch {
  endPoint = rawEndpoint;
}

// 自动匹配多种环境变量命名，兜底默认值 minioadmin
const accessKey =
  process.env.S3_ACCESS_KEY ||
  process.env.MINIO_ACCESS_KEY ||
  process.env.MINIO_ROOT_USER ||
  'minioadmin';

const secretKey =
  process.env.S3_SECRET_KEY ||
  process.env.MINIO_SECRET_KEY ||
  process.env.MINIO_ROOT_PASSWORD ||
  'minioadmin';

const minioClient = new Minio.Client({
  endPoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.MINIO_BUCKET || 'excalidraw-plus';

function getUserConfigKey(username: string): string {
  return `users/${username}/llm-config.json`;
}

/**
 * 获取指定用户的大模型配置
 */
export async function getUserLLMConfig(username: string): Promise<UserLLMConfig | null> {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, getUserConfigKey(username));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const data = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(data) as UserLLMConfig;
  } catch (error: any) {
    if (
      error.code === 'NoSuchKey' ||
      error.code === 'NotFound' ||
      error.message?.includes('Not Found')
    ) {
      return null;
    }
    console.error(`[LLM Config] 读取 ${username} 的配置失败:`, error);
    return null;
  }
}

/**
 * 保存用户的大模型配置
 */
export async function saveUserLLMConfig(username: string, config: UserLLMConfig): Promise<void> {
  let baseUrl = config.baseUrl?.trim() || '';
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const payload: UserLLMConfig = {
    ...config,
    providerType: 'openai_compatible',
    baseUrl,
    models: (config.models || []).map((m) => m.trim()).filter(Boolean),
    maxTokens: Number(config.maxTokens) || 4096,
    temperature: Number(config.temperature) ?? 0.7,
  };

  // 自动检测并创建 Bucket
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, '');
    }
  } catch {
    // 忽略已存在或并发创建错误
  }

  const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
  await minioClient.putObject(BUCKET_NAME, getUserConfigKey(username), buffer, buffer.length, {
    'Content-Type': 'application/json',
  });
}

/**
 * 获取当前登录用户对应的 OpenAI 客户端与配置
 */
export async function getOpenAIClientForRequest(): Promise<{
  client: OpenAI;
  config: UserLLMConfig;
  username: string;
}> {
  const user = await getCurrentUser();
  if (!user || !user.username) {
    throw new Error('UNAUTHORIZED');
  }

  const config = await getUserLLMConfig(user.username);
  if (!config || !config.apiKey || !config.baseUrl) {
    throw new Error('NO_LLM_CONFIG');
  }

  const client = new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  return {
    client,
    config,
    username: user.username,
  };
}