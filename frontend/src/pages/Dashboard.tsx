import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Sparkles } from "lucide-react";
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
        <div className="grid gap-4 pb-20 md:grid-cols-2 md:pb-0">
          {overview.documents.map((doc, i) => (
            <DocumentCard key={doc.id} doc={doc} index={i} />
          ))}
        </div>
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
