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
