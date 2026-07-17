import base64
import json

import httpx
import pytest

from reviewer.ai.errors import AIProviderError
from reviewer.ai.gemini import GeminiClient


def _ok_response(text="GENERATED TEXT"):
    return httpx.Response(200, json={
        "candidates": [{"content": {"parts": [{"text": text}]}}],
    })


def test_generate_text_sends_system_and_user_and_returns_text():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        captured["body"] = json.loads(request.content)
        return _ok_response("Hello from Gemini")

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    out = client.generate_text(system="SYS", user="USER", max_tokens=1234)

    assert out == "Hello from Gemini"
    req = captured["request"]
    assert req.url.path == "/v1beta/models/gemini-2.5-flash:generateContent"
    assert req.headers["x-goog-api-key"] == "test-key"
    body = captured["body"]
    assert body["system_instruction"] == {"parts": [{"text": "SYS"}]}
    assert body["contents"] == [{"role": "user", "parts": [{"text": "USER"}]}]
    assert body["generationConfig"]["maxOutputTokens"] == 1234


def test_ocr_image_sends_inline_data_and_returns_text():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return _ok_response("TRANSCRIBED TEXT")

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    result = client.ocr_image(b"\x89PNG-bytes", "image/png")

    assert result == "TRANSCRIBED TEXT"
    body = captured["body"]
    assert "system_instruction" not in body
    parts = body["contents"][0]["parts"]
    image_part = next(p for p in parts if "inline_data" in p)
    assert image_part["inline_data"]["mime_type"] == "image/png"
    assert image_part["inline_data"]["data"] == base64.standard_b64encode(
        b"\x89PNG-bytes").decode("utf-8")
    text_part = next(p for p in parts if "text" in p)
    assert "Transcribe" in text_part["text"]


def test_response_parsing_joins_multiple_text_parts():
    def handler(request):
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": [
                {"text": "Hello "}, {"text": "world"},
            ]}}],
        })

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    assert client.generate_text(system="SYS", user="USER") == "Hello world"


def test_rate_limit_429_raises_free_tier_error():
    def handler(request):
        return httpx.Response(429, json={"error": {"message": "rate limited"}})

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "free-tier" in str(exc_info.value)


@pytest.mark.parametrize("status", [400, 401, 403])
def test_key_rejected_statuses_raise_friendly_error(status):
    def handler(request):
        return httpx.Response(status, json={"error": {"message": "bad key"}})

    client = GeminiClient(api_key="bad-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "API key was rejected" in str(exc_info.value)
    assert "aistudio.google.com" in str(exc_info.value)


def test_other_error_status_includes_body():
    def handler(request):
        return httpx.Response(500, text="Internal server explosion")

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "Gemini API returned an error" in str(exc_info.value)
    assert "Internal server explosion" in str(exc_info.value)


def test_no_candidates_raises_blocked_message():
    def handler(request):
        return httpx.Response(200, json={"candidates": []})

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "blocked" in str(exc_info.value)


def test_empty_parts_raises_blocked_message():
    def handler(request):
        return httpx.Response(200, json={
            "candidates": [{"content": {"parts": []}}],
        })

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "blocked" in str(exc_info.value)


def test_connect_error_raises_friendly_message():
    def handler(request):
        raise httpx.ConnectError("boom", request=request)

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "internet connection" in str(exc_info.value)


def test_timeout_error_raises_friendly_message():
    def handler(request):
        raise httpx.TimeoutException("timed out", request=request)

    client = GeminiClient(api_key="test-key", model="gemini-2.5-flash",
                          transport=httpx.MockTransport(handler))
    with pytest.raises(AIProviderError) as exc_info:
        client.generate_text(system="SYS", user="USER")
    assert "internet connection" in str(exc_info.value)
