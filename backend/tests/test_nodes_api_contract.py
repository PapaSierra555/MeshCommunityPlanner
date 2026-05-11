"""Contract tests for the nodes API."""

from __future__ import annotations

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.nodes import router as nodes_router
from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.node_repo import NodeRepository


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

_CREATE_NODES = """
CREATE TABLE IF NOT EXISTS nodes (
    id                          TEXT PRIMARY KEY,
    plan_id                     TEXT NOT NULL REFERENCES plans(id),
    site_id                     TEXT,
    mount_id                    TEXT,
    radio_profile_id            TEXT,
    name                        TEXT NOT NULL,
    latitude                    REAL NOT NULL,
    longitude                   REAL NOT NULL,
    antenna_height_m            REAL NOT NULL DEFAULT 2.0,
    device_id                   TEXT NOT NULL,
    firmware                    TEXT NOT NULL,
    region                      TEXT NOT NULL,
    frequency_mhz               REAL NOT NULL,
    tx_power_dbm                REAL NOT NULL,
    spreading_factor            INTEGER NOT NULL,
    bandwidth_khz               REAL NOT NULL,
    coding_rate                 TEXT NOT NULL,
    modem_preset                TEXT,
    antenna_id                  TEXT NOT NULL,
    cable_id                    TEXT,
    cable_length_m              REAL NOT NULL DEFAULT 0.0,
    pa_module_id                TEXT,
    is_solar                    INTEGER NOT NULL DEFAULT 0,
    desired_coverage_radius_m   REAL,
    notes                       TEXT NOT NULL DEFAULT '',
    environment                 TEXT NOT NULL DEFAULT 'suburban',
    coverage_environment        TEXT DEFAULT NULL,
    visibility                  TEXT NOT NULL DEFAULT 'private',
    coordinate_precision        TEXT NOT NULL DEFAULT 'exact',
    node_role                   TEXT NOT NULL DEFAULT 'planned',
    node_status                 TEXT NOT NULL DEFAULT 'planned',
    sort_order                  INTEGER NOT NULL DEFAULT 0,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
)
"""


@pytest.fixture
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:", check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute(_CREATE_PLANS)
    c.execute(_CREATE_NODES)
    c.execute(
        "INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (
            "plan-contract-001",
            "Contract Plan",
            "2026-04-26T00:00:00Z",
            "2026-04-26T00:00:00Z",
        ),
    )
    c.commit()
    return c


@pytest.fixture
def client(conn: sqlite3.Connection) -> TestClient:
    app = FastAPI()
    app.include_router(nodes_router, prefix="/api")
    app.dependency_overrides[get_db_connection] = lambda: conn
    return TestClient(app)


def _make_node(repo: NodeRepository, plan_id: str, **overrides) -> str:
    defaults = dict(
        plan_id=plan_id,
        name="Contract Node",
        latitude=40.1,
        longitude=-105.2,
        device_id="tbeam-supreme",
        firmware="meshtastic",
        region="us_fcc",
        frequency_mhz=906.875,
        tx_power_dbm=22.0,
        spreading_factor=11,
        bandwidth_khz=250.0,
        coding_rate="4/5",
        antenna_id="915-3dbi-omni",
    )
    defaults.update(overrides)
    return repo.create(**defaults)


def _node_payload(**overrides) -> dict:
    payload = dict(
        name="Contract Node",
        latitude=40.1,
        longitude=-105.2,
        antenna_height_m=4.0,
        device_id="tbeam-supreme",
        firmware="meshtastic",
        region="us_fcc",
        frequency_mhz=906.875,
        tx_power_dbm=22.0,
        spreading_factor=11,
        bandwidth_khz=250.0,
        coding_rate="4/5",
        modem_preset="long_fast",
        antenna_id="915-3dbi-omni",
        cable_id=None,
        cable_length_m=0.0,
        pa_module_id=None,
        is_solar=False,
        desired_coverage_radius_m=None,
        notes="",
        environment="suburban",
        coverage_environment=None,
        visibility="private",
        coordinate_precision="exact",
        node_role="planned",
        node_status="planned",
    )
    payload.update(overrides)
    return payload


def test_list_nodes_returns_paginated_contract_with_privacy_domain_fields(
    client: TestClient,
    conn: sqlite3.Connection,
) -> None:
    repo = NodeRepository(conn)
    _make_node(
        repo,
        "plan-contract-001",
        name="Hilltop",
        visibility="community",
        coordinate_precision="approximate",
        node_role="repeater",
        node_status="active",
        sort_order=1,
    )
    _make_node(
        repo,
        "plan-contract-001",
        name="Valley",
        visibility="public",
        coordinate_precision="hidden",
        node_role="gateway",
        node_status="candidate",
        sort_order=2,
    )

    resp = client.get("/api/plans/plan-contract-001/nodes?limit=1&offset=1")

    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"items", "total", "limit", "offset"}
    assert body["total"] == 2
    assert body["limit"] == 1
    assert body["offset"] == 1
    assert len(body["items"]) == 1

    node = body["items"][0]
    assert node["name"] == "Valley"
    assert node["visibility"] == "public"
    assert node["coordinate_precision"] == "hidden"
    assert node["node_role"] == "gateway"
    assert node["node_status"] == "candidate"
    assert node["site_id"] is None
    assert node["mount_id"] is None
    assert node["radio_profile_id"] is None


def test_create_and_update_node_round_trips_optional_relationship_ids(
    client: TestClient,
) -> None:
    create_resp = client.post(
        "/api/plans/plan-contract-001/nodes",
        json=_node_payload(
            site_id="site-contract-001",
            mount_id="mount-contract-001",
            radio_profile_id="radio-profile-contract-001",
        ),
    )

    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["site_id"] == "site-contract-001"
    assert created["mount_id"] == "mount-contract-001"
    assert created["radio_profile_id"] == "radio-profile-contract-001"

    update_resp = client.put(
        f"/api/plans/plan-contract-001/nodes/{created['id']}",
        json={
            "site_id": "site-contract-002",
            "mount_id": None,
            "radio_profile_id": "radio-profile-contract-002",
        },
    )

    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["site_id"] == "site-contract-002"
    assert updated["mount_id"] is None
    assert updated["radio_profile_id"] == "radio-profile-contract-002"
