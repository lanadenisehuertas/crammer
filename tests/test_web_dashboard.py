import pytest
from fastapi.testclient import TestClient
from reviewer.db import connect
from reviewer.web.app import create_app


class FakeClient:
    def ocr_image(self, image_bytes, media_type):
        return "ocr text"

    def generate_text(self, system, user, max_tokens=16000):
        # minimal valid reviewer JSON, then a cheat sheet
        if "cheat sheet" in system.lower():
            return "CHEAT"
        return '{"modules":[{"title":"T","sections":[],"cards":[]}]}'


@pytest.fixture
def client(tmp_path):
    db_path = str(tmp_path / "t.sqlite3")
    app = create_app(lambda: connect(db_path, check_same_thread=False), FakeClient())
    return TestClient(app)


def test_dashboard_loads_empty(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Crammer" in r.text  # app title in base template
