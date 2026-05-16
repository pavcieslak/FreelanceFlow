"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  FolderOpen,
  Users,
  FileText,
  MoreHorizontal,
  Target,
  TrendingUp,
  Settings,
  BarChart2,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const MAIN_NAV = [
  { label: "Tracker", icon: Clock, href: "/tracker" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Invoices", icon: FileText, href: "/invoices" },
  { label: "Reports", icon: BarChart2, href: "/reports" },
];

const MORE_NAV = [
  { label: "Clients", icon: Users, href: "/clients" },
  { label: "Tags", icon: Tag, href: "/tags" },
  { label: "Profitability", icon: Target, href: "/profitability" },
  { label: "Runway", icon: TrendingUp, href: "/runway" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_NAV.some((i) => pathname.startsWith(i.href));

  return (
    <>
      {/* More drawer */}
      {moreOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-surface border-t border-border px-2 py-2 grid grid-cols-3 gap-1">
            {MORE_NAV.map(({ label, icon: Icon, href }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
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
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {MAIN_NAV.map(({ label, icon: Icon, href }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors min-h-[56px] justify-center",
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
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors min-h-[56px] justify-center",
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
