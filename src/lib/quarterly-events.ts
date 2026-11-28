import {
  createClientSafeId,
  formatEventBadgesFromIsoDate,
  resolveEventIsoDate,
} from "@/lib/format-utils";
import type { EventItem } from "@/types/site-content";

export type QuarterlyRuleMode = "nth-weekday" | "day-of-month";

export interface QuarterlyScheduleSlot {
  readonly quarter: 1 | 2 | 3 | 4;
  readonly dateIso: string;
  readonly title: string;
  readonly alreadyExists: boolean;
}

const KOR_WEEKDAY_NAMES = [
  "주일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;

const KOR_ORDINAL_NAMES = [
  "첫째",
  "둘째",
  "셋째",
  "넷째",
  "마지막",
] as const;

function daysInUtcMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function formatIsoParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoDateParts(isoDate: string): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly dayOfWeek: number;
  readonly nthWeekday: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInUtcMonth(year, month)) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = dt.getUTCDay();
  const nthWeekday = Math.floor((day - 1) / 7) + 1;
  return { year, month, day, dayOfWeek, nthWeekday };
}

export function resolveQuarterlyTitle(
  baseTitle: string,
  quarter: 1 | 2 | 3 | 4
): string {
  const trimmed = baseTitle.trim();
  if (!trimmed) return "";
  if (/(?:제\s*)?[1-4]\s*분기/u.test(trimmed)) {
    return trimmed.replace(
      /((?:제\s*)?)[1-4](\s*분기)/gu,
      `$1${quarter}$2`
    );
  }
  return trimmed;
}

function normalizeEventTitleKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(?:제\s*)?[1-4]\s*분기/gu, "분기")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^가-힣a-z0-9]/gu, "");
}

function isSameQuarterlyEventOnMonth(
  existingEvents: readonly EventItem[],
  year: number,
  month: number,
  candidateDateIso: string,
  candidateTitle: string
): boolean {
  const normCand = normalizeEventTitleKey(candidateTitle);
  const yearMonthPrefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-`;

  return existingEvents.some((ev) => {
    const evIso = resolveEventIsoDate(ev);
    const normExisting = normalizeEventTitleKey(ev.title);
    if (!normCand || !normExisting) return false;
    const sameTitle =
      normCand === normExisting ||
      (normCand.length >= 3 && normExisting.includes(normCand)) ||
      (normExisting.length >= 3 && normCand.includes(normExisting));
    if (!sameTitle) return false;
    return evIso === candidateDateIso || evIso.startsWith(yearMonthPrefix);
  });
}

export function isLikelyQuarterlyEventTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  return /(?:분기|정기\s*제직회|제직회)/u.test(trimmed);
}

export function describeQuarterlyRule(
  anchorIsoDate: string,
  mode: QuarterlyRuleMode
): string {
  const parsed = parseIsoDateParts(anchorIsoDate);
  if (!parsed) return "";

  const monthOffset = (parsed.month - 1) % 3;
  const monthsLabel = [1, 2, 3, 4]
    .map((q) => `${(q - 1) * 3 + 1 + monthOffset}월`)
    .join(", ");

  if (mode === "day-of-month") {
    return `${parsed.year}년 ${monthsLabel} ${parsed.day}일 (총 4회)`;
  }

  const ordLabel =
    KOR_ORDINAL_NAMES[Math.min(parsed.nthWeekday - 1, 4)] ?? "첫째";
  const dowLabel = KOR_WEEKDAY_NAMES[parsed.dayOfWeek] ?? "주일";
  return `${parsed.year}년 ${monthsLabel} ${ordLabel} ${dowLabel} (총 4회)`;
}

export function buildSameYearQuarterlySlots(params: {
  readonly anchorIsoDate: string;
  readonly baseTitle: string;
  readonly mode: QuarterlyRuleMode;
  readonly existingEvents: readonly EventItem[];
  readonly excludeEventId?: string;
}): readonly QuarterlyScheduleSlot[] {
  const parsed = parseIsoDateParts(params.anchorIsoDate);
  if (!parsed) return [];

  const monthOffset = (parsed.month - 1) % 3;
  const filteredExisting = params.excludeEventId
    ? params.existingEvents.filter((e) => e.id !== params.excludeEventId)
    : params.existingEvents;

  const quarters = [1, 2, 3, 4] as const;
  return quarters.map((q) => {
    const targetMonth = (q - 1) * 3 + 1 + monthOffset;
    const maxDay = daysInUtcMonth(parsed.year, targetMonth);

    let targetDay: number;
    if (params.mode === "day-of-month") {
      targetDay = Math.min(parsed.day, maxDay);
    } else {
      const firstDow = new Date(
        Date.UTC(parsed.year, targetMonth - 1, 1)
      ).getUTCDay();
      const delta = (parsed.dayOfWeek - firstDow + 7) % 7;
      const firstOccurrence = 1 + delta;
      let candidate = firstOccurrence + (parsed.nthWeekday - 1) * 7;
      while (candidate > maxDay) {
        candidate -= 7;
      }
      targetDay = candidate;
    }

    const dateIso = formatIsoParts(parsed.year, targetMonth, targetDay);
    const resolvedTitle =
      resolveQuarterlyTitle(params.baseTitle, q) || "분기 정기 일정";
    const alreadyExists = isSameQuarterlyEventOnMonth(
      filteredExisting,
      parsed.year,
      targetMonth,
      dateIso,
      resolvedTitle
    );

    return {
      quarter: q,
      dateIso,
      title: resolvedTitle,
      alreadyExists,
    };
  });
}

export function materializeQuarterlyEventItems(params: {
  readonly anchorIsoDate: string;
  readonly baseTitle: string;
  readonly timeText: string;
  readonly location: string;
  readonly description: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
  readonly mode: QuarterlyRuleMode;
  readonly existingEvents: readonly EventItem[];
}): readonly EventItem[] {
  const slots = buildSameYearQuarterlySlots({
    anchorIsoDate: params.anchorIsoDate,
    baseTitle: params.baseTitle,
    mode: params.mode,
    existingEvents: params.existingEvents,
  });

  return slots
    .filter((slot) => !slot.alreadyExists)
    .map((slot) => {
      const badges = formatEventBadgesFromIsoDate(slot.dateIso);
      return {
        id: createClientSafeId("ev"),
        date: slot.dateIso,
        dayBadge: badges.dayBadge,
        monthYearBadge: badges.monthYearBadge,
        title: slot.title,
        timeText: params.timeText.trim() || "오전 11:00",
        location: params.location.trim() || "일광교회 본당",
        description: params.description.trim(),
        recurrence: "quarterly",
        attachmentUrl: params.attachmentUrl || undefined,
        attachmentName: params.attachmentName || undefined,
      };
    });
}
