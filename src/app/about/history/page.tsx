import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { ABOUT_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function AboutHistoryPage() {
  const content = await getSiteContent();

  return (
    <div>
      <SubpageHero
        englishLabel="History"
        title="교회 역사"
        subtitle="1971년부터 지금까지 — 하나님의 신실하심으로 걸어온 발자취"
        bannerImageUrl="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1800&auto=format&fit=crop&q=80"
        tabs={ABOUT_TABS}
      />

      <div className="max-w-[1000px] mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <div className="flex items-center justify-end mb-6">
          <AdminEditLink
            href="/admin?tab=history"
            className="px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
          >
            ✎ 연혁 및 원본 사료 관리
          </AdminEditLink>
        </div>

        <div className="relative border-l-2 border-[#2E7D32]/30 ml-4 sm:ml-8 space-y-10 pl-7 sm:pl-10">
          {content.history.map((item) => (
            <div key={item.id} className="relative">
              <span className="absolute -left-[37px] sm:-left-[49px] top-1.5 w-4 h-4 rounded-full bg-[#2E7D32] ring-4 ring-[#E8F5E9]" />
              <span className="inline-block px-3 py-1 rounded-full bg-[#1a2744] text-white text-xs font-black tracking-wider mb-2">
                {item.year}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-[#1a2744] mb-1.5 break-keep">
                {item.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed break-keep">
                {item.description}
              </p>

              {item.imageUrl && (
                <figure className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs max-w-lg space-y-2.5">
                  <a
                    href={item.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.imageCaption || item.title}
                      className="max-h-72 w-auto mx-auto object-contain"
                    />
                  </a>
                  <figcaption className="flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700 break-keep">
                      {item.imageCaption || `${item.year} 사료 원본 이미지`}
                    </span>
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-bold text-[#2E7D32] hover:underline"
                    >
                      원본 크게 보기 ↗
                    </a>
                  </figcaption>
                </figure>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl bg-[#F8FAF8] p-8 text-center border border-gray-100 space-y-5">
          <p className="text-[#1a2744] font-bold text-base sm:text-lg leading-relaxed break-keep">
            일광교회는 반세기가 넘는 역사 속에서 오직 하나님의 은혜로 성장해
            왔습니다.
            <br />
            앞으로도 말씀과 기도, 전도와 선교의 사명을 붙잡고 다음 세대에게 귀한
            신앙의 유산을 전수하겠습니다.
          </p>
          <div>
            <Link
              href="/news/gallery"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#1a2744] hover:bg-[#2E7D32] text-white text-xs sm:text-sm font-bold transition-colors"
            >
              교회 앨범 보러가기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
