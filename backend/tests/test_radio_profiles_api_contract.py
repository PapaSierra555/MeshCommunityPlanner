"""Contract tests for plan-scoped radio profile CRUD."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.radio_profiles import router as radio_profiles_router
from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.radio_profile_repo import RadioProfileRepository


_CREATE_PLANS = """
CREATE TABLE IF NOT EXISTS plans (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    firmware_family TEXT,
    region      TEXT,
    file_path   TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
)
"""

_CREATE_RADIO_PROFILES = """
CREATE TABLE IF NOT EXISTS radio_profiles (
    id                  TEXT PRIMARY KEY,
    plan_id             TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    protocol            TEXT NOT NULL DEFAULT 'meshtastic',
    region              TEXT NOT NULL,
    frequency_mhz       REAL NOT NULL,
    tx_power_dbm        REAL NOT NULL,
    spreading_factor    INTEGER NOT NULL,
    bandwidth_khz       REAL NOT NULL,
    coding_rate         TEXT NOT NULL,
    modem_preset        TEXT,
    firmware_version    TEXT,
    config_json         TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
)
"""


@pytest.fixture
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:", check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute(_CREATE_PLANS)
    c.execute(_CREATE_RADIO_PROFILES)
    c.executemany(
        "INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [
            (
                "plan-radio-001",
                "Radio Plan",
                "2026-04-26T00:00:00Z",
                "2026-04-26T00:00:00Z",
            ),
            (
                "plan-radio-002",
                "Other Plan",
                "2026-04-26T00:00:00Z",
                "2026-04-26T00:00:00Z",
            ),
        ],
    )
    c.commit()
    return c


@pytest.fixture
def client(conn: sqlite3.Connection) -> TestClient:
    app = FastAPI()
    app.include_router(radio_profiles_router, prefix="/api")
    app.dependency_overrides[get_db_connection] = lambda: conn
    return TestClient(app)


def _profile_payload(**overrides) -> dict:
    payload = {
        "name": "Long Fast US",
        "protocol": "meshtastic",
        "region": "us_fcc",
        "frequency_mhz": 906.875,
        "tx_power_dbm": 22.0,
        "spreading_factor": 11,
        "bandwidth_khz": 250.0,
        "coding_rate": "4/5",
        "modem_preset": "long_fast",
        "firmware_version": "2.5.0",
        "config_json": {"channel": 20},
    }
    payload.update(overrides)
    return payload


def _make_profile(repo: RadioProfileRepository, plan_id: str, **overrides) -> str:
    payload = _profile_payload(**overrides)
    return repo.create(plan_id=plan_id, **payload)


def test_create_list_update_and_delete_radio_profile(client: TestClient) -> None:
    create_resp = client.post(
        "/api/plans/plan-radio-001/radio-profiles",
        json=_profile_payload(name="MeshCore US", protocol="meshcore", coding_rate="4/7"),
    )

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert set(created) == {
        "id",
        "plan_id",
        "name",
        "protocol",
        "region",
        "frequency_mhz",
        "tx_power_dbm",
        "spreading_factor",
        "bandwidth_khz",
        "coding_rate",
        "modem_preset",
        "firmware_version",
        "config_json",
        "created_at",
        "updated_at",
    }
    assert created["plan_id"] == "plan-radio-001"
    assert created["protocol"] == "meshcore"
    assert created["config_json"] == {"channel": 20}

    list_resp = client.get("/api/plans/plan-radio-001/radio-profiles")
    assert list_resp.status_code == 200
    page = list_resp.json()
    assert set(page) == {"items", "total", "limit", "offset"}
    assert page["total"] == 1
    assert page["items"][0]["id"] == created["id"]

    update_resp = client.put(
        f"/api/plans/plan-radio-001/radio-profiles/{created['id']}",
        json={
            "name": "Reticulum 915",
            "protocol": "reticulum",
            "frequency_mhz": 915.0,
            "config_json": {"profile": "custom"},
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Reticulum 915"
    assert updated["protocol"] == "reticulum"
    assert updated["frequency_mhz"] == 915.0
    assert updated["config_json"] == {"profile": "custom"}

    delete_resp = client.delete(
        f"/api/plans/plan-radio-001/radio-profiles/{created['id']}"
    )
    assert delete_resp.status_code == 204

    get_after_delete = client.get(
        f"/api/plans/plan-radio-001/radio-profiles/{created['id']}"
    )
    assert get_after_delete.status_code == 404


def test_plan_must_exist_for_radio_profile_crud(client: TestClient) -> None:
    assert client.get("/api/plans/missing/radio-profiles").status_code == 404
    assert client.post(
        "/api/plans/missing/radio-profiles",
        json=_profile_payload(),
    ).status_code == 404


def test_cross_plan_access_fails(
    client: TestClient,
    conn: sqlite3.Connection,
) -> None:
    profile_id = _make_profile(RadioProfileRepository(conn), "plan-radio-001")

    assert client.get(
        f"/api/plans/plan-radio-002/radio-profiles/{profile_id}"
    ).status_code == 404
    assert client.put(
        f"/api/plans/plan-radio-002/radio-profiles/{profile_id}",
        json={"name": "Wrong Plan"},
    ).status_code == 404
    assert client.delete(
        f"/api/plans/plan-radio-002/radio-profiles/{profile_id}"
    ).status_code == 404


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("protocol", "lora"),
        ("frequency_mhz", 1020.1),
        ("tx_power_dbm", 47.1),
        ("spreading_factor", 13),
        ("bandwidth_khz", 0),
    ],
)
def test_radio_profile_validation_matches_node_radio_ranges(
    client: TestClient,
    field: str,
    value,
) -> None:
    resp = client.post(
        "/api/plans/plan-radio-001/radio-profiles",
        json=_profile_payload(**{field: value}),
    )

    assert resp.status_code == 422
