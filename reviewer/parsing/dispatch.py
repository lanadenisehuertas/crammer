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
