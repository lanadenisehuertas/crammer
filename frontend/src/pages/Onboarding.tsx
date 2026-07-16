import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";

export function Onboarding() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-wash px-6 py-10">
      <div className="w-full max-w-md rounded-card bg-white p-8 text-center shadow-soft">
        <BooksIllustration />
        <h1 className="mb-3 text-2xl font-extrabold leading-tight text-ink">
          Start Learning Today
        </h1>
        <p className="mx-auto mb-8 max-w-xs text-sm text-muted">
          Turn your notes and files into flashcards, cheat sheets, and a study
          schedule built around your real exam dates.
        </p>
        <Button variant="pill-dark" className="w-full" onClick={() => navigate("/")}>
          Get Started
        </Button>
        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-2 w-6 rounded-full bg-ink" />
          <span className="h-2 w-2 rounded-full bg-ink/20" />
          <span className="h-2 w-2 rounded-full bg-ink/20" />
        </div>
      </div>
    </div>
  );
}

function BooksIllustration() {
  return (
    <svg viewBox="0 0 240 160" className="mx-auto mb-8 h-40 w-full max-w-[260px]">
      <rect width="240" height="160" rx="24" fill="#F1EDFB" />
      <rect x="40" y="96" width="160" height="16" rx="6" fill="#DCD3FA" />
      <g transform="translate(60,50)">
        <rect x="0" y="20" width="34" height="52" rx="4" fill="#4F8EF7" />
        <rect x="38" y="8" width="34" height="64" rx="4" fill="#8B7CF6" />
        <rect x="76" y="26" width="34" height="46" rx="4" fill="#A78BFA" />
        <rect x="0" y="20" width="34" height="10" rx="3" fill="#ffffff" opacity="0.35" />
        <rect x="38" y="8" width="34" height="10" rx="3" fill="#ffffff" opacity="0.35" />
        <rect x="76" y="26" width="34" height="10" rx="3" fill="#ffffff" opacity="0.35" />
      </g>
      <circle cx="196" cy="40" r="14" fill="#D6E8DE" />
      <circle cx="30" cy="34" r="9" fill="#DCD3FA" />
    </svg>
  );
}
