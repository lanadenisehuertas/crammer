import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "./ui";
import { cn } from "../lib/cn";

/**
 * Shared end-of-session screen: score ring, a stat line, optional extra
 * content (e.g. a missed-questions list), and pill actions to retry or
 * head back to the document. Used by Quiz, Type, and Match.
 */
export function SessionEndCard({
  scorePct,
  statLine,
  subtitle,
  docId,
  onRetry,
  retryLabel = "Try again",
  children,
}: {
  scorePct: number;
  statLine: string;
  subtitle?: string;
  docId: number;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <Card className="mb-6 p-8 text-center">
        <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-lav">
          <span className="text-3xl font-extrabold text-primary">{scorePct}%</span>
        </div>
        <p className="mb-1 font-bold text-ink">{statLine}</p>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </Card>

      {children}

      <div className="flex gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-full bg-lav py-3.5 text-sm font-bold text-ink"
          >
            {retryLabel}
          </button>
        )}
        <Link
          to={`/document/${docId}`}
          className={cn(
            "flex-1 rounded-full bg-ink py-3.5 text-center text-sm font-semibold text-white",
          )}
        >
          Back to document
        </Link>
      </div>
    </div>
  );
}
