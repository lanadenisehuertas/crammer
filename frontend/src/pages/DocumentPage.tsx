import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Check, ChevronDown, Copy, Sparkles } from "lucide-react";
import { api, DocDetail } from "../lib/api";
import { StatsRow } from "../components/StatsRow";
import { OriginBadge } from "../components/OriginBadge";
import { Card } from "../components/ui";
import { cn } from "../lib/cn";

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<number | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [examDate, setExamDate] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api
      .document(docId)
      .then((d) => {
        setDoc(d);
        setExamDate(d.exam_date ?? "");
      })
      .catch((e) => setError(e.message ?? "That document does not exist."));
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveExamDate() {
    try {
      await api.setExamDate(docId, examDate || null);
      setExamOpen(false);
      load();
    } catch (e) {
      setError((e as Error).message ?? "Could not save the exam date.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; ignore silently
    }
  }

  if (error) {
    return (
      <div className="rounded-card bg-white p-8 text-center shadow-soft">
        <p className="mb-4 font-semibold text-ink">{error}</p>
        <Link to="/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!doc) {
    return <div className="h-64 animate-pulse rounded-card bg-white/60" />;
  }

  return (
    <div>
      <div className="-mx-4 -mt-6 mb-6 rounded-b-card bg-primary px-4 pb-8 pt-6 text-white md:-mx-8 md:rounded-card md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Copy link"
            onClick={copyLink}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <Sparkles size={22} />
        </div>
        <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          {doc.source_type}
        </span>
        <h1 className="text-2xl font-extrabold leading-tight">{doc.title}</h1>
      </div>

      <div className="-mt-10 mb-6">
        <StatsRow modules={doc.modules_total} cards={doc.cards_total} due={doc.cards_due} />
      </div>

      {doc.cheat_sheet && (
        <Card className="mb-6 p-5">
          <h2 className="mb-2 text-base font-bold text-ink">Cheat sheet</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{doc.cheat_sheet}</p>
        </Card>
      )}

      <h2 className="mb-3 text-base font-bold text-ink">Modules</h2>
      <div className="mb-6 space-y-3">
        {doc.modules.map((m) => {
          const isOpen = openModule === m.id;
          return (
            <Card key={m.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenModule(isOpen ? null : m.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    m.finished ? "bg-emerald-500 text-white" : "bg-washAlt text-muted",
                  )}
                >
                  {m.finished ? <Check size={14} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{m.title}</span>
                  <span className="text-xs text-muted">
                    {m.cards_count} card{m.cards_count === 1 ? "" : "s"}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={cn("shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
                />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-ink/5 p-4">
                  {m.sections.map((s, i) => (
                    <div key={i}>
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{s.heading}</p>
                        <OriginBadge origin={s.origin} />
                      </div>
                      <p className="text-sm leading-relaxed text-muted">{s.content}</p>
                    </div>
                  ))}
                  {m.sections.length === 0 && (
                    <p className="text-sm text-muted">No notes for this module yet.</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {doc.modules.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">No modules yet.</Card>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="Bookmark"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-soft text-ink"
        >
          <Bookmark size={18} />
        </button>
        <Link
          to={`/study/${doc.id}?mode=due`}
          className="flex-1 rounded-full bg-ink py-3 text-center text-sm font-semibold text-white"
        >
          Start Studying
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          to={`/study/${doc.id}?mode=cram`}
          className="rounded-full bg-lav px-4 py-2 text-xs font-semibold text-ink"
        >
          Cram
        </Link>
        <Link
          to={`/study/${doc.id}?mode=weak`}
          className="rounded-full bg-mint px-4 py-2 text-xs font-semibold text-ink"
        >
          Weak spots
        </Link>
        <Link
          to={`/practice/${doc.id}`}
          className="rounded-full bg-washAlt px-4 py-2 text-xs font-semibold text-ink"
        >
          Practice
        </Link>
      </div>

      <div>
        {!examOpen ? (
          <button
            type="button"
            onClick={() => setExamOpen(true)}
            className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
          >
            {doc.exam_date ? `Exam date: ${doc.exam_date}` : "Set an exam date"}
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-white p-1.5 shadow-soft">
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="rounded-full bg-transparent px-3 py-1.5 text-xs font-semibold text-ink outline-none"
            />
            <button
              type="button"
              onClick={saveExamDate}
              className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
