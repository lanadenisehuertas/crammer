import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Plus, Search, Sparkles } from "lucide-react";
import { api, Overview } from "../lib/api";
import { GreetingHeader } from "../components/TopHeader";
import { DocumentCard } from "../components/DocumentCard";

export function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .overview()
      .then(setOverview)
      .catch((e) => setError(e.message ?? "Failed to load your dashboard."));
  }, []);

  return (
    <div>
      <GreetingHeader name="You" masteryPct={overview?.mastery_pct ?? 0} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">Your Progress Today</h2>
        <button
          type="button"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-soft text-ink"
        >
          <Search size={16} />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-card bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {overview === null && !error && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-card bg-white/60" />
          ))}
        </div>
      )}

      {overview !== null && overview.documents.length === 0 && (
        <div className="rounded-card bg-white p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
            <Sparkles size={24} />
          </div>
          <p className="mb-1 font-bold text-ink">No documents yet</p>
          <p className="mb-5 text-sm text-muted">
            Upload notes or paste text to generate your first reviewer.
          </p>
          <Link
            to="/upload"
            className="inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
          >
            Upload your first document
          </Link>
        </div>
      )}

      {overview !== null && overview.documents.length > 0 && (
        <>
          {overview.cards_due_total > 0 ? (
            <Link
              to="/study/all"
              className="mb-4 block rounded-card bg-ink p-6 text-white shadow-soft transition-transform active:scale-[0.99]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
                <Flame size={20} />
              </div>
              <p className="mb-1 text-lg font-extrabold leading-snug">
                {overview.cards_due_total} card{overview.cards_due_total === 1 ? "" : "s"} due
                across your subjects
              </p>
              <p className="mb-5 text-sm text-white/70">Clear your whole queue in one session.</p>
              <span className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink">
                Study all due
              </span>
            </Link>
          ) : (
            <div className="mb-4 flex items-center gap-3 rounded-card bg-mint p-5 shadow-soft">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-ink">
                <Sparkles size={18} />
              </div>
              <p className="text-sm font-bold text-ink">All caught up ✨</p>
            </div>
          )}

          <div className="grid gap-4 pb-20 md:grid-cols-2 md:pb-0">
            {overview.documents.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} index={i} />
            ))}
          </div>
        </>
      )}

      <Link
        to="/upload"
        aria-label="Upload a new document"
        className="fixed bottom-24 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-soft md:bottom-10"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
