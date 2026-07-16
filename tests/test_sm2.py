# tests/test_sm2.py
from datetime import datetime
from reviewer.scheduler.sm2 import next_schedule, MAX_INTERVAL_MINUTES

NOW = datetime(2026, 7, 16, 9, 0, 0)


def test_new_card_ratings_set_base_intervals():
    for rating, expected in [("again", 10), ("hard", 30), ("good", 60), ("easy", 240)]:
        r = next_schedule(interval_minutes=0, ease_factor=2.5, review_count=0,
                          rating=rating, now=NOW)
        assert r.interval_minutes == expected
        assert r.review_count == 1


def test_good_multiplies_interval_by_ease():
    r = next_schedule(interval_minutes=60, ease_factor=2.5, review_count=1,
                      rating="good", now=NOW)
    assert r.interval_minutes == 150  # round(60 * 2.5)
    assert r.ease_factor == 2.5


def test_again_resets_interval_and_lowers_ease():
    r = next_schedule(interval_minutes=600, ease_factor=2.5, review_count=3,
                      rating="again", now=NOW)
    assert r.interval_minutes == 10
    assert r.ease_factor == 2.3


def test_easy_raises_ease_and_grows_faster():
    r = next_schedule(interval_minutes=60, ease_factor=2.5, review_count=1,
                      rating="easy", now=NOW)
    assert r.ease_factor == 2.65
    assert r.interval_minutes == round(60 * 2.65 * 1.3)


def test_interval_capped_at_max():
    r = next_schedule(interval_minutes=2000, ease_factor=3.0, review_count=5,
                      rating="good", now=NOW)
    assert r.interval_minutes == MAX_INTERVAL_MINUTES


def test_ease_floor_is_1_3():
    r = next_schedule(interval_minutes=10, ease_factor=1.3, review_count=2,
                      rating="again", now=NOW)
    assert r.ease_factor == 1.3


def test_due_at_is_now_plus_interval_iso():
    r = next_schedule(interval_minutes=0, ease_factor=2.5, review_count=0,
                      rating="good", now=NOW)
    assert r.due_at == datetime(2026, 7, 16, 10, 0, 0).isoformat(timespec="seconds")
