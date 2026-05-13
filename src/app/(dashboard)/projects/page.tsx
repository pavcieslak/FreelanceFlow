"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import ProjectModal from "@/components/projects/ProjectModal";
import { Project, Client } from "@/types";
import { formatDuration } from "@/lib/utils";
import { SkeletonList } from "@/components/ui/Skeleton";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [modalProject, setModalProject] = useState<Project | null | "new">(null);

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        fetch(`/api/projects?archived=${showArchived}`).then((r) => r.json()),
        fetch("/api/clients?archived=false").then((r) => r.json()),
      ]);
      setProjects(p);
      setClients(c);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [showArchived]);

  async function toggleArchive(project: Project) {
    await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.archived }),
    });
    load();
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageShell
      title="Projects"
      action={
        <Button onClick={() => setModalProject("new")} size="sm">
          <Plus size={14} /> New Project
        </Button>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="bg-surface-elevated border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent text-sm flex-1 max-w-xs"
        />
        <button
          onClick={() => setShowArchived((a) => !a)}
          className={`px-3 py-2 rounded border text-sm transition-colors ${showArchived ? "bg-accent/10 border-accent/30 text-accent" : "bg-surface-elevated border-border text-text-muted hover:text-text-primary"}`}
        >
          {showArchived ? "Active" : "Archived"}
        </button>
      </div>

      {loading ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-muted text-lg font-medium">No projects yet</p>
          <p className="text-text-muted text-sm mt-1">Create your first project to start tracking time</p>
          <Button onClick={() => setModalProject("new")} className="mt-4">
            <Plus size={14} /> New Project
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Client</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr key={project.id} className="border-b border-border last:border-b-0 hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        <span className="font-medium text-text-primary">{project.name}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted">{project.client?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModalProject(project)}
                          className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => toggleArchive(project)}
                          className="p-1.5 rounded text-text-muted hover:text-warning hover:bg-warning/10 transition-colors">
                          {project.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
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
            {filtered.map((project) => (
              <div key={project.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/projects/${project.id}`} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                    <span className="font-medium text-text-primary">{project.name}</span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModalProject(project)}
                      className="p-1.5 rounded text-text-muted hover:text-accent transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => toggleArchive(project)}
                      className="p-1.5 rounded text-text-muted hover:text-warning transition-colors">
                      {project.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    </button>
                  </div>
                </div>
                {project.client && (
                  <p className="text-sm text-text-muted mt-1 ml-5">{project.client.name}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {modalProject !== null && (
        <ProjectModal
          project={modalProject === "new" ? null : modalProject}
          clients={clients}
          onClose={() => setModalProject(null)}
          onSaved={() => { setModalProject(null); load(); }}
        />
      )}
    </PageShell>
  );
}
