/**
 * MapContainer component
 * Main map component with Leaflet integration, OSM tiles, node markers,
 * multi-select, group drag, click-to-add toggle, and dynamic analysis overlays
 */

import { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { usePlanStore } from '../../stores/planStore';
import { useMapStore } from '../../stores/mapStore';
import type { TerrainCoverageOverlay, ViewshedOverlay, RoutePathOverlay, FloodingOverlay, PlacementSuggestion, SignalOverlay } from '../../stores/mapStore';
import { CoverageLegend } from './CoverageLegend';
import { ElevationLegend } from './ElevationLegend';
import { getAPIClient } from '../../services/api';
import { ensureHatchPatterns, removeHatchPatterns, getPatternId, getNodeHatchColor, getPatternType, PatternType } from '../../utils/hatchPatterns';
import { escapeHtml } from '../../utils/html';
import { observationRfSummary } from '../../utils/fieldObservationRf';
import { NODE_LABEL_TOOLTIP_OPTIONS, buildNodePopupHtml, createNodeIcon } from './nodeMarkerLeaflet';

// Stable default center - defined outside component to avoid re-creation
const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

/** Load a data URL as a fully decoded HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draw the sub-region of `img` that corresponds to the geographic intersection
 * rectangle onto an offscreen canvas of size W×H.  Returns the canvas.
 */
function drawImageSubregion(
  img: HTMLImageElement,
  bounds: { min_lat: number; max_lat: number; min_lon: number; max_lon: number },
  intMinLat: number, intMaxLat: number,
  intMinLon: number, intMaxLon: number,
  W: number, H: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const lonRange = bounds.max_lon - bounds.min_lon;
  const latRange = bounds.max_lat - bounds.min_lat;

  // Source rect within the image (Y is flipped: top of image = max_lat)
  const sx = ((intMinLon - bounds.min_lon) / lonRange) * img.naturalWidth;
  const sy = ((bounds.max_lat - intMaxLat) / latRange) * img.naturalHeight;
  const sw = ((intMaxLon - intMinLon) / lonRange) * img.naturalWidth;
  const sh = ((intMaxLat - intMinLat) / latRange) * img.naturalHeight;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return canvas;
}

/** Parse a 6-digit hex color string into {r, g, b}. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Returns true if pixel (x, y) falls on a hatch line for the given pattern type.
 * Spacing matches the SVG pattern tiles (12 px, 2 px stroke-width).
 */
function isHatchPixel(x: number, y: number, type: PatternType): boolean {
  const S = 12; // tile size matching hatchPatterns.ts
  const W = 2;  // stroke width
  switch (type) {
    case 'diag-right':   return ((x + y) % S) < W;
    case 'diag-left':    return (((x - y) % S) + S) % S < W;
    case 'horizontal':   return y % S < W;
    case 'vertical':     return x % S < W;
    case 'dots': {
      const cx = x % S, cy = y % S;
      const dist = Math.sqrt((cx - S / 2) ** 2 + (cy - S / 2) ** 2);
      return dist < W;
    }
    case 'cross':        return y % S < W || x % S < W;
  }
}

export interface MapContainerProps {
  className?: string;
}

export function MapContainer({ className = '' }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const losLayerRef = useRef<L.LayerGroup | null>(null);
  const coverageLayerRef = useRef<L.LayerGroup | null>(null);
  const terrainCoverageLayerRef = useRef<L.LayerGroup | null>(null);
  const terrainHatchLayerRef = useRef<L.LayerGroup | null>(null);
  const viewshedLayerRef = useRef<L.LayerGroup | null>(null);
  const routePathLayerRef = useRef<L.LayerGroup | null>(null);
  const floodingLayerRef = useRef<L.LayerGroup | null>(null);
  const placementLayerRef = useRef<L.LayerGroup | null>(null);
  const signalLayerRef = useRef<L.LayerGroup | null>(null);
  const fieldObservationLayerRef = useRef<L.LayerGroup | null>(null);
  const elevationTileLayerRef = useRef<L.TileLayer | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const elevationEnsureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPosRef = useRef<L.LatLng | null>(null);

  // Read store values
  const nodes = usePlanStore((s) => s.nodes);
  const addNode = usePlanStore((s) => s.addNode);
  const updateNodeStore = usePlanStore((s) => s.updateNode);
  const selectedNodeId = useMapStore((s) => s.selected_node_id);
  const selectedNodeIds = useMapStore((s) => s.selected_node_ids);
  const selectNode = useMapStore((s) => s.selectNode);
  const toggleNodeSelection = useMapStore((s) => s.toggleNodeSelection);
  const losOverlays = useMapStore((s) => s.los_overlays);
  const coverageOverlays = useMapStore((s) => s.coverage_overlays);
  const terrainCoverageOverlays = useMapStore((s) => s.terrain_coverage_overlays);
  const viewshedOverlays = useMapStore((s) => s.viewshed_overlays);
  const routePathOverlays = useMapStore((s) => s.route_path_overlays);
  const floodingOverlay = useMapStore((s) => s.flooding_overlay);
  const placementSuggestions = useMapStore((s) => s.placement_suggestions);
  const signalOverlays = useMapStore((s) => s.signal_overlays);
  const fieldObservations = useMapStore((s) => s.field_observations);
  const placementCoverageRadiusM = useMapStore((s) => s.placement_coverage_radius_m);
  const placementSearchBounds = useMapStore((s) => s.placement_search_bounds);
  const coverageOpacity = useMapStore((s) => s.coverageOpacity);
  const coverageHatchMode = useMapStore((s) => s.coverageHatchMode);
  const satelliteMode = useMapStore((s) => s.satelliteMode);
  const lockNodePositions = useMapStore((s) => s.lockNodePositions);
  const elevationLayerEnabled = useMapStore((s) => s.elevation_layer_enabled);
  const elevationOpacity = useMapStore((s) => s.elevationOpacity);
  const elevationMin = useMapStore((s) => s.elevationMin);
  const elevationMax = useMapStore((s) => s.elevationMax);
  const mapInvalidateCounter = useMapStore((s) => s.map_invalidate_counter);
  const fitBoundsCounter = useMapStore((s) => s.fit_bounds_counter);
  const fitBounds = useMapStore((s) => s.fit_bounds);

  // Handle map clicks for adding nodes (reads current network radio settings)
  const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
    const plan = usePlanStore.getState().current_plan;
    const mode = useMapStore.getState().mode;

    if (mode === 'add_field_observation') {
      useMapStore.getState().setFieldObservationDraft({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
      });
      return;
    }

    if (mode !== 'add_node' || !plan) return;

    const { lat, lng } = e.latlng;
    const currentNodes = usePlanStore.getState().nodes;
    const nodeNum = currentNodes.length + 1;

    // Inherit radio settings from existing nodes (network-wide consistency)
    const refNode = currentNodes.length > 0 ? currentNodes[0] : null;
    const firmware = refNode?.firmware || 'meshtastic';
    const region = refNode?.region || plan.region || 'us_fcc';
    const frequency = refNode?.frequency_mhz || 906.875;
    const sf = refNode?.spreading_factor || 11;
    const bw = refNode?.bandwidth_khz || 250;
    const cr = refNode?.coding_rate || '4/5';

    const api = getAPIClient();
    try {
      const newNode = await api.createNode(plan.id, {
        name: `Node ${nodeNum}`,
        latitude: lat,
        longitude: lng,
        antenna_height_m: 3,
        visibility: refNode?.visibility || 'private',
        coordinate_precision: refNode?.coordinate_precision || 'exact',
        node_role: 'planned',
        node_status: 'planned',
        device_id: 'tbeam-supreme',
        firmware,
        region,
        frequency_mhz: frequency,
        tx_power_dbm: 20,
        spreading_factor: sf,
        bandwidth_khz: bw,
        coding_rate: cr,
        modem_preset: null,
        antenna_id: '915-3dbi-omni',
        cable_id: null,
        cable_length_m: 0,
        pa_module_id: null,
        is_solar: false,
        desired_coverage_radius_m: null,
        notes: '',
      });
      addNode(newNode);
    } catch (err: any) {
      console.error('Failed to create node:', err);
      addNode({
        id: `temp-${Date.now()}`,
        plan_id: plan.id,
        name: `Node ${nodeNum}`,
        latitude: lat,
        longitude: lng,
        antenna_height_m: 3,
        visibility: refNode?.visibility || 'private',
        coordinate_precision: refNode?.coordinate_precision || 'exact',
        node_role: 'planned',
        node_status: 'planned',
        device_id: 'tbeam-supreme',
        firmware,
        region,
        frequency_mhz: frequency,
        tx_power_dbm: 20,
        spreading_factor: sf,
        bandwidth_khz: bw,
        coding_rate: cr,
        modem_preset: null,
        antenna_id: '915-3dbi-omni',
        cable_id: null,
        cable_length_m: 0,
        pa_module_id: null,
        is_solar: false,
        desired_coverage_radius_m: null,
        notes: '',
        environment: 'suburban',
        coverage_environment: null,
        sort_order: nodeNum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [addNode]);

  // Handle marker drag start - record initial position for group drag
  const handleMarkerDragStart = useCallback((_nodeId: string, e: L.LeafletEvent) => {
    if (useMapStore.getState().lockNodePositions) return;
    const marker = e.target as L.Marker;
    dragStartPosRef.current = marker.getLatLng();
  }, []);

  // Handle marker drag end - GROUP DRAG: update ALL selected node positions locally first, then API
  const handleMarkerDragEnd = useCallback(async (nodeId: string, e: L.DragEndEvent) => {
    if (useMapStore.getState().lockNodePositions) return;
    const latlng = (e.target as L.Marker).getLatLng();
    const plan = usePlanStore.getState().current_plan;
    const currentSelectedIds = useMapStore.getState().selected_node_ids;
    const startPos = dragStartPosRef.current;
    dragStartPosRef.current = null;

    // Collect all position updates
    const updates: Array<{ id: string; lat: number; lng: number }> = [];

    if (startPos && currentSelectedIds.length > 1 && currentSelectedIds.includes(nodeId)) {
      // GROUP DRAG: compute delta and apply to all selected nodes
      const deltaLat = latlng.lat - startPos.lat;
      const deltaLng = latlng.lng - startPos.lng;

      // Phase 1: Update ALL local store positions immediately (no awaits)
      for (const id of currentSelectedIds) {
        if (id === nodeId) {
          updateNodeStore(nodeId, { latitude: latlng.lat, longitude: latlng.lng });
          updates.push({ id: nodeId, lat: latlng.lat, lng: latlng.lng });
        } else {
          const otherNode = usePlanStore.getState().nodes.find((n) => String(n.id) === id);
          if (otherNode) {
            const newLat = otherNode.latitude + deltaLat;
            const newLng = otherNode.longitude + deltaLng;
            updateNodeStore(id, { latitude: newLat, longitude: newLng });
            updates.push({ id, lat: newLat, lng: newLng });
          }
        }
      }
    } else {
      // SINGLE drag
      updateNodeStore(nodeId, { latitude: latlng.lat, longitude: latlng.lng });
      updates.push({ id: nodeId, lat: latlng.lat, lng: latlng.lng });
    }

    // Phase 2: Persist all to API in parallel (non-blocking)
    if (plan) {
      const api = getAPIClient();
      for (const u of updates) {
        if (!u.id.startsWith('temp-')) {
          api.updateNode(plan.id, u.id, { latitude: u.lat, longitude: u.lng })
            .catch((err: any) => console.error('Failed to persist node position:', err));
        }
      }
    }
  }, [updateNodeStore]);

  // Initialize map (once)
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
    osmLayer.addTo(map);
    baseTileLayerRef.current = osmLayer;

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    const losLayer = L.layerGroup().addTo(map);
    losLayerRef.current = losLayer;

    const coverageLayer = L.layerGroup().addTo(map);
    coverageLayerRef.current = coverageLayer;

    const terrainCoverageLayer = L.layerGroup().addTo(map);
    terrainCoverageLayerRef.current = terrainCoverageLayer;

    // Terrain hatch layer sits above the heatmap images so patterns are visible
    const terrainHatchLayer = L.layerGroup().addTo(map);
    terrainHatchLayerRef.current = terrainHatchLayer;

    const viewshedLayer = L.layerGroup().addTo(map);
    viewshedLayerRef.current = viewshedLayer;

    const routePathLayer = L.layerGroup().addTo(map);
    routePathLayerRef.current = routePathLayer;

    const floodingLayer = L.layerGroup().addTo(map);
    floodingLayerRef.current = floodingLayer;

    const placementLayer = L.layerGroup().addTo(map);
    placementLayerRef.current = placementLayer;

    const signalLayer = L.layerGroup().addTo(map);
    signalLayerRef.current = signalLayer;
    const fieldObservationLayer = L.layerGroup().addTo(map);
    fieldObservationLayerRef.current = fieldObservationLayer;

    map.on('click', handleMapClick);

    leafletMapRef.current = map;

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Fix 1: Invalidate map size when sidebar toggles
  useEffect(() => {
    if (mapInvalidateCounter === 0) return;
    leafletMapRef.current?.invalidateSize();
  }, [mapInvalidateCounter]);

  // Fix 3: Fit bounds when a plan is loaded
  useEffect(() => {
    if (fitBoundsCounter === 0 || !fitBounds || !leafletMapRef.current) return;
    const [[swLat, swLng], [neLat, neLng]] = fitBounds;
    if (swLat === neLat && swLng === neLng) {
      // Single node — center on it
      leafletMapRef.current.setView([swLat, swLng], 14);
    } else {
      leafletMapRef.current.fitBounds([[swLat, swLng], [neLat, neLng]], { padding: [50, 50], maxZoom: 15 });
    }
  }, [fitBoundsCounter, fitBounds]);

  // Update markers when nodes or selection changes
  useEffect(() => {
    if (!markersLayerRef.current || !leafletMapRef.current) return;

    const currentMarkerIds = new Set(markersRef.current.keys());
    const newNodeIds = new Set(nodes.map((n) => String(n.id)));

    // Remove markers for deleted nodes
    currentMarkerIds.forEach((id) => {
      if (!newNodeIds.has(id)) {
        const marker = markersRef.current.get(id);
        if (marker) {
          markersLayerRef.current!.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }
    });

    // Add or update markers for each node
    nodes.forEach((node) => {
      const nodeId = String(node.id);
      const isPrimarySelected = selectedNodeId === nodeId;
      const isMultiSelected = selectedNodeIds.includes(nodeId);
      const existingMarker = markersRef.current.get(nodeId);
      const nodeNameHtml = escapeHtml(node.name);
      const nodePopupHtml = buildNodePopupHtml(node);

      if (existingMarker) {
        existingMarker.setLatLng([node.latitude, node.longitude]);
        existingMarker.setIcon(createNodeIcon(isPrimarySelected, isMultiSelected && !isPrimarySelected));
        existingMarker.setPopupContent(nodePopupHtml);
        // Update permanent label — must unbind/rebind to change options
        existingMarker.unbindTooltip();
        existingMarker.bindTooltip(nodeNameHtml, NODE_LABEL_TOOLTIP_OPTIONS);
        const existingEl = existingMarker.getElement();
        if (existingEl) existingEl.setAttribute('aria-label', `Node: ${node.name}`);
        if (lockNodePositions) existingMarker.dragging?.disable();
        else existingMarker.dragging?.enable();
      } else {
        const marker = L.marker([node.latitude, node.longitude], {
          icon: createNodeIcon(isPrimarySelected, isMultiSelected && !isPrimarySelected),
          draggable: !lockNodePositions,
        })
          .bindPopup(nodePopupHtml)
          .bindTooltip(nodeNameHtml, NODE_LABEL_TOOLTIP_OPTIONS);

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const originalEvent = (e as any).originalEvent as MouseEvent;
          if (originalEvent && (originalEvent.ctrlKey || originalEvent.metaKey)) {
            toggleNodeSelection(nodeId);
          } else {
            // If this node is already in a multi-selection, just make it primary
            const currentIds = useMapStore.getState().selected_node_ids;
            if (currentIds.includes(nodeId) && currentIds.length > 1) {
              useMapStore.setState({ selected_node_id: nodeId });
            } else {
              selectNode(nodeId);
            }
          }
        });

        marker.on('dragstart', (e) => handleMarkerDragStart(nodeId, e));
        marker.on('dragend', (e) => handleMarkerDragEnd(nodeId, e));

        markersLayerRef.current!.addLayer(marker);
        const markerEl = marker.getElement();
        if (markerEl) markerEl.setAttribute('aria-label', `Node: ${node.name}`);
        markersRef.current.set(nodeId, marker);
      }
    });
  }, [nodes, selectedNodeId, selectedNodeIds, selectNode, toggleNodeSelection, handleMarkerDragStart, handleMarkerDragEnd, lockNodePositions]);

  // Build popup HTML for a LOS overlay
  const buildLOSPopupHtml = useCallback((los: typeof losOverlays[number]) => {
    const qualityLabel = !los.isViable
      ? 'Not Viable'
      : !los.hasLos
        ? 'NLOS (Obstructed)'
        : los.linkQuality === 'marginal'
          ? 'Marginal'
          : 'Good';

    const terrainLines: string[] = [];
    if (!los.hasLos) {
      terrainLines.push(`<b style="color:#f97316">Terrain Obstructed</b>`);
      if (los.maxObstructionM > 0) {
        terrainLines.push(`Obstruction: ${los.maxObstructionM.toFixed(1)}m above LOS`);
      }
      if (los.additionalLossDb > 0) {
        terrainLines.push(`Diffraction Loss: ${los.additionalLossDb.toFixed(1)} dB`);
      }
    } else {
      terrainLines.push(`<b style="color:#16a34a">Clear Line of Sight</b>`);
    }
    if (los.totalPathLossDb > 0) {
      const fspl = los.freeSpaceLossDb > 0 ? ` (FSPL: ${los.freeSpaceLossDb.toFixed(1)})` : '';
      terrainLines.push(`Path Loss: ${los.totalPathLossDb.toFixed(1)} dB${fspl}`);
    }

    const elevSrc = los.elevationSource || 'flat_terrain';
    const elevLabel = elevSrc === 'srtm_30m' ? 'SRTM 30m'
      : elevSrc === 'srtm_partial' ? 'SRTM (partial)'
      : elevSrc === 'srtm_no_data' ? 'SRTM (no data)'
      : 'Flat terrain';
    const elevColor = elevSrc.startsWith('srtm') && elevSrc !== 'srtm_no_data' ? '#16a34a' : '#f97316';
    const elevRange = los.elevationMaxM > 0
      ? ` (${los.elevationMinM.toFixed(0)}-${los.elevationMaxM.toFixed(0)}m)`
      : '';

    return (
      `<b>Link: ${escapeHtml(los.nodeAName)} <-> ${escapeHtml(los.nodeBName)}</b><br>` +
      `Quality: ${qualityLabel}<br>` +
      `Distance: ${(los.distanceM / 1000).toFixed(2)} km<br>` +
      terrainLines.join('<br>') + '<br>' +
      `Fresnel Clearance: ${los.fresnelClearancePct.toFixed(0)}%<br>` +
      `Link Margin: ${los.linkMarginDb.toFixed(1)} dB<br>` +
      `Rx Signal: ${los.receivedSignalDbm.toFixed(1)} dBm<br>` +
      `<span style="color:${elevColor}">Terrain: ${elevLabel}${elevRange}</span>`
    );
  }, []);

  // Draw LOS overlays - DYNAMIC: look up current node positions from nodes array
  // Fix 5: invisible hit lines for wider click area
  // Fix 6: disambiguation popup when multiple lines overlap
  useEffect(() => {
    if (!losLayerRef.current || !leafletMapRef.current) return;
    losLayerRef.current.clearLayers();

    const map = leafletMapRef.current;

    // Store hit lines + LOS data for disambiguation
    const hitLines: Array<{ line: L.Polyline; los: typeof losOverlays[number]; visibleLine: L.Polyline }> = [];

    losOverlays.forEach((los) => {
      const nodeA = nodes.find((n) => String(n.id) === los.nodeAUuid);
      const nodeB = nodes.find((n) => String(n.id) === los.nodeBUuid);
      if (!nodeA || !nodeB) return;

      let color = '#16a34a';
      let dashArray = '';
      let weight = 3;
      if (!los.isViable) {
        color = '#dc2626';
        dashArray = '10, 5';
        weight = 3;
      } else if (!los.hasLos) {
        color = '#f97316';
        dashArray = '8, 4';
        weight = 3;
      } else if (los.linkQuality === 'marginal') {
        color = '#eab308';
        dashArray = '5, 5';
      }

      const coords: L.LatLngExpression[] = [[nodeA.latitude, nodeA.longitude], [nodeB.latitude, nodeB.longitude]];

      // Invisible wide hit-detection line (Fix 5)
      const hitLine = L.polyline(coords, { weight: 16, opacity: 0, interactive: true });

      // Visible styled line on top
      const visibleLine = L.polyline(coords, { color, weight, opacity: 0.8, dashArray, interactive: false });

      const qualityLabel = !los.isViable ? 'Not Viable' : !los.hasLos ? 'NLOS (Obstructed)' : los.linkQuality === 'marginal' ? 'Marginal' : 'Good';
      const losTag = los.hasLos ? '' : ' NLOS';
      visibleLine.bindTooltip(`${qualityLabel}${losTag} (${(los.distanceM / 1000).toFixed(1)}km)`);
      hitLine.bindTooltip(`${qualityLabel}${losTag} (${(los.distanceM / 1000).toFixed(1)}km)`);

      hitLines.push({ line: hitLine, los, visibleLine });

      losLayerRef.current!.addLayer(hitLine);
      losLayerRef.current!.addLayer(visibleLine);
    });

    // Fix 6: Disambiguation — on hit line click, check for nearby overlapping lines
    const distToSegment = (pt: L.Point, a: L.Point, b: L.Point): number => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return pt.distanceTo(a);
      let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const proj = L.point(a.x + t * dx, a.y + t * dy);
      return pt.distanceTo(proj);
    };

    hitLines.forEach(({ line, los }) => {
      line.on('click', (e: L.LeafletMouseEvent) => {
        const clickPt = map.latLngToLayerPoint(e.latlng);

        // Find all lines within 20px of the click point
        const nearby = hitLines.filter(({ los: otherLos }) => {
          const nA = nodes.find((n) => String(n.id) === otherLos.nodeAUuid);
          const nB = nodes.find((n) => String(n.id) === otherLos.nodeBUuid);
          if (!nA || !nB) return false;
          const ptA = map.latLngToLayerPoint(L.latLng(nA.latitude, nA.longitude));
          const ptB = map.latLngToLayerPoint(L.latLng(nB.latitude, nB.longitude));
          return distToSegment(clickPt, ptA, ptB) <= 20;
        });

        if (nearby.length <= 1) {
          // Single match — open detail popup directly on the line
          L.popup().setLatLng(e.latlng).setContent(buildLOSPopupHtml(los)).openOn(map);
        } else {
          // Multiple matches — disambiguation popup
          const items = nearby.map(({ los: nLos }) => {
            const q = !nLos.isViable ? 'Not Viable' : !nLos.hasLos ? 'NLOS' : nLos.linkQuality === 'marginal' ? 'Marginal' : 'Good';
            const dist = (nLos.distanceM / 1000).toFixed(2);
            return `<div class="los-disambig-item" data-los-id="${escapeHtml(nLos.id)}" style="cursor:pointer;padding:3px 6px;border-bottom:1px solid #555;">` +
              `<b>${escapeHtml(nLos.nodeAName)} ↔ ${escapeHtml(nLos.nodeBName)}</b> — ${q}, ${dist} km</div>`;
          }).join('');

          const popup = L.popup({ className: 'los-disambig-popup', maxWidth: 320 })
            .setLatLng(e.latlng)
            .setContent(`<div class="los-disambig"><div class="los-disambig-title">Multiple links at this point:</div>${items}</div>`)
            .openOn(map);

          // Bind click handlers on disambiguation items
          setTimeout(() => {
            const container = popup.getElement();
            if (!container) return;
            container.querySelectorAll('.los-disambig-item').forEach((el) => {
              el.addEventListener('click', () => {
                const losId = (el as HTMLElement).dataset.losId;
                const match = nearby.find(({ los: nLos }) => nLos.id === losId);
                if (match) {
                  L.popup().setLatLng(e.latlng).setContent(buildLOSPopupHtml(match.los)).openOn(map);
                }
              });
            });
          }, 50);
        }
      });
    });
  }, [losOverlays, nodes, buildLOSPopupHtml]); // depends on NODES so lines update when nodes move

  // Draw coverage overlays - DYNAMIC: look up current node positions
  useEffect(() => {
    if (!coverageLayerRef.current || !leafletMapRef.current) return;
    coverageLayerRef.current.clearLayers();

    coverageOverlays.forEach((cov, index) => {
      // Look up current position from nodes array
      const node = nodes.find((n) => String(n.id) === cov.nodeUuid);
      if (!node) return; // skip if deleted

      const strokeColor = coverageHatchMode ? getNodeHatchColor(index) : '#3498db';
      const fillColor = coverageHatchMode ? `url(#${getPatternId(index)})` : '#3498db';

      const circle = L.circle([node.latitude, node.longitude], {
        radius: cov.coverageRadiusM,
        color: strokeColor,
        fillColor,
        fillOpacity: coverageHatchMode ? 1 : 0.15,
        weight: 2,
        dashArray: coverageHatchMode ? undefined : '5, 5',
      });

      circle.bindPopup(
        `<b>Coverage: ${escapeHtml(cov.nodeName)}</b><br>` +
        `Radius: ${(cov.coverageRadiusM / 1000).toFixed(2)} km<br>` +
        `Engine: ${escapeHtml(cov.engine)}`
      );

      circle.bindTooltip(`${(cov.coverageRadiusM / 1000).toFixed(1)}km radius`);
      coverageLayerRef.current!.addLayer(circle);
    });

    // Inject/remove SVG hatch pattern defs AFTER circles are drawn.
    // Leaflet creates its SVG element lazily on first path add, so querying
    // before the forEach above would return null and the url(#id) references
    // would silently fall back to no fill.
    const overlayPane = leafletMapRef.current.getPanes().overlayPane;
    const svgEl = overlayPane?.querySelector('svg') as SVGSVGElement | null;
    if (svgEl) {
      if (coverageHatchMode) {
        ensureHatchPatterns(svgEl, coverageOverlays.length);
      } else {
        removeHatchPatterns(svgEl);
      }
    }
  }, [coverageOverlays, nodes, coverageHatchMode]); // depends on NODES so circles follow nodes

  // Swap base tile layer between OSM street map and ESRI World Imagery satellite.
  // The base layer ref is captured at map init; we remove it and replace it on toggle.
  useEffect(() => {
    const map = leafletMapRef.current;
    const currentBase = baseTileLayerRef.current;
    if (!map || !currentBase) return;

    map.removeLayer(currentBase);

    const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const SAT_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    const newBase = satelliteMode
      ? L.tileLayer(SAT_URL, { attribution: SAT_ATTR, maxZoom: 19 })
      : L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 });

    // Insert below all overlay layers so markers/coverage stay on top
    newBase.addTo(map);
    newBase.bringToBack();
    baseTileLayerRef.current = newBase;
  }, [satelliteMode]);

  // Draw terrain coverage heat map overlays (L.imageOverlay)
  useEffect(() => {
    if (!terrainCoverageLayerRef.current) return;
    terrainCoverageLayerRef.current.clearLayers();

    terrainCoverageOverlays.forEach((overlay: TerrainCoverageOverlay) => {
      if (!overlay.imageDataUrl) return;

      const node = nodes.find((n) => String(n.id) === overlay.nodeUuid);

      const imageBounds: L.LatLngBoundsExpression = [
        [overlay.bounds.min_lat, overlay.bounds.min_lon],
        [overlay.bounds.max_lat, overlay.bounds.max_lon],
      ];

      const imageOverlay = L.imageOverlay(overlay.imageDataUrl, imageBounds, {
        opacity: coverageOpacity,
        interactive: true,
      });

      // Signal stats are precomputed — raw points not stored in state
      let popupContent = `<b>Coverage: ${escapeHtml(overlay.nodeName)}</b><br>` +
        `Environment: ${escapeHtml(overlay.environment)}<br>`;
      if (overlay.pointCount > 0) {
        popupContent +=
          `Signal range: ${overlay.signalMax.toFixed(0)} to ${overlay.signalMin.toFixed(0)} dBm<br>` +
          `Average: ${overlay.signalMean.toFixed(1)} dBm<br>`;
      }
      popupContent +=
        `Grid points: ${overlay.pointCount.toLocaleString()}<br>` +
        `Elevation: ${escapeHtml(overlay.elevationSource)}<br>` +
        `Compute: ${overlay.computationTimeMs}ms`;

      imageOverlay.bindPopup(popupContent);

      // Dashed max-radius ring — low opacity at rest, full opacity on heatmap hover
      if (node && overlay.maxRadiusM) {
        const ring = L.circle([node.latitude, node.longitude], {
          radius: overlay.maxRadiusM,
          color: '#6b7280',
          weight: 1.5,
          dashArray: '6 6',
          fill: false,
          interactive: true,
          opacity: 0.4,
        });
        ring.bindTooltip(`Analysis boundary: ${(overlay.maxRadiusM / 1000).toFixed(0)} km`, { sticky: true });
        imageOverlay.on('mouseover', () => { ring.setStyle({ opacity: 1.0 }); });
        imageOverlay.on('mouseout', () => { ring.setStyle({ opacity: 0.4 }); });
        terrainCoverageLayerRef.current!.addLayer(ring);
      }

      terrainCoverageLayerRef.current!.addLayer(imageOverlay);
    });
  }, [terrainCoverageOverlays, coverageOpacity, nodes]);

  // Render hatch overlay images showing only the actual pixel overlap between
  // terrain coverage heatmaps. For each pair (i, j), load both imageDataUrl PNGs
  // onto offscreen canvases, find pixels where both have signal coverage (alpha > 10),
  // paint a per-pair hatch pattern onto those pixels only, then place the result as
  // an L.imageOverlay bounded to the geographic intersection of the two heatmaps.
  useEffect(() => {
    if (!terrainHatchLayerRef.current || !leafletMapRef.current) return;
    terrainHatchLayerRef.current.clearLayers();

    if (!coverageHatchMode || terrainCoverageOverlays.length < 2) return;

    let cancelled = false;
    const SIZE = 512; // offscreen canvas resolution

    const renderOverlaps = async () => {
      let pairIndex = 0;

      for (let i = 0; i < terrainCoverageOverlays.length; i++) {
        for (let j = i + 1; j < terrainCoverageOverlays.length; j++) {
          if (cancelled) return;

          const ov1 = terrainCoverageOverlays[i];
          const ov2 = terrainCoverageOverlays[j];
          if (!ov1.imageDataUrl || !ov2.imageDataUrl) { pairIndex++; continue; }

          const b1 = ov1.bounds;
          const b2 = ov2.bounds;

          // Geographic bounding-box intersection
          const intMinLat = Math.max(b1.min_lat, b2.min_lat);
          const intMaxLat = Math.min(b1.max_lat, b2.max_lat);
          const intMinLon = Math.max(b1.min_lon, b2.min_lon);
          const intMaxLon = Math.min(b1.max_lon, b2.max_lon);

          if (intMinLat >= intMaxLat || intMinLon >= intMaxLon) { pairIndex++; continue; }

          const [img1, img2] = await Promise.all([
            loadImage(ov1.imageDataUrl),
            loadImage(ov2.imageDataUrl),
          ]);
          if (cancelled) return;

          // Crop each image to the intersection region, drawn at SIZE×SIZE
          const c1 = drawImageSubregion(img1, b1, intMinLat, intMaxLat, intMinLon, intMaxLon, SIZE, SIZE);
          const c2 = drawImageSubregion(img2, b2, intMinLat, intMaxLat, intMinLon, intMaxLon, SIZE, SIZE);

          const px1 = c1.getContext('2d')!.getImageData(0, 0, SIZE, SIZE).data;
          const px2 = c2.getContext('2d')!.getImageData(0, 0, SIZE, SIZE).data;

          const resultCanvas = document.createElement('canvas');
          resultCanvas.width = SIZE;
          resultCanvas.height = SIZE;
          const ctx = resultCanvas.getContext('2d')!;
          const result = ctx.createImageData(SIZE, SIZE);
          const rd = result.data;

          const color = hexToRgb(getNodeHatchColor(pairIndex));
          const patType = getPatternType(pairIndex);

          for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
              const idx = (y * SIZE + x) * 4;
              if (px1[idx + 3] > 10 && px2[idx + 3] > 10 && isHatchPixel(x, y, patType)) {
                rd[idx]     = color.r;
                rd[idx + 1] = color.g;
                rd[idx + 2] = color.b;
                rd[idx + 3] = 220;
              }
            }
          }

          ctx.putImageData(result, 0, 0);
          if (cancelled) return;

          const dataUrl = resultCanvas.toDataURL('image/png');
          const overlayBounds: L.LatLngBoundsExpression = [
            [intMinLat, intMinLon],
            [intMaxLat, intMaxLon],
          ];
          L.imageOverlay(dataUrl, overlayBounds, { opacity: 1, interactive: false, zIndex: 250 })
            .addTo(terrainHatchLayerRef.current!);

          pairIndex++;
        }
      }
    };

    renderOverlaps().catch(console.error);
    return () => { cancelled = true; };
  }, [terrainCoverageOverlays, coverageHatchMode]);

  // Draw viewshed overlays — green solid for visible, red dashed for blocked
  useEffect(() => {
    if (!viewshedLayerRef.current) return;
    viewshedLayerRef.current.clearLayers();

    viewshedOverlays.forEach((vs: ViewshedOverlay) => {
      const observer = nodes.find((n) => String(n.id) === vs.observerUuid);
      if (!observer) return;

      vs.results.forEach((target) => {
        const targetNode = nodes.find((n) => String(n.id) === target.nodeId);
        const lat = targetNode?.latitude ?? target.latitude;
        const lon = targetNode?.longitude ?? target.longitude;

        const coords: L.LatLngExpression[] = [
          [observer.latitude, observer.longitude],
          [lat, lon],
        ];

        const color = target.hasLos ? '#16a34a' : '#dc2626';
        const dashArray = target.hasLos ? '' : '10, 5';

        const line = L.polyline(coords, {
          color,
          weight: 2,
          opacity: 0.7,
          dashArray,
          interactive: true,
        });

        const statusLabel = target.hasLos ? 'Visible' : 'Blocked';
        const distKm = (target.distanceM / 1000).toFixed(2);
        const obstructionHtml = target.maxObstructionM != null && target.maxObstructionM > 0
          ? `<br>Obstruction: ${target.maxObstructionM.toFixed(1)}m above LOS` : '';
        const terrainTag = vs.terrainAvailable ? 'SRTM terrain' : 'Flat terrain';

        line.bindPopup(
          `<b>Viewshed: ${escapeHtml(vs.observerName)} → ${escapeHtml(target.nodeName)}</b><br>` +
          `Status: <b>${statusLabel}</b><br>` +
          `Distance: ${distKm} km${obstructionHtml}<br>` +
          `Terrain: ${terrainTag}`
        );

        line.bindTooltip(`${escapeHtml(target.nodeName)}: ${statusLabel} (${distKm}km)`);
        viewshedLayerRef.current!.addLayer(line);
      });
    });
  }, [viewshedOverlays, nodes]);

  // Draw route path overlays — cyan bold for primary, dashed for alternatives
  useEffect(() => {
    if (!routePathLayerRef.current) return;
    routePathLayerRef.current.clearLayers();

    routePathOverlays.forEach((route: RoutePathOverlay) => {
      const isPrimary = route.rank === 0;
      const pathCoords: L.LatLngExpression[] = [];

      for (const uuid of route.path) {
        const node = nodes.find((n) => String(n.id) === uuid);
        if (node) pathCoords.push([node.latitude, node.longitude]);
      }

      if (pathCoords.length < 2) return;

      const line = L.polyline(pathCoords, {
        color: '#06b6d4',
        weight: isPrimary ? 5 : 3,
        opacity: isPrimary ? 0.9 : 0.5,
        dashArray: isPrimary ? '' : '8, 6',
        interactive: true,
      });

      if (isPrimary) {
        const hopDetails = route.pathLinks.map((link) => {
          const nA = nodes.find((n) => String(n.id) === link.nodeAUuid);
          const nB = nodes.find((n) => String(n.id) === link.nodeBUuid);
          return `${escapeHtml(nA?.name || '?')} → ${escapeHtml(nB?.name || '?')}: ${(link.distanceM / 1000).toFixed(2)} km (${escapeHtml(link.linkQuality)})`;
        }).join('<br>');

        line.bindPopup(
          `<b>Route: ${escapeHtml(route.sourceName)} → ${escapeHtml(route.targetName)}</b><br>` +
          `Hops: ${route.hopCount}<br>` +
          `Total distance: ${(route.totalDistanceM / 1000).toFixed(2)} km<br>` +
          `<hr style="margin:4px 0">${hopDetails}`
        );
      } else {
        line.bindPopup(
          `<b>Alternative route #${route.rank}</b><br>` +
          `${escapeHtml(route.sourceName)} → ${escapeHtml(route.targetName)}<br>` +
          `Hops: ${route.hopCount}, Distance: ${(route.totalDistanceM / 1000).toFixed(2)} km`
        );
      }

      const label = isPrimary ? 'Primary' : `Alt #${route.rank}`;
      line.bindTooltip(`${label}: ${route.hopCount} hops, ${(route.totalDistanceM / 1000).toFixed(1)}km`);
      routePathLayerRef.current!.addLayer(line);
    });
  }, [routePathOverlays, nodes]);

  // Draw flooding simulation overlay — animated wave expansion with critical node/bridge highlighting
  useEffect(() => {
    if (!floodingLayerRef.current) return;
    floodingLayerRef.current.clearLayers();

    if (!floodingOverlay) return;

    const waveColors = ['#2ecc71', '#27ae60', '#f1c40f', '#e67e22', '#e74c3c', '#9b59b6'];
    const criticalSet = new Set(floodingOverlay.criticalNodeIds || []);
    const bridgeSet = new Set(
      (floodingOverlay.bridgeLinks || []).map((b) => [b.from, b.to].sort().join('-')),
    );

    // Draw waves up to currentWaveIndex
    for (let i = 0; i <= floodingOverlay.currentWaveIndex && i < floodingOverlay.waves.length; i++) {
      const wave = floodingOverlay.waves[i];
      const color = waveColors[Math.min(i, waveColors.length - 1)];
      const isCurrentWave = i === floodingOverlay.currentWaveIndex;

      // Draw links for this wave
      for (const link of wave.links) {
        const fromNode = nodes.find((n) => String(n.id) === link.from);
        const toNode = nodes.find((n) => String(n.id) === link.to);
        if (!fromNode || !toNode) continue;

        const linkKey = [link.from, link.to].sort().join('-');
        const isBridge = bridgeSet.has(linkKey);

        const line = L.polyline(
          [[fromNode.latitude, fromNode.longitude], [toNode.latitude, toNode.longitude]],
          {
            color: isBridge ? '#e74c3c' : color,
            weight: isCurrentWave ? 5 : (isBridge ? 4 : 3),
            opacity: isCurrentWave ? 1.0 : 0.7,
            dashArray: isBridge ? '8, 4' : (isCurrentWave ? '6, 4' : ''),
          }
        );
        const bridgeTag = isBridge ? ' [BRIDGE]' : '';
        line.bindTooltip(`Hop ${i}: ${(link.distanceM / 1000).toFixed(2)} km${bridgeTag}`);
        floodingLayerRef.current!.addLayer(line);
      }

      // Draw node circles for this wave
      for (const nodeId of wave.nodeIds) {
        const node = nodes.find((n) => String(n.id) === nodeId);
        if (!node) continue;

        const isSource = i === 0;
        const isCritical = criticalSet.has(nodeId);
        const radius = isSource ? 12 : 8;
        const circle = L.circleMarker([node.latitude, node.longitude], {
          radius,
          color,
          fillColor: color,
          fillOpacity: isSource ? 0.9 : 0.6,
          weight: isSource ? 3 : 2,
        });
        circle.bindTooltip(`${escapeHtml(node.name)} (Hop ${i}, ${wave.cumulativeTimeMs.toFixed(0)}ms)${isCritical ? ' [CRITICAL]' : ''}`);
        floodingLayerRef.current!.addLayer(circle);

        // Red dashed ring around critical (articulation point) nodes
        if (isCritical) {
          const ring = L.circleMarker([node.latitude, node.longitude], {
            radius: radius + 6,
            color: '#e74c3c',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 2,
            dashArray: '4, 3',
            interactive: false,
          });
          floodingLayerRef.current!.addLayer(ring);
        }
      }
    }
  }, [floodingOverlay, nodes]);

  // Flooding animation timer — advance wave index when playing (speed-aware)
  useEffect(() => {
    if (!floodingOverlay?.isPlaying) return;
    const maxWave = floodingOverlay.waves.length - 1;
    if (floodingOverlay.currentWaveIndex >= maxWave) {
      useMapStore.getState().setFloodingPlaying(false);
      return;
    }
    const speedMs = floodingOverlay.animationSpeedMs ?? 800;
    const timer = setInterval(() => {
      const overlay = useMapStore.getState().flooding_overlay;
      if (!overlay || !overlay.isPlaying) return;
      const next = overlay.currentWaveIndex + 1;
      if (next > maxWave) {
        useMapStore.getState().setFloodingPlaying(false);
      } else {
        useMapStore.getState().updateFloodingWaveIndex(next);
      }
    }, speedMs);
    return () => clearInterval(timer);
  }, [floodingOverlay?.isPlaying, floodingOverlay?.waves.length, floodingOverlay?.animationSpeedMs]);

  // Elevation heatmap tile layer — create/destroy when toggled or range changes
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Always remove existing layer first (range may have changed)
    if (elevationTileLayerRef.current) {
      const handler = (elevationTileLayerRef.current as any)._ensureHandler;
      if (handler) map.off('moveend', handler);
      map.removeLayer(elevationTileLayerRef.current);
      elevationTileLayerRef.current = null;
    }
    if (elevationEnsureTimerRef.current) {
      clearTimeout(elevationEnsureTimerRef.current);
      elevationEnsureTimerRef.current = null;
    }

    if (elevationLayerEnabled) {
      const authToken = (window as any).__MESH_PLANNER_AUTH__ || '';
      // Append range params only when they differ from defaults
      const isCustomRange = elevationMin !== -500 || elevationMax !== 9000;
      const rangeParams = isCustomRange
        ? `&elev_min=${elevationMin}&elev_max=${elevationMax}`
        : '';
      const tileLayer = L.tileLayer(
        `/api/elevation/tile/{z}/{x}/{y}.png?token=${encodeURIComponent(authToken)}${rangeParams}`,
        {
          minZoom: 9,
          maxZoom: 15,
          opacity: elevationOpacity,
          errorTileUrl: '',  // suppress broken tile images
        }
      );
      tileLayer.addTo(map);
      elevationTileLayerRef.current = tileLayer;

      // Ensure SRTM tiles are available for the visible area, then redraw
      const ensureAndRedraw = () => {
        if (elevationEnsureTimerRef.current) clearTimeout(elevationEnsureTimerRef.current);
        elevationEnsureTimerRef.current = setTimeout(async () => {
          const bounds = map.getBounds();
          try {
            await fetch('/api/elevation/ensure-tiles', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                min_lat: bounds.getSouth(),
                min_lon: bounds.getWest(),
                max_lat: bounds.getNorth(),
                max_lon: bounds.getEast(),
              }),
            });
            elevationTileLayerRef.current?.redraw();
          } catch (err) {
            console.warn('Failed to ensure elevation tiles:', err);
          }
        }, 500);
      };

      map.on('moveend', ensureAndRedraw);
      (tileLayer as any)._ensureHandler = ensureAndRedraw;

      // Initial ensure for current view
      ensureAndRedraw();
    }
  }, [elevationLayerEnabled, elevationMin, elevationMax]);

  // Update elevation tile layer opacity
  useEffect(() => {
    if (elevationTileLayerRef.current) {
      elevationTileLayerRef.current.setOpacity(elevationOpacity);
    }
  }, [elevationOpacity]);

  // Draw placement suggestion ghost markers
  useEffect(() => {
    if (!placementLayerRef.current) return;
    placementLayerRef.current.clearLayers();

    // Draw search boundary rectangle if bounds are set
    if (placementSearchBounds) {
      const rect = L.rectangle(
        [
          [placementSearchBounds.min_lat, placementSearchBounds.min_lon],
          [placementSearchBounds.max_lat, placementSearchBounds.max_lon],
        ],
        {
          color: '#3498db',
          fillColor: '#3498db',
          fillOpacity: 0.04,
          weight: 2,
          dashArray: '8, 4',
          interactive: false,
        },
      );
      placementLayerRef.current!.addLayer(rect);
    }

    placementSuggestions.forEach((sug, idx) => {
      // Dashed-outline circle for coverage preview
      const circle = L.circle([sug.latitude, sug.longitude], {
        radius: placementCoverageRadiusM,
        color: '#2ecc71',
        fillColor: '#2ecc71',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '8, 4',
      });

      // Ghost marker with "+" icon
      const ghostSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#2ecc71" fill-opacity="0.5" stroke="#2ecc71" stroke-width="2" stroke-dasharray="4,3"/>
        <text x="14" y="18" text-anchor="middle" fill="#fff" font-size="16" font-weight="bold">+</text>
      </svg>`;
      const ghostIcon = L.divIcon({
        html: ghostSvg,
        className: 'placement-ghost-icon',
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -36],
      });

      const marker = L.marker([sug.latitude, sug.longitude], { icon: ghostIcon, interactive: true });
      const scoreColor = sug.score > 0.7 ? '#2ecc71' : sug.score > 0.4 ? '#f1c40f' : '#e74c3c';
      marker.bindPopup(
        `<b>Suggested Location #${idx + 1}</b><br>` +
        `Score: <span style="color:${scoreColor}">${(sug.score * 100).toFixed(0)}%</span><br>` +
        `Coverage gain: ${sug.coverage_gain_km2.toFixed(2)} km&sup2;<br>` +
        `${escapeHtml(sug.reason)}`
      );
      marker.bindTooltip(`Suggestion #${idx + 1} (${(sug.score * 100).toFixed(0)}%)`);

      placementLayerRef.current!.addLayer(circle);
      placementLayerRef.current!.addLayer(marker);
    });
  }, [placementSuggestions, placementCoverageRadiusM, placementSearchBounds, nodes]);

  // Draw signal overlays — RSSI/SNR observations as colored polylines
  useEffect(() => {
    if (!signalLayerRef.current) return;
    signalLayerRef.current.clearLayers();

    signalOverlays.forEach((overlay: SignalOverlay) => {
      overlay.observations.forEach((obs) => {
        const nodeA = nodes.find((n) => String(n.id) === obs.nodeAUuid);
        const nodeB = nodes.find((n) => String(n.id) === obs.nodeBUuid);
        if (!nodeA || !nodeB) return;

        // Color by RSSI strength
        let color: string;
        if (obs.rssi_dbm > -85) {
          color = '#2ecc71';   // green — strong
        } else if (obs.rssi_dbm >= -100) {
          color = '#f1c40f';   // yellow — marginal
        } else {
          color = '#e74c3c';   // red — weak
        }

        const coords: L.LatLngExpression[] = [
          [nodeA.latitude, nodeA.longitude],
          [nodeB.latitude, nodeB.longitude],
        ];

        const line = L.polyline(coords, {
          color,
          weight: 3,
          opacity: 0.8,
          interactive: true,
        });

        const snrPart = obs.snr_db !== null ? ` / ${obs.snr_db.toFixed(1)} dB SNR` : '';
        line.bindTooltip(
          `${escapeHtml(obs.nodeAName)} \u2192 ${escapeHtml(obs.nodeBName)}: ${obs.rssi_dbm.toFixed(1)} dBm${snrPart}`,
          { sticky: true }
        );

        signalLayerRef.current!.addLayer(line);
      });
    });
  }, [signalOverlays, nodes]);

  // Draw saved field test observations — pass/fail communication markers
  useEffect(() => {
    if (!fieldObservationLayerRef.current) return;
    fieldObservationLayerRef.current.clearLayers();

    fieldObservations.forEach((obs) => {
      const color = obs.success ? '#16a34a' : '#dc2626';
      const glyph = obs.success ? '&#10003;' : '&#215;';
      const label = obs.success ? 'Success' : 'Failed';
      const icon = L.divIcon({
        className: 'field-observation-marker',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${glyph}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12],
      });

      const marker = L.marker([obs.latitude, obs.longitude], { icon, interactive: true });
      const rf = observationRfSummary(obs, nodes);
      const ackPart = obs.ack_db != null ? `${obs.ack_db.toFixed(1)} dB` : 'Not recorded';
      const rssiPart = rf.estimatedRssi != null ? `${rf.estimatedRssi.toFixed(1)} dBm` : 'Not available';
      const noisePart = rf.estimatedRssi != null ? ` (${rf.bandwidthKhz} kHz noise floor ${rf.noiseFloor.toFixed(1)} dBm)` : '';
      const deltaPart = rf.txToRssiDelta != null ? `<br>Approx. observed path loss: ${rf.txToRssiDelta.toFixed(1)} dB` : '';
      const relayPart = obs.ack_relay ? escapeHtml(obs.ack_relay) : 'None';
      const timePart = obs.timestamp ? escapeHtml(obs.timestamp.replace('T', ' ').slice(0, 16)) : 'Not recorded';
      const notesPart = obs.notes ? `<br>Notes: ${escapeHtml(obs.notes)}` : '';
      marker.bindPopup(
        `<b>Field test: ${label}</b><br>` +
        `ACK Relay: ${relayPart}<br>` +
        `ACK SNR: ${ackPart}<br>` +
        `Est. RSSI: ${rssiPart}${noisePart}${deltaPart}<br>` +
        `Type: ${escapeHtml(obs.test_type)}<br>` +
        `Time: ${timePart}${notesPart}`
      );
      marker.bindTooltip(`${label}${obs.ack_relay ? ` via ${obs.ack_relay}` : ''}`, { sticky: true });
      fieldObservationLayerRef.current!.addLayer(marker);
    });
  }, [fieldObservations, nodes]);

  // Change cursor based on mode
  useEffect(() => {
    if (!mapRef.current) return;
    const mode = useMapStore.getState().mode;
    const plan = usePlanStore.getState().current_plan;
    if ((mode === 'add_node' && plan) || mode === 'add_field_observation') {
      mapRef.current.style.cursor = 'crosshair';
    } else {
      mapRef.current.style.cursor = '';
    }
  });

  // Build list of selected nodes for the info overlay
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(String(n.id)));

  return (
    <div className={`map-container ${className}`} style={{ height: '100%', minHeight: '400px', position: 'relative' }} role="application" aria-label="Interactive map">
      <div
        ref={mapRef}
        style={{ height: '100%', width: '100%' }}
      />
      {losOverlays.length > 0 && (
        <div className="los-legend">
          <div className="los-legend-title">LOS Quality</div>
          <div className="los-legend-item">
            <span className="los-legend-line" style={{ background: '#16a34a' }}></span>
            <span>Strong</span>
          </div>
          <div className="los-legend-item">
            <span className="los-legend-line los-legend-dashed" style={{ background: `repeating-linear-gradient(90deg, #eab308 0, #eab308 5px, transparent 5px, transparent 10px)` }}></span>
            <span>Marginal</span>
          </div>
          <div className="los-legend-item">
            <span className="los-legend-line los-legend-dashed" style={{ background: `repeating-linear-gradient(90deg, #f97316 0, #f97316 5px, transparent 5px, transparent 10px)` }}></span>
            <span>NLOS</span>
          </div>
          <div className="los-legend-item">
            <span className="los-legend-line los-legend-dashed" style={{ background: `repeating-linear-gradient(90deg, #dc2626 0, #dc2626 5px, transparent 5px, transparent 10px)` }}></span>
            <span>Not Viable</span>
          </div>
        </div>
      )}
      {selectedNodes.length > 0 && (
        <div className="node-info-overlay" role="complementary" aria-label="Selected node information">
          {selectedNodes.map((node) => (
            <div key={String(node.id)}
              className={`node-info-card${selectedNodeId === String(node.id) ? ' node-info-card-active' : ''}`}
              onClick={() => {
                // In multi-select, just shift primary focus without dropping the selection
                if (selectedNodeIds.length > 1) {
                  useMapStore.setState({ selected_node_id: String(node.id) });
                } else {
                  selectNode(String(node.id));
                }
              }}>
              <div className="node-info-name">
                {node.name}
                <button
                  className="node-info-close"
                  type="button"
                  title="Deselect node"
                  aria-label={`Deselect ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeSelection(String(node.id));
                  }}
                >
                  &times;
                </button>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Position:</span>
                <span>{node.latitude.toFixed(5)}, {node.longitude.toFixed(5)}</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Height:</span>
                <span>{node.antenna_height_m}m</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Device:</span>
                <span>{node.device_id}</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">TX Power:</span>
                <span>{node.tx_power_dbm} dBm</span>
              </div>
              <div className="node-info-row">
                <span className="node-info-label">Frequency:</span>
                <span>{node.frequency_mhz} MHz</span>
              </div>
              {node.is_solar && (
                <div className="node-info-row">
                  <span className="node-info-label">Power:</span>
                  <span>Solar</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <CoverageLegend />
      <ElevationLegend />
    </div>
  );
}
