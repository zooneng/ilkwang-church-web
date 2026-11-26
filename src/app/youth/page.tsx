import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { YOUTH_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";
import {
  matchesYouthDepartment,
  normalizeYouthDepartmentLabel,
} from "@/lib/format-utils";

export const dynamic = "force-dynamic";

function resolveYouthDeptHref(department: string): string {
  if (matchesYouthDepartment(department, "sunday")) {
    return "/youth/sunday#dept-news";
  }
  if (matchesYouthDepartment(department, "teens")) {
    return "/youth/teens#dept-news";
  }
  return "/youth/young-adults#dept-news";
}

export default async function YouthOverviewPage() {
  const content = await getSiteContent();
  const youthNewsPosts = content.communityPosts.filter(
    (p) =>
      matchesYouthDepartment(p.department, "sunday") ||
      matchesYouthDepartment(p.department, "teens") ||
      matchesYouthDepartment(p.department, "young-adults")
  );

  return (
    <div>
      <SubpageHero
        englishLabel="Next Generation"
        title="다음 세대"
        subtitle="오늘의 아이들이 내일의 교회입니다 — 다음 세대를 세우는 일광교회"
        bannerImageUrl="https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1800&auto=format&fit=crop&q=80"
        tabs={YOUTH_TABS}
      />

      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-16">
        <section className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744] mb-4">
            다음 세대를 위한 사명
          </h2>
          <p className="text-gray-600 leading-relaxed break-keep">
            일광교회는 어린이와 청소년, 청년들이 하나님을 인격적으로 만나고
            말씀 위에 굳건히 세워지기를 소망합니다. 각 세대에 맞는 예배와 교육,
            공동체 활동을 통해 신앙의 다음 세대를 든든히 키워가겠습니다.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {content.youthDepartments.map((dept) => (
            <Link
              key={dept.id}
              href={dept.slug}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all p-7 flex flex-col group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{dept.emoji}</span>
                <span className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                  {dept.worshipTime}
                </span>
              </div>
              <h3 className="text-xl font-black text-[#1a2744] group-hover:text-[#2E7D32] transition-colors">
                {dept.title}
              </h3>
              <p className="text-xs font-bold text-[#2E7D32] mt-1 mb-3">
                {dept.targetAge}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mb-6 flex-1 break-keep">
                {dept.intro}
              </p>
              <span className="text-sm font-bold text-[#1a2744] group-hover:text-[#2E7D32]">
                부서 소개 및 소식 보기 →
              </span>
            </Link>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-[#2E7D32]/25 shadow-xs p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#1a2744] text-white text-xs font-bold">
                청년 주거 및 신앙 공동체
              </span>
              <span className="text-xs font-bold text-[#2E7D32]">
                Dormitory Ministry
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1a2744]">
              일광학사관 사역 안내
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed break-keep max-w-2xl">
              서울 지역 대학에 재학하거나 취업을 준비하는 기독교인 청년들이 말씀과 기도의 공동체 안에서 안전하게 생활하며 학업과 진로를 준비하도록 돕는 일광교회 학사관 사역입니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/boards/dormitory"
              className="px-5 py-3 rounded-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs sm:text-sm font-bold transition-colors"
            >
              일광학사관 게시판 및 모집 안내 →
            </Link>
          </div>
        </section>

        {youthNewsPosts.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2E7D32]">
                  DEPARTMENT NEWS
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-[#1a2744] mt-1">
                  다음 세대 부서별 최근 소식
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  각 부서 카드를 누르면 해당 부서 페이지의 소식 나눔 창으로 바로 이동합니다.
                </p>
              </div>
              <AdminEditLink
                href="/admin?tab=community"
                className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
              >
                + 부서 소식 등록·관리
              </AdminEditLink>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {youthNewsPosts.slice(0, 6).map((post) => {
                const deptLabel = normalizeYouthDepartmentLabel(post.department);
                const deptHref = resolveYouthDeptHref(post.department);
                return (
                  <Link
                    key={post.id}
                    href={deptHref}
                    className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
                  >
                    <div className="aspect-[16/10] bg-gray-100 overflow-hidden relative">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {post.youtubeId && (
                        <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[11px] font-bold">
                          ▶ 사역 영상
                        </span>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                          {deptLabel}
                        </span>
                        <span className="text-xs text-gray-400">{post.date}</span>
                      </div>
                      <h3 className="text-base font-black text-[#1a2744] group-hover:text-[#2E7D32] transition-colors mb-2 break-keep">
                        {post.title}
                      </h3>
                      {post.content.trim() && (
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mb-3 break-keep">
                          {post.content}
                        </p>
                      )}
                      <span className="text-xs font-bold text-[#2E7D32] mt-auto">
                        {deptLabel} 창에서 보기 →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="bg-[#F8FAF8] rounded-2xl p-6 sm:p-10 border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-[#1a2744]">
              부서별 예배 시간 및 장소
            </h2>
            <AdminEditLink
              href="/admin?tab=youth"
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-bold text-[#2E7D32] hover:bg-[#E8F5E9]"
            >
              ✎ 다음 세대 부서 정보 편집
            </AdminEditLink>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="py-3.5 px-4">부서</th>
                  <th className="py-3.5 px-4">대상</th>
                  <th className="py-3.5 px-4">예배 시간</th>
                  <th className="py-3.5 px-4">장소</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {content.youthDepartments.map((row) => (
                  <tr key={row.id} className="bg-white/60">
                    <td className="py-4 px-4 font-bold text-[#1a2744]">
                      {row.title}
                    </td>
                    <td className="py-4 px-4 text-gray-600">{row.targetAge}</td>
                    <td className="py-4 px-4 font-semibold text-[#2E7D32]">
                      {row.worshipTime}
                    </td>
                    <td className="py-4 px-4 text-gray-600">{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
