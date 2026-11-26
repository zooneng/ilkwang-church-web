import { YouthDepartmentDetail } from "@/components/YouthDepartmentDetail";
import { getSiteContent } from "@/lib/content-store";
import { matchesYouthDepartment } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function YouthTeensPage() {
  const content = await getSiteContent();
  const dept =
    content.youthDepartments.find((d) => d.id === "teens") ??
    content.youthDepartments[1];
  const posts = content.communityPosts.filter((p) =>
    matchesYouthDepartment(p.department, "teens")
  );
  return <YouthDepartmentDetail dept={dept} posts={posts} />;
}
