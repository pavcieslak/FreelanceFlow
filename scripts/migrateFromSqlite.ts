/**
 * One-time import of data from the old single-tenant SQLite database
 * (the pre-Postgres, pre-multi-tenant version of this app) into the
 * current PostgreSQL schema, attached to a specific user account.
 *
 * Every migrated row keeps its original id, so relations (project -> client,
 * time entry -> project, invoice item -> invoice, etc.) stay intact — only
 * a userId is added. Old columns that don't exist in a given .db file
 * (older schema versions) fall back to sensible defaults instead of failing.
 *
 * Usage:
 *   MIGRATE_USER_EMAIL=you@example.com [SQLITE_PATH=./prisma/dev.db] \
 *     npm run db:migrate-from-sqlite
 */
import Database from "better-sqlite3";
import { existsSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
  return !!row;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  const sqlitePath = process.env.SQLITE_PATH ?? "./prisma/dev.db";
  const userEmail = process.env.MIGRATE_USER_EMAIL;

  if (!userEmail) {
    throw new Error(
      "Set MIGRATE_USER_EMAIL to the email of the (already registered) account that should own the imported data."
    );
  }
  if (!existsSync(sqlitePath)) {
    throw new Error(
      `SQLite file not found at "${sqlitePath}". Set SQLITE_PATH to the correct location ` +
        `(older checkouts sometimes have it nested at "prisma/prisma/dev.db").`
    );
  }

  const user = await prisma.user.findUnique({ where: { email: userEmail.toLowerCase().trim() } });
  if (!user) {
    throw new Error(
      `No user found for ${userEmail}. Register that account first (via /register), then rerun this script.`
    );
  }
  const userId = user.id;

  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  const counts = {
    clients: 0,
    projects: 0,
    tasks: 0,
    tags: 0,
    timeEntries: 0,
    timeEntryTags: 0,
    invoices: 0,
    invoiceItems: 0,
    settings: 0,
  };

  // --- Clients ---
  if (tableExists(db, "Client")) {
    const rows = db.prepare("SELECT * FROM Client").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.client.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          userId,
          clockifyClientId: (r.clockifyClientId as string) ?? null,
          name: r.name as string,
          email: (r.email as string) ?? null,
          address: (r.address as string) ?? null,
          currency: (r.currency as string) ?? "USD",
          archived: !!r.archived,
          createdAt: toDate(r.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
      counts.clients = count;
    }
  }

  // --- Projects ---
  if (tableExists(db, "Project")) {
    const rows = db.prepare("SELECT * FROM Project").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.project.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          userId,
          name: r.name as string,
          color: (r.color as string) ?? "#3b82f6",
          clientId: (r.clientId as string) ?? null,
          hourlyRate: (r.hourlyRate as number) ?? 0,
          currency: (r.currency as string) ?? "USD",
          billableByDefault: r.billableByDefault === undefined ? true : !!r.billableByDefault,
          archived: !!r.archived,
          createdAt: toDate(r.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
      counts.projects = count;
    }
  }

  // --- Tasks (scoped via project, no direct userId) ---
  if (tableExists(db, "Task")) {
    const rows = db.prepare("SELECT * FROM Task").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.task.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          name: r.name as string,
          projectId: r.projectId as string,
          archived: !!r.archived,
        })),
        skipDuplicates: true,
      });
      counts.tasks = count;
    }
  }

  // --- Tags ---
  if (tableExists(db, "Tag")) {
    const rows = db.prepare("SELECT * FROM Tag").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.tag.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          userId,
          name: r.name as string,
        })),
        skipDuplicates: true,
      });
      counts.tags = count;
    }
  }

  // --- Time entries ---
  if (tableExists(db, "TimeEntry")) {
    const rows = db.prepare("SELECT * FROM TimeEntry").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.timeEntry.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          userId,
          description: (r.description as string) ?? null,
          projectId: (r.projectId as string) ?? null,
          taskId: (r.taskId as string) ?? null,
          mode: (r.mode as string) ?? "TIMER",
          isPlanned: !!r.isPlanned,
          startTime: toDate(r.startTime) ?? new Date(),
          endTime: toDate(r.endTime),
          duration: (r.duration as number) ?? null,
          billable: r.billable === undefined ? true : !!r.billable,
          invoiced: !!r.invoiced,
          createdAt: toDate(r.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
      counts.timeEntries = count;
    }
  }

  // --- Time entry <-> tag join rows ---
  if (tableExists(db, "TimeEntryTag")) {
    const rows = db.prepare("SELECT * FROM TimeEntryTag").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.timeEntryTag.createMany({
        data: rows.map((r) => ({
          timeEntryId: r.timeEntryId as string,
          tagId: r.tagId as string,
        })),
        skipDuplicates: true,
      });
      counts.timeEntryTags = count;
    }
  }

  // --- Invoices ---
  if (tableExists(db, "Invoice")) {
    const rows = db.prepare("SELECT * FROM Invoice").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.invoice.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          userId,
          clockifyInvoiceId: (r.clockifyInvoiceId as string) ?? null,
          number: r.number as string,
          clientId: r.clientId as string,
          status: (r.status as string) ?? "DRAFT",
          issueDate: toDate(r.issueDate) ?? new Date(),
          dueDate: toDate(r.dueDate),
          subject: (r.subject as string) ?? null,
          notes: (r.notes as string) ?? null,
          currency: (r.currency as string) ?? "USD",
          taxRate: (r.taxRate as number) ?? 0,
          paidAmount: (r.paidAmount as number) ?? 0,
          balanceAmount: (r.balanceAmount as number) ?? 0,
          createdAt: toDate(r.createdAt) ?? new Date(),
        })),
        skipDuplicates: true,
      });
      counts.invoices = count;
    }
  }

  // --- Invoice items ---
  if (tableExists(db, "InvoiceItem")) {
    const rows = db.prepare("SELECT * FROM InvoiceItem").all() as Record<string, unknown>[];
    if (rows.length) {
      const { count } = await prisma.invoiceItem.createMany({
        data: rows.map((r) => ({
          id: r.id as string,
          invoiceId: r.invoiceId as string,
          description: r.description as string,
          quantity: r.quantity as number,
          unitPrice: r.unitPrice as number,
          amount: r.amount as number,
          timeEntryId: (r.timeEntryId as string) ?? null,
        })),
        skipDuplicates: true,
      });
      counts.invoiceItems = count;
    }
  }

  // --- Settings (old singleton row -> this user's settings) ---
  if (tableExists(db, "Settings")) {
    const row = db.prepare("SELECT * FROM Settings WHERE id = 'singleton'").get() as
      | Record<string, unknown>
      | undefined;
    if (row) {
      await prisma.settings.upsert({
        where: { userId },
        update: {
          fullName: (row.fullName as string) ?? null,
          businessName: (row.businessName as string) ?? null,
          email: (row.email as string) ?? null,
          address: (row.address as string) ?? null,
          phone: (row.phone as string) ?? null,
          logo: (row.logo as string) ?? null,
          defaultCurrency: (row.defaultCurrency as string) ?? "USD",
          defaultHourlyRate: (row.defaultHourlyRate as number) ?? 0,
          monthlyExpenses: (row.monthlyExpenses as number) ?? 0,
        },
        create: {
          userId,
          fullName: (row.fullName as string) ?? null,
          businessName: (row.businessName as string) ?? null,
          email: (row.email as string) ?? null,
          address: (row.address as string) ?? null,
          phone: (row.phone as string) ?? null,
          logo: (row.logo as string) ?? null,
          defaultCurrency: (row.defaultCurrency as string) ?? "USD",
          defaultHourlyRate: (row.defaultHourlyRate as number) ?? 0,
          monthlyExpenses: (row.monthlyExpenses as number) ?? 0,
        },
      });
      counts.settings = 1;
    }
  }

  db.close();

  console.log(
    JSON.stringify(
      { migratedFor: userEmail, sqlitePath, imported: counts },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
