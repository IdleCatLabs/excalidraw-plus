import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_token")?.value;

  // 1. 公开白名单路径（无需登录）
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/share") || // 只读分享页完全公开
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/share") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes("favicon.ico");

  // 2. 未登录访问私有页面 -> 强制跳转 /login
  if (!token && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. 已登录访问 /login -> 自动重定向到首页
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，排除静态资源
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};