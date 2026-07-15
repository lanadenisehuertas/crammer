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
