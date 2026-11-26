import { NextResponse } from "next/server";
import { getRequestAdminRole } from "@/lib/admin-auth";
import { isCloudStoreEnabled, readCloudJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = getRequestAdminRole(request);
  if (role !== "site_admin") {
    return NextResponse.json(
      { error: "사이트 관리자 로그인이 필요합니다." },
      { status: role === "photo_admin" ? 403 : 401 }
    );
  }

  if (!isCloudStoreEnabled()) {
    return NextResponse.json(
      { error: "클라우드 보관소가 연결되어 있지 않습니다." },
      { status: 404 }
    );
  }

  const archived = await readCloudJson<Record<string, unknown>>("legacy-archive");
  if (!archived.found || !archived.value) {
    return NextResponse.json(
      { error: "보관된 구 홈페이지 아카이브 데이터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const body = `${JSON.stringify(archived.value, null, 2)}\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="ilkwang-legacy-archive.json"',
      "Cache-Control": "no-store",
    },
  });
}
