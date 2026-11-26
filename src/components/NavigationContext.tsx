"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_NAVIGATION,
  type SubTabItem,
} from "@/components/NavigationConfig";
import type { AdminRole } from "@/lib/admin-auth";
import type { NavCategoryConfig } from "@/types/site-content";

const NavigationContext = createContext<readonly NavCategoryConfig[]>(
  DEFAULT_NAVIGATION
);
const AdminRoleContext = createContext<AdminRole | null>(null);

export function NavigationProvider({
  navigation,
  adminRole = null,
  children,
}: {
  readonly navigation: readonly NavCategoryConfig[];
  readonly adminRole?: AdminRole | null;
  readonly children: React.ReactNode;
}) {
  return (
    <NavigationContext.Provider value={navigation}>
      <AdminRoleContext.Provider value={adminRole}>
        {children}
      </AdminRoleContext.Provider>
    </NavigationContext.Provider>
  );
}

export function useNavigation(): readonly NavCategoryConfig[] {
  return useContext(NavigationContext);
}

export function useAdminRole(): AdminRole | null {
  return useContext(AdminRoleContext);
}

export function useIsAdmin(): boolean {
  return useContext(AdminRoleContext) === "site_admin";
}

export function useCanUploadPhotos(): boolean {
  const role = useContext(AdminRoleContext);
  return role === "site_admin" || role === "photo_admin";
}

export function resolveCategoryForPathname(
  navigation: readonly NavCategoryConfig[],
  pathname: string
): NavCategoryConfig | null {
  const visibleCategories = navigation.filter((cat) => cat.isVisible !== false);

  for (const cat of visibleCategories) {
    const visibleItems = cat.items.filter((i) => i.isVisible !== false);
    if (visibleItems.some((item) => item.href === pathname)) {
      return cat;
    }
  }

  for (const cat of visibleCategories) {
    if (cat.href && cat.href !== "/" && cat.href === pathname) {
      return cat;
    }
  }

  for (const cat of visibleCategories) {
    const visibleItems = cat.items.filter((i) => i.isVisible !== false);
    if (
      visibleItems.some(
        (item) => item.href !== "/" && pathname.startsWith(`${item.href}/`)
      )
    ) {
      return cat;
    }
  }

  return null;
}

export function resolveDynamicSubTabs(
  navigation: readonly NavCategoryConfig[],
  pathname: string,
  fallbackTabs?: readonly SubTabItem[]
): readonly SubTabItem[] | undefined {
  const matched = resolveCategoryForPathname(navigation, pathname);
  if (matched) {
    const visibleItems = matched.items
      .filter((item) => item.isVisible !== false)
      .map((item) => ({ label: item.label, href: item.href }));
    if (visibleItems.length > 0) {
      return visibleItems;
    }
  }
  return fallbackTabs;
}
