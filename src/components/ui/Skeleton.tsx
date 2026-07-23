"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse bg-surface-elevated rounded",
        className
      )}
    />
  );
}

export function SkeletonList({ rows = 5, delayMs = 160 }: { rows?: number; delayMs?: number }) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
