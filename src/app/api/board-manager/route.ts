import { NextResponse } from "next/server";
import { requireSiteAdminRequest } from "@/lib/admin-auth";
import {
  bulkDeleteManagedPosts,
  createCustomBoardAndAttachToNav,
  createManagedPost,
  deleteCustomBoardAndDetachFromNav,
  getManagedBoardSummaries,
  moveManagedPosts,
  updateCustomBoardSettings,
  updateManagedPost,
} from "@/lib/boards-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const summaries = await getManagedBoardSummaries();
    return NextResponse.json({ summaries });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "게시판 요약 정보를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "create-board") {
      const result = await createCustomBoardAndAttachToNav({
        parentCategoryId: String(body.parentCategoryId ?? ""),
        title: String(body.title ?? ""),
        subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
        englishLabel:
          typeof body.englishLabel === "string" ? body.englishLabel : undefined,
        slug: typeof body.slug === "string" ? body.slug : undefined,
        allowMemberWrite: Boolean(body.allowMemberWrite),
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "update-board") {
      const slug = typeof body.slug === "string" ? body.slug.trim() : "";
      if (!slug) {
        return NextResponse.json(
          { error: "수정할 게시판 슬러그가 필요합니다." },
          { status: 400 }
        );
      }
      const result = await updateCustomBoardSettings({
        slug,
        title: typeof body.title === "string" ? body.title : undefined,
        subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
        allowMemberWrite:
          typeof body.allowMemberWrite === "boolean"
            ? body.allowMemberWrite
            : undefined,
      });
      return NextResponse.json(result);
    }

    if (action === "delete-board") {
      const slug = typeof body.slug === "string" ? body.slug.trim() : "";
      if (!slug) {
        return NextResponse.json(
          { error: "삭제할 게시판 슬러그가 필요합니다." },
          { status: 400 }
        );
      }
      const result = await deleteCustomBoardAndDetachFromNav(slug);
      return NextResponse.json(result);
    }

    if (action === "create-post") {
      const result = await createManagedPost({
        boardKey: String(body.boardKey ?? ""),
        categoryTag:
          typeof body.categoryTag === "string" ? body.categoryTag : undefined,
        title: String(body.title ?? ""),
        author: typeof body.author === "string" ? body.author : undefined,
        date: typeof body.date === "string" ? body.date : undefined,
        content: String(body.content ?? ""),
        isPinned: Boolean(body.isPinned),
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
        attachmentUrl:
          typeof body.attachmentUrl === "string" ? body.attachmentUrl : undefined,
        attachmentName:
          typeof body.attachmentName === "string"
            ? body.attachmentName
            : undefined,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === "update-post") {
      const result = await updateManagedPost({
        boardKey: String(body.boardKey ?? ""),
        postId: String(body.postId ?? ""),
        categoryTag:
          typeof body.categoryTag === "string" ? body.categoryTag : undefined,
        title: typeof body.title === "string" ? body.title : undefined,
        author: typeof body.author === "string" ? body.author : undefined,
        date: typeof body.date === "string" ? body.date : undefined,
        content: typeof body.content === "string" ? body.content : undefined,
        isPinned:
          typeof body.isPinned === "boolean" ? body.isPinned : undefined,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
        attachmentUrl:
          typeof body.attachmentUrl === "string" ? body.attachmentUrl : undefined,
        attachmentName:
          typeof body.attachmentName === "string"
            ? body.attachmentName
            : undefined,
      });
      return NextResponse.json(result);
    }

    if (action === "bulk-delete-posts") {
      const postIds = Array.isArray(body.postIds)
        ? body.postIds.filter((v): v is string => typeof v === "string")
        : [];
      const result = await bulkDeleteManagedPosts({
        boardKey: String(body.boardKey ?? ""),
        postIds,
      });
      return NextResponse.json(result);
    }

    if (action === "move-posts") {
      const postIds = Array.isArray(body.postIds)
        ? body.postIds.filter((v): v is string => typeof v === "string")
        : [];
      const result = await moveManagedPosts({
        sourceBoardKey: String(body.sourceBoardKey ?? ""),
        targetBoardKey: String(body.targetBoardKey ?? ""),
        postIds,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: `지원하지 않는 요청 동작입니다: ${action}` },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "게시판 및 게시물 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
