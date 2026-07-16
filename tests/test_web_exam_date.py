import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app
from reviewer import repository as repo
from tests.test_web_upload import FakeClient


@pytest.fixture
def ctx(tmp_path):
    db_path = str(tmp_path / "t.sqlite3")
    factory = lambda: connect(db_path, check_same_thread=False)
    app = create_app(factory, FakeClient())
    c = TestClient(app, follow_redirects=False)
    c.post("/upload", data={"text": "notes", "title": "Bio"})
    return c, factory


def test_set_exam_date(ctx):
    client, factory = ctx
    r = client.post("/document/1/exam-date", data={"exam_date": "2026-07-20"})
    assert r.status_code in (302, 303)
    assert repo.get_document(factory(), 1).exam_date == "2026-07-20"


def test_clear_exam_date(ctx):
    client, factory = ctx
    client.post("/document/1/exam-date", data={"exam_date": "2026-07-20"})
    client.post("/document/1/exam-date", data={"exam_date": ""})
    assert repo.get_document(factory(), 1).exam_date is None
