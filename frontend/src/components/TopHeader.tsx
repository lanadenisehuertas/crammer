import { ReactNode } from "react";
import { ArrowLeft, Bell, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, Progress } from "./ui";

export function GreetingHeader({
  name,
  masteryPct,
}: {
  name: string;
  masteryPct: number;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Avatar name={name} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted">Hello!</p>
        <h1 className="truncate text-xl font-extrabold text-ink">{name}</h1>
        <Progress value={masteryPct} className="mt-1.5 h-1.5" />
      </div>
      <button
        type="button"
        aria-label="Notifications"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-soft text-ink"
      >
        <Bell size={18} />
      </button>
    </div>
  );
}

export function BackTitleHeader({
  title,
  action,
  onBack,
}: {
  title: string;
  action?: ReactNode;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="mb-6 flex items-center gap-3">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (onBack ? onBack() : navigate(-1))}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-soft text-ink"
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="flex-1 truncate text-center text-lg font-bold text-ink">{title}</h1>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">{action}</div>
    </div>
  );
}

export function SimpleHeader({ name, title }: { name: string; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Avatar name={name} size={40} />
      <h1 className="flex-1 text-xl font-extrabold text-ink">{title}</h1>
      <button
        type="button"
        aria-label="More"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-soft text-ink"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
