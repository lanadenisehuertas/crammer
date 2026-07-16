import { History } from "lucide-react";
import { Card } from "./ui";
import { ShortcutHints } from "./ShortcutHints";
import { relativeTime } from "../lib/sessionStore";

/**
 * Shown before a review session starts when a saved session exists for this
 * activity + document. Enter resumes (wired by the page's useKeys map, which
 * guards so the same keypress never also reveals the first card).
 */
export function ResumeCard({
  progressLine,
  savedAt,
  onResume,
  onStartOver,
}: {
  progressLine: string;
  savedAt: number;
  onResume: () => void;
  onStartOver: () => void;
}) {
  return (
    <div>
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
          <History size={24} />
        </div>
        <p className="mb-1 font-bold text-ink">Pick up where you left off?</p>
        <p className="mb-5 text-sm text-muted">
          {progressLine} &middot; saved {relativeTime(savedAt)}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onStartOver}
            className="flex-1 rounded-full bg-lav py-3.5 text-sm font-bold text-ink"
          >
            Start over
          </button>
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-full bg-ink py-3.5 text-sm font-semibold text-white"
          >
            Resume
          </button>
        </div>
      </Card>
      <ShortcutHints hints={[{ keys: "Enter", label: "Resume" }]} />
    </div>
  );
}
