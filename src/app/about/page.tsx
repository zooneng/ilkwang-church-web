import { AdminEditLink } from "@/components/AdminEditLink";
import { ABOUT_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

function isConfirmedLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    !trimmed.includes("[관리자 모드") &&
    !trimmed.includes("[확인 필요]")
  );
}

export default async function AboutGreetingPage() {
  const content = await getSiteContent();
  const pastor = content.pastorProfile;

  const confirmedEducation = pastor.education.filter(isConfirmedLine);
  const confirmedCareer = pastor.career.filter((item) =>
    isConfirmedLine(item.label)
  );
  const showBioSection =
    confirmedEducation.length > 0 || confirmedCareer.length > 0;

  return (
    <div>
      <SubpageHero
        englishLabel="Greeting"
        title="담임목사 인사말"
        subtitle="행복과 영원으로 초대하는 일광교회"
        bannerImageUrl="https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1800&auto=format&fit=crop&q=80"
        tabs={ABOUT_TABS}
      />

      {/* Pastor Greeting Section */}
      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-10 sm:py-14 lg:py-20">
        <div className="grid md:grid-cols-2 xl:grid-cols-[2fr_3fr] gap-8 sm:gap-12 xl:gap-20 items-center">
          <div className="relative max-w-md mx-auto w-full md:max-w-none">
            <div className="rounded-2xl overflow-hidden shadow-xl aspect-[4/3] bg-gray-100">
              <img
                src={pastor.photoUrl}
                alt={`담임목사 ${pastor.name}`}
                className="w-full h-full object-cover object-[68%_center]"
              />
            </div>
          </div>

          <div className="space-y-5 text-gray-700 leading-loose text-left md:text-left">
            <h2 className="font-nanum-extrabold text-xl sm:text-2xl text-[#1a2744] break-keep">
              {pastor.greetingTitle}
            </h2>

            {pastor.greetingBody.map((paragraph, idx) => {
              const isHighlightLine =
                paragraph.includes("여기 행복의 길이") ||
                paragraph.includes("여기 영원히 사는 길이");
              if (isHighlightLine) {
                return (
                  <p
                    key={idx}
                    className="font-nanum-extrabold text-[#2E7D32] text-lg break-keep"
                  >
                    {paragraph}
                  </p>
                );
              }
              return (
                <p key={idx} className="whitespace-pre-line break-keep">
                  {paragraph}
                </p>
              );
            })}

            <blockquote className="border-l-4 border-[#FFC107] pl-4 sm:pl-5 py-3.5 bg-[#FFFDE7] rounded-r-lg text-left md:text-left">
              <p className="font-nanum-extrabold text-lg sm:text-xl text-gray-800 break-keep">
                {pastor.bibleQuote}
              </p>
              <p className="text-[#2E7D32] text-sm font-semibold mt-1">
                {pastor.bibleReference}
              </p>
            </blockquote>

            <p className="break-keep">{pastor.closingLine}</p>

            <div className="pt-4">
              <p className="text-gray-500 text-sm">{pastor.roleTitle}</p>
              <p className="font-nanum-extrabold text-2xl text-[#1a2744] mt-1">
                {pastor.displayName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pastor Education & Career Section */}
      {showBioSection && (
        <div className="bg-[#F8FAF8] py-10 sm:py-14 lg:py-16">
          <div className="max-w-[1400px] mx-auto px-5 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
              <h2 className="font-nanum-extrabold text-xl sm:text-2xl text-[#1a2744]">
                {confirmedEducation.length > 0 && confirmedCareer.length > 0
                  ? "학력 및 약력"
                  : confirmedEducation.length > 0
                    ? "학력"
                    : "사역 약력"}
              </h2>
              <AdminEditLink
                href="/admin?tab=pastor-bio"
                className="inline-flex items-center gap-1.5 self-start sm:self-auto px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
              >
                <span>✎ 관리자 모드에서 약력 바로 수정하기</span>
              </AdminEditLink>
            </div>

            <div
              className={`grid gap-6 sm:gap-8 xl:gap-16 ${
                confirmedEducation.length > 0 && confirmedCareer.length > 0
                  ? "md:grid-cols-2"
                  : "md:grid-cols-1 max-w-2xl"
              }`}
            >
              {confirmedEducation.length > 0 && (
                <div className="bg-white rounded-xl p-6 sm:p-7 shadow-sm border border-gray-100">
                  <h3 className="font-nanum-extrabold text-[#2E7D32] mb-4 flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="w-8 h-8 bg-[#2E7D32] text-white rounded-full flex items-center justify-center shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" />
                      </svg>
                    </span>
                    <span>학력</span>
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-700">
                    {confirmedEducation.map((edu, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <span className="text-[#2E7D32] mt-0.5">▸</span>
                        <span>{edu}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {confirmedCareer.length > 0 && (
                <div className="bg-white rounded-xl p-6 sm:p-7 shadow-sm border border-gray-100">
                  <h3 className="font-nanum-extrabold text-[#2E7D32] mb-4 flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="w-8 h-8 bg-[#2E7D32] text-white rounded-full flex items-center justify-center shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </span>
                    <span>경력</span>
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-700">
                    {confirmedCareer.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 ${
                            item.status === "현"
                              ? "text-[#2E7D32]"
                              : "text-gray-400"
                          }`}
                        >
                          ▸
                        </span>
                        <span>
                          <strong
                            className={
                              item.status === "현"
                                ? "text-[#2E7D32] mr-1.5"
                                : "text-gray-500 mr-1.5"
                            }
                          >
                            {item.status})
                          </strong>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
