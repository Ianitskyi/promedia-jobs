interface LogoProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
}

/** Organization or event branding mark. Falls back to initials — no hardcoded brand. */
export function Logo({ name, logoUrl, size = 32 }: LogoProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external, org-supplied URLs, size varies per call site
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-sm object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-sm bg-[var(--accent)] font-serif font-medium text-[var(--accent-foreground)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials || "?"}
    </span>
  );
}
