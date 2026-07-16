import sqlite3

from reviewer import repository as repo


def module_finished(conn: sqlite3.Connection, module_id: int) -> bool:
    """True when the module has cards and every card was reviewed at least once."""
    cards = repo.list_cards_for_module(conn, module_id)
    if not cards:
        return False
    return all(c.review_count > 0 for c in cards)


def document_mastery(conn: sqlite3.Connection, document_id: int) -> tuple[int, int]:
    """Return (finished_modules, total_modules) for a document."""
    modules = repo.list_modules(conn, document_id)
    finished = sum(1 for m in modules if module_finished(conn, m.id))
    return finished, len(modules)
