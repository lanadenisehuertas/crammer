import sqlite3
from datetime import date, datetime

from reviewer import repository as repo
from reviewer.progress.mastery import document_mastery
from reviewer.progress.streaks import current_streak, longest_streak
from reviewer.scheduler.selection import due_cards


def dashboard_stats(conn: sqlite3.Connection, document_id: int,
                    now: datetime | None = None,
                    today: date | None = None) -> dict:
    now = now or datetime.now()
    today = today or date.today()
    cards = repo.list_cards_for_document(conn, document_id)
    finished, total_modules = document_mastery(conn, document_id)

    reviews_all_time = 0
    reviews_today = 0
    today_str = today.isoformat()
    for card in cards:
        for review in repo.list_reviews_for_card(conn, card.id):
            reviews_all_time += 1
            if review.rated_at.startswith(today_str):
                reviews_today += 1

    return {
        "cards_total": len(cards),
        "cards_due": len(due_cards(conn, document_id, now=now)),
        "modules_finished": finished,
        "modules_total": total_modules,
        "reviews_today": reviews_today,
        "reviews_all_time": reviews_all_time,
        "streak": current_streak(conn, today=today),
        "longest_streak": longest_streak(conn),
    }
