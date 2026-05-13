"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { CURRENCIES } from "@/lib/utils";
import { Client } from "@/types";

interface Props {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ClientModal({ client, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email ?? "");
      setAddress(client.address ?? "");
      setCurrency(client.currency);
    } else {
      setName(""); setEmail(""); setAddress(""); setCurrency("USD");
    }
    setError("");
  }, [client]);

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const url = client ? `/api/clients/${client.id}` : "/api/clients";
      const method = client ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email || null, address: address || null, currency }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={client ? "Edit Client" : "New Client"}>
      <div className="p-5 space-y-4">
        {error && <p className="text-danger text-sm bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</p>}

        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm"
            placeholder="Client name" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm"
            placeholder="client@example.com" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm resize-none"
            placeholder="123 Main St, City, Country" />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text-muted">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent text-sm appearance-none">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={loading} className="flex-1">Save</Button>
        </div>
      </div>
    </Modal>
  );
}
