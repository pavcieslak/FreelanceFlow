"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import ClientModal from "@/components/clients/ClientModal";
import { Client } from "@/types";
import { SkeletonList } from "@/components/ui/Skeleton";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [modalClient, setModalClient] = useState<Client | null | "new">(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch(`/api/clients?archived=${showArchived}`).then((r) => r.json());
      setClients(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [showArchived]);

  async function toggleArchive(client: Client) {
    await fetch(`/api/clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !client.archived }),
    });
    load();
  }

  return (
    <PageShell
      title="Clients"
      action={
        <Button onClick={() => setModalClient("new")} size="sm">
          <Plus size={14} /> New Client
        </Button>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setShowArchived((a) => !a)}
          className={`px-3 py-2 rounded border text-sm transition-colors ${showArchived ? "bg-accent/10 border-accent/30 text-accent" : "bg-surface-elevated border-border text-text-muted hover:text-text-primary"}`}>
          {showArchived ? "Show Active" : "Show Archived"}
        </button>
      </div>

      {loading ? (
        <SkeletonList />
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-muted text-lg font-medium">No clients yet</p>
          <p className="text-text-muted text-sm mt-1">Add your first client to get started</p>
          <Button onClick={() => setModalClient("new")} className="mt-4"><Plus size={14} /> New Client</Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Address</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Currency</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{client.name}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{client.email ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-text-muted max-w-[200px] truncate">{client.address ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{client.currency}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModalClient(client)}
                          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => toggleArchive(client)}
                          className="p-1.5 rounded text-text-muted hover:text-warning hover:bg-warning/10 transition-colors">
                          {client.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
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
            {clients.map((client) => (
              <div key={client.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{client.name}</p>
                    {client.email && <p className="text-sm text-text-muted mt-0.5">{client.email}</p>}
                    {client.address && <p className="text-sm text-text-muted mt-0.5 truncate max-w-[200px]">{client.address}</p>}
                    <p className="text-xs text-text-muted mt-1">{client.currency}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModalClient(client)}
                      className="p-1.5 rounded text-text-muted hover:text-accent transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => toggleArchive(client)}
                      className="p-1.5 rounded text-text-muted hover:text-warning transition-colors">
                      {client.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modalClient !== null && (
        <ClientModal
          client={modalClient === "new" ? null : modalClient}
          onClose={() => setModalClient(null)}
          onSaved={() => { setModalClient(null); load(); }}
        />
      )}
    </PageShell>
  );
}
