import { ChurchEventsBrowser } from "@/components/ChurchEventsBrowser";
import { NEWS_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";
import { getKstDateString } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function NewsEventsPage() {
  const content = await getSiteContent();
  const referenceIsoDate = getKstDateString();

  return (
    <div>
      <SubpageHero
        englishLabel="Church Events"
        title="행사 안내"
        subtitle="일광교회의 절기 예배와 분기, 반기, 연간 사역 일정을 안내합니다"
        bannerImageUrl="https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1800&auto=format&fit=crop&q=80"
        tabs={NEWS_TABS}
      />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <ChurchEventsBrowser
          events={content.events}
          referenceIsoDate={referenceIsoDate}
        />
      </div>
    </div>
  );
}
