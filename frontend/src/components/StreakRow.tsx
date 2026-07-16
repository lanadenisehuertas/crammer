import { ChevronRight } from "lucide-react";
import { Card } from "./ui";

export function StreakRow({ streak }: { streak: number }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">
        ⚡
      </div>
      <div className="flex-1">
        <p className="font-bold text-ink">
          {streak}-day learning streak{streak > 0 ? "!" : ""}
        </p>
        <p className="text-xs text-muted">Keep it up, review something every day.</p>
      </div>
      <ChevronRight size={18} className="text-muted" />
    </Card>
  );
}
