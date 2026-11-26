"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPaginationBar } from "@/components/AdminPaginationBar";
import type { ParsedBulletinDraft } from "@/lib/hwp-parser";
import {
  composeBulletinFullContent,
  createClientSafeId,
  formatBulletinDateTitle,
  formatDefaultBulletinScheduleTitle,
  formatDefaultBulletinVolume,
  getKstDateString,
  isAutoBulletinDateTitle,
  isAutoBulletinScheduleTitle,
  isAutoBulletinVolume,
  normalizeCelebrationLine,
  splitBulletinNewsAndSchedule,
} from "@/lib/format-utils";
import { readJsonResponseSafe } from "@/lib/media-utils";
import type { BulletinItem, SiteContent } from "@/types/site-content";

interface AdminBulletinStudioProps {
  readonly draft: SiteContent;
  readonly saving: boolean;
  readonly onUpdateBulletins: (nextBulletins: readonly BulletinItem[]) => void;
  readonly onSaveImmediate: (
    nextContent: SiteContent,
    toastMsg: string
  ) => Promise<void>;
  readonly onUploadAsset: (
    file: File,
    bucket: "bulletins",
    label: string
  ) => Promise<{
    readonly url: string;
    readonly fileName: string;
    readonly sizeLabel: string;
  } | null>;
  readonly onToast: (msg: string) => void;
  readonly onError: (msg: string) => void;
}

const SUPPORTED_BULLETIN_EXTS = [".hwp", ".hwpx", ".docx", ".txt"] as const;

function isSupportedBulletinFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_BULLETIN_EXTS.some((ext) => lower.endsWith(ext));
}

function resolveBulletinParts(bul: BulletinItem): {
  readonly churchNews: string;
  readonly scheduleTitle: string;
  readonly churchSchedule: string;
} {
  const split = splitBulletinNewsAndSchedule(bul.fullContent, bul.date);
  return {
    churchNews: bul.churchNews ?? split.churchNews,
    scheduleTitle: bul.scheduleTitle ?? split.scheduleTitle,
    churchSchedule: bul.churchSchedule ?? split.churchSchedule,
  };
}

export function AdminBulletinStudio({
  draft,
  saving,
  onUpdateBulletins,
  onSaveImmediate,
  onUploadAsset,
  onToast,
  onError,
}: AdminBulletinStudioProps) {
  const bulletins = draft.bulletins;

  // Bulk Upload & Single Composer States
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [alsoAttachOriginalFile, setAlsoAttachOriginalFile] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [parsingHwp, setParsingHwp] = useState(false);
  const [parsedSourceName, setParsedSourceName] = useState<string | null>(null);
  const [pendingSourceFile, setPendingSourceFile] = useState<File | null>(null);

  const [newDate, setNewDate] = useState(() => getKstDateString());
  const [newTitle, setNewTitle] = useState(() =>
    formatBulletinDateTitle(getKstDateString())
  );
  const [newVolume, setNewVolume] = useState(() =>
    formatDefaultBulletinVolume(getKstDateString())
  );
  const [newSermonTitle, setNewSermonTitle] = useState("");
  const [newScripture, setNewScripture] = useState("");
  const [newPreacher, setNewPreacher] = useState(
    `${draft.pastorProfile.name} 담임목사`
  );
  const [newWorshipOrderText, setNewWorshipOrderText] = useState("");
  const [newChurchNews, setNewChurchNews] = useState("");
  const [newScheduleTitle, setNewScheduleTitle] = useState(() =>
    formatDefaultBulletinScheduleTitle(getKstDateString())
  );
  const [newChurchSchedule, setNewChurchSchedule] = useState("");
  const [newCelebrationsText, setNewCelebrationsText] = useState("");

  // Compact List, Filter, Bulk-Select, Expand-Row, and Pagination States
  const [yearFilter, setYearFilter] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const b of bulletins) {
      const y = b.date.slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [bulletins]);

  const filteredBulletins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bulletins.filter((b) => {
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
  }, [bulletins, yearFilter, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBulletins.length / pageSize)
  );
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredBulletins.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const allPageSelected =
    pageItems.length > 0 &&
    pageItems.every((item) => selectedIds.includes(item.id));

  async function parseHangulFileSilent(
    file: File
  ): Promise<ParsedBulletinDraft> {
    if (!isSupportedBulletinFile(file.name)) {
      throw new Error(
        `"${file.name}" 파일은 지원하지 않는 형식입니다. 한글(.hwp, .hwpx), 워드(.docx), 텍스트(.txt) 파일을 선택해 주세요.`
      );
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/parse-bulletin", {
      method: "POST",
      body: formData,
    });
    const data = await readJsonResponseSafe<{
      readonly parsed?: ParsedBulletinDraft;
      readonly error?: string;
    }>(response, `"${file.name}" 파일 분석에 실패했습니다.`);
    if (!response.ok || !data.parsed) {
      throw new Error(data.error ?? `"${file.name}" 파일 분석에 실패했습니다.`);
    }
    return data.parsed;
  }

  async function handleBulkUploadAndRegister(files: FileList) {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0) return;

    setParsingHwp(true);
    setBulkProgress(`주보 파일 준비 중 (0/${selectedFiles.length})...`);
    try {
      const createdItems: BulletinItem[] = [];
      const failedNames: string[] = [];

      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i]!;
        setBulkProgress(
          `주보 분석 및 등록 중 (${i + 1}/${selectedFiles.length}): ${file.name}`
        );
        try {
          const parsed = await parseHangulFileSilent(file);
          const resolvedDate = parsed.date ?? getKstDateString();
          const resolvedTitle = formatBulletinDateTitle(resolvedDate);
          const resolvedVolume =
            parsed.volume ?? formatDefaultBulletinVolume(resolvedDate);

          let uploadedFileUrl: string | undefined;
          let uploadedFileName: string | undefined;
          if (alsoAttachOriginalFile) {
            const uploaded = await onUploadAsset(
              file,
              "bulletins",
              `${file.name} (${i + 1}/${selectedFiles.length})`
            );
            if (uploaded) {
              uploadedFileUrl = uploaded.url;
              uploadedFileName = uploaded.fileName;
            }
          }

          const celebrations = parsed.celebrations
            .map((line) => normalizeCelebrationLine(line, resolvedDate))
            .filter(Boolean);

          const split = splitBulletinNewsAndSchedule(
            parsed.fullContent,
            resolvedDate
          );
          const composedFull = composeBulletinFullContent(split, resolvedDate);

          createdItems.push({
            id: createClientSafeId("bul"),
            title: resolvedTitle,
            date: resolvedDate,
            volume: resolvedVolume,
            sermonTitle: parsed.sermonTitle || "주일 강단 말씀",
            scripture: parsed.scripture || "강단 본문",
            preacher: parsed.preacher || `${draft.pastorProfile.name} 담임목사`,
            worshipOrder:
              parsed.worshipOrder.length > 0 ? parsed.worshipOrder : undefined,
            celebrations: celebrations.length > 0 ? celebrations : undefined,
            churchNews: split.churchNews || undefined,
            scheduleTitle: split.churchSchedule
              ? split.scheduleTitle
              : undefined,
            churchSchedule: split.churchSchedule || undefined,
            fullContent: composedFull || undefined,
            fileUrl: uploadedFileUrl,
            fileName: uploadedFileName,
          });
        } catch {
          failedNames.push(file.name);
        }
      }

      if (createdItems.length === 0) {
        throw new Error(
          `선택한 파일(${failedNames.join(", ")})에서 주보 내용을 추출하지 못했습니다. 한글(.hwp, .hwpx) 파일인지 확인해 주세요.`
        );
      }

      // Merge and sort newest date first
      const merged = [...createdItems, ...draft.bulletins].sort((a, b) =>
        b.date.localeCompare(a.date)
      );

      setBulkProgress("등록된 주보를 저장하는 중...");
      const summaryToast =
        failedNames.length > 0
          ? `주보 ${createdItems.length}호를 일괄 등록했습니다. (실패 ${failedNames.length}건: ${failedNames.join(", ")})`
          : `주보 ${createdItems.length}호가 한 번에 등록되었습니다.`;

      await onSaveImmediate(
        {
          ...draft,
          bulletins: merged,
        },
        summaryToast
      );
      setPage(1);
    } catch (err: unknown) {
      onError(
        err instanceof Error
          ? err.message
          : "주보 일괄 등록 중 오류가 발생했습니다."
      );
    } finally {
      setParsingHwp(false);
      setBulkProgress(null);
    }
  }

  async function handleSelectHangulForComposer(file: File) {
    setParsingHwp(true);
    try {
      const parsed = await parseHangulFileSilent(file);
      setPendingSourceFile(file);
      setParsedSourceName(file.name);
      setComposerOpen(true);

      const resolvedDate = parsed.date ?? newDate;
      setNewDate(resolvedDate);
      setNewTitle(formatBulletinDateTitle(resolvedDate));
      setNewVolume(parsed.volume ?? formatDefaultBulletinVolume(resolvedDate));
      if (parsed.sermonTitle) setNewSermonTitle(parsed.sermonTitle);
      if (parsed.scripture) setNewScripture(parsed.scripture);
      if (parsed.preacher) setNewPreacher(parsed.preacher);
      if (parsed.worshipOrder.length > 0) {
        setNewWorshipOrderText(parsed.worshipOrder.join("\n"));
      }
      const split = splitBulletinNewsAndSchedule(
        parsed.fullContent,
        resolvedDate
      );
      setNewChurchNews(split.churchNews);
      setNewScheduleTitle(split.scheduleTitle);
      setNewChurchSchedule(split.churchSchedule);
      setNewCelebrationsText(parsed.celebrations.join("\n"));

      onToast(
        `"${file.name}" 내용을 불러왔습니다. 확인 후 [주보 등록하기]를 눌러 주세요.`
      );
    } catch (err: unknown) {
      onError(
        err instanceof Error
          ? err.message
          : "한글 파일 분석 중 오류가 발생했습니다."
      );
    } finally {
      setParsingHwp(false);
    }
  }

  async function handlePublishNewBulletin() {
    const resolvedTitle =
      newTitle.trim() || formatBulletinDateTitle(newDate);

    let uploadedFileUrl: string | undefined;
    let uploadedFileName: string | undefined;

    if (alsoAttachOriginalFile && pendingSourceFile) {
      const uploaded = await onUploadAsset(
        pendingSourceFile,
        "bulletins",
        pendingSourceFile.name
      );
      if (uploaded) {
        uploadedFileUrl = uploaded.url;
        uploadedFileName = uploaded.fileName;
      }
    }

    const worshipOrder = newWorshipOrderText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const celebrations = newCelebrationsText
      .split("\n")
      .map((l) => normalizeCelebrationLine(l, newDate))
      .filter(Boolean);

    const trimmedNews = newChurchNews.trim();
    const trimmedSchedule = newChurchSchedule.trim();
    const resolvedScheduleTitle =
      newScheduleTitle.trim() || formatDefaultBulletinScheduleTitle(newDate);
    const composedFull = composeBulletinFullContent(
      {
        churchNews: trimmedNews,
        scheduleTitle: resolvedScheduleTitle,
        churchSchedule: trimmedSchedule,
      },
      newDate
    );

    const created: BulletinItem = {
      id: createClientSafeId("bul"),
      title: resolvedTitle,
      date: newDate,
      volume: newVolume.trim() || formatDefaultBulletinVolume(newDate),
      sermonTitle: newSermonTitle.trim() || "주일 강단 말씀",
      scripture: newScripture.trim() || "강단 본문",
      preacher: newPreacher.trim() || `${draft.pastorProfile.name} 담임목사`,
      worshipOrder: worshipOrder.length > 0 ? worshipOrder : undefined,
      celebrations: celebrations.length > 0 ? celebrations : undefined,
      churchNews: trimmedNews || undefined,
      scheduleTitle: trimmedSchedule ? resolvedScheduleTitle : undefined,
      churchSchedule: trimmedSchedule || undefined,
      fullContent: composedFull || undefined,
      fileUrl: uploadedFileUrl,
      fileName: uploadedFileName,
    };

    const nextContent: SiteContent = {
      ...draft,
      bulletins: [created, ...draft.bulletins].sort((a, b) =>
        b.date.localeCompare(a.date)
      ),
    };

    await onSaveImmediate(nextContent, `"${created.title}"가 게시되었습니다.`);

    setNewTitle(formatBulletinDateTitle(newDate));
    setNewVolume(formatDefaultBulletinVolume(newDate));
    setNewSermonTitle("");
    setNewScripture("");
    setNewWorshipOrderText("");
    setNewChurchNews("");
    setNewScheduleTitle(formatDefaultBulletinScheduleTitle(newDate));
    setNewChurchSchedule("");
    setNewCelebrationsText("");
    setPendingSourceFile(null);
    setParsedSourceName(null);
    setPage(1);
  }

  async function handleExtractHangulIntoExistingRow(
    bulId: string,
    file: File
  ) {
    setParsingHwp(true);
    try {
      const parsed = await parseHangulFileSilent(file);
      onUpdateBulletins(
        bulletins.map((b) => {
          if (b.id !== bulId) return b;
          const nextDate = parsed.date ?? b.date;
          const nextFull = parsed.fullContent || (b.fullContent ?? "");
          const split = splitBulletinNewsAndSchedule(nextFull, nextDate);
          const composedFull = composeBulletinFullContent(split, nextDate);
          return {
            ...b,
            title: parsed.title || b.title,
            date: nextDate,
            volume: parsed.volume ?? b.volume,
            sermonTitle: parsed.sermonTitle ?? b.sermonTitle,
            scripture: parsed.scripture ?? b.scripture,
            preacher: parsed.preacher ?? b.preacher,
            worshipOrder:
              parsed.worshipOrder.length > 0
                ? parsed.worshipOrder
                : b.worshipOrder,
            celebrations:
              parsed.celebrations.length > 0
                ? parsed.celebrations
                : undefined,
            churchNews: split.churchNews || undefined,
            scheduleTitle: split.churchSchedule
              ? split.scheduleTitle
              : undefined,
            churchSchedule: split.churchSchedule || undefined,
            fullContent: composedFull || undefined,
          };
        })
      );
      onToast(
        `"${file.name}" 내용을 반영했습니다. 상단 [변경사항 저장하기]를 눌러 확정해 주세요.`
      );
    } catch (err: unknown) {
      onError(
        err instanceof Error
          ? err.message
          : "한글 파일 분석 중 오류가 발생했습니다."
      );
    } finally {
      setParsingHwp(false);
    }
  }

  function handleToggleSelectPage() {
    if (allPageSelected) {
      const pageSet = new Set(pageItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...pageItems.map((i) => i.id)]);
      setSelectedIds([...merged]);
    }
  }

  async function handleBulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    const removeSet = new Set(selectedIds);
    const remaining = bulletins.filter((b) => !removeSet.has(b.id));
    setSelectedIds([]);
    setConfirmBulkDelete(false);
    await onSaveImmediate(
      {
        ...draft,
        bulletins: remaining,
      },
      `선택한 주보 ${removeSet.size}호가 삭제되었습니다.`
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5 shadow-xs">
      {/* Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h2 className="text-lg sm:text-xl font-black text-[#1a2744]">
          주보 안내 ({bulletins.length}호)
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setComposerOpen((prev) => !prev)}
            className="px-3.5 py-1.5 rounded-full border border-[#2E7D32] text-[#2E7D32] hover:bg-[#E8F5E9] text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            {composerOpen ? "직접 작성창 접기 ▲" : "+ 직접 작성 및 개별 확인 ▼"}
          </button>
          <Link
            href="/news/bulletin"
            target="_blank"
            className="px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
          >
            주보 화면 보기 ↗
          </Link>
        </div>
      </div>

      {/* Primary Action: 1-Click Bulk / Multi-File HWP Upload */}
      <div className="rounded-2xl bg-[#F8FAF8] border border-[#2E7D32]/30 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-black text-[#1a2744]">
              한글 주보 파일 바로 등록 (여러 파일 동시 선택 가능)
            </h3>
            <p className="text-xs text-gray-500">
              한글 파일(.hwp, .hwpx)을 한 개 또는 여러 개 한꺼번에 선택하면 날짜순으로 자동 등록됩니다.
            </p>
          </div>

          <label
            className={`px-5 py-3 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black text-center cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              parsingHwp || saving ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {bulkProgress
              ? "일괄 등록 중..."
              : "+ 주보 파일 선택 (1개 또는 여러 개)"}
            <input
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                await handleBulkUploadAndRegister(files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoAttachOriginalFile}
            onChange={(e) => setAlsoAttachOriginalFile(e.target.checked)}
            className="rounded border-gray-300 text-[#2E7D32]"
          />
          <span>원본 한글 파일 다운로드 버튼도 함께 첨부</span>
        </label>

        {bulkProgress && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-xs sm:text-sm font-bold text-blue-900">
            {bulkProgress}
          </div>
        )}
      </div>

      {/* Optional Single-Item Preview / Manual Composer */}
      {composerOpen && (
        <div className="rounded-2xl bg-[#F8FAF8] border border-gray-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl p-3.5 border border-gray-200">
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-[#1a2744]">
                개별 파일 내용 미리 확인 후 등록
              </p>
              {parsedSourceName && (
                <p className="text-xs font-bold text-[#2E7D32]">
                  불러온 파일: {parsedSourceName}
                </p>
              )}
            </div>

            <label
              className={`shrink-0 px-4 py-2 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold cursor-pointer transition-colors text-center ${
                parsingHwp ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {parsingHwp ? "분석 중..." : "한글 파일 1개 불러오기"}
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleSelectHangulForComposer(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="주보 제목"
              className="lg:col-span-2 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-bold"
            />
            <input
              type="date"
              aria-label="주보 예배일"
              value={newDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setNewDate(nextDate);
                if (isAutoBulletinDateTitle(newTitle)) {
                  setNewTitle(formatBulletinDateTitle(nextDate));
                }
                if (isAutoBulletinVolume(newVolume)) {
                  setNewVolume(formatDefaultBulletinVolume(nextDate));
                }
                if (isAutoBulletinScheduleTitle(newScheduleTitle)) {
                  setNewScheduleTitle(
                    formatDefaultBulletinScheduleTitle(nextDate)
                  );
                }
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newVolume}
              onChange={(e) => setNewVolume(e.target.value)}
              placeholder="호수 (예: 2026-46)"
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newSermonTitle}
              onChange={(e) => setNewSermonTitle(e.target.value)}
              placeholder="설교 제목"
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newScripture}
              onChange={(e) => setNewScripture(e.target.value)}
              placeholder="성경 본문"
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-1.5">
              <label className="block text-xs font-extrabold text-[#1a2744]">
                예배 순서
              </label>
              <textarea
                rows={12}
                value={newWorshipOrderText}
                onChange={(e) => setNewWorshipOrderText(e.target.value)}
                placeholder="한 줄에 한 순서씩 입력"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
              />
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-1.5">
                <label className="block text-xs font-extrabold text-[#1a2744]">
                  교회 소식
                </label>
                <textarea
                  rows={4}
                  value={newChurchNews}
                  onChange={(e) => setNewChurchNews(e.target.value)}
                  placeholder={"1. 예배 안내: ...\n2. 모임 안내: ..."}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                />
              </div>

              <div className="rounded-xl border border-[#1a2744]/20 bg-white p-3.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-[#1a2744]">
                    교회 일정
                  </label>
                  <input
                    type="text"
                    aria-label="새 주보 교회 일정 제목"
                    value={newScheduleTitle}
                    onChange={(e) => setNewScheduleTitle(e.target.value)}
                    placeholder="예: 11월 교회 일정"
                    className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-[#1a2744] focus:bg-white focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
                <textarea
                  rows={3}
                  value={newChurchSchedule}
                  onChange={(e) => setNewChurchSchedule(e.target.value)}
                  placeholder={"• 11월 1일: 성례주일\n• 11월 15일: 추수감사절"}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                />
              </div>

              <div className="rounded-xl border border-[#2E7D32]/30 bg-white p-3.5 space-y-1.5">
                <label className="block text-xs font-extrabold text-[#2E7D32]">
                  축하합니다
                </label>
                <textarea
                  rows={2}
                  value={newCelebrationsText}
                  onChange={(e) => setNewCelebrationsText(e.target.value)}
                  placeholder={"생일: 홍길동 (11월 7일)\n결혼: 김일광, 박은혜 (11월 10일)"}
                  className="w-full rounded-lg border border-[#2E7D32]/40 bg-white px-3 py-1.5 text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">설교자:</span>
              <input
                type="text"
                value={newPreacher}
                onChange={(e) => setNewPreacher(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold w-44"
              />
            </div>

            <button
              type="button"
              disabled={saving || parsingHwp}
              onClick={() => void handlePublishNewBulletin()}
              className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-black transition-colors disabled:opacity-50"
            >
              주보 등록하기
            </button>
          </div>
        </div>
      )}

      {/* Filter, Search & Bulk-Delete Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a2744] mr-1 cursor-pointer">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={handleToggleSelectPage}
                className="rounded border-gray-300 text-[#2E7D32]"
              />
              <span>현재 페이지 선택 ({selectedIds.length})</span>
            </label>

            {["전체", ...availableYears].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setYearFilter(yr);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  yearFilter === yr
                    ? "bg-[#1a2744] text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-[#2E7D32]"
                }`}
              >
                {yr === "전체" ? "전체 연도" : `${yr}년`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="제목, 호수, 설교 말씀, 광고 검색..."
              className="w-full sm:w-64 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm focus:border-[#2E7D32] focus:outline-none"
            />
            {selectedIds.length > 0 &&
              (confirmBulkDelete ? (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-red-700">
                    {selectedIds.length}호 삭제?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleBulkDeleteSelected()}
                    className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold"
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(false)}
                    className="px-2.5 py-1 rounded bg-white text-gray-600 text-xs border border-gray-200"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
                >
                  선택 일괄 삭제 ({selectedIds.length})
                </button>
              ))}
          </div>
        </div>

        {/* Compact Bulletin Rows */}
        {pageItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            조건에 해당하는 주보가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {pageItems.map((bul) => {
              const isExpanded = expandedId === bul.id;
              const isChecked = selectedIds.includes(bul.id);
              const bulParts = resolveBulletinParts(bul);

              return (
                <div
                  key={bul.id}
                  className={`p-3.5 transition-colors ${
                    isExpanded ? "bg-[#F8FAF8]" : "bg-white hover:bg-gray-50/70"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(bul.id)
                              ? prev.filter((id) => id !== bul.id)
                              : [...prev, bul.id]
                          )
                        }
                        className="w-4 h-4 rounded border-gray-300 text-[#2E7D32] shrink-0"
                      />
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold shrink-0">
                        {bul.volume}
                      </span>
                      <span className="text-xs text-gray-400 font-mono shrink-0">
                        {bul.date}
                      </span>
                      <span className="font-bold text-sm text-[#1a2744] truncate">
                        {bul.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-6 sm:pl-0">
                      {bulParts.churchNews.trim().length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px] font-semibold">
                          소식
                        </span>
                      )}
                      {bulParts.churchSchedule.trim().length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[#1a2744] text-[11px] font-semibold">
                          일정
                        </span>
                      )}
                      {bul.celebrations && bul.celebrations.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-semibold">
                          축하
                        </span>
                      )}
                      {(bul.fileUrl || (bul.imageUrls && bul.imageUrls.length > 0)) && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                          첨부
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : bul.id)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isExpanded
                            ? "bg-[#1a2744] text-white"
                            : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                        }`}
                      >
                        {isExpanded ? "닫기 ▲" : "수정 ▼"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `"${bul.title}" 주보를 삭제하시겠습니까?`
                            )
                          ) {
                            return;
                          }
                          const remaining = bulletins.filter(
                            (b) => b.id !== bul.id
                          );
                          void onSaveImmediate(
                            {
                              ...draft,
                              bulletins: remaining,
                            },
                            `"${bul.title}" 주보가 삭제되었습니다.`
                          );
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3.5 pt-3.5 border-t border-gray-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                        <input
                          type="text"
                          value={bul.title}
                          placeholder="주보 제목"
                          onChange={(e) =>
                            onUpdateBulletins(
                              bulletins.map((b) =>
                                b.id === bul.id
                                  ? { ...b, title: e.target.value }
                                  : b
                              )
                            )
                          }
                          className="lg:col-span-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold"
                        />
                        <input
                          type={
                            /^\d{4}-\d{2}-\d{2}$/.test(bul.date)
                              ? "date"
                              : "text"
                          }
                          value={bul.date}
                          onChange={(e) => {
                            const nextDate = e.target.value;
                            onUpdateBulletins(
                              bulletins.map((b) =>
                                b.id === bul.id
                                  ? {
                                      ...b,
                                      date: nextDate,
                                      title: isAutoBulletinDateTitle(b.title)
                                        ? formatBulletinDateTitle(nextDate)
                                        : b.title,
                                      volume: isAutoBulletinVolume(b.volume)
                                        ? formatDefaultBulletinVolume(nextDate)
                                        : b.volume,
                                    }
                                  : b
                              )
                            );
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={bul.volume}
                          placeholder="호수"
                          onChange={(e) =>
                            onUpdateBulletins(
                              bulletins.map((b) =>
                                b.id === bul.id
                                  ? { ...b, volume: e.target.value }
                                  : b
                              )
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={bul.sermonTitle}
                          placeholder="설교 제목"
                          onChange={(e) =>
                            onUpdateBulletins(
                              bulletins.map((b) =>
                                b.id === bul.id
                                  ? { ...b, sermonTitle: e.target.value }
                                  : b
                              )
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={bul.scripture}
                          placeholder="성경 본문"
                          onChange={(e) =>
                            onUpdateBulletins(
                              bulletins.map((b) =>
                                b.id === bul.id
                                  ? { ...b, scripture: e.target.value }
                                  : b
                              )
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">
                          설교자:
                        </span>
                        <input
                          type="text"
                          value={bul.preacher ?? ""}
                          placeholder="예: 신점일 담임목사"
                          onChange={(e) =>
                            onUpdateBulletins(
                              bulletins.map((b) =>
                                b.id === bul.id
                                  ? { ...b, preacher: e.target.value }
                                  : b
                              )
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm w-48"
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
                        <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-1.5">
                          <label className="block text-xs font-extrabold text-[#1a2744]">
                            예배 순서
                          </label>
                          <textarea
                            rows={12}
                            value={(bul.worshipOrder ?? []).join("\n")}
                            onChange={(e) =>
                              onUpdateBulletins(
                                bulletins.map((b) =>
                                  b.id === bul.id
                                    ? {
                                        ...b,
                                        worshipOrder:
                                          e.target.value.length > 0
                                            ? e.target.value.split("\n")
                                            : undefined,
                                      }
                                    : b
                                )
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                          />
                        </div>

                        <div className="space-y-2.5">
                          <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-1.5">
                            <label className="block text-xs font-extrabold text-[#1a2744]">
                              교회 소식
                            </label>
                            <textarea
                              rows={4}
                              value={bulParts.churchNews}
                              placeholder={"1. 예배 안내: ...\n2. 모임 안내: ..."}
                              onChange={(e) => {
                                const nextNews = e.target.value;
                                onUpdateBulletins(
                                  bulletins.map((b) => {
                                    if (b.id !== bul.id) return b;
                                    const cur = resolveBulletinParts(b);
                                    const composed = composeBulletinFullContent(
                                      {
                                        churchNews: nextNews,
                                        scheduleTitle: cur.scheduleTitle,
                                        churchSchedule: cur.churchSchedule,
                                      },
                                      b.date
                                    );
                                    return {
                                      ...b,
                                      churchNews: nextNews,
                                      fullContent: composed || undefined,
                                    };
                                  })
                                );
                              }}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                            />
                          </div>

                          <div className="rounded-xl border border-[#1a2744]/20 bg-white p-3.5 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="text-xs font-extrabold text-[#1a2744]">
                                교회 일정
                              </label>
                              <input
                                type="text"
                                aria-label="교회 일정 제목"
                                value={bulParts.scheduleTitle}
                                placeholder="예: 7월 교회 일정"
                                onChange={(e) => {
                                  const nextSchedTitle = e.target.value;
                                  onUpdateBulletins(
                                    bulletins.map((b) => {
                                      if (b.id !== bul.id) return b;
                                      const cur = resolveBulletinParts(b);
                                      const composed = composeBulletinFullContent(
                                        {
                                          churchNews: cur.churchNews,
                                          scheduleTitle: nextSchedTitle,
                                          churchSchedule: cur.churchSchedule,
                                        },
                                        b.date
                                      );
                                      return {
                                        ...b,
                                        scheduleTitle: nextSchedTitle,
                                        fullContent: composed || undefined,
                                      };
                                    })
                                  );
                                }}
                                className="w-40 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-[#1a2744] focus:bg-white focus:border-[#2E7D32] focus:outline-none"
                              />
                            </div>
                            <textarea
                              rows={3}
                              value={bulParts.churchSchedule}
                              placeholder={"• 7월 3-4일: 청년부 수련회\n• 7월 12일: 제직회"}
                              onChange={(e) => {
                                const nextSched = e.target.value;
                                onUpdateBulletins(
                                  bulletins.map((b) => {
                                    if (b.id !== bul.id) return b;
                                    const cur = resolveBulletinParts(b);
                                    const composed = composeBulletinFullContent(
                                      {
                                        churchNews: cur.churchNews,
                                        scheduleTitle: cur.scheduleTitle,
                                        churchSchedule: nextSched,
                                      },
                                      b.date
                                    );
                                    return {
                                      ...b,
                                      churchSchedule: nextSched,
                                      fullContent: composed || undefined,
                                    };
                                  })
                                );
                              }}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed"
                            />
                          </div>

                          <div className="rounded-xl border border-[#2E7D32]/30 bg-white p-3.5 space-y-1.5">
                            <label className="block text-xs font-extrabold text-[#2E7D32]">
                              축하합니다
                            </label>
                            <textarea
                              rows={2}
                              value={(bul.celebrations ?? []).join("\n")}
                              placeholder={"생일: 홍길동 (7월 6일)\n결혼: 김일광, 박은혜 (7월 10일)"}
                              onChange={(e) => {
                                const nextVal = e.target.value;
                                onUpdateBulletins(
                                  bulletins.map((b) =>
                                    b.id === bul.id
                                      ? {
                                          ...b,
                                          celebrations:
                                            nextVal.trim().length > 0
                                              ? nextVal.split("\n")
                                              : undefined,
                                        }
                                      : b
                                  )
                                );
                              }}
                              className="w-full rounded-lg border border-[#2E7D32]/40 bg-white px-3 py-1.5 text-sm leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                        <label className="px-3 py-1.5 rounded-lg bg-[#1a2744] hover:bg-[#2E7D32] text-white font-bold cursor-pointer">
                          한글 파일에서 다시 불러오기
                          <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              await handleExtractHangulIntoExistingRow(
                                bul.id,
                                file
                              );
                              e.target.value = "";
                            }}
                          />
                        </label>

                        <label className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold cursor-pointer">
                          원본 파일 첨부 (선택)
                          <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const uploaded = await onUploadAsset(
                                file,
                                "bulletins",
                                file.name
                              );
                              if (uploaded) {
                                onUpdateBulletins(
                                  bulletins.map((b) =>
                                    b.id === bul.id
                                      ? {
                                          ...b,
                                          fileUrl: uploaded.url,
                                          fileName: uploaded.fileName,
                                        }
                                      : b
                                  )
                                );
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>

                        {bul.fileUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateBulletins(
                                bulletins.map((b) =>
                                  b.id === bul.id
                                    ? {
                                        ...b,
                                        fileUrl: undefined,
                                        fileName: undefined,
                                      }
                                    : b
                                )
                              )
                            }
                            className="text-red-600 underline font-semibold"
                          >
                            첨부파일 해제 ({bul.fileName})
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setExpandedId(null);
                            void onSaveImmediate(
                              draft,
                              `"${bul.title}" 주보 수정사항이 저장되었습니다.`
                            );
                          }}
                          className="ml-auto px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black transition-colors disabled:opacity-60"
                        >
                          수정 내용 저장
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AdminPaginationBar
          currentPage={safePage}
          totalItems={filteredBulletins.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemUnit="호"
        />
      </div>
    </div>
  );
}
