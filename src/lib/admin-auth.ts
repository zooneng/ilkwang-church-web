import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { verifySameOriginRequest } from "@/lib/security";

export type AdminRole = "site_admin" | "photo_admin";

export const ADMIN_SESSION_COOKIE = "ilkwang_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export function isSiteAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function isPhotoAdminPasswordConfigured(): boolean {
  return Boolean(process.env.PHOTO_ADMIN_PASSWORD?.trim());
}

export function isAuthRequired(): boolean {
  return (
    isSiteAdminPasswordConfigured() ||
    isPhotoAdminPasswordConfigured() ||
    process.env.NODE_ENV === "production"
  );
}

export function getAuthConfigStatus(): {
  readonly authRequired: boolean;
  readonly siteAdminConfigured: boolean;
  readonly photoAdminConfigured: boolean;
} {
  return {
    authRequired: isAuthRequired(),
    siteAdminConfigured: isSiteAdminPasswordConfigured(),
    photoAdminConfigured: isPhotoAdminPasswordConfigured(),
  };
}

function getRoleConfiguredPassword(role: AdminRole): string | null {
  if (role === "site_admin") {
    const val = process.env.ADMIN_PASSWORD?.trim();
    return val ? val : null;
  }
  const val = process.env.PHOTO_ADMIN_PASSWORD?.trim();
  return val ? val : null;
}

function getRoleSigningKey(role: AdminRole): string | null {
  if (!isAuthRequired()) {
    return `dev-local-key:${role}`;
  }
  const rolePassword = getRoleConfiguredPassword(role);
  if (!rolePassword) {
    return null;
  }
  const baseSecret =
    process.env.ADMIN_SESSION_SECRET?.trim() || "ilkwang-session-v2-default";
  return createHmac("sha256", baseSecret)
    .update(`${role}:${rolePassword}`)
    .digest("hex");
}

function constantTimeMatch(candidate: string, expected: string | null): boolean {
  const safeCandidate = candidate || "";
  const safeExpected = expected ?? "__unconfigured_ilkwang_secret__";
  const a = createHmac("sha256", "ilkwang-pwd-compare-v2")
    .update(safeCandidate)
    .digest();
  const b = createHmac("sha256", "ilkwang-pwd-compare-v2")
    .update(safeExpected)
    .digest();
  const matched = timingSafeEqual(a, b);
  return Boolean(expected && candidate && matched);
}

export function normalizeLoginRole(rawAccount: string | undefined): AdminRole {
  const normalized = (rawAccount ?? "").trim().toLowerCase();
  if (
    normalized === "photo" ||
    normalized === "photo_admin" ||
    normalized === "gallery" ||
    normalized === "사진"
  ) {
    return "photo_admin";
  }
  return "site_admin";
}

export function verifyAccountCredentials(
  accountOrRole: string | undefined,
  password: string
): AdminRole | null {
  const targetRole = normalizeLoginRole(accountOrRole);
  const siteMatched = constantTimeMatch(
    password,
    getRoleConfiguredPassword("site_admin")
  );
  const photoMatched = constantTimeMatch(
    password,
    getRoleConfiguredPassword("photo_admin")
  );

  if (targetRole === "site_admin") {
    return siteMatched ? "site_admin" : null;
  }
  if (photoMatched) {
    return "photo_admin";
  }
  return null;
}

export function createAdminSessionToken(role: AdminRole): string {
  const signingKey = getRoleSigningKey(role);
  if (!signingKey) {
    throw new Error(
      role === "site_admin"
        ? "ADMIN_PASSWORD 환경변수가 설정되지 않았습니다."
        : "PHOTO_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다."
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + ADMIN_SESSION_TTL_SECONDS;
  const nonce = randomBytes(8).toString("hex");
  const payload = `v2.${role}.${nowSec}.${exp}.${nonce}`;
  const signature = createHmac("sha256", signingKey)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionTokenRole(
  token: string | undefined | null
): AdminRole | null {
  if (!token) {
    return isAuthRequired() ? null : "site_admin";
  }

  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v2") {
    return isAuthRequired() ? null : "site_admin";
  }

  const rawRole = parts[1];
  if (rawRole !== "site_admin" && rawRole !== "photo_admin") {
    return null;
  }

  const iat = Number(parts[2]);
  const exp = Number(parts[3]);
  const nonce = parts[4] ?? "";
  const providedSigHex = parts[5] ?? "";
  const nowSec = Math.floor(Date.now() / 1000);

  if (
    !Number.isFinite(iat) ||
    !Number.isFinite(exp) ||
    exp <= nowSec ||
    iat > nowSec + 60 ||
    !/^[0-9a-f]{16}$/.test(nonce) ||
    !/^[0-9a-f]{64}$/.test(providedSigHex)
  ) {
    return null;
  }

  const signingKey = getRoleSigningKey(rawRole);
  if (!signingKey) {
    return null;
  }

  const payload = `v2.${rawRole}.${parts[2]}.${parts[3]}.${nonce}`;
  const expectedSig = createHmac("sha256", signingKey).update(payload).digest();
  const providedSig = Buffer.from(providedSigHex, "hex");
  if (expectedSig.length !== providedSig.length) {
    return null;
  }
  return timingSafeEqual(expectedSig, providedSig) ? rawRole : null;
}

function extractCookieFromHeader(
  cookieHeader: string | null,
  cookieName: string
): string | null {
  if (!cookieHeader) return null;
  for (const segment of cookieHeader.split(";")) {
    const trimmed = segment.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (key === cookieName) {
      try {
        return decodeURIComponent(trimmed.slice(eqIdx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getRequestAdminRole(request: Request): AdminRole | null {
  const token = extractCookieFromHeader(
    request.headers.get("cookie"),
    ADMIN_SESSION_COOKIE
  );
  return verifySessionTokenRole(token);
}

export function requireSiteAdminRequest(request: Request): NextResponse | null {
  const originDenied = verifySameOriginRequest(request);
  if (originDenied) {
    return originDenied;
  }

  const role = getRequestAdminRole(request);
  if (role === "site_admin") {
    return null;
  }
  if (role === "photo_admin") {
    return NextResponse.json(
      {
        error:
          "사진 업로드 전용 계정으로는 접근할 수 없는 기능입니다. 사이트 관리자 계정(admin)으로 로그인해 주세요.",
      },
      { status: 403 }
    );
  }
  return NextResponse.json(
    {
      error: isSiteAdminPasswordConfigured()
        ? "사이트 관리자 로그인이 필요합니다."
        : "운영 서버에 ADMIN_PASSWORD 환경변수가 아직 설정되지 않았습니다.",
    },
    { status: 401 }
  );
}

export function requireGalleryUploadRequest(request: Request): {
  readonly denied: NextResponse | null;
  readonly role: AdminRole | null;
} {
  const originDenied = verifySameOriginRequest(request);
  if (originDenied) {
    return { denied: originDenied, role: null };
  }

  const role = getRequestAdminRole(request);
  if (role === "site_admin" || role === "photo_admin") {
    return { denied: null, role };
  }
  return {
    denied: NextResponse.json(
      {
        error:
          isSiteAdminPasswordConfigured() || isPhotoAdminPasswordConfigured()
            ? "사진 업로드는 관리자 또는 사진 업로드 전용 계정으로 로그인한 뒤 이용할 수 있습니다."
            : "운영 서버에 관리자 비밀번호 환경변수가 아직 설정되지 않았습니다.",
      },
      { status: 401 }
    ),
    role: null,
  };
}
