from reviewer.parsing.base import OcrFn, ParsedContent


def read_image(data: bytes, media_type: str, ocr: OcrFn) -> ParsedContent:
    """OCR a standalone image file.

    Unlike the embedded-image readers (pdf/docx/pptx), a standalone image IS the
    whole document, so an OCR failure is allowed to propagate to the caller rather
    than being swallowed — there is no surrounding text to fall back to.
    """
    return ParsedContent(text=ocr(data, media_type))
