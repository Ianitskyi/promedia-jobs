import { Logo } from "@/components/Logo";

interface TicketProps {
  organizationName: string;
  organizationLogoUrl: string | null;
  eventLogoUrl: string | null;
  eventName: string;
  attendeeName: string;
  attendeeCompany: string | null;
  dateLabel: string;
  venueName: string | null;
  address: string | null;
  qrSvg: string;
}

export function Ticket({
  organizationName,
  organizationLogoUrl,
  eventLogoUrl,
  eventName,
  attendeeName,
  attendeeCompany,
  dateLabel,
  venueName,
  address,
  qrSvg,
}: TicketProps) {
  return (
    <div className="mx-auto w-full max-w-sm border border-[var(--border)] bg-background">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-6 py-4">
        <Logo name={organizationName} logoUrl={eventLogoUrl ?? organizationLogoUrl} />
        <span className="text-sm font-medium">{organizationName}</span>
      </div>

      <div className="px-6 py-6 text-center">
        <h1 className="font-serif text-2xl italic">{eventName}</h1>
        <p className="mt-1 text-sm text-muted">{dateLabel}</p>
        {venueName && <p className="text-sm text-muted">{venueName}</p>}
        {address && <p className="text-xs text-muted">{address}</p>}
      </div>

      <div
        className="mx-auto flex w-full max-w-[260px] items-center justify-center px-6 pb-6 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <div className="border-t border-[var(--border)] px-6 py-4 text-center">
        <p className="font-medium">{attendeeName}</p>
        {attendeeCompany && <p className="text-sm text-muted">{attendeeCompany}</p>}
      </div>
    </div>
  );
}
