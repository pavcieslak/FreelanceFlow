"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
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
      </div>
    </nav>
  );
}
