"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useIntegrations } from "@/components/integrations/useIntegrations";
import { Plus, Trash2, ArrowLeft, Download, Clock, Send, Link2, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ImportTimeModal from "@/components/invoices/ImportTimeModal";
import { Invoice, InvoiceItem, Settings } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";

interface EditableItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  timeEntryId?: string | null;
}

function statusBadgeVariant(status: string) {
  if (status === "PAID") return "success" as const;
  if (status === "SENT") return "info" as const;
  return "default" as const;
}

export default function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Features that depend on optional integrations are disabled rather than
  // left to fail on click; Settings › Integrations says what to set.
  const { available, get } = useIntegrations();
  const stripeReady = available("stripe");
  const emailReady = available("email");

  function unavailableHint(id: "stripe" | "email"): string {
    const info = get(id);
    if (!info) return "Not configured — see Settings › Integrations";
    return `${info.label} is not configured. ${info.fallback} Set ${info.missing.join(" and ")} to enable it.`;
  }

  const unavailable = [
    ...(stripeReady ? [] : ["payment links"]),
    ...(emailReady ? [] : ["emailing invoices"]),
  ];
  const [importOpen, setImportOpen] = useState(false);

  // Editable fields
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<EditableItem[]>([]);

  const loadInvoice = useCallback(async () => {
    const [inv, sett] = await Promise.all([
      fetch(`/api/invoices/${id}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setInvoice(inv);
    setSettings(sett);
    setNumber(inv.number ?? "");
    setStatus(inv.status ?? "DRAFT");
    setIssueDate(inv.issueDate ? inv.issueDate.slice(0, 10) : "");
    setDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : "");
    setSubject(inv.subject ?? "");
    setNotes(inv.notes ?? "");
    setTaxRate(inv.taxRate ?? 0);
    setItems((inv.items ?? []).map((item: InvoiceItem) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      timeEntryId: item.timeEntryId,
    })));
    setLoading(false);
  }, [id]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  function updateItem(index: number, field: keyof EditableItem, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        item.amount = Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100;
      }
      next[index] = item;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = subtotal + taxAmount;

  async function save(overrideStatus?: string) {
    setSaving(true);
    try {
      await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number, status: overrideStatus ?? status,
          issueDate: new Date(issueDate).toISOString(),
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          subject, notes, taxRate, items,
        }),
      });
      if (overrideStatus) setStatus(overrideStatus);
      await loadInvoice();
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setFeedback(null);
    try {
      await save();
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: data?.error ?? "Failed to send invoice" });
      } else {
        setFeedback({ kind: "success", text: "Invoice sent to the client's email" });
        await loadInvoice();
      }
    } finally {
      setSending(false);
    }
  }

  async function handlePaymentLink() {
    setLinking(true);
    setFeedback(null);
    try {
      await save();
      const res = await fetch(`/api/invoices/${id}/payment-link`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedback({ kind: "error", text: data?.error ?? "Failed to create payment link" });
      } else {
        await navigator.clipboard.writeText(data.paymentUrl).catch(() => {});
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
        setFeedback({ kind: "success", text: "Payment link created and copied to clipboard" });
        await loadInvoice();
      }
    } finally {
      setLinking(false);
    }
  }

  if (loading || !invoice) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border shrink-0 flex-wrap gap-y-3">
        <Link href="/invoices" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <input value={number} onChange={(e) => setNumber(e.target.value)}
          className="font-semibold text-xl text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none transition-colors" />
        <Badge variant={statusBadgeVariant(status)}>
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <Clock size={14} /> Import Time
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePaymentLink}
            loading={linking}
            disabled={!stripeReady}
            title={stripeReady ? undefined : unavailableHint("stripe")}
          >
            {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
            {linkCopied ? "Copied" : "Payment Link"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSend}
            loading={sending}
            disabled={!emailReady}
            title={emailReady ? undefined : unavailableHint("email")}
          >
            <Send size={14} /> Send
          </Button>
          <Link href={`/invoices/${id}/pdf`} target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-border rounded text-sm text-text-muted hover:text-text-primary transition-colors">
            <Download size={14} /> PDF
          </Link>
          {status !== "SENT" && status !== "PAID" && (
            <Button variant="secondary" size="sm" onClick={() => save("SENT")}>Mark Sent</Button>
          )}
          {status !== "PAID" && (
            <Button variant="secondary" size="sm" onClick={() => save("PAID")}>Mark Paid</Button>
          )}
          <Button onClick={() => save()} loading={saving} size="sm">Save</Button>
        </div>
      </div>

      {unavailable.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4 rounded border border-border bg-surface px-3 py-2 text-sm text-text-muted">
          {unavailable.join(" and ")} {unavailable.length > 1 ? "are" : "is"} unavailable
          because the required integration is not configured. You can still export a
          PDF and mark the invoice paid by hand.{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Configure in Settings
          </Link>
        </div>
      )}

      {feedback && (
        <div
          className={cn(
            "mx-4 md:mx-6 mt-4 rounded border px-3 py-2 text-sm",
            feedback.kind === "success"
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-danger/10 border-danger/30 text-danger"
          )}
        >
          {feedback.text}
        </div>
      )}

      <div className="flex-1 px-4 md:px-6 py-6 w-full space-y-6">
        {/* Dates row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Issue Date</label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent text-sm" />
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Due Date</label>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="text-xs text-text-muted hover:text-accent transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent text-sm" />
            {!dueDate && (
              <p className="text-xs text-text-muted">No payment deadline set</p>
            )}
          </div>
        </div>

        {/* Bill From / Bill To */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Bill From</p>
            {settings ? (
              <div className="space-y-0.5 text-sm text-text-primary">
                {settings.businessName && <p className="font-semibold">{settings.businessName}</p>}
                {settings.fullName && <p>{settings.fullName}</p>}
                {settings.email && <p className="text-text-muted">{settings.email}</p>}
                {settings.address && <p className="text-text-muted whitespace-pre-line">{settings.address}</p>}
                {settings.phone && <p className="text-text-muted">{settings.phone}</p>}
              </div>
            ) : (
              <p className="text-text-muted text-sm italic">Configure in Settings</p>
            )}
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Bill To</p>
            {invoice.client && (
              <div className="space-y-0.5 text-sm text-text-primary">
                <p className="font-semibold">{invoice.client.name}</p>
                {invoice.client.email && <p className="text-text-muted">{invoice.client.email}</p>}
                {invoice.client.address && <p className="text-text-muted whitespace-pre-line">{invoice.client.address}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Services for May 2025"
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm" />
        </div>

        {/* Line items */}
        <div>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-elevated">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase w-full">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase whitespace-nowrap">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase whitespace-nowrap">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase whitespace-nowrap">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-2">
                      <input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)}
                        placeholder="Item description"
                        className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-2 py-1 text-text-primary placeholder-text-muted text-sm transition-colors" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-20 text-right bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-2 py-1 text-text-primary text-sm transition-colors" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-24 text-right bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-2 py-1 text-text-primary text-sm transition-colors" />
                    </td>
                    <td className="px-4 py-2 text-right text-text-primary whitespace-nowrap">
                      {formatCurrency(item.amount, invoice.currency)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeItem(i)}
                        className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border">
              <button onClick={addItem}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors">
                <Plus size={14} /> Add item
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Subtotal</span>
                <span className="text-text-primary">{formatCurrency(subtotal, invoice.currency)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted flex items-center gap-2">
                  Tax
                  <input type="number" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    min="0" max="100" step="0.1"
                    className="w-14 bg-surface-elevated border border-border rounded px-2 py-0.5 text-text-primary text-xs focus:outline-none focus:border-accent text-right" />
                  %
                </span>
                <span className="text-text-primary">{formatCurrency(taxAmount, invoice.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span className="text-text-primary">Total</span>
                <span className="text-text-primary">{formatCurrency(total, invoice.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wide">Notes / Payment Terms</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Payment due within 30 days…"
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm resize-none" />
        </div>
      </div>

      <ImportTimeModal
        invoiceId={id}
        clientId={invoice.clientId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadInvoice}
      />
    </div>
  );
}
