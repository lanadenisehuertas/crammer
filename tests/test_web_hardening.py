import re

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
    c = TestClient(app, follow_redirects=False, raise_server_exceptions=False)
    c.post("/upload", data={"text": "notes", "title": "Bio"})
    return c, factory


def test_session_negative_index_rejected(ctx):
    client, factory = ctx
    r = client.get("/session/1/cram?i=-1")
    assert r.status_code == 422


def test_practice_correct_is_clamped(ctx):
    client, factory = ctx
    r = client.get("/practice/1?i=99&correct=999")
    assert r.status_code == 200
    # The inflated correct count must not surface in the score line
    # (e.g. "999 of 999 correct"); it was clamped to the real card count.
    assert "999 of" not in r.text
    assert "999%" not in r.text
    percents = [int(m) for m in re.findall(r"(\d+)%<", r.text)]
    assert percents  # a percent is shown
    assert all(p <= 100 for p in percents)


def test_review_missing_card_returns_400(ctx):
    client, factory = ctx
    r = client.post("/review", data={"doc_id": 1, "card_id": 999999,
                                     "rating": "good", "mode": "study"})
    assert r.status_code == 400


def test_review_invalid_rating_returns_400(ctx):
    client, factory = ctx
    conn = factory()
    card = repo.list_cards_for_document(conn, 1)[0]
    r = client.post("/review", data={"doc_id": 1, "card_id": card.id,
                                     "rating": "bogus", "mode": "study"})
    assert r.status_code == 400
