import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { NEWS_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";
import {
  CANONICAL_RESOURCE_CATEGORIES,
  extractFileFormatBadge,
  normalizeResourceCategory,
} from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const content = await getSiteContent();

  const groupedSections = CANONICAL_RESOURCE_CATEGORIES.map((category) => ({
    category,
    items: content.resources.filter(
      (item) => normalizeResourceCategory(item.category) === category
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="bg-[#FAFAFA] min-h-screen">
      <SubpageHero
        englishLabel="RESOURCES"
        title="교재 자료"
        subtitle="각 부서 교재와 성경 공부 자료를 다운로드하세요"
        bannerImageUrl="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1800&auto=format&fit=crop&q=80"
        tabs={NEWS_TABS}
      />

      {/* Categorized White Section Cards (Matching ilkwang.org/resources) */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {groupedSections.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-10 text-center text-sm text-gray-500">
            등록된 교재 자료가 없습니다.
          </div>
        )}
        {groupedSections.map((section) => (
          <section key={section.category}>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-gray-900">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="w-5 h-5 text-[#2E7D32] shrink-0"
                >
                  <path d="M12 7v14" />
                  <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
                </svg>
                <span>{section.category}</span>
              </h2>
            </div>

            {section.items.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
                등록된 {section.category} 항목이 없습니다.
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {section.items.map((item) => {
                  const formatBadge = extractFileFormatBadge(item.fileName);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="w-5 h-5 text-gray-400 group-hover:text-[#2E7D32] transition-colors shrink-0"
                        >
                          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                          <path d="M10 9H8" />
                          <path d="M16 13H8" />
                          <path d="M16 17H8" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-medium text-gray-800 group-hover:text-[#2E7D32] transition-colors break-keep">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.date} · {formatBadge} · {item.fileSizeLabel}
                          </p>
                        </div>
                      </div>

                      <a
                        href={item.fileUrl}
                        download={item.fileName}
                        className="shrink-0 flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#2E7D32] hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="w-4 h-4"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                        <span>다운로드</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}

        {/* Bottom Info Guidance Box (Matching ilkwang.org/resources) */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-5 sm:p-6 text-sm text-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="w-5 h-5 text-[#2E7D32] shrink-0 mt-0.5 sm:mt-0"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <p className="leading-relaxed break-keep">
              <strong className="font-bold text-gray-800">자료 요청 안내:</strong>{" "}
              목록에 없는 자료가 필요하시면{" "}
              <Link
                href="/contact"
                className="font-bold text-[#2E7D32] underline underline-offset-2 hover:text-[#1B5E20]"
              >
                문의하기
              </Link>
              로 연락 주시거나 교회 사무실({content.churchInfo.phone})로 문의해 주세요.
            </p>
          </div>

          <AdminEditLink
            href="/admin?tab=resources"
            className="shrink-0 self-end sm:self-center text-xs font-bold text-[#2E7D32] hover:underline whitespace-nowrap"
          >
            + 교재 자료 관리
          </AdminEditLink>
        </div>
      </div>
    </div>
  );
}
