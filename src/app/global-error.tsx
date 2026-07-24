"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 * It replaces the whole document, so it must render its own <html>/<body>
 * and cannot rely on the app's stylesheet being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111318",
          color: "#e6e9ef",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Application error
          </h1>
          <p style={{ color: "#9aa3b2", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            The app failed to load. Please refresh the page.
          </p>
          {error.digest && (
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                marginBottom: "1.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "#90caf9",
              color: "#111318",
              border: "none",
              borderRadius: 6,
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
