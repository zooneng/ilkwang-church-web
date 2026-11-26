import { callCloudRpc, isCloudStoreEnabled } from "@/lib/cloud-store";

// Supabase Free plan quotas (database size and file storage).
export const DB_QUOTA_BYTES = 500 * 1024 * 1024;
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

export type ChurchUsageSnapshot =
  | {
      readonly ok: true;
      readonly dbBytes: number;
      readonly storageBytes: number;
      readonly storageObjects: number;
      readonly dbQuotaBytes: number;
      readonly storageQuotaBytes: number;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

interface UsageRpcResult {
  readonly db_bytes: number;
  readonly storage_bytes: number;
  readonly storage_objects: number;
}

export async function getChurchUsageSnapshot(): Promise<ChurchUsageSnapshot> {
  if (!isCloudStoreEnabled()) {
    return { ok: false, error: "클라우드 저장소 미연결" };
  }
  try {
    const result = await callCloudRpc<UsageRpcResult>("church_usage_stats");
    return {
      ok: true,
      dbBytes: Number(result.db_bytes),
      storageBytes: Number(result.storage_bytes),
      storageObjects: Number(result.storage_objects),
      dbQuotaBytes: DB_QUOTA_BYTES,
      storageQuotaBytes: STORAGE_QUOTA_BYTES,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[usage-store] church_usage_stats failed:", message);
    return { ok: false, error: "용량 조회 실패" };
  }
}
