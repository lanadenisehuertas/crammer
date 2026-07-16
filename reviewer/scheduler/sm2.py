from dataclasses import dataclass
from datetime import datetime, timedelta

MAX_INTERVAL_MINUTES = 2880  # 2 days
_MIN_EASE = 1.3
_MAX_EASE = 3.0
_NEW_INTERVALS = {"again": 10, "hard": 30, "good": 60, "easy": 240}


@dataclass
class ScheduleResult:
    interval_minutes: int
    ease_factor: float
    review_count: int
    due_at: str


def _clamp_ease(ease: float) -> float:
    return max(_MIN_EASE, min(_MAX_EASE, round(ease, 2)))


def next_schedule(*, interval_minutes: int, ease_factor: float, review_count: int,
                  rating: str, now: datetime,
                  max_interval_minutes: int = MAX_INTERVAL_MINUTES) -> ScheduleResult:
    """Compute the next schedule for a card given a recall rating."""
    if rating not in ("again", "hard", "good", "easy"):
        raise ValueError(f"Unknown rating: {rating}")
    if review_count == 0:
        new_interval = _NEW_INTERVALS[rating]
        new_ease = ease_factor
    elif rating == "again":
        new_interval = 10
        new_ease = _clamp_ease(ease_factor - 0.20)
    elif rating == "hard":
        new_interval = round(interval_minutes * 1.2)
        new_ease = _clamp_ease(ease_factor - 0.15)
    elif rating == "good":
        new_ease = ease_factor  # good does not change ease
        new_interval = round(interval_minutes * new_ease)
    elif rating == "easy":
        new_ease = _clamp_ease(ease_factor + 0.15)
        new_interval = round(interval_minutes * new_ease * 1.3)
    else:
        raise ValueError(f"Unknown rating: {rating}")

    new_interval = max(1, min(new_interval, max_interval_minutes))
    due_at = (now + timedelta(minutes=new_interval)).isoformat(timespec="seconds")
    return ScheduleResult(interval_minutes=new_interval, ease_factor=new_ease,
                          review_count=review_count + 1, due_at=due_at)
