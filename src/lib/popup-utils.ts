import type { PopupItem } from "@/types/site-content";

export type PopupDisplayStatus = "live" | "scheduled" | "expired" | "hidden";

export function hasPopupRenderableBody(popup: PopupItem): boolean {
  return Boolean(
    popup.imageUrl?.trim() || popup.title.trim() || popup.content.trim()
  );
}

export function resolvePopupStatus(
  popup: PopupItem,
  todayIso: string
): PopupDisplayStatus {
  if (!popup.isActive || !hasPopupRenderableBody(popup)) {
    return "hidden";
  }
  const start = popup.startDate?.trim() ?? "";
  const end = popup.endDate?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(start) && todayIso < start) {
    return "scheduled";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end) && todayIso > end) {
    return "expired";
  }
  return "live";
}

export function isPopupCurrentlyLive(
  popup: PopupItem,
  todayIso: string
): boolean {
  return resolvePopupStatus(popup, todayIso) === "live";
}

export function sanitizePopupHref(raw?: string): {
  readonly href: string;
  readonly external: boolean;
} | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return { href: trimmed, external: false };
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return { href: trimmed, external: true };
  }
  return null;
}

export function addDaysToIsoDate(baseIso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseIso);
  if (!match) return baseIso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getUpcomingSundayIso(todayIso: string): {
  readonly dateIso: string;
  readonly label: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  if (!match) {
    return { dateIso: todayIso, label: "이번 주일까지" };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utc.getUTCDay(); // 0 = Sunday
  if (dayOfWeek === 0) {
    return {
      dateIso: addDaysToIsoDate(todayIso, 7),
      label: "다음 주일까지",
    };
  }
  return {
    dateIso: addDaysToIsoDate(todayIso, 7 - dayOfWeek),
    label: "이번 주일까지",
  };
}
