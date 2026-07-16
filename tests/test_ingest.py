from reviewer import repository as repo
from reviewer.ingest import ingest_text, ingest_file


def test_ingest_text_creates_document(conn):
    doc, pc = ingest_text(conn, title="My Notes", text="cells and organelles")
    assert doc.id is not None
    assert doc.source_type == "text"
    assert doc.title == "My Notes"
    assert repo.get_document(conn, doc.id).extracted_text == "cells and organelles"


def test_ingest_file_creates_document_with_source_type(conn):
    doc, pc = ingest_file(conn, "lecture.csv", b"Term,Definition\nA,Apple\n",
                          ocr=lambda b, m: "")
    assert doc.source_type == "csv"
    assert "Apple" in doc.extracted_text
    assert ("A", "Apple") in pc.flashcard_pairs


def test_ingest_file_title_defaults_to_filename(conn):
    doc, pc = ingest_file(conn, "history.txt", b"the cold war", ocr=lambda b, m: "")
    assert doc.title == "history.txt"
