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
