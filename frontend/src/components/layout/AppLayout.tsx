/**
 * AppLayout Component
 * Main application layout with toolbar, sidebar, map, and status bar.
 * Implements network-wide radio settings with modem presets.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Toolbar } from './Toolbar';
import type { PlanInfoEntry } from './Toolbar';
import { StatusBar } from './StatusBar';
import { MainContent } from './MainContent';
import { usePlanStore } from '../../stores/planStore';
import { useMapStore, ELEVATION_RANGE_BUILD_ID as BUILD_ID } from '../../stores/mapStore';
import type { LOSOverlay, CoverageOverlay, TerrainCoverageOverlay, ViewshedOverlay, RoutePathOverlay } from '../../stores/mapStore';
import { getAPIClient } from '../../services/api';
import { renderCoverageCanvas } from '../../utils/coverageCanvas';
import type { Plan, Node, CodingRate } from '../../types';
import { LinkReportModal } from '../analysis/LinkReportModal';
import { TimeOnAirModal } from '../analysis/TimeOnAirModal';
import { RepeaterChainModal } from '../analysis/RepeaterChainModal';
import { MeshCoreAirtimeModal } from '../analysis/MeshCoreAirtimeModal';
import { MeshCoreCapacityModal } from '../analysis/MeshCoreCapacityModal';
import { MeshCoreFreqCoordModal } from '../analysis/MeshCoreFreqCoordModal';
import { ChannelCapacityModal } from '../analysis/ChannelCapacityModal';
import { ReticulumAnnounceModal } from '../analysis/ReticulumAnnounceModal';
import { RNSLinkBudgetModal } from '../analysis/RNSLinkBudgetModal';
import { RNSTransportModal } from '../analysis/RNSTransportModal';
import { RNSThroughputModal } from '../analysis/RNSThroughputModal';
import { BOMModal } from '../bom/BOMModal';
import { exportNodesCSV, parseNodesCSV } from '../../utils/csv';
import { exportKML, type KMLLink } from '../../utils/kml';
import { exportGeoJSON, type GeoJSONLink } from '../../utils/geojson';
import { findKShortestPaths } from '../../utils/routing';
import { FloodingSimModal } from '../analysis/FloodingSimModal';
import { PlacementSuggestModal } from '../analysis/PlacementSuggestModal';
import { PDFReportModal } from '../analysis/PDFReportModal';
import type { BOMPlanData, BOMNodeData } from '../bom/BOMModal';
import { CatalogModal } from '../catalog';
import { ErrorDialog } from '../common/ErrorDialog';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PromptDialog } from '../common/PromptDialog';
import { NumberInput } from '../common/NumberInput';
import { WelcomeTour } from '../onboarding/WelcomeTour';
import { InternetMapImportModal } from '../plan/InternetMapImportModal';
import { SignalImportModal } from '../plan/SignalImportModal';
import { KMLExportDialog } from '../plan/KMLExportDialog';
import './AppLayout.css';

// ============================================================================
// Modem Presets — network-wide radio settings
// ============================================================================

interface ModemPreset {
  label: string;
  spreading_factor: number;
  bandwidth_khz: number;
  coding_rate: CodingRate;
  description: string;
}

const MODEM_PRESETS: Record<string, ModemPreset> = {
  'LongFast': {
    label: 'Long Range / Fast (default)',
    spreading_factor: 11, bandwidth_khz: 250, coding_rate: '4/5',
    description: 'Spreading Factor 11, Bandwidth 250 kHz, Coding Rate 4/5 — Best balance of range and throughput',
  },
  'LongSlow': {
    label: 'Long Range / Slow',
    spreading_factor: 12, bandwidth_khz: 125, coding_rate: '4/8',
    description: 'Spreading Factor 12, Bandwidth 125 kHz, Coding Rate 4/8 — Maximum range, ~250 bps',
  },
  'LongModerate': {
    label: 'Long Range / Moderate',
    spreading_factor: 11, bandwidth_khz: 125, coding_rate: '4/8',
    description: 'Spreading Factor 11, Bandwidth 125 kHz, Coding Rate 4/8 — Good range with moderate speed',
  },
  'MediumSlow': {
    label: 'Medium Range / Slow',
    spreading_factor: 11, bandwidth_khz: 250, coding_rate: '4/8',
    description: 'Spreading Factor 11, Bandwidth 250 kHz, Coding Rate 4/8 — Medium range, extra error correction',
  },
  'MediumFast': {
    label: 'Medium Range / Fast',
    spreading_factor: 9, bandwidth_khz: 250, coding_rate: '4/5',
    description: 'Spreading Factor 9, Bandwidth 250 kHz, Coding Rate 4/5 — Faster data, moderate range',
  },
  'ShortSlow': {
    label: 'Short Range / Slow',
    spreading_factor: 8, bandwidth_khz: 250, coding_rate: '4/5',
    description: 'Spreading Factor 8, Bandwidth 250 kHz, Coding Rate 4/5 — Shorter range, higher throughput',
  },
  'ShortFast': {
    label: 'Short Range / Fast',
    spreading_factor: 7, bandwidth_khz: 250, coding_rate: '4/5',
    description: 'Spreading Factor 7, Bandwidth 250 kHz, Coding Rate 4/5 — Short range, fast data',
  },
  'ShortTurbo': {
    label: 'Short Range / Turbo',
    spreading_factor: 5, bandwidth_khz: 500, coding_rate: '4/5',
    description: 'Spreading Factor 5, Bandwidth 500 kHz, Coding Rate 4/5 — Shortest range, highest speed',
  },
  'MeshCore-US': {
    label: 'MeshCore US Preset',
    spreading_factor: 11, bandwidth_khz: 250, coding_rate: '4/7',
    description: 'Spreading Factor 11, Bandwidth 250 kHz, Coding Rate 4/7 — MeshCore standard US configuration',
  },
};

// Per-node coverage environment override options
const COVERAGE_ENV_OPTIONS = [
  { value: '', label: 'Inherit global setting' },
  { value: 'los_elevated', label: 'Clear LOS (Elevated)' },
  { value: 'open_rural', label: 'Open Rural' },
  { value: 'suburban', label: 'Suburban' },
  { value: 'urban', label: 'Urban' },
  { value: 'indoor', label: 'Indoor' },
];

// Badge abbreviation + color for per-node environment override
const ENV_BADGE: Record<string, { label: string; color: string }> = {
  los_elevated: { label: 'LOS', color: '#7fb3f0' },
  open_rural: { label: 'Rural', color: '#2ecc71' },
  suburban: { label: 'Sub', color: '#f39c12' },
  urban: { label: 'Urban', color: '#e74c3c' },
  indoor: { label: 'Indoor', color: '#9b59b6' },
};

const REGION_FREQUENCIES: Record<string, number> = {
  'us_fcc': 906.875,
  'eu_868': 869.525,
  'eu_433': 433.175,
  'anz': 916.0,
};

function detectPreset(sf: number, bw: number, cr: string): string {
  for (const [key, preset] of Object.entries(MODEM_PRESETS)) {
    if (preset.spreading_factor === sf && preset.bandwidth_khz === bw && preset.coding_rate === cr) {
      return key;
    }
  }
  return 'Custom';
}

// ============================================================================
// Realistic Coverage Model — Log-distance path loss + radio horizon
// ============================================================================

/** LoRa receiver sensitivity (dBm) by SF and BW — from Semtech SX1276/SX1262 datasheets */
function loraSensitivityDbm(sf: number, bwKhz: number): number {
  const table: Record<number, Record<number, number>> = {
    125: { 7: -123, 8: -126, 9: -129, 10: -132, 11: -135, 12: -137 },
    250: { 5: -111, 7: -120, 8: -123, 9: -125, 10: -128, 11: -131, 12: -134 },
    500: { 5: -109, 7: -116, 8: -119, 9: -122, 10: -125, 11: -128, 12: -130 },
  };
  return table[bwKhz]?.[sf] ?? -120;
}

/** Device default antenna gain (dBi) — approximate values for built-in / bundled antennas */
const DEVICE_ANTENNA_GAIN: Record<string, number> = {
  'tbeam-supreme': 3.0,
  'techo': 1.0,
  'canaryone': 2.0,
  'rak-wisblock-starter': 2.0,
  'rak4631': 2.0,
  'heltec-v2': 2.5,
  'heltec-v3': 2.5,
  'heltec-v4': 2.5,
  't114-v2': 2.0,
  't1000-e': 1.0,
  'xiaos3-wio': 2.0,
};

interface CoverageEnvironment {
  label: string;
  pathLossExponent: number;
  fadeMarginDb: number;
  description: string;
}

const COVERAGE_ENVIRONMENTS: Record<string, CoverageEnvironment> = {
  'los_elevated': {
    label: 'Clear LOS (Elevated)',
    pathLossExponent: 2.0,
    fadeMarginDb: 6,
    description: 'Hilltop/rooftop, clear line of sight. 10-16+ km with good antennas.',
  },
  'open_rural': {
    label: 'Open / Rural',
    pathLossExponent: 2.8,
    fadeMarginDb: 10,
    description: 'Open fields, minimal obstructions. 5-10 km typical.',
  },
  'suburban': {
    label: 'Suburban (default)',
    pathLossExponent: 3.3,
    fadeMarginDb: 10,
    description: 'Houses, trees, moderate obstructions. 2-5 km typical.',
  },
  'urban': {
    label: 'Urban',
    pathLossExponent: 4.0,
    fadeMarginDb: 10,
    description: 'Dense buildings, street-level. 0.5-2 km typical.',
  },
  'indoor': {
    label: 'Indoor / Dense Cover',
    pathLossExponent: 4.5,
    fadeMarginDb: 15,
    description: 'Indoor or heavy vegetation. 0.2-0.8 km typical.',
  },
};

/**
 * Compute realistic coverage radius using log-distance path loss model
 * with radio horizon cap.
 *
 * Log-distance: PL(d) = PL_1m + 10*n*log10(d)
 * Radio horizon: d = 3570 * (sqrt(h_tx) + sqrt(h_rx)) meters
 * Result: min(model_radius, horizon)
 */
function computeRealisticCoverageM(
  txPowerDbm: number,
  deviceId: string,
  frequencyMhz: number,
  sf: number,
  bwKhz: number,
  antennaHeightM: number,
  environment: string,
): { radiusM: number; sensitivityDbm: number; linkBudgetDb: number; horizonM: number; modelRadiusM: number; envLabel: string } {
  const sensitivity = loraSensitivityDbm(sf, bwKhz);
  const antennaGain = DEVICE_ANTENNA_GAIN[deviceId] ?? 3.0;
  const env = COVERAGE_ENVIRONMENTS[environment] || COVERAGE_ENVIRONMENTS['suburban'];

  // Link budget (dB)
  const linkBudget = txPowerDbm + antennaGain - sensitivity - env.fadeMarginDb;
  if (linkBudget <= 0) {
    return { radiusM: 0, sensitivityDbm: sensitivity, linkBudgetDb: 0, horizonM: 0, modelRadiusM: 0, envLabel: env.label };
  }

  // Reference path loss at 1m (FSPL at 1m for the frequency)
  const freqHz = frequencyMhz * 1e6;
  const pl1m = 20 * Math.log10(freqHz) + 20 * Math.log10(4 * Math.PI / 299792458);

  // Log-distance model: d = 10^((linkBudget - PL_1m) / (10 * n))
  const logD = (linkBudget - pl1m) / (10 * env.pathLossExponent);
  const modelRadius = Math.pow(10, logD);

  // Radio horizon (meters): TX antenna + RX at 1.5m (handheld)
  const rxHeightM = 1.5;
  const horizonM = 3570 * (Math.sqrt(Math.max(antennaHeightM, 0.5)) + Math.sqrt(rxHeightM));

  const radiusM = Math.min(modelRadius, horizonM);

  return { radiusM, sensitivityDbm: sensitivity, linkBudgetDb: linkBudget, horizonM, modelRadiusM: modelRadius, envLabel: env.label };
}

/* ---- Shared download helper ---- */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_');
}


export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showPlanList, setShowPlanList] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [kmlExportDialog, setKmlExportDialog] = useState<{ nodeCount: number; linkCount: number } | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [radioCollapsed, setRadioCollapsed] = useState(false);
  const [radioHelpExpanded, setRadioHelpExpanded] = useState(false);
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const [nodesCollapsed, setNodesCollapsed] = useState(false);
  const COVERAGE_SETTINGS_KEY = 'meshPlanner_coverageSettings';
  const savedCoverageSettings = (() => { try { const p = JSON.parse(localStorage.getItem(COVERAGE_SETTINGS_KEY) || 'null'); return p?.buildId === BUILD_ID ? p : null; } catch { return null; } })();
  const [coverageEnv, setCoverageEnv] = useState(savedCoverageSettings?.env ?? 'suburban');
  const [maxRadiusKm, setMaxRadiusKm] = useState(savedCoverageSettings?.maxRadiusKm ?? 15);
  const [rememberCoverageSettings, setRememberCoverageSettings] = useState(!!savedCoverageSettings);
  const [lastRunCoverageSettings, setLastRunCoverageSettings] = useState<{ env: string; maxRadiusKm: number } | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const losCancelRef = useRef(false);
  const [checkedPlanIds, setCheckedPlanIds] = useState<Set<string>>(new Set());
  const [descExpanded, setDescExpanded] = useState(false);
  const [showLinkReport, setShowLinkReport] = useState(false);
  const [showTimeOnAir, setShowTimeOnAir] = useState(false);
  const [showRepeaterChain, setShowRepeaterChain] = useState(false);
  const [showMeshCoreAirtime, setShowMeshCoreAirtime] = useState(false);
  const [showMeshCoreCapacity, setShowMeshCoreCapacity] = useState(false);
  const [showMeshCoreFreqCoord, setShowMeshCoreFreqCoord] = useState(false);
  const [showChannelCapacity, setShowChannelCapacity] = useState(false);
  const [showReticulumAnnounce, setShowReticulumAnnounce] = useState(false);
  const [showRNSLinkBudget, setShowRNSLinkBudget] = useState(false);
  const [showRNSTransport, setShowRNSTransport] = useState(false);
  const [showRNSThroughput, setShowRNSThroughput] = useState(false);
  const [showBOM, setShowBOM] = useState(false);
  const [bomData, setBomData] = useState<BOMPlanData[] | null>(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [bomError, setBomError] = useState<string | null>(null);
  const [bomExporting, setBomExporting] = useState(false);
  const [loadedPlanObjects, setLoadedPlanObjects] = useState<Plan[]>([]);
  const [tourForceKey, setTourForceKey] = useState(0);
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogTourForce, setCatalogTourForce] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFloodingSim, setShowFloodingSim] = useState(false);
  const [showPlacementSuggest, setShowPlacementSuggest] = useState(false);
  const [showPDFReport, setShowPDFReport] = useState(false);
  const [internetMapImportOpen, setInternetMapImportOpen] = useState(false);
  const [isInternetOnline, setIsInternetOnline] = useState<boolean | null>(null);
  const [signalImportOpen, setSignalImportOpen] = useState(false);
  const [bulkCoverageEnv, setBulkCoverageEnv] = useState('');
  const [envWarningDialog, setEnvWarningDialog] = useState<{
    nodeNames: string;
    onSwitch: () => void;
    onRunAnyway: () => void;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
    variant?: 'primary' | 'danger';
    title?: string;
    confirmText?: string;
  } | null>(null);
  const [promptDialog, setPromptDialog] = useState<{
    message: string;
    defaultValue: string;
    onSubmit: (value: string) => void;
    placeholder?: string;
  } | null>(null);

  // Catalog-driven data (fetched from API, replaces hardcoded dropdowns)
  const [catalogDevices, setCatalogDevices] = useState<any[]>([]);
  const [catalogAntennas, setCatalogAntennas] = useState<any[]>([]);
  const [catalogCables, setCatalogCables] = useState<any[]>([]);
  const [catalogPAModules, setCatalogPAModules] = useState<any[]>([]);
  const [catalogRegions, setCatalogRegions] = useState<any[]>([]);
  const [catalogModemPresets, setCatalogModemPresets] = useState<any[]>([]);
  const [catalogFirmwareDefaults, setCatalogFirmwareDefaults] = useState<any[]>([]);

  const currentPlan = usePlanStore((s) => s.current_plan);
  const nodes = usePlanStore((s) => s.nodes);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setNodes = usePlanStore((s) => s.setNodes);
  const updatePlanStore = usePlanStore((s) => s.updatePlan);
  const updateNodeStore = usePlanStore((s) => s.updateNode);
  const removeNodeStore = usePlanStore((s) => s.removeNode);
  const clearPlan = usePlanStore((s) => s.clearPlan);
  const mapMode = useMapStore((s) => s.mode);
  const setMode = useMapStore((s) => s.setMode);
  const selectedNodeId = useMapStore((s) => s.selected_node_id);
  const selectedNodeIds = useMapStore((s) => s.selected_node_ids);
  const selectNode = useMapStore((s) => s.selectNode);
  const toggleNodeSelection = useMapStore((s) => s.toggleNodeSelection);
  const clearNodeSelection = useMapStore((s) => s.clearNodeSelection);
  const invalidateMap = useMapStore((s) => s.invalidateMap);
  const requestFitBounds = useMapStore((s) => s.requestFitBounds);
  const setLOSOverlays = useMapStore((s) => s.setLOSOverlays);
  const clearLOSOverlays = useMapStore((s) => s.clearLOSOverlays);
  const setCoverageOverlays = useMapStore((s) => s.setCoverageOverlays);
  const clearCoverageOverlays = useMapStore((s) => s.clearCoverageOverlays);
  const setTerrainCoverageOverlays = useMapStore((s) => s.setTerrainCoverageOverlays);
  const clearTerrainCoverageOverlays = useMapStore((s) => s.clearTerrainCoverageOverlays);
  const setViewshedOverlays = useMapStore((s) => s.setViewshedOverlays);
  const clearViewshedOverlays = useMapStore((s) => s.clearViewshedOverlays);
  const setRoutePathOverlays = useMapStore((s) => s.setRoutePathOverlays);
  const clearRoutePathOverlays = useMapStore((s) => s.clearRoutePathOverlays);
  const losOverlays = useMapStore((s) => s.los_overlays);
  const coverageOverlays = useMapStore((s) => s.coverage_overlays);
  const terrainCoverageOverlays = useMapStore((s) => s.terrain_coverage_overlays);
  const viewshedOverlays = useMapStore((s) => s.viewshed_overlays);
  const routePathOverlays = useMapStore((s) => s.route_path_overlays);
  const elevationLayerEnabled = useMapStore((s) => s.elevation_layer_enabled);
  const setElevationLayerEnabled = useMapStore((s) => s.setElevationLayerEnabled);
  const coverageHatchMode = useMapStore((s) => s.coverageHatchMode);
  const setCoverageHatchMode = useMapStore((s) => s.setCoverageHatchMode);
  const satelliteMode = useMapStore((s) => s.satelliteMode);
  const setSatelliteMode = useMapStore((s) => s.setSatelliteMode);
  const dirty = usePlanStore((s) => s.dirty);
  const clearDirty = usePlanStore((s) => s.clearDirty);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = useCallback(() => {
    setSaveStatus('saved');
    clearDirty();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
  }, [clearDirty]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  const api = getAPIClient();

  // ---- Load catalog data from API on mount and when catalog modal closes ----
  const loadCatalogData = useCallback(async () => {
    try {
      const [devices, antennas, cables, paModules, regions, presets, fwDefaults] = await Promise.all([
        api.getCatalogDevices(),
        api.getCatalogAntennas(),
        api.getCatalogCables(),
        api.getCatalogPAModules(),
        api.getRegulatoryPresets(),
        api.getModemPresets(),
        api.getFirmwareDefaults(),
      ]);
      setCatalogDevices(devices);
      setCatalogAntennas(antennas);
      setCatalogCables(cables);
      setCatalogPAModules(paModules);
      setCatalogRegions(regions);
      setCatalogModemPresets(presets);
      setCatalogFirmwareDefaults(fwDefaults);
    } catch (err) {
      console.error('Failed to load catalog data:', err);
    }
  }, [api]);

  useEffect(() => { loadCatalogData(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Probe internet connectivity once on startup — result gates the Import Nodes (Internet) menu item
  useEffect(() => {
    const token = (window as any).__MESH_PLANNER_AUTH__;
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/import/internet-map/ping', { headers })
      .then((r) => r.json())
      .then((data) => setIsInternetOnline(!!data.online))
      .catch(() => setIsInternetOnline(false));
  }, []);

  const handleCatalogClose = useCallback(() => {
    setCatalogModalOpen(false);
    loadCatalogData(); // refresh dropdowns after catalog edits
  }, [loadCatalogData]);

  const selectedNode = nodes.find((n) => String(n.id) === selectedNodeId) || null;

  // ---- Auto-recompute coverage when node params change ----
  const recomputeCoverageIfActive = useCallback(() => {
    const overlays = useMapStore.getState().coverage_overlays;
    if (overlays.length === 0) return;

    const latestNodes = usePlanStore.getState().nodes;
    const overlayNodeIds = new Set(overlays.map((o) => o.nodeUuid));
    const updated: CoverageOverlay[] = [];

    for (const ov of overlays) {
      const node = latestNodes.find((n) => String(n.id) === ov.nodeUuid);
      if (!node) continue;
      const result = computeRealisticCoverageM(
        node.tx_power_dbm,
        node.device_id,
        node.frequency_mhz,
        node.spreading_factor,
        node.bandwidth_khz,
        node.antenna_height_m,
        coverageEnv,
      );
      updated.push({
        id: ov.id,
        nodeUuid: ov.nodeUuid,
        nodeName: node.name,
        coverageRadiusM: Math.round(result.radiusM),
        engine: `log-distance (${COVERAGE_ENVIRONMENTS[coverageEnv]?.label || 'Suburban'}, n=${COVERAGE_ENVIRONMENTS[coverageEnv]?.pathLossExponent})`,
      });
    }

    setCoverageOverlays(updated);
  }, [coverageEnv, setCoverageOverlays]);

  // ---- Auto-recompute LOS when node positions/params change ----
  const recomputeLOSIfActive = useCallback(async () => {
    const overlays = useMapStore.getState().los_overlays;
    if (overlays.length === 0) return;

    setStatusMessage('Updating LOS analysis...');
    const latestNodes = usePlanStore.getState().nodes;
    const updated: LOSOverlay[] = [];

    for (const ov of overlays) {
      const nodeA = latestNodes.find((n) => String(n.id) === ov.nodeAUuid);
      const nodeB = latestNodes.find((n) => String(n.id) === ov.nodeBUuid);
      if (!nodeA || !nodeB) continue;

      try {
        const result = await api.getLOSProfile(nodeA, nodeB);
        updated.push({
          ...ov,
          nodeAName: nodeA.name,
          nodeBName: nodeB.name,
          isViable: result.is_viable,
          linkQuality: result.link_quality || 'unknown',
          distanceM: result.distance_m,
          linkMarginDb: result.link_margin_db || 0,
          receivedSignalDbm: result.received_signal_dbm || 0,
          hasLos: result.has_los !== false,
          fresnelClearancePct: result.fresnel_clearance_pct || 0,
          maxObstructionM: result.max_obstruction_m || 0,
          additionalLossDb: result.estimated_additional_loss_db || 0,
          totalPathLossDb: result.total_path_loss_db || 0,
          freeSpaceLossDb: result.free_space_loss_db || 0,
          elevationSource: result.elevation_source || 'flat_terrain',
          elevationMinM: result.elevation_min_m || 0,
          elevationMaxM: result.elevation_max_m || 0,
        });
      } catch {
        updated.push(ov); // keep old data on error
      }
    }

    if (updated.length > 0) {
      setLOSOverlays(updated);
      const viable = updated.filter((o) => o.isViable).length;
      const clearLos = updated.filter((o) => o.hasLos).length;
      setStatusMessage(`LOS updated: ${updated.length} link(s), ${viable} viable, ${clearLos} clear.`);
    }
  }, [api, setLOSOverlays]);

  // Debounced LOS recompute when node positions or antenna heights change
  const losRecomputeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodePositionKey = nodes.map(
    (n) => `${n.id}:${n.latitude.toFixed(5)}:${n.longitude.toFixed(5)}:${n.antenna_height_m}:${n.tx_power_dbm}:${n.frequency_mhz}`
  ).join('|');

  useEffect(() => {
    if (losOverlays.length === 0) return;
    // Debounce 800ms after last position change before re-querying backend
    if (losRecomputeRef.current) clearTimeout(losRecomputeRef.current);
    losRecomputeRef.current = setTimeout(() => {
      recomputeLOSIfActive();
    }, 800);
    return () => {
      if (losRecomputeRef.current) clearTimeout(losRecomputeRef.current);
    };
  }, [nodePositionKey]); // only fires when positions/radio params actually change

  // Cleanup LOS recompute timer on unmount
  useEffect(() => {
    return () => { if (losRecomputeRef.current) clearTimeout(losRecomputeRef.current); };
  }, []);

  // Read current network radio settings from the first node (all nodes should be identical)
  const refNode = nodes.length > 0 ? nodes[0] : null;
  const networkRadio = {
    firmware: refNode?.firmware || 'meshtastic',
    region: refNode?.region || currentPlan?.region || 'us_fcc',
    frequency_mhz: refNode?.frequency_mhz || REGION_FREQUENCIES[currentPlan?.region || 'us_fcc'] || 906.875,
    spreading_factor: refNode?.spreading_factor || 11,
    bandwidth_khz: refNode?.bandwidth_khz || 250,
    coding_rate: (refNode?.coding_rate || '4/5') as string,
  };
  const currentPreset = detectPreset(networkRadio.spreading_factor, networkRadio.bandwidth_khz, networkRadio.coding_rate);

  // ---- Auto-calculate node range from radio config (for Placement tool) ----
  // Uses the realistic log-distance path loss model + radio horizon cap
  // (same model as coverage analysis) instead of raw FSPL.
  const nodeRangeInfo = useMemo(() => {
    if (!refNode) return { rangeM: 1000, description: 'No nodes configured' };

    const txPower = refNode.tx_power_dbm || 22;
    const antennaHeight = refNode.antenna_height_m || 3;
    const env = COVERAGE_ENVIRONMENTS[coverageEnv] || COVERAGE_ENVIRONMENTS['suburban'];

    const result = computeRealisticCoverageM(
      txPower,
      refNode.device_id || 'tbeam-supreme',
      networkRadio.frequency_mhz,
      networkRadio.spreading_factor,
      networkRadio.bandwidth_khz,
      antennaHeight,
      coverageEnv,
    );

    const rangeM = Math.max(Math.round(result.radiusM), 100);
    const presetLabel = currentPreset || `SF${networkRadio.spreading_factor}/${networkRadio.bandwidth_khz}kHz`;
    const deviceLabel = refNode.device_id || 'Unknown device';
    const rangeStr = rangeM >= 1000 ? `${(rangeM / 1000).toFixed(1)} km` : `${rangeM} m`;
    const description = `${rangeStr} (${presetLabel}, ${deviceLabel}, ${env.label})`;

    return { rangeM, description };
  }, [nodes, networkRadio, coverageEnv, currentPreset]);

  // ---- Apply radio setting to ALL nodes in the plan ----
  const applyNetworkRadio = useCallback(async (updates: Partial<Node>) => {
    const currentNodes = usePlanStore.getState().nodes;
    const plan = usePlanStore.getState().current_plan;

    // Update all nodes locally
    for (const node of currentNodes) {
      updateNodeStore(String(node.id), updates);
    }

    // Persist all to API
    if (plan) {
      for (const node of currentNodes) {
        const nodeId = String(node.id);
        if (!nodeId.startsWith('temp-')) {
          api.updateNode(plan.id, nodeId, updates)
            .catch((err: any) => console.error(`Failed to update node ${nodeId}:`, err));
        }
      }
    }

    setStatusMessage(`Network radio updated across ${currentNodes.length} node(s).`);
    recomputeCoverageIfActive();
    flashSaved();
  }, [api, updateNodeStore, recomputeCoverageIfActive, flashSaved]);

  // ---- Plan Actions ----

  const fitBoundsToNodes = useCallback((nodeList: Node[]) => {
    if (nodeList.length === 0) return;
    const lats = nodeList.map((n) => n.latitude);
    const lngs = nodeList.map((n) => n.longitude);
    const sw: [number, number] = [Math.min(...lats), Math.min(...lngs)];
    const ne: [number, number] = [Math.max(...lats), Math.max(...lngs)];
    requestFitBounds([sw, ne]);
  }, [requestFitBounds]);

  const handleNewPlan = useCallback(() => {
    setPromptDialog({
      message: 'Enter a name for the new plan:',
      defaultValue: 'My Mesh Plan',
      onSubmit: async (name: string) => {
        setPromptDialog(null);
        setStatusMessage('Creating plan...');
        try {
          const plan = await api.createPlan({ name, description: '', firmware_family: 'meshtastic', region: 'us_fcc' });
          setPlan(plan);
          setNodes([]);
          setMode('view');
          setShowPlanList(false);
          setStatusMessage(`Plan "${plan.name}" created. Use "Add Node" to place nodes on the map.`);
        } catch (err: any) {
          setStatusMessage(`Error: ${err.message}`);
        }
      },
    });
  }, [api, setPlan, setNodes, setMode]);

  const handleOpenPlan = useCallback(async () => {
    setStatusMessage('Loading plans...');
    setCheckedPlanIds(new Set());
    try {
      const planList = await api.listPlans();
      setPlans(planList);
      setStatusMessage(planList.length > 0 ? `${planList.length} plan(s) found` : 'No plans found.');
    } catch (err: any) {
      setPlans([]);
      setStatusMessage(`Error loading plans: ${err.message}`);
    } finally {
      setShowPlanList(true);
    }
  }, [api]);

  const handleSelectPlan = useCallback(async (plan: Plan) => {
    setStatusMessage(`Loading "${plan.name}"...`);
    try {
      setPlan(plan);
      setLoadedPlanObjects([plan]);
      const resp = await api.listNodes(plan.id);
      const nodeList = Array.isArray(resp) ? resp : (resp as any).items || [];
      setNodes(nodeList);
      setShowPlanList(false);
      setCheckedPlanIds(new Set());
      setMode('view');
      clearLOSOverlays();
      clearCoverageOverlays();
      // Collapse sidebar sections on load (except Nodes)
      setConfigCollapsed(true);
      setRadioCollapsed(true);
      setNodesCollapsed(false);
      setDescExpanded(false);
      fitBoundsToNodes(nodeList);
      setStatusMessage(`"${plan.name}" loaded (${nodeList.length} nodes). Use "Add Node" to place nodes.`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  }, [api, setPlan, setNodes, setMode, clearLOSOverlays, clearCoverageOverlays, fitBoundsToNodes]);

  const handleOpenMultiplePlans = useCallback(async (planIds: Set<string>) => {
    const selectedPlans = plans.filter((p) => planIds.has(p.id));
    if (selectedPlans.length === 0) return;
    setStatusMessage(`Loading ${selectedPlans.length} plan(s)...`);
    try {
      let allNodes: Node[] = [];
      for (const plan of selectedPlans) {
        const resp = await api.listNodes(plan.id);
        const nodeList = Array.isArray(resp) ? resp : (resp as any).items || [];
        allNodes = allNodes.concat(nodeList);
      }
      // Use first plan as the "active" plan for sidebar
      setPlan(selectedPlans[0]);
      setLoadedPlanObjects(selectedPlans);
      setNodes(allNodes);
      setShowPlanList(false);
      setCheckedPlanIds(new Set());
      setMode('view');
      clearLOSOverlays();
      clearCoverageOverlays();
      // Collapse sidebar sections on load (except Nodes)
      setConfigCollapsed(true);
      setRadioCollapsed(true);
      setNodesCollapsed(false);
      setDescExpanded(false);
      fitBoundsToNodes(allNodes);
      const planNames = selectedPlans.map((p) => p.name).join(', ');
      setStatusMessage(`Loaded ${selectedPlans.length} plan(s): ${planNames} (${allNodes.length} total nodes).`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  }, [api, plans, setPlan, setNodes, setMode, clearLOSOverlays, clearCoverageOverlays, fitBoundsToNodes]);

  // ---- Import / Export ----

  const handleExportPlan = useCallback(async () => {
    if (!currentPlan) return;
    setStatusMessage('Exporting plan...');
    try {
      const planNodes = usePlanStore.getState().nodes;
      const exportData = {
        version: '0.1.0',
        exported_at: new Date().toISOString(),
        plan: {
          name: currentPlan.name,
          description: currentPlan.description || '',
          firmware_family: currentPlan.firmware_family,
          region: currentPlan.region,
        },
        nodes: planNodes.map((n) => ({
          name: n.name,
          latitude: n.latitude,
          longitude: n.longitude,
          antenna_height_m: n.antenna_height_m,
          device_id: n.device_id,
          firmware: n.firmware,
          region: n.region,
          frequency_mhz: n.frequency_mhz,
          tx_power_dbm: n.tx_power_dbm,
          spreading_factor: n.spreading_factor,
          bandwidth_khz: n.bandwidth_khz,
          coding_rate: n.coding_rate,
          modem_preset: n.modem_preset,
          antenna_id: n.antenna_id,
          cable_id: n.cable_id,
          cable_length_m: n.cable_length_m,
          pa_module_id: n.pa_module_id,
          is_solar: n.is_solar,
          desired_coverage_radius_m: n.desired_coverage_radius_m,
          notes: n.notes,
          sort_order: n.sort_order,
        })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `${sanitizeFilename(currentPlan.name)}.meshplan.json`);
      setStatusMessage(`Exported "${currentPlan.name}" with ${planNodes.length} node(s).`);
    } catch (err: any) {
      setStatusMessage(`Export error: ${err.message}`);
    }
  }, [currentPlan]);

  const handleImportPlan = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.meshplan.json';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length === 0) return;

      setStatusMessage(`Importing ${files.length} plan(s)...`);
      try {
        const existingPlans = await api.listPlans();
        const existingNames = new Set(existingPlans.map((p: Plan) => p.name));

        let imported = 0;
        let skipped = 0;
        let lastPlan: Plan | null = null;
        let lastNodes: Node[] = [];

        for (const file of files) {
          try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.plan?.name) {
              skipped++;
              continue;
            }

            let planName = data.plan.name;
            if (existingNames.has(planName)) {
              planName = `${planName} (copy)`;
            }

            const plan = await api.createPlan({
              name: planName,
              description: data.plan.description || '',
              firmware_family: data.plan.firmware_family || 'meshtastic',
              region: data.plan.region || 'us_fcc',
            });

            const importedNodes: Node[] = [];
            if (Array.isArray(data.nodes)) {
              for (const nd of data.nodes) {
                try {
                  const created = await api.createNode(plan.id, {
                    name: nd.name || 'Imported Node',
                    latitude: nd.latitude,
                    longitude: nd.longitude,
                    antenna_height_m: nd.antenna_height_m ?? 3,
                    device_id: nd.device_id || 'tbeam-supreme',
                    firmware: nd.firmware || 'meshtastic',
                    region: nd.region || plan.region || 'us_fcc',
                    frequency_mhz: nd.frequency_mhz ?? 906.875,
                    tx_power_dbm: nd.tx_power_dbm ?? 20,
                    spreading_factor: nd.spreading_factor ?? 11,
                    bandwidth_khz: nd.bandwidth_khz ?? 250,
                    coding_rate: nd.coding_rate || '4/5',
                    modem_preset: nd.modem_preset || null,
                    antenna_id: nd.antenna_id || '915-3dbi-omni',
                    cable_id: nd.cable_id || null,
                    cable_length_m: nd.cable_length_m ?? 0,
                    pa_module_id: nd.pa_module_id || null,
                    is_solar: nd.is_solar ?? false,
                    desired_coverage_radius_m: nd.desired_coverage_radius_m ?? null,
                    notes: nd.notes || '',
                  });
                  importedNodes.push(created);
                } catch (nodeErr: any) {
                  console.error(`Failed to import node "${nd.name}":`, nodeErr);
                }
              }
            }

            existingNames.add(planName);
            imported++;
            lastPlan = plan;
            lastNodes = importedNodes;
          } catch (fileErr: any) {
            console.error(`Failed to import file "${file.name}":`, fileErr);
            skipped++;
          }
        }

        if (lastPlan) {
          setPlan(lastPlan);
          setNodes(lastNodes);
          setMode('view');
          setShowPlanList(false);
          clearLOSOverlays();
          clearCoverageOverlays();
        }
        setStatusMessage(`Imported ${imported} plan(s).${skipped ? ` ${skipped} skipped.` : ''}`);
      } catch (err: any) {
        setStatusMessage(`Import error: ${err.message}`);
      }
    };
    input.click();
  }, [api, setPlan, setNodes, setMode, clearLOSOverlays, clearCoverageOverlays]);

  // ---- CSV Export/Import ----

  const handleExportCSV = useCallback(() => {
    if (!currentPlan) return;
    try {
      const planNodes = usePlanStore.getState().nodes;
      const csvStr = exportNodesCSV(planNodes);
      const blob = new Blob([csvStr], { type: 'text/csv' });
      triggerDownload(blob, `${sanitizeFilename(currentPlan.name)}_nodes.csv`);
      setStatusMessage(`Exported ${planNodes.length} node(s) as CSV.`);
    } catch (err: any) {
      setErrorMsg(`CSV export error: ${err.message}`);
    }
  }, [currentPlan]);

  const handleImportCSV = useCallback(() => {
    if (!currentPlan) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setStatusMessage('Importing CSV...');
      try {
        const text = await file.text();
        const refNode = usePlanStore.getState().nodes[0];
        const defaults: Partial<Node> = {
          antenna_height_m: refNode?.antenna_height_m ?? 3,
          device_id: refNode?.device_id || 'tbeam-supreme',
          firmware: refNode?.firmware || (currentPlan.firmware_family as any) || 'meshtastic',
          region: refNode?.region || (currentPlan.region as any) || 'us_fcc',
          frequency_mhz: refNode?.frequency_mhz ?? 906.875,
          tx_power_dbm: refNode?.tx_power_dbm ?? 20,
          spreading_factor: refNode?.spreading_factor ?? 11,
          bandwidth_khz: refNode?.bandwidth_khz ?? 250,
          coding_rate: refNode?.coding_rate || '4/5',
          antenna_id: refNode?.antenna_id || '915-3dbi-omni',
          is_solar: false,
        };
        const { nodes: parsedNodes, errors } = parseNodesCSV(text, defaults);
        if (errors.length > 0 && parsedNodes.length === 0) {
          setErrorMsg(`CSV import failed:\n${errors.join('\n')}`);
          return;
        }
        let created = 0;
        const newNodes: Node[] = [];
        for (const nd of parsedNodes) {
          try {
            const node = await api.createNode(currentPlan.id, {
              name: nd.name || 'Imported Node',
              latitude: nd.latitude!,
              longitude: nd.longitude!,
              antenna_height_m: nd.antenna_height_m ?? 3,
              device_id: nd.device_id || defaults.device_id!,
              firmware: nd.firmware || defaults.firmware!,
              region: nd.region || defaults.region!,
              frequency_mhz: nd.frequency_mhz ?? defaults.frequency_mhz!,
              tx_power_dbm: nd.tx_power_dbm ?? defaults.tx_power_dbm!,
              spreading_factor: nd.spreading_factor ?? defaults.spreading_factor!,
              bandwidth_khz: nd.bandwidth_khz ?? defaults.bandwidth_khz!,
              coding_rate: nd.coding_rate || defaults.coding_rate!,
              modem_preset: nd.modem_preset ?? null,
              antenna_id: nd.antenna_id || defaults.antenna_id!,
              cable_id: nd.cable_id ?? null,
              cable_length_m: nd.cable_length_m ?? 0,
              pa_module_id: nd.pa_module_id ?? null,
              is_solar: nd.is_solar ?? false,
              desired_coverage_radius_m: nd.desired_coverage_radius_m ?? null,
              notes: nd.notes || '',
            });
            newNodes.push(node);
            created++;
          } catch (err: any) {
            console.error(`CSV import: failed to create node "${nd.name}":`, err);
          }
        }
        // Add to store
        const existingNodes = usePlanStore.getState().nodes;
        setNodes([...existingNodes, ...newNodes]);
        if (newNodes.length > 0) fitBoundsToNodes([...existingNodes, ...newNodes]);
        const errText = errors.length > 0 ? ` (${errors.length} warning(s))` : '';
        setStatusMessage(`Imported ${created} node(s) from CSV${errText}.`);
      } catch (err: any) {
        setErrorMsg(`CSV import error: ${err.message}`);
      }
    };
    input.click();
  }, [api, currentPlan, setNodes, fitBoundsToNodes, setErrorMsg, setStatusMessage]);

  const handleImportJSON = useCallback(() => {
    if (!currentPlan) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setStatusMessage('Importing JSON...');
      try {
        const text = await file.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch (err: any) {
          setErrorMsg(`JSON import error: Invalid JSON - ${err.message}`);
          return;
        }

        if (!data || !Array.isArray(data.layers)) {
          setErrorMsg('JSON import error: Expected an object with a "layers" array.');
          return;
        }

        const refNode = usePlanStore.getState().nodes[0];
        const defaults: Partial<Node> = {
          antenna_height_m: refNode?.antenna_height_m ?? 3,
          device_id: refNode?.device_id || 'tbeam-supreme',
          firmware: refNode?.firmware || (currentPlan.firmware_family as any) || 'meshtastic',
          region: refNode?.region || (currentPlan.region as any) || 'us_fcc',
          frequency_mhz: refNode?.frequency_mhz ?? 906.875,
          tx_power_dbm: refNode?.tx_power_dbm ?? 20,
          spreading_factor: refNode?.spreading_factor ?? 11,
          bandwidth_khz: refNode?.bandwidth_khz ?? 250,
          coding_rate: refNode?.coding_rate || '4/5',
          antenna_id: refNode?.antenna_id || '915-3dbi-omni',
          is_solar: false,
        };

        const errors: string[] = [];
        const candidates: {
          name: string;
          latitude: number;
          longitude: number;
          antenna_height_m?: number;
        }[] = [];

        data.layers.forEach((layer: any, idx: number) => {
          const rowIdx = idx + 1;
          if (!layer || typeof layer !== 'object') {
            errors.push(`Layer ${rowIdx}: not an object`);
            return;
          }
          const name = typeof layer.name === 'string' && layer.name.trim() !== ''
            ? layer.name.trim()
            : `Imported Node ${rowIdx}`;

          const lat = typeof layer.latitude === 'number' ? layer.latitude : parseFloat(String(layer.latitude));
          const lon = typeof layer.longitude === 'number' ? layer.longitude : parseFloat(String(layer.longitude));

          if (isNaN(lat) || lat < -90 || lat > 90) {
            errors.push(`Layer ${rowIdx}: invalid latitude "${layer.latitude}"`);
            return;
          }
          if (isNaN(lon) || lon < -180 || lon > 180) {
            errors.push(`Layer ${rowIdx}: invalid longitude "${layer.longitude}"`);
            return;
          }

          let antennaHeight: number | undefined;
          if (layer.antenna_height_a !== undefined && layer.antenna_height_a !== null) {
            const ah = typeof layer.antenna_height_a === 'number'
              ? layer.antenna_height_a
              : parseFloat(String(layer.antenna_height_a));
            if (!isNaN(ah)) {
              antennaHeight = ah;
            }
          }

          candidates.push({
            name,
            latitude: lat,
            longitude: lon,
            antenna_height_m: antennaHeight,
          });
        });

        if (candidates.length === 0) {
          setErrorMsg(`JSON import failed: no valid layers found.${errors.length ? `\n${errors.join('\n')}` : ''}`);
          return;
        }

        let created = 0;
        const newNodes: Node[] = [];
        for (const nd of candidates) {
          try {
            const node = await api.createNode(currentPlan.id, {
              name: nd.name || 'Imported Node',
              latitude: nd.latitude,
              longitude: nd.longitude,
              antenna_height_m: nd.antenna_height_m ?? defaults.antenna_height_m ?? 3,
              device_id: defaults.device_id!,
              firmware: defaults.firmware!,
              region: defaults.region!,
              frequency_mhz: defaults.frequency_mhz!,
              tx_power_dbm: defaults.tx_power_dbm!,
              spreading_factor: defaults.spreading_factor!,
              bandwidth_khz: defaults.bandwidth_khz!,
              coding_rate: defaults.coding_rate! as any,
              modem_preset: null,
              antenna_id: defaults.antenna_id!,
              cable_id: null,
              cable_length_m: 0,
              pa_module_id: null,
              is_solar: false,
              desired_coverage_radius_m: null,
              notes: '',
            });
            newNodes.push(node);
            created++;
          } catch (err: any) {
            console.error(`JSON import: failed to create node "${nd.name}":`, err);
          }
        }

        const existingNodes = usePlanStore.getState().nodes;
        setNodes([...existingNodes, ...newNodes]);
        if (newNodes.length > 0) {
          fitBoundsToNodes([...existingNodes, ...newNodes]);
        }
        const errText = errors.length > 0 ? ` (${errors.length} warning(s))` : '';
        setStatusMessage(`Imported ${created} node(s) from JSON${errText}.`);
      } catch (err: any) {
        setErrorMsg(`JSON import error: ${err.message}`);
      }
    };
    input.click();
  }, [api, currentPlan, setNodes, fitBoundsToNodes]);

  // ---- KML Export ----

  const handleExportKML = useCallback(() => {
    if (!currentPlan) return;
    try {
      const planNodes = usePlanStore.getState().nodes;
      const currentLOS = useMapStore.getState().los_overlays;

      // Build KML link data from LOS overlays
      let kmlLinks: KMLLink[] | undefined;
      if (currentLOS.length > 0) {
        kmlLinks = [];
        for (const ov of currentLOS) {
          const nodeA = planNodes.find((n) => String(n.id) === ov.nodeAUuid);
          const nodeB = planNodes.find((n) => String(n.id) === ov.nodeBUuid);
          if (nodeA && nodeB) {
            kmlLinks.push({
              nodeAName: ov.nodeAName,
              nodeBName: ov.nodeBName,
              nodeALat: nodeA.latitude,
              nodeALon: nodeA.longitude,
              nodeAAlt: nodeA.antenna_height_m,
              nodeBLat: nodeB.latitude,
              nodeBLon: nodeB.longitude,
              nodeBAlt: nodeB.antenna_height_m,
              distanceM: ov.distanceM,
              linkQuality: ov.linkQuality,
              isViable: ov.isViable,
              receivedSignalDbm: ov.receivedSignalDbm,
              fresnelClearancePct: ov.fresnelClearancePct,
            });
          }
        }
      }

      const kmlStr = exportKML(planNodes, currentPlan.name, kmlLinks);
      const blob = new Blob([kmlStr], { type: 'application/vnd.google-earth.kml+xml' });
      triggerDownload(blob, `${sanitizeFilename(currentPlan.name)}.kml`);
      setKmlExportDialog({ nodeCount: planNodes.length, linkCount: kmlLinks?.length ?? 0 });
    } catch (err: any) {
      setErrorMsg(`KML export error: ${err.message}`);
    }
  }, [currentPlan]);

  const handleExportGeoJSON = useCallback(() => {
    if (!currentPlan) return;
    try {
      const planNodes = usePlanStore.getState().nodes;
      const currentLOS = useMapStore.getState().los_overlays;

      // Build GeoJSON link data from LOS overlays
      let geojsonLinks: GeoJSONLink[] | undefined;
      if (currentLOS.length > 0) {
        geojsonLinks = [];
        for (const ov of currentLOS) {
          const nodeA = planNodes.find((n) => String(n.id) === ov.nodeAUuid);
          const nodeB = planNodes.find((n) => String(n.id) === ov.nodeBUuid);
          if (nodeA && nodeB) {
            geojsonLinks.push({
              nodeAName: ov.nodeAName,
              nodeBName: ov.nodeBName,
              nodeALat: nodeA.latitude,
              nodeALon: nodeA.longitude,
              nodeBLat: nodeB.latitude,
              nodeBLon: nodeB.longitude,
              distanceM: ov.distanceM,
              linkQuality: ov.linkQuality,
              isViable: ov.isViable,
              receivedSignalDbm: ov.receivedSignalDbm,
              fresnelClearancePct: ov.fresnelClearancePct,
            });
          }
        }
      }

      const geojsonStr = exportGeoJSON(planNodes, currentPlan.name, geojsonLinks);
      const blob = new Blob([geojsonStr], { type: 'application/geo+json' });
      triggerDownload(blob, `${sanitizeFilename(currentPlan.name)}.geojson`);
      const linkNote = geojsonLinks && geojsonLinks.length > 0 ? ` with ${geojsonLinks.length} link(s)` : '';
      setStatusMessage(`Exported ${planNodes.length} node(s) as GeoJSON${linkNote}.`);
    } catch (err: any) {
      setErrorMsg(`GeoJSON export error: ${err.message}`);
    }
  }, [currentPlan]);


  const handlePlacementSuggest = useCallback(async (params: {
    existing_nodes: Array<{ latitude: number; longitude: number; name: string }>;
    bounds: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
    coverage_radius_m: number;
    grid_resolution_m: number;
    max_candidates: number;
  }) => {
    const result = await api.suggestPlacement(params);
    return (result.candidates || []).map((c: any) => ({
      latitude: c.latitude,
      longitude: c.longitude,
      score: c.score,
      coverage_gain_km2: c.coverage_gain_km2 || 0,
      reason: c.reason || '',
    }));
  }, [api]);

  const handleAcceptPlacementNode = useCallback(async (lat: number, lon: number, name: string) => {
    if (!currentPlan) return;
    const refNode = usePlanStore.getState().nodes[0];
    try {
      const node = await api.createNode(currentPlan.id, {
        name,
        latitude: lat,
        longitude: lon,
        antenna_height_m: 3,
        device_id: refNode?.device_id || 'tbeam-supreme',
        firmware: refNode?.firmware || 'meshtastic',
        region: refNode?.region || currentPlan.region || 'us_fcc',
        frequency_mhz: refNode?.frequency_mhz || 906.875,
        tx_power_dbm: refNode?.tx_power_dbm || 20,
        spreading_factor: refNode?.spreading_factor || 11,
        bandwidth_khz: refNode?.bandwidth_khz || 250,
        coding_rate: refNode?.coding_rate || '4/5',
        modem_preset: null,
        antenna_id: refNode?.antenna_id || '915-3dbi-omni',
        cable_id: null,
        cable_length_m: 0,
        pa_module_id: null,
        is_solar: false,
        desired_coverage_radius_m: null,
        notes: '',
      });
      const existingNodes = usePlanStore.getState().nodes;
      setNodes([...existingNodes, node]);
      setStatusMessage(`Node "${name}" created at ${lat.toFixed(5)}, ${lon.toFixed(5)}.`);
    } catch (err: any) {
      setErrorMsg(`Failed to create node: ${err.message}`);
    }
  }, [api, currentPlan, setNodes]);

  const handlePDFReportGenerate = useCallback(async (config: {
    sections: string[];
    page_size: 'letter' | 'A4';
    include_executive_summary: boolean;
    include_bom_summary: boolean;
    include_recommendations: boolean;
  }) => {
    if (!currentPlan) return;
    setStatusMessage('Generating Network Report PDF...');
    try {
      // Capture map screenshot
      let screenshotBase64 = '';
      const mapEl = document.querySelector('.map-container') as HTMLElement | null;
      if (mapEl) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          screenshotBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
        } catch {
          console.warn('Map screenshot capture failed.');
        }
      }

      const planNodes = usePlanStore.getState().nodes;
      const reportNodes = planNodes.map((n) => ({
        name: n.name, latitude: n.latitude, longitude: n.longitude,
        antenna_height_m: n.antenna_height_m, device_id: n.device_id,
        firmware: n.firmware, region: n.region, frequency_mhz: n.frequency_mhz,
        tx_power_dbm: n.tx_power_dbm, spreading_factor: n.spreading_factor,
        bandwidth_khz: n.bandwidth_khz, coding_rate: n.coding_rate,
        modem_preset: n.modem_preset || null, is_solar: n.is_solar, notes: n.notes || '',
      }));

      const currentLOS = useMapStore.getState().los_overlays;
      const reportLinks = currentLOS.map((ov) => ({
        nodeAName: ov.nodeAName, nodeBName: ov.nodeBName,
        isViable: ov.isViable, linkQuality: ov.linkQuality,
        distanceM: ov.distanceM, linkMarginDb: ov.linkMarginDb,
        receivedSignalDbm: ov.receivedSignalDbm, hasLos: ov.hasLos,
        fresnelClearancePct: ov.fresnelClearancePct, maxObstructionM: ov.maxObstructionM,
        totalPathLossDb: ov.totalPathLossDb, freeSpaceLossDb: ov.freeSpaceLossDb,
        elevationSource: ov.elevationSource,
      }));

      const blob = await api.exportNetworkReportPDF({
        plan_name: currentPlan.name,
        plan_description: currentPlan.description || '',
        nodes: reportNodes,
        links: reportLinks,
        map_screenshot_base64: screenshotBase64,
        include_executive_summary: config.include_executive_summary,
        include_bom_summary: config.include_bom_summary,
        include_recommendations: config.include_recommendations,
        page_size: config.page_size,
        sections: config.sections,
      });

      triggerDownload(blob, `${sanitizeFilename(currentPlan.name)}_network_report.pdf`);
      setStatusMessage('Network Report PDF exported successfully.');
    } catch (err: any) {
      console.error('Network report PDF export failed:', err);
      throw err;
    }
  }, [api, currentPlan]);

  const handleClosePlan = useCallback(() => {
    clearPlan();
    setLoadedPlanObjects([]);
    setMode('view');
    clearNodeSelection();
    setShowPlanList(false);
    setEditingPlan(false);
    clearLOSOverlays();
    clearCoverageOverlays();
    setStatusMessage('Ready');
  }, [clearPlan, setMode, clearNodeSelection, clearLOSOverlays, clearCoverageOverlays]);

  const handleDeletePlan = useCallback(() => {
    if (!currentPlan) return;
    const planName = currentPlan.name;
    const planId = currentPlan.id;
    setConfirmDialog({
      message: `Permanently delete plan "${planName}" and all its nodes? This cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        setStatusMessage(`Deleting "${planName}"...`);
        try {
          await api.deletePlan(planId);
          clearPlan();
          setLoadedPlanObjects([]);
          setMode('view');
          clearNodeSelection();
          setShowPlanList(false);
          setEditingPlan(false);
          clearLOSOverlays();
          clearCoverageOverlays();
          setStatusMessage(`Plan "${planName}" deleted.`);
        } catch (err: any) {
          setStatusMessage(`Error deleting plan: ${err.message}`);
        }
      },
    });
  }, [api, currentPlan, clearPlan, setMode, clearNodeSelection, clearLOSOverlays, clearCoverageOverlays]);

  // ---- Exit App handler ----
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const handleExitApp = useCallback(() => {
    setExitDialogOpen(true);
  }, []);
  const handleExitConfirm = useCallback(() => {
    setExitDialogOpen(false);
    // Flag so the beforeunload handler skips the browser's native dialog
    (window as any).__exitConfirmed = true;
    // Send shutdown request to kill the backend server
    const token = (window as any).__MESH_PLANNER_AUTH__;
    if (token) {
      fetch('/api/shutdown', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        keepalive: true,
      }).catch(() => {});
    }
    // Try to close the tab/window. On macOS browsers this may fail
    // silently because the tab was not opened by JavaScript.
    // If window.close() doesn't work, replace the page with a
    // "safe to close" message so the user knows the app has shut down.
    setTimeout(() => {
      window.close();
      // If we're still here after 500ms, the browser blocked window.close()
      setTimeout(() => {
        document.title = 'Mesh Community Planner — Closed';
        document.body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100vh;' +
          'background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;text-align:center">' +
          '<div><h2 style="margin-bottom:0.5rem">Mesh Community Planner has shut down.</h2>' +
          '<p style="color:#999">You can close this browser tab.</p></div></div>';
      }, 500);
    }, 200);
  }, []);

  const handleEditPlan = useCallback(() => {
    if (!currentPlan) return;
    setPlanName(currentPlan.name);
    setPlanDesc(currentPlan.description || '');
    setEditingPlan(true);
  }, [currentPlan]);

  const handleSavePlan = useCallback(async () => {
    if (!currentPlan) return;
    setStatusMessage('Saving plan...');
    try {
      const updated = await api.updatePlan(currentPlan.id, { name: planName, description: planDesc });
      updatePlanStore({ name: updated.name, description: updated.description });
      setEditingPlan(false);
      setStatusMessage(`Plan "${updated.name}" saved.`);
      flashSaved();
    } catch (err: any) {
      setStatusMessage(`Error saving: ${err.message}`);
    }
  }, [api, currentPlan, planName, planDesc, updatePlanStore, flashSaved]);

  // ---- Node Actions ----

  const handleToggleAddNode = useCallback(() => {
    if (mapMode === 'add_node') {
      setMode('view');
      setStatusMessage('Add Node mode OFF.');
    } else {
      setMode('add_node');
      setStatusMessage('Add Node mode ON. Click the map to place nodes.');
    }
  }, [mapMode, setMode]);

  const handleDeleteNode = useCallback((node: Node) => {
    if (!currentPlan) return;
    const nodeName = node.name;
    const nodeId = String(node.id);
    const planId = currentPlan.id;
    setConfirmDialog({
      message: `Delete node "${nodeName}"?`,
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        setStatusMessage(`Deleting "${nodeName}"...`);
        removeNodeStore(nodeId);
        if (selectedNodeId === nodeId) selectNode(null);

        if (!nodeId.startsWith('temp-')) {
          try {
            await api.deleteNode(planId, nodeId);
          } catch (err: any) {
            console.error('Server delete failed:', err);
          }
        }
        setStatusMessage(`Node "${nodeName}" deleted.`);
      },
    });
  }, [api, currentPlan, removeNodeStore, selectedNodeId, selectNode]);

  // Delete/Backspace keyboard shortcut for selected node
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      // Don't trigger if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const sid = useMapStore.getState().selected_node_id;
      if (!sid) return;
      const plan = usePlanStore.getState().current_plan;
      if (!plan) return;
      const nodeList = usePlanStore.getState().nodes;
      const node = nodeList.find((n) => String(n.id) === sid);
      if (!node) return;

      e.preventDefault();
      handleDeleteNode(node);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleDeleteNode]);

  const handleUpdateNodeField = useCallback(async (nodeId: string, field: string, value: any) => {
    if (nodeId.startsWith('temp-')) return;
    // Use the node's own plan_id (supports multi-plan mode)
    const node = usePlanStore.getState().nodes.find((n) => String(n.id) === nodeId);
    const planId = node?.plan_id || currentPlan?.id;
    if (!planId) return;
    try {
      await api.updateNode(planId, nodeId, { [field]: value });
      setStatusMessage('Node updated.');
      recomputeCoverageIfActive();
      flashSaved();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  }, [api, currentPlan, recomputeCoverageIfActive, flashSaved]);

  const handleSaveNode = useCallback(async () => {
    const node = usePlanStore.getState().nodes.find((n) => String(n.id) === selectedNodeId);
    if (!node) return;
    const nodeId = String(node.id);
    if (nodeId.startsWith('temp-')) return;
    const planId = node.plan_id || currentPlan?.id;
    if (!planId) return;
    try {
      await api.updateNode(planId, nodeId, {
        name: node.name,
        latitude: node.latitude,
        longitude: node.longitude,
        antenna_height_m: node.antenna_height_m,
        device_id: node.device_id,
        tx_power_dbm: node.tx_power_dbm,
        is_solar: node.is_solar,
        notes: node.notes,
      });
      setStatusMessage(`Node "${node.name}" saved.`);
      recomputeCoverageIfActive();
      flashSaved();
    } catch (err: any) {
      setStatusMessage(`Error saving node: ${err.message}`);
    }
  }, [api, currentPlan, selectedNodeId, recomputeCoverageIfActive, flashSaved]);

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleNodeSelection(nodeId);
    } else {
      selectNode(nodeId);
    }
  }, [selectNode, toggleNodeSelection]);

  // ---- Modem Preset Handler (catalog-driven with hardcoded fallback) ----
  const handlePresetChange = useCallback((presetKey: string) => {
    // Try catalog presets first
    const catPreset = catalogModemPresets.find(p => p.id === presetKey || p.name === presetKey);
    if (catPreset) {
      applyNetworkRadio({
        spreading_factor: catPreset.spreading_factor,
        bandwidth_khz: catPreset.bandwidth_khz,
        coding_rate: catPreset.coding_rate,
      });
      return;
    }
    // Fallback to hardcoded
    const preset = MODEM_PRESETS[presetKey];
    if (!preset) return;
    applyNetworkRadio({
      spreading_factor: preset.spreading_factor,
      bandwidth_khz: preset.bandwidth_khz,
      coding_rate: preset.coding_rate,
    });
  }, [applyNetworkRadio, catalogModemPresets]);

  const handleRegionChange = useCallback((regionCode: string) => {
    // Try catalog firmware_region_defaults first
    const fw = networkRadio.firmware;
    const fwDefault = catalogFirmwareDefaults.find(d => d.region_code === regionCode && d.firmware === fw);
    const freq = fwDefault?.default_frequency_mhz || REGION_FREQUENCIES[regionCode] || 906.875;
    applyNetworkRadio({ region: regionCode as any, frequency_mhz: freq });
  }, [applyNetworkRadio, catalogFirmwareDefaults, networkRadio.firmware]);

  const handleFirmwareChange = useCallback((firmware: string) => {
    applyNetworkRadio({ firmware: firmware as any });
  }, [applyNetworkRadio]);

  // ---- Device Auto-Fill (cascading update from device catalog) ----
  const handleDeviceChange = useCallback((nodeId: string, deviceId: string) => {
    const device = catalogDevices.find((d: any) => d.id === deviceId);
    // Always update device_id locally
    updateNodeStore(nodeId, { device_id: deviceId });

    if (device && device.max_tx_power_dbm != null) {
      // Auto-fill TX power from catalog
      updateNodeStore(nodeId, { tx_power_dbm: device.max_tx_power_dbm });
      // Persist to API
      if (!nodeId.startsWith('temp-')) {
        const node = usePlanStore.getState().nodes.find((n) => String(n.id) === nodeId);
        const planId = node?.plan_id || currentPlan?.id;
        if (planId) {
          api.updateNode(planId, nodeId, { device_id: deviceId, tx_power_dbm: device.max_tx_power_dbm })
            .then(() => {
              setStatusMessage(`Device updated — TX power auto-filled to ${device.max_tx_power_dbm} dBm.`);
              recomputeCoverageIfActive();
              flashSaved();
            })
            .catch((err: any) => setStatusMessage(`Error: ${err.message}`));
        }
      }
    } else {
      // No TX power info, just save device_id
      handleUpdateNodeField(nodeId, 'device_id', deviceId);
    }
  }, [catalogDevices, updateNodeStore, api, currentPlan, recomputeCoverageIfActive, flashSaved, handleUpdateNodeField]);

  // ---- Tool Actions ----

  /** Haversine distance in metres between two lat/lon points. */
  const haversineM = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  /** Maximum realistic LoRa LOS distance (300 km is already very generous). */
  const LOS_MAX_DISTANCE_M = 300_000;

  const handleLineOfSight = useCallback(async () => {
    if (!currentPlan) { setErrorMsg('Open a plan first.'); return; }
    if (selectedNodeIds.length < 2) {
      setErrorMsg('Select at least 2 nodes for Line of Sight analysis.\nTip: Hold Ctrl and click nodes to multi-select.');
      return;
    }

    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(String(n.id)));

    // Pre-flight distance check — reject pairs that exceed LoRa's realistic range
    for (let i = 0; i < selectedNodes.length; i++) {
      for (let j = i + 1; j < selectedNodes.length; j++) {
        const nodeA = selectedNodes[i];
        const nodeB = selectedNodes[j];
        const distM = haversineM(nodeA.latitude, nodeA.longitude, nodeB.latitude, nodeB.longitude);
        if (distM > LOS_MAX_DISTANCE_M) {
          setErrorMsg(
            `"${nodeA.name}" → "${nodeB.name}" is ${Math.round(distM / 1000)} km apart.\n` +
            `LOS analysis is capped at ${LOS_MAX_DISTANCE_M / 1000} km — LoRa links beyond this distance are not physically realistic.`
          );
          return;
        }
      }
    }

    losCancelRef.current = false;
    setAnalysisLoading(true);
    setStatusMessage('Running Line of Sight analysis...');
    clearLOSOverlays();

    const overlays: LOSOverlay[] = [];

    for (let i = 0; i < selectedNodes.length; i++) {
      for (let j = i + 1; j < selectedNodes.length; j++) {
        if (losCancelRef.current) break;
        const nodeA = selectedNodes[i];
        const nodeB = selectedNodes[j];
        try {
          const result = await api.getLOSProfile(nodeA, nodeB);
          if (losCancelRef.current) break;
          overlays.push({
            id: `los-${nodeA.id}-${nodeB.id}`,
            nodeAUuid: String(nodeA.id),
            nodeBUuid: String(nodeB.id),
            nodeAName: nodeA.name,
            nodeBName: nodeB.name,
            isViable: result.is_viable,
            linkQuality: result.link_quality || 'unknown',
            distanceM: result.distance_m,
            linkMarginDb: result.link_margin_db || 0,
            receivedSignalDbm: result.received_signal_dbm || 0,
            hasLos: result.has_los !== false,
            fresnelClearancePct: result.fresnel_clearance_pct || 0,
            maxObstructionM: result.max_obstruction_m || 0,
            additionalLossDb: result.estimated_additional_loss_db || 0,
            totalPathLossDb: result.total_path_loss_db || 0,
            freeSpaceLossDb: result.free_space_loss_db || 0,
            elevationSource: result.elevation_source || 'flat_terrain',
            elevationMinM: result.elevation_min_m || 0,
            elevationMaxM: result.elevation_max_m || 0,
          });
        } catch (err: any) {
          console.error(`LOS failed for ${nodeA.name} <-> ${nodeB.name}:`, err);
          setStatusMessage(`LOS error: ${err.message}`);
        }
      }
    }

    setLOSOverlays(overlays);
    if (losCancelRef.current) {
      setStatusMessage('LOS analysis cancelled.');
    } else {
      const viable = overlays.filter((o) => o.isViable).length;
      const clearLos = overlays.filter((o) => o.hasLos).length;
      const obstructed = overlays.length - clearLos;
      const terrainNote = obstructed > 0 ? ` | ${obstructed} terrain-obstructed` : '';
      const elevSources = [...new Set(overlays.map((o) => o.elevationSource))];
      const hasSrtm = elevSources.some((s) => s.startsWith('srtm'));
      const elevNote = hasSrtm ? ' [SRTM terrain]' : ' [flat terrain - no SRTM data]';
      setStatusMessage(`LOS: ${overlays.length} link(s), ${viable} viable, ${clearLos} clear${terrainNote}.${elevNote} Click lines for details.`);
    }
    setAnalysisLoading(false);
  }, [currentPlan, selectedNodeIds, nodes, api, setLOSOverlays, clearLOSOverlays, haversineM]);

  const runCoverageAnalysis = useCallback(async (envOverride?: string) => {
    if (!currentPlan) { setErrorMsg('Open a plan first.'); return; }
    if (analysisLoading) return;

    const targetNodes = selectedNodeIds.length > 0
      ? nodes.filter((n) => selectedNodeIds.includes(String(n.id)))
      : nodes.filter((n) => n.plan_id === currentPlan?.id);

    if (targetNodes.length < 1) {
      setErrorMsg('Need at least 1 node for coverage analysis.');
      return;
    }

    const activeEnv = envOverride ?? coverageEnv;
    if (envOverride) setCoverageEnv(envOverride);

    const envLabel = COVERAGE_ENVIRONMENTS[activeEnv]?.label || 'Suburban';
    setStatusMessage(`Computing terrain-aware ${envLabel} coverage for ${targetNodes.length} node(s)...`);
    setAnalysisLoading(true);
    clearCoverageOverlays();
    clearTerrainCoverageOverlays();

    const terrainOverlays: TerrainCoverageOverlay[] = [];
    const fallbackOverlays: CoverageOverlay[] = [];
    let totalTimeMs = 0;
    let elevSource = '';

    for (let i = 0; i < targetNodes.length; i++) {
      const node = targetNodes[i];
      setStatusMessage(`Computing terrain coverage for "${node.name}" (${i + 1}/${targetNodes.length})...`);

      try {
        // Per-node override takes priority; fall back to global panel setting
        const nodeEnv = node.coverage_environment || activeEnv || node.environment;
        // Resolve PA params for effective TX calculation on the backend
        const pa = catalogPAModules.find((p: any) => p.id === node.pa_module_id) ?? null;
        let paMaxOutputDbm: number | undefined;
        let paInputRangeMaxDbm: number | undefined;
        if (pa) {
          paMaxOutputDbm = pa.max_output_power_dbm;
          const nums = (pa.input_power_range ?? '').match(/\b\d+(?:\.\d+)?/g);
          paInputRangeMaxDbm = nums ? parseFloat(nums[nums.length - 1]) : 22;
        }
        const result = await api.getTerrainCoverageGrid(node, nodeEnv, maxRadiusKm * 1000, paMaxOutputDbm, paInputRangeMaxDbm);

        // Render to canvas before discarding raw points — they are NOT stored in state
        const canvasResult = renderCoverageCanvas(
          result.points,
          result.bounds,
          1000,
          node.latitude,
          node.longitude,
        );

        // Precompute signal stats via loop — spread operator throws on arrays > ~65k elements
        let signalMin = Infinity, signalMax = -Infinity, signalSum = 0;
        for (const p of result.points) {
          const s = p.signal_dbm;
          if (s < signalMin) signalMin = s;
          if (s > signalMax) signalMax = s;
          signalSum += s;
        }
        const pointCount = result.points.length;
        const signalMean = pointCount > 0 ? signalSum / pointCount : 0;
        if (!isFinite(signalMin)) signalMin = 0;
        if (!isFinite(signalMax)) signalMax = 0;

        terrainOverlays.push({
          id: `tcov-${node.id}`,
          nodeUuid: String(node.id),
          nodeName: node.name,
          environment: nodeEnv,
          elevationSource: result.elevation_source,
          computationTimeMs: result.computation_time_ms,
          pointCount,
          signalMin,
          signalMax,
          signalMean,
          bounds: result.bounds,
          imageDataUrl: canvasResult?.dataUrl || null,
          maxRadiusM: maxRadiusKm * 1000,
        });

        totalTimeMs += result.computation_time_ms;
        elevSource = result.elevation_source;
      } catch (err: any) {
        console.warn(`Terrain coverage failed for ${node.name}, falling back to circle:`, err);
        // Fallback to client-side circle
        const fallbackEnv = node.coverage_environment || activeEnv || node.environment;
        const result = computeRealisticCoverageM(
          node.tx_power_dbm,
          node.device_id,
          node.frequency_mhz,
          node.spreading_factor,
          node.bandwidth_khz,
          node.antenna_height_m,
          fallbackEnv,
        );
        const fallbackLabel = COVERAGE_ENVIRONMENTS[fallbackEnv]?.label || fallbackEnv;
        fallbackOverlays.push({
          id: `cov-${node.id}`,
          nodeUuid: String(node.id),
          nodeName: node.name,
          coverageRadiusM: Math.round(result.radiusM),
          engine: `log-distance (${fallbackLabel}, n=${COVERAGE_ENVIRONMENTS[fallbackEnv]?.pathLossExponent})`,
        });
      }
    }

    if (terrainOverlays.length > 0) {
      setTerrainCoverageOverlays(terrainOverlays);
    }
    if (fallbackOverlays.length > 0) {
      setCoverageOverlays(fallbackOverlays);
    }

    const totalPoints = terrainOverlays.reduce((sum, o) => sum + o.pointCount, 0);
    const elevNote = elevSource.startsWith('srtm') ? ` [${elevSource}]` : ' [no terrain data]';
    const parts: string[] = [];
    if (terrainOverlays.length > 0) {
      parts.push(`${terrainOverlays.length} terrain heat map(s), ${totalPoints.toLocaleString()} pts, ${(totalTimeMs / 1000).toFixed(1)}s${elevNote}`);
    }
    if (fallbackOverlays.length > 0) {
      parts.push(`${fallbackOverlays.length} circle fallback(s)`);
    }
    setStatusMessage(`Coverage (${envLabel}): ${parts.join(', ')}. Click overlays for details.`);
    setLastRunCoverageSettings({ env: activeEnv, maxRadiusKm });
    setAnalysisLoading(false);
  }, [currentPlan, selectedNodeIds, nodes, coverageEnv, maxRadiusKm, api, analysisLoading, setCoverageOverlays, clearCoverageOverlays, setTerrainCoverageOverlays, clearTerrainCoverageOverlays]);

  const handleCoverageAnalysis = useCallback(() => {
    if (!currentPlan || analysisLoading) return;
    const targetNodes = selectedNodeIds.length > 0
      ? nodes.filter((n) => selectedNodeIds.includes(String(n.id)))
      : nodes.filter((n) => n.plan_id === currentPlan?.id);
    // Warn before computing if elevated nodes are using a non-LOS environment.
    // Skip nodes that already have an explicit per-node coverage_environment set — the user made an intentional choice.
    const elevatedNodes = targetNodes.filter((n) => !n.coverage_environment && n.antenna_height_m > 15 && coverageEnv !== 'los_elevated');
    if (elevatedNodes.length > 0) {
      const names = elevatedNodes.map((n) => `${n.name} (${n.antenna_height_m}m)`).join(', ');
      setEnvWarningDialog({
        nodeNames: names,
        onSwitch: () => {
          setEnvWarningDialog(null);
          // Auto-cap max radius to radio horizon when switching to los_elevated
          const h = elevatedNodes[0]?.antenna_height_m ?? 3;
          const horizonKm = Math.ceil(3570 * (Math.sqrt(Math.max(0, h)) + Math.sqrt(1.5)) / 1000);
          if (maxRadiusKm > horizonKm) {
            setMaxRadiusKm(horizonKm);
            if (rememberCoverageSettings) localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ env: 'los_elevated', maxRadiusKm: horizonKm, buildId: BUILD_ID }));
          }
          runCoverageAnalysis('los_elevated');
        },
        onRunAnyway: () => { setEnvWarningDialog(null); runCoverageAnalysis(); },
      });
      return;
    }
    runCoverageAnalysis();
  }, [currentPlan, analysisLoading, selectedNodeIds, nodes, coverageEnv, runCoverageAnalysis]);

  /** Fetch catalog data once (shared across all plan BOM builds). */
  const fetchCatalogData = useCallback(async () => {
    const [devices, antennas, cables, paModules, powerComps] = await Promise.all([
      api.getCatalogDevices().catch(() => [] as any[]),
      api.getCatalogAntennas().catch(() => [] as any[]),
      api.getCatalogCables().catch(() => [] as any[]),
      api.getCatalogPAModules().catch(() => [] as any[]),
      api.getCatalogPower().catch(() => [] as any[]),
    ]);
    const deviceMap = new Map(devices.map((d: any) => [d.id, d]));
    const antennaMap = new Map(antennas.map((a: any) => [a.id, a]));
    const cableMap = new Map(cables.map((c: any) => [c.id, c]));
    const paMap = new Map(paModules.map((p: any) => [p.id, p]));
    const defaultPower: Record<string, any> = {};
    for (const pc of powerComps) {
      if (!defaultPower[pc.category]) defaultPower[pc.category] = pc;
    }
    return { deviceMap, antennaMap, cableMap, paMap, defaultPower };
  }, [api]);

  /** Build a BOM payload for a specific plan and its nodes using pre-fetched catalog data. */
  const buildBOMPayloadForPlan = useCallback((
    plan: Plan,
    planNodes: Node[],
    catalog: { deviceMap: Map<string, any>; antennaMap: Map<string, any>; cableMap: Map<string, any>; paMap: Map<string, any>; defaultPower: Record<string, any> },
  ) => {
    const bomNodes = planNodes.map((n) => ({
      node_id: String(n.id),
      node_name: n.name || String(n.id),
      latitude: n.latitude,
      longitude: n.longitude,
      device: catalog.deviceMap.get(n.device_id) || null,
      antenna: catalog.antennaMap.get(n.antenna_id) || null,
      cable: n.cable_id ? catalog.cableMap.get(n.cable_id) || null : null,
      cable_length_m: n.cable_length_m || 0,
      pa_module: n.pa_module_id ? catalog.paMap.get(n.pa_module_id) || null : null,
      battery: catalog.defaultPower['battery'] || null,
      solar_panel: n.is_solar ? (catalog.defaultPower['solar_panel'] || null) : null,
      bec: catalog.defaultPower['buck_converter'] || catalog.defaultPower['bec'] || null,
      charge_controller: n.is_solar ? (catalog.defaultPower['charge_controller'] || null) : null,
      enclosure: catalog.defaultPower['enclosure'] || null,
      mast: catalog.defaultPower['mast'] || null,
      is_outdoor: n.is_solar,
      // Radio configuration for deployment cards
      frequency_mhz: n.frequency_mhz || null,
      tx_power_dbm: n.tx_power_dbm || null,
      spreading_factor: n.spreading_factor || null,
      bandwidth_khz: n.bandwidth_khz || null,
      coding_rate: n.coding_rate || null,
      antenna_height_m: n.antenna_height_m || null,
      region: n.region || null,
      firmware: n.firmware || null,
      modem_preset: n.modem_preset || null,
    }));
    return {
      plan_id: String(plan.id),
      plan_name: plan.name || 'Untitled Plan',
      nodes: bomNodes,
    };
  }, []);

  const handleExportMaterialList = useCallback(async () => {
    if (!currentPlan) { setErrorMsg('Open a plan first.'); return; }
    if (nodes.length < 1) { setErrorMsg('Need at least 1 node to generate BOM.'); return; }

    setShowBOM(true);
    setBomData(null);
    setBomLoading(true);
    setBomError(null);

    try {
      const catalog = await fetchCatalogData();
      const allNodes = usePlanStore.getState().nodes;
      const plansToProcess = loadedPlanObjects.length > 0 ? loadedPlanObjects : (currentPlan ? [currentPlan] : []);

      const allPlanBoms: BOMPlanData[] = [];

      for (const plan of plansToProcess) {
        const planNodes = plansToProcess.length === 1 ? allNodes : allNodes.filter((n) => n.plan_id === plan.id);
        if (planNodes.length === 0) continue;

        const payload = buildBOMPayloadForPlan(plan, planNodes, catalog);
        const planResult = await api.getPlanBOM(payload);

        const nodeBoms: BOMNodeData[] = [];
        for (const nodePayload of payload.nodes) {
          try {
            const nodeResult = await api.getNodeBOM(nodePayload);
            nodeBoms.push(nodeResult);
          } catch {
            nodeBoms.push({
              node_id: nodePayload.node_id,
              node_name: nodePayload.node_name,
              items: [],
              total_cost_usd: 0,
              item_count: 0,
            });
          }
        }

        allPlanBoms.push({
          plan_id: planResult.plan_id,
          plan_name: planResult.plan_name,
          total_nodes: planResult.total_nodes,
          total_cost_usd: planResult.total_cost_usd,
          consolidated_items: planResult.consolidated_items || [],
          node_boms: nodeBoms,
        });
      }

      setBomData(allPlanBoms.length > 0 ? allPlanBoms : null);
      if (allPlanBoms.length === 0) setBomError('No plans with nodes to generate BOM.');
    } catch (err: any) {
      setBomError(err.message || 'Failed to generate BOM.');
    } finally {
      setBomLoading(false);
    }
  }, [currentPlan, nodes, api, fetchCatalogData, buildBOMPayloadForPlan, loadedPlanObjects]);

  const handleBOMExport = useCallback(async (format: 'csv' | 'pdf' | 'cards') => {
    if (!currentPlan) return;
    setBomExporting(true);

    const plansToProcess = loadedPlanObjects.length > 0 ? loadedPlanObjects : [currentPlan];
    const isMulti = plansToProcess.length > 1;
    setStatusMessage(`Exporting BOM as ${format.toUpperCase()} for ${plansToProcess.length} plan(s)...`);

    try {
      const catalog = await fetchCatalogData();
      const allNodes = usePlanStore.getState().nodes;
      let exported = 0;

      for (let i = 0; i < plansToProcess.length; i++) {
        const plan = plansToProcess[i];
        const planNodes = isMulti ? allNodes.filter((n) => n.plan_id === plan.id) : allNodes;
        if (planNodes.length === 0) continue;

        const payload = buildBOMPayloadForPlan(plan, planNodes, catalog);
        const safeName = plan.name?.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_') || 'plan';

        let blob: Blob;
        let filename: string;

        if (format === 'csv') {
          blob = await api.exportBOMCSV(payload);
          filename = `${safeName}_bom.csv`;
        } else if (format === 'pdf') {
          blob = await api.exportBOMPDF(payload);
          filename = `${safeName}_bom.pdf`;
        } else {
          blob = await api.exportDeploymentCards(payload);
          filename = `${safeName}_deployment_cards.pdf`;
        }

        triggerDownload(blob, filename);
        exported++;

        // Small delay between downloads so the browser doesn't block them
        if (i < plansToProcess.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      setStatusMessage(`BOM exported as ${format.toUpperCase()}: ${exported} file(s) downloaded.`);
    } catch (err: any) {
      setStatusMessage(`BOM export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setBomExporting(false);
    }
  }, [currentPlan, api, fetchCatalogData, buildBOMPayloadForPlan, loadedPlanObjects]);

  const handleViewshed = useCallback(async () => {
    if (!currentPlan) { setErrorMsg('Open a plan first.'); return; }
    if (selectedNodeIds.length !== 1) {
      setErrorMsg('Select exactly 1 node as the observer for viewshed analysis.\nAll other nodes will be targets.');
      return;
    }

    const observerNode = nodes.find((n) => String(n.id) === selectedNodeIds[0]);
    if (!observerNode) return;
    const targetNodes = nodes.filter((n) => String(n.id) !== selectedNodeIds[0]);
    if (targetNodes.length === 0) {
      setErrorMsg('Need at least 2 nodes for viewshed analysis (1 observer + targets).');
      return;
    }

    setAnalysisLoading(true);
    setStatusMessage(`Running viewshed analysis from "${observerNode.name}"...`);
    clearViewshedOverlays();

    try {
      const result = await api.getViewshed(observerNode, targetNodes);

      const overlay: ViewshedOverlay = {
        id: `viewshed-${observerNode.id}`,
        observerUuid: String(observerNode.id),
        observerName: observerNode.name,
        results: [...(result.visible || []), ...(result.blocked || [])].map((t: any) => ({
          nodeId: t.node_id,
          nodeName: targetNodes.find((n) => String(n.id) === t.node_id)?.name || t.node_id,
          latitude: t.latitude,
          longitude: t.longitude,
          distanceM: t.distance_m || 0,
          hasLos: t.has_los !== false,
          maxObstructionM: t.max_obstruction_m,
        })),
        visibleCount: result.visible_count || 0,
        blockedCount: result.blocked_count || 0,
        terrainAvailable: result.terrain_available !== false,
      };

      setViewshedOverlays([overlay]);
      const terrainTag = overlay.terrainAvailable ? '[SRTM terrain]' : '[flat terrain]';
      setStatusMessage(`Viewshed: ${overlay.visibleCount} visible, ${overlay.blockedCount} blocked from "${observerNode.name}" ${terrainTag}`);
    } catch (err: any) {
      console.error('Viewshed failed:', err);
      setErrorMsg(`Viewshed error: ${err.message}`);
      setStatusMessage(`Viewshed error: ${err.message}`);
    }
    setAnalysisLoading(false);
  }, [currentPlan, selectedNodeIds, nodes, api, clearViewshedOverlays, setViewshedOverlays]);

  const handleFindRoute = useCallback(() => {
    if (!currentPlan) { setErrorMsg('Open a plan first.'); return; }
    if (losOverlays.length === 0) {
      setErrorMsg('Run Line of Sight analysis first.\nRoute finding uses LOS results to determine viable links.');
      return;
    }
    if (selectedNodeIds.length !== 2) {
      setErrorMsg('Select exactly 2 nodes to find a route between them.\nTip: Hold Ctrl and click nodes to multi-select.');
      return;
    }

    const nodeA = nodes.find((n) => String(n.id) === selectedNodeIds[0]);
    const nodeB = nodes.find((n) => String(n.id) === selectedNodeIds[1]);
    if (!nodeA || !nodeB) return;

    clearRoutePathOverlays();
    const results = findKShortestPaths(selectedNodeIds[0], selectedNodeIds[1], losOverlays, 3);

    if (!results[0]?.isReachable) {
      setStatusMessage(`No route found between "${nodeA.name}" and "${nodeB.name}".`);
      return;
    }

    const overlays: RoutePathOverlay[] = results
      .filter((r) => r.isReachable)
      .map((r, idx) => ({
        id: `route-${nodeA.id}-${nodeB.id}-${idx}`,
        sourceUuid: String(nodeA.id),
        targetUuid: String(nodeB.id),
        sourceName: nodeA.name,
        targetName: nodeB.name,
        path: r.path,
        hopCount: r.hopCount,
        totalDistanceM: r.totalDistanceM,
        pathLinks: r.pathLinks,
        rank: idx,
      }));

    setRoutePathOverlays(overlays);

    const primary = overlays[0];
    const pathNames = primary.path.map((uuid) => nodes.find((n) => String(n.id) === uuid)?.name || uuid);
    const altCount = overlays.length - 1;
    const altMsg = altCount > 0 ? ` ${altCount} alternative${altCount > 1 ? 's' : ''} found.` : '';
    setStatusMessage(`Route: ${primary.hopCount} hop${primary.hopCount !== 1 ? 's' : ''} via ${pathNames.join(' → ')} (${(primary.totalDistanceM / 1000).toFixed(1)} km).${altMsg}`);
  }, [currentPlan, losOverlays, selectedNodeIds, nodes, clearRoutePathOverlays, setRoutePathOverlays]);

  const handleLinkReport = useCallback(() => setShowLinkReport(true), []);

  const handleClearOverlays = useCallback(() => {
    clearLOSOverlays();
    clearCoverageOverlays();
    clearTerrainCoverageOverlays();
    clearViewshedOverlays();
    clearRoutePathOverlays();
    setShowLinkReport(false);
    setStatusMessage('Analysis overlays cleared.');
  }, [clearLOSOverlays, clearCoverageOverlays, clearTerrainCoverageOverlays, clearViewshedOverlays, clearRoutePathOverlays]);

  const handleExportNetworkPDF = useCallback(async () => {
    if (!currentPlan) { setErrorMsg('Open a plan first.'); return; }
    setStatusMessage('Generating Network Report PDF...');
    try {
      // Capture map screenshot as JPEG base64
      let screenshotBase64 = '';
      const mapEl = document.querySelector('.map-container') as HTMLElement | null;
      if (mapEl) {
        try {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(mapEl, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          // Strip "data:image/jpeg;base64," prefix
          screenshotBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
        } catch {
          console.warn('Map screenshot capture failed, proceeding without it.');
        }
      }

      // Gather nodes
      const planNodes = usePlanStore.getState().nodes;
      const reportNodes = planNodes.map((n) => ({
        name: n.name,
        latitude: n.latitude,
        longitude: n.longitude,
        antenna_height_m: n.antenna_height_m,
        device_id: n.device_id,
        firmware: n.firmware,
        region: n.region,
        frequency_mhz: n.frequency_mhz,
        tx_power_dbm: n.tx_power_dbm,
        spreading_factor: n.spreading_factor,
        bandwidth_khz: n.bandwidth_khz,
        coding_rate: n.coding_rate,
        modem_preset: n.modem_preset || null,
        is_solar: n.is_solar,
        notes: n.notes || '',
      }));

      // Gather LOS overlay link data
      const currentLOS = useMapStore.getState().los_overlays;
      const reportLinks = currentLOS.map((ov) => ({
        nodeAName: ov.nodeAName,
        nodeBName: ov.nodeBName,
        isViable: ov.isViable,
        linkQuality: ov.linkQuality,
        distanceM: ov.distanceM,
        linkMarginDb: ov.linkMarginDb,
        receivedSignalDbm: ov.receivedSignalDbm,
        hasLos: ov.hasLos,
        fresnelClearancePct: ov.fresnelClearancePct,
        maxObstructionM: ov.maxObstructionM,
        totalPathLossDb: ov.totalPathLossDb,
        freeSpaceLossDb: ov.freeSpaceLossDb,
        elevationSource: ov.elevationSource,
      }));

      const blob = await api.exportNetworkReportPDF({
        plan_name: currentPlan.name,
        plan_description: currentPlan.description || '',
        nodes: reportNodes,
        links: reportLinks,
        map_screenshot_base64: screenshotBase64,
      });

      triggerDownload(blob, `${sanitizeFilename(currentPlan.name)}_network_report.pdf`);
      setStatusMessage('Network Report PDF exported successfully.');
    } catch (err: any) {
      console.error('Network report PDF export failed:', err);
      setStatusMessage(`PDF export error: ${err.message}`);
    }
  }, [api, currentPlan]);

  const handleSaveScreenshot = useCallback(async () => {
    const mapEl = document.querySelector('.map-container') as HTMLElement | null;
    if (!mapEl) { setErrorMsg('Map not found.'); return; }
    setStatusMessage('Capturing screenshot...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `mesh-planner-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatusMessage('Screenshot saved.');
    } catch (err) {
      console.error('Screenshot failed:', err);
      setStatusMessage('Screenshot failed — see console for details.');
    }
  }, []);

  const handleDuplicatePlan = useCallback(async () => {
    if (!currentPlan) return;
    setStatusMessage(`Duplicating "${currentPlan.name}"...`);
    try {
      const srcNodes = usePlanStore.getState().nodes;
      const newPlan = await api.createPlan({
        name: `${currentPlan.name} (copy)`,
        description: currentPlan.description || '',
        firmware_family: currentPlan.firmware_family,
        region: currentPlan.region,
      });
      const newNodes: Node[] = [];
      for (const n of srcNodes) {
        const created = await api.createNode(newPlan.id, {
          name: n.name, latitude: n.latitude, longitude: n.longitude,
          antenna_height_m: n.antenna_height_m, device_id: n.device_id,
          firmware: n.firmware, region: n.region, frequency_mhz: n.frequency_mhz,
          tx_power_dbm: n.tx_power_dbm, spreading_factor: n.spreading_factor,
          bandwidth_khz: n.bandwidth_khz, coding_rate: n.coding_rate,
          modem_preset: n.modem_preset, antenna_id: n.antenna_id,
          cable_id: n.cable_id, cable_length_m: n.cable_length_m,
          pa_module_id: n.pa_module_id, is_solar: n.is_solar,
          desired_coverage_radius_m: n.desired_coverage_radius_m,
          notes: n.notes, sort_order: n.sort_order,
        });
        newNodes.push(created);
      }
      setPlan(newPlan);
      setNodes(newNodes);
      clearLOSOverlays();
      clearCoverageOverlays();
      setStatusMessage(`Duplicated as "${newPlan.name}" (${newNodes.length} nodes).`);
    } catch (err: any) {
      setStatusMessage(`Duplicate error: ${err.message}`);
    }
  }, [api, currentPlan, setPlan, setNodes, clearLOSOverlays, clearCoverageOverlays]);

  const handleBulkDeletePlans = useCallback(() => {
    if (checkedPlanIds.size === 0) return;
    const count = checkedPlanIds.size;
    const idsToDelete = Array.from(checkedPlanIds);
    setConfirmDialog({
      message: `Delete ${count} plan(s)? This cannot be undone.`,
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        setStatusMessage(`Deleting ${count} plan(s)...`);
        try {
          await Promise.all(idsToDelete.map((id) => api.deletePlan(id)));
          if (currentPlan && checkedPlanIds.has(currentPlan.id)) {
            clearPlan();
            setMode('view');
            clearNodeSelection();
            setEditingPlan(false);
            clearLOSOverlays();
            clearCoverageOverlays();
          }
          setCheckedPlanIds(new Set());
          const refreshed = await api.listPlans();
          setPlans(refreshed);
          if (refreshed.length === 0) {
            setShowPlanList(false);
          }
          setStatusMessage(`Deleted ${count} plan(s). ${refreshed.length} remaining.`);
        } catch (err: any) {
          setStatusMessage(`Bulk delete error: ${err.message}`);
        }
      },
    });
  }, [api, checkedPlanIds, currentPlan, clearPlan, setMode, clearNodeSelection, clearLOSOverlays, clearCoverageOverlays]);

  const handleBulkExportPlans = useCallback(async () => {
    if (checkedPlanIds.size === 0) return;
    setStatusMessage(`Exporting ${checkedPlanIds.size} plan(s)...`);
    try {
      for (const planId of checkedPlanIds) {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) continue;
        const resp = await api.listNodes(planId);
        const nodeList = Array.isArray(resp) ? resp : (resp as any).items || [];
        const exportData = {
          version: '0.1.0',
          exported_at: new Date().toISOString(),
          plan: {
            name: plan.name,
            description: (plan as any).description || '',
            firmware_family: plan.firmware_family,
            region: plan.region,
          },
          nodes: nodeList.map((n: Node) => ({
            name: n.name, latitude: n.latitude, longitude: n.longitude,
            antenna_height_m: n.antenna_height_m, device_id: n.device_id,
            firmware: n.firmware, region: n.region, frequency_mhz: n.frequency_mhz,
            tx_power_dbm: n.tx_power_dbm, spreading_factor: n.spreading_factor,
            bandwidth_khz: n.bandwidth_khz, coding_rate: n.coding_rate,
            modem_preset: n.modem_preset, antenna_id: n.antenna_id,
            cable_id: n.cable_id, cable_length_m: n.cable_length_m,
            pa_module_id: n.pa_module_id, is_solar: n.is_solar,
            desired_coverage_radius_m: n.desired_coverage_radius_m,
            notes: n.notes, sort_order: n.sort_order,
          })),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `${sanitizeFilename(plan.name)}.meshplan.json`);
      }
      setStatusMessage(`Exported ${checkedPlanIds.size} plan(s).`);
    } catch (err: any) {
      setStatusMessage(`Bulk export error: ${err.message}`);
    }
  }, [api, checkedPlanIds, plans]);

  const buildStatus = () => {
    if (currentPlan) {
      const modeLabel = mapMode === 'add_node' ? 'Add Node' : 'Select';
      const selCount = selectedNodeIds.length;
      const selText = selCount > 1 ? ` | Selected: ${selCount} nodes` : '';
      return `${statusMessage} | Plan: ${currentPlan.name} | Nodes: ${nodes.length}${selText} | Mode: ${modeLabel}`;
    }
    return statusMessage;
  };

  // ---- Network Radio Panel ----
  const renderNetworkRadio = () => {
    if (!currentPlan || nodes.length === 0) return null;
    return (
      <div className="sidebar-section">
        <div className="section-header" onClick={() => setRadioCollapsed(!radioCollapsed)}
          title="Click to expand/collapse network radio settings" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRadioCollapsed(!radioCollapsed); } }}>
          <h3 className="sidebar-heading sidebar-heading-radio">
            Network Radio Settings
            <span className="collapse-icon">{radioCollapsed ? '+' : '-'}</span>
          </h3>
        </div>
        {!radioCollapsed && (
          <>
            <p className="sidebar-hint">
              These settings apply to ALL nodes in the plan.{' '}
              <button type="button" className="radio-help-toggle" onClick={() => setRadioHelpExpanded(!radioHelpExpanded)}>
                {radioHelpExpanded ? 'Less' : 'More'}
              </button>
            </p>
            {radioHelpExpanded && (
              <p className="sidebar-hint radio-help-detail">
                All nodes must share the same Spreading Factor (SF), Bandwidth (BW), Coding Rate (CR), and frequency.
                If any node uses different settings, it will not be able to communicate with others, breaking the mesh.
              </p>
            )}
            <div className="config-field">
              <label>Modem Preset</label>
              <select value={currentPreset}
                title="Select a predefined radio configuration (Spreading Factor, Bandwidth, Coding Rate)"
                onChange={(e) => handlePresetChange(e.target.value)}>
                {catalogModemPresets.length > 0
                  ? catalogModemPresets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (SF{p.spreading_factor}/BW{p.bandwidth_khz})</option>
                  ))
                  : Object.entries(MODEM_PRESETS).map(([key, p]) => (
                    <option key={key} value={key}>{p.label}</option>
                  ))
                }
                {currentPreset === 'Custom' && <option value="Custom">Custom</option>}
              </select>
            </div>
            {MODEM_PRESETS[currentPreset] && (
              <p className="sidebar-hint">{MODEM_PRESETS[currentPreset].description}</p>
            )}
            <div className="config-field">
              <label>Firmware</label>
              <select value={networkRadio.firmware}
                title="Mesh firmware family. All nodes must use the same firmware."
                onChange={(e) => handleFirmwareChange(e.target.value)}>
                <option value="meshtastic">Meshtastic</option>
                <option value="meshcore">MeshCore</option>
                <option value="reticulum">Reticulum</option>
              </select>
            </div>
            <div className="config-field">
              <label>Region</label>
              <select value={networkRadio.region}
                title="Regulatory region. Sets the default frequency for your area."
                onChange={(e) => handleRegionChange(e.target.value)}>
                {catalogRegions.length > 0
                  ? catalogRegions.map((r) => (
                    <option key={r.id} value={r.region_code}>{r.name}</option>
                  ))
                  : <>
                    <option value="us_fcc">US (FCC) - 906.875 MHz</option>
                    <option value="eu_868">EU (868 MHz)</option>
                    <option value="eu_433">EU (433 MHz)</option>
                    <option value="anz">ANZ - 916 MHz</option>
                  </>
                }
              </select>
            </div>
            <div className="config-field">
              <label>Frequency (MHz)</label>
              <NumberInput step={0.125} min={137} max={1020}
                value={networkRadio.frequency_mhz}
                title="Center frequency in MHz. Must match across all nodes."
                onChange={(v) => applyNetworkRadio({ frequency_mhz: v })}
              />
            </div>
            <div className="radio-params-row">
              <div className="config-field">
                <label>Spreading Factor</label>
                <NumberInput step={1} min={5} max={12}
                  value={networkRadio.spreading_factor}
                  title="Higher Spreading Factor = longer range but slower data rate (5-12)"
                  onChange={(v) => applyNetworkRadio({ spreading_factor: Math.round(v) })}
                />
              </div>
              <div className="config-field">
                <label>Bandwidth (kHz)</label>
                <NumberInput step={25} min={1}
                  value={networkRadio.bandwidth_khz}
                  title="Lower Bandwidth = longer range but slower data rate (125, 250, 500 kHz)"
                  onChange={(v) => applyNetworkRadio({ bandwidth_khz: v })}
                />
              </div>
              <div className="config-field">
                <label>Coding Rate</label>
                <select value={networkRadio.coding_rate}
                  title="Coding Rate for forward error correction. Higher = more resilient but slower."
                  onChange={(e) => applyNetworkRadio({ coding_rate: e.target.value as CodingRate })}>
                  <option value="4/5">4/5</option>
                  <option value="4/6">4/6</option>
                  <option value="4/7">4/7</option>
                  <option value="4/8">4/8</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ---- Node Config Panel (per-node settings only) ----
  const renderNodeConfig = () => {
    if (!selectedNode) return null;
    return (
      <div className="sidebar-section node-config">
        <div className="section-header" onClick={() => setConfigCollapsed(!configCollapsed)}
          title="Click to expand/collapse node configuration" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConfigCollapsed(!configCollapsed); } }}>
          <h3 className="sidebar-heading sidebar-heading-config">
            Node Config
            <span className="collapse-icon">{configCollapsed ? '+' : '-'}</span>
          </h3>
        </div>
        {!configCollapsed && (
          <>
            <div className="config-field">
              <label>Name</label>
              <input type="text" value={selectedNode.name}
                title="Display name for this node"
                onChange={(e) => updateNodeStore(String(selectedNode.id), { name: e.target.value })}
                onBlur={(e) => handleUpdateNodeField(String(selectedNode.id), 'name', e.target.value)}
              />
            </div>
            <div className="config-field">
              <label>Latitude</label>
              <NumberInput step={0.00001} value={selectedNode.latitude}
                title="Node latitude in decimal degrees. Drag the marker on the map to reposition."
                onChange={(v) => { updateNodeStore(String(selectedNode.id), { latitude: v }); handleUpdateNodeField(String(selectedNode.id), 'latitude', v); }}
              />
            </div>
            <div className="config-field">
              <label>Longitude</label>
              <NumberInput step={0.00001} value={selectedNode.longitude}
                title="Node longitude in decimal degrees. Drag the marker on the map to reposition."
                onChange={(v) => { updateNodeStore(String(selectedNode.id), { longitude: v }); handleUpdateNodeField(String(selectedNode.id), 'longitude', v); }}
              />
            </div>
            <div className="config-field">
              <label>Antenna Height (m)</label>
              <NumberInput step={0.5} min={0} max={500} value={selectedNode.antenna_height_m}
                title="Height above ground in meters. Higher = better coverage and radio horizon."
                onChange={(v) => { updateNodeStore(String(selectedNode.id), { antenna_height_m: v }); handleUpdateNodeField(String(selectedNode.id), 'antenna_height_m', v); }}
              />
            </div>
            <div className="config-field">
              <label>Device</label>
              <select value={selectedNode.device_id}
                title="Hardware device model. Affects antenna gain and capabilities."
                onChange={(e) => handleDeviceChange(String(selectedNode.id), e.target.value)}>
                {catalogDevices.length > 0
                  ? catalogDevices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}{d.is_custom ? ' (custom)' : ''}</option>
                  ))
                  : <>
                    <option value="tbeam-supreme">LilyGO T-Beam Supreme</option>
                    <option value="techo">LilyGO T-Echo</option>
                    <option value="canaryone">CanaryOne</option>
                    <option value="rak-wisblock-starter">RAK WisBlock Starter</option>
                    <option value="rak4631">RAK4631</option>
                    <option value="heltec-v2">Heltec LoRa V2</option>
                    <option value="heltec-v3">Heltec LoRa V3</option>
                    <option value="heltec-v4">Heltec LoRa V4</option>
                    <option value="t114-v2">Mesh Node T114 V2</option>
                    <option value="t1000-e">Seeed T1000-E</option>
                    <option value="xiaos3-wio">XiaoS3 WIO + SX1262</option>
                  </>
                }
              </select>
            </div>
            {(() => {
              const device = catalogDevices.find((d: any) => d.id === selectedNode.device_id);
              const pa = catalogPAModules.find((p: any) => p.id === selectedNode.pa_module_id) ?? null;
              // Device hardware output limit
              const deviceMaxTx: number = device?.max_tx_power_dbm ?? 30;
              // PA input range max — parsed from "0-22 dBm" → 22
              const paInputMax: number | null = pa
                ? (() => { const m = (pa.input_power_range ?? '').match(/\b\d+(?:\.\d+)?/g); return m ? parseFloat(m[m.length - 1]) : 22; })()
                : null;
              const paGain: number = pa ? (pa.max_output_power_dbm - (paInputMax ?? 22)) : 0;
              const effectiveOutputDbm: number = pa
                ? Math.min(selectedNode.tx_power_dbm + paGain, pa.max_output_power_dbm)
                : selectedNode.tx_power_dbm;
              // Warning tiers
              const overdrivingDevice = selectedNode.tx_power_dbm > deviceMaxTx;
              const overdrivingPaInput = pa !== null && selectedNode.tx_power_dbm > (paInputMax ?? 22);
              // >= 30 dBm = 1W — the FCC Part 15 / ETSI unlicensed limit
              const exceedsRegulatory = !overdrivingDevice && !overdrivingPaInput && effectiveOutputDbm >= 30;
              const effectiveW = Math.pow(10, (effectiveOutputDbm - 30) / 10);
              return (<>
                <div className="config-field">
                  <label htmlFor="txPowerDbm">TX Power (dBm)</label>
                  <NumberInput id="txPowerDbm" step={1} min={0} max={47}
                    value={selectedNode.tx_power_dbm}
                    title="Transmit power in dBm. 30 dBm = 1W (FCC Part 15 / ETSI unlicensed limit). Higher values supported for licensed or non-permissive environments."
                    onChange={(v) => { updateNodeStore(String(selectedNode.id), { tx_power_dbm: v }); handleUpdateNodeField(String(selectedNode.id), 'tx_power_dbm', v); }}
                  />
                </div>
                {/* PA info always shown when PA is present — even alongside warnings */}
                {pa && (
                  <p className="sidebar-hint" style={{ marginBottom: '0.25rem' }}>
                    PA output: {effectiveOutputDbm.toFixed(1)} dBm ({selectedNode.tx_power_dbm} dBm device + {paGain} dB gain) ≈ {effectiveW.toFixed(2)}W
                  </p>
                )}
                {overdrivingDevice && (
                  <p className="sidebar-hint" style={{ marginBottom: '0.25rem', color: '#e74c3c' }}>
                    ⚠ {selectedNode.tx_power_dbm} dBm exceeds device limit ({deviceMaxTx} dBm). Simulation only — do not transmit.
                  </p>
                )}
                {!overdrivingDevice && overdrivingPaInput && (
                  <p className="sidebar-hint" style={{ marginBottom: '0.25rem', color: '#e74c3c' }}>
                    ⚠ {selectedNode.tx_power_dbm} dBm overdrives PA input (max {paInputMax} dBm). Simulation only — do not transmit.
                  </p>
                )}
                {exceedsRegulatory && (
                  <p className="sidebar-hint" style={{ marginBottom: '0.25rem', color: 'var(--color-warning, #e67e22)' }}>
                    {effectiveOutputDbm.toFixed(1)} dBm ≈ {effectiveW.toFixed(2)}W — at or above 1W unlicensed limit. Use only where permitted.
                  </p>
                )}
                {/* No-PA watt note when TX is meaningfully high */}
                {!pa && selectedNode.tx_power_dbm >= 27 && !overdrivingDevice && (
                  <p className="sidebar-hint" style={{ marginBottom: '0.25rem' }}>
                    {selectedNode.tx_power_dbm} dBm ≈ {Math.pow(10, (selectedNode.tx_power_dbm - 30) / 10).toFixed(2)}W
                  </p>
                )}
              </>);
            })()}
            <div className="config-field">
              <label>Antenna</label>
              <select value={selectedNode.antenna_id || ''}
                title="Antenna model. Affects gain and coverage."
                onChange={(e) => { updateNodeStore(String(selectedNode.id), { antenna_id: e.target.value }); handleUpdateNodeField(String(selectedNode.id), 'antenna_id', e.target.value); }}>
                {catalogAntennas.length > 0
                  ? catalogAntennas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.gain_dbi} dBi){a.is_default ? ' (default)' : ''}</option>
                  ))
                  : <option value="">-- No antennas loaded --</option>
                }
              </select>
            </div>
            <div className="config-field">
              <label>Cable</label>
              <select value={selectedNode.cable_id || ''}
                title="Coaxial cable type. Adds signal loss proportional to length."
                onChange={(e) => { updateNodeStore(String(selectedNode.id), { cable_id: e.target.value || null }); handleUpdateNodeField(String(selectedNode.id), 'cable_id', e.target.value || null); }}>
                <option value="">None (direct connect)</option>
                {catalogCables.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.cable_type})</option>
                ))}
              </select>
            </div>
            {selectedNode.cable_id && (
              <div className="config-field">
                <label>Cable Length (m)</label>
                <NumberInput step={0.1} min={0} max={100} value={selectedNode.cable_length_m || 0}
                  title="Cable length in meters. Longer cable = more signal loss."
                  onChange={(v) => { updateNodeStore(String(selectedNode.id), { cable_length_m: v }); handleUpdateNodeField(String(selectedNode.id), 'cable_length_m', v); }}
                />
              </div>
            )}
            <div className="config-field">
              <label>PA Module</label>
              <select value={selectedNode.pa_module_id || ''}
                title="External power amplifier module. Boosts transmit power."
                onChange={(e) => { updateNodeStore(String(selectedNode.id), { pa_module_id: e.target.value || null }); handleUpdateNodeField(String(selectedNode.id), 'pa_module_id', e.target.value || null); }}>
                <option value="">None</option>
                {catalogPAModules.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.max_output_power_dbm} dBm)</option>
                ))}
              </select>
            </div>
            <div className="config-field" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={selectedNode.is_solar}
                title="Check if this node has solar power for battery calculations"
                onChange={(e) => { updateNodeStore(String(selectedNode.id), { is_solar: e.target.checked }); handleUpdateNodeField(String(selectedNode.id), 'is_solar', e.target.checked); }}
              />
              <label style={{ margin: 0 }}>Is the node solar powered?</label>
            </div>
            <div className="config-field">
              <label>Coverage Environment</label>
              <select
                value={selectedNode.coverage_environment ?? ''}
                title="Per-node coverage environment override. Leave as 'Inherit' to use the global panel setting."
                onChange={(e) => {
                  const val = e.target.value || null;
                  updateNodeStore(String(selectedNode.id), { coverage_environment: val });
                  handleUpdateNodeField(String(selectedNode.id), 'coverage_environment', val);
                }}
              >
                {COVERAGE_ENV_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="sidebar-hint" style={{ marginTop: '0.25rem', marginBottom: 0 }}>
                Overrides the global environment for this node's coverage simulation. Leave as 'Inherit' to use the panel setting.
              </p>
            </div>
            <div className="config-field">
              <label>Notes</label>
              <textarea value={selectedNode.notes || ''} rows={2}
                title="Free-form notes about this node (location details, mount info, etc.)"
                onChange={(e) => updateNodeStore(String(selectedNode.id), { notes: e.target.value })}
                onBlur={(e) => handleUpdateNodeField(String(selectedNode.id), 'notes', e.target.value)}
              />
            </div>
            <div className="config-actions">
              <button className="sidebar-btn sidebar-btn-save" type="button" onClick={handleSaveNode}
                title="Save all changes for this node to the plan">
                Save Node
              </button>
              <button className="sidebar-btn sidebar-btn-secondary" type="button" onClick={() => clearNodeSelection()}
                title="Deselect this node and close the config panel">
                Deselect
              </button>
              <button className="sidebar-btn sidebar-btn-danger" type="button" onClick={() => handleDeleteNode(selectedNode)}
                title="Permanently delete this node from the plan">
                Delete Node
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Toolbar
        onToggleSidebar={() => { setSidebarOpen(!sidebarOpen); setTimeout(() => invalidateMap(), 200); }}
        onNewPlan={handleNewPlan}
        onOpenPlan={handleOpenPlan}
        onImportPlan={handleImportPlan}
        onExportPlan={handleExportPlan}
        onExportCSV={handleExportCSV}
        onImportCSV={handleImportCSV}
        onImportJSON={handleImportJSON}
        onImportFromMap={() => setInternetMapImportOpen(true)}
        isInternetOnline={isInternetOnline}
        onImportSignal={() => setSignalImportOpen(true)}
        onExportKML={handleExportKML}
        onExportGeoJSON={handleExportGeoJSON}
        onDuplicatePlan={handleDuplicatePlan}
        onClosePlan={handleClosePlan}
        onDeletePlan={handleDeletePlan}
        onExitApp={handleExitApp}
        hasPlan={!!currentPlan}
        onLineOfSight={handleLineOfSight}
        onCoverageAnalysis={handleCoverageAnalysis}
        onViewshed={handleViewshed}
        onFindRoute={handleFindRoute}
        onLinkReport={handleLinkReport}
        onClearOverlays={handleClearOverlays}
        onExportMaterialList={handleExportMaterialList}
        onExportNetworkPDF={() => setShowPDFReport(true)}
        onTimeOnAir={() => setShowTimeOnAir(true)}
        onRepeaterChain={() => setShowRepeaterChain(true)}
        onMeshCoreAirtime={() => setShowMeshCoreAirtime(true)}
        onMeshCoreCapacity={() => setShowMeshCoreCapacity(true)}
        onMeshCoreFreqCoord={() => setShowMeshCoreFreqCoord(true)}
        onChannelCapacity={() => setShowChannelCapacity(true)}
        onReticulumAnnounce={() => setShowReticulumAnnounce(true)}
        onRNSLinkBudget={() => setShowRNSLinkBudget(true)}
        onRNSTransport={() => setShowRNSTransport(true)}
        onRNSThroughput={() => setShowRNSThroughput(true)}
        onFloodSim={() => setShowFloodingSim(true)}
        onSuggestPlacement={() => setShowPlacementSuggest(true)}
        onSaveScreenshot={handleSaveScreenshot}
        onToggleElevation={() => setElevationLayerEnabled(!elevationLayerEnabled)}
        elevationEnabled={elevationLayerEnabled}
        onToggleCoverageHatch={() => setCoverageHatchMode(!coverageHatchMode)}
        coverageHatchEnabled={coverageHatchMode}
        onToggleSatellite={() => setSatelliteMode(!satelliteMode)}
        satelliteEnabled={satelliteMode}
        hasOverlays={losOverlays.length > 0 || coverageOverlays.length > 0 || terrainCoverageOverlays.length > 0 || viewshedOverlays.length > 0 || routePathOverlays.length > 0}
        hasLOSOverlays={losOverlays.length > 0}
        selectedCount={selectedNodeIds.length}
        analysisLoading={analysisLoading}
        onOpenCatalog={() => setCatalogModalOpen(true)}
        onShowTour={() => setTourForceKey((k) => k + 1)}
        onShowCatalogTour={() => {
          setCatalogModalOpen(true);
          setCatalogTourForce(true);
        }}
        loadedPlans={loadedPlanObjects.map((p) => {
          const planNodes = nodes.filter((n) => n.plan_id === p.id);
          const refN = planNodes[0];
          return {
            id: p.id,
            name: p.name,
            description: p.description || undefined,
            nodeCount: planNodes.length,
            firmware: refN?.firmware || p.firmware_family || undefined,
            region: refN?.region || p.region || undefined,
          } as PlanInfoEntry;
        })}
        totalNodeCount={nodes.length}
        losLinkCount={losOverlays.length}
        coverageOverlayCount={coverageOverlays.length + terrainCoverageOverlays.length}
        networkRadioSummary={`SF${networkRadio.spreading_factor} / BW${networkRadio.bandwidth_khz} / CR${networkRadio.coding_rate}`}
        coverageEnv={COVERAGE_ENVIRONMENTS[coverageEnv]?.label || coverageEnv}
      />
      <div className="app-body">
        {sidebarOpen && (
          <aside className="app-sidebar" role="complementary" aria-label="Plan sidebar">
            {/* Plan Section */}
            <div className="sidebar-section">
              <div className="section-header" onClick={() => setPlanCollapsed(!planCollapsed)}
                title="Click to expand/collapse plan management" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlanCollapsed(!planCollapsed); } }}>
                <h3 className="sidebar-heading sidebar-heading-plan">
                  Plan
                  <span className="collapse-icon">{planCollapsed ? '+' : '-'}</span>
                </h3>
              </div>
              {!planCollapsed && (
                showPlanList ? (
                  <>
                    <div className="plan-list-header">
                      <label className="plan-list-select-all">
                        <input type="checkbox" className="plan-list-select-all-cb"
                          checked={plans.length > 0 && checkedPlanIds.size === plans.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCheckedPlanIds(new Set(plans.map((p) => p.id)));
                            } else {
                              setCheckedPlanIds(new Set());
                            }
                          }}
                        />
                        <span>Select All</span>
                      </label>
                      {checkedPlanIds.size > 0 && (
                        <label className="plan-list-select-all" style={{ marginLeft: '0.5rem' }}>
                          <input type="checkbox" className="plan-list-select-all-cb"
                            checked={false}
                            onChange={() => setCheckedPlanIds(new Set())}
                          />
                          <span>Deselect All</span>
                        </label>
                      )}
                      {checkedPlanIds.size > 0 && (
                        <span className="plan-list-count">{checkedPlanIds.size} selected</span>
                      )}
                    </div>
                    <p className="sidebar-hint">Click a plan name to select it. Use checkboxes for bulk operations.</p>
                    {plans.length === 0 ? (
                      <p className="sidebar-empty">No plans found</p>
                    ) : (
                      <div className="sidebar-plan-list">
                        {plans.map((plan) => (
                          <div key={plan.id} className="plan-list-row">
                            <input type="checkbox" className="plan-list-checkbox"
                              checked={checkedPlanIds.has(plan.id)}
                              onChange={() => {
                                setCheckedPlanIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(plan.id)) next.delete(plan.id);
                                  else next.add(plan.id);
                                  return next;
                                });
                              }}
                            />
                            <button className="plan-list-name" type="button"
                              title={`Click to select "${plan.name}"`}
                              onClick={() => {
                                setCheckedPlanIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(plan.id)) next.delete(plan.id);
                                  else next.add(plan.id);
                                  return next;
                                });
                              }}>
                              {plan.name}
                            </button>
                            <button className="plan-list-delete" type="button"
                              title={`Delete "${plan.name}"`}
                              onClick={() => {
                                const pName = plan.name;
                                const pId = plan.id;
                                setConfirmDialog({
                                  message: `Delete "${pName}"? This cannot be undone.`,
                                  variant: 'danger',
                                  confirmText: 'Delete',
                                  onConfirm: async () => {
                                    setConfirmDialog(null);
                                    try {
                                      await api.deletePlan(pId);
                                      setPlans((prev) => prev.filter((p) => p.id !== pId));
                                      setCheckedPlanIds((prev) => { const n = new Set(prev); n.delete(pId); return n; });
                                      setStatusMessage(`Deleted "${pName}".`);
                                    } catch (err: any) {
                                      setStatusMessage(`Error: ${err.message}`);
                                    }
                                  },
                                });
                              }}>
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {checkedPlanIds.size > 0 && (
                      <div className="plan-bulk-actions">
                        <button className="plan-bulk-btn plan-bulk-btn-danger" type="button"
                          onClick={handleBulkDeletePlans}>
                          Delete Selected ({checkedPlanIds.size})
                        </button>
                        <button className="plan-bulk-btn" type="button"
                          onClick={handleBulkExportPlans}>
                          Export Selected ({checkedPlanIds.size})
                        </button>
                      </div>
                    )}
                    {checkedPlanIds.size === 1 && (
                      <button className="sidebar-btn" type="button" style={{ marginTop: '0.35rem' }}
                        onClick={() => {
                          const planId = Array.from(checkedPlanIds)[0];
                          const plan = plans.find((p) => p.id === planId);
                          if (plan) handleSelectPlan(plan);
                        }}>
                        Open Plan
                      </button>
                    )}
                    {checkedPlanIds.size > 1 && (
                      <button className="sidebar-btn" type="button" style={{ marginTop: '0.35rem' }}
                        onClick={() => handleOpenMultiplePlans(checkedPlanIds)}>
                        Open {checkedPlanIds.size} Plans Together
                      </button>
                    )}
                    <button className="sidebar-btn sidebar-btn-secondary" type="button"
                      title="Cancel and return to the main screen"
                      onClick={() => { setShowPlanList(false); setCheckedPlanIds(new Set()); }} style={{ marginTop: '0.35rem' }}>
                      Cancel
                    </button>
                  </>
                ) : currentPlan ? (
                  editingPlan ? (
                    <>
                      <div className="config-field">
                        <label>Name</label>
                        <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)}
                          title="Edit the plan name" />
                      </div>
                      <div className="config-field">
                        <label>Description</label>
                        <textarea value={planDesc} rows={3} onChange={(e) => setPlanDesc(e.target.value)}
                          title="Edit the plan description" />
                      </div>
                      <button className="sidebar-btn" type="button" onClick={handleSavePlan}
                        title="Save plan name and description changes">Save</button>
                      <button className="sidebar-btn sidebar-btn-secondary" type="button" onClick={() => setEditingPlan(false)}
                        title="Discard changes and return to plan view">Cancel</button>
                    </>
                  ) : (
                    <>
                      <div className="plan-name-row">
                        <p className="sidebar-plan-name">{currentPlan.name}</p>
                        {dirty && saveStatus === 'idle' && (
                          <>
                            <span className="save-indicator save-unsaved" title="Unsaved changes">*</span>
                            <button
                              type="button"
                              className="save-inline-btn"
                              title="Save changes"
                              onClick={async () => {
                                if (!currentPlan) return;
                                await api.updatePlan(currentPlan.id, {
                                  name: currentPlan.name,
                                  description: currentPlan.description || '',
                                });
                                flashSaved();
                              }}
                            >
                              Save
                            </button>
                          </>
                        )}
                        {saveStatus === 'saved' && (
                          <span className="save-indicator save-confirmed">Saved</span>
                        )}
                      </div>
                      {currentPlan.description ? (
                        <p className={`sidebar-hint plan-desc${descExpanded ? '' : ' plan-desc-clamped'}`}
                          onClick={() => setDescExpanded(!descExpanded)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDescExpanded(!descExpanded); } }}
                          tabIndex={0}
                          role="button"
                          title={descExpanded ? 'Click to collapse' : 'Click to expand full description'}
                          style={{ cursor: 'pointer' }}>
                          {currentPlan.description}
                          {!descExpanded && <span className="plan-desc-more"> ...more</span>}
                        </p>
                      ) : (
                        <p className="sidebar-hint">No description</p>
                      )}
                      <button className="sidebar-btn sidebar-btn-secondary" type="button" onClick={handleEditPlan}
                        title="Edit plan name and description">
                        Edit Plan Details
                      </button>
                      <div className="config-field" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                        <label>Coverage Environment <span style={{ fontWeight: 400, color: '#7f8c8d' }}>(Global Setting)</span></label>
                        <select value={coverageEnv} onChange={(e) => { setCoverageEnv(e.target.value); if (rememberCoverageSettings) localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ env: e.target.value, maxRadiusKm, buildId: BUILD_ID })); }}
                          title="Terrain type affects signal propagation and coverage radius">
                          {Object.entries(COVERAGE_ENVIRONMENTS).map(([key, env]) => (
                            <option key={key} value={key}>{env.label}</option>
                          ))}
                        </select>
                      </div>
                      {COVERAGE_ENVIRONMENTS[coverageEnv] && (
                        <p className="sidebar-hint" style={{ marginBottom: '0' }}>
                          {COVERAGE_ENVIRONMENTS[coverageEnv].description}
                        </p>
                      )}
                      <details className="horizon-note" style={{ marginBottom: '0.25rem' }}>
                        <summary>About the global environment setting</summary>
                        <div className="horizon-note-body">
                          This is the default environment used for all nodes in coverage analysis. To override it for a specific node, select that node and set its <strong>Coverage Environment</strong> field individually. Nodes without a per-node setting inherit this global choice.
                        </div>
                      </details>
                      {selectedNode && selectedNode.antenna_height_m > 15 && coverageEnv !== 'los_elevated' && (
                        <p className="sidebar-hint" style={{ marginBottom: '0', color: 'var(--color-warning, #e67e22)' }}>
                          Elevated node ({selectedNode.antenna_height_m} m) — use "Clear LOS (Elevated)" for accurate simulation. Current environment underestimates range at height.
                        </p>
                      )}
                      {(() => {
                        // Radio horizon for the selected node (or tallest target node)
                        const coverageTargetNodes = selectedNodeIds.length > 0
                          ? nodes.filter((n) => selectedNodeIds.includes(String(n.id)))
                          : nodes;
                        const h = selectedNode?.antenna_height_m
                          ?? (coverageTargetNodes.length > 0
                            ? Math.max(...coverageTargetNodes.map((n) => n.antenna_height_m))
                            : 3);
                        const horizonM = 3570 * (Math.sqrt(Math.max(0, h)) + Math.sqrt(1.5));
                        const horizonMaxKm = Math.ceil(horizonM / 1000);
                        // Auto-clamp stored value if node antenna height changed
                        const clampedRadius = Math.min(maxRadiusKm, horizonMaxKm);
                        if (clampedRadius !== maxRadiusKm) {
                          setMaxRadiusKm(clampedRadius);
                          if (rememberCoverageSettings) localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ env: coverageEnv, maxRadiusKm: clampedRadius, buildId: BUILD_ID }));
                        }
                        const saveAndSet = (v: number) => {
                          setMaxRadiusKm(v);
                          if (rememberCoverageSettings) localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ env: coverageEnv, maxRadiusKm: v, buildId: BUILD_ID }));
                        };
                        return (
                          <div className="config-field" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                            <label htmlFor="maxRadiusKm">Max Radius (km)</label>
                            <NumberInput
                              id="maxRadiusKm"
                              min={1}
                              max={horizonMaxKm}
                              step={1}
                              value={clampedRadius}
                              onChange={(v) => saveAndSet(v)}
                              aria-label={`Maximum coverage analysis radius in kilometres (1–${horizonMaxKm})`}
                              title={`Physical limit: ${horizonMaxKm} km radio horizon at ${h}m antenna height.`}
                            />
                            <p className="sidebar-hint" style={{ marginBottom: 0, marginTop: '0.2rem' }}>
                              Radio horizon at {h} m: {horizonMaxKm} km max
                            </p>
                          </div>
                        );
                      })()}
                      {lastRunCoverageSettings && terrainCoverageOverlays.length > 0 &&
                        (lastRunCoverageSettings.env !== coverageEnv || lastRunCoverageSettings.maxRadiusKm !== maxRadiusKm) && (
                        <p className="sidebar-hint" style={{ marginBottom: '0.25rem', color: 'var(--color-warning, #e67e22)' }}>
                          Settings changed — re-run analysis to update.
                        </p>
                      )}
                      <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="checkbox"
                          id="rememberCoverageSettings"
                          checked={rememberCoverageSettings}
                          onChange={(e) => {
                            setRememberCoverageSettings(e.target.checked);
                            if (e.target.checked) {
                              localStorage.setItem(COVERAGE_SETTINGS_KEY, JSON.stringify({ env: coverageEnv, maxRadiusKm, buildId: BUILD_ID }));
                            } else {
                              localStorage.removeItem(COVERAGE_SETTINGS_KEY);
                            }
                          }}
                        />
                        <label htmlFor="rememberCoverageSettings" className="sidebar-hint" style={{ margin: 0, cursor: 'pointer' }}>
                          Remember coverage settings
                        </label>
                      </div>
                    </>
                  )
                ) : (
                  <p className="sidebar-hint">No plan loaded. Use the Plan menu above.</p>
                )
              )}
            </div>


            {/* Network Radio Settings (plan-level, applies to all nodes) */}
            {renderNetworkRadio()}

            {/* Node List Section */}
            <div className="sidebar-section">
              <div className="section-header" onClick={() => setNodesCollapsed(!nodesCollapsed)}
                title="Click to expand/collapse the node list" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNodesCollapsed(!nodesCollapsed); } }}>
                <h3 className="sidebar-heading sidebar-heading-nodes">
                  Nodes ({nodes.length})
                  <span className="collapse-icon">{nodesCollapsed ? '+' : '-'}</span>
                </h3>
              </div>
              {!nodesCollapsed && (
                <>
                  {currentPlan && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <button
                        className={`sidebar-btn ${mapMode === 'add_node' ? 'sidebar-btn-active' : 'sidebar-btn-secondary'}`}
                        type="button"
                        onClick={handleToggleAddNode}
                        title="Toggle Add Node mode. When active, clicking the map creates a new node at the clicked location."
                      >
                        {mapMode === 'add_node' ? '[ Adding Nodes ] - Click to Stop' : 'Add Node'}
                      </button>
                      <p className="sidebar-hint">
                        {mapMode === 'add_node'
                          ? 'Click the map to place nodes. Click this button again to stop.'
                          : 'Hold Ctrl+Click on nodes for multi-select. Drag to reposition.'}
                      </p>
                    </div>
                  )}
                  {!currentPlan && (
                    <p className="sidebar-hint">Open or create a New plan to manage nodes.</p>
                  )}
                  {selectedNodeIds.length > 1 && (
                    <>
                      <p className="sidebar-hint multi-select-info">
                        {selectedNodeIds.length} nodes selected (Ctrl+Click for more, drag one to move all)
                      </p>
                      <div className="config-field multi-env-row">
                        <label>Set Coverage Env (all selected)</label>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <select
                            value={bulkCoverageEnv}
                            onChange={(e) => setBulkCoverageEnv(e.target.value)}
                            style={{ flex: 3 }}
                            title="Set coverage environment override on all selected nodes"
                          >
                            {COVERAGE_ENV_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <button
                            className="sidebar-btn sidebar-btn-secondary"
                            type="button"
                            style={{ flex: 1, whiteSpace: 'nowrap', padding: '0.3rem 0.4rem', fontSize: '0.78rem', marginBottom: 0 }}
                            title="Apply to all selected nodes"
                            onClick={async () => {
                              const val = bulkCoverageEnv || null;
                              const plan = usePlanStore.getState().current_plan;
                              for (const nid of selectedNodeIds) {
                                updateNodeStore(nid, { coverage_environment: val });
                                if (!nid.startsWith('temp-') && plan) {
                                  const n = usePlanStore.getState().nodes.find((x) => String(x.id) === nid);
                                  const planId = n?.plan_id || plan.id;
                                  api.updateNode(planId, nid, { coverage_environment: val })
                                    .catch((err: any) => console.error(`Failed to update node ${nid}:`, err));
                                }
                              }
                              setStatusMessage(`Coverage environment set on ${selectedNodeIds.length} node(s).`);
                              flashSaved();
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="sidebar-node-list" aria-label="Node list">
                    {nodes.length === 0 ? (
                      <p className="sidebar-empty">No nodes yet</p>
                    ) : (
                      nodes.map((node) => {
                        const nodeId = String(node.id);
                        const isPrimary = selectedNodeId === nodeId;
                        const isMulti = selectedNodeIds.includes(nodeId);
                        return (
                          <div key={node.id}
                            className={`sidebar-node-item ${isPrimary ? 'selected' : ''} ${isMulti && !isPrimary ? 'multi-selected' : ''}`}
                            title={`Click to select "${node.name}". Ctrl+Click for multi-select.`}
                            onClick={(e) => handleNodeClick(nodeId, e)}>
                            <div className="node-row">
                              <span className="node-name">{node.name}</span>
                              {node.coverage_environment && ENV_BADGE[node.coverage_environment] ? (
                                <span
                                  className="node-env-badge"
                                  style={{ backgroundColor: ENV_BADGE[node.coverage_environment].color }}
                                  title={`Coverage environment override: ${COVERAGE_ENV_OPTIONS.find((o) => o.value === node.coverage_environment)?.label ?? node.coverage_environment}`}
                                >
                                  {ENV_BADGE[node.coverage_environment].label}
                                </span>
                              ) : (
                                <span
                                  className="node-env-badge"
                                  style={{ backgroundColor: '#4a5568' }}
                                  title="Using global coverage environment setting"
                                >
                                  Global
                                </span>
                              )}
                              <button className="node-delete-btn" type="button"
                                title="Delete node"
                                onClick={(e) => { e.stopPropagation(); handleDeleteNode(node); }}>
                                x
                              </button>
                            </div>
                            <span className="node-coords">
                              {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Node Config (per-node settings only) */}
            {renderNodeConfig()}
          </aside>
        )}
        <MainContent />
      </div>
      <StatusBar status={buildStatus()} isLoading={analysisLoading} />
      {/* Blocking overlay — prevents interaction while terrain analysis runs */}
      {analysisLoading && (
        <div
          className="analysis-loading-overlay"
          role="progressbar"
          aria-label="Analysis in progress"
          aria-busy="true"
        >
          <div className="analysis-loading-box">
            <span className="analysis-loading-spinner" aria-hidden="true" />
            <span className="analysis-loading-text">{buildStatus()}</span>
            <button
              className="analysis-loading-cancel"
              type="button"
              onClick={() => { losCancelRef.current = true; setAnalysisLoading(false); setStatusMessage('Analysis cancelled.'); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Environment warning — shown before compute starts */}
      <ConfirmDialog
        isOpen={!!envWarningDialog}
        title="Environment Recommendation"
        message={`${envWarningDialog?.nodeNames} — the current environment underestimates coverage for elevated nodes. Switch to Clear LOS (Elevated) for accurate simulation?`}
        confirmText="Switch to Clear LOS & Run"
        cancelText="Run Anyway"
        onConfirm={envWarningDialog?.onSwitch ?? (() => {})}
        onCancel={envWarningDialog?.onRunAnyway ?? (() => {})}
      />
      <LinkReportModal isOpen={showLinkReport} onClose={() => setShowLinkReport(false)} onExportPDF={handleExportNetworkPDF} />
      <RepeaterChainModal isOpen={showRepeaterChain} onClose={() => setShowRepeaterChain(false)} />
      <MeshCoreAirtimeModal isOpen={showMeshCoreAirtime} onClose={() => setShowMeshCoreAirtime(false)} />
      <MeshCoreCapacityModal isOpen={showMeshCoreCapacity} onClose={() => setShowMeshCoreCapacity(false)} />
      <MeshCoreFreqCoordModal isOpen={showMeshCoreFreqCoord} onClose={() => setShowMeshCoreFreqCoord(false)} />
      <TimeOnAirModal
        isOpen={showTimeOnAir}
        onClose={() => setShowTimeOnAir(false)}
        catalogModemPresets={catalogModemPresets}
        currentPresetSF={networkRadio.spreading_factor}
        currentPresetBW={networkRadio.bandwidth_khz}
        currentPresetCR={networkRadio.coding_rate}
        catalogDevices={catalogDevices}
        currentDeviceId={selectedNode?.device_id}
      />
      <ChannelCapacityModal
        isOpen={showChannelCapacity}
        onClose={() => setShowChannelCapacity(false)}
        catalogModemPresets={catalogModemPresets}
        currentPresetSF={networkRadio.spreading_factor}
        currentPresetBW={networkRadio.bandwidth_khz}
        currentPresetCR={networkRadio.coding_rate}
        currentNodeCount={nodes.length}
      />
      <ReticulumAnnounceModal
        isOpen={showReticulumAnnounce}
        onClose={() => setShowReticulumAnnounce(false)}
      />
      <RNSLinkBudgetModal
        isOpen={showRNSLinkBudget}
        onClose={() => setShowRNSLinkBudget(false)}
      />
      <RNSTransportModal
        isOpen={showRNSTransport}
        onClose={() => setShowRNSTransport(false)}
      />
      <RNSThroughputModal
        isOpen={showRNSThroughput}
        onClose={() => setShowRNSThroughput(false)}
      />
      <BOMModal
        isOpen={showBOM}
        onClose={() => setShowBOM(false)}
        bomData={bomData}
        loading={bomLoading}
        error={bomError}
        onExportCSV={() => handleBOMExport('csv')}
        onExportPDF={() => handleBOMExport('pdf')}
        onExportCards={() => handleBOMExport('cards')}
        exporting={bomExporting}
      />
      <WelcomeTour key={tourForceKey} forceShow={tourForceKey > 0} />
      <InternetMapImportModal
        isOpen={internetMapImportOpen}
        onClose={() => setInternetMapImportOpen(false)}
        planId={currentPlan?.id ?? null}
      />
      <SignalImportModal
        isOpen={signalImportOpen}
        onClose={() => setSignalImportOpen(false)}
        planNodes={nodes.filter((n) => n.plan_id === currentPlan?.id).map((n) => ({ id: String(n.id), name: n.name }))}
      />
      <CatalogModal
        isOpen={catalogModalOpen}
        onClose={handleCatalogClose}
        forceTour={catalogTourForce}
        onTourComplete={() => setCatalogTourForce(false)}
      />
      {kmlExportDialog && (
        <KMLExportDialog
          nodeCount={kmlExportDialog.nodeCount}
          linkCount={kmlExportDialog.linkCount}
          onClose={() => setKmlExportDialog(null)}
        />
      )}
      {errorMsg && <ErrorDialog message={errorMsg} onClose={() => setErrorMsg(null)} />}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        message={confirmDialog?.message ?? ''}
        title={confirmDialog?.title}
        variant={confirmDialog?.variant}
        confirmText={confirmDialog?.confirmText}
        onConfirm={() => { confirmDialog?.onConfirm(); }}
        onCancel={() => setConfirmDialog(null)}
      />
      <ConfirmDialog
        isOpen={exitDialogOpen}
        title="Exit Application"
        message="Closing this tab or window will close the Mesh Community Planner app. Are you sure?"
        confirmText="Exit"
        cancelText="Cancel"
        variant="danger"
        showCloseButton
        closeOnBackdrop={false}
        onConfirm={handleExitConfirm}
        onCancel={() => setExitDialogOpen(false)}
      />
      <PromptDialog
        isOpen={promptDialog !== null}
        message={promptDialog?.message ?? ''}
        defaultValue={promptDialog?.defaultValue ?? ''}
        placeholder={promptDialog?.placeholder}
        onSubmit={(v) => { promptDialog?.onSubmit(v); }}
        onCancel={() => setPromptDialog(null)}
      />
      <FloodingSimModal
        isOpen={showFloodingSim}
        onClose={() => setShowFloodingSim(false)}
        nodes={nodes.map((n) => ({ id: String(n.id), uuid: String(n.id), name: n.name }))}
        losOverlays={losOverlays}
        radioSF={networkRadio.spreading_factor}
        radioBW={networkRadio.bandwidth_khz}
        radioCR={networkRadio.coding_rate}
      />
      <PlacementSuggestModal
        isOpen={showPlacementSuggest}
        onClose={() => setShowPlacementSuggest(false)}
        nodes={nodes.map((n) => ({ latitude: n.latitude, longitude: n.longitude, uuid: String(n.id), name: n.name }))}
        nodeRangeM={nodeRangeInfo.rangeM}
        nodeRangeDescription={nodeRangeInfo.description}
        onSuggest={handlePlacementSuggest}
        onAcceptNode={handleAcceptPlacementNode}
      />
      <PDFReportModal
        isOpen={showPDFReport}
        onClose={() => setShowPDFReport(false)}
        hasLOSOverlays={losOverlays.length > 0}
        hasCoverageOverlays={coverageOverlays.length > 0 || terrainCoverageOverlays.length > 0}
        onGenerate={handlePDFReportGenerate}
      />
    </div>
  );
}
