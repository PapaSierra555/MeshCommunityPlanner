"""Contract tests for the mounts API."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.mounts import router as mounts_router
from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.mount_repo import MountRepository


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
    plan_id              TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
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

_CREATE_MOUNTS = """
CREATE TABLE IF NOT EXISTS mounts (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    mount_type      TEXT NOT NULL DEFAULT 'mast',
    height_agl_m    REAL NOT NULL DEFAULT 0.0,
    height_asl_m    REAL,
    cable_id        TEXT,
    cable_length_m  REAL DEFAULT 0.0,
    enclosure       TEXT,
    power_source    TEXT NOT NULL DEFAULT 'unknown',
    install_notes   TEXT DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
)
"""


@pytest.fixture
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:", check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.execute(_CREATE_PLANS)
    c.execute(_CREATE_SITES)
    c.execute(_CREATE_MOUNTS)
    for plan_id, name in [
        ("plan-contract-001", "Contract Plan"),
        ("plan-contract-002", "Other Plan"),
    ]:
        c.execute(
            "INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (plan_id, name, "2026-04-26T00:00:00Z", "2026-04-26T00:00:00Z"),
        )
    for site_id, plan_id, name in [
        ("site-contract-001", "plan-contract-001", "Contract Site"),
        ("site-contract-002", "plan-contract-001", "Second Site"),
        ("site-contract-other", "plan-contract-002", "Other Site"),
    ]:
        c.execute(
            """
            INSERT INTO sites (id, plan_id, name, latitude, longitude, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                site_id,
                plan_id,
                name,
                40.1,
                -105.2,
                "2026-04-26T00:00:00Z",
                "2026-04-26T00:00:00Z",
            ),
        )
    c.commit()
    return c


@pytest.fixture
def client(conn: sqlite3.Connection) -> TestClient:
    app = FastAPI()
    app.include_router(mounts_router, prefix="/api")
    app.dependency_overrides[get_db_connection] = lambda: conn
    return TestClient(app)


def _mount_payload(**overrides) -> dict:
    payload = dict(
        site_id="site-contract-001",
        mount_type="mast",
        height_agl_m=6.5,
        height_asl_m=1660.0,
        cable_id="lmr-195",
        cable_length_m=4.0,
        enclosure="ip67-box",
        power_source="solar",
        install_notes="South side of roof",
    )
    payload.update(overrides)
    return payload


def test_create_get_update_list_delete_mount_round_trip(client: TestClient) -> None:
    create_resp = client.post("/api/plans/plan-contract-001/mounts", json=_mount_payload())

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert set(created) == {
        "id",
        "plan_id",
        "site_id",
        "mount_type",
        "height_agl_m",
        "height_asl_m",
        "cable_id",
        "cable_length_m",
        "enclosure",
        "power_source",
        "install_notes",
        "created_at",
        "updated_at",
    }
    assert created["plan_id"] == "plan-contract-001"
    assert created["site_id"] == "site-contract-001"
    assert created["mount_type"] == "mast"
    assert created["height_agl_m"] == 6.5
    assert created["power_source"] == "solar"

    get_resp = client.get(f"/api/plans/plan-contract-001/mounts/{created['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == created["id"]

    update_resp = client.put(
        f"/api/plans/plan-contract-001/mounts/{created['id']}",
        json={
            "site_id": "site-contract-002",
            "mount_type": "roof",
            "height_agl_m": 8.0,
            "height_asl_m": None,
            "cable_id": None,
            "cable_length_m": 2.5,
            "enclosure": "weatherproof",
            "power_source": "mains",
            "install_notes": "Moved to parapet",
        },
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["site_id"] == "site-contract-002"
    assert updated["mount_type"] == "roof"
    assert updated["height_agl_m"] == 8.0
    assert updated["height_asl_m"] is None
    assert updated["cable_id"] is None
    assert updated["power_source"] == "mains"

    list_resp = client.get("/api/plans/plan-contract-001/mounts?site_id=site-contract-002")
    assert list_resp.status_code == 200
    listed = list_resp.json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == created["id"]

    delete_resp = client.delete(f"/api/plans/plan-contract-001/mounts/{created['id']}")
    assert delete_resp.status_code == 204
    missing_resp = client.get(f"/api/plans/plan-contract-001/mounts/{created['id']}")
    assert missing_resp.status_code == 404


def test_mount_validation_rejects_invalid_enums_and_ranges(client: TestClient) -> None:
    bad_mount_type = client.post(
        "/api/plans/plan-contract-001/mounts",
        json=_mount_payload(mount_type="balloon"),
    )
    assert bad_mount_type.status_code == 422

    bad_power = client.post(
        "/api/plans/plan-contract-001/mounts",
        json=_mount_payload(power_source="generator"),
    )
    assert bad_power.status_code == 422

    bad_height = client.post(
        "/api/plans/plan-contract-001/mounts",
        json=_mount_payload(height_agl_m=-0.1),
    )
    assert bad_height.status_code == 422

    bad_cable_length = client.post(
        "/api/plans/plan-contract-001/mounts",
        json=_mount_payload(cable_length_m=-1.0),
    )
    assert bad_cable_length.status_code == 422


def test_plan_and_site_scope_fail_cleanly(client: TestClient, conn: sqlite3.Connection) -> None:
    missing_plan = client.post("/api/plans/missing-plan/mounts", json=_mount_payload())
    assert missing_plan.status_code == 404
    assert missing_plan.json()["detail"] == "Plan not found"

    missing_plan_read = client.get("/api/plans/missing-plan/mounts/mount-1")
    assert missing_plan_read.status_code == 404
    assert missing_plan_read.json()["detail"] == "Plan not found"

    wrong_plan_site = client.post(
        "/api/plans/plan-contract-001/mounts",
        json=_mount_payload(site_id="site-contract-other"),
    )
    assert wrong_plan_site.status_code == 400
    assert wrong_plan_site.json()["detail"] == "Site not found in plan"

    repo = MountRepository(conn)
    mount_id = repo.create(
        plan_id="plan-contract-002",
        site_id="site-contract-other",
        mount_type="tower",
        height_agl_m=12.0,
    )
    cross_plan_read = client.get(f"/api/plans/plan-contract-001/mounts/{mount_id}")
    assert cross_plan_read.status_code == 404

    cross_plan_delete = client.delete(f"/api/plans/plan-contract-001/mounts/{mount_id}")
    assert cross_plan_delete.status_code == 404

    assert repo.get_by_id("plan-contract-002", mount_id) is not None
