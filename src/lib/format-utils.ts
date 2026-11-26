export function extractYoutubeId(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const normalized = /^(?:https?:)?\/\//i.test(trimmed)
    ? trimmed.startsWith("//")
      ? `https:${trimmed}`
      : trimmed
    : /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const slug = url.pathname.split("/").filter(Boolean)[0];
      if (slug && /^[A-Za-z0-9_-]{11}$/.test(slug)) {
        return slug;
      }
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
      const vParam = url.searchParams.get("v");
      if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      const segments = url.pathname.split("/").filter(Boolean);
      const markerIndex = segments.findIndex((seg) =>
        ["embed", "live", "shorts", "v"].includes(seg)
      );
      if (markerIndex !== -1 && segments[markerIndex + 1]) {
        const candidate = segments[markerIndex + 1];
        if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    const queryMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/);
    if (queryMatch) {
      return queryMatch[1];
    }
    const pathMatch = trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed|live|shorts|v)\/)([A-Za-z0-9_-]{11})/
    );
    if (pathMatch) {
      return pathMatch[1];
    }
  }

  return "";
}

export function getKstDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getKstYearMonthDotString(now: Date = new Date()): string {
  return getKstDateString(now).slice(0, 7).replace("-", ".");
}

export function createClientSafeId(prefix: string): string {
  const uuidPart =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${uuidPart}`;
}

export function stripOfferingAccountPlaceholder(rawAccountNumber: string): string {
  return rawAccountNumber
    .replace(/\s*\(관리자[^)]*\)\s*$/u, "")
    .trim();
}

export function formatBulletinDateTitle(isoDate: string): string {
  const match = isoDate.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!match) {
    return "0000년 00월 00일 교회 주보";
  }
  const yyyy = match[1];
  const mm = match[2].padStart(2, "0");
  const dd = match[3].padStart(2, "0");
  return `${yyyy}년 ${mm}월 ${dd}일 교회 주보`;
}

export function isAutoBulletinDateTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  return /^\d{4}년\s*\d{1,2}월\s*(?:\d{1,2}일\s*교회\s*주보|(?:첫째|둘째|셋째|넷째|다섯째)\s*주일\s*주보)$/.test(
    trimmed
  );
}

export function formatDefaultBulletinVolume(isoDate: string): string {
  const match = isoDate.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!match) {
    return `${getKstDateString().slice(0, 4)}-01`;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const targetUtc = Date.UTC(year, month - 1, day);
  const jan1Utc = Date.UTC(year, 0, 1);
  const jan1Dow = new Date(jan1Utc).getUTCDay();
  const offsetToFirstSunday = (7 - jan1Dow) % 7;
  const firstSundayUtc = jan1Utc + offsetToFirstSunday * 86_400_000;
  const sundayOrdinal =
    targetUtc < firstSundayUtc
      ? 1
      : Math.floor((targetUtc - firstSundayUtc) / (7 * 86_400_000)) + 1;
  return `${match[1]}-${String(sundayOrdinal).padStart(2, "0")}`;
}

export function isAutoBulletinVolume(volume: string): boolean {
  const trimmed = volume.trim();
  if (!trimmed || trimmed === "제55권 신간호") return true;
  return /^\d{4}-\d{1,2}$/.test(trimmed);
}

export function formatDefaultBulletinScheduleTitle(isoDate: string): string {
  const match = isoDate.trim().match(/^\d{4}[-./](\d{1,2})[-./]\d{1,2}$/);
  if (!match) {
    return "교회 일정";
  }
  const month = Number(match[1]);
  if (month >= 1 && month <= 12) {
    return `${month}월 교회 일정`;
  }
  return "교회 일정";
}

export function isAutoBulletinScheduleTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed || trimmed === "교회 일정") return true;
  return /^\d{1,2}월\s*교회\s*일정$/.test(trimmed);
}

export function isBulletinScheduleHeading(heading: string | null): boolean {
  if (!heading) return false;
  return /(?:일정|행사)/.test(heading);
}

export function splitBulletinNewsAndSchedule(
  fullContent: string | undefined,
  bulletinIsoDate: string
): {
  readonly churchNews: string;
  readonly scheduleTitle: string;
  readonly churchSchedule: string;
} {
  const defaultTitle = formatDefaultBulletinScheduleTitle(bulletinIsoDate);
  if (!fullContent || !fullContent.trim()) {
    return {
      churchNews: "",
      scheduleTitle: defaultTitle,
      churchSchedule: "",
    };
  }

  const blocks: { heading: string | null; lines: string[] }[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    while (currentLines.length > 0 && currentLines[0]?.trim() === "") {
      currentLines.shift();
    }
    while (
      currentLines.length > 0 &&
      currentLines[currentLines.length - 1]?.trim() === ""
    ) {
      currentLines.pop();
    }
    if (currentLines.length > 0 || currentHeading !== null) {
      blocks.push({ heading: currentHeading, lines: [...currentLines] });
    }
    currentLines = [];
  };

  for (const rawLine of fullContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const bracketMatch = trimmed.match(/^\[(.+?)\]$/);
    if (bracketMatch) {
      flush();
      currentHeading = bracketMatch[1].trim();
      continue;
    }
    currentLines.push(rawLine);
  }
  flush();

  const newsChunks: string[] = [];
  const scheduleBlocks: { heading: string; lines: string[] }[] = [];

  for (const blk of blocks) {
    const compactHeading = (blk.heading ?? "").replace(/\s+/g, "");
    if (
      compactHeading === "축하합니다" ||
      compactHeading === "축하" ||
      compactHeading === "교우동정"
    ) {
      continue;
    }
    if (blk.heading && isBulletinScheduleHeading(blk.heading)) {
      if (blk.lines.length > 0) {
        scheduleBlocks.push({ heading: blk.heading, lines: blk.lines });
      }
      continue;
    }
    if (blk.lines.length === 0) {
      continue;
    }
    if (blk.heading === null || compactHeading === "교회소식") {
      newsChunks.push(blk.lines.join("\n"));
    } else {
      newsChunks.push(`[${blk.heading}]\n${blk.lines.join("\n")}`);
    }
  }

  let scheduleTitle = defaultTitle;
  let churchSchedule = "";
  if (scheduleBlocks.length === 1) {
    scheduleTitle = scheduleBlocks[0].heading;
    churchSchedule = scheduleBlocks[0].lines.join("\n");
  } else if (scheduleBlocks.length > 1) {
    scheduleTitle = scheduleBlocks[0].heading;
    churchSchedule = [
      scheduleBlocks[0].lines.join("\n"),
      ...scheduleBlocks.slice(1).map((sb) => `[${sb.heading}]\n${sb.lines.join("\n")}`),
    ].join("\n\n");
  }

  return {
    churchNews: newsChunks.join("\n\n"),
    scheduleTitle,
    churchSchedule,
  };
}

export function composeBulletinFullContent(
  parts: {
    readonly churchNews: string;
    readonly scheduleTitle?: string;
    readonly churchSchedule: string;
  },
  bulletinIsoDate: string
): string {
  const chunks: string[] = [];
  const trimmedNews = parts.churchNews.trim();
  const trimmedSched = parts.churchSchedule.trim();

  if (trimmedNews.length > 0) {
    if (trimmedNews.startsWith("[")) {
      chunks.push(trimmedNews);
    } else {
      chunks.push(`[교회 소식]\n${trimmedNews}`);
    }
  }

  if (trimmedSched.length > 0) {
    if (trimmedSched.startsWith("[")) {
      chunks.push(trimmedSched);
    } else {
      const cleanHeading =
        (parts.scheduleTitle ?? "")
          .trim()
          .replace(/^\[|\]$/g, "")
          .trim() || formatDefaultBulletinScheduleTitle(bulletinIsoDate);
      chunks.push(`[${cleanHeading}]\n${trimmedSched}`);
    }
  }

  return chunks.join("\n\n");
}

const ENGLISH_MONTH_INDEX: Readonly<Record<string, string>> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function resolveEventIsoDate(evt: {
  readonly date?: string;
  readonly dayBadge: string;
  readonly monthYearBadge: string;
}): string {
  if (evt.date && /^\d{4}-\d{2}-\d{2}$/.test(evt.date.trim())) {
    return evt.date.trim();
  }

  const rawDay = evt.dayBadge.replace(/[^\d]/g, "");
  const dd = (rawDay || "01").padStart(2, "0").slice(-2);
  const rawMonthYear = evt.monthYearBadge.trim();

  // Pattern 1: "2026. 11" or "2026-11" or "2026년 11월"
  const numericMatch = rawMonthYear.match(/(\d{4})\D+(\d{1,2})/);
  if (numericMatch) {
    const yyyy = numericMatch[1];
    const mm = numericMatch[2].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Pattern 2: "Apr 2026" or "April 2026"
  const engMatch = rawMonthYear.match(/([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (engMatch) {
    const mm = ENGLISH_MONTH_INDEX[engMatch[1].toLowerCase()] ?? "01";
    const yyyy = engMatch[2];
    return `${yyyy}-${mm}-${dd}`;
  }

  return `${getKstDateString().slice(0, 7)}-${dd}`;
}

export function formatEventBadgesFromIsoDate(isoDate: string): {
  readonly dayBadge: string;
  readonly monthYearBadge: string;
} {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { dayBadge: "01", monthYearBadge: "2026. 01" };
  }
  return {
    dayBadge: match[3],
    monthYearBadge: `${match[1]}. ${match[2]}`,
  };
}

export type CanonicalResourceCategory =
  | "주일 설교 요약"
  | "소그룹 교재"
  | "주일학교 교재"
  | "성경 공부";

export const CANONICAL_RESOURCE_CATEGORIES: readonly CanonicalResourceCategory[] = [
  "주일 설교 요약",
  "소그룹 교재",
  "주일학교 교재",
  "성경 공부",
];

export function normalizeResourceCategory(
  rawCategory: string
): CanonicalResourceCategory {
  const trimmed = rawCategory.trim();
  if (trimmed === "주일 설교 요약" || trimmed === "설교·예배자료") {
    return "주일 설교 요약";
  }
  if (trimmed === "소그룹 교재") {
    return "소그룹 교재";
  }
  if (trimmed === "주일학교 교재" || trimmed === "다음세대 공과") {
    return "주일학교 교재";
  }
  return "성경 공부";
}

export function extractFileFormatBadge(fileName: string): string {
  const extMatch = fileName.trim().match(/\.([A-Za-z0-9]+)$/);
  if (!extMatch) {
    return "FILE";
  }
  return extMatch[1].toUpperCase();
}

export function matchesYouthDepartment(
  postDepartment: string,
  deptId: "sunday" | "teens" | "young-adults"
): boolean {
  const trimmed = postDepartment.trim();
  if (deptId === "sunday") {
    return trimmed === "유초등부" || trimmed === "주일학교";
  }
  if (deptId === "teens") {
    return trimmed === "중고등부";
  }
  return trimmed === "청년부";
}

export function normalizeYouthDepartmentLabel(
  rawDept: string
): "유초등부" | "중고등부" | "청년부" {
  const trimmed = rawDept.trim();
  if (trimmed === "유초등부" || trimmed === "주일학교") {
    return "유초등부";
  }
  if (trimmed === "중고등부") {
    return "중고등부";
  }
  return "청년부";
}

const IGNORED_STAFF_MINISTRY_PLACEHOLDERS = new Set([
  "담당 부서",
  "담당 사역",
]);

export function splitRawStaffDepartmentTokens(rawInput: string): string[] {
  const trimmed = rawInput.trim();
  if (!trimmed || IGNORED_STAFF_MINISTRY_PLACEHOLDERS.has(trimmed)) {
    return [];
  }

  const byExplicitDelimiters = trimmed
    .split(/[·ㆍ・,/|]+/u)
    .map((token) => token.trim())
    .filter(
      (token) => Boolean(token) && !IGNORED_STAFF_MINISTRY_PLACEHOLDERS.has(token)
    );

  const expanded: string[] = [];
  for (const chunk of byExplicitDelimiters) {
    // Split space-joined department lists like "중고등부 청년부" while preserving phrases like "교회 총괄"
    if (/^\S+부(?:\s+\S+부)+$/u.test(chunk)) {
      expanded.push(...chunk.split(/\s+/u).filter(Boolean));
    } else {
      expanded.push(chunk);
    }
  }

  return Array.from(new Set(expanded));
}

export function parseStaffDepartments(person: {
  readonly department: string;
  readonly departments?: readonly string[];
}): string[] {
  if (Array.isArray(person.departments)) {
    const cleaned = person.departments
      .map((tag) => tag.replace(/^[·ㆍ・,/|\s]+|[·ㆍ・,/|\s]+$/gu, "").trim())
      .filter(
        (tag) => Boolean(tag) && !IGNORED_STAFF_MINISTRY_PLACEHOLDERS.has(tag)
      );
    return Array.from(new Set(cleaned));
  }
  return splitRawStaffDepartmentTokens(person.department);
}

export function formatStaffDepartmentsField(tags: readonly string[]): string {
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(", ");
}

function validUtcCalendarDate(
  year: number,
  month: number,
  day: number
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  ) {
    return dt;
  }
  return null;
}

export function resolveCelebrationMonthDay(
  rawParen: string,
  bulletinIsoDate: string | null
): string | null {
  const trimmed = rawParen.trim();

  const alreadyKorean = trimmed.match(
    /^(음\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*[,\s]\s*([가-힣0-9]{1,8}))?$/
  );
  if (alreadyKorean) {
    const lunarPrefix = alreadyKorean[1] ? "음 " : "";
    const noteSuffix = alreadyKorean[4] ? `, ${alreadyKorean[4]}` : "";
    return `${lunarPrefix}${Number(alreadyKorean[2])}월 ${Number(alreadyKorean[3])}일${noteSuffix}`;
  }

  const slashOrDot = trimmed.match(
    /^(음\s*)?(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\s*[,\s]\s*([가-힣0-9]{1,8}))?$/
  );
  if (slashOrDot) {
    const lunarPrefix = slashOrDot[1] ? "음 " : "";
    const m = Number(slashOrDot[2]);
    const d = Number(slashOrDot[3]);
    const noteSuffix = slashOrDot[4] ? `, ${slashOrDot[4]}` : "";
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${lunarPrefix}${m}월 ${d}일${noteSuffix}`;
    }
  }

  const dayOnly = trimmed.match(
    /^(음\s*)?(\d{1,2})(?:\s*일)?(?:\s*[,\s]\s*([가-힣0-9]{1,8}))?$/
  );
  if (!dayOnly) {
    return null;
  }

  const lunarPrefix = dayOnly[1] ? "음 " : "";
  const day = Number(dayOnly[2]);
  const noteSuffix = dayOnly[3] ? `, ${dayOnly[3]}` : "";
  if (day < 1 || day > 31) {
    return null;
  }

  const fallbackIso = bulletinIsoDate ?? getKstDateString();
  const isoParts = fallbackIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoParts) {
    return null;
  }

  const by = Number(isoParts[1]);
  const bm = Number(isoParts[2]);
  const bd = Number(isoParts[3]);
  const baseUtc = validUtcCalendarDate(by, bm, bd);

  if (!baseUtc) {
    return `${lunarPrefix}${bm}월 ${day}일${noteSuffix}`;
  }

  const nextY = bm === 12 ? by + 1 : by;
  const nextM = bm === 12 ? 1 : bm + 1;
  const prevY = bm === 1 ? by - 1 : by;
  const prevM = bm === 1 ? 12 : bm - 1;

  const curCand = validUtcCalendarDate(by, bm, day);
  const nextCand = validUtcCalendarDate(nextY, nextM, day);
  const prevCand = validUtcCalendarDate(prevY, prevM, day);

  let resolvedMonth = bm;
  if (day >= bd && curCand) {
    resolvedMonth = bm;
  } else if (day < bd) {
    const nextDiffDays = nextCand
      ? Math.round((nextCand.getTime() - baseUtc.getTime()) / 86_400_000)
      : 999;
    if (nextDiffDays >= 0 && nextDiffDays <= 14) {
      resolvedMonth = nextM;
    } else if (curCand) {
      resolvedMonth = bm;
    } else if (prevCand) {
      resolvedMonth = prevM;
    }
  } else if (!curCand && prevCand) {
    resolvedMonth = prevM;
  }

  return `${lunarPrefix}${resolvedMonth}월 ${day}일${noteSuffix}`;
}

export function formatCelebrationValueList(
  rawRhs: string,
  bulletinIsoDate: string | null
): string {
  const entries: string[] = [];
  const tokenRe = /([^()]+?)\(\s*([^()]+?)\s*\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = tokenRe.exec(rawRhs);

  while (match !== null) {
    const cleanNames = match[1]
      .replace(/^[•·▪,\s]+/, "")
      .replace(/([가-힣A-Za-z])\s*[•·▪`/]\s*([가-힣A-Za-z])/g, "$1, $2")
      .replace(/\s*[,/]\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
    const rawDateToken = match[2].trim();
    const resolvedDate = resolveCelebrationMonthDay(
      rawDateToken,
      bulletinIsoDate
    );

    if (cleanNames) {
      entries.push(`${cleanNames} (${resolvedDate ?? rawDateToken})`);
    }
    lastIndex = tokenRe.lastIndex;
    match = tokenRe.exec(rawRhs);
  }

  if (entries.length === 0) {
    return rawRhs.replace(/\s+/g, " ").trim();
  }

  const trailing = rawRhs
    .slice(lastIndex)
    .replace(/^[•·▪,\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (trailing) {
    entries.push(trailing);
  }

  return entries.join(", ");
}

export function normalizeCelebrationLine(
  rawLine: string,
  bulletinIsoDate: string | null
): string {
  const stripped = rawLine.replace(/^[•·▪-]\s*/, "").trim();
  if (!stripped) return "";
  const colonMatch = stripped.match(/^([^:：]{1,12}?)\s*[:：]\s*(.+)$/);
  if (colonMatch) {
    const rawLabel = colonMatch[1].replace(/\s+/g, "");
    const cleanLabel = rawLabel === "결혼기념" || rawLabel === "결혼기념일" ? "결혼" : rawLabel;
    return `${cleanLabel}: ${formatCelebrationValueList(colonMatch[2], bulletinIsoDate)}`;
  }
  return formatCelebrationValueList(stripped, bulletinIsoDate);
}
