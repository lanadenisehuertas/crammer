import json

from reviewer.generation.schemas import GeneratedCard, GeneratedModule, GeneratedSection

_VALID_ORIGINS = {"from-file", "added-context"}
_VALID_CARD_TYPES = {"flashcard", "fill-in-blank", "short-answer"}


def _extract_json(raw: str) -> str:
    """Return the JSON object substring from a possibly fenced/prose-wrapped reply."""
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        return ""
    return raw[start:end + 1]


def _parse_section(obj: dict) -> GeneratedSection | None:
    heading = str(obj.get("heading", "")).strip()
    content = str(obj.get("content", "")).strip()
    if not heading and not content:
        return None
    origin = obj.get("origin", "from-file")
    if origin not in _VALID_ORIGINS:
        origin = "from-file"
    return GeneratedSection(heading=heading, content=content, origin=origin)


def _parse_card(obj: dict) -> GeneratedCard | None:
    question = str(obj.get("question", "")).strip()
    answer = str(obj.get("answer", "")).strip()
    if not question or not answer:
        return None
    card_type = obj.get("type", "flashcard")
    if card_type not in _VALID_CARD_TYPES:
        card_type = "flashcard"
    return GeneratedCard(card_type=card_type, question=question, answer=answer)


def parse_modules(raw: str) -> list[GeneratedModule]:
    """Parse a Claude JSON reply into GeneratedModules. Returns [] if unparseable."""
    text = _extract_json(raw)
    if not text:
        return []
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return []

    modules: list[GeneratedModule] = []
    for m in data.get("modules", []) if isinstance(data, dict) else []:
        if not isinstance(m, dict):
            continue
        title = str(m.get("title", "")).strip()
        if not title:
            continue
        sections = [s for s in (_parse_section(x) for x in m.get("sections", [])
                                if isinstance(x, dict)) if s]
        cards = [c for c in (_parse_card(x) for x in m.get("cards", [])
                             if isinstance(x, dict)) if c]
        modules.append(GeneratedModule(title=title, sections=sections, cards=cards))
    return modules
