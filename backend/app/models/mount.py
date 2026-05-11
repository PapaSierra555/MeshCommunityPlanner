"""Pydantic models for plan-scoped Mount entities."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from backend.app.models.node import contains_ssrf_pattern
from backend.app.security.sanitize import contains_sql_injection


MountType = Literal[
    "handheld",
    "window",
    "indoor",
    "mast",
    "roof",
    "tower",
    "vehicle",
    "tree",
    "temporary",
]
PowerSource = Literal["battery", "solar", "mains", "vehicle", "unknown"]


class _MountBase(BaseModel):
    """Shared mount fields and validation."""

    site_id: str = Field(..., min_length=1, max_length=256)
    mount_type: MountType = "mast"
    height_agl_m: float = Field(default=0.0, ge=0.0, le=500.0)
    height_asl_m: Optional[float] = Field(default=None, ge=-500.0, le=9000.0)
    cable_id: Optional[str] = Field(default=None, max_length=256)
    cable_length_m: float = Field(default=0.0, ge=0.0, le=500.0)
    enclosure: Optional[str] = Field(default=None, max_length=256)
    power_source: PowerSource = "unknown"
    install_notes: str = Field(default="", max_length=4096)

    @field_validator("site_id", "mount_type", "cable_id", "enclosure", "power_source", "install_notes")
    @classmethod
    def validate_text_fields(cls, value: Optional[str]) -> Optional[str]:
        """Validate mount text fields against shared SQLi/SSRF patterns."""
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


class MountCreate(_MountBase):
    """Request model for creating a mount."""


class MountUpdate(BaseModel):
    """Request model for partially updating a mount."""

    site_id: Optional[str] = Field(default=None, min_length=1, max_length=256)
    mount_type: Optional[MountType] = None
    height_agl_m: Optional[float] = Field(default=None, ge=0.0, le=500.0)
    height_asl_m: Optional[float] = Field(default=None, ge=-500.0, le=9000.0)
    cable_id: Optional[str] = Field(default=None, max_length=256)
    cable_length_m: Optional[float] = Field(default=None, ge=0.0, le=500.0)
    enclosure: Optional[str] = Field(default=None, max_length=256)
    power_source: Optional[PowerSource] = None
    install_notes: Optional[str] = Field(default=None, max_length=4096)

    @field_validator("site_id", "mount_type", "cable_id", "enclosure", "power_source", "install_notes")
    @classmethod
    def validate_text_fields(cls, value: Optional[str]) -> Optional[str]:
        """Validate mount text fields against shared SQLi/SSRF patterns."""
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


class MountResponse(_MountBase):
    """Response model for mount data."""

    id: str
    plan_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
