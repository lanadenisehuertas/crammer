from reviewer import repository as repo
from reviewer.models import Document
from reviewer.generation import build_and_store


class FakeClient:
    def __init__(self, replies):
        self._replies = list(replies)

    def generate_text(self, system, user, max_tokens=16000):
        return self._replies.pop(0)


_MODULE_JSON = ('{"modules":[{"title":"Cells","sections":['
                '{"heading":"Membrane","content":"controls entry","origin":"from-file"}],'
                '"cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}')


def test_build_and_store_end_to_end(conn):
    doc = repo.create_document(conn, Document(
        None, "Bio", "text", "2026-07-16T09:00:00", "some source text"))
    client = FakeClient([_MODULE_JSON, "CHEAT SHEET"])

    generated = build_and_store(conn, client, doc.id, "some source text")

    assert len(generated.modules) == 1
    modules = repo.list_modules(conn, doc.id)
    assert modules[0].title == "Cells"
    assert repo.list_cards_for_document(conn, doc.id)[0].question == "Q?"
    assert repo.get_document(conn, doc.id).cheat_sheet == "CHEAT SHEET"
