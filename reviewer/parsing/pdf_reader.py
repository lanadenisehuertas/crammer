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
