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
