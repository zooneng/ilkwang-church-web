export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm"]);

export const GALLERY_MEDIA_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
]);

export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".hwp",
  ".hwpx",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".txt",
  ...GALLERY_MEDIA_EXTENSIONS,
]);

export const ALLOWED_BUCKETS = new Set([
  "bulletins",
  "resources",
  "gallery",
  "profiles",
  "notices",
]);

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeBaseName(nameWithoutExt: string): string {
  const cleaned = nameWithoutExt
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, 48) || "asset";
}

function startsWithBytes(buf: Buffer, sig: readonly number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

const PDF_SIG = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SIG = [0xff, 0xd8, 0xff] as const;
const OLE_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const ZIP_SIG_LOCAL = [0x50, 0x4b, 0x03, 0x04] as const;
const ZIP_SIG_EMPTY = [0x50, 0x4b, 0x05, 0x06] as const;
const ZIP_SIG_SPANNED = [0x50, 0x4b, 0x07, 0x08] as const;
const HWP3_SIG = [0x48, 0x57, 0x50, 0x20, 0x44, 0x6f, 0x63, 0x75] as const;
const WEBM_SIG = [0x1a, 0x45, 0xdf, 0xa3] as const;

const MP4_MOV_ATOMS = new Set([
  "ftyp",
  "moov",
  "mdat",
  "wide",
  "free",
  "skip",
  "pnot",
]);

function isZipContainer(buf: Buffer): boolean {
  return (
    startsWithBytes(buf, ZIP_SIG_LOCAL) ||
    startsWithBytes(buf, ZIP_SIG_EMPTY) ||
    startsWithBytes(buf, ZIP_SIG_SPANNED)
  );
}

export function hasValidMagicBytes(ext: string, buf: Buffer): boolean {
  switch (ext) {
    case ".pdf":
      return startsWithBytes(buf, PDF_SIG);
    case ".png":
      return startsWithBytes(buf, PNG_SIG);
    case ".jpg":
    case ".jpeg":
      return startsWithBytes(buf, JPEG_SIG);
    case ".webp":
      return (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString("ascii") === "RIFF" &&
        buf.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case ".mp4":
    case ".mov":
    case ".m4v": {
      if (buf.length < 8) return false;
      const boxType = buf.subarray(4, 8).toString("ascii");
      return MP4_MOV_ATOMS.has(boxType);
    }
    case ".webm":
      return startsWithBytes(buf, WEBM_SIG);
    case ".hwp":
      return (
        startsWithBytes(buf, OLE_SIG) ||
        startsWithBytes(buf, HWP3_SIG) ||
        isZipContainer(buf)
      );
    case ".doc":
    case ".ppt":
      return startsWithBytes(buf, OLE_SIG);
    case ".hwpx":
    case ".docx":
    case ".pptx":
      return isZipContainer(buf);
    case ".txt": {
      const sample = buf.subarray(0, Math.min(buf.length, 4096));
      if (sample.includes(0x00)) return false;
      const headText = sample.toString("utf8").trimStart().toLowerCase();
      if (
        headText.startsWith("<!doctype html") ||
        headText.startsWith("<html") ||
        headText.startsWith("<script")
      ) {
        return false;
      }
      return true;
    }
    default:
      return false;
  }
}

export function resolveMimeType(ext: string, fallbackType?: string): string {
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".m4v":
      return "video/x-m4v";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".hwp":
      return "application/x-hwp";
    case ".hwpx":
      return "application/hwp+zip";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".ppt":
      return "application/vnd.ms-powerpoint";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return fallbackType || "application/octet-stream";
  }
}
