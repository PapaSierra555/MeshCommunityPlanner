"""Radio profile API endpoints scoped to plans."""

import sqlite3
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.plan_repo import PlanRepository
from backend.app.db.repositories.radio_profile_repo import RadioProfileRepository
from backend.app.models.radio_profile import (
    RadioProfileCreate,
    RadioProfileResponse,
    RadioProfileUpdate,
)


router = APIRouter(tags=["radio-profiles"])


def _require_plan(conn: sqlite3.Connection, plan_id: str) -> None:
    if not PlanRepository(conn).get_by_id(plan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )


@router.get("/plans/{plan_id}/radio-profiles")
async def list_radio_profiles(
    plan_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> Dict[str, Any]:
    _require_plan(conn, plan_id)

    repo = RadioProfileRepository(conn)
    return {
        "items": repo.list_by_plan(plan_id, limit=limit, offset=offset),
        "total": repo.count_by_plan(plan_id),
        "limit": limit,
        "offset": offset,
    }


@router.post(
    "/plans/{plan_id}/radio-profiles",
    response_model=RadioProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_radio_profile(
    plan_id: str,
    profile: RadioProfileCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    _require_plan(conn, plan_id)

    repo = RadioProfileRepository(conn)
    profile_id = repo.create(plan_id=plan_id, **profile.model_dump())
    return repo.get_by_id(plan_id, profile_id)


@router.get(
    "/plans/{plan_id}/radio-profiles/{profile_id}",
    response_model=RadioProfileResponse,
)
async def get_radio_profile(
    plan_id: str,
    profile_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    _require_plan(conn, plan_id)

    profile = RadioProfileRepository(conn).get_by_id(plan_id, profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Radio profile not found",
        )
    return profile


@router.put(
    "/plans/{plan_id}/radio-profiles/{profile_id}",
    response_model=RadioProfileResponse,
)
async def update_radio_profile(
    plan_id: str,
    profile_id: str,
    profile: RadioProfileUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    _require_plan(conn, plan_id)

    repo = RadioProfileRepository(conn)
    success = repo.update(plan_id, profile_id, **profile.model_dump(exclude_unset=True))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Radio profile not found",
        )
    return repo.get_by_id(plan_id, profile_id)


@router.delete(
    "/plans/{plan_id}/radio-profiles/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_radio_profile(
    plan_id: str,
    profile_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    _require_plan(conn, plan_id)

    if not RadioProfileRepository(conn).delete(plan_id, profile_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Radio profile not found",
        )
