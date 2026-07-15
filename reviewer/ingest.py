import sqlite3
from datetime import datetime

from reviewer import repository as repo
from reviewer.models import Document
from reviewer.parsing import ParsedContent, parse_file, parse_text
from reviewer.parsing.base import OcrFn


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def ingest_text(conn: sqlite3.Connection, title: str, text: str) -> tuple[Document, ParsedContent]:
    pc = parse_text(text)
    doc = repo.create_document(conn, Document(
        id=None, title=title, source_type="text",
        created_at=_now(), extracted_text=pc.text))
    return doc, pc


def ingest_file(conn: sqlite3.Connection, filename: str, data: bytes,
                ocr: OcrFn) -> tuple[Document, ParsedContent]:
    pc = parse_file(filename, data, ocr)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "file"
    doc = repo.create_document(conn, Document(
        id=None, title=filename, source_type=ext,
        created_at=_now(), extracted_text=pc.text))
    return doc, pc
