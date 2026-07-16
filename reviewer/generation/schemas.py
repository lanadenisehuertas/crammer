from dataclasses import dataclass, field


@dataclass
class GeneratedSection:
    heading: str
    content: str
    origin: str  # 'from-file' | 'added-context'


@dataclass
class GeneratedCard:
    card_type: str  # 'flashcard' | 'fill-in-blank' | 'short-answer'
    question: str
    answer: str


@dataclass
class GeneratedModule:
    title: str
    sections: list[GeneratedSection] = field(default_factory=list)
    cards: list[GeneratedCard] = field(default_factory=list)


@dataclass
class GeneratedReviewer:
    modules: list[GeneratedModule] = field(default_factory=list)
    cheat_sheet: str = ""
