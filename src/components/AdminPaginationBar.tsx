"use client";

interface AdminPaginationBarProps {
  readonly currentPage: number;
  readonly totalItems: number;
  readonly pageSize: number;
  readonly onPageChange: (nextPage: number) => void;
  readonly onPageSizeChange?: (nextSize: number) => void;
  readonly itemUnit?: string;
}

export function AdminPaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemUnit = "건",
}: AdminPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(totalItems, safePage * pageSize);

  // Build compact page window (up to 5 buttons around safePage)
  const pages: number[] = [];
  const half = 2;
  let winStart = Math.max(1, safePage - half);
  const winEnd = Math.min(totalPages, winStart + 4);
  winStart = Math.max(1, winEnd - 4);
  for (let p = winStart; p <= winEnd; p += 1) {
    pages.push(p);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
      <div className="flex flex-wrap items-center gap-2.5 text-gray-500">
        <span>
          전체 <strong className="text-[#1a2744]">{totalItems}</strong>
          {itemUnit} 중{" "}
          <strong className="text-[#1a2744]">
            {startIdx}–{endIdx}
          </strong>{" "}
          표시
        </span>
        {onPageSizeChange && (
          <select
            aria-label="페이지당 표시 개수"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-700"
          >
            <option value={10}>10개씩 보기</option>
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
          </select>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            ◀ 이전
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-[30px] px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                p === safePage
                  ? "bg-[#1a2744] text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-[#2E7D32]"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            다음 ▶
          </button>
        </div>
      )}
    </div>
  );
}
