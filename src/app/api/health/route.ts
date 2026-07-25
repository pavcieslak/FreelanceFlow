import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liveness/readiness probe for uptime monitoring and container orchestration.
 * Intentionally unauthenticated but leaks nothing beyond reachability, version
 * and whether the schema is up to date.
 */

/**
 * Probes that the database actually has the columns and tables this build of
 * the Prisma client expects. Catches the common self-hosting mistake of
 * pulling new code without running `prisma migrate deploy`, which otherwise
 * only surfaces as a generic 500 the first time someone writes data.
 */
async function findSchemaProblems(): Promise<string[]> {
  const probes: Array<{ label: string; run: () => Promise<unknown> }> = [
    {
      label: "User.passwordChangedAt (migration: add_password_reset)",
      run: () => prisma.user.findFirst({ select: { passwordChangedAt: true } }),
    },
    {
      label: "PasswordResetToken table (migration: add_password_reset)",
      run: () => prisma.passwordResetToken.findFirst({ select: { id: true } }),
    },
    {
      label: "ProcessedWebhookEvent table (migration: add_processed_webhook_events)",
      run: () => prisma.processedWebhookEvent.findFirst({ select: { id: true } }),
    },
    {
      label: "Invoice.dueDate nullable (migration: optional_invoice_due_date)",
      run: () => prisma.invoice.findFirst({ select: { dueDate: true } }),
    },
  ];

  const problems: string[] = [];
  for (const probe of probes) {
    try {
      await probe.run();
    } catch {
      problems.push(probe.label);
    }
  }
  return problems;
}

export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown";
  const commit = process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown";

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - start;

    const schemaProblems = await findSchemaProblems();

    if (schemaProblems.length) {
      return NextResponse.json(
        {
          status: "degraded",
          version,
          commit,
          database: "up",
          dbLatencyMs,
          schema: "out_of_date",
          missing: schemaProblems,
          fix: "Run `npx prisma migrate deploy` against DATABASE_URL, then restart the app.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { status: "ok", version, commit, database: "up", dbLatencyMs, schema: "up_to_date" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        version,
        commit,
        database: "down",
        fix: "Check DATABASE_URL and that PostgreSQL is running and reachable.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
