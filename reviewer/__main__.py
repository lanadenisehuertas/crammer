"""Run the Crammer web app: python -m reviewer"""
import uvicorn

from reviewer.ai.client import ClaudeClient
from reviewer.config import load_config
from reviewer.db import connect
from reviewer.web.app import create_app


def main() -> None:
    config = load_config()
    client = ClaudeClient(api_key=config.anthropic_api_key, model=config.model)

    def conn_factory():
        return connect(config.db_path, check_same_thread=False)

    app = create_app(conn_factory, client)
    print("Crammer running at http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
