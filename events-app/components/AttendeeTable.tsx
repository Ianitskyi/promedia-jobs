"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/Input";
import { StatusBadge } from "@/components/StatusBadge";
import type { AttendeeRow } from "@/lib/server/attendees";

type Filter = "all" | "checked_in" | "not_checked_in";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AttendeeTable({ attendees }: { attendees: AttendeeRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attendees.filter((a) => {
      if (filter === "checked_in" && !a.checkedInAt) return false;
      if (filter === "not_checked_in" && a.checkedInAt) return false;
      if (!q) return true;
      return (
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [attendees, query, filter]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search attendees"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-1 text-sm">
          {(
            [
              ["all", "All"],
              ["checked_in", "Checked in"],
              ["not_checked_in", "Not checked in"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-sm px-3 py-1.5 ${
                filter === value
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-muted hover:bg-[var(--surface)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Organization</th>
              <th className="py-2 pr-4 font-medium">Registered</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Checked in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-[var(--border)]">
                <td className="py-2.5 pr-4">
                  {a.firstName} {a.lastName}
                </td>
                <td className="py-2.5 pr-4 text-muted">{a.email}</td>
                <td className="py-2.5 pr-4 text-muted">{a.company ?? "—"}</td>
                <td className="py-2.5 pr-4 text-muted">{formatDateTime(a.registeredAt)}</td>
                <td className="py-2.5 pr-4">
                  {a.checkedInAt ? (
                    <StatusBadge tone="success">Checked in</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Not checked in</StatusBadge>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-muted">
                  {a.checkedInAt ? formatDateTime(a.checkedInAt) : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  No attendees match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
