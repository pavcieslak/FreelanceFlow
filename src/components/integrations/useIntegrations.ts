"use client";

import { useEffect, useState } from "react";

export interface IntegrationInfo {
  id: "email" | "stripe" | "clockify";
  label: string;
  configured: boolean;
  missing: string[];
  partial: boolean;
  enables: string;
  fallback: string;
}

/**
 * Reads integration availability so a page can disable what cannot work.
 *
 * `loading` starts true and features should stay enabled while it is true —
 * briefly showing a button that turns out to be unavailable is better than
 * flashing "not configured" at someone whose setup is perfectly fine.
 */
export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/integrations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.integrations) setIntegrations(data.integrations);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function get(id: IntegrationInfo["id"]): IntegrationInfo | undefined {
    return integrations.find((i) => i.id === id);
  }

  /** Unknown until loaded, so callers do not disable features prematurely. */
  function available(id: IntegrationInfo["id"]): boolean {
    if (loading) return true;
    return get(id)?.configured ?? true;
  }

  return { integrations, loading, get, available };
}
