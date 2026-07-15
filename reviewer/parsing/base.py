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
