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
