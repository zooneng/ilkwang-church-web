import { redirect } from "next/navigation";
import { AdminStudio } from "@/components/AdminStudio";
import { AdminUsageMeter } from "@/components/AdminUsageMeter";
import { isAuthRequired } from "@/lib/admin-auth";
import { getServerAdminRole } from "@/lib/admin-session-server";
import { getManagedBoardSummaries } from "@/lib/boards-store";
import { getSiteContent } from "@/lib/content-store";
import { getLegacyGalleryData } from "@/lib/legacy-gallery-store";
import { listInquiries } from "@/lib/operations-store";
import { getChurchUsageSnapshot } from "@/lib/usage-store";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  readonly searchParams: Promise<{
    readonly tab?: string;
    readonly board?: string;
    readonly dept?: string;
  }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const role = await getServerAdminRole();
  if (role === "photo_admin") {
    redirect("/admin/photos");
  }
  if (role !== "site_admin") {
    redirect("/login?next=/admin");
  }

  const params = await searchParams;
  const [content, inquiries, legacyData, boardSummaries, usage] =
    await Promise.all([
      getSiteContent(),
      listInquiries(),
      getLegacyGalleryData(),
      getManagedBoardSummaries(),
      getChurchUsageSnapshot(),
    ]);

  return (
    <>
      <AdminUsageMeter usage={usage} />
      <AdminStudio
        initialContent={content}
        initialInquiries={inquiries}
        initialLegacyAlbums={legacyData.albums}
        initialBoardSummaries={boardSummaries}
        initialBoardKey={params.board}
        initialTab={params.tab ?? (params.board ? "posts" : undefined)}
        initialDept={params.dept}
        authRequired={isAuthRequired()}
      />
    </>
  );
}
