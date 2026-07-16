import { useCallback, useEffect, useState } from "react";
import { api, CardOut, QueueMode } from "./api";

/**
 * Fetches a document's review queue for a given mode and exposes loading /
 * error state plus a `reload()` escape hatch for refetching from the server.
 * Shared by Study, Quiz, Type, and Match so each page doesn't reimplement
 * the same fetch/loading/error dance.
 */
export function useReviewQueue(docId: number, mode: QueueMode) {
  const [cards, setCards] = useState<CardOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setCards(null);
    setError(null);
    api
      .queue(docId, mode)
      .then((res) => setCards(res.cards))
      .catch((e) => setError(e.message ?? "Could not load this session."));
  }, [docId, mode, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { cards, error, reload };
}
