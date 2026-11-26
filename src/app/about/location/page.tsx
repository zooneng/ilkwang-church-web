import { CopyAccountButton } from "@/components/CopyAccountButton";
import { ABOUT_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function AboutLocationPage() {
  const content = await getSiteContent();
  const info = content.churchInfo;
  const encodedAddr = encodeURIComponent(info.address);
  const googleEmbedUrl = `https://maps.google.com/maps?q=${encodedAddr}&hl=ko&z=17&output=embed`;
  const naverMapUrl = `https://map.naver.com/p/search/${encodedAddr}`;
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodedAddr}`;
  const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddr}`;

  return (
    <div>
      <SubpageHero
        englishLabel="Location"
        title="오시는 길"
        subtitle={`${info.address} — 4호선 길음역 인근`}
        bannerImageUrl="https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1800&auto=format&fit=crop&q=80"
        tabs={ABOUT_TABS}
      />

      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="grid lg:grid-cols-[1.28fr_0.72fr] gap-8 items-stretch">
          {/* Compact Google Maps Card & One-Click Navigation Launcher */}
          <div className="rounded-2xl overflow-hidden shadow-md border border-gray-200 bg-white flex flex-col">
            <div className="relative flex-1 bg-[#F4F7F5] p-5 sm:p-6 flex flex-col justify-between gap-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a2744] text-white text-xs font-bold">
                  <span>일광교회 위치 지도</span>
                </span>
                <span className="text-xs font-semibold text-[#2E7D32] bg-[#E8F5E9] px-3 py-1 rounded-full">
                  {info.subwayGuide}
                </span>
              </div>

              {/* Google Maps Embed replacing the former SVG schematic range */}
              <div className="flex-1 min-h-[260px] sm:min-h-[300px] rounded-2xl overflow-hidden border border-gray-200/90 bg-gray-200 shadow-2xs relative z-10">
                <iframe
                  src={googleEmbedUrl}
                  title="일광교회 지도"
                  width="100%"
                  height="100%"
                  className="w-full h-full min-h-[260px] sm:min-h-[300px] block"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              {/* Action Bar: Naver Map, KakaoMap, Google Maps */}
              <div className="space-y-2.5 relative z-10">
                <p className="text-xs text-gray-500">
                  모바일이나 PC에서 자주 쓰시는 지도 앱을 누르면 일광교회 위치와 실시간 길찾기가 바로 열립니다.
                </p>
                <div className="grid sm:grid-cols-3 gap-2.5">
                  <a
                    href={naverMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-[#03C75A] hover:bg-[#02b351] text-white text-xs sm:text-sm font-black text-center shadow-xs transition-colors"
                  >
                    네이버 지도 길찾기 ↗
                  </a>
                  <a
                    href={kakaoMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-[#FEE500] hover:bg-[#f4dc00] text-[#191919] text-xs sm:text-sm font-black text-center shadow-xs transition-colors"
                  >
                    카카오맵 길찾기 ↗
                  </a>
                  <a
                    href={googleMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-[#1a2744] hover:bg-[#0b1320] text-white text-xs sm:text-sm font-bold text-center shadow-xs transition-colors"
                  >
                    구글 지도 열기 ↗
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Address & Transit Cards */}
          <div className="space-y-4">
            <div className="bg-[#E8F5E9] rounded-2xl p-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-[#1a2744] text-base">
                  📍 도로명 주소
                </h3>
                <CopyAccountButton
                  textToCopy={info.address}
                  label="주소 복사"
                />
              </div>
              <p className="text-sm sm:text-base text-gray-800 font-bold">
                {info.address}
              </p>
              <p className="text-xs text-gray-600">
                우편번호: {info.postalCode}
              </p>
            </div>

            <div className="bg-[#F8FAF8] rounded-2xl p-6 border border-gray-100">
              <h3 className="font-black text-[#1a2744] text-base mb-2">
                📞 연락처
              </h3>
              <a
                href={`tel:${info.phone}`}
                className="text-lg font-black text-[#2E7D32] hover:underline"
              >
                {info.phone}
              </a>
              <p className="text-xs text-gray-500 mt-1">{info.email}</p>
            </div>

            <div className="bg-[#F8FAF8] rounded-2xl p-6 border border-gray-100 space-y-3">
              <h3 className="font-black text-[#1a2744] text-base">
                🚇 대중교통 안내
              </h3>
              <div>
                <p className="text-xs font-bold text-[#2E7D32]">지하철</p>
                <p className="text-sm text-gray-700 mt-0.5">{info.subwayGuide}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#2E7D32]">버스</p>
                <p className="text-sm text-gray-700">간선: {info.busTrunk}</p>
                <p className="text-sm text-gray-700">지선: {info.busBranch}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Worship Schedule Quick Summary */}
        <div className="bg-[#F8FAF8] rounded-2xl p-7 sm:p-10 border border-gray-100">
          <h2 className="text-xl sm:text-2xl font-black text-[#1a2744] mb-6">
            예배 시간 안내
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.worshipSchedule.map((svc) => (
              <div
                key={svc.id}
                className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between gap-3"
              >
                <span className="font-bold text-[#1a2744] text-sm">
                  {svc.title}
                </span>
                <span className="text-sm font-semibold text-[#2E7D32] shrink-0">
                  {svc.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
