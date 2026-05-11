"""Pydantic models for plan-scoped field communication observations."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from backend.app.models.node import contains_ssrf_pattern
from backend.app.security.sanitize import contains_sql_injection


FieldTestType = Literal["message", "position", "telemetry", "voice", "other"]


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


class FieldObservationCreate(BaseModel):
    """Request model for creating a field test observation."""

    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    success: bool = False
    ack_relay: Optional[str] = Field(None, max_length=256)
    ack_db: Optional[float] = Field(None, ge=-160.0, le=60.0)
    test_type: FieldTestType = "message"
    source_node_id: Optional[str] = Field(None, max_length=128)
    target_node_id: Optional[str] = Field(None, max_length=128)
    timestamp: Optional[datetime] = None
    notes: str = Field(default="", max_length=4096)

    @field_validator("ack_relay", "source_node_id", "target_node_id", "notes")
    @classmethod
    def validate_string_security(cls, value: Optional[str]) -> Optional[str]:
        return _validate_safe_text(value)


class FieldObservationUpdate(BaseModel):
    """Request model for partially updating a field test observation."""

    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    success: Optional[bool] = None
    ack_relay: Optional[str] = Field(None, max_length=256)
    ack_db: Optional[float] = Field(None, ge=-160.0, le=60.0)
    test_type: Optional[FieldTestType] = None
    source_node_id: Optional[str] = Field(None, max_length=128)
    target_node_id: Optional[str] = Field(None, max_length=128)
    timestamp: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=4096)

    @field_validator("ack_relay", "source_node_id", "target_node_id", "notes")
    @classmethod
    def validate_string_security(cls, value: Optional[str]) -> Optional[str]:
        return _validate_safe_text(value)


class FieldObservationResponse(BaseModel):
    """Response model for field test observation data."""

    id: str
    plan_id: str
    latitude: float
    longitude: float
    success: bool
    ack_relay: Optional[str]
    ack_db: Optional[float]
    test_type: FieldTestType
    source_node_id: Optional[str]
    target_node_id: Optional[str]
    timestamp: Optional[datetime]
    notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
