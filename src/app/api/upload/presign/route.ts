import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireGalleryUploadRequest } from "@/lib/admin-auth";
import {
  createSignedCloudUploadUrl,
  deleteCloudStorageObject,
  isCloudStoreEnabled,
  readCloudObjectHeadBytes,
} from "@/lib/cloud-store";
import { checkRateLimit, getClientIp } from "@/lib/security";
import {
  ALLOWED_BUCKETS,
  ALLOWED_EXTENSIONS,
  formatFileSize,
  GALLERY_MEDIA_EXTENSIONS,
  hasValidMagicBytes,
  MAX_FILE_BYTES,
  resolveMimeType,
  sanitizeBaseName,
} from "@/lib/upload-validation";

export const dynamic = "force-dynamic";

interface PresignRequestBody {
  readonly action?: "sign" | "verify";
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly contentType?: string;
  readonly bucket?: string;
  readonly storedName?: string;
  readonly ext?: string;
}

export async function POST(request: Request) {
  const { denied, role } = requireGalleryUploadRequest(request);
  if (denied) return denied;

  const limit = checkRateLimit({
    bucket: "file-upload-presign",
    key: getClientIp(request),
    maxRequests: 160,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "단시간에 너무 많은 업로드 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  let body: PresignRequestBody;
  try {
    body = (await request.json()) as PresignRequestBody;
  } catch {
    return NextResponse.json(
      { error: "유효한 업로드 요청 형식이 아닙니다." },
      { status: 400 }
    );
  }

  const action = body.action ?? "sign";

  if (action === "verify") {
    const rawBucket = String(body.bucket ?? "");
    const storedName = String(body.storedName ?? "");
    const ext = String(body.ext ?? "").toLowerCase();

    if (
      !ALLOWED_BUCKETS.has(rawBucket) ||
      !/^[A-Za-z0-9._-]+$/.test(storedName) ||
      !ALLOWED_EXTENSIONS.has(ext)
    ) {
      return NextResponse.json(
        { error: "업로드 검증 파라미터가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (
      role === "photo_admin" &&
      (rawBucket !== "gallery" || !GALLERY_MEDIA_EXTENSIONS.has(ext))
    ) {
      return NextResponse.json(
        { error: "허용되지 않은 업로드 권한입니다." },
        { status: 403 }
      );
    }

    try {
      const headBuf = await readCloudObjectHeadBytes({
        bucketFolder: rawBucket,
        storedName,
        maxBytes: 64,
      });
      if (!hasValidMagicBytes(ext, headBuf)) {
        await deleteCloudStorageObject({
          bucketFolder: rawBucket,
          storedName,
        });
        return NextResponse.json(
          {
            error: `파일 형식이 확장자(${ext})와 일치하지 않거나 손상되어 업로드를 취소했습니다.`,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "업로드된 파일 검증 중 오류가 발생했습니다.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // action === "sign"
  const rawFileName = path.basename(String(body.fileName ?? "").trim());
  const fileSize = Number(body.fileSize ?? 0);
  const rawBucket = String(body.bucket ?? "resources");

  if (!rawFileName) {
    return NextResponse.json(
      { error: "업로드할 파일 이름이 비어 있습니다." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json(
      { error: "빈 파일은 업로드할 수 없습니다." },
      { status: 400 }
    );
  }
  if (fileSize > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "파일 크기는 최대 50MB까지 허용됩니다." },
      { status: 400 }
    );
  }

  const parsedPath = path.parse(rawFileName);
  const ext = parsedPath.ext.toLowerCase();

  if (role === "photo_admin") {
    if (rawBucket !== "gallery") {
      return NextResponse.json(
        {
          error:
            "사진 업로드 전용 계정은 앨범 미디어만 업로드할 수 있습니다.",
        },
        { status: 403 }
      );
    }
    if (!GALLERY_MEDIA_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error:
            "사진 및 동영상 파일(JPG, PNG, WEBP, MP4, MOV)만 업로드할 수 있습니다.",
        },
        { status: 403 }
      );
    }
  }

  const bucket = ALLOWED_BUCKETS.has(rawBucket) ? rawBucket : "resources";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      {
        error: `허용되지 않는 파일 형식(${ext || "없음"})입니다. 사진(JPG, PNG, WEBP), 동영상(MP4, MOV), 문서(PDF, HWP, HWPX, DOCX, PPTX) 파일만 올릴 수 있습니다.`,
      },
      { status: 400 }
    );
  }

  if (!isCloudStoreEnabled()) {
    return NextResponse.json({ mode: "local" });
  }

  try {
    const safeStem = sanitizeBaseName(parsedPath.name);
    const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeStem}${ext}`;
    const resolvedMime = resolveMimeType(ext, body.contentType);
    const signed = await createSignedCloudUploadUrl({
      bucketFolder: bucket,
      storedName,
    });

    return NextResponse.json({
      mode: "signed",
      signedPutUrl: signed.signedPutUrl,
      publicUrl: signed.publicUrl,
      storedName,
      bucket,
      ext,
      contentType: resolvedMime,
      fileName: rawFileName,
      sizeLabel: formatFileSize(fileSize),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "업로드 준비 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
