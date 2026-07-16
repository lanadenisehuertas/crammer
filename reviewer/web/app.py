import sqlite3
from datetime import date, datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from reviewer import repository as repo
from reviewer.schema import init_db
from reviewer.ingest import ingest_file, ingest_text
from reviewer.parsing.base import EmptyContentError, UnsupportedFileType
from reviewer.generation import build_and_store
from reviewer.scheduler.review import review_card
from reviewer.scheduler.selection import cram_cards, due_cards, weak_spot_cards
from reviewer.progress.mastery import document_mastery, module_finished
from reviewer.progress.stats import dashboard_stats
from reviewer.practice.test import build_practice_test, score
from reviewer.web.api import build_api_router

TEMPLATES_DIR = Path(__file__).parent / "templates"


def create_app(conn_factory, client) -> FastAPI:
    app = FastAPI(title="Crammer")
    app.add_middleware(CORSMiddleware,
                       allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                       allow_methods=["*"], allow_headers=["*"])
    templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
    startup_conn = conn_factory()
    try:
        init_db(startup_conn)
    finally:
        startup_conn.close()

    def get_conn():
        conn = conn_factory()
        try:
            yield conn
        finally:
            conn.close()

    def _error(request: Request, message: str, status: int = 400) -> HTMLResponse:
        return templates.TemplateResponse(
            request, "error.html", {"message": message}, status_code=status)

    @app.get("/", response_class=HTMLResponse)
    def dashboard(request: Request, conn: sqlite3.Connection = Depends(get_conn)):
        from reviewer.progress.streaks import current_streak, longest_streak
        docs = []
        for d in repo.list_documents(conn):
            finished, total = document_mastery(conn, d.id)
            docs.append({"doc": d, "finished": finished, "total": total})
        ctx = {
            "documents": docs,
            "streak": current_streak(conn, today=date.today()),
            "longest": longest_streak(conn),
        }
        return templates.TemplateResponse(request, "dashboard.html", ctx)

    @app.post("/upload")
    async def upload(request: Request, conn: sqlite3.Connection = Depends(get_conn),
                     file: UploadFile = File(default=None),
                     text: str = Form(default=""),
                     title: str = Form(default="")):
        try:
            if file is not None and file.filename:
                data = await file.read()
                doc, parsed = ingest_file(conn, file.filename, data, client.ocr_image)
            elif text.strip():
                doc, parsed = ingest_text(conn, title.strip() or "Pasted notes", text)
            else:
                return _error(request, "Please upload a file or paste some text.")
        except UnsupportedFileType as e:
            return _error(request, str(e))
        except EmptyContentError as e:
            return _error(request, str(e))

        build_and_store(conn, client, doc.id, doc.extracted_text,
                        flashcard_pairs=parsed.flashcard_pairs)
        return RedirectResponse(f"/document/{doc.id}", status_code=303)

    @app.get("/document/{doc_id}", response_class=HTMLResponse)
    def document_view(doc_id: int, request: Request,
                      conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            return _error(request, "That document does not exist.", status=404)
        modules = []
        for m in repo.list_modules(conn, doc_id):
            cards = repo.list_cards_for_module(conn, m.id)
            modules.append({
                "module": m,
                "sections": repo.list_sections(conn, m.id),
                "cards": cards,
                "finished": module_finished(conn, m.id),
            })
        stats = dashboard_stats(conn, doc_id, now=datetime.now(), today=date.today())
        ctx = {"doc": doc, "modules": modules, "stats": stats}
        return templates.TemplateResponse(request, "document.html", ctx)

    def render_card(request, doc, card, mode, reveal, index=None, total=None):
        ctx = {"doc": doc, "card": card, "mode": mode,
               "reveal": reveal, "index": index, "total": total}
        return templates.TemplateResponse(request, "card.html", ctx)

    @app.get("/study/{doc_id}", response_class=HTMLResponse)
    def study(doc_id: int, request: Request, card: int = 0, reveal: int = 0,
              conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            return _error(request, "That document does not exist.", status=404)
        due = due_cards(conn, doc_id, now=datetime.now())
        if not due:
            return templates.TemplateResponse(
                request, "done.html", {"doc": doc, "message": "You're all caught up!"})
        current = next((c for c in due if c.id == card), due[0])
        return render_card(request, doc, current, "study", bool(reveal))

    @app.post("/review")
    def review(request: Request, conn: sqlite3.Connection = Depends(get_conn),
               doc_id: int = Form(...), card_id: int = Form(...),
               rating: str = Form(...), mode: str = Form("study"),
               index: int = Form(0)):
        try:
            review_card(conn, card_id, rating, now=datetime.now())
        except ValueError:
            return _error(request, "That card or rating is no longer valid.", status=400)
        if mode == "study":
            return RedirectResponse(f"/study/{doc_id}", status_code=303)
        return RedirectResponse(f"/session/{doc_id}/{mode}?i={index + 1}", status_code=303)

    @app.get("/session/{doc_id}/{mode}", response_class=HTMLResponse)
    def session(doc_id: int, mode: str, request: Request,
                i: int = Query(0, ge=0), reveal: int = Query(0, ge=0),
                conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            return _error(request, "That document does not exist.", status=404)
        if mode == "cram":
            cards = cram_cards(conn, doc_id)
        elif mode == "weak":
            cards = weak_spot_cards(conn, doc_id)
        else:
            return _error(request, "Unknown study mode.", status=404)

        if not cards:
            msg = "No weak spots yet — keep studying!" if mode == "weak" else "No cards yet."
            return templates.TemplateResponse(
                request, "done.html", {"doc": doc, "message": msg})
        if i >= len(cards):
            return templates.TemplateResponse(
                request, "done.html", {"doc": doc, "message": "Session complete!"})
        return render_card(request, doc, cards[i], mode, bool(reveal),
                           index=i, total=len(cards))

    @app.get("/practice/{doc_id}", response_class=HTMLResponse)
    def practice(doc_id: int, request: Request,
                 i: int = Query(0, ge=0), reveal: int = Query(0, ge=0),
                 correct: int = Query(0, ge=0),
                 conn: sqlite3.Connection = Depends(get_conn)):
        doc = repo.get_document(conn, doc_id)
        if doc is None:
            return _error(request, "That document does not exist.", status=404)
        cards = build_practice_test(conn, document_id=doc_id)
        if not cards:
            return templates.TemplateResponse(
                request, "done.html", {"doc": doc, "message": "No cards to test yet."})
        if i >= len(cards):
            correct = max(0, min(correct, len(cards)))
            result = score([True] * correct + [False] * (len(cards) - correct))
            return templates.TemplateResponse(
                request, "score.html", {"doc": doc, "result": result})
        ctx = {"doc": doc, "card": cards[i], "index": i,
               "total": len(cards), "reveal": bool(reveal), "correct": correct}
        return templates.TemplateResponse(request, "practice.html", ctx)

    @app.post("/document/{doc_id}/exam-date")
    def set_exam_date(doc_id: int, request: Request,
                      exam_date: str = Form(""),
                      conn: sqlite3.Connection = Depends(get_conn)):
        if repo.get_document(conn, doc_id) is None:
            return _error(request, "That document does not exist.", status=404)
        repo.set_exam_date(conn, doc_id, exam_date.strip() or None)
        return RedirectResponse(f"/document/{doc_id}", status_code=303)

    app.include_router(build_api_router(get_conn, client), prefix="/api")

    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.is_dir():
        app.mount("/app", StaticFiles(directory=str(dist), html=True), name="spa")

    return app
