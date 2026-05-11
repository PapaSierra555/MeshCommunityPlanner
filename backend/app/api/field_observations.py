"""Field observation API endpoints."""

from __future__ import annotations

import sqlite3
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.db.connection import get_db_connection
from backend.app.db.repositories.field_observation_repo import FieldObservationRepository
from backend.app.db.repositories.plan_repo import PlanRepository
from backend.app.models.field_observation import (
    FieldObservationCreate,
    FieldObservationResponse,
    FieldObservationUpdate,
)


router = APIRouter()


@router.get("/plans/{plan_id}/field-observations")
async def list_field_observations(
    plan_id: str,
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    sort_by: Optional[Literal["created_at", "updated_at", "timestamp", "success", "ack_db"]] = Query(default=None),
    order: Optional[Literal["asc", "desc"]] = Query(default="asc"),
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> Dict[str, Any]:
    plan_repo = PlanRepository(conn)
    if not plan_repo.get_by_id(plan_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    repo = FieldObservationRepository(conn)
    items = repo.list_by_plan(plan_id, limit=limit, offset=offset, sort_by=sort_by, order=order)
    total = repo.count_by_plan(plan_id)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post(
    "/plans/{plan_id}/field-observations",
    response_model=FieldObservationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_field_observation(
    plan_id: str,
    observation: FieldObservationCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    plan_repo = PlanRepository(conn)
    if not plan_repo.get_by_id(plan_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    repo = FieldObservationRepository(conn)
    observation_id = repo.create(plan_id=plan_id, **observation.model_dump())
    return repo.get_by_id(plan_id, observation_id)


@router.get("/plans/{plan_id}/field-observations/{observation_id}", response_model=FieldObservationResponse)
async def get_field_observation(
    plan_id: str,
    observation_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = FieldObservationRepository(conn)
    observation = repo.get_by_id(plan_id, observation_id)
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field observation not found")
    return observation


@router.put("/plans/{plan_id}/field-observations/{observation_id}", response_model=FieldObservationResponse)
async def update_field_observation(
    plan_id: str,
    observation_id: str,
    observation: FieldObservationUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = FieldObservationRepository(conn)
    success = repo.update(
        plan_id,
        observation_id,
        **observation.model_dump(exclude_unset=True),
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field observation not found")
    return repo.get_by_id(plan_id, observation_id)


@router.delete("/plans/{plan_id}/field-observations/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_field_observation(
    plan_id: str,
    observation_id: str,
    conn: sqlite3.Connection = Depends(get_db_connection),
):
    repo = FieldObservationRepository(conn)
    success = repo.delete(plan_id, observation_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field observation not found")
