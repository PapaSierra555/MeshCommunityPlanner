"""
Node Repository - CRUD operations for nodes table.

All operations are scoped to plan_id for security.
Uses parameterized queries for SQL injection prevention.
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


class NodeRepository:
    """Repository for node CRUD operations (scoped to plan_id)."""

    def __init__(self, conn: sqlite3.Connection):
        """
        Initialize node repository.

        Args:
            conn: SQLite database connection
        """
        self.conn = conn
        self.conn.row_factory = sqlite3.Row

    def create(
        self,
        plan_id: str,
        name: str,
        latitude: float,
        longitude: float,
        device_id: str,
        firmware: str,
        region: str,
        frequency_mhz: float,
        tx_power_dbm: float,
        spreading_factor: int,
        bandwidth_khz: float,
        coding_rate: str,
        antenna_id: str,
        antenna_height_m: float = 2.0,
        modem_preset: Optional[str] = None,
        cable_id: Optional[str] = None,
        cable_length_m: float = 0.0,
        pa_module_id: Optional[str] = None,
        is_solar: bool = False,
        desired_coverage_radius_m: Optional[float] = None,
        notes: str = "",
        environment: str = "suburban",
        coverage_environment: Optional[str] = None,
        visibility: str = "private",
        coordinate_precision: str = "exact",
        node_role: str = "planned",
        node_status: str = "planned",
        site_id: Optional[str] = None,
        mount_id: Optional[str] = None,
        radio_profile_id: Optional[str] = None,
        sort_order: int = 0
    ) -> str:
        """
        Create a new node in a plan.

        Args:
            plan_id: Parent plan UUID
            name: Node name
            latitude: Latitude in degrees
            longitude: Longitude in degrees
            device_id: Device catalog ID
            firmware: Firmware family
            region: Regulatory region
            frequency_mhz: Frequency in MHz
            tx_power_dbm: TX power in dBm
            spreading_factor: LoRa spreading factor
            bandwidth_khz: Bandwidth in kHz
            coding_rate: Coding rate
            antenna_id: Antenna catalog ID
            antenna_height_m: Antenna height in meters (default: 2.0)
            modem_preset: Modem preset name (optional)
            cable_id: Cable catalog ID (optional)
            cable_length_m: Cable length in meters (default: 0.0)
            pa_module_id: PA module catalog ID (optional)
            is_solar: Solar powered (default: False)
            desired_coverage_radius_m: User-set coverage radius (optional)
            notes: Node notes (default: "")
            sort_order: Display order (default: 0)

        Returns:
            Node UUID
        """
        node_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO nodes (
                id, plan_id, name, latitude, longitude, antenna_height_m,
                device_id, firmware, region, frequency_mhz, tx_power_dbm,
                spreading_factor, bandwidth_khz, coding_rate, modem_preset,
                antenna_id, cable_id, cable_length_m, pa_module_id, is_solar,
                desired_coverage_radius_m, notes, environment, coverage_environment,
                visibility, coordinate_precision, node_role, node_status,
                site_id, mount_id, radio_profile_id, sort_order, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            node_id, plan_id, name, latitude, longitude, antenna_height_m,
            device_id, firmware, region, frequency_mhz, tx_power_dbm,
            spreading_factor, bandwidth_khz, coding_rate, modem_preset,
            antenna_id, cable_id, cable_length_m, pa_module_id, 1 if is_solar else 0,
            desired_coverage_radius_m, notes, environment, coverage_environment,
            visibility, coordinate_precision, node_role, node_status,
            site_id, mount_id, radio_profile_id, sort_order, now, now
        ))

        self.conn.commit()
        return node_id

    def get_by_id(self, plan_id: str, node_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a node by ID (scoped to plan_id).

        Args:
            plan_id: Parent plan UUID
            node_id: Node UUID

        Returns:
            Node dictionary or None if not found or wrong plan
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, plan_id, name, latitude, longitude, antenna_height_m,
                   device_id, firmware, region, frequency_mhz, tx_power_dbm,
                   spreading_factor, bandwidth_khz, coding_rate, modem_preset,
                   antenna_id, cable_id, cable_length_m, pa_module_id, is_solar,
                   desired_coverage_radius_m, notes, environment, coverage_environment,
                   visibility, coordinate_precision, node_role, node_status,
                   site_id, mount_id, radio_profile_id, sort_order, created_at, updated_at
            FROM nodes
            WHERE id = ? AND plan_id = ?
        """, (node_id, plan_id))

        row = cursor.fetchone()
        if row is None:
            return None

        node_dict = dict(row)
        # Convert is_solar from int to bool
        node_dict["is_solar"] = bool(node_dict["is_solar"])
        return node_dict

    def update(
        self,
        plan_id: str,
        node_id: str,
        **kwargs
    ) -> bool:
        """
        Update a node (partial update supported, scoped to plan_id).

        Args:
            plan_id: Parent plan UUID
            node_id: Node UUID
            **kwargs: Fields to update

        Returns:
            True if node was updated, False if not found or wrong plan
        """
        # Build dynamic UPDATE query for provided fields
        updates = []
        params = []

        allowed_fields = [
            "name", "latitude", "longitude", "antenna_height_m",
            "device_id", "firmware", "region", "frequency_mhz", "tx_power_dbm",
            "spreading_factor", "bandwidth_khz", "coding_rate", "modem_preset",
            "antenna_id", "cable_id", "cable_length_m", "pa_module_id", "is_solar",
            "desired_coverage_radius_m", "notes", "environment", "coverage_environment",
            "visibility", "coordinate_precision", "node_role", "node_status",
            "site_id", "mount_id", "radio_profile_id", "sort_order"
        ]

        for field, value in kwargs.items():
            if field in allowed_fields:
                updates.append(f"{field} = ?")
                # Convert bool to int for is_solar
                if field == "is_solar":
                    params.append(1 if value else 0)
                else:
                    params.append(value)

        if not updates:
            # No fields to update
            return True

        # Always update updated_at
        updates.append("updated_at = ?")
        params.append(datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))

        # Add node_id and plan_id to params
        params.append(node_id)
        params.append(plan_id)

        cursor = self.conn.cursor()
        query = f"UPDATE nodes SET {', '.join(updates)} WHERE id = ? AND plan_id = ?"
        cursor.execute(query, params)

        self.conn.commit()
        return cursor.rowcount > 0

    def delete(self, plan_id: str, node_id: str) -> bool:
        """
        Delete a node (scoped to plan_id).

        Args:
            plan_id: Parent plan UUID
            node_id: Node UUID

        Returns:
            True if node was deleted, False if not found or wrong plan
        """
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM nodes WHERE id = ? AND plan_id = ?", (node_id, plan_id))

        self.conn.commit()
        return cursor.rowcount > 0

    def list_by_plan(
        self,
        plan_id: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        sort_by: Optional[str] = None,
        order: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List nodes for a specific plan with optional pagination and sorting.

        Args:
            plan_id: Parent plan UUID
            limit: Maximum number of nodes to return (default: all)
            offset: Number of nodes to skip (default: 0)
            sort_by: Field to sort by (name, created_at, antenna_height_m, sort_order)
            order: Sort order (asc, desc) - default: asc

        Returns:
            List of node dictionaries
        """
        cursor = self.conn.cursor()

        # Build ORDER BY clause
        if sort_by:
            # Map sort_by to actual column name
            sort_column = sort_by
            # For name, use COLLATE NOCASE for case-insensitive sorting
            if sort_by == "name":
                sort_column = "name COLLATE NOCASE"

            sort_direction = "DESC" if order == "desc" else "ASC"
            order_clause = f"ORDER BY {sort_column} {sort_direction}"
        else:
            # Default sort: sort_order ASC, then created_at ASC
            order_clause = "ORDER BY sort_order ASC, created_at ASC"

        query = f"""
            SELECT id, plan_id, name, latitude, longitude, antenna_height_m,
                   device_id, firmware, region, frequency_mhz, tx_power_dbm,
                   spreading_factor, bandwidth_khz, coding_rate, modem_preset,
                   antenna_id, cable_id, cable_length_m, pa_module_id, is_solar,
                   desired_coverage_radius_m, notes, environment, coverage_environment,
                   visibility, coordinate_precision, node_role, node_status,
                   site_id, mount_id, radio_profile_id, sort_order, created_at, updated_at
            FROM nodes
            WHERE plan_id = ?
            {order_clause}
        """

        params = [plan_id]

        if limit is not None:
            query += " LIMIT ?"
            params.append(limit)

        if offset is not None:
            query += " OFFSET ?"
            params.append(offset)

        cursor.execute(query, params)

        rows = cursor.fetchall()
        nodes = []
        for row in rows:
            node_dict = dict(row)
            # Convert is_solar from int to bool
            node_dict["is_solar"] = bool(node_dict["is_solar"])
            nodes.append(node_dict)
        return nodes

    def count_by_plan(self, plan_id: str) -> int:
        """
        Count total nodes for a specific plan.

        Args:
            plan_id: Parent plan UUID

        Returns:
            Total number of nodes in the plan
        """
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM nodes WHERE plan_id = ?", (plan_id,))
        result = cursor.fetchone()
        return result[0] if result else 0
