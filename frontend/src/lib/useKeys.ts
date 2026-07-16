import { useEffect, type DependencyList } from "react";

export type KeyMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Registers a window-level keydown listener from a map of key -> handler.
 * Keys are matched against `e.key` as-is, lowercase, and uppercase, so
 * callers can use either "a" or "A" in their map.
 *
 * Ignored when the event target is a form control (input/textarea/select or
 * a contentEditable element) or when a modifier key (meta/ctrl/alt) is held,
 * so shortcuts never fight with text entry or browser/OS shortcuts.
 *
 * Space is preventDefault-ed whenever a handler is registered for it, so it
 * never scrolls the page.
 */
export function useKeys(map: KeyMap, deps: DependencyList = []): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const handler = map[e.key] ?? map[e.key.toLowerCase()] ?? map[e.key.toUpperCase()];
      if (!handler) return;
      if (e.key === " ") e.preventDefault();
      handler(e);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
