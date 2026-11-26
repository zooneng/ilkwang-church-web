import { WORSHIP_TABS } from "@/components/NavigationConfig";
import { SermonArchiveBrowser } from "@/components/SermonArchiveBrowser";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

interface SermonsPageProps {
  readonly searchParams: Promise<{ readonly v?: string }>;
}

export default async function WorshipSermonsPage({
  searchParams,
}: SermonsPageProps) {
  const params = await searchParams;
  const content = await getSiteContent();

  return (
    <div>
      <SubpageHero
        englishLabel="Sermon Archive"
        title="설교 영상"
        subtitle="일광교회 강단에서 선포되는 생명의 말씀"
        bannerImageUrl="https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=1800&auto=format&fit=crop&q=80"
        tabs={WORSHIP_TABS}
      />
      <SermonArchiveBrowser
        sermons={content.sermons}
        youtubeChannelUrl={content.churchInfo.youtubeUrl}
        initialVideoId={params.v}
      />
    </div>
  );
}
