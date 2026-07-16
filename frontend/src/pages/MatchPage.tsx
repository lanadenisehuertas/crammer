import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PartyPopper } from "lucide-react";
import { api, CardOut } from "../lib/api";
import { Card, Progress } from "../components/ui";
import { useReviewQueue } from "../lib/useReviewQueue";
import { useKeys, KeyMap } from "../lib/useKeys";
import { shuffle } from "../lib/shuffle";
import { ShortcutHints } from "../components/ShortcutHints";
import { SessionEndCard } from "../components/SessionEndCard";
import { ResumeCard } from "../components/ResumeCard";
import { clearSession, loadSession, saveSession } from "../lib/sessionStore";
import { cn } from "../lib/cn";

const ROUND_SIZE = 6;
const MIN_CARDS = 2;
const LEFT_KEYS = ["1", "2", "3", "4", "5", "6"];
const RIGHT_KEYS = ["q", "w", "e", "r", "t", "y"];
const RIGHT_ALT_KEYS = ["a", "b", "c", "d", "e", "f"];

type Stage = "playing" | "grading" | "roundComplete" | "done";

interface RightTile {
  cardId: number;
  answer: string;
}

interface MatchSave {
  order: number[];
  roundIndex: number;
  roundsCompleted: number;
  totalMistakes: number;
}

interface PendingResume {
  savedAt: number;
  cards: CardOut[];
  roundIndex: number;
  roundsCompleted: number;
  totalMistakes: number;
}

export function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const docId = Number(id);
  const { cards: fetched, error } = useReviewQueue(docId, "cram");

  const [pending, setPending] = useState<PendingResume | null>(null);
  const [cards, setCards] = useState<CardOut[] | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [stage, setStage] = useState<Stage>("playing");
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<Set<number>>(new Set());
  const [matchedRight, setMatchedRight] = useState<Set<number>>(new Set());
  const [firstTryFailed, setFirstTryFailed] = useState<Set<number>>(new Set());
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetched) return;
    if (fetched.length < MIN_CARDS) {
      setCards(fetched);
      return;
    }
    const byId = new Map(fetched.map((c) => [c.id, c]));
    const saved = loadSession<MatchSave>("match", docId);
    if (saved) {
      const order = saved.data.order.filter((cardId) => byId.has(cardId));
      const roundCount = Math.ceil(order.length / ROUND_SIZE);
      const savedRound = Math.min(saved.data.roundIndex, roundCount);
      if (savedRound > 0 && savedRound < roundCount) {
        setPending({
          savedAt: saved.savedAt,
          cards: order.map((cardId) => byId.get(cardId)!),
          roundIndex: savedRound,
          roundsCompleted: saved.data.roundsCompleted,
          totalMistakes: saved.data.totalMistakes,
        });
        return;
      }
      clearSession("match", docId);
    }
    setCards(fetched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched, docId]);

  const rounds = useMemo(() => {
    if (!cards) return [];
    const chunks = [];
    for (let i = 0; i < cards.length; i += ROUND_SIZE) chunks.push(cards.slice(i, i + ROUND_SIZE));
    return chunks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, shuffleSeed]);

  // Autosave at round granularity: a finished round advances the checkpoint;
  // the session clears once the last round is done.
  useEffect(() => {
    if (!cards || cards.length < MIN_CARDS || rounds.length === 0) return;
    const effRound = stage === "roundComplete" ? roundIndex + 1 : roundIndex;
    if (stage === "done" || effRound >= rounds.length) {
      clearSession("match", docId);
      return;
    }
    if (effRound === 0) return;
    saveSession<MatchSave>("match", docId, {
      order: cards.map((c) => c.id),
      roundIndex: effRound,
      roundsCompleted,
      totalMistakes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, rounds.length, roundIndex, stage, roundsCompleted, totalMistakes]);

  function resume() {
    if (!pending) return;
    setCards(pending.cards);
    setRoundIndex(pending.roundIndex);
    setRoundsCompleted(pending.roundsCompleted);
    setTotalMistakes(pending.totalMistakes);
    resetRoundState();
    setStage("playing");
    setPending(null);
  }

  function startOver() {
    clearSession("match", docId);
    setPending(null);
    setCards(fetched ?? []);
    setRoundIndex(0);
    setRoundsCompleted(0);
    setTotalMistakes(0);
    resetRoundState();
    setStage("playing");
  }

  const leftItems = rounds[roundIndex] ?? [];

  const rightItems: RightTile[] = useMemo(
    () => shuffle(leftItems.map((c) => ({ cardId: c.id, answer: c.answer }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leftItems, shuffleSeed],
  );

  function resetRoundState() {
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedLeft(new Set());
    setMatchedRight(new Set());
    setFirstTryFailed(new Set());
    setWrongPair(null);
  }

  function attemptMatch(li: number, ri: number) {
    const leftCard = leftItems[li];
    const rightTile = rightItems[ri];
    if (!leftCard || !rightTile) return;
    const isCorrect = rightTile.cardId === leftCard.id;
    if (isCorrect) {
      setMatchedLeft((s) => new Set(s).add(li));
      setMatchedRight((s) => new Set(s).add(ri));
      setSelectedLeft(null);
      setSelectedRight(null);
    } else {
      setFirstTryFailed((s) => new Set(s).add(li));
      setWrongPair({ left: li, right: ri });
      window.setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 350);
    }
  }

  function selectLeft(li: number) {
    if (stage !== "playing" || matchedLeft.has(li) || wrongPair) return;
    if (selectedRight !== null) attemptMatch(li, selectedRight);
    else setSelectedLeft(li);
  }

  function selectRight(ri: number) {
    if (stage !== "playing" || matchedRight.has(ri) || wrongPair) return;
    if (selectedLeft !== null) attemptMatch(selectedLeft, ri);
    else setSelectedRight(ri);
  }

  async function finishRound() {
    setStage("grading");
    try {
      await Promise.all(
        leftItems.map((c, li) => api.review(c.id, firstTryFailed.has(li) ? "again" : "good")),
      );
      setTotalMistakes((m) => m + firstTryFailed.size);
      setRoundsCompleted((r) => r + 1);
      setStage("roundComplete");
    } catch (e) {
      setRunError((e as Error).message ?? "Could not save round results.");
    }
  }

  useEffect(() => {
    if (stage === "playing" && leftItems.length > 0 && matchedLeft.size === leftItems.length) {
      finishRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedLeft, leftItems.length, stage]);

  function continueRound() {
    if (roundIndex + 1 < rounds.length) {
      setRoundIndex((r) => r + 1);
      resetRoundState();
      setStage("playing");
    } else {
      setStage("done");
    }
  }

  function retry() {
    clearSession("match", docId);
    setRoundIndex(0);
    resetRoundState();
    setRoundsCompleted(0);
    setTotalMistakes(0);
    setRunError(null);
    setShuffleSeed((s) => s + 1);
    setStage("playing");
  }

  useKeys(
    (() => {
      const map: KeyMap = {};
      if (pending) {
        // Guard: while the resume prompt is up, Enter only resumes.
        map["Enter"] = () => resume();
        return map;
      }
      if (stage === "playing") {
        leftItems.forEach((_, i) => {
          map[LEFT_KEYS[i]] = () => selectLeft(i);
        });
        rightItems.forEach((_, i) => {
          map[RIGHT_KEYS[i]] = () => selectRight(i);
        });
        rightItems.forEach((_, i) => {
          const alt = RIGHT_ALT_KEYS[i];
          if (!(alt in map)) map[alt] = () => selectRight(i);
        });
      }
      if (stage === "roundComplete") {
        map[" "] = () => continueRound();
        map["Enter"] = () => continueRound();
      }
      return map;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })(),
    [pending, stage, leftItems, rightItems, selectedLeft, selectedRight, matchedLeft, matchedRight, wrongPair],
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
    const totalRounds = Math.ceil(pending.cards.length / ROUND_SIZE);
    return (
      <ResumeCard
        progressLine={`${pending.roundIndex} of ${totalRounds} round${totalRounds === 1 ? "" : "s"} done`}
        savedAt={pending.savedAt}
        onResume={resume}
        onStartOver={startOver}
      />
    );
  }

  if (cards === null) {
    return <div className="h-64 animate-pulse rounded-card bg-white/60" />;
  }

  if (cards.length < MIN_CARDS) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
          <PartyPopper size={24} />
        </div>
        <p className="mb-1 font-bold text-ink">Not enough cards to match</p>
        <p className="mb-5 text-sm text-muted">Add a few more cards to this document to unlock match mode.</p>
        <Link to={`/document/${docId}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Back to document
        </Link>
      </Card>
    );
  }

  if (stage === "done") {
    const totalCards = cards.length;
    const firstTryCorrect = Math.max(0, totalCards - totalMistakes);
    const pct = totalCards > 0 ? Math.round((firstTryCorrect / totalCards) * 100) : 0;
    return (
      <SessionEndCard
        scorePct={pct}
        statLine={`${roundsCompleted} round${roundsCompleted === 1 ? "" : "s"} complete`}
        subtitle={`${totalMistakes} mistake${totalMistakes === 1 ? "" : "s"} along the way`}
        docId={docId}
        onRetry={retry}
      />
    );
  }

  const progressPct =
    ((roundIndex + (leftItems.length ? matchedLeft.size / leftItems.length : 0)) / rounds.length) * 100;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        MATCH &middot; Round {roundIndex + 1} of {rounds.length}
      </p>
      <Progress value={progressPct} className="mb-6 h-1.5" />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {leftItems.map((c, li) => {
            const isMatched = matchedLeft.has(li);
            const isWrong = wrongPair?.left === li;
            const isSelected = selectedLeft === li;
            return (
              <button
                key={c.id}
                type="button"
                disabled={isMatched || stage !== "playing"}
                onClick={() => selectLeft(li)}
                className={cn(
                  "flex min-h-[64px] w-full items-start gap-2 rounded-card p-3 text-left text-sm font-semibold text-ink shadow-soft transition-colors disabled:cursor-default",
                  isMatched && "bg-mint ring-2 ring-emerald-400",
                  isWrong && "bg-red-100 ring-2 ring-red-300 animate-shake",
                  isSelected && !isWrong && !isMatched && "bg-white ring-2 ring-primary",
                  !isMatched && !isWrong && !isSelected && "bg-white hover:bg-wash",
                )}
              >
                <kbd className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ink/10 bg-washAlt font-mono text-[10px] font-bold text-muted">
                  {LEFT_KEYS[li]}
                </kbd>
                <span className="line-clamp-3">{c.question}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rightItems.map((r, ri) => {
            const isMatched = matchedRight.has(ri);
            const isWrong = wrongPair?.right === ri;
            const isSelected = selectedRight === ri;
            return (
              <button
                key={r.cardId}
                type="button"
                disabled={isMatched || stage !== "playing"}
                onClick={() => selectRight(ri)}
                className={cn(
                  "flex min-h-[64px] w-full items-start gap-2 rounded-card p-3 text-left text-sm font-semibold text-ink shadow-soft transition-colors disabled:cursor-default",
                  isMatched && "bg-mint ring-2 ring-emerald-400",
                  isWrong && "bg-red-100 ring-2 ring-red-300 animate-shake",
                  isSelected && !isWrong && !isMatched && "bg-white ring-2 ring-primary",
                  !isMatched && !isWrong && !isSelected && "bg-white hover:bg-wash",
                )}
              >
                <kbd className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-ink/10 bg-washAlt font-mono text-[10px] font-bold text-muted">
                  {RIGHT_KEYS[ri]?.toUpperCase()}
                </kbd>
                <span className="line-clamp-3">{r.answer}</span>
              </button>
            );
          })}
        </div>
      </div>

      {stage === "roundComplete" && (
        <Card className="mb-4 p-6 text-center">
          <p className="mb-1 font-bold text-ink">Round {roundIndex + 1} complete!</p>
          <p className="mb-4 text-sm text-muted">
            {firstTryFailed.size === 0
              ? "Perfect round — no mistakes."
              : `${firstTryFailed.size} mistake${firstTryFailed.size === 1 ? "" : "s"} this round.`}
          </p>
          <button
            type="button"
            onClick={continueRound}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
          >
            {roundIndex + 1 < rounds.length ? "Next round" : "See results"}
          </button>
        </Card>
      )}

      <ShortcutHints
        hints={
          stage === "roundComplete"
            ? [{ keys: "Space", label: "Continue" }]
            : [
                { keys: "1–6", label: "Select term" },
                { keys: "Q–Y", label: "Select answer" },
              ]
        }
      />
    </div>
  );
}
