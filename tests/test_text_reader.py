from reviewer.parsing.text_reader import read_plain, read_rtf


def test_read_plain_decodes_utf8():
    pc = read_plain("Hello — world\nline two".encode("utf-8"))
    assert "Hello — world" in pc.text
    assert "line two" in pc.text
    assert pc.flashcard_pairs == []


def test_read_rtf_strips_control_words():
    rtf = rb"{\rtf1\ansi Hello \b bold\b0 world}"
    pc = read_rtf(rtf)
    assert "Hello" in pc.text
    assert "bold" in pc.text
    assert "\\rtf1" not in pc.text
