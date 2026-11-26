import { Suspense } from "react";
import { AdminLoginClient } from "@/components/AdminLoginClient";
import { getAuthConfigStatus } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const status = getAuthConfigStatus();
  return (
    <Suspense
      fallback={
        <div className="min-h-[75vh] bg-[#F8FAF8] flex items-center justify-center text-sm text-gray-500">
          로그인 화면을 불러오는 중입니다...
        </div>
      }
    >
      <AdminLoginClient
        authRequired={status.authRequired}
        siteAdminConfigured={status.siteAdminConfigured}
        photoAdminConfigured={status.photoAdminConfigured}
      />
    </Suspense>
  );
}
