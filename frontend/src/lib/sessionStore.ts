// Persist in-progress review sessions to localStorage so leaving a page
// mid-session never loses progress. One slot per activity per document.

export type Activity =
  | "study-due"
  | "study-cram"
  | "study-weak"
  | "quiz"
  | "type"
  | "match"
  | "practice";

export interface SavedSession<T> {
  savedAt: number;
  data: T;
}

type DocKey = number | "all";

function storageKey(activity: Activity, docId: DocKey): string {
  return `crammer:${activity}:${docId}`;
}

export function saveSession<T>(activity: Activity, docId: DocKey, data: T): void {
  try {
    localStorage.setItem(
      storageKey(activity, docId),
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // storage full or unavailable — losing autosave is not fatal
  }
}

export function loadSession<T>(activity: Activity, docId: DocKey): SavedSession<T> | null {
  try {
    const raw = localStorage.getItem(storageKey(activity, docId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || parsed.data == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(activity: Activity, docId: DocKey): void {
  try {
    localStorage.removeItem(storageKey(activity, docId));
  } catch {
    // ignore
  }
}

/** Removes every saved session (any activity) for a specific document — used
 * when the document itself is deleted so stale sessions don't linger. */
export function clearAllSessionsForDocument(docId: number): void {
  try {
    const suffix = `:${docId}`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("crammer:") && key.endsWith(suffix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

/** "just now", "5m ago", "3h ago", "2d ago" — for the resume prompt. */
export function relativeTime(savedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
