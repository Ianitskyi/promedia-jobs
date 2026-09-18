import type { CheckinResultState } from "@/lib/server/checkin";
import { useI18n } from "@/lib/i18n/client";

export interface ScannerResultData {
  state: CheckinResultState;
  attendee?: { firstName: string; lastName: string; company: string | null };
  checkedInAt?: string;
}

const STYLE: Record<CheckinResultState, { bg: string; fg: string }> = {
  CHECKED_IN: { bg: "bg-emerald-600", fg: "text-white" },
  ALREADY_CHECKED_IN: { bg: "bg-amber-500", fg: "text-white" },
  INVALID_TICKET: { bg: "bg-red-700", fg: "text-white" },
  WRONG_EVENT: { bg: "bg-red-700", fg: "text-white" },
  TICKET_REVOKED: { bg: "bg-red-700", fg: "text-white" },
};

// Dot-path keys resolved dynamically via t() — the state name doesn't
// match the dictionary key casing, so this is the one place a static
// dict.scanner.xyz property access doesn't fit, and the runtime
// locale -> English -> literal-path fallback in translate.ts matters
// for real rather than just as a safety net.
const LABEL_PATH: Record<CheckinResultState, string> = {
  CHECKED_IN: "scanner.stateCheckedIn",
  ALREADY_CHECKED_IN: "scanner.stateAlreadyCheckedIn",
  INVALID_TICKET: "scanner.stateInvalidTicket",
  WRONG_EVENT: "scanner.stateWrongEvent",
  TICKET_REVOKED: "scanner.stateTicketRevoked",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScannerResult({ state, attendee, checkedInAt }: ScannerResultData) {
  const { dict, t } = useI18n();
  const style = STYLE[state];
  const label = t(LABEL_PATH[state]);

  return (
    <div
      role="status"
      className={`flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center ${style.bg} ${style.fg}`}
    >
      <p className="text-2xl font-semibold uppercase tracking-wide">{label}</p>
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
          {state === "ALREADY_CHECKED_IN" ? dict.scanner.firstCheckInPrefix : ""}
          {formatTime(checkedInAt)}
        </p>
      )}
    </div>
  );
}
