"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPaginationBar } from "@/components/AdminPaginationBar";
import {
  applyAllBulletinFixes,
  applyBulletinIssueFix,
  type BulletinCheckInput,
  type BulletinIssue,
  highlightTextWithMatches,
  inspectBulletinDraft,
} from "@/lib/bulletin-typo-checker";
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

function HighlightedText({
  text,
  terms,
}: {
  readonly text: string;
  readonly terms: readonly string[];
}) {
  const segments = useMemo(
    () => highlightTextWithMatches(text, terms),
    [text, terms]
  );
  return (
    <>
      {segments.map((seg, idx) =>
        seg.highlighted ? (
          <mark
            key={idx}
            className="bg-amber-200 text-amber-950 font-black px-1 rounded"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={idx}>{seg.text}</span>
        )
      )}
    </>
  );
}

function BulletinProofreadPanel({
  issues,
  onApplySingleFix,
  onApplyAllFixes,
}: {
  readonly issues: readonly BulletinIssue[];
  readonly onApplySingleFix: (issue: BulletinIssue) => void;
  readonly onApplyAllFixes: () => void;
}) {
  const fixableIssues = issues.filter(
    (item) =>
      item.matchedText !== undefined &&
      item.suggestedText !== undefined &&
      item.matchedText !== item.suggestedText
  );

  if (issues.length === 0) {
    return (
      <div className="rounded-2xl bg-[#E8F5E9] border border-[#2E7D32]/40 px-4 sm:px-5 py-3.5">
        <p className="text-sm sm:text-base font-black text-[#1B5E20]">
          자동 점검 완료 — 발견된 맞춤법 및 날짜 이상 없음
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-amber-50 border-2 border-amber-400 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm sm:text-base font-black text-amber-950">
            확인할 항목 {issues.length}건
          </p>
          <p className="text-xs sm:text-sm text-amber-900/85 mt-0.5">
            오른쪽 버튼으로 바로 수정하거나 의도한 표현이면 그대로 게시하시면 됩니다.
          </p>
        </div>

        {fixableIssues.length > 0 && (
          <button
            type="button"
            onClick={onApplyAllFixes}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-black shadow-xs transition-colors shrink-0"
          >
            오타 {fixableIssues.length}건 한 번에 고치기
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {issues.map((issue) => {
          const canFix =
            issue.matchedText !== undefined &&
            issue.suggestedText !== undefined &&
            issue.matchedText !== issue.suggestedText;
          return (
            <li
              key={issue.id}
              className="rounded-xl bg-white border border-amber-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm min-w-0 flex-1">
                <span
                  className={`px-2.5 py-0.5 rounded-md font-extrabold shrink-0 ${
                    issue.severity === "warning"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {issue.fieldLabel}
                </span>
                <span className="font-bold text-gray-800 break-keep">
                  {issue.message}
                </span>
              </div>

              {canFix && (
                <button
                  type="button"
                  onClick={() => onApplySingleFix(issue)}
                  className="px-3 py-1.5 rounded-lg bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-black whitespace-nowrap shrink-0 transition-colors"
                >
                  {issue.suggestedText === ""
                    ? `'${issue.matchedText}' 지우기`
                    : `'${issue.matchedText}' → '${issue.suggestedText}' 고치기`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
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

  // Bulk Upload & Single Pre-Publish Review Composer States
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [alsoAttachOriginalFile, setAlsoAttachOriginalFile] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(true);
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

  const composerCheckInput: BulletinCheckInput = useMemo(
    () => ({
      date: newDate,
      volume: newVolume,
      sermonTitle: newSermonTitle,
      scripture: newScripture,
      preacher: newPreacher,
      worshipOrderText: newWorshipOrderText,
      churchNews: newChurchNews,
      scheduleTitle: newScheduleTitle,
      churchSchedule: newChurchSchedule,
      celebrationsText: newCelebrationsText,
    }),
    [
      newDate,
      newVolume,
      newSermonTitle,
      newScripture,
      newPreacher,
      newWorshipOrderText,
      newChurchNews,
      newScheduleTitle,
      newChurchSchedule,
      newCelebrationsText,
    ]
  );

  const composerIssues = useMemo(
    () => inspectBulletinDraft(composerCheckInput, bulletins),
    [composerCheckInput, bulletins]
  );

  const composerHighlightTerms = useMemo(
    () =>
      composerIssues
        .map((item) => item.matchedText ?? "")
        .filter((t) => t.trim().length > 0),
    [composerIssues]
  );

  function applyFixedInputToComposer(next: BulletinCheckInput) {
    setNewDate(next.date);
    setNewVolume(next.volume);
    setNewSermonTitle(next.sermonTitle);
    setNewScripture(next.scripture);
    setNewPreacher(next.preacher);
    setNewWorshipOrderText(next.worshipOrderText);
    setNewChurchNews(next.churchNews);
    setNewScheduleTitle(next.scheduleTitle);
    setNewChurchSchedule(next.churchSchedule);
    setNewCelebrationsText(next.celebrationsText);
  }

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

    // When a single weekly bulletin is selected, open the pre-publish typo review first!
    if (selectedFiles.length === 1) {
      await handleSelectHangulForComposer(selectedFiles[0]!);
      return;
    }

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
      setShowLivePreview(true);

      const resolvedDate = parsed.date ?? newDate;
      setNewDate(resolvedDate);
      setNewTitle(formatBulletinDateTitle(resolvedDate));
      setNewVolume(parsed.volume ?? formatDefaultBulletinVolume(resolvedDate));
      setNewSermonTitle(parsed.sermonTitle ?? "");
      setNewScripture(parsed.scripture ?? "");
      setNewPreacher(
        parsed.preacher || `${draft.pastorProfile.name} 담임목사`
      );
      setNewWorshipOrderText(
        parsed.worshipOrder.length > 0 ? parsed.worshipOrder.join("\n") : ""
      );
      const split = splitBulletinNewsAndSchedule(
        parsed.fullContent,
        resolvedDate
      );
      setNewChurchNews(split.churchNews);
      setNewScheduleTitle(split.scheduleTitle);
      setNewChurchSchedule(split.churchSchedule);
      setNewCelebrationsText(parsed.celebrations.join("\n"));

      onToast(
        `"${file.name}" 주보를 불러왔습니다. 아래에서 오탈자를 확인하신 뒤 [확인 완료 — 주보 게시하기]를 눌러 주세요.`
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

    await onSaveImmediate(nextContent, `"${created.title}"가 홈페이지에 게시되었습니다.`);

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
    setComposerOpen(false);
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
        `"${file.name}" 내용을 불러왔습니다. 오탈자를 확인한 뒤 아래 [수정 내용 저장]을 눌러 확정해 주세요.`
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

  function applyEditedInputToRow(bul: BulletinItem, next: BulletinCheckInput) {
    const composed = composeBulletinFullContent(
      {
        churchNews: next.churchNews,
        scheduleTitle: next.scheduleTitle,
        churchSchedule: next.churchSchedule,
      },
      next.date
    );
    onUpdateBulletins(
      bulletins.map((b) =>
        b.id === bul.id
          ? {
              ...b,
              date: next.date,
              volume: next.volume,
              sermonTitle: next.sermonTitle,
              scripture: next.scripture,
              preacher: next.preacher,
              worshipOrder:
                next.worshipOrderText.length > 0
                  ? next.worshipOrderText.split("\n")
                  : undefined,
              churchNews: next.churchNews || undefined,
              scheduleTitle: next.churchSchedule
                ? next.scheduleTitle
                : undefined,
              churchSchedule: next.churchSchedule || undefined,
              fullContent: composed || undefined,
              celebrations:
                next.celebrationsText.trim().length > 0
                  ? next.celebrationsText.split("\n")
                  : undefined,
            }
          : b
      )
    );
  }

  const previewWorshipLines = newWorshipOrderText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const previewNewsLines = newChurchNews
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const previewScheduleLines = newChurchSchedule
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const previewCelebrationLines = newCelebrationsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5 shadow-xs">
      {/* Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h2 className="text-xl sm:text-2xl font-black text-[#1a2744]">
          주보 올리기 ({bulletins.length}호)
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setComposerOpen((prev) => !prev)}
            className="px-4 py-2 rounded-full border border-[#2E7D32] text-[#2E7D32] hover:bg-[#E8F5E9] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
          >
            {composerOpen ? "작성창 닫기" : "직접 입력"}
          </button>
          <Link
            href="/news/bulletin"
            target="_blank"
            className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
          >
            주보 화면 보기
          </Link>
        </div>
      </div>

      {/* Primary Action: Weekly HWP Upload */}
      <div className="rounded-2xl bg-[#F8FAF8] border-2 border-[#2E7D32]/35 p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-[#1a2744]">
              이번 주 한글 주보 선택 (.hwp, .hwpx)
            </h3>
            <p className="text-xs sm:text-sm text-gray-600">
              파일을 고르면 게시 전에 내용을 먼저 확인할 수 있습니다.
            </p>
          </div>

          <label
            className={`px-6 py-3.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm sm:text-base font-black text-center cursor-pointer whitespace-nowrap shrink-0 shadow-sm transition-colors ${
              parsingHwp || saving ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {parsingHwp
              ? "주보 분석 중..."
              : bulkProgress
                ? "일괄 등록 중..."
                : "한글 파일 선택하기"}
            <input
              type="file"
              multiple
              accept=".hwp,.hwpx,.docx,.txt"
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

        <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700 font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={alsoAttachOriginalFile}
            onChange={(e) => setAlsoAttachOriginalFile(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#2E7D32]"
          />
          <span>원본 한글 파일도 함께 첨부</span>
        </label>

        {bulkProgress && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs sm:text-sm font-bold text-blue-900">
            {bulkProgress}
          </div>
        )}
      </div>

      {/* Step 2 & 3: Pre-Publish Typo Check, Editable Fields, and Highlighted Live Preview */}
      {composerOpen && (
        <div className="rounded-2xl bg-[#F8FAF8] border-2 border-[#1a2744]/20 p-4 sm:p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl p-4 border border-gray-200">
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#1a2744] text-white text-xs font-extrabold">
                  게시 전 확인
                </span>
                <p className="text-sm sm:text-base font-black text-[#1a2744]">
                  내용 확인 후 맨 아래 [주보 게시하기]를 눌러 주세요
                </p>
              </div>
              {parsedSourceName && (
                <p className="text-xs sm:text-sm font-bold text-[#2E7D32]">
                  파일: {parsedSourceName}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label
                className={`px-4 py-2 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs sm:text-sm font-bold cursor-pointer transition-colors text-center ${
                  parsingHwp ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {parsingHwp ? "분석 중..." : "다른 한글 파일 다시 선택"}
                <input
                  type="file"
                  accept=".hwp,.hwpx,.docx,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleSelectHangulForComposer(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setShowLivePreview((prev) => !prev)}
                className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold transition-colors ${
                  showLivePreview
                    ? "bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20]"
                    : "bg-white border-gray-300 text-gray-700"
                }`}
              >
                {showLivePreview ? "큰글씨 미리보기 숨기기" : "큰글씨 미리보기 켜기"}
              </button>
            </div>
          </div>

          {/* Automated Korean & Church Bulletin Proofread Report */}
          <BulletinProofreadPanel
            issues={composerIssues}
            onApplySingleFix={(issue) =>
              applyFixedInputToComposer(
                applyBulletinIssueFix(composerCheckInput, issue)
              )
            }
            onApplyAllFixes={() =>
              applyFixedInputToComposer(
                applyAllBulletinFixes(composerCheckInput, composerIssues)
              )
            }
          />

          {/* Editable Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-xs font-extrabold text-gray-600 mb-1">
                주보 제목
              </label>
              <input
                type="text"
                lang="ko"
                spellCheck={true}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="주보 제목"
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm sm:text-base font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-600 mb-1">
                주일 예배일
              </label>
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
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-600 mb-1">
                권호수
              </label>
              <input
                type="text"
                value={newVolume}
                onChange={(e) => setNewVolume(e.target.value)}
                placeholder="예: 제 55-47호"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-600 mb-1">
                설교 제목
              </label>
              <input
                type="text"
                lang="ko"
                spellCheck={true}
                value={newSermonTitle}
                onChange={(e) => setNewSermonTitle(e.target.value)}
                placeholder="이번 주 설교 제목"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-gray-600 mb-1">
                성경 본문
              </label>
              <input
                type="text"
                lang="ko"
                spellCheck={true}
                value={newScripture}
                onChange={(e) => setNewScripture(e.target.value)}
                placeholder="예: 요한복음 3:16"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <label className="block text-sm font-extrabold text-[#1a2744]">
                예배 순서 (틀린 글자가 있으면 바로 고치세요)
              </label>
              <textarea
                rows={13}
                lang="ko"
                spellCheck={true}
                value={newWorshipOrderText}
                onChange={(e) => setNewWorshipOrderText(e.target.value)}
                placeholder="한 줄에 한 순서씩 입력"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm sm:text-base leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
                <label className="block text-sm font-extrabold text-[#1a2744]">
                  교회 소식
                </label>
                <textarea
                  rows={5}
                  lang="ko"
                  spellCheck={true}
                  value={newChurchNews}
                  onChange={(e) => setNewChurchNews(e.target.value)}
                  placeholder={"1. 예배 안내: ...\n2. 모임 안내: ..."}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm sm:text-base leading-relaxed"
                />
              </div>

              <div className="rounded-xl border border-[#1a2744]/20 bg-white p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-extrabold text-[#1a2744]">
                    교회 일정
                  </label>
                  <input
                    type="text"
                    lang="ko"
                    spellCheck={true}
                    aria-label="새 주보 교회 일정 제목"
                    value={newScheduleTitle}
                    onChange={(e) => setNewScheduleTitle(e.target.value)}
                    placeholder="예: 11월 교회 일정"
                    className="w-44 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs sm:text-sm font-bold text-[#1a2744] focus:bg-white focus:border-[#2E7D32] focus:outline-none"
                  />
                </div>
                <textarea
                  rows={3}
                  lang="ko"
                  spellCheck={true}
                  value={newChurchSchedule}
                  onChange={(e) => setNewChurchSchedule(e.target.value)}
                  placeholder={"• 11월 1일: 성례주일\n• 11월 15일: 추수감사절"}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm sm:text-base leading-relaxed"
                />
              </div>

              <div className="rounded-xl border border-[#2E7D32]/30 bg-white p-4 space-y-2">
                <label className="block text-sm font-extrabold text-[#2E7D32]">
                  축하합니다 (성도 성함 오타 확인)
                </label>
                <textarea
                  rows={2}
                  lang="ko"
                  spellCheck={true}
                  value={newCelebrationsText}
                  onChange={(e) => setNewCelebrationsText(e.target.value)}
                  placeholder={"생일: 홍길동 (11월 7일)\n결혼: 김일광, 박은혜 (11월 10일)"}
                  className="w-full rounded-lg border border-[#2E7D32]/40 bg-white px-3.5 py-2 text-sm sm:text-base leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Large-Print Highlighted Congregation Preview */}
          {showLivePreview && (
            <div className="rounded-2xl bg-white border-2 border-[#2E7D32]/30 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <span className="text-xs font-extrabold text-[#2E7D32]">
                    실제 성도 화면 큰글씨 미리보기
                  </span>
                  <h4 className="text-lg sm:text-xl font-black text-[#1a2744] mt-0.5">
                    {newTitle || formatBulletinDateTitle(newDate)}{" "}
                    <span className="text-sm font-bold text-gray-500">
                      ({newVolume || formatDefaultBulletinVolume(newDate)})
                    </span>
                  </h4>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-500">
                  노란 형광펜 표시는 점검 제안 단어입니다
                </span>
              </div>

              <div className="rounded-xl bg-[#F8FAF8] border border-[#2E7D32]/20 p-4 space-y-1">
                <p className="text-xs font-extrabold text-[#2E7D32]">
                  주일 강단 말씀
                </p>
                <p className="text-lg sm:text-xl font-black text-[#1a2744] break-keep">
                  &ldquo;
                  <HighlightedText
                    text={newSermonTitle || "(설교 제목 미입력)"}
                    terms={composerHighlightTerms}
                  />
                  &rdquo;
                </p>
                <p className="text-sm sm:text-base text-gray-700 font-semibold">
                  성경 본문:{" "}
                  <HighlightedText
                    text={newScripture || "(성경 본문 미입력)"}
                    terms={composerHighlightTerms}
                  />{" "}
                  / 설교:{" "}
                  <HighlightedText
                    text={newPreacher || "(설교자 미입력)"}
                    terms={composerHighlightTerms}
                  />
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm sm:text-base leading-relaxed">
                <div className="rounded-xl border border-gray-200 p-4 space-y-2">
                  <p className="font-black text-[#1a2744] border-b border-gray-100 pb-1.5">
                    예배 순서
                  </p>
                  {previewWorshipLines.length === 0 ? (
                    <p className="text-gray-400 text-sm">입력된 예배 순서 없음</p>
                  ) : (
                    <ol className="space-y-1.5 text-gray-800">
                      {previewWorshipLines.map((line, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-bold text-[#2E7D32] shrink-0">
                            {i + 1}.
                          </span>
                          <span className="break-keep">
                            <HighlightedText
                              text={line}
                              terms={composerHighlightTerms}
                            />
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-200 p-4 space-y-1.5">
                    <p className="font-black text-[#1a2744] border-b border-gray-100 pb-1.5">
                      교회 소식
                    </p>
                    {previewNewsLines.length === 0 ? (
                      <p className="text-gray-400 text-sm">입력된 소식 없음</p>
                    ) : (
                      previewNewsLines.map((line, i) => (
                        <p key={i} className="text-gray-800 break-keep">
                          <HighlightedText
                            text={line}
                            terms={composerHighlightTerms}
                          />
                        </p>
                      ))
                    )}
                  </div>

                  {previewScheduleLines.length > 0 && (
                    <div className="rounded-xl border border-gray-200 p-4 space-y-1.5">
                      <p className="font-black text-[#1a2744] border-b border-gray-100 pb-1.5">
                        <HighlightedText
                          text={newScheduleTitle || "교회 일정"}
                          terms={composerHighlightTerms}
                        />
                      </p>
                      {previewScheduleLines.map((line, i) => (
                        <p key={i} className="text-gray-800 break-keep">
                          <HighlightedText
                            text={line}
                            terms={composerHighlightTerms}
                          />
                        </p>
                      ))}
                    </div>
                  )}

                  {previewCelebrationLines.length > 0 && (
                    <div className="rounded-xl bg-[#F8FAF8] border border-[#2E7D32]/25 p-4 space-y-1.5">
                      <p className="font-black text-[#2E7D32] border-b border-[#2E7D32]/15 pb-1.5">
                        축하합니다
                      </p>
                      {previewCelebrationLines.map((line, i) => (
                        <p key={i} className="text-gray-800 font-semibold break-keep">
                          <HighlightedText
                            text={line}
                            terms={composerHighlightTerms}
                          />
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-gray-700">
                설교자:
              </span>
              <input
                type="text"
                lang="ko"
                spellCheck={true}
                value={newPreacher}
                onChange={(e) => setNewPreacher(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm sm:text-base font-semibold w-48"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setComposerOpen(false);
                  setPendingSourceFile(null);
                  setParsedSourceName(null);
                }}
                className="px-4 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving || parsingHwp}
                onClick={() => void handlePublishNewBulletin()}
                className="px-6 py-3 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm sm:text-base font-black shadow-md transition-colors disabled:opacity-50"
              >
                주보 게시하기
              </button>
            </div>
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
              const rowCheckInput: BulletinCheckInput | null = isExpanded
                ? {
                    currentId: bul.id,
                    date: bul.date,
                    volume: bul.volume,
                    sermonTitle: bul.sermonTitle,
                    scripture: bul.scripture,
                    preacher: bul.preacher ?? "",
                    worshipOrderText: (bul.worshipOrder ?? []).join("\n"),
                    churchNews: bulParts.churchNews,
                    scheduleTitle: bulParts.scheduleTitle,
                    churchSchedule: bulParts.churchSchedule,
                    celebrationsText: (bul.celebrations ?? []).join("\n"),
                  }
                : null;
              const rowIssues = rowCheckInput
                ? inspectBulletinDraft(rowCheckInput, bulletins)
                : [];

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
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold shrink-0">
                        {bul.volume}
                      </span>
                      <span className="text-xs text-gray-500 font-mono shrink-0">
                        {bul.date}
                      </span>
                      <span className="font-bold text-sm sm:text-base text-[#1a2744] truncate">
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
                      {(bul.fileUrl ||
                        (bul.imageUrls && bul.imageUrls.length > 0)) && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">
                          첨부
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : bul.id)
                        }
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isExpanded
                            ? "bg-[#1a2744] text-white"
                            : "bg-[#F4F7F5] text-[#1a2744] hover:bg-gray-200"
                        }`}
                      >
                        {isExpanded ? "닫기 ▲" : "오탈자 점검 및 수정 ▼"}
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

                  {isExpanded && rowCheckInput && (
                    <div className="mt-3.5 pt-3.5 border-t border-gray-200 space-y-3.5">
                      <BulletinProofreadPanel
                        issues={rowIssues}
                        onApplySingleFix={(issue) =>
                          applyEditedInputToRow(
                            bul,
                            applyBulletinIssueFix(rowCheckInput, issue)
                          )
                        }
                        onApplyAllFixes={() =>
                          applyEditedInputToRow(
                            bul,
                            applyAllBulletinFixes(rowCheckInput, rowIssues)
                          )
                        }
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                        <input
                          type="text"
                          lang="ko"
                          spellCheck={true}
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
                          lang="ko"
                          spellCheck={true}
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
                          lang="ko"
                          spellCheck={true}
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
                          lang="ko"
                          spellCheck={true}
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
                            lang="ko"
                            spellCheck={true}
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
                              lang="ko"
                              spellCheck={true}
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
                                lang="ko"
                                spellCheck={true}
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
                              lang="ko"
                              spellCheck={true}
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
                              lang="ko"
                              spellCheck={true}
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
                            accept=".hwp,.hwpx,.docx,.txt"
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
                          className="ml-auto px-4 py-2 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
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
