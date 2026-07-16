import sqlite3
from datetime import date, datetime
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from reviewer import repository as repo
from reviewer.schema import init_db
from reviewer.ingest import ingest_file, ingest_text
from reviewer.parsing.base import EmptyContentError, UnsupportedFileType
from reviewer.generation import build_and_store
from reviewer.scheduler.review import review_card
from reviewer.scheduler.selection import cram_cards, due_cards, weak_spot_cards
from reviewer.progress.mastery import document_mastery
from reviewer.progress.stats import dashboard_stats
from reviewer.practice.test import build_practice_test, score

TEMPLATES_DIR = Path(__file__).parent / "templates"


def create_app(conn_factory, client) -> FastAPI:
    app = FastAPI(title="Crammer")
    templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
    init_db(conn_factory())

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

    # further routes added in later tasks

    app.state.conn_factory = conn_factory
    app.state.client = client
    app.state.templates = templates
    app.state.get_conn = get_conn
    app.state.error = _error
    return app
