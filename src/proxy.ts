import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  isAuthRequired,
  verifySessionTokenRole,
} from "@/lib/admin-auth";

function withPrivateAdminHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "no-store, private, max-age=0");
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/login") {
    return withPrivateAdminHeaders(NextResponse.next());
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const role = verifySessionTokenRole(token);

  if (!isAuthRequired()) {
    if (
      role === "photo_admin" &&
      pathname !== "/admin/photos" &&
      !pathname.startsWith("/admin/photos/")
    ) {
      return withPrivateAdminHeaders(
        NextResponse.redirect(new URL("/admin/photos", request.url))
      );
    }
    return withPrivateAdminHeaders(NextResponse.next());
  }

  const isPhotoStudioRoute =
    pathname === "/admin/photos" || pathname.startsWith("/admin/photos/");

  if (isPhotoStudioRoute) {
    if (role === "site_admin" || role === "photo_admin") {
      return withPrivateAdminHeaders(NextResponse.next());
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("role", "photo");
    loginUrl.searchParams.set("next", "/admin/photos");
    return withPrivateAdminHeaders(NextResponse.redirect(loginUrl));
  }

  if (role === "site_admin") {
    return withPrivateAdminHeaders(NextResponse.next());
  }

  if (role === "photo_admin") {
    return withPrivateAdminHeaders(
      NextResponse.redirect(new URL("/admin/photos", request.url))
    );
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("next", nextPath);
  return withPrivateAdminHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
