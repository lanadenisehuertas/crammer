import sqlite3
from datetime import date, datetime, timedelta

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


def reviews_by_day(conn: sqlite3.Connection, days: int = 7,
                   today: date | None = None) -> list[tuple[str, int]]:
    """(iso-date, review count) for the last `days` days, oldest first, zero-filled."""
    today = today or date.today()
    counts = {row["d"]: row["n"] for row in conn.execute(
        "SELECT substr(rated_at, 1, 10) AS d, COUNT(*) AS n FROM reviews GROUP BY d")}
    out = []
    for i in range(days - 1, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        out.append((day, counts.get(day, 0)))
    return out
