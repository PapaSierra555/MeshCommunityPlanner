"""Pydantic models for plan-scoped Site entities."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from backend.app.models.node import contains_ssrf_pattern
from backend.app.security.sanitize import contains_sql_injection


CoordinatePrecision = Literal["exact", "approximate", "hidden"]
SiteVisibility = Literal["private", "community", "public"]
SiteStatus = Literal["candidate", "planned", "active", "retired", "rejected"]


def _validate_safe_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value

    if contains_sql_injection(value):
        raise ValueError(
            "Input contains potentially malicious SQL pattern. "
            "Please use only alphanumeric characters, spaces, and basic punctuation."
        )

    if contains_ssrf_pattern(value):
        raise ValueError(
            "Input contains potentially malicious URL or IP pattern. "
            "URLs and IP addresses are not allowed in this field."
        )

    return value


class SiteCreate(BaseModel):
    """Request model for creating a site within a plan."""

    name: str = Field(..., min_length=1, max_length=256)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    public_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    public_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    coordinate_precision: CoordinatePrecision = "exact"
    visibility: SiteVisibility = "private"
    owner_user_id: Optional[str] = Field(None, max_length=256)
    access_notes_private: str = Field(default="", max_length=4096)
    status: SiteStatus = "planned"
    notes: str = Field(default="", max_length=4096)

    @field_validator("name", "owner_user_id", "access_notes_private", "notes")
    @classmethod
    def validate_string_security(cls, value: Optional[str]) -> Optional[str]:
        return _validate_safe_text(value)


class SiteUpdate(BaseModel):
    """Request model for partially updating a site."""

    name: Optional[str] = Field(None, min_length=1, max_length=256)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    public_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    public_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    coordinate_precision: Optional[CoordinatePrecision] = None
    visibility: Optional[SiteVisibility] = None
    owner_user_id: Optional[str] = Field(None, max_length=256)
    access_notes_private: Optional[str] = Field(None, max_length=4096)
    status: Optional[SiteStatus] = None
    notes: Optional[str] = Field(None, max_length=4096)

    @field_validator("name", "owner_user_id", "access_notes_private", "notes")
    @classmethod
    def validate_string_security(cls, value: Optional[str]) -> Optional[str]:
        return _validate_safe_text(value)


class SiteResponse(BaseModel):
    """Response model for site data."""

    id: str
    plan_id: str
    name: str
    latitude: float
    longitude: float
    public_latitude: Optional[float]
    public_longitude: Optional[float]
    coordinate_precision: CoordinatePrecision
    visibility: SiteVisibility
    owner_user_id: Optional[str]
    access_notes_private: str
    status: SiteStatus
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
