import { NextResponse } from "next/server";
import crypto from "crypto";
import * as Minio from "minio";
import { signToken, getCurrentUser } from "@/lib/auth";

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

// 确保默认管理员与默认项目初始化
async function getSystemUsers(client: Minio.Client) {
  const adminName = (process.env.ADMIN_USERNAME || "admin").trim();
  const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();
  const objectName = "system/users.json";

  let users: any[] = [];
  try {
    const stream = await client.getObject(BUCKET, objectName);
    users = JSON.parse(await streamToString(stream));
  } catch {}

  let admin = users.find((u) => u.username.toLowerCase() === adminName.toLowerCase());
  if (!admin) {
    admin = {
      userId: `u_${crypto.createHash("md5").update(adminName.toLowerCase()).digest("hex").slice(0, 10)}`,
      username: adminName,
      password: adminPass,
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    users.unshift(admin);
    const buf = Buffer.from(JSON.stringify(users, null, 2), "utf-8");
    await client.putObject(BUCKET, objectName, buf, buf.length, { "Content-Type": "application/json" });

    // 初始化管理员的默认项目
    const defaultProjBuf = Buffer.from(
      JSON.stringify({ projects: [{ id: "proj_default", name: "默认项目", createdAt: new Date().toISOString() }] }, null, 2),
      "utf-8"
    );
    await client.putObject(BUCKET, `users/${admin.userId}/projects.json`, defaultProjBuf, defaultProjBuf.length, {
      "Content-Type": "application/json",
    });
  }
  return users;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ user });
}

export async function POST(req: Request) {
  try {
    const minio = getMinioClient();
    await ensureBucket(minio);
    const users = await getSystemUsers(minio);

    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "用户名或密码不能为空" }, { status: 400 });
    }

    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password).trim();

    const targetUser = users.find((u) => u.username.toLowerCase() === cleanUser);
    if (!targetUser) {
      return NextResponse.json({ error: "用户不存在，请联系管理员分配账号" }, { status: 401 });
    }

    if (targetUser.password !== cleanPass) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    const token = signToken({
      userId: targetUser.userId,
      username: targetUser.username,
      role: targetUser.role || "user",
    });

    const res = NextResponse.json({
      success: true,
      user: {
        userId: targetUser.userId,
        username: targetUser.username,
        role: targetUser.role || "user",
      },
    });

    res.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
      path: "/",
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
  return res;
}