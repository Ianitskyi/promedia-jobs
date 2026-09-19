import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90",
  secondary:
    "bg-transparent text-foreground border border-[var(--border)] hover:bg-[var(--surface)]",
  ghost: "bg-transparent text-foreground hover:bg-[var(--surface)]",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
