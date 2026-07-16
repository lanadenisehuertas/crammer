import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PartyPopper } from "lucide-react";
import { api, CardOut, QueueMode, Rating } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { RatingPills } from "../components/RatingPills";
import { useKeys } from "../lib/useKeys";
import { ShortcutHints } from "../components/ShortcutHints";

const MODE_LABEL: Record<QueueMode, string> = {
  due: "Due review",
  cram: "Cram session",
  weak: "Weak spots",
};

export function StudyPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") as QueueMode) || "due";

  const [cards, setCards] = useState<CardOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .queue(docId, mode)
      .then((res) => setCards(res.cards))
      .catch((e) => setError(e.message ?? "Could not load this study session."));
  }, [docId, mode]);

  async function rate(rating: Rating) {
    if (!cards || submitting) return;
    setSubmitting(true);
    try {
      await api.review(cards[index].id, rating);
      setCompleted((c) => c + 1);
      setIndex((i) => i + 1);
      setRevealed(false);
    } catch (e) {
      setError((e as Error).message ?? "Could not save that review.");
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
        if (revealed) rate("again");
      },
      "2": () => {
        if (revealed) rate("hard");
      },
      "3": () => {
        if (revealed) rate("good");
      },
      "4": () => {
        if (revealed) rate("easy");
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

  if (cards.length === 0 || index >= cards.length) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
          <PartyPopper size={24} />
        </div>
        <p className="mb-1 font-bold text-ink">
          {cards.length === 0 ? "Nothing to study here yet" : "Session complete!"}
        </p>
        <p className="mb-5 text-sm text-muted">
          {cards.length === 0
            ? "Come back once cards are due, or try another mode."
            : `You reviewed ${completed} card${completed === 1 ? "" : "s"}.`}
        </p>
        <Link to={`/document/${docId}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Back to document
        </Link>
      </Card>
    );
  }

  const card = cards[index];
  const progressPct = (index / cards.length) * 100;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {MODE_LABEL[mode]} &middot; {index + 1} of {cards.length}
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
        <RatingPills onRate={rate} disabled={submitting} />
      )}

      <ShortcutHints
        hints={
          revealed
            ? [{ keys: "1–4", label: "Rate" }]
            : [{ keys: "Space", label: "Reveal" }]
        }
      />
    </div>
  );
}
