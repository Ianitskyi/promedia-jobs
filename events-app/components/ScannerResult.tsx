import type { CheckinResultState } from "@/lib/server/checkin";

export interface ScannerResultData {
  state: CheckinResultState;
  attendee?: { firstName: string; lastName: string; company: string | null };
  checkedInAt?: string;
}

const CONFIG: Record<
  CheckinResultState,
  { label: string; bg: string; fg: string }
> = {
  CHECKED_IN: { label: "✓ Checked in", bg: "bg-emerald-600", fg: "text-white" },
  ALREADY_CHECKED_IN: { label: "Already checked in", bg: "bg-amber-500", fg: "text-white" },
  INVALID_TICKET: { label: "Invalid ticket", bg: "bg-red-700", fg: "text-white" },
  WRONG_EVENT: { label: "Wrong event", bg: "bg-red-700", fg: "text-white" },
  TICKET_REVOKED: { label: "Ticket revoked", bg: "bg-red-700", fg: "text-white" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScannerResult({ state, attendee, checkedInAt }: ScannerResultData) {
  const config = CONFIG[state];

  return (
    <div
      role="status"
      className={`flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center ${config.bg} ${config.fg}`}
    >
      <p className="text-2xl font-semibold uppercase tracking-wide">{config.label}</p>
      {attendee && (
        <div className="mt-2">
          <p className="text-xl font-medium">
            {attendee.firstName} {attendee.lastName}
          </p>
          {attendee.company && <p className="text-sm opacity-90">{attendee.company}</p>}
        </div>
      )}
      {checkedInAt && (
        <p className="mt-1 text-sm opacity-90">
          {state === "ALREADY_CHECKED_IN" ? "First check-in: " : ""}
          {formatTime(checkedInAt)}
        </p>
      )}
    </div>
  );
}
