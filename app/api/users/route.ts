import { NextResponse } from "next/server";
import crypto from "crypto";
import * as Minio from "minio";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

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

// 1. GET: 获取团队用户列表 (仅 admin)
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, PERMISSIONS.USER_READ)) {
    return NextResponse.json({ error: "无权访问用户列表" }, { status: 403 });
  }

  try {
    const minio = getMinioClient();
    const stream = await minio.getObject(BUCKET, "system/users.json");
    const users = JSON.parse(await streamToString(stream));

    // 脱敏返回
    const safeUsers = users.map((u: any) => ({
      userId: u.userId,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ users: safeUsers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 2. POST: 管理员添加新成员
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, PERMISSIONS.USER_CREATE)) {
    return NextResponse.json({ error: "只有管理员有权添加成员" }, { status: 403 });
  }

  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "用户名与密码不能为空" }, { status: 400 });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();
    const adminName = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();

    // 核心约束：不允许新建 admin 账号
    if (cleanUser.toLowerCase() === adminName || cleanUser.toLowerCase() === "admin") {
      return NextResponse.json({ error: "不允许新增 admin 账号" }, { status: 400 });
    }

    const minio = getMinioClient();
    const stream = await minio.getObject(BUCKET, "system/users.json");
    const users = JSON.parse(await streamToString(stream));

    if (users.some((u: any) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
      return NextResponse.json({ error: "该用户名已存在" }, { status: 400 });
    }

    const newUserId = `u_${crypto.createHash("md5").update(cleanUser.toLowerCase()).digest("hex").slice(0, 10)}`;
    const newUser = {
      userId: newUserId,
      username: cleanUser,
      password: cleanPass,
      role: "user", // 固定为普通成员
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    const buf = Buffer.from(JSON.stringify(users, null, 2), "utf-8");
    await minio.putObject(BUCKET, "system/users.json", buf, buf.length, { "Content-Type": "application/json" });

    // 自动为新用户创建「默认项目」
    const defaultProjBuf = Buffer.from(
      JSON.stringify({ projects: [{ id: "proj_default", name: "默认项目", createdAt: new Date().toISOString() }] }, null, 2),
      "utf-8"
    );
    await minio.putObject(BUCKET, `users/${newUserId}/projects.json`, defaultProjBuf, defaultProjBuf.length, {
      "Content-Type": "application/json",
    });

    return NextResponse.json({ success: true, user: { userId: newUserId, username: cleanUser, role: "user" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 3. DELETE: 删除团队成员
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, PERMISSIONS.USER_DELETE)) {
    return NextResponse.json({ error: "无权删除成员" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) return NextResponse.json({ error: "缺少 userId" }, { status: 400 });

    const minio = getMinioClient();
    const stream = await minio.getObject(BUCKET, "system/users.json");
    let users = JSON.parse(await streamToString(stream));

    const targetUser = users.find((u: any) => u.userId === targetUserId);
    if (!targetUser) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

    // 核心约束：任何人不允许修改/删除 admin 账号
    if (targetUser.role === "admin" || targetUser.username.toLowerCase() === "admin") {
      return NextResponse.json({ error: "管理员账号不允许删除或修改" }, { status: 403 });
    }

    users = users.filter((u: any) => u.userId !== targetUserId);
    const buf = Buffer.from(JSON.stringify(users, null, 2), "utf-8");
    await minio.putObject(BUCKET, "system/users.json", buf, buf.length, { "Content-Type": "application/json" });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}