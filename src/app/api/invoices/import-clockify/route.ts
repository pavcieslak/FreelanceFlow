import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";

const CLOCKIFY_API_BASE = "https://api.clockify.me/api/v1";

type ClockifyListItem = {
  id: string;
  number: string;
  status: string;
  issuedDate: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  amount: number;
  paid: number;
  balance: number;
  currency: string;
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
  amount?: number;
  paid?: number;
  balance?: number;
  currency?: string;
  items?: ClockifyInvoiceItem[];
};

function getClockifyConfig() {
  const apiKey = process.env.CLOCKIFY_API_KEY;
  const workspaceId = process.env.CLOCKIFY_WORKSPACE_ID;

  if (!apiKey || !workspaceId) {
    throw new Error("CLOCKIFY_API_KEY and CLOCKIFY_WORKSPACE_ID must be set");
  }

  return { apiKey, workspaceId };
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

async function fetchAllClockifyInvoices(
  workspaceId: string,
  apiKey: string
): Promise<ClockifyListItem[]> {
  const pageSize = 50;
  let page = 1;
  const all: ClockifyListItem[] = [];
  let total = 0;

  while (true) {
    const data = await clockifyFetch<ClockifyListResponse>(
      `/workspaces/${workspaceId}/invoices?page-size=${pageSize}&page=${page}`,
      apiKey
    );

    if (typeof data.total === "number") total = data.total;
    all.push(...(data.invoices ?? []));

    if (!data.invoices?.length || all.length >= total) break;
    page += 1;
  }

  return all;
}

function toMajorUnits(value: number | undefined): number {
  return Math.round((value ?? 0)) / 100;
}

function mapClockifyStatus(status: string): "DRAFT" | "SENT" | "PAID" {
  const s = status.toUpperCase();
  if (s === "PAID") return "PAID";
  if (s === "UNSENT" || s === "DRAFT") return "DRAFT";
  return "SENT";
}

function buildUniqueNumber(base: string, suffix: string) {
  const safe = base.trim() || `CLK-${suffix}`;
  return `${safe}-${suffix}`;
}

async function resolveUniqueInvoiceNumber(
  userId: string,
  preferredNumber: string,
  existingInvoiceId?: string
): Promise<string> {
  let candidate = preferredNumber;
  let attempt = 0;

  while (true) {
    const existing = await prisma.invoice.findUnique({
      where: { userId_number: { userId, number: candidate } },
    });
    if (!existing || existing.id === existingInvoiceId) return candidate;
    attempt += 1;
    candidate = buildUniqueNumber(preferredNumber, String(attempt));
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

async function upsertClockifyInvoice(userId: string, detail: ClockifyInvoiceDetail) {
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

  const number = await resolveUniqueInvoiceNumber(
    userId,
    detail.number?.trim() || `CLK-${detail.id.slice(-6)}`,
    existing?.id
  );

  const items = (detail.items ?? []).map((item, index) => ({
    description: item.description?.trim() || `Clockify item ${index + 1}`,
    quantity: toMajorUnits(item.quantity),
    unitPrice: toMajorUnits(item.unitPrice),
    amount: toMajorUnits(item.amount),
    timeEntryId: null as string | null,
  }));

  const baseData = {
    clockifyInvoiceId: detail.id,
    number,
    clientId: client.id,
    status: mapClockifyStatus(detail.status),
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
      prisma.invoice.update({
        where: { id: existing.id },
        data: baseData,
      }),
      prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } }),
      ...(items.length
        ? [prisma.invoiceItem.createMany({ data: items.map((item) => ({ ...item, invoiceId: existing.id })) })]
        : []),
    ]);

    return prisma.invoice.findUnique({
      where: { id: existing.id },
      include: { client: true, items: true },
    });
  }

  const created = await prisma.invoice.create({
    data: {
      userId,
      ...baseData,
      items: items.length ? { create: items } : undefined,
    },
    include: { client: true, items: true },
  });

  return created;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const { apiKey, workspaceId } = getClockifyConfig();
    const invoices = await fetchAllClockifyInvoices(workspaceId, apiKey);

    return NextResponse.json({
      total: invoices.length,
      invoices,
      fields: [
        "id",
        "number",
        "status",
        "issuedDate",
        "dueDate",
        "clientId",
        "clientName",
        "amount",
        "paid",
        "balance",
        "currency",
      ],
      localMapping: {
        issueDate: "issuedDate",
        dueDate: "dueDate",
        status: "mapped: UNSENT->DRAFT, OVERDUE->SENT, PAID->PAID",
        paidAmount: "paid / 100",
        balanceAmount: "balance / 100",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clockify fetch failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const { apiKey, workspaceId } = getClockifyConfig();
    const body = await req.json().catch(() => ({}));
    const invoiceIds: string[] | undefined = Array.isArray(body?.invoiceIds)
      ? body.invoiceIds
      : undefined;

    const list = await fetchAllClockifyInvoices(workspaceId, apiKey);
    const target = invoiceIds?.length
      ? list.filter((inv) => invoiceIds.includes(inv.id))
      : list;

    const results = [];

    for (const inv of target) {
      const detail = await clockifyFetch<ClockifyInvoiceDetail>(
        `/workspaces/${workspaceId}/invoices/${inv.id}`,
        apiKey
      );
      const imported = await upsertClockifyInvoice(userId, detail);
      results.push({
        clockifyInvoiceId: inv.id,
        localInvoiceId: imported?.id,
        number: imported?.number,
        status: imported?.status,
      });
    }

    return NextResponse.json({
      imported: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clockify import failed" },
      { status: 500 }
    );
  }
}
