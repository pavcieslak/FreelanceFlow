"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, DollarSign, Clock, Plus } from "lucide-react";
import { Project, Tag } from "@/types";
import { formatDuration, cn } from "@/lib/utils";

interface TimerBarProps {
  projects: Project[];
  tags: Tag[];
  onEntryCreated: () => void;
}

export default function TimerBar({ projects, tags, onEntryCreated }: TimerBarProps) {
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [billable, setBillable] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const startInterval = useCallback((from: Date) => {
    startTimeRef.current = from;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - from.getTime()) / 1000));
    }, 1000);
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetch("/api/time-entries/active")
      .then((r) => r.json())
      .then((entry) => {
        if (entry?.id) {
          setActiveEntryId(entry.id);
          setIsRunning(true);
          setDescription(entry.description ?? "");
          setProjectId(entry.projectId ?? "");
          setBillable(entry.billable);
          startInterval(new Date(entry.startTime));
        }
      })
      .catch(() => {});
    return () => stopInterval();
  }, [startInterval, stopInterval]);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, projectId: projectId || null, tagIds, billable }),
      });
      const entry = await res.json();
      if (res.ok) {
        setActiveEntryId(entry.id);
        setIsRunning(true);
        setElapsed(0);
        startInterval(new Date(entry.startTime));
        onEntryCreated();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!activeEntryId) return;
    setLoading(true);
    try {
      const endTime = new Date().toISOString();
      await fetch(`/api/time-entries/${activeEntryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endTime, duration: elapsed }),
      });
      stopInterval();
      setIsRunning(false);
      setActiveEntryId(null);
      setElapsed(0);
      setDescription("");
      setProjectId("");
      setTagIds([]);
      setBillable(true);
      onEntryCreated();
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSubmit() {
    setLoading(true);
    try {
      const start = new Date(`${manualDate}T${manualStart}`);
      const end = new Date(`${manualDate}T${manualEnd}`);
      const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
      if (duration <= 0) return;
      await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          projectId: projectId || null,
          tagIds,
          billable,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          duration,
        }),
      });
      setDescription("");
      setProjectId("");
      setTagIds([]);
      onEntryCreated();
      setIsManual(false);
    } finally {
      setLoading(false);
    }
  }

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <div className="bg-surface border-b border-border px-4 py-3 shrink-0">
      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you working on?"
          className="flex-1 bg-surface-elevated border border-border rounded px-3 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm min-h-[44px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isRunning && !isManual) handleStart();
          }}
        />

        <div className="flex items-center gap-2">
          {/* Project selector */}
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-surface-elevated border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer min-h-[44px] pr-8"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.client ? ` · ${p.client.name}` : ""}
                </option>
              ))}
            </select>
            {selectedProject && (
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
                style={{ backgroundColor: selectedProject.color }}
              />
            )}
          </div>

          {/* Tag selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTagDropOpen((o) => !o)}
              className={cn(
                "bg-surface-elevated border border-border rounded px-3 py-2 text-sm min-h-[44px] transition-colors",
                tagIds.length > 0 ? "text-accent border-accent/50" : "text-text-muted hover:text-text-primary"
              )}
            >
              Tags {tagIds.length > 0 && `(${tagIds.length})`}
            </button>
            {tagDropOpen && (
              <div className="absolute top-full mt-1 right-0 bg-surface border border-border rounded-lg shadow-xl z-20 min-w-[160px] py-1">
                {tags.length === 0 && (
                  <div className="px-3 py-2 text-text-muted text-sm">No tags</div>
                )}
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-elevated cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={tagIds.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="accent-accent"
                    />
                    <span className="text-text-primary">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Billable toggle */}
          <button
            type="button"
            onClick={() => setBillable((b) => !b)}
            title={billable ? "Billable" : "Non-billable"}
            className={cn(
              "p-2.5 rounded border transition-colors min-h-[44px]",
              billable
                ? "bg-success/10 border-success/30 text-success"
                : "bg-surface-elevated border-border text-text-muted"
            )}
          >
            <DollarSign size={16} />
          </button>

          {/* Manual mode toggle */}
          <button
            type="button"
            onClick={() => setIsManual((m) => !m)}
            title="Manual mode"
            className={cn(
              "p-2.5 rounded border transition-colors min-h-[44px]",
              isManual
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-surface-elevated border-border text-text-muted hover:text-text-primary"
            )}
          >
            <Clock size={16} />
          </button>

          {isManual ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="bg-surface-elevated border border-border rounded px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent min-h-[44px]"
              />
              <input
                type="time"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="bg-surface-elevated border border-border rounded px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent min-h-[44px] w-24"
              />
              <span className="text-text-muted">–</span>
              <input
                type="time"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="bg-surface-elevated border border-border rounded px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent min-h-[44px] w-24"
              />
              <button
                onClick={handleManualSubmit}
                disabled={loading}
                className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded px-3 py-2 min-h-[44px] transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-text-primary min-w-[80px] text-center">
                {formatDuration(elapsed)}
              </span>
              {isRunning ? (
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="bg-danger hover:bg-danger/80 disabled:opacity-50 text-white rounded px-4 py-2 min-h-[44px] font-medium transition-colors flex items-center gap-2"
                >
                  <Square size={14} fill="currentColor" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded px-4 py-2 min-h-[44px] font-medium transition-colors flex items-center gap-2"
                >
                  <Play size={14} fill="currentColor" />
                  Start
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
