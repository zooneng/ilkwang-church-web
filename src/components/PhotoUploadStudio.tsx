"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AdminPaginationBar } from "@/components/AdminPaginationBar";
import type { AdminRole } from "@/lib/admin-auth";
import { uploadAssetClient } from "@/lib/client-upload";
import { getKstDateString } from "@/lib/format-utils";
import {
  inferGalleryTagsFromTitle,
  PRESET_GALLERY_TAGS,
} from "@/lib/gallery-tags";
import { isVideoAssetUrl, readJsonResponseSafe } from "@/lib/media-utils";
import type {
  LegacyGalleryAlbum,
  LegacyGalleryStoreData,
} from "@/types/site-content";

interface PhotoUploadStudioProps {
  readonly initialAlbums: readonly LegacyGalleryAlbum[];
  readonly role: AdminRole;
  readonly authRequired: boolean;
}

const ALBUMS_PER_PAGE = 8;

const GALLERY_FILE_ACCEPT =
  "image/*,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.m4v,.webm";

function toggleTagItem(
  current: readonly string[],
  tag: string
): readonly string[] {
  return current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
}

export function PhotoUploadStudio({
  initialAlbums,
  role,
  authRequired,
}: PhotoUploadStudioProps) {
  const router = useRouter();
  const [albums, setAlbums] =
    useState<readonly LegacyGalleryAlbum[]>(initialAlbums);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => getKstDateString());
  const [newSelectedTags, setNewSelectedTags] = useState<readonly string[]>([
    "예배와 절기",
  ]);
  const [tagsManuallyEdited, setTagsManuallyEdited] = useState(false);
  const [newContent, setNewContent] = useState("");

  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<{
    readonly scope: string;
    readonly ok: boolean;
    readonly text: string;
    readonly stamp: number;
  } | null>(null);
  const feedbackSeqRef = useRef(0);

  function showInlineFeedback(scope: string, ok: boolean, text: string) {
    feedbackSeqRef.current += 1;
    const stamp = feedbackSeqRef.current;
    setInlineFeedback({ scope, ok, text, stamp });
    window.setTimeout(() => {
      setInlineFeedback((current) =>
        current && current.stamp === stamp ? null : current
      );
    }, ok ? 6000 : 12000);
  }

  function renderInlineFeedback(scope: string) {
    if (!inlineFeedback || inlineFeedback.scope !== scope) return null;
    return (
      <p
        role={inlineFeedback.ok ? "status" : "alert"}
        className={`text-xs font-bold ${
          inlineFeedback.ok ? "text-[#2E7D32]" : "text-red-700"
        }`}
      >
        {inlineFeedback.ok ? "✓ " : "⚠ "}
        {inlineFeedback.text}
      </p>
    );
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "전체" | "공개중" | "숨김"
  >("전체");
  const [page, setPage] = useState(1);

  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [albumEditDrafts, setAlbumEditDrafts] = useState<
    Record<
      string,
      {
        readonly title: string;
        readonly date: string;
        readonly tags: readonly string[];
        readonly content: string;
      }
    >
  >({});

  const visibleCount = useMemo(
    () => albums.filter((a) => a.isVisible).length,
    [albums]
  );
  const totalPhotosCount = useMemo(
    () => albums.reduce((sum, a) => sum + a.photos.length, 0),
    [albums]
  );

  const filteredAlbums = useMemo(() => {
    const q = searchQuery.trim().replace(/^#+/, "").toLowerCase();
    return albums.filter((album) => {
      if (visibilityFilter === "공개중" && !album.isVisible) return false;
      if (visibilityFilter === "숨김" && album.isVisible) return false;
      if (!q) return true;
      return (
        album.title.toLowerCase().includes(q) ||
        album.date.toLowerCase().includes(q) ||
        (album.content ?? "").toLowerCase().includes(q) ||
        (album.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [albums, searchQuery, visibilityFilter]);

  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredAlbums.length / ALBUMS_PER_PAGE))
  );
  const pagedAlbums = filteredAlbums.slice(
    (safePage - 1) * ALBUMS_PER_PAGE,
    safePage * ALBUMS_PER_PAGE
  );

  async function handleCreateAlbumWithMedia(files: FileList) {
    const title = newTitle.trim();
    if (!title) {
      setErrorMsg("먼저 앨범 제목을 입력한 뒤 사진이나 동영상을 선택해 주세요.");
      showInlineFeedback(
        "new-album",
        false,
        "먼저 앨범 제목을 입력해 주세요."
      );
      return;
    }
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setErrorMsg(null);
    setToastMsg(null);
    try {
      const uploadedPhotos: { imageUrl: string; caption?: string }[] = [];
      for (let i = 0; i < fileList.length; i += 1) {
        const f = fileList[i]!;
        setUploadingStatus(
          `미디어 업로드 중 (${i + 1}/${fileList.length}): ${f.name}`
        );
        const uploaded = await uploadAssetClient(f, "gallery");
        uploadedPhotos.push({ imageUrl: uploaded.url });
      }

      setUploadingStatus("앨범 정보를 저장하는 중...");
      const effectiveTags =
        newSelectedTags.length > 0
          ? [...newSelectedTags]
          : inferGalleryTagsFromTitle(title);

      const response = await fetch("/api/legacy-gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date: newDate || getKstDateString(),
          tags: effectiveTags,
          content: newContent.trim(),
          photos: uploadedPhotos,
        }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "앨범 생성에 실패했습니다.");
      if (!response.ok || !Array.isArray(data.albums)) {
        throw new Error(data.error ?? "앨범 생성에 실패했습니다.");
      }
      setAlbums(data.albums);
      setNewTitle("");
      setNewSelectedTags(["예배와 절기"]);
      setTagsManuallyEdited(false);
      setNewContent("");
      setPage(1);
      setToastMsg(
        `"${title}" 앨범에 ${uploadedPhotos.length}개 항목이 등록되었습니다.`
      );
      showInlineFeedback(
        "new-album",
        true,
        `"${title}" 앨범을 등록했습니다 (${uploadedPhotos.length}개 항목).`
      );
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "앨범 등록 중 오류가 발생했습니다.";
      setErrorMsg(message);
      showInlineFeedback("new-album", false, message);
    } finally {
      setUploadingStatus(null);
    }
  }

  async function handleAddMediaToExistingAlbum(
    album: LegacyGalleryAlbum,
    files: FileList
  ) {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const uploadedPhotos: { imageUrl: string }[] = [];
      for (let i = 0; i < fileList.length; i += 1) {
        const f = fileList[i]!;
        setUploadingStatus(
          `"${album.title}" 추가 중 (${i + 1}/${fileList.length}): ${f.name}`
        );
        const uploaded = await uploadAssetClient(f, "gallery");
        uploadedPhotos.push({ imageUrl: uploaded.url });
      }
      const response = await fetch("/api/legacy-gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: album.id,
          action: "add-photos",
          photos: uploadedPhotos,
        }),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "항목 추가에 실패했습니다.");
      if (!response.ok || !Array.isArray(data.albums)) {
        throw new Error(data.error ?? "항목 추가에 실패했습니다.");
      }
      setAlbums(data.albums);
      setToastMsg(
        `"${album.title}" 앨범에 ${uploadedPhotos.length}개 항목을 추가했습니다.`
      );
      showInlineFeedback(
        `row:${album.id}`,
        true,
        `${uploadedPhotos.length}개 항목을 추가했습니다.`
      );
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "추가 중 오류가 발생했습니다.";
      setErrorMsg(message);
      showInlineFeedback(`row:${album.id}`, false, message);
    } finally {
      setUploadingStatus(null);
    }
  }

  async function handlePatchAlbum(
    payload: Record<string, unknown>,
    successText: string,
    scope?: string
  ) {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const response = await fetch("/api/legacy-gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponseSafe<
        LegacyGalleryStoreData & { readonly error?: string }
      >(response, "앨범 변경에 실패했습니다.");
      if (!response.ok || !Array.isArray(data.albums)) {
        throw new Error(data.error ?? "앨범 변경에 실패했습니다.");
      }
      setAlbums(data.albums);
      if (scope) {
        showInlineFeedback(scope, true, successText);
      } else {
        setToastMsg(successText);
      }
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "요청 처리 중 오류가 발생했습니다.";
      if (scope) {
        showInlineFeedback(scope, false, message);
      } else {
        setErrorMsg(message);
      }
    }
  }

  function openEditAlbum(album: LegacyGalleryAlbum) {
    if (expandedAlbumId === album.id) {
      setExpandedAlbumId(null);
      return;
    }
    setExpandedAlbumId(album.id);
    setAlbumEditDrafts((prev) => ({
      ...prev,
      [album.id]: {
        title: album.title,
        date: album.date,
        tags: Array.isArray(album.tags) ? album.tags : [],
        content: album.content ?? "",
      },
    }));
  }

  return (
    <div className="min-h-screen bg-[#F4F7F5] pb-20">
      {/* Top Banner */}
      <div className="bg-[#1a2744] text-white border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-6 sm:py-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-block px-3 py-0.5 rounded-full bg-[#2E7D32] text-xs font-bold mb-2">
              {role === "photo_admin" ? "사진 업로드 계정" : "사이트 관리자"}
            </span>
            <h1 className="text-xl sm:text-2xl font-black">
              앨범 사진 및 영상 업로드
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === "site_admin" && (
              <Link
                href="/admin?tab=gallery"
                className="px-4 py-2 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold transition-colors"
              >
                관리자 모드 →
              </Link>
            )}
            <Link
              href="/news/gallery"
              className="px-4 py-2 rounded-full border border-white/40 text-white hover:bg-white hover:text-[#1a2744] text-xs sm:text-sm font-bold transition-colors"
            >
              앨범 화면 보기 ↗
            </Link>
            {(authRequired || role === "photo_admin") && (
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/admin-auth", { method: "DELETE" });
                  router.push("/");
                  router.refresh();
                }}
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/25 text-white border border-white/25 text-xs sm:text-sm font-bold transition-colors"
              >
                로그아웃
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-5 sm:pt-6 space-y-6">
        {uploadingStatus && (
          <div className="rounded-xl bg-blue-50 border border-blue-300 px-4 py-3.5 text-sm font-bold text-blue-900">
            {uploadingStatus}
          </div>
        )}
        {toastMsg && (
          <div
            role="status"
            className="rounded-xl bg-[#E8F5E9] border border-[#2E7D32] px-4 py-3.5 flex items-center justify-between gap-3 text-sm font-bold text-[#1B5E20]"
          >
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-xs underline shrink-0"
            >
              닫기
            </button>
          </div>
        )}
        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-300 px-4 py-3.5 text-sm font-bold text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {/* 1. Upload New Album */}
        <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-4 shadow-xs">
          <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
            새 앨범 등록
          </h2>

          <div className="bg-[#F8FAF8] p-4 rounded-xl border border-gray-200 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  앨범 제목 *
                </label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="예: 추수감사주일 예배 및 애찬"
                  value={newTitle}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setNewTitle(nextVal);
                    if (!tagsManuallyEdited && nextVal.trim()) {
                      setNewSelectedTags(inferGalleryTagsFromTitle(nextVal));
                    }
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-bold focus:border-[#2E7D32] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  게시일
                </label>
                <input
                  type="date"
                  aria-label="앨범 게시일"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#2E7D32] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-gray-600 mb-1.5">
                분류 태그 선택 (복수 선택 가능)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_GALLERY_TAGS.map((tag) => {
                  const selected = newSelectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setTagsManuallyEdited(true);
                        setNewSelectedTags((prev) => toggleTagItem(prev, tag));
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        selected
                          ? "bg-[#2E7D32] text-white"
                          : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                앨범 설명 (선택)
              </label>
              <textarea
                rows={3}
                maxLength={5000}
                placeholder="행사 소개나 짧은 인사말을 입력할 수 있습니다."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:border-[#2E7D32] focus:outline-none"
              />
            </div>

            <label
              className={`block w-full sm:w-auto sm:inline-block px-6 py-3 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-black text-center cursor-pointer transition-colors ${
                uploadingStatus ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {uploadingStatus
                ? "업로드 중..."
                : "+ 사진 또는 동영상 선택 후 등록"}
              <input
                type="file"
                multiple
                accept={GALLERY_FILE_ACCEPT}
                className="hidden"
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  await handleCreateAlbumWithMedia(files);
                  e.target.value = "";
                }}
              />
            </label>
            {renderInlineFeedback("new-album")}
          </div>
        </section>

        {/* 2. Manage Existing Albums */}
        <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5 shadow-xs">
          <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
            등록된 앨범 ({albums.length}개, 공개 {visibleCount}개, 총{" "}
            {totalPhotosCount}개)
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAF8] p-3.5 rounded-xl border border-gray-200">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["전체", "공개중", "숨김"] as const).map((vis) => (
                <button
                  key={vis}
                  type="button"
                  onClick={() => {
                    setVisibilityFilter(vis);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    visibilityFilter === vis
                      ? "bg-[#1a2744] text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {vis}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="제목, 날짜, #태그 검색..."
              className="w-full sm:w-72 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            {pagedAlbums.map((album) => {
              const expanded = expandedAlbumId === album.id;
              const draftItem = albumEditDrafts[album.id];
              const coverSrc =
                album.coverImageUrl || album.photos[0]?.imageUrl || "";
              const coverIsVideo = isVideoAssetUrl(coverSrc);

              return (
                <div
                  key={album.id}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-20 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200">
                        {coverSrc &&
                          (coverIsVideo ? (
                            <video
                              src={coverSrc}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={coverSrc}
                              alt={album.title}
                              className="w-full h-full object-cover"
                            />
                          ))}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold ${
                              album.isVisible
                                ? "bg-[#E8F5E9] text-[#2E7D32]"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {album.isVisible ? "공개중" : "숨김"}
                          </span>
                          <span className="text-gray-500">{album.date}</span>
                          <span className="text-gray-400">
                            {album.photos.length}개
                          </span>
                        </div>
                        <p className="font-bold text-sm sm:text-base text-[#1a2744] mt-1 break-keep">
                          {album.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="px-3 py-2 rounded-lg bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold cursor-pointer transition-colors">
                        + 사진 및 영상 추가
                        <input
                          type="file"
                          multiple
                          accept={GALLERY_FILE_ACCEPT}
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            await handleAddMediaToExistingAlbum(album, files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          void handlePatchAlbum(
                            {
                              albumId: album.id,
                              action: "update-album",
                              isVisible: !album.isVisible,
                            },
                            album.isVisible
                              ? `"${album.title}" 앨범을 숨김 처리했습니다.`
                              : `"${album.title}" 앨범을 공개로 전환했습니다.`,
                            `row:${album.id}`
                          )
                        }
                        className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        {album.isVisible ? "숨기기" : "공개하기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditAlbum(album)}
                        className="px-3 py-2 rounded-lg bg-[#1a2744] text-white text-xs font-bold hover:bg-[#2E7D32] transition-colors"
                      >
                        {expanded ? "편집 닫기" : "상세 편집"}
                      </button>
                      {inlineFeedback?.scope === `row:${album.id}` && (
                        <div className="w-full sm:text-right">
                          {renderInlineFeedback(`row:${album.id}`)}
                        </div>
                      )}
                    </div>
                  </div>

                  {expanded && draftItem && (
                    <div className="border-t border-gray-100 bg-[#F8FAF8] p-4 sm:p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          maxLength={150}
                          value={draftItem.title}
                          onChange={(e) =>
                            setAlbumEditDrafts((prev) => ({
                              ...prev,
                              [album.id]: {
                                ...draftItem,
                                title: e.target.value,
                              },
                            }))
                          }
                          placeholder="앨범 제목"
                          className="sm:col-span-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-bold"
                        />
                        <input
                          type="date"
                          value={draftItem.date}
                          onChange={(e) =>
                            setAlbumEditDrafts((prev) => ({
                              ...prev,
                              [album.id]: {
                                ...draftItem,
                                date: e.target.value,
                              },
                            }))
                          }
                          className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <span className="block text-xs font-bold text-gray-600 mb-1.5">
                          분류 태그
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_GALLERY_TAGS.map((tag) => {
                            const selected = draftItem.tags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() =>
                                  setAlbumEditDrafts((prev) => ({
                                    ...prev,
                                    [album.id]: {
                                      ...draftItem,
                                      tags: toggleTagItem(draftItem.tags, tag),
                                    },
                                  }))
                                }
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                  selected
                                    ? "bg-[#2E7D32] text-white"
                                    : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                #{tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        maxLength={5000}
                        value={draftItem.content}
                        onChange={(e) =>
                          setAlbumEditDrafts((prev) => ({
                            ...prev,
                            [album.id]: {
                              ...draftItem,
                              content: e.target.value,
                            },
                          }))
                        }
                        placeholder="앨범 설명 본문 (선택)"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `"${album.title}" 앨범 전체를 삭제하시겠습니까?`
                              )
                            ) {
                              return;
                            }
                            void handlePatchAlbum(
                              { albumId: album.id, action: "delete-album" },
                              `"${album.title}" 앨범을 삭제했습니다.`
                            );
                          }}
                          className="px-3.5 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold"
                        >
                          앨범 전체 삭제
                        </button>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          {renderInlineFeedback(`edit:${album.id}`)}
                          <button
                            type="button"
                            onClick={() =>
                              void handlePatchAlbum(
                                {
                                  albumId: album.id,
                                  action: "update-album",
                                  title: draftItem.title,
                                  date: draftItem.date,
                                  tags: draftItem.tags,
                                  content: draftItem.content,
                                },
                                "앨범 정보를 저장했습니다.",
                                `edit:${album.id}`
                              )
                            }
                            className="px-5 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold"
                          >
                            앨범 정보 저장
                          </button>
                        </div>
                      </div>

                      {/* Media Grid inside Expanded Album */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                        {album.photos.map((photo, idx) => {
                          const isCover = album.coverImageUrl === photo.imageUrl;
                          const isVid = isVideoAssetUrl(photo.imageUrl);
                          return (
                            <div
                              key={photo.id}
                              className="rounded-xl bg-white border border-gray-200 overflow-hidden flex flex-col"
                            >
                              <div className="relative aspect-[4/3] bg-gray-100">
                                {isVid ? (
                                  <video
                                    src={photo.imageUrl}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={photo.imageUrl}
                                    alt={`${album.title} ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                {isVid && (
                                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold">
                                    ▶ 영상
                                  </span>
                                )}
                                {isCover && (
                                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-[#2E7D32] text-white text-[10px] font-bold">
                                    대표 표지
                                  </span>
                                )}
                              </div>
                              <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                                <button
                                  type="button"
                                  disabled={isCover}
                                  onClick={() =>
                                    void handlePatchAlbum(
                                      {
                                        albumId: album.id,
                                        action: "update-album",
                                        coverImageUrl: photo.imageUrl,
                                      },
                                      "앨범 대표 표지를 변경했습니다.",
                                      `edit:${album.id}`
                                    )
                                  }
                                  className="font-bold text-[#1a2744] hover:text-[#2E7D32] disabled:opacity-40"
                                >
                                  대표 지정
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handlePatchAlbum(
                                      {
                                        albumId: album.id,
                                        action: "delete-photo",
                                        photoId: photo.id,
                                      },
                                      "항목 1개를 삭제했습니다.",
                                      `edit:${album.id}`
                                    )
                                  }
                                  className="font-bold text-red-600 hover:underline"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <AdminPaginationBar
            currentPage={safePage}
            totalItems={filteredAlbums.length}
            pageSize={ALBUMS_PER_PAGE}
            onPageChange={setPage}
            itemUnit="개 앨범"
          />
        </section>
      </div>
    </div>
  );
}
