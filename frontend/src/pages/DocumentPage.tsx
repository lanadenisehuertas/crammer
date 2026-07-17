import { ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  Flame,
  Keyboard,
  Layers,
  ListChecks,
  Loader2,
  Printer,
  Shuffle,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { api, DocDetail } from "../lib/api";
import { StatsRow } from "../components/StatsRow";
import { OriginBadge } from "../components/OriginBadge";
import { ModuleCardsList } from "../components/ModuleCardsList";
import { Button, Card } from "../components/ui";
import { cn } from "../lib/cn";
import { clearAllSessionsForDocument } from "../lib/sessionStore";

function ReviewModeTile({
  to,
  icon,
  label,
  description,
  tint,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  description: string;
  tint: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft transition-transform active:scale-[0.98]"
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", tint)}>{icon}</div>
      <div>
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
    </Link>
  );
}

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
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cheatCopied, setCheatCopied] = useState(false);

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

  async function retryGeneration() {
    setRetrying(true);
    setRetryError(null);
    // Poll alongside the request: if the browser drops the long-running
    // request, generation still finishes server-side — detect it by the
    // modules appearing rather than trusting the HTTP response alone.
    const poll = window.setInterval(async () => {
      try {
        const fresh = await api.document(docId);
        if (fresh.modules.length > 0) {
          window.clearInterval(poll);
          setRetrying(false);
          setDoc(fresh);
        }
      } catch {
        /* transient poll failure: keep trying */
      }
    }, 4000);
    try {
      await api.generateDocument(docId);
      load();
      window.clearInterval(poll);
      setRetrying(false);
    } catch (e) {
      if (!(e instanceof TypeError)) {
        // Real server-reported failure; a network drop keeps the poller alive.
        window.clearInterval(poll);
        setRetrying(false);
        setRetryError((e as Error).message ?? "Could not retry generation.");
      }
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

  async function deleteDocument() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteDocument(docId);
      clearAllSessionsForDocument(docId);
      navigate("/");
    } catch (e) {
      setDeleteError((e as Error).message ?? "Could not delete this document.");
    } finally {
      setDeleting(false);
    }
  }

  async function copyCheatSheet() {
    if (!doc?.cheat_sheet) return;
    try {
      await navigator.clipboard.writeText(doc.cheat_sheet);
      setCheatCopied(true);
      setTimeout(() => setCheatCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; ignore silently
    }
  }

  function printCheatSheet() {
    window.print();
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Copy link"
              onClick={copyLink}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <button
              type="button"
              aria-label="Delete document"
              onClick={() => setConfirmDelete(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
            >
              <Trash2 size={18} />
            </button>
          </div>
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

      {confirmDelete && (
        <Card className="mb-6 p-5">
          <p className="mb-1 font-bold text-ink">Delete this document and all its cards?</p>
          <p className="mb-4 text-sm text-muted">This can&apos;t be undone.</p>
          {deleteError && (
            <div className="mb-4 rounded-card bg-red-50 p-3 text-sm font-medium text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 rounded-full bg-washAlt py-3 text-sm font-bold text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deleteDocument}
              disabled={deleting}
              className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Card>
      )}

      {doc.cheat_sheet && (
        <Card className="mb-6 p-5 print:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">Cheat sheet</h2>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={copyCheatSheet}
                className="inline-flex items-center gap-1.5 rounded-full bg-washAlt px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {cheatCopied ? <Check size={13} /> : <Copy size={13} />}
                {cheatCopied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={printCheatSheet}
                className="inline-flex items-center gap-1.5 rounded-full bg-washAlt px-3 py-1.5 text-xs font-semibold text-ink"
              >
                <Printer size={13} />
                Print
              </button>
            </div>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{doc.cheat_sheet}</p>
        </Card>
      )}

      {doc.cheat_sheet &&
        typeof document !== "undefined" &&
        document.getElementById("root") &&
        createPortal(
          <div id="print-cheat-sheet">
            <h1>{doc.title}</h1>
            <pre>{doc.cheat_sheet}</pre>
          </div>,
          document.getElementById("root")!,
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
                  <ModuleCardsList docId={doc.id} moduleId={m.id} cards={m.cards} onChanged={load} />
                </div>
              )}
            </Card>
          );
        })}
        {doc.modules.length === 0 && (
          <Card className="p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-200 text-amber-800">
              <AlertTriangle size={18} />
            </div>
            <h3 className="mb-1 text-base font-bold text-ink">Generation didn&apos;t finish</h3>
            <p className="mb-4 text-sm text-muted">
              Your notes are saved, but Crammer couldn&apos;t generate the reviewer for them.
              Fix the issue below if there is one, then retry — nothing was lost.
            </p>
            {retryError && (
              <div className="mb-4 rounded-card bg-red-50 p-4 text-sm font-medium text-red-700">
                {retryError}
              </div>
            )}
            <Button variant="pill-dark" onClick={retryGeneration} disabled={retrying}>
              {retrying && <Loader2 size={16} className="animate-spin" />}
              {retrying ? "Retrying…" : "Retry generation"}
            </Button>
          </Card>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Review</h2>
        <button
          type="button"
          aria-label="Bookmark"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-soft text-ink"
        >
          <Bookmark size={16} />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <ReviewModeTile
          to={`/study/${doc.id}?mode=due`}
          icon={<Layers size={18} className="text-primary" />}
          label="Flashcards"
          description="Due for review"
          tint="bg-lav"
        />
        <ReviewModeTile
          to={`/quiz/${doc.id}`}
          icon={<ListChecks size={18} className="text-emerald-700" />}
          label="Quiz"
          description="Multiple choice"
          tint="bg-mint"
        />
        <ReviewModeTile
          to={`/type/${doc.id}`}
          icon={<Keyboard size={18} className="text-blue" />}
          label="Type answers"
          description="Type what you recall"
          tint="bg-blue/10"
        />
        <ReviewModeTile
          to={`/match/${doc.id}`}
          icon={<Shuffle size={18} className="text-amber-800" />}
          label="Match"
          description="Pair terms & answers"
          tint="bg-amber-200"
        />
        <ReviewModeTile
          to={`/practice/${doc.id}`}
          icon={<Target size={18} className="text-primary" />}
          label="Practice test"
          description="Exam simulation"
          tint="bg-lav"
        />
        <ReviewModeTile
          to={`/study/${doc.id}?mode=cram`}
          icon={<Flame size={18} className="text-emerald-700" />}
          label="Cram all"
          description="Every card, right now"
          tint="bg-mint"
        />
      </div>

      <Link
        to={`/study/${doc.id}?mode=weak`}
        className="mb-6 inline-block rounded-full bg-washAlt px-4 py-2 text-xs font-semibold text-ink"
      >
        Drill weak spots
      </Link>

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
