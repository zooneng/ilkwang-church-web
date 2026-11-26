import { NextResponse } from "next/server";
import { requireSiteAdminRequest } from "@/lib/admin-auth";
import {
  createInquiry,
  deleteInquiry,
  listInquiries,
  updateInquiry,
} from "@/lib/operations-store";
import {
  checkRateLimit,
  getClientIp,
  sanitizePlainText,
  verifySameOriginRequest,
} from "@/lib/security";
import type { InquiryCategory } from "@/types/site-content";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = new Set<InquiryCategory>([
  "새가족 등록",
  "예배·교회 문의",
  "심방·기도 요청",
  "시설·행정 문의",
]);

export async function GET(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const inquiries = await listInquiries();
    return NextResponse.json({ inquiries });
  } catch {
    return NextResponse.json(
      { error: "문의 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const originDenied = verifySameOriginRequest(request);
  if (originDenied) return originDenied;

  const limit = checkRateLimit({
    bucket: "inquiries-post",
    key: getClientIp(request),
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          "단시간에 많은 문의가 접수되었습니다. 잠시 후 다시 시도하시거나 교회 사무실(02-927-0691)로 연락해 주세요.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = (await request.json()) as {
      readonly category?: InquiryCategory;
      readonly name?: string;
      readonly contact?: string;
      readonly title?: string;
      readonly message?: string;
      readonly website?: string;
    };

    // Anti-bot honeypot field check
    if (typeof body.website === "string" && body.website.trim().length > 0) {
      return NextResponse.json(
        { error: "비정상적인 자동화 요청이 차단되었습니다." },
        { status: 400 }
      );
    }

    const name = sanitizePlainText(body.name, 60);
    const contact = sanitizePlainText(body.contact, 100);
    const title = sanitizePlainText(body.title, 150);
    const message = sanitizePlainText(body.message, 3000);

    if (!name || !contact || !title || !message) {
      return NextResponse.json(
        { error: "성함, 연락처, 제목, 문의 내용을 모두 입력해 주세요." },
        { status: 400 }
      );
    }

    const category: InquiryCategory =
      body.category && ALLOWED_CATEGORIES.has(body.category)
        ? body.category
        : "예배·교회 문의";

    const created = await createInquiry({
      category,
      name,
      contact,
      title,
      message,
    });

    return NextResponse.json({ inquiry: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "문의 접수 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as {
      readonly id?: string;
      readonly status?: "접수대기" | "연락완료";
      readonly adminMemo?: string;
    };
    const id = sanitizePlainText(body.id, 120);
    if (!id) {
      return NextResponse.json(
        { error: "문의 ID가 필요합니다." },
        { status: 400 }
      );
    }
    const adminMemo =
      body.adminMemo !== undefined
        ? sanitizePlainText(body.adminMemo, 1000)
        : undefined;
    const status =
      body.status === "접수대기" || body.status === "연락완료"
        ? body.status
        : undefined;
    const inquiries = await updateInquiry(id, { status, adminMemo });
    return NextResponse.json({ inquiries });
  } catch {
    return NextResponse.json(
      { error: "문의 상태 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const id = sanitizePlainText(searchParams.get("id"), 120);
    if (!id) {
      return NextResponse.json(
        { error: "삭제할 문의 ID가 필요합니다." },
        { status: 400 }
      );
    }
    const inquiries = await deleteInquiry(id);
    return NextResponse.json({ inquiries });
  } catch {
    return NextResponse.json(
      { error: "문의 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
