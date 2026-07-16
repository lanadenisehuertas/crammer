import { CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";

export function ScheduleListItem({
  title,
  date,
  documentId,
}: {
  title: string;
  date: string;
  documentId: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-white p-4 shadow-soft">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <CalendarClock size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{title}</p>
        <p className="text-xs text-muted">{date}</p>
      </div>
      <Link
        to={`/document/${documentId}`}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
      >
        Study
      </Link>
    </div>
  );
}
