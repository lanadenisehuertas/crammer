import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { api, CardOut } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { useKeys } from "../lib/useKeys";
import { ShortcutHints } from "../components/ShortcutHints";

export function PracticePage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);

  const [cards, setCards] = useState<CardOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .practice(docId)
      .then((res) => setCards(res.cards))
      .catch((e) => setError(e.message ?? "Could not load the practice test."));
  }, [docId]);

  async function grade(correct: boolean) {
    if (!cards || submitting) return;
    setSubmitting(true);
    try {
      await api.review(cards[index].id, correct ? "good" : "again");
      setResults((r) => [...r, correct]);
      setIndex((i) => i + 1);
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
        if (cards && index < cards.length && !revealed) setRevealed(true);
      },
      Enter: () => {
        if (cards && index < cards.length && !revealed) setRevealed(true);
      },
      "1": () => {
        if (revealed) grade(true);
      },
      "2": () => {
        if (revealed) grade(false);
      },
    },
    [cards, index, revealed, submitting],
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
