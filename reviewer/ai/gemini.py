import base64
import re
import time

import httpx

_EXCLUDED_MODEL_HINTS = (
    "preview", "exp", "image", "live", "tts", "audio", "embedding", "thinking")

from reviewer.ai.errors import AIProviderError
from reviewer.ai.prompts import OCR_INSTRUCTION

_BLOCKED_MESSAGE = (
    "Gemini returned no text (the content may have been blocked). Try again or "
    "rephrase."
)
_RATE_LIMIT_MESSAGE = (
    "Gemini's free-tier limit was hit even after retrying. {reason} "
    "If this happens on your very first request, the key's project may have no "
    "free quota for this model - try REVIEWER_GEMINI_MODEL=gemini-2.5-flash-lite "
    "in your .env, or wait and try again."
)
_MAX_RATE_LIMIT_RETRIES = 2  # 3 attempts total
_DEFAULT_RETRY_SECONDS = 30.0
_KEY_REJECTED_MESSAGE = (
    "Your Gemini API key was rejected. Check GEMINI_API_KEY in your .env file "
    "(get a free key at aistudio.google.com)."
)
_CONNECTION_MESSAGE = "Couldn't reach the Gemini API. Check your internet connection."


def _retry_delay_seconds(response: httpx.Response) -> float:
    """Seconds to wait before retrying a 429, honoring Google's RetryInfo hint."""
    try:
        details = response.json().get("error", {}).get("details", [])
        for detail in details:
            if str(detail.get("@type", "")).endswith("RetryInfo"):
                match = re.match(r"(\d+(?:\.\d+)?)s", str(detail.get("retryDelay", "")))
                if match:
                    return min(float(match.group(1)) + 1.0, 120.0)
    except Exception:
        pass
    return _DEFAULT_RETRY_SECONDS


def _model_version(name: str) -> float:
    """Numeric version from a model name like gemini-3-flash / gemini-2.5-flash."""
    match = re.search(r"gemini-(\d+(?:\.\d+)?)", name)
    return float(match.group(1)) if match else 0.0


def _pick_fallback_model(available: list[str]) -> str | None:
    """Best general-purpose model for reviewer generation: prefer stable
    'flash' models (fast + free-tier friendly), highest version first, plain
    flash over flash-lite."""
    def stable(names):
        return [n for n in names
                if not any(h in n for h in _EXCLUDED_MODEL_HINTS)]

    flash = stable([n for n in available if "flash" in n])
    if flash:
        return max(flash, key=lambda n: (_model_version(n), "lite" not in n))
    gemini = stable([n for n in available if n.startswith("gemini")])
    if gemini:
        return max(gemini, key=_model_version)
    return None


def _quota_reason(response: httpx.Response) -> str:
    """Google's own explanation of which quota was exceeded, if it sent one."""
    try:
        message = response.json().get("error", {}).get("message", "")
        return f"Google says: {message[:300]}" if message else ""
    except Exception:
        return ""


class GeminiClient:
    """Thin wrapper over the Gemini REST API for the reviewer app.

    Talks directly to the generateContent REST endpoint over httpx rather than
    pulling in the google-genai SDK, keeping the dependency footprint small.
    """

    def __init__(self, api_key: str, model: str, transport=None, sleep=time.sleep):
        # `transport` lets tests inject an httpx.MockTransport; `sleep` lets
        # tests skip real waiting. Production leaves both at their defaults.
        self._api_key = api_key
        self._model = model
        self._sleep = sleep
        self._model_fallback_tried = False
        self._http = httpx.Client(
            base_url="https://generativelanguage.googleapis.com",
            timeout=120.0,
            transport=transport,
        )

    def _list_available_models(self) -> list[str]:
        """Model names this key can call with generateContent (best-effort)."""
        try:
            response = self._http.get(
                "/v1beta/models",
                params={"pageSize": 1000},
                headers={"x-goog-api-key": self._api_key},
            )
            if response.status_code != 200:
                return []
            names = []
            for model in response.json().get("models", []):
                methods = model.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    names.append(str(model.get("name", "")).removeprefix("models/"))
            return [n for n in names if n]
        except httpx.HTTPError:
            return []

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

        for attempt in range(_MAX_RATE_LIMIT_RETRIES + 1):
            try:
                response = self._http.post(
                    f"/v1beta/models/{self._model}:generateContent",
                    headers={"x-goog-api-key": self._api_key},
                    json=body,
                )
            except (httpx.ConnectError, httpx.TimeoutException):
                raise AIProviderError(_CONNECTION_MESSAGE)
            if response.status_code != 429:
                break
            # Rate-limited: wait (using Google's own retry hint when present)
            # and try again, so a per-minute blip becomes a slower success.
            if attempt < _MAX_RATE_LIMIT_RETRIES:
                self._sleep(_retry_delay_seconds(response))

        if response.status_code == 429:
            raise AIProviderError(
                _RATE_LIMIT_MESSAGE.format(reason=_quota_reason(response)))
        if response.status_code == 404 and not self._model_fallback_tried:
            # The configured model isn't available to this key (Google retires
            # older model names for new accounts). Discover what IS available,
            # switch to the best flash-style model, and retry once.
            self._model_fallback_tried = True
            available = self._list_available_models()
            fallback = _pick_fallback_model(available)
            if fallback and fallback != self._model:
                print(f"Gemini model '{self._model}' unavailable for this key; "
                      f"switching to '{fallback}'.")
                self._model = fallback
                return self._generate(contents, max_tokens, system)
            shown = ", ".join(available[:8]) or "none found"
            raise AIProviderError(
                f"The Gemini model '{self._model}' isn't available to your key, "
                f"and no automatic replacement was found. Models your key can "
                f"use: {shown}. Set REVIEWER_GEMINI_MODEL in your .env to one "
                f"of them.")
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
