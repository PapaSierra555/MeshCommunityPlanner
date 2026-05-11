"""Migration tests for Phase 2 site/mount/radio-profile foundations."""

from __future__ import annotations

import sqlite3

from backend.app.db.database import get_schema_version, run_migrations


def _column_names(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _index_names(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in conn.execute(f"PRAGMA index_list({table})")}


def test_phase2_foundation_migration_creates_tables_columns_and_indexes() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")

    run_migrations(conn)

    assert get_schema_version(conn) == 8

    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    assert {"sites", "mounts", "radio_profiles"}.issubset(tables)

    assert {
        "id",
        "plan_id",
        "name",
        "latitude",
        "longitude",
        "visibility",
        "coordinate_precision",
        "status",
    }.issubset(_column_names(conn, "sites"))
    assert {
        "id",
        "plan_id",
        "site_id",
        "mount_type",
        "height_agl_m",
    }.issubset(_column_names(conn, "mounts"))
    assert {
        "id",
        "plan_id",
        "name",
        "protocol",
        "region",
        "frequency_mhz",
        "tx_power_dbm",
    }.issubset(_column_names(conn, "radio_profiles"))

    assert {
        "site_id",
        "mount_id",
        "radio_profile_id",
    }.issubset(_column_names(conn, "nodes"))

    assert "idx_sites_plan" in _index_names(conn, "sites")
    assert "idx_mounts_plan" in _index_names(conn, "mounts")
    assert "idx_mounts_site" in _index_names(conn, "mounts")
    assert "idx_radio_profiles_plan" in _index_names(conn, "radio_profiles")
    assert "idx_nodes_site" in _index_names(conn, "nodes")
    assert "idx_nodes_mount" in _index_names(conn, "nodes")
    assert "idx_nodes_radio_profile" in _index_names(conn, "nodes")


def test_phase2_migration_keeps_existing_nodes_with_null_relationships() -> None:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")

    run_migrations(conn)
    conn.execute(
        """
        INSERT INTO plans (id, name, created_at, updated_at)
        VALUES ('plan-1', 'Plan', '2026-04-26T00:00:00Z', '2026-04-26T00:00:00Z')
        """
    )
    conn.execute(
        """
        INSERT INTO devices (
            id, name, mcu, radio_chip, max_tx_power_dbm, frequency_bands,
            has_gps, compatible_firmware
        ) VALUES (
            'tbeam-supreme', 'T-Beam Supreme', 'esp32', 'sx1262', 22.0,
            '["915"]', 1, '["meshtastic"]'
        )
        """
    )
    conn.execute(
        """
        INSERT INTO antennas (id, name, frequency_band, gain_dbi)
        VALUES ('915-3dbi-omni', '915 MHz 3 dBi Omni', '915', 3.0)
        """
    )
    conn.execute(
        """
        INSERT INTO nodes (
            id, plan_id, name, latitude, longitude, antenna_height_m,
            device_id, firmware, region, frequency_mhz, tx_power_dbm,
            spreading_factor, bandwidth_khz, coding_rate, antenna_id,
            created_at, updated_at
        ) VALUES (
            'node-1', 'plan-1', 'Legacy Node', 40.0, -105.0, 3.0,
            'tbeam-supreme', 'meshtastic', 'us_fcc', 906.875, 20.0,
            11, 250.0, '4/5', '915-3dbi-omni',
            '2026-04-26T00:00:00Z', '2026-04-26T00:00:00Z'
        )
        """
    )

    row = conn.execute(
        "SELECT site_id, mount_id, radio_profile_id FROM nodes WHERE id = 'node-1'"
    ).fetchone()

    assert dict(row) == {
        "site_id": None,
        "mount_id": None,
        "radio_profile_id": None,
    }
