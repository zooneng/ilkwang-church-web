import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isCloudStoreEnabled,
  readCloudJson,
  writeCloudJson,
} from "@/lib/cloud-store";
import { getSiteContent, saveSiteContent } from "@/lib/content-store";
import {
  formatEventBadgesFromIsoDate,
  getKstDateString,
  normalizeResourceCategory,
  resolveEventIsoDate,
} from "@/lib/format-utils";
import type {
  CommunityDepartment,
  CommunityPost,
  CustomBoard,
  CustomBoardPost,
  CustomBoardsStoreData,
  EventItem,
  ManagedBoardPost,
  ManagedBoardSummary,
  NavCategoryConfig,
  NoticeItem,
  ResourceItem,
  SiteContent,
} from "@/types/site-content";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const CUSTOM_BOARDS_FILE = path.join(DATA_DIRECTORY, "custom-boards.json");

const DEFAULT_BANNER_IMAGE =
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1800&auto=format&fit=crop&q=80";
const DEFAULT_COMMUNITY_IMAGE = DEFAULT_BANNER_IMAGE;

let boardsLockQueue: Promise<void> = Promise.resolve();

async function withBoardsLock<T>(task: () => Promise<T>): Promise<T> {
  const next = boardsLockQueue.then(task, task);
  boardsLockQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

const CUSTOM_BOARDS_CLOUD_KEY = "custom-boards";

async function atomicWriteCustomBoards(data: CustomBoardsStoreData): Promise<void> {
  if (isCloudStoreEnabled()) {
    await writeCloudJson(CUSTOM_BOARDS_CLOUD_KEY, data);
    return;
  }
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  const tmpPath = `${CUSTOM_BOARDS_FILE}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, CUSTOM_BOARDS_FILE);
}

async function readBundledCustomBoardsSeed(): Promise<CustomBoardsStoreData> {
  try {
    const raw = await fs.readFile(CUSTOM_BOARDS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<CustomBoardsStoreData>;
    return {
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      boards: Array.isArray(parsed.boards) ? parsed.boards : [],
    };
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      boards: [],
    };
  }
}

async function readCustomBoardsUnlocked(): Promise<CustomBoardsStoreData> {
  if (isCloudStoreEnabled()) {
    const cloud = await readCloudJson<Partial<CustomBoardsStoreData>>(
      CUSTOM_BOARDS_CLOUD_KEY
    );
    if (cloud.found && cloud.value) {
      return {
        updatedAt:
          typeof cloud.value.updatedAt === "string"
            ? cloud.value.updatedAt
            : new Date().toISOString(),
        boards: Array.isArray(cloud.value.boards) ? cloud.value.boards : [],
      };
    }
    const seeded = await readBundledCustomBoardsSeed();
    await writeCloudJson(CUSTOM_BOARDS_CLOUD_KEY, seeded);
    return seeded;
  }

  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    const raw = await fs.readFile(CUSTOM_BOARDS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<CustomBoardsStoreData>;
    return {
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      boards: Array.isArray(parsed.boards) ? parsed.boards : [],
    };
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
    const initial: CustomBoardsStoreData = {
      updatedAt: new Date().toISOString(),
      boards: [],
    };
    await atomicWriteCustomBoards(initial);
    return initial;
  }
}

function sanitizeAsciiSlug(raw?: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function coerceNoticeCategory(tag: string): NoticeItem["category"] {
  if (tag === "필독" || tag === "예배" || tag === "소식" || tag === "모집") {
    return tag;
  }
  return "소식";
}

function coerceCommunityDept(tag: string): CommunityDepartment {
  if (tag === "유초등부" || tag === "주일학교") {
    return "유초등부";
  }
  if (tag === "중고등부") {
    return "중고등부";
  }
  if (tag === "청년부") {
    return "청년부";
  }
  return "청년부";
}

function findParentCategoryLabel(
  navigation: readonly NavCategoryConfig[],
  href: string
): string {
  for (const cat of navigation) {
    if (cat.items.some((item) => item.href === href)) {
      return cat.label;
    }
  }
  return "미연결 메뉴";
}

export async function getCustomBoardsData(): Promise<CustomBoardsStoreData> {
  return withBoardsLock(readCustomBoardsUnlocked);
}

export async function getCustomBoardBySlug(
  slug: string
): Promise<CustomBoard | null> {
  const data = await getCustomBoardsData();
  return data.boards.find((b) => b.slug === slug) ?? null;
}

export async function getManagedBoardSummaries(): Promise<
  readonly ManagedBoardSummary[]
> {
  const [content, customData] = await Promise.all([
    getSiteContent(),
    getCustomBoardsData(),
  ]);

  const noticesSummary: ManagedBoardSummary = {
    boardKey: "builtin:notices",
    title: "교회 소식",
    href: "/news",
    parentCategoryLabel: findParentCategoryLabel(content.navigation, "/news"),
    isBuiltIn: true,
    subtitle: "일광교회의 주요 공지 사항과 한 주간의 소식",
    postCount: content.notices.length,
    posts: [...content.notices]
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
      .map((n) => ({
        id: n.id,
        boardKey: "builtin:notices",
        categoryTag: n.category,
        title: n.title,
        author: n.author,
        date: n.date,
        content: n.content,
        isPinned: n.isPinned,
        attachmentUrl: n.attachmentUrl,
        attachmentName: n.attachmentName,
      })),
  };

  const eventsSummary: ManagedBoardSummary = {
    boardKey: "builtin:events",
    title: "행사 안내",
    href: "/news/events",
    parentCategoryLabel: findParentCategoryLabel(
      content.navigation,
      "/news/events"
    ),
    isBuiltIn: true,
    subtitle: "절기 예배 및 연간 주요 행사 일정",
    postCount: content.events.length,
    posts: [...content.events]
      .sort((a, b) => resolveEventIsoDate(b).localeCompare(resolveEventIsoDate(a)))
      .map((ev) => ({
        id: ev.id,
        boardKey: "builtin:events",
        categoryTag: ev.location || "일광교회",
        title: ev.title,
        author: ev.timeText || "예배 및 행사",
        date: resolveEventIsoDate(ev),
        content: ev.description,
        isPinned: false,
        attachmentUrl: ev.attachmentUrl,
        attachmentName: ev.attachmentName,
      })),
  };

  const resourcesSummary: ManagedBoardSummary = {
    boardKey: "builtin:resources",
    title: "교재 자료",
    href: "/resources",
    parentCategoryLabel: findParentCategoryLabel(
      content.navigation,
      "/resources"
    ),
    isBuiltIn: true,
    subtitle: "성경 공부 교재 및 부서 공과 자료실",
    postCount: content.resources.length,
    posts: content.resources.map((r) => ({
      id: r.id,
      boardKey: "builtin:resources",
      categoryTag: normalizeResourceCategory(r.category),
      title: r.title,
      author: r.author,
      date: r.date,
      content: r.description,
      isPinned: false,
      attachmentUrl: r.fileUrl,
      attachmentName: r.fileName,
    })),
  };

  const youthBoardSpecs = [
    {
      boardKey: "builtin:youth:sunday",
      dept: "유초등부" as const,
      href: "/youth/sunday",
      subtitle: "유치부 및 유초등부 예배와 교육 소식",
    },
    {
      boardKey: "builtin:youth:teens",
      dept: "중고등부" as const,
      href: "/youth/teens",
      subtitle: "중고등부 청소년 공동체 소식",
    },
    {
      boardKey: "builtin:youth:young-adults",
      dept: "청년부" as const,
      href: "/youth/young-adults",
      subtitle: "청년부 예배와 사역 소식",
    },
  ] as const;

  const youthSummaries: ManagedBoardSummary[] = youthBoardSpecs.map((spec) => {
    const deptPosts = content.communityPosts.filter((c) => {
      const normalized = c.department === "주일학교" ? "유초등부" : c.department;
      return normalized === spec.dept;
    });
    return {
      boardKey: spec.boardKey,
      title: `${spec.dept} 소식`,
      href: spec.href,
      parentCategoryLabel: findParentCategoryLabel(
        content.navigation,
        spec.href
      ),
      isBuiltIn: true,
      subtitle: spec.subtitle,
      postCount: deptPosts.length,
      posts: deptPosts.map((c) => ({
        id: c.id,
        boardKey: spec.boardKey,
        categoryTag: spec.dept,
        title: c.title,
        author: c.author,
        date: c.date,
        content: c.content,
        isPinned: false,
        imageUrl: c.imageUrl,
        youtubeId: c.youtubeId,
        attachmentUrl: c.attachmentUrl,
        attachmentName: c.attachmentName,
      })),
    };
  });

  const customSummaries: ManagedBoardSummary[] = customData.boards.map(
    (board) => {
      const boardHref = `/boards/${board.slug}`;
      const sortedPosts = [...board.posts].sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned)
      );
      return {
        boardKey: `custom:${board.slug}`,
        title: board.title,
        href: boardHref,
        parentCategoryLabel: findParentCategoryLabel(
          content.navigation,
          boardHref
        ),
        isBuiltIn: false,
        customBoardSlug: board.slug,
        allowMemberWrite: false,
        subtitle: board.subtitle,
        postCount: board.posts.length,
        posts: sortedPosts.map((p) => ({
          id: p.id,
          boardKey: `custom:${board.slug}`,
          categoryTag: p.categoryTag,
          title: p.title,
          author: p.author,
          date: p.date,
          content: p.content,
          isPinned: p.isPinned,
          imageUrl: p.imageUrl,
          attachmentUrl: p.attachmentUrl,
          attachmentName: p.attachmentName,
        })),
      };
    }
  );

  return [
    noticesSummary,
    eventsSummary,
    resourcesSummary,
    ...youthSummaries,
    ...customSummaries,
  ];
}

export async function createCustomBoardAndAttachToNav(input: {
  readonly parentCategoryId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly englishLabel?: string;
  readonly slug?: string;
  readonly allowMemberWrite?: boolean;
  readonly bannerImageUrl?: string;
}): Promise<{
  readonly board: CustomBoard;
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    throw new Error("새 게시판 이름을 입력해 주세요.");
  }

  const createdBoard = await withBoardsLock(async () => {
    const store = await readCustomBoardsUnlocked();
    const existingSlugs = new Set(store.boards.map((b) => b.slug));
    let candidateSlug = sanitizeAsciiSlug(input.slug);
    if (!candidateSlug || existingSlugs.has(candidateSlug)) {
      candidateSlug = `${candidateSlug || "board"}-${randomUUID().slice(0, 6)}`;
    }

    const board: CustomBoard = {
      id: `cboard-${randomUUID().slice(0, 8)}`,
      slug: candidateSlug,
      title: trimmedTitle,
      subtitle:
        input.subtitle?.trim() || `${trimmedTitle} 게시판의 소식과 나눔을 전해드립니다.`,
      englishLabel: input.englishLabel?.trim() || "Church Board",
      bannerImageUrl: input.bannerImageUrl?.trim() || DEFAULT_BANNER_IMAGE,
      allowMemberWrite: Boolean(input.allowMemberWrite),
      createdAt: new Date().toISOString(),
      posts: [],
    };

    const nextStore: CustomBoardsStoreData = {
      updatedAt: new Date().toISOString(),
      boards: [...store.boards, board],
    };
    await atomicWriteCustomBoards(nextStore);
    return board;
  });

  const currentContent = await getSiteContent();
  const boardHref = `/boards/${createdBoard.slug}`;
  const targetExists = currentContent.navigation.some(
    (c) => c.id === input.parentCategoryId
  );
  const fallbackCategoryId =
    currentContent.navigation[currentContent.navigation.length - 1]?.id ?? "";
  const effectiveCategoryId = targetExists
    ? input.parentCategoryId
    : fallbackCategoryId;

  const updatedNav = currentContent.navigation.map((cat) => {
    if (cat.id !== effectiveCategoryId) return cat;
    const nextItems = [
      ...cat.items,
      {
        id: `sub-${randomUUID().slice(0, 8)}`,
        label: createdBoard.title,
        href: boardHref,
        description: createdBoard.subtitle,
        isVisible: true,
        customBoardSlug: createdBoard.slug,
      },
    ];
    const shouldUpdateCategoryHref =
      !cat.href || cat.href === "#" || cat.items.length === 0;
    return {
      ...cat,
      href: shouldUpdateCategoryHref ? boardHref : cat.href,
      items: nextItems,
    };
  });

  const savedContent = await saveSiteContent({
    ...currentContent,
    navigation: updatedNav,
  });
  const summaries = await getManagedBoardSummaries();

  return { board: createdBoard, content: savedContent, summaries };
}

export async function updateCustomBoardSettings(input: {
  readonly slug: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly allowMemberWrite?: boolean;
}): Promise<{
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  let updatedBoard: CustomBoard | null = null;
  await withBoardsLock(async () => {
    const store = await readCustomBoardsUnlocked();
    const target = store.boards.find((b) => b.slug === input.slug);
    if (!target) {
      throw new Error("수정할 게시판을 찾을 수 없습니다.");
    }
    const nextTitle = input.title?.trim() || target.title;
    const nextSubtitle = input.subtitle?.trim() || target.subtitle;
    updatedBoard = {
      ...target,
      title: nextTitle,
      subtitle: nextSubtitle,
      allowMemberWrite:
        typeof input.allowMemberWrite === "boolean"
          ? input.allowMemberWrite
          : target.allowMemberWrite,
    };
    const nextStore: CustomBoardsStoreData = {
      updatedAt: new Date().toISOString(),
      boards: store.boards.map((b) =>
        b.slug === input.slug && updatedBoard ? updatedBoard : b
      ),
    };
    await atomicWriteCustomBoards(nextStore);
  });

  const currentContent = await getSiteContent();
  const boardHref = `/boards/${input.slug}`;
  const updatedNav = currentContent.navigation.map((cat) => ({
    ...cat,
    items: cat.items.map((sub) =>
      sub.customBoardSlug === input.slug || sub.href === boardHref
        ? {
            ...sub,
            label: updatedBoard ? updatedBoard.title : sub.label,
            description: updatedBoard ? updatedBoard.subtitle : sub.description,
          }
        : sub
    ),
  }));

  const savedContent = await saveSiteContent({
    ...currentContent,
    navigation: updatedNav,
  });
  const summaries = await getManagedBoardSummaries();
  return { content: savedContent, summaries };
}

export async function deleteCustomBoardAndDetachFromNav(slug: string): Promise<{
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  await withBoardsLock(async () => {
    const store = await readCustomBoardsUnlocked();
    const nextStore: CustomBoardsStoreData = {
      updatedAt: new Date().toISOString(),
      boards: store.boards.filter((b) => b.slug !== slug),
    };
    await atomicWriteCustomBoards(nextStore);
  });

  const boardHref = `/boards/${slug}`;
  const currentContent = await getSiteContent();
  const updatedNav = currentContent.navigation.map((cat) => {
    const remainingItems = cat.items.filter(
      (item) => item.customBoardSlug !== slug && item.href !== boardHref
    );
    const nextHref =
      cat.href === boardHref ? (remainingItems[0]?.href ?? "/") : cat.href;
    return {
      ...cat,
      href: nextHref,
      items: remainingItems,
    };
  });

  const savedContent = await saveSiteContent({
    ...currentContent,
    navigation: updatedNav,
  });
  const summaries = await getManagedBoardSummaries();
  return { content: savedContent, summaries };
}

export async function addMemberPostToCustomBoard(
  slug: string,
  input: {
    readonly categoryTag?: string;
    readonly title: string;
    readonly author: string;
    readonly content: string;
  }
): Promise<CustomBoard> {
  return withBoardsLock(async () => {
    const store = await readCustomBoardsUnlocked();
    const board = store.boards.find((b) => b.slug === slug);
    if (!board) {
      throw new Error("게시판을 찾을 수 없습니다.");
    }
    if (!board.allowMemberWrite) {
      throw new Error("이 게시판은 관리자 전용 게시판입니다.");
    }
    const created: CustomBoardPost = {
      id: `cpost-${randomUUID().slice(0, 8)}`,
      categoryTag: input.categoryTag?.trim() || "나눔",
      title: input.title.trim(),
      author: input.author.trim(),
      date: getKstDateString(),
      content: input.content.trim(),
      isPinned: false,
    };
    const updatedBoard: CustomBoard = {
      ...board,
      posts: [created, ...board.posts],
    };
    await atomicWriteCustomBoards({
      updatedAt: new Date().toISOString(),
      boards: store.boards.map((b) => (b.slug === slug ? updatedBoard : b)),
    });
    return updatedBoard;
  });
}

// Helper: insert normalized posts into any target boardKey
async function insertPostsIntoBoard(
  targetBoardKey: string,
  incoming: readonly Omit<ManagedBoardPost, "boardKey">[]
): Promise<void> {
  if (incoming.length === 0) return;

  if (targetBoardKey === "builtin:notices") {
    const current = await getSiteContent();
    const mapped: NoticeItem[] = incoming.map((p) => ({
      id: `notice-${randomUUID().slice(0, 8)}`,
      category: coerceNoticeCategory(p.categoryTag),
      title: p.title,
      date: p.date || getKstDateString(),
      author: p.author || "교회 사무실",
      isPinned: p.isPinned,
      content: p.content,
      ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
      ...(p.attachmentUrl ? { attachmentUrl: p.attachmentUrl } : {}),
      ...(p.attachmentName ? { attachmentName: p.attachmentName } : {}),
    }));
    await saveSiteContent({
      ...current,
      notices: [...mapped, ...current.notices],
    });
    return;
  }

  if (targetBoardKey === "builtin:events") {
    const current = await getSiteContent();
    const mapped: EventItem[] = incoming.map((p) => {
      const isoDate =
        p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
          ? p.date
          : getKstDateString();
      const badges = formatEventBadgesFromIsoDate(isoDate);
      return {
        id: `ev-${randomUUID().slice(0, 8)}`,
        date: isoDate,
        dayBadge: badges.dayBadge,
        monthYearBadge: badges.monthYearBadge,
        title: p.title,
        timeText: p.author || "예배 및 행사 안내",
        location: p.categoryTag || "일광교회",
        description: p.content,
        ...(p.attachmentUrl ? { attachmentUrl: p.attachmentUrl } : {}),
        ...(p.attachmentName ? { attachmentName: p.attachmentName } : {}),
      };
    });
    await saveSiteContent({
      ...current,
      events: [...mapped, ...current.events],
    });
    return;
  }

  if (targetBoardKey === "builtin:resources") {
    const current = await getSiteContent();
    const mapped: ResourceItem[] = incoming.map((p) => ({
      id: `res-${randomUUID().slice(0, 8)}`,
      category: normalizeResourceCategory(p.categoryTag),
      title: p.title,
      description: p.content,
      date: p.date || getKstDateString(),
      author: p.author || "교회 사무실",
      fileUrl: p.attachmentUrl || "/resources",
      fileName: p.attachmentName || "첨부자료",
      fileSizeLabel: p.attachmentUrl ? "첨부파일" : "본문안내",
    }));
    await saveSiteContent({
      ...current,
      resources: [...mapped, ...current.resources],
    });
    return;
  }

  if (
    targetBoardKey === "builtin:community" ||
    targetBoardKey.startsWith("builtin:youth:")
  ) {
    const forcedDept: CommunityDepartment | null =
      targetBoardKey === "builtin:youth:sunday"
        ? "유초등부"
        : targetBoardKey === "builtin:youth:teens"
          ? "중고등부"
          : targetBoardKey === "builtin:youth:young-adults"
            ? "청년부"
            : null;
    const current = await getSiteContent();
    const mapped: CommunityPost[] = incoming.map((p) => ({
      id: `comm-${randomUUID().slice(0, 8)}`,
      department: forcedDept ?? coerceCommunityDept(p.categoryTag),
      title: p.title,
      content: p.content,
      author: p.author || `${forcedDept ?? "다음세대"} 담당`,
      date: p.date || getKstDateString(),
      imageUrl: p.imageUrl || DEFAULT_COMMUNITY_IMAGE,
      ...(p.youtubeId ? { youtubeId: p.youtubeId } : {}),
      ...(p.attachmentUrl ? { attachmentUrl: p.attachmentUrl } : {}),
      ...(p.attachmentName ? { attachmentName: p.attachmentName } : {}),
    }));
    await saveSiteContent({
      ...current,
      communityPosts: [...mapped, ...current.communityPosts],
    });
    return;
  }

  if (targetBoardKey.startsWith("custom:")) {
    const slug = targetBoardKey.slice("custom:".length);
    await withBoardsLock(async () => {
      const store = await readCustomBoardsUnlocked();
      const target = store.boards.find((b) => b.slug === slug);
      if (!target) {
        throw new Error("대상 사용자 게시판을 찾을 수 없습니다.");
      }
      const mapped: CustomBoardPost[] = incoming.map((p) => ({
        id: `cpost-${randomUUID().slice(0, 8)}`,
        categoryTag: p.categoryTag || "소식",
        title: p.title,
        author: p.author || "교회 사무실",
        date: p.date || getKstDateString(),
        content: p.content,
        isPinned: p.isPinned,
        ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
        ...(p.attachmentUrl ? { attachmentUrl: p.attachmentUrl } : {}),
        ...(p.attachmentName ? { attachmentName: p.attachmentName } : {}),
      }));
      await atomicWriteCustomBoards({
        updatedAt: new Date().toISOString(),
        boards: store.boards.map((b) =>
          b.slug === slug ? { ...b, posts: [...mapped, ...b.posts] } : b
        ),
      });
    });
    return;
  }

  throw new Error(`지원하지 않는 게시판 식별자입니다: ${targetBoardKey}`);
}

// Helper: delete post IDs from any boardKey
async function removePostsFromBoard(
  boardKey: string,
  postIds: ReadonlySet<string>
): Promise<void> {
  if (postIds.size === 0) return;

  if (boardKey === "builtin:notices") {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      notices: current.notices.filter((n) => !postIds.has(n.id)),
    });
    return;
  }

  if (boardKey === "builtin:events") {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      events: current.events.filter((ev) => !postIds.has(ev.id)),
    });
    return;
  }

  if (boardKey === "builtin:resources") {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      resources: current.resources.filter((r) => !postIds.has(r.id)),
    });
    return;
  }

  if (
    boardKey === "builtin:community" ||
    boardKey.startsWith("builtin:youth:")
  ) {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      communityPosts: current.communityPosts.filter((c) => !postIds.has(c.id)),
    });
    return;
  }

  if (boardKey.startsWith("custom:")) {
    const slug = boardKey.slice("custom:".length);
    await withBoardsLock(async () => {
      const store = await readCustomBoardsUnlocked();
      await atomicWriteCustomBoards({
        updatedAt: new Date().toISOString(),
        boards: store.boards.map((b) =>
          b.slug === slug
            ? { ...b, posts: b.posts.filter((p) => !postIds.has(p.id)) }
            : b
        ),
      });
    });
    return;
  }

  throw new Error(`지원하지 않는 게시판 식별자입니다: ${boardKey}`);
}

export async function createManagedPost(input: {
  readonly boardKey: string;
  readonly categoryTag?: string;
  readonly title: string;
  readonly author?: string;
  readonly date?: string;
  readonly content: string;
  readonly isPinned?: boolean;
  readonly imageUrl?: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}): Promise<{
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  if (!input.title.trim() || !input.content.trim()) {
    throw new Error("게시물 제목과 본문을 모두 입력해 주세요.");
  }

  await insertPostsIntoBoard(input.boardKey, [
    {
      id: `tmp-${randomUUID().slice(0, 8)}`,
      categoryTag: input.categoryTag?.trim() || "소식",
      title: input.title.trim(),
      author: input.author?.trim() || "교회 사무실",
      date: input.date?.trim() || getKstDateString(),
      content: input.content.trim(),
      isPinned: Boolean(input.isPinned),
      imageUrl: input.imageUrl?.trim() || undefined,
      attachmentUrl: input.attachmentUrl?.trim() || undefined,
      attachmentName: input.attachmentName?.trim() || undefined,
    },
  ]);

  const [content, summaries] = await Promise.all([
    getSiteContent(),
    getManagedBoardSummaries(),
  ]);
  return { content, summaries };
}

export async function updateManagedPost(input: {
  readonly boardKey: string;
  readonly postId: string;
  readonly categoryTag?: string;
  readonly title?: string;
  readonly author?: string;
  readonly date?: string;
  readonly content?: string;
  readonly isPinned?: boolean;
  readonly imageUrl?: string;
  readonly attachmentUrl?: string;
  readonly attachmentName?: string;
}): Promise<{
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  const { boardKey, postId } = input;

  if (boardKey === "builtin:notices") {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      notices: current.notices.map((n) =>
        n.id === postId
          ? {
              ...n,
              category: input.categoryTag
                ? coerceNoticeCategory(input.categoryTag)
                : n.category,
              title: input.title?.trim() || n.title,
              author: input.author?.trim() || n.author,
              date: input.date?.trim() || n.date,
              content: input.content !== undefined ? input.content : n.content,
              isPinned:
                typeof input.isPinned === "boolean" ? input.isPinned : n.isPinned,
              ...(input.attachmentUrl !== undefined
                ? { attachmentUrl: input.attachmentUrl || undefined }
                : {}),
              ...(input.attachmentName !== undefined
                ? { attachmentName: input.attachmentName || undefined }
                : {}),
            }
          : n
      ),
    });
  } else if (boardKey === "builtin:events") {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      events: current.events.map((ev) => {
        if (ev.id !== postId) return ev;
        const nextIso =
          input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim())
            ? input.date.trim()
            : resolveEventIsoDate(ev);
        const badges = formatEventBadgesFromIsoDate(nextIso);
        return {
          ...ev,
          date: nextIso,
          dayBadge: badges.dayBadge,
          monthYearBadge: badges.monthYearBadge,
          title: input.title?.trim() || ev.title,
          timeText: input.author?.trim() || ev.timeText,
          location: input.categoryTag?.trim() || ev.location,
          description: input.content !== undefined ? input.content : ev.description,
        };
      }),
    });
  } else if (boardKey === "builtin:resources") {
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      resources: current.resources.map((r) =>
        r.id === postId
          ? {
              ...r,
              category: input.categoryTag
                ? normalizeResourceCategory(input.categoryTag)
                : r.category,
              title: input.title?.trim() || r.title,
              author: input.author?.trim() || r.author,
              date: input.date?.trim() || r.date,
              description:
                input.content !== undefined ? input.content : r.description,
              ...(input.attachmentUrl !== undefined
                ? { fileUrl: input.attachmentUrl || "/resources" }
                : {}),
              ...(input.attachmentName !== undefined
                ? { fileName: input.attachmentName || "첨부자료" }
                : {}),
            }
          : r
      ),
    });
  } else if (
    boardKey === "builtin:community" ||
    boardKey.startsWith("builtin:youth:")
  ) {
    const forcedDept: CommunityDepartment | null =
      boardKey === "builtin:youth:sunday"
        ? "유초등부"
        : boardKey === "builtin:youth:teens"
          ? "중고등부"
          : boardKey === "builtin:youth:young-adults"
            ? "청년부"
            : null;
    const current = await getSiteContent();
    await saveSiteContent({
      ...current,
      communityPosts: current.communityPosts.map((c) =>
        c.id === postId
          ? {
              ...c,
              department:
                forcedDept ??
                (input.categoryTag
                  ? coerceCommunityDept(input.categoryTag)
                  : c.department),
              title: input.title?.trim() || c.title,
              author: input.author?.trim() || c.author,
              date: input.date?.trim() || c.date,
              content: input.content !== undefined ? input.content : c.content,
              ...(input.imageUrl !== undefined && input.imageUrl
                ? { imageUrl: input.imageUrl }
                : {}),
              ...(input.attachmentUrl !== undefined
                ? { attachmentUrl: input.attachmentUrl || undefined }
                : {}),
              ...(input.attachmentName !== undefined
                ? { attachmentName: input.attachmentName || undefined }
                : {}),
            }
          : c
      ),
    });
  } else if (boardKey.startsWith("custom:")) {
    const slug = boardKey.slice("custom:".length);
    await withBoardsLock(async () => {
      const store = await readCustomBoardsUnlocked();
      await atomicWriteCustomBoards({
        updatedAt: new Date().toISOString(),
        boards: store.boards.map((b) =>
          b.slug === slug
            ? {
                ...b,
                posts: b.posts.map((p) =>
                  p.id === postId
                    ? {
                        ...p,
                        categoryTag: input.categoryTag?.trim() || p.categoryTag,
                        title: input.title?.trim() || p.title,
                        author: input.author?.trim() || p.author,
                        date: input.date?.trim() || p.date,
                        content:
                          input.content !== undefined ? input.content : p.content,
                        isPinned:
                          typeof input.isPinned === "boolean"
                            ? input.isPinned
                            : p.isPinned,
                        ...(input.imageUrl !== undefined
                          ? { imageUrl: input.imageUrl || undefined }
                          : {}),
                        ...(input.attachmentUrl !== undefined
                          ? { attachmentUrl: input.attachmentUrl || undefined }
                          : {}),
                        ...(input.attachmentName !== undefined
                          ? { attachmentName: input.attachmentName || undefined }
                          : {}),
                      }
                    : p
                ),
              }
            : b
        ),
      });
    });
  } else {
    throw new Error(`지원하지 않는 게시판 식별자입니다: ${boardKey}`);
  }

  const [content, summaries] = await Promise.all([
    getSiteContent(),
    getManagedBoardSummaries(),
  ]);
  return { content, summaries };
}

export async function bulkDeleteManagedPosts(input: {
  readonly boardKey: string;
  readonly postIds: readonly string[];
}): Promise<{
  readonly deletedCount: number;
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  const idSet = new Set(input.postIds.filter(Boolean));
  if (idSet.size === 0) {
    throw new Error("삭제할 게시물을 하나 이상 선택해 주세요.");
  }

  await removePostsFromBoard(input.boardKey, idSet);

  const [content, summaries] = await Promise.all([
    getSiteContent(),
    getManagedBoardSummaries(),
  ]);
  return { deletedCount: idSet.size, content, summaries };
}

export async function moveManagedPosts(input: {
  readonly sourceBoardKey: string;
  readonly targetBoardKey: string;
  readonly postIds: readonly string[];
}): Promise<{
  readonly movedCount: number;
  readonly content: SiteContent;
  readonly summaries: readonly ManagedBoardSummary[];
}> {
  if (input.sourceBoardKey === input.targetBoardKey) {
    throw new Error("현재 게시판과 다른 이동 대상 게시판을 선택해 주세요.");
  }
  const idSet = new Set(input.postIds.filter(Boolean));
  if (idSet.size === 0) {
    throw new Error("이동할 게시물을 하나 이상 선택해 주세요.");
  }

  const allBefore = await getManagedBoardSummaries();
  const sourceSummary = allBefore.find(
    (s) => s.boardKey === input.sourceBoardKey
  );
  const targetSummary = allBefore.find(
    (s) => s.boardKey === input.targetBoardKey
  );
  if (!sourceSummary) {
    throw new Error("원본 게시판을 찾을 수 없습니다.");
  }
  if (!targetSummary) {
    throw new Error("이동할 대상 게시판을 찾을 수 없습니다.");
  }

  const selectedPosts = sourceSummary.posts.filter((p) => idSet.has(p.id));
  if (selectedPosts.length === 0) {
    throw new Error("선택한 게시물을 원본 게시판에서 찾을 수 없습니다.");
  }

  // Write to target board first, then remove from source board
  await insertPostsIntoBoard(input.targetBoardKey, selectedPosts);
  await removePostsFromBoard(
    input.sourceBoardKey,
    new Set(selectedPosts.map((p) => p.id))
  );

  const [content, summaries] = await Promise.all([
    getSiteContent(),
    getManagedBoardSummaries(),
  ]);
  return { movedCount: selectedPosts.length, content, summaries };
}
