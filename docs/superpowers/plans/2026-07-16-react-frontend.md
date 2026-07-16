# React Frontend Implementation Plan (Plan 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Crammer a polished mobile-first UI matching the provided mockups' design language (lavender/mint palette, pill buttons, big-radius cards, soft shadows), implemented as a React SPA talking to a new JSON API on the existing FastAPI backend.

**Architecture:** Part A adds `reviewer/web/api.py` — an `APIRouter` mounted at `/api` that wraps the existing services (ingest, generation, scheduler, progress, practice) as JSON endpoints, plus CORS for the Vite dev origin and an optional static mount of the built SPA. Part B is a `frontend/` Vite + React 18 + TypeScript + Tailwind app with react-router, Recharts, and lucide-react, hand-vendored shadcn-style primitives, and 8 routed pages mapping the mockups to Crammer's real features.

**Tech Stack:** FastAPI (existing), React 18, TypeScript, Vite, Tailwind CSS v3, react-router-dom v6, Recharts, lucide-react.

---

# Part A — JSON API (`reviewer/web/api.py`)

## Contracts (all under `/api`)

| Method & path | Request | Response |
|---|---|---|
| `GET /api/overview` | — | `{streak, longest_streak, reviews_today, cards_due_total, mastery_pct, documents: [DocSummary]}` |
| `GET /api/documents/{id}` | — | `DocDetail` (404 if missing) |
| `POST /api/paste` | JSON `{title, text}` | `{document_id}` (400 on empty text) |
| `POST /api/upload` | multipart `file` | `{document_id}` (400 unsupported/empty) |
| `GET /api/documents/{id}/queue?mode=due\|cram\|weak` | — | `{cards: [CardOut]}` (404 bad mode/doc) |
| `POST /api/review` | JSON `{card_id, rating}` | `{ok: true}` (400 on bad card/rating) |
| `GET /api/documents/{id}/practice` | — | `{cards: [CardOut]}` (shuffled server-side) |
| `POST /api/documents/{id}/exam-date` | JSON `{exam_date}` (ISO date or null) | `{ok: true}` (400 past date) |
| `GET /api/stats/weekly` | — | `{days: [{date, reviews}]}` — last 7 days ending today |
| `GET /api/schedule` | — | `{study_days: [iso-date], exams: [{document_id, title, exam_date}]}` |

Shapes:

```
DocSummary = {id, title, source_type, created_at, exam_date,
              cards_total, cards_due, modules_finished, modules_total, mastery_pct}
DocDetail  = DocSummary + {cheat_sheet, reviews_today, streak,
              modules: [{id, title, position, finished, cards_count,
                         sections: [{heading, content, origin}]}]}
CardOut    = {id, module_id, card_type, question, answer}
```

`mastery_pct` = `round(100 * modules_finished / modules_total)` (0 when no modules).

## Task A1: `reviews_by_day` helper

**Files:** Modify `reviewer/progress/stats.py`; test `tests/test_stats.py` (append).

TDD: add

```python
def reviews_by_day(conn: sqlite3.Connection, days: int = 7,
                   today: date | None = None) -> list[tuple[str, int]]:
    """(iso-date, review count) for the last `days` days, oldest first, zero-filled."""
    today = today or date.today()
    counts = {row["d"]: row["n"] for row in conn.execute(
        "SELECT substr(rated_at, 1, 10) AS d, COUNT(*) AS n FROM reviews GROUP BY d")}
    out = []
    for i in range(days - 1, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        out.append((day, counts.get(day, 0)))
    return out
```

(import `timedelta`). Test: log reviews on two days via existing fixtures, assert zero-fill, order, counts, and length 7.

## Task A2: the API router

**Files:** Create `reviewer/web/api.py`; modify `reviewer/web/app.py`; test `tests/test_api.py`.

- `build_api_router(get_conn, client) -> APIRouter` mirroring how `app.py` wires `Depends(get_conn)` and the injected Claude client. `create_app` calls `app.include_router(build_api_router(get_conn, client), prefix="/api")`.
- Add CORS in `create_app`:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
                   allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
```

- Optional SPA mount at the end of `create_app` (after all routes):

```python
dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if dist.is_dir():
    app.mount("/app", StaticFiles(directory=str(dist), html=True), name="spa")
```

- Endpoints reuse: `repo.*`, `ingest_text`/`ingest_file` (OCR = `client.ocr_image`), `build_and_store`, `due_cards`/`cram_cards`/`weak_spot_cards`, `review_card` (wrap `ValueError` → 400), `build_practice_test` (shuffle with `random.shuffle`), `dashboard_stats`, `module_finished`, `document_mastery`, `current_streak`, `longest_streak`, `reviews_by_day`, `repo.list_study_days`, `repo.set_exam_date` (reject past dates with 400).
- `GET /api/overview` aggregates per-document via `dashboard_stats`; top-level `streak`/`longest_streak`/`reviews_today`/`cards_due_total`/`mastery_pct` computed across documents (sum dues; mastery over all modules).
- Upload/paste run the same generate pipeline as the HTML routes (`build_and_store` with the document's text + `flashcard_pairs`).

**Tests** (`tests/test_api.py`, TestClient + fake Claude client, same pattern as `tests/test_web_*.py`): overview empty → zeros; paste → 200 + document_id, then overview lists it; document detail includes modules/sections/origins/cheat_sheet; queue modes due/cram/weak + 404 on bad mode; review ok + 400 bad rating; practice returns all cards; exam-date set + 400 past; stats/weekly length 7 zero-filled; schedule lists study day after a review and exam after setting. Bad paste (blank) → 400. Unknown document → 404.

Commit per task: `feat: reviews-by-day stat helper`, `feat: JSON API for the React frontend`.

---

# Part B — React app (`frontend/`)

## Scaffold (Task B1)

`frontend/` created **by hand** (no interactive CLIs): `package.json`, `vite.config.ts` (react plugin + `server.proxy = {"/api": "http://127.0.0.1:8000"}`), `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html` (Plus Jakarta Sans via Google Fonts `<link>`), `src/main.tsx`, `src/index.css` (@tailwind directives + base styles).

Dependencies: `react`, `react-dom`, `react-router-dom`, `recharts`, `lucide-react`; dev: `typescript`, `vite`, `@vitejs/plugin-react`, `tailwindcss@^3`, `postcss`, `autoprefixer`, `@types/react`, `@types/react-dom`.

Tailwind theme tokens (exact, from the mockups):

```ts
colors: {
  wash:   "#F1EDFB",  washAlt: "#EDE9FB",
  primary:"#8B7CF6",  primarySoft: "#A78BFA",
  lav:    "#DCD3FA",  mint: "#D6E8DE",
  blue:   "#4F8EF7",
  ink:    "#14142B",  ink2: "#1B1B2F",
  muted:  "#6B7280",
},
borderRadius: { card: "22px" },
fontFamily: { sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"] },
boxShadow: { soft: "0 8px 24px rgba(20,20,43,0.08)" },
```

Shape language: cards `rounded-card shadow-soft bg-white`; CTAs `rounded-full bg-ink text-white`; icon buttons 40px white circles with soft shadow; chips/pills everywhere; headings bold 24–28px; metadata 12–13px `text-muted`.

## Shared layer (Task B2)

- `src/lib/api.ts` — typed fetch client for every Part A endpoint (types mirror the contracts table).
- `src/components/ui.tsx` — vendored shadcn-style primitives used app-wide: `Button` (variants: pill-dark, pill-primary, ghost, icon-circle), `Card`, `Badge`, `Avatar` (initials fallback), `Progress` (thin rounded purple bar), `Tabs`.
- `src/components/AppShell.tsx` — `<Outlet/>` layout: left sidebar ≥768px / bottom tab bar <768px, icons Home, BarChart3, CalendarDays, Plus (Upload); active item bold/dark exactly like mockup 2's bottom nav. Lavender `bg-wash` page background, content in a centered `max-w-md md:max-w-4xl` column.
- `src/components/TopHeader.tsx` — variants: greeting (avatar + "Hello!" + progress sliver + bell), back-title-action (back circle, centered title, action circle), simple (avatar + kebab).
- Domain components: `DocumentCard` (icon chip top-left, mastery pill top-right, source-type category label, 2-line bold title, "N modules" chip group, "N due" pill, circular arrow button; alternating `bg-mint`/`bg-lav`), `StatTile` (purple/blue tiles), `WeeklyBarChart` (Recharts: 7 bars, `#EDE9FB` inactive → `#8B7CF6` max day, dark rounded tooltip "N reviews"), `StreakRow` (⚡ pill card + chevron), `StatsRow` (3-up: Modules/Cards/Due, pastel icon tiles), `CalendarWidget` (Mon-first month grid; study days = soft purple pill; exam dates = yellow; today = dark circle; prev/next chevrons), `ScheduleListItem` (icon tile, label, chevron/action pill), `FloatingToolbar` (dark pill bar with icon buttons, active one highlighted), `OriginBadge` ("From file" mint chip / "Added context" purple chip), `RatingPills` (Again/Hard/Good/Easy).

## Pages (Tasks B3–B6, grouped commits)

Mockup → Crammer mapping (real data, no placeholder people):

1. `/onboarding` — hero card with stacked-books SVG illustration (drawn inline, blue books on lavender), "Start Learning Today", subtext, dark "Get Started" pill → `/`; pagination dots.
2. `/` **Dashboard** — greeting header (initials avatar "You", overall-mastery progress sliver, bell), "Your Progress Today" + search icon, `DocumentCard` list from `GET /api/overview`; empty state pointing to upload; floating `+`.
3. `/document/:id` — lesson-details layout: purple header block (back, share=copy-link), circular book badge, source-type tag pill, title, `StatsRow` (Modules / Cards / Due), cheat-sheet card (description slot), "Modules" list — each module row shows ✓ when finished and expands to sections with `OriginBadge`; bookmark circle + "Start Studying" dark pill; secondary pills: Cram · Weak spots · Practice; exam-date chip opens a date input (`POST exam-date`).
4. `/study/:id?mode=due|cram|weak` — thin progress bar, big white question card, "Show answer" dark pill → answer + `RatingPills` (`POST /api/review`), session-complete card (cards done, streak) with "Back to document".
5. `/practice/:id` — same card flow, self-grade "I got it" / "Missed it" (logs review good/again), then score screen: big % ring, "N of M correct", missed-question review list.
6. `/statistics` — "Learning Overview" + "Weekly" chip, `WeeklyBarChart` from `GET /api/stats/weekly`, `StatTile`s (purple "Reviews today", blue "Mastery %"), `StreakRow` ("N-day learning streak!").
7. `/schedule` — "Learning Schedule Plan", `CalendarWidget` (month state, study days + exam dates from `GET /api/schedule`), "Upcoming exams" list with dark "Study" pill → document.
8. `/upload` — two cards: file drop/picker (`POST /api/upload`) and paste form (`POST /api/paste`); generating state (spinner pill "Generating your reviewer…"); on success navigate to `/document/:id`; friendly error banner on 400.

Router: `createBrowserRouter` with `basename` detection (works at `/` in dev and `/app` when served by FastAPI). All pages inside `AppShell` except `/onboarding`.

## Verification (Task B7)

- `npm install` then `npm run build` (tsc + vite) passes with zero errors.
- `npx tsc --noEmit` clean.
- Backend suite still green (`python -m pytest -q`).
- Manual smoke: `python -m reviewer` + `npm run dev`, drive upload→document→study.

Commits: `feat: scaffold React frontend with mockup design system`, `feat: shared UI components and API client`, `feat: dashboard, onboarding, upload pages`, `feat: document, study, practice pages`, `feat: statistics and schedule pages`, `chore: frontend build config polish` (as needed).

---

## Definition of done

- `/api` serves every contract above, tested (backend suite green).
- `frontend/` builds clean; all 8 routes navigable with real API data; responsive
  (bottom tabs <768px, sidebar ≥768px); design matches the mockup language
  (palette, pills, radii, shadows, typography).
- No placeholder people/content — all data is the user's real documents.
- `frontend/node_modules` and `frontend/dist` gitignored.
