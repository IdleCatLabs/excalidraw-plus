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
    if (!sceneData || !Array.isArray(sceneData.elements)) {
      return NextResponse.json({ error: '缺少有效的 sceneData.elements 画布数据' }, { status: 400 });
    }

    await ensureBucketExists();

    const objectKey = `scenes/${boardId}.json`;
    const jsonStr = JSON.stringify(sceneData);
    const buffer = Buffer.from(jsonStr, 'utf-8');

    await minioClient.putObject(BUCKET_NAME, objectKey, buffer, buffer.length, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    console.log(`[MinIO] 草图成功持久化: ${objectKey}, 图元数量: ${sceneData.elements.length}`);

    return NextResponse.json({
      success: true,
      message: '保存成功',
      objectKey,
      elementCount: sceneData.elements.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/scenes POST] Fatal Error:', error);
    return NextResponse.json(
      { error: error.message || 'MinIO 数据写入失败' },
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

    return new Promise<NextResponse>(async (resolve) => {
      try {
        const stream = await minioClient.getObject(BUCKET_NAME, objectKey);
        const chunks: Buffer[] = [];

        stream.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        stream.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (!raw.trim()) {
              resolve(NextResponse.json({ success: true, sceneData: null }));
              return;
            }
            const sceneData = JSON.parse(raw);
            resolve(NextResponse.json({ success: true, sceneData }));
          } catch (parseErr: any) {
            console.error(`[MinIO] JSON 解析失败 (${objectKey}):`, parseErr);
            resolve(NextResponse.json({ success: true, sceneData: null }));
          }
        });

        stream.on('error', (err: any) => {
          if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
            resolve(NextResponse.json({ success: true, sceneData: null }));
          } else {
            console.error(`[MinIO] 读取 Stream 异常 (${objectKey}):`, err);
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
          }
        });
      } catch (err: any) {
        if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
          resolve(NextResponse.json({ success: true, sceneData: null }));
        } else {
          console.error(`[MinIO] 获取对象异常 (${objectKey}):`, err);
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        }
      }
    });
  } catch (error: any) {
    console.error('[API /api/scenes GET] Fatal Error:', error);
    return NextResponse.json(
      { error: error.message || '获取画板失败' },
      { status: 500 }
    );
  }
}