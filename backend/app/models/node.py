"""
Pydantic models for Node entities.

Models:
- NodeCreate: Request model for creating a new node
- NodeUpdate: Request model for updating an existing node
- NodeResponse: Response model for node data

All models include field validators for:
- Latitude range: -90 to 90
- Longitude range: -180 to 180
- Frequency range: 137 to 1020 MHz
- TX power range: 0 to 30 dBm
- Antenna height range: 0 to 500 meters
- String lengths: name max 256, notes max 4096

Security:
All string fields are validated using W1's centralized security functions
to reject SQL injection and SSRF attack patterns.
"""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Import W1's centralized security functions (defense-in-depth)
from backend.app.security.sanitize import contains_sql_injection
import re

# SSRF patterns for text fields (simpler than W1's coordinate validator)
_TEXT_SSRF_PATTERNS = [
    re.compile(r'https?://', re.IGNORECASE),  # URLs (anywhere in string)
    re.compile(r'file://', re.IGNORECASE),    # File URIs (anywhere in string)
    re.compile(r'ftp://', re.IGNORECASE),     # FTP URLs (anywhere in string)
    re.compile(r'\blocalhost\b', re.IGNORECASE),
    re.compile(r'\b127\.0\.0\.1\b'),
    re.compile(r'\b0\.0\.0\.0\b'),
    re.compile(r'\b169\.254\.', re.IGNORECASE),  # Link-local
    re.compile(r'\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),  # Private 10.x
    re.compile(r'\b192\.168\.', re.IGNORECASE),  # Private 192.168.x
    re.compile(r'\b172\.(1[6-9]|2[0-9]|3[0-1])\.', re.IGNORECASE),  # Private 172.16-31.x
]


def contains_ssrf_pattern(value: str) -> bool:
    """Check if text contains SSRF patterns (URLs, IPs) - for general text fields."""
    if not value:
        return False
    for pattern in _TEXT_SSRF_PATTERNS:
        if pattern.search(value):
            return True
    return False


NodeVisibility = Literal["private", "community", "public"]
CoordinatePrecision = Literal["exact", "approximate", "hidden"]
NodeRole = Literal[
    "client", "repeater", "gateway", "sensor", "planned", "experimental"
]
NodeStatus = Literal["candidate", "planned", "active", "retired", "rejected"]


class NodeCreate(BaseModel):
    """Request model for creating a new node."""

    name: str = Field(..., min_length=1, max_length=256, description="Node name")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in degrees")
    antenna_height_m: float = Field(
        default=2.0,
        ge=0.0,
        le=500.0,
        description="Antenna height above ground in meters"
    )
    device_id: str = Field(..., description="Device catalog ID")
    firmware: str = Field(..., description="Firmware family (meshtastic, meshcore, reticulum)")
    region: str = Field(..., description="Regulatory region code")
    frequency_mhz: float = Field(
        ...,
        ge=137.0,
        le=1020.0,
        description="Frequency in MHz"
    )
    tx_power_dbm: float = Field(
        ...,
        ge=0.0,
        le=47.0,
        description="TX power in dBm (0–30 dBm for unlicensed; up to 47 dBm supported for licensed/non-permissive environments)"
    )
    spreading_factor: int = Field(..., ge=5, le=12, description="LoRa spreading factor")
    bandwidth_khz: float = Field(..., gt=0.0, description="Bandwidth in kHz")
    coding_rate: str = Field(..., description="Coding rate (e.g., 4/5, 4/6, 4/7, 4/8)")
    modem_preset: Optional[str] = Field(None, description="Modem preset name (null if custom)")
    antenna_id: str = Field(..., description="Antenna catalog ID")
    cable_id: Optional[str] = Field(None, description="Cable catalog ID")
    cable_length_m: float = Field(default=0.0, ge=0.0, description="Cable length in meters")
    pa_module_id: Optional[str] = Field(None, description="PA module catalog ID")
    is_solar: bool = Field(default=False, description="Solar powered")
    desired_coverage_radius_m: Optional[float] = Field(
        None,
        gt=0.0,
        description="User-set planning radius (null = use FSPL)"
    )
    notes: str = Field(default="", max_length=4096, description="Node notes")
    environment: str = Field(
        default="suburban",
        pattern="^(los_elevated|open_rural|suburban|urban|indoor)$",
        description="Propagation environment"
    )
    coverage_environment: Optional[str] = Field(
        None,
        pattern="^(los_elevated|open_rural|suburban|urban|indoor)$",
        description="Per-node propagation environment override (null = inherit global)"
    )
    visibility: NodeVisibility = Field(
        default="private",
        description="Node visibility scope"
    )
    coordinate_precision: CoordinatePrecision = Field(
        default="exact",
        description="Coordinate disclosure precision"
    )
    node_role: NodeRole = Field(
        default="planned",
        description="Planned or deployed node role"
    )
    node_status: NodeStatus = Field(
        default="planned",
        description="Planning lifecycle status"
    )
    site_id: Optional[str] = Field(
        None,
        description="Optional physical site relationship"
    )
    mount_id: Optional[str] = Field(
        None,
        description="Optional mount relationship"
    )
    radio_profile_id: Optional[str] = Field(
        None,
        description="Optional reusable radio profile relationship"
    )

    @field_validator('name', 'notes')
    @classmethod
    def validate_string_security(cls, v: str) -> str:
        """Validate strings against SQL injection (W1) and SSRF attacks."""
        if v is None:
            return v

        # Check for SQL injection patterns (using W1's function)
        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        # Check for SSRF patterns (URLs/IPs in text)
        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    @field_validator(
        'device_id', 'firmware', 'region', 'coding_rate',
        'modem_preset', 'antenna_id', 'cable_id', 'pa_module_id',
        'site_id', 'mount_id', 'radio_profile_id'
    )
    @classmethod
    def validate_id_fields(cls, v: Optional[str]) -> Optional[str]:
        """Validate ID and enum-like fields using W1's SQL injection check."""
        if v is None:
            return v

        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Hilltop Repeater",
                    "latitude": 40.7128,
                    "longitude": -74.0060,
                    "antenna_height_m": 10.0,
                    "device_id": "tbeam-supreme",
                    "firmware": "meshtastic",
                    "region": "us_fcc",
                    "frequency_mhz": 906.875,
                    "tx_power_dbm": 22.0,
                    "spreading_factor": 11,
                    "bandwidth_khz": 250.0,
                    "coding_rate": "4/5",
                    "modem_preset": "long_fast",
                    "antenna_id": "915-3dbi-omni",
                    "cable_id": "lmr-195",
                    "cable_length_m": 3.0,
                    "is_solar": True,
                    "notes": "Solar powered repeater on hilltop"
                }
            ]
        }
    }


class NodeUpdate(BaseModel):
    """Request model for updating an existing node (all fields optional)."""

    name: Optional[str] = Field(None, min_length=1, max_length=256)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    antenna_height_m: Optional[float] = Field(None, ge=0.0, le=500.0)
    device_id: Optional[str] = None
    firmware: Optional[str] = None
    region: Optional[str] = None
    frequency_mhz: Optional[float] = Field(None, ge=137.0, le=1020.0)
    tx_power_dbm: Optional[float] = Field(None, ge=0.0, le=47.0)
    spreading_factor: Optional[int] = Field(None, ge=5, le=12)
    bandwidth_khz: Optional[float] = Field(None, gt=0.0)
    coding_rate: Optional[str] = None
    modem_preset: Optional[str] = None
    antenna_id: Optional[str] = None
    cable_id: Optional[str] = None
    cable_length_m: Optional[float] = Field(None, ge=0.0)
    pa_module_id: Optional[str] = None
    is_solar: Optional[bool] = None
    desired_coverage_radius_m: Optional[float] = Field(None, gt=0.0)
    notes: Optional[str] = Field(None, max_length=4096)
    environment: Optional[str] = Field(
        None,
        pattern="^(los_elevated|open_rural|suburban|urban|indoor)$"
    )
    coverage_environment: Optional[str] = Field(
        None,
        pattern="^(los_elevated|open_rural|suburban|urban|indoor)$",
        description="Per-node propagation environment override (null = inherit global)"
    )
    visibility: Optional[NodeVisibility] = None
    coordinate_precision: Optional[CoordinatePrecision] = None
    node_role: Optional[NodeRole] = None
    node_status: Optional[NodeStatus] = None
    site_id: Optional[str] = None
    mount_id: Optional[str] = None
    radio_profile_id: Optional[str] = None
    sort_order: Optional[int] = Field(None, ge=0)

    @field_validator('name', 'notes')
    @classmethod
    def validate_string_security(cls, v: Optional[str]) -> Optional[str]:
        """Validate strings against SQL injection and SSRF attacks using W1's security functions."""
        if v is None:
            return v

        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    @field_validator(
        'device_id', 'firmware', 'region', 'coding_rate',
        'modem_preset', 'antenna_id', 'cable_id', 'pa_module_id',
        'site_id', 'mount_id', 'radio_profile_id'
    )
    @classmethod
    def validate_id_fields(cls, v: Optional[str]) -> Optional[str]:
        """Validate ID and enum-like fields using W1's SQL injection check."""
        if v is None:
            return v

        if contains_sql_injection(v):
            raise ValueError(
                "Input contains potentially malicious SQL pattern. "
                "Please use only alphanumeric characters, spaces, and basic punctuation."
            )

        if contains_ssrf_pattern(v):
            raise ValueError(
                "Input contains potentially malicious URL or IP pattern. "
                "URLs and IP addresses are not allowed in this field."
            )

        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Updated Node Name",
                    "tx_power_dbm": 25.0,
                    "notes": "Updated notes"
                }
            ]
        }
    }


class NodeResponse(BaseModel):
    """Response model for node data."""

    id: str = Field(..., description="Node UUID")
    plan_id: str = Field(..., description="Parent plan UUID")
    name: str
    latitude: float
    longitude: float
    antenna_height_m: float
    device_id: str
    firmware: str
    region: str
    frequency_mhz: float
    tx_power_dbm: float
    spreading_factor: int
    bandwidth_khz: float
    coding_rate: str
    modem_preset: Optional[str]
    antenna_id: str
    cable_id: Optional[str]
    cable_length_m: float
    pa_module_id: Optional[str]
    is_solar: bool
    desired_coverage_radius_m: Optional[float]
    notes: str
    environment: str
    coverage_environment: Optional[str]
    visibility: NodeVisibility
    coordinate_precision: CoordinatePrecision
    node_role: NodeRole
    node_status: NodeStatus
    site_id: Optional[str]
    mount_id: Optional[str]
    radio_profile_id: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "plan_id": "660e8400-e29b-41d4-a716-446655440000",
                    "name": "Hilltop Repeater",
                    "latitude": 40.7128,
                    "longitude": -74.0060,
                    "antenna_height_m": 10.0,
                    "device_id": "tbeam-supreme",
                    "firmware": "meshtastic",
                    "region": "us_fcc",
                    "frequency_mhz": 906.875,
                    "tx_power_dbm": 22.0,
                    "spreading_factor": 11,
                    "bandwidth_khz": 250.0,
                    "coding_rate": "4/5",
                    "modem_preset": "long_fast",
                    "antenna_id": "915-3dbi-omni",
                    "cable_id": "lmr-195",
                    "cable_length_m": 3.0,
                    "pa_module_id": None,
                    "is_solar": True,
                    "desired_coverage_radius_m": 5000.0,
                    "notes": "Solar powered repeater on hilltop",
                    "sort_order": 0,
                    "created_at": "2026-02-06T12:00:00Z",
                    "updated_at": "2026-02-06T12:00:00Z"
                }
            ]
        }
    }
