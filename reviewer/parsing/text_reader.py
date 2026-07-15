from striprtf.striprtf import rtf_to_text

from reviewer.parsing.base import ParsedContent


def read_plain(data: bytes) -> ParsedContent:
    """Decode TXT/Markdown bytes as UTF-8 (lenient)."""
    return ParsedContent(text=data.decode("utf-8", errors="replace"))


def read_rtf(data: bytes) -> ParsedContent:
    """Extract plain text from RTF."""
    return ParsedContent(text=rtf_to_text(data.decode("utf-8", errors="replace")))
