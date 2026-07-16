# crammer

## Running Crammer

1. `python -m venv .venv && source .venv/Scripts/activate` (Windows Git Bash) or
   `.venv\Scripts\Activate.ps1` (PowerShell).
2. `pip install -e ".[dev]"`
3. Copy `.env.example` to `.env` and add your `ANTHROPIC_API_KEY`.
   Optionally set `REVIEWER_MODEL` (default `claude-opus-4-7`; use
   `claude-sonnet-4-6` or `claude-haiku-4-5` for lower cost).
4. `python -m reviewer`
5. Open http://127.0.0.1:8000 and upload a file or paste text.