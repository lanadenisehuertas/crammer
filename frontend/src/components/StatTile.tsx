import { ReactNode } from "react";
import { cn } from "../lib/cn";

export function StatTile({
  icon,
  label,
  value,
  tone = "primary",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: "primary" | "blue";
}) {
  return (
    <div
      className={cn(
        "flex-1 rounded-card p-5 text-white shadow-soft",
        tone === "primary" ? "bg-primary" : "bg-blue",
      )}
    >
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
        {icon}
      </div>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs font-medium text-white/80">{label}</p>
    </div>
  );
}
