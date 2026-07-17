"""Run the Crammer web app: python -m reviewer"""
import sys
import threading
import webbrowser
from pathlib import Path

import uvicorn

from reviewer.ai.client import ClaudeClient
from reviewer.ai.gemini import GeminiClient
from reviewer.config import ConfigError, load_config
from reviewer.db import connect
from reviewer.web.app import create_app


def main() -> None:
    try:
        config = load_config()
    except ConfigError as exc:
        print(f"\n  Crammer can't start yet: {exc}\n")
        print("  1. Copy .env.example to .env in this folder")
        print("  2. Put an AI key in it: either ANTHROPIC_API_KEY (paid, Claude)")
        print("     or GEMINI_API_KEY (free tier — get one at aistudio.google.com)")
        print("  3. Run this again\n")
        sys.exit(1)

    if config.provider == "gemini":
        client = GeminiClient(api_key=config.gemini_api_key, model=config.gemini_model)
        provider_label = f"Gemini ({config.gemini_model})"
    else:
        client = ClaudeClient(api_key=config.anthropic_api_key, model=config.model)
        provider_label = f"Claude ({config.model})"

    def conn_factory():
        return connect(config.db_path, check_same_thread=False)

    app = create_app(conn_factory, client)

    # Land the user in the polished UI when it's built, else the classic pages.
    dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    url = "http://127.0.0.1:8000/app" if dist.is_dir() else "http://127.0.0.1:8000"
    print(f"Crammer running at {url}  (Ctrl+C to stop)  — using {provider_label}")
    threading.Timer(1.0, webbrowser.open, args=(url,)).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
