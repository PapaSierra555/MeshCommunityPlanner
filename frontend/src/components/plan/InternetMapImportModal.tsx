/**
 * InternetMapImportModal
 * Two-phase modal for importing nodes from public mesh network maps.
 *
 * Phase 1: Source selection + fetch
 * Phase 2: Preview / filter / select / import
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAPIClient } from '../../services/api';
import { usePlanStore } from '../../stores/planStore';
import meshcoreIcon from '../../assets/icons/meshcore.svg';
import './InternetMapImportModal.css';

/** Read the injected auth token (set by the backend at startup). */
function getAuthToken(): string | null {
  return (window as any).__MESH_PLANNER_AUTH__ || null;
}

/** Authenticated GET request to the backend API. */
async function apiGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method: 'GET', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---- Types ----

interface MapNode {
  name: string;
  lat: number;
  lon: number;
  description: string;
}

interface InternetMapImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string | null;
}

type Phase = 'select' | 'preview';

// ---- Component ----

export function InternetMapImportModal({ isOpen, onClose, planId }: InternetMapImportModalProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapNodes, setMapNodes] = useState<MapNode[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const currentPlan = usePlanStore((s) => s.current_plan);
  const existingNodes = usePlanStore((s) => s.nodes);
  const setPlanNodes = usePlanStore((s) => s.setNodes);

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setPhase('select');
      setLoading(false);
      setFetchError(null);
      setMapNodes([]);
      setSelected(new Set());
      setFilter('');
      setImporting(false);
      setImportResult(null);
    }
  }, [isOpen]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Filtered nodes list
  const filteredNodes = useMemo(() => {
    if (!filter.trim()) return mapNodes;
    const q = filter.trim().toLowerCase();
    return mapNodes.filter((n) => n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q));
  }, [mapNodes, filter]);

  // ---- Actions ----

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await apiGet<{ nodes: MapNode[]; count: number; source: string }>(
        '/import/internet-map?source=meshcore'
      );
      const fetched: MapNode[] = Array.isArray(data.nodes) ? data.nodes : [];
      setMapNodes(fetched);
      // Pre-select all by default
      setSelected(new Set(fetched.map((_: MapNode, i: number) => i)));
      setPhase('preview');
    } catch (err: any) {
      const msg = err?.message || err?.detail || 'Failed to fetch nodes from MeshCore map.';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(filteredNodes.map((n) => mapNodes.indexOf(n))));
  }, [filteredNodes, mapNodes]);

  const handleDeselectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const n of filteredNodes) {
        next.delete(mapNodes.indexOf(n));
      }
      return next;
    });
  }, [filteredNodes, mapNodes]);

  const handleToggle = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!planId || !currentPlan) return;
    const api = getAPIClient();
    const refNode = existingNodes[0];

    // Build radio defaults from current plan's first node or plan defaults
    const defaults = {
      antenna_height_m: 3.0,
      device_id: refNode?.device_id || 'tbeam-supreme',
      firmware: refNode?.firmware || currentPlan.firmware_family || 'meshcore',
      region: refNode?.region || currentPlan.region || 'us_fcc',
      frequency_mhz: refNode?.frequency_mhz ?? 906.875,
      tx_power_dbm: refNode?.tx_power_dbm ?? 20,
      spreading_factor: refNode?.spreading_factor ?? 11,
      bandwidth_khz: refNode?.bandwidth_khz ?? 250,
      coding_rate: refNode?.coding_rate || '4/5',
      modem_preset: refNode?.modem_preset ?? null,
      antenna_id: refNode?.antenna_id || '915-3dbi-omni',
      cable_id: null as string | null,
      cable_length_m: 0,
      pa_module_id: null as string | null,
      is_solar: false,
    };

    const toImport = mapNodes.filter((_, i) => selected.has(i));
    setImporting(true);
    setImportResult(null);

    const created: any[] = [];
    let failures = 0;
    for (const mapNode of toImport) {
      try {
        const node = await api.createNode(planId, {
          name: mapNode.name,
          latitude: mapNode.lat,
          longitude: mapNode.lon,
          notes: mapNode.description || '',
          ...defaults,
        });
        created.push(node);
      } catch (err) {
        failures++;
        console.error('InternetMapImport: failed to create node', mapNode.name, err);
      }
    }

    // Update plan store
    setPlanNodes([...existingNodes, ...created]);

    setImporting(false);
    if (failures > 0) {
      setImportResult(`Imported ${created.length} node(s). ${failures} failed.`);
    } else {
      setImportResult(`${created.length} node(s) imported successfully.`);
    }

    // Auto-close after brief success display
    if (failures === 0 && created.length > 0) {
      setTimeout(() => onClose(), 1500);
    }
  }, [planId, currentPlan, existingNodes, mapNodes, selected, onClose, setPlanNodes]);

  if (!isOpen) return null;

  // ---- Render ----

  return (
    <div className="imim-overlay" role="dialog" aria-modal="true" aria-label="Import Nodes from Internet Map">
      <div className="imim-modal">
        {/* Header */}
        <div className="imim-header">
          <div>
            <h2 className="imim-title">
              <img src={meshcoreIcon} className="imim-title-icon" alt="" aria-hidden="true" />
              Import Nodes — MeshCore Map
            </h2>
            <p className="imim-subtitle">
              Fetch live node positions from map.meshcore.dev
            </p>
          </div>
          <button className="imim-close" type="button" onClick={onClose} title="Close">&times;</button>
        </div>

        {/* Body */}
        <div className="imim-body">
          {phase === 'select' && (
            <PhaseSelect
              loading={loading}
              error={fetchError}
              onFetch={handleFetch}
            />
          )}
          {phase === 'preview' && (
            <PhasePreview
              allNodes={mapNodes}
              filteredNodes={filteredNodes}
              selected={selected}
              filter={filter}
              importing={importing}
              importResult={importResult}
              onFilterChange={setFilter}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onImport={handleImport}
              onBack={() => setPhase('select')}
              nodeIndexOf={(n) => mapNodes.indexOf(n)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Phase 1: Source Selection ----

interface PhaseSelectProps {
  loading: boolean;
  error: string | null;
  onFetch: () => void;
}

function PhaseSelect({ loading, error, onFetch }: PhaseSelectProps) {
  return (
    <div className="imim-phase-select">
      <p className="imim-section-label">Choose a map source</p>
      <div className="imim-source-cards">
        {/* MeshCore Map — active */}
        <div className="imim-source-card imim-source-card--active">
          <div className="imim-source-card-header">
            <span className="imim-source-name">MeshCore Map</span>
            <span className="imim-source-badge imim-source-badge--live">Live</span>
          </div>
          <p className="imim-source-url">map.meshcore.dev</p>
          <p className="imim-source-desc">
            Live node positions from the MeshCore global mesh network map.
            Includes node name, coordinates, and radio parameters.
          </p>
        </div>

        {/* rmap.world — coming soon */}
        <div className="imim-source-card imim-source-card--disabled">
          <div className="imim-source-card-header">
            <span className="imim-source-name">rmap.world</span>
            <span className="imim-source-badge imim-source-badge--soon">Coming Soon</span>
          </div>
          <p className="imim-source-url">rmap.world</p>
          <p className="imim-source-desc">
            Reticulum mesh network node map. Not yet available.
          </p>
        </div>
      </div>

      {error && (
        <div className="imim-error" role="alert">
          <strong>Fetch failed:</strong> {error}
        </div>
      )}

      <div className="imim-actions">
        <button
          className="imim-btn imim-btn--primary"
          type="button"
          onClick={onFetch}
          disabled={loading}
          title="Fetch nodes from MeshCore Map"
        >
          {loading ? (
            <><span className="imim-spinner" aria-hidden="true" /> Fetching&hellip;</>
          ) : (
            'Fetch Nodes'
          )}
        </button>
      </div>
    </div>
  );
}

// ---- Phase 2: Preview / Filter / Import ----

interface PhasePreviewProps {
  allNodes: MapNode[];
  filteredNodes: MapNode[];
  selected: Set<number>;
  filter: string;
  importing: boolean;
  importResult: string | null;
  onFilterChange: (v: string) => void;
  onToggle: (idx: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onImport: () => void;
  onBack: () => void;
  nodeIndexOf: (n: MapNode) => number;
}

const BULK_IMPORT_WARN_THRESHOLD = 5;

function PhasePreview({
  allNodes,
  filteredNodes,
  selected,
  filter,
  importing,
  importResult,
  onFilterChange,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onImport,
  onBack,
  nodeIndexOf,
}: PhasePreviewProps) {
  const selectedCount = selected.size;
  const [confirmPending, setConfirmPending] = useState(false);

  const handleImportClick = useCallback(() => {
    if (selectedCount > BULK_IMPORT_WARN_THRESHOLD) {
      setConfirmPending(true);
    } else {
      onImport();
    }
  }, [selectedCount, onImport]);

  const handleConfirm = useCallback(() => {
    setConfirmPending(false);
    onImport();
  }, [onImport]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmPending(false);
  }, []);

  return (
    <div className="imim-phase-preview">
      {/* Count + filter row */}
      <div className="imim-preview-toolbar">
        <span className="imim-count-badge">{allNodes.length} nodes found</span>
        <input
          className="imim-filter-input"
          type="text"
          placeholder="Filter by name or description..."
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          aria-label="Filter nodes"
        />
        <button className="imim-btn-link" type="button" onClick={onSelectAll}>Select All</button>
        <button className="imim-btn-link" type="button" onClick={onDeselectAll}>Deselect All</button>
      </div>

      {/* Node table */}
      <div className="imim-table-wrap">
        <table className="imim-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}><span className="sr-only">Select</span></th>
              <th>Name</th>
              <th>Lat</th>
              <th>Lon</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredNodes.length === 0 && (
              <tr>
                <td colSpan={5} className="imim-empty">No nodes match the current filter.</td>
              </tr>
            )}
            {filteredNodes.map((node) => {
              const idx = nodeIndexOf(node);
              const isChecked = selected.has(idx);
              return (
                <tr
                  key={idx}
                  className={isChecked ? 'imim-row-checked' : ''}
                  onClick={() => onToggle(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="imim-checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(idx)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${node.name}`}
                    />
                  </td>
                  <td className="imim-cell-name">{node.name}</td>
                  <td className="imim-cell-coord">{node.lat.toFixed(4)}</td>
                  <td className="imim-cell-coord">{node.lon.toFixed(4)}</td>
                  <td className="imim-cell-desc">{node.description || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <p className="imim-note">
        Selected nodes will be added to the current plan. Existing nodes at the same location will not be deduplicated automatically.
      </p>

      {importResult && (
        <div className={`imim-import-result${importResult.includes('failed') ? ' imim-import-result--warn' : ' imim-import-result--ok'}`} role="status">
          {importResult}
        </div>
      )}

      {/* Bulk import confirmation warning */}
      {confirmPending && (
        <div className="imim-bulk-warn" role="alert">
          <strong>Importing {selectedCount} nodes</strong>
          <p>That's a large number of nodes. They will all be added to your current plan. Are you sure?</p>
          <div className="imim-bulk-warn-actions">
            <button className="imim-btn imim-btn--ghost" type="button" onClick={handleCancelConfirm}>Cancel</button>
            <button className="imim-btn imim-btn--primary" type="button" onClick={handleConfirm}>Import {selectedCount} Nodes</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!confirmPending && (
        <div className="imim-actions imim-actions--split">
          <button
            className="imim-btn imim-btn--ghost"
            type="button"
            onClick={onBack}
            disabled={importing}
          >
            &larr; Back
          </button>
          <button
            className="imim-btn imim-btn--primary"
            type="button"
            onClick={handleImportClick}
            disabled={importing || selectedCount === 0}
            title={selectedCount === 0 ? 'Select at least one node to import' : `Import ${selectedCount} selected node(s)`}
          >
            {importing ? (
              <><span className="imim-spinner" aria-hidden="true" /> Importing&hellip;</>
            ) : (
              `Import ${selectedCount} Selected Node${selectedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
