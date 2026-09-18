"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";

interface SearchResult {
  attendeeId: string;
  ticketId: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  checkedInAt: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ManualCheckin({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const searchActive = open && trimmedQuery.length >= 2;

  useEffect(() => {
    if (!searchActive) return;
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/events/${eventId}/attendees?q=${encodeURIComponent(trimmedQuery)}`,
      );
      if (res.ok) {
        const body = await res.json();
        setResults(body.results ?? []);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchActive, trimmedQuery, eventId]);

  const visibleResults = searchActive ? results : [];

  async function checkIn(result: SearchResult) {
    if (!result.ticketId) return;
    setPendingId(result.attendeeId);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ticketId: result.ticketId, method: "MANUAL" }),
      });
      const body = await res.json();
      if (res.ok && body.checkedInAt) {
        setResults((prev) =>
          prev.map((r) =>
            r.attendeeId === result.attendeeId ? { ...r, checkedInAt: body.checkedInAt } : r,
          ),
        );
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm underline underline-offset-2"
      >
        Can&apos;t scan the QR?
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <Input
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {visibleResults.map((r) => (
              <li key={r.attendeeId} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {r.firstName} {r.lastName}
                  </p>
                  {r.company && <p className="text-xs text-muted">{r.company}</p>}
                </div>
                {r.checkedInAt ? (
                  <StatusBadge tone="success">Checked in — {formatTime(r.checkedInAt)}</StatusBadge>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => checkIn(r)}
                    disabled={pendingId === r.attendeeId}
                  >
                    {pendingId === r.attendeeId ? "…" : "Check in"}
                  </Button>
                )}
              </li>
            ))}
            {searchActive && visibleResults.length === 0 && (
              <li className="py-3 text-sm text-muted">No matching attendees.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
