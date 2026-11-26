import Link from "next/link";
import { AdminEditLink } from "@/components/AdminEditLink";
import { CustomBoardClient } from "@/components/CustomBoardClient";
import type { SubTabItem } from "@/components/NavigationConfig";
import { SubpageHero } from "@/components/SubpageHero";
import { getCustomBoardBySlug } from "@/lib/boards-store";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

interface CustomBoardPageProps {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams: Promise<{ readonly id?: string }>;
}

export default async function CustomBoardPage({
  params,
  searchParams,
}: CustomBoardPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const [board, siteContent] = await Promise.all([
    getCustomBoardBySlug(slug),
    getSiteContent(),
  ]);

  if (!board) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-md space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#2E7D32]">
            Board Not Found
          </p>
          <h1 className="text-2xl font-black text-[#1a2744]">
            요청하신 게시판을 찾을 수 없습니다
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            삭제되었거나 주소가 변경된 게시판일 수 있습니다. 관리자 모드에서 메뉴와 게시판을 확인해 주세요.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-full bg-[#1a2744] text-white text-xs font-bold"
            >
              홈으로 돌아가기
            </Link>
            <AdminEditLink
              href="/admin?tab=menus"
              className="px-5 py-2.5 rounded-full bg-[#2E7D32] text-white text-xs font-bold"
            >
              메뉴 및 게시판 관리
            </AdminEditLink>
          </div>
        </div>
      </div>
    );
  }

  const boardHref = `/boards/${board.slug}`;
  const parentCategory = siteContent.navigation.find((cat) =>
    cat.items.some(
      (item) => item.href === boardHref || item.customBoardSlug === board.slug
    )
  );
  const heroTabs: readonly SubTabItem[] | undefined = parentCategory
    ? [
        ...(parentCategory.href === "/youth"
          ? [{ label: "다음 세대 안내", href: "/youth" }]
          : []),
        ...parentCategory.items
          .filter((item) => item.isVisible !== false)
          .map((item) => ({ label: item.label, href: item.href })),
      ]
    : undefined;

  return (
    <div>
      <SubpageHero
        englishLabel={board.englishLabel}
        title={board.title}
        subtitle={board.subtitle}
        bannerImageUrl={board.bannerImageUrl}
        tabs={heroTabs}
      />
      <CustomBoardClient initialBoard={board} initialSelectedId={query.id} />
    </div>
  );
}
