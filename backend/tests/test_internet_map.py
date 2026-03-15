"""Unit tests for the /api/import/internet-map proxy endpoint.

Tests cover:
- Valid meshcore source with mocked msgpack response → 200, correct shape
- Nodes with missing/null/empty name are skipped (not "Unknown" — they're filtered)
- source=unknown → 400
- Missing source param → uses default (meshcore) — no 422 since default is set
- Backend httpx timeout → 503
- Backend httpx HTTP status error → 503
- Backend httpx request error → 503
- Msgpack decode error → 503
- Empty nodes list → 200, count=0
- Nodes missing lat/lon → filtered out
- Dict response with 'nodes' key → unwrapped correctly
"""

from __future__ import annotations

import msgpack
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch

from backend.app.api.internet_map import router

TEST_TOKEN = "test-token-internet-map"


def _create_test_app() -> FastAPI:
    """Minimal app with AuthMiddleware bypassed via test mode."""
    from backend.app.auth.middleware import AuthMiddleware

    app = FastAPI()
    app.add_middleware(AuthMiddleware, token=TEST_TOKEN)
    app.include_router(router, prefix="/api")
    return app


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {TEST_TOKEN}"}


def _pack(data) -> bytes:
    """Encode data as msgpack bytes."""
    return msgpack.packb(data, use_bin_type=True)


@pytest.fixture
def client(monkeypatch):
    """TestClient with MESH_PLANNER_TEST_TOKEN set so auth is in test mode."""
    monkeypatch.setenv("MESH_PLANNER_TEST_TOKEN", TEST_TOKEN)
    app = _create_test_app()
    return TestClient(app)


def _mock_httpx_response(body: bytes, status_code: int = 200):
    """Build a mock httpx Response object."""
    mock_resp = MagicMock()
    mock_resp.content = body
    mock_resp.status_code = status_code
    mock_resp.raise_for_status = MagicMock()  # no-op
    return mock_resp


# ============================================================================
# Valid meshcore response
# ============================================================================


class TestMeshcoreValidResponse:
    def test_valid_nodes_returns_200_with_shape(self, client):
        """Mocked valid msgpack list → 200, source/nodes/count keys present."""
        raw_nodes = [
            {"n": "Node Alpha", "lat": 25.7617, "lon": -80.1918, "t": 2},
            {"n": "Node Beta", "lat": 30.3322, "lon": -81.6557, "t": 1},
        ]
        packed = _pack(raw_nodes)

        mock_resp = _mock_httpx_response(packed)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["source"] == "meshcore"
        assert body["count"] == 2
        assert len(body["nodes"]) == 2

    def test_normalized_node_has_name_lat_lon(self, client):
        """Each normalized node must have name, lat, lon."""
        raw_nodes = [
            {"n": "Repeater One", "lat": 25.0, "lon": -80.0, "t": 2,
             "p": {"freq": 915, "bw": 250, "sf": 11}},
        ]
        packed = _pack(raw_nodes)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        node = resp.json()["nodes"][0]
        assert node["name"] == "Repeater One"
        assert node["lat"] == pytest.approx(25.0, abs=0.0001)
        assert node["lon"] == pytest.approx(-80.0, abs=0.0001)
        assert "description" in node

    def test_description_includes_type_and_radio_params(self, client):
        """Description field is built from type label and radio params."""
        raw_nodes = [
            {"n": "GW", "lat": 25.0, "lon": -80.0, "t": 2,
             "p": {"freq": 906, "bw": 250, "sf": 10}},
        ]
        packed = _pack(raw_nodes)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        desc = resp.json()["nodes"][0]["description"]
        assert "Repeater" in desc
        assert "906" in desc

    def test_node_name_as_bytes_is_decoded(self, client):
        """Name field as bytes is decoded to string."""
        raw_nodes = [
            {"n": b"ByteNode", "lat": 10.0, "lon": 20.0},
        ]
        packed = _pack(raw_nodes)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        # msgpack with use_bin_type=True and raw=False already decodes str,
        # but bytes name should still be handled
        assert resp.status_code == 200


# ============================================================================
# Nodes filtered out (missing/null name or coordinates)
# ============================================================================


class TestNodeFiltering:
    def test_nodes_with_empty_name_are_skipped(self, client):
        """Nodes with no name (empty string, null, missing) are filtered out."""
        raw_nodes = [
            {"n": "", "lat": 25.0, "lon": -80.0},       # empty string
            {"lat": 25.0, "lon": -80.0},                  # missing n key
            {"n": None, "lat": 25.0, "lon": -80.0},      # null n
            {"n": "Valid", "lat": 25.1, "lon": -80.1},   # kept
        ]
        packed = _pack(raw_nodes)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 1
        assert body["nodes"][0]["name"] == "Valid"

    def test_nodes_missing_lat_lon_are_skipped(self, client):
        """Nodes with missing or null lat/lon are filtered out."""
        raw_nodes = [
            {"n": "NoLat", "lon": -80.0},
            {"n": "NoLon", "lat": 25.0},
            {"n": "NullCoords", "lat": None, "lon": None},
            {"n": "Good", "lat": 25.5, "lon": -80.5},
        ]
        packed = _pack(raw_nodes)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        assert resp.json()["count"] == 1

    def test_nodes_with_invalid_coordinates_are_skipped(self, client):
        """Nodes with out-of-range coordinates are filtered out."""
        raw_nodes = [
            {"n": "BadLat", "lat": 999.0, "lon": -80.0},
            {"n": "BadLon", "lat": 25.0, "lon": 999.0},
            {"n": "Good", "lat": 25.5, "lon": -80.5},
        ]
        packed = _pack(raw_nodes)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        assert resp.json()["count"] == 1


# ============================================================================
# Empty nodes list
# ============================================================================


class TestEmptyNodesList:
    def test_empty_list_returns_200_count_zero(self, client):
        """Empty node list from API returns 200 with count=0."""
        packed = _pack([])

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0
        assert body["nodes"] == []

    def test_dict_response_with_nodes_key_is_unwrapped(self, client):
        """If msgpack returns dict with 'nodes' key, the list is unwrapped."""
        inner = [{"n": "Wrapped", "lat": 25.0, "lon": -80.0}]
        packed = _pack({"nodes": inner})

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        assert resp.json()["count"] == 1


# ============================================================================
# Error cases — source validation
# ============================================================================


class TestSourceValidation:
    def test_unknown_source_returns_400(self, client):
        """source=unknown → 400 with detail message."""
        resp = client.get(
            "/api/import/internet-map?source=unknown",
            headers=_auth_headers(),
        )
        assert resp.status_code == 400
        assert "unknown" in resp.json()["detail"].lower()

    def test_missing_source_uses_default_meshcore(self, client):
        """Missing source param uses default='meshcore', not 422."""
        packed = _pack([])

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=_mock_httpx_response(packed))
            mock_client_cls.return_value = mock_client

            # No ?source= param — should default to meshcore (not 422)
            resp = client.get(
                "/api/import/internet-map",
                headers=_auth_headers(),
            )

        assert resp.status_code == 200
        assert resp.json()["source"] == "meshcore"


# ============================================================================
# Error cases — upstream failures → 503
# ============================================================================


class TestUpstreamErrors:
    def test_httpx_timeout_returns_503(self, client):
        """Backend httpx timeout → 503."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 503
        assert "timed out" in resp.json()["detail"].lower()

    def test_httpx_http_status_error_returns_503(self, client):
        """Backend returns HTTP 500 → 503 from our endpoint."""
        import httpx

        mock_inner_resp = MagicMock()
        mock_inner_resp.status_code = 500
        err = httpx.HTTPStatusError("500", request=MagicMock(), response=mock_inner_resp)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)

            # raise_for_status raises HTTPStatusError
            mock_resp = MagicMock()
            mock_resp.content = b""
            mock_resp.raise_for_status = MagicMock(side_effect=err)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 503
        assert "500" in resp.json()["detail"]

    def test_httpx_request_error_returns_503(self, client):
        """Network-level httpx RequestError → 503."""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(
                side_effect=httpx.RequestError("connection refused", request=MagicMock())
            )
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 503

    def test_msgpack_decode_error_returns_503(self, client):
        """Corrupt/non-msgpack response body → 503."""
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            # Return garbage bytes that can't be decoded as msgpack
            mock_client.get = AsyncMock(
                return_value=_mock_httpx_response(b"<html>not msgpack</html>")
            )
            mock_client_cls.return_value = mock_client

            resp = client.get(
                "/api/import/internet-map?source=meshcore",
                headers=_auth_headers(),
            )

        assert resp.status_code == 503
        assert "unreadable" in resp.json()["detail"].lower()


class TestPingEndpoint:
    """Tests for GET /api/import/internet-map/ping connectivity probe."""

    def test_ping_returns_online_true_when_reachable(self, client):
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.head = AsyncMock(return_value=MagicMock(status_code=200))
            mock_client_cls.return_value = mock_client

            resp = client.get("/api/import/internet-map/ping", headers=_auth_headers())

        assert resp.status_code == 200
        assert resp.json() == {"online": True}

    def test_ping_returns_online_false_on_timeout(self, client):
        import httpx
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.head = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client_cls.return_value = mock_client

            resp = client.get("/api/import/internet-map/ping", headers=_auth_headers())

        assert resp.status_code == 200
        assert resp.json() == {"online": False}

    def test_ping_returns_online_false_on_connection_error(self, client):
        import httpx
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.head = AsyncMock(side_effect=httpx.ConnectError("no route"))
            mock_client_cls.return_value = mock_client

            resp = client.get("/api/import/internet-map/ping", headers=_auth_headers())

        assert resp.status_code == 200
        assert resp.json() == {"online": False}
