import path from "node:path";
import { NextResponse } from "next/server";
import { requireSiteAdminRequest } from "@/lib/admin-auth";
import { parseBulletinFileBuffer } from "@/lib/hwp-parser";

export const dynamic = "force-dynamic";

const SUPPORTED_PARSE_EXTS = new Set([".hwp", ".hwpx", ".docx", ".txt"]);
const MAX_PARSE_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const formData = await request.formData();
    const rawFile = formData.get("file");

    if (!(rawFile instanceof File)) {
      return NextResponse.json(
        { error: "분석할 한글(.hwp, .hwpx) 파일을 선택해 주세요." },
        { status: 400 }
      );
    }

    if (rawFile.size <= 0 || rawFile.size > MAX_PARSE_BYTES) {
      return NextResponse.json(
        { error: "파일 크기가 비어 있거나 25MB를 초과합니다." },
        { status: 400 }
      );
    }

    const ext = path.extname(rawFile.name).toLowerCase();
    if (!SUPPORTED_PARSE_EXTS.has(ext)) {
      return NextResponse.json(
        {
          error: `자동 본문 추출은 한글(.hwp, .hwpx), 워드(.docx), 텍스트(.txt) 파일에서 지원됩니다 (현재 파일: ${ext || "확장자 없음"}).`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await rawFile.arrayBuffer());
    const parsed = parseBulletinFileBuffer(buffer, rawFile.name);

    return NextResponse.json({ parsed });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "한글 주보 파일 분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
