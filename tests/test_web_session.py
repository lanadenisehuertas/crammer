import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app
from reviewer import repository as repo
from reviewer.models import Review
from tests.test_web_upload import FakeClient


@pytest.fixture
def ctx(tmp_path):
    db_path = str(tmp_path / "t.sqlite3")
    factory = lambda: connect(db_path, check_same_thread=False)
    app = create_app(factory, FakeClient())
    c = TestClient(app, follow_redirects=False)
    c.post("/upload", data={"text": "notes", "title": "Bio"})
    return c, factory


def test_cram_shows_first_card(ctx):
    client, factory = ctx
    r = client.get("/session/1/cram")
    assert r.status_code == 200
    assert "Q?" in r.text
    assert "card 1 of" in r.text


def test_cram_past_end_shows_done(ctx):
    client, factory = ctx
    r = client.get("/session/1/cram?i=99")
    assert "complete" in r.text.lower() or "caught up" in r.text.lower() or "🎉" in r.text


def test_weak_lists_only_missed_cards(ctx):
    client, factory = ctx
    conn = factory()
    card = repo.list_cards_for_document(conn, 1)[0]
    repo.log_review(conn, Review(None, card.id, "2026-07-16T10:00:00", "again"))
    r = client.get("/session/1/weak")
    assert r.status_code == 200
    assert "Q?" in r.text


def test_unknown_mode_404(ctx):
    client, factory = ctx
    r = client.get("/session/1/bogus")
    assert r.status_code == 404
