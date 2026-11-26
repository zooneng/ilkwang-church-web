import { NextResponse } from "next/server";

interface RateLimitBucketEntry {
  readonly timestamps: readonly number[];
}

const rateLimitStore = new Map<string, RateLimitBucketEntry>();
const MAX_TRACKED_KEYS = 5000;

function pruneRateLimitStore(now: number, maxWindowMs: number): void {
  if (rateLimitStore.size <= MAX_TRACKED_KEYS) {
    return;
  }
  const cutoff = now - maxWindowMs;
  for (const [key, entry] of rateLimitStore.entries()) {
    const fresh = entry.timestamps.filter((ts) => ts > cutoff);
    if (fresh.length === 0) {
      rateLimitStore.delete(key);
    } else if (fresh.length !== entry.timestamps.length) {
      rateLimitStore.set(key, { timestamps: fresh });
    }
  }
  if (rateLimitStore.size > MAX_TRACKED_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey !== undefined) {
      rateLimitStore.delete(oldestKey);
    }
  }
}

export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 80);
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 80);
    }
  }
  return "local";
}

export function checkRateLimit(options: {
  readonly bucket: string;
  readonly key: string;
  readonly maxRequests: number;
  readonly windowMs: number;
}): { readonly allowed: boolean; readonly retryAfterSeconds: number } {
  const now = Date.now();
  pruneRateLimitStore(now, Math.max(options.windowMs, 15 * 60 * 1000));

  const compositeKey = `${options.bucket}:${options.key}`;
  const cutoff = now - options.windowMs;
  const current = rateLimitStore.get(compositeKey)?.timestamps ?? [];
  const active = current.filter((ts) => ts > cutoff);

  if (active.length >= options.maxRequests) {
    const earliest = active[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((earliest + options.windowMs - now) / 1000)
    );
    rateLimitStore.set(compositeKey, { timestamps: active });
    return { allowed: false, retryAfterSeconds };
  }

  rateLimitStore.set(compositeKey, { timestamps: [...active, now] });
  return { allowed: true, retryAfterSeconds: 0 };
}

function normalizeHostValue(raw: string): string {
  return raw.split(",")[0]!.trim().toLowerCase();
}

export function verifySameOriginRequest(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const expectedHostRaw =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!expectedHostRaw) {
    return null;
  }
  const expectedHost = normalizeHostValue(expectedHostRaw);

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host.toLowerCase();
      if (originHost === expectedHost) {
        return null;
      }
    } catch {
      // Invalid Origin header falls through to rejection
    }
    return NextResponse.json(
      { error: "허용되지 않은 외부 출처(Origin) 요청이 차단되었습니다." },
      { status: 403 }
    );
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    try {
      const refererHost = new URL(refererHeader).host.toLowerCase();
      if (refererHost === expectedHost) {
        return null;
      }
    } catch {
      // Invalid Referer header falls through to rejection
    }
    return NextResponse.json(
      { error: "허용되지 않은 외부 참조(Referer) 요청이 차단되었습니다." },
      { status: 403 }
    );
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "출처 확인 헤더(Origin)가 없는 변경 요청이 차단되었습니다." },
      { status: 403 }
    );
  }

  return null;
}

export function sanitizePlainText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") {
    return "";
  }
  return input
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}
