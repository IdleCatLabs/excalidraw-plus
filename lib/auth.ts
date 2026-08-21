import { cookies } from "next/headers";
import crypto from "crypto";
import { Role } from "./rbac";

const JWT_SECRET = process.env.JWT_SECRET || "idle-cat-excalidraw-secret-key-2026";
const COOKIE_NAME = "auth_token";

export interface UserSession {
  userId: string;
  username: string;
  role: Role;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, "base64url").toString("utf-8");
}

export function signToken(payload: UserSession): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 }));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): UserSession | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const data = JSON.parse(base64UrlDecode(body));
    if (data.exp && Date.now() > data.exp) return null;

    return { 
      userId: data.userId, 
      username: data.username, 
      role: (data.role as Role) || "user" 
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    const session = verifyToken(token);
    if (session) return session;
  }

  return null;
}