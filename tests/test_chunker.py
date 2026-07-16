from reviewer.generation.chunker import chunk_text


def test_short_text_is_one_chunk():
    assert chunk_text("hello world", max_chars=100) == ["hello world"]


def test_empty_text_is_no_chunks():
    assert chunk_text("   ", max_chars=100) == []


def test_splits_on_paragraph_boundaries():
    text = "A" * 40 + "\n\n" + "B" * 40
    chunks = chunk_text(text, max_chars=50)
    assert len(chunks) == 2
    assert chunks[0] == "A" * 40
    assert chunks[1] == "B" * 40


def test_hard_splits_oversized_paragraph():
    chunks = chunk_text("X" * 120, max_chars=50)
    assert len(chunks) == 3
    assert all(len(c) <= 50 for c in chunks)
    assert "".join(chunks) == "X" * 120
