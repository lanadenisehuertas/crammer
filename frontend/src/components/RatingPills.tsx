import { Rating } from "../lib/api";
import { cn } from "../lib/cn";

const RATINGS: { value: Rating; label: string; className: string }[] = [
  { value: "again", label: "Again", className: "bg-red-100 text-red-700 hover:bg-red-200" },
  { value: "hard", label: "Hard", className: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
  { value: "good", label: "Good", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" },
  { value: "easy", label: "Easy", className: "bg-lav text-ink hover:bg-primary hover:text-white" },
];

export function RatingPills({
  onRate,
  disabled,
}: {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          onClick={() => onRate(r.value)}
          className={cn(
            "rounded-full px-2 py-3 text-sm font-bold transition-colors disabled:opacity-50",
            r.className,
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
