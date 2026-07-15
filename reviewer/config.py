import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # reads .env if present; no error if absent


class ConfigError(Exception):
    """Raised when required configuration is missing or invalid."""


@dataclass(frozen=True)
class Config:
    anthropic_api_key: str
    db_path: str


def load_config() -> Config:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ConfigError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    db_path = os.environ.get("REVIEWER_DB_PATH") or "reviewer.sqlite3"
    return Config(anthropic_api_key=api_key, db_path=db_path)
