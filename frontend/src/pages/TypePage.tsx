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
import { cn } from "../lib/cn";

type Stage = "answering" | "feedback";

export function TypePage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const { cards, error } = useReviewQueue(docId, "cram");

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

  const card = cards && index < cards.length ? cards[index] : null;

  useEffect(() => {
    if (stage === "answering") inputRef.current?.focus();
  }, [index, stage]);

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
      Enter: () => advance(),
      o: () => override(),
    },
    [stage, card?.id, wasCorrect, overridden, submitting],
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
