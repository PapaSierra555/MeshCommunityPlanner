"""Pydantic request/response models for API endpoints.

Provides typed validation and automatic OpenAPI schema generation.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ===========================================================================
# LOS models
# ===========================================================================


class LOSNodeRequest(BaseModel):
    node_id: str = "node"
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    antenna_height_m: float = 2.0
    frequency_mhz: float = 915.0
    tx_power_dbm: float = 22.0
    antenna_gain_dbi: float = 3.0
    cable_loss_db: float = 0.0
    receiver_sensitivity_dbm: float = -130.0


class LOSProfileRequest(BaseModel):
    node_a: LOSNodeRequest
    node_b: LOSNodeRequest
    frequency_mhz: float = 915.0
    num_samples: int = Field(100, ge=2, le=10000)


class ProfilePointResponse(BaseModel):
    distance_m: float
    latitude: float
    longitude: float
    elevation_m: float
    los_height_m: float
    fresnel_radius_m: float
    fresnel_clearance_m: float
    is_obstructed: bool
    fresnel_obstructed: bool


class LOSProfileResponse(BaseModel):
    node_a_id: str
    node_b_id: str
    distance_m: float
    profile: list[ProfilePointResponse]
    free_space_loss_db: float
    total_path_loss_db: float
    received_signal_dbm: float
    link_margin_db: float
    is_viable: bool
    link_quality: str
    has_los: bool
    max_obstruction_m: float
    fresnel_clearance_pct: float
    estimated_additional_loss_db: float
    error: Optional[str] = None


# ===========================================================================
# BOM models
# ===========================================================================


class BOMNodeRequest(BaseModel):
    node_id: str
    node_name: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    device: Optional[dict[str, Any]] = None
    antenna: Optional[dict[str, Any]] = None
    cable: Optional[dict[str, Any]] = None
    cable_length_m: float = 0.0
    pa_module: Optional[dict[str, Any]] = None
    battery: Optional[dict[str, Any]] = None
    solar_panel: Optional[dict[str, Any]] = None
    bec: Optional[dict[str, Any]] = None
    charge_controller: Optional[dict[str, Any]] = None
    enclosure: Optional[dict[str, Any]] = None
    mast: Optional[dict[str, Any]] = None
    is_outdoor: bool = False
    # Radio configuration (for deployment cards)
    frequency_mhz: Optional[float] = None
    tx_power_dbm: Optional[float] = None
    spreading_factor: Optional[int] = None
    bandwidth_khz: Optional[float] = None
    coding_rate: Optional[str] = None
    antenna_height_m: Optional[float] = None
    region: Optional[str] = None
    firmware: Optional[str] = None
    modem_preset: Optional[str] = None


class BOMItemResponse(BaseModel):
    category: str
    name: str
    description: str
    quantity: int
    unit_price_usd: Optional[float] = None
    total_price_usd: Optional[float] = None


class BOMNodeResponse(BaseModel):
    node_id: str
    node_name: str
    items: list[BOMItemResponse]
    total_cost_usd: float
    item_count: int
    error: Optional[str] = None


class BOMPlanRequest(BaseModel):
    plan_id: str
    plan_name: str = "Untitled Plan"
    nodes: list[BOMNodeRequest] = []


class BOMPlanResponse(BaseModel):
    plan_id: str
    plan_name: str
    total_nodes: int
    total_cost_usd: float
    consolidated_items: list[BOMItemResponse]
    error: Optional[str] = None


# ===========================================================================
# Coverage / placement models
# ===========================================================================


class CoverageNodeInput(BaseModel):
    node_id: str = "node"
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    coverage_radius_m: float = Field(1000.0, gt=0, le=100000)


class BoundsInput(BaseModel):
    min_lat: float = Field(..., ge=-90, le=90)
    min_lon: float = Field(..., ge=-180, le=180)
    max_lat: float = Field(..., ge=-90, le=90)
    max_lon: float = Field(..., ge=-180, le=180)


class PlacementSuggestRequest(BaseModel):
    """Suggest next node placement."""
    existing_nodes: list[CoverageNodeInput] = []
    bounds: BoundsInput
    coverage_radius_m: float = Field(1000.0, gt=0, le=100000)
    grid_resolution_m: float = Field(200, ge=10, le=5000)
    max_candidates: int = Field(5, ge=1, le=20)


class PlacementEvaluateRequest(BaseModel):
    """Evaluate a specific candidate placement."""
    candidate_lat: float = Field(..., ge=-90, le=90)
    candidate_lon: float = Field(..., ge=-180, le=180)
    coverage_radius_m: float = Field(1000.0, gt=0, le=100000)
    existing_nodes: list[CoverageNodeInput] = []
    bounds: BoundsInput
    grid_resolution_m: float = Field(200, ge=10, le=5000)


# ===========================================================================
# Viewshed models
# ===========================================================================


class ViewshedRequest(BaseModel):
    """Viewshed analysis from a single point."""
    observer_lat: float = Field(..., ge=-90, le=90)
    observer_lon: float = Field(..., ge=-180, le=180)
    observer_height_m: float = Field(10.0, ge=0, le=500)
    target_nodes: list[CoverageNodeInput] = []
    frequency_mhz: float = Field(906.875, ge=137.0, le=6000.0)


# ===========================================================================
# Network report models
# ===========================================================================


class NetworkReportNodeInput(BaseModel):
    """Node data for network report PDF export."""
    name: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    antenna_height_m: float = 2.0
    device_id: str = ""
    firmware: str = "meshtastic"
    region: str = "us_fcc"
    frequency_mhz: float = 906.875
    tx_power_dbm: float = 20.0
    spreading_factor: int = 11
    bandwidth_khz: float = 250.0
    coding_rate: str = "4/5"
    modem_preset: str | None = None
    is_solar: bool = False
    notes: str = ""


class NetworkReportLinkInput(BaseModel):
    """Link data for network report PDF export."""
    nodeAName: str = ""
    nodeBName: str = ""
    isViable: bool = False
    linkQuality: str = "unknown"
    distanceM: float = 0.0
    linkMarginDb: float = 0.0
    receivedSignalDbm: float = 0.0
    hasLos: bool = True
    fresnelClearancePct: float = 0.0
    maxObstructionM: float = 0.0
    totalPathLossDb: float = 0.0
    freeSpaceLossDb: float = 0.0
    elevationSource: str = "flat_terrain"


class NetworkReportRequest(BaseModel):
    """Network report PDF export request."""
    plan_name: str = "Untitled Plan"
    plan_description: str = ""
    nodes: list[NetworkReportNodeInput] = []
    links: list[NetworkReportLinkInput] = []
    map_screenshot_base64: str = ""
    include_executive_summary: bool = True
    include_bom_summary: bool = True
    include_recommendations: bool = True
    coverage_data: Optional[dict[str, Any]] = None
    bom_summary: Optional[dict[str, Any]] = None
    page_size: str = "letter"
    sections: Optional[list[str]] = None



# ===========================================================================
# Terrain coverage grid models
# ===========================================================================


class ElevationEnsureTilesRequest(BaseModel):
    """Request to ensure SRTM tiles are available for a bounding box."""
    min_lat: float = Field(..., ge=-90, le=90)
    min_lon: float = Field(..., ge=-180, le=180)
    max_lat: float = Field(..., ge=-90, le=90)
    max_lon: float = Field(..., ge=-180, le=180)


class TerrainCoverageGridRequest(BaseModel):
    """Terrain-aware coverage grid request (radial sweep with SRTM)."""
    node_id: str = "node"
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    antenna_height_m: float = Field(2.0, ge=0, le=500)
    frequency_mhz: float = Field(906.875, ge=137, le=1020)
    tx_power_dbm: float = Field(22.0, ge=0, le=47)
    antenna_gain_dbi: float = 3.0
    cable_loss_db: float = Field(0.0, ge=0)
    receiver_sensitivity_dbm: float = -130.0
    environment: str = Field("suburban", pattern="^(los_elevated|open_rural|suburban|urban|indoor)$")
    max_radius_m: float = Field(15000.0, ge=100, le=200000)
    num_radials: int = Field(360, ge=36, le=720)
    sample_interval_m: float = Field(30.0, ge=10, le=200)
    # PA module params — when present, effective TX = min(tx+gain, max_output)
    # No ge/le constraints here: Optional[float] with constraints can behave
    # unexpectedly in some Pydantic v2 builds; handler validates values itself.
    pa_max_output_power_dbm: Optional[float] = None
    pa_input_range_max_dbm: Optional[float] = None
