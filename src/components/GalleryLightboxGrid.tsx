"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCanUploadPhotos } from "@/components/NavigationContext";
import { PRESET_GALLERY_TAGS } from "@/lib/gallery-tags";
import { isVideoAssetUrl } from "@/lib/media-utils";
import type { LegacyGalleryAlbum } from "@/types/site-content";

interface GalleryLightboxGridProps {
  readonly albums: readonly LegacyGalleryAlbum[];
}

const ALBUMS_PER_PAGE = 12;

export function GalleryLightboxGrid({ albums }: GalleryLightboxGridProps) {
  const canUploadPhotos = useCanUploadPhotos();
  const [selectedTag, setSelectedTag] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [albumPage, setAlbumPage] = useState(1);

  const [activeAlbum, setActiveAlbum] = useState<LegacyGalleryAlbum | null>(
    null
  );
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showBodyPanel, setShowBodyPanel] = useState(true);
  const filmstripRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const album of albums) {
      if (!Array.isArray(album.tags)) continue;
      for (const tag of album.tags) {
        const cleaned = tag.replace(/^#+/, "").trim();
        if (cleaned) {
          tagSet.add(cleaned);
        }
      }
    }
    const ordered: string[] = [];
    for (const preset of PRESET_GALLERY_TAGS) {
      if (tagSet.has(preset)) {
        ordered.push(preset);
        tagSet.delete(preset);
      }
    }
    for (const extra of tagSet) {
      ordered.push(extra);
    }
    return ordered;
  }, [albums]);

  useEffect(() => {
    if (!activeAlbum) return;
    const photoTotal = activeAlbum.photos.length;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveAlbum(null);
      } else if (event.key === "ArrowLeft" && photoTotal > 1) {
        event.preventDefault();
        setActivePhotoIndex((prev) => (prev - 1 + photoTotal) % photoTotal);
      } else if (event.key === "ArrowRight" && photoTotal > 1) {
        event.preventDefault();
        setActivePhotoIndex((prev) => (prev + 1) % photoTotal);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAlbum]);

  useEffect(() => {
    if (!activeAlbum) return;
    const thumbNode = filmstripRefs.current.get(activePhotoIndex);
    if (thumbNode) {
      thumbNode.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeAlbum, activePhotoIndex]);

  const normalizedQuery = searchQuery.trim().replace(/^#+/, "").toLowerCase();

  const filteredAlbums = albums.filter((album) => {
    const albumTags = Array.isArray(album.tags) ? album.tags : [];
    if (selectedTag !== "전체" && !albumTags.includes(selectedTag)) {
      return false;
    }
    if (normalizedQuery) {
      const inTitle = album.title.toLowerCase().includes(normalizedQuery);
      const inContent = (album.content ?? "")
        .toLowerCase()
        .includes(normalizedQuery);
      const inDate = album.date.toLowerCase().includes(normalizedQuery);
      const inTags = albumTags.some((t) =>
        t.toLowerCase().includes(normalizedQuery)
      );
      const inCaptions = album.photos.some((p) =>
        p.caption.toLowerCase().includes(normalizedQuery)
      );
      if (!inTitle && !inContent && !inDate && !inTags && !inCaptions) {
        return false;
      }
    }
    return true;
  });

  const filteredPhotoCount = filteredAlbums.reduce(
    (sum, album) => sum + album.photos.length,
    0
  );

  const totalAlbumPages = Math.max(
    1,
    Math.ceil(filteredAlbums.length / ALBUMS_PER_PAGE)
  );
  const safeAlbumPage = Math.min(albumPage, totalAlbumPages);
  const paginatedAlbums = filteredAlbums.slice(
    (safeAlbumPage - 1) * ALBUMS_PER_PAGE,
    safeAlbumPage * ALBUMS_PER_PAGE
  );

  const activeSafeIndex = activeAlbum
    ? Math.min(activePhotoIndex, Math.max(0, activeAlbum.photos.length - 1))
    : 0;
  const activeModalPhoto = activeAlbum
    ? activeAlbum.photos[activeSafeIndex]
    : undefined;
  const activeBodyText = activeAlbum?.content?.trim() ?? "";
  const hasActiveBody = activeBodyText.length > 0;

  return (
    <div
      id="gallery-top"
      className="max-w-[1400px] mx-auto px-5 sm:px-6 py-10 sm:py-16 space-y-7"
    >
      {/* Clean Top Toolbar: Count + Search + Tag Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-200">
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-bold text-[#1a2744]">
              전체 앨범{" "}
              <span className="text-[#2E7D32]">{filteredAlbums.length}</span>개
              <span className="text-gray-400 font-medium ml-1.5 text-xs sm:text-sm">
                ({filteredPhotoCount}개 미디어)
              </span>
              {filteredAlbums.length > 0 && (
                <span className="font-normal text-gray-400 ml-2 text-xs">
                  {safeAlbumPage} / {totalAlbumPages} 페이지
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto min-w-0">
            {canUploadPhotos && (
              <Link
                href="/admin/photos"
                className="px-4 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors"
              >
                + 사진 및 영상 업로드
              </Link>
            )}
            <div className="relative flex-1 sm:w-72 min-w-0">
              <input
                id="gallery-album-search"
                type="search"
                aria-label="앨범 검색"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setAlbumPage(1);
                }}
                placeholder="제목, 본문, 날짜, #태그 검색..."
                className="w-full min-w-0 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setAlbumPage(1);
                  }}
                  aria-label="검색어 지우기"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-gray-400 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>
            {(selectedTag !== "전체" || Boolean(searchQuery.trim())) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTag("전체");
                  setSearchQuery("");
                  setAlbumPage(1);
                }}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-[#1a2744] whitespace-nowrap shrink-0"
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* Tag Filter Pills (Horizontal scroll on narrow screens, wrap on desktop) */}
        {availableTags.length > 0 && (
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedTag("전체");
                setAlbumPage(1);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                selectedTag === "전체"
                  ? "bg-[#1a2744] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              전체
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSelectedTag(tag);
                  setAlbumPage(1);
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  selectedTag === tag
                    ? "bg-[#2E7D32] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Album Grid */}
      {albums.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-[#F8FAF8] p-12 text-center space-y-2">
          <p className="text-base font-bold text-[#1a2744]">
            등록된 앨범이 아직 없습니다.
          </p>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3">
          <p className="text-base font-bold text-[#1a2744]">
            검색 조건에 일치하는 앨범이 없습니다.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTag("전체");
              setSearchQuery("");
              setAlbumPage(1);
            }}
            className="px-4 py-2 rounded-full bg-[#1a2744] text-white text-xs font-bold"
          >
            전체 앨범 보기
          </button>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {paginatedAlbums.map((album) => {
              const coverSrc =
                album.coverImageUrl || album.photos[0]?.imageUrl || "";
              const isCoverVideo = isVideoAssetUrl(coverSrc);
              const hasAnyVideo = album.photos.some((p) =>
                isVideoAssetUrl(p.imageUrl)
              );
              const count = album.photoCount || album.photos.length;
              const albumTags = Array.isArray(album.tags) ? album.tags : [];
              const hasBody = Boolean(album.content && album.content.trim());

              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => {
                    setActiveAlbum(album);
                    setActivePhotoIndex(0);
                    setShowBodyPanel(true);
                  }}
                  className="text-left bg-white rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-lg hover:border-[#2E7D32]/50 transition-all overflow-hidden group flex flex-col min-w-0"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 w-full">
                    {coverSrc &&
                      (isCoverVideo ? (
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
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ))}
                    {hasAnyVideo && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#1a2744]/85 text-white text-[11px] font-bold">
                        ▶ 동영상 포함
                      </span>
                    )}
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-bold">
                      {count}개
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between w-full min-w-0">
                    <div>
                      <h3 className="font-bold text-[#1a2744] text-sm sm:text-base leading-snug break-keep group-hover:text-[#2E7D32] transition-colors">
                        {album.title}
                      </h3>

                      {albumTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {albumTags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-3">
                      <p className="text-xs text-gray-500 font-medium">
                        {album.date}
                      </p>
                      {hasBody && (
                        <span className="px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold shrink-0">
                          본문
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalAlbumPages > 1 && (
            <nav
              aria-label="앨범 페이지 이동"
              className="flex flex-wrap items-center justify-center gap-1.5 pt-4"
            >
              <button
                type="button"
                disabled={safeAlbumPage <= 1}
                onClick={() => {
                  setAlbumPage((p) => Math.max(1, p - 1));
                  document
                    .getElementById("gallery-top")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-[#1a2744] hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                ← 이전
              </button>
              {Array.from({ length: totalAlbumPages }, (_, idx) => idx + 1).map(
                (pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => {
                      setAlbumPage(pageNum);
                      document
                        .getElementById("gallery-top")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                    aria-current={pageNum === safeAlbumPage ? "page" : undefined}
                    className={`min-w-[40px] min-h-[40px] px-3 py-2 rounded-xl text-xs font-black transition-colors shrink-0 ${
                      pageNum === safeAlbumPage
                        ? "bg-[#1a2744] text-white shadow-xs"
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={safeAlbumPage >= totalAlbumPages}
                onClick={() => {
                  setAlbumPage((p) => Math.min(totalAlbumPages, p + 1));
                  document
                    .getElementById("gallery-top")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-[#1a2744] hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                다음 →
              </button>
            </nav>
          )}
        </>
      )}

      {/* Multi-Media Album Lightbox + Filmstrip + Mobile Touch Swipe */}
      {activeAlbum && activeModalPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeAlbum.title} 앨범 뷰어`}
          className="fixed inset-0 z-[110] bg-black/92 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5"
          onClick={() => setActiveAlbum(null)}
        >
          <div
            className={`relative min-w-0 w-full ${
              hasActiveBody && showBodyPanel
                ? "max-w-[min(72rem,calc(100vw-1rem))] sm:max-w-[min(72rem,calc(100vw-2.5rem))]"
                : "max-w-[min(64rem,calc(100vw-1rem))] sm:max-w-[min(64rem,calc(100vw-2.5rem))]"
            } bg-[#111827] text-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col max-h-[94dvh] transition-all`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex items-center justify-between gap-3 bg-[#1a2744] shrink-0 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-gray-200 font-semibold">
                    {activeAlbum.date}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white font-black">
                    {activeSafeIndex + 1} / {activeAlbum.photos.length}
                  </span>
                  {Array.isArray(activeAlbum.tags) &&
                    activeAlbum.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-[#2E7D32] text-white font-bold"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
                <h4 className="text-sm sm:text-lg font-black text-white mt-1 leading-snug break-keep">
                  {activeAlbum.title}
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasActiveBody && (
                  <button
                    type="button"
                    onClick={() => setShowBodyPanel((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                      showBodyPanel
                        ? "bg-white/15 hover:bg-white/25 text-white"
                        : "bg-[#2E7D32] hover:bg-[#1B5E20] text-white"
                    }`}
                  >
                    {showBodyPanel ? "본문 접기" : "본문 보기"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveAlbum(null)}
                  aria-label="앨범 뷰어 닫기"
                  className="min-w-[42px] min-h-[42px] rounded-full bg-white/15 hover:bg-white hover:text-[#1a2744] text-white flex items-center justify-center text-sm font-black shrink-0 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Lightbox Body */}
            <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
              <div className="flex-1 min-w-0 flex flex-col justify-between bg-black overflow-hidden">
                <div
                  className="relative bg-black flex-1 min-w-0 w-full overflow-hidden flex items-center justify-center min-h-[220px] sm:min-h-[340px] px-2 sm:px-14 py-3 select-none"
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    if (t) {
                      touchStartRef.current = { x: t.clientX, y: t.clientY };
                    }
                  }}
                  onTouchEnd={(e) => {
                    const start = touchStartRef.current;
                    touchStartRef.current = null;
                    const t = e.changedTouches[0];
                    if (!start || !t || activeAlbum.photos.length <= 1) return;
                    const dx = t.clientX - start.x;
                    const dy = t.clientY - start.y;
                    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                      const len = activeAlbum.photos.length;
                      setActivePhotoIndex((prev) =>
                        dx < 0 ? (prev + 1) % len : (prev - 1 + len) % len
                      );
                    }
                  }}
                >
                  {activeAlbum.photos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex(
                          (prev) =>
                            (prev - 1 + activeAlbum.photos.length) %
                            activeAlbum.photos.length
                        )
                      }
                      aria-label="이전 항목"
                      className="absolute left-2 sm:left-4 z-10 min-w-[42px] min-h-[42px] w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-[#2E7D32] border border-white/25 text-white flex items-center justify-center text-lg font-black transition-colors"
                    >
                      ‹
                    </button>
                  )}

                  {isVideoAssetUrl(activeModalPhoto.imageUrl) ? (
                    <video
                      key={activeModalPhoto.imageUrl}
                      src={activeModalPhoto.imageUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-auto max-w-full mx-auto max-h-[54dvh] sm:max-h-[63dvh] object-contain block"
                    />
                  ) : (
                    <img
                      src={activeModalPhoto.imageUrl}
                      alt={
                        activeModalPhoto.caption ||
                        `${activeAlbum.title} (${activeSafeIndex + 1}/${activeAlbum.photos.length})`
                      }
                      className="w-auto max-w-full mx-auto max-h-[54dvh] sm:max-h-[63dvh] object-contain block"
                    />
                  )}

                  {activeAlbum.photos.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex(
                          (prev) => (prev + 1) % activeAlbum.photos.length
                        )
                      }
                      aria-label="다음 항목"
                      className="absolute right-2 sm:right-4 z-10 min-w-[42px] min-h-[42px] w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 hover:bg-[#2E7D32] border border-white/25 text-white flex items-center justify-center text-lg font-black transition-colors"
                    >
                      ›
                    </button>
                  )}
                </div>

                {/* Caption + Filmstrip */}
                <div className="px-4 sm:px-6 py-3 bg-[#111827] border-t border-white/10 space-y-2.5 shrink-0 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-300">
                    <p className="font-medium break-keep min-w-0">
                      {activeModalPhoto.caption || activeAlbum.title}
                    </p>
                    {activeAlbum.photos.length > 1 && (
                      <>
                        <span className="sm:hidden text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                          좌우로 밀어 이동
                        </span>
                        <span className="hidden sm:inline text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                          키보드 방향키 이동, ESC 닫기
                        </span>
                      </>
                    )}
                  </div>

                  {activeAlbum.photos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                      {activeAlbum.photos.map((photo, idx) => {
                        const isCurrent = idx === activeSafeIndex;
                        const isVid = isVideoAssetUrl(photo.imageUrl);
                        return (
                          <button
                            key={photo.id}
                            ref={(node) => {
                              if (node) {
                                filmstripRefs.current.set(idx, node);
                              } else {
                                filmstripRefs.current.delete(idx);
                              }
                            }}
                            type="button"
                            onClick={() => setActivePhotoIndex(idx)}
                            aria-label={`${idx + 1}번째 미디어 보기`}
                            className={`relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                              isCurrent
                                ? "border-[#4CAF50] ring-2 ring-[#4CAF50]/60 opacity-100 scale-105"
                                : "border-transparent opacity-55 hover:opacity-90"
                            }`}
                          >
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
                                alt={`${activeAlbum.title} 썸네일 ${idx + 1}`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/75 text-[9px] font-bold text-white leading-tight">
                              {isVid ? "▶" : idx + 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {hasActiveBody && showBodyPanel && (
                <aside
                  aria-label="게시물 본문"
                  className="w-full lg:w-[280px] xl:w-[340px] shrink-0 bg-[#162033] border-t lg:border-t-0 lg:border-l border-white/10 p-4 sm:p-6 lg:overflow-y-auto space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <span className="text-xs font-black tracking-wide text-[#81C784]">
                      앨범 설명
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {activeAlbum.date}
                    </span>
                  </div>
                  <p className="text-sm sm:text-[15px] text-gray-100 leading-7 whitespace-pre-line break-keep">
                    {activeBodyText}
                  </p>
                </aside>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
