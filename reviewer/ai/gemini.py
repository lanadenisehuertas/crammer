import base64

import httpx

from reviewer.ai.errors import AIProviderError
from reviewer.ai.prompts import OCR_INSTRUCTION

_BLOCKED_MESSAGE = (
    "Gemini returned no text (the content may have been blocked). Try again or "
    "rephrase."
)
_RATE_LIMIT_MESSAGE = (
    "Gemini's free-tier limit was hit. Wait a minute and try again (free tier "
    "allows a limited number of requests per minute/day)."
)
_KEY_REJECTED_MESSAGE = (
    "Your Gemini API key was rejected. Check GEMINI_API_KEY in your .env file "
    "(get a free key at aistudio.google.com)."
)
_CONNECTION_MESSAGE = "Couldn't reach the Gemini API. Check your internet connection."


class GeminiClient:
    """Thin wrapper over the Gemini REST API for the reviewer app.

    Talks directly to the generateContent REST endpoint over httpx rather than
    pulling in the google-genai SDK, keeping the dependency footprint small.
    """

    def __init__(self, api_key: str, model: str, transport=None):
        # `transport` lets tests inject an httpx.MockTransport; production
        # leaves it None so httpx.Client uses the real network transport.
        self._api_key = api_key
        self._model = model
        self._http = httpx.Client(
            base_url="https://generativelanguage.googleapis.com",
            timeout=120.0,
            transport=transport,
        )

    def ocr_image(self, image_bytes: bytes, media_type: str) -> str:
        """Return the text Gemini reads from an image."""
        data = base64.standard_b64encode(image_bytes).decode("utf-8")
        contents = [{
            "role": "user",
            "parts": [
                {"inline_data": {"mime_type": media_type, "data": data}},
                {"text": OCR_INSTRUCTION},
            ],
        }]
        return self._generate(contents, max_tokens=4000)

    def generate_text(self, system: str, user: str, max_tokens: int = 16000) -> str:
        """Return Gemini's text response to a system + user prompt."""
        contents = [{"role": "user", "parts": [{"text": user}]}]
        return self._generate(contents, max_tokens=max_tokens, system=system)

    def _generate(self, contents: list, max_tokens: int, system: str | None = None) -> str:
        body = {
            "contents": contents,
            "generationConfig": {"maxOutputTokens": max_tokens},
        }
        if system is not None:
            body["system_instruction"] = {"parts": [{"text": system}]}

        try:
            response = self._http.post(
                f"/v1beta/models/{self._model}:generateContent",
                headers={"x-goog-api-key": self._api_key},
                json=body,
            )
        except (httpx.ConnectError, httpx.TimeoutException):
            raise AIProviderError(_CONNECTION_MESSAGE)

        if response.status_code == 429:
            raise AIProviderError(_RATE_LIMIT_MESSAGE)
        if response.status_code in (400, 401, 403):
            raise AIProviderError(_KEY_REJECTED_MESSAGE)
        if response.status_code >= 400:
            raise AIProviderError(
                f"The Gemini API returned an error: {response.text[:300]}")

        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise AIProviderError(_BLOCKED_MESSAGE)
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            raise AIProviderError(_BLOCKED_MESSAGE)
        return text
