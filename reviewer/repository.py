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


from reviewer.models import Module, ModuleSection


def _row_to_module(row: sqlite3.Row) -> Module:
    return Module(id=row["id"], document_id=row["document_id"],
                  title=row["title"], position=row["position"])


def create_module(conn: sqlite3.Connection, module: Module) -> Module:
    cur = conn.execute(
        "INSERT INTO modules (document_id, title, position) VALUES (?, ?, ?)",
        (module.document_id, module.title, module.position),
    )
    conn.commit()
    module.id = cur.lastrowid
    return module


def list_modules(conn: sqlite3.Connection, document_id: int) -> list[Module]:
    rows = conn.execute(
        "SELECT * FROM modules WHERE document_id = ? ORDER BY position, id",
        (document_id,),
    ).fetchall()
    return [_row_to_module(r) for r in rows]


def _row_to_section(row: sqlite3.Row) -> ModuleSection:
    return ModuleSection(id=row["id"], module_id=row["module_id"],
                         heading=row["heading"], content=row["content"],
                         origin=row["origin"], position=row["position"])


def add_section(conn: sqlite3.Connection, section: ModuleSection) -> ModuleSection:
    cur = conn.execute(
        """INSERT INTO module_sections (module_id, heading, content, origin, position)
           VALUES (?, ?, ?, ?, ?)""",
        (section.module_id, section.heading, section.content,
         section.origin, section.position),
    )
    conn.commit()
    section.id = cur.lastrowid
    return section


def list_sections(conn: sqlite3.Connection, module_id: int) -> list[ModuleSection]:
    rows = conn.execute(
        "SELECT * FROM module_sections WHERE module_id = ? ORDER BY position, id",
        (module_id,),
    ).fetchall()
    return [_row_to_section(r) for r in rows]
