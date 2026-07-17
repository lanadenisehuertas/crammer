import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # reads .env if present; no error if absent


class ConfigError(Exception):
    """Raised when required configuration is missing or invalid."""


_VALID_PROVIDERS = ("claude", "gemini")


@dataclass(frozen=True)
class Config:
    provider: str
    anthropic_api_key: str
    gemini_api_key: str
    db_path: str
    model: str
    gemini_model: str


def _select_provider(anthropic_key: str, gemini_key: str) -> str:
    provider_env = os.environ.get("REVIEWER_PROVIDER")
    if provider_env:
        provider = provider_env.strip().lower()
        if provider not in _VALID_PROVIDERS:
            raise ConfigError(
                f"Unknown REVIEWER_PROVIDER '{provider_env}'. Valid options are "
                "'claude' or 'gemini'."
            )
        return provider
    if anthropic_key:
        return "claude"
    if gemini_key:
        return "gemini"
    raise ConfigError(
        "No AI key found. Either set ANTHROPIC_API_KEY (paid, Claude) or "
        "GEMINI_API_KEY (free tier — get one at aistudio.google.com) in your "
        ".env file."
    )


def load_config() -> Config:
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY") or ""
    gemini_key = os.environ.get("GEMINI_API_KEY") or ""

    provider = _select_provider(anthropic_key, gemini_key)

    if provider == "claude" and not anthropic_key:
        raise ConfigError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    if provider == "gemini" and not gemini_key:
        raise ConfigError(
            "GEMINI_API_KEY is not set. Copy .env.example to .env and add your free "
            "key from aistudio.google.com."
        )

    db_path = os.environ.get("REVIEWER_DB_PATH") or "reviewer.sqlite3"
    model = os.environ.get("REVIEWER_MODEL") or "claude-opus-4-7"
    gemini_model = os.environ.get("REVIEWER_GEMINI_MODEL") or "gemini-2.5-flash"

    return Config(
        provider=provider,
        anthropic_api_key=anthropic_key,
        gemini_api_key=gemini_key,
        db_path=db_path,
        model=model,
        gemini_model=gemini_model,
    )
