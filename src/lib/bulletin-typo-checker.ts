import type { BulletinItem } from "@/types/site-content";

export type BulletinIssueSeverity = "warning" | "info";

export type BulletinFieldKey =
  | "date"
  | "volume"
  | "sermonTitle"
  | "scripture"
  | "preacher"
  | "worshipOrder"
  | "churchNews"
  | "scheduleTitle"
  | "churchSchedule"
  | "celebrations";

export interface BulletinCheckInput {
  readonly currentId?: string;
  readonly date: string;
  readonly volume: string;
  readonly sermonTitle: string;
  readonly scripture: string;
  readonly preacher: string;
  readonly worshipOrderText: string;
  readonly churchNews: string;
  readonly scheduleTitle: string;
  readonly churchSchedule: string;
  readonly celebrationsText: string;
}

export interface BulletinIssue {
  readonly id: string;
  readonly severity: BulletinIssueSeverity;
  readonly field: BulletinFieldKey;
  readonly fieldLabel: string;
  readonly matchedText?: string;
  readonly suggestedText?: string;
  readonly message: string;
}

export interface HighlightSegment {
  readonly text: string;
  readonly highlighted: boolean;
}

interface TypoRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly replaceWith: string | ((matched: string) => string);
  readonly reason: (matched: string, suggested: string) => string;
}

const KOREAN_WEEKDAYS = [
  "주일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;

const TYPO_RULES: readonly TypoRule[] = [
  {
    id: "myeochil",
    pattern: /(?<![가-힣])몇\s*일(?=[간동남지이은에로도요,\s.)]|$)/g,
    replaceWith: "며칠",
    reason: (m, s) => `'${m}'은 '${s}'이 바른 맞춤법입니다.`,
  },
  {
    id: "month-myeochil",
    pattern: /(\d{1,2}월\s*)몇\s*일/g,
    replaceWith: (m) => m.replace(/몇\s*일/, "며칠"),
    reason: (m, s) => `'${m}'은 '${s}'이 바른 표기입니다.`,
  },
  {
    id: "doet",
    pattern: /됬/g,
    replaceWith: "됐",
    reason: () => "'됬'은 없는 글자이며 '됐'(되었)이 바른 표기입니다.",
  },
  {
    id: "doeseo",
    pattern: /되서(?=[요,\s.!]|$)/g,
    replaceWith: "돼서",
    reason: () => "'되서'는 '돼서'(되어서)가 바른 표기입니다.",
  },
  {
    id: "doeyo",
    pattern: /(?<!안)되요(?=[,\s.!]|$)/g,
    replaceWith: "돼요",
    reason: () => "'되요'는 '돼요'(되어요)가 바른 표기입니다.",
  },
  {
    id: "andoeyo",
    pattern: /안되요/g,
    replaceWith: "안 돼요",
    reason: () => "'안되요'는 '안 돼요'가 바른 표기입니다.",
  },
  {
    id: "wenji",
    pattern: /웬지/g,
    replaceWith: "왠지",
    reason: () => "'웬지'는 '왠지'(왜인지)가 바른 표기입니다.",
  },
  {
    id: "oraenmane",
    pattern: /오랫만에/g,
    replaceWith: "오랜만에",
    reason: () => "'오랫만에'는 '오랜만에'가 바른 표기입니다.",
  },
  {
    id: "geumse",
    pattern: /금새(?=[,\s.]|$)/g,
    replaceWith: "금세",
    reason: () => "'금새' 대신 '금세'(금시에)가 바른 표기입니다.",
  },
  {
    id: "eotteoke",
    pattern: /어떡해(?=\s+(?:하|해|합|할))/g,
    replaceWith: "어떻게",
    reason: () => "뒤에 동사가 올 때는 '어떻게'가 바른 표기입니다.",
  },
  {
    id: "seollem",
    pattern: /설레임/g,
    replaceWith: "설렘",
    reason: () => "'설레임'은 '설렘'이 바른 표기입니다.",
  },
  {
    id: "iljjigi",
    pattern: /일찌기/g,
    replaceWith: "일찍이",
    reason: () => "'일찌기'는 '일찍이'가 바른 표기입니다.",
  },
  {
    id: "deougi",
    pattern: /더우기/g,
    replaceWith: "더욱이",
    reason: () => "'더우기'는 '더욱이'가 바른 표기입니다.",
  },
  {
    id: "kkaekkeusi",
    pattern: /깨끗히/g,
    replaceWith: "깨끗이",
    reason: () => "'깨끗히'는 '깨끗이'가 바른 표기입니다.",
  },
  {
    id: "kkomkkomhi",
    pattern: /꼼꼼이(?=\s)/g,
    replaceWith: "꼼꼼히",
    reason: () => "'꼼꼼이'는 '꼼꼼히'가 바른 표기입니다.",
  },
  {
    id: "kkaedal",
    pattern: /깨닳/g,
    replaceWith: "깨달",
    reason: () => "'깨닳-'은 '깨달-'이 바른 표기입니다.",
  },
  {
    id: "bwaeyo",
    pattern: /뵈요(?=[,\s.!]|$)/g,
    replaceWith: "봬요",
    reason: () => "'뵈요'는 '봬요'(뵈어요)가 바른 표기입니다.",
  },
  {
    id: "huihan",
    pattern: /희안하/g,
    replaceWith: "희한하",
    reason: () => "'희안하다'는 '희한하다'가 바른 표기입니다.",
  },
  {
    id: "eoi",
    pattern: /어의없/g,
    replaceWith: "어이없",
    reason: () => "'어의없다'는 '어이없다'가 바른 표기입니다.",
  },
  // Church & Worship Liturgy Terms
  {
    id: "yebe",
    pattern: /예베/g,
    replaceWith: "예배",
    reason: () => "'예베' 오타가 있습니다 ('예배').",
  },
  {
    id: "damim-moksi",
    pattern: /담임목시/g,
    replaceWith: "담임목사",
    reason: () => "'담임목시' 오타가 있습니다 ('담임목사').",
  },
  {
    id: "bumoksi",
    pattern: /부목시/g,
    replaceWith: "부목사",
    reason: () => "'부목시' 오타가 있습니다 ('부목사').",
  },
  {
    id: "gangdosi",
    pattern: /강도시/g,
    replaceWith: "강도사",
    reason: () => "'강도시' 오타가 있습니다 ('강도사').",
  },
  {
    id: "jeondosi",
    pattern: /전도시/g,
    replaceWith: "전도사",
    reason: () => "'전도시' 오타가 있습니다 ('전도사').",
  },
  {
    id: "bongduk",
    pattern: /성경봉둑/g,
    replaceWith: "성경봉독",
    reason: () => "'성경봉둑' 오타가 있습니다 ('성경봉독').",
  },
  {
    id: "sadosingang",
    pattern: /사도신강/g,
    replaceWith: "사도신경",
    reason: () => "'사도신강' 오타가 있습니다 ('사도신경').",
  },
  {
    id: "jugidomeun",
    pattern: /주기도믄/g,
    replaceWith: "주기도문",
    reason: () => "'주기도믄' 오타가 있습니다 ('주기도문').",
  },
  {
    id: "chansonggi",
    pattern: /찬송기(?=\s|\d|$)/g,
    replaceWith: "찬송가",
    reason: () => "'찬송기' 오타가 있습니다 ('찬송가').",
  },
  {
    id: "bonghyeon",
    pattern: /봉현(?=\s|기|드|합|위|$)/g,
    replaceWith: "봉헌",
    reason: () => "'봉현' 오타가 있습니다 ('봉헌').",
  },
  {
    id: "gyodukmun",
    pattern: /교둑문/g,
    replaceWith: "교독문",
    reason: () => "'교둑문' 오타가 있습니다 ('교독문').",
  },
  {
    id: "halleluya",
    pattern: /할렐루아/g,
    replaceWith: "할렐루야",
    reason: () => "'할렐루아' 대신 표준 교회 표기인 '할렐루야'를 권장합니다.",
  },
  {
    id: "gidohui",
    pattern: /기도희/g,
    replaceWith: "기도회",
    reason: () => "'기도희' 오타가 있습니다 ('기도회').",
  },
  {
    id: "jeondohui",
    pattern: /전도희/g,
    replaceWith: "전도회",
    reason: () => "'전도희' 오타가 있습니다 ('전도회').",
  },
  {
    id: "seongyohui",
    pattern: /선교희/g,
    replaceWith: "선교회",
    reason: () => "'선교희' 오타가 있습니다 ('선교회').",
  },
  {
    id: "jejikhui",
    pattern: /제직희/g,
    replaceWith: "제직회",
    reason: () => "'제직희' 오타가 있습니다 ('제직회').",
  },
  {
    id: "gongdonguihui",
    pattern: /공동의희/g,
    replaceWith: "공동의회",
    reason: () => "'공동의희' 오타가 있습니다 ('공동의회').",
  },
  {
    id: "chusugamsajeol",
    pattern: /추수감사졀/g,
    replaceWith: "추수감사절",
    reason: () => "'추수감사졀' 오타가 있습니다 ('추수감사절').",
  },
  {
    id: "buhwaljeol",
    pattern: /부활졀/g,
    replaceWith: "부활절",
    reason: () => "'부활졀' 오타가 있습니다 ('부활절').",
  },
  {
    id: "seongtanjeol",
    pattern: /성탄졀/g,
    replaceWith: "성탄절",
    reason: () => "'성탄졀' 오타가 있습니다 ('성탄절').",
  },
  {
    id: "double-colon",
    pattern: /(\d{1,3})::(\d{1,3})/g,
    replaceWith: "$1:$2",
    reason: (m, s) => `장절 또는 시간 표기에 콜론이 두 번 들어갔습니다 ('${m}' → '${s}').`,
  },
];

function scanFieldTextIssues(
  field: BulletinFieldKey,
  fieldLabel: string,
  text: string,
  out: BulletinIssue[]
): void {
  if (!text.trim()) return;

  // 1. Dictionary & Orthography Rules
  for (const rule of TYPO_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const seenMatches = new Set<string>();
    for (const match of text.matchAll(regex)) {
      const matched = match[0];
      if (!matched || seenMatches.has(matched)) continue;
      seenMatches.add(matched);
      const suggested =
        typeof rule.replaceWith === "function"
          ? rule.replaceWith(matched)
          : matched.replace(new RegExp(rule.pattern.source), rule.replaceWith);
      if (suggested === matched) continue;
      out.push({
        id: `${field}-${rule.id}-${matched}`,
        severity: "warning",
        field,
        fieldLabel,
        matchedText: matched,
        suggestedText: suggested,
        message: rule.reason(matched, suggested),
      });
    }
  }

  // 2. Stray Hangul Jamo attached to words or standalone vowels (e.g. 예배ㅇ., 기도ㅎ, 11시ㅏ)
  const jamoAttachedRegex = /([가-힣0-9]+)([ㄱ-ㅎㅏ-ㅣ]+)(?![가-힣])/g;
  const seenJamo = new Set<string>();
  for (const m of text.matchAll(jamoAttachedRegex)) {
    const full = m[0];
    const clean = m[1];
    const stray = m[2];
    if (!full || !clean || !stray || seenJamo.has(full)) continue;
    seenJamo.add(full);
    out.push({
      id: `${field}-jamo-${full}`,
      severity: "warning",
      field,
      fieldLabel,
      matchedText: full,
      suggestedText: clean,
      message: `'${full}' 끝에 실수로 입력된 자음 또는 모음('${stray}')이 붙어 있습니다.`,
    });
  }

  const standaloneVowelRegex = /(?<![가-힣ㄱ-ㅎㅏ-ㅣ])[ㅏ-ㅣ]+(?![가-힣])/g;
  for (const m of text.matchAll(standaloneVowelRegex)) {
    const vowel = m[0];
    if (!vowel || seenJamo.has(vowel)) continue;
    seenJamo.add(vowel);
    out.push({
      id: `${field}-vowel-${vowel}`,
      severity: "warning",
      field,
      fieldLabel,
      matchedText: vowel,
      suggestedText: "",
      message: `단독으로 잘못 입력된 모음('${vowel}')이 있습니다.`,
    });
  }

  // 3. Consecutive Repeated Words (e.g. "예배 예배", "오전 오전")
  const dupWordRegex = /([가-힣]{2,})([ \t]+)\1(?![가-힣])/g;
  const seenDup = new Set<string>();
  for (const m of text.matchAll(dupWordRegex)) {
    const full = m[0];
    const word = m[1];
    if (!full || !word || seenDup.has(full)) continue;
    if (word.endsWith("씩") || word.endsWith("마다") || word === "하루") continue;
    seenDup.add(full);
    out.push({
      id: `${field}-dup-${word}`,
      severity: "warning",
      field,
      fieldLabel,
      matchedText: full,
      suggestedText: word,
      message: `같은 단어('${word}')가 두 번 연속 입력되었습니다.`,
    });
  }

  // 4. Impossible Month or Day Numbers (e.g. 13월, 32일)
  for (const m of text.matchAll(/(?:^|[^\d])((?:1[3-9]|[2-9]\d)월)/g)) {
    const badMonth = m[1];
    if (badMonth) {
      out.push({
        id: `${field}-month-${badMonth}`,
        severity: "warning",
        field,
        fieldLabel,
        matchedText: badMonth,
        message: `존재하지 않는 월 표기('${badMonth}')가 있습니다. 숫자를 확인해 주세요.`,
      });
    }
  }
  for (const m of text.matchAll(/(?:^|[^\d])((?:3[2-9]|[4-9]\d|00)일)(?![가-힣])/g)) {
    const badDay = m[1];
    if (badDay) {
      out.push({
        id: `${field}-day-${badDay}`,
        severity: "warning",
        field,
        fieldLabel,
        matchedText: badDay,
        message: `존재하지 않는 일자 표기('${badDay}')가 있습니다. 숫자를 확인해 주세요.`,
      });
    }
  }

  // 5. Unmatched Parentheses per Line (ignoring list markers like "1)", "가)", "현)")
  const lines = text.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx]?.trim() ?? "";
    if (!rawLine) continue;
    const strippedMarkers = rawLine.replace(
      /(?:^|\s)(?:\d{1,2}|[가-하]|[현전])\)/g,
      ""
    );
    const openCount = (strippedMarkers.match(/\(/g) ?? []).length;
    const closeCount = (strippedMarkers.match(/\)/g) ?? []).length;
    if (openCount !== closeCount) {
      const previewSnippet =
        rawLine.length > 28 ? `${rawLine.slice(0, 28)}...` : rawLine;
      out.push({
        id: `${field}-paren-${idx}`,
        severity: "info",
        field,
        fieldLabel,
        matchedText: rawLine,
        message: `괄호 '(' 와 ')' 개수가 맞지 않는 줄이 있습니다: "${previewSnippet}"`,
      });
    }
  }
}

export function inspectBulletinDraft(
  input: BulletinCheckInput,
  existingBulletins: readonly BulletinItem[]
): readonly BulletinIssue[] {
  const issues: BulletinIssue[] = [];

  // 1. Date format, Sunday check, and duplicate date check
  const trimmedDate = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    issues.push({
      id: "date-invalid-format",
      severity: "warning",
      field: "date",
      fieldLabel: "주보 예배일",
      message: "예배일 날짜 형식이 올바르지 않습니다 (예: 2026-11-29).",
    });
  } else {
    const parsedUtc = new Date(`${trimmedDate}T00:00:00Z`);
    if (!Number.isNaN(parsedUtc.getTime())) {
      const dayIdx = parsedUtc.getUTCDay();
      if (dayIdx !== 0) {
        const dayLabel = KOREAN_WEEKDAYS[dayIdx] ?? "평일";
        issues.push({
          id: "date-not-sunday",
          severity: "info",
          field: "date",
          fieldLabel: "주보 예배일",
          matchedText: trimmedDate,
          message: `선택된 예배일(${trimmedDate})이 주일이 아닌 ${dayLabel}입니다. 절기 예배가 아니라면 주일 날짜가 맞는지 확인해 주세요.`,
        });
      }
    }

    const dupDateItem = existingBulletins.find(
      (b) => b.id !== input.currentId && b.date.trim() === trimmedDate
    );
    if (dupDateItem) {
      issues.push({
        id: "date-duplicate",
        severity: "warning",
        field: "date",
        fieldLabel: "주보 예배일",
        matchedText: trimmedDate,
        message: `이미 같은 날짜(${trimmedDate})의 주보가 등록되어 있습니다. 지난주 주보 날짜가 그대로 남아 있지 않은지 확인해 주세요.`,
      });
    }
  }

  // 2. Duplicate volume check
  const trimmedVolume = input.volume.trim();
  if (trimmedVolume) {
    const dupVolItem = existingBulletins.find(
      (b) =>
        b.id !== input.currentId &&
        b.volume.trim() !== "" &&
        b.volume.trim() === trimmedVolume
    );
    if (dupVolItem) {
      issues.push({
        id: "volume-duplicate",
        severity: "warning",
        field: "volume",
        fieldLabel: "주보 호수",
        matchedText: trimmedVolume,
        message: `이미 같은 호수(${trimmedVolume}, ${dupVolItem.date})가 등록되어 있습니다. 이번 주 호수로 숫자를 올렸는지 확인해 주세요.`,
      });
    }
  }

  // 3. Essential field omissions
  const trimmedSermon = input.sermonTitle.trim();
  if (!trimmedSermon || trimmedSermon === "주일 강단 말씀") {
    issues.push({
      id: "sermon-empty",
      severity: "warning",
      field: "sermonTitle",
      fieldLabel: "설교 제목",
      message: "설교 제목이 비어 있습니다. 이번 주 강단 말씀 제목을 확인해 주세요.",
    });
  }

  const trimmedScripture = input.scripture.trim();
  if (!trimmedScripture || trimmedScripture === "강단 본문") {
    issues.push({
      id: "scripture-empty",
      severity: "warning",
      field: "scripture",
      fieldLabel: "성경 본문",
      message: "성경 본문 장절이 비어 있습니다.",
    });
  }

  if (!input.worshipOrderText.trim()) {
    issues.push({
      id: "worship-order-empty",
      severity: "info",
      field: "worshipOrder",
      fieldLabel: "예배 순서",
      message: "예배 순서 칸이 비어 있습니다.",
    });
  }

  if (!input.churchNews.trim()) {
    issues.push({
      id: "church-news-empty",
      severity: "info",
      field: "churchNews",
      fieldLabel: "교회 소식",
      message: "교회 소식 칸이 비어 있습니다.",
    });
  }

  // 4. Text-level orthography & typo checks across all editable text fields
  scanFieldTextIssues("sermonTitle", "설교 제목", input.sermonTitle, issues);
  scanFieldTextIssues("scripture", "성경 본문", input.scripture, issues);
  scanFieldTextIssues("preacher", "설교자", input.preacher, issues);
  scanFieldTextIssues(
    "worshipOrder",
    "예배 순서",
    input.worshipOrderText,
    issues
  );
  scanFieldTextIssues("churchNews", "교회 소식", input.churchNews, issues);
  scanFieldTextIssues(
    "scheduleTitle",
    "교회 일정 제목",
    input.scheduleTitle,
    issues
  );
  scanFieldTextIssues(
    "churchSchedule",
    "교회 일정",
    input.churchSchedule,
    issues
  );
  scanFieldTextIssues(
    "celebrations",
    "축하합니다",
    input.celebrationsText,
    issues
  );

  return issues;
}

function replaceInField(
  input: BulletinCheckInput,
  field: BulletinFieldKey,
  fromText: string,
  toText: string
): BulletinCheckInput {
  if (!fromText) return input;
  const replaceAllLiteral = (src: string) => src.split(fromText).join(toText);

  switch (field) {
    case "sermonTitle":
      return { ...input, sermonTitle: replaceAllLiteral(input.sermonTitle) };
    case "scripture":
      return { ...input, scripture: replaceAllLiteral(input.scripture) };
    case "preacher":
      return { ...input, preacher: replaceAllLiteral(input.preacher) };
    case "worshipOrder":
      return {
        ...input,
        worshipOrderText: replaceAllLiteral(input.worshipOrderText),
      };
    case "churchNews":
      return { ...input, churchNews: replaceAllLiteral(input.churchNews) };
    case "scheduleTitle":
      return {
        ...input,
        scheduleTitle: replaceAllLiteral(input.scheduleTitle),
      };
    case "churchSchedule":
      return {
        ...input,
        churchSchedule: replaceAllLiteral(input.churchSchedule),
      };
    case "celebrations":
      return {
        ...input,
        celebrationsText: replaceAllLiteral(input.celebrationsText),
      };
    default:
      return input;
  }
}

export function applyBulletinIssueFix(
  input: BulletinCheckInput,
  issue: BulletinIssue
): BulletinCheckInput {
  if (
    issue.matchedText === undefined ||
    issue.suggestedText === undefined ||
    issue.matchedText === issue.suggestedText
  ) {
    return input;
  }
  return replaceInField(
    input,
    issue.field,
    issue.matchedText,
    issue.suggestedText
  );
}

export function applyAllBulletinFixes(
  input: BulletinCheckInput,
  issues: readonly BulletinIssue[]
): BulletinCheckInput {
  let next = input;
  for (const issue of issues) {
    if (issue.matchedText !== undefined && issue.suggestedText !== undefined) {
      next = applyBulletinIssueFix(next, issue);
    }
  }
  return next;
}

export function highlightTextWithMatches(
  text: string,
  matchedTerms: readonly string[]
): readonly HighlightSegment[] {
  const validTerms = [
    ...new Set(matchedTerms.map((t) => t.trim()).filter(Boolean)),
  ].sort((a, b) => b.length - a.length);

  if (!text || validTerms.length === 0) {
    return [{ text, highlighted: false }];
  }

  const escaped = validTerms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(pattern);
  const termSet = new Set(validTerms);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: termSet.has(part),
    }));
}
