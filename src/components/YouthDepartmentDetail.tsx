import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { YOUTH_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { YouthDepartmentNewsSection } from "@/components/YouthDepartmentNewsSection";
import type { CommunityPost, YouthDepartmentConfig } from "@/types/site-content";

interface YouthDepartmentDetailProps {
  readonly dept: YouthDepartmentConfig;
  readonly posts?: readonly CommunityPost[];
}

export function YouthDepartmentDetail({
  dept,
  posts = [],
}: YouthDepartmentDetailProps) {
  return (
    <div>
      <SubpageHero
        englishLabel={dept.englishLabel}
        title={dept.title}
        subtitle={dept.subtitle}
        bannerImageUrl={dept.bannerImageUrl}
        tabs={YOUTH_TABS}
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 sm:p-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                {dept.targetAge}
              </span>
              <h2 className="text-2xl font-black text-[#1a2744] mt-3">
                {dept.emoji} {dept.title} 소개
              </h2>
            </div>
            <AdminEditLink
              href="/admin?tab=youth"
              className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
            >
              ✎ 부서 시간·장소·안내 편집하기
            </AdminEditLink>
          </div>

          <p className="text-gray-600 leading-relaxed break-keep">
            {dept.intro}
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-3">
            <div className="rounded-xl bg-[#E8F5E9] p-5">
              <p className="text-xs font-bold text-[#2E7D32] mb-1">예배 시간</p>
              <p className="font-black text-[#1a2744] text-sm sm:text-base">
                {dept.worshipTime}
              </p>
            </div>
            <div className="rounded-xl bg-[#F8FAF8] p-5 border border-gray-100">
              <p className="text-xs font-bold text-[#2E7D32] mb-1">예배 장소</p>
              <p className="font-black text-[#1a2744] text-sm sm:text-base">
                {dept.location}
              </p>
            </div>
            <div className="rounded-xl bg-[#F8FAF8] p-5 border border-gray-100">
              <p className="text-xs font-bold text-[#2E7D32] mb-1">섬기는 분들</p>
              <p className="font-black text-[#1a2744] text-sm sm:text-base">
                {dept.directorInfo}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#F8FAF8] rounded-2xl p-7 sm:p-10 border border-gray-100">
          <h3 className="text-xl font-black text-[#1a2744] mb-6">
            주요 사역 및 양육 프로그램
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dept.programs.map((prog) => (
              <div
                key={prog.title}
                className="bg-white rounded-xl p-5 border border-gray-100"
              >
                <h4 className="font-bold text-[#1a2744] mb-1.5">
                  {prog.title}
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {prog.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <YouthDepartmentNewsSection dept={dept} posts={posts} />

        <div className="rounded-2xl bg-[#1a2744] text-white p-8 text-center space-y-3">
          <h3 className="text-xl sm:text-2xl font-black">
            {dept.title} 새가족 안내 및 문의
          </h3>
          <p className="text-sm text-gray-300">
            처음 방문하시는 가정과 청소년, 청년분들을 진심으로 환영합니다.
          </p>
          <Link
            href="/contact"
            className="inline-block px-7 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] rounded-[26px] text-sm font-bold transition-colors"
          >
            온라인 등록 및 문의하기
          </Link>
        </div>
      </div>
    </div>
  );
}
