# Study Reviewer App — Design Spec

**Date:** 2026-07-16
**Status:** Approved design, pending implementation plan

## Summary

A **local web app** (run on the user's own computer) that turns uploaded study
materials into a **structured reviewer document** plus **flashcards and quizzes**,
and drills them with a **short-term, hours-based spaced-repetition system** tuned
for real cram study (1–2 day windows), with progress, streaks, and per-module
mastery tracking.

The user pastes a Claude API key once. Claude is used for both reading images/
diagrams (built-in vision — no separate OCR engine) and generating the reviewer
and cards. All data is stored locally in a single SQLite file.

Scope now: **personal tool, single user, local.** The architecture (SQLite +
API layer) is chosen so it can grow into a hosted, multi-user web app later
without a rewrite.

## Goals

- Upload a file (or paste text) and get a detailed, well-structured reviewer with
  minimal steps — Gizmo-like ease.
- Emphasize **active recall** (flashcards, fill-in-the-blank, short-answer,
  self-test) over passive re-reading.
- **Short-term spaced repetition** measured in hours, built for studying over
  1–2 days rather than weeks/months.
- Motivation via **streaks and per-module mastery**, like Gizmo/Anki.
- Cram-friendly tools for a real student on a deadline: exam mode, practice
  tests, weak-spot drilling, and a last-minute cheat sheet.
- Base content on the **user's file first**; supplement from AI knowledge only
  when the file is thin, and **clearly label** all AI additions.

## Non-goals (for now)

- Multi-user accounts, hosting, billing (future "version B").
- Live web lookup / real-time internet sources for supplements.
- Mobile native apps.
- Collaborative/shared decks.
- Long-horizon (weeks/months) scheduling — deliberately out; this is a
  short-window study tool.

## Users & platform

- **Audience:** one student, running it on their own machine.
- **Technical level:** "somewhat technical" — comfortable installing a program,
  running a command, and pasting an API key when guided.
- **Delivery:** run a command, open a `localhost` page in the browser.
- **AI cost:** pay-per-use Claude API (typically cents per document); acceptable.

## Architecture

One Python program (FastAPI backend) serving a browser UI, plus a local SQLite
database. Five focused components, each independently testable:

### 1. File Parser
Takes an uploaded file (or pasted text) and produces clean text, including text
read out of embedded pictures/diagrams.

- **PDF** → `pypdf` for text; scanned/image pages sent to Claude vision.
- **DOCX** → `python-docx` for text; embedded images sent to vision.
- **PPTX** → `python-pptx` for text + speaker notes; slide images sent to vision.
- **Images** (PNG/JPG/etc.) → sent straight to Claude vision.
- **Plain/rich text** → TXT, Markdown (.md), RTF.
- **Spreadsheets/data** → CSV, XLSX/XLS. Rows read as content. **Smart table:**
  if laid out as term + definition columns, rows become ready-made flashcards
  directly (in addition to a generated reviewer).
- **Web/e-book** → HTML, EPUB.
- **Pasted text** → skips the parser, goes straight to the Reviewer Generator.
- Unrecognized type → clear "unsupported file type" message, no silent failure.
- Adding a new format is an isolated change (one small reader function).

### 2. Reviewer Generator
Sends extracted content to Claude to build the structured reviewer: organized
notes, key terms, concepts, and definitions, **grouped into modules (topic
groups)** rather than one flat pile. Output is stored per module as sections
(heading + content), each piece marked **from-file** or **added-context**. Also
produces a condensed **cheat sheet** (one-page TL;DR) per document.

### 3. Card Generator
Turns the reviewer into flashcards and quiz questions: flashcard, fill-in-the-
blank, and short-answer types. Each card belongs to a module, so cards test the
material the user will actually read. Smart-table spreadsheet rows also feed here
directly.

### 4. Study Scheduler
A **short-term, hours-based** spaced-repetition engine (SM-2 adapted to
minutes/hours instead of days). Tracks each card's state (interval, ease factor,
due time, review count) and decides what is due now.

- Miss a card (Again) → returns in minutes.
- Get it (Hard/Good/Easy) → returns in a few hours, growing toward ~1 day.
- Default horizon ~1–2 days; the optional exam date compresses or stretches it.
- Rating options: Again / Hard / Good / Easy.

### 5. Web UI + Storage
A `localhost` page to upload/paste, read reviewers (with AI additions labeled),
run reviews, take practice tests, view the dashboard, and read cheat sheets. All
data in one local SQLite file.

**Data flow:** Upload/Paste → Parser → Reviewer Generator (→ Modules + Cheat
sheet) → Card Generator → Storage → Study UI. (Pasted text skips the Parser.)

## Study features

### Core review
Dashboard shows streak, cards due now, and per-document module progress. A review
session shows each due card, reveals the answer, and takes a recall rating that
feeds the hours-based scheduler.

### Exam Mode (cram)
A "Cram now" action that runs through **all** cards in a document or module
immediately, ignoring the spaced schedule — for when the test is imminent.

### Test date / deadline (optional)
Optionally set an exam date on a document. When set, the scheduler front-loads
reviews so every card is learned before that date, and the dashboard surfaces
"N topics to master in M days." When unset, normal short-term scheduling applies.

### Practice Test
A scored mock quiz over a module or whole document: mixed question types, graded
at the end, with a review of what was missed. Simulates the real exam.

### Weak-spots focus
A "drill my weak spots" mode that targets the cards the user misses most
(derived from the Reviews log).

### Cheat sheet
A one-page condensed TL;DR per document for a final skim before the exam.

## Data model (SQLite)

1. **Documents** — one per upload/paste: title, date added, extracted text,
   source type, optional **exam date**, and cheat-sheet content.
2. **Modules** — topic groups within a Document: title, order, and the reviewer
   sections for that module (each section tagged `from-file` or `added-context`).
3. **Cards** — one per flashcard/quiz question, linked to a Module (and Document):
   question, answer, card type (flashcard / fill-in-blank / short-answer), and
   scheduling state (due time, interval in minutes/hours, ease factor, review
   count).
4. **Reviews** — a log of each answered card: card, timestamp, rating. Preserves
   history and powers weak-spot detection and stats.
5. **Progress & Streaks** — mostly derived from Reviews + card/module state, plus
   a lightweight **Study Days** record (dates studied) for streaks:
   - Daily streak (current unbroken run) and longest-ever streak.
   - **Module mastery:** a module is **finished** once all its cards have been
     answered at least once; document mastery = finished modules / total modules,
     shown as a per-document topic checklist ("3 of 5 topics done").
   - Overall stats: total cards, cards due now, modules finished, reviews today,
     reviews all-time.

A future hosted version adds a `user` column; the structure otherwise holds.

## AI generation rules

- **File content is primary** — build the reviewer from the actual material, its
  wording, terms, and structure; do not replace it with generic knowledge.
- **Supplement only when thin** — add accurate related context from AI knowledge
  only where the material is clearly incomplete on a topic it raises. Every such
  piece is tagged `added-context` so the UI labels it (e.g. "Added context"
  badge, distinct color).
- **No hallucinated sources** — general knowledge only; no invented citations, no
  live-web claims.
- **Cards come from the reviewer** — so questions test what the user reads.
- **Sensible module count** — group content into a handful of coherent topics,
  not dozens of tiny ones.
- **Chunking** — long documents are processed in chunks to control reliability
  and cost.

## Study flow

Open app → dashboard shows streak, cards due now, and module progress → choose:
normal review, Cram now, Practice Test, or drill weak spots. For each card: show
question → reveal answer → rate recall (Again/Hard/Good/Easy) → scheduler sets the
next due time (minutes to hours). Finishing all of a module's cards marks the
module finished; streak and stats update as you go.

## Error handling

- **Bad/missing API key** → clear message up front; app still opens.
- **Unreadable/corrupt file** → skip with a plain explanation; don't crash the
  batch.
- **API failure mid-generation** → save what succeeded; allow retry of the rest.
- **Empty/blank file or no extractable text** → tell the user; don't generate a
  hollow reviewer.
- **Large files** → processed in chunks to avoid failures and surprise cost.
- **Unsupported file type** → explicit message.
- **Exam date in the past / too soon** → warn, fall back to Cram mode.

## Testing

- **Parsers** — checked against small sample files of each supported type.
- **Scheduler** — tested against known short-interval (hours-based) SM-2 cases,
  including exam-date front-loading.
- **Generators** — tested with a faked Claude response (fast, free,
  deterministic), including module grouping and cheat-sheet output.
- **Progress** — streak, module-finished, and weak-spot math tested directly.
- **Practice Test** — scoring and missed-item review tested.
- **End-to-end** — one sample file in → modules + reviewer + cards + cheat sheet +
  schedule out.

## Tech stack

- **Language/backend:** Python, FastAPI.
- **Parsing:** pypdf, python-docx, python-pptx, Pillow, openpyxl (xlsx), stdlib
  csv, an HTML parser, an EPUB reader; Markdown/RTF/TXT readers.
- **AI:** Anthropic Claude API (text + vision) via the official SDK, with prompt
  caching where it helps cost.
- **Storage:** SQLite.
- **UI:** browser page served by the backend at `localhost`.

## Future ("version B") — not built now

- Multi-user accounts and hosting.
- Optional live-web supplements with citations.
- Shared/exportable decks (e.g. Anki export).
- Long-horizon scheduling for durable, semester-long retention.
