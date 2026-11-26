"use client";

import { useMemo, useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import {
  BULLETIN_SERMON_SERVICES,
  normalizeScriptureText,
  normalizeSermonServiceType,
} from "@/lib/sermon-utils";
import type { SermonItem } from "@/types/site-content";

interface SermonArchiveBrowserProps {
  readonly sermons: readonly SermonItem[];
  readonly youtubeChannelUrl: string;
  readonly initialVideoId?: string;
}

const PER_PAGE = 12;

export function SermonArchiveBrowser({
  sermons,
  youtubeChannelUrl,
  initialVideoId,
}: SermonArchiveBrowserProps) {
  const normalizedSermons = useMemo(
    () =>
      sermons.map((s) => ({
        ...s,
        serviceType: normalizeSermonServiceType(s.serviceType),
        scripture: normalizeScriptureText(s.scripture),
        preacher: s.preacher.trim(),
      })),
    [sermons]
  );

  const [selectedSermonId, setSelectedSermonId] = useState<string>(() => {
    if (initialVideoId) {
      const matched = normalizedSermons.find(
        (s) => s.id === initialVideoId || s.youtubeId === initialVideoId
      );
      if (matched) return matched.id;
    }
    return normalizedSermons[0]?.id ?? "";
  });
  const [serviceFilter, setServiceFilter] = useState<string>("전체");
  const [yearFilter, setYearFilter] = useState<string>("전체");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const s of normalizedSermons) {
      const yr = s.date.slice(0, 4);
      if (/^\d{4}$/.test(yr)) set.add(yr);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [normalizedSermons]);

  const serviceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of normalizedSermons) {
      map[s.serviceType] = (map[s.serviceType] ?? 0) + 1;
    }
    return map;
  }, [normalizedSermons]);

  const visibleServiceFilters = useMemo(
    () =>
      BULLETIN_SERMON_SERVICES.filter(
        (svc) => (serviceCounts[svc] ?? 0) > 0 || serviceFilter === svc
      ),
    [serviceCounts, serviceFilter]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return normalizedSermons.filter((s) => {
      if (serviceFilter !== "전체" && s.serviceType !== serviceFilter) {
        return false;
      }
      if (yearFilter !== "전체" && !s.date.startsWith(yearFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.scripture.toLowerCase().includes(q) ||
        s.preacher.toLowerCase().includes(q) ||
        s.date.includes(q)
      );
    });
  }, [normalizedSermons, query, serviceFilter, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedSermons = filtered.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

  const activeSermon =
    normalizedSermons.find((s) => s.id === selectedSermonId) ??
    pagedSermons[0] ??
    normalizedSermons[0];

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-10 sm:py-16 space-y-8 sm:space-y-10">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1a2744]">
            설교 아카이브
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            예배 구분과 연도, 성경 본문으로 원하는 설교 영상을 바로 찾아 시청할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <AdminEditLink
            href="/admin?tab=sermons"
            className="px-4 py-2 rounded-full bg-[#2E7D32] text-white hover:bg-[#1B5E20] text-xs font-bold transition-colors"
          >
            + 설교 영상 관리
          </AdminEditLink>
          <a
            href={youtubeChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full border border-gray-300 text-[#1a2744] hover:bg-gray-50 text-xs font-bold transition-colors"
          >
            유튜브 채널 이동 ↗
          </a>
        </div>
      </div>

      {/* Active Player (Clean: Worship Type, Date, Title, Scripture, Optional Preacher — No Summary) */}
      {activeSermon && (
        <div
          id="sermon-active-player"
          className="bg-[#0b1320] rounded-2xl overflow-hidden shadow-xl grid lg:grid-cols-[1.5fr_0.5fr]"
        >
          <div className="aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${activeSermon.youtubeId}`}
              title={activeSermon.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <div className="p-5 sm:p-8 text-white flex flex-col justify-center space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block px-3 py-1 rounded-full bg-[#2E7D32] text-xs font-bold">
                {activeSermon.serviceType}
              </span>
              <span className="text-xs text-gray-300 font-semibold">
                {activeSermon.date}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black leading-snug break-keep">
              {activeSermon.title}
            </h3>
            {activeSermon.scripture && (
              <p className="text-sm font-bold text-[#81c784]">
                성경 본문: {activeSermon.scripture}
              </p>
            )}
            {activeSermon.preacher && (
              <p className="text-xs text-gray-300 font-semibold">
                설교: {activeSermon.preacher}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-[#F8FAF8] p-4 rounded-2xl border border-gray-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setServiceFilter("전체");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                serviceFilter === "전체"
                  ? "bg-[#1a2744] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              전체
            </button>
            {visibleServiceFilters.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setServiceFilter(cat);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  serviceFilter === cat
                    ? "bg-[#1a2744] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <select
              aria-label="설교 연도 선택"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-full border border-gray-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1a2744] focus:border-[#2E7D32] focus:outline-none"
            >
              <option value="전체">전체 연도</option>
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}년
                </option>
              ))}
            </select>

            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="설교 제목, 성경 본문(예: 시편), 설교자 검색..."
              className="w-full sm:w-72 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Sermon Cards Grid */}
      {pagedSermons.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-10 text-center text-sm text-gray-500">
          검색 조건에 해당하는 설교 영상이 없습니다.
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {pagedSermons.map((sermon) => {
              const isSelected = activeSermon?.id === sermon.id;
              const subMeta = [sermon.scripture, sermon.preacher]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={sermon.id}
                  type="button"
                  onClick={() => {
                    setSelectedSermonId(sermon.id);
                    const el = document.getElementById("sermon-active-player");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    } else {
                      window.scrollTo({ top: 260, behavior: "smooth" });
                    }
                  }}
                  className={`text-left rounded-2xl overflow-hidden border transition-all flex flex-col ${
                    isSelected
                      ? "border-[#2E7D32] ring-2 ring-[#2E7D32]/25 bg-[#F8FAF8]"
                      : "border-gray-100 bg-white hover:shadow-md"
                  }`}
                >
                  <div className="relative aspect-video bg-[#1a2744] w-full">
                    <img
                      src={`https://i.ytimg.com/vi/${sermon.youtubeId}/hqdefault.jpg`}
                      alt={sermon.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded bg-[#1a2744]/85 text-white text-[11px] font-bold">
                      {sermon.serviceType}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded bg-black/75 text-white text-[11px] font-bold">
                      {isSelected ? "현재 재생 중" : "시청하기 ▶"}
                    </span>
                  </div>
                  <div className="p-4 sm:p-5 flex-1 flex flex-col w-full">
                    <p className="text-xs text-gray-400 mb-1">{sermon.date}</p>
                    <h4 className="font-bold text-[#1a2744] text-base mb-1.5 break-keep">
                      {sermon.title}
                    </h4>
                    {subMeta && (
                      <p className="text-xs font-semibold text-[#2E7D32] mt-auto">
                        {subMeta}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                ← 이전
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - safePage) <= 2
                )
                .reduce<number[]>((acc, p) => {
                  if (acc.length > 0 && p - acc[acc.length - 1] > 1) {
                    acc.push(-p);
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p) =>
                  p < 0 ? (
                    <span
                      key={`ellipsis-${p}`}
                      className="px-1.5 text-xs text-gray-400"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`min-w-9 h-9 px-2.5 rounded-xl text-xs font-bold transition-colors ${
                        p === safePage
                          ? "bg-[#2E7D32] text-white"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
