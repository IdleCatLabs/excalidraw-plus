import { NextResponse } from "next/server";
import * as Minio from "minio";

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

export async function GET(req: Request, { params }: { params: { boardId: string } }) {
  try {
    const { boardId } = params;
    const minio = getMinioClient();
    const objectName = `public_shares/${boardId}.json`;

    const stream = await minio.getObject(BUCKET, objectName);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);

    const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "未找到该分享草图或已被作者删除" }, { status: 404 });
  }
}