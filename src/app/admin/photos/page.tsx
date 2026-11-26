import { redirect } from "next/navigation";
import { AdminUsageMeter } from "@/components/AdminUsageMeter";
import { PhotoUploadStudio } from "@/components/PhotoUploadStudio";
import { isAuthRequired } from "@/lib/admin-auth";
import { getServerAdminRole } from "@/lib/admin-session-server";
import { getLegacyGalleryData } from "@/lib/legacy-gallery-store";
import { getChurchUsageSnapshot } from "@/lib/usage-store";

export const dynamic = "force-dynamic";

export default async function AdminPhotosPage() {
  const role = await getServerAdminRole();
  if (role !== "site_admin" && role !== "photo_admin") {
    redirect("/login?role=photo&next=/admin/photos");
  }

  const [galleryData, usage] = await Promise.all([
    getLegacyGalleryData(),
    getChurchUsageSnapshot(),
  ]);

  return (
    <>
      <AdminUsageMeter usage={usage} />
      <PhotoUploadStudio
        initialAlbums={galleryData.albums}
        role={role}
        authRequired={isAuthRequired()}
      />
    </>
  );
}
