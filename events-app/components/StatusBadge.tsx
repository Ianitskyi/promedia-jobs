type Tone = "neutral" | "success" | "warning" | "danger" | "info";

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--surface)] text-foreground border-[var(--border)]",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-[var(--accent-tint)] text-[var(--accent-dark)] border-[var(--accent-dark)]",
  danger: "bg-red-50 text-red-800 border-red-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
