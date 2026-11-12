import base64

from fastapi.testclient import TestClient

from backend.app.main import criar_app
from backend.app.session_service import Sessao


def test_hospedagem_serve_dashboard_e_exige_senha(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<title>prevLoss</title>", encoding="utf-8")
    monkeypatch.setenv("PREVLOSS_STATIC_DIR", str(tmp_path))
    monkeypatch.setenv("PREVLOSS_REQUIRE_AUTH", "1")
    monkeypatch.setenv("PREVLOSS_ACCESS_PASSWORD", "segredo-de-teste")
    token = base64.b64encode(b"prevloss:segredo-de-teste").decode("ascii")

    with TestClient(criar_app(Sessao(), gerar=False)) as client:
        assert client.get("/api/saude").status_code == 200
        assert client.get("/").status_code == 401
        assert client.get("/api/estado").status_code == 401
        assert client.get("/", headers={"Authorization": "Basic !!!"}).status_code == 401
        assert client.get("/", headers={"Authorization": f"Basic {token}"}).text == "<title>prevLoss</title>"
        assert client.get("/api/estado", headers={"Authorization": f"Basic {token}"}).status_code == 200
        assert client.post("/api/iniciar", json={}, headers={"Authorization": f"Basic {token}"}).status_code == 200
