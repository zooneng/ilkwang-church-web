"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { sanitizePopupHref } from "@/lib/popup-utils";
import type { PopupItem } from "@/types/site-content";

interface HomePopupModalProps {
  readonly popups: readonly PopupItem[];
  readonly todayIso: string;
}

const POPUP_DISMISS_EVENT = "church-popup-dismiss-change";

function subscribePopupDismiss(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(POPUP_DISMISS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(POPUP_DISMISS_EVENT, onStoreChange);
  };
}

function getDismissKey(popupId: string): string {
  return `church_popup_hide_date_${popupId}`;
}

function PopupCard({
  popup,
  onDismissToday,
  onClose,
}: {
  readonly popup: PopupItem;
  readonly onDismissToday: (id: string) => void;
  readonly onClose: (id: string) => void;
}) {
  const safeLink = sanitizePopupHref(popup.linkUrl);
  const hasImage = Boolean(popup.imageUrl?.trim());
  const hasTitle = Boolean(popup.title.trim());
  const hasContent = Boolean(popup.content.trim());
  const actionLabel = popup.linkLabel?.trim() || "자세히 보기";

  const imageElement = hasImage ? (
    <img
      src={popup.imageUrl!.trim()}
      alt={popup.title.trim() || "교회 안내"}
      className="w-full max-h-[58vh] object-contain bg-[#F8FAF8] block select-none"
    />
  ) : null;

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col justify-between w-full">
      <div>
        {/* Text-only header accent when no poster image is attached */}
        {!hasImage && (
          <div className="bg-[#1a2744] text-white px-5 sm:px-6 py-4">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#2E7D32] text-white text-xs font-extrabold mb-1.5">
              안내
            </span>
            <h2 className="text-lg sm:text-xl font-black leading-snug break-keep">
              {popup.title.trim() || "교회 공지 안내"}
            </h2>
          </div>
        )}

        {/* Poster Image (clickable if link exists and no separate text block is shown) */}
        {hasImage &&
          (safeLink && !hasContent ? (
            safeLink.external ? (
              <a
                href={safeLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {imageElement}
              </a>
            ) : (
              <Link href={safeLink.href} className="block">
                {imageElement}
              </Link>
            )
          ) : (
            imageElement
          ))}

        {/* Body Content & Action Link */}
        {(hasContent || (hasImage && hasTitle) || safeLink) && (
          <div className="p-5 sm:p-6 space-y-3">
            {hasImage && hasTitle && (
              <h2 className="text-lg sm:text-xl font-black text-[#1a2744] leading-snug break-keep">
                {popup.title.trim()}
              </h2>
            )}
            {hasContent && (
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line break-keep max-h-[34vh] overflow-y-auto">
                {popup.content.trim()}
              </p>
            )}
            {safeLink && (
              <div className="pt-1">
                {safeLink.external ? (
                  <a
                    href={safeLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-black transition-colors"
                  >
                    {actionLabel} →
                  </a>
                ) : (
                  <Link
                    href={safeLink.href}
                    className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-black transition-colors"
                  >
                    {actionLabel} →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Dismiss & Close Bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onDismissToday(popup.id)}
          className="text-xs sm:text-sm font-bold text-gray-600 hover:text-[#1a2744] px-2 py-1 rounded-lg hover:bg-gray-200/60 transition-colors"
        >
          오늘 하루 보지 않기
        </button>
        <button
          type="button"
          onClick={() => onClose(popup.id)}
          className="px-4 py-1.5 rounded-lg bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs sm:text-sm font-black transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function HomePopupModal({ popups, todayIso }: HomePopupModalProps) {
  const [sessionClosedIds, setSessionClosedIds] = useState<readonly string[]>(
    []
  );
  const [mobileIndex, setMobileIndex] = useState(0);

  const clientDismissSnapshot = useSyncExternalStore(
    subscribePopupDismiss,
    () => {
      try {
        return popups
          .map((p) =>
            window.localStorage.getItem(getDismissKey(p.id)) === todayIso
              ? p.id
              : ""
          )
          .filter(Boolean)
          .join(",");
      } catch {
        return "";
      }
    },
    () => "__SSR__"
  );

  const visiblePopups = useMemo(() => {
    if (clientDismissSnapshot === "__SSR__") return [];
    const dismissedSet = new Set(
      clientDismissSnapshot ? clientDismissSnapshot.split(",") : []
    );
    const closedSet = new Set(sessionClosedIds);
    return popups.filter(
      (p) => !dismissedSet.has(p.id) && !closedSet.has(p.id)
    );
  }, [clientDismissSnapshot, popups, sessionClosedIds]);

  useEffect(() => {
    if (visiblePopups.length === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSessionClosedIds((prev) => [
          ...new Set([...prev, ...visiblePopups.map((p) => p.id)]),
        ]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visiblePopups]);

  if (visiblePopups.length === 0) {
    return null;
  }

  function handleDismissToday(id: string) {
    try {
      window.localStorage.setItem(getDismissKey(id), todayIso);
      window.dispatchEvent(new Event(POPUP_DISMISS_EVENT));
    } catch {
      // Fallback to in-memory close if storage is blocked
    }
    setSessionClosedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function handleCloseOne(id: string) {
    setSessionClosedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function handleCloseAll() {
    setSessionClosedIds((prev) => [
      ...new Set([...prev, ...visiblePopups.map((p) => p.id)]),
    ]);
  }

  const safeIndex = Math.min(mobileIndex, visiblePopups.length - 1);
  const activeSinglePopup = visiblePopups[safeIndex] ?? visiblePopups[0]!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="교회 주요 안내 팝업"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseAll();
        }
      }}
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {visiblePopups.length === 1 ? (
        <div className="w-full max-w-[440px]">
          <PopupCard
            popup={activeSinglePopup}
            onDismissToday={handleDismissToday}
            onClose={handleCloseOne}
          />
        </div>
      ) : visiblePopups.length === 2 ? (
        <div className="w-full max-w-[440px] lg:max-w-[880px] space-y-3">
          {/* Desktop: 2 cards side by side */}
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
            {visiblePopups.map((item) => (
              <PopupCard
                key={item.id}
                popup={item}
                onDismissToday={handleDismissToday}
                onClose={handleCloseOne}
              />
            ))}
          </div>

          {/* Mobile & Tablet: 1 card at a time with switcher */}
          <div className="lg:hidden space-y-2.5">
            <div className="flex items-center justify-between px-1 text-white text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setMobileIndex((idx) =>
                      idx <= 0 ? visiblePopups.length - 1 : idx - 1
                    )
                  }
                  className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30"
                >
                  이전
                </button>
                <span className="px-2">
                  {safeIndex + 1} / {visiblePopups.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMobileIndex((idx) => (idx + 1) % visiblePopups.length)
                  }
                  className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30"
                >
                  다음
                </button>
              </div>
              <button
                type="button"
                onClick={handleCloseAll}
                className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30"
              >
                모두 닫기
              </button>
            </div>
            <PopupCard
              popup={activeSinglePopup}
              onDismissToday={handleDismissToday}
              onClose={handleCloseOne}
            />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[440px] space-y-2.5">
          <div className="flex items-center justify-between px-1 text-white text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setMobileIndex((idx) =>
                    idx <= 0 ? visiblePopups.length - 1 : idx - 1
                  )
                }
                className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30"
              >
                이전
              </button>
              <span className="px-2">
                {safeIndex + 1} / {visiblePopups.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setMobileIndex((idx) => (idx + 1) % visiblePopups.length)
                }
                className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30"
              >
                다음
              </button>
            </div>
            <button
              type="button"
              onClick={handleCloseAll}
              className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30"
            >
              모두 닫기
            </button>
          </div>
          <PopupCard
            popup={activeSinglePopup}
            onDismissToday={handleDismissToday}
            onClose={handleCloseOne}
          />
        </div>
      )}
    </div>
  );
}
