import pytest
from reviewer.config import load_config, ConfigError


def test_load_config_reads_api_key_and_default_db_path(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("REVIEWER_DB_PATH", raising=False)
    cfg = load_config()
    assert cfg.anthropic_api_key == "sk-ant-test"
    assert cfg.db_path == "reviewer.sqlite3"


def test_load_config_uses_custom_db_path(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_DB_PATH", "/tmp/custom.sqlite3")
    cfg = load_config()
    assert cfg.db_path == "/tmp/custom.sqlite3"


def test_load_config_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ConfigError):
        load_config()


def test_load_config_default_model(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("REVIEWER_MODEL", raising=False)
    assert load_config().model == "claude-opus-4-7"


def test_load_config_custom_model(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_MODEL", "claude-haiku-4-5")
    assert load_config().model == "claude-haiku-4-5"
