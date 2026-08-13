"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  FolderOpen,
  Users,
  LayoutDashboard,
  FileText,
  MoreHorizontal,
  Target,
  TrendingUp,
  Settings,
  BarChart2,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// The bar fits five slots and the sidebar has ten destinations, so the last
// slot opens a drawer holding the rest. Everything reachable on a desktop is
// reachable on a phone — the app installs as a PWA, where this bar is the only
// navigation there is.
const MAIN_NAV = [
  { label: "Home", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Tracker", icon: Clock, href: "/tracker" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Invoices", icon: FileText, href: "/invoices" },
];

const MORE_NAV = [
  { label: "Clients", icon: Users, href: "/clients" },
  { label: "Tags", icon: Tag, href: "/tags" },
  { label: "Reports", icon: BarChart2, href: "/reports" },
  { label: "Profitability", icon: Target, href: "/profitability" },
  { label: "Runway", icon: TrendingUp, href: "/runway" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    for (const item of [...MAIN_NAV, ...MORE_NAV]) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setPendingPath(null);
    setMoreOpen(false);
  }, [pathname]);

  const activePath = pendingPath ?? pathname;
  const isMoreActive = MORE_NAV.some((i) => activePath.startsWith(i.href));

  return (
    <>
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-surface border-t border-border px-2 py-2 grid grid-cols-3 gap-1">
            {MORE_NAV.map(({ label, icon: Icon, href }) => {
              const active = activePath.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  onClick={() => {
                    setPendingPath(href);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 px-1 rounded text-xs transition-colors",
                    active ? "text-accent bg-accent/10" : "text-text-muted"
                  )}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {MAIN_NAV.map(({ label, icon: Icon, href }) => {
            const active = activePath.startsWith(href);
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
          <button
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-label="More pages"
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors min-h-[56px] justify-center rounded-t-lg",
              isMoreActive || moreOpen ? "text-accent" : "text-text-muted"
            )}
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
