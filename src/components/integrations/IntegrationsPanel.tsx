"use client";

import { CheckCircle2, AlertTriangle, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIntegrations, type IntegrationInfo } from "./useIntegrations";

function StatusBadge({ integration }: { integration: IntegrationInfo }) {
  const { configured, partial } = integration;

  const style = configured
    ? { icon: CheckCircle2, text: "Active", cls: "text-success border-success/30 bg-success/10" }
    : partial
      ? { icon: AlertTriangle, text: "Incomplete", cls: "text-warning border-warning/30 bg-warning/10" }
      : { icon: CircleSlash, text: "Not configured", cls: "text-text-muted border-border bg-surface" };

  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 shrink-0 text-xs px-2 py-1 rounded border",
        style.cls
      )}
    >
      <Icon size={13} />
      {style.text}
    </span>
  );
}

/**
 * Shows which optional integrations are switched on and exactly which
 * environment variables are still missing. This is the page every
 * "requires configuration" message elsewhere in the app points at, so it has
 * to name the variables rather than just saying the feature is off.
 */
export default function IntegrationsPanel() {
  const { integrations, loading } = useIntegrations();

  if (loading) {
    return <p className="text-sm text-text-muted">Checking integrations…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Optional features. Each one needs its variables set in the server&apos;s
        environment (<code className="text-xs">.env</code>), then a restart. The app works
        without them.
      </p>

      {integrations.map((integration) => (
        <div
          key={integration.id}
          className="border border-border rounded-lg p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-medium text-text-primary">{integration.label}</h3>
            <StatusBadge integration={integration} />
          </div>

          <p className="text-sm text-text-muted">{integration.enables}</p>

          {!integration.configured && (
            <>
              <p className="text-sm text-text-muted">
                Missing:{" "}
                {integration.missing.map((v, i) => (
                  <span key={v}>
                    {i > 0 && ", "}
                    <code className="text-xs text-text-primary">{v}</code>
                  </span>
                ))}
              </p>
              <p className="text-sm text-text-muted">
                Until then: {integration.fallback}
              </p>
            </>
          )}

          {integration.partial && (
            <p className="text-sm text-warning">
              Half-configured. The feature stays off until every variable is set —
              a partial setup would fail midway through.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
