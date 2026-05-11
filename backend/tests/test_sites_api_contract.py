"""Contract tests for the sites API."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.sites import router as sites_router
from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.site_repo import SiteRepository


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

_CREATE_SITES = """
CREATE TABLE IF NOT EXISTS sites (
    id                   TEXT PRIMARY KEY,
    plan_id              TEXT NOT NULL REFERENCES plans(id),
    name                 TEXT NOT NULL,
    latitude             REAL NOT NULL,
    longitude            REAL NOT NULL,
    public_latitude      REAL,
    public_longitude     REAL,
    coordinate_precision TEXT NOT NULL DEFAULT 'exact',
    visibility           TEXT NOT NULL DEFAULT 'private',
    owner_user_id        TEXT,
    access_notes_private TEXT DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'planned',
    notes                TEXT DEFAULT '',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
)
"""


@pytest.fixture
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:", check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute(_CREATE_PLANS)
    c.execute(_CREATE_SITES)
    c.executemany(
        "INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [
            (
                "plan-contract-001",
                "Contract Plan",
                "2026-04-26T00:00:00Z",
                "2026-04-26T00:00:00Z",
            ),
            (
                "plan-contract-002",
                "Other Contract Plan",
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
    app.include_router(sites_router, prefix="/api")
    app.dependency_overrides[get_db_connection] = lambda: conn
    return TestClient(app)


def _site_payload(**overrides) -> dict:
    payload = dict(
        name="Hilltop Site",
        latitude=40.1,
        longitude=-105.2,
        public_latitude=40.11,
        public_longitude=-105.21,
        coordinate_precision="approximate",
        visibility="community",
        owner_user_id="owner-001",
        access_notes_private="Gate code stored offline",
        status="candidate",
        notes="Candidate high point",
    )
    payload.update(overrides)
    return payload


def test_create_list_update_delete_site_round_trips_phase2_fields(
    client: TestClient,
) -> None:
    create_resp = client.post("/api/plans/plan-contract-001/sites", json=_site_payload())

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["plan_id"] == "plan-contract-001"
    assert created["name"] == "Hilltop Site"
    assert created["latitude"] == 40.1
    assert created["longitude"] == -105.2
    assert created["public_latitude"] == 40.11
    assert created["public_longitude"] == -105.21
    assert created["coordinate_precision"] == "approximate"
    assert created["visibility"] == "community"
    assert created["owner_user_id"] == "owner-001"
    assert created["access_notes_private"] == "Gate code stored offline"
    assert created["status"] == "candidate"
    assert created["notes"] == "Candidate high point"
    assert created["created_at"]
    assert created["updated_at"]

    list_resp = client.get("/api/plans/plan-contract-001/sites?limit=10&offset=0")
    assert list_resp.status_code == 200
    listed = list_resp.json()
    assert set(listed) == {"items", "total", "limit", "offset"}
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == created["id"]

    update_resp = client.put(
        f"/api/plans/plan-contract-001/sites/{created['id']}",
        json={
            "name": "Hilltop Active",
            "public_latitude": None,
            "public_longitude": None,
            "coordinate_precision": "hidden",
            "visibility": "private",
            "status": "active",
            "notes": "Activated",
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["name"] == "Hilltop Active"
    assert updated["public_latitude"] is None
    assert updated["public_longitude"] is None
    assert updated["coordinate_precision"] == "hidden"
    assert updated["visibility"] == "private"
    assert updated["status"] == "active"
    assert updated["notes"] == "Activated"

    delete_resp = client.delete(f"/api/plans/plan-contract-001/sites/{created['id']}")
    assert delete_resp.status_code == 204
    assert client.get(f"/api/plans/plan-contract-001/sites/{created['id']}").status_code == 404


def test_sites_validate_coordinates_enums_and_plan_existence(client: TestClient) -> None:
    assert client.post(
        "/api/plans/missing-plan/sites",
        json=_site_payload(),
    ).status_code == 404

    bad_coordinate = client.post(
        "/api/plans/plan-contract-001/sites",
        json=_site_payload(latitude=91.0),
    )
    assert bad_coordinate.status_code == 422

    bad_visibility = client.post(
        "/api/plans/plan-contract-001/sites",
        json=_site_payload(visibility="internet"),
    )
    assert bad_visibility.status_code == 422

    bad_status = client.post(
        "/api/plans/plan-contract-001/sites",
        json=_site_payload(status="maybe"),
    )
    assert bad_status.status_code == 422

    bad_precision = client.post(
        "/api/plans/plan-contract-001/sites",
        json=_site_payload(coordinate_precision="blurred"),
    )
    assert bad_precision.status_code == 422


def test_site_access_is_scoped_to_plan(client: TestClient, conn: sqlite3.Connection) -> None:
    repo = SiteRepository(conn)
    site_id = repo.create(
        plan_id="plan-contract-002",
        name="Other Plan Site",
        latitude=39.0,
        longitude=-104.0,
    )

    assert client.get(f"/api/plans/plan-contract-001/sites/{site_id}").status_code == 404
    assert client.put(
        f"/api/plans/plan-contract-001/sites/{site_id}",
        json={"name": "Wrong Plan"},
    ).status_code == 404
    assert client.delete(f"/api/plans/plan-contract-001/sites/{site_id}").status_code == 404

    list_resp = client.get("/api/plans/plan-contract-001/sites")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0
