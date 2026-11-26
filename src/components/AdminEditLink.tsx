"use client";

import Link from "next/link";
import { useIsAdmin } from "@/components/NavigationContext";

interface AdminEditLinkProps {
  readonly href: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function AdminEditLink({
  href,
  className,
  children,
}: AdminEditLinkProps) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) {
    return null;
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
