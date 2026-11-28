"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractBulletinSyncPlan,
  type ProposedBulletinBanner,
  type ProposedBulletinEvent,
  type ProposedBulletinPopup,
} from "@/lib/bulletin-sync-extractor";
import { findMatchingRegisteredEvent } from "@/lib/event-dedup";
import {
  createClientSafeId,
  formatEventBadgesFromIsoDate,
  getKstDateString,
} from "@/lib/format-utils";
import {
  buildSameYearQuarterlySlots,
  materializeQuarterlyEventItems,
} from "@/lib/quarterly-events";
import type {
  BulletinItem,
  EventItem,
  PopupItem,
  SiteContent,
} from "@/types/site-content";

interface BulletinSyncModalProps {
  readonly draft: SiteContent;
  readonly saving: boolean;
  readonly initialBulletinId?: string;
  readonly overrideBulletin?: BulletinItem;
  readonly autoPromptNotice?: string;
  readonly onClose: () => void;
  readonly onConfirmSave: (
    nextContent: SiteContent,
    toastMsg: string
  ) => Promise<void>;
  readonly onUploadImage: (
    file: File,
    label: string
  ) => Promise<{
    readonly url: string;
    readonly fileName: string;
    readonly sizeLabel: string;
  } | null>;
}

const POSTER_IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";

function ItemStatusPill({
  checked,
  alreadyExists,
  isPast,
}: {
  readonly checked: boolean;
  readonly alreadyExists: boolean;
  readonly isPast?: boolean;
}) {
  if (checked) {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-xs font-black shrink-0">
        추가 예정
      </span>
    );
  }
  if (alreadyExists) {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-bold shrink-0">
        이미 등록됨
      </span>
    );
  }
  if (isPast) {
    return (
      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold shrink-0">
        지난 일정
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold shrink-0">
      제외됨
    </span>
  );
}

export function BulletinSyncModal({
  draft,
  saving,
  initialBulletinId,
  overrideBulletin,
  autoPromptNotice,
  onClose,
  onConfirmSave,
  onUploadImage,
}: BulletinSyncModalProps) {
  const todayIso = getKstDateString();

  const availableBulletins = useMemo(() => {
    if (!overrideBulletin) return draft.bulletins;
    const rest = draft.bulletins.filter((b) => b.id !== overrideBulletin.id);
    return [overrideBulletin, ...rest];
  }, [draft.bulletins, overrideBulletin]);

  const initialTargetBulletin =
    (overrideBulletin
      ? overrideBulletin
      : initialBulletinId
        ? availableBulletins.find((b) => b.id === initialBulletinId)
        : undefined) ?? availableBulletins[0];

  const initialPlan = useMemo(
    () =>
      initialTargetBulletin
        ? extractBulletinSyncPlan(initialTargetBulletin, draft, todayIso)
        : null,
    // Compute once on mount for the initial target bulletin
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [selectedBulletinId, setSelectedBulletinId] = useState<string>(
    initialTargetBulletin?.id ?? ""
  );
  const [events, setEvents] = useState<readonly ProposedBulletinEvent[]>(
    initialPlan?.events ?? []
  );
  const [popups, setPopups] = useState<readonly ProposedBulletinPopup[]>(
    initialPlan?.popups ?? []
  );
  const [banners, setBanners] = useState<readonly ProposedBulletinBanner[]>(
    initialPlan?.banners ?? []
  );
  const [uploadingPopupKey, setUploadingPopupKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  function handleSelectBulletin(nextId: string) {
    setSelectedBulletinId(nextId);
    const found = availableBulletins.find((b) => b.id === nextId);
    if (!found) {
      setEvents([]);
      setPopups([]);
      setBanners([]);
      return;
    }
    const nextPlan = extractBulletinSyncPlan(found, draft, todayIso);
    setEvents(nextPlan.events);
    setPopups(nextPlan.popups);
    setBanners(nextPlan.banners);
  }

  const unregisteredEvents = events.filter((e) => !e.alreadyExists);
  const skippedRegisteredEvents = events.filter((e) => e.alreadyExists);
  const unregisteredPopups = popups.filter((p) => !p.alreadyExists);
  const skippedRegisteredPopups = popups.filter((p) => p.alreadyExists);
  const unregisteredBanners = banners.filter((b) => !b.alreadyExists);

  const checkedEvents = unregisteredEvents.filter(
    (e) => e.checked && e.title.trim() !== ""
  );
  const plannedEventAdditionsCount = checkedEvents.reduce((sum, ev) => {
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(ev.date.trim())
      ? ev.date.trim()
      : todayIso;
    if (!ev.quarterlyRepeat) {
      return findMatchingRegisteredEvent(
        draft.events,
        safeDate,
        ev.title.trim()
      )
        ? sum
        : sum + 1;
    }
    const missingCount = buildSameYearQuarterlySlots({
      anchorIsoDate: safeDate,
      baseTitle: ev.title.trim(),
      mode: "nth-weekday",
      existingEvents: draft.events,
    }).filter((s) => !s.alreadyExists).length;
    return sum + missingCount;
  }, 0);
  const checkedPopups = unregisteredPopups.filter(
    (p) =>
      p.checked &&
      (p.title.trim() !== "" ||
        p.content.trim() !== "" ||
        Boolean(p.imageUrl?.trim()))
  );
  const checkedBanners = unregisteredBanners.filter(
    (b) => b.checked && b.text.trim() !== ""
  );
  const totalCheckedCount =
    plannedEventAdditionsCount + checkedPopups.length + checkedBanners.length;

  const totalUnregisteredCount =
    unregisteredEvents.length +
    unregisteredPopups.length +
    unregisteredBanners.length;
  const totalCandidateCount = events.length + popups.length + banners.length;

  async function handleFinalConfirm() {
    if (totalCheckedCount === 0) return;

    let runningEvents: readonly EventItem[] = draft.events;
    const createdEvents: EventItem[] = [];

    for (const ev of checkedEvents) {
      const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(ev.date.trim())
        ? ev.date.trim()
        : todayIso;

      if (ev.quarterlyRepeat) {
        const quarterlyCreated = materializeQuarterlyEventItems({
          anchorIsoDate: safeDate,
          baseTitle: ev.title.trim(),
          timeText: ev.timeText.trim() || "오전 11:00",
          location: ev.location.trim() || "일광교회 본당",
          description: ev.description.trim(),
          mode: "nth-weekday",
          existingEvents: runningEvents,
        });
        createdEvents.push(...quarterlyCreated);
        runningEvents = [...quarterlyCreated, ...runningEvents];
      } else {
        if (
          findMatchingRegisteredEvent(
            runningEvents,
            safeDate,
            ev.title.trim()
          )
        ) {
          continue;
        }
        const badges = formatEventBadgesFromIsoDate(safeDate);
        const singleCreated: EventItem = {
          id: createClientSafeId("ev"),
          date: safeDate,
          dayBadge: badges.dayBadge,
          monthYearBadge: badges.monthYearBadge,
          title: ev.title.trim(),
          timeText: ev.timeText.trim() || "오전 11:00",
          location: ev.location.trim() || "일광교회 본당",
          description: ev.description.trim(),
        };
        createdEvents.push(singleCreated);
        runningEvents = [singleCreated, ...runningEvents];
      }
    }

    const createdPopups: PopupItem[] = checkedPopups.map((p) => ({
      id: createClientSafeId("popup"),
      title: p.title.trim(),
      content: p.content.trim(),
      imageUrl: p.imageUrl?.trim() || undefined,
      linkUrl: p.linkUrl.trim() || undefined,
      linkLabel: p.linkLabel.trim() || undefined,
      startDate: p.startDate.trim() || todayIso,
      endDate: p.endDate.trim() || undefined,
      isActive: true,
    }));

    const existingBannerSet = new Set(
      draft.topBannerNotices.map((line) => line.trim())
    );
    const addedBannerLines = checkedBanners
      .map((b) => b.text.trim())
      .filter((line) => Boolean(line) && !existingBannerSet.has(line));

    const nextContent: SiteContent = {
      ...draft,
      events:
        createdEvents.length > 0
          ? [...createdEvents, ...draft.events]
          : draft.events,
      popups:
        createdPopups.length > 0
          ? [...createdPopups, ...draft.popups]
          : draft.popups,
      topBannerNotices:
        addedBannerLines.length > 0
          ? [...addedBannerLines, ...draft.topBannerNotices]
          : draft.topBannerNotices,
    };

    const summaryParts: string[] = [];
    if (createdEvents.length > 0) {
      summaryParts.push(`행사 일정 ${createdEvents.length}건`);
    }
    if (createdPopups.length > 0) {
      summaryParts.push(`팝업 공지 ${createdPopups.length}건`);
    }
    if (addedBannerLines.length > 0) {
      summaryParts.push(`상단 알림 ${addedBannerLines.length}건`);
    }

    const toastMsg = `${summaryParts.join(", ")}이 홈페이지에 추가되었습니다.`;
    await onConfirmSave(nextContent, toastMsg);
    onClose();
  }

  const summarySegments: string[] = [];
  if (plannedEventAdditionsCount > 0) {
    summarySegments.push(`행사 일정 ${plannedEventAdditionsCount}건`);
  }
  if (checkedPopups.length > 0) {
    summarySegments.push(`팝업 공지 ${checkedPopups.length}건`);
  }
  if (checkedBanners.length > 0) {
    summarySegments.push(`상단 한 줄 알림 ${checkedBanners.length}건`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulletin-sync-modal-title"
      className="fixed inset-0 z-[130] bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[920px] max-h-[92dvh] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="bg-[#1a2744] text-white px-5 sm:px-7 py-4 sm:py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <h2
              id="bulletin-sync-modal-title"
              className="text-lg sm:text-2xl font-black tracking-tight"
            >
              주보 내용으로 일정 및 팝업 추가
            </h2>
            <p className="text-xs sm:text-sm text-white/80 font-medium">
              추가될 내용을 확인하시고 맨 아래 [최종 확인 후 추가하기]를 누르면 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-bold transition-colors shrink-0"
          >
            닫기
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F8FAF8]">
          {autoPromptNotice && (
            <div className="rounded-2xl bg-[#E8F5E9] border border-[#2E7D32]/40 px-4 py-3 text-xs sm:text-sm font-bold text-[#1B5E20]">
              {autoPromptNotice}
            </div>
          )}

          {availableBulletins.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-10 text-center text-sm sm:text-base font-bold text-gray-600">
              등록된 주보가 없습니다. 먼저 주보를 올려 주세요.
            </div>
          ) : (
            <>
              {/* Bulletin Source Selector */}
              <div className="rounded-2xl bg-white border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label
                  htmlFor="bulletin-sync-source-select"
                  className="text-sm font-black text-[#1a2744] shrink-0"
                >
                  기준 주보 선택
                </label>
                <select
                  id="bulletin-sync-source-select"
                  value={selectedBulletinId}
                  onChange={(e) => handleSelectBulletin(e.target.value)}
                  className="flex-1 sm:max-w-[560px] rounded-xl border-2 border-gray-300 bg-white px-3.5 py-2.5 text-sm sm:text-base font-bold text-[#1a2744] focus:border-[#2E7D32] focus:outline-none"
                >
                  {availableBulletins.map((bul) => (
                    <option key={bul.id} value={bul.id}>
                      {bul.date} — {bul.title} ({bul.volume})
                    </option>
                  ))}
                </select>
              </div>

              {totalCandidateCount === 0 ? (
                <div className="rounded-2xl bg-white border border-dashed border-gray-300 p-10 text-center space-y-1.5">
                  <p className="text-base font-black text-[#1a2744]">
                    이 주보에서 추출할 새 일정이나 행사 안내를 찾지 못했습니다.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">
                    위에서 다른 날짜의 주보를 선택해 확인하실 수 있습니다.
                  </p>
                </div>
              ) : totalUnregisteredCount === 0 ? (
                <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-2">
                  <p className="text-base sm:text-lg font-black text-[#1B5E20]">
                    이 주보의 행사 일정과 팝업 공지가 이미 모두 등록되어 있습니다.
                  </p>
                  {skippedRegisteredEvents.length > 0 && (
                    <p className="text-xs sm:text-sm text-gray-600">
                      등록 완료 일정:{" "}
                      {skippedRegisteredEvents
                        .map(
                          (ev) =>
                            `${ev.date} ${ev.matchedExistingTitle ?? ev.title}`
                        )
                        .join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* SECTION 1: EVENTS */}
                  <section className="rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-black text-[#1a2744]">
                          1. 행사 일정 추가
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-xs font-black">
                          선택 {plannedEventAdditionsCount}건
                        </span>
                      </div>
                      {unregisteredEvents.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEvents((prev) =>
                                prev.map((ev) => ({
                                  ...ev,
                                  checked: !ev.alreadyExists,
                                }))
                              )
                            }
                            className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700"
                          >
                            전체 선택
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEvents((prev) =>
                                prev.map((ev) => ({ ...ev, checked: false }))
                              )
                            }
                            className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-500"
                          >
                            선택 해제
                          </button>
                        </div>
                      )}
                    </div>

                    {unregisteredEvents.length === 0 ? (
                      <p className="text-sm font-semibold text-gray-600 py-1">
                        새로 추가할 행사 일정이 없습니다. (주보 속 일정은 모두 이미 등록되어 제외되었습니다.)
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {unregisteredEvents.map((ev) => (
                          <div
                            key={ev.key}
                            className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                              ev.checked
                                ? "border-[#2E7D32] bg-[#F8FAF8]"
                                : "border-gray-200 bg-white opacity-75"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ev.checked}
                                  onChange={(e) =>
                                    setEvents((prev) =>
                                      prev.map((item) =>
                                        item.key === ev.key
                                          ? {
                                              ...item,
                                              checked: e.target.checked,
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-5 h-5 rounded border-gray-300 text-[#2E7D32]"
                                />
                                <span className="text-sm sm:text-base font-black text-[#1a2744]">
                                  {ev.title || "행사 제목"}
                                </span>
                              </label>
                              <ItemStatusPill
                                checked={ev.checked}
                                alreadyExists={ev.alreadyExists}
                                isPast={ev.isPast}
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pl-0 sm:pl-7">
                              <input
                                type="date"
                                aria-label="행사 날짜"
                                value={ev.date}
                                onChange={(e) =>
                                  setEvents((prev) =>
                                    prev.map((item) =>
                                      item.key === ev.key
                                        ? { ...item, date: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold"
                              />
                              <input
                                type="text"
                                aria-label="행사 제목"
                                value={ev.title}
                                placeholder="행사명"
                                onChange={(e) =>
                                  setEvents((prev) =>
                                    prev.map((item) =>
                                      item.key === ev.key
                                        ? { ...item, title: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold"
                              />
                              <input
                                type="text"
                                aria-label="행사 시간"
                                value={ev.timeText}
                                placeholder="예배 및 모임 시간"
                                onChange={(e) =>
                                  setEvents((prev) =>
                                    prev.map((item) =>
                                      item.key === ev.key
                                        ? { ...item, timeText: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm"
                              />
                              <input
                                type="text"
                                aria-label="행사 장소"
                                value={ev.location}
                                placeholder="장소"
                                onChange={(e) =>
                                  setEvents((prev) =>
                                    prev.map((item) =>
                                      item.key === ev.key
                                        ? { ...item, location: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm"
                              />
                            </div>

                            <div className="pl-0 sm:pl-7 space-y-2">
                              <input
                                type="text"
                                aria-label="행사 상세 안내"
                                value={ev.description}
                                placeholder="강사 및 추가 안내 (선택)"
                                onChange={(e) =>
                                  setEvents((prev) =>
                                    prev.map((item) =>
                                      item.key === ev.key
                                        ? {
                                            ...item,
                                            description: e.target.value,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm"
                              />

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-[#1a2744] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={ev.quarterlyRepeat}
                                    onChange={(e) =>
                                      setEvents((prev) =>
                                        prev.map((item) =>
                                          item.key === ev.key
                                            ? {
                                                ...item,
                                                checked: e.target.checked
                                                  ? true
                                                  : item.checked,
                                                quarterlyRepeat:
                                                  e.target.checked,
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    className="w-4 h-4 rounded border-gray-300 text-[#2E7D32]"
                                  />
                                  <span>분기마다 반복 — 동년 1~4분기 자동 입력</span>
                                </label>

                                {ev.quarterlyRepeat && (
                                  <span className="text-xs font-bold text-[#2E7D32]">
                                    {buildSameYearQuarterlySlots({
                                      anchorIsoDate: ev.date,
                                      baseTitle: ev.title,
                                      mode: "nth-weekday",
                                      existingEvents: draft.events,
                                    })
                                      .map(
                                        (s) =>
                                          `${s.quarter}분기 ${s.dateIso.slice(5)}${s.alreadyExists ? "(등록됨)" : ""}`
                                      )
                                      .join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {skippedRegisteredEvents.length > 0 && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2.5 text-xs text-gray-600">
                        <span className="font-extrabold text-gray-700">
                          이미 등록되어 제외됨 ({skippedRegisteredEvents.length}건):{" "}
                        </span>
                        <span>
                          {skippedRegisteredEvents
                            .map(
                              (ev) =>
                                `${ev.date} ${ev.matchedExistingTitle ?? ev.title}`
                            )
                            .join(", ")}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* SECTION 2: POPUPS */}
                  <section className="rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base sm:text-lg font-black text-[#1a2744]">
                          2. 팝업 공지 추가
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-xs font-black">
                          선택 {checkedPopups.length}건
                        </span>
                      </div>
                      {unregisteredPopups.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPopups((prev) =>
                              prev.map((p) => ({ ...p, checked: false }))
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-500"
                        >
                          팝업 선택 해제
                        </button>
                      )}
                    </div>

                    {unregisteredPopups.length === 0 ? (
                      <p className="text-sm font-semibold text-gray-600 py-1">
                        새로 추가할 팝업 공지가 없습니다.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {unregisteredPopups.map((p) => (
                          <div
                            key={p.key}
                            className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                              p.checked
                                ? "border-[#2E7D32] bg-[#F8FAF8]"
                                : "border-gray-200 bg-white opacity-75"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={p.checked}
                                  onChange={(e) =>
                                    setPopups((prev) =>
                                      prev.map((item) =>
                                        item.key === p.key
                                          ? {
                                              ...item,
                                              checked: e.target.checked,
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  className="w-5 h-5 rounded border-gray-300 text-[#2E7D32]"
                                />
                                <span className="text-sm sm:text-base font-black text-[#1a2744]">
                                  {p.title || "팝업 제목"}
                                </span>
                              </label>
                              <ItemStatusPill
                                checked={p.checked}
                                alreadyExists={p.alreadyExists}
                                isPast={p.isPast}
                              />
                            </div>

                            <div className="pl-0 sm:pl-7 space-y-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-2">
                                <input
                                  type="text"
                                  aria-label="팝업 제목"
                                  value={p.title}
                                  placeholder="팝업 제목"
                                  onChange={(e) =>
                                    setPopups((prev) =>
                                      prev.map((item) =>
                                        item.key === p.key
                                          ? { ...item, title: e.target.value }
                                          : item
                                      )
                                    )
                                  }
                                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold"
                                />
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-600 shrink-0">
                                    종료일
                                  </span>
                                  <input
                                    type="date"
                                    aria-label="팝업 종료일"
                                    value={p.endDate}
                                    onChange={(e) =>
                                      setPopups((prev) =>
                                        prev.map((item) =>
                                          item.key === p.key
                                            ? {
                                                ...item,
                                                endDate: e.target.value,
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs sm:text-sm"
                                  />
                                </div>
                              </div>

                              <textarea
                                rows={2}
                                aria-label="팝업 안내 문구"
                                value={p.content}
                                placeholder="팝업 안내 문구"
                                onChange={(e) =>
                                  setPopups((prev) =>
                                    prev.map((item) =>
                                      item.key === p.key
                                        ? { ...item, content: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm leading-relaxed"
                              />

                              <div className="flex flex-wrap items-center gap-2">
                                {p.imageUrl ? (
                                  <>
                                    <img
                                      src={p.imageUrl}
                                      alt="팝업 포스터 미리보기"
                                      className="w-12 h-14 object-contain rounded border border-gray-200 bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPopups((prev) =>
                                          prev.map((item) =>
                                            item.key === p.key
                                              ? {
                                                  ...item,
                                                  imageUrl: undefined,
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700"
                                    >
                                      포스터 빼기
                                    </button>
                                  </>
                                ) : (
                                  <label
                                    className={`px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-[#1a2744] cursor-pointer ${
                                      uploadingPopupKey === p.key
                                        ? "opacity-60 pointer-events-none"
                                        : ""
                                    }`}
                                  >
                                    {uploadingPopupKey === p.key
                                      ? "포스터 올리는 중..."
                                      : "포스터 사진 첨부 — 선택"}
                                    <input
                                      type="file"
                                      accept={POSTER_IMAGE_ACCEPT}
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (!file) return;
                                        setUploadingPopupKey(p.key);
                                        try {
                                          const uploaded = await onUploadImage(
                                            file,
                                            file.name
                                          );
                                          if (uploaded) {
                                            setPopups((prev) =>
                                              prev.map((item) =>
                                                item.key === p.key
                                                  ? {
                                                      ...item,
                                                      checked: true,
                                                      imageUrl: uploaded.url,
                                                    }
                                                  : item
                                              )
                                            );
                                          }
                                        } finally {
                                          setUploadingPopupKey(null);
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {skippedRegisteredPopups.length > 0 && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2.5 text-xs text-gray-600">
                        <span className="font-extrabold text-gray-700">
                          이미 등록된 팝업 제외 ({skippedRegisteredPopups.length}건):{" "}
                        </span>
                        <span>
                          {skippedRegisteredPopups
                            .map((p) => p.title)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* SECTION 3: TOP BANNER NOTICES */}
                  {unregisteredBanners.length > 0 && (
                    <section className="rounded-2xl bg-white border border-gray-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-base sm:text-lg font-black text-[#1a2744]">
                            3. 상단 한 줄 알림 추가
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-xs font-black">
                            선택 {checkedBanners.length}건
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setBanners((prev) =>
                              prev.map((b) => ({ ...b, checked: false }))
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-500"
                        >
                          선택 해제
                        </button>
                      </div>

                      <div className="space-y-2">
                        {unregisteredBanners.map((b) => (
                          <div
                            key={b.key}
                            className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 transition-colors ${
                              b.checked
                                ? "border-[#2E7D32] bg-[#F8FAF8]"
                                : "border-gray-200 bg-white opacity-75"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 shrink-0">
                              <input
                                type="checkbox"
                                checked={b.checked}
                                onChange={(e) =>
                                  setBanners((prev) =>
                                    prev.map((item) =>
                                      item.key === b.key
                                        ? {
                                            ...item,
                                            checked: e.target.checked,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="w-5 h-5 rounded border-gray-300 text-[#2E7D32]"
                              />
                              <ItemStatusPill
                                checked={b.checked}
                                alreadyExists={b.alreadyExists}
                              />
                            </div>
                            <input
                              type="text"
                              aria-label="상단 한 줄 알림 문구"
                              value={b.text}
                              onChange={(e) =>
                                setBanners((prev) =>
                                  prev.map((item) =>
                                    item.key === b.key
                                      ? { ...item, text: e.target.value }
                                      : item
                                  )
                                )
                              }
                              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold"
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Final Confirmation Footer */}
        <div className="bg-white border-t border-gray-200 px-5 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs sm:text-sm font-extrabold text-[#1a2744]">
            {totalCheckedCount > 0 ? (
              <span>추가될 항목: {summarySegments.join(", ")}</span>
            ) : (
              <span className="text-gray-500">
                현재 선택된 추가 항목이 없습니다
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              disabled={saving || totalCheckedCount === 0}
              onClick={() => void handleFinalConfirm()}
              className="px-6 py-3 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm sm:text-base font-black shadow-md transition-colors disabled:opacity-50"
            >
              {saving
                ? "반영 중..."
                : `최종 확인 후 추가하기 (${totalCheckedCount}건)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
