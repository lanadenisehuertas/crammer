# Crammer

Turn your study materials (PDF, DOCX, PPTX, images, spreadsheets, and more)
into structured reviewers, flashcards, and quizzes — with short-term spaced
repetition built for studying over 1–2 days. Runs on your own computer;
only the AI calls go to Claude or Gemini, whichever you configure.

## Quick start (Windows)

1. Copy `.env.example` to `.env` and add an AI key.
   - No budget? Get a free Gemini key at aistudio.google.com and set
     `GEMINI_API_KEY` instead. (`REVIEWER_GEMINI_MODEL` picks the model —
     `gemini-2.5-flash` is the default and free-tier friendly.)
   - Have Anthropic credits? Put your key after `ANTHROPIC_API_KEY=`.
     (`REVIEWER_MODEL` picks the model — `claude-haiku-4-5` is the cheapest.)
   - Crammer auto-detects which provider to use from whichever key is set;
     set `REVIEWER_PROVIDER=claude` or `gemini` to force one.
2. **Double-click `start.bat`.** The first run sets everything up, then your
   browser opens Crammer automatically.

That's it — upload a file or paste notes, and study.

## Manual start

```
python -m venv .venv
.venv\Scripts\Activate.ps1        # PowerShell (Git Bash: source .venv/Scripts/activate)
pip install -e .
python -m reviewer                # opens your browser automatically
```

The app UI is served at `/app` (a prebuilt copy is committed, so Node/npm is
NOT required to use Crammer). A minimal classic UI remains at `/`.

## Development

- Backend tests: `pip install -e ".[dev]"` then `python -m pytest -q`
- Frontend: `cd frontend && npm install && npm run dev` (proxies `/api` to the
  backend on port 8000); rebuild the shipped UI with `npm run build`
