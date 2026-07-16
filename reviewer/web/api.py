import random
import sqlite3
from datetime import date, datetime

import anthropic
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from reviewer import repository as repo
from reviewer.generation import build_and_store
from reviewer.ingest import ingest_file, ingest_text
from reviewer.parsing.base import EmptyContentError, UnsupportedFileType
from reviewer.practice.test import build_practice_test
from reviewer.progress.mastery import module_finished
from reviewer.progress.stats import dashboard_stats, reviews_by_day
from reviewer.progress.streaks import current_streak, longest_streak
from reviewer.scheduler.review import review_card
from reviewer.scheduler.selection import cram_cards, due_cards, weak_spot_cards


class PasteBody(BaseModel):
    title: str = ""
    text: str = ""


class ReviewBody(BaseModel):
    card_id: int
    rating: str


class ExamDateBody(BaseModel):
    exam_date: str | None = None


def _claude_api_http_error(e: anthropic.APIError) -> HTTPException:
    """Map an Anthropic SDK error to a 502 with a student-friendly message."""
    message = getattr(e, "message", None) or str(e)
    if "credit balance" in message.lower():
        detail = (
            "Your Anthropic account is out of credits, so Crammer can't generate "
            "right now. Add credits at console.anthropic.com → Plans & Billing, "
            "then press Retry. (Tip: REVIEWER_MODEL=claude-haiku-4-5 in your .env "
            "is the cheapest model.)"
        )
    elif isinstance(e, anthropic.AuthenticationError):
        detail = "Your API key was rejected. Check ANTHROPIC_API_KEY in your .env file."
    elif isinstance(e, anthropic.APIConnectionError):
        detail = "Couldn't reach the Claude API. Check your internet connection and try again."
    elif isinstance(e, anthropic.RateLimitError):
        detail = "The Claude API is rate-limiting requests. Wait a minute and try again."
    else:
        detail = f"The Claude API returned an error: {message}"
    return HTTPException(502, detail)


def _mastery_pct(finished: int, total: int) -> int:
    return round(100 * finished / total) if total else 0


def _doc_summary(conn: sqlite3.Connection, doc, now: datetime, today: date) -> dict:
    stats = dashboard_stats(conn, doc.id, now=now, today=today)
    return {
        "id": doc.id,
        "title": doc.title,
        "source_type": doc.source_type,
        "created_at": doc.created_at,
        "exam_date": doc.exam_date,
        "cards_total": stats["cards_total"],
        "cards_due": stats["cards_due"],
        "modules_finished": stats["modules_finished"],
        "modules_total": stats["modules_total"],
        "mastery_pct": _mastery_pct(stats["modules_finished"], stats["modules_total"]),
        "_reviews_today": stats["reviews_today"],
    }


def _card_out(card) -> dict:
    return {
        "id": card.id,
        "module_id": card.module_id,
        "card_type": card.card_type,
        "question": card.question,
        "answer": card.answer,
    }


def build_api_router(get_conn, client) -> APIRouter:
    router = APIRouter()

    @router.get("/overview")
    def overview(conn: sqlite3.Connection = Depends(get_conn)):
        now = datetime.now()
        today = date.today()
        summaries = [_doc_summary(conn, d, now, today) for d in repo.list_documents(conn)]
        reviews_today = sum(s.pop("_reviews_today") for s in summaries)
        cards_due_total = sum(s["cards_due"] for s in summaries)
        modules_finished_total = sum(s["modules_finished"] for s in summaries)
        modules_total_total = sum(s["modules_total"] for s in summaries)
        return {
            "streak": current_streak(conn, today=today),
            "longest_streak": longest_streak(conn),
            "reviews_today": reviews_today,
            "cards_due_total": cards_due_total,
            "mastery_pct": _mastery_pct(modules_finished_total, modules_total_total),
            "documents": summaries,
        }

    @router.get("/documents/{doc_id}")
    def document_detail(doc_id: int, conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            raise HTTPException(404, "That document does not exist.")
        now = datetime.now()
        today = date.today()
        summary = _doc_summary(conn, doc, now, today)
        reviews_today = summary.pop("_reviews_today")
        modules = []
        for m in repo.list_modules(conn, doc_id):
            sections = [
                {"heading": s.heading, "content": s.content, "origin": s.origin}
                for s in repo.list_sections(conn, m.id)
            ]
            cards = repo.list_cards_for_module(conn, m.id)
            modules.append({
                "id": m.id,
                "title": m.title,
                "position": m.position,
                "finished": module_finished(conn, m.id),
                "cards_count": len(cards),
                "sections": sections,
            })
        return {
            **summary,
            "cheat_sheet": doc.cheat_sheet,
            "reviews_today": reviews_today,
            "streak": current_streak(conn, today=today),
            "modules": modules,
        }

    @router.post("/paste")
    def paste(body: PasteBody, conn: sqlite3.Connection = Depends(get_conn)):
        try:
            doc, parsed = ingest_text(conn, body.title.strip() or "Pasted notes", body.text)
        except EmptyContentError as e:
            raise HTTPException(400, str(e))
        # The document row already exists at this point (intentionally): if
        # generation fails the pasted text is safe and can be retried later.
        try:
            build_and_store(conn, client, doc.id, doc.extracted_text,
                            flashcard_pairs=parsed.flashcard_pairs)
        except anthropic.APIError as e:
            raise _claude_api_http_error(e)
        return {"document_id": doc.id}

    @router.post("/upload")
    async def upload(conn: sqlite3.Connection = Depends(get_conn),
                     file: UploadFile = File(...)):
        try:
            data = await file.read()
            doc, parsed = ingest_file(conn, file.filename or "upload", data, client.ocr_image)
        except UnsupportedFileType as e:
            raise HTTPException(400, str(e))
        except EmptyContentError as e:
            raise HTTPException(400, str(e))
        except anthropic.APIError as e:  # OCR of an image can hit the API too
            raise _claude_api_http_error(e)
        # The document row already exists at this point (intentionally): if
        # generation fails the extracted text is safe and can be retried later.
        try:
            build_and_store(conn, client, doc.id, doc.extracted_text,
                            flashcard_pairs=parsed.flashcard_pairs)
        except anthropic.APIError as e:
            raise _claude_api_http_error(e)
        return {"document_id": doc.id}

    @router.post("/documents/{doc_id}/generate")
    def generate(doc_id: int, conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            raise HTTPException(404, "That document does not exist.")
        if repo.list_modules(conn, doc_id):
            raise HTTPException(400, "This document already has a generated reviewer.")
        try:
            build_and_store(conn, client, doc_id, doc.extracted_text)
        except anthropic.APIError as e:
            raise _claude_api_http_error(e)
        return {"ok": True}

    @router.get("/documents/{doc_id}/queue")
    def queue(doc_id: int, mode: str = "due", conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            raise HTTPException(404, "That document does not exist.")
        if mode == "due":
            cards = due_cards(conn, doc_id, now=datetime.now())
        elif mode == "cram":
            cards = cram_cards(conn, doc_id)
        elif mode == "weak":
            cards = weak_spot_cards(conn, doc_id)
        else:
            raise HTTPException(404, "Unknown study mode.")
        return {"cards": [_card_out(c) for c in cards]}

    @router.post("/review")
    def review(body: ReviewBody, conn: sqlite3.Connection = Depends(get_conn)):
        try:
            review_card(conn, body.card_id, body.rating, now=datetime.now())
        except ValueError:
            raise HTTPException(400, "That card or rating is no longer valid.")
        return {"ok": True}

    @router.get("/documents/{doc_id}/practice")
    def practice(doc_id: int, conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            raise HTTPException(404, "That document does not exist.")
        cards = build_practice_test(conn, document_id=doc_id)
        cards = list(cards)
        random.shuffle(cards)
        return {"cards": [_card_out(c) for c in cards]}

    @router.post("/documents/{doc_id}/exam-date")
    def set_exam_date(doc_id: int, body: ExamDateBody,
                      conn: sqlite3.Connection = Depends(get_conn)):
        if repo.get_document(conn, doc_id) is None:
            raise HTTPException(404, "That document does not exist.")
        exam_date = (body.exam_date or "").strip() or None
        if exam_date is not None:
            try:
                parsed_date = date.fromisoformat(exam_date)
            except ValueError:
                raise HTTPException(400, "Invalid exam date.")
            if parsed_date < date.today():
                raise HTTPException(400, "Exam date cannot be in the past.")
        repo.set_exam_date(conn, doc_id, exam_date)
        return {"ok": True}

    @router.get("/stats/weekly")
    def stats_weekly(conn: sqlite3.Connection = Depends(get_conn)):
        days = reviews_by_day(conn, days=7, today=date.today())
        return {"days": [{"date": d, "reviews": n} for d, n in days]}

    @router.get("/schedule")
    def schedule(conn: sqlite3.Connection = Depends(get_conn)):
        exams = [
            {"document_id": d.id, "title": d.title, "exam_date": d.exam_date}
            for d in repo.list_documents(conn) if d.exam_date
        ]
        return {"study_days": repo.list_study_days(conn), "exams": exams}

    return router
