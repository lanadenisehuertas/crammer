import csv
import io

from openpyxl import load_workbook

from reviewer.parsing.base import ParsedContent

_HEADER_TERMS = {"term", "terms", "word", "front", "question"}
_HEADER_DEFS = {"definition", "definitions", "meaning", "back", "answer"}


def _rows_to_content(rows: list[list[str]]) -> ParsedContent:
    rows = [[(c or "").strip() for c in row] for row in rows if any((c or "").strip() for c in row)]
    text = "\n".join("\t".join(row) for row in rows)

    pairs: list[tuple[str, str]] = []
    if rows and all(len(row) == 2 for row in rows):
        data_rows = rows
        first = rows[0]
        if first[0].lower() in _HEADER_TERMS and first[1].lower() in _HEADER_DEFS:
            data_rows = rows[1:]
        pairs = [(r[0], r[1]) for r in data_rows if r[0] and r[1]]
    return ParsedContent(text=text, flashcard_pairs=pairs)


def read_csv(data: bytes) -> ParsedContent:
    text = data.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    return _rows_to_content(rows)


def read_xlsx(data: bytes) -> ParsedContent:
    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    rows: list[list[str]] = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            rows.append(["" if v is None else str(v) for v in row])
    return _rows_to_content(rows)
