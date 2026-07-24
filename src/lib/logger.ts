/**
 * Minimal structured logger.
 *
 * Emits single-line JSON in production so `docker logs` output can be shipped
 * to any log collector, and human-readable text in development.
 */

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const suffix = context ? ` ${JSON.stringify(context)}` : "";
  const line = `[${level}] ${message}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

/**
 * Logs the real error server-side and returns a generic client-facing message,
 * so stack traces and database details never reach the browser.
 */
export function serverError(message: string, error: unknown): Response {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  return new Response(
    JSON.stringify({ error: "Something went wrong. Please try again." }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
