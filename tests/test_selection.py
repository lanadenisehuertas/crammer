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
