import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { api, CardOut } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { useKeys } from "../lib/useKeys";
import { ShortcutHints } from "../components/ShortcutHints";
import { ResumeCard } from "../components/ResumeCard";
import { clearSession, loadSession, saveSession } from "../lib/sessionStore";

interface PracticeSave {
  order: number[];
  results: boolean[];
}

interface PendingResume {
  savedAt: number;
  cards: CardOut[];
  results: boolean[];
}

export function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);

  const [fetched, setFetched] = useState<CardOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResume | null>(null);

  // The session's card order (the server shuffles each fetch, so a resumed
  // session restores its own saved order).
  const [cards, setCards] = useState<CardOut[] | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const index = results.length;

  useEffect(() => {
    let cancelled = false;
    api
      .practice(docId)
      .then((res) => {
        if (cancelled) return;
        setFetched(res.cards);
        const byId = new Map(res.cards.map((c) => [c.id, c]));
        const saved = loadSession<PracticeSave>("practice", docId);
        if (saved) {
          const keptOrder: number[] = [];
          const keptResults: boolean[] = [];
          saved.data.order.forEach((cardId, i) => {
            if (!byId.has(cardId)) return; // drop vanished cards
            keptOrder.push(cardId);
            if (i < saved.data.results.length) keptResults.push(saved.data.results[i]);
          });
          if (keptResults.length > 0 && keptResults.length < keptOrder.length) {
            setPending({
              savedAt: saved.savedAt,
              cards: keptOrder.map((cardId) => byId.get(cardId)!),
              results: keptResults,
            });
            return;
          }
          clearSession("practice", docId);
        }
        setCards(res.cards);
        setResults([]);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Could not load the practice test.");
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Autosave progress; clear once the test is finished.
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    if (results.length >= cards.length) {
      clearSession("practice", docId);
      return;
    }
    if (results.length === 0) return;
    saveSession<PracticeSave>("practice", docId, {
      order: cards.map((c) => c.id),
      results,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, results]);

  function resume() {
    if (!pending) return;
    setCards(pending.cards);
    setResults(pending.results);
    setRevealed(false);
    setPending(null);
  }

  function startOver() {
    clearSession("practice", docId);
    setPending(null);
    setCards(fetched ?? []);
    setResults([]);
    setRevealed(false);
  }

  async function grade(correct: boolean) {
    if (!cards || index >= cards.length || submitting) return;
    setSubmitting(true);
    try {
      await api.review(cards[index].id, correct ? "good" : "again");
      setResults((r) => [...r, correct]);
      setRevealed(false);
    } catch (e) {
      setError((e as Error).message ?? "Could not save that answer.");
    } finally {
      setSubmitting(false);
    }
  }

  useKeys(
    {
      " ": () => {
        if (!pending && cards && index < cards.length && !revealed) setRevealed(true);
      },
      Enter: () => {
        // Guard: while the resume prompt is up, Enter only resumes.
        if (pending) {
          resume();
          return;
        }
        if (cards && index < cards.length && !revealed) setRevealed(true);
      },
      "1": () => {
        if (!pending && revealed) grade(true);
      },
      "2": () => {
        if (!pending && revealed) grade(false);
      },
    },
    [pending, cards, results, revealed, submitting],
  );

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 font-semibold text-ink">{error}</p>
        <Link to={`/document/${docId}`} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          Back to document
        </Link>
      </Card>
    );
  }

  if (fetched === null) {
    return <div className="h-64 animate-pulse rounded-card bg-white/60" />;
  }

  if (pending) {
    return (
      <ResumeCard
        progressLine={`${pending.results.length} of ${pending.cards.length} done`}
        savedAt={pending.savedAt}
        onResume={resume}
        onStartOver={startOver}
      />
    );
  }

  if (cards === null) {
    return <div className="h-64 animate-pulse rounded-card bg-white/60" />;
  }

  if (cards.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-1 font-bold text-ink">No cards to test yet</p>
        <p className="mb-5 text-sm text-muted">Study this document first to build a practice test.</p>
        <Link to={`/document/${docId}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Back to document
        </Link>
      </Card>
    );
  }

  if (index >= cards.length) {
    const correctCount = results.filter(Boolean).length;
    const pct = Math.round((correctCount / cards.length) * 100);
    const missed = cards.filter((_, i) => results[i] === false);
    return (
      <div>
        <Card className="mb-6 p-8 text-center">
          <div className="relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-lav">
            <span className="text-3xl font-extrabold text-primary">{pct}%</span>
          </div>
          <p className="mb-1 font-bold text-ink">
            {correctCount} of {cards.length} correct
          </p>
          <p className="text-sm text-muted">Nice work — review the missed ones below.</p>
        </Card>

        {missed.length > 0 && (
          <div className="mb-6 space-y-3">
            <h2 className="text-base font-bold text-ink">Missed questions</h2>
            {missed.map((c) => (
              <Card key={c.id} className="p-4">
                <p className="mb-1 text-sm font-semibold text-ink">{c.question}</p>
                <p className="text-sm text-muted">{c.answer}</p>
              </Card>
            ))}
          </div>
        )}

        <Link to={`/document/${docId}`} className="block w-full rounded-full bg-ink py-3.5 text-center text-sm font-semibold text-white">
          Back to document
        </Link>
      </div>
    );
  }

  const card = cards[index];
  const progressPct = (index / cards.length) * 100;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Practice test &middot; {index + 1} of {cards.length}
      </p>
      <Progress value={progressPct} className="mb-6 h-1.5" />

      <Card className="mb-6 flex min-h-[280px] flex-col justify-center p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Question</p>
        <p className="mt-3 text-xl font-bold leading-snug text-ink">{card.question}</p>
        {revealed && (
          <>
            <div className="my-5 h-px bg-ink/5" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Answer</p>
            <p className="mt-3 text-lg font-semibold leading-snug text-ink">{card.answer}</p>
          </>
        )}
      </Card>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-white"
        >
          Show answer
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => grade(false)}
            className="flex items-center justify-center gap-2 rounded-full bg-red-100 py-3.5 text-sm font-bold text-red-700 disabled:opacity-50"
          >
            <X size={16} /> Missed it
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => grade(true)}
            className="flex items-center justify-center gap-2 rounded-full bg-emerald-100 py-3.5 text-sm font-bold text-emerald-800 disabled:opacity-50"
          >
            <Check size={16} /> I got it
          </button>
        </div>
      )}

      <ShortcutHints
        hints={
          revealed
            ? [
                { keys: "1", label: "Got it" },
                { keys: "2", label: "Missed it" },
              ]
            : [{ keys: "Space", label: "Reveal" }]
        }
      />
    </div>
  );
}
