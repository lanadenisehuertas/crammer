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
