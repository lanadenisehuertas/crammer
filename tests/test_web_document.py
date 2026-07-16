import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app
from tests.test_web_upload import FakeClient


@pytest.fixture
def client(tmp_path):
    db_path = str(tmp_path / "t.sqlite3")
    app = create_app(lambda: connect(db_path, check_same_thread=False), FakeClient())
    return TestClient(app, follow_redirects=False)


def test_document_view_shows_modules_sections_and_cheatsheet(client):
    client.post("/upload", data={"text": "some notes", "title": "Bio"})
    r = client.get("/document/1")
    assert r.status_code == 200
    assert "Cells" in r.text
    assert "Membrane" in r.text
    assert "CHEAT SHEET" in r.text
    assert "From file" in r.text  # origin label


def test_document_view_404_for_missing(client):
    r = client.get("/document/999")
    assert r.status_code == 404
