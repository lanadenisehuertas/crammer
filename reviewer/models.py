from dataclasses import dataclass
from typing import Optional


@dataclass
class Document:
    id: Optional[int]
    title: str
    source_type: str
    created_at: str
    extracted_text: str
    exam_date: Optional[str] = None
    cheat_sheet: Optional[str] = None


@dataclass
class Module:
    id: Optional[int]
    document_id: int
    title: str
    position: int


@dataclass
class ModuleSection:
    id: Optional[int]
    module_id: int
    heading: str
    content: str
    origin: str  # 'from-file' | 'added-context'
    position: int


@dataclass
class Card:
    id: Optional[int]
    document_id: int
    module_id: int
    card_type: str  # 'flashcard' | 'fill-in-blank' | 'short-answer'
    question: str
    answer: str
    due_at: str
    interval_minutes: int = 0
    ease_factor: float = 2.5
    review_count: int = 0
    created_at: str = ""


@dataclass
class Review:
    id: Optional[int]
    card_id: int
    rated_at: str
    rating: str  # 'again' | 'hard' | 'good' | 'easy'
