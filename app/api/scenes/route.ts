import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME } from '@/lib/minio';
import { getAuthUser } from '@/lib/auth';

// GET: 获取画板场景数据
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId =
      searchParams.get('id') ||
      searchParams.get('boardId') ||
      'default-board';

    const objectName = `scenes/${boardId}.json`;

    try {
      const stream = await minioClient.getObject(BUCKET_NAME, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const dataStr = Buffer.concat(chunks).toString('utf-8');
      const scene = JSON.parse(dataStr);
      return NextResponse.json(scene);
    } catch (err: any) {
      // 若 MinIO 中尚未创建该画板，正常返回空画板结构，不抛出 400
      return NextResponse.json({
        id: boardId,
        boardId,
        title: '12号',
        elements: [],
        appState: {},
        files: {},
      });
    }
  } catch (error: any) {
    console.error('获取画板场景异常:', error);
    return NextResponse.json({
      id: 'default-board',
      boardId: 'default-board',
      title: '12号',
      elements: [],
      appState: {},
      files: {},
    });
  }
}

// POST: 保存/持久化画板场景到 MinIO
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const body = await req.json();

    const boardId = body.id || body.boardId || 'default-board';
    const title = body.title || '12号';
    const projectId = body.projectId || 'default-project';

    const sceneData = {
      id: boardId,
      boardId,
      projectId,
      title,
      elements: body.elements || [],
      appState: body.appState || {},
      files: body.files || {},
      updatedAt: new Date().toISOString(),
      updatedBy: user?.username || 'admin',
    };

    const objectName = `scenes/${boardId}.json`;
    const buffer = Buffer.from(JSON.stringify(sceneData, null, 2), 'utf-8');

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

    return NextResponse.json({ success: true, ...sceneData });
  } catch (error: any) {
    console.error('保存画板场景失败:', error);
    return NextResponse.json(
      { error: error.message || '保存画板场景失败' },
      { status: 500 }
    );
  }
}

// DELETE: 删除画板场景
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('id') || searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: '缺少画板 ID' }, { status: 400 });
    }

    const objectName = `scenes/${boardId}.json`;
    try {
      await minioClient.removeObject(BUCKET_NAME, objectName);
    } catch (e) {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除画板失败' }, { status: 500 });
  }
}