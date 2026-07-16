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
