import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME, ensureBucketExists } from '@/lib/minio';

export const runtime = 'nodejs';

const WORKSPACE_KEY = 'meta/workspace.json';

const DEFAULT_WORKSPACE = {
  folders: ['默认项目'],
  boards: [
    { id: 'board-01', title: '新建草图', folder: '默认项目', updatedAt: '刚刚' },
  ],
};

// 获取工作区元数据（分组与草图列表）
export async function GET() {
  try {
    await ensureBucketExists();

    try {
      const stream = await minioClient.getObject(BUCKET_NAME, WORKSPACE_KEY);
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }

      const raw = Buffer.concat(chunks).toString('utf-8');
      const data = JSON.parse(raw);
      return NextResponse.json({ success: true, data });
    } catch (err: any) {
      if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
        // 初次使用自动初始化默认元数据
        const buffer = Buffer.from(JSON.stringify(DEFAULT_WORKSPACE), 'utf-8');
        await minioClient.putObject(BUCKET_NAME, WORKSPACE_KEY, buffer, buffer.length, {
          'Content-Type': 'application/json',
        });
        return NextResponse.json({ success: true, data: DEFAULT_WORKSPACE });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[MinIO] Get Workspace Meta Error:', error);
    return NextResponse.json({ success: false, data: DEFAULT_WORKSPACE });
  }
}

// 保存工作区元数据
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { folders, boards } = body;

    if (!Array.isArray(folders) || !Array.isArray(boards)) {
      return NextResponse.json({ error: '无效的工作区元数据' }, { status: 400 });
    }

    await ensureBucketExists();

    const payload = { folders, boards, updatedAt: new Date().toISOString() };
    const buffer = Buffer.from(JSON.stringify(payload), 'utf-8');

    await minioClient.putObject(BUCKET_NAME, WORKSPACE_KEY, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });

    return NextResponse.json({ success: true, message: '工作区元数据已保存到 MinIO' });
  } catch (error: any) {
    console.error('[MinIO] Save Workspace Meta Error:', error);
    return NextResponse.json(
      { error: error.message || '保存失败' },
      { status: 500 }
    );
  }
}