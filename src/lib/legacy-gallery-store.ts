import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isCloudStoreEnabled,
  readCloudJson,
  writeCloudJson,
} from "@/lib/cloud-store";
import type {
  LegacyGalleryAlbum,
  LegacyGalleryImage,
  LegacyGalleryStoreData,
} from "@/types/site-content";

export class LegacyGalleryInputError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "LegacyGalleryInputError";
    this.statusCode = statusCode;
  }
}

const fileQueues = new Map<string, Promise<void>>();

function getLegacyGalleryFilePath(): string {
  return path.join(process.cwd(), "data", "legacy-gallery.json");
}

async function withFileLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const prev = fileQueues.get(filePath) ?? Promise.resolve();
  const next = prev.then(task, task);
  fileQueues.set(
    filePath,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

const GALLERY_CLOUD_KEY = "legacy-gallery";

async function atomicWriteJsonFile(
  filePath: string,
  payload: unknown
): Promise<void> {
  if (isCloudStoreEnabled()) {
    await writeCloudJson(GALLERY_CLOUD_KEY, payload);
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

export function normalizeAlbumTags(rawTags: unknown): readonly string[] {
  if (!Array.isArray(rawTags)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of rawTags) {
    if (typeof item !== "string") continue;
    const cleaned = item.replace(/^#+/, "").trim();
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(cleaned);
  }
  return result;
}

function sortAlbumsNewestFirst(
  albums: readonly LegacyGalleryAlbum[]
): readonly LegacyGalleryAlbum[] {
  return [...albums].sort((a, b) => {
    const byDate = (b.date || "").localeCompare(a.date || "");
    if (byDate !== 0) return byDate;
    const byDateTime = (b.postDateTime || "").localeCompare(a.postDateTime || "");
    if (byDateTime !== 0) return byDateTime;
    const srlA = Number(a.documentSrl || 0);
    const srlB = Number(b.documentSrl || 0);
    return srlB - srlA;
  });
}

function normalizeStoreData(
  albums: readonly LegacyGalleryAlbum[],
  updatedAt: string
): LegacyGalleryStoreData {
  const normalizedAlbums = sortAlbumsNewestFirst(
    albums.map((album) => {
      const photos = Array.isArray(album.photos) ? album.photos : [];
      const hasValidCover =
        Boolean(album.coverImageUrl) &&
        photos.some((photo) => photo.imageUrl === album.coverImageUrl);
      const normalizedTags = normalizeAlbumTags(album.tags);
      const normalizedContent =
        typeof album.content === "string" ? album.content.trim() : "";
      return {
        ...album,
        content: normalizedContent,
        tags: normalizedTags,
        photos,
        photoCount: photos.length,
        coverImageUrl: hasValidCover
          ? album.coverImageUrl
          : (photos[0]?.imageUrl ?? ""),
      };
    })
  );

  const totalPhotos = normalizedAlbums.reduce(
    (sum, album) => sum + album.photos.length,
    0
  );

  return {
    updatedAt,
    totalAlbums: normalizedAlbums.length,
    totalPhotos,
    albums: normalizedAlbums,
  };
}

async function readBundledGallerySeed(
  filePath: string
): Promise<LegacyGalleryStoreData> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LegacyGalleryStoreData>;
    const rawAlbums = Array.isArray(parsed.albums) ? parsed.albums : [];
    const updatedAt =
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : new Date().toISOString();
    return normalizeStoreData(rawAlbums, updatedAt);
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      totalAlbums: 0,
      totalPhotos: 0,
      albums: [],
    };
  }
}

async function readLegacyGalleryUnlocked(
  filePath: string
): Promise<{ readonly exists: boolean; readonly data: LegacyGalleryStoreData }> {
  if (isCloudStoreEnabled()) {
    const cloud = await readCloudJson<Partial<LegacyGalleryStoreData>>(
      GALLERY_CLOUD_KEY
    );
    if (cloud.found && cloud.value) {
      const rawAlbums = Array.isArray(cloud.value.albums)
        ? cloud.value.albums
        : [];
      const updatedAt =
        typeof cloud.value.updatedAt === "string" ? cloud.value.updatedAt : "";
      return {
        exists: true,
        data: normalizeStoreData(rawAlbums, updatedAt),
      };
    }
    const seeded = await readBundledGallerySeed(filePath);
    await writeCloudJson(GALLERY_CLOUD_KEY, seeded);
    return { exists: true, data: seeded };
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LegacyGalleryStoreData>;
    const rawAlbums = Array.isArray(parsed.albums) ? parsed.albums : [];
    const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : "";
    return {
      exists: true,
      data: normalizeStoreData(rawAlbums, updatedAt),
    };
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        exists: false,
        data: {
          updatedAt: "",
          totalAlbums: 0,
          totalPhotos: 0,
          albums: [],
        },
      };
    }
    throw error;
  }
}

export async function getLegacyGalleryData(): Promise<LegacyGalleryStoreData> {
  const filePath = getLegacyGalleryFilePath();
  return withFileLock(filePath, async () => {
    const { data } = await readLegacyGalleryUnlocked(filePath);
    return data;
  });
}

export async function createGalleryAlbum(input: {
  readonly title: string;
  readonly content?: string;
  readonly date: string;
  readonly tags?: readonly string[];
  readonly photos: readonly {
    readonly imageUrl: string;
    readonly caption?: string;
  }[];
}): Promise<LegacyGalleryStoreData> {
  const title = input.title.trim();
  if (!title) {
    throw new LegacyGalleryInputError("앨범 제목을 입력해 주세요.", 400);
  }
  const content = (input.content ?? "").trim();
  const date = input.date.trim();
  if (!date) {
    throw new LegacyGalleryInputError("게시일(YYYY-MM-DD)을 입력해 주세요.", 400);
  }
  const validPhotos: LegacyGalleryImage[] = input.photos
    .filter((p) => typeof p.imageUrl === "string" && p.imageUrl.trim().length > 0)
    .map((p, idx) => ({
      id: `alb-img-${randomUUID().slice(0, 8)}-${idx + 1}`,
      imageUrl: p.imageUrl.trim(),
      caption: (p.caption ?? "").trim() || `${title} (${idx + 1})`,
    }));

  if (validPhotos.length === 0) {
    throw new LegacyGalleryInputError(
      "앨범에 등록할 사진을 최소 1장 이상 선택해 주세요.",
      400
    );
  }

  const yearMatch = date.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  const nowIso = new Date().toISOString();
  const createdAlbum: LegacyGalleryAlbum = {
    id: `album-new-${randomUUID().slice(0, 8)}`,
    board: "gallery",
    title,
    content,
    date,
    postDateTime: `${date} ${nowIso.slice(11, 16)}`,
    year,
    eventYear: year,
    tags: normalizeAlbumTags(input.tags ?? []),
    coverImageUrl: validPhotos[0].imageUrl,
    photoCount: validPhotos.length,
    isVisible: true,
    photos: validPhotos,
  };

  const filePath = getLegacyGalleryFilePath();
  return withFileLock(filePath, async () => {
    const { data } = await readLegacyGalleryUnlocked(filePath);
    const nextStore = normalizeStoreData(
      [createdAlbum, ...data.albums],
      nowIso
    );
    await atomicWriteJsonFile(filePath, nextStore);
    return nextStore;
  });
}

export async function updateLegacyAlbum(
  albumId: string,
  patch: {
    readonly title?: string;
    readonly content?: string;
    readonly date?: string;
    readonly tags?: readonly string[];
    readonly isVisible?: boolean;
    readonly coverImageUrl?: string;
  }
): Promise<LegacyGalleryStoreData> {
  const trimmedId = albumId.trim();
  if (!trimmedId) {
    throw new LegacyGalleryInputError("수정할 앨범 ID가 필요합니다.", 400);
  }

  const filePath = getLegacyGalleryFilePath();
  return withFileLock(filePath, async () => {
    const { exists, data } = await readLegacyGalleryUnlocked(filePath);
    if (!exists) {
      throw new LegacyGalleryInputError(
        "앨범 데이터 파일이 아직 준비되지 않았습니다.",
        404
      );
    }

    const targetExists = data.albums.some((album) => album.id === trimmedId);
    if (!targetExists) {
      throw new LegacyGalleryInputError("해당 앨범을 찾을 수 없습니다.", 404);
    }

    const nextAlbums = data.albums.map((album) => {
      if (album.id !== trimmedId) {
        return album;
      }

      const nextTitle =
        patch.title !== undefined ? patch.title.trim() : album.title;
      const nextContent =
        patch.content !== undefined
          ? patch.content.trim()
          : (album.content ?? "");
      const nextDate =
        patch.date !== undefined ? patch.date.trim() : album.date;
      const yearMatch = nextDate.match(/\b((?:19|20)\d{2})\b/);
      const nextYear = yearMatch ? yearMatch[1] : album.year;
      const titleYearMatch =
        patch.title !== undefined
          ? nextTitle.match(/\b((?:19|20)\d{2})\b/)
          : null;
      const nextEventYear = titleYearMatch
        ? titleYearMatch[1]
        : (album.eventYear ?? nextYear);
      const nextTags =
        patch.tags !== undefined
          ? normalizeAlbumTags(patch.tags)
          : normalizeAlbumTags(album.tags);
      const nextVisible =
        patch.isVisible !== undefined ? patch.isVisible : album.isVisible;
      const nextCover =
        patch.coverImageUrl !== undefined
          ? patch.coverImageUrl.trim()
          : album.coverImageUrl;

      return {
        ...album,
        title: nextTitle,
        content: nextContent,
        date: nextDate,
        year: nextYear,
        eventYear: nextEventYear,
        tags: nextTags,
        isVisible: nextVisible,
        coverImageUrl: nextCover,
      };
    });

    const nextStore = normalizeStoreData(nextAlbums, new Date().toISOString());
    await atomicWriteJsonFile(filePath, nextStore);
    return nextStore;
  });
}

export async function addPhotosToAlbum(
  albumId: string,
  newPhotos: readonly { readonly imageUrl: string; readonly caption?: string }[]
): Promise<LegacyGalleryStoreData> {
  const trimmedAlbumId = albumId.trim();
  if (!trimmedAlbumId) {
    throw new LegacyGalleryInputError("대상 앨범 ID가 필요합니다.", 400);
  }

  const filePath = getLegacyGalleryFilePath();
  return withFileLock(filePath, async () => {
    const { exists, data } = await readLegacyGalleryUnlocked(filePath);
    if (!exists) {
      throw new LegacyGalleryInputError(
        "앨범 데이터 파일이 아직 준비되지 않았습니다.",
        404
      );
    }

    const targetAlbum = data.albums.find((album) => album.id === trimmedAlbumId);
    if (!targetAlbum) {
      throw new LegacyGalleryInputError("해당 앨범을 찾을 수 없습니다.", 404);
    }

    const prepared: LegacyGalleryImage[] = newPhotos
      .filter((p) => typeof p.imageUrl === "string" && p.imageUrl.trim().length > 0)
      .map((p, idx) => ({
        id: `alb-img-${randomUUID().slice(0, 8)}-${idx + 1}`,
        imageUrl: p.imageUrl.trim(),
        caption:
          (p.caption ?? "").trim() ||
          `${targetAlbum.title} (${targetAlbum.photos.length + idx + 1})`,
      }));

    if (prepared.length === 0) {
      throw new LegacyGalleryInputError("추가할 유효한 사진이 없습니다.", 400);
    }

    const nextAlbums = data.albums.map((album) => {
      if (album.id !== trimmedAlbumId) {
        return album;
      }
      const mergedPhotos = [...album.photos, ...prepared];
      return {
        ...album,
        photos: mergedPhotos,
        photoCount: mergedPhotos.length,
        coverImageUrl: album.coverImageUrl || mergedPhotos[0]?.imageUrl || "",
      };
    });

    const nextStore = normalizeStoreData(nextAlbums, new Date().toISOString());
    await atomicWriteJsonFile(filePath, nextStore);
    return nextStore;
  });
}

export async function deleteLegacyAlbumPhoto(
  albumId: string,
  photoId: string
): Promise<LegacyGalleryStoreData> {
  const trimmedAlbumId = albumId.trim();
  const trimmedPhotoId = photoId.trim();
  if (!trimmedAlbumId || !trimmedPhotoId) {
    throw new LegacyGalleryInputError(
      "삭제할 앨범 ID와 사진 ID가 모두 필요합니다.",
      400
    );
  }

  const filePath = getLegacyGalleryFilePath();
  return withFileLock(filePath, async () => {
    const { exists, data } = await readLegacyGalleryUnlocked(filePath);
    if (!exists) {
      throw new LegacyGalleryInputError(
        "앨범 데이터 파일이 아직 준비되지 않았습니다.",
        404
      );
    }

    const targetAlbum = data.albums.find((album) => album.id === trimmedAlbumId);
    if (!targetAlbum) {
      throw new LegacyGalleryInputError("해당 앨범을 찾을 수 없습니다.", 404);
    }

    const photoExists = targetAlbum.photos.some(
      (photo) => photo.id === trimmedPhotoId
    );
    if (!photoExists) {
      throw new LegacyGalleryInputError(
        "삭제할 사진을 해당 앨범에서 찾을 수 없습니다.",
        404
      );
    }

    const nextAlbums = data.albums.map((album) => {
      if (album.id !== trimmedAlbumId) {
        return album;
      }
      const remainingPhotos = album.photos.filter(
        (photo) => photo.id !== trimmedPhotoId
      );
      const nextCover = remainingPhotos.some(
        (photo) => photo.imageUrl === album.coverImageUrl
      )
        ? album.coverImageUrl
        : (remainingPhotos[0]?.imageUrl ?? "");

      return {
        ...album,
        photos: remainingPhotos,
        photoCount: remainingPhotos.length,
        coverImageUrl: nextCover,
      };
    });

    const nextStore = normalizeStoreData(nextAlbums, new Date().toISOString());
    await atomicWriteJsonFile(filePath, nextStore);
    return nextStore;
  });
}

export async function deleteGalleryAlbum(
  albumId: string
): Promise<LegacyGalleryStoreData> {
  const trimmedId = albumId.trim();
  if (!trimmedId) {
    throw new LegacyGalleryInputError("삭제할 앨범 ID가 필요합니다.", 400);
  }

  const filePath = getLegacyGalleryFilePath();
  return withFileLock(filePath, async () => {
    const { exists, data } = await readLegacyGalleryUnlocked(filePath);
    if (!exists) {
      throw new LegacyGalleryInputError(
        "앨범 데이터 파일이 아직 준비되지 않았습니다.",
        404
      );
    }
    const targetExists = data.albums.some((album) => album.id === trimmedId);
    if (!targetExists) {
      throw new LegacyGalleryInputError("삭제할 앨범을 찾을 수 없습니다.", 404);
    }
    const nextAlbums = data.albums.filter((album) => album.id !== trimmedId);
    const nextStore = normalizeStoreData(nextAlbums, new Date().toISOString());
    await atomicWriteJsonFile(filePath, nextStore);
    return nextStore;
  });
}
