"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SubTabItem } from "@/components/NavigationConfig";
import {
  resolveDynamicSubTabs,
  useDefaultSubpageBanner,
  useNavigation,
} from "@/components/NavigationContext";

interface SubpageHeroProps {
  readonly englishLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly bannerImageUrl: string;
  readonly tabs?: readonly SubTabItem[];
}

export function SubpageHero({
  englishLabel,
  title,
  subtitle,
  bannerImageUrl,
  tabs,
}: SubpageHeroProps) {
  const pathname = usePathname();
  const navigation = useNavigation();
  const defaultSubpageBannerUrl = useDefaultSubpageBanner();
  const effectiveTabs = resolveDynamicSubTabs(navigation, pathname, tabs);
  const effectiveBannerUrl =
    defaultSubpageBannerUrl && bannerImageUrl.includes("images.unsplash.com")
      ? defaultSubpageBannerUrl
      : bannerImageUrl;

  return (
    <>
      <div className="relative flex items-end overflow-hidden min-h-[300px] sm:min-h-[400px] lg:min-h-[460px] pt-28">
        <img
          src={effectiveBannerUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1320]/90 via-[#0b1320]/55 to-[#1a2744]/55" />
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-5 sm:px-6 pb-9 sm:pb-12 lg:pb-14 text-center sm:text-left">
          <p className="text-[#6dbf73] text-[11px] font-bold uppercase tracking-[0.3em] mb-3 sm:mb-4">
            {englishLabel}
          </p>
          <h1 className="font-nanum-extrabold text-white leading-tight mb-3 sm:mb-4 text-3xl sm:text-4xl lg:text-5xl break-keep">
            {title}
          </h1>
          <p className="text-gray-200 text-base sm:text-lg max-w-2xl leading-relaxed mx-auto sm:mx-0 break-keep">
            {subtitle}
          </p>
          <div className="mt-6 sm:mt-8 w-16 h-1 bg-[#2E7D32] rounded-full mx-auto sm:mx-0" />
        </div>
      </div>

      {effectiveTabs && effectiveTabs.length > 0 && (
        <div className="bg-white border-b border-gray-200 sticky top-[72px] z-40 shadow-2xs">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
            {effectiveTabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={`${tab.href}-${tab.label}`}
                  href={tab.href}
                  className={`py-4 px-5 text-sm font-nanum-bold whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-[#2E7D32] text-[#2E7D32]"
                      : "border-transparent text-gray-500 hover:text-[#2E7D32]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
