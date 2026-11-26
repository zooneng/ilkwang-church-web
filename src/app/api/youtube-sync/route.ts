import { NextResponse } from "next/server";
import { requireSiteAdminRequest } from "@/lib/admin-auth";
import { parseYoutubeSermonHeadline } from "@/lib/sermon-utils";
import type { SermonItem } from "@/types/site-content";

export const dynamic = "force-dynamic";

const CHANNEL_VIDEOS_URL = "https://www.youtube.com/@ilkwangucc/videos";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NON_SERMON_TITLE_RE =
  /(찬양대|성가대|특송|찬양율동|가족찬양제|성탄동영상|워십|율동|발표회|축하영상|찬양제|헌금송|봉헌송|특주|중창|독창|합창|연주|꽁트|촌극|성극|연극|사임인사|유치부\s*인사|홍보영상|스케치)/i;

interface RawChannelVideo {
  readonly videoId: string;
  readonly title: string;
  readonly durationSec: number;
}

function parseDurationSeconds(dur: string): number {
  if (!dur) return 0;
  const parts = dur.trim().split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function collectVideosFromInitialData(node: unknown, out: RawChannelVideo[]): void {
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;

  const richContent = (
    rec.richItemRenderer as { readonly content?: Record<string, unknown> } | undefined
  )?.content;

  if (richContent?.lockupViewModel) {
    const l = richContent.lockupViewModel as {
      readonly contentId?: string;
      readonly metadata?: {
        readonly lockupMetadataViewModel?: {
          readonly title?: { readonly content?: string };
        };
      };
      readonly contentImage?: {
        readonly thumbnailViewModel?: {
          readonly overlays?: readonly {
            readonly thumbnailBottomOverlayViewModel?: {
              readonly badges?: readonly {
                readonly thumbnailBadgeViewModel?: { readonly text?: string };
              }[];
            };
          }[];
        };
      };
    };
    const videoId = l.contentId ?? "";
    const title = l.metadata?.lockupMetadataViewModel?.title?.content ?? "";
    const dur =
      l.contentImage?.thumbnailViewModel?.overlays?.[0]
        ?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel
        ?.text ?? "";
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId) && title) {
      out.push({
        videoId,
        title,
        durationSec: parseDurationSeconds(dur),
      });
    }
    return;
  }

  if (richContent?.videoRenderer) {
    const v = richContent.videoRenderer as {
      readonly videoId?: string;
      readonly title?: {
        readonly runs?: readonly { readonly text?: string }[];
        readonly simpleText?: string;
      };
      readonly lengthText?: { readonly simpleText?: string };
    };
    const videoId = v.videoId ?? "";
    const title =
      v.title?.runs?.map((r) => r.text ?? "").join("") ??
      v.title?.simpleText ??
      "";
    const dur = v.lengthText?.simpleText ?? "";
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId) && title) {
      out.push({
        videoId,
        title,
        durationSec: parseDurationSeconds(dur),
      });
    }
    return;
  }

  for (const val of Object.values(rec)) {
    if (Array.isArray(val)) {
      for (const item of val) collectVideosFromInitialData(item, out);
    } else if (val && typeof val === "object") {
      collectVideosFromInitialData(val, out);
    }
  }
}

async function fetchPublishDateForVideo(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      readonly existingYoutubeIds?: readonly string[];
    };
    const existingSet = new Set(
      Array.isArray(body.existingYoutubeIds) ? body.existingYoutubeIds : []
    );

    const res = await fetch(CHANNEL_VIDEOS_URL, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "유튜브 채널 목록을 불러오지 못했습니다." },
        { status: 502 }
      );
    }

    const html = await res.text();
    const marker = "var ytInitialData = ";
    const start = html.indexOf(marker);
    const end = start >= 0 ? html.indexOf(";</script>", start + marker.length) : -1;
    if (start < 0 || end < 0) {
      return NextResponse.json(
        { error: "유튜브 채널 데이터를 해석하지 못했습니다." },
        { status: 502 }
      );
    }

    const data = JSON.parse(html.slice(start + marker.length, end)) as unknown;
    const rawVideos: RawChannelVideo[] = [];
    collectVideosFromInitialData(data, rawVideos);

    const newSermons: SermonItem[] = [];
    for (const v of rawVideos) {
      if (existingSet.has(v.videoId)) continue;
      if (NON_SERMON_TITLE_RE.test(v.title) && !/설교/.test(v.title)) continue;
      if (v.durationSec > 0 && v.durationSec < 660 && !/설교/.test(v.title)) {
        continue;
      }

      const prelim = parseYoutubeSermonHeadline(v.title);
      let finalDate = prelim.date;
      if (!finalDate) {
        finalDate = await fetchPublishDateForVideo(v.videoId);
      }
      const parsed = finalDate
        ? parseYoutubeSermonHeadline(v.title, { fallbackIsoDate: finalDate })
        : prelim;

      newSermons.push({
        id: `yt-${v.videoId}`,
        title: parsed.title,
        scripture: parsed.scripture,
        preacher: parsed.preacher,
        date: parsed.date ?? new Date().toISOString().slice(0, 10),
        serviceType: parsed.serviceType,
        youtubeId: v.videoId,
      });
    }

    return NextResponse.json({ newSermons });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "유튜브 채널 동기화 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
