import { resolveEventIsoDate } from "@/lib/format-utils";
import type { EventItem } from "@/types/site-content";

const DEPT_TOKENS = ["유초등부", "중고등부", "청년부"] as const;

const CORE_EVENT_KEYWORDS = [
  "성탄발표회",
  "발표회",
  "성탄예배",
  "송구영신",
  "사경회",
  "말씀축제",
  "부흥회",
  "선교",
  "특강",
  "초청예배",
  "추수감사",
  "맥추감사",
  "부활",
  "성례",
  "수련회",
  "찬양대회",
  "퀴즈",
  "제직회",
  "공동의회",
  "어린이",
  "어버이",
  "산행",
  "산책",
  "노회",
  "대청소",
  "연합예배",
  "수능",
] as const;

export function unifyChurchEventSynonyms(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/(?:유년부|초등부|아동부|주일학교|유초등(?!부))/gu, "유초등부")
    .replace(/(?:중등부|고등부|청소년부|중고등(?!부))/gu, "중고등부")
    .replace(/청년\s*연합/gu, "청년부연합")
    .replace(/추수\s*감사\s*(?:절|주일|예배)?/gu, "추수감사")
    .replace(/맥추\s*감사\s*(?:절|주일|예배)?/gu, "맥추감사")
    .replace(/부활\s*(?:절|주일|감사예배|예배)/gu, "부활")
    .replace(
      /성탄(?:절|축하)?\s*(?:발표회|발표|찬양제|축하의밤|행사)/gu,
      "성탄발표회"
    )
    .replace(/성탄(?:절|축하)?\s*(?:감사)?예배/gu, "성탄예배")
    .replace(/(?:성례|성찬)\s*(?:주일|식|예배)?/gu, "성례")
    .replace(/초청\s*(?:주일|감사예배|예배)/gu, "초청예배")
    .replace(/찬양\s*(?:대회|축제|제)/gu, "찬양대회")
    .replace(/(?:성경\s*)?퀴즈\s*대회/gu, "성경퀴즈대회")
    .replace(
      /(?:겨울|동계|여름|하계|봄|춘계|가을|추계)?\s*(?:수련회|수려회|성경학교|캠프)/gu,
      "수련회"
    );
}

export function canonicalizeChurchEventTitle(raw: string): string {
  const unified = unifyChurchEventSynonyms(raw);
  return unified
    .replace(/(?:제\s*)?[1-4]\s*분기/gu, "")
    .replace(
      /(?:상반기|하반기|전교인|구역별|기관별|연말|신년|축하|특별|기념|정기|일일|가족|친구|이웃|새생명|오전예배|오후예배|낮예배|합동|안내|및)/gu,
      ""
    )
    .replace(/[^가-힣a-z0-9]/gu, "");
}

function extractDepartmentTokens(unified: string): readonly string[] {
  return DEPT_TOKENS.filter((dept) => unified.includes(dept));
}

function absDayDiff(isoA: string, isoB: string): number {
  const ma = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoA);
  const mb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoB);
  if (!ma || !mb) return 999;
  const ua = Date.UTC(Number(ma[1]), Number(ma[2]) - 1, Number(ma[3]));
  const ub = Date.UTC(Number(mb[1]), Number(mb[2]) - 1, Number(mb[3]));
  return Math.abs(Math.round((ua - ub) / 86_400_000));
}

export function areChurchEventTitlesEquivalent(
  titleA: string,
  titleB: string,
  sameExactDate: boolean
): boolean {
  const unifiedA = unifyChurchEventSynonyms(titleA);
  const unifiedB = unifyChurchEventSynonyms(titleB);

  const deptsA = extractDepartmentTokens(unifiedA);
  const deptsB = extractDepartmentTokens(unifiedB);
  if (
    deptsA.length > 0 &&
    deptsB.length > 0 &&
    !deptsA.some((d) => deptsB.includes(d))
  ) {
    return false;
  }

  const canonA = canonicalizeChurchEventTitle(titleA);
  const canonB = canonicalizeChurchEventTitle(titleB);
  if (!canonA || !canonB) return false;

  if (canonA === canonB) return true;
  if (canonA.length >= 2 && canonB.includes(canonA)) return true;
  if (canonB.length >= 2 && canonA.includes(canonB)) return true;

  if (sameExactDate) {
    for (const kw of CORE_EVENT_KEYWORDS) {
      if (unifiedA.includes(kw) && unifiedB.includes(kw)) {
        return true;
      }
      if (canonA.includes(kw) && canonB.includes(kw)) {
        return true;
      }
    }
  }

  return false;
}

export function findMatchingRegisteredEvent(
  existingEvents: readonly EventItem[],
  candidateDateIso: string,
  candidateTitle: string
): EventItem | undefined {
  const unifiedCand = unifyChurchEventSynonyms(candidateTitle);
  const isMultiDayRetreat = unifiedCand.includes("수련회");

  return existingEvents.find((ev) => {
    const evDate = resolveEventIsoDate(ev);
    const dayGap = absDayDiff(evDate, candidateDateIso);

    if (dayGap === 0) {
      return areChurchEventTitlesEquivalent(ev.title, candidateTitle, true);
    }

    if (isMultiDayRetreat && dayGap <= 2) {
      return areChurchEventTitlesEquivalent(ev.title, candidateTitle, false);
    }

    return false;
  });
}
