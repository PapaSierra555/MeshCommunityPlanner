"""Pydantic models for reusable radio profiles."""

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from backend.app.models.node import contains_ssrf_pattern
from backend.app.security.sanitize import contains_sql_injection


RadioProtocol = Literal["meshtastic", "meshcore", "reticulum"]


class _RadioProfileBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    protocol: RadioProtocol = Field(default="meshtastic")
    region: str = Field(..., min_length=1, max_length=64)
    frequency_mhz: float = Field(..., ge=137.0, le=1020.0)
    tx_power_dbm: float = Field(..., ge=0.0, le=47.0)
    spreading_factor: int = Field(..., ge=5, le=12)
    bandwidth_khz: float = Field(..., gt=0.0)
    coding_rate: str = Field(..., min_length=1, max_length=16)
    modem_preset: Optional[str] = Field(None, max_length=128)
    firmware_version: Optional[str] = Field(None, max_length=128)
    config_json: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
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

    @field_validator(
        "protocol",
        "region",
        "coding_rate",
        "modem_preset",
        "firmware_version",
    )
    @classmethod
    def validate_enum_like_fields(cls, value: Optional[str]) -> Optional[str]:
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


class RadioProfileCreate(_RadioProfileBase):
    """Request model for creating a radio profile."""


class RadioProfileUpdate(BaseModel):
    """Request model for partially updating a radio profile."""

    name: Optional[str] = Field(None, min_length=1, max_length=256)
    protocol: Optional[RadioProtocol] = None
    region: Optional[str] = Field(None, min_length=1, max_length=64)
    frequency_mhz: Optional[float] = Field(None, ge=137.0, le=1020.0)
    tx_power_dbm: Optional[float] = Field(None, ge=0.0, le=47.0)
    spreading_factor: Optional[int] = Field(None, ge=5, le=12)
    bandwidth_khz: Optional[float] = Field(None, gt=0.0)
    coding_rate: Optional[str] = Field(None, min_length=1, max_length=16)
    modem_preset: Optional[str] = Field(None, max_length=128)
    firmware_version: Optional[str] = Field(None, max_length=128)
    config_json: Optional[Dict[str, Any]] = None

    _validate_name = field_validator("name")(_RadioProfileBase.validate_name.__func__)
    _validate_enum_like_fields = field_validator(
        "protocol",
        "region",
        "coding_rate",
        "modem_preset",
        "firmware_version",
    )(_RadioProfileBase.validate_enum_like_fields.__func__)


class RadioProfileResponse(_RadioProfileBase):
    """Response model for radio profile data."""

    id: str
    plan_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
