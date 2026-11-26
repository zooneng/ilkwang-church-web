import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { NEWS_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

interface NewsPageProps {
  readonly searchParams: Promise<{ readonly id?: string }>;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = await searchParams;
  const content = await getSiteContent();
  const sortedNotices = [...content.notices].sort(
    (a, b) => Number(b.isPinned) - Number(a.isPinned)
  );
  const activeNotice =
    sortedNotices.find((n) => n.id === params.id) ?? sortedNotices[0];

  return (
    <div>
      <SubpageHero
        englishLabel="Church News"
        title="교회 소식"
        subtitle="일광교회의 주요 공지 사항과 한 주간의 소식을 전해드립니다"
        bannerImageUrl="https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1800&auto=format&fit=crop&q=80"
        tabs={NEWS_TABS}
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[#1a2744]">
              공지 및 교회 소식
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              항목을 클릭하면 아래에서 바로 본문을 열람하실 수 있습니다.
            </p>
          </div>
          <AdminEditLink
            href="/admin?tab=notices"
            className="px-4 py-2 rounded-full bg-[#2E7D32] text-white hover:bg-[#1B5E20] text-xs font-bold transition-colors"
          >
            + 새 공지 작성하기
          </AdminEditLink>
        </div>

        {/* Active Notice Reader */}
        {activeNotice && (
          <article className="bg-[#F8FAF8] rounded-2xl border border-[#2E7D32]/25 p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {activeNotice.isPinned && (
                <span className="px-2.5 py-1 rounded-full bg-[#1a2744] text-white text-xs font-bold">
                  상단고정
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-[#2E7D32] text-white text-xs font-bold">
                {activeNotice.category}
              </span>
              <span className="text-xs text-gray-500">
                {activeNotice.date}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1a2744] break-keep">
              {activeNotice.title}
            </h3>
            <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line break-keep pt-2 border-t border-gray-200">
              {activeNotice.content}
            </p>
            {activeNotice.attachmentUrl && (
              <div className="pt-3 border-t border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-gray-600">
                  첨부파일: {activeNotice.attachmentName ?? "첨부 문서"}
                </span>
                <a
                  href={activeNotice.attachmentUrl}
                  download={activeNotice.attachmentName ?? true}
                  className="px-4 py-2 rounded-full bg-[#1a2744] text-white hover:bg-[#2E7D32] text-xs font-bold transition-colors"
                >
                  첨부파일 다운로드 ↓
                </a>
              </div>
            )}
          </article>
        )}

        {/* Notice Board Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
          <ul className="divide-y divide-gray-100">
            {sortedNotices.length === 0 && (
              <li className="px-6 py-10 text-center text-sm text-gray-500">
                아직 등록된 교회 소식이 없습니다. 매주 소식은{" "}
                <Link
                  href="/news/bulletin"
                  className="font-bold text-[#2E7D32] underline"
                >
                  온라인 주보
                </Link>
                에서 보실 수 있습니다.
              </li>
            )}
            {sortedNotices.map((notice) => {
              const selected = activeNotice?.id === notice.id;
              return (
                <li key={notice.id}>
                  <Link
                    href={`/news?id=${notice.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-4 transition-colors ${
                      selected ? "bg-[#E8F5E9]/60" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {notice.isPinned && (
                        <span className="shrink-0 px-2 py-0.5 rounded bg-[#1a2744] text-white text-xs font-bold">
                          상단고정
                        </span>
                      )}
                      <span className="shrink-0 px-2.5 py-0.5 rounded bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                        {notice.category}
                      </span>
                      <span className="font-bold text-[#1a2744] text-sm sm:text-base truncate">
                        {notice.title}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-400 shrink-0">
                      <span>{notice.date}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
