"""Sites API endpoints - CRUD operations for sites within a plan."""

import sqlite3
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.plan_repo import PlanRepository
from backend.app.db.repositories.site_repo import SiteRepository
from backend.app.models.site import SiteCreate, SiteResponse, SiteUpdate


router = APIRouter()


def _ensure_plan_exists(conn: sqlite3.Connection, plan_id: str) -> None:
    if not PlanRepository(conn).get_by_id(plan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )


@router.get("/plans/{plan_id}/sites")
async def list_sites(
    plan_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    sort_by: Optional[Literal["name", "created_at", "updated_at", "status"]] = Query(default=None),
    order: Optional[Literal["asc", "desc"]] = Query(default="asc"),
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> Dict[str, Any]:
    """List sites for a plan with pagination."""
    _ensure_plan_exists(conn, plan_id)

    repo = SiteRepository(conn)
    return {
        "items": repo.list_by_plan(
            plan_id,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            order=order,
        ),
        "total": repo.count_by_plan(plan_id),
        "limit": limit,
        "offset": offset,
    }


@router.post("/plans/{plan_id}/sites", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    plan_id: str,
    site: SiteCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Create a site in a plan."""
    _ensure_plan_exists(conn, plan_id)

    repo = SiteRepository(conn)
    site_id = repo.create(plan_id=plan_id, **site.model_dump())
    return repo.get_by_id(plan_id, site_id)


@router.get("/plans/{plan_id}/sites/{site_id}", response_model=SiteResponse)
async def get_site(
    plan_id: str,
    site_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Get a site by ID scoped to a plan."""
    _ensure_plan_exists(conn, plan_id)

    site = SiteRepository(conn).get_by_id(plan_id, site_id)
    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )
    return site


@router.put("/plans/{plan_id}/sites/{site_id}", response_model=SiteResponse)
async def update_site(
    plan_id: str,
    site_id: str,
    site: SiteUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    """Update a site scoped to a plan."""
    _ensure_plan_exists(conn, plan_id)

    repo = SiteRepository(conn)
    if not repo.update(plan_id, site_id, **site.model_dump(exclude_unset=True)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )

    return repo.get_by_id(plan_id, site_id)


@router.delete("/plans/{plan_id}/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site(
    plan_id: str,
    site_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> None:
    """Delete a site scoped to a plan."""
    _ensure_plan_exists(conn, plan_id)

    if not SiteRepository(conn).delete(plan_id, site_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found",
        )
