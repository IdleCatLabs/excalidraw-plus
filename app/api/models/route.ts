import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME, ensureBucketExists } from '@/lib/minio';

export const runtime = 'nodejs';

const LLM_CONFIG_KEY = 'config/llm-config.json';

// 获取 AI 配置
export async function GET() {
  try {
    await ensureBucketExists();

    const stream = await minioClient.getObject(BUCKET_NAME, LLM_CONFIG_KEY);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    const config = JSON.parse(raw);

    return NextResponse.json({
      configured: !!config.apiKey,
      models: config.models || ['qwen3.7-plus', 'deepseek-chat'],
      defaultModel: config.defaultModel || 'qwen3.7-plus',
      baseUrl: config.baseUrl || '',
    });
  } catch (err: any) {
    // 默认回退到环境变量或空配置
    const envApiKey = process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
    const envBaseUrl = process.env.OPENAI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    return NextResponse.json({
      configured: !!envApiKey,
      models: ['qwen3.7-plus', 'deepseek-chat', 'deepseek-coder'],
      defaultModel: 'qwen3.7-plus',
      baseUrl: envBaseUrl,
    });
  }
}

// 保存 AI 配置到 MinIO
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, baseUrl, models, defaultModel } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 不能为空' }, { status: 400 });
    }

    await ensureBucketExists();

    const configData = {
      apiKey,
      baseUrl: baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: models && models.length > 0 ? models : ['qwen3.7-plus', 'deepseek-chat'],
      defaultModel: defaultModel || 'qwen3.7-plus',
      updatedAt: new Date().toISOString(),
    };

    const buffer = Buffer.from(JSON.stringify(configData), 'utf-8');
    await minioClient.putObject(BUCKET_NAME, LLM_CONFIG_KEY, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });

    return NextResponse.json({ success: true, message: 'AI 大模型配置已持久化至 MinIO' });
  } catch (error: any) {
    console.error('[MinIO] Save LLM Config Error:', error);
    return NextResponse.json(
      { error: error.message || '保存配置失败' },
      { status: 500 }
    );
  }
}