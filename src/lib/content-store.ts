import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_SITE_CONTENT } from "@/data/default-site-content";
import {
  isCloudStoreEnabled,
  readCloudJson,
  writeCloudJson,
} from "@/lib/cloud-store";
import { extractYoutubeId } from "@/lib/format-utils";
import type { NavCategoryConfig, SiteContent } from "@/types/site-content";

export { extractYoutubeId };

const CLOUD_KEY = "site-content";

function sanitizeNavigation(
  navigation: readonly NavCategoryConfig[]
): readonly NavCategoryConfig[] {
  return navigation.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (sub) =>
        sub.id !== "sub-news-community" &&
        sub.href !== "/blog" &&
        sub.id !== "sub-news-board" &&
        sub.href !== "/resources/board"
    ),
  }));
}

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const CONTENT_FILE_PATH = path.join(DATA_DIRECTORY, "site-content.json");

let contentWriteQueue: Promise<void> = Promise.resolve();

async function atomicWriteJson(
  filePath: string,
  payload: unknown
): Promise<void> {
  if (isCloudStoreEnabled()) {
    await writeCloudJson(CLOUD_KEY, payload);
    return;
  }
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const runWrite = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
    await fs.writeFile(tmpPath, serialized, "utf8");
    await fs.rename(tmpPath, filePath);
  };
  const nextOp = contentWriteQueue.then(runWrite, runWrite);
  contentWriteQueue = nextOp.then(
    () => undefined,
    () => undefined
  );
  await nextOp;
}

async function readBundledSeedSiteContent(): Promise<Partial<SiteContent>> {
  try {
    const raw = await fs.readFile(CONTENT_FILE_PATH, "utf8");
    return JSON.parse(raw) as Partial<SiteContent>;
  } catch {
    return DEFAULT_SITE_CONTENT;
  }
}

async function ensureLocalContentFileExists(): Promise<void> {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  try {
    await fs.access(CONTENT_FILE_PATH);
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
    await atomicWriteJson(CONTENT_FILE_PATH, DEFAULT_SITE_CONTENT);
  }
}

function normalizeSiteContent(parsed: Partial<SiteContent>): SiteContent {
  const rawGallery = Array.isArray(parsed.gallery)
    ? parsed.gallery
    : DEFAULT_SITE_CONTENT.gallery;

  const mergedGallery = rawGallery.map((item) => {
    if (typeof item.showInHeroCube === "boolean") {
      return item;
    }
    return {
      ...item,
      showInHeroCube: item.imageUrl.includes("/c01/cube-"),
    };
  });

  return {
    ...DEFAULT_SITE_CONTENT,
    ...parsed,
    navigation: sanitizeNavigation(
      Array.isArray(parsed.navigation)
        ? parsed.navigation
        : DEFAULT_SITE_CONTENT.navigation
    ),
    topBannerNotices: Array.isArray(parsed.topBannerNotices)
      ? parsed.topBannerNotices
      : DEFAULT_SITE_CONTENT.topBannerNotices,
    churchInfo: {
      ...DEFAULT_SITE_CONTENT.churchInfo,
      ...(parsed.churchInfo ?? {}),
    },
    pastorProfile: {
      ...DEFAULT_SITE_CONTENT.pastorProfile,
      ...(parsed.pastorProfile ?? {}),
    },
    history: Array.isArray(parsed.history)
      ? parsed.history
      : DEFAULT_SITE_CONTENT.history,
    staff: Array.isArray(parsed.staff)
      ? parsed.staff
      : DEFAULT_SITE_CONTENT.staff,
    worshipSchedule: Array.isArray(parsed.worshipSchedule)
      ? parsed.worshipSchedule
      : DEFAULT_SITE_CONTENT.worshipSchedule,
    youthDepartments: Array.isArray(parsed.youthDepartments)
      ? parsed.youthDepartments
      : DEFAULT_SITE_CONTENT.youthDepartments,
    sermons: Array.isArray(parsed.sermons)
      ? parsed.sermons
      : DEFAULT_SITE_CONTENT.sermons,
    notices: Array.isArray(parsed.notices)
      ? parsed.notices
      : DEFAULT_SITE_CONTENT.notices,
    bulletins: Array.isArray(parsed.bulletins)
      ? parsed.bulletins
      : DEFAULT_SITE_CONTENT.bulletins,
    events: Array.isArray(parsed.events)
      ? parsed.events
      : DEFAULT_SITE_CONTENT.events,
    offeringAccounts: Array.isArray(parsed.offeringAccounts)
      ? parsed.offeringAccounts
      : DEFAULT_SITE_CONTENT.offeringAccounts,
    gallery: mergedGallery,
    resources: Array.isArray(parsed.resources)
      ? parsed.resources
      : DEFAULT_SITE_CONTENT.resources,
    communityPosts: Array.isArray(parsed.communityPosts)
      ? parsed.communityPosts
      : DEFAULT_SITE_CONTENT.communityPosts,
  };
}

export async function getSiteContent(): Promise<SiteContent> {
  if (isCloudStoreEnabled()) {
    const cloud = await readCloudJson<Partial<SiteContent>>(CLOUD_KEY);
    if (cloud.found && cloud.value) {
      return normalizeSiteContent(cloud.value);
    }
    const seed = normalizeSiteContent(await readBundledSeedSiteContent());
    await writeCloudJson(CLOUD_KEY, seed);
    return seed;
  }

  await ensureLocalContentFileExists();
  const raw = await fs.readFile(CONTENT_FILE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<SiteContent>;
  return normalizeSiteContent(parsed);
}

export async function saveSiteContent(
  nextContent: SiteContent
): Promise<SiteContent> {
  if (!isCloudStoreEnabled()) {
    await ensureLocalContentFileExists();
  }
  const updated: SiteContent = {
    ...nextContent,
    navigation: sanitizeNavigation(nextContent.navigation),
    updatedAt: new Date().toISOString(),
  };
  await atomicWriteJson(CONTENT_FILE_PATH, updated);
  return updated;
}

export async function resetSiteContent(): Promise<SiteContent> {
  const resetPayload: SiteContent = {
    ...DEFAULT_SITE_CONTENT,
    updatedAt: new Date().toISOString(),
  };
  await atomicWriteJson(CONTENT_FILE_PATH, resetPayload);
  return resetPayload;
}
