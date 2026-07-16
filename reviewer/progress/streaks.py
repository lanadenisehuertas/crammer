import sqlite3
from datetime import date, timedelta

from reviewer import repository as repo


def _days(conn: sqlite3.Connection) -> set[date]:
    return {date.fromisoformat(d) for d in repo.list_study_days(conn)}


def current_streak(conn: sqlite3.Connection, today: date | None = None) -> int:
    """Consecutive study days ending today or yesterday; 0 if neither was studied."""
    today = today or date.today()
    days = _days(conn)
    if today in days:
        cursor = today
    elif (today - timedelta(days=1)) in days:
        cursor = today - timedelta(days=1)
    else:
        return 0
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def longest_streak(conn: sqlite3.Connection) -> int:
    """Longest run of consecutive study days ever recorded."""
    days = sorted(_days(conn))
    if not days:
        return 0
    best = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if cur - prev == timedelta(days=1) else 1
        best = max(best, run)
    return best
