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
    return TestClient(app, follow_redirects=False), factory


def _paste(client, text="some notes", title="Bio"):
    return client.post("/api/paste", json={"title": title, "text": text})


def test_overview_empty_is_zeros(ctx):
    client, factory = ctx
    r = client.get("/api/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["streak"] == 0
    assert body["longest_streak"] == 0
    assert body["reviews_today"] == 0
    assert body["cards_due_total"] == 0
    assert body["mastery_pct"] == 0
    assert body["documents"] == []


def test_paste_creates_document_and_appears_in_overview(ctx):
    client, factory = ctx
    r = _paste(client)
    assert r.status_code == 200
    doc_id = r.json()["document_id"]
    assert doc_id == 1

    overview = client.get("/api/overview").json()
    assert len(overview["documents"]) == 1
    doc = overview["documents"][0]
    assert doc["id"] == doc_id
    assert doc["title"] == "Bio"
    assert doc["cards_total"] == 1
    assert doc["modules_total"] == 1


def test_paste_blank_text_is_400(ctx):
    client, factory = ctx
    r = _paste(client, text="   ", title="Empty")
    assert r.status_code == 400


def test_upload_unsupported_file_is_400(ctx):
    client, factory = ctx
    r = client.post("/api/upload", files={"file": ("a.zip", b"PK\x03\x04", "application/zip")})
    assert r.status_code == 400


def test_upload_text_file_creates_document(ctx):
    client, factory = ctx
    r = client.post("/api/upload", files={"file": ("notes.txt", b"the cold war", "text/plain")})
    assert r.status_code == 200
    assert "document_id" in r.json()


def test_document_detail_includes_modules_sections_and_cheatsheet(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]
    r = client.get(f"/api/documents/{doc_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["cheat_sheet"] == "CHEAT SHEET"
    assert len(body["modules"]) == 1
    module = body["modules"][0]
    assert module["title"] == "Cells"
    assert len(module["sections"]) == 1
    section = module["sections"][0]
    assert section["heading"] == "Membrane"
    assert section["origin"] == "from-file"
    assert "reviews_today" in body
    assert "streak" in body


def test_document_detail_404_for_missing(ctx):
    client, factory = ctx
    r = client.get("/api/documents/999")
    assert r.status_code == 404


def test_queue_modes_due_cram_weak(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]

    r_due = client.get(f"/api/documents/{doc_id}/queue", params={"mode": "due"})
    assert r_due.status_code == 200
    assert len(r_due.json()["cards"]) == 1

    r_cram = client.get(f"/api/documents/{doc_id}/queue", params={"mode": "cram"})
    assert r_cram.status_code == 200
    assert len(r_cram.json()["cards"]) == 1

    r_weak = client.get(f"/api/documents/{doc_id}/queue", params={"mode": "weak"})
    assert r_weak.status_code == 200
    assert r_weak.json()["cards"] == []


def test_queue_bad_mode_is_404(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]
    r = client.get(f"/api/documents/{doc_id}/queue", params={"mode": "bogus"})
    assert r.status_code == 404


def test_queue_bad_document_is_404(ctx):
    client, factory = ctx
    r = client.get("/api/documents/999/queue", params={"mode": "due"})
    assert r.status_code == 404


def test_review_ok_and_bad_rating(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]
    card_id = repo.list_cards_for_document(factory(), doc_id)[0].id

    r = client.post("/api/review", json={"card_id": card_id, "rating": "good"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    r_bad = client.post("/api/review", json={"card_id": card_id, "rating": "nonsense"})
    assert r_bad.status_code == 400

    r_missing = client.post("/api/review", json={"card_id": 9999, "rating": "good"})
    assert r_missing.status_code == 400


def test_practice_returns_all_cards(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]
    r = client.get(f"/api/documents/{doc_id}/practice")
    assert r.status_code == 200
    cards = r.json()["cards"]
    assert len(cards) == 1
    assert cards[0]["question"] == "Q?"


def test_practice_bad_document_is_404(ctx):
    client, factory = ctx
    r = client.get("/api/documents/999/practice")
    assert r.status_code == 404


def test_exam_date_set_and_reject_past(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]

    r = client.post(f"/api/documents/{doc_id}/exam-date", json={"exam_date": "2099-01-01"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    assert repo.get_document(factory(), doc_id).exam_date == "2099-01-01"

    r_past = client.post(f"/api/documents/{doc_id}/exam-date", json={"exam_date": "2000-01-01"})
    assert r_past.status_code == 400

    r_clear = client.post(f"/api/documents/{doc_id}/exam-date", json={"exam_date": None})
    assert r_clear.status_code == 200
    assert repo.get_document(factory(), doc_id).exam_date is None


def test_exam_date_bad_document_is_404(ctx):
    client, factory = ctx
    r = client.post("/api/documents/999/exam-date", json={"exam_date": None})
    assert r.status_code == 404


def test_stats_weekly_zero_filled_length_7(ctx):
    client, factory = ctx
    r = client.get("/api/stats/weekly")
    assert r.status_code == 200
    days = r.json()["days"]
    assert len(days) == 7
    assert all("date" in d and "reviews" in d for d in days)
    assert all(d["reviews"] == 0 for d in days)


def test_schedule_lists_study_day_and_exam(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]
    card_id = repo.list_cards_for_document(factory(), doc_id)[0].id
    client.post("/api/review", json={"card_id": card_id, "rating": "good"})
    client.post(f"/api/documents/{doc_id}/exam-date", json={"exam_date": "2099-01-01"})

    r = client.get("/api/schedule")
    assert r.status_code == 200
    body = r.json()
    assert len(body["study_days"]) == 1
    assert len(body["exams"]) == 1
    assert body["exams"][0]["document_id"] == doc_id
    assert body["exams"][0]["exam_date"] == "2099-01-01"
