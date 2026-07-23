"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clock, FolderOpen, Users, BarChart2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Tracker", icon: Clock, href: "/tracker" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Clients", icon: Users, href: "/clients" },
  { label: "Reports", icon: BarChart2, href: "/reports" },
  { label: "Invoices", icon: FileText, href: "/invoices" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    for (const item of NAV_ITEMS) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = (pendingPath ?? pathname).startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => setPendingPath(href)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors min-h-[56px] justify-center rounded-t-lg",
                active ? "text-accent" : "text-text-muted"
              )}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
