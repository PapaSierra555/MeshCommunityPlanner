"""Repository for plan-scoped field observation CRUD operations."""

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class FieldObservationRepository:
    """CRUD repository for field observations scoped to a plan_id."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _serialize_timestamp(value: Any) -> Any:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        return value

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        data["success"] = bool(data["success"])
        return data

    def create(
        self,
        plan_id: str,
        latitude: float,
        longitude: float,
        success: bool = False,
        ack_relay: Optional[str] = None,
        ack_db: Optional[float] = None,
        test_type: str = "message",
        source_node_id: Optional[str] = None,
        target_node_id: Optional[str] = None,
        timestamp: Any = None,
        notes: str = "",
    ) -> str:
        observation_id = str(uuid.uuid4())
        now = self._now()

        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO field_observations (
                id, plan_id, latitude, longitude, success, ack_relay, ack_db,
                test_type, source_node_id, target_node_id, timestamp, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                observation_id,
                plan_id,
                latitude,
                longitude,
                1 if success else 0,
                ack_relay,
                ack_db,
                test_type,
                source_node_id,
                target_node_id,
                self._serialize_timestamp(timestamp),
                notes,
                now,
                now,
            ),
        )
        self.conn.commit()
        return observation_id

    def get_by_id(self, plan_id: str, observation_id: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, plan_id, latitude, longitude, success, ack_relay, ack_db,
                   test_type, source_node_id, target_node_id, timestamp, notes,
                   created_at, updated_at
            FROM field_observations
            WHERE id = ? AND plan_id = ?
            """,
            (observation_id, plan_id),
        )
        row = cursor.fetchone()
        return self._row_to_dict(row) if row is not None else None

    def update(self, plan_id: str, observation_id: str, **kwargs: Any) -> bool:
        allowed_fields = {
            "latitude",
            "longitude",
            "success",
            "ack_relay",
            "ack_db",
            "test_type",
            "source_node_id",
            "target_node_id",
            "timestamp",
            "notes",
        }
        updates = []
        params = []

        for field, value in kwargs.items():
            if field not in allowed_fields:
                continue
            updates.append(f"{field} = ?")
            if field == "success":
                params.append(1 if value else 0)
            elif field == "timestamp":
                params.append(self._serialize_timestamp(value))
            else:
                params.append(value)

        if not updates:
            return self.get_by_id(plan_id, observation_id) is not None

        updates.append("updated_at = ?")
        params.append(self._now())
        params.extend([observation_id, plan_id])

        cursor = self.conn.cursor()
        cursor.execute(
            f"UPDATE field_observations SET {', '.join(updates)} WHERE id = ? AND plan_id = ?",
            params,
        )
        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, plan_id: str, observation_id: str) -> bool:
        cursor = self.conn.cursor()
        cursor.execute(
            "DELETE FROM field_observations WHERE id = ? AND plan_id = ?",
            (observation_id, plan_id),
        )
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
        allowed_sort = {
            "created_at",
            "updated_at",
            "timestamp",
            "success",
            "ack_db",
        }
        sort_column = sort_by if sort_by in allowed_sort else "created_at"
        sort_direction = "DESC" if order == "desc" else "ASC"

        query = f"""
            SELECT id, plan_id, latitude, longitude, success, ack_relay, ack_db,
                   test_type, source_node_id, target_node_id, timestamp, notes,
                   created_at, updated_at
            FROM field_observations
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
        return [self._row_to_dict(row) for row in cursor.fetchall()]

    def count_by_plan(self, plan_id: str) -> int:
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM field_observations WHERE plan_id = ?", (plan_id,))
        row = cursor.fetchone()
        return row[0] if row else 0
