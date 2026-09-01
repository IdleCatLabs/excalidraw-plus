import { NextRequest, NextResponse } from 'next/server';
import { minioClient, BUCKET_NAME } from '@/lib/minio';
import { getAuthUser } from '@/lib/auth';

export interface BoardItem {
  id: string;
  projectId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string;
  boards: BoardItem[];
}

const PROJECTS_OBJECT = 'projects/projects.json';

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: 'default-project',
    name: '默认项目',
    description: '默认画板项目',
    boards: [
      {
        id: 'default-board',
        projectId: 'default-project',
        title: '12号',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
  },
];

// 从 MinIO 获取项目配置并自动同步 MinIO 内的已有场景
async function getProjectsData(): Promise<ProjectItem[]> {
  let projects: ProjectItem[] = [];

  try {
    const stream = await minioClient.getObject(BUCKET_NAME, PROJECTS_OBJECT);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    projects = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch (err) {
    projects = DEFAULT_PROJECTS;
  }

  if (!projects || projects.length === 0) {
    projects = DEFAULT_PROJECTS;
  }

  // 扫描 scenes/ 目录下的所有画板，避免因丢失索引导致画板未列出
  try {
    const stream = minioClient.listObjects(BUCKET_NAME, 'scenes/', true);
    const sceneFiles: string[] = [];

    for await (const item of stream) {
      if (item.name && item.name.endsWith('.json')) {
        const boardId = item.name.replace(/^scenes\//, '').replace(/\.json$/, '');
        if (boardId) sceneFiles.push(boardId);
      }
    }

    // 检查已存画板是否在项目列表中
    const knownBoardIds = new Set<string>();
    projects.forEach((p) => {
      p.boards = p.boards || [];
      p.boards.forEach((b) => knownBoardIds.add(b.id));
    });

    let modified = false;
    for (const boardId of sceneFiles) {
      if (!knownBoardIds.has(boardId)) {
        // 读取画板标题
        let boardTitle = boardId;
        try {
          const s = await minioClient.getObject(BUCKET_NAME, `scenes/${boardId}.json`);
          const chunks: Buffer[] = [];
          for await (const c of s) chunks.push(c);
          const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (data.title) boardTitle = data.title;
        } catch {}

        projects[0].boards.push({
          id: boardId,
          projectId: projects[0].id,
          title: boardTitle,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        modified = true;
      }
    }

    if (modified) {
      await saveProjectsData(projects);
    }
  } catch (e) {
    console.error('扫描 scenes 异常:', e);
  }

  return projects;
}

// 保存项目配置到 MinIO
async function saveProjectsData(projects: ProjectItem[]): Promise<boolean> {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    }

    const buffer = Buffer.from(JSON.stringify(projects, null, 2), 'utf-8');
    await minioClient.putObject(BUCKET_NAME, PROJECTS_OBJECT, buffer, buffer.length, {
      'Content-Type': 'application/json',
    });
    return true;
  } catch (err) {
    console.error('保存项目数据失败:', err);
    return false;
  }
}

// GET: 获取所有项目及关联画板
export async function GET() {
  try {
    const projects = await getProjectsData();
    return NextResponse.json({ projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取项目失败' }, { status: 500 });
  }
}

// POST: 新建项目分组
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    const projects = await getProjectsData();
    const newProject: ProjectItem = {
      id: `project-${Date.now()}`,
      name,
      description: body.description || '',
      boards: [],
    };

    projects.push(newProject);
    await saveProjectsData(projects);

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '创建项目失败' }, { status: 500 });
  }
}

// PUT: 重命名/更新项目分组
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name } = body;

    if (!id || !name?.trim()) {
      return NextResponse.json({ error: '项目 ID 和名称不能为空' }, { status: 400 });
    }

    const projects = await getProjectsData();
    const target = projects.find((p) => p.id === id);

    if (!target) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    target.name = name.trim();
    await saveProjectsData(projects);

    return NextResponse.json({ success: true, project: target });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新项目失败' }, { status: 500 });
  }
}

// DELETE: 删除项目分组
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '项目 ID 不能为空' }, { status: 400 });
    }

    let projects = await getProjectsData();
    if (projects.length <= 1) {
      return NextResponse.json({ error: '至少需要保留一个默认项目' }, { status: 400 });
    }

    const targetProject = projects.find((p) => p.id === id);
    if (targetProject && targetProject.boards) {
      for (const board of targetProject.boards) {
        try {
          await minioClient.removeObject(BUCKET_NAME, `scenes/${board.id}.json`);
        } catch {}
      }
    }

    projects = projects.filter((p) => p.id !== id);
    await saveProjectsData(projects);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除项目失败' }, { status: 500 });
  }
}