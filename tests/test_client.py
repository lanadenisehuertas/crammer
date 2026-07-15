import base64
from reviewer.ai.client import ClaudeClient


class _FakeBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class _FakeMessage:
    def __init__(self, text):
        self.content = [_FakeBlock(text)]


class _FakeMessages:
    def __init__(self, recorder):
        self._recorder = recorder

    def create(self, **kwargs):
        self._recorder["kwargs"] = kwargs
        return _FakeMessage("TRANSCRIBED TEXT")


class _FakeAnthropic:
    def __init__(self, recorder):
        self.messages = _FakeMessages(recorder)


def test_ocr_image_returns_text_and_sends_image_block():
    recorder = {}
    client = ClaudeClient(api_key="sk-ant-test", model="claude-opus-4-7",
                          sdk=_FakeAnthropic(recorder))
    result = client.ocr_image(b"\x89PNG-bytes", "image/png")
    assert result == "TRANSCRIBED TEXT"

    kwargs = recorder["kwargs"]
    assert kwargs["model"] == "claude-opus-4-7"
    content = kwargs["messages"][0]["content"]
    image_block = next(b for b in content if b["type"] == "image")
    assert image_block["source"]["media_type"] == "image/png"
    # image bytes must be base64-encoded
    assert image_block["source"]["data"] == base64.standard_b64encode(
        b"\x89PNG-bytes").decode("utf-8")
