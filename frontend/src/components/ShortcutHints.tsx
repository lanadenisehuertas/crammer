import { cn } from "../lib/cn";

export interface ShortcutHint {
  keys: string;
  label: string;
}

/**
 * Small muted row of "kbd chip + label" hints shown at the bottom of every
 * review screen, e.g. [Space] Reveal  ·  [1–4] Rate
 */
export function ShortcutHints({ hints, className }: { hints: ShortcutHint[]; className?: string }) {
  return (
    <div className={cn("mt-6 flex flex-wrap items-center justify-center gap-2", className)}>
      {hints.map((h) => (
        <span
          key={h.keys + h.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[11px] font-medium text-muted"
        >
          <kbd className="rounded border border-ink/10 bg-washAlt px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink">
            {h.keys}
          </kbd>
          {h.label}
        </span>
      ))}
    </div>
  );
}
