from reviewer import repository as repo
from reviewer.models import Document, Module, ModuleSection, Card, Review


def test_full_document_lifecycle(conn):
    doc = repo.create_document(conn, Document(
        None, "Chem Notes", "pptx", "2026-07-16T09:00:00", "atoms and bonds"))
    module = repo.create_module(conn, Module(None, doc.id, "Atoms", 0))
    repo.add_section(conn, ModuleSection(
        None, module.id, "Atom", "smallest unit of matter", "from-file", 0))
    repo.add_section(conn, ModuleSection(
        None, module.id, "History", "coined by Democritus", "added-context", 1))
    card = repo.create_card(conn, Card(
        None, doc.id, module.id, "flashcard", "What is an atom?",
        "smallest unit of matter", due_at="2026-07-16T09:00:00",
        created_at="2026-07-16T09:00:00"))
    repo.log_review(conn, Review(None, card.id, "2026-07-16T09:10:00", "good"))
    repo.record_study_day(conn, "2026-07-16")

    assert len(repo.list_documents(conn)) == 1
    assert len(repo.list_modules(conn, doc.id)) == 1
    assert len(repo.list_sections(conn, module.id)) == 2
    assert len(repo.list_cards_for_document(conn, doc.id)) == 1
    assert len(repo.list_reviews_for_card(conn, card.id)) == 1
    assert repo.list_study_days(conn) == ["2026-07-16"]
