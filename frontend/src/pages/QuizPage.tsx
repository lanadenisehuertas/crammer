import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, PartyPopper, XCircle } from "lucide-react";
import { api, CardOut } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { useReviewQueue } from "../lib/useReviewQueue";
import { useKeys } from "../lib/useKeys";
import { shuffle } from "../lib/shuffle";
import { ShortcutHints } from "../components/ShortcutHints";
import { SessionEndCard } from "../components/SessionEndCard";
import { cn } from "../lib/cn";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

function buildOptions(card: CardOut, allCards: CardOut[]): string[] {
  const distractorPool = Array.from(
    new Set(
      allCards
        .filter((c) => c.id !== card.id && c.answer !== card.answer)
        .map((c) => c.answer),
    ),
  );
  const distractors = shuffle(distractorPool).slice(0, MAX_OPTIONS - 1);
  return shuffle([card.answer, ...distractors]);
}

export function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const { cards, error } = useReviewQueue(docId, "cram");

  const [index, setIndex] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<{ card: CardOut; chosen: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const card = cards && index < cards.length ? cards[index] : null;

  const options = useMemo(() => {
    if (!cards || !card) return [];
    return buildOptions(card, cards);
    // shuffleSeed forces a reshuffle on "Try again"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, card?.id, shuffleSeed]);

  async function choose(optIndex: number) {
    if (!card || selected !== null || submitting || optIndex >= options.length) return;
    setSubmitting(true);
    const isCorrect = options[optIndex] === card.answer;
    try {
      await api.review(card.id, isCorrect ? "good" : "again");
      setSelected(optIndex);
      if (isCorrect) setCorrectCount((c) => c + 1);
      else setMissed((m) => [...m, { card, chosen: options[optIndex] }]);
    } catch (e) {
      setRunError((e as Error).message ?? "Could not save that answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    if (selected === null) return;
    setSelected(null);
    setIndex((i) => i + 1);
  }

  function retry() {
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setMissed([]);
    setRunError(null);
    setShuffleSeed((s) => s + 1);
  }

  useKeys(
    {
      "1": () => choose(0),
      "2": () => choose(1),
      "3": () => choose(2),
      "4": () => choose(3),
      " ": () => advance(),
      Enter: () => advance(),
    },
    [card?.id, selected, options, submitting],
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

  if (cards.length < MIN_OPTIONS) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
          <PartyPopper size={24} />
        </div>
        <p className="mb-1 font-bold text-ink">Not enough cards for a quiz</p>
        <p className="mb-5 text-sm text-muted">Add a few more cards to this document to unlock quiz mode.</p>
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
            {missed.map(({ card: c, chosen }) => (
              <Card key={c.id} className="p-4">
                <p className="mb-1 text-sm font-semibold text-ink">{c.question}</p>
                <p className="text-sm text-red-600">You picked: {chosen}</p>
                <p className="text-sm text-emerald-700">Correct: {c.answer}</p>
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
        QUIZ &middot; {index + 1} of {cards.length}
      </p>
      <Progress value={progressPct} className="mb-6 h-1.5" />

      <Card className="mb-6 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Question</p>
        <p className="mt-3 text-xl font-bold leading-snug text-ink">{card!.question}</p>
      </Card>

      <div className="grid gap-3">
        {options.map((opt, i) => {
          const isChosen = selected === i;
          const isCorrectOption = opt === card!.answer;
          let stateClass = "bg-white hover:bg-wash";
          if (selected !== null) {
            if (isChosen && isCorrectOption) stateClass = "bg-mint ring-2 ring-emerald-400";
            else if (isChosen && !isCorrectOption) stateClass = "bg-red-100 ring-2 ring-red-300";
            else if (isCorrectOption) stateClass = "bg-mint";
          }
          return (
            <button
              key={i}
              type="button"
              disabled={selected !== null || submitting}
              onClick={() => choose(i)}
              className={cn(
                "flex items-center gap-3 rounded-card p-4 text-left shadow-soft transition-colors disabled:cursor-default",
                stateClass,
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-washAlt text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-semibold text-ink">{opt}</span>
              {selected !== null && isChosen && isCorrectOption && (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
              )}
              {selected !== null && isChosen && !isCorrectOption && (
                <XCircle size={18} className="shrink-0 text-red-600" />
              )}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          type="button"
          onClick={advance}
          className="mt-4 w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-white"
        >
          Next
        </button>
      )}

      <ShortcutHints
        hints={[
          { keys: "1–4", label: "Select" },
          { keys: "Space", label: "Next" },
        ]}
      />
    </div>
  );
}
