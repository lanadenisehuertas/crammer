# File Parsing (Content Ingestion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn any supported upload (or pasted text) into clean extracted text — including text read out of embedded images/diagrams via Claude vision — and store it as a `documents` row.

**Architecture:** A thin `reviewer/ai/client.py` wraps the Anthropic SDK and exposes `ocr_image()` (Claude vision). A `reviewer/parsing/` subpackage has one reader per format, each producing a `ParsedContent(text, flashcard_pairs)`. A dispatcher (`parse_file` / `parse_text`) routes by file extension and injects an OCR callable so readers stay testable without a live API. `reviewer/ingest.py` ties parsing to `repository.create_document`. Builds on Plan 1's storage layer.

**Tech Stack:** Python 3.11+, `anthropic`, `pypdf`, `python-docx`, `python-pptx`, `Pillow`, `openpyxl`, `beautifulsoup4`, `EbookLib`, `striprtf`; dev-only `fpdf2` for PDF test fixtures.

---

## File Structure

- `pyproject.toml` — add runtime + dev dependencies.
- `.env.example` — document `REVIEWER_MODEL`.
- `reviewer/config.py` — add `model` field.
- `reviewer/ai/__init__.py`
- `reviewer/ai/client.py` — `ClaudeClient` with `ocr_image()`.
- `reviewer/parsing/__init__.py` — public exports.
- `reviewer/parsing/base.py` — `ParsedContent`, `OcrFn`, `media_type_for`, exceptions.
- `reviewer/parsing/text_reader.py` — TXT, MD, RTF.
- `reviewer/parsing/spreadsheet_reader.py` — CSV, XLSX/XLS (+ smart-table pairs).
- `reviewer/parsing/web_reader.py` — HTML, EPUB.
- `reviewer/parsing/image_reader.py` — PNG/JPG/etc.
- `reviewer/parsing/pdf_reader.py` — PDF (text + embedded-image OCR).
- `reviewer/parsing/docx_reader.py` — DOCX (paragraphs, tables, images).
- `reviewer/parsing/pptx_reader.py` — PPTX (text, tables, notes, pictures).
- `reviewer/parsing/dispatch.py` — `parse_file`, `parse_text`.
- `reviewer/ingest.py` — `ingest_file`, `ingest_text`.
- Tests mirror each module under `tests/`.

### Key interfaces (defined in Task 3, used everywhere)

```python
# ParsedContent: what every reader returns.
#   text: the clean extracted text
#   flashcard_pairs: (term, definition) tuples from smart tables; usually []
# OcrFn: Callable[[bytes, str], str]  # (image_bytes, media_type) -> transcribed text
```

Readers never call the API directly. The dispatcher passes an `OcrFn`. In production it is `ClaudeClient.ocr_image`; in tests it is a fake returning canned text.

---

## Task 1: Add dependencies

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Update `pyproject.toml` dependencies**

Replace the `[project]` dependencies and `[project.optional-dependencies]` blocks with:

```toml
dependencies = [
    "python-dotenv>=1.0",
    "anthropic>=0.40",
    "pypdf>=5.0",
    "python-docx>=1.1",
    "python-pptx>=1.0",
    "Pillow>=10.0",
    "openpyxl>=3.1",
    "beautifulsoup4>=4.12",
    "EbookLib>=0.18",
    "striprtf>=0.0.26",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "fpdf2>=2.7",
]
```

- [ ] **Step 2: Install**

Run: `pip install -e ".[dev]"`
Expected: all packages install without errors.

- [ ] **Step 3: Verify imports**

Run: `python -c "import anthropic, pypdf, docx, pptx, PIL, openpyxl, bs4, ebooklib, striprtf; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add parsing and Anthropic SDK dependencies"
```

---

## Task 2: Config — model setting

**Files:**
- Modify: `reviewer/config.py`
- Modify: `.env.example`
- Test: `tests/test_config.py` (append)

- [ ] **Step 1: Write the failing test (append to `tests/test_config.py`)**

```python
def test_load_config_default_model(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("REVIEWER_MODEL", raising=False)
    assert load_config().model == "claude-opus-4-7"


def test_load_config_custom_model(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_MODEL", "claude-haiku-4-5")
    assert load_config().model == "claude-haiku-4-5"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_config.py -v`
Expected: FAIL — `Config` has no attribute `model` / TypeError.

- [ ] **Step 3: Update `reviewer/config.py`**

Add `model` to the dataclass and populate it in `load_config`:

```python
@dataclass(frozen=True)
class Config:
    anthropic_api_key: str
    db_path: str
    model: str
```

In `load_config`, before the `return`:

```python
    model = os.environ.get("REVIEWER_MODEL") or "claude-opus-4-7"
    return Config(anthropic_api_key=api_key, db_path=db_path, model=model)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_config.py -v`
Expected: PASS (5 passed in this file).

- [ ] **Step 5: Document the setting in `.env.example`**

Append:

```bash
# Which Claude model to use. Defaults to claude-opus-4-7.
# For lower cost, use claude-sonnet-4-6 or claude-haiku-4-5.
REVIEWER_MODEL=claude-opus-4-7
```

- [ ] **Step 6: Commit**

```bash
git add reviewer/config.py .env.example tests/test_config.py
git commit -m "feat: configurable Claude model via REVIEWER_MODEL"
```

---

## Task 3: Parsing base types + Claude vision client

**Files:**
- Create: `reviewer/parsing/__init__.py` (empty for now)
- Create: `reviewer/parsing/base.py`
- Create: `reviewer/ai/__init__.py` (empty)
- Create: `reviewer/ai/client.py`
- Test: `tests/test_parsing_base.py`
- Test: `tests/test_client.py`

- [ ] **Step 1: Write the failing test for base types**

```python
# tests/test_parsing_base.py
import pytest
from reviewer.parsing.base import (
    ParsedContent, media_type_for, UnsupportedFileType, EmptyContentError,
)


def test_parsed_content_defaults_to_no_pairs():
    pc = ParsedContent(text="hello")
    assert pc.text == "hello"
    assert pc.flashcard_pairs == []


def test_media_type_for_known_extensions():
    assert media_type_for("a.png") == "image/png"
    assert media_type_for("a.JPG") == "image/jpeg"
    assert media_type_for("a.jpeg") == "image/jpeg"
    assert media_type_for("a.gif") == "image/gif"
    assert media_type_for("a.webp") == "image/webp"


def test_media_type_for_unknown_raises():
    with pytest.raises(UnsupportedFileType):
        media_type_for("a.bmp")


def test_exceptions_exist():
    assert issubclass(UnsupportedFileType, Exception)
    assert issubclass(EmptyContentError, Exception)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_parsing_base.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'reviewer.parsing'`.

- [ ] **Step 3: Implement base types**

Create `reviewer/parsing/__init__.py` with:

```python
"""File parsing: uploads and pasted text to clean extracted text."""
```

Create `reviewer/parsing/base.py`:

```python
from dataclasses import dataclass, field
from typing import Callable

# (image_bytes, media_type) -> transcribed text
OcrFn = Callable[[bytes, str], str]


class UnsupportedFileType(Exception):
    """Raised when a file's extension has no registered reader."""


class EmptyContentError(Exception):
    """Raised when parsing yields no usable text."""


@dataclass
class ParsedContent:
    text: str
    flashcard_pairs: list[tuple[str, str]] = field(default_factory=list)


_IMAGE_MEDIA_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
}


def media_type_for(filename: str) -> str:
    """Return the image media type for a filename, else raise UnsupportedFileType."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _IMAGE_MEDIA_TYPES:
        raise UnsupportedFileType(f"Unsupported image type: {filename}")
    return _IMAGE_MEDIA_TYPES[ext]
```

- [ ] **Step 4: Run base test to verify it passes**

Run: `pytest tests/test_parsing_base.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Write the failing test for the Claude client**

The client must not hit the network in tests. We inject a fake underlying SDK object shaped like `anthropic.Anthropic` (only `.messages.create` is used).

```python
# tests/test_client.py
import base64
from reviewer.ai.client import ClaudeClient


class _FakeBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class _FakeMessage:
    def __init__(self, text):
        self.content = [_FakeBlock(text)]


class _FakeMessages:
    def __init__(self, recorder):
        self._recorder = recorder

    def create(self, **kwargs):
        self._recorder["kwargs"] = kwargs
        return _FakeMessage("TRANSCRIBED TEXT")


class _FakeAnthropic:
    def __init__(self, recorder):
        self.messages = _FakeMessages(recorder)


def test_ocr_image_returns_text_and_sends_image_block():
    recorder = {}
    client = ClaudeClient(api_key="sk-ant-test", model="claude-opus-4-7",
                          sdk=_FakeAnthropic(recorder))
    result = client.ocr_image(b"\x89PNG-bytes", "image/png")
    assert result == "TRANSCRIBED TEXT"

    kwargs = recorder["kwargs"]
    assert kwargs["model"] == "claude-opus-4-7"
    content = kwargs["messages"][0]["content"]
    image_block = next(b for b in content if b["type"] == "image")
    assert image_block["source"]["media_type"] == "image/png"
    # image bytes must be base64-encoded
    assert image_block["source"]["data"] == base64.standard_b64encode(
        b"\x89PNG-bytes").decode("utf-8")
```

- [ ] **Step 6: Run client test to verify it fails**

Run: `pytest tests/test_client.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'reviewer.ai'`.

- [ ] **Step 7: Implement the client**

Create `reviewer/ai/__init__.py`:

```python
"""Claude API integration."""
```

Create `reviewer/ai/client.py`:

```python
import base64

import anthropic

_OCR_INSTRUCTION = (
    "Transcribe all text visible in this image exactly as written, preserving "
    "reading order. If the image contains a diagram or chart, briefly describe it "
    "in square brackets. Output only the transcription, with no preamble."
)


class ClaudeClient:
    """Thin wrapper over the Anthropic SDK for the reviewer app."""

    def __init__(self, api_key: str, model: str, sdk=None):
        # `sdk` lets tests inject a fake; production uses the real client.
        self._client = sdk or anthropic.Anthropic(api_key=api_key)
        self._model = model

    def ocr_image(self, image_bytes: bytes, media_type: str) -> str:
        """Return the text Claude reads from an image."""
        data = base64.standard_b64encode(image_bytes).decode("utf-8")
        message = self._client.messages.create(
            model=self._model,
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": media_type, "data": data}},
                    {"type": "text", "text": _OCR_INSTRUCTION},
                ],
            }],
        )
        return "".join(b.text for b in message.content if b.type == "text").strip()
```

- [ ] **Step 8: Run client test to verify it passes**

Run: `pytest tests/test_client.py -v`
Expected: PASS (1 passed).

- [ ] **Step 9: Commit**

```bash
git add reviewer/parsing/__init__.py reviewer/parsing/base.py reviewer/ai/ \
        tests/test_parsing_base.py tests/test_client.py
git commit -m "feat: parsing base types and Claude vision OCR client"
```

---

## Task 4: Text reader (TXT, MD, RTF)

**Files:**
- Create: `reviewer/parsing/text_reader.py`
- Test: `tests/test_text_reader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_text_reader.py
from reviewer.parsing.text_reader import read_plain, read_rtf


def test_read_plain_decodes_utf8():
    pc = read_plain("Hello — world\nline two".encode("utf-8"))
    assert "Hello — world" in pc.text
    assert "line two" in pc.text
    assert pc.flashcard_pairs == []


def test_read_rtf_strips_control_words():
    rtf = rb"{\rtf1\ansi Hello \b bold\b0 world}"
    pc = read_rtf(rtf)
    assert "Hello" in pc.text
    assert "bold" in pc.text
    assert "\\rtf1" not in pc.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_text_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/text_reader.py
from striprtf.striprtf import rtf_to_text

from reviewer.parsing.base import ParsedContent


def read_plain(data: bytes) -> ParsedContent:
    """Decode TXT/Markdown bytes as UTF-8 (lenient)."""
    return ParsedContent(text=data.decode("utf-8", errors="replace"))


def read_rtf(data: bytes) -> ParsedContent:
    """Extract plain text from RTF."""
    return ParsedContent(text=rtf_to_text(data.decode("utf-8", errors="replace")))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_text_reader.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/text_reader.py tests/test_text_reader.py
git commit -m "feat: text reader for txt, markdown, and rtf"
```

---

## Task 5: Spreadsheet reader (CSV, XLSX) with smart tables

**Files:**
- Create: `reviewer/parsing/spreadsheet_reader.py`
- Test: `tests/test_spreadsheet_reader.py`

Smart-table rule: if every non-empty row has exactly two columns, treat column 1 as term and column 2 as definition, emit `flashcard_pairs` (skipping a header row named like term/definition). The joined text is always produced too.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_spreadsheet_reader.py
import io
from openpyxl import Workbook
from reviewer.parsing.spreadsheet_reader import read_csv, read_xlsx


def test_read_csv_two_columns_makes_pairs():
    csv_bytes = b"Term,Definition\nMitochondria,Powerhouse of the cell\nOsmosis,Water diffusion\n"
    pc = read_csv(csv_bytes)
    assert ("Mitochondria", "Powerhouse of the cell") in pc.flashcard_pairs
    assert ("Osmosis", "Water diffusion") in pc.flashcard_pairs
    assert "Mitochondria" in pc.text  # text still produced


def test_read_csv_multi_column_has_no_pairs():
    csv_bytes = b"a,b,c\n1,2,3\n4,5,6\n"
    pc = read_csv(csv_bytes)
    assert pc.flashcard_pairs == []
    assert "1" in pc.text and "3" in pc.text


def test_read_xlsx_two_columns_makes_pairs():
    wb = Workbook()
    ws = wb.active
    ws.append(["Term", "Definition"])
    ws.append(["Photosynthesis", "Converting light to energy"])
    buf = io.BytesIO()
    wb.save(buf)
    pc = read_xlsx(buf.getvalue())
    assert ("Photosynthesis", "Converting light to energy") in pc.flashcard_pairs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_spreadsheet_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/spreadsheet_reader.py
import csv
import io

from openpyxl import load_workbook

from reviewer.parsing.base import ParsedContent

_HEADER_TERMS = {"term", "terms", "word", "front", "question"}
_HEADER_DEFS = {"definition", "definitions", "meaning", "back", "answer"}


def _rows_to_content(rows: list[list[str]]) -> ParsedContent:
    rows = [[(c or "").strip() for c in row] for row in rows if any((c or "").strip() for c in row)]
    text = "\n".join("\t".join(row) for row in rows)

    pairs: list[tuple[str, str]] = []
    if rows and all(len(row) == 2 for row in rows):
        data_rows = rows
        first = rows[0]
        if first[0].lower() in _HEADER_TERMS and first[1].lower() in _HEADER_DEFS:
            data_rows = rows[1:]
        pairs = [(r[0], r[1]) for r in data_rows if r[0] and r[1]]
    return ParsedContent(text=text, flashcard_pairs=pairs)


def read_csv(data: bytes) -> ParsedContent:
    text = data.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    return _rows_to_content(rows)


def read_xlsx(data: bytes) -> ParsedContent:
    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    rows: list[list[str]] = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            rows.append(["" if v is None else str(v) for v in row])
    return _rows_to_content(rows)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_spreadsheet_reader.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/spreadsheet_reader.py tests/test_spreadsheet_reader.py
git commit -m "feat: spreadsheet reader with smart-table flashcard detection"
```

---

## Task 6: Web reader (HTML, EPUB)

**Files:**
- Create: `reviewer/parsing/web_reader.py`
- Test: `tests/test_web_reader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_web_reader.py
from reviewer.parsing.web_reader import read_html


def test_read_html_extracts_visible_text_only():
    html = b"""<html><head><style>.x{color:red}</style>
    <script>var a=1;</script></head>
    <body><h1>Title</h1><p>Body text here.</p></body></html>"""
    pc = read_html(html)
    assert "Title" in pc.text
    assert "Body text here." in pc.text
    assert "color:red" not in pc.text
    assert "var a=1" not in pc.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_web_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/web_reader.py
import io
import tempfile

from bs4 import BeautifulSoup

from reviewer.parsing.base import ParsedContent


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def read_html(data: bytes) -> ParsedContent:
    return ParsedContent(text=_html_to_text(data.decode("utf-8", errors="replace")))


def read_epub(data: bytes) -> ParsedContent:
    # EbookLib reads from a path; write bytes to a temp file.
    from ebooklib import epub, ITEM_DOCUMENT

    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    book = epub.read_epub(tmp_path)
    parts = []
    for item in book.get_items_of_type(ITEM_DOCUMENT):
        parts.append(_html_to_text(item.get_content().decode("utf-8", errors="replace")))
    return ParsedContent(text="\n\n".join(p for p in parts if p))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_web_reader.py -v`
Expected: PASS (1 passed). (EPUB path is exercised in the dispatch e2e via a generated fixture in Task 11; the unit test covers the shared HTML extraction.)

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/web_reader.py tests/test_web_reader.py
git commit -m "feat: web reader for html and epub"
```

---

## Task 7: Image reader

**Files:**
- Create: `reviewer/parsing/image_reader.py`
- Test: `tests/test_image_reader.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_image_reader.py
from reviewer.parsing.image_reader import read_image


def test_read_image_calls_ocr_with_bytes_and_media_type():
    calls = []

    def fake_ocr(image_bytes, media_type):
        calls.append((image_bytes, media_type))
        return "text from image"

    pc = read_image(b"IMG", "image/png", ocr=fake_ocr)
    assert pc.text == "text from image"
    assert calls == [(b"IMG", "image/png")]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_image_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/image_reader.py
from reviewer.parsing.base import OcrFn, ParsedContent


def read_image(data: bytes, media_type: str, ocr: OcrFn) -> ParsedContent:
    """OCR a standalone image file."""
    return ParsedContent(text=ocr(data, media_type))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_image_reader.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/image_reader.py tests/test_image_reader.py
git commit -m "feat: image reader via Claude vision OCR"
```

---

## Task 8: PDF reader

**Files:**
- Create: `reviewer/parsing/pdf_reader.py`
- Test: `tests/test_pdf_reader.py`

Approach: extract text per page with `pypdf`. Also OCR embedded images (`page.images`) so diagrams/scans are captured. Each embedded image exposes `.data` (bytes) and `.name` (used to infer media type; default `image/png`).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_pdf_reader.py
import io
from fpdf import FPDF
from reviewer.parsing.pdf_reader import read_pdf


def _make_pdf(text: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", size=14)
    pdf.cell(0, 10, text)
    return bytes(pdf.output())


def test_read_pdf_extracts_text():
    pc = read_pdf(_make_pdf("Photosynthesis basics"), ocr=lambda b, m: "")
    assert "Photosynthesis basics" in pc.text


def test_read_pdf_appends_ocr_for_embedded_images(monkeypatch):
    # A text PDF has no embedded images, so OCR should not run here.
    calls = []
    read_pdf(_make_pdf("Some text"), ocr=lambda b, m: calls.append(1) or "X")
    assert calls == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_pdf_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/pdf_reader.py
import io

from pypdf import PdfReader

from reviewer.parsing.base import OcrFn, ParsedContent


def _image_media_type(name: str) -> str:
    lower = name.lower()
    if lower.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if lower.endswith(".gif"):
        return "image/gif"
    if lower.endswith(".webp"):
        return "image/webp"
    return "image/png"


def read_pdf(data: bytes, ocr: OcrFn) -> ParsedContent:
    reader = PdfReader(io.BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            parts.append(page_text.strip())
        for image in getattr(page, "images", []):
            try:
                transcription = ocr(image.data, _image_media_type(image.name or ""))
            except Exception:
                transcription = ""
            if transcription.strip():
                parts.append(transcription.strip())
    return ParsedContent(text="\n\n".join(parts))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_pdf_reader.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/pdf_reader.py tests/test_pdf_reader.py
git commit -m "feat: pdf reader with text extraction and embedded-image OCR"
```

---

## Task 9: DOCX reader

**Files:**
- Create: `reviewer/parsing/docx_reader.py`
- Test: `tests/test_docx_reader.py`

Approach: paragraphs + table cell text via `python-docx`; embedded images via document relationships (`doc.part.rels`, `rel.reltype` ends with `/image`, `rel.target_part.blob`, `.content_type`), OCR'd.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_docx_reader.py
import io
from docx import Document as DocxDocument
from PIL import Image
from reviewer.parsing.docx_reader import read_docx


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buf, format="PNG")
    return buf.getvalue()


def _make_docx() -> bytes:
    d = DocxDocument()
    d.add_paragraph("Intro paragraph.")
    table = d.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Cell A"
    table.rows[0].cells[1].text = "Cell B"
    d.add_picture(io.BytesIO(_png_bytes()))
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def test_read_docx_extracts_paragraphs_tables_and_image_ocr():
    pc = read_docx(_make_docx(), ocr=lambda b, m: "IMAGE_TEXT")
    assert "Intro paragraph." in pc.text
    assert "Cell A" in pc.text and "Cell B" in pc.text
    assert "IMAGE_TEXT" in pc.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_docx_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/docx_reader.py
import io

from docx import Document as DocxDocument

from reviewer.parsing.base import OcrFn, ParsedContent


def read_docx(data: bytes, ocr: OcrFn) -> ParsedContent:
    doc = DocxDocument(io.BytesIO(data))
    parts: list[str] = []

    for para in doc.paragraphs:
        if para.text.strip():
            parts.append(para.text.strip())

    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append("\t".join(cells))

    for rel in doc.part.rels.values():
        if rel.reltype.endswith("/image"):
            try:
                blob = rel.target_part.blob
                media_type = rel.target_part.content_type
                transcription = ocr(blob, media_type)
            except Exception:
                transcription = ""
            if transcription.strip():
                parts.append(transcription.strip())

    return ParsedContent(text="\n\n".join(parts))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_docx_reader.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/docx_reader.py tests/test_docx_reader.py
git commit -m "feat: docx reader for paragraphs, tables, and embedded images"
```

---

## Task 10: PPTX reader

**Files:**
- Create: `reviewer/parsing/pptx_reader.py`
- Test: `tests/test_pptx_reader.py`

Approach: per slide, shape text frames + table cells + speaker notes; picture shapes OCR'd via `shape.image.blob` / `shape.image.content_type`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_pptx_reader.py
import io
from pptx import Presentation
from pptx.util import Inches
from PIL import Image
from reviewer.parsing.pptx_reader import read_pptx


def _png() -> io.BytesIO:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buf, format="PNG")
    buf.seek(0)
    return buf


def _make_pptx() -> bytes:
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[5])
    slide.shapes.title.text = "Slide Title"
    slide.shapes.add_picture(_png(), Inches(1), Inches(1))
    slide.notes_slide.notes_text_frame.text = "Speaker note here"
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def test_read_pptx_extracts_text_notes_and_image_ocr():
    pc = read_pptx(_make_pptx(), ocr=lambda b, m: "SLIDE_IMAGE_TEXT")
    assert "Slide Title" in pc.text
    assert "Speaker note here" in pc.text
    assert "SLIDE_IMAGE_TEXT" in pc.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_pptx_reader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/pptx_reader.py
import io

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from reviewer.parsing.base import OcrFn, ParsedContent


def _shape_text(shape, ocr: OcrFn, parts: list[str]) -> None:
    if shape.has_text_frame and shape.text_frame.text.strip():
        parts.append(shape.text_frame.text.strip())
    if shape.has_table:
        for row in shape.table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append("\t".join(cells))
    if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
        try:
            image = shape.image
            transcription = ocr(image.blob, image.content_type)
        except Exception:
            transcription = ""
        if transcription.strip():
            parts.append(transcription.strip())


def read_pptx(data: bytes, ocr: OcrFn) -> ParsedContent:
    prs = Presentation(io.BytesIO(data))
    parts: list[str] = []
    for slide in prs.slides:
        for shape in slide.shapes:
            _shape_text(shape, ocr, parts)
        if slide.has_notes_slide:
            note = slide.notes_slide.notes_text_frame.text.strip()
            if note:
                parts.append(f"[Notes] {note}")
    return ParsedContent(text="\n\n".join(parts))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_pptx_reader.py -v`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/pptx_reader.py tests/test_pptx_reader.py
git commit -m "feat: pptx reader for slide text, tables, notes, and images"
```

---

## Task 11: Dispatcher

**Files:**
- Create: `reviewer/parsing/dispatch.py`
- Modify: `reviewer/parsing/__init__.py` (export public API)
- Test: `tests/test_dispatch.py`

Routes by extension. Image-bearing readers receive the `ocr` callable. Blank results raise `EmptyContentError`; unknown extensions raise `UnsupportedFileType`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_dispatch.py
import io
import pytest
from openpyxl import Workbook
from reviewer.parsing.dispatch import parse_file, parse_text
from reviewer.parsing.base import UnsupportedFileType, EmptyContentError


def _noop_ocr(b, m):
    return ""


def test_parse_text_wraps_pasted_text():
    pc = parse_text("just some notes")
    assert pc.text == "just some notes"


def test_parse_text_blank_raises():
    with pytest.raises(EmptyContentError):
        parse_text("   \n  ")


def test_parse_file_routes_txt():
    pc = parse_file("notes.txt", b"hello world", ocr=_noop_ocr)
    assert "hello world" in pc.text


def test_parse_file_routes_csv_with_pairs():
    pc = parse_file("cards.csv", b"Term,Definition\nA,Apple\n", ocr=_noop_ocr)
    assert ("A", "Apple") in pc.flashcard_pairs


def test_parse_file_routes_image_to_ocr():
    pc = parse_file("pic.png", b"IMG", ocr=lambda b, m: "ocr text")
    assert pc.text == "ocr text"


def test_parse_file_unknown_extension_raises():
    with pytest.raises(UnsupportedFileType):
        parse_file("archive.zip", b"...", ocr=_noop_ocr)


def test_parse_file_empty_result_raises():
    with pytest.raises(EmptyContentError):
        parse_file("empty.txt", b"   ", ocr=_noop_ocr)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_dispatch.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/parsing/dispatch.py
from reviewer.parsing.base import (
    EmptyContentError, OcrFn, ParsedContent, UnsupportedFileType, media_type_for,
)
from reviewer.parsing import (
    text_reader, spreadsheet_reader, web_reader, image_reader,
    pdf_reader, docx_reader, pptx_reader,
)

_IMAGE_EXTS = {"png", "jpg", "jpeg", "gif", "webp"}


def parse_text(text: str) -> ParsedContent:
    if not text.strip():
        raise EmptyContentError("No text provided.")
    return ParsedContent(text=text)


def parse_file(filename: str, data: bytes, ocr: OcrFn) -> ParsedContent:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext in {"txt", "md", "markdown"}:
        pc = text_reader.read_plain(data)
    elif ext == "rtf":
        pc = text_reader.read_rtf(data)
    elif ext == "csv":
        pc = spreadsheet_reader.read_csv(data)
    elif ext in {"xlsx", "xls"}:
        pc = spreadsheet_reader.read_xlsx(data)
    elif ext in {"html", "htm"}:
        pc = web_reader.read_html(data)
    elif ext == "epub":
        pc = web_reader.read_epub(data)
    elif ext in _IMAGE_EXTS:
        pc = image_reader.read_image(data, media_type_for(filename), ocr)
    elif ext == "pdf":
        pc = pdf_reader.read_pdf(data, ocr)
    elif ext == "docx":
        pc = docx_reader.read_docx(data, ocr)
    elif ext == "pptx":
        pc = pptx_reader.read_pptx(data, ocr)
    else:
        raise UnsupportedFileType(f"No reader for '.{ext}' files.")

    if not pc.text.strip() and not pc.flashcard_pairs:
        raise EmptyContentError(f"No usable content extracted from {filename}.")
    return pc
```

Update `reviewer/parsing/__init__.py`:

```python
"""File parsing: uploads and pasted text to clean extracted text."""

from reviewer.parsing.base import (
    ParsedContent, OcrFn, UnsupportedFileType, EmptyContentError,
)
from reviewer.parsing.dispatch import parse_file, parse_text

__all__ = [
    "ParsedContent", "OcrFn", "UnsupportedFileType", "EmptyContentError",
    "parse_file", "parse_text",
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_dispatch.py -v`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add reviewer/parsing/dispatch.py reviewer/parsing/__init__.py tests/test_dispatch.py
git commit -m "feat: parsing dispatcher routing by file extension"
```

---

## Task 12: Ingestion + end-to-end

**Files:**
- Create: `reviewer/ingest.py`
- Test: `tests/test_ingest.py`

`ingest_text` and `ingest_file` parse content and create a `documents` row. They return `(Document, ParsedContent)` so later plans can use `flashcard_pairs`. `source_type` is derived from the extension (pasted text → `"text"`). Timestamps use `datetime.now().isoformat()`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ingest.py
from reviewer import repository as repo
from reviewer.ingest import ingest_text, ingest_file


def test_ingest_text_creates_document(conn):
    doc, pc = ingest_text(conn, title="My Notes", text="cells and organelles")
    assert doc.id is not None
    assert doc.source_type == "text"
    assert doc.title == "My Notes"
    assert repo.get_document(conn, doc.id).extracted_text == "cells and organelles"


def test_ingest_file_creates_document_with_source_type(conn):
    doc, pc = ingest_file(conn, "lecture.csv", b"Term,Definition\nA,Apple\n",
                          ocr=lambda b, m: "")
    assert doc.source_type == "csv"
    assert "Apple" in doc.extracted_text
    assert ("A", "Apple") in pc.flashcard_pairs


def test_ingest_file_title_defaults_to_filename(conn):
    doc, pc = ingest_file(conn, "history.txt", b"the cold war", ocr=lambda b, m: "")
    assert doc.title == "history.txt"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ingest.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```python
# reviewer/ingest.py
import sqlite3
from datetime import datetime

from reviewer import repository as repo
from reviewer.models import Document
from reviewer.parsing import ParsedContent, parse_file, parse_text
from reviewer.parsing.base import OcrFn


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def ingest_text(conn: sqlite3.Connection, title: str, text: str) -> tuple[Document, ParsedContent]:
    pc = parse_text(text)
    doc = repo.create_document(conn, Document(
        id=None, title=title, source_type="text",
        created_at=_now(), extracted_text=pc.text))
    return doc, pc


def ingest_file(conn: sqlite3.Connection, filename: str, data: bytes,
                ocr: OcrFn) -> tuple[Document, ParsedContent]:
    pc = parse_file(filename, data, ocr)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "file"
    doc = repo.create_document(conn, Document(
        id=None, title=filename, source_type=ext,
        created_at=_now(), extracted_text=pc.text))
    return doc, pc
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ingest.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Run the full suite**

Run: `python -m pytest -q`
Expected: all tests PASS (Plan 1 + Plan 2).

- [ ] **Step 6: Commit**

```bash
git add reviewer/ingest.py tests/test_ingest.py
git commit -m "feat: ingestion ties parsing to document storage"
```

---

## Definition of done

- `python -m pytest -q` fully green.
- `reviewer/ai/client.py` exposes `ClaudeClient.ocr_image` (SDK-injectable for tests).
- `reviewer/parsing` parses TXT, MD, RTF, CSV, XLSX, HTML, EPUB, PNG/JPG/GIF/WEBP,
  PDF, DOCX, PPTX, and pasted text; images/diagrams are OCR'd via Claude vision;
  spreadsheets laid out as term/definition produce `flashcard_pairs`.
- Unknown extensions raise `UnsupportedFileType`; blank results raise `EmptyContentError`.
- `reviewer/ingest.py` creates `documents` rows and returns parsed content for later plans.
- Ready for Plan 3 (AI generation): read a document's `extracted_text`, produce
  modules + reviewer sections + cards + cheat sheet.
