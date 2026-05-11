"""
Nodes API endpoints - CRUD operations for nodes within a plan.

All endpoints are scoped to a plan_id - nodes cannot be accessed
across different plans. All endpoints require authentication.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import Dict, Any, Literal, Optional
import sqlite3

from backend.app.models.node import (
    NodeCreate,
    NodeUpdate,
    NodeResponse,
)
from backend.app.db.repositories.node_repo import NodeRepository
from backend.app.db.repositories.plan_repo import PlanRepository
from backend.app.db.connection import get_db_connection


router = APIRouter()


@router.get("/plans/{plan_id}/nodes")
async def list_nodes(
    plan_id: str,
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of nodes to return"),
    offset: int = Query(default=0, ge=0, description="Number of nodes to skip"),
    sort_by: Optional[Literal["name", "created_at", "antenna_height_m", "sort_order"]] = Query(
        default=None,
        description="Field to sort by (default: sort_order)"
    ),
    order: Optional[Literal["asc", "desc"]] = Query(
        default="asc",
        description="Sort order (default: asc)"
    ),
    conn: sqlite3.Connection = Depends(get_db_connection)
) -> Dict[str, Any]:
    """
    List nodes for a plan with pagination and sorting.

    Args:
        plan_id: Plan UUID
        limit: Maximum nodes to return (1-500, default 50)
        offset: Number of nodes to skip (default 0)
        sort_by: Field to sort by (name, created_at, antenna_height_m, sort_order)
        order: Sort order (asc, desc) - default: asc

    Returns:
        Paginated response with:
        - items: List of nodes
        - total: Total number of nodes in plan
        - limit: Applied limit
        - offset: Applied offset

    Raises:
        HTTPException: 404 if plan not found

    Example response:
        ```json
        {
            "items": [...],
            "total": 150,
            "limit": 50,
            "offset": 0
        }
        ```
    """
    # Verify plan exists
    plan_repo = PlanRepository(conn)
    if not plan_repo.get_by_id(plan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )

    node_repo = NodeRepository(conn)
    nodes = node_repo.list_by_plan(
        plan_id,
        limit=limit,
        offset=offset,
        sort_by=sort_by,
        order=order
    )
    total = node_repo.count_by_plan(plan_id)

    return {
        "items": nodes,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/plans/{plan_id}/nodes", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node(
    plan_id: str,
    node: NodeCreate,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Create a new node in a plan.

    Args:
        plan_id: Plan UUID
        node: Node data

    Returns:
        Created node

    Raises:
        HTTPException: 404 if plan not found
    """
    # Verify plan exists
    plan_repo = PlanRepository(conn)
    if not plan_repo.get_by_id(plan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )

    node_repo = NodeRepository(conn)

    node_id = node_repo.create(
        plan_id=plan_id,
        name=node.name,
        latitude=node.latitude,
        longitude=node.longitude,
        antenna_height_m=node.antenna_height_m,
        device_id=node.device_id,
        firmware=node.firmware,
        region=node.region,
        frequency_mhz=node.frequency_mhz,
        tx_power_dbm=node.tx_power_dbm,
        spreading_factor=node.spreading_factor,
        bandwidth_khz=node.bandwidth_khz,
        coding_rate=node.coding_rate,
        modem_preset=node.modem_preset,
        antenna_id=node.antenna_id,
        cable_id=node.cable_id,
        cable_length_m=node.cable_length_m,
        pa_module_id=node.pa_module_id,
        is_solar=node.is_solar,
        desired_coverage_radius_m=node.desired_coverage_radius_m,
        notes=node.notes,
        environment=node.environment,
        coverage_environment=node.coverage_environment,
        visibility=node.visibility,
        coordinate_precision=node.coordinate_precision,
        node_role=node.node_role,
        node_status=node.node_status,
        site_id=node.site_id,
        mount_id=node.mount_id,
        radio_profile_id=node.radio_profile_id,
        sort_order=0  # Default sort order
    )

    # Retrieve and return the created node
    created_node = node_repo.get_by_id(plan_id, node_id)
    return created_node



@router.get("/plans/{plan_id}/nodes/{node_id}", response_model=NodeResponse)
async def get_node(
    plan_id: str,
    node_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Get a node by ID (scoped to plan).

    Args:
        plan_id: Plan UUID
        node_id: Node UUID

    Returns:
        Node data

    Raises:
        HTTPException: 404 if node not found or doesn't belong to plan
    """
    node_repo = NodeRepository(conn)
    node = node_repo.get_by_id(plan_id, node_id)

    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found"
        )

    return node


@router.put("/plans/{plan_id}/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    plan_id: str,
    node_id: str,
    node: NodeUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Update a node (scoped to plan).

    Args:
        plan_id: Plan UUID
        node_id: Node UUID
        node: Updated node data (partial updates supported)

    Returns:
        Updated node

    Raises:
        HTTPException: 404 if node not found or doesn't belong to plan
    """
    node_repo = NodeRepository(conn)

    # Only pass fields that were actually set in the request (for partial updates)
    update_data = node.model_dump(exclude_unset=True)

    success = node_repo.update(
        plan_id=plan_id,
        node_id=node_id,
        **update_data
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found"
        )

    # Retrieve and return the updated node
    updated_node = node_repo.get_by_id(plan_id, node_id)
    return updated_node



@router.delete("/plans/{plan_id}/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    plan_id: str,
    node_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection)
):
    """
    Delete a node (scoped to plan).

    Args:
        plan_id: Plan UUID
        node_id: Node UUID

    Raises:
        HTTPException: 404 if node not found or doesn't belong to plan
    """
    node_repo = NodeRepository(conn)

    success = node_repo.delete(plan_id, node_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found"
        )


