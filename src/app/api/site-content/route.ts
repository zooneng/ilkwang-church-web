import { NextResponse } from "next/server";
import {
  getRequestAdminRole,
  requireSiteAdminRequest,
} from "@/lib/admin-auth";
import {
  getSiteContent,
  resetSiteContent,
  saveSiteContent,
} from "@/lib/content-store";
import type { SiteContent } from "@/types/site-content";

export const dynamic = "force-dynamic";

const TOP_LEVEL_ARRAY_KEYS = [
  "navigation",
  "topBannerNotices",
  "history",
  "staff",
  "worshipSchedule",
  "youthDepartments",
  "sermons",
  "notices",
  "bulletins",
  "events",
  "offeringAccounts",
  "gallery",
  "resources",
  "communityPosts",
] as const satisfies readonly (keyof SiteContent)[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePublicSiteContent(content: SiteContent): SiteContent {
  return {
    ...content,
    offeringAccounts: content.offeringAccounts.filter(
      (acc) => !acc.accountNumber.includes("000-00")
    ),
    staff: content.staff.filter((p) => p.name.trim() !== "새 교역자"),
    pastorProfile: {
      ...content.pastorProfile,
      education: content.pastorProfile.education.filter(
        (line) =>
          !line.includes("[관리자 모드") && !line.includes("[확인 필요]")
      ),
      career: content.pastorProfile.career.filter(
        (item) =>
          !item.label.includes("[관리자 모드") &&
          !item.label.includes("[확인 필요]")
      ),
      bioNotice: "",
    },
  };
}

export async function GET(request: Request) {
  try {
    const content = await getSiteContent();
    const role = getRequestAdminRole(request);
    if (role === "site_admin") {
      return NextResponse.json(content);
    }
    return NextResponse.json(sanitizePublicSiteContent(content));
  } catch {
    return NextResponse.json(
      { error: "사이트 콘텐츠를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as Partial<SiteContent>;
    if (
      !isPlainObject(body) ||
      !isPlainObject(body.churchInfo) ||
      !isPlainObject(body.pastorProfile)
    ) {
      return NextResponse.json(
        {
          error:
            "유효하지 않은 콘텐츠 형식입니다. churchInfo 및 pastorProfile 객체가 필요합니다.",
        },
        { status: 400 }
      );
    }

    for (const key of TOP_LEVEL_ARRAY_KEYS) {
      const candidate = body[key];
      if (candidate !== undefined && !Array.isArray(candidate)) {
        return NextResponse.json(
          { error: `유효하지 않은 콘텐츠 형식입니다: '${key}' 항목은 배열이어야 합니다.` },
          { status: 400 }
        );
      }
    }

    const current = await getSiteContent();
    const merged: SiteContent = {
      ...current,
      ...body,
      churchInfo: {
        ...current.churchInfo,
        ...body.churchInfo,
      },
      pastorProfile: {
        ...current.pastorProfile,
        ...body.pastorProfile,
      },
    };
    const saved = await saveSiteContent(merged);
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json(
      { error: "사이트 콘텐츠 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { readonly action?: string };
    if (body.action !== "reset") {
      return NextResponse.json(
        { error: "지원하지 않는 요청입니다." },
        { status: 400 }
      );
    }
    const resetData = await resetSiteContent();
    return NextResponse.json(resetData);
  } catch {
    return NextResponse.json(
      { error: "초기 데이터 복원에 실패했습니다." },
      { status: 500 }
    );
  }
}
