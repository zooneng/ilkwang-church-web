import { AdminEditLink } from "@/components/AdminEditLink";
import { ABOUT_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";
import { parseStaffDepartments } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

const DEFAULT_BIO_PLACEHOLDER = "사역 소개 문구를 입력해 주세요.";

export default async function AboutStaffPage() {
  const content = await getSiteContent();

  return (
    <div>
      <SubpageHero
        englishLabel="Our Team"
        title="섬기는 사람들"
        subtitle="일광교회를 함께 섬기는 교역자 및 사역자를 소개합니다"
        bannerImageUrl="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1800&auto=format&fit=crop&q=80"
        tabs={ABOUT_TABS}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="relative flex flex-col sm:flex-row items-center justify-center mb-8 sm:mb-12 gap-3">
          <p className="text-center text-gray-500 text-sm sm:text-base break-keep">
            일광교회를 함께 섬기는 교역자 및 사역자를 소개합니다.
          </p>
          <AdminEditLink
            href="/admin?tab=staff"
            className="sm:absolute sm:right-0 px-3.5 py-1.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
          >
            ✎ 섬기는 사람들 편집하기
          </AdminEditLink>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {content.staff
            .filter((person) => person.name.trim() !== "새 교역자")
            .map((person) => {
            const ministryTags = parseStaffDepartments(person);
            const trimmedBio = person.description.trim();
            const hasCustomBio =
              Boolean(trimmedBio) && trimmedBio !== DEFAULT_BIO_PLACEHOLDER;

            return (
              <div
                key={person.id}
                className="flex flex-col items-center text-center bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200/90 hover:border-[#2E7D32] hover:shadow-md transition-all"
              >
                {person.photoUrl ? (
                  <div className="w-[116px] sm:w-[132px] aspect-[3/4] rounded-xl overflow-hidden bg-[#F8FAF8] border border-gray-200 shadow-xs mb-4 shrink-0">
                    <img
                      src={person.photoUrl}
                      alt={person.name}
                      className={`w-full h-full object-cover ${
                        person.photoUrl === "/pastor.png"
                          ? "object-[68%_20%]"
                          : "object-center"
                      }`}
                    />
                  </div>
                ) : (
                  <div className="w-[116px] sm:w-[132px] aspect-[3/4] rounded-xl bg-[#F8FAF8] border-2 border-dashed border-gray-300 flex items-center justify-center mb-4 shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-12 h-12 text-gray-300"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M5 20a7 7 0 0 1 14 0" />
                    </svg>
                  </div>
                )}

                <h3 className="text-base sm:text-[17px] font-black text-[#1a2744] leading-snug break-keep">
                  {person.name}
                </h3>

                {person.role && (
                  <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[11px] font-bold">
                    {person.role}
                  </span>
                )}

                {ministryTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                    {ministryTags.map((tag) => (
                      <span
                        key={`${person.id}-tag-${tag}`}
                        className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155] text-[11px] font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {hasCustomBio && (
                  <p className="mt-3 pt-2.5 border-t border-gray-100 text-xs text-gray-500 leading-relaxed break-keep w-full">
                    {trimmedBio}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
