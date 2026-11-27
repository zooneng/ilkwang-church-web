import Link from "next/link";
import { DEFAULT_NAVIGATION } from "@/components/NavigationConfig";
import type {
  ChurchInfo,
  NavCategoryConfig,
  WorshipServiceItem,
} from "@/types/site-content";

interface SiteFooterProps {
  readonly churchInfo: ChurchInfo;
  readonly worshipSchedule: readonly WorshipServiceItem[];
  readonly navigation?: readonly NavCategoryConfig[];
}

export function SiteFooter({
  churchInfo,
  worshipSchedule,
  navigation = DEFAULT_NAVIGATION,
}: SiteFooterProps) {
  const footerServices = worshipSchedule.filter(
    (item) => item.footerShortLabel && item.footerShortTime
  );

  const visibleCategories = navigation
    .filter((cat) => cat.isVisible !== false)
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((sub) => sub.isVisible !== false),
    }));

  const gridColsClass =
    visibleCategories.length >= 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 xl:gap-12"
      : "grid-cols-2 lg:grid-cols-4 gap-8 xl:gap-16";

  return (
    <footer className="bg-[#0b1320] text-gray-300 mt-auto">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 py-12 sm:py-16 flex flex-col md:flex-row gap-8 sm:gap-10">
        {/* Brand & Contact Info */}
        <div className="md:w-72 shrink-0 flex flex-col items-center md:items-start">
          <div className="mb-3">
            <Link
              href="/"
              className="inline-flex items-end select-none gap-2"
            >
              <div className="shrink-0 w-[28px] h-[40px] mb-[5px]">
                <img
                  src={churchInfo.logoUrl?.trim() || "/gapck-logo.svg"}
                  alt={churchInfo.name}
                  className="w-[28px] h-[40px] object-contain block"
                />
              </div>
              <div className="flex flex-col items-start leading-none pt-[9px]">
                <span className="font-nanum text-[11px] text-white/85 tracking-[0.03em]">
                  {churchInfo.slogan}
                </span>
                <span className="font-noto-black text-[30px] text-white mt-[6px]">
                  {churchInfo.name}
                </span>
              </div>
            </Link>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-5 text-center md:text-left">
            {churchInfo.denomination} · {churchInfo.foundedYear}년 설립된 서울 성북구{" "}
            {churchInfo.name}
          </p>
          <ul className="space-y-2.5 text-sm text-gray-400">
            <li className="flex items-start gap-2.5">
              <span className="text-[#6dbf73] shrink-0 mt-0.5">📍</span>
              <span>{churchInfo.shortAddress}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-[#6dbf73] shrink-0">📞</span>
              <a
                href={`tel:${churchInfo.phone}`}
                className="hover:text-white transition-colors"
              >
                {churchInfo.phone}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-[#6dbf73] shrink-0">✉</span>
              <a
                href={`mailto:${churchInfo.email}`}
                className="hover:text-white transition-colors"
              >
                {churchInfo.email}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-[#6dbf73] shrink-0">▶</span>
              <a
                href={churchInfo.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                유튜브 채널 바로가기
              </a>
            </li>
          </ul>
        </div>

        {/* Dynamic Multi-Column Sitemap */}
        <div className={`grid ${gridColsClass} md:ml-auto pr-2`}>
          {visibleCategories.map((category) => {
            const isWorshipCategory =
              category.id === "nav-worship" || category.href === "/worship";
            return (
              <div key={category.id}>
                <h4 className="font-black text-white text-[18px] tracking-wider mb-5">
                  {category.label}
                </h4>
                {isWorshipCategory && footerServices.length > 0 && (
                  <ul className="space-y-1.5 text-sm mb-5">
                    {footerServices.map((svc) => (
                      <li key={svc.id} className="flex gap-2 text-gray-400">
                        <span className="w-16 shrink-0">
                          {svc.footerShortLabel}
                        </span>
                        <span>{svc.footerShortTime}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="space-y-2.5 text-sm">
                  {category.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="text-gray-400 hover:text-[#6dbf73] transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1400px] mx-auto px-6 pt-5 pb-20 sm:pb-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-3">
          <p>© 2026 {churchInfo.name}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-gray-400 hover:text-white font-medium transition-colors"
            >
              관리자
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
