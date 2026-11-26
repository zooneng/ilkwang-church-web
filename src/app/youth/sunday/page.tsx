import { YouthDepartmentDetail } from "@/components/YouthDepartmentDetail";
import { getSiteContent } from "@/lib/content-store";
import { matchesYouthDepartment } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function YouthSundaySchoolPage() {
  const content = await getSiteContent();
  const dept =
    content.youthDepartments.find((d) => d.id === "sunday") ??
    content.youthDepartments[0];
  const posts = content.communityPosts.filter((p) =>
    matchesYouthDepartment(p.department, "sunday")
  );
  return <YouthDepartmentDetail dept={dept} posts={posts} />;
}
