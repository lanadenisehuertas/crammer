import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app
from reviewer import repository as repo


class FakeClient:
    def ocr_image(self, image_bytes, media_type):
        return "ocr text"

    def generate_text(self, system, user, max_tokens=16000):
        if "cheat sheet" in system.lower():
            return "CHEAT SHEET"
        return ('{"modules":[{"title":"Cells","sections":['
                '{"heading":"Membrane","content":"controls entry","origin":"from-file"}],'
                '"cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}')


@pytest.fixture
def ctx(tmp_path):
    db_path = str(tmp_path / "t.sqlite3")
    factory = lambda: connect(db_path, check_same_thread=False)
    app = create_app(factory, FakeClient())
    return TestClient(app, follow_redirects=False), factory


def test_upload_pasted_text_generates_and_redirects(ctx):
    client, factory = ctx
    r = client.post("/upload", data={"text": "some notes", "title": "Bio"})
    assert r.status_code in (302, 303)
    conn = factory()
    docs = repo.list_documents(conn)
    assert len(docs) == 1
    assert repo.list_modules(conn, docs[0].id)[0].title == "Cells"
    assert repo.get_document(conn, docs[0].id).cheat_sheet == "CHEAT SHEET"


def test_upload_text_file_generates(ctx):
    client, factory = ctx
    r = client.post("/upload", files={"file": ("notes.txt", b"the cold war", "text/plain")})
    assert r.status_code in (302, 303)
    conn = factory()
    assert len(repo.list_documents(conn)) == 1


def test_upload_unsupported_file_shows_error(ctx):
    client, factory = ctx
    r = client.post("/upload", files={"file": ("a.zip", b"PK\x03\x04", "application/zip")})
    assert r.status_code == 400
    assert "unsupported" in r.text.lower() or "no reader" in r.text.lower()


def test_upload_nothing_shows_error(ctx):
    client, factory = ctx
    r = client.post("/upload", data={"text": "", "title": ""})
    assert r.status_code == 400
