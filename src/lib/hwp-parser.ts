import { inflateRawSync } from "node:zlib";
import {
  formatBulletinDateTitle,
  formatCelebrationValueList,
  formatDefaultBulletinVolume,
  getKstDateString,
  resolveCelebrationMonthDay,
} from "./format-utils";

export { formatCelebrationValueList, resolveCelebrationMonthDay };

export interface ParsedBulletinDraft {
  readonly format: "hwp" | "hwpx" | "docx" | "txt";
  readonly title: string;
  readonly date: string | null;
  readonly volume: string | null;
  readonly sermonTitle: string | null;
  readonly scripture: string | null;
  readonly preacher: string | null;
  readonly worshipOrder: readonly string[];
  readonly celebrations: readonly string[];
  readonly fullContent: string;
  readonly rawLineCount: number;
}

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const ZIP_LOCAL_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

const HWP5_EXTENDED_CONTROLS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
]);

function startsWith(buf: Buffer, sig: readonly number[]): boolean {
  if (buf.length < sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

function stripPrivateUseGlyphs(input: string): string {
  return input.replace(
    /[\uE000-\uF8FF]|[\u{F0000}-\u{FFFFD}]|[\u{100000}-\u{10FFFD}]/gu,
    ""
  );
}

function cleanExtractedLine(raw: string): string {
  return stripPrivateUseGlyphs(raw).replace(/[ \t]+/g, " ").trim();
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface ZipEntryData {
  readonly name: string;
  readonly data: Buffer;
}

function readZipEntries(buf: Buffer): readonly ZipEntryData[] {
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("유효한 압축 문서(HWPX, DOCX) 구조가 아닙니다.");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntryData[] = [];

  let ptr = cdOffset;
  for (let idx = 0; idx < totalEntries && ptr + 46 <= buf.length; idx += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const compressionMethod = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const fileNameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);

    const name = buf
      .subarray(ptr + 46, ptr + 46 + fileNameLen)
      .toString("utf8");
    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (localHeaderOffset + 30 > buf.length) continue;
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buf.length) continue;

    const rawSlice = buf.subarray(dataStart, dataEnd);
    if (compressionMethod === 0) {
      entries.push({ name, data: rawSlice });
    } else if (compressionMethod === 8) {
      entries.push({ name, data: inflateRawSync(rawSlice) });
    }
  }

  return entries;
}

function extractXmlParagraphLines(xml: string): string[] {
  const withBreaks = xml
    .replace(/<(?:hp:lineBreak|w:br)\b[^>]*\/?>/gi, "\n")
    .replace(/<(?:hp:tab|w:tab)\b[^>]*\/?>/gi, "  ")
    .replace(/<\/(?:hp:tc|w:tc)>/gi, "\n")
    .replace(/<\/(?:hp:tr|w:tr|hp:p|w:p)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const decoded = decodeXmlEntities(withBreaks);
  return decoded
    .split(/\r?\n/)
    .map(cleanExtractedLine)
    .filter((line) => line.length > 0);
}

function extractTextFromZipContainer(
  buf: Buffer,
  extHint: string
): { readonly format: "hwpx" | "docx"; readonly lines: readonly string[] } {
  const entries = readZipEntries(buf);

  const hwpxSections = entries
    .filter((e) => /^Contents\/section\d+\.xml$/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (hwpxSections.length > 0) {
    const lines: string[] = [];
    for (const sec of hwpxSections) {
      lines.push(...extractXmlParagraphLines(sec.data.toString("utf8")));
    }
    return { format: "hwpx", lines };
  }

  const docxMain = entries.find(
    (e) => e.name.toLowerCase() === "word/document.xml"
  );
  if (docxMain) {
    return {
      format: "docx",
      lines: extractXmlParagraphLines(docxMain.data.toString("utf8")),
    };
  }

  const prvTxt = entries.find((e) =>
    /preview\/prvtext\.txt$/i.test(e.name)
  );
  if (prvTxt) {
    const lines = prvTxt.data
      .toString("utf8")
      .split(/\r?\n/)
      .map(cleanExtractedLine)
      .filter(Boolean);
    return { format: extHint === ".docx" ? "docx" : "hwpx", lines };
  }

  throw new Error(
    "문서 내부에서 본문 섹션(Contents/section0.xml)을 찾지 못했습니다."
  );
}

interface OleDirectoryEntry {
  readonly id: number;
  readonly name: string;
  readonly objectType: number;
  readonly leftSibling: number;
  readonly rightSibling: number;
  readonly childId: number;
  readonly startSector: number;
  readonly streamSize: number;
}

function decodeHwpParaText(rec: Buffer): string {
  const wordCount = Math.floor(rec.length / 2);
  const chars: string[] = [];

  for (let i = 0; i < wordCount; i += 1) {
    const code = rec.readUInt16LE(i * 2);
    if (code === 0) continue;

    if (code === 10 || code === 13) {
      chars.push("\n");
      continue;
    }

    if (HWP5_EXTENDED_CONTROLS.has(code)) {
      if (code === 9) {
        chars.push("  ");
      }
      if (i + 7 < wordCount && rec.readUInt16LE((i + 7) * 2) === code) {
        i += 7;
      }
      continue;
    }

    if (code === 24) {
      chars.push("-");
      continue;
    }

    if (code === 30 || code === 31) {
      chars.push(" ");
      continue;
    }

    if (code < 32) {
      continue;
    }

    if (code >= 0xd800 && code <= 0xdbff && i + 1 < wordCount) {
      const low = rec.readUInt16LE((i + 1) * 2);
      if (low >= 0xdc00 && low <= 0xdfff) {
        const cp = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        chars.push(String.fromCodePoint(cp));
        i += 1;
        continue;
      }
    }

    chars.push(String.fromCharCode(code));
  }

  return chars.join("");
}

function extractTextFromHwp5Ole(buf: Buffer): readonly string[] {
  if (buf.length < 512) {
    throw new Error("손상되었거나 너무 작은 HWP 파일입니다.");
  }

  const sectorShift = buf.readUInt16LE(30);
  const miniSectorShift = buf.readUInt16LE(32);
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniSectorShift;

  const firstDirSector = buf.readUInt32LE(48);
  const miniStreamCutoff = buf.readUInt32LE(56);
  const firstMiniFatSector = buf.readUInt32LE(60);
  const numMiniFatSectors = buf.readUInt32LE(64);
  const firstDifatSector = buf.readUInt32LE(68);
  const numDifatSectors = buf.readUInt32LE(72);

  function readSectorSlice(secId: number): Buffer {
    const start = (secId + 1) * sectorSize;
    if (start < 0 || start >= buf.length) return Buffer.alloc(0);
    return buf.subarray(start, Math.min(buf.length, start + sectorSize));
  }

  const difat: number[] = [];
  for (let i = 0; i < 109; i += 1) {
    const sec = buf.readUInt32LE(76 + i * 4);
    if (sec !== FREESECT && sec !== ENDOFCHAIN) {
      difat.push(sec);
    }
  }

  let difatSec = firstDifatSector;
  let difatGuard = 0;
  while (
    difatSec !== ENDOFCHAIN &&
    difatSec !== FREESECT &&
    difatGuard < numDifatSectors + 4
  ) {
    difatGuard += 1;
    const block = readSectorSlice(difatSec);
    if (block.length < sectorSize) break;
    const entriesPerSector = sectorSize / 4 - 1;
    for (let i = 0; i < entriesPerSector; i += 1) {
      const sec = block.readUInt32LE(i * 4);
      if (sec !== FREESECT && sec !== ENDOFCHAIN) {
        difat.push(sec);
      }
    }
    difatSec = block.readUInt32LE(entriesPerSector * 4);
  }

  const fatEntriesPerSector = sectorSize / 4;
  const fat = new Uint32Array(difat.length * fatEntriesPerSector);
  fat.fill(FREESECT);
  for (let idx = 0; idx < difat.length; idx += 1) {
    const block = readSectorSlice(difat[idx]);
    const count = Math.floor(block.length / 4);
    for (let j = 0; j < count; j += 1) {
      fat[idx * fatEntriesPerSector + j] = block.readUInt32LE(j * 4);
    }
  }

  function readNormalChain(startSec: number, byteLen?: number): Buffer {
    const chunks: Buffer[] = [];
    let cur = startSec;
    let total = 0;
    const maxSteps = fat.length + 1;
    let steps = 0;
    while (
      cur !== ENDOFCHAIN &&
      cur !== FREESECT &&
      cur < fat.length &&
      steps < maxSteps
    ) {
      steps += 1;
      const slice = readSectorSlice(cur);
      if (slice.length === 0) break;
      chunks.push(slice);
      total += slice.length;
      if (byteLen !== undefined && total >= byteLen) break;
      cur = fat[cur];
    }
    const combined = Buffer.concat(chunks);
    return byteLen !== undefined ? combined.subarray(0, byteLen) : combined;
  }

  const dirStream = readNormalChain(firstDirSector);
  const dirCount = Math.floor(dirStream.length / 128);
  const dirEntries: OleDirectoryEntry[] = [];

  for (let id = 0; id < dirCount; id += 1) {
    const base = id * 128;
    const nameByteLen = dirStream.readUInt16LE(base + 64);
    const objectType = dirStream[base + 66];
    if (objectType === 0 || nameByteLen < 2) {
      dirEntries.push({
        id,
        name: "",
        objectType: 0,
        leftSibling: FREESECT,
        rightSibling: FREESECT,
        childId: FREESECT,
        startSector: ENDOFCHAIN,
        streamSize: 0,
      });
      continue;
    }
    const cleanByteLen = Math.min(64, Math.max(0, nameByteLen - 2));
    const name = dirStream
      .subarray(base, base + cleanByteLen)
      .toString("utf16le");
    const leftSibling = dirStream.readUInt32LE(base + 68);
    const rightSibling = dirStream.readUInt32LE(base + 72);
    const childId = dirStream.readUInt32LE(base + 76);
    const startSector = dirStream.readUInt32LE(base + 116);
    const streamSize = dirStream.readUInt32LE(base + 120);

    dirEntries.push({
      id,
      name,
      objectType,
      leftSibling,
      rightSibling,
      childId,
      startSector,
      streamSize,
    });
  }

  const rootEntry = dirEntries[0];
  const rootMiniStream =
    rootEntry && rootEntry.startSector !== ENDOFCHAIN
      ? readNormalChain(rootEntry.startSector, rootEntry.streamSize)
      : Buffer.alloc(0);

  const miniFatRaw =
    firstMiniFatSector !== ENDOFCHAIN &&
    firstMiniFatSector !== FREESECT &&
    numMiniFatSectors > 0
      ? readNormalChain(firstMiniFatSector)
      : Buffer.alloc(0);
  const miniFatCount = Math.floor(miniFatRaw.length / 4);
  const miniFat = new Uint32Array(miniFatCount);
  for (let i = 0; i < miniFatCount; i += 1) {
    miniFat[i] = miniFatRaw.readUInt32LE(i * 4);
  }

  function readEntryStream(entry: OleDirectoryEntry): Buffer {
    if (entry.streamSize <= 0) return Buffer.alloc(0);
    if (entry.streamSize < miniStreamCutoff && rootMiniStream.length > 0) {
      const chunks: Buffer[] = [];
      let cur = entry.startSector;
      let total = 0;
      let steps = 0;
      while (
        cur !== ENDOFCHAIN &&
        cur !== FREESECT &&
        cur < miniFat.length &&
        steps <= miniFat.length
      ) {
        steps += 1;
        const start = cur * miniSectorSize;
        if (start >= rootMiniStream.length) break;
        const slice = rootMiniStream.subarray(
          start,
          Math.min(rootMiniStream.length, start + miniSectorSize)
        );
        chunks.push(slice);
        total += slice.length;
        if (total >= entry.streamSize) break;
        cur = miniFat[cur];
      }
      return Buffer.concat(chunks).subarray(0, entry.streamSize);
    }
    return readNormalChain(entry.startSector, entry.streamSize);
  }

  const pathMap = new Map<string, OleDirectoryEntry>();
  function walkChildren(nodeId: number, prefix: string, visited: Set<number>) {
    if (
      nodeId === FREESECT ||
      nodeId === ENDOFCHAIN ||
      nodeId >= dirEntries.length ||
      visited.has(nodeId)
    ) {
      return;
    }
    visited.add(nodeId);
    const entry = dirEntries[nodeId];
    if (!entry || entry.objectType === 0) return;

    walkChildren(entry.leftSibling, prefix, visited);

    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    pathMap.set(fullPath, entry);
    if (entry.objectType === 1 && entry.childId !== FREESECT) {
      walkChildren(entry.childId, fullPath, new Set());
    }

    walkChildren(entry.rightSibling, prefix, visited);
  }

  if (rootEntry && rootEntry.childId !== FREESECT) {
    walkChildren(rootEntry.childId, "", new Set());
  }

  const fileHeaderEntry =
    pathMap.get("FileHeader") ??
    dirEntries.find((e) => e.name === "FileHeader");
  let isCompressed = true;
  if (fileHeaderEntry) {
    const hdr = readEntryStream(fileHeaderEntry);
    if (hdr.length >= 40) {
      const flags = hdr.readUInt32LE(36);
      isCompressed = (flags & 0x01) !== 0;
      const isEncrypted = (flags & 0x02) !== 0;
      if (isEncrypted) {
        throw new Error(
          "암호가 설정된 한글(HWP) 문서입니다. 한글 프로그램에서 암호를 해제한 뒤 다시 올려 주세요."
        );
      }
    }
  }

  const sectionEntries = [...pathMap.entries()]
    .filter(([p, e]) => /^BodyText\/Section\d+$/i.test(p) && e.objectType === 2)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([, entry]) => entry);

  const extractedLines: string[] = [];

  for (const secEntry of sectionEntries) {
    const rawStream = readEntryStream(secEntry);
    if (rawStream.length === 0) continue;
    const unpacked = isCompressed ? inflateRawSync(rawStream) : rawStream;

    let offset = 0;
    while (offset + 4 <= unpacked.length) {
      const recHeader = unpacked.readUInt32LE(offset);
      offset += 4;
      const tagId = recHeader & 0x3ff;
      let recSize = (recHeader >>> 20) & 0xfff;
      if (recSize === 0xfff) {
        if (offset + 4 > unpacked.length) break;
        recSize = unpacked.readUInt32LE(offset);
        offset += 4;
      }
      if (offset + recSize > unpacked.length) break;

      if (tagId === 67) {
        const decoded = decodeHwpParaText(
          unpacked.subarray(offset, offset + recSize)
        );
        for (const rawLine of decoded.split(/\r?\n/)) {
          const cleaned = cleanExtractedLine(rawLine);
          if (cleaned) {
            extractedLines.push(cleaned);
          }
        }
      }
      offset += recSize;
    }
  }

  if (extractedLines.length > 0) {
    return extractedLines;
  }

  const prvEntry =
    pathMap.get("PrvText") ?? dirEntries.find((e) => e.name === "PrvText");
  if (prvEntry) {
    const prvBuf = readEntryStream(prvEntry);
    const prvLines = prvBuf
      .toString("utf16le")
      .replace(/<[^>]+>/g, " ")
      .split(/\r?\n/)
      .map(cleanExtractedLine)
      .filter(Boolean);
    if (prvLines.length > 0) {
      return prvLines;
    }
  }

  throw new Error(
    "한글 파일에서 텍스트 본문을 추출하지 못했습니다. 문서가 이미지 스캔본인지 확인해 주세요."
  );
}

function decodePlainTextBuffer(buf: Buffer): readonly string[] {
  let text = buf.toString("utf8");
  if (text.includes("\ufffd")) {
    try {
      text = new TextDecoder("euc-kr").decode(buf);
    } catch {
      // keep utf8 fallback
    }
  }
  return text
    .split(/\r?\n/)
    .map(cleanExtractedLine)
    .filter(Boolean);
}

function compactSectionKey(line: string): string {
  return line
    .replace(/[∎▪■▣▶•*※|｜[\]()<>「」『』"'“”‘’·.!-]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

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

const BIBLE_ABBREV_ENTRIES: readonly (readonly [string, string])[] = [
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

const FULL_BIBLE_CITATION_RE = new RegExp(
  `((?:${FULL_BIBLE_BOOKS.join("|")})\\s*\\d+\\s*(?:장|편|:)\\s*[\\d\\s,~–-]*절?)`
);

function normalizeSingleBibleSegment(seg: string): string {
  const cleaned = seg
    .replace(/\(\s*[구신]\s*[.,:：]?\s*\d+[^)]*\)/g, "")
    .replace(/(\d+)\s*;\s*(\d+)/g, "$1:$2")
    .replace(/\s+/g, " ")
    .trim();

  for (const fullBook of FULL_BIBLE_BOOKS) {
    if (cleaned.startsWith(fullBook)) {
      const rest = cleaned.slice(fullBook.length).trim();
      return rest ? `${fullBook} ${rest}` : fullBook;
    }
  }

  for (const [abbr, fullBook] of BIBLE_ABBREV_ENTRIES) {
    const abbrRe = new RegExp(`^${abbr}\\s*(\\d+.*)$`);
    const m = cleaned.match(abbrRe);
    if (m) {
      return `${fullBook} ${m[1].trim()}`;
    }
  }

  return cleaned;
}

function normalizeBibleReference(raw: string): {
  readonly headerScripture: string;
  readonly orderDisplay: string;
} {
  const trimmed = raw.trim();
  const pageMatch = trimmed.match(/(\(\s*[구신]\s*[.,:：]?\s*\d+[^)]*\))\s*$/);
  const pageSuffix = pageMatch ? pageMatch[1].replace(/\s+/g, "") : "";
  const withoutTrailingPage = (
    pageMatch ? trimmed.slice(0, pageMatch.index).trim() : trimmed
  ).replace(/\s+/g, " ");

  const rawSegments = withoutTrailingPage.split(/\s*,\s*/);
  const normalizedSegments = rawSegments.map((seg, idx) =>
    idx === 0 || /^[가-힣]/.test(seg)
      ? normalizeSingleBibleSegment(seg)
      : seg.replace(/\(\s*[구신]\s*[.,:：]?\s*\d+[^)]*\)/g, "").trim()
  );
  const formattedCore = normalizedSegments.filter(Boolean).join(", ");

  return {
    headerScripture: formattedCore,
    orderDisplay: pageSuffix
      ? `${formattedCore} ${pageSuffix}`
      : formattedCore,
  };
}

const CANONICAL_LITURGY_STEPS: Readonly<Record<string, string>> = {
  예배로의부름: "예배로의 부름",
  묵도: "묵도",
  기원: "기원",
  경배찬양: "경배찬양",
  경배와찬양: "경배와 찬양",
  송영: "송영",
  교독문: "교독문",
  성시교독: "성시교독",
  신앙고백: "신앙고백",
  사도신경: "사도신경",
  찬송: "찬송",
  기도: "기도",
  대표기도: "대표기도",
  목회기도: "목회기도",
  성경봉독: "성경봉독",
  말씀봉독: "말씀봉독",
  찬양: "찬양",
  특송: "특송",
  특별찬양: "특별찬양",
  설교: "설교",
  말씀선포: "말씀선포",
  봉헌기도: "봉헌기도",
  봉헌: "봉헌",
  헌금: "헌금",
  봉헌찬송: "봉헌찬송",
  광고: "광고",
  교회소식: "교회 소식",
  환영과교제: "환영과 교제",
  축도: "축도",
  파송찬양: "파송찬양",
  파송의찬양: "파송의 찬양",
  폐회: "폐회",
};

const ROLE_ONLY_PREFIXES = new Set([
  "담임",
  "원로",
  "시무",
  "협동",
  "교육",
  "청년",
  "찬양",
  "인도",
  "사회",
  "교회",
  "다음",
]);

function normalizePersonRoleString(raw: string): string | null {
  const trimmed = raw.trim();
  const compact = trimmed.replace(/\s+/g, "");

  if (compact === "다같이") return "다같이";
  if (compact === "사회자") return "사회자";
  if (compact === "인도자") return "인도자";
  if (compact === "회중") return "회중";
  if (compact === "담임목사") return "담임목사";
  if (compact === "봉헌위원") return "봉헌위원";
  if (compact === "안내위원") return "안내위원";

  if (/^[가-힣A-Za-z0-9\s]{2,18}(?:찬양대|성가대|찬양팀|중창단)$/.test(trimmed)) {
    return trimmed.replace(/\s+/g, " ");
  }

  const roleSuffixMatch = compact.match(
    /^([가-힣]{2,4})(담임목사|원로목사|부목사|목사|강도사|전도사|선교사|장로|집사|권사|성도)$/
  );
  if (roleSuffixMatch) {
    const name = roleSuffixMatch[1];
    const role = roleSuffixMatch[2];
    if (!ROLE_ONLY_PREFIXES.has(name)) {
      return `${name} ${role}`;
    }
  }

  const rolePrefixMatch = compact.match(
    /^(담임목사|원로목사|부목사|목사|강도사|전도사|선교사)([가-힣]{2,4})$/
  );
  if (rolePrefixMatch) {
    const role = rolePrefixMatch[1];
    const name = rolePrefixMatch[2];
    if (!ROLE_ONLY_PREFIXES.has(name)) {
      return `${name} ${role}`;
    }
  }

  return null;
}

function isTypoNoiseFragment(line: string): boolean {
  if (line.length <= 8 && /[ㄱ-ㅎㅏ-ㅣ]/.test(line)) {
    return true;
  }
  return false;
}

function stripOuterQuotes(value: string): string {
  const trimmed = value.trim();
  const prefixed = trimmed.match(
    /^([^"'“”‘’「」『』]+?)\s*["'“‘「『]([^"'“”‘’「」『』]+)["'”’」』]$/
  );
  if (prefixed) {
    return `${prefixed[1].trim()} ${prefixed[2].trim()}`;
  }
  return trimmed
    .replace(/^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g, "")
    .trim();
}

interface MutableLiturgyStep {
  standing: boolean;
  rawStepKey: string;
  label: string;
  details: string[];
  officiant: string | null;
}

interface MainWorshipParseResult {
  readonly worshipOrder: readonly string[];
  readonly sermonTitle: string | null;
  readonly scripture: string | null;
  readonly preacher: string | null;
}

function parseMainSundayWorshipSection(
  deduped: readonly string[]
): MainWorshipParseResult {
  let startIdx = -1;
  for (let i = 0; i < deduped.length; i += 1) {
    const key = compactSectionKey(deduped[i]);
    if (
      key === "주일대예배" ||
      key === "주일낮예배" ||
      key === "주일예배" ||
      key === "대예배" ||
      key.startsWith("주일대예배") ||
      key.startsWith("주일낮예배")
    ) {
      startIdx = i;
      break;
    }
  }

  if (startIdx < 0) {
    return {
      worshipOrder: [],
      sermonTitle: null,
      scripture: null,
      preacher: null,
    };
  }

  let endIdx = deduped.length;
  for (let i = startIdx + 1; i < deduped.length; i += 1) {
    const key = compactSectionKey(deduped[i]);
    if (
      key.startsWith("주일오후예배") ||
      key === "오후예배" ||
      key === "오후찬양예배" ||
      key.startsWith("주중기도회") ||
      key.startsWith("주중예배") ||
      key.startsWith("수요기도회") ||
      key.startsWith("수요예배") ||
      (key === "교회소식" &&
        compactSectionKey(deduped[i + 1] ?? "") !== "사회자" &&
        compactSectionKey(deduped[i + 1] ?? "") !== "인도자") ||
      key === "봉사위원" ||
      key === "성경통독" ||
      key === "섬기는이들"
    ) {
      endIdx = i;
      break;
    }
  }

  const sectionLines = deduped.slice(startIdx + 1, endIdx);
  let headerLeaderPreacher: string | null = null;
  const steps: MutableLiturgyStep[] = [];
  let currentStep: MutableLiturgyStep | null = null;
  let pendingStanding = false;

  let extractedSermonTitle: string | null = null;
  let extractedScripture: string | null = null;
  let extractedPreacher: string | null = null;

  function flushCurrentStep() {
    if (!currentStep) return;
    steps.push(currentStep);
    currentStep = null;
  }

  for (let lineIdx = 0; lineIdx < sectionLines.length; lineIdx += 1) {
    const rawLine = sectionLines[lineIdx];
    if (isTypoNoiseFragment(rawLine)) {
      continue;
    }

    // Skip pure leader-dot filler cells (e.g. "···············" in 2013 HWP tables)
    if (/^[·․.•…\-_~\s]+$/.test(rawLine) && rawLine !== "※" && rawLine !== "*") {
      continue;
    }

    const compact = compactSectionKey(rawLine);
    if (!compact && rawLine !== "※") {
      continue;
    }

    // Stop at table footnote lines
    if (
      compact.startsWith("표는일어나") ||
      compact.startsWith("다음주기도") ||
      compact.startsWith("다음주특송") ||
      compact.startsWith("다음주봉헌")
    ) {
      break;
    }

    // 2013 2-column header where right-column "교독문" + "1. 시편1편" precedes "※ 묵도"
    if (
      steps.length === 0 &&
      !currentStep &&
      !pendingStanding &&
      compact === "교독문" &&
      /(?:1부|2부|오전\s*\d|사\s*회\s*[:：]|인\s*도\s*[:：])/.test(
        sectionLines[lineIdx + 1] ?? ""
      )
    ) {
      continue;
    }

    // Service time / presider info line right below heading
    if (
      /(?:1부|2부|오전\s*\d|사\s*회\s*[:：]|인\s*도\s*[:：])/.test(rawLine) &&
      steps.length === 0 &&
      !currentStep
    ) {
      const leaderMatch = rawLine.match(/(?:인\s*도|사\s*회)\s*[:：]\s*(.+)$/);
      if (leaderMatch) {
        const normalizedLeader = normalizePersonRoleString(leaderMatch[1]);
        if (normalizedLeader) {
          headerLeaderPreacher = normalizedLeader;
        }
      }
      // If followed immediately by responsive reading title ("1. 시편1편") from right-hand header cell, skip it too
      if (/^\d{1,3}\.\s*\S+/.test(sectionLines[lineIdx + 1] ?? "")) {
        lineIdx += 1;
      }
      continue;
    }

    if (rawLine === "※" || rawLine === "*") {
      flushCurrentStep();
      pendingStanding = true;
      continue;
    }

    let workingLine = rawLine;
    if (/^※\s+/.test(workingLine)) {
      flushCurrentStep();
      pendingStanding = true;
      workingLine = workingLine.replace(/^※\s+/, "").trim();
    }

    // Check single-line delimited format e.g. "찬송 / 23장 (다같이)"
    const inlineStepMatch = workingLine.match(
      /^([가-힣\s]{2,10}?)\s*[/|:：—–-]\s*(.+)$/
    );
    if (inlineStepMatch) {
      const candidateKey = compactSectionKey(inlineStepMatch[1]);
      const stepLabel = CANONICAL_LITURGY_STEPS[candidateKey];
      if (stepLabel) {
        flushCurrentStep();
        const rhs = inlineStepMatch[2].trim();
        steps.push({
          standing: pendingStanding,
          rawStepKey: candidateKey,
          label: stepLabel,
          details: [rhs],
          officiant: null,
        });
        pendingStanding = false;
        continue;
      }
    }

    const lineKey = compactSectionKey(workingLine);
    const matchedStepLabel = CANONICAL_LITURGY_STEPS[lineKey];

    if (matchedStepLabel) {
      // "사도신경" immediately after "신앙고백" is the creed title, not a separate step
      if (
        lineKey === "사도신경" &&
        currentStep &&
        currentStep.rawStepKey === "신앙고백" &&
        currentStep.details.length === 0
      ) {
        currentStep.details.push("사도신경");
        continue;
      }

      // Consecutive step labels sharing a single cell group e.g. "봉헌기도" + "봉헌"
      if (
        currentStep &&
        currentStep.details.length === 0 &&
        !currentStep.officiant &&
        !pendingStanding
      ) {
        currentStep.label = `${currentStep.label}, ${matchedStepLabel}`;
        currentStep.rawStepKey = lineKey;
        continue;
      }

      flushCurrentStep();
      currentStep = {
        standing: pendingStanding,
        rawStepKey: lineKey,
        label: matchedStepLabel,
        details: [],
        officiant: null,
      };
      pendingStanding = false;
      continue;
    }

    if (!currentStep) {
      continue;
    }

    // Once officiant is filled (e.g. "다같이" on 교독문), skip body verses until next step,
    // except when a sermon title line follows preacher in 2-row 2013 HWP sermon cells
    if (currentStep.officiant) {
      if (
        (currentStep.rawStepKey === "설교" || currentStep.rawStepKey === "말씀선포") &&
        currentStep.details.length === 0 &&
        workingLine.length <= 50
      ) {
        currentStep.details.push(workingLine);
      }
      continue;
    }

    const maybeOfficiant = normalizePersonRoleString(workingLine);
    if (maybeOfficiant) {
      currentStep.officiant = maybeOfficiant;
      continue;
    }

    if (currentStep.details.length < 2) {
      currentStep.details.push(workingLine);
    }
  }

  flushCurrentStep();

  const formattedOrder: string[] = [];

  for (const step of steps) {
    const prefix = step.standing ? "※ " : "";
    let detailText = step.details.join(" ").trim();

    if (
      (step.rawStepKey === "성경봉독" || step.rawStepKey === "말씀봉독") &&
      detailText
    ) {
      const normalizedRef = normalizeBibleReference(detailText);
      if (!extractedScripture && normalizedRef.headerScripture) {
        extractedScripture = normalizedRef.headerScripture;
      }
      detailText = normalizedRef.orderDisplay;
    }

    if (
      (step.rawStepKey === "설교" || step.rawStepKey === "말씀선포") &&
      detailText
    ) {
      const cleanTitle = stripOuterQuotes(
        detailText.replace(/\([^)]*목사[^)]*\)\s*$/, "").trim()
      );
      if (!extractedSermonTitle && cleanTitle) {
        extractedSermonTitle = cleanTitle;
      }
      detailText = `“${cleanTitle}”`;
      if (step.officiant && !extractedPreacher) {
        extractedPreacher = step.officiant;
      }
    }

    if (detailText && step.officiant) {
      formattedOrder.push(
        `${prefix}${step.label} — ${detailText} (${step.officiant})`
      );
    } else if (detailText) {
      formattedOrder.push(`${prefix}${step.label} — ${detailText}`);
    } else if (step.officiant) {
      formattedOrder.push(`${prefix}${step.label} — ${step.officiant}`);
    } else {
      formattedOrder.push(`${prefix}${step.label}`);
    }
  }

  return {
    worshipOrder: formattedOrder.slice(0, 20),
    sermonTitle: extractedSermonTitle,
    scripture: extractedScripture,
    preacher: extractedPreacher ?? headerLeaderPreacher,
  };
}

const ANNOUNCEMENT_STOP_KEYS = new Set([
  "헌금",
  "헌금명단",
  "봉헌명단",
  "봉사위원",
  "이번주봉사위원",
  "성경통독",
  "섬기는이들",
  "섬기는사람들",
  "협력선교사",
  "성경공부",
  "함께기도합시다",
  "예배시간안내",
  "마을모임현황",
]);

function stripLegacyWingdingPrefix(line: string): string {
  return line.replace(/^[LA┗└✤❖]\s+/, "").replace(/^✤|✤$/g, "").trim();
}

const MONTHLY_SCHEDULE_HEADER_RE =
  /^[▣■▪▶*\s]*(\d{1,2}\s*월\s*교회\s*일정)[▣■▪◀*\s]*$/;

const KOR_DATE_SPAN_PART =
  "(?:\\d{1,2}\\s*월\\s*)?\\d{1,2}\\s*(?:일)?(?:\\s*\\([^)]{1,4}\\))?(?:\\s*일)?(?:\\s*[~–-]\\s*(?:\\d{1,2}\\s*월\\s*)?\\d{1,2}\\s*(?:일)?(?:\\s*\\([^)]{1,4}\\))?(?:\\s*일)?)?";

const KOR_SCHEDULE_DATE_CELL_RE = new RegExp(
  `^\\d{1,2}\\s*월\\s*\\d{1,2}\\s*(?:일)?(?:\\s*\\([^)]{1,4}\\))?(?:\\s*일)?(?:\\s*[~–-]\\s*${KOR_DATE_SPAN_PART})?(?:\\s*,\\s*${KOR_DATE_SPAN_PART})*$`
);

const SLASH_SCHEDULE_DATE_CELL_RE =
  /^\d{1,2}\/\d{1,2}(?:\s*[~–-]\s*(?:\d{1,2}\/)?\d{1,2})?$/;

function isScheduleDateCell(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 36 || /[:：]/.test(trimmed)) {
    return false;
  }
  return (
    KOR_SCHEDULE_DATE_CELL_RE.test(trimmed) ||
    SLASH_SCHEDULE_DATE_CELL_RE.test(trimmed)
  );
}

function normalizeScheduleDateCell(raw: string): string {
  const spaced = raw
    .trim()
    .replace(/(\d{1,2})\s*월\s*(\d)/g, "$1월 $2")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ");
  if (/\d\s*월/.test(spaced) && /\d$/.test(spaced)) {
    return `${spaced}일`;
  }
  return spaced;
}

function normalizeScheduleEventCell(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (/^(?:[가-힣]\s+){1,4}[가-힣]$/.test(trimmed)) {
    return trimmed.replace(/\s+/g, "");
  }
  return trimmed.replace(/,\s*/g, ", ");
}

function isValidScheduleEventCell(line: string): boolean {
  if (!line) return false;
  if (isScheduleDateCell(line)) return false;
  if (MONTHLY_SCHEDULE_HEADER_RE.test(line)) return false;
  if (/^[•·▪▣∎[]/.test(line)) return false;
  if (/^\d{1,2}[.)]\s/.test(line)) return false;
  const key = compactSectionKey(line);
  if (
    ANNOUNCEMENT_STOP_KEYS.has(key) ||
    key === "소식" ||
    key === "교회소식" ||
    key === "축하합니다" ||
    key === "교우동정"
  ) {
    return false;
  }
  return true;
}

function normalizeSpacedTopicPrefix(line: string): string {
  // e.g. "4. 성 탄 절 : 강도사님을 중심으로..." -> "4. 성탄절: 강도사님을 중심으로..."
  const numberedSpaced = line.match(
    /^(\d{1,2}[.)]\s*)((?:[가-힣]\s+){1,4}[가-힣])\s*[:：]\s*(.+)$/
  );
  if (numberedSpaced) {
    const numPrefix = numberedSpaced[1];
    const compactLabel = numberedSpaced[2].replace(/\s+/g, "");
    const body = numberedSpaced[3].trim();
    return `${numPrefix}${compactLabel}: ${body}`;
  }

  const numberedNormal = line.match(/^(\d{1,2}[.)]\s*[^:：]{1,18}?)\s*[:：]\s*(.+)$/);
  if (numberedNormal) {
    return `${numberedNormal[1].trim()}: ${numberedNormal[2].trim()}`;
  }

  return line;
}

function isEmptyCelebrationPlaceholder(value: string): boolean {
  const compact = value.replace(/[•·▪\s-]/g, "");
  return compact === "" || compact === "없음" || compact === "해당없음";
}

function isNewcomerBoilerplateLine(line: string): boolean {
  if (/^\d{1,2}[.)]\s/.test(line)) {
    return false;
  }
  const compact = compactSectionKey(line);
  if (
    (compact.includes("처음나오신분") ||
      compact.includes("처음오신분") ||
      compact.includes("새로나오신분")) &&
    compact.includes("환영합니다")
  ) {
    return true;
  }
  if (
    (compact.includes("새가족등록") ||
      compact.includes("등록안내서") ||
      compact.includes("일광가족카드") ||
      compact.includes("등록카드")) &&
    (compact.includes("작성해주") ||
      compact.includes("작성바랍") ||
      compact.includes("기재해주"))
  ) {
    return true;
  }
  return false;
}

function isCelebrationContinuationLine(
  candidate: string | undefined,
  rawSlice: readonly string[]
): candidate is string {
  if (!candidate) return false;
  if (/^[•·▪▣∎[<]/.test(candidate)) return false;
  if (/^[LA┗└]\s+/.test(candidate)) return false;
  if (/^\d{1,2}[.)]\s/.test(candidate)) return false;
  if (/^[^:：]{1,12}\s*[:：]/.test(candidate)) return false;
  if (/교회\s*일정/.test(candidate)) return false;
  if (MONTHLY_SCHEDULE_HEADER_RE.test(candidate)) return false;
  if (isScheduleDateCell(candidate)) return false;
  const key = compactSectionKey(stripLegacyWingdingPrefix(candidate));
  if (
    ANNOUNCEMENT_STOP_KEYS.has(key) ||
    key === "소식" ||
    key === "교회소식" ||
    key === "축하합니다" ||
    key === "교우동정"
  ) {
    return false;
  }
  void rawSlice;
  return true;
}

function normalizeCelebrationCategoryLabel(raw: string): string {
  const compact = raw.replace(/\s+/g, "");
  if (compact === "결혼기념" || compact === "결혼기념일") {
    return "결혼";
  }
  return compact;
}

function extractAnnouncementsAndCelebrations(
  deduped: readonly string[],
  bulletinIsoDate: string | null
): {
  readonly announcements: string | null;
  readonly celebrations: readonly string[];
} {
  let startIdx = -1;
  for (let i = 0; i < deduped.length; i += 1) {
    const key = compactSectionKey(deduped[i]);
    const nextKey = compactSectionKey(deduped[i + 1] ?? "");
    if (
      (key === "교회소식" ||
        key === "금주의소식" ||
        key === "주간소식" ||
        key === "광고및소식" ||
        key === "광고내용") &&
      nextKey !== "사회자" &&
      nextKey !== "인도자"
    ) {
      startIdx = i;
      break;
    }
  }

  if (startIdx < 0) {
    return { announcements: null, celebrations: [] };
  }

  const rawSlice: string[] = [];
  for (let i = startIdx + 1; i < deduped.length; i += 1) {
    const cur = deduped[i];
    const inlinePrayerStop = cur.match(/^(.*?)\s*[LA┗└]\s*함께\s*기도\s*합시다.*$/);
    if (inlinePrayerStop) {
      const prefix = inlinePrayerStop[1].trim();
      if (prefix) {
        rawSlice.push(prefix);
      }
      break;
    }
    const key = compactSectionKey(stripLegacyWingdingPrefix(cur));
    if (ANNOUNCEMENT_STOP_KEYS.has(key)) {
      break;
    }
    rawSlice.push(cur);
  }

  if (rawSlice.length === 0) {
    return { announcements: null, celebrations: [] };
  }

  const out: string[] = [];
  const celebrations: string[] = [];
  let inCelebration = false;
  let inAngleSchedule = false;
  let i = 0;

  while (i < rawSlice.length) {
    const rawLine = rawSlice[i];
    const line = stripLegacyWingdingPrefix(rawLine);
    if (!inCelebration && isNewcomerBoilerplateLine(line)) {
      i += 1;
      continue;
    }
    const key = compactSectionKey(line);

    if (key === "소식" || key === "교회소식" || key === "광고") {
      inCelebration = false;
      inAngleSchedule = false;
      if (out.length > 0 && out[out.length - 1] !== "") {
        out.push("");
      }
      out.push("[교회 소식]");
      i += 1;
      continue;
    }

    if (key === "축하합니다" || key === "축하" || key === "교우동정") {
      inCelebration = true;
      inAngleSchedule = false;
      i += 1;
      continue;
    }

    // Angle-bracket schedule heading in 2013 HWP e.g. "<2월 행사 안내>"
    const angleHeaderMatch = line.match(/^<\s*(\d{1,2}\s*월\s*[^<>]{2,16})\s*>$/);
    if (angleHeaderMatch) {
      inCelebration = false;
      inAngleSchedule = true;
      if (out.length > 0 && out[out.length - 1] !== "") {
        out.push("");
      }
      out.push(`[${angleHeaderMatch[1].replace(/\s+/g, " ").trim()}]`);
      i += 1;
      continue;
    }

    // Case 1: Schedule table anchored BEFORE "▣ N월 교회 일정 ▣" caption (e.g. 2026-07-05..2026-10-18 HWPX)
    if (isScheduleDateCell(line)) {
      const dateCells: string[] = [];
      let cursor = i;
      while (cursor < rawSlice.length && isScheduleDateCell(rawSlice[cursor])) {
        dateCells.push(rawSlice[cursor]);
        cursor += 1;
      }
      if (
        dateCells.length >= 1 &&
        cursor + dateCells.length <= rawSlice.length
      ) {
        const eventCells = rawSlice.slice(cursor, cursor + dateCells.length);
        const validPairs = eventCells.every((ev) => isValidScheduleEventCell(ev));
        const trailingHeaderRaw = rawSlice[cursor + dateCells.length] ?? "";
        const trailingHeaderMatch = trailingHeaderRaw.match(
          MONTHLY_SCHEDULE_HEADER_RE
        );
        const atSliceEnd = cursor + dateCells.length === rawSlice.length;

        if (validPairs && (trailingHeaderMatch || atSliceEnd)) {
          inCelebration = false;
          if (out.length > 0 && out[out.length - 1] !== "") {
            out.push("");
          }
          const headingLabel = trailingHeaderMatch
            ? trailingHeaderMatch[1].replace(/\s+/g, " ").trim()
            : "교회 일정";
          out.push(`[${headingLabel}]`);
          for (let k = 0; k < dateCells.length; k += 1) {
            out.push(
              `• ${normalizeScheduleDateCell(dateCells[k])}: ${normalizeScheduleEventCell(eventCells[k])}`
            );
          }
          i = cursor + dateCells.length + (trailingHeaderMatch ? 1 : 0);
          continue;
        }
      }
    }

    // Case 2: "▣ N월 교회 일정 ▣" heading followed by 2-row horizontal schedule table
    const monthlyScheduleMatch = line.match(MONTHLY_SCHEDULE_HEADER_RE);
    if (monthlyScheduleMatch) {
      inCelebration = false;
      const headingLabel = monthlyScheduleMatch[1].replace(/\s+/g, " ").trim();
      i += 1;

      const dateCells: string[] = [];
      let cursor = i;
      while (cursor < rawSlice.length && isScheduleDateCell(rawSlice[cursor])) {
        dateCells.push(rawSlice[cursor]);
        cursor += 1;
      }
      if (
        dateCells.length >= 1 &&
        cursor + dateCells.length <= rawSlice.length
      ) {
        const eventCells = rawSlice.slice(cursor, cursor + dateCells.length);
        const validPairs = eventCells.every((ev) => isValidScheduleEventCell(ev));
        if (validPairs) {
          if (out.length > 0 && out[out.length - 1] !== "") {
            out.push("");
          }
          out.push(`[${headingLabel}]`);
          for (let k = 0; k < dateCells.length; k += 1) {
            out.push(
              `• ${normalizeScheduleDateCell(dateCells[k])}: ${normalizeScheduleEventCell(eventCells[k])}`
            );
          }
          i = cursor + dateCells.length;
          continue;
        }
      }

      // Non-horizontal fallback: only emit heading if non-empty schedule lines follow
      if (i < rawSlice.length) {
        if (out.length > 0 && out[out.length - 1] !== "") {
          out.push("");
        }
        out.push(`[${headingLabel}]`);
      }
      continue;
    }

    if (inCelebration && /^\d{1,2}[.)]\s/.test(line)) {
      inCelebration = false;
    }

    if (inCelebration) {
      // Case A: Split bullet label e.g. "•생 일 :" followed by value line(s) "이협우(19)"
      const splitBulletMatch = line.match(/^[•·▪-]?\s*(.+?)\s*[:：]\s*$/);
      if (splitBulletMatch) {
        const cleanLabel = normalizeCelebrationCategoryLabel(splitBulletMatch[1]);
        const valueParts: string[] = [];
        let nextIdx = i + 1;
        while (isCelebrationContinuationLine(rawSlice[nextIdx], rawSlice)) {
          valueParts.push(rawSlice[nextIdx]);
          nextIdx += 1;
        }
        const joinedValues = valueParts.join(" ").trim();
        if (joinedValues && !isEmptyCelebrationPlaceholder(joinedValues)) {
          const formatted = formatCelebrationValueList(
            joinedValues,
            bulletinIsoDate
          );
          celebrations.push(`${cleanLabel}: ${formatted}`);
        }
        i = nextIdx;
        continue;
      }

      // Case B: Inline labeled bullet e.g. "• 생일: 이협우(19)"
      const inlineCelebMatch = line.match(
        /^[•·▪-]?\s*([^:：]{1,12}?)\s*[:：]\s*(.+)$/
      );
      if (inlineCelebMatch) {
        const cleanLabel = normalizeCelebrationCategoryLabel(inlineCelebMatch[1]);
        const valueParts: string[] = [inlineCelebMatch[2].trim()];
        let nextIdx = i + 1;
        while (isCelebrationContinuationLine(rawSlice[nextIdx], rawSlice)) {
          valueParts.push(rawSlice[nextIdx]);
          nextIdx += 1;
        }
        const joinedValues = valueParts.join(" ").trim();
        if (joinedValues && !isEmptyCelebrationPlaceholder(joinedValues)) {
          const formatted = formatCelebrationValueList(
            joinedValues,
            bulletinIsoDate
          );
          celebrations.push(`${cleanLabel}: ${formatted}`);
        }
        i = nextIdx;
        continue;
      }

      // Case C: Unlabeled celebration entry line
      const cleanedEntry = line.replace(/^[•·▪-]\s*/, "").trim();
      if (cleanedEntry && !isEmptyCelebrationPlaceholder(cleanedEntry)) {
        celebrations.push(
          formatCelebrationValueList(cleanedEntry, bulletinIsoDate)
        );
      }
      i += 1;
      continue;
    }

    if (inAngleSchedule) {
      const dayEventMatch = line.match(/^(\d{1,2}\s*일(?:\([^)]+\))?)\s+(.+)$/);
      if (dayEventMatch) {
        out.push(`• ${dayEventMatch[1].trim()}: ${dayEventMatch[2].trim()}`);
        i += 1;
        continue;
      }
    }

    // Non-celebration split bullet label lines
    const splitBulletMatch = line.match(/^[•·▪-]\s*(.+?)\s*[:：]\s*$/);
    if (splitBulletMatch) {
      const cleanLabel = splitBulletMatch[1].replace(/\s+/g, "");
      const nextLine = rawSlice[i + 1];
      if (
        nextLine &&
        !/^[•·▪▣∎\d]/.test(nextLine) &&
        !ANNOUNCEMENT_STOP_KEYS.has(compactSectionKey(nextLine)) &&
        !/교회\s*일정/.test(nextLine)
      ) {
        out.push(`• ${cleanLabel}: ${nextLine}`);
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    out.push(normalizeSpacedTopicPrefix(line));
    i += 1;
  }

  return {
    announcements: out.join("\n").trim() || null,
    celebrations,
  };
}

const FALLBACK_LITURGY_KEYWORD_RE =
  /^(?:예배로의\s*부름|묵\s*도|기\s*원|찬\s*송|성시\s*교독|교독문|신앙\s*고백|사도\s*신경|대표\s*기도|기\s*도|성경\s*봉독|말씀\s*봉독|찬\s*양|특\s*송|설\s*교(?!\s*자)|말씀\s*선포|봉\s*헌(?:\s*및\s*봉헌기도)?|헌\s*금|교회\s*소식(?:\s*및\s*환영)?|광\s*고|환영과\s*교제|축\s*도|파송의\s*찬양)(?:$|[\s:：|/—–\-·(])/;

export function extractBulletinDraftFromLines(
  lines: readonly string[],
  fileName: string,
  format: "hwp" | "hwpx" | "docx" | "txt"
): ParsedBulletinDraft {
  const deduped: string[] = [];
  for (const raw of lines) {
    const line = cleanExtractedLine(raw);
    if (line && deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  const joined = deduped.join("\n");

  // 1. Cover volume + Korean date detection (e.g., "2026-46 2026년 11월 15일")
  let detectedDate: string | null = null;
  let detectedVolume: string | null = null;

  for (const line of deduped) {
    const coverCombo =
      line.match(
        /(?<![\d.-])(20\d{2}\s*-\s*\d{1,2})(?![-.\d])\s*(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/
      ) ??
      line.match(
        /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?<![\d.-])(20\d{2}\s*-\s*\d{1,2})(?![-.\d])/
      );

    if (coverCombo) {
      if (coverCombo[1].includes("-")) {
        detectedVolume = coverCombo[1].replace(/\s+/g, "");
        detectedDate = `${coverCombo[2]}-${coverCombo[3].padStart(2, "0")}-${coverCombo[4].padStart(2, "0")}`;
      } else {
        detectedDate = `${coverCombo[1]}-${coverCombo[2].padStart(2, "0")}-${coverCombo[3].padStart(2, "0")}`;
        detectedVolume = coverCombo[4].replace(/\s+/g, "");
      }
      break;
    }
  }

  if (!detectedDate) {
    const korDateMatch =
      joined.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ??
      joined.match(/(20\d{2})[./]\s*(\d{1,2})[./]\s*(\d{1,2})/) ??
      joined.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/) ??
      fileName.match(/(20\d{2})[._-]?(\d{2})[._-]?(\d{2})/);

    if (korDateMatch) {
      const yyyy = korDateMatch[1];
      const mm = korDateMatch[2].padStart(2, "0");
      const dd = korDateMatch[3].padStart(2, "0");
      detectedDate = `${yyyy}-${mm}-${dd}`;
    } else {
      const mmddFileMatch = fileName.match(
        /(?:^|\D)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:\D|$)/
      );
      if (mmddFileMatch) {
        const currentYear = getKstDateString().slice(0, 4);
        detectedDate = `${currentYear}-${mmddFileMatch[1]}-${mmddFileMatch[2]}`;
      }
    }
  }

  if (!detectedVolume) {
    for (const line of deduped) {
      const standaloneIssue = line.match(/^(20\d{2}\s*-\s*\d{1,2})$/);
      if (standaloneIssue) {
        detectedVolume = standaloneIssue[1].replace(/\s+/g, "");
        break;
      }
    }
  }

  if (!detectedVolume) {
    const volMatch = joined.match(/제\s*\d+\s*권\s*(?:제\s*)?\d+\s*호/);
    if (volMatch) {
      detectedVolume = volMatch[0]
        .replace(/\s+/g, " ")
        .replace(/제\s*(\d+)\s*권/, "제$1권");
    }
  }

  if (!detectedVolume) {
    const inlineIssueMatch = joined.match(
      /(?<![\d.-])(20\d{2}-\d{1,2})(?![-.\d])/
    );
    if (inlineIssueMatch) {
      detectedVolume = inlineIssueMatch[1];
    } else if (detectedDate) {
      detectedVolume = formatDefaultBulletinVolume(detectedDate);
    }
  }

  // 2. Parse Main Sunday Worship section ("주 일 대 예 배") first
  const mainWorship = parseMainSundayWorshipSection(deduped);

  let detectedScripture = mainWorship.scripture;
  let detectedSermonTitle = mainWorship.sermonTitle;
  let detectedPreacher = mainWorship.preacher;
  const worshipOrder = [...mainWorship.worshipOrder];

  // Fallbacks for non-table plain text / DOCX bulletins
  if (!detectedScripture) {
    for (const line of deduped) {
      const labeled = line.match(
        /(?:성경\s*본문|성경\s*봉독|말씀\s*본문|본\s*문)\s*[:：|-]\s*(.+)/
      );
      if (labeled && labeled[1].trim().length >= 3) {
        detectedScripture = normalizeBibleReference(
          labeled[1].trim().slice(0, 60)
        ).headerScripture;
        break;
      }
      const cit = line.match(FULL_BIBLE_CITATION_RE);
      if (cit) {
        detectedScripture = cit[1].trim();
        break;
      }
    }
  }

  if (!detectedSermonTitle) {
    for (const line of deduped) {
      const m = line.match(
        /^(?:[-•*]\s*)?(?:설\s*교\s*제\s*목|말\s*씀\s*제\s*목|제\s*목|설\s*교|말씀선포)\s*[:：|-]\s*(.+)/
      );
      if (m) {
        const cleaned = stripOuterQuotes(
          m[1]
            .replace(/\([^)]*목사[^)]*\)/g, "")
            .replace(/[-|/]\s*[가-힣]+\s*(?:담임)?목사.*$/, "")
        );
        if (cleaned.length >= 2) {
          detectedSermonTitle = cleaned.slice(0, 80);
          break;
        }
      }
    }
  }

  if (!detectedPreacher) {
    for (const line of deduped) {
      const labeledPreacher = line.match(
        /(?:설\s*교(?:\s*자)?|인\s*도)\s*[:：]\s*(.+)/
      );
      if (labeledPreacher) {
        const normalized = normalizePersonRoleString(labeledPreacher[1]);
        if (normalized) {
          detectedPreacher = normalized;
          break;
        }
      }
      const prefixPastor = line.match(
        /^(담임목사|원로목사|부목사|목사)\s+([가-힣](?:\s*[가-힣]){1,3})$/
      );
      if (prefixPastor) {
        const compactName = prefixPastor[2].replace(/\s+/g, "");
        if (!ROLE_ONLY_PREFIXES.has(compactName)) {
          detectedPreacher = `${compactName} ${prefixPastor[1]}`;
          break;
        }
      }
      const normalizedWhole = normalizePersonRoleString(line);
      if (
        normalizedWhole &&
        /(?:담임목사|목사|강도사|전도사)$/.test(normalizedWhole) &&
        normalizedWhole !== "담임목사"
      ) {
        detectedPreacher = normalizedWhole;
        break;
      }
    }
  }

  if (worshipOrder.length === 0) {
    for (const line of deduped) {
      if (FALLBACK_LITURGY_KEYWORD_RE.test(line) && line.length <= 90) {
        worshipOrder.push(line);
        if (worshipOrder.length >= 20) break;
      }
    }
  }

  // 3. Extract Announcements ("교회 소식" / 광고 내용) and Celebrations ("축하합니다")
  const { announcements, celebrations } = extractAnnouncementsAndCelebrations(
    deduped,
    detectedDate
  );
  const fullContent =
    announcements !== null || celebrations.length > 0
      ? (announcements ?? "")
      : joined;

  const title = detectedDate
    ? formatBulletinDateTitle(detectedDate)
    : formatBulletinDateTitle(getKstDateString());

  return {
    format,
    title,
    date: detectedDate,
    volume: detectedVolume,
    sermonTitle: detectedSermonTitle,
    scripture: detectedScripture,
    preacher: detectedPreacher,
    worshipOrder,
    celebrations,
    fullContent,
    rawLineCount: deduped.length,
  };
}

export function parseBulletinFileBuffer(
  buf: Buffer,
  fileName: string
): ParsedBulletinDraft {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";

  if (startsWith(buf, ZIP_LOCAL_MAGIC)) {
    const { format, lines } = extractTextFromZipContainer(buf, ext);
    return extractBulletinDraftFromLines(lines, fileName, format);
  }

  if (startsWith(buf, OLE_MAGIC)) {
    const lines = extractTextFromHwp5Ole(buf);
    return extractBulletinDraftFromLines(lines, fileName, "hwp");
  }

  if (ext === ".txt") {
    const lines = decodePlainTextBuffer(buf);
    if (lines.length === 0) {
      throw new Error("빈 텍스트 파일입니다.");
    }
    return extractBulletinDraftFromLines(lines, fileName, "txt");
  }

  throw new Error(
    "자동 내용 추출은 한글 문서(.hwp, .hwpx), 워드(.docx), 텍스트(.txt) 파일을 지원합니다."
  );
}
