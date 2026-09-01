import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME } from '@/lib/minio';
import { getAuthUser } from '@/lib/auth';

const PROJECTS_OBJECT = 'projects/projects.json';

// 同步画板元数据到 projects.json 索引中
async function syncBoardToProjects(boardId: string, projectId: string, title: string) {
  try {
    let projects: any[] = [];
    try {
      const stream = await minioClient.getObject(BUCKET_NAME, PROJECTS_OBJECT);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      projects = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    } catch {
      projects = [
        {
          id: 'default-project',
          name: '默认项目',
          boards: [],
        },
      ];
    }

    let targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj) {
      targetProj = projects[0];
    }

    targetProj.boards = targetProj.boards || [];
    const existingBoardIndex = targetProj.boards.findIndex((b: any) => b.id === boardId);

    const now = new Date().toISOString();
    if (existingBoardIndex >= 0) {
      targetProj.boards[existingBoardIndex].title = title;
      targetProj.boards[existingBoardIndex].updatedAt = now;
    } else {
      targetProj.boards.push({
        id: boardId,
        projectId: targetProj.id,
        title: title || '未命名画板',
        createdAt: now,
        updatedAt: now,
      });
    }

    const buffer = Buffer.from(JSON.stringify(projects, null, 2), 'utf-8');
    await minioClient.putObject(BUCKET_NAME, PROJECTS_OBJECT, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });
  } catch (e) {
    console.error('同步画板到项目索引失败:', e);
  }
}

// 从 projects.json 索引中移除画板
async function removeBoardFromProjects(boardId: string) {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, PROJECTS_OBJECT);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const projects = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

    projects.forEach((p: any) => {
      if (p.boards) {
        p.boards = p.boards.filter((b: any) => b.id !== boardId);
      }
    });

    const buffer = Buffer.from(JSON.stringify(projects, null, 2), 'utf-8');
    await minioClient.putObject(BUCKET_NAME, PROJECTS_OBJECT, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });
  } catch (e) {
    console.error('移除画板索引失败:', e);
  }
}

// GET: 获取画板场景
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('id') || searchParams.get('boardId') || 'default-board';
    const objectName = `scenes/${boardId}.json`;

    try {
      const stream = await minioClient.getObject(BUCKET_NAME, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const dataStr = Buffer.concat(chunks).toString('utf-8');
      return NextResponse.json(JSON.parse(dataStr));
    } catch {
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

// POST: 保存/新建画板并同步索引
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const body = await req.json();

    const boardId = body.id || body.boardId || `board-${Date.now()}`;
    const title = body.title || '未命名画板';
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

    await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });

    // 同步到项目列表
    await syncBoardToProjects(boardId, projectId, title);

    return NextResponse.json({ success: true, ...sceneData });
  } catch (error: any) {
    console.error('保存画板异常:', error);
    return NextResponse.json({ error: error.message || '保存画板异常' }, { status: 500 });
  }
}

// PUT: 重命名画板
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, projectId } = body;

    if (!id || !title?.trim()) {
      return NextResponse.json({ error: '画板 ID 与标题不能为空' }, { status: 400 });
    }

    const objectName = `scenes/${id}.json`;
    let sceneData: any = {};

    try {
      const stream = await minioClient.getObject(BUCKET_NAME, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      sceneData = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
    } catch {
      sceneData = { id, elements: [], appState: {}, files: {} };
    }

    sceneData.title = title.trim();
    sceneData.updatedAt = new Date().toISOString();

    const buffer = Buffer.from(JSON.stringify(sceneData, null, 2), 'utf-8');
    await minioClient.putObject(BUCKET_NAME, objectName, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });

    await syncBoardToProjects(id, projectId || sceneData.projectId || 'default-project', title.trim());

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '重命名画板失败' }, { status: 500 });
  }
}

// DELETE: 删除画板
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('id') || searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: '缺少画板 ID' }, { status: 400 });
    }

    try {
      await minioClient.removeObject(BUCKET_NAME, `scenes/${boardId}.json`);
    } catch {}

    await removeBoardFromProjects(boardId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除画板失败' }, { status: 500 });
  }
}