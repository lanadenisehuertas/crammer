from reviewer.parsing.image_reader import read_image


def test_read_image_calls_ocr_with_bytes_and_media_type():
    calls = []

    def fake_ocr(image_bytes, media_type):
        calls.append((image_bytes, media_type))
        return "text from image"

    pc = read_image(b"IMG", "image/png", ocr=fake_ocr)
    assert pc.text == "text from image"
    assert calls == [(b"IMG", "image/png")]
