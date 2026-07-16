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
