import { NextResponse } from "next/server";
import * as Minio from "minio";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getMinioClient() {
  let rawEndpoint = (process.env.MINIO_ENDPOINT || "minio").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  let host = rawEndpoint;
  let port = Number(process.env.MINIO_PORT) || 9000;
  if (host.includes(":")) {
    const parts = host.split(":");
    host = parts[0];
    port = Number(parts[1]) || port;
  }
  return new Minio.Client({
    endPoint: host,
    port,
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: (process.env.MINIO_ROOT_USER || "admin_user").trim(),
    secretKey: (process.env.MINIO_ROOT_PASSWORD || "StrongPassword123").trim(),
  });
}

const BUCKET = (process.env.MINIO_BUCKET || "excalidraw-scenes").trim();

async function ensureBucket(client: Minio.Client) {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) await client.makeBucket(BUCKET, "us-east-1");
}

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const minioClient = getMinioClient();
    await ensureBucket(minioClient);

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("boardId");

    if (boardId) {
      const objectName = `users/${user.userId}/scenes/${boardId}.json`;
      try {
        const stream = await minioClient.getObject(BUCKET, objectName);
        const dataStr = await streamToString(stream);
        return NextResponse.json(JSON.parse(dataStr));
      } catch {
        return NextResponse.json({ error: "画板未找到" }, { status: 404 });
      }
    }

    const prefix = `users/${user.userId}/scenes/`;
    const objectsStream = minioClient.listObjectsV2(BUCKET, prefix, true);
    const boards: any[] = [];

    for await (const obj of objectsStream) {
      if (!obj.name || !obj.name.endsWith(".json")) continue;
      try {
        const stream = await minioClient.getObject(BUCKET, obj.name);
        const content = JSON.parse(await streamToString(stream));
        boards.push({
          boardId: content.boardId || obj.name.replace(prefix, "").replace(".json", ""),
          projectId: content.projectId || "proj_default",
          name: content.name || "未命名草图",
          updatedAt: content.updatedAt || obj.lastModified,
          elementCount: content.data?.elements?.length || 0,
        });
      } catch {}
    }

    boards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return NextResponse.json({ boards });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const minioClient = getMinioClient();
    await ensureBucket(minioClient);

    const { boardId, projectId = "proj_default", name, data } = await req.json();
    if (!boardId) return NextResponse.json({ error: "boardId 不能为空" }, { status: 400 });

    const payload = {
      boardId,
      projectId: projectId || "proj_default",
      userId: user.userId,
      author: user.username,
      name: name || "未命名草图",
      updatedAt: new Date().toISOString(),
      data: data || { elements: [], appState: {}, threads: [] },
    };

    const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");

    // 私有存储
    await minioClient.putObject(BUCKET, `users/${user.userId}/scenes/${boardId}.json`, buffer, buffer.length, {
      "Content-Type": "application/json",
    });

    // 公开分享镜像
    await minioClient.putObject(BUCKET, `public_shares/${boardId}.json`, buffer, buffer.length, {
      "Content-Type": "application/json",
    });

    return NextResponse.json({ success: true, boardId, projectId: payload.projectId, name: payload.name });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 核心功能：PATCH 移动草图至目标项目
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const { boardId, targetProjectId } = await req.json();
    if (!boardId || !targetProjectId) {
      return NextResponse.json({ error: "缺少 boardId 或 targetProjectId" }, { status: 400 });
    }

    const minioClient = getMinioClient();
    const objectName = `users/${user.userId}/scenes/${boardId}.json`;
    const stream = await minioClient.getObject(BUCKET, objectName);
    const content = JSON.parse(await streamToString(stream));

    content.projectId = targetProjectId;
    content.updatedAt = new Date().toISOString();

    const buffer = Buffer.from(JSON.stringify(content, null, 2), "utf-8");
    await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, { "Content-Type": "application/json" });

    return NextResponse.json({ success: true, boardId, targetProjectId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const minioClient = getMinioClient();
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) return NextResponse.json({ error: "缺少 boardId" }, { status: 400 });

    await minioClient.removeObject(BUCKET, `users/${user.userId}/scenes/${boardId}.json`);
    try {
      await minioClient.removeObject(BUCKET, `public_shares/${boardId}.json`);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}