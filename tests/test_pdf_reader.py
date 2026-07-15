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


def test_read_pdf_swallows_ocr_failure_and_keeps_text():
    # A failing OCR on an embedded image must not abort extraction of page text.
    def boom(b, m):
        raise RuntimeError("ocr down")

    pc = read_pdf(_make_pdf("Cell biology notes"), ocr=boom)
    assert "Cell biology notes" in pc.text
