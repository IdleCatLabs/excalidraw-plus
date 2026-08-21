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

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function ensureBucket(client: Minio.Client) {
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET, "us-east-1");
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const minio = getMinioClient();
    await ensureBucket(minio);
    const objectName = `users/${user.userId}/projects.json`;

    try {
      const stream = await minio.getObject(BUCKET, objectName);
      const data = JSON.parse(await streamToString(stream));
      return NextResponse.json({ projects: data.projects || [] });
    } catch {
      const defaultProjects = [{ id: "proj_default", name: "默认项目", createdAt: new Date().toISOString() }];
      const buffer = Buffer.from(JSON.stringify({ projects: defaultProjects }, null, 2), "utf-8");
      await minio.putObject(BUCKET, objectName, buffer, buffer.length, { "Content-Type": "application/json" });
      return NextResponse.json({ projects: defaultProjects });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const minio = getMinioClient();
    await ensureBucket(minio);
    const { id, name } = await req.json();

    if (!name) return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });

    const objectName = `users/${user.userId}/projects.json`;
    let projects: any[] = [];
    try {
      const stream = await minio.getObject(BUCKET, objectName);
      projects = JSON.parse(await streamToString(stream)).projects || [];
    } catch {}

    const targetId = id || `proj_${Date.now()}`;
    const existsIdx = projects.findIndex((p) => p.id === targetId);

    if (existsIdx >= 0) {
      projects[existsIdx].name = name;
    } else {
      projects.push({ id: targetId, name, createdAt: new Date().toISOString() });
    }

    const buffer = Buffer.from(JSON.stringify({ projects }, null, 2), "utf-8");
    await minio.putObject(BUCKET, objectName, buffer, buffer.length, { "Content-Type": "application/json" });

    return NextResponse.json({ success: true, project: { id: targetId, name } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    const minio = getMinioClient();
    await ensureBucket(minio);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId || projectId === "proj_default") {
      return NextResponse.json({ error: "默认项目不可删除" }, { status: 400 });
    }

    const objectName = `users/${user.userId}/projects.json`;
    let projects: any[] = [];
    try {
      const stream = await minio.getObject(BUCKET, objectName);
      projects = JSON.parse(await streamToString(stream)).projects || [];
    } catch {}

    projects = projects.filter((p) => p.id !== projectId);
    const buffer = Buffer.from(JSON.stringify({ projects }, null, 2), "utf-8");
    await minio.putObject(BUCKET, objectName, buffer, buffer.length, { "Content-Type": "application/json" });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}