"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { Invoice, Client } from "@/types";
import { formatCurrency, formatDateShort, CURRENCIES, cn } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/Skeleton";

type StatusFilter = "ALL" | "DRAFT" | "SENT" | "PAID";
type DateSort = "ISSUE_DATE_DESC" | "DUE_DATE_DESC";

function statusBadge(status: string) {
  if (status === "PAID") return <Badge variant="success">Paid</Badge>;
  if (status === "SENT") return <Badge variant="info">Sent</Badge>;
  return <Badge variant="default">Draft</Badge>;
}

function invoiceTotal(invoice: Invoice): number {
  return (invoice.items ?? []).reduce((s, i) => s + i.amount, 0);
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [dateSort, setDateSort] = useState<DateSort>("ISSUE_DATE_DESC");
  const [newOpen, setNewOpen] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newDueDate, setNewDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      params.set("sort", dateSort === "DUE_DATE_DESC" ? "dueDate_desc" : "issueDate_desc");
      const invoicesUrl = `/api/invoices${params.toString() ? `?${params.toString()}` : ""}`;

      const [inv, cl] = await Promise.all([
        fetch(invoicesUrl).then((r) => r.json()),
        fetch("/api/clients?archived=false").then((r) => r.json()),
      ]);
      setInvoices(inv);
      setClients(cl);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter, dateSort]);

  async function createInvoice() {
    if (!newClientId || !newDueDate) return;
    setCreating(true);
    try {
      const client = clients.find((c) => c.id === newClientId);
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: newClientId, dueDate: new Date(newDueDate).toISOString(), currency: client?.currency ?? "USD" }),
      });
      const inv = await res.json();
      if (inv.id) router.push(`/invoices/${inv.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    load();
  }

  const TABS: StatusFilter[] = ["ALL", "DRAFT", "SENT", "PAID"];

  return (
    <PageShell
      title="Invoices"
      action={
        <Button onClick={() => setNewOpen(true)} size="sm">
          <Plus size={14} /> New Invoice
        </Button>
      }
    >
      {/* Status filter tabs */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4 -mt-1">
        <div className="flex border-b border-border">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
                filter === tab ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-primary")}>
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="invoice-date-sort" className="text-sm text-text-muted">Sort by</label>
          <select
            id="invoice-date-sort"
            value={dateSort}
            onChange={(e) => setDateSort(e.target.value as DateSort)}
            className="bg-surface-elevated border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="ISSUE_DATE_DESC">Issue date (latest first)</option>
            <option value="DUE_DATE_DESC">Due date (latest first)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonList />
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-muted text-lg font-medium">No invoices yet</p>
          <p className="text-text-muted text-sm mt-1">Create your first invoice to get paid</p>
          <Button onClick={() => setNewOpen(true)} className="mt-4"><Plus size={14} /> New Invoice</Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Invoice #", "Client", "Issue Date", "Due Date", "Total", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-accent hover:underline">{inv.number}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">{inv.client?.name}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{formatDateShort(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{formatDateShort(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-text-primary">{formatCurrency(invoiceTotal(inv), inv.currency)}</td>
                    <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/invoices/${inv.id}`}
                          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          <ExternalLink size={14} />
                        </Link>
                        <button onClick={() => deleteInvoice(inv.id)}
                          className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="block bg-surface border border-border rounded-lg p-4 hover:bg-surface-elevated transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-accent">{inv.number}</span>
                  {statusBadge(inv.status)}
                </div>
                <p className="text-text-primary text-sm mt-1">{inv.client?.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-text-muted text-xs">Due {formatDateShort(inv.dueDate)}</span>
                  <span className="font-medium text-text-primary text-sm">{formatCurrency(invoiceTotal(inv), inv.currency)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* New Invoice Modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Invoice">
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">Client *</label>
            <select value={newClientId} onChange={(e) => setNewClientId(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm appearance-none">
              <option value="">Select a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-muted">Due Date *</label>
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={createInvoice} loading={creating} disabled={!newClientId || !newDueDate} className="flex-1">Create</Button>
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
