import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, PartyPopper, X } from "lucide-react";
import { api, CardOut } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { useReviewQueue } from "../lib/useReviewQueue";
import { useKeys } from "../lib/useKeys";
import { isAnswerCorrect } from "../lib/grading";
import { ShortcutHints } from "../components/ShortcutHints";
import { SessionEndCard } from "../components/SessionEndCard";
import { ResumeCard } from "../components/ResumeCard";
import { clearSession, loadSession, saveSession } from "../lib/sessionStore";
import { cn } from "../lib/cn";

type Stage = "answering" | "feedback";

interface TypeSave {
  order: number[];
  index: number;
  correctCount: number;
  missedIds: number[];
}

interface PendingResume {
  savedAt: number;
  cards: CardOut[];
  index: number;
  correctCount: number;
  missed: CardOut[];
}

export function TypePage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const { cards: fetched, error } = useReviewQueue(docId, "cram");

  const [pending, setPending] = useState<PendingResume | null>(null);
  const [cards, setCards] = useState<CardOut[] | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<Stage>("answering");
  const [wasCorrect, setWasCorrect] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<CardOut[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fetched) return;
    if (fetched.length === 0) {
      setCards(fetched);
      return;
    }
    const byId = new Map(fetched.map((c) => [c.id, c]));
    const saved = loadSession<TypeSave>("type", docId);
    if (saved) {
      const order = saved.data.order.filter((cardId) => byId.has(cardId));
      const savedIndex = Math.min(saved.data.index, order.length);
      if (savedIndex > 0 && savedIndex < order.length) {
        setPending({
          savedAt: saved.savedAt,
          cards: order.map((cardId) => byId.get(cardId)!),
          index: savedIndex,
          correctCount: saved.data.correctCount,
          missed: saved.data.missedIds
            .filter((cardId) => byId.has(cardId))
            .map((cardId) => byId.get(cardId)!),
        });
        return;
      }
      clearSession("type", docId);
    }
    setCards(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched, docId]);

  // Autosave: a card counts as answered once feedback is showing, so a
  // resume never re-asks a question that was already graded.
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    const effIndex = stage === "feedback" ? index + 1 : index;
    if (effIndex >= cards.length) {
      clearSession("type", docId);
      return;
    }
    if (effIndex === 0) return;
    saveSession<TypeSave>("type", docId, {
      order: cards.map((c) => c.id),
      index: effIndex,
      correctCount,
      missedIds: missed.map((c) => c.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, index, stage, correctCount, missed]);

  function resume() {
    if (!pending) return;
    setCards(pending.cards);
    setIndex(pending.index);
    setCorrectCount(pending.correctCount);
    setMissed(pending.missed);
    setStage("answering");
    setValue("");
    setPending(null);
  }

  function startOver() {
    clearSession("type", docId);
    setPending(null);
    setCards(fetched ?? []);
    setIndex(0);
    setCorrectCount(0);
    setMissed([]);
    setStage("answering");
    setValue("");
  }

  const card = cards && index < cards.length ? cards[index] : null;

  useEffect(() => {
    if (stage === "answering") inputRef.current?.focus();
  }, [index, stage, cards]);

  async function submit() {
    if (!card || submitting || stage !== "answering" || !value.trim()) return;
    setSubmitting(true);
    const correct = isAnswerCorrect(value, card.answer);
    try {
      await api.review(card.id, correct ? "good" : "again");
      setWasCorrect(correct);
      setOverridden(false);
      if (correct) setCorrectCount((c) => c + 1);
      else setMissed((m) => [...m, card]);
      setStage("feedback");
      inputRef.current?.blur();
    } catch (e) {
      setRunError((e as Error).message ?? "Could not save that answer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function override() {
    if (!card || wasCorrect || overridden || submitting || stage !== "feedback") return;
    setSubmitting(true);
    try {
      await api.review(card.id, "good");
      setCorrectCount((c) => c + 1);
      setMissed((m) => m.filter((c) => c.id !== card.id));
      setOverridden(true);
    } catch (e) {
      setRunError((e as Error).message ?? "Could not save that override.");
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    if (stage !== "feedback") return;
    setValue("");
    setWasCorrect(false);
    setOverridden(false);
    setStage("answering");
    setIndex((i) => i + 1);
  }

  function retry() {
    clearSession("type", docId);
    setIndex(0);
    setValue("");
    setStage("answering");
    setWasCorrect(false);
    setOverridden(false);
    setCorrectCount(0);
    setMissed([]);
    setRunError(null);
  }

  useKeys(
    {
      Enter: () => {
        // Guard: while the resume prompt is up, Enter only resumes.
        if (pending) {
          resume();
          return;
        }
        advance();
      },
      o: () => {
        if (!pending) override();
      },
    },
    [pending, stage, card?.id, wasCorrect, overridden, submitting],
  );

  if (error || runError) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 font-semibold text-ink">{error ?? runError}</p>
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
        progressLine={`${pending.index} of ${pending.cards.length} done`}
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
          <PartyPopper size={24} />
        </div>
        <p className="mb-1 font-bold text-ink">Nothing to type yet</p>
        <p className="mb-5 text-sm text-muted">Add some cards to this document first.</p>
        <Link to={`/document/${docId}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Back to document
        </Link>
      </Card>
    );
  }

  if (index >= cards.length) {
    const pct = Math.round((correctCount / cards.length) * 100);
    return (
      <SessionEndCard
        scorePct={pct}
        statLine={`${correctCount} of ${cards.length} correct`}
        subtitle="Nice work — review the missed ones below."
        docId={docId}
        onRetry={retry}
      >
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
      </SessionEndCard>
    );
  }

  const progressPct = (index / cards.length) * 100;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        TYPE &middot; {index + 1} of {cards.length}
      </p>
      <Progress value={progressPct} className="mb-6 h-1.5" />

      <Card className="mb-6 flex min-h-[280px] flex-col justify-center p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Question</p>
        <p className="mt-3 text-xl font-bold leading-snug text-ink">{card!.question}</p>

        <div className="mx-auto mt-6 w-full max-w-sm">
          <input
            ref={inputRef}
            type="text"
            value={value}
            disabled={stage === "feedback"}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Type your answer"
            className={cn(
              "w-full rounded-full border px-5 py-3 text-center text-sm font-semibold text-ink outline-none",
              stage === "feedback"
                ? wasCorrect || overridden
                  ? "border-emerald-300 bg-mint"
                  : "border-red-300 bg-red-50"
                : "border-ink/10 bg-white focus:border-primary",
            )}
          />
        </div>

        {stage === "feedback" && (
          <div className="mt-4">
            <p
              className={cn(
                "mb-1 flex items-center justify-center gap-1.5 text-sm font-bold",
                wasCorrect || overridden ? "text-emerald-700" : "text-red-700",
              )}
            >
              {wasCorrect || overridden ? <Check size={16} /> : <X size={16} />}
              {wasCorrect ? "Correct" : overridden ? "Marked correct" : "Not quite"}
            </p>
            <p className="text-sm text-muted">
              Expected: <span className="font-semibold text-ink">{card!.answer}</span>
            </p>
          </div>
        )}
      </Card>

      {stage === "answering" ? (
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !value.trim()}
          className="w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Submit
        </button>
      ) : (
        <div className="flex gap-3">
          {!wasCorrect && !overridden && (
            <button
              type="button"
              onClick={override}
              disabled={submitting}
              className="flex-1 rounded-full bg-lav py-3.5 text-sm font-bold text-ink disabled:opacity-50"
            >
              I was right
            </button>
          )}
          <button
            type="button"
            onClick={advance}
            className="flex-1 rounded-full bg-ink py-3.5 text-sm font-semibold text-white"
          >
            Next
          </button>
        </div>
      )}

      <ShortcutHints
        hints={
          stage === "answering"
            ? [{ keys: "Enter", label: "Submit" }]
            : [
                { keys: "Enter", label: "Next" },
                ...(!wasCorrect && !overridden ? [{ keys: "O", label: "I was right" }] : []),
              ]
        }
      />
    </div>
  );
}
