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
