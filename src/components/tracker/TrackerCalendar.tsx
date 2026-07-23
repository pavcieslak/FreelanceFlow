"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import { Project, TimeEntry } from "@/types";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface TrackerCalendarProps {
  projects: Project[];
  onBookingCreated: () => void;
}

type SlotMode = "TIMED" | "HALF_DAY" | "FULL_DAY";

function toIsoRange(date: Date) {
  return {
    start: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
    end: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
  };
}

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export default function TrackerCalendar({ projects, onBookingCreated }: TrackerCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [plannedEntries, setPlannedEntries] = useState<TimeEntry[]>([]);
  const [trackedEntries, setTrackedEntries] = useState<TimeEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [slotMode, setSlotMode] = useState<SlotMode>("HALF_DAY");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [billable, setBillable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const rangeStart = startOfMonth(month).toISOString();
      const rangeEnd = endOfMonth(month).toISOString();

      const [plannedRes, trackedRes] = await Promise.all([
        fetch(
          `/api/time-entries?planned=true&page=1&limit=500&startDate=${encodeURIComponent(rangeStart)}&endDate=${encodeURIComponent(rangeEnd)}`
        ),
        fetch(
          `/api/time-entries?planned=false&page=1&limit=500&startDate=${encodeURIComponent(rangeStart)}&endDate=${encodeURIComponent(rangeEnd)}`
        ),
      ]);

      const plannedData = await plannedRes.json();
      const trackedData = await trackedRes.json();
      setPlannedEntries(plannedData.entries ?? []);
      setTrackedEntries(trackedData.entries ?? []);
    }

    load().catch(() => {
      setPlannedEntries([]);
      setTrackedEntries([]);
    });
  }, [month]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [month]);

  const totalsByDay = useMemo(() => {
    const map = new Map<string, { planned: number; tracked: number }>();

    for (const entry of plannedEntries) {
      const key = dayKey(new Date(entry.startTime));
      const row = map.get(key) ?? { planned: 0, tracked: 0 };
      row.planned += entry.duration ?? 0;
      map.set(key, row);
    }

    for (const entry of trackedEntries) {
      const key = dayKey(new Date(entry.startTime));
      const row = map.get(key) ?? { planned: 0, tracked: 0 };
      row.tracked += entry.duration ?? 0;
      map.set(key, row);
    }

    return map;
  }, [plannedEntries, trackedEntries]);

  async function bookSlot() {
    setLoading(true);
    setError(null);
    try {
      const { start: dayStart } = toIsoRange(new Date(selectedDay));
      const baseDate = dayStart.slice(0, 10);
      const start = new Date(`${baseDate}T${startTime}`);

      let mode: "TIMER" | "HALF_DAY" | "FULL_DAY" = "TIMER";
      let end: Date | null = null;
      let duration: number | null = null;

      if (slotMode === "HALF_DAY") {
        mode = "HALF_DAY";
        duration = 4 * 60 * 60;
        end = new Date(start.getTime() + duration * 1000);
      } else if (slotMode === "FULL_DAY") {
        mode = "FULL_DAY";
        duration = 8 * 60 * 60;
        end = new Date(start.getTime() + duration * 1000);
      } else {
        mode = "TIMER";
        end = new Date(`${baseDate}T${endTime}`);
        duration = Math.floor((end.getTime() - start.getTime()) / 1000);
      }

      if (!duration || duration <= 0) {
        setError("End time must be after start time.");
        return;
      }

      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          projectId: projectId || null,
          billable,
          mode,
          isPlanned: true,
          startTime: start.toISOString(),
          endTime: end?.toISOString() ?? null,
          duration,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save booking.");
        return;
      }

      setDescription("");
      onBookingCreated();

      const rangeStart = startOfMonth(month).toISOString();
      const rangeEnd = endOfMonth(month).toISOString();
      const plannedRes = await fetch(
        `/api/time-entries?planned=true&page=1&limit=500&startDate=${encodeURIComponent(rangeStart)}&endDate=${encodeURIComponent(rangeEnd)}`
      );
      const plannedData = await plannedRes.json();
      setPlannedEntries(plannedData.entries ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-b border-border bg-surface/60 px-4 py-4 md:px-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Calendar Planner</h2>
          <p className="text-xs text-text-muted">Book half-day, full-day, or custom time slots for upcoming work.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((d) => startOfMonth(subMonths(d, 1)))}
            className="rounded-md border border-border bg-surface-elevated p-2 text-text-muted hover:text-text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[120px] text-center text-sm text-text-primary">
            {format(month, "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setMonth((d) => startOfMonth(addMonths(d, 1)))}
            className="rounded-md border border-border bg-surface-elevated p-2 text-text-muted hover:text-text-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const key = dayKey(day);
          const totals = totalsByDay.get(key) ?? { planned: 0, tracked: 0 };
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "rounded-md border p-2 text-left min-h-[84px] transition-colors",
                isSameDay(day, selectedDay)
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface-elevated hover:border-accent/40",
                !isSameMonth(day, month) && "opacity-40"
              )}
            >
              <div className="text-xs text-text-primary">{format(day, "d")}</div>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="text-warning">Planned: {(totals.planned / 3600).toFixed(1)}h</div>
                <div className="text-success">Tracked: {(totals.tracked / 3600).toFixed(1)}h</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface p-3">
        <div className="mb-3 flex items-center gap-2 text-sm text-text-primary">
          <CalendarPlus size={15} />
          <span>Book slot for {format(selectedDay, "EEE, MMM d")}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will you work on?"
            className="md:col-span-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary"
          />
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={slotMode}
            onChange={(e) => setSlotMode(e.target.value as SlotMode)}
            className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary"
          >
            <option value="HALF_DAY">Half day (4h)</option>
            <option value="FULL_DAY">Full day (8h)</option>
            <option value="TIMED">Custom time</option>
          </select>
          <button
            type="button"
            onClick={() => setBillable((v) => !v)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              billable
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-surface-elevated text-text-muted"
            )}
          >
            {billable ? "Billable" : "Non-billable"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary"
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={slotMode !== "TIMED"}
            className={cn(
              "rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary",
              slotMode !== "TIMED" && "cursor-not-allowed opacity-60"
            )}
          />
          <Button onClick={bookSlot} loading={loading} className="justify-center">
            Save booking
          </Button>
        </div>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
