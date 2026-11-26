import { BulletinBoardClient } from "@/components/BulletinBoardClient";
import { NEWS_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

interface NewsBulletinPageProps {
  readonly searchParams: Promise<{ readonly id?: string }>;
}

export default async function NewsBulletinPage({
  searchParams,
}: NewsBulletinPageProps) {
  const params = await searchParams;
  const content = await getSiteContent();

  return (
    <div>
      <SubpageHero
        englishLabel="Weekly Bulletin"
        title="주보 안내"
        subtitle="매 주일 예배 순서와 한 주간의 교회 소식을 화면에서 편리하게 확인하세요"
        bannerImageUrl="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1800&auto=format&fit=crop&q=80"
        tabs={NEWS_TABS}
      />
      <BulletinBoardClient
        bulletins={content.bulletins}
        initialBulletinId={params.id}
      />
    </div>
  );
}
