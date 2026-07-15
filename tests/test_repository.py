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


from reviewer.models import Module, ModuleSection


def _doc(conn):
    return repo.create_document(conn, Document(None, "D", "text", "2026-07-16T09:00:00", "x"))


def test_create_and_list_modules_in_position_order(conn):
    d = _doc(conn)
    m2 = repo.create_module(conn, Module(None, d.id, "Second", 1))
    m1 = repo.create_module(conn, Module(None, d.id, "First", 0))
    mods = repo.list_modules(conn, d.id)
    assert [m.title for m in mods] == ["First", "Second"]
    assert m1.id is not None and m2.id is not None


def test_add_and_list_sections_with_origin(conn):
    d = _doc(conn)
    m = repo.create_module(conn, Module(None, d.id, "M", 0))
    repo.add_section(conn, ModuleSection(None, m.id, "Def", "A cell is...", "from-file", 0))
    repo.add_section(conn, ModuleSection(None, m.id, "Extra", "Related...", "added-context", 1))
    secs = repo.list_sections(conn, m.id)
    assert [s.origin for s in secs] == ["from-file", "added-context"]
    assert secs[0].heading == "Def"
