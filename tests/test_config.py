import pytest
from reviewer.config import load_config, ConfigError


def _clear_ai_env(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("REVIEWER_PROVIDER", raising=False)
    monkeypatch.delenv("REVIEWER_MODEL", raising=False)
    monkeypatch.delenv("REVIEWER_GEMINI_MODEL", raising=False)
    monkeypatch.delenv("REVIEWER_DB_PATH", raising=False)


def test_load_config_reads_api_key_and_default_db_path(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    cfg = load_config()
    assert cfg.anthropic_api_key == "sk-ant-test"
    assert cfg.db_path == "reviewer.sqlite3"
    assert cfg.provider == "claude"


def test_load_config_uses_custom_db_path(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_DB_PATH", "/tmp/custom.sqlite3")
    cfg = load_config()
    assert cfg.db_path == "/tmp/custom.sqlite3"


def test_load_config_missing_api_key_raises(monkeypatch):
    _clear_ai_env(monkeypatch)
    with pytest.raises(ConfigError):
        load_config()


def test_load_config_missing_key_message_mentions_both_providers(monkeypatch):
    _clear_ai_env(monkeypatch)
    with pytest.raises(ConfigError) as exc_info:
        load_config()
    message = str(exc_info.value)
    assert "ANTHROPIC_API_KEY" in message
    assert "GEMINI_API_KEY" in message
    assert "aistudio.google.com" in message


def test_load_config_default_model(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    assert load_config().model == "claude-opus-4-7"


def test_load_config_custom_model(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_MODEL", "claude-haiku-4-5")
    assert load_config().model == "claude-haiku-4-5"


# --- provider selection ------------------------------------------------

def test_gemini_only_env_selects_gemini(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test-key")
    cfg = load_config()
    assert cfg.provider == "gemini"
    assert cfg.gemini_api_key == "gemini-test-key"


def test_gemini_default_model(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test-key")
    assert load_config().gemini_model == "gemini-2.5-flash"


def test_gemini_custom_model(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test-key")
    monkeypatch.setenv("REVIEWER_GEMINI_MODEL", "gemini-2.5-pro")
    assert load_config().gemini_model == "gemini-2.5-pro"


def test_explicit_provider_wins_over_available_keys(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test-key")
    monkeypatch.setenv("REVIEWER_PROVIDER", "gemini")
    cfg = load_config()
    assert cfg.provider == "gemini"


def test_unknown_provider_raises_config_error(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("REVIEWER_PROVIDER", "openai")
    with pytest.raises(ConfigError) as exc_info:
        load_config()
    message = str(exc_info.value)
    assert "claude" in message
    assert "gemini" in message


def test_gemini_selected_without_key_raises(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("REVIEWER_PROVIDER", "gemini")
    with pytest.raises(ConfigError) as exc_info:
        load_config()
    assert "GEMINI_API_KEY" in str(exc_info.value)


def test_claude_selected_without_key_raises(monkeypatch):
    _clear_ai_env(monkeypatch)
    monkeypatch.setenv("REVIEWER_PROVIDER", "claude")
    with pytest.raises(ConfigError) as exc_info:
        load_config()
    assert "ANTHROPIC_API_KEY" in str(exc_info.value)
