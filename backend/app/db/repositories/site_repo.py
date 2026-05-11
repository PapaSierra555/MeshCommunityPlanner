"""Repository for plan-scoped site CRUD operations."""

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class SiteRepository:
    """CRUD repository for sites scoped to a plan_id."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def create(
        self,
        plan_id: str,
        name: str,
        latitude: float,
        longitude: float,
        public_latitude: Optional[float] = None,
        public_longitude: Optional[float] = None,
        coordinate_precision: str = "exact",
        visibility: str = "private",
        owner_user_id: Optional[str] = None,
        access_notes_private: str = "",
        status: str = "planned",
        notes: str = "",
    ) -> str:
        site_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO sites (
                id, plan_id, name, latitude, longitude, public_latitude,
                public_longitude, coordinate_precision, visibility, owner_user_id,
                access_notes_private, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                site_id,
                plan_id,
                name,
                latitude,
                longitude,
                public_latitude,
                public_longitude,
                coordinate_precision,
                visibility,
                owner_user_id,
                access_notes_private,
                status,
                notes,
                now,
                now,
            ),
        )
        self.conn.commit()
        return site_id

    def get_by_id(self, plan_id: str, site_id: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, plan_id, name, latitude, longitude, public_latitude,
                   public_longitude, coordinate_precision, visibility, owner_user_id,
                   access_notes_private, status, notes, created_at, updated_at
            FROM sites
            WHERE id = ? AND plan_id = ?
            """,
            (site_id, plan_id),
        )
        row = cursor.fetchone()
        return dict(row) if row is not None else None

    def update(self, plan_id: str, site_id: str, **kwargs: Any) -> bool:
        allowed_fields = {
            "name",
            "latitude",
            "longitude",
            "public_latitude",
            "public_longitude",
            "coordinate_precision",
            "visibility",
            "owner_user_id",
            "access_notes_private",
            "status",
            "notes",
        }
        updates = []
        params = []

        for field, value in kwargs.items():
            if field in allowed_fields:
                updates.append(f"{field} = ?")
                params.append(value)

        if not updates:
            return self.get_by_id(plan_id, site_id) is not None

        updates.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
        params.extend([site_id, plan_id])

        cursor = self.conn.cursor()
        cursor.execute(
            f"UPDATE sites SET {', '.join(updates)} WHERE id = ? AND plan_id = ?",
            params,
        )
        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, plan_id: str, site_id: str) -> bool:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM sites WHERE id = ? AND plan_id = ?", (site_id, plan_id))
        self.conn.commit()
        return cursor.rowcount > 0

    def list_by_plan(
        self,
        plan_id: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        sort_by: Optional[str] = None,
        order: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        sort_column = sort_by or "created_at"
        if sort_column == "name":
            sort_column = "name COLLATE NOCASE"
        sort_direction = "DESC" if order == "desc" else "ASC"

        query = f"""
            SELECT id, plan_id, name, latitude, longitude, public_latitude,
                   public_longitude, coordinate_precision, visibility, owner_user_id,
                   access_notes_private, status, notes, created_at, updated_at
            FROM sites
            WHERE plan_id = ?
            ORDER BY {sort_column} {sort_direction}
        """
        params: List[Any] = [plan_id]

        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)

        if offset is not None:
            query += " OFFSET ?"
            params.append(offset)

        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    def count_by_plan(self, plan_id: str) -> int:
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sites WHERE plan_id = ?", (plan_id,))
        row = cursor.fetchone()
        return row[0] if row else 0
