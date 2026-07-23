"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clock,
  FolderOpen,
  Users,
  Tag,
  BarChart2,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Target,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME;

const BUILD_TITLE = `Version v${APP_VERSION} · commit ${GIT_SHA}${
  BUILD_TIME ? ` · built ${new Date(BUILD_TIME).toLocaleString()}` : ""
}`;

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Tracker", icon: Clock, href: "/tracker" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Clients", icon: Users, href: "/clients" },
  { label: "Tags", icon: Tag, href: "/tags" },
  { label: "Reports", icon: BarChart2, href: "/reports" },
  { label: "Invoices", icon: FileText, href: "/invoices" },
  { label: "Profitability", icon: Target, href: "/profitability" },
  { label: "Runway", icon: TrendingUp, href: "/runway" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    for (const item of NAV_ITEMS) {
      router.prefetch(item.href);
    }
    router.prefetch("/settings");
  }, [router]);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-surface/95 backdrop-blur border-r border-border transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
        {!collapsed && (
          <span className="font-bold text-text-primary text-lg tracking-tight">
            ProjectFlow
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn("p-1.5 rounded-full hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors", collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const activePath = pendingPath ?? pathname;
          const active = activePath.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => setPendingPath(href)}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                active
                  ? "bg-accent/20 text-accent"
                  : "text-text-muted hover:bg-surface-elevated hover:text-text-primary",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-1">
        <Link
          href="/settings"
          prefetch
          onClick={() => setPendingPath("/settings")}
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
            (pendingPath ?? pathname).startsWith("/settings")
              ? "bg-accent/20 text-accent"
              : "text-text-muted hover:bg-surface-elevated hover:text-text-primary",
            collapsed && "justify-center px-2"
          )}
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium text-text-muted hover:bg-surface-elevated hover:text-danger",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>

        <div
          title={BUILD_TITLE}
          className={cn(
            "px-3 pt-1.5 text-[10px] leading-tight text-text-muted/60 select-none",
            collapsed ? "text-center" : "truncate"
          )}
        >
          {collapsed ? GIT_SHA.slice(0, 4) : `v${APP_VERSION} · ${GIT_SHA}`}
        </div>
      </div>
    </aside>
  );
}
