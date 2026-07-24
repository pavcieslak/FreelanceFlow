"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates with the server-side log entry for this error.
    console.error("Application error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center bg-surface border border-border rounded-lg p-8">
        <AlertTriangle size={40} className="mx-auto text-danger mb-4" />
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-text-muted text-sm mb-6">
          An unexpected error occurred. Your data is safe — try again, and if it
          keeps happening the reference below helps with debugging.
        </p>
        {error.digest && (
          <p className="text-xs text-text-muted/70 font-mono mb-6">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="bg-accent hover:bg-accent-hover text-white font-medium rounded px-5 py-2.5 text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
