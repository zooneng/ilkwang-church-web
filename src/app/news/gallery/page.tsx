import { GalleryLightboxGrid } from "@/components/GalleryLightboxGrid";
import { NEWS_TABS } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getLegacyGalleryData } from "@/lib/legacy-gallery-store";

export const dynamic = "force-dynamic";

export default async function NewsGalleryPage() {
  const galleryData = await getLegacyGalleryData();

  const visibleAlbums = galleryData.albums.filter(
    (album) => album.isVisible && album.photos.length > 0
  );

  return (
    <div>
      <SubpageHero
        englishLabel="Church Album"
        title="앨범"
        subtitle="예배와 교제, 다음 세대와 공동체의 소중한 순간을 담은 앨범"
        bannerImageUrl="https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=1800&auto=format&fit=crop&q=80"
        tabs={NEWS_TABS}
      />
      <GalleryLightboxGrid albums={visibleAlbums} />
    </div>
  );
}
