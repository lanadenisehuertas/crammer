from reviewer import repository as repo
from reviewer.models import Document
from reviewer.generation.schemas import (
    GeneratedReviewer, GeneratedModule, GeneratedSection, GeneratedCard,
)
from reviewer.generation.store import store_reviewer


def _doc(conn):
    return repo.create_document(conn, Document(
        None, "D", "text", "2026-07-16T09:00:00", "source"))


def _sample():
    return GeneratedReviewer(
        modules=[GeneratedModule(
            title="Cells",
            sections=[GeneratedSection("Membrane", "controls entry", "from-file"),
                      GeneratedSection("Extra", "related", "added-context")],
            cards=[GeneratedCard("flashcard", "Q?", "A.")])],
        cheat_sheet="TL;DR cells")


def test_store_persists_modules_sections_cards_cheatsheet(conn):
    d = _doc(conn)
    store_reviewer(conn, d.id, _sample())

    modules = repo.list_modules(conn, d.id)
    assert [m.title for m in modules] == ["Cells"]
    sections = repo.list_sections(conn, modules[0].id)
    assert [s.origin for s in sections] == ["from-file", "added-context"]
    cards = repo.list_cards_for_module(conn, modules[0].id)
    assert cards[0].question == "Q?"
    assert repo.get_document(conn, d.id).cheat_sheet == "TL;DR cells"


def test_store_creates_key_terms_module_from_pairs(conn):
    d = _doc(conn)
    store_reviewer(conn, d.id, _sample(),
                   flashcard_pairs=[("Osmosis", "Water diffusion")])
    modules = repo.list_modules(conn, d.id)
    assert "Key Terms" in [m.title for m in modules]
    key = next(m for m in modules if m.title == "Key Terms")
    cards = repo.list_cards_for_module(conn, key.id)
    assert cards[0].question == "Osmosis"
    assert cards[0].answer == "Water diffusion"
    assert cards[0].card_type == "flashcard"


def test_store_new_cards_are_due_immediately(conn):
    d = _doc(conn)
    store_reviewer(conn, d.id, _sample())
    card = repo.list_cards_for_document(conn, d.id)[0]
    assert card.due_at  # non-empty timestamp
    assert card.review_count == 0
