import { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ToolbarItem {
  key: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}

export function FloatingToolbar({ items }: { items: ToolbarItem[] }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-ink p-1.5 shadow-soft">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
            item.active ? "bg-primary text-white" : "text-white/70 hover:text-white",
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
