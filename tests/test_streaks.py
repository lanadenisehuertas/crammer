# tests/test_streaks.py
from datetime import date
from reviewer import repository as repo
from reviewer.progress.streaks import current_streak, longest_streak


def test_current_streak_counts_consecutive_days_including_today(conn):
    for day in ["2026-07-14", "2026-07-15", "2026-07-16"]:
        repo.record_study_day(conn, day)
    assert current_streak(conn, today=date(2026, 7, 16)) == 3


def test_current_streak_allows_today_missing_if_yesterday_present(conn):
    for day in ["2026-07-14", "2026-07-15"]:
        repo.record_study_day(conn, day)
    # Not studied today yet, but streak through yesterday still counts.
    assert current_streak(conn, today=date(2026, 7, 16)) == 2


def test_current_streak_breaks_on_gap(conn):
    for day in ["2026-07-10", "2026-07-15", "2026-07-16"]:
        repo.record_study_day(conn, day)
    assert current_streak(conn, today=date(2026, 7, 16)) == 2


def test_current_streak_zero_when_stale(conn):
    repo.record_study_day(conn, "2026-07-10")
    assert current_streak(conn, today=date(2026, 7, 16)) == 0


def test_longest_streak(conn):
    for day in ["2026-07-01", "2026-07-02", "2026-07-03",
                "2026-07-10", "2026-07-11"]:
        repo.record_study_day(conn, day)
    assert longest_streak(conn) == 3
