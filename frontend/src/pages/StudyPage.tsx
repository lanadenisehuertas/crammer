import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PartyPopper } from "lucide-react";
import { api, CardOut, QueueMode, Rating } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { RatingPills } from "../components/RatingPills";
import { useKeys } from "../lib/useKeys";
import { ShortcutHints } from "../components/ShortcutHints";
import { ResumeCard } from "../components/ResumeCard";
import { Activity, clearSession, loadSession, saveSession } from "../lib/sessionStore";
import { cn } from "../lib/cn";

const MODE_LABEL: Record<QueueMode, string> = {
  due: "Due review",
  cram: "Cram session",
  weak: "Weak spots",
};

// Anki-style requeue offsets: how many cards later a rated card comes back.
const AGAIN_OFFSET = 3;
const HARD_OFFSET = 8;

type RepeatMap = Record<number, "again" | "hard">;

interface StudySave {
  queueIds: number[];
  finishedIds: number[];
  repeat: RepeatMap;
  answers: number;
  totalIds: number[];
}

interface PendingResume {
  savedAt: number;
  queue: CardOut[];
  finishedIds: number[];
  repeat: RepeatMap;
  answers: number;
  totalIds: number[];
}

export function StudyPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") as QueueMode) || "due";
  const activity = `study-${mode}` as Activity;

  const [fetched, setFetched] = useState<CardOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResume | null>(null);

  // The working queue: queue[0] is the current card. "Again"/"Hard" reinsert
  // the same card later in the queue; "Good"/"Easy" retire it. The session
  // ends only when the queue is empty.
  const [queue, setQueue] = useState<CardOut[] | null>(null);
  const [finished, setFinished] = useState<Set<number>>(new Set());
  const [repeat, setRepeat] = useState<RepeatMap>({});
  const [answers, setAnswers] = useState(0);
  const [totalIds, setTotalIds] = useState<number[]>([]);

  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function startFresh(cards: CardOut[]) {
    setQueue(cards);
    setFinished(new Set());
    setRepeat({});
    setAnswers(0);
    setTotalIds(cards.map((c) => c.id));
    setRevealed(false);
  }

  useEffect(() => {
    let cancelled = false;
    setFetched(null);
    setQueue(null);
    setPending(null);
    setError(null);
    api
      .queue(docId, mode)
      .then((res) => {
        if (cancelled) return;
        setFetched(res.cards);
        const byId = new Map(res.cards.map((c) => [c.id, c]));
        const saved = loadSession<StudySave>(activity, docId);
        if (saved) {
          const queueIds = saved.data.queueIds.filter((cardId) => byId.has(cardId));
          const finishedIds = saved.data.finishedIds.filter((cardId) => byId.has(cardId));
          const savedTotalIds = saved.data.totalIds.filter((cardId) => byId.has(cardId));
          if (queueIds.length > 0 && saved.data.answers > 0) {
            const repeatKept: RepeatMap = {};
            for (const cardId of queueIds) {
              if (saved.data.repeat[cardId]) repeatKept[cardId] = saved.data.repeat[cardId];
            }
            setPending({
              savedAt: saved.savedAt,
              queue: queueIds.map((cardId) => byId.get(cardId)!),
              finishedIds,
              repeat: repeatKept,
              answers: saved.data.answers,
              totalIds: savedTotalIds,
            });
            return;
          }
          // nothing meaningful left (or already complete) — forget it
          clearSession(activity, docId);
        }
        startFresh(res.cards);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Could not load this study session.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, mode]);

  // Autosave on every state change; clear once the session completes.
  useEffect(() => {
    if (!queue) return;
    if (queue.length === 0) {
      if (totalIds.length > 0) clearSession(activity, docId);
      return;
    }
    if (answers === 0) return;
    saveSession<StudySave>(activity, docId, {
      queueIds: queue.map((c) => c.id),
      finishedIds: [...finished],
      repeat,
      answers,
      totalIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, finished, repeat, answers, totalIds]);

  function resume() {
    if (!pending) return;
    setQueue(pending.queue);
    setFinished(new Set(pending.finishedIds));
    setRepeat(pending.repeat);
    setAnswers(pending.answers);
    setTotalIds(pending.totalIds);
    setRevealed(false);
    setPending(null);
  }

  function startOver() {
    clearSession(activity, docId);
    setPending(null);
    startFresh(fetched ?? []);
  }

  async function rate(rating: Rating) {
    if (!queue || queue.length === 0 || submitting) return;
    const card = queue[0];
    setSubmitting(true);
    try {
      // Every answer counts, like Anki — even repeats POST a review.
      await api.review(card.id, rating);
      setAnswers((a) => a + 1);
      setRevealed(false);
      if (rating === "good" || rating === "easy") {
        setFinished((f) => new Set(f).add(card.id));
        setRepeat((r) => {
          if (!(card.id in r)) return r;
          const { [card.id]: _dropped, ...rest } = r;
          return rest;
        });
        setQueue((q) => q!.slice(1));
      } else {
        const offset = rating === "again" ? AGAIN_OFFSET : HARD_OFFSET;
        setRepeat((r) => ({ ...r, [card.id]: rating }));
        setQueue((q) => {
          const rest = q!.slice(1);
          const pos = Math.min(offset, rest.length);
          return [...rest.slice(0, pos), card, ...rest.slice(pos)];
        });
      }
    } catch (e) {
      setError((e as Error).message ?? "Could not save that review.");
    } finally {
      setSubmitting(false);
    }
  }

  useKeys(
    {
      " ": () => {
        if (!pending && queue && queue.length > 0 && !revealed) setRevealed(true);
      },
      Enter: () => {
        // Guard: while the resume prompt is up, Enter only resumes — it must
        // not fall through and reveal the first card.
        if (pending) {
          resume();
          return;
        }
        if (queue && queue.length > 0 && !revealed) setRevealed(true);
      },
      "1": () => {
        if (!pending && revealed) rate("again");
      },
      "2": () => {
        if (!pending && revealed) rate("hard");
      },
      "3": () => {
        if (!pending && revealed) rate("good");
      },
      "4": () => {
        if (!pending && revealed) rate("easy");
      },
    },
    [pending, queue, revealed, submitting],
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
        progressLine={`${pending.finishedIds.length} of ${pending.totalIds.length} done`}
        savedAt={pending.savedAt}
        onResume={resume}
        onStartOver={startOver}
      />
    );
  }

  if (queue === null) {
    return <div className="h-64 animate-pulse rounded-card bg-white/60" />;
  }

  if (fetched.length === 0 || queue.length === 0) {
    const nothingToStudy = fetched.length === 0;
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
          <PartyPopper size={24} />
        </div>
        <p className="mb-1 font-bold text-ink">
          {nothingToStudy ? "Nothing to study here yet" : "Session complete!"}
        </p>
        <p className="mb-5 text-sm text-muted">
          {nothingToStudy
            ? "Come back once cards are due, or try another mode."
            : `${finished.size} card${finished.size === 1 ? "" : "s"} mastered · ${answers} answer${answers === 1 ? "" : "s"}`}
        </p>
        <Link to={`/document/${docId}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Back to document
        </Link>
      </Card>
    );
  }

  const card = queue[0];
  const uniqueTotal = totalIds.length;
  const progressPct = uniqueTotal > 0 ? (finished.size / uniqueTotal) * 100 : 0;
  const repeatRating = repeat[card.id];

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {MODE_LABEL[mode]} &middot; {Math.min(finished.size + 1, uniqueTotal)} of {uniqueTotal}
      </p>
      <Progress value={progressPct} className="mb-6 h-1.5" />

      <Card className="mb-6 flex min-h-[280px] flex-col justify-center p-8 text-center">
        {repeatRating && (
          <span
            className={cn(
              "mx-auto mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              repeatRating === "again"
                ? "bg-orange-100 text-orange-700"
                : "bg-amber-100 text-amber-800",
            )}
          >
            Repeat card
          </span>
        )}
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
