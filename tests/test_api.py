import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app
from reviewer import repository as repo
from tests.test_web_upload import FakeClient


def _make_ctx(tmp_path, ai_client=None):
    db_path = str(tmp_path / "t.sqlite3")
    factory = lambda: connect(db_path, check_same_thread=False)
    app = create_app(factory, ai_client or FakeClient())
    return TestClient(app, follow_redirects=False), factory


@pytest.fixture
def ctx(tmp_path):
    return _make_ctx(tmp_path)


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


# --- Claude API failure handling + retry ------------------------------------

def _api_request():
    return httpx.Request("POST", "https://api.anthropic.com")


def _api_response(status):
    return httpx.Response(status, request=_api_request())


def _credit_error():
    return anthropic.BadRequestError(
        "Your credit balance is too low to access the Anthropic API.",
        response=_api_response(400), body=None)


class FailingClient(FakeClient):
    """Fake whose generation raises a given Anthropic SDK error until unset."""

    def __init__(self, exc):
        self.exc = exc

    def generate_text(self, system, user, max_tokens=16000):
        if self.exc is not None:
            raise self.exc
        return super().generate_text(system, user, max_tokens)


def test_paste_credit_error_502_keeps_document(tmp_path):
    client, factory = _make_ctx(tmp_path, FailingClient(_credit_error()))
    r = _paste(client)
    assert r.status_code == 502
    detail = r.json()["detail"]
    assert "credit" in detail.lower()
    # The document row survives with 0 modules so generation can be retried.
    conn = factory()
    docs = repo.list_documents(conn)
    assert len(docs) == 1
    assert repo.list_modules(conn, docs[0].id) == []


def test_paste_auth_error_502(tmp_path):
    exc = anthropic.AuthenticationError(
        "invalid x-api-key", response=_api_response(401), body=None)
    client, factory = _make_ctx(tmp_path, FailingClient(exc))
    r = _paste(client)
    assert r.status_code == 502
    assert "API key" in r.json()["detail"]


def test_paste_connection_error_502(tmp_path):
    exc = anthropic.APIConnectionError(request=_api_request())
    client, factory = _make_ctx(tmp_path, FailingClient(exc))
    r = _paste(client)
    assert r.status_code == 502
    assert "internet connection" in r.json()["detail"]


def test_paste_rate_limit_error_502(tmp_path):
    exc = anthropic.RateLimitError(
        "rate limited", response=_api_response(429), body=None)
    client, factory = _make_ctx(tmp_path, FailingClient(exc))
    r = _paste(client)
    assert r.status_code == 502
    assert "rate-limiting" in r.json()["detail"]


def test_paste_other_api_error_502_includes_message(tmp_path):
    exc = anthropic.InternalServerError(
        "Overloaded", response=_api_response(500), body=None)
    client, factory = _make_ctx(tmp_path, FailingClient(exc))
    r = _paste(client)
    assert r.status_code == 502
    assert "The Claude API returned an error" in r.json()["detail"]
    assert "Overloaded" in r.json()["detail"]


def test_upload_credit_error_502_keeps_document(tmp_path):
    client, factory = _make_ctx(tmp_path, FailingClient(_credit_error()))
    r = client.post("/api/upload",
                    files={"file": ("notes.txt", b"the cold war", "text/plain")})
    assert r.status_code == 502
    assert "credit" in r.json()["detail"].lower()
    conn = factory()
    docs = repo.list_documents(conn)
    assert len(docs) == 1
    assert repo.list_modules(conn, docs[0].id) == []


def test_generate_retry_succeeds_after_failure(tmp_path):
    ai = FailingClient(_credit_error())
    client, factory = _make_ctx(tmp_path, ai)
    assert _paste(client).status_code == 502
    doc_id = repo.list_documents(factory())[0].id

    ai.exc = None  # "credits added" — the API works again
    r = client.post(f"/api/documents/{doc_id}/generate")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    conn = factory()
    modules = repo.list_modules(conn, doc_id)
    assert len(modules) == 1
    assert modules[0].title == "Cells"
    assert repo.get_document(conn, doc_id).cheat_sheet == "CHEAT SHEET"


def test_generate_still_failing_502_and_retryable_again(tmp_path):
    ai = FailingClient(_credit_error())
    client, factory = _make_ctx(tmp_path, ai)
    assert _paste(client).status_code == 502
    doc_id = repo.list_documents(factory())[0].id

    r = client.post(f"/api/documents/{doc_id}/generate")
    assert r.status_code == 502
    assert "credit" in r.json()["detail"].lower()
    assert repo.list_modules(factory(), doc_id) == []


def test_generate_on_already_generated_doc_400(ctx):
    client, factory = ctx
    doc_id = _paste(client).json()["document_id"]
    r = client.post(f"/api/documents/{doc_id}/generate")
    assert r.status_code == 400
    assert "already has a generated reviewer" in r.json()["detail"]


def test_generate_unknown_doc_404(ctx):
    client, factory = ctx
    r = client.post("/api/documents/999/generate")
    assert r.status_code == 404
