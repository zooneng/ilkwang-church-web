import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  type AdminRole,
  verifySessionTokenRole,
} from "@/lib/admin-auth";

export async function getServerAdminRole(): Promise<AdminRole | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySessionTokenRole(sessionCookie);
}

export async function isServerAdminAuthenticated(): Promise<boolean> {
  return (await getServerAdminRole()) === "site_admin";
}
