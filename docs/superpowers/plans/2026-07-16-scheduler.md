# Study Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive daily study — a short-term, hours-based SM-2 scheduler; review recording; due/cram/weak-spot card selection; per-module mastery, streaks, and dashboard stats; and scored practice tests.

**Architecture:** Pure scheduling math lives in `reviewer/scheduler/sm2.py` (no DB). `reviewer/scheduler/review.py` applies a rating to a card (update schedule + log review + record study day). `reviewer/scheduler/selection.py` picks cards (due / cram / weak-spots). `reviewer/progress/` derives streaks, mastery, and stats from the Reviews log and card/module state. `reviewer/practice/` builds and scores practice tests. All persistence goes through the Plan 1 repository. Builds on Plans 1–3.

**Tech Stack:** Python 3.11+, stdlib `datetime`.

---

## File Structure

- `reviewer/scheduler/__init__.py`
- `reviewer/scheduler/sm2.py` — `next_schedule` (pure).
- `reviewer/scheduler/review.py` — `review_card`.
- `reviewer/scheduler/selection.py` — `due_cards`, `cram_cards`, `weak_spot_cards`.
- `reviewer/progress/__init__.py`
- `reviewer/progress/streaks.py` — `current_streak`, `longest_streak`.
- `reviewer/progress/mastery.py` — `module_finished`, `document_mastery`.
- `reviewer/progress/stats.py` — `dashboard_stats`.
- `reviewer/practice/__init__.py`
- `reviewer/practice/test.py` — `build_practice_test`, `score`.
- Tests mirror each module.

### Rating vocabulary
`again` | `hard` | `good` | `easy` (matches the `reviews.rating` CHECK constraint).

### Scheduling model (hours-based, cram-friendly)
- Intervals are in **minutes**, capped at `MAX_INTERVAL_MINUTES = 2880` (2 days).
- Ease factor bounded to `[1.3, 3.0]`, default 2.5.
- **New card** (review_count 0): again→10, hard→30, good→60, easy→240 minutes.
- **Established card**: again→reset 10 min & ease−0.20; hard→interval×1.2 & ease−0.15; good→interval×ease; easy→interval×ease×1.3 & ease+0.15.
- `review_count` increments each review; `due_at = now + interval`.

---

## Task 1: SM-2 scheduling math (pure)

**Files:**
- Create: `reviewer/scheduler/__init__.py` (docstring)
- Create: `reviewer/scheduler/sm2.py`
- Test: `tests/test_sm2.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_sm2.py
from datetime import datetime
from reviewer.scheduler.sm2 import next_schedule, MAX_INTERVAL_MINUTES

NOW = datetime(2026, 7, 16, 9, 0, 0)


def test_new_card_ratings_set_base_intervals():
    for rating, expected in [("again", 10), ("hard", 30), ("good", 60), ("easy", 240)]:
        r = next_schedule(interval_minutes=0, ease_factor=2.5, review_count=0,
                          rating=rating, now=NOW)
        assert r.interval_minutes == expected
        assert r.review_count == 1


def test_good_multiplies_interval_by_ease():
    r = next_schedule(interval_minutes=60, ease_factor=2.5, review_count=1,
                      rating="good", now=NOW)
    assert r.interval_minutes == 150  # round(60 * 2.5)
    assert r.ease_factor == 2.5


def test_again_resets_interval_and_lowers_ease():
    r = next_schedule(interval_minutes=600, ease_factor=2.5, review_count=3,
                      rating="again", now=NOW)
    assert r.interval_minutes == 10
    assert r.ease_factor == 2.3


def test_easy_raises_ease_and_grows_faster():
    r = next_schedule(interval_minutes=60, ease_factor=2.5, review_count=1,
                      rating="easy", now=NOW)
    assert r.ease_factor == 2.65
    assert r.interval_minutes == round(60 * 2.65 * 1.3)


def test_interval_capped_at_max():
    r = next_schedule(interval_minutes=2000, ease_factor=3.0, review_count=5,
                      rating="good", now=NOW)
    assert r.interval_minutes == MAX_INTERVAL_MINUTES


def test_ease_floor_is_1_3():
    r = next_schedule(interval_minutes=10, ease_factor=1.3, review_count=2,
                      rating="again", now=NOW)
    assert r.ease_factor == 1.3


def test_due_at_is_now_plus_interval_iso():
    r = next_schedule(interval_minutes=0, ease_factor=2.5, review_count=0,
                      rating="good", now=NOW)
    assert r.due_at == datetime(2026, 7, 16, 10, 0, 0).isoformat(timespec="seconds")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_sm2.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/scheduler/__init__.py
"""Short-term, hours-based spaced-repetition scheduling."""
```

```python
# reviewer/scheduler/sm2.py
from dataclasses import dataclass
from datetime import datetime, timedelta

MAX_INTERVAL_MINUTES = 2880  # 2 days
_MIN_EASE = 1.3
_MAX_EASE = 3.0
_NEW_INTERVALS = {"again": 10, "hard": 30, "good": 60, "easy": 240}


@dataclass
class ScheduleResult:
    interval_minutes: int
    ease_factor: float
    review_count: int
    due_at: str


def _clamp_ease(ease: float) -> float:
    return max(_MIN_EASE, min(_MAX_EASE, round(ease, 2)))


def next_schedule(*, interval_minutes: int, ease_factor: float, review_count: int,
                  rating: str, now: datetime,
                  max_interval_minutes: int = MAX_INTERVAL_MINUTES) -> ScheduleResult:
    """Compute the next schedule for a card given a recall rating."""
    if review_count == 0:
        new_interval = _NEW_INTERVALS[rating]
        new_ease = ease_factor
    elif rating == "again":
        new_interval = 10
        new_ease = _clamp_ease(ease_factor - 0.20)
    elif rating == "hard":
        new_interval = round(interval_minutes * 1.2)
        new_ease = _clamp_ease(ease_factor - 0.15)
    elif rating == "good":
        new_ease = _clamp_ease(ease_factor)
        new_interval = round(interval_minutes * new_ease)
    elif rating == "easy":
        new_ease = _clamp_ease(ease_factor + 0.15)
        new_interval = round(interval_minutes * new_ease * 1.3)
    else:
        raise ValueError(f"Unknown rating: {rating}")

    new_interval = max(1, min(new_interval, max_interval_minutes))
    due_at = (now + timedelta(minutes=new_interval)).isoformat(timespec="seconds")
    return ScheduleResult(interval_minutes=new_interval, ease_factor=new_ease,
                          review_count=review_count + 1, due_at=due_at)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_sm2.py -v`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/scheduler/__init__.py reviewer/scheduler/sm2.py tests/test_sm2.py
git commit -m "feat: hours-based SM-2 scheduling math"
```

---

## Task 2: Review a card

**Files:**
- Create: `reviewer/scheduler/review.py`
- Test: `tests/test_review.py`

`review_card(conn, card_id, rating, now=None)` loads the card, computes the next schedule, updates the card, logs the review, and records the study day. Returns the updated `Card`. If the card's document has an `exam_date`, the interval is capped so the card stays due on/before the exam.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_review.py
from datetime import datetime
from reviewer import repository as repo
from reviewer.models import Document, Module, Card
from reviewer.scheduler.review import review_card

NOW = datetime(2026, 7, 16, 9, 0, 0)


def _card(conn, exam_date=None):
    d = repo.create_document(conn, Document(
        None, "D", "text", "2026-07-16T08:00:00", "src", exam_date=exam_date))
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    return repo.create_card(conn, Card(
        None, d.id, m.id, "flashcard", "Q", "A",
        due_at=NOW.isoformat(timespec="seconds"), created_at="2026-07-16T08:00:00")), d


def test_review_updates_schedule_and_logs(conn):
    card, _ = _card(conn)
    updated = review_card(conn, card.id, "good", now=NOW)
    assert updated.review_count == 1
    assert updated.interval_minutes == 60
    assert len(repo.list_reviews_for_card(conn, card.id)) == 1
    assert repo.list_study_days(conn) == ["2026-07-16"]


def test_review_records_rating_value(conn):
    card, _ = _card(conn)
    review_card(conn, card.id, "again", now=NOW)
    assert repo.list_reviews_for_card(conn, card.id)[0].rating == "again"


def test_exam_date_caps_due_at(conn):
    # exam is 30 min away; a good rating would want 60 min, must cap to <= exam.
    exam = datetime(2026, 7, 16, 9, 30, 0)
    card, _ = _card(conn, exam_date=exam.isoformat(timespec="seconds"))
    updated = review_card(conn, card.id, "good", now=NOW)
    assert updated.due_at <= exam.isoformat(timespec="seconds")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_review.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/scheduler/review.py
import sqlite3
from datetime import datetime

from reviewer import repository as repo
from reviewer.models import Review
from reviewer.scheduler.sm2 import next_schedule


def review_card(conn: sqlite3.Connection, card_id: int, rating: str,
                now: datetime | None = None):
    """Apply a recall rating: reschedule the card, log the review, record the day."""
    now = now or datetime.now()
    card = repo.get_card(conn, card_id)
    if card is None:
        raise ValueError(f"No card with id {card_id}")

    result = next_schedule(
        interval_minutes=card.interval_minutes, ease_factor=card.ease_factor,
        review_count=card.review_count, rating=rating, now=now)

    due_at = result.due_at
    document = repo.get_document(conn, card.document_id)
    if document is not None and document.exam_date and due_at > document.exam_date:
        due_at = document.exam_date

    repo.update_card_schedule(
        conn, card_id, due_at=due_at, interval_minutes=result.interval_minutes,
        ease_factor=result.ease_factor, review_count=result.review_count)
    repo.log_review(conn, Review(
        None, card_id, now.isoformat(timespec="seconds"), rating))
    repo.record_study_day(conn, now.date().isoformat())
    return repo.get_card(conn, card_id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_review.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/scheduler/review.py tests/test_review.py
git commit -m "feat: apply recall rating with exam-date capping"
```

---

## Task 3: Card selection (due / cram / weak-spots)

**Files:**
- Create: `reviewer/scheduler/selection.py`
- Test: `tests/test_selection.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_selection.py
from datetime import datetime
from reviewer import repository as repo
from reviewer.models import Document, Module, Card, Review
from reviewer.scheduler.selection import due_cards, cram_cards, weak_spot_cards

NOW = datetime(2026, 7, 16, 12, 0, 0)


def _doc_with_cards(conn, due_ats):
    d = repo.create_document(conn, Document(None, "D", "text", "t", "src"))
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    cards = []
    for i, due in enumerate(due_ats):
        cards.append(repo.create_card(conn, Card(
            None, d.id, m.id, "flashcard", f"Q{i}", f"A{i}",
            due_at=due, created_at="t")))
    return d, cards


def test_due_cards_returns_only_past_due(conn):
    d, cards = _doc_with_cards(conn, [
        "2026-07-16T11:00:00",  # due
        "2026-07-16T13:00:00",  # future
    ])
    due = due_cards(conn, d.id, now=NOW)
    assert [c.question for c in due] == ["Q0"]


def test_cram_cards_returns_all_regardless_of_due(conn):
    d, cards = _doc_with_cards(conn, [
        "2026-07-16T11:00:00", "2026-07-16T13:00:00"])
    assert len(cram_cards(conn, d.id)) == 2


def test_weak_spot_cards_ranks_by_again_and_hard(conn):
    d, cards = _doc_with_cards(conn, ["t", "t"])
    # card 0 missed twice, card 1 once
    for rating in ("again", "hard"):
        repo.log_review(conn, Review(None, cards[0].id, "2026-07-16T10:00:00", rating))
    repo.log_review(conn, Review(None, cards[1].id, "2026-07-16T10:00:00", "again"))
    weak = weak_spot_cards(conn, d.id)
    assert weak[0].id == cards[0].id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_selection.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/scheduler/selection.py
import sqlite3
from datetime import datetime

from reviewer import repository as repo
from reviewer.models import Card


def due_cards(conn: sqlite3.Connection, document_id: int,
              now: datetime | None = None) -> list[Card]:
    now = now or datetime.now()
    cutoff = now.isoformat(timespec="seconds")
    return [c for c in repo.list_cards_for_document(conn, document_id)
            if c.due_at <= cutoff]


def cram_cards(conn: sqlite3.Connection, document_id: int) -> list[Card]:
    """All cards, ignoring the schedule (exam-mode)."""
    return repo.list_cards_for_document(conn, document_id)


def weak_spot_cards(conn: sqlite3.Connection, document_id: int,
                    limit: int | None = None) -> list[Card]:
    """Cards ranked by how often they were rated 'again' or 'hard', most-missed first."""
    rows = conn.execute(
        """SELECT c.id AS card_id,
                  SUM(CASE WHEN r.rating IN ('again', 'hard') THEN 1 ELSE 0 END) AS misses
           FROM cards c JOIN reviews r ON r.card_id = c.id
           WHERE c.document_id = ?
           GROUP BY c.id
           HAVING misses > 0
           ORDER BY misses DESC, c.id""",
        (document_id,),
    ).fetchall()
    cards = [repo.get_card(conn, row["card_id"]) for row in rows]
    return cards[:limit] if limit else cards
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_selection.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/scheduler/selection.py tests/test_selection.py
git commit -m "feat: due, cram, and weak-spot card selection"
```

---

## Task 4: Streaks

**Files:**
- Create: `reviewer/progress/__init__.py` (docstring)
- Create: `reviewer/progress/streaks.py`
- Test: `tests/test_streaks.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_streaks.py
from datetime import date
from reviewer import repository as repo
from reviewer.progress.streaks import current_streak, longest_streak


def test_current_streak_counts_consecutive_days_including_today(conn):
    for day in ["2026-07-14", "2026-07-15", "2026-07-16"]:
        repo.record_study_day(conn, day)
    assert current_streak(conn, today=date(2026, 7, 16)) == 3


def test_current_streak_allows_today_missing_if_yesterday_present(conn):
    for day in ["2026-07-14", "2026-07-15"]:
        repo.record_study_day(conn, day)
    # Not studied today yet, but streak through yesterday still counts.
    assert current_streak(conn, today=date(2026, 7, 16)) == 2


def test_current_streak_breaks_on_gap(conn):
    for day in ["2026-07-10", "2026-07-15", "2026-07-16"]:
        repo.record_study_day(conn, day)
    assert current_streak(conn, today=date(2026, 7, 16)) == 2


def test_current_streak_zero_when_stale(conn):
    repo.record_study_day(conn, "2026-07-10")
    assert current_streak(conn, today=date(2026, 7, 16)) == 0


def test_longest_streak(conn):
    for day in ["2026-07-01", "2026-07-02", "2026-07-03",
                "2026-07-10", "2026-07-11"]:
        repo.record_study_day(conn, day)
    assert longest_streak(conn) == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_streaks.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/progress/__init__.py
"""Progress tracking: streaks, mastery, and dashboard stats."""
```

```python
# reviewer/progress/streaks.py
import sqlite3
from datetime import date, timedelta

from reviewer import repository as repo


def _days(conn: sqlite3.Connection) -> set[date]:
    return {date.fromisoformat(d) for d in repo.list_study_days(conn)}


def current_streak(conn: sqlite3.Connection, today: date | None = None) -> int:
    """Consecutive study days ending today or yesterday; 0 if neither was studied."""
    today = today or date.today()
    days = _days(conn)
    if today in days:
        cursor = today
    elif (today - timedelta(days=1)) in days:
        cursor = today - timedelta(days=1)
    else:
        return 0
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def longest_streak(conn: sqlite3.Connection) -> int:
    """Longest run of consecutive study days ever recorded."""
    days = sorted(_days(conn))
    if not days:
        return 0
    best = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if cur - prev == timedelta(days=1) else 1
        best = max(best, run)
    return best
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_streaks.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/progress/__init__.py reviewer/progress/streaks.py tests/test_streaks.py
git commit -m "feat: current and longest study streaks"
```

---

## Task 5: Mastery

**Files:**
- Create: `reviewer/progress/mastery.py`
- Test: `tests/test_mastery.py`

A module is **finished** once every card in it has been reviewed at least once (`review_count > 0`). Document mastery = finished modules / total modules.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_mastery.py
from reviewer import repository as repo
from reviewer.models import Document, Module, Card
from reviewer.progress.mastery import module_finished, document_mastery


def _module_with_cards(conn, doc_id, title, pos, n):
    m = repo.create_module(conn, Module(None, doc_id, title, pos))
    cards = [repo.create_card(conn, Card(
        None, doc_id, m.id, "flashcard", f"Q{i}", f"A{i}",
        due_at="t", created_at="t")) for i in range(n)]
    return m, cards


def _review_all(conn, cards):
    for c in cards:
        repo.update_card_schedule(conn, c.id, due_at="t", interval_minutes=60,
                                  ease_factor=2.5, review_count=1)


def test_module_finished_only_when_all_cards_reviewed(conn):
    d = repo.create_document(conn, Document(None, "D", "text", "t", "s"))
    m, cards = _module_with_cards(conn, d.id, "M", 0, 2)
    assert module_finished(conn, m.id) is False
    _review_all(conn, cards[:1])
    assert module_finished(conn, m.id) is False
    _review_all(conn, cards)
    assert module_finished(conn, m.id) is True


def test_empty_module_is_not_finished(conn):
    d = repo.create_document(conn, Document(None, "D", "text", "t", "s"))
    m = repo.create_module(conn, Module(None, d.id, "Empty", 0))
    assert module_finished(conn, m.id) is False


def test_document_mastery_counts_finished_modules(conn):
    d = repo.create_document(conn, Document(None, "D", "text", "t", "s"))
    m1, c1 = _module_with_cards(conn, d.id, "M1", 0, 1)
    m2, c2 = _module_with_cards(conn, d.id, "M2", 1, 1)
    _review_all(conn, c1)
    assert document_mastery(conn, d.id) == (1, 2)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_mastery.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/progress/mastery.py
import sqlite3

from reviewer import repository as repo


def module_finished(conn: sqlite3.Connection, module_id: int) -> bool:
    """True when the module has cards and every card was reviewed at least once."""
    cards = repo.list_cards_for_module(conn, module_id)
    if not cards:
        return False
    return all(c.review_count > 0 for c in cards)


def document_mastery(conn: sqlite3.Connection, document_id: int) -> tuple[int, int]:
    """Return (finished_modules, total_modules) for a document."""
    modules = repo.list_modules(conn, document_id)
    finished = sum(1 for m in modules if module_finished(conn, m.id))
    return finished, len(modules)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_mastery.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/progress/mastery.py tests/test_mastery.py
git commit -m "feat: module-finished and document mastery"
```

---

## Task 6: Dashboard stats

**Files:**
- Create: `reviewer/progress/stats.py`
- Test: `tests/test_stats.py`

`dashboard_stats(conn, document_id, now, today)` returns a dict: `cards_total`, `cards_due`, `modules_finished`, `modules_total`, `reviews_today`, `reviews_all_time`, `streak`, `longest_streak`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_stats.py
from datetime import datetime, date
from reviewer import repository as repo
from reviewer.models import Document, Module, Card, Review
from reviewer.progress.stats import dashboard_stats

NOW = datetime(2026, 7, 16, 12, 0, 0)
TODAY = date(2026, 7, 16)


def test_dashboard_stats(conn):
    d = repo.create_document(conn, Document(None, "D", "text", "t", "s"))
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    c1 = repo.create_card(conn, Card(None, d.id, m.id, "flashcard", "Q1", "A1",
                                     due_at="2026-07-16T11:00:00", created_at="t"))
    c2 = repo.create_card(conn, Card(None, d.id, m.id, "flashcard", "Q2", "A2",
                                     due_at="2026-07-16T13:00:00", created_at="t"))
    repo.log_review(conn, Review(None, c1.id, "2026-07-16T10:00:00", "good"))
    repo.log_review(conn, Review(None, c1.id, "2026-07-15T10:00:00", "good"))
    repo.record_study_day(conn, "2026-07-16")

    stats = dashboard_stats(conn, d.id, now=NOW, today=TODAY)
    assert stats["cards_total"] == 2
    assert stats["cards_due"] == 1          # only c1 past due
    assert stats["modules_total"] == 1
    assert stats["modules_finished"] == 0   # c2 never reviewed
    assert stats["reviews_today"] == 1
    assert stats["reviews_all_time"] == 2
    assert stats["streak"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_stats.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/progress/stats.py
import sqlite3
from datetime import date, datetime

from reviewer import repository as repo
from reviewer.progress.mastery import document_mastery
from reviewer.progress.streaks import current_streak, longest_streak
from reviewer.scheduler.selection import due_cards


def dashboard_stats(conn: sqlite3.Connection, document_id: int,
                    now: datetime | None = None,
                    today: date | None = None) -> dict:
    now = now or datetime.now()
    today = today or date.today()
    cards = repo.list_cards_for_document(conn, document_id)
    finished, total_modules = document_mastery(conn, document_id)

    reviews_all_time = 0
    reviews_today = 0
    today_str = today.isoformat()
    for card in cards:
        for review in repo.list_reviews_for_card(conn, card.id):
            reviews_all_time += 1
            if review.rated_at.startswith(today_str):
                reviews_today += 1

    return {
        "cards_total": len(cards),
        "cards_due": len(due_cards(conn, document_id, now=now)),
        "modules_finished": finished,
        "modules_total": total_modules,
        "reviews_today": reviews_today,
        "reviews_all_time": reviews_all_time,
        "streak": current_streak(conn, today=today),
        "longest_streak": longest_streak(conn),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_stats.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/progress/stats.py tests/test_stats.py
git commit -m "feat: dashboard stats aggregation"
```

---

## Task 7: Practice test

**Files:**
- Create: `reviewer/practice/__init__.py` (docstring)
- Create: `reviewer/practice/test.py`
- Test: `tests/test_practice.py`

A practice test is a set of cards (whole document or one module). Grading is caller-driven (the UI records whether each answer was correct); `score` turns a list of booleans into a result dict.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_practice.py
import pytest
from reviewer import repository as repo
from reviewer.models import Document, Module, Card
from reviewer.practice.test import build_practice_test, score


def _doc(conn):
    d = repo.create_document(conn, Document(None, "D", "text", "t", "s"))
    m1 = repo.create_module(conn, Module(None, d.id, "M1", 0))
    m2 = repo.create_module(conn, Module(None, d.id, "M2", 1))
    repo.create_card(conn, Card(None, d.id, m1.id, "flashcard", "Q1", "A1", due_at="t", created_at="t"))
    repo.create_card(conn, Card(None, d.id, m2.id, "flashcard", "Q2", "A2", due_at="t", created_at="t"))
    return d, m1


def test_build_practice_test_for_document(conn):
    d, m1 = _doc(conn)
    cards = build_practice_test(conn, document_id=d.id)
    assert len(cards) == 2


def test_build_practice_test_for_module(conn):
    d, m1 = _doc(conn)
    cards = build_practice_test(conn, module_id=m1.id)
    assert [c.question for c in cards] == ["Q1"]


def test_build_practice_test_requires_a_target(conn):
    with pytest.raises(ValueError):
        build_practice_test(conn)


def test_score_computes_percent():
    result = score([True, True, False, True])
    assert result == {"correct": 3, "total": 4, "percent": 75}


def test_score_empty():
    assert score([]) == {"correct": 0, "total": 0, "percent": 0}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_practice.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/practice/__init__.py
"""Practice tests: scored mock quizzes over a module or document."""
```

```python
# reviewer/practice/test.py
import sqlite3

from reviewer import repository as repo
from reviewer.models import Card


def build_practice_test(conn: sqlite3.Connection, *, document_id: int | None = None,
                        module_id: int | None = None) -> list[Card]:
    """Return the cards for a practice test over a document or a single module."""
    if module_id is not None:
        return repo.list_cards_for_module(conn, module_id)
    if document_id is not None:
        return repo.list_cards_for_document(conn, document_id)
    raise ValueError("Provide either document_id or module_id.")


def score(results: list[bool]) -> dict:
    """Turn per-question correctness into a score summary."""
    total = len(results)
    correct = sum(1 for r in results if r)
    percent = round(correct / total * 100) if total else 0
    return {"correct": correct, "total": total, "percent": percent}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_practice.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -q`
Expected: all tests PASS (Plans 1–4).

- [ ] **Step 6: Commit**

```bash
git add reviewer/practice/__init__.py reviewer/practice/test.py tests/test_practice.py
git commit -m "feat: practice test builder and scoring"
```

---

## Definition of done

- `python -m pytest -q` fully green.
- `reviewer/scheduler` provides hours-based SM-2 (`next_schedule`), rating
  application with exam-date capping (`review_card`), and card selection
  (`due_cards`, `cram_cards`, `weak_spot_cards`).
- `reviewer/progress` provides streaks, module/document mastery, and
  `dashboard_stats`.
- `reviewer/practice` builds and scores practice tests.
- All logic is pure/DB-backed and testable without any Claude API access.
- Ready for Plan 5 (web UI): endpoints call these functions to drive upload →
  generate → study → dashboard.
