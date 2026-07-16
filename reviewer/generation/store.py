import sqlite3
from datetime import datetime

from reviewer import repository as repo
from reviewer.models import Card, Module, ModuleSection
from reviewer.generation.schemas import GeneratedReviewer


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def store_reviewer(conn: sqlite3.Connection, document_id: int,
                   generated: GeneratedReviewer,
                   flashcard_pairs: list[tuple[str, str]] | None = None) -> None:
    """Persist a generated reviewer (modules, sections, cards, cheat sheet)."""
    now = _now()
    position = 0
    for gm in generated.modules:
        module = repo.create_module(conn, Module(
            id=None, document_id=document_id, title=gm.title, position=position))
        position += 1
        for i, section in enumerate(gm.sections):
            repo.add_section(conn, ModuleSection(
                id=None, module_id=module.id, heading=section.heading,
                content=section.content, origin=section.origin, position=i))
        for card in gm.cards:
            repo.create_card(conn, Card(
                id=None, document_id=document_id, module_id=module.id,
                card_type=card.card_type, question=card.question, answer=card.answer,
                due_at=now, created_at=now))

    if flashcard_pairs:
        module = repo.create_module(conn, Module(
            id=None, document_id=document_id, title="Key Terms", position=position))
        for term, definition in flashcard_pairs:
            repo.create_card(conn, Card(
                id=None, document_id=document_id, module_id=module.id,
                card_type="flashcard", question=term, answer=definition,
                due_at=now, created_at=now))

    repo.set_cheat_sheet(conn, document_id, generated.cheat_sheet)
