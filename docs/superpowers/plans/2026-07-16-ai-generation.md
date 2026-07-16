# AI Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a document's extracted text into a structured reviewer — topic **modules**, each with reviewer **sections** (tagged from-file vs added-context) and active-recall **cards** — plus a one-page **cheat sheet**, and persist it all via the Plan 1 repository.

**Architecture:** `ClaudeClient` gains `generate_text()`. A `reviewer/generation/` subpackage holds: `schemas.py` (dataclasses for generated content), `prompts.py` (system prompts + user-prompt builders encoding the spec's generation rules), `chunker.py` (split long text), `parser.py` (Claude JSON → schemas, validated), `generator.py` (orchestrate chunk→generate→merge + cheat sheet), and `store.py` (persist to DB, incl. smart-table pairs → a "Key Terms" module). The Claude client is injected so all logic is testable with a fake — no live API in tests. Builds on Plans 1–2.

**Tech Stack:** Python 3.11+, `anthropic` (already a dep), stdlib `json`.

---

## File Structure

- `reviewer/ai/client.py` — add `generate_text()`.
- `reviewer/generation/__init__.py` — public exports.
- `reviewer/generation/schemas.py` — `GeneratedSection`, `GeneratedCard`, `GeneratedModule`, `GeneratedReviewer`.
- `reviewer/generation/prompts.py` — prompt constants + builders.
- `reviewer/generation/chunker.py` — `chunk_text`.
- `reviewer/generation/parser.py` — `parse_modules`.
- `reviewer/generation/generator.py` — `generate_reviewer`, `build_and_store`.
- `reviewer/generation/store.py` — `store_reviewer`.
- Tests mirror each module under `tests/`.

### Generated-content shape (defined in Task 2)

```
GeneratedReviewer(modules: list[GeneratedModule], cheat_sheet: str)
GeneratedModule(title: str, sections: list[GeneratedSection], cards: list[GeneratedCard])
GeneratedSection(heading: str, content: str, origin: str)   # 'from-file' | 'added-context'
GeneratedCard(card_type: str, question: str, answer: str)   # 'flashcard' | 'fill-in-blank' | 'short-answer'
```

### JSON contract Claude must return (per chunk)

```json
{
  "modules": [
    {
      "title": "string",
      "sections": [
        {"heading": "string", "content": "string", "origin": "from-file"}
      ],
      "cards": [
        {"type": "flashcard", "question": "string", "answer": "string"}
      ]
    }
  ]
}
```

`origin` ∈ {`from-file`, `added-context`}; card `type` ∈ {`flashcard`, `fill-in-blank`, `short-answer`}.

---

## Task 1: Client — text generation

**Files:**
- Modify: `reviewer/ai/client.py`
- Test: `tests/test_client.py` (append)

- [ ] **Step 1: Write the failing test (append to `tests/test_client.py`)**

```python
def test_generate_text_sends_system_and_user_and_returns_text():
    recorder = {}
    client = ClaudeClient(api_key="sk-ant-test", model="claude-opus-4-7",
                          sdk=_FakeAnthropic(recorder))
    # _FakeMessages.create returns "TRANSCRIBED TEXT"; reuse it as the model reply.
    out = client.generate_text(system="SYS", user="USER", max_tokens=1234)
    assert out == "TRANSCRIBED TEXT"
    kwargs = recorder["kwargs"]
    assert kwargs["model"] == "claude-opus-4-7"
    assert kwargs["system"] == "SYS"
    assert kwargs["max_tokens"] == 1234
    assert kwargs["messages"] == [{"role": "user", "content": "USER"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_client.py -v`
Expected: FAIL — `ClaudeClient` has no attribute `generate_text`.

- [ ] **Step 3: Implement (append method to the `ClaudeClient` class in `reviewer/ai/client.py`)**

```python
    def generate_text(self, system: str, user: str, max_tokens: int = 16000) -> str:
        """Return Claude's text response to a system + user prompt."""
        message = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in message.content if b.type == "text").strip()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_client.py -v`
Expected: PASS (2 passed in this file).

- [ ] **Step 5: Commit**

```bash
git add reviewer/ai/client.py tests/test_client.py
git commit -m "feat: Claude text generation method"
```

---

## Task 2: Generation schemas

**Files:**
- Create: `reviewer/generation/__init__.py` (empty docstring for now)
- Create: `reviewer/generation/schemas.py`

- [ ] **Step 1: Implement (plain data holders — no logic to test yet)**

Create `reviewer/generation/__init__.py`:

```python
"""AI generation: extracted text to modules, sections, cards, and cheat sheet."""
```

Create `reviewer/generation/schemas.py`:

```python
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
```

- [ ] **Step 2: Verify it imports**

Run: `python -c "import reviewer.generation.schemas"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add reviewer/generation/__init__.py reviewer/generation/schemas.py
git commit -m "feat: generation schemas for modules, sections, cards, reviewer"
```

---

## Task 3: Chunker

**Files:**
- Create: `reviewer/generation/chunker.py`
- Test: `tests/test_chunker.py`

Splits text into chunks no larger than `max_chars`, breaking on paragraph (blank-line) boundaries where possible; a single oversized paragraph is hard-split.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_chunker.py
from reviewer.generation.chunker import chunk_text


def test_short_text_is_one_chunk():
    assert chunk_text("hello world", max_chars=100) == ["hello world"]


def test_empty_text_is_no_chunks():
    assert chunk_text("   ", max_chars=100) == []


def test_splits_on_paragraph_boundaries():
    text = "A" * 40 + "\n\n" + "B" * 40
    chunks = chunk_text(text, max_chars=50)
    assert len(chunks) == 2
    assert chunks[0] == "A" * 40
    assert chunks[1] == "B" * 40


def test_hard_splits_oversized_paragraph():
    chunks = chunk_text("X" * 120, max_chars=50)
    assert len(chunks) == 3
    assert all(len(c) <= 50 for c in chunks)
    assert "".join(chunks) == "X" * 120
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_chunker.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/generation/chunker.py


def chunk_text(text: str, max_chars: int = 12000) -> list[str]:
    """Split text into chunks <= max_chars, preferring paragraph boundaries."""
    if not text.strip():
        return []

    chunks: list[str] = []
    current = ""
    for para in text.split("\n\n"):
        para = para.strip()
        if not para:
            continue
        if len(para) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            for i in range(0, len(para), max_chars):
                chunks.append(para[i:i + max_chars])
            continue
        candidate = para if not current else current + "\n\n" + para
        if len(candidate) > max_chars:
            chunks.append(current)
            current = para
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_chunker.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/generation/chunker.py tests/test_chunker.py
git commit -m "feat: text chunker for long documents"
```

---

## Task 4: Prompts

**Files:**
- Create: `reviewer/generation/prompts.py`
- Test: `tests/test_prompts.py`

Encodes the spec's generation rules. Two flows: reviewer (per chunk, JSON) and cheat sheet (from generated modules, Markdown text).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_prompts.py
from reviewer.generation import prompts
from reviewer.generation.schemas import GeneratedModule, GeneratedSection


def test_reviewer_system_states_core_rules():
    s = prompts.REVIEWER_SYSTEM.lower()
    assert "from-file" in s
    assert "added-context" in s
    assert "json" in s


def test_build_reviewer_user_embeds_source_text():
    user = prompts.build_reviewer_user("PHOTOSYNTHESIS NOTES")
    assert "PHOTOSYNTHESIS NOTES" in user


def test_build_cheatsheet_user_includes_module_titles_and_headings():
    modules = [GeneratedModule(
        title="Cells",
        sections=[GeneratedSection("Membrane", "controls entry", "from-file")],
        cards=[])]
    user = prompts.build_cheatsheet_user(modules)
    assert "Cells" in user
    assert "Membrane" in user
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_prompts.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/generation/prompts.py
from reviewer.generation.schemas import GeneratedModule

REVIEWER_SYSTEM = (
    "You are an expert study-guide creator. Given source study material, produce a "
    "structured reviewer as JSON. Group the content into a small number (2 to 6) of "
    "coherent topic modules. For each module, write concise reviewer sections "
    "(a heading and an explanation) and active-recall cards.\n\n"
    "Rules:\n"
    "- Base everything primarily on the provided material and its wording.\n"
    "- Use origin 'from-file' for sections drawn from the material.\n"
    "- Only when the material is clearly incomplete on a concept it raises, you may "
    "add accurate related context; mark those sections with origin 'added-context'.\n"
    "- Do not invent citations or cite live web sources.\n"
    "- Cards must test the material in the sections. Card types: 'flashcard', "
    "'fill-in-blank', 'short-answer'.\n"
    "- Output ONLY valid JSON matching the schema. No prose, no markdown fences."
)

_SCHEMA_EXAMPLE = (
    '{\n'
    '  "modules": [\n'
    '    {\n'
    '      "title": "Topic name",\n'
    '      "sections": [\n'
    '        {"heading": "Term or concept", "content": "Explanation.", "origin": "from-file"}\n'
    '      ],\n'
    '      "cards": [\n'
    '        {"type": "flashcard", "question": "Q?", "answer": "A."}\n'
    '      ]\n'
    '    }\n'
    '  ]\n'
    '}'
)

CHEATSHEET_SYSTEM = (
    "You create a one-page condensed cheat sheet (TL;DR) for last-minute exam review. "
    "Given the key points of a study reviewer, output a concise Markdown cheat sheet "
    "covering the most important terms, definitions, formulas, and facts. Be brief and "
    "high-yield. Output only the cheat sheet text."
)


def build_reviewer_user(source_text: str) -> str:
    return (
        "Source material:\n<<<\n" + source_text + "\n>>>\n\n"
        "Return JSON of exactly this shape:\n" + _SCHEMA_EXAMPLE
    )


def build_cheatsheet_user(modules: list[GeneratedModule]) -> str:
    lines: list[str] = []
    for module in modules:
        lines.append(f"# {module.title}")
        for section in module.sections:
            lines.append(f"- {section.heading}: {section.content}")
    return (
        "Reviewer key points:\n" + "\n".join(lines) +
        "\n\nWrite the cheat sheet now."
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_prompts.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/generation/prompts.py tests/test_prompts.py
git commit -m "feat: generation prompts for reviewer and cheat sheet"
```

---

## Task 5: Response parser

**Files:**
- Create: `reviewer/generation/parser.py`
- Test: `tests/test_generation_parser.py`

Parses Claude's JSON reply into `GeneratedModule`s. Robust to markdown fences and surrounding prose. Invalid `origin`/`type` values are coerced to safe defaults; cards missing question/answer are skipped; a module needs a title.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_generation_parser.py
from reviewer.generation.parser import parse_modules


def test_parses_valid_json():
    raw = '''{"modules":[{"title":"Cells",
      "sections":[{"heading":"Membrane","content":"controls entry","origin":"from-file"}],
      "cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}'''
    modules = parse_modules(raw)
    assert len(modules) == 1
    assert modules[0].title == "Cells"
    assert modules[0].sections[0].origin == "from-file"
    assert modules[0].cards[0].card_type == "flashcard"


def test_strips_markdown_fences_and_prose():
    raw = 'Here is the JSON:\n```json\n{"modules":[{"title":"T","sections":[],"cards":[]}]}\n```'
    modules = parse_modules(raw)
    assert modules[0].title == "T"


def test_invalid_origin_defaults_to_from_file():
    raw = '{"modules":[{"title":"T","sections":[{"heading":"h","content":"c","origin":"bogus"}],"cards":[]}]}'
    assert parse_modules(raw)[0].sections[0].origin == "from-file"


def test_invalid_card_type_defaults_to_flashcard():
    raw = '{"modules":[{"title":"T","sections":[],"cards":[{"type":"weird","question":"q","answer":"a"}]}]}'
    assert parse_modules(raw)[0].cards[0].card_type == "flashcard"


def test_skips_cards_missing_question_or_answer():
    raw = '{"modules":[{"title":"T","sections":[],"cards":[{"type":"flashcard","question":"","answer":"a"}]}]}'
    assert parse_modules(raw)[0].cards == []


def test_unparseable_returns_empty_list():
    assert parse_modules("not json at all") == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_generation_parser.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/generation/parser.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_generation_parser.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/generation/parser.py tests/test_generation_parser.py
git commit -m "feat: robust parser for generated reviewer JSON"
```

---

## Task 6: Generator

**Files:**
- Create: `reviewer/generation/generator.py`
- Test: `tests/test_generator.py`

`generate_reviewer(client, extracted_text)` chunks the text, generates modules per chunk (merging them), then generates a cheat sheet from the merged modules. `client` is any object with `generate_text(system, user, max_tokens=...)`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_generator.py
from reviewer.generation.generator import generate_reviewer


class FakeClient:
    """Records calls; returns queued replies in order."""
    def __init__(self, replies):
        self._replies = list(replies)
        self.calls = []

    def generate_text(self, system, user, max_tokens=16000):
        self.calls.append((system, user))
        return self._replies.pop(0)


_MODULE_JSON = ('{"modules":[{"title":"Cells","sections":['
                '{"heading":"Membrane","content":"controls entry","origin":"from-file"}],'
                '"cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}')


def test_generate_reviewer_single_chunk():
    client = FakeClient([_MODULE_JSON, "CHEAT SHEET TEXT"])
    result = generate_reviewer(client, "short source text")
    assert len(result.modules) == 1
    assert result.modules[0].title == "Cells"
    assert result.cheat_sheet == "CHEAT SHEET TEXT"
    # one reviewer call + one cheat-sheet call
    assert len(client.calls) == 2


def test_generate_reviewer_merges_multiple_chunks():
    other = _MODULE_JSON.replace("Cells", "Energy")
    client = FakeClient([_MODULE_JSON, other, "CHEAT"])
    # max_chars small enough to force two chunks
    result = generate_reviewer(client, "A" * 30 + "\n\n" + "B" * 30, max_chars=40)
    titles = [m.title for m in result.modules]
    assert titles == ["Cells", "Energy"]
    assert len(client.calls) == 3  # two reviewer calls + one cheat sheet
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_generator.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/generation/generator.py
from reviewer.generation import prompts
from reviewer.generation.chunker import chunk_text
from reviewer.generation.parser import parse_modules
from reviewer.generation.schemas import GeneratedReviewer


def generate_reviewer(client, extracted_text: str, *, max_chars: int = 12000) -> GeneratedReviewer:
    """Generate a structured reviewer (modules + cheat sheet) from extracted text."""
    modules = []
    for chunk in chunk_text(extracted_text, max_chars=max_chars):
        raw = client.generate_text(prompts.REVIEWER_SYSTEM,
                                   prompts.build_reviewer_user(chunk))
        modules.extend(parse_modules(raw))

    cheat_sheet = ""
    if modules:
        cheat_sheet = client.generate_text(
            prompts.CHEATSHEET_SYSTEM, prompts.build_cheatsheet_user(modules)).strip()
    return GeneratedReviewer(modules=modules, cheat_sheet=cheat_sheet)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_generator.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/generation/generator.py tests/test_generator.py
git commit -m "feat: reviewer generator with chunk merge and cheat sheet"
```

---

## Task 7: Store

**Files:**
- Create: `reviewer/generation/store.py`
- Test: `tests/test_generation_store.py`

Persists a `GeneratedReviewer` for a document: modules (ordered), sections (ordered, with origin), cards (due now), and the cheat sheet. If `flashcard_pairs` are supplied (from a smart-table spreadsheet), append a "Key Terms" module of flashcards.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_generation_store.py
from reviewer import repository as repo
from reviewer.models import Document
from reviewer.generation.schemas import (
    GeneratedReviewer, GeneratedModule, GeneratedSection, GeneratedCard,
)
from reviewer.generation.store import store_reviewer


def _doc(conn):
    return repo.create_document(conn, Document(
        None, "D", "text", "2026-07-16T09:00:00", "source"))


def _sample():
    return GeneratedReviewer(
        modules=[GeneratedModule(
            title="Cells",
            sections=[GeneratedSection("Membrane", "controls entry", "from-file"),
                      GeneratedSection("Extra", "related", "added-context")],
            cards=[GeneratedCard("flashcard", "Q?", "A.")])],
        cheat_sheet="TL;DR cells")


def test_store_persists_modules_sections_cards_cheatsheet(conn):
    d = _doc(conn)
    store_reviewer(conn, d.id, _sample())

    modules = repo.list_modules(conn, d.id)
    assert [m.title for m in modules] == ["Cells"]
    sections = repo.list_sections(conn, modules[0].id)
    assert [s.origin for s in sections] == ["from-file", "added-context"]
    cards = repo.list_cards_for_module(conn, modules[0].id)
    assert cards[0].question == "Q?"
    assert repo.get_document(conn, d.id).cheat_sheet == "TL;DR cells"


def test_store_creates_key_terms_module_from_pairs(conn):
    d = _doc(conn)
    store_reviewer(conn, d.id, _sample(),
                   flashcard_pairs=[("Osmosis", "Water diffusion")])
    modules = repo.list_modules(conn, d.id)
    assert "Key Terms" in [m.title for m in modules]
    key = next(m for m in modules if m.title == "Key Terms")
    cards = repo.list_cards_for_module(conn, key.id)
    assert cards[0].question == "Osmosis"
    assert cards[0].answer == "Water diffusion"
    assert cards[0].card_type == "flashcard"


def test_store_new_cards_are_due_immediately(conn):
    d = _doc(conn)
    store_reviewer(conn, d.id, _sample())
    card = repo.list_cards_for_document(conn, d.id)[0]
    assert card.due_at  # non-empty timestamp
    assert card.review_count == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_generation_store.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/generation/store.py
import sqlite3
from datetime import datetime

from reviewer import repository as repo
from reviewer.models import Card, Module, ModuleSection
from reviewer.generation.schemas import GeneratedReviewer


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def store_reviewer(conn: sqlite3.Connection, document_id: int,
                   generated: GeneratedReviewer,
                   flashcard_pairs: list[tuple[str, str]] | None = None) -> None:
    """Persist a generated reviewer (modules, sections, cards, cheat sheet)."""
    now = _now()
    position = 0
    for gm in generated.modules:
        module = repo.create_module(conn, Module(
            id=None, document_id=document_id, title=gm.title, position=position))
        position += 1
        for i, section in enumerate(gm.sections):
            repo.add_section(conn, ModuleSection(
                id=None, module_id=module.id, heading=section.heading,
                content=section.content, origin=section.origin, position=i))
        for card in gm.cards:
            repo.create_card(conn, Card(
                id=None, document_id=document_id, module_id=module.id,
                card_type=card.card_type, question=card.question, answer=card.answer,
                due_at=now, created_at=now))

    if flashcard_pairs:
        module = repo.create_module(conn, Module(
            id=None, document_id=document_id, title="Key Terms", position=position))
        for term, definition in flashcard_pairs:
            repo.create_card(conn, Card(
                id=None, document_id=document_id, module_id=module.id,
                card_type="flashcard", question=term, answer=definition,
                due_at=now, created_at=now))

    repo.set_cheat_sheet(conn, document_id, generated.cheat_sheet)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_generation_store.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/generation/store.py tests/test_generation_store.py
git commit -m "feat: persist generated reviewer and smart-table key terms"
```

---

## Task 8: Orchestrator + end-to-end

**Files:**
- Modify: `reviewer/generation/generator.py` (add `build_and_store`)
- Modify: `reviewer/generation/__init__.py` (exports)
- Test: `tests/test_generation_e2e.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_generation_e2e.py
from reviewer import repository as repo
from reviewer.models import Document
from reviewer.generation import build_and_store


class FakeClient:
    def __init__(self, replies):
        self._replies = list(replies)

    def generate_text(self, system, user, max_tokens=16000):
        return self._replies.pop(0)


_MODULE_JSON = ('{"modules":[{"title":"Cells","sections":['
                '{"heading":"Membrane","content":"controls entry","origin":"from-file"}],'
                '"cards":[{"type":"flashcard","question":"Q?","answer":"A."}]}]}')


def test_build_and_store_end_to_end(conn):
    doc = repo.create_document(conn, Document(
        None, "Bio", "text", "2026-07-16T09:00:00", "some source text"))
    client = FakeClient([_MODULE_JSON, "CHEAT SHEET"])

    generated = build_and_store(conn, client, doc.id, "some source text")

    assert len(generated.modules) == 1
    modules = repo.list_modules(conn, doc.id)
    assert modules[0].title == "Cells"
    assert repo.list_cards_for_document(conn, doc.id)[0].question == "Q?"
    assert repo.get_document(conn, doc.id).cheat_sheet == "CHEAT SHEET"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_generation_e2e.py -v`
Expected: FAIL — cannot import `build_and_store`.

- [ ] **Step 3: Implement (append to `reviewer/generation/generator.py`)**

```python
import sqlite3

from reviewer.generation.store import store_reviewer


def build_and_store(conn: sqlite3.Connection, client, document_id: int,
                    extracted_text: str,
                    flashcard_pairs=None, *, max_chars: int = 12000) -> GeneratedReviewer:
    """Generate a reviewer from text and persist it for the document."""
    generated = generate_reviewer(client, extracted_text, max_chars=max_chars)
    store_reviewer(conn, document_id, generated, flashcard_pairs)
    return generated
```

Update `reviewer/generation/__init__.py`:

```python
"""AI generation: extracted text to modules, sections, cards, and cheat sheet."""

from reviewer.generation.schemas import (
    GeneratedReviewer, GeneratedModule, GeneratedSection, GeneratedCard,
)
from reviewer.generation.generator import generate_reviewer, build_and_store
from reviewer.generation.store import store_reviewer

__all__ = [
    "GeneratedReviewer", "GeneratedModule", "GeneratedSection", "GeneratedCard",
    "generate_reviewer", "build_and_store", "store_reviewer",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_generation_e2e.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -q`
Expected: all tests PASS (Plans 1–3).

- [ ] **Step 6: Commit**

```bash
git add reviewer/generation/generator.py reviewer/generation/__init__.py tests/test_generation_e2e.py
git commit -m "feat: build-and-store orchestrator for AI generation"
```

---

## Definition of done

- `python -m pytest -q` fully green.
- `ClaudeClient.generate_text` returns model text for a system+user prompt.
- `reviewer/generation` turns a document's `extracted_text` into modules,
  reviewer sections (origin-tagged), cards, and a cheat sheet, and persists them;
  smart-table `flashcard_pairs` become a "Key Terms" flashcard module.
- Long text is chunked; unparseable model output degrades to no modules rather
  than crashing.
- All Claude access is injected, so the suite runs with no API key.
- Ready for Plan 4 (scheduler): cards exist with `due_at`/`interval_minutes`/
  `ease_factor`/`review_count` ready for the hours-based SM-2 engine.
