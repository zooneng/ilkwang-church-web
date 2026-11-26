import { NextResponse } from "next/server";
import {
  getRequestAdminRole,
  requireGalleryUploadRequest,
} from "@/lib/admin-auth";
import {
  addPhotosToAlbum,
  createGalleryAlbum,
  deleteGalleryAlbum,
  deleteLegacyAlbumPhoto,
  getLegacyGalleryData,
  LegacyGalleryInputError,
  normalizeAlbumTags,
  updateLegacyAlbum,
} from "@/lib/legacy-gallery-store";
import { sanitizePlainText } from "@/lib/security";

export const dynamic = "force-dynamic";

const MAX_PHOTOS_PER_REQUEST = 60;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeGalleryImageUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 1024) {
    return false;
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return (
      parsed.hostname.endsWith(".supabase.co") ||
      parsed.hostname === "images.unsplash.com"
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const role = getRequestAdminRole(request);
    const data = await getLegacyGalleryData();
    if (role === "site_admin" || role === "photo_admin") {
      return NextResponse.json(data);
    }
    return NextResponse.json({
      ...data,
      albums: data.albums.filter(
        (album) => album.isVisible && album.photos.length > 0
      ),
    });
  } catch {
    return NextResponse.json(
      { error: "앨범 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { denied } = requireGalleryUploadRequest(request);
  if (denied) return denied;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "유효한 JSON 요청 본문이 필요합니다." },
      { status: 400 }
    );
  }

  if (!isPlainObject(rawBody)) {
    return NextResponse.json(
      { error: "요청 본문은 객체 형식이어야 합니다." },
      { status: 400 }
    );
  }

  const title = sanitizePlainText(rawBody.title, 150);
  const content = sanitizePlainText(rawBody.content, 5000);
  const date = sanitizePlainText(rawBody.date, 30);
  const tags = normalizeAlbumTags(rawBody.tags);
  const rawPhotos = Array.isArray(rawBody.photos)
    ? rawBody.photos.slice(0, MAX_PHOTOS_PER_REQUEST)
    : [];

  const photos = rawPhotos
    .filter(isPlainObject)
    .map((item) => ({
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl.trim() : "",
      caption:
        typeof item.caption === "string"
          ? sanitizePlainText(item.caption, 200)
          : undefined,
    }))
    .filter((item) => isSafeGalleryImageUrl(item.imageUrl));

  try {
    const created = await createGalleryAlbum({
      title,
      content,
      date,
      tags,
      photos,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof LegacyGalleryInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "새 앨범 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { denied } = requireGalleryUploadRequest(request);
  if (denied) return denied;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "유효한 JSON 요청 본문이 필요합니다." },
      { status: 400 }
    );
  }

  if (!isPlainObject(rawBody)) {
    return NextResponse.json(
      { error: "요청 본문은 객체 형식이어야 합니다." },
      { status: 400 }
    );
  }

  const rawAlbumId =
    typeof rawBody.albumId === "string"
      ? rawBody.albumId
      : typeof rawBody.id === "string"
        ? rawBody.id
        : "";
  const albumId = sanitizePlainText(rawAlbumId, 120);
  if (!albumId) {
    return NextResponse.json(
      { error: "대상 앨범 ID(albumId)가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    if (rawBody.action === "delete-photo") {
      const photoId = sanitizePlainText(rawBody.photoId, 120);
      if (!photoId) {
        return NextResponse.json(
          { error: "삭제할 사진 ID(photoId)가 필요합니다." },
          { status: 400 }
        );
      }
      const updated = await deleteLegacyAlbumPhoto(albumId, photoId);
      return NextResponse.json(updated);
    }

    if (rawBody.action === "add-photos") {
      const rawPhotos = Array.isArray(rawBody.photos)
        ? rawBody.photos.slice(0, MAX_PHOTOS_PER_REQUEST)
        : [];
      const photos = rawPhotos
        .filter(isPlainObject)
        .map((item) => ({
          imageUrl:
            typeof item.imageUrl === "string" ? item.imageUrl.trim() : "",
          caption:
            typeof item.caption === "string"
              ? sanitizePlainText(item.caption, 200)
              : undefined,
        }))
        .filter((item) => isSafeGalleryImageUrl(item.imageUrl));
      const updated = await addPhotosToAlbum(albumId, photos);
      return NextResponse.json(updated);
    }

    if (rawBody.action === "delete-album") {
      const updated = await deleteGalleryAlbum(albumId);
      return NextResponse.json(updated);
    }

    if (rawBody.action !== undefined && rawBody.action !== "update-album") {
      return NextResponse.json(
        { error: "지원하지 않는 action 값입니다." },
        { status: 400 }
      );
    }

    let title: string | undefined;
    if (rawBody.title !== undefined) {
      title = sanitizePlainText(rawBody.title, 150);
      if (!title) {
        return NextResponse.json(
          { error: "앨범 제목은 비어 있지 않은 문자열이어야 합니다." },
          { status: 400 }
        );
      }
    }

    let content: string | undefined;
    if (rawBody.content !== undefined) {
      if (typeof rawBody.content !== "string") {
        return NextResponse.json(
          { error: "게시물 본문(content)은 문자열이어야 합니다." },
          { status: 400 }
        );
      }
      content = sanitizePlainText(rawBody.content, 5000);
    }

    let date: string | undefined;
    if (rawBody.date !== undefined) {
      date = sanitizePlainText(rawBody.date, 30);
      if (!date) {
        return NextResponse.json(
          { error: "게시일(date)은 비어 있지 않은 문자열이어야 합니다." },
          { status: 400 }
        );
      }
    }

    let tags: readonly string[] | undefined;
    if (rawBody.tags !== undefined) {
      if (!Array.isArray(rawBody.tags)) {
        return NextResponse.json(
          { error: "태그(tags)는 문자열 배열이어야 합니다." },
          { status: 400 }
        );
      }
      tags = normalizeAlbumTags(rawBody.tags);
    }

    let isVisible: boolean | undefined;
    if (rawBody.isVisible !== undefined) {
      if (typeof rawBody.isVisible !== "boolean") {
        return NextResponse.json(
          { error: "공개 여부(isVisible)는 불리언 값이어야 합니다." },
          { status: 400 }
        );
      }
      isVisible = rawBody.isVisible;
    }

    let coverImageUrl: string | undefined;
    if (rawBody.coverImageUrl !== undefined) {
      if (
        typeof rawBody.coverImageUrl !== "string" ||
        !isSafeGalleryImageUrl(rawBody.coverImageUrl)
      ) {
        return NextResponse.json(
          { error: "유효한 대표 이미지 경로(coverImageUrl)가 필요합니다." },
          { status: 400 }
        );
      }
      coverImageUrl = rawBody.coverImageUrl.trim();
    }

    if (
      title === undefined &&
      content === undefined &&
      date === undefined &&
      tags === undefined &&
      isVisible === undefined &&
      coverImageUrl === undefined
    ) {
      return NextResponse.json(
        { error: "수정할 항목이 최소 1개 이상 필요합니다." },
        { status: 400 }
      );
    }

    const updated = await updateLegacyAlbum(albumId, {
      title,
      content,
      date,
      tags,
      isVisible,
      coverImageUrl,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof LegacyGalleryInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "앨범 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
