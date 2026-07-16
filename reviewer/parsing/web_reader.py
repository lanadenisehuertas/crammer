import os
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
    try:
        book = epub.read_epub(tmp_path)
        parts = []
        for item in book.get_items_of_type(ITEM_DOCUMENT):
            parts.append(_html_to_text(item.get_content().decode("utf-8", errors="replace")))
    finally:
        os.unlink(tmp_path)
    return ParsedContent(text="\n\n".join(p for p in parts if p))
