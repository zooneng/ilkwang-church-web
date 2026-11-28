import {
  resolveEventIsoDate,
  splitBulletinNewsAndSchedule,
} from "@/lib/format-utils";
import { addDaysToIsoDate } from "@/lib/popup-utils";
import { isLikelyQuarterlyEventTitle } from "@/lib/quarterly-events";
import type {
  BulletinItem,
  EventItem,
  PopupItem,
  SiteContent,
} from "@/types/site-content";

export interface ProposedBulletinEvent {
  readonly key: string;
  readonly checked: boolean;
  readonly quarterlyRepeat: boolean;
  readonly alreadyExists: boolean;
  readonly isPast: boolean;
  readonly date: string;
  readonly title: string;
  readonly timeText: string;
  readonly location: string;
  readonly description: string;
  readonly sourceText: string;
}

export interface ProposedBulletinPopup {
  readonly key: string;
  readonly checked: boolean;
  readonly alreadyExists: boolean;
  readonly isPast: boolean;
  readonly title: string;
  readonly content: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly linkUrl: string;
  readonly linkLabel: string;
  readonly imageUrl?: string;
  readonly sourceText: string;
}

export interface ProposedBulletinBanner {
  readonly key: string;
  readonly checked: boolean;
  readonly alreadyExists: boolean;
  readonly text: string;
  readonly sourceText: string;
}

export interface BulletinSyncPlan {
  readonly bulletinId: string;
  readonly bulletinDate: string;
  readonly bulletinTitle: string;
  readonly bulletinVolume: string;
  readonly events: readonly ProposedBulletinEvent[];
  readonly popups: readonly ProposedBulletinPopup[];
  readonly banners: readonly ProposedBulletinBanner[];
}

interface RawScheduleEntry {
  readonly date: string;
  readonly title: string;
  readonly spanLabel?: string;
  readonly sourceText: string;
}

interface RawNewsEntry {
  readonly date: string;
  readonly topic: string;
  readonly body: string;
  readonly timeText?: string;
  readonly location?: string;
  readonly speakerLabel?: string;
  readonly summaryDetail: string;
  readonly sourceText: string;
}

interface MergedCandidate {
  readonly date: string;
  readonly title: string;
  readonly timeText: string;
  readonly location: string;
  readonly description: string;
  readonly speakerLabel?: string;
  readonly fromSchedule: boolean;
  readonly hasNewsDetail: boolean;
  readonly isSecularNote: boolean;
  readonly sourceText: string;
}

function validCalendarIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolveMonthDayToIso(
  month: number,
  day: number,
  bulletinIsoDate: string
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bulletinIsoDate.trim());
  const baseYear = match ? Number(match[1]) : new Date().getFullYear();
  const baseMonth = match ? Number(match[2]) : 1;

  let resolvedYear = baseYear;
  if (baseMonth >= 10 && month <= 3) {
    resolvedYear = baseYear + 1;
  } else if (baseMonth === 1 && month === 12) {
    resolvedYear = baseYear - 1;
  }

  return validCalendarIso(resolvedYear, month, day);
}

function diffDaysBetweenIso(fromIso: string, toIso: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromIso);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toIso);
  if (!a || !b) return 999;
  const utcA = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const utcB = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((utcB - utcA) / 86_400_000);
}

function formatKoreanReadableDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function normalizeCompareToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/안내$/u, "")
    .replace(/[^가-힣a-z0-9]/gu, "");
}

function titlesOverlap(a: string, b: string): boolean {
  const na = normalizeCompareToken(a);
  const nb = normalizeCompareToken(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.includes(na)) return true;
  if (nb.length >= 3 && na.includes(nb)) return true;
  return false;
}

const STANDING_ROUTINE_SCHEDULE_RE =
  /^(?:주일오전예배|주일오후예배|주일예배|수요기도회|수요예배|금요기도회|새벽기도회?)(?:\s*[:：]|$)/u;

const ROUTINE_OR_PERSONAL_NEWS_RE =
  /(?:기도\s*1\s*\.\s*2\s*\.\s*20|월\s*[-~]\s*금\s*새벽|처음\s*(?:오신|나오신)|새로\s*나오신|진심으로\s*환영합니다|일광가족카드|등록카드|자동으로\s*분리\s*입력|관리자\s*모드|달력이?\s*준비|교회\s*요람|기부금\s*영수증|연말정산|식당\s*봉사|교회\s*청소|중식\s*제공|주차\s*안내|준비위원\s*모임|준비\s*모임|위원\s*모임|임원\s*모임|교사\s*모임|결혼식|장례|별세|소천|입원|퇴원|출산|개업)/u;

const PAST_REPORT_NEWS_RE =
  /(?:은혜\s*가운데\s*마쳤|잘\s*마쳤습니다|마쳤습니다|다녀왔습니다|드렸습니다)/u;

const SECULAR_CALENDAR_NOTE_RE = /(?:대학수학능력시험|수능일?)/u;

function inferDefaultTimeFromTitle(title: string, spanLabel?: string): string {
  if (spanLabel) {
    return spanLabel;
  }
  if (/송구영신/u.test(title)) {
    return "밤 11:00";
  }
  if (/수요/u.test(title)) {
    return "수요일 저녁 7:30";
  }
  if (/금요/u.test(title)) {
    return "금요일 저녁 8:00";
  }
  if (/새벽/u.test(title)) {
    return "새벽 5:00";
  }
  if (
    /(?:발표회|찬양대회|찬양제|퀴즈대회|오후|특강|간증|사역보고|제직회|공동의회)/u.test(
      title
    )
  ) {
    return "주일 오후 1:30";
  }
  if (/(?:성탄축하예배|성탄예배|성탄절\s*예배)/u.test(title)) {
    return "오전 11:00";
  }
  if (SECULAR_CALENDAR_NOTE_RE.test(title)) {
    return "전일 중보기도";
  }
  return "오전 9:30, 오전 11:00";
}

function inferLocationFromText(text: string): string {
  if (/서울여자대학교/u.test(text)) return "서울여자대학교";
  if (/일광학사관|학사관/u.test(text)) return "일광학사관";
  if (/교육관/u.test(text)) return "일광교회 교육관";
  if (/비전홀/u.test(text)) return "일광교회 비전홀";
  if (/기도실/u.test(text)) return "일광교회 기도실";
  return "일광교회 본당";
}

function parseScheduleEntries(
  rawSchedule: string,
  bulletinIsoDate: string
): readonly RawScheduleEntry[] {
  if (!rawSchedule.trim()) return [];
  const results: RawScheduleEntry[] = [];

  for (const rawLine of rawSchedule.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^\[.+\]$/.test(trimmed)) continue;

    const stripped = trimmed.replace(/^[•·\u25aa▣∎\-*]+\s*/u, "").trim();
    if (!stripped || STANDING_ROUTINE_SCHEDULE_RE.test(stripped)) {
      continue;
    }

    // Pattern 1: "11월 29일: 선교 특강" or "1월 23일(금) ~ 24일(토): 유초등부 겨울수련회"
    const korMatch =
      /^(\d{1,2})\s*월\s*(\d{1,2})\s*일?(?:\s*\([^)]{1,4}\))?(?:\s*[~–-]\s*((?:\d{1,2}\s*월\s*)?\d{1,2}\s*일?(?:\s*\([^)]{1,4}\))?))?(?:\s*[:：-]\s*|\s+)(.+)$/u.exec(
        stripped
      );
    if (korMatch) {
      const month = Number(korMatch[1]);
      const day = Number(korMatch[2]);
      const spanTail = korMatch[3]?.trim();
      const eventTitle = korMatch[4]?.trim() ?? "";
      const dateIso = resolveMonthDayToIso(month, day, bulletinIsoDate);
      if (dateIso && eventTitle && !STANDING_ROUTINE_SCHEDULE_RE.test(eventTitle)) {
        const spanLabel = spanTail
          ? `${month}월 ${day}일 ~ ${spanTail.replace(/\s+/g, " ")}`
          : undefined;
        results.push({
          date: dateIso,
          title: eventTitle,
          spanLabel,
          sourceText: stripped,
        });
      }
      continue;
    }

    // Pattern 2: "12/25: 성탄축하예배" or "12.25: 성탄축하예배"
    const numMatch =
      /^(\d{1,2})\s*[/.]\s*(\d{1,2})(?:\s*\([^)]{1,4}\))?(?:\s*[~–-]\s*((?:\d{1,2}\s*[/.]\s*)?\d{1,2}(?:\s*\([^)]{1,4}\))?))?\s*[:：-]\s*(.+)$/u.exec(
        stripped
      );
    if (numMatch) {
      const month = Number(numMatch[1]);
      const day = Number(numMatch[2]);
      const spanTail = numMatch[3]?.trim();
      const eventTitle = numMatch[4]?.trim() ?? "";
      const dateIso = resolveMonthDayToIso(month, day, bulletinIsoDate);
      if (dateIso && eventTitle && !STANDING_ROUTINE_SCHEDULE_RE.test(eventTitle)) {
        const spanLabel = spanTail ? `${month}/${day} ~ ${spanTail}` : undefined;
        results.push({
          date: dateIso,
          title: eventTitle,
          spanLabel,
          sourceText: stripped,
        });
      }
    }
  }

  return results;
}

function groupNumberedNewsItems(rawNews: string): readonly string[] {
  if (!rawNews.trim()) return [];
  const items: string[] = [];
  let current = "";

  for (const rawLine of rawNews.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^\[.+\]$/.test(trimmed)) continue;

    if (/^\d{1,2}[.)]\s*/u.test(trimmed)) {
      if (current) items.push(current);
      current = trimmed.replace(/^\d{1,2}[.)]\s*/u, "").trim();
    } else if (/^[•·\u25aa]\s*/u.test(trimmed)) {
      if (current) items.push(current);
      current = trimmed.replace(/^[•·\u25aa]\s*/u, "").trim();
    } else if (current) {
      current = `${current} ${trimmed}`;
    } else {
      current = trimmed;
    }
  }
  if (current) {
    items.push(current);
  }
  return items;
}

function extractTimeFromNewsText(topic: string, body: string): string | undefined {
  const combined = `${topic} ${body}`;

  const jointMatch =
    /(1\s*,\s*2부\s*합동)(?:으로)?\s*(?:오전\s*)?(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/u.exec(
      combined
    );
  if (jointMatch) {
    const hh = jointMatch[2];
    const mm = jointMatch[3] ? jointMatch[3].padStart(2, "0") : "00";
    return `오전 ${hh}:${mm} (1, 2부 합동)`;
  }

  const periodMatch =
    /(오전|오후|저녁|밤|새벽)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/u.exec(
      combined
    );
  if (periodMatch) {
    const period = periodMatch[1];
    const hh = periodMatch[2];
    const mm = periodMatch[3] ? periodMatch[3].padStart(2, "0") : "00";
    return `${period} ${hh}:${mm}`;
  }

  const plainHourMatch =
    /(?<![0-9.])(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*(?:에\s*드립니다|예배|시작)/u.exec(
      combined
    );
  if (plainHourMatch) {
    const hhNum = Number(plainHourMatch[1]);
    const mm = plainHourMatch[2] ? plainHourMatch[2].padStart(2, "0") : "00";
    const period = hhNum >= 7 && hhNum <= 11 ? "오전" : "오후";
    return `${period} ${hhNum}:${mm}`;
  }

  if (topic.replace(/\s+/g, "") === "오후예배" || /오후예배/u.test(combined)) {
    return "주일 오후 1:30";
  }

  return undefined;
}

function extractSpeakerFromNewsText(body: string): string | undefined {
  const explicitWithRole =
    /강사\s*[:：]\s*([가-힣]{2,4}?)\s*(목사|선교사|강도사|전도사|장로|교수|박사)(?:\s*\(([^)]+)\))?/u.exec(
      body
    );
  if (explicitWithRole) {
    const name = explicitWithRole[1];
    const role = explicitWithRole[2];
    const affil = explicitWithRole[3] ? ` (${explicitWithRole[3].trim()})` : "";
    return `${name} ${role}${affil}`.trim();
  }

  const explicitPlain = /강사\s*[:：]\s*([가-힣]{2,6})(?:\s*\(([^)]+)\))?/u.exec(
    body
  );
  if (explicitPlain) {
    const name = explicitPlain[1];
    const affil = explicitPlain[2] ? ` (${explicitPlain[2].trim()})` : "";
    return `${name}${affil}`.trim();
  }

  const honorificMatch =
    /([가-힣]{2,4}?)\s*(목사|선교사|강도사|전도사|장로|교수)(?:\s*\(([^)]+)\))?(?:님)?(?:께서|의\s*사역보고|의\s*특강|초청)/u.exec(
      body
    );
  if (honorificMatch) {
    const name = honorificMatch[1];
    const role = honorificMatch[2];
    const affil = honorificMatch[3] ? ` (${honorificMatch[3].trim()})` : "";
    return `${name} ${role}${affil}`.trim();
  }

  return undefined;
}

function parseNewsEntries(
  rawNews: string,
  bulletinIsoDate: string
): readonly RawNewsEntry[] {
  const grouped = groupNumberedNewsItems(rawNews);
  const results: RawNewsEntry[] = [];

  for (const item of grouped) {
    if (ROUTINE_OR_PERSONAL_NEWS_RE.test(item)) {
      continue;
    }
    if (PAST_REPORT_NEWS_RE.test(item) && !/\d{1,2}\s*월\s*\d{1,2}\s*일/u.test(item)) {
      continue;
    }

    const colonMatch = /^([^:：]{1,20}?)\s*[:：]\s*(.+)$/u.exec(item);
    const topic = colonMatch ? colonMatch[1].trim() : "";
    const body = colonMatch ? colonMatch[2].trim() : item.trim();

    if (ROUTINE_OR_PERSONAL_NEWS_RE.test(topic)) {
      continue;
    }

    let dateIso: string | null = null;
    const korDateMatch = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/u.exec(body);
    if (korDateMatch) {
      dateIso = resolveMonthDayToIso(
        Number(korDateMatch[1]),
        Number(korDateMatch[2]),
        bulletinIsoDate
      );
    } else if (/다음\s*주(?:일)?/u.test(body)) {
      dateIso = addDaysToIsoDate(bulletinIsoDate, 7);
    } else if (
      /오늘|이번\s*주일/u.test(body) ||
      topic.replace(/\s+/g, "") === "오후예배"
    ) {
      dateIso = bulletinIsoDate;
    }

    if (!dateIso) {
      continue;
    }

    const timeText = extractTimeFromNewsText(topic, body);
    const speakerLabel = extractSpeakerFromNewsText(body);
    const location =
      /서울여자대학교|학사관|교육관|비전홀|기도실|본당/u.test(body)
        ? inferLocationFromText(body)
        : undefined;

    let cleanTopic = topic;
    if (!cleanTopic || cleanTopic.replace(/\s+/g, "") === "오후예배") {
      if (/사역보고/u.test(body)) {
        cleanTopic = "오후예배 선교 사역보고";
      } else if (/선교사/u.test(body)) {
        cleanTopic = "오후예배 선교 말씀";
      } else {
        cleanTopic = topic || "주일 특별 안내";
      }
    }

    const cleanedBody = body
      .replace(/^\d{1,2}\s*월\s*\d{1,2}\s*일(?:\([^)]*\))?\s*[,，]?\s*/u, "")
      .replace(/\s+/g, " ")
      .trim();

    results.push({
      date: dateIso,
      topic: cleanTopic,
      body: cleanedBody,
      timeText,
      location,
      speakerLabel,
      summaryDetail: speakerLabel ? `강사: ${speakerLabel}` : cleanedBody,
      sourceText: item,
    });
  }

  return results;
}

function mergeScheduleAndNews(
  scheduleEntries: readonly RawScheduleEntry[],
  newsEntries: readonly RawNewsEntry[]
): readonly MergedCandidate[] {
  const consumedNewsIndexes = new Set<number>();
  const merged: MergedCandidate[] = [];

  for (const sched of scheduleEntries) {
    const matchingNewsIdx = newsEntries.findIndex(
      (n, idx) => !consumedNewsIndexes.has(idx) && n.date === sched.date
    );
    const matchedNews =
      matchingNewsIdx >= 0 ? newsEntries[matchingNewsIdx] : undefined;
    if (matchingNewsIdx >= 0) {
      consumedNewsIndexes.add(matchingNewsIdx);
    }

    let mergedTitle = sched.title;
    if (
      matchedNews &&
      matchedNews.topic &&
      !matchedNews.topic.startsWith("오후예배") &&
      !titlesOverlap(sched.title, matchedNews.topic)
    ) {
      mergedTitle = `${sched.title} (${matchedNews.topic})`;
    }

    const timeText =
      matchedNews?.timeText ??
      inferDefaultTimeFromTitle(mergedTitle, sched.spanLabel);
    const location =
      matchedNews?.location ?? inferLocationFromText(`${mergedTitle} ${matchedNews?.body ?? ""}`);

    const descriptionParts: string[] = [];
    if (matchedNews?.speakerLabel) {
      descriptionParts.push(`강사: ${matchedNews.speakerLabel}`);
    } else if (matchedNews?.body) {
      descriptionParts.push(matchedNews.body);
    }

    merged.push({
      date: sched.date,
      title: mergedTitle,
      timeText,
      location,
      description: descriptionParts.join(", "),
      speakerLabel: matchedNews?.speakerLabel,
      fromSchedule: true,
      hasNewsDetail: Boolean(matchedNews),
      isSecularNote: SECULAR_CALENDAR_NOTE_RE.test(mergedTitle),
      sourceText: matchedNews
        ? `${sched.sourceText} / ${matchedNews.sourceText}`
        : sched.sourceText,
    });
  }

  newsEntries.forEach((news, idx) => {
    if (consumedNewsIndexes.has(idx)) return;
    merged.push({
      date: news.date,
      title: news.topic,
      timeText: news.timeText ?? inferDefaultTimeFromTitle(news.topic),
      location: news.location ?? inferLocationFromText(news.body),
      description: news.speakerLabel ? `강사: ${news.speakerLabel}` : news.body,
      speakerLabel: news.speakerLabel,
      fromSchedule: false,
      hasNewsDetail: true,
      isSecularNote: SECULAR_CALENDAR_NOTE_RE.test(news.topic),
      sourceText: news.sourceText,
    });
  });

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

function isEventAlreadyRegistered(
  cand: MergedCandidate,
  existingEvents: readonly EventItem[]
): boolean {
  return existingEvents.some((ev) => {
    const evDate = resolveEventIsoDate(ev);
    if (evDate !== cand.date) return false;
    return titlesOverlap(ev.title, cand.title);
  });
}

function isPopupAlreadyRegistered(
  popupTitle: string,
  candTitle: string,
  existingPopups: readonly PopupItem[]
): boolean {
  return existingPopups.some(
    (p) => titlesOverlap(p.title, popupTitle) || titlesOverlap(p.title, candTitle)
  );
}

function isBannerAlreadyRegistered(
  bannerText: string,
  candTitle: string,
  existingBanners: readonly string[]
): boolean {
  const normText = normalizeCompareToken(bannerText);
  const normTitle = normalizeCompareToken(candTitle);
  return existingBanners.some((line) => {
    const normExisting = normalizeCompareToken(line);
    if (!normExisting) return false;
    if (normExisting === normText) return true;
    return normTitle.length >= 4 && normExisting.includes(normTitle);
  });
}

export function extractBulletinSyncPlan(
  bulletin: BulletinItem,
  existingContent: Pick<SiteContent, "events" | "popups" | "topBannerNotices">,
  todayIso: string
): BulletinSyncPlan {
  const safeBulletinDate = /^\d{4}-\d{2}-\d{2}$/.test(bulletin.date.trim())
    ? bulletin.date.trim()
    : todayIso;

  const split = splitBulletinNewsAndSchedule(
    bulletin.fullContent,
    safeBulletinDate
  );
  const rawNews = (bulletin.churchNews ?? split.churchNews).trim();
  const rawSchedule = (bulletin.churchSchedule ?? split.churchSchedule).trim();

  const scheduleEntries = parseScheduleEntries(rawSchedule, safeBulletinDate);
  const newsEntries = parseNewsEntries(rawNews, safeBulletinDate);
  const merged = mergeScheduleAndNews(scheduleEntries, newsEntries);

  // 1. Proposed Events
  const events: ProposedBulletinEvent[] = merged.map((cand, idx) => {
    const alreadyExists = isEventAlreadyRegistered(cand, existingContent.events);
    const isPast = cand.date < todayIso;
    const checked = !alreadyExists && !isPast && !cand.isSecularNote;
    return {
      key: `ev-${cand.date}-${idx}`,
      checked,
      quarterlyRepeat: isLikelyQuarterlyEventTitle(cand.title),
      alreadyExists,
      isPast,
      date: cand.date,
      title: cand.title,
      timeText: cand.timeText,
      location: cand.location,
      description: cand.description,
      sourceText: cand.sourceText,
    };
  });

  // 2. Proposed Popups (prioritize church-wide schedule + news items, cap auto-checked at 2)
  const nonSecular = merged.filter((cand) => !cand.isSecularNote);
  const popupDraftMeta = nonSecular.map((cand, idx) => {
    const popupTitle = cand.title.endsWith("안내")
      ? cand.title
      : `${cand.title} 안내`;
    const alreadyExists = isPopupAlreadyRegistered(
      popupTitle,
      cand.title,
      existingContent.popups
    );
    const isPast = cand.date < todayIso;
    const daysUntil = diffDaysBetweenIso(todayIso, cand.date);
    const priorityScore =
      (cand.fromSchedule && cand.hasNewsDetail ? 100 : 0) +
      (cand.fromSchedule ? 40 : 0) +
      (cand.hasNewsDetail ? 25 : 0) +
      (daysUntil <= 14 ? 20 : daysUntil <= 28 ? 10 : 0);

    const detailLines = [
      `일시: ${formatKoreanReadableDate(cand.date)} ${cand.timeText}`.trim(),
      `장소: ${cand.location}`,
    ];
    if (cand.description) {
      detailLines.push(cand.description);
    }

    return {
      key: `popup-${cand.date}-${idx}`,
      alreadyExists,
      isPast,
      priorityScore,
      daysUntil,
      fromSchedule: cand.fromSchedule,
      hasNewsDetail: cand.hasNewsDetail,
      title: popupTitle,
      content: detailLines.join("\n"),
      startDate: todayIso,
      endDate:
        cand.date >= todayIso ? cand.date : addDaysToIsoDate(todayIso, 7),
      linkUrl: "/news/events",
      linkLabel: "행사 일정 보기",
      sourceText: cand.sourceText,
    };
  });

  const autoCheckedPopupKeys = new Set(
    popupDraftMeta
      .filter(
        (m) =>
          !m.alreadyExists &&
          !m.isPast &&
          (m.hasNewsDetail || m.daysUntil <= 21)
      )
      .sort(
        (a, b) =>
          b.priorityScore - a.priorityScore ||
          a.endDate.localeCompare(b.endDate)
      )
      .slice(0, 2)
      .map((m) => m.key)
  );

  if (autoCheckedPopupKeys.size === 0) {
    const nearestEligible = popupDraftMeta.find(
      (m) => !m.alreadyExists && !m.isPast
    );
    if (nearestEligible) {
      autoCheckedPopupKeys.add(nearestEligible.key);
    }
  }

  const popups: ProposedBulletinPopup[] = popupDraftMeta.map((m) => ({
    key: m.key,
    checked: autoCheckedPopupKeys.has(m.key),
    alreadyExists: m.alreadyExists,
    isPast: m.isPast,
    title: m.title,
    content: m.content,
    startDate: m.startDate,
    endDate: m.endDate,
    linkUrl: m.linkUrl,
    linkLabel: m.linkLabel,
    sourceText: m.sourceText,
  }));

  // 3. Proposed Top-Banner Notices (concise single-line summary, auto-check top 1 highest-priority upcoming notice)
  const bannerMeta = nonSecular
    .filter((cand) => cand.date >= todayIso)
    .map((cand, idx) => {
      const readableDate = formatKoreanReadableDate(cand.date);
      const tailParts = [cand.timeText];
      if (cand.speakerLabel) {
        tailParts.push(`강사: ${cand.speakerLabel}`);
      }
      const bannerText = `${readableDate} ${cand.title} 안내 — ${tailParts.join(", ")}`;
      const alreadyExists = isBannerAlreadyRegistered(
        bannerText,
        cand.title,
        existingContent.topBannerNotices
      );
      const daysUntil = diffDaysBetweenIso(todayIso, cand.date);
      const priorityScore =
        (cand.fromSchedule && cand.hasNewsDetail ? 100 : 0) +
        (cand.fromSchedule ? 40 : 0) +
        (cand.hasNewsDetail ? 25 : 0) +
        (daysUntil <= 14 ? 20 : 0);

      return {
        key: `banner-${cand.date}-${idx}`,
        alreadyExists,
        priorityScore,
        date: cand.date,
        text: bannerText,
        sourceText: cand.sourceText,
      };
    });

  const topBannerKey = bannerMeta
    .filter((b) => !b.alreadyExists)
    .sort(
      (a, b) => b.priorityScore - a.priorityScore || a.date.localeCompare(b.date)
    )[0]?.key;

  const banners: ProposedBulletinBanner[] = bannerMeta.map((b) => ({
    key: b.key,
    checked: Boolean(topBannerKey && b.key === topBannerKey),
    alreadyExists: b.alreadyExists,
    text: b.text,
    sourceText: b.sourceText,
  }));

  return {
    bulletinId: bulletin.id,
    bulletinDate: safeBulletinDate,
    bulletinTitle: bulletin.title,
    bulletinVolume: bulletin.volume,
    events,
    popups,
    banners,
  };
}
