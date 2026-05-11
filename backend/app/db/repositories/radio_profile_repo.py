"""Plan-scoped repository for radio_profiles."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class RadioProfileRepository:
    """CRUD operations for radio profiles scoped to a plan_id."""

    _COLUMNS = """
        id, plan_id, name, protocol, region, frequency_mhz, tx_power_dbm,
        spreading_factor, bandwidth_khz, coding_rate, modem_preset,
        firmware_version, config_json, created_at, updated_at
    """

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def create(
        self,
        plan_id: str,
        name: str,
        protocol: str,
        region: str,
        frequency_mhz: float,
        tx_power_dbm: float,
        spreading_factor: int,
        bandwidth_khz: float,
        coding_rate: str,
        modem_preset: Optional[str] = None,
        firmware_version: Optional[str] = None,
        config_json: Optional[Dict[str, Any]] = None,
    ) -> str:
        profile_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        config_text = json.dumps(config_json or {}, separators=(",", ":"))

        self.conn.execute(
            """
            INSERT INTO radio_profiles (
                id, plan_id, name, protocol, region, frequency_mhz, tx_power_dbm,
                spreading_factor, bandwidth_khz, coding_rate, modem_preset,
                firmware_version, config_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                plan_id,
                name,
                protocol,
                region,
                frequency_mhz,
                tx_power_dbm,
                spreading_factor,
                bandwidth_khz,
                coding_rate,
                modem_preset,
                firmware_version,
                config_text,
                now,
                now,
            ),
        )
        self.conn.commit()
        return profile_id

    def get_by_id(self, plan_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            f"""
            SELECT {self._COLUMNS}
            FROM radio_profiles
            WHERE id = ? AND plan_id = ?
            """,
            (profile_id, plan_id),
        ).fetchone()
        return self._row_to_dict(row)

    def list_by_plan(
        self,
        plan_id: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        query = f"""
            SELECT {self._COLUMNS}
            FROM radio_profiles
            WHERE plan_id = ?
            ORDER BY name COLLATE NOCASE ASC, created_at ASC
        """
        params: list[Any] = [plan_id]

        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)
        if offset is not None:
            query += " OFFSET ?"
            params.append(offset)

        rows = self.conn.execute(query, params).fetchall()
        return [profile for row in rows if (profile := self._row_to_dict(row)) is not None]

    def count_by_plan(self, plan_id: str) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) FROM radio_profiles WHERE plan_id = ?",
            (plan_id,),
        ).fetchone()
        return row[0] if row else 0

    def update(self, plan_id: str, profile_id: str, **kwargs: Any) -> bool:
        allowed_fields = {
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
        }
        updates = []
        params = []

        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue
            updates.append(f"{field} = ?")
            if field == "config_json":
                params.append(json.dumps(value or {}, separators=(",", ":")))
            else:
                params.append(value)

        if not updates:
            return True

        updates.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
        params.extend([profile_id, plan_id])

        cursor = self.conn.execute(
            f"UPDATE radio_profiles SET {', '.join(updates)} WHERE id = ? AND plan_id = ?",
            params,
        )
        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, plan_id: str, profile_id: str) -> bool:
        cursor = self.conn.execute(
            "DELETE FROM radio_profiles WHERE id = ? AND plan_id = ?",
            (profile_id, plan_id),
        )
        self.conn.commit()
        return cursor.rowcount > 0

    def _row_to_dict(self, row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
        if row is None:
            return None

        profile = dict(row)
        try:
            profile["config_json"] = json.loads(profile.get("config_json") or "{}")
        except json.JSONDecodeError:
            profile["config_json"] = {}
        return profile
