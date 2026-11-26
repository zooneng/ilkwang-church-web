import type { ChurchUsageSnapshot } from "@/lib/usage-store";

interface AdminUsageMeterProps {
  readonly usage: ChurchUsageSnapshot;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)}GB`;
  }
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)}MB`;
}

function UsageChip({
  label,
  used,
  quota,
}: {
  readonly label: string;
  readonly used: number;
  readonly quota: number;
}) {
  const pct = Math.min(100, Math.max(0, (used / quota) * 100));
  const barColor =
    pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div
      className="flex items-center gap-2"
      title={`${label} ${formatBytes(used)} 사용 중, 무료 한도 ${formatBytes(quota)}`}
    >
      <span className="font-bold text-white/70">{label}</span>
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-white/15">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </span>
      <span className="tabular-nums text-white/90">
        {formatBytes(used)} / {formatBytes(quota)}
        <span className="ml-1 text-white/55">({Math.round(pct)}%)</span>
      </span>
    </div>
  );
}

export function AdminUsageMeter({ usage }: AdminUsageMeterProps) {
  return (
    <div className="bg-[#111a30] text-[11px] text-white/80">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-end gap-x-5 gap-y-1 px-5 py-1.5 sm:px-6">
        <span className="font-black text-white/60">저장 용량</span>
        {usage.ok ? (
          <>
            <UsageChip
              label="데이터베이스"
              used={usage.dbBytes}
              quota={usage.dbQuotaBytes}
            />
            <UsageChip
              label="사진 및 파일"
              used={usage.storageBytes}
              quota={usage.storageQuotaBytes}
            />
          </>
        ) : (
          <span className="font-bold text-amber-300">{usage.error}</span>
        )}
      </div>
    </div>
  );
}
