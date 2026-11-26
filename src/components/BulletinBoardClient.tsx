"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminEditLink } from "@/components/AdminEditLink";
import {
  composeBulletinFullContent,
  isBulletinScheduleHeading,
  normalizeCelebrationLine,
} from "@/lib/format-utils";
import type { BulletinItem } from "@/types/site-content";

interface BulletinBoardClientProps {
  readonly bulletins: readonly BulletinItem[];
  readonly initialBulletinId?: string;
}

interface AnnouncementSubBlock {
  readonly heading: string | null;
  readonly lines: readonly string[];
}

interface CelebrationEntryChip {
  readonly name: string;
  readonly date: string | null;
}

interface CelebrationDisplayRow {
  readonly category: string | null;
  readonly chips: readonly CelebrationEntryChip[];
}

const PER_PAGE = 10;

function splitCelebrationChips(rhs: string): readonly CelebrationEntryChip[] {
  const rawTokens: string[] = [];
  let buf = "";
  let parenDepth = 0;

  for (let i = 0; i < rhs.length; i += 1) {
    const ch = rhs[i];
    if (ch === "(") {
      parenDepth += 1;
      buf += ch;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      buf += ch;
      if (parenDepth === 0) {
        let nextNonSpace = i + 1;
        while (nextNonSpace < rhs.length && rhs[nextNonSpace] === " ") {
          nextNonSpace += 1;
        }
        if (rhs[nextNonSpace] === ",") {
          rawTokens.push(buf.trim());
          buf = "";
          i = nextNonSpace;
        }
      }
      continue;
    }
    buf += ch;
  }

  if (buf.trim()) {
    rawTokens.push(buf.trim());
  }

  return rawTokens
    .map((tok) => tok.replace(/^[,\s]+/, "").trim())
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^(.+?)\s*\(\s*([^()]+?)\s*\)$/);
      if (m) {
        return { name: m[1].trim(), date: m[2].trim() };
      }
      return { name: tok, date: null };
    });
}

function resolveBulletinSections(bulletin: BulletinItem | null): {
  readonly newsBlocks: readonly AnnouncementSubBlock[];
  readonly scheduleBlocks: readonly AnnouncementSubBlock[];
  readonly celebrationRows: readonly CelebrationDisplayRow[];
} {
  if (!bulletin) {
    return { newsBlocks: [], scheduleBlocks: [], celebrationRows: [] };
  }

  const explicitCelebrations = (bulletin.celebrations ?? [])
    .map((line) => normalizeCelebrationLine(line, bulletin.date))
    .filter(Boolean);

  const rawBody =
    bulletin.fullContent ??
    (bulletin.churchNews !== undefined || bulletin.churchSchedule !== undefined
      ? composeBulletinFullContent(
          {
            churchNews: bulletin.churchNews ?? "",
            scheduleTitle: bulletin.scheduleTitle,
            churchSchedule: bulletin.churchSchedule ?? "",
          },
          bulletin.date
        )
      : "");

  const inlineCelebrations: string[] = [];
  const announcementBlocks: { heading: string | null; lines: string[] }[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];
  let inInlineCelebration = false;

  function flushBlock() {
    const trimmedLines = currentLines.filter((l) => l.trim().length > 0);
    if (trimmedLines.length > 0) {
      announcementBlocks.push({
        heading: currentHeading,
        lines: trimmedLines,
      });
    }
    currentLines = [];
  }

  for (const rawLine of rawBody.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const bracketMatch = trimmed.match(/^\[(.+?)\]$/);
    if (bracketMatch) {
      const headingText = bracketMatch[1].trim();
      const compactKey = headingText.replace(/\s+/g, "");
      if (
        compactKey === "축하합니다" ||
        compactKey === "축하" ||
        compactKey === "교우동정"
      ) {
        flushBlock();
        inInlineCelebration = true;
        currentHeading = null;
        continue;
      }
      flushBlock();
      inInlineCelebration = false;
      currentHeading = headingText;
      continue;
    }

    if (inInlineCelebration) {
      if (trimmed) {
        const normalized = normalizeCelebrationLine(trimmed, bulletin.date);
        if (normalized) {
          inlineCelebrations.push(normalized);
        }
      }
      continue;
    }

    if (trimmed) {
      currentLines.push(trimmed);
    }
  }

  flushBlock();

  const newsBlocks = announcementBlocks.filter(
    (b) => !isBulletinScheduleHeading(b.heading)
  );
  const scheduleBlocks = announcementBlocks.filter((b) =>
    isBulletinScheduleHeading(b.heading)
  );

  const mergedCelebrations =
    explicitCelebrations.length > 0 ? explicitCelebrations : inlineCelebrations;

  const celebrationRows: CelebrationDisplayRow[] = mergedCelebrations.map(
    (line) => {
      const colonMatch = line.match(/^([^:：]{1,12}?)\s*[:：]\s*(.+)$/);
      if (colonMatch) {
        return {
          category: colonMatch[1].trim(),
          chips: splitCelebrationChips(colonMatch[2].trim()),
        };
      }
      return {
        category: null,
        chips: splitCelebrationChips(line),
      };
    }
  );

  return { newsBlocks, scheduleBlocks, celebrationRows };
}

export function BulletinBoardClient({
  bulletins,
  initialBulletinId,
}: BulletinBoardClientProps) {
  const sortedBulletins = useMemo(
    () => [...bulletins].sort((a, b) => b.date.localeCompare(a.date)),
    [bulletins]
  );

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const item of sortedBulletins) {
      const y = item.date.slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [sortedBulletins]);

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (
      initialBulletinId &&
      sortedBulletins.some((b) => b.id === initialBulletinId)
    ) {
      return initialBulletinId;
    }
    return sortedBulletins[0]?.id ?? "";
  });
  const [yearFilter, setYearFilter] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredBulletins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedBulletins.filter((b) => {
      if (yearFilter !== "전체" && !b.date.startsWith(yearFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.volume.toLowerCase().includes(q) ||
        b.sermonTitle.toLowerCase().includes(q) ||
        b.scripture.toLowerCase().includes(q) ||
        (b.preacher ?? "").toLowerCase().includes(q) ||
        (b.worshipOrder ?? []).some((step) => step.toLowerCase().includes(q)) ||
        (b.celebrations ?? []).some((item) => item.toLowerCase().includes(q)) ||
        (b.churchNews ?? "").toLowerCase().includes(q) ||
        (b.churchSchedule ?? "").toLowerCase().includes(q) ||
        (b.fullContent ?? "").toLowerCase().includes(q)
      );
    });
  }, [sortedBulletins, yearFilter, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBulletins.length / PER_PAGE)
  );
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredBulletins.slice(
    (safePage - 1) * PER_PAGE,
    safePage * PER_PAGE
  );

  const activeBulletin =
    sortedBulletins.find((b) => b.id === selectedId) ??
    filteredBulletins[0] ??
    sortedBulletins[0] ??
    null;

  const { newsBlocks, scheduleBlocks, celebrationRows } = useMemo(
    () => resolveBulletinSections(activeBulletin),
    [activeBulletin]
  );

  const attachedScanUrls = useMemo(() => {
    if (activeBulletin?.imageUrls && activeBulletin.imageUrls.length > 0) {
      return activeBulletin.imageUrls;
    }
    if (
      activeBulletin?.fileUrl &&
      /\.(png|jpe?g|webp)$/i.test(activeBulletin.fileUrl)
    ) {
      return [activeBulletin.fileUrl];
    }
    return [];
  }, [activeBulletin]);

  const hasWorshipOrder = Boolean(
    activeBulletin?.worshipOrder && activeBulletin.worshipOrder.length > 0
  );
  const hasNews = newsBlocks.length > 0;
  const hasSchedule = scheduleBlocks.length > 0;
  const hasCelebrations = celebrationRows.length > 0;
  const hasRightColumn = hasNews || hasSchedule || hasCelebrations;
  const hasStandingMark = Boolean(
    activeBulletin?.worshipOrder?.some((step) => step.trim().startsWith("※"))
  );

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-10">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[#1a2744]">
            온라인 주보 안내
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            별도 한글 프로그램 설치나 파일 다운로드 없이 예배 순서, 광고 내용, 축하합니다 소식을 화면에서 바로 확인하실 수 있습니다.
          </p>
        </div>
        <AdminEditLink
          href="/admin?tab=bulletin"
          className="px-4 py-2 rounded-full bg-[#2E7D32] text-white hover:bg-[#1B5E20] text-xs font-bold transition-colors"
        >
          + 한글 파일로 이번 주 주보 등록
        </AdminEditLink>
      </div>

      {/* Active Bulletin Online Reader */}
      {activeBulletin && (
        <article
          id="bulletin-reader-panel"
          className="bg-white rounded-2xl border border-[#2E7D32]/30 shadow-xs overflow-hidden"
        >
          {/* Top Navy/Green Header */}
          <div className="bg-[#1a2744] text-white px-6 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-[#2E7D32] text-white text-xs font-bold">
                  {activeBulletin.volume}
                </span>
                <span className="text-xs text-gray-300 font-medium">
                  예배일: {activeBulletin.date}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight break-keep">
                {activeBulletin.title}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                href="/worship/sermons"
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white hover:text-[#1a2744] text-white text-xs font-bold transition-colors border border-white/25"
              >
                설교 영상 보기 →
              </Link>
              {activeBulletin.fileUrl && (
                <a
                  href={activeBulletin.fileUrl}
                  download={activeBulletin.fileName ?? true}
                  className="px-4 py-2 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold transition-colors"
                >
                  원본 파일 내려받기 ↓
                </a>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Pulpit Message Highlight */}
            <div className="rounded-2xl bg-[#F8FAF8] border border-[#2E7D32]/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-[#2E7D32] uppercase tracking-wider">
                  주일 강단 말씀
                </span>
                <p className="text-lg sm:text-xl font-black text-[#1a2744] break-keep">
                  &ldquo;{activeBulletin.sermonTitle}&rdquo;
                </p>
                <p className="text-sm text-gray-600 font-semibold">
                  성경 본문: {activeBulletin.scripture}
                  {activeBulletin.preacher
                    ? ` · 설교: ${activeBulletin.preacher}`
                    : ""}
                </p>
              </div>
            </div>

            {/* Worship Order + Announcements & Celebrations */}
            {(hasWorshipOrder || hasRightColumn) && (
              <div className="grid grid-cols-1 lg:grid-cols-[0.94fr_1.06fr] gap-6 items-start">
                {hasWorshipOrder && activeBulletin.worshipOrder && (
                  <div
                    className={`rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-3.5 ${
                      !hasRightColumn ? "lg:col-span-2" : ""
                    }`}
                  >
                    <h4 className="text-sm font-black text-[#1a2744] flex items-center gap-2 border-b border-gray-100 pb-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                      <span>예배 순서</span>
                    </h4>
                    <ol className="space-y-2 text-sm text-gray-700">
                      {activeBulletin.worshipOrder.map((step, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 leading-relaxed"
                        >
                          <span className="text-xs font-bold text-[#2E7D32] mt-0.5 w-5 shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="break-keep">{step}</span>
                        </li>
                      ))}
                    </ol>
                    {hasStandingMark && (
                      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                        ※ 표시는 일어서서 드립니다.
                      </p>
                    )}
                  </div>
                )}

                {hasRightColumn && (
                  <div
                    className={`space-y-5 ${
                      !hasWorshipOrder ? "lg:col-span-2" : ""
                    }`}
                  >
                    {hasNews && (
                      <div className="rounded-2xl bg-gray-50/80 border border-gray-200 p-5 sm:p-6 space-y-4">
                        <h4 className="text-sm font-black text-[#1a2744] flex items-center gap-2 border-b border-gray-200 pb-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#1a2744]" />
                          <span>
                            {newsBlocks.length === 1 &&
                            newsBlocks[0]?.heading &&
                            newsBlocks[0].heading.replace(/\s+/g, "") !==
                              "교회소식"
                              ? newsBlocks[0].heading
                              : "교회 소식"}
                          </span>
                        </h4>
                        <div className="space-y-4 text-sm sm:text-[15px] text-gray-700 leading-relaxed break-keep">
                          {newsBlocks.map((block, bIdx) => {
                            const showSubheading =
                              Boolean(block.heading) &&
                              block.heading!.replace(/\s+/g, "") !== "교회소식" &&
                              !(newsBlocks.length === 1 && bIdx === 0);
                            return (
                              <div key={bIdx} className="space-y-1.5">
                                {showSubheading && (
                                  <p className="text-xs font-extrabold text-[#2E7D32] tracking-wide pt-0.5">
                                    {block.heading}
                                  </p>
                                )}
                                <div className="space-y-1">
                                  {block.lines.map((line, lIdx) => (
                                    <p key={lIdx}>{line}</p>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {hasSchedule && (
                      <div className="rounded-2xl bg-white border border-[#1a2744]/20 p-5 sm:p-6 space-y-3.5">
                        <h4 className="text-sm font-black text-[#1a2744] flex items-center gap-2 border-b border-gray-100 pb-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#1a2744]" />
                          <span>
                            {scheduleBlocks.length === 1 &&
                            scheduleBlocks[0]?.heading
                              ? scheduleBlocks[0].heading
                              : "교회 일정"}
                          </span>
                        </h4>
                        <div className="space-y-3 text-sm sm:text-[15px] text-gray-700 leading-relaxed break-keep">
                          {scheduleBlocks.map((block, sIdx) => (
                            <div key={sIdx} className="space-y-1">
                              {scheduleBlocks.length > 1 && block.heading && (
                                <p className="text-xs font-extrabold text-[#1a2744] pt-0.5">
                                  {block.heading}
                                </p>
                              )}
                              {block.lines.map((line, lIdx) => (
                                <p key={lIdx}>{line}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasCelebrations && (
                      <div className="rounded-2xl bg-[#F8FAF8] border border-[#2E7D32]/25 p-5 sm:p-6 space-y-3.5">
                        <h4 className="text-sm font-black text-[#1a2744] flex items-center gap-2 border-b border-[#2E7D32]/15 pb-2.5">
                          <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                          <span>축하합니다</span>
                        </h4>
                        <div className="space-y-2.5">
                          {celebrationRows.map((row, rIdx) => (
                            <div
                              key={rIdx}
                              className="flex flex-col sm:flex-row sm:items-start gap-2"
                            >
                              {row.category && (
                                <span className="self-start px-2.5 py-0.5 rounded-md bg-[#E8F5E9] text-[#2E7D32] text-xs font-extrabold shrink-0 mt-0.5">
                                  {row.category}
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {row.chips.map((chip, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-[#2E7D32]/20 text-sm break-keep"
                                  >
                                    <span className="font-bold text-[#1a2744]">
                                      {chip.name}
                                    </span>
                                    {chip.date && (
                                      <span className="text-xs font-semibold text-[#2E7D32] ml-1">
                                        ({chip.date})
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Attached Original Scan Pages if any */}
            {attachedScanUrls.length > 0 && (
              <details className="group rounded-2xl border border-gray-200 bg-gray-50/70 overflow-hidden">
                <summary className="cursor-pointer select-none px-5 py-3.5 flex items-center justify-between gap-3 text-sm font-black text-[#1a2744] hover:bg-gray-100/80 transition-colors">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />
                    <span>원본 스캔 주보 보기 ({attachedScanUrls.length}면)</span>
                  </span>
                  <span className="text-xs font-bold text-[#2E7D32] group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="p-4 sm:p-5 border-t border-gray-200 bg-white space-y-4">
                  {attachedScanUrls.map((scanUrl, sIdx) => (
                    <figure
                      key={scanUrl}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-2 sm:p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between px-1 text-xs text-gray-500 font-semibold">
                        <span>{sIdx + 1}면</span>
                        <a
                          href={scanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2E7D32] hover:underline font-bold"
                        >
                          원본 크기로 열기 ↗
                        </a>
                      </div>
                      <img
                        src={scanUrl}
                        alt={`${activeBulletin.title} ${sIdx + 1}면`}
                        loading="lazy"
                        className="w-full object-contain mx-auto rounded-lg"
                      />
                    </figure>
                  ))}
                </div>
              </details>
            )}
          </div>
        </article>
      )}

      {/* Search & Year Filter + Paginated Bulletin Board List */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAF8] p-4 rounded-2xl border border-gray-200">
          <div className="flex flex-wrap items-center gap-1.5">
            {["전체", ...years].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setYearFilter(yr);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  yearFilter === yr
                    ? "bg-[#1a2744] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-[#2E7D32]"
                }`}
              >
                {yr === "전체" ? "전체 연도" : `${yr}년`}
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
            placeholder="주보 제목, 호수, 설교 제목, 성경 본문, 광고 내용 검색..."
            className="w-full sm:w-80 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs sm:text-sm focus:border-[#2E7D32] focus:outline-none"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          {pageItems.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              검색 조건에 맞는 주보 안내 내역이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pageItems.map((item) => {
                const isSelected = activeBulletin?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        const panel = document.getElementById(
                          "bulletin-reader-panel"
                        );
                        panel?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                      className={`w-full text-left px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                        isSelected ? "bg-[#E8F5E9]/65" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <span
                          className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isSelected
                              ? "bg-[#2E7D32] text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.volume}
                        </span>
                        <span className="font-bold text-sm sm:text-base text-[#1a2744] break-keep">
                          {item.title}
                        </span>
                        <span className="text-xs text-[#2E7D32] font-semibold">
                          · {item.sermonTitle} ({item.scripture})
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium shrink-0">
                        {item.date}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 disabled:opacity-40"
            >
              ◀ 이전
            </button>
            <span className="text-xs font-bold text-[#1a2744] px-3">
              {safePage} / {totalPages} 페이지
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 disabled:opacity-40"
            >
              다음 ▶
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
