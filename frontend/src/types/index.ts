/**
 * Core Type Definitions
 * Type system for Mesh Community Planner frontend
 */

// ============================================================================
// Core Domain Types
// ============================================================================

export type FirmwareFamily = 'meshtastic' | 'meshcore' | 'reticulum';
export type RegionCode = 'us_fcc' | 'eu_868' | 'eu_433' | 'anz';
export type CodingRate = '4/5' | '4/6' | '4/7' | '4/8';
export type UnitSystem = 'metric' | 'imperial';
export type ColorPalette = 'viridis' | 'cividis' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'high_contrast';
export type NodeVisibility = 'private' | 'community' | 'public';
export type CoordinatePrecision = 'exact' | 'approximate' | 'hidden';
export type NodeRole = 'client' | 'repeater' | 'gateway' | 'sensor' | 'planned' | 'experimental';
export type NodeLifecycleStatus = 'candidate' | 'planned' | 'active' | 'retired' | 'rejected';
export type MountType = 'handheld' | 'window' | 'indoor' | 'mast' | 'roof' | 'tower' | 'vehicle' | 'tree' | 'temporary';
export type PowerSource = 'battery' | 'solar' | 'mains' | 'vehicle' | 'unknown';
export type RadioProtocol = FirmwareFamily;
export type FieldTestType = 'message' | 'position' | 'telemetry' | 'voice' | 'other';

// ============================================================================
// Plan & Node Types
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  description: string;
  firmware_family: FirmwareFamily | null;
  region: RegionCode | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  plan_id: string;
  name: string;
  latitude: number;
  longitude: number;
  public_latitude: number | null;
  public_longitude: number | null;
  coordinate_precision: CoordinatePrecision;
  visibility: NodeVisibility;
  owner_user_id: string | null;
  access_notes_private: string;
  status: NodeLifecycleStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Mount {
  id: string;
  plan_id: string;
  site_id: string;
  mount_type: MountType;
  height_agl_m: number;
  height_asl_m: number | null;
  cable_id: string | null;
  cable_length_m: number;
  enclosure: string | null;
  power_source: PowerSource;
  install_notes: string;
  created_at: string;
  updated_at: string;
}

export interface RadioProfile {
  id: string;
  plan_id: string;
  name: string;
  protocol: RadioProtocol;
  region: string;
  frequency_mhz: number;
  tx_power_dbm: number;
  spreading_factor: number;
  bandwidth_khz: number;
  coding_rate: string;
  modem_preset: string | null;
  firmware_version: string | null;
  config_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FieldObservation {
  id: string;
  plan_id: string;
  latitude: number;
  longitude: number;
  success: boolean;
  ack_relay: string | null;
  ack_db: number | null;
  test_type: FieldTestType;
  source_node_id: string | null;
  target_node_id: string | null;
  timestamp: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Node {
  id: string | number;
  plan_id: string;
  site_id?: string | null;
  mount_id?: string | null;
  radio_profile_id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  antenna_height_m: number;
  elevation?: number;
  status?: 'online' | 'offline' | 'warning';
  visibility?: NodeVisibility;
  coordinate_precision?: CoordinatePrecision;
  node_role?: NodeRole;
  node_status?: NodeLifecycleStatus;
  device_id: string;
  firmware: FirmwareFamily;
  region: RegionCode;
  frequency_mhz: number;
  tx_power_dbm: number;
  spreading_factor: number;
  bandwidth_khz: number;
  coding_rate: CodingRate;
  modem_preset: string | null;
  antenna_id: string;
  cable_id: string | null;
  cable_length_m: number;
  pa_module_id: string | null;
  is_solar: boolean;
  desired_coverage_radius_m: number | null;
  notes: string;
  environment: string;  // 'los_elevated' | 'open_rural' | 'suburban' | 'urban' | 'indoor'
  coverage_environment?: string | null;  // per-node override; null = inherit global
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NodePage {
  items: Node[];
  total: number;
  limit: number;
  offset: number;
}

export interface SitePage {
  items: Site[];
  total: number;
  limit: number;
  offset: number;
}

export interface MountPage {
  items: Mount[];
  total: number;
  limit: number;
  offset: number;
}

export interface RadioProfilePage {
  items: RadioProfile[];
  total: number;
  limit: number;
  offset: number;
}

export interface FieldObservationPage {
  items: FieldObservation[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Propagation Types (minimal for Phase 8)
// ============================================================================

export interface CoverageResult {
  engine: string;
  node_id: string | null;
  coverage_radius_m: number | null;
  signal_grid: number[][] | null;
  bounds: BoundingBox | null;
  timestamp: string;
}

export interface BoundingBox {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

// ============================================================================
// Topology Types (minimal for Phase 8)
// ============================================================================

export interface TopologyNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_critical: boolean;
  is_isolated: boolean;
  connectivity: number;
}

export interface TopologyEdge {
  source: string;
  target: string;
  quality: 'strong' | 'marginal' | 'weak';
  signal_strength_dbm: number | null;
}

export interface Link {
  id: number;
  source_node_id: number;
  target_node_id: number;
  link_quality?: number;
  signal_strength_dbm?: number | null;
  status?: 'active' | 'inactive' | 'degraded';
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface ResilienceMetrics {
  total_nodes: number;
  total_links: number;
  avg_connectivity: number;
  spof_count: number;
  network_diameter: number;
  is_connected: boolean;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface Settings {
  unit_system: UnitSystem;
  color_palette: ColorPalette;
  map_cache_limit_mb: number;
  terrain_cache_limit_mb: number;
  total_cache_limit_mb: number;
  sun_hours_peak: number;
  battery_autonomy_days: number;
  signal_server_concurrency: number;
}

// ============================================================================
// Map State Types
// ============================================================================

export type MapMode = 'view' | 'add_node' | 'add_field_observation' | 'edit_node' | 'measure';

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

export interface LayerVisibility {
  coverage_circles: boolean;
  heatmaps: boolean;
  connectivity_lines: boolean;
  overlap_zones: boolean;
  planning_radius: boolean;
  node_labels: boolean;
}
