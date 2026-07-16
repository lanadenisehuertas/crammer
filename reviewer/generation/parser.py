import json

from reviewer.generation.schemas import GeneratedCard, GeneratedModule, GeneratedSection

_VALID_ORIGINS = {"from-file", "added-context"}
_VALID_CARD_TYPES = {"flashcard", "fill-in-blank", "short-answer"}


def _extract_json(raw: str) -> str:
    """Return the first balanced JSON object substring from a fenced/prose reply.

    Scans from the first '{' tracking brace depth and returns the substring
    ending at the '}' that closes it, ignoring any trailing prose (which may
    itself contain stray braces). Returns "" if no balanced object is found.
    """
    start = raw.find("{")
    if start == -1:
        return ""
    depth = 0
    for i in range(start, len(raw)):
        char = raw[i]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw[start:i + 1]
    return ""


def _parse_section(obj: dict) -> GeneratedSection | None:
    heading = str(obj.get("heading", "")).strip()
    content = str(obj.get("content", "")).strip()
    if not heading and not content:
        return None
    origin = str(obj.get("origin", "from-file"))
    if origin not in _VALID_ORIGINS:
        origin = "from-file"
    return GeneratedSection(heading=heading, content=content, origin=origin)


def _parse_card(obj: dict) -> GeneratedCard | None:
    question = str(obj.get("question", "")).strip()
    answer = str(obj.get("answer", "")).strip()
    if not question or not answer:
        return None
    card_type = str(obj.get("type", "flashcard"))
    if card_type not in _VALID_CARD_TYPES:
        card_type = "flashcard"
    return GeneratedCard(card_type=card_type, question=question, answer=answer)


def parse_modules(raw: str) -> list[GeneratedModule]:
    """Parse a Claude JSON reply into GeneratedModules. Returns [] if unparseable.

    Never raises on any string input: malformed content is skipped and whatever
    can be salvaged is returned (possibly []).
    """
    text = _extract_json(raw)
    if not text:
        return []
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return []

    modules: list[GeneratedModule] = []
    for m in (data.get("modules") or []) if isinstance(data, dict) else []:
        if not isinstance(m, dict):
            continue
        try:
            title = str(m.get("title", "")).strip()
            if not title:
                continue
            sections = [s for s in (_parse_section(x) for x in (m.get("sections") or [])
                                    if isinstance(x, dict)) if s]
            cards = [c for c in (_parse_card(x) for x in (m.get("cards") or [])
                                 if isinstance(x, dict)) if c]
            modules.append(GeneratedModule(title=title, sections=sections, cards=cards))
        except (TypeError, AttributeError, ValueError):
            continue
    return modules


def parse_cards(raw: str) -> list[GeneratedCard]:
    """Parse a Claude JSON reply of shape {"cards": [...]} into GeneratedCards.

    Never raises on any string input: malformed content is skipped and whatever
    can be salvaged is returned (possibly []).
    """
    text = _extract_json(raw)
    if not text:
        return []
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(data, dict):
        return []
    try:
        return [c for c in (_parse_card(x) for x in (data.get("cards") or [])
                            if isinstance(x, dict)) if c]
    except (TypeError, AttributeError, ValueError):
        return []
