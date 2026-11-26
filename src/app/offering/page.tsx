import { AdminEditLink } from "@/components/AdminEditLink";
import { CopyAccountButton } from "@/components/CopyAccountButton";
import { ABOUT_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";
import { stripOfferingAccountPlaceholder } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

const OFFERING_TYPES = [
  { title: "십일조", desc: "수입의 십분의 일을 하나님께 구별하여 드리는 예물입니다." },
  { title: "감사헌금", desc: "하나님의 은혜와 인도하심에 감사하여 드리는 예물입니다." },
  { title: "건축헌금", desc: "예배당 관리 및 성전 사역을 위해 드리는 예물입니다." },
  { title: "선교헌금", desc: "국내외 복음 전파와 선교 사역을 위한 예물입니다." },
  { title: "구제헌금", desc: "어려운 이웃에게 그리스도의 사랑을 나누는 예물입니다." },
  { title: "교육헌금", desc: "다음세대 신앙 양육과 교육 사역을 위한 예물입니다." },
] as const;

export default async function OfferingPage() {
  const content = await getSiteContent();
  const confirmedAccounts = content.offeringAccounts.filter((acc) => {
    const cleaned = stripOfferingAccountPlaceholder(acc.accountNumber);
    return Boolean(cleaned) && !cleaned.includes("000-00");
  });

  return (
    <div>
      <SubpageHero
        englishLabel="Online Offering"
        title="온라인 헌금"
        subtitle="하나님께 드리는 예물을 정성과 믿음으로 올려드립니다"
        bannerImageUrl="https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1800&auto=format&fit=crop&q=80"
        tabs={ABOUT_TABS}
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-14">
        <blockquote className="rounded-2xl bg-[#FFFDE7] border-l-4 border-[#FFC107] p-6 sm:p-8 text-center">
          <p className="text-lg sm:text-xl font-bold text-[#1a2744] mb-2 break-keep">
            &ldquo;각각 그 마음에 정한 대로 할 것이요 인색함으로나 억지로 하지 말지니
            하나님은 즐겨 내는 자를 사랑하시느니라&rdquo;
          </p>
          <p className="text-sm font-bold text-[#2E7D32]">고린도후서 9:7</p>
        </blockquote>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-[#1a2744]">온라인 헌금 계좌 안내</h2>
            <AdminEditLink
              href="/admin?tab=offering"
              className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
            >
              ✎ 실제 교회 계좌번호 등록하기
            </AdminEditLink>
          </div>

          {confirmedAccounts.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {confirmedAccounts.map((acc) => {
                const cleanAccountNumber = stripOfferingAccountPlaceholder(
                  acc.accountNumber
                );
                return (
                  <div
                    key={acc.id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-block px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                        {acc.purpose}
                      </span>
                      <CopyAccountButton
                        textToCopy={`${acc.bankName} ${cleanAccountNumber}`.trim()}
                      />
                    </div>
                    <h3 className="text-lg font-black text-[#1a2744]">
                      {acc.bankName}
                    </h3>
                    <p className="text-lg font-mono font-bold text-[#2E7D32] break-all">
                      {cleanAccountNumber}
                    </p>
                    <p className="text-xs text-gray-500 mt-auto">
                      예금주: {acc.holder}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-[#F8FAF8] p-7 sm:p-8 text-center space-y-2">
              <p className="text-base font-bold text-[#1a2744]">
                온라인 헌금 전용 계좌는 교회 주보 또는 사무실을 통해 안내해 드리고 있습니다.
              </p>
              <p className="text-sm text-gray-600">
                교회 사무실 대표전화: <strong>{content.churchInfo.phone}</strong>
              </p>
            </div>
          )}
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-black text-[#1a2744]">헌금 종류 안내</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {OFFERING_TYPES.map((item) => (
              <div
                key={item.title}
                className="bg-[#F8FAF8] rounded-xl p-5 border border-gray-100"
              >
                <h3 className="font-bold text-[#1a2744] mb-1">{item.title}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[#1a2744] text-white p-7 sm:p-8 space-y-2 text-sm">
          <h3 className="text-base font-bold text-[#6dbf73] mb-2">
            헌금 이체 안내
          </h3>
          <p>• 이체 시 성함과 헌금 종류를 받는 분 통장 표시란에 입력해 주세요. (예: 성함 십일조)</p>
          <p>• 기부금 영수증 발급 관련 문의는 교회 사무실로 연락해 주시기 바랍니다.</p>
          <p>• 문의 전화: {content.churchInfo.phone}</p>
        </section>
      </div>
    </div>
  );
}
