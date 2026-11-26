export const BULLETIN_SERMON_SERVICES = [
  "주일오전예배",
  "주일오후예배",
  "수요기도회",
  "금요기도회",
  "새벽기도회",
  "특별집회",
] as const;

export type BulletinSermonService = (typeof BULLETIN_SERMON_SERVICES)[number];

const FULL_BIBLE_BOOKS = [
  "창세기",
  "출애굽기",
  "레위기",
  "민수기",
  "신명기",
  "여호수아",
  "사사기",
  "룻기",
  "사무엘상",
  "사무엘하",
  "열왕기상",
  "열왕기하",
  "역대상",
  "역대하",
  "에스라",
  "느헤미야",
  "에스더",
  "욥기",
  "시편",
  "잠언",
  "전도서",
  "아가",
  "이사야",
  "예레미야애가",
  "예레미야",
  "에스겔",
  "다니엘",
  "호세아",
  "요엘",
  "아모스",
  "오바댜",
  "요나",
  "미가",
  "나훔",
  "하박국",
  "스바냐",
  "학개",
  "스가랴",
  "말라기",
  "마태복음",
  "마가복음",
  "누가복음",
  "요한복음",
  "사도행전",
  "로마서",
  "고린도전서",
  "고린도후서",
  "갈라디아서",
  "에베소서",
  "빌립보서",
  "골로새서",
  "데살로니가전서",
  "데살로니가후서",
  "디모데전서",
  "디모데후서",
  "디도서",
  "빌레몬서",
  "히브리서",
  "야고보서",
  "베드로전서",
  "베드로후서",
  "요한일서",
  "요한이서",
  "요한삼서",
  "유다서",
  "요한계시록",
] as const;

const BIBLE_ABBREV_MAP: readonly (readonly [string, string])[] = [
  ["삼상", "사무엘상"],
  ["삼하", "사무엘하"],
  ["왕상", "열왕기상"],
  ["왕하", "열왕기하"],
  ["대상", "역대상"],
  ["대하", "역대하"],
  ["고전", "고린도전서"],
  ["고후", "고린도후서"],
  ["살전", "데살로니가전서"],
  ["살후", "데살로니가후서"],
  ["딤전", "디모데전서"],
  ["딤후", "디모데후서"],
  ["벧전", "베드로전서"],
  ["벧후", "베드로후서"],
  ["요일", "요한일서"],
  ["요이", "요한이서"],
  ["요삼", "요한삼서"],
  ["계시록", "요한계시록"],
  ["미가서", "미가"],
  ["하바국", "하박국"],
  ["창", "창세기"],
  ["출", "출애굽기"],
  ["레", "레위기"],
  ["민", "민수기"],
  ["신", "신명기"],
  ["수", "여호수아"],
  ["삿", "사사기"],
  ["룻", "룻기"],
  ["스", "에스라"],
  ["느", "느헤미야"],
  ["에", "에스더"],
  ["욥", "욥기"],
  ["시", "시편"],
  ["잠", "잠언"],
  ["전", "전도서"],
  ["아", "아가"],
  ["사", "이사야"],
  ["렘", "예레미야"],
  ["애", "예레미야애가"],
  ["겔", "에스겔"],
  ["단", "다니엘"],
  ["호", "호세아"],
  ["욜", "요엘"],
  ["암", "아모스"],
  ["옵", "오바댜"],
  ["욘", "요나"],
  ["미", "미가"],
  ["나", "나훔"],
  ["합", "하박국"],
  ["습", "스바냐"],
  ["학", "학개"],
  ["슥", "스가랴"],
  ["말", "말라기"],
  ["마", "마태복음"],
  ["막", "마가복음"],
  ["눅", "누가복음"],
  ["요", "요한복음"],
  ["행", "사도행전"],
  ["롬", "로마서"],
  ["갈", "갈라디아서"],
  ["엡", "에베소서"],
  ["빌", "빌립보서"],
  ["골", "골로새서"],
  ["딛", "디도서"],
  ["몬", "빌레몬서"],
  ["히", "히브리서"],
  ["약", "야고보서"],
  ["유", "유다서"],
  ["계", "요한계시록"],
];

const ALL_BOOK_TOKENS = [
  ...FULL_BIBLE_BOOKS,
  ...BIBLE_ABBREV_MAP.map(([abbr]) => abbr),
].sort((a, b) => b.length - a.length);

const SINGLE_CITATION_PATTERN = `(?:${ALL_BOOK_TOKENS.join("|")})\\s*(?:\\d{1,3}\\s*[-~–—]\\s*\\d{1,3}\\s*(?:장|편)|\\d{1,3}(?:\\s*(?:장|편|:|\\s)\\s*\\d{1,3}(?:\\s*[~\\-–—,\\s]\\s*(?:\\d{1,3}\\s*(?:장|편|:)\\s*)?\\d{1,3})*\\s*절?|\\s*(?:장|편)))`;

const MULTI_CITATION_RE = new RegExp(
  `(${SINGLE_CITATION_PATTERN}(?:\\s*[,/·]\\s*${SINGLE_CITATION_PATTERN})*)`,
  "u"
);

export function normalizeSermonServiceType(raw: string): BulletinSermonService {
  const clean = raw.replace(/\s+/g, "");
  if (!clean) return "주일오전예배";
  if (
    clean.includes("오후") ||
    clean.includes("주일성경공부") ||
    clean.includes("헌신예배")
  ) {
    return "주일오후예배";
  }
  if (clean.includes("수요")) {
    return "수요기도회";
  }
  if (clean.includes("금요") || clean.includes("심야")) {
    return "금요기도회";
  }
  if (clean.includes("새벽") || clean.includes("특새")) {
    return "새벽기도회";
  }
  if (
    clean.includes("특별") ||
    clean.includes("부흥") ||
    clean.includes("사경회") ||
    clean.includes("송구영신") ||
    clean.includes("임직") ||
    clean.includes("헌당") ||
    clean.includes("위임")
  ) {
    return "특별집회";
  }
  return "주일오전예배";
}

const ORDERED_BOOK_RULES: readonly (readonly [string, string])[] = [
  ...BIBLE_ABBREV_MAP,
  ...FULL_BIBLE_BOOKS.map((b) => [b, b] as const),
].sort((a, b) => b[0].length - a[0].length);

export function normalizeScriptureText(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^[\s()[\]/-]+|[\s()[\]/-]+$/g, "")
    .replace(/~/g, "-")
    .replace(/\s+/g, " ");
  if (!trimmed || trimmed === "주일 강단 말씀" || trimmed === "강단 말씀") {
    return "";
  }

  const segments = trimmed.split(/\s*,\s*/);
  const normalizedSegments = segments.map((seg) => {
    for (const [token, full] of ORDERED_BOOK_RULES) {
      const m = seg.match(new RegExp(`^${token}\\s*(\\d.*)$`, "u"));
      if (m) {
        const rest = m[1]
          .trim()
          .replace(/^(\d+)\s+(\d+-\d+\s*절?)$/, "$1:$2")
          .replace(/^(\d+)\s*(장|편)\s*(\d+)\s+(\d+)\s*절?$/, "$1$2 $3-$4절")
          .replace(/(장|편)(\d)/g, "$1 $2");
        return `${full} ${rest}`;
      }
    }
    return seg;
  });

  return normalizedSegments.join(", ");
}

export interface ParsedYoutubeSermonFields {
  readonly title: string;
  readonly scripture: string;
  readonly preacher: string;
  readonly date: string | null;
  readonly serviceType: BulletinSermonService;
}

const PREACHER_FULL_RE =
  /([가-힣]{2,4})\s*(담임목사|원로목사|부목사|목사|강도사|전도사|선교사|교수|장로)(?:님)?(?:\s*\(([^()]{1,24})\))?/u;

const EXCLUDED_ROLE_NAMES = new Set([
  "일광교회",
  "주일설교",
  "오후예배",
  "오전예배",
  "헌신예배",
  "감사예배",
  "부흥성회",
  "심령부흥",
  "목사위임",
]);

export function parseYoutubeSermonHeadline(
  rawHeadline: string,
  options?: {
    readonly fallbackIsoDate?: string | null;
    readonly playlistHint?: string | null;
  }
): ParsedYoutubeSermonFields {
  let working = rawHeadline
    .replace(/#[^\s#,]+/g, " ")
    .replace(/[,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Fix known source title typos on YouTube
  working = working
    .replace(/여호수아\s*224\s*:\s*15/g, "여호수아 24:15")
    .replace(/출애굽기\s*17장\s*1\s+17절/g, "출애굽기 17:1-7")
    .replace(/사도행전\s+장\s+1-19절/g, "사도행전 9장 1-19절")
    .replace(/시편\s*8절\s*1-9절/g, "시편 8편 1-9절")
    .replace(/시\s+편\s+(\d)/g, "시편 $1")
    .replace(/계\s*8\s*[~-]\s*1\s*:\s*13/g, "요한계시록 8:1-13")
    .replace(/하바국/g, "하박국");

  // Extract Date
  let parsedDate: string | null = null;
  const splitDayTypo = working.match(
    /^(20\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d)\.(\d)\b/
  );
  const fullDateMatch = working.match(
    /(20\d{2})\s*(?:[.\-/년]\s*|\s+)(\d{1,2})\s*(?:[.\-/월]\s*|\s+)(\d{1,2})\s*[.일]?/
  );
  if (splitDayTypo) {
    const mm = splitDayTypo[2].padStart(2, "0");
    const dd = `${splitDayTypo[3]}${splitDayTypo[4]}`;
    parsedDate = `${splitDayTypo[1]}-${mm}-${dd}`;
    working = working.slice(splitDayTypo[0].length).trim();
  } else if (fullDateMatch && fullDateMatch.index !== undefined) {
    const yyyy = fullDateMatch[1];
    const mm = fullDateMatch[2].padStart(2, "0");
    const dd = fullDateMatch[3].padStart(2, "0");
    parsedDate = `${yyyy}-${mm}-${dd}`;
    working = `${working.slice(0, fullDateMatch.index)} ${working.slice(
      fullDateMatch.index + fullDateMatch[0].length
    )}`
      .replace(/\s+/g, " ")
      .trim();
  } else {
    const shortYrMatch = working.match(
      /(?:^|\s)(2\d)\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/
    );
    if (shortYrMatch && shortYrMatch.index !== undefined) {
      parsedDate = `20${shortYrMatch[1]}-${shortYrMatch[2].padStart(2, "0")}-${shortYrMatch[3].padStart(2, "0")}`;
      working = `${working.slice(0, shortYrMatch.index)} ${working.slice(
        shortYrMatch.index + shortYrMatch[0].length
      )}`
        .replace(/\s+/g, " ")
        .trim();
    } else {
      const monthDayKorean = working.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
      const mmddCompact = working.match(/^([01]\d)([0-3]\d)\b/);
      const fallbackYear =
        options?.fallbackIsoDate?.slice(0, 4) ?? "2026";
      if (monthDayKorean && monthDayKorean.index !== undefined) {
        parsedDate = `${fallbackYear}-${monthDayKorean[1].padStart(2, "0")}-${monthDayKorean[2].padStart(2, "0")}`;
        working = `${working.slice(0, monthDayKorean[0].length + monthDayKorean.index - monthDayKorean[0].length)} ${working.slice(
          monthDayKorean.index + monthDayKorean[0].length
        )}`
          .replace(/\s+/g, " ")
          .trim();
      } else if (mmddCompact) {
        parsedDate = `${fallbackYear}-${mmddCompact[1]}-${mmddCompact[2]}`;
        working = working.slice(mmddCompact[0].length).trim();
      }
    }
  }

  if (!parsedDate && options?.fallbackIsoDate) {
    parsedDate = options.fallbackIsoDate;
  }

  // Detect Service Type aligned strictly with Ilkwang Church's weekly bulletin
  let serviceType: BulletinSermonService = "주일오전예배";
  const combinedHint = `${rawHeadline} ${options?.playlistHint ?? ""}`;
  if (
    /(심령부흥회|부흥사경회|부흥성회|일일부흥회|특별집회|송구영신|헌당예배|임직은퇴|목사위임)/.test(
      combinedHint
    )
  ) {
    serviceType = "특별집회";
  } else if (/(고난주일특새|특새|새벽기도|새벽예배)/.test(combinedHint)) {
    serviceType = "새벽기도회";
  } else if (/(금요기도회|금요예배|금요철야)/.test(combinedHint)) {
    serviceType = "금요기도회";
  } else if (/(수요기도회|수요예배|수요오전|수요성경공부)/.test(combinedHint)) {
    serviceType = "수요기도회";
  } else if (/(주일오후예배|오후예배|오후찬양|주일성경공부|헌신예배)/.test(combinedHint)) {
    serviceType = "주일오후예배";
  } else if (parsedDate && !/주일|오전예배|부활/.test(combinedHint)) {
    const [y, m, d] = parsedDate.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const isHolidaySpecialDate =
      (m === 12 && (d === 25 || d === 31)) || (m === 1 && d === 1);
    if (dow !== 0 && (isHolidaySpecialDate || /성탄/.test(combinedHint))) {
      serviceType = "특별집회";
    } else if (dow === 3) {
      serviceType = "수요기도회";
    } else if (dow === 5 && /기도회/.test(combinedHint)) {
      serviceType = "금요기도회";
    }
  }

  // Extract Preacher only when explicitly stated
  let preacher = "";
  const preacherMatch = working.match(PREACHER_FULL_RE);
  if (preacherMatch && !EXCLUDED_ROLE_NAMES.has(preacherMatch[1])) {
    const baseName = `${preacherMatch[1]} ${preacherMatch[2]}`;
    preacher = preacherMatch[3]
      ? `${baseName} (${preacherMatch[3].trim()})`
      : baseName;
    working = `${working.slice(0, preacherMatch.index)} ${working.slice(
      (preacherMatch.index ?? 0) + preacherMatch[0].length
    )}`
      .replace(/\s+/g, " ")
      .trim();
  }

  // Extract Scripture
  let scripture = "";
  const citeMatch = working.match(MULTI_CITATION_RE);
  if (citeMatch && citeMatch.index !== undefined) {
    scripture = normalizeScriptureText(citeMatch[1]);
    working = `${working.slice(0, citeMatch.index)} ${working.slice(
      citeMatch.index + citeMatch[0].length
    )}`
      .replace(/\s+/g, " ")
      .trim();
  }

  // Clean Sermon Title
  let cleanTitle = working
    .replace(/\(\s*[/,·~-]?\s*\)/g, " ")
    .replace(/\[\s*\]/g, " ")
    .replace(/일광교회/g, " ")
    .replace(
      /(?:주일\s*대예배|주일\s*예배|주일\s*설교|오전\s*예배|오후\s*예배|오후\s*찬양\s*예배|부활주일\s*설교|수요\s*성경공부|수요\s*예배)/g,
      " "
    )
    .replace(/["'“”‘’]/g, "")
    .replace(/^[\s\-–—/_.,:|]+|[\s\-–—/_.,:|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(강해|설교|말씀)$/.test(cleanTitle) && scripture) {
    cleanTitle = `${scripture} ${cleanTitle}`;
  }
  if (!cleanTitle) {
    cleanTitle = rawHeadline.trim();
  }

  return {
    title: cleanTitle,
    scripture,
    preacher,
    date: parsedDate,
    serviceType,
  };
}
