import io
from openpyxl import Workbook
from reviewer.parsing.spreadsheet_reader import read_csv, read_xlsx


def test_read_csv_two_columns_makes_pairs():
    csv_bytes = b"Term,Definition\nMitochondria,Powerhouse of the cell\nOsmosis,Water diffusion\n"
    pc = read_csv(csv_bytes)
    assert ("Mitochondria", "Powerhouse of the cell") in pc.flashcard_pairs
    assert ("Osmosis", "Water diffusion") in pc.flashcard_pairs
    assert "Mitochondria" in pc.text  # text still produced


def test_read_csv_multi_column_has_no_pairs():
    csv_bytes = b"a,b,c\n1,2,3\n4,5,6\n"
    pc = read_csv(csv_bytes)
    assert pc.flashcard_pairs == []
    assert "1" in pc.text and "3" in pc.text


def test_read_xlsx_two_columns_makes_pairs():
    wb = Workbook()
    ws = wb.active
    ws.append(["Term", "Definition"])
    ws.append(["Photosynthesis", "Converting light to energy"])
    buf = io.BytesIO()
    wb.save(buf)
    pc = read_xlsx(buf.getvalue())
    assert ("Photosynthesis", "Converting light to energy") in pc.flashcard_pairs
