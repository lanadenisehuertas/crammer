import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function CalendarWidget({
  year,
  month,
  studyDays,
  examDays,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number; // 0-indexed
  studyDays: Set<string>;
  examDays: Set<string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const firstOfMonth = new Date(year, month, 1);
  // Monday-first: JS getDay() is 0=Sun..6=Sat, shift so Mon=0..Sun=6
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayIso = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-card bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-ink">
          {MONTH_LABELS[month]} {year}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-wash text-ink"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={onNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-wash text-ink"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const iso = toIso(year, month, day);
          const isToday = iso === todayIso;
          const isExam = examDays.has(iso);
          const isStudy = studyDays.has(iso);
          return (
            <div key={iso} className="flex aspect-square items-center justify-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                  isToday && "bg-ink text-white",
                  !isToday && isExam && "bg-amber-300 text-amber-900",
                  !isToday && !isExam && isStudy && "bg-lav text-ink",
                  !isToday && !isExam && !isStudy && "text-ink",
                )}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
