import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME, ensureBucketExists } from '@/lib/minio';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { boardId, sceneData } = body;

    if (!boardId || !sceneData) {
      return NextResponse.json({ error: '缺少 boardId 或 sceneData 参数' }, { status: 400 });
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
    console.error('Save Scene Error:', error);
    return NextResponse.json(
      { error: error.message || '保存失败，请检查 MinIO 连接' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: '缺少 boardId 参数' }, { status: 400 });
    }

    await ensureBucketExists();

    const objectKey = `scenes/${boardId}.json`;

    try {
      const dataStream = await minioClient.getObject(BUCKET_NAME, objectKey);
      const chunks: Buffer[] = [];

      for await (const chunk of dataStream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }

      const raw = Buffer.concat(chunks).toString('utf-8');
      const sceneData = JSON.parse(raw);

      return NextResponse.json({ success: true, sceneData });
    } catch (err: any) {
      if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
        return NextResponse.json({ success: true, sceneData: null });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Get Scene Error:', error);
    return NextResponse.json(
      { error: error.message || '获取画板数据失败' },
      { status: 500 }
    );
  }
}