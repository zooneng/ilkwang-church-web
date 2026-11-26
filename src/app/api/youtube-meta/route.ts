import { NextResponse } from "next/server";
import { requireSiteAdminRequest } from "@/lib/admin-auth";
import { extractYoutubeId } from "@/lib/content-store";
import {
  type BulletinSermonService,
  parseYoutubeSermonHeadline,
} from "@/lib/sermon-utils";

export const dynamic = "force-dynamic";

interface ParsedSermonMeta {
  readonly youtubeId: string;
  readonly rawTitle: string;
  readonly parsedTitle: string;
  readonly parsedDate: string | null;
  readonly parsedScripture: string | null;
  readonly parsedPreacher: string | null;
  readonly parsedServiceType: BulletinSermonService;
  readonly authorName: string;
  readonly thumbnailUrl: string;
}

function extractJsonObject(
  str: string,
  startIdx: number
): Record<string, unknown> | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < str.length; i += 1) {
    const ch = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(str.slice(startIdx, i + 1)) as Record<
            string,
            unknown
          >;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function fetchWatchPageDetails(youtubeId: string): Promise<{
  readonly title: string;
  readonly publishIsoDate: string | null;
  readonly author: string;
} | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    const marker = "var ytInitialPlayerResponse = ";
    const idx = html.indexOf(marker);
    if (idx < 0) return null;
    const pr = extractJsonObject(html, idx + marker.length);
    if (!pr) return null;

    const videoDetails = pr.videoDetails as
      | { readonly title?: string; readonly author?: string }
      | undefined;
    const microformat = pr.microformat as
      | {
          readonly playerMicroformatRenderer?: {
            readonly publishDate?: string;
            readonly uploadDate?: string;
          };
        }
      | undefined;
    const rawPub =
      microformat?.playerMicroformatRenderer?.publishDate ??
      microformat?.playerMicroformatRenderer?.uploadDate ??
      "";
    const publishIsoDate = /^\d{4}-\d{2}-\d{2}/.test(rawPub)
      ? rawPub.slice(0, 10)
      : null;

    return {
      title: videoDetails?.title ?? "",
      publishIsoDate,
      author: videoDetails?.author ?? "",
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const denied = requireSiteAdminRequest(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url") ?? "";
    const youtubeId = extractYoutubeId(rawUrl);

    if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
      return NextResponse.json(
        {
          error:
            "유효한 유튜브 영상 주소(URL) 또는 11자리 영상 ID를 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    const watchInfo = await fetchWatchPageDetails(youtubeId);
    let rawTitle = watchInfo?.title ?? "";
    let authorName = watchInfo?.author ?? "";
    let thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

    if (!rawTitle) {
      const canonicalWatchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        canonicalWatchUrl
      )}&format=json`;
      const response = await fetch(oembedEndpoint, { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as {
          readonly title?: string;
          readonly author_name?: string;
          readonly thumbnail_url?: string;
        };
        rawTitle = data.title ?? "";
        authorName = data.author_name ?? "";
        if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
      }
    }

    if (!rawTitle) {
      return NextResponse.json(
        {
          youtubeId,
          rawTitle: "",
          parsedTitle: "",
          parsedDate: watchInfo?.publishIsoDate ?? null,
          parsedScripture: null,
          parsedPreacher: null,
          parsedServiceType: "주일오전예배",
          authorName: "",
          thumbnailUrl,
          warning:
            "영상 ID는 인식되었으나 공개 제목 정보를 가져오지 못했습니다. 제목을 직접 입력해 주세요.",
        },
        { status: 200 }
      );
    }

    const parsed = parseYoutubeSermonHeadline(rawTitle, {
      fallbackIsoDate: watchInfo?.publishIsoDate ?? null,
    });

    const result: ParsedSermonMeta = {
      youtubeId,
      rawTitle,
      parsedTitle: parsed.title,
      parsedDate: parsed.date,
      parsedScripture: parsed.scripture || null,
      parsedPreacher: parsed.preacher || null,
      parsedServiceType: parsed.serviceType,
      authorName,
      thumbnailUrl,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "유튜브 메타데이터 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
