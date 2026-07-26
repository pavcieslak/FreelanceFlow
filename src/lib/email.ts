import { isConfigured } from "@/lib/config";

const RESEND_API_BASE = "https://api.resend.com";

export function emailEnabled(): boolean {
  return isConfigured("email");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured");

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo && { reply_to: opts.replyTo }),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? `Email send failed (${res.status})`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderInvoiceEmail(opts: {
  invoiceNumber: string;
  businessName: string;
  clientName: string;
  currency: string;
  subtotal: number;
  taxRate: number;
  total: number;
  dueDate: string | null;
  notes?: string | null;
  paymentUrl?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
}): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: opts.currency }).format(n);

  const rows = opts.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(item.unitPrice)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(item.amount)}</td>
        </tr>`
    )
    .join("");

  const payButton = opts.paymentUrl
    ? `<p style="margin:24px 0;">
         <a href="${opts.paymentUrl}"
            style="background:#3b82f6;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
           Pay ${fmt(opts.total)} online
         </a>
       </p>`
    : "";

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
    <h2 style="margin-bottom:4px;">Invoice ${escapeHtml(opts.invoiceNumber)}</h2>
    <p style="color:#6b7280;margin-top:0;">from ${escapeHtml(opts.businessName)}</p>
    <p>Hi ${escapeHtml(opts.clientName)},</p>
    <p>${
      opts.dueDate
        ? `Please find your invoice below. Payment is due by <strong>${escapeHtml(opts.dueDate)}</strong>.`
        : "Please find your invoice below."
    }</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">Description</th>
          <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Qty</th>
          <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Rate</th>
          <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Subtotal</td>
          <td style="padding:8px 12px;text-align:right;">${fmt(opts.subtotal)}</td>
        </tr>
        ${
          opts.taxRate > 0
            ? `<tr>
                 <td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;">Tax (${opts.taxRate}%)</td>
                 <td style="padding:8px 12px;text-align:right;">${fmt(opts.total - opts.subtotal)}</td>
               </tr>`
            : ""
        }
        <tr>
          <td colspan="3" style="padding:8px 12px;text-align:right;font-weight:700;">Total due</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;">${fmt(opts.total)}</td>
        </tr>
      </tfoot>
    </table>
    ${payButton}
    ${opts.notes ? `<p style="color:#6b7280;white-space:pre-line;">${escapeHtml(opts.notes)}</p>` : ""}
    <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Sent with ProjectFlow</p>
  </div>`;
}
