import React from "react";
import { cn } from "../lib/cn";

// ---------------------------------------------------------------------------
// Vendored shadcn-style primitives (hand-written, no CLI, no Radix).
// ---------------------------------------------------------------------------

type ButtonVariant = "pill-dark" | "pill-primary" | "pill-outline" | "ghost" | "icon-circle";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  "pill-dark":
    "rounded-full bg-ink text-white font-semibold px-6 py-3 hover:bg-ink2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  "pill-primary":
    "rounded-full bg-primary text-white font-semibold px-6 py-3 hover:bg-primarySoft active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  "pill-outline":
    "rounded-full border border-ink/10 bg-white text-ink font-semibold px-6 py-3 hover:bg-wash active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  ghost:
    "rounded-full text-ink font-medium px-4 py-2 hover:bg-white/60 disabled:opacity-50 disabled:pointer-events-none",
  "icon-circle":
    "h-10 w-10 shrink-0 rounded-full bg-white shadow-soft flex items-center justify-center text-ink hover:bg-wash active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "pill-dark", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 text-sm transition-all",
        buttonVariantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-white shadow-soft", className)} {...props} />;
}

type BadgeTone = "mint" | "lav" | "ink" | "yellow" | "white";

const badgeToneClasses: Record<BadgeTone, string> = {
  mint: "bg-mint text-ink",
  lav: "bg-lav text-ink",
  ink: "bg-ink text-white",
  yellow: "bg-amber-200 text-amber-900",
  white: "bg-white text-ink shadow-soft",
};

export function Badge({
  tone = "lav",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        badgeToneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-primary text-white font-bold flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </div>
  );
}

export function Progress({
  value,
  className,
  trackClassName,
  barClassName,
}: {
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full rounded-full bg-washAlt overflow-hidden", trackClassName, className)}>
      <div
        className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export interface TabItem {
  value: string;
  label: string;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-soft", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            item.value === value ? "bg-ink text-white" : "text-muted hover:text-ink",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
