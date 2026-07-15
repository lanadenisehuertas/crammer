import sqlite3
from typing import Optional

from reviewer.models import Document


def _row_to_document(row: sqlite3.Row) -> Document:
    return Document(
        id=row["id"],
        title=row["title"],
        source_type=row["source_type"],
        created_at=row["created_at"],
        extracted_text=row["extracted_text"],
        exam_date=row["exam_date"],
        cheat_sheet=row["cheat_sheet"],
    )


def create_document(conn: sqlite3.Connection, doc: Document) -> Document:
    cur = conn.execute(
        """INSERT INTO documents
           (title, source_type, created_at, extracted_text, exam_date, cheat_sheet)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (doc.title, doc.source_type, doc.created_at, doc.extracted_text,
         doc.exam_date, doc.cheat_sheet),
    )
    conn.commit()
    doc.id = cur.lastrowid
    return doc


def get_document(conn: sqlite3.Connection, doc_id: int) -> Optional[Document]:
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    return _row_to_document(row) if row else None


def list_documents(conn: sqlite3.Connection) -> list[Document]:
    rows = conn.execute(
        "SELECT * FROM documents ORDER BY created_at DESC, id DESC"
    ).fetchall()
    return [_row_to_document(r) for r in rows]


def set_exam_date(conn: sqlite3.Connection, doc_id: int, exam_date: Optional[str]) -> None:
    conn.execute("UPDATE documents SET exam_date = ? WHERE id = ?", (exam_date, doc_id))
    conn.commit()


def set_cheat_sheet(conn: sqlite3.Connection, doc_id: int, cheat_sheet: str) -> None:
    conn.execute("UPDATE documents SET cheat_sheet = ? WHERE id = ?", (cheat_sheet, doc_id))
    conn.commit()
