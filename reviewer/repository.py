import sqlite3
from typing import Optional

from reviewer.models import Document, Module, ModuleSection, Card, Review


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


def delete_document(conn: sqlite3.Connection, doc_id: int) -> None:
    """Delete a document. FK cascades remove its modules/sections/cards/reviews."""
    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()


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


def get_module(conn: sqlite3.Connection, module_id: int) -> Optional[Module]:
    row = conn.execute("SELECT * FROM modules WHERE id = ?", (module_id,)).fetchone()
    return _row_to_module(row) if row else None


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


def _row_to_card(row: sqlite3.Row) -> Card:
    return Card(
        id=row["id"], document_id=row["document_id"], module_id=row["module_id"],
        card_type=row["card_type"], question=row["question"], answer=row["answer"],
        due_at=row["due_at"], interval_minutes=row["interval_minutes"],
        ease_factor=row["ease_factor"], review_count=row["review_count"],
        created_at=row["created_at"],
    )


def create_card(conn: sqlite3.Connection, card: Card) -> Card:
    cur = conn.execute(
        """INSERT INTO cards
           (document_id, module_id, card_type, question, answer, due_at,
            interval_minutes, ease_factor, review_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (card.document_id, card.module_id, card.card_type, card.question, card.answer,
         card.due_at, card.interval_minutes, card.ease_factor, card.review_count,
         card.created_at),
    )
    conn.commit()
    card.id = cur.lastrowid
    return card


def get_card(conn: sqlite3.Connection, card_id: int) -> Optional[Card]:
    row = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
    return _row_to_card(row) if row else None


def list_cards_for_module(conn: sqlite3.Connection, module_id: int) -> list[Card]:
    rows = conn.execute(
        "SELECT * FROM cards WHERE module_id = ? ORDER BY id", (module_id,)
    ).fetchall()
    return [_row_to_card(r) for r in rows]


def list_cards_for_document(conn: sqlite3.Connection, document_id: int) -> list[Card]:
    rows = conn.execute(
        "SELECT * FROM cards WHERE document_id = ? ORDER BY id", (document_id,)
    ).fetchall()
    return [_row_to_card(r) for r in rows]


def update_card_schedule(conn: sqlite3.Connection, card_id: int, *, due_at: str,
                         interval_minutes: int, ease_factor: float,
                         review_count: int) -> None:
    conn.execute(
        """UPDATE cards SET due_at = ?, interval_minutes = ?, ease_factor = ?,
           review_count = ? WHERE id = ?""",
        (due_at, interval_minutes, ease_factor, review_count, card_id),
    )
    conn.commit()


def update_card_content(conn: sqlite3.Connection, card_id: int, *, question: str,
                        answer: str, card_type: str) -> None:
    conn.execute(
        "UPDATE cards SET question = ?, answer = ?, card_type = ? WHERE id = ?",
        (question, answer, card_type, card_id),
    )
    conn.commit()


def delete_card(conn: sqlite3.Connection, card_id: int) -> None:
    conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    conn.commit()


def _row_to_review(row: sqlite3.Row) -> Review:
    return Review(id=row["id"], card_id=row["card_id"],
                  rated_at=row["rated_at"], rating=row["rating"])


def log_review(conn: sqlite3.Connection, review: Review) -> Review:
    cur = conn.execute(
        "INSERT INTO reviews (card_id, rated_at, rating) VALUES (?, ?, ?)",
        (review.card_id, review.rated_at, review.rating),
    )
    conn.commit()
    review.id = cur.lastrowid
    return review


def list_reviews_for_card(conn: sqlite3.Connection, card_id: int) -> list[Review]:
    rows = conn.execute(
        "SELECT * FROM reviews WHERE card_id = ? ORDER BY rated_at, id", (card_id,)
    ).fetchall()
    return [_row_to_review(r) for r in rows]


def record_study_day(conn: sqlite3.Connection, day: str) -> None:
    conn.execute("INSERT OR IGNORE INTO study_days (day) VALUES (?)", (day,))
    conn.commit()


def list_study_days(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute("SELECT day FROM study_days ORDER BY day").fetchall()
    return [r["day"] for r in rows]
