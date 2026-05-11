/**
 * Optimized store selectors
 * Prevent unnecessary re-renders with memoized selectors
 */

import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from './planStore';
import { useMapStore } from './mapStore';
import { useSettingsStore } from './settingsStore';

// ============================================================================
// Plan Store Selectors
// ============================================================================

/**
 * Get node count (memoized)
 */
export const useNodeCount = () =>
  usePlanStore((state) => state.nodes.length);

/**
 * Get specific node by ID (memoized)
 */
export const useNode = (nodeId: string) =>
  usePlanStore((state) => state.nodes.find((n) => n.id === nodeId));

// Note: useNodeIds removed due to infinite loop issues with array identity.
// Use usePlanStore directly: usePlanStore((state) => state.nodes.map(n => n.id))

/**
 * Get dirty flag (for save button state)
 */
export const useHasUnsavedChanges = () =>
  usePlanStore((state) => state.dirty);

/**
 * Get current plan ID (for detecting plan switches)
 */
export const usePlanId = () =>
  usePlanStore((state) => state.current_plan?.id);

/**
 * Get plan metadata (name, description, created)
 */
export const usePlanMetadata = () =>
  usePlanStore(
    useShallow(
      (state) => ({
        name: state.current_plan?.name,
        description: state.current_plan?.description,
        created_at: state.current_plan?.created_at,
      })
    )
  );

/**
 * Get topology status (whether topology is loaded)
 */
export const useHasTopology = () =>
  usePlanStore((state) => state.topology_graph !== null);

/**
 * Get coverage status for a node
 */
export const useNodeCoverageStatus = (nodeId: string) =>
  usePlanStore((state) => state.coverage_results.has(nodeId));

// ============================================================================
// Map Store Selectors
// ============================================================================

/**
 * Get map center and zoom (for map initialization)
 */
export const useMapViewport = () =>
  useMapStore(useShallow((state) => state.viewport));

/**
 * Get selected node ID only (for highlighting)
 */
export const useSelectedNodeId = () =>
  useMapStore((state) => state.selected_node_id);

/**
 * Get active layers (for layer controls)
 */
export const useActiveLayers = () =>
  useMapStore(useShallow((state) => state.layer_visibility));

// ============================================================================
// Settings Store Selectors
// ============================================================================

/**
 * Get theme preference
 */
export const useTheme = () =>
  useSettingsStore(() => null);

/**
 * Get distance units preference
 */
export const useDistanceUnits = () =>
  useSettingsStore((state) => state.settings.unit_system);

/**
 * Get all preferences (for settings panel)
 */
export const useAllPreferences = () =>
  useSettingsStore(
    useShallow(
      (state) => ({
        unit_system: state.settings.unit_system,
        color_palette: state.settings.color_palette,
        map_cache_limit_mb: state.settings.map_cache_limit_mb,
        terrain_cache_limit_mb: state.settings.terrain_cache_limit_mb,
        total_cache_limit_mb: state.settings.total_cache_limit_mb,
        sun_hours_peak: state.settings.sun_hours_peak,
        battery_autonomy_days: state.settings.battery_autonomy_days,
        signal_server_concurrency: state.settings.signal_server_concurrency,
      })
    )
  );

/**
 * Get API key status (whether keys are configured)
 */
export const useHasElevationApiKey = () =>
  useSettingsStore(() => false);

export const useHasGeocodingApiKey = () =>
  useSettingsStore(() => false);

// ============================================================================
// Computed Selectors (Derived State)
// ============================================================================

/**
 * Check if plan can be saved (has changes and has nodes)
 */
export const useCanSavePlan = () =>
  usePlanStore(
    (state) => state.dirty && state.nodes.length > 0
  );

// Note: useNodeCountByStatus removed due to infinite loop issues with object identity.
// Use usePlanStore directly with useMemo in your component if needed.

/**
 * Check if any nodes are selected
 */
export const useHasSelection = () =>
  useMapStore((state) => state.selected_node_id !== null);

/**
 * Get total coverage area (sum of all coverage radii)
 */
export const useTotalCoverageArea = () =>
  usePlanStore((state) => {
    let total = 0;
    state.coverage_results.forEach((result) => {
      const radiusKm = (result.coverage_radius_m ?? 0) / 1000;
      total += Math.PI * radiusKm * radiusKm;
    });
    return total;
  });
