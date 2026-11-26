"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ClickAnchor {
  readonly top: number;
  readonly left: number;
}

const BUBBLE_MAX_WIDTH = 300;

let lastClickAnchor: ClickAnchor | null = null;
let listenerCount = 0;

function captureClickAnchor(event: MouseEvent) {
  const target =
    event.target instanceof Element
      ? event.target.closest("button, label, a, [role='button']")
      : null;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const maxLeft =
    window.scrollX + document.documentElement.clientWidth - BUBBLE_MAX_WIDTH - 12;
  lastClickAnchor = {
    top: rect.bottom + window.scrollY + 8,
    left: Math.max(window.scrollX + 12, Math.min(rect.left + window.scrollX, maxLeft)),
  };
}

/** Registers a capture-phase click listener that remembers the last clicked control. */
export function useActionAnchorTracking() {
  useEffect(() => {
    if (listenerCount === 0) {
      document.addEventListener("click", captureClickAnchor, true);
    }
    listenerCount += 1;
    return () => {
      listenerCount -= 1;
      if (listenerCount === 0) {
        document.removeEventListener("click", captureClickAnchor, true);
      }
    };
  }, []);
}

interface ActionFeedbackBubbleProps {
  readonly text: string;
  readonly tone: "success" | "error";
}

/**
 * Small confirmation shown right below the control the user last clicked.
 * Remount it (via `key`) for every new message.
 */
export function ActionFeedbackBubble({ text, tone }: ActionFeedbackBubbleProps) {
  const [anchor] = useState<ClickAnchor | null>(() => lastClickAnchor);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Each click anchors at most one confirmation, so a later message that
    // was not triggered by a click never appears next to a stale control.
    lastClickAnchor = null;
    const timer = window.setTimeout(
      () => setVisible(false),
      tone === "error" ? 9000 : 4500
    );
    return () => window.clearTimeout(timer);
  }, [tone]);

  if (!anchor || !visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{ top: anchor.top, left: anchor.left, maxWidth: BUBBLE_MAX_WIDTH }}
      className={`absolute z-[70] rounded-xl border px-3 py-2 text-xs font-bold shadow-lg ${
        tone === "error"
          ? "bg-red-50 border-red-300 text-red-800"
          : "bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20]"
      }`}
    >
      {tone === "error" ? "⚠ " : "✓ "}
      {text}
    </div>,
    document.body
  );
}
