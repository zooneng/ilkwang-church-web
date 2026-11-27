"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_NAVIGATION } from "@/components/NavigationConfig";
import { resolveCategoryForPathname } from "@/components/NavigationContext";
import type { AdminRole } from "@/lib/admin-auth";
import type { NavCategoryConfig } from "@/types/site-content";

interface SiteHeaderProps {
  readonly churchName: string;
  readonly slogan: string;
  readonly shortAddress: string;
  readonly phone: string;
  readonly topBannerNotices: readonly string[];
  readonly navigation?: readonly NavCategoryConfig[];
  readonly adminRole?: AdminRole | null;
  readonly logoUrl?: string;
}

const SOLID_HEADER_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
];

export function SiteHeader({
  churchName,
  slogan,
  shortAddress,
  phone,
  topBannerNotices,
  navigation = DEFAULT_NAVIGATION,
  adminRole = null,
  logoUrl = "/gapck-logo.svg",
}: SiteHeaderProps) {
  const adminActionHref =
    adminRole === "site_admin"
      ? "/admin"
      : adminRole === "photo_admin"
        ? "/admin/photos"
        : "/login";
  const adminActionLabel =
    adminRole === "site_admin"
      ? "관리자"
      : adminRole === "photo_admin"
        ? "사진 업로드"
        : "로그인";
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuState, setMobileMenuState] = useState<{
    readonly openForPath: string | null;
    readonly expandedId: string | null;
  }>({ openForPath: null, expandedId: null });
  const [hoverState, setHoverState] = useState<{
    readonly path: string;
    readonly categoryId: string | null;
  }>({ path: pathname, categoryId: null });
  const [noticeIdx, setNoticeIdx] = useState(0);
  const closeTimerRef = useRef<number | null>(null);

  const mobileOpen = mobileMenuState.openForPath === pathname;
  const mobileExpandedId = mobileMenuState.expandedId;
  const openCategoryId =
    hoverState.path === pathname ? hoverState.categoryId : null;

  function setMobileOpen(nextOpen: boolean) {
    setMobileMenuState((prev) => ({
      openForPath: nextOpen ? pathname : null,
      expandedId: prev.expandedId,
    }));
  }

  function setMobileExpandedId(
    updater: string | null | ((prev: string | null) => string | null)
  ) {
    setMobileMenuState((prev) => ({
      ...prev,
      expandedId:
        typeof updater === "function" ? updater(prev.expandedId) : updater,
    }));
  }

  function setOpenCategoryId(categoryId: string | null) {
    setHoverState({ path: pathname, categoryId });
  }

  const visibleNavigation = navigation
    .filter((cat) => cat.isVisible !== false)
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((sub) => sub.isVisible !== false),
    }));

  const forceSolid = SOLID_HEADER_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isSolid = forceSolid || scrolled || mobileOpen;

  function clearHoverTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openHoverCategory(categoryId: string) {
    clearHoverTimer();
    setHoverState({ path: pathname, categoryId });
  }

  function scheduleCloseHoverCategory() {
    clearHoverTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setHoverState({ path: pathname, categoryId: null });
      closeTimerRef.current = null;
    }, 150);
  }

  useEffect(() => {
    return () => {
      clearHoverTimer();
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const htmlRectTop = document.documentElement.getBoundingClientRect().top;
      const bodyRectTop = document.body.getBoundingClientRect().top;
      const rectScrolledY = -Math.min(0, htmlRectTop, bodyRectTop);
      const y = Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.scrollingElement?.scrollTop || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
        rectScrolledY
      );
      setScrolled(y > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [pathname]);

  useEffect(() => {
    if (topBannerNotices.length <= 1) return;
    const timer = window.setInterval(() => {
      setNoticeIdx((prev) => (prev + 1) % topBannerNotices.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [topBannerNotices.length]);

  const activeNotice =
    topBannerNotices[noticeIdx % Math.max(topBannerNotices.length, 1)] ?? "";

  const activePathCategory = resolveCategoryForPathname(
    visibleNavigation,
    pathname
  );
  const hoveredCategory =
    visibleNavigation.find((cat) => cat.id === openCategoryId) ?? null;

  function handleToggleMobileDrawer() {
    setMobileMenuState((prev) => {
      const currentlyOpen = prev.openForPath === pathname;
      if (currentlyOpen) {
        return { openForPath: null, expandedId: prev.expandedId };
      }
      return {
        openForPath: pathname,
        expandedId:
          activePathCategory?.id ?? visibleNavigation[0]?.id ?? null,
      };
    });
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpenCategoryId(null);
            setMobileOpen(false);
          }
        }}
      >
        {/* Top Navy Notice Bar (Public pages at top of scroll only) */}
        {!forceSolid && (
          <div
            className={`hidden md:block bg-[#1a2744] border-b border-white/10 transition-all duration-300 ${
              scrolled
                ? "h-0 opacity-0 overflow-hidden border-none"
                : "h-9 opacity-100"
            }`}
          >
            <div className="max-w-[1400px] mx-auto px-6 h-9 relative flex items-center justify-between gap-4">
              <div className="hidden xl:flex items-center gap-2 text-[11px] text-[#6dbf73] font-semibold shrink-0 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6dbf73]" />
                <span>{shortAddress}</span>
              </div>
              <p className="min-w-0 flex-1 mr-4 lg:mr-0 lg:flex-none lg:absolute lg:left-1/2 lg:-translate-x-1/2 text-white/75 text-xs tracking-wider whitespace-nowrap truncate lg:max-w-[460px] xl:max-w-[520px]">
                {activeNotice}
              </p>
              <div className="ml-auto flex items-center gap-4 shrink-0 whitespace-nowrap">
                {adminRole && (
                  <Link
                    href={adminActionHref}
                    className="px-2.5 py-0.5 rounded-full bg-[#2E7D32]/40 border border-[#6dbf73]/60 text-[#a3c9a8] hover:bg-[#2E7D32] hover:text-white text-[11px] font-bold transition-colors whitespace-nowrap"
                  >
                    {adminRole === "photo_admin" ? "사진 업로드 스튜디오" : "관리자 모드"}
                  </Link>
                )}
                <Link
                  href="/about/location"
                  className="text-white/75 hover:text-white text-xs transition-colors whitespace-nowrap"
                >
                  오시는 길
                </Link>
                <Link
                  href="/contact"
                  className="text-white/75 hover:text-white text-xs transition-colors whitespace-nowrap"
                >
                  문의하기
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Main 72px Navigation Bar + ilkwang.org Floating 2-Column Hover Mega-Card */}
        <div
          className={`relative transition-all duration-300 ${
            isSolid
              ? "bg-white shadow-sm border-b border-gray-100"
              : "bg-transparent"
          }`}
        >
          <div className="max-w-[1400px] mx-auto px-5 sm:px-6 flex items-center h-[72px] relative gap-4">
            {/* Logo Lockup */}
            <div className="flex-1 min-w-0">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-end select-none gap-2"
              >
                <div className="shrink-0 w-[28px] h-[40px] mb-[4px]">
                  <img
                    src={logoUrl || "/gapck-logo.svg"}
                    alt={churchName}
                    className="w-[28px] h-[40px] object-contain block"
                  />
                </div>
                <div className="flex flex-col items-start leading-none pt-[7px]">
                  <span
                    className={`font-nanum text-[11px] tracking-[0.03em] transition-colors duration-300 ${
                      isSolid ? "text-gray-600" : "text-white/85"
                    }`}
                  >
                    {slogan}
                  </span>
                  <span
                    className={`font-noto-black text-[28px] sm:text-[30px] mt-[5px] transition-colors duration-300 ${
                      isSolid ? "text-[#1a2744]" : "text-white"
                    }`}
                  >
                    {churchName}
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Center Category Bar (Hover opens 700px 2-column card like ilkwang.org) */}
            <nav
              aria-label="주요 메뉴"
              className="hidden lg:flex flex-none items-center"
            >
              {visibleNavigation.map((category) => {
                const primaryHref =
                  category.href || category.items[0]?.href || "/";
                const isActive = activePathCategory?.id === category.id;
                const isHovered = openCategoryId === category.id;

                return (
                  <div
                    key={category.id}
                    className="relative flex items-center"
                    onMouseEnter={() => openHoverCategory(category.id)}
                    onMouseLeave={scheduleCloseHoverCategory}
                  >
                    <Link
                      href={primaryHref}
                      onFocus={() => openHoverCategory(category.id)}
                      onClick={() => setOpenCategoryId(null)}
                      className={`flex items-center gap-0.5 px-3.5 xl:px-4 py-2 text-[15px] font-semibold transition-colors whitespace-nowrap ${
                        isSolid
                          ? isHovered || isActive
                            ? "text-[#2E7D32]"
                            : "text-[#1a2744] hover:text-[#2E7D32]"
                          : isHovered || isActive
                            ? "text-[#6dbf73]"
                            : "text-white/90 hover:text-white"
                      }`}
                    >
                      <span>{category.label}</span>
                      {category.items.length > 0 && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3.5 h-3.5 opacity-60 ml-0.5"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      )}
                    </Link>
                  </div>
                );
              })}
            </nav>

            {/* Desktop Right Action Pills */}
            <div className="hidden lg:flex flex-1 items-center justify-end gap-3">
              {forceSolid && (
                <Link
                  href="/"
                  className="px-3.5 py-2 text-xs font-bold rounded-full bg-gray-100 text-[#1a2744] hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  홈페이지 보기
                </Link>
              )}
              <Link
                href={adminActionHref}
                className="px-4 py-2 bg-[#2E7D32] text-white text-sm font-bold rounded-[26px] hover:bg-[#1B5E20] transition-colors whitespace-nowrap"
              >
                {adminActionLabel}
              </Link>
              <Link
                href="/contact"
                className={`px-4 py-2 text-sm font-bold rounded-[26px] transition-colors tracking-wide whitespace-nowrap ${
                  isSolid
                    ? "border border-[#1a2744]/30 text-[#1a2744] hover:border-[#1a2744] hover:bg-[#1a2744] hover:text-white"
                    : "border border-white/80 text-white hover:bg-white hover:text-[#1a2744] backdrop-blur-xs"
                }`}
              >
                문의하기
              </Link>
            </div>

            {/* Mobile Menu Toggle (< 1024px) */}
            <div className="flex lg:hidden items-center gap-2">
              <Link
                href={adminRole ? adminActionHref : "/contact"}
                onClick={() => setMobileOpen(false)}
                className="px-3.5 py-2 rounded-full bg-[#2E7D32] text-white text-xs font-bold whitespace-nowrap"
              >
                {adminRole ? adminActionLabel : "문의하기"}
              </Link>
              <button
                type="button"
                onClick={handleToggleMobileDrawer}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
                className={`p-2.5 rounded-lg transition-colors ${
                  isSolid
                    ? "text-[#1a2744] hover:bg-gray-100"
                    : "text-white hover:bg-white/10"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6"
                >
                  {mobileOpen ? (
                    <>
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </>
                  ) : (
                    <>
                      <path d="M4 6h16" />
                      <path d="M4 12h16" />
                      <path d="M4 18h16" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop ilkwang.org-matched 2-Column Floating Hover Mega-Card */}
          {hoveredCategory && hoveredCategory.items.length > 0 && (
            <div
              onMouseEnter={() => openHoverCategory(hoveredCategory.id)}
              onMouseLeave={scheduleCloseHoverCategory}
              className="absolute top-full left-1/2 -translate-x-1/2 w-[min(700px,calc(100vw-3rem))] z-50 shadow-2xl hidden lg:flex rounded-xl overflow-hidden border border-black/5"
            >
              {/* Left Summary Column (Dark Slate #374151 matching ilkwang.org) */}
              <div className="w-52 shrink-0 bg-gray-700 px-6 py-7 flex flex-col justify-center">
                <span className="text-[#6dbf73] text-xs font-bold uppercase tracking-[0.2em] mb-3">
                  {hoveredCategory.label}
                </span>
                <h3 className="text-white font-black text-xl leading-snug mb-3 break-keep">
                  {hoveredCategory.headingTitle || hoveredCategory.label}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line break-keep">
                  {hoveredCategory.description}
                </p>
                <Link
                  href={
                    hoveredCategory.href ||
                    hoveredCategory.items[0]?.href ||
                    "/"
                  }
                  onClick={() => setOpenCategoryId(null)}
                  className="mt-5 inline-flex items-center gap-1.5 text-[#6dbf73] text-sm font-semibold hover:text-white transition-colors"
                >
                  <span>전체보기</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Right 2-Column Sub-Menu Grid (Light Gray #e5e7eb matching ilkwang.org) */}
              <div className="flex-1 bg-gray-200 px-8 py-7">
                <p className="text-xs text-[#2E7D32] font-bold uppercase tracking-[0.2em] mb-4">
                  {hoveredCategory.label}
                </p>
                <div className="grid gap-1 grid-cols-2">
                  {hoveredCategory.items.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.id}
                        href={sub.href}
                        onClick={() => setOpenCategoryId(null)}
                        className={`group flex flex-col px-3 py-3 rounded-lg transition-colors ${
                          subActive
                            ? "bg-white shadow-2xs"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <span
                          className={`font-bold text-[14px] transition-colors ${
                            subActive
                              ? "text-[#2E7D32]"
                              : "text-gray-800 group-hover:text-[#2E7D32]"
                          }`}
                        >
                          {sub.label}
                        </span>
                        {sub.description && (
                          <span className="text-xs text-gray-500 mt-0.5 leading-relaxed whitespace-pre-line line-clamp-2">
                            {sub.description}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Smartphone / Tablet Touch-Friendly Collapsible Accordion Menu */}
          {mobileOpen && (
            <div className="lg:hidden bg-white border-t border-gray-100 px-5 py-4 space-y-1.5 shadow-xl max-h-[calc(100dvh-72px)] overflow-y-auto">
              {visibleNavigation.map((category) => {
                const isExpanded = mobileExpandedId === category.id;
                const primaryHref =
                  category.href || category.items[0]?.href || "/";
                const hasSubItems = category.items.length > 0;

                if (!hasSubItems) {
                  return (
                    <div
                      key={category.id}
                      className="border-b border-gray-100 last:border-none"
                    >
                      <Link
                        href={primaryHref}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between py-3 text-[15px] font-bold text-[#1a2744]"
                      >
                        <span>{category.label}</span>
                      </Link>
                    </div>
                  );
                }

                return (
                  <div
                    key={category.id}
                    className="border-b border-gray-100 last:border-none"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setMobileExpandedId((prev) =>
                          prev === category.id ? null : category.id
                        )
                      }
                      className="w-full flex items-center justify-between py-3 text-left text-[15px] font-bold text-[#1a2744]"
                    >
                      <span
                        className={
                          isExpanded ? "text-[#2E7D32]" : "text-[#1a2744]"
                        }
                      >
                        {category.label}
                      </span>
                      <span className="flex items-center gap-2 text-xs font-medium text-gray-400">
                        <span>{category.items.length}개 메뉴</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? "rotate-180 text-[#2E7D32]" : ""
                          }`}
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="pl-3 pr-1 pb-3 pt-0.5 space-y-1">
                        {category.items.map((sub) => {
                          const subActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.id}
                              href={sub.href}
                              onClick={() => setMobileOpen(false)}
                              className={`block px-3 py-2 rounded-lg transition-colors ${
                                subActive
                                  ? "bg-[#E8F5E9] text-[#2E7D32] font-bold"
                                  : "text-gray-700 hover:bg-gray-50 hover:text-[#2E7D32]"
                              }`}
                            >
                              <div className="text-sm font-semibold">
                                {sub.label}
                              </div>
                              {sub.description && (
                                <div className="text-[11px] text-gray-400 mt-0.5">
                                  {sub.description}
                                </div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-3 flex flex-wrap items-center gap-2.5 border-t border-gray-100">
                <a
                  href={`tel:${phone}`}
                  className="text-xs sm:text-sm text-[#1a2744] font-semibold px-3 py-2 rounded-full bg-gray-100"
                >
                  📞 {phone}
                </a>
                <Link
                  href={adminActionHref}
                  onClick={() => setMobileOpen(false)}
                  className="text-xs sm:text-sm px-4 py-2 bg-[#2E7D32] text-white rounded-[26px] font-bold"
                >
                  {adminRole === "site_admin"
                    ? "관리자 모드"
                    : adminRole === "photo_admin"
                      ? "사진 업로드"
                      : "관리자 로그인"}
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="text-xs sm:text-sm px-4 py-2 border border-[#1a2744]/30 text-[#1a2744] rounded-[26px] font-bold"
                >
                  문의하기
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>
      {forceSolid && <div className="h-[72px] shrink-0" aria-hidden="true" />}
    </>
  );
}
