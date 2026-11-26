const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"] as const;

export function isVideoAssetUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  const cleanPath = rawUrl.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  return VIDEO_EXTENSIONS.some((ext) => cleanPath.endsWith(ext));
}

export async function readJsonResponseSafe<T>(
  response: Response,
  fallbackErrorMessage = "서버 응답을 처리하지 못했습니다."
): Promise<T> {
  const rawText = await response.text();

  if (
    response.status === 413 ||
    rawText.includes("Request Entity Too Large") ||
    rawText.includes("FUNCTION_PAYLOAD_TOO_LARGE")
  ) {
    throw new Error(
      "파일 용량이 웹 서버 기본 한도를 초과했습니다. 대용량 직접 업로드 경로로 다시 시도해 주세요."
    );
  }

  if (!rawText.trim()) {
    if (!response.ok) {
      throw new Error(`${fallbackErrorMessage} (HTTP ${response.status})`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    if (!response.ok) {
      throw new Error(`${fallbackErrorMessage} (HTTP ${response.status})`);
    }
    throw new Error(fallbackErrorMessage);
  }
}
