import sqlite3

from reviewer.generation import prompts
from reviewer.generation.chunker import chunk_text
from reviewer.generation.parser import parse_modules
from reviewer.generation.schemas import GeneratedReviewer
from reviewer.generation.store import store_reviewer


def generate_reviewer(client, extracted_text: str, *, max_chars: int = 12000) -> GeneratedReviewer:
    """Generate a structured reviewer (modules + cheat sheet) from extracted text."""
    modules = []
    for chunk in chunk_text(extracted_text, max_chars=max_chars):
        raw = client.generate_text(prompts.REVIEWER_SYSTEM,
                                   prompts.build_reviewer_user(chunk))
        modules.extend(parse_modules(raw))

    cheat_sheet = ""
    if modules:
        cheat_sheet = client.generate_text(
            prompts.CHEATSHEET_SYSTEM, prompts.build_cheatsheet_user(modules)).strip()
    return GeneratedReviewer(modules=modules, cheat_sheet=cheat_sheet)


def build_and_store(conn: sqlite3.Connection, client, document_id: int,
                    extracted_text: str,
                    flashcard_pairs=None, *, max_chars: int = 12000) -> GeneratedReviewer:
    """Generate a reviewer from text and persist it for the document."""
    generated = generate_reviewer(client, extracted_text, max_chars=max_chars)
    store_reviewer(conn, document_id, generated, flashcard_pairs)
    return generated
