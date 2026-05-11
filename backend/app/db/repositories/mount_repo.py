"""Mount Repository - CRUD operations for mounts table."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class MountRepository:
    """Repository for plan-scoped mount CRUD operations."""

    _COLUMNS = """
        id, plan_id, site_id, mount_type, height_agl_m, height_asl_m,
        cable_id, cable_length_m, enclosure, power_source, install_notes,
        created_at, updated_at
    """

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def site_belongs_to_plan(self, plan_id: str, site_id: str) -> bool:
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT 1 FROM sites WHERE id = ? AND plan_id = ?",
            (site_id, plan_id),
        )
        return cursor.fetchone() is not None

    def create(
        self,
        plan_id: str,
        site_id: str,
        mount_type: str = "mast",
        height_agl_m: float = 0.0,
        height_asl_m: Optional[float] = None,
        cable_id: Optional[str] = None,
        cable_length_m: float = 0.0,
        enclosure: Optional[str] = None,
        power_source: str = "unknown",
        install_notes: str = "",
    ) -> str:
        mount_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO mounts (
                id, plan_id, site_id, mount_type, height_agl_m, height_asl_m,
                cable_id, cable_length_m, enclosure, power_source, install_notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mount_id,
                plan_id,
                site_id,
                mount_type,
                height_agl_m,
                height_asl_m,
                cable_id,
                cable_length_m,
                enclosure,
                power_source,
                install_notes,
                now,
                now,
            ),
        )
        self.conn.commit()
        return mount_id

    def get_by_id(self, plan_id: str, mount_id: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute(
            f"""
            SELECT {self._COLUMNS}
            FROM mounts
            WHERE id = ? AND plan_id = ?
            """,
            (mount_id, plan_id),
        )
        row = cursor.fetchone()
        return dict(row) if row is not None else None

    def list_by_plan(
        self,
        plan_id: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        site_id: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        where_clauses = ["plan_id = ?"]
        params: list[Any] = [plan_id]

        if site_id is not None:
            where_clauses.append("site_id = ?")
            params.append(site_id)

        sort_columns = {
            "created_at": "created_at",
            "updated_at": "updated_at",
            "mount_type": "mount_type COLLATE NOCASE",
            "height_agl_m": "height_agl_m",
        }
        sort_column = sort_columns.get(sort_by or "", "created_at")
        sort_direction = "DESC" if order == "desc" else "ASC"

        query = f"""
            SELECT {self._COLUMNS}
            FROM mounts
            WHERE {' AND '.join(where_clauses)}
            ORDER BY {sort_column} {sort_direction}
        """

        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)
        if offset is not None:
            query += " OFFSET ?"
            params.append(offset)

        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    def count_by_plan(self, plan_id: str, site_id: Optional[str] = None) -> int:
        params: list[Any] = [plan_id]
        where_sql = "plan_id = ?"
        if site_id is not None:
            where_sql += " AND site_id = ?"
            params.append(site_id)

        cursor = self.conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM mounts WHERE {where_sql}", params)
        result = cursor.fetchone()
        return result[0] if result else 0

    def update(self, plan_id: str, mount_id: str, **kwargs: Any) -> bool:
        allowed_fields = [
            "site_id",
            "mount_type",
            "height_agl_m",
            "height_asl_m",
            "cable_id",
            "cable_length_m",
            "enclosure",
            "power_source",
            "install_notes",
        ]
        updates = []
        params = []

        for field, value in kwargs.items():
            if field in allowed_fields:
                updates.append(f"{field} = ?")
                params.append(value)

        if not updates:
            return self.get_by_id(plan_id, mount_id) is not None

        updates.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
        params.extend([mount_id, plan_id])

        cursor = self.conn.cursor()
        cursor.execute(
            f"UPDATE mounts SET {', '.join(updates)} WHERE id = ? AND plan_id = ?",
            params,
        )
        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, plan_id: str, mount_id: str) -> bool:
        cursor = self.conn.cursor()
        cursor.execute(
            "DELETE FROM mounts WHERE id = ? AND plan_id = ?",
            (mount_id, plan_id),
        )
        self.conn.commit()
        return cursor.rowcount > 0
