"""Mounts API endpoints - CRUD operations for mounts within a plan."""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.mount_repo import MountRepository
from backend.app.db.repositories.plan_repo import PlanRepository
from backend.app.models.mount import MountCreate, MountResponse, MountUpdate


router = APIRouter()


def _require_plan(conn: sqlite3.Connection, plan_id: str) -> None:
    if not PlanRepository(conn).get_by_id(plan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )


def _require_site_in_plan(repo: MountRepository, plan_id: str, site_id: str) -> None:
    if not repo.site_belongs_to_plan(plan_id, site_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Site not found in plan",
        )


@router.get("/plans/{plan_id}/mounts")
async def list_mounts(
    plan_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    site_id: Optional[str] = Query(default=None),
    sort_by: Optional[Literal["created_at", "updated_at", "mount_type", "height_agl_m"]] = Query(default=None),
    order: Optional[Literal["asc", "desc"]] = Query(default="asc"),
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> Dict[str, Any]:
    """List mounts for a plan with pagination and optional site filter."""
    _require_plan(conn, plan_id)
    mount_repo = MountRepository(conn)

    if site_id is not None:
        _require_site_in_plan(mount_repo, plan_id, site_id)

    mounts = mount_repo.list_by_plan(
        plan_id=plan_id,
        limit=limit,
        offset=offset,
        site_id=site_id,
        sort_by=sort_by,
        order=order,
    )
    total = mount_repo.count_by_plan(plan_id, site_id=site_id)
    return {"items": mounts, "total": total, "limit": limit, "offset": offset}


@router.post(
    "/plans/{plan_id}/mounts",
    response_model=MountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_mount(
    plan_id: str,
    mount: MountCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Create a mount in a plan."""
    _require_plan(conn, plan_id)
    mount_repo = MountRepository(conn)
    _require_site_in_plan(mount_repo, plan_id, mount.site_id)

    mount_id = mount_repo.create(plan_id=plan_id, **mount.model_dump())
    return mount_repo.get_by_id(plan_id, mount_id)


@router.get("/plans/{plan_id}/mounts/{mount_id}", response_model=MountResponse)
async def get_mount(
    plan_id: str,
    mount_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Get a mount by ID scoped to its plan."""
    _require_plan(conn, plan_id)
    mount = MountRepository(conn).get_by_id(plan_id, mount_id)
    if mount is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mount not found",
        )
    return mount


@router.put("/plans/{plan_id}/mounts/{mount_id}", response_model=MountResponse)
async def update_mount(
    plan_id: str,
    mount_id: str,
    mount: MountUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Update a mount scoped to its plan."""
    _require_plan(conn, plan_id)
    mount_repo = MountRepository(conn)
    if mount_repo.get_by_id(plan_id, mount_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mount not found",
        )

    update_data = mount.model_dump(exclude_unset=True)
    if "site_id" in update_data:
        _require_site_in_plan(mount_repo, plan_id, update_data["site_id"])

    if not mount_repo.update(plan_id=plan_id, mount_id=mount_id, **update_data):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mount not found",
        )
    return mount_repo.get_by_id(plan_id, mount_id)


@router.delete("/plans/{plan_id}/mounts/{mount_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mount(
    plan_id: str,
    mount_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Delete a mount scoped to its plan."""
    _require_plan(conn, plan_id)
    if not MountRepository(conn).delete(plan_id, mount_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mount not found",
        )
