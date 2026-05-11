"""Tests for per-node coverage_environment field.

Covers:
- Creating a node with coverage_environment set stores and returns it correctly
- Creating a node with coverage_environment=None returns None
- Updating a node's coverage_environment from None to a value persists
- Updating coverage_environment to None clears it
- Node created without coverage_environment in request defaults to None (no error)

Uses an in-memory SQLite DB with the minimal schema required by NodeRepository.
"""

from __future__ import annotations

import sqlite3

import pytest

from backend.app.db.repositories.node_repo import NodeRepository


# ============================================================================
# Minimal schema — plans + nodes tables only
# ============================================================================

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
    site_id                     TEXT,
    mount_id                    TEXT,
    radio_profile_id            TEXT,
    sort_order                  INTEGER NOT NULL DEFAULT 0,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
)
"""


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def conn() -> sqlite3.Connection:
    """In-memory SQLite DB with plans + nodes schema."""
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.execute(_CREATE_PLANS)
    c.execute(_CREATE_NODES)
    c.commit()
    return c


@pytest.fixture
def plan_id(conn: sqlite3.Connection) -> str:
    """Insert a minimal plan and return its ID."""
    pid = "plan-test-001"
    conn.execute(
        "INSERT INTO plans (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (pid, "Test Plan", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
    )
    conn.commit()
    return pid


def _make_node(repo: NodeRepository, plan_id: str, **overrides) -> str:
    """Create a node with sensible defaults; override via kwargs."""
    defaults = dict(
        plan_id=plan_id,
        name="Test Node",
        latitude=27.5,
        longitude=-82.0,
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


# ============================================================================
# Tests
# ============================================================================

class TestCoverageEnvironmentCreate:
    def test_create_with_coverage_environment_stores_value(self, conn, plan_id):
        """Node created with coverage_environment='los_elevated' returns that value."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id, coverage_environment="los_elevated")
        node = repo.get_by_id(plan_id, node_id)
        assert node is not None
        assert node["coverage_environment"] == "los_elevated"

    def test_create_with_coverage_environment_null_returns_none(self, conn, plan_id):
        """Node created with coverage_environment=None returns None."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id, coverage_environment=None)
        node = repo.get_by_id(plan_id, node_id)
        assert node is not None
        assert node["coverage_environment"] is None

    def test_create_without_coverage_environment_defaults_to_none(self, conn, plan_id):
        """Node created without passing coverage_environment defaults to None, no error."""
        repo = NodeRepository(conn)
        # _make_node does NOT include coverage_environment — uses repo default
        node_id = repo.create(
            plan_id=plan_id,
            name="Default Node",
            latitude=27.5,
            longitude=-82.0,
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
        node = repo.get_by_id(plan_id, node_id)
        assert node is not None
        assert node["coverage_environment"] is None

    def test_all_valid_values_round_trip(self, conn, plan_id):
        """Each valid coverage_environment value is stored and retrieved correctly."""
        valid_values = ["los_elevated", "open_rural", "suburban", "urban", "indoor"]
        repo = NodeRepository(conn)
        for val in valid_values:
            node_id = _make_node(repo, plan_id, name=f"Node {val}", coverage_environment=val)
            node = repo.get_by_id(plan_id, node_id)
            assert node["coverage_environment"] == val, f"Failed for value: {val}"


class TestCoverageEnvironmentUpdate:
    def test_update_from_none_to_value_persists(self, conn, plan_id):
        """Updating coverage_environment from None to 'suburban' persists correctly."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id, coverage_environment=None)

        success = repo.update(plan_id, node_id, coverage_environment="suburban")
        assert success is True

        node = repo.get_by_id(plan_id, node_id)
        assert node["coverage_environment"] == "suburban"

    def test_update_to_none_clears_value(self, conn, plan_id):
        """Updating coverage_environment to None from a set value clears it."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id, coverage_environment="urban")

        success = repo.update(plan_id, node_id, coverage_environment=None)
        assert success is True

        node = repo.get_by_id(plan_id, node_id)
        assert node["coverage_environment"] is None

    def test_update_from_one_value_to_another(self, conn, plan_id):
        """Updating coverage_environment from 'urban' to 'indoor' persists."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id, coverage_environment="urban")

        repo.update(plan_id, node_id, coverage_environment="indoor")
        node = repo.get_by_id(plan_id, node_id)
        assert node["coverage_environment"] == "indoor"

    def test_update_without_coverage_environment_leaves_value_unchanged(self, conn, plan_id):
        """Partial update not including coverage_environment leaves it unchanged."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id, coverage_environment="open_rural")

        # Update only the name — coverage_environment must be untouched
        repo.update(plan_id, node_id, name="Renamed Node")
        node = repo.get_by_id(plan_id, node_id)
        assert node["coverage_environment"] == "open_rural"


class TestCoverageEnvironmentListByPlan:
    def test_list_returns_coverage_environment(self, conn, plan_id):
        """list_by_plan includes coverage_environment in returned dicts."""
        repo = NodeRepository(conn)
        _make_node(repo, plan_id, name="Node A", coverage_environment="los_elevated")
        _make_node(repo, plan_id, name="Node B", coverage_environment=None)

        nodes = repo.list_by_plan(plan_id)
        assert len(nodes) == 2
        by_name = {n["name"]: n for n in nodes}
        assert by_name["Node A"]["coverage_environment"] == "los_elevated"
        assert by_name["Node B"]["coverage_environment"] is None


class TestNodePrivacyDomainFields:
    def test_create_without_privacy_domain_fields_uses_defaults(self, conn, plan_id):
        """Node created without privacy/domain fields returns backwards-compatible defaults."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id)

        node = repo.get_by_id(plan_id, node_id)

        assert node is not None
        assert node["visibility"] == "private"
        assert node["coordinate_precision"] == "exact"
        assert node["node_role"] == "planned"
        assert node["node_status"] == "planned"

    def test_create_with_privacy_domain_fields_round_trips(self, conn, plan_id):
        """Node privacy/domain fields are stored and returned on create."""
        repo = NodeRepository(conn)
        node_id = _make_node(
            repo,
            plan_id,
            visibility="community",
            coordinate_precision="approximate",
            node_role="repeater",
            node_status="active",
        )

        node = repo.get_by_id(plan_id, node_id)

        assert node is not None
        assert node["visibility"] == "community"
        assert node["coordinate_precision"] == "approximate"
        assert node["node_role"] == "repeater"
        assert node["node_status"] == "active"

    def test_update_privacy_domain_fields_persists(self, conn, plan_id):
        """Partial updates can change privacy/domain fields."""
        repo = NodeRepository(conn)
        node_id = _make_node(repo, plan_id)

        success = repo.update(
            plan_id,
            node_id,
            visibility="public",
            coordinate_precision="hidden",
            node_role="gateway",
            node_status="retired",
        )
        node = repo.get_by_id(plan_id, node_id)

        assert success is True
        assert node["visibility"] == "public"
        assert node["coordinate_precision"] == "hidden"
        assert node["node_role"] == "gateway"
        assert node["node_status"] == "retired"

    def test_list_returns_privacy_domain_fields(self, conn, plan_id):
        """list_by_plan includes privacy/domain fields in returned dicts."""
        repo = NodeRepository(conn)
        _make_node(repo, plan_id, name="Node A", visibility="community", node_role="sensor")
        _make_node(repo, plan_id, name="Node B", coordinate_precision="hidden", node_status="candidate")

        nodes = repo.list_by_plan(plan_id)
        by_name = {n["name"]: n for n in nodes}

        assert by_name["Node A"]["visibility"] == "community"
        assert by_name["Node A"]["node_role"] == "sensor"
        assert by_name["Node B"]["coordinate_precision"] == "hidden"
        assert by_name["Node B"]["node_status"] == "candidate"
