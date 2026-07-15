from reviewer import repository as repo
from reviewer.models import Document


def test_create_and_get_document(conn):
    doc = Document(
        id=None,
        title="Biology Ch. 1",
        source_type="pdf",
        created_at="2026-07-16T10:00:00",
        extracted_text="cells are the basic unit of life",
    )
    saved = repo.create_document(conn, doc)
    assert saved.id is not None

    fetched = repo.get_document(conn, saved.id)
    assert fetched.title == "Biology Ch. 1"
    assert fetched.source_type == "pdf"
    assert fetched.exam_date is None


def test_list_documents_returns_newest_first(conn):
    a = repo.create_document(conn, Document(None, "A", "text", "2026-07-16T09:00:00", "a"))
    b = repo.create_document(conn, Document(None, "B", "text", "2026-07-16T11:00:00", "b"))
    docs = repo.list_documents(conn)
    assert [d.id for d in docs] == [b.id, a.id]


def test_set_exam_date(conn):
    d = repo.create_document(conn, Document(None, "A", "text", "2026-07-16T09:00:00", "a"))
    repo.set_exam_date(conn, d.id, "2026-07-18")
    assert repo.get_document(conn, d.id).exam_date == "2026-07-18"


def test_set_cheat_sheet(conn):
    d = repo.create_document(conn, Document(None, "A", "text", "2026-07-16T09:00:00", "a"))
    repo.set_cheat_sheet(conn, d.id, "TL;DR: cells.")
    assert repo.get_document(conn, d.id).cheat_sheet == "TL;DR: cells."
