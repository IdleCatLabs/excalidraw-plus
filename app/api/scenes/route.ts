import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME, ensureBucketExists } from '@/lib/minio';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { boardId, sceneData } = body;

    if (!boardId) {
      return NextResponse.json({ error: '缺少 boardId 参数' }, { status: 400 });
    }
    if (!sceneData) {
      return NextResponse.json({ error: '缺少 sceneData 画板内容' }, { status: 400 });
    }

    // 确保存储桶可用
    await ensureBucketExists();

    const objectKey = `scenes/${boardId}.json`;
    const buffer = Buffer.from(JSON.stringify(sceneData), 'utf-8');

    await minioClient.putObject(BUCKET_NAME, objectKey, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });

    return NextResponse.json({
      success: true,
      message: '保存成功',
      objectKey,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/scenes POST] Error:', error);
    return NextResponse.json(
      { error: error.message || 'MinIO 数据写入失败' },
      { status: 500 }
    );
  }
}