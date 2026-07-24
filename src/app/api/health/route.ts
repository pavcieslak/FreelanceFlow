import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liveness/readiness probe for uptime monitoring and container orchestration.
 * Intentionally unauthenticated but leaks nothing beyond reachability and version.
 */
export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const commit = process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown";

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - start;

    return NextResponse.json(
      { status: "ok", version, commit, database: "up", dbLatencyMs },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", version, commit, database: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
