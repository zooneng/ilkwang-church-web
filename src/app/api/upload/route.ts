import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireGalleryUploadRequest } from "@/lib/admin-auth";
import { isCloudStoreEnabled, uploadToCloudStorage } from "@/lib/cloud-store";
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

export async function POST(request: Request) {
  const { denied, role } = requireGalleryUploadRequest(request);
  if (denied) return denied;

  const limit = checkRateLimit({
    bucket: "file-upload",
    key: getClientIp(request),
    maxRequests: 120,
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

  try {
    const formData = await request.formData();
    const rawFile = formData.get("file");
    const rawBucket = String(formData.get("bucket") ?? "resources");

    if (!(rawFile instanceof File)) {
      return NextResponse.json(
        { error: "업로드할 파일이 선택되지 않았습니다." },
        { status: 400 }
      );
    }

    if (rawFile.size <= 0) {
      return NextResponse.json(
        { error: "빈 파일은 업로드할 수 없습니다." },
        { status: 400 }
      );
    }

    if (rawFile.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "파일 크기는 최대 50MB까지 허용됩니다." },
        { status: 400 }
      );
    }

    const parsedPath = path.parse(path.basename(rawFile.name));
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

    const buffer = Buffer.from(await rawFile.arrayBuffer());
    if (!hasValidMagicBytes(ext, buffer)) {
      return NextResponse.json(
        {
          error: `파일 헤더가 확장자(${ext})와 일치하지 않거나 손상된 파일입니다.`,
        },
        { status: 400 }
      );
    }

    const safeStem = sanitizeBaseName(parsedPath.name);
    const storedName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeStem}${ext}`;

    if (isCloudStoreEnabled()) {
      const publicUrl = await uploadToCloudStorage({
        bucketFolder: bucket,
        storedName,
        buffer,
        contentType: resolveMimeType(ext, rawFile.type),
      });
      return NextResponse.json({
        url: publicUrl,
        fileName: path.basename(rawFile.name),
        sizeLabel: formatFileSize(rawFile.size),
      });
    }

    const targetDir = path.join(process.cwd(), "public", "uploads", bucket);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, storedName), buffer);

    return NextResponse.json({
      url: `/uploads/${bucket}/${storedName}`,
      fileName: path.basename(rawFile.name),
      sizeLabel: formatFileSize(rawFile.size),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "파일 업로드 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
