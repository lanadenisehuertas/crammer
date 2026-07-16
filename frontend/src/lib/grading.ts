// Normalized-text grading for the "type the answer" review mode.

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Correct if the normalized strings are equal, or if both are longer than 3
 * characters and one contains the other (forgives minor over/under-typing).
 */
export function isAnswerCorrect(input: string, expected: string): boolean {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter > 3 && (a.includes(b) || b.includes(a))) return true;
  return false;
}
