import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { WORSHIP_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";
import {
  normalizeScriptureText,
  normalizeSermonServiceType,
} from "@/lib/sermon-utils";

export const dynamic = "force-dynamic";

export default async function WorshipPage() {
  const content = await getSiteContent();

  return (
    <div>
      <SubpageHero
        englishLabel="Worship & Message"
        title="예배 안내"
        subtitle="살아계신 하나님을 예배하고 그 말씀을 듣습니다"
        bannerImageUrl="https://images.unsplash.com/photo-1579975096649-e773152b04cb?w=1800&auto=format&fit=crop&q=80"
        tabs={WORSHIP_TABS}
      />

      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-12 sm:py-16 space-y-16">
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744]">
              예배 시간 안내
            </h2>
            <AdminEditLink
              href="/admin?tab=worship"
              className="self-start sm:self-auto px-4 py-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#2E7D32] hover:text-white text-xs font-bold transition-colors"
            >
              ✎ 예배 시간표 수정하기
            </AdminEditLink>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.worshipSchedule.map((svc) => (
              <div
                key={svc.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold">
                    {svc.location}
                  </span>
                  <span className="text-sm font-black text-[#2E7D32]">
                    {svc.time}
                  </span>
                </div>
                <h3 className="text-xl font-black text-[#1a2744]">
                  {svc.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {svc.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1a2744]">
              최신 설교 말씀
            </h2>
            <Link
              href="/worship/sermons"
              className="text-sm font-bold text-[#2E7D32] hover:underline"
            >
              전체 보기 →
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.sermons.slice(0, 3).map((sermon) => {
              const metaLine = [
                normalizeScriptureText(sermon.scripture),
                sermon.preacher.trim(),
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <Link
                  key={sermon.id}
                  href={`/worship/sermons?v=${sermon.youtubeId}`}
                  className="bg-[#F8FAF8] rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-all group flex flex-col"
                >
                  <div className="aspect-video bg-[#1a2744] overflow-hidden relative">
                    <img
                      src={`https://i.ytimg.com/vi/${sermon.youtubeId}/hqdefault.jpg`}
                      alt={sermon.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="w-11 h-11 rounded-full bg-[#2E7D32] text-white flex items-center justify-center text-sm shadow-lg">
                        ▶
                      </span>
                    </div>
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#1a2744]/85 text-white text-[11px] font-semibold">
                      {normalizeSermonServiceType(sermon.serviceType)}
                    </span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-xs text-gray-400 mb-1">{sermon.date}</p>
                    <h3 className="font-bold text-[#1a2744] text-base mb-1.5 group-hover:text-[#2E7D32] break-keep">
                      {sermon.title}
                    </h3>
                    {metaLine && (
                      <p className="text-xs text-[#2E7D32] font-semibold mt-auto">
                        {metaLine}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
