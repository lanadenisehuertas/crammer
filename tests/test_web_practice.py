import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app
from tests.test_web_upload import FakeClient


@pytest.fixture
def client(tmp_path):
    db_path = str(tmp_path / "t.sqlite3")
    app = create_app(lambda: connect(db_path, check_same_thread=False), FakeClient())
    c = TestClient(app, follow_redirects=False)
    c.post("/upload", data={"text": "notes", "title": "Bio"})
    return c


def test_practice_shows_question(client):
    r = client.get("/practice/1")
    assert r.status_code == 200
    assert "Q?" in r.text


def test_practice_reveal_shows_grade_buttons(client):
    r = client.get("/practice/1?i=0&reveal=1&correct=0")
    assert "A." in r.text
    assert "Correct" in r.text and "Incorrect" in r.text


def test_practice_end_shows_score(client):
    # one card total; after grading index 1 is past the end
    r = client.get("/practice/1?i=1&correct=1")
    assert r.status_code == 200
    assert "100" in r.text  # 1/1 = 100%
