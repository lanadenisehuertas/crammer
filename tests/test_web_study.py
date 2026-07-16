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
    c.post("/upload", data={"text": "some notes", "title": "Bio"})
    return c, factory


def test_study_shows_due_card_question(ctx):
    client, factory = ctx
    r = client.get("/study/1")
    assert r.status_code == 200
    assert "Q?" in r.text
    assert "Show answer" in r.text


def test_reveal_shows_answer_and_ratings(ctx):
    client, factory = ctx
    conn = factory()
    card = repo.list_cards_for_document(conn, 1)[0]
    r = client.get(f"/study/1?card={card.id}&reveal=1")
    assert "A." in r.text
    assert "Good" in r.text and "Again" in r.text


def test_review_advances_and_reschedules(ctx):
    client, factory = ctx
    conn = factory()
    card = repo.list_cards_for_document(conn, 1)[0]
    r = client.post("/review", data={"doc_id": 1, "card_id": card.id,
                                     "rating": "good", "mode": "study"})
    assert r.status_code in (302, 303)
    updated = repo.get_card(factory(), card.id)
    assert updated.review_count == 1
    assert updated.interval_minutes == 60


def test_study_done_when_nothing_due(ctx):
    client, factory = ctx
    conn = factory()
    # push all cards into the future
    for c in repo.list_cards_for_document(conn, 1):
        repo.update_card_schedule(conn, c.id, due_at="2099-01-01T00:00:00",
                                  interval_minutes=60, ease_factor=2.5, review_count=1)
    r = client.get("/study/1")
    assert "all caught up" in r.text.lower() or "nothing due" in r.text.lower()
