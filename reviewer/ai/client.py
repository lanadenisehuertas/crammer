import base64

import anthropic

from reviewer.ai.prompts import OCR_INSTRUCTION


def _text_from(message) -> str:
    """Concatenate and strip the text blocks of a Claude message response."""
    return "".join(b.text for b in message.content if b.type == "text").strip()


class ClaudeClient:
    """Thin wrapper over the Anthropic SDK for the reviewer app."""

    def __init__(self, api_key: str, model: str, sdk=None):
        # `sdk` lets tests inject a fake; production uses the real client.
        self._client = sdk or anthropic.Anthropic(api_key=api_key)
        self._model = model

    def ocr_image(self, image_bytes: bytes, media_type: str) -> str:
        """Return the text Claude reads from an image."""
        data = base64.standard_b64encode(image_bytes).decode("utf-8")
        message = self._client.messages.create(
            model=self._model,
            max_tokens=4000,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": media_type, "data": data}},
                    {"type": "text", "text": OCR_INSTRUCTION},
                ],
            }],
        )
        return _text_from(message)

    def generate_text(self, system: str, user: str, max_tokens: int = 16000) -> str:
        """Return Claude's text response to a system + user prompt."""
        message = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return _text_from(message)
