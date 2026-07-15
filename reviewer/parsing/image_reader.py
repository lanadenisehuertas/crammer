from reviewer.parsing.base import OcrFn, ParsedContent


def read_image(data: bytes, media_type: str, ocr: OcrFn) -> ParsedContent:
    """OCR a standalone image file."""
    return ParsedContent(text=ocr(data, media_type))
