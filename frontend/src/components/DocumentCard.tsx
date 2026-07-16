import { ArrowUpRight, BookOpen, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { DocSummary } from "../lib/api";
import { Badge } from "./ui";

export function DocumentCard({ doc, index }: { doc: DocSummary; index: number }) {
  const bg = index % 2 === 0 ? "bg-mint" : "bg-lav";
  return (
    <Link
      to={`/document/${doc.id}`}
      className={`block rounded-card ${bg} p-5 shadow-soft transition-transform active:scale-[0.99]`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink">
          <BookOpen size={18} />
        </div>
        <Badge tone="white">{doc.mastery_pct}% mastered</Badge>
      </div>

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink/60">
        {doc.source_type}
      </p>
      <h3 className="mb-4 line-clamp-2 text-lg font-bold leading-snug text-ink">{doc.title}</h3>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink">
            <Layers size={12} />
            {doc.modules_total} module{doc.modules_total === 1 ? "" : "s"}
          </span>
          {doc.cards_due > 0 && (
            <span className="inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
              {doc.cards_due} due
            </span>
          )}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-soft text-ink">
          <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}
