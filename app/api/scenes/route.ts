import { NextResponse } from "next/server";
import * as Minio from "minio";

export const dynamic = "force-dynamic";

// 智能清洗 MinIO 端点（剥离 http://、https:// 及附加端口）
function getMinioClient() {
  let rawEndpoint = (process.env.MINIO_ENDPOINT || "minio").trim();
  
  // 1. 移除 http:// 或 https:// 前缀
  rawEndpoint = rawEndpoint.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  let host = rawEndpoint;
  let port = Number(process.env.MINIO_PORT) || 9000;

  // 2. 若端点字符串中自带端口 (例如 127.0.0.1:9000)，进行智能拆分
  if (host.includes(":")) {
    const parts = host.split(":");
    host = parts[0];
    port = Number(parts[1]) || port;
  }

  return new Minio.Client({
    endPoint: host,
    port: port,
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: (process.env.MINIO_ROOT_USER || "admin_user").trim(),
    secretKey: (process.env.MINIO_ROOT_PASSWORD || "StrongPassword123").trim(),
  });
}

const BUCKET = (process.env.MINIO_BUCKET || "excalidraw-scenes").trim();

// 确保存储桶存在
async function ensureBucket(client: Minio.Client) {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, "us-east-1");
  }
}

// Stream 转字符串辅助函数
async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

// 1. GET: 获取单个画板详情 或 获取画板列表
export async function GET(req: Request) {
  try {
    const minioClient = getMinioClient();
    await ensureBucket(minioClient);
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("boardId");

    // A. 查询指定画板
    if (boardId) {
      const objectName = `scenes/${boardId}.json`;
      try {
        const stream = await minioClient.getObject(BUCKET, objectName);
        const dataStr = await streamToString(stream);
        return NextResponse.json(JSON.parse(dataStr));
      } catch (e: any) {
        return NextResponse.json({ error: "画板未找到或已被删除" }, { status: 404 });
      }
    }

    // B. 获取全量画板列表
    const objectsStream = minioClient.listObjectsV2(BUCKET, "scenes/", true);
    const boards: any[] = [];

    for await (const obj of objectsStream) {
      if (!obj.name || !obj.name.endsWith(".json")) continue;
      try {
        const stream = await minioClient.getObject(BUCKET, obj.name);
        const dataStr = await streamToString(stream);
        const content = JSON.parse(dataStr);
        boards.push({
          boardId: content.boardId || obj.name.replace("scenes/", "").replace(".json", ""),
          name: content.name || "未命名草图",
          updatedAt: content.updatedAt || obj.lastModified,
          elementCount: content.data?.elements?.length || 0,
        });
      } catch (e) {
        console.warn(`读取画板 ${obj.name} 失败:`, e);
      }
    }

    boards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ boards });
  } catch (error: any) {
    console.error("[/api/scenes] GET 异常:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST: 保存 / 更新画板与 1:N 会话数据
export async function POST(req: Request) {
  try {
    const minioClient = getMinioClient();
    await ensureBucket(minioClient);
    const { boardId, name, data } = await req.json();

    if (!boardId) {
      return NextResponse.json({ error: "boardId 不能为空" }, { status: 400 });
    }

    const payload = {
      boardId,
      name: name || "未命名草图",
      updatedAt: new Date().toISOString(),
      data: data || { elements: [], appState: {}, threads: [] },
    };

    const objectName = `scenes/${boardId}.json`;
    const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");

    await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
      "Content-Type": "application/json",
    });

    return NextResponse.json({ success: true, boardId, name: payload.name });
  } catch (error: any) {
    console.error("[/api/scenes] POST 异常:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 3. DELETE: 删除画板
export async function DELETE(req: Request) {
  try {
    const minioClient = getMinioClient();
    await ensureBucket(minioClient);
    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json({ error: "缺少 boardId 参数" }, { status: 400 });
    }

    const objectName = `scenes/${boardId}.json`;
    await minioClient.removeObject(BUCKET, objectName);

    return NextResponse.json({ success: true, message: `草图 ${boardId} 已删除` });
  } catch (error: any) {
    console.error("[/api/scenes] DELETE 异常:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}