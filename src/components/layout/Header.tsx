"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/tracker": "Tracker",
  "/projects": "Projects",
  "/clients": "Clients",
  "/tags": "Tags",
  "/reports": "Reports",
  "/invoices": "Invoices",
  "/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const title =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "ProjectFlow";

  return (
    <header className="md:hidden sticky top-0 z-40 bg-surface border-b border-border px-4 h-14 flex items-center justify-between">
      <span className="font-bold text-text-primary text-lg">ProjectFlow</span>
      <span className="text-text-muted text-sm">{title}</span>
    </header>
  );
}
