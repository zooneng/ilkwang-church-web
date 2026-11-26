import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
  getAuthConfigStatus,
  normalizeLoginRole,
  verifyAccountCredentials,
} from "@/lib/admin-auth";
import {
  checkRateLimit,
  getClientIp,
  verifySameOriginRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function POST(request: Request) {
  const originDenied = verifySameOriginRequest(request);
  if (originDenied) {
    return originDenied;
  }

  const clientIp = getClientIp(request);

  try {
    const body = (await request.json()) as {
      readonly account?: string;
      readonly password?: string;
    };
    const requestedRole = normalizeLoginRole(body.account);
    const password = typeof body.password === "string" ? body.password : "";

    const config = getAuthConfigStatus();

    // Local development without configured passwords: issue role-scoped session cleanly
    if (!config.authRequired) {
      const token = createAdminSessionToken(requestedRole);
      const response = NextResponse.json({
        ok: true,
        devBypass: true,
        role: requestedRole,
        redirectTo:
          requestedRole === "photo_admin" ? "/admin/photos" : "/admin",
      });
      response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: token,
        httpOnly: true,
        sameSite: "strict",
        secure: false,
        path: "/",
        maxAge: ADMIN_SESSION_TTL_SECONDS,
      });
      return response;
    }

    if (requestedRole === "site_admin" && !config.siteAdminConfigured) {
      return NextResponse.json(
        {
          error:
            "서버 환경변수(ADMIN_PASSWORD)가 아직 설정되지 않았습니다. Vercel 환경 설정에서 등록해 주세요.",
        },
        { status: 503 }
      );
    }

    if (requestedRole === "photo_admin" && !config.photoAdminConfigured) {
      return NextResponse.json(
        {
          error:
            "사진 업로드 전용 비밀번호(PHOTO_ADMIN_PASSWORD)가 아직 설정되지 않았습니다. Vercel 환경 설정에서 등록해 주세요.",
        },
        { status: 503 }
      );
    }

    const verifiedRole = verifyAccountCredentials(requestedRole, password);
    if (!verifiedRole) {
      await delay(280);
      const limit = checkRateLimit({
        bucket: "admin-login-fail",
        key: clientIp,
        maxRequests: MAX_FAILED_ATTEMPTS,
        windowMs: LOGIN_WINDOW_MS,
      });
      if (!limit.allowed) {
        return NextResponse.json(
          {
            error: `비밀번호 입력 오류가 반복되어 보안을 위해 잠시 잠겼습니다. ${Math.ceil(
              limit.retryAfterSeconds / 60
            )}분 뒤에 다시 시도해 주세요.`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(limit.retryAfterSeconds) },
          }
        );
      }
      return NextResponse.json(
        {
          error:
            requestedRole === "photo_admin"
              ? "사진 업로드 전용 계정 비밀번호가 일치하지 않습니다."
              : "사이트 관리자 비밀번호가 일치하지 않습니다.",
        },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken(verifiedRole);
    const response = NextResponse.json({
      ok: true,
      role: verifiedRole,
      redirectTo: verifiedRole === "photo_admin" ? "/admin/photos" : "/admin",
    });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "로그인 요청을 처리하지 못했습니다." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const originDenied = verifySameOriginRequest(request);
  if (originDenied) {
    return originDenied;
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
