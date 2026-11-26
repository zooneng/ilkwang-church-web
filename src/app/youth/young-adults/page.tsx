import { YouthDepartmentDetail } from "@/components/YouthDepartmentDetail";
import { getSiteContent } from "@/lib/content-store";
import { matchesYouthDepartment } from "@/lib/format-utils";

export const dynamic = "force-dynamic";

export default async function YouthYoungAdultsPage() {
  const content = await getSiteContent();
  const dept =
    content.youthDepartments.find((d) => d.id === "young-adults") ??
    content.youthDepartments[2];
  const posts = content.communityPosts.filter((p) =>
    matchesYouthDepartment(p.department, "young-adults")
  );
  return <YouthDepartmentDetail dept={dept} posts={posts} />;
}
