"use client";

import { readJsonResponseSafe } from "@/lib/media-utils";

export type UploadBucket =
  | "bulletins"
  | "resources"
  | "gallery"
  | "profiles"
  | "notices";

export interface UploadedAssetInfo {
  readonly url: string;
  readonly fileName: string;
  readonly sizeLabel: string;
}

interface PresignResponse {
  readonly mode?: "signed" | "local";
  readonly signedPutUrl?: string;
  readonly publicUrl?: string;
  readonly storedName?: string;
  readonly bucket?: string;
  readonly ext?: string;
  readonly contentType?: string;
  readonly fileName?: string;
  readonly sizeLabel?: string;
  readonly error?: string;
}

const MAX_IMAGE_DIMENSION = 2560;
const AUTO_COMPRESS_THRESHOLD_BYTES = 3.2 * 1024 * 1024; // 3.2 MB

function getLowerExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function replaceFileExtension(fileName: string, newExt: string): string {
  const idx = fileName.lastIndexOf(".");
  const stem = idx >= 0 ? fileName.slice(0, idx) : fileName;
  return `${stem || "photo"}${newExt}`;
}

async function decodeAndTranscodeToJpeg(
  file: File,
  maxDimension: number,
  quality: number
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
      el.src = objectUrl;
    });

    const natW = img.naturalWidth || img.width || 1;
    const natH = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(natW, natH));
    const targetW = Math.max(1, Math.round(natW * scale));
    const targetH = Math.max(1, Math.round(natH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CANVAS_INIT_FAILED");
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((res) => resolve(res), "image/jpeg", quality);
    });
    if (!blob) {
      throw new Error("CANVAS_BLOB_FAILED");
    }

    const nextName = replaceFileExtension(file.name, ".jpg");
    return new File([blob], nextName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareUploadFile(file: File): Promise<File> {
  const ext = getLowerExtension(file.name);
  const mime = (file.type || "").toLowerCase();

  // 1. iPhone HEIC / HEIF camera originals -> convert to standard JPEG on-device
  const isHeic =
    ext === ".heic" ||
    ext === ".heif" ||
    mime === "image/heic" ||
    mime === "image/heif";

  if (isHeic) {
    try {
      return await decodeAndTranscodeToJpeg(file, MAX_IMAGE_DIMENSION, 0.88);
    } catch {
      throw new Error(
        "HEIC 사진 변환을 지원하지 않는 브라우저입니다. 아이폰 사파리에서 업로드하거나 JPG/PNG 형식으로 올려 주세요."
      );
    }
  }

  // 2. Missing extension on mobile camera capture (e.g. "image" with type image/jpeg or video/quicktime)
  let normalizedFile = file;
  if (!ext) {
    if (mime === "image/jpeg") {
      normalizedFile = new File([file], `${file.name || "photo"}.jpg`, {
        type: "image/jpeg",
      });
    } else if (mime === "image/png") {
      normalizedFile = new File([file], `${file.name || "photo"}.png`, {
        type: "image/png",
      });
    } else if (mime === "image/webp") {
      normalizedFile = new File([file], `${file.name || "photo"}.webp`, {
        type: "image/webp",
      });
    } else if (mime === "video/quicktime") {
      normalizedFile = new File([file], `${file.name || "video"}.mov`, {
        type: "video/quicktime",
      });
    } else if (mime === "video/mp4") {
      normalizedFile = new File([file], `${file.name || "video"}.mp4`, {
        type: "video/mp4",
      });
    }
  }

  // 3. Optimize very large camera JPEG/WEBP photos (> 3.2 MB) for fast mobile cellular upload
  const finalExt = getLowerExtension(normalizedFile.name);
  const isLargePhoto =
    (finalExt === ".jpg" || finalExt === ".jpeg" || finalExt === ".webp") &&
    normalizedFile.size > AUTO_COMPRESS_THRESHOLD_BYTES;

  if (isLargePhoto) {
    try {
      return await decodeAndTranscodeToJpeg(
        normalizedFile,
        MAX_IMAGE_DIMENSION,
        0.88
      );
    } catch {
      return normalizedFile;
    }
  }

  return normalizedFile;
}

export async function uploadAssetClient(
  rawFile: File,
  bucket: UploadBucket
): Promise<UploadedAssetInfo> {
  const file = await prepareUploadFile(rawFile);

  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sign",
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
      bucket,
    }),
  });

  const presignData = await readJsonResponseSafe<PresignResponse>(
    presignRes,
    `${file.name} 업로드 준비에 실패했습니다.`
  );

  if (!presignRes.ok || presignData.error) {
    throw new Error(
      presignData.error ?? `${file.name} 업로드 준비에 실패했습니다.`
    );
  }

  // Cloud Direct Signed Upload (bypasses Vercel 4.5 MB serverless payload ceiling; supports up to 50 MB)
  if (
    presignData.mode === "signed" &&
    presignData.signedPutUrl &&
    presignData.publicUrl &&
    presignData.storedName &&
    presignData.bucket &&
    presignData.ext
  ) {
    const putRes = await fetch(presignData.signedPutUrl, {
      method: "PUT",
      headers: {
        "Content-Type": presignData.contentType || "application/octet-stream",
      },
      body: file,
    });

    if (!putRes.ok) {
      throw new Error(
        `${file.name} 클라우드 전송에 실패했습니다 (HTTP ${putRes.status}).`
      );
    }

    const verifyRes = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "verify",
        bucket: presignData.bucket,
        storedName: presignData.storedName,
        ext: presignData.ext,
      }),
    });
    const verifyData = await readJsonResponseSafe<{
      readonly ok?: boolean;
      readonly error?: string;
    }>(verifyRes, `${file.name} 파일 검증에 실패했습니다.`);

    if (!verifyRes.ok || verifyData.error) {
      throw new Error(
        verifyData.error ?? `${file.name} 파일 형식 검증에 실패했습니다.`
      );
    }

    return {
      url: presignData.publicUrl,
      fileName: presignData.fileName ?? file.name,
      sizeLabel: presignData.sizeLabel ?? "",
    };
  }

  // Local Dev Fallback (stores in public/uploads/{bucket})
  const formData = new FormData();
  formData.set("file", file);
  formData.set("bucket", bucket);

  const localRes = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const localData = await readJsonResponseSafe<
    UploadedAssetInfo & { readonly error?: string }
  >(localRes, `${file.name} 업로드에 실패했습니다.`);

  if (!localRes.ok || localData.error || !localData.url) {
    throw new Error(localData.error ?? `${file.name} 업로드에 실패했습니다.`);
  }

  return {
    url: localData.url,
    fileName: localData.fileName,
    sizeLabel: localData.sizeLabel,
  };
}
