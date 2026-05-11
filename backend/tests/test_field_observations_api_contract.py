"""Contract tests for the field observations API."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.field_observations import router as field_observations_router
from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.field_observation_repo import FieldObservationRepository


_CREATE_PLANS = """
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    firmware_family TEXT,
    region TEXT,
    file_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""

_CREATE_FIELD_OBSERVATIONS = """
CREATE TABLE IF NOT EXISTS field_observations (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    ack_relay TEXT,
    ack_db REAL,
    test_type TEXT NOT NULL DEFAULT 'message',
    source_node_id TEXT,
    target_node_id TEXT,
    timestamp TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""


@pytest.fixture
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:", check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute(_CREATE_PLANS)
    c.execute(_CREATE_FIELD_OBSERVATIONS)
    c.executemany(
        "INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [
            ("plan-contract-001", "Contract Plan", "2026-04-26T00:00:00Z", "2026-04-26T00:00:00Z"),
            ("plan-contract-002", "Other Contract Plan", "2026-04-26T00:00:00Z", "2026-04-26T00:00:00Z"),
        ],
    )
    c.commit()
    return c


@pytest.fixture
def client(conn: sqlite3.Connection) -> TestClient:
    app = FastAPI()
    app.include_router(field_observations_router, prefix="/api")
    app.dependency_overrides[get_db_connection] = lambda: conn
    return TestClient(app)


def _observation_payload(**overrides) -> dict:
    payload = dict(
        latitude=39.7392,
        longitude=-104.9903,
        success=True,
        ack_relay="Lookout Repeater",
        ack_db=-113.5,
        test_type="message",
        source_node_id="node-a",
        target_node_id="node-b",
        timestamp="2026-04-27T18:30:00Z",
        notes="ACKed after one retry",
    )
    payload.update(overrides)
    return payload


def test_create_list_update_delete_field_observation_round_trips(client: TestClient) -> None:
    create_resp = client.post(
        "/api/plans/plan-contract-001/field-observations",
        json=_observation_payload(),
    )

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["plan_id"] == "plan-contract-001"
    assert created["latitude"] == 39.7392
    assert created["longitude"] == -104.9903
    assert created["success"] is True
    assert created["ack_relay"] == "Lookout Repeater"
    assert created["ack_db"] == -113.5
    assert created["test_type"] == "message"
    assert created["timestamp"] == "2026-04-27T18:30:00Z"
    assert created["notes"] == "ACKed after one retry"

    list_resp = client.get("/api/plans/plan-contract-001/field-observations")
    assert list_resp.status_code == 200
    listed = list_resp.json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == created["id"]

    update_resp = client.put(
        f"/api/plans/plan-contract-001/field-observations/{created['id']}",
        json={
            "success": False,
            "ack_relay": None,
            "ack_db": None,
            "notes": "No ACK from this test point",
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["success"] is False
    assert updated["ack_relay"] is None
    assert updated["ack_db"] is None
    assert updated["notes"] == "No ACK from this test point"

    delete_resp = client.delete(f"/api/plans/plan-contract-001/field-observations/{created['id']}")
    assert delete_resp.status_code == 204
    assert client.get(f"/api/plans/plan-contract-001/field-observations/{created['id']}").status_code == 404


def test_field_observations_validate_coordinates_enums_and_plan_existence(client: TestClient) -> None:
    assert client.post(
        "/api/plans/missing-plan/field-observations",
        json=_observation_payload(),
    ).status_code == 404

    assert client.post(
        "/api/plans/plan-contract-001/field-observations",
        json=_observation_payload(latitude=91.0),
    ).status_code == 422

    assert client.post(
        "/api/plans/plan-contract-001/field-observations",
        json=_observation_payload(test_type="ping"),
    ).status_code == 422

    assert client.post(
        "/api/plans/plan-contract-001/field-observations",
        json=_observation_payload(ack_db=-200.0),
    ).status_code == 422


def test_field_observation_access_is_scoped_to_plan(
    client: TestClient,
    conn: sqlite3.Connection,
) -> None:
    repo = FieldObservationRepository(conn)
    observation_id = repo.create(
        plan_id="plan-contract-002",
        latitude=40.0,
        longitude=-105.0,
        success=True,
    )

    assert client.get(f"/api/plans/plan-contract-001/field-observations/{observation_id}").status_code == 404
    assert client.put(
        f"/api/plans/plan-contract-001/field-observations/{observation_id}",
        json={"notes": "Wrong plan"},
    ).status_code == 404
    assert client.delete(f"/api/plans/plan-contract-001/field-observations/{observation_id}").status_code == 404

    list_resp = client.get("/api/plans/plan-contract-001/field-observations")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0
