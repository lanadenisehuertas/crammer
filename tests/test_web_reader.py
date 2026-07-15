from reviewer.parsing.web_reader import read_html


def test_read_html_extracts_visible_text_only():
    html = b"""<html><head><style>.x{color:red}</style>
    <script>var a=1;</script></head>
    <body><h1>Title</h1><p>Body text here.</p></body></html>"""
    pc = read_html(html)
    assert "Title" in pc.text
    assert "Body text here." in pc.text
    assert "color:red" not in pc.text
    assert "var a=1" not in pc.text
