# Storage Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the project scaffold, configuration, and local SQLite storage layer that every later feature (parsing, AI generation, scheduling, UI) reads and writes through.

**Architecture:** A single Python package `reviewer/`. Configuration is loaded from environment/`.env` (Claude API key, DB path). Storage is plain `sqlite3` (stdlib) behind a thin data-access module: one `schema.py` that creates tables, one `db.py` that manages connections, and one `repository.py` of focused functions per entity. No ORM — transparent SQL, easy to test against an in-memory database.

**Tech Stack:** Python 3.11+, `sqlite3` (stdlib), `python-dotenv`, `pytest`.

---

## File Structure

- `pyproject.toml` — project metadata + dependencies.
- `.env.example` — documents required env vars (`ANTHROPIC_API_KEY`, `REVIEWER_DB_PATH`).
- `reviewer/__init__.py` — package marker.
- `reviewer/config.py` — loads and validates configuration.
- `reviewer/db.py` — connection factory (file or in-memory), enables foreign keys.
- `reviewer/schema.py` — SQL to create all tables; `init_db(conn)`.
- `reviewer/models.py` — lightweight dataclasses for each entity.
- `reviewer/repository.py` — CRUD functions per entity.
- `tests/conftest.py` — pytest fixture: fresh in-memory DB per test.
- `tests/test_config.py`, `tests/test_schema.py`, `tests/test_repository.py`.

### Data model (tables)

- `documents(id, title, source_type, created_at, extracted_text, exam_date, cheat_sheet)`
- `modules(id, document_id, title, position)`
- `module_sections(id, module_id, heading, content, origin, position)` — `origin` ∈ {`from-file`, `added-context`}
- `cards(id, document_id, module_id, card_type, question, answer, due_at, interval_minutes, ease_factor, review_count, created_at)`
- `reviews(id, card_id, rated_at, rating)`
- `study_days(day)` — one row per date studied (streaks)

---

## Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `reviewer/__init__.py`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "reviewer"
version = "0.1.0"
description = "Local study reviewer app with short-term spaced repetition"
requires-python = ">=3.11"
dependencies = [
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

- [ ] **Step 2: Create `.env.example`**

```bash
# Copy to .env and fill in. .env is gitignored.
ANTHROPIC_API_KEY=sk-ant-your-key-here
# Where the local SQLite database lives. Defaults to ./reviewer.sqlite3 if unset.
REVIEWER_DB_PATH=reviewer.sqlite3
```

- [ ] **Step 3: Create empty package markers**

Create `reviewer/__init__.py` with a single line:

```python
"""Local study reviewer app."""
```

Create `tests/__init__.py` as an empty file (no content).

- [ ] **Step 4: Create and activate a virtual environment, install dev deps**

Run:
```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Git Bash:           source .venv/Scripts/activate
pip install -e ".[dev]"
```
Expected: installs `python-dotenv` and `pytest` without errors.

- [ ] **Step 5: Verify pytest runs (collects zero tests)**

Run: `pytest -q`
Expected: `no tests ran` (exit code 5 is fine at this point).

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml .env.example reviewer/__init__.py tests/__init__.py
git commit -m "chore: project scaffold and dependencies"
```

---

## Task 2: Configuration module

**Files:**
- Create: `reviewer/config.py`
- Test: `tests/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_config.py
import pytest
from reviewer.config import load_config, ConfigError


def test_load_config_reads_api_key_and_default_db_path(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("REVIEWER_DB_PATH", raising=False)
    cfg = load_config()
    assert cfg.anthropic_api_key == "sk-ant-test"
    assert cfg.db_path == "reviewer.sqlite3"


def test_load_config_uses_custom_db_path(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_DB_PATH", "/tmp/custom.sqlite3")
    cfg = load_config()
    assert cfg.db_path == "/tmp/custom.sqlite3"


def test_load_config_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ConfigError):
        load_config()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.config'`

- [ ] **Step 3: Write minimal implementation**

```python
# reviewer/config.py
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # reads .env if present; no error if absent


class ConfigError(Exception):
    """Raised when required configuration is missing or invalid."""


@dataclass(frozen=True)
class Config:
    anthropic_api_key: str
    db_path: str


def load_config() -> Config:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ConfigError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    db_path = os.environ.get("REVIEWER_DB_PATH") or "reviewer.sqlite3"
    return Config(anthropic_api_key=api_key, db_path=db_path)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/config.py tests/test_config.py
git commit -m "feat: configuration loading with API key validation"
```

---

## Task 3: Database connection factory

**Files:**
- Create: `reviewer/db.py`
- Test: `tests/test_schema.py` (connection part)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_schema.py
import sqlite3
from reviewer.db import connect


def test_connect_in_memory_returns_connection():
    conn = connect(":memory:")
    assert isinstance(conn, sqlite3.Connection)
    conn.close()


def test_connect_enables_foreign_keys():
    conn = connect(":memory:")
    cur = conn.execute("PRAGMA foreign_keys")
    assert cur.fetchone()[0] == 1
    conn.close()


def test_connect_rows_are_accessible_by_name():
    conn = connect(":memory:")
    conn.execute("CREATE TABLE t (a INTEGER, b TEXT)")
    conn.execute("INSERT INTO t (a, b) VALUES (1, 'x')")
    row = conn.execute("SELECT a, b FROM t").fetchone()
    assert row["a"] == 1
    assert row["b"] == "x"
    conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_schema.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.db'`

- [ ] **Step 3: Write minimal implementation**

```python
# reviewer/db.py
import sqlite3


def connect(db_path: str) -> sqlite3.Connection:
    """Open a SQLite connection with foreign keys on and name-based row access."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_schema.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/db.py tests/test_schema.py
git commit -m "feat: sqlite connection factory with foreign keys and row access"
```

---

## Task 4: Schema creation

**Files:**
- Create: `reviewer/schema.py`
- Test: `tests/test_schema.py` (append)

- [ ] **Step 1: Write the failing test (append to `tests/test_schema.py`)**

```python
from reviewer.schema import init_db


def test_init_db_creates_all_tables():
    conn = connect(":memory:")
    init_db(conn)
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    names = {r["name"] for r in rows}
    assert {
        "documents",
        "modules",
        "module_sections",
        "cards",
        "reviews",
        "study_days",
    } <= names
    conn.close()


def test_init_db_is_idempotent():
    conn = connect(":memory:")
    init_db(conn)
    init_db(conn)  # must not raise
    conn.close()


def test_foreign_key_enforced_on_modules():
    import sqlite3
    conn = connect(":memory:")
    init_db(conn)
    try:
        # document_id 999 does not exist -> FK violation
        conn.execute(
            "INSERT INTO modules (document_id, title, position) VALUES (999, 'x', 0)"
        )
        raised = False
    except sqlite3.IntegrityError:
        raised = True
    assert raised
    conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_schema.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.schema'`

- [ ] **Step 3: Write minimal implementation**

```python
# reviewer/schema.py
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    source_type   TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    exam_date     TEXT,
    cheat_sheet   TEXT
);

CREATE TABLE IF NOT EXISTS modules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    title       TEXT NOT NULL,
    position    INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS module_sections (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    heading   TEXT NOT NULL,
    content   TEXT NOT NULL,
    origin    TEXT NOT NULL CHECK (origin IN ('from-file', 'added-context')),
    position  INTEGER NOT NULL,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id     INTEGER NOT NULL,
    module_id       INTEGER NOT NULL,
    card_type       TEXT NOT NULL CHECK (card_type IN ('flashcard', 'fill-in-blank', 'short-answer')),
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    due_at          TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL DEFAULT 0,
    ease_factor     REAL NOT NULL DEFAULT 2.5,
    review_count    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id   INTEGER NOT NULL,
    rated_at  TEXT NOT NULL,
    rating    TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_days (
    day TEXT PRIMARY KEY
);
"""


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables if they do not already exist."""
    conn.executescript(SCHEMA)
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_schema.py -v`
Expected: PASS (6 passed total in this file)

- [ ] **Step 5: Commit**

```bash
git add reviewer/schema.py tests/test_schema.py
git commit -m "feat: database schema for documents, modules, cards, reviews, streaks"
```

---

## Task 5: Models (dataclasses)

**Files:**
- Create: `reviewer/models.py`
- Test: `tests/test_repository.py` (imports these; no standalone test needed yet)

- [ ] **Step 1: Write the implementation directly (plain data holders, no logic to test)**

```python
# reviewer/models.py
from dataclasses import dataclass
from typing import Optional


@dataclass
class Document:
    id: Optional[int]
    title: str
    source_type: str
    created_at: str
    extracted_text: str
    exam_date: Optional[str] = None
    cheat_sheet: Optional[str] = None


@dataclass
class Module:
    id: Optional[int]
    document_id: int
    title: str
    position: int


@dataclass
class ModuleSection:
    id: Optional[int]
    module_id: int
    heading: str
    content: str
    origin: str  # 'from-file' | 'added-context'
    position: int


@dataclass
class Card:
    id: Optional[int]
    document_id: int
    module_id: int
    card_type: str  # 'flashcard' | 'fill-in-blank' | 'short-answer'
    question: str
    answer: str
    due_at: str
    interval_minutes: int = 0
    ease_factor: float = 2.5
    review_count: int = 0
    created_at: str = ""


@dataclass
class Review:
    id: Optional[int]
    card_id: int
    rated_at: str
    rating: str  # 'again' | 'hard' | 'good' | 'easy'
```

- [ ] **Step 2: Verify it imports**

Run: `python -c "import reviewer.models"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add reviewer/models.py
git commit -m "feat: dataclass models for storage entities"
```

---

## Task 6: Repository — pytest fixture

**Files:**
- Create: `tests/conftest.py`

- [ ] **Step 1: Write the shared in-memory DB fixture**

```python
# tests/conftest.py
import pytest
from reviewer.db import connect
from reviewer.schema import init_db


@pytest.fixture
def conn():
    c = connect(":memory:")
    init_db(c)
    yield c
    c.close()
```

- [ ] **Step 2: Verify pytest still collects cleanly**

Run: `pytest -q`
Expected: existing tests still PASS; the new fixture is unused so far (no failures).

- [ ] **Step 3: Commit**

```bash
git add tests/conftest.py
git commit -m "test: in-memory database fixture"
```

---

## Task 7: Repository — Documents

**Files:**
- Create: `reviewer/repository.py`
- Test: `tests/test_repository.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_repository.py
from reviewer import repository as repo
from reviewer.models import Document


def test_create_and_get_document(conn):
    doc = Document(
        id=None,
        title="Biology Ch. 1",
        source_type="pdf",
        created_at="2026-07-16T10:00:00",
        extracted_text="cells are the basic unit of life",
    )
    saved = repo.create_document(conn, doc)
    assert saved.id is not None

    fetched = repo.get_document(conn, saved.id)
    assert fetched.title == "Biology Ch. 1"
    assert fetched.source_type == "pdf"
    assert fetched.exam_date is None


def test_list_documents_returns_newest_first(conn):
    a = repo.create_document(conn, Document(None, "A", "text", "2026-07-16T09:00:00", "a"))
    b = repo.create_document(conn, Document(None, "B", "text", "2026-07-16T11:00:00", "b"))
    docs = repo.list_documents(conn)
    assert [d.id for d in docs] == [b.id, a.id]


def test_set_exam_date(conn):
    d = repo.create_document(conn, Document(None, "A", "text", "2026-07-16T09:00:00", "a"))
    repo.set_exam_date(conn, d.id, "2026-07-18")
    assert repo.get_document(conn, d.id).exam_date == "2026-07-18"


def test_set_cheat_sheet(conn):
    d = repo.create_document(conn, Document(None, "A", "text", "2026-07-16T09:00:00", "a"))
    repo.set_cheat_sheet(conn, d.id, "TL;DR: cells.")
    assert repo.get_document(conn, d.id).cheat_sheet == "TL;DR: cells."
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'reviewer.repository'`

- [ ] **Step 3: Write minimal implementation**

```python
# reviewer/repository.py
import sqlite3
from typing import Optional

from reviewer.models import Document


def _row_to_document(row: sqlite3.Row) -> Document:
    return Document(
        id=row["id"],
        title=row["title"],
        source_type=row["source_type"],
        created_at=row["created_at"],
        extracted_text=row["extracted_text"],
        exam_date=row["exam_date"],
        cheat_sheet=row["cheat_sheet"],
    )


def create_document(conn: sqlite3.Connection, doc: Document) -> Document:
    cur = conn.execute(
        """INSERT INTO documents
           (title, source_type, created_at, extracted_text, exam_date, cheat_sheet)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (doc.title, doc.source_type, doc.created_at, doc.extracted_text,
         doc.exam_date, doc.cheat_sheet),
    )
    conn.commit()
    doc.id = cur.lastrowid
    return doc


def get_document(conn: sqlite3.Connection, doc_id: int) -> Optional[Document]:
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return _row_to_document(row) if row else None


def list_documents(conn: sqlite3.Connection) -> list[Document]:
    rows = conn.execute(
        "SELECT * FROM documents ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [_row_to_document(r) for r in rows]


def set_exam_date(conn: sqlite3.Connection, doc_id: int, exam_date: Optional[str]) -> None:
    conn.execute("UPDATE documents SET exam_date = ? WHERE id = ?", (exam_date, doc_id))
    conn.commit()


def set_cheat_sheet(conn: sqlite3.Connection, doc_id: int, cheat_sheet: str) -> None:
    conn.execute("UPDATE documents SET cheat_sheet = ? WHERE id = ?", (cheat_sheet, doc_id))
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repository.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/repository.py tests/test_repository.py
git commit -m "feat: document repository (create, get, list, exam date, cheat sheet)"
```

---

## Task 8: Repository — Modules and sections

**Files:**
- Modify: `reviewer/repository.py`
- Test: `tests/test_repository.py` (append)

- [ ] **Step 1: Write the failing test (append)**

```python
from reviewer.models import Module, ModuleSection


def _doc(conn):
    return repo.create_document(conn, Document(None, "D", "text", "2026-07-16T09:00:00", "x"))


def test_create_and_list_modules_in_position_order(conn):
    d = _doc(conn)
    m2 = repo.create_module(conn, Module(None, d.id, "Second", 1))
    m1 = repo.create_module(conn, Module(None, d.id, "First", 0))
    mods = repo.list_modules(conn, d.id)
    assert [m.title for m in mods] == ["First", "Second"]
    assert m1.id is not None and m2.id is not None


def test_add_and_list_sections_with_origin(conn):
    d = _doc(conn)
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    repo.add_section(conn, ModuleSection(None, m.id, "Def", "A cell is...", "from-file", 0))
    repo.add_section(conn, ModuleSection(None, m.id, "Extra", "Related...", "added-context", 1))
    secs = repo.list_sections(conn, m.id)
    assert [s.origin for s in secs] == ["from-file", "added-context"]
    assert secs[0].heading == "Def"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL with `AttributeError: module 'reviewer.repository' has no attribute 'create_module'`

- [ ] **Step 3: Write minimal implementation (append to `reviewer/repository.py`)**

```python
from reviewer.models import Module, ModuleSection


def _row_to_module(row: sqlite3.Row) -> Module:
    return Module(id=row["id"], document_id=row["document_id"],
                  title=row["title"], position=row["position"])


def create_module(conn: sqlite3.Connection, module: Module) -> Module:
    cur = conn.execute(
        "INSERT INTO modules (document_id, title, position) VALUES (?, ?, ?)",
        (module.document_id, module.title, module.position),
    )
    conn.commit()
    module.id = cur.lastrowid
    return module


def list_modules(conn: sqlite3.Connection, document_id: int) -> list[Module]:
    rows = conn.execute(
        "SELECT * FROM modules WHERE document_id = ? ORDER BY position, id",
        (document_id,),
    ).fetchall()
    return [_row_to_module(r) for r in rows]


def _row_to_section(row: sqlite3.Row) -> ModuleSection:
    return ModuleSection(id=row["id"], module_id=row["module_id"],
                         heading=row["heading"], content=row["content"],
                         origin=row["origin"], position=row["position"])


def add_section(conn: sqlite3.Connection, section: ModuleSection) -> ModuleSection:
    cur = conn.execute(
        """INSERT INTO module_sections (module_id, heading, content, origin, position)
           VALUES (?, ?, ?, ?, ?)""",
        (section.module_id, section.heading, section.content,
         section.origin, section.position),
    )
    conn.commit()
    section.id = cur.lastrowid
    return section


def list_sections(conn: sqlite3.Connection, module_id: int) -> list[ModuleSection]:
    rows = conn.execute(
        "SELECT * FROM module_sections WHERE module_id = ? ORDER BY position, id",
        (module_id,),
    ).fetchall()
    return [_row_to_section(r) for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repository.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/repository.py tests/test_repository.py
git commit -m "feat: module and section repository functions"
```

---

## Task 9: Repository — Cards

**Files:**
- Modify: `reviewer/repository.py`
- Test: `tests/test_repository.py` (append)

- [ ] **Step 1: Write the failing test (append)**

```python
from reviewer.models import Card


def test_create_and_list_cards_for_module(conn):
    d = _doc(conn)
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    repo.create_card(conn, Card(None, d.id, m.id, "flashcard", "Q1", "A1",
                                due_at="2026-07-16T10:00:00", created_at="2026-07-16T09:00:00"))
    repo.create_card(conn, Card(None, d.id, m.id, "short-answer", "Q2", "A2",
                                due_at="2026-07-16T10:00:00", created_at="2026-07-16T09:00:00"))
    cards = repo.list_cards_for_module(conn, m.id)
    assert {c.question for c in cards} == {"Q1", "Q2"}
    assert cards[0].ease_factor == 2.5


def test_update_card_schedule(conn):
    d = _doc(conn)
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    c = repo.create_card(conn, Card(None, d.id, m.id, "flashcard", "Q", "A",
                                    due_at="2026-07-16T10:00:00", created_at="2026-07-16T09:00:00"))
    repo.update_card_schedule(conn, c.id, due_at="2026-07-16T14:00:00",
                              interval_minutes=240, ease_factor=2.6, review_count=1)
    updated = repo.get_card(conn, c.id)
    assert updated.due_at == "2026-07-16T14:00:00"
    assert updated.interval_minutes == 240
    assert updated.review_count == 1


def test_list_cards_for_document(conn):
    d = _doc(conn)
    m1 = repo.create_module(conn, Module(None, d.id, "M1", 0))
    m2 = repo.create_module(conn, Module(None, d.id, "M2", 1))
    repo.create_card(conn, Card(None, d.id, m1.id, "flashcard", "Q1", "A1",
                                due_at="2026-07-16T10:00:00", created_at="2026-07-16T09:00:00"))
    repo.create_card(conn, Card(None, d.id, m2.id, "flashcard", "Q2", "A2",
                                due_at="2026-07-16T10:00:00", created_at="2026-07-16T09:00:00"))
    assert len(repo.list_cards_for_document(conn, d.id)) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL with `AttributeError: module 'reviewer.repository' has no attribute 'create_card'`

- [ ] **Step 3: Write minimal implementation (append)**

```python
from reviewer.models import Card


def _row_to_card(row: sqlite3.Row) -> Card:
    return Card(
        id=row["id"], document_id=row["document_id"], module_id=row["module_id"],
        card_type=row["card_type"], question=row["question"], answer=row["answer"],
        due_at=row["due_at"], interval_minutes=row["interval_minutes"],
        ease_factor=row["ease_factor"], review_count=row["review_count"],
        created_at=row["created_at"],
    )


def create_card(conn: sqlite3.Connection, card: Card) -> Card:
    cur = conn.execute(
        """INSERT INTO cards
           (document_id, module_id, card_type, question, answer, due_at,
            interval_minutes, ease_factor, review_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (card.document_id, card.module_id, card.card_type, card.question, card.answer,
         card.due_at, card.interval_minutes, card.ease_factor, card.review_count,
         card.created_at),
    )
    conn.commit()
    card.id = cur.lastrowid
    return card


def get_card(conn: sqlite3.Connection, card_id: int) -> Optional[Card]:
    row = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    return _row_to_card(row) if row else None


def list_cards_for_module(conn: sqlite3.Connection, module_id: int) -> list[Card]:
    rows = conn.execute(
        "SELECT * FROM cards WHERE module_id = ? ORDER BY id", (module_id,)
    ).fetchall()
    return [_row_to_card(r) for r in rows]


def list_cards_for_document(conn: sqlite3.Connection, document_id: int) -> list[Card]:
    rows = conn.execute(
        "SELECT * FROM cards WHERE document_id = ? ORDER BY id", (document_id,)
    ).fetchall()
    return [_row_to_card(r) for r in rows]


def update_card_schedule(conn: sqlite3.Connection, card_id: int, *, due_at: str,
                         interval_minutes: int, ease_factor: float,
                         review_count: int) -> None:
    conn.execute(
        """UPDATE cards SET due_at = ?, interval_minutes = ?, ease_factor = ?,
           review_count = ? WHERE id = ?""",
        (due_at, interval_minutes, ease_factor, review_count, card_id),
    )
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repository.py -v`
Expected: PASS (9 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/repository.py tests/test_repository.py
git commit -m "feat: card repository (create, get, list, update schedule)"
```

---

## Task 10: Repository — Reviews and study days

**Files:**
- Modify: `reviewer/repository.py`
- Test: `tests/test_repository.py` (append)

- [ ] **Step 1: Write the failing test (append)**

```python
from reviewer.models import Review


def test_log_review_and_list_for_card(conn):
    d = _doc(conn)
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    c = repo.create_card(conn, Card(None, d.id, m.id, "flashcard", "Q", "A",
                                    due_at="2026-07-16T10:00:00", created_at="2026-07-16T09:00:00"))
    repo.log_review(conn, Review(None, c.id, "2026-07-16T10:05:00", "good"))
    repo.log_review(conn, Review(None, c.id, "2026-07-16T12:05:00", "again"))
    reviews = repo.list_reviews_for_card(conn, c.id)
    assert [r.rating for r in reviews] == ["good", "again"]


def test_record_study_day_is_unique(conn):
    repo.record_study_day(conn, "2026-07-16")
    repo.record_study_day(conn, "2026-07-16")  # duplicate must not raise
    repo.record_study_day(conn, "2026-07-15")
    days = repo.list_study_days(conn)
    assert days == ["2026-07-15", "2026-07-16"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repository.py -v`
Expected: FAIL with `AttributeError: module 'reviewer.repository' has no attribute 'log_review'`

- [ ] **Step 3: Write minimal implementation (append)**

```python
from reviewer.models import Review


def _row_to_review(row: sqlite3.Row) -> Review:
    return Review(id=row["id"], card_id=row["card_id"],
                  rated_at=row["rated_at"], rating=row["rating"])


def log_review(conn: sqlite3.Connection, review: Review) -> Review:
    cur = conn.execute(
        "INSERT INTO reviews (card_id, rated_at, rating) VALUES (?, ?, ?)",
        (review.card_id, review.rated_at, review.rating),
    )
    conn.commit()
    review.id = cur.lastrowid
    return review


def list_reviews_for_card(conn: sqlite3.Connection, card_id: int) -> list[Review]:
    rows = conn.execute(
        "SELECT * FROM reviews WHERE card_id = ? ORDER BY rated_at, id", (card_id,)
    ).fetchall()
    return [_row_to_review(r) for r in rows]


def record_study_day(conn: sqlite3.Connection, day: str) -> None:
    conn.execute("INSERT OR IGNORE INTO study_days (day) VALUES (?)", (day,))
    conn.commit()


def list_study_days(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute("SELECT day FROM study_days ORDER BY day").fetchall()
    return [r["day"] for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repository.py -v`
Expected: PASS (11 passed)

- [ ] **Step 5: Commit**

```bash
git add reviewer/repository.py tests/test_repository.py
git commit -m "feat: review log and study-day repository functions"
```

---

## Task 11: End-to-end storage smoke test

**Files:**
- Test: `tests/test_storage_e2e.py`

- [ ] **Step 1: Write the end-to-end test**

```python
# tests/test_storage_e2e.py
from reviewer import repository as repo
from reviewer.models import Document, Module, ModuleSection, Card, Review


def test_full_document_lifecycle(conn):
    doc = repo.create_document(conn, Document(
        None, "Chem Notes", "pptx", "2026-07-16T09:00:00", "atoms and bonds"))
    module = repo.create_module(conn, Module(None, doc.id, "Atoms", 0))
    repo.add_section(conn, ModuleSection(
        None, module.id, "Atom", "smallest unit of matter", "from-file", 0))
    repo.add_section(conn, ModuleSection(
        None, module.id, "History", "coined by Democritus", "added-context", 1))
    card = repo.create_card(conn, Card(
        None, doc.id, module.id, "flashcard", "What is an atom?",
        "smallest unit of matter", due_at="2026-07-16T09:00:00",
        created_at="2026-07-16T09:00:00"))
    repo.log_review(conn, Review(None, card.id, "2026-07-16T09:10:00", "good"))
    repo.record_study_day(conn, "2026-07-16")

    assert len(repo.list_documents(conn)) == 1
    assert len(repo.list_modules(conn, doc.id)) == 1
    assert len(repo.list_sections(conn, module.id)) == 2
    assert len(repo.list_cards_for_document(conn, doc.id)) == 1
    assert len(repo.list_reviews_for_card(conn, card.id)) == 1
    assert repo.list_study_days(conn) == ["2026-07-16"]
```

- [ ] **Step 2: Run the full test suite**

Run: `pytest -q`
Expected: all tests PASS (config + schema + repository + e2e).

- [ ] **Step 3: Commit**

```bash
git add tests/test_storage_e2e.py
git commit -m "test: end-to-end storage lifecycle"
```

---

## Definition of done

- `pytest -q` passes with all tests green.
- `reviewer/` exposes: `config.load_config`, `db.connect`, `schema.init_db`, and
  a `repository` module with create/list/get/update functions for documents,
  modules, sections, cards, reviews, and study days.
- No `.env` or `*.sqlite3` committed (already gitignored).
- Ready for Plan 2 (File parsing) to write extracted text into `documents`.
