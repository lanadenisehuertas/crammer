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
