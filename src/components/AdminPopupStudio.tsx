"use client";

import Link from "next/link";
import { useState } from "react";
import { createClientSafeId, getKstDateString } from "@/lib/format-utils";
import {
  addDaysToIsoDate,
  getUpcomingSundayIso,
  type PopupDisplayStatus,
  resolvePopupStatus,
} from "@/lib/popup-utils";
import type { PopupItem, SiteContent } from "@/types/site-content";

interface AdminPopupStudioProps {
  readonly draft: SiteContent;
  readonly saving: boolean;
  readonly onUpdatePopups: (nextPopups: readonly PopupItem[]) => void;
  readonly onSaveImmediate: (
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
  readonly onError: (msg: string) => void;
}

const POPUP_IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif";

const LINK_PRESETS = [
  { label: "없음", href: "" },
  { label: "공지사항", href: "/news" },
  { label: "행사 일정", href: "/news/events" },
  { label: "주보", href: "/news/bulletin" },
  { label: "일광학사관", href: "/boards/dormitory" },
  { label: "문의 및 등록", href: "/contact" },
] as const;

function StatusBadge({ status }: { readonly status: PopupDisplayStatus }) {
  if (status === "live") {
    return (
      <span className="px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-xs font-black shrink-0">
        현재 노출 중
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-black shrink-0">
        예약됨
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold shrink-0">
        기간 종료
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold shrink-0">
      숨김
    </span>
  );
}

export function AdminPopupStudio({
  draft,
  saving,
  onUpdatePopups,
  onSaveImmediate,
  onUploadImage,
  onError,
}: AdminPopupStudioProps) {
  const todayIso = getKstDateString();
  const upcomingSunday = getUpcomingSundayIso(todayIso);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newStartDate, setNewStartDate] = useState(todayIso);
  const [newEndDate, setNewEndDate] = useState(upcomingSunday.dateIso);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleSelectNewPoster(file: File) {
    setUploadingPoster(true);
    try {
      const uploaded = await onUploadImage(file, file.name);
      if (uploaded) {
        setNewImageUrl(uploaded.url);
      }
    } finally {
      setUploadingPoster(false);
    }
  }

  async function handleCreatePopup() {
    const trimmedTitle = newTitle.trim();
    const trimmedContent = newContent.trim();
    const trimmedImage = newImageUrl.trim();

    if (!trimmedTitle && !trimmedContent && !trimmedImage) {
      onError("포스터 사진을 올리거나 제목 또는 안내 문구를 입력해 주세요.");
      return;
    }

    if (
      newStartDate &&
      newEndDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(newStartDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(newEndDate) &&
      newEndDate < newStartDate
    ) {
      onError("종료일은 시작일과 같거나 그 이후 날짜여야 합니다.");
      return;
    }

    const created: PopupItem = {
      id: createClientSafeId("popup"),
      title: trimmedTitle,
      content: trimmedContent,
      imageUrl: trimmedImage || undefined,
      linkUrl: newLinkUrl.trim() || undefined,
      linkLabel: newLinkLabel.trim() || undefined,
      startDate: newStartDate.trim() || undefined,
      endDate: newEndDate.trim() || undefined,
      isActive: true,
    };

    const nextContent: SiteContent = {
      ...draft,
      popups: [created, ...draft.popups],
    };

    await onSaveImmediate(
      nextContent,
      "새 팝업이 홈페이지 첫 화면에 등록되었습니다."
    );

    setNewTitle("");
    setNewContent("");
    setNewImageUrl("");
    setNewStartDate(todayIso);
    setNewEndDate(upcomingSunday.dateIso);
    setNewLinkUrl("");
    setNewLinkLabel("");
  }

  async function handleTogglePopupActive(popup: PopupItem) {
    const turningOn = !popup.isActive;
    const clearExpiredEnd =
      turningOn &&
      popup.endDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(popup.endDate) &&
      popup.endDate < todayIso;

    const nextPopups = draft.popups.map((item) =>
      item.id === popup.id
        ? {
            ...item,
            isActive: turningOn,
            endDate: clearExpiredEnd ? undefined : item.endDate,
          }
        : item
    );

    await onSaveImmediate(
      { ...draft, popups: nextPopups },
      turningOn
        ? "팝업을 홈페이지 첫 화면에 다시 표시합니다."
        : "팝업을 숨김으로 변경했습니다."
    );
  }

  async function handleDeletePopup(popup: PopupItem) {
    const label = popup.title.trim() || "선택한 팝업";
    if (!window.confirm(`"${label}" 항목을 삭제하시겠습니까?`)) {
      return;
    }
    const nextPopups = draft.popups.filter((item) => item.id !== popup.id);
    if (expandedId === popup.id) {
      setExpandedId(null);
    }
    await onSaveImmediate(
      { ...draft, popups: nextPopups },
      "팝업이 삭제되었습니다."
    );
  }

  function movePopup(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draft.popups.length) return;
    const next = [...draft.popups];
    const temp = next[targetIdx]!;
    next[targetIdx] = next[index]!;
    next[index] = temp;
    onUpdatePopups(next);
  }

  return (
    <div className="space-y-6">
      {/* 1. Create New Popup Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <h2 className="text-xl sm:text-2xl font-black text-[#1a2744]">
            새 팝업 등록
          </h2>
          <Link
            href="/"
            target="_blank"
            className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
          >
            메인 화면 보기
          </Link>
        </div>

        <div className="bg-[#F8FAF8] rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-4">
          {/* Poster Upload */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-[#1a2744]">
                포스터 사진 — 선택 사항
              </span>
              <span className="text-xs text-gray-500 font-semibold">
                사진만 올리거나 글자만 적으셔도 됩니다
              </span>
            </div>

            {newImageUrl ? (
              <div className="rounded-xl bg-white border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={newImageUrl}
                    alt="팝업 포스터 미리보기"
                    className="w-20 h-24 object-contain rounded-lg border border-gray-200 bg-gray-50"
                  />
                  <span className="text-xs sm:text-sm font-bold text-[#2E7D32]">
                    포스터 사진이 선택되었습니다
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="px-3.5 py-2 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold cursor-pointer transition-colors">
                    다른 사진 고르기
                    <input
                      type="file"
                      accept={POPUP_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        await handleSelectNewPoster(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewImageUrl("")}
                    className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    사진 빼기
                  </button>
                </div>
              </div>
            ) : (
              <label
                className={`inline-block px-5 py-2.5 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs sm:text-sm font-black cursor-pointer transition-colors ${
                  uploadingPoster ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploadingPoster ? "사진 올리는 중..." : "포스터 사진 선택"}
                <input
                  type="file"
                  accept={POPUP_IMAGE_ACCEPT}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    await handleSelectNewPoster(file);
                  }}
                />
              </label>
            )}
          </div>

          {/* Title & Body */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-extrabold text-[#1a2744] mb-1.5">
                제목
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder="예: 추수감사주일 특별예배 안내"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm sm:text-base font-bold focus:border-[#2E7D32] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-[#1a2744] mb-1.5">
                안내 문구 — 선택 사항
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="포스터 사진만 띄우실 때는 비워 두셔도 됩니다."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm sm:text-base leading-relaxed focus:border-[#2E7D32] focus:outline-none"
              />
            </div>
          </div>

          {/* Date Window with 1-Tap Presets */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-[#1a2744]">
                노출 기간
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNewStartDate(todayIso);
                    setNewEndDate(upcomingSunday.dateIso);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                    newEndDate === upcomingSunday.dateIso
                      ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {upcomingSunday.label}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewStartDate(todayIso);
                    setNewEndDate(addDaysToIsoDate(todayIso, 14));
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                    newEndDate === addDaysToIsoDate(todayIso, 14)
                      ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  2주간
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewStartDate(todayIso);
                    setNewEndDate("");
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                    newEndDate === ""
                      ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  기한 없음
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 w-12 shrink-0">
                  시작일
                </span>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600 w-12 shrink-0">
                  종료일
                </span>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Optional Link Destination */}
          <div className="space-y-2">
            <span className="block text-sm font-extrabold text-[#1a2744]">
              누르면 이동할 화면 — 선택 사항
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LINK_PRESETS.map((preset) => {
                const selected = newLinkUrl === preset.href;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setNewLinkUrl(preset.href)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      selected
                        ? "bg-[#1a2744] text-white border-[#1a2744]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            {newLinkUrl !== "" && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2.5 pt-1">
                <input
                  type="text"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="이동할 주소 (예: /news 또는 https://...)"
                  className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
                />
                <input
                  type="text"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="버튼 문구 (기본: 자세히 보기)"
                  className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={saving || uploadingPoster}
            onClick={() => void handleCreatePopup()}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-base font-black shadow-sm transition-colors disabled:opacity-60"
          >
            {saving ? "저장 중..." : "팝업 등록하기"}
          </button>
        </div>
      </div>

      {/* 2. Registered Popups List */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <h3 className="text-lg sm:text-xl font-black text-[#1a2744]">
          등록된 팝업 ({draft.popups.length}건)
        </h3>

        {draft.popups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
            현재 등록된 팝업이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {draft.popups.map((popup, idx) => {
              const status = resolvePopupStatus(popup, todayIso);
              const isExpanded = expandedId === popup.id;
              const periodLabel =
                popup.startDate || popup.endDate
                  ? `${popup.startDate || "제한없음"} ~ ${popup.endDate || "제한없음"}`
                  : "상시 노출";

              return (
                <div
                  key={popup.id}
                  className={`rounded-2xl border p-4 space-y-3 ${
                    status === "live"
                      ? "border-[#2E7D32]/45 bg-[#F8FAF8]"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {popup.imageUrl ? (
                        <img
                          src={popup.imageUrl}
                          alt={popup.title || "팝업 썸네일"}
                          className="w-12 h-14 rounded-lg object-cover border border-gray-200 bg-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-14 rounded-lg bg-[#1a2744] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          글자
                        </div>
                      )}

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={status} />
                          <span className="text-xs text-gray-500 font-semibold">
                            {periodLabel}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base font-black text-[#1a2744] truncate">
                          {popup.title.trim() ||
                            popup.content.trim().slice(0, 40) ||
                            "포스터 이미지 팝업"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleTogglePopupActive(popup)}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-colors ${
                          popup.isActive
                            ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                            : "bg-[#2E7D32] text-white hover:bg-[#1B5E20]"
                        }`}
                      >
                        {popup.isActive ? "숨기기" : "다시 띄우기"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : popup.id)
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs sm:text-sm font-bold transition-colors"
                      >
                        {isExpanded ? "닫기" : "수정"}
                      </button>

                      {draft.popups.length > 1 && (
                        <>
                          <button
                            type="button"
                            disabled={idx === 0}
                            aria-label="위로 이동"
                            onClick={() => movePopup(idx, -1)}
                            className="px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 disabled:opacity-35"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === draft.popups.length - 1}
                            aria-label="아래로 이동"
                            onClick={() => movePopup(idx, 1)}
                            className="px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 disabled:opacity-35"
                          >
                            ▼
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDeletePopup(popup)}
                        className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm font-bold transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3.5 py-2 rounded-xl bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs font-bold cursor-pointer transition-colors">
                          {popup.imageUrl ? "포스터 사진 교체" : "포스터 사진 추가"}
                          <input
                            type="file"
                            accept={POPUP_IMAGE_ACCEPT}
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              const uploaded = await onUploadImage(
                                file,
                                file.name
                              );
                              if (uploaded) {
                                onUpdatePopups(
                                  draft.popups.map((item) =>
                                    item.id === popup.id
                                      ? { ...item, imageUrl: uploaded.url }
                                      : item
                                  )
                                );
                              }
                            }}
                          />
                        </label>
                        {popup.imageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePopups(
                                draft.popups.map((item) =>
                                  item.id === popup.id
                                    ? { ...item, imageUrl: undefined }
                                    : item
                                )
                              )
                            }
                            className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700"
                          >
                            포스터 사진 제거
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={popup.title}
                          placeholder="팝업 제목"
                          onChange={(e) =>
                            onUpdatePopups(
                              draft.popups.map((item) =>
                                item.id === popup.id
                                  ? { ...item, title: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-bold"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            aria-label="팝업 시작일"
                            value={popup.startDate ?? ""}
                            onChange={(e) =>
                              onUpdatePopups(
                                draft.popups.map((item) =>
                                  item.id === popup.id
                                    ? {
                                        ...item,
                                        startDate:
                                          e.target.value.trim() || undefined,
                                      }
                                    : item
                                )
                              )
                            }
                            className="rounded-xl border border-gray-300 bg-white px-2.5 py-2 text-xs sm:text-sm"
                          />
                          <input
                            type="date"
                            aria-label="팝업 종료일"
                            value={popup.endDate ?? ""}
                            onChange={(e) =>
                              onUpdatePopups(
                                draft.popups.map((item) =>
                                  item.id === popup.id
                                    ? {
                                        ...item,
                                        endDate:
                                          e.target.value.trim() || undefined,
                                      }
                                    : item
                                )
                              )
                            }
                            className="rounded-xl border border-gray-300 bg-white px-2.5 py-2 text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={popup.content}
                        placeholder="팝업 안내 문구"
                        onChange={(e) =>
                          onUpdatePopups(
                            draft.popups.map((item) =>
                              item.id === popup.id
                                ? { ...item, content: e.target.value }
                                : item
                            )
                          )
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm leading-relaxed"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2.5">
                        <input
                          type="text"
                          value={popup.linkUrl ?? ""}
                          placeholder="이동할 주소 (예: /news, /boards/dormitory)"
                          onChange={(e) =>
                            onUpdatePopups(
                              draft.popups.map((item) =>
                                item.id === popup.id
                                  ? {
                                      ...item,
                                      linkUrl:
                                        e.target.value.trim() || undefined,
                                    }
                                  : item
                              )
                            )
                          }
                          className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={popup.linkLabel ?? ""}
                          placeholder="버튼 문구 (자세히 보기)"
                          onChange={(e) =>
                            onUpdatePopups(
                              draft.popups.map((item) =>
                                item.id === popup.id
                                  ? {
                                      ...item,
                                      linkLabel:
                                        e.target.value.trim() || undefined,
                                    }
                                  : item
                              )
                            )
                          }
                          className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setExpandedId(null);
                            void onSaveImmediate(
                              draft,
                              "팝업 수정 내용이 저장되었습니다."
                            );
                          }}
                          className="px-5 py-2.5 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-black transition-colors disabled:opacity-60"
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
      </div>
    </div>
  );
}
