"""Seed data loader for catalog tables and settings defaults.

Loads JSON seed files into their corresponding database tables on first startup.
Skips tables that already have data (idempotent).
Also auto-imports bundled sample plans on first run.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).parent

# Mapping of JSON file -> (table_name, column_list)
# Column order must match the JSON fields. JSON array/object fields are
# serialized to JSON strings before insertion.
SEED_FILES: dict[str, tuple[str, list[str]]] = {
    "devices.json": (
        "devices",
        [
            "id", "name", "mcu", "radio_chip", "max_tx_power_dbm",
            "frequency_bands", "has_gps", "battery_type", "battery_capacity_mah",
            "form_factor", "has_bluetooth", "has_wifi", "price_usd",
            "compatible_firmware", "tx_current_ma", "rx_current_ma",
            "sleep_current_ma", "is_custom",
        ],
    ),
    "antennas.json": (
        "antennas",
        [
            "id", "name", "frequency_band", "gain_dbi", "polarization",
            "form_factor", "connector_type", "price_usd", "is_default", "is_custom",
        ],
    ),
    "cables.json": (
        "cables",
        [
            "id", "name", "cable_type", "loss_per_m_915mhz", "loss_per_m_868mhz",
            "loss_per_m_433mhz", "connector_types", "price_per_m_usd", "is_custom",
        ],
    ),
    "pa_modules.json": (
        "pa_modules",
        [
            "id", "name", "frequency_range", "max_output_power_dbm",
            "input_power_range", "current_draw_ma", "price_usd", "is_custom",
        ],
    ),
    "power_components.json": (
        "power_components",
        ["id", "category", "name", "specs", "price_usd", "is_custom"],
    ),
    "regulatory_presets.json": (
        "regulatory_presets",
        [
            "id", "name", "region_code", "min_frequency_mhz", "max_frequency_mhz",
            "max_tx_power_dbm", "max_erp_dbm", "duty_cycle_pct", "bandwidths_khz",
        ],
    ),
    "modem_presets.json": (
        "modem_presets",
        [
            "id", "name", "firmware", "spreading_factor", "bandwidth_khz",
            "coding_rate", "receiver_sensitivity_dbm", "is_default", "sort_order",
        ],
    ),
    "firmware_region_defaults.json": (
        "firmware_region_defaults",
        [
            "id", "firmware", "region_code", "default_frequency_mhz",
            "default_modem_preset_id",
        ],
    ),
}

# Default settings values (from design doc)
SETTINGS_DEFAULTS: dict[str, str] = {
    "unit_system": "metric",
    "color_palette": "viridis",
    "map_cache_limit_mb": "500",
    "terrain_cache_limit_mb": "1000",
    "total_cache_limit_mb": "2000",
    "sun_hours_peak": "4",
    "battery_autonomy_days": "3",
    "signal_server_concurrency": "2",
}


def _serialize_value(value):
    """Serialize lists and dicts to JSON strings for storage."""
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return value


def _table_is_populated(conn: sqlite3.Connection, table: str) -> bool:
    """Check if a table already has data."""
    row = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()  # noqa: S608
    return row[0] > 0


def load_seed_data(conn: sqlite3.Connection) -> None:
    """Load all catalog seed data from JSON files.

    Uses INSERT OR REPLACE so catalog changes (e.g. updated device specs) are
    applied on every startup.  Custom entries (user-created, different IDs) are
    unaffected because their IDs never appear in the seed files.
    """
    for filename, (table, columns) in SEED_FILES.items():
        json_path = SEED_DIR / filename
        if not json_path.exists():
            continue

        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Failed to parse seed file %s: %s", filename, exc)
            continue

        placeholders = ", ".join("?" for _ in columns)
        col_names = ", ".join(columns)
        sql = f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})"  # noqa: S608

        rows = [
            tuple(_serialize_value(entry.get(col)) for col in columns)
            for entry in data
        ]
        conn.executemany(sql, rows)
        conn.commit()


def load_settings_defaults(conn: sqlite3.Connection) -> None:
    """Load default settings values.

    Uses INSERT OR IGNORE so existing (user-modified) values are preserved.
    """
    if _table_is_populated(conn, "settings"):
        return

    for key, value in SETTINGS_DEFAULTS.items():
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    conn.commit()


def _find_sample_plans_dir() -> Path | None:
    """Locate the sample plans directory.

    Checks two locations:
    1. PyInstaller bundle: _internal/sample_plans/ (relative to exe)
    2. Development: test_plans/ (relative to project root)
    """
    # PyInstaller bundle: sys._MEIPASS points to _internal/
    if hasattr(sys, "_MEIPASS"):
        bundled = Path(sys._MEIPASS) / "sample_plans"
        if bundled.is_dir():
            return bundled

    # Development: test_plans/ at project root (5 levels up from this file)
    project_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    dev_dir = project_root / "test_plans"
    if dev_dir.is_dir():
        return dev_dir

    return None


def load_sample_plans(conn: sqlite3.Connection) -> None:
    """Auto-import bundled sample .meshplan.json files on first run.

    Skips any plan whose name already exists in the database (idempotent).
    """
    sample_dir = _find_sample_plans_dir()
    if sample_dir is None:
        return

    plan_files = sorted(sample_dir.glob("*.meshplan.json"))
    if not plan_files:
        return

    # Get existing plan names to avoid duplicates
    existing = {
        row[0]
        for row in conn.execute("SELECT name FROM plans").fetchall()
    }

    imported = 0
    for plan_file in plan_files:
        try:
            data = json.loads(plan_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Failed to parse sample plan %s: %s", plan_file.name, exc)
            continue

        plan_info = data.get("plan", {})
        plan_name = plan_info.get("name", plan_file.stem)

        if plan_name in existing:
            continue

        # Create plan
        plan_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        description = plan_info.get("description", "")
        # Tag as sample plan in description
        if description and not description.startswith("[Sample]"):
            description = f"[Sample] {description}"
        elif not description:
            description = "[Sample] Bundled sample plan"

        conn.execute(
            """INSERT INTO plans (id, name, description, firmware_family, region,
               file_path, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                plan_id,
                plan_name,
                description,
                plan_info.get("firmware_family"),
                plan_info.get("region"),
                None,
                now,
                now,
            ),
        )

        # Create nodes
        for node in data.get("nodes", []):
            node_id = str(uuid.uuid4())
            conn.execute(
                """INSERT INTO nodes (
                    id, plan_id, name, latitude, longitude, antenna_height_m,
                    device_id, firmware, region, frequency_mhz, tx_power_dbm,
                    spreading_factor, bandwidth_khz, coding_rate, modem_preset,
                    antenna_id, cable_id, cable_length_m, pa_module_id, is_solar,
                    desired_coverage_radius_m, notes, environment, sort_order,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    node_id,
                    plan_id,
                    node.get("name", "Unnamed"),
                    node.get("latitude", 0.0),
                    node.get("longitude", 0.0),
                    node.get("antenna_height_m", 2.0),
                    node.get("device_id", ""),
                    node.get("firmware", "meshtastic"),
                    node.get("region", "us_fcc"),
                    node.get("frequency_mhz", 906.875),
                    node.get("tx_power_dbm", 20),
                    node.get("spreading_factor", 11),
                    node.get("bandwidth_khz", 250),
                    node.get("coding_rate", "4/5"),
                    node.get("modem_preset"),
                    node.get("antenna_id", "915-3dbi-omni"),
                    node.get("cable_id"),
                    node.get("cable_length_m", 0.0),
                    node.get("pa_module_id"),
                    1 if node.get("is_solar", False) else 0,
                    node.get("desired_coverage_radius_m"),
                    node.get("notes", ""),
                    node.get("environment", "suburban"),
                    node.get("sort_order", 0),
                    now,
                    now,
                ),
            )

        conn.commit()
        existing.add(plan_name)
        imported += 1
        logger.info("Seeded sample plan: %s (%d nodes)", plan_name, len(data.get("nodes", [])))

    if imported:
        logger.info("Loaded %d sample plan(s) into database", imported)
