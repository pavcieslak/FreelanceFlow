import { PrismaClient } from "@prisma/client";

const CLOCKIFY_API_BASE = "https://api.clockify.me/api/v1";

type ClockifyListItem = {
  id: string;
};

type ClockifyListResponse = {
  total: number;
  invoices: ClockifyListItem[];
};

type ClockifyInvoiceItem = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
};

type ClockifyInvoiceDetail = {
  id: string;
  number: string;
  status: string;
  issuedDate: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  clientAddress?: string;
  subject?: string;
  note?: string;
  subtotal?: number;
  taxAmount?: number;
  tax2Amount?: number;
  paid?: number;
  balance?: number;
  currency?: string;
  items?: ClockifyInvoiceItem[];
};

const prisma = new PrismaClient();

function getConfig() {
  const apiKey = process.env.CLOCKIFY_API_KEY;
  const workspaceId = process.env.CLOCKIFY_WORKSPACE_ID;
  const userEmail = process.env.IMPORT_USER_EMAIL ?? process.env.AUTH_EMAIL;
  if (!apiKey || !workspaceId) {
    throw new Error("CLOCKIFY_API_KEY and CLOCKIFY_WORKSPACE_ID must be set");
  }
  if (!userEmail) {
    throw new Error("IMPORT_USER_EMAIL (or AUTH_EMAIL) must be set to pick the target account");
  }
  return { apiKey, workspaceId, userEmail };
}

async function clockifyFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${CLOCKIFY_API_BASE}${path}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clockify request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

async function fetchAllInvoiceIds(workspaceId: string, apiKey: string): Promise<string[]> {
  const pageSize = 50;
  let page = 1;
  let total = 0;
  const ids: string[] = [];

  while (true) {
    const data = await clockifyFetch<ClockifyListResponse>(
      `/workspaces/${workspaceId}/invoices?page-size=${pageSize}&page=${page}`,
      apiKey
    );

    if (typeof data.total === "number") total = data.total;
    ids.push(...(data.invoices ?? []).map((inv) => inv.id));

    if (!data.invoices?.length || ids.length >= total) break;
    page += 1;
  }

  return ids;
}

function toMajorUnits(value: number | undefined): number {
  return Math.round(value ?? 0) / 100;
}

function mapStatus(status: string): "DRAFT" | "SENT" | "PAID" {
  const s = status.toUpperCase();
  if (s === "PAID") return "PAID";
  if (s === "UNSENT" || s === "DRAFT") return "DRAFT";
  return "SENT";
}

function withSuffix(base: string, suffix: string) {
  const safe = base.trim() || `CLK-${suffix}`;
  return `${safe}-${suffix}`;
}

async function resolveUniqueInvoiceNumber(
  userId: string,
  preferredNumber: string,
  existingInvoiceId?: string
) {
  let candidate = preferredNumber;
  let attempt = 0;

  while (true) {
    const existing = await prisma.invoice.findUnique({
      where: { userId_number: { userId, number: candidate } },
    });
    if (!existing || existing.id === existingInvoiceId) return candidate;
    attempt += 1;
    candidate = withSuffix(preferredNumber, String(attempt));
  }
}

async function ensureClient(
  userId: string,
  clockifyClientId: string,
  clientName: string,
  clientAddress: string | undefined,
  currency: string
) {
  const byClockifyId = await prisma.client.findUnique({
    where: { userId_clockifyClientId: { userId, clockifyClientId } },
  });
  if (byClockifyId) return byClockifyId;

  const byName = await prisma.client.findFirst({
    where: { userId, name: clientName, archived: false },
    orderBy: { createdAt: "desc" },
  });

  if (byName) {
    return prisma.client.update({
      where: { id: byName.id },
      data: {
        clockifyClientId,
        address: byName.address ?? clientAddress ?? null,
        currency: byName.currency || currency,
      },
    });
  }

  return prisma.client.create({
    data: {
      userId,
      clockifyClientId,
      name: clientName,
      address: clientAddress ?? null,
      currency: currency || "USD",
    },
  });
}

async function upsertInvoice(userId: string, detail: ClockifyInvoiceDetail) {
  const client = await ensureClient(
    userId,
    detail.clientId,
    detail.clientName || "Clockify Client",
    detail.clientAddress,
    detail.currency || "USD"
  );

  const subtotal = toMajorUnits(detail.subtotal);
  const taxAmount = toMajorUnits((detail.taxAmount ?? 0) + (detail.tax2Amount ?? 0));
  const taxRate = subtotal > 0 ? Number(((taxAmount / subtotal) * 100).toFixed(2)) : 0;

  const existing = await prisma.invoice.findUnique({
    where: { userId_clockifyInvoiceId: { userId, clockifyInvoiceId: detail.id } },
  });

  const preferredNumber = detail.number?.trim() || `CLK-${detail.id.slice(-6)}`;
  const number = await resolveUniqueInvoiceNumber(userId, preferredNumber, existing?.id);

  const items = (detail.items ?? []).map((item, idx) => ({
    description: item.description?.trim() || `Clockify item ${idx + 1}`,
    quantity: toMajorUnits(item.quantity),
    unitPrice: toMajorUnits(item.unitPrice),
    amount: toMajorUnits(item.amount),
    timeEntryId: null as string | null,
  }));

  const baseData = {
    clockifyInvoiceId: detail.id,
    number,
    clientId: client.id,
    status: mapStatus(detail.status),
    issueDate: new Date(detail.issuedDate),
    dueDate: new Date(detail.dueDate),
    subject: detail.subject || null,
    notes: detail.note || null,
    currency: detail.currency || client.currency || "USD",
    taxRate,
    paidAmount: toMajorUnits(detail.paid),
    balanceAmount: toMajorUnits(detail.balance),
  };

  if (existing) {
    await prisma.$transaction([
      prisma.invoice.update({ where: { id: existing.id }, data: baseData }),
      prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } }),
      ...(items.length
        ? [
            prisma.invoiceItem.createMany({
              data: items.map((item) => ({ ...item, invoiceId: existing.id })),
            }),
          ]
        : []),
    ]);
    return { action: "updated" as const, id: existing.id };
  }

  const created = await prisma.invoice.create({
    data: {
      userId,
      ...baseData,
      items: items.length ? { create: items } : undefined,
    },
    select: { id: true },
  });

  return { action: "created" as const, id: created.id };
}

async function main() {
  const { apiKey, workspaceId, userEmail } = getConfig();

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    throw new Error(`No user found for ${userEmail} — create the account first`);
  }
  const userId = user.id;

  const ids = await fetchAllInvoiceIds(workspaceId, apiKey);

  let created = 0;
  let updated = 0;

  for (const id of ids) {
    const detail = await clockifyFetch<ClockifyInvoiceDetail>(
      `/workspaces/${workspaceId}/invoices/${id}`,
      apiKey
    );
    const result = await upsertInvoice(userId, detail);
    if (result.action === "created") created += 1;
    else updated += 1;
  }

  const totalLocal = await prisma.invoice.count({ where: { userId } });
  const clockifyLinked = await prisma.invoice.count({
    where: { userId, clockifyInvoiceId: { not: null } },
  });

  console.log(
    JSON.stringify(
      {
        importedFromClockify: ids.length,
        created,
        updated,
        totalLocalInvoices: totalLocal,
        clockifyLinkedInvoices: clockifyLinked,
      },
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
