"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  LogOut,
  TrendingUp,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Tracker", icon: Clock, href: "/tracker" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Clients", icon: Users, href: "/clients" },
  { label: "Tags", icon: Tag, href: "/tags" },
  { label: "Reports", icon: BarChart2, href: "/reports" },
  { label: "Invoices", icon: FileText, href: "/invoices" },
  { label: "Runway", icon: TrendingUp, href: "/runway" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-surface border-r border-border transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
        {!collapsed && (
          <span className="font-bold text-text-primary text-lg tracking-tight">
            FreelanceFlow
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-sm font-medium",
                active
                  ? "bg-accent/10 text-accent"
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
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-sm font-medium",
            pathname.startsWith("/settings")
              ? "bg-accent/10 text-accent"
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
            "w-full flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-sm font-medium text-text-muted hover:bg-surface-elevated hover:text-danger",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
