import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthCookie } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const ok = await verifyAuthCookie(cookie, process.env.TEAM_PASSWORD);
  if (ok) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const from = request.nextUrl.pathname + request.nextUrl.search;
  if (from !== "/") loginUrl.searchParams.set("from", from);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon\\.ico|logo\\.png).*)"],
};
