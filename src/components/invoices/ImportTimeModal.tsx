"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { TimeEntry } from "@/types";
import { formatDateShort, formatDuration, formatCurrency } from "@/lib/utils";

interface Props {
  invoiceId: string;
  clientId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportTimeModal({ invoiceId, clientId, open, onClose, onImported }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    setSelected([]);
    // Fetch unbilled billable entries for projects belonging to this client
    fetch(`/api/time-entries?billable=true&invoiced=false&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const filtered = (data.entries ?? []).filter(
          (e: TimeEntry) => e.project?.clientId === clientId
        );
        setEntries(filtered);
      })
      .finally(() => setLoading(false));
  }, [open, clientId]);

  function toggleAll() {
    setSelected((prev) => prev.length === entries.length ? [] : entries.map((e) => e.id));
  }

  function toggleEntry(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleImport() {
    if (!selected.length) return;
    setImporting(true);
    try {
      await fetch(`/api/invoices/${invoiceId}/import-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: selected }),
      });
      onImported();
      onClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Time Entries" className="md:max-w-2xl">
      <div className="p-4">
        {loading ? (
          <div className="py-8 text-center text-text-muted">Loading entries…</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-text-muted">No unbilled time entries for this client.</div>
        ) : (
          <>
            <div className="overflow-y-auto max-h-96 border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left">
                      <input type="checkbox" checked={selected.length === entries.length && entries.length > 0}
                        onChange={toggleAll} className="accent-accent" />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase">Project</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-muted uppercase">Duration</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-text-muted uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const hours = Math.round(((entry.duration ?? 0) / 3600) * 100) / 100;
                    const amount = Math.round(hours * (entry.project?.hourlyRate ?? 0) * 100) / 100;
                    return (
                      <tr key={entry.id} onClick={() => toggleEntry(entry.id)}
                        className="border-b border-border last:border-b-0 hover:bg-surface-elevated cursor-pointer transition-colors">
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected.includes(entry.id)}
                            onChange={() => toggleEntry(entry.id)} onClick={(e) => e.stopPropagation()}
                            className="accent-accent" />
                        </td>
                        <td className="px-3 py-2.5 text-text-muted">{formatDateShort(entry.startTime)}</td>
                        <td className="px-3 py-2.5 text-text-primary max-w-[180px] truncate">{entry.description ?? <span className="italic text-text-muted">No description</span>}</td>
                        <td className="px-3 py-2.5">
                          {entry.project && (
                            <span className="flex items-center gap-1.5 text-text-muted">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.project.color }} />
                              {entry.project.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-text-primary">{formatDuration(entry.duration ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right text-text-primary">{formatCurrency(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-text-muted">{selected.length} of {entries.length} selected</span>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={onClose} size="sm">Cancel</Button>
                <Button onClick={handleImport} loading={importing} disabled={selected.length === 0} size="sm">
                  Import {selected.length > 0 ? `(${selected.length})` : ""}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
