import { useCallback, useMemo, useRef, useState } from 'react';
import type { FieldObservation, FieldTestType, Node } from '../../types';
import { getAPIClient } from '../../services/api';
import { useMapStore } from '../../stores/mapStore';
import { observationRfSummary } from '../../utils/fieldObservationRf';
import './SignalImportModal.css';

interface FieldObservationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string | null;
  observations: FieldObservation[];
  planNodes: Node[];
  onRefresh: () => Promise<void> | void;
  onStartEntryMode: () => void;
  onEditObservation: (observation: FieldObservation) => void;
}

type ParsedObservation = {
  latitude: number;
  longitude: number;
  success: boolean;
  ack_relay: string | null;
  ack_db: number | null;
  test_type: FieldTestType;
  timestamp: string | null;
  notes: string;
};

function parseBool(value: string | undefined): boolean {
  const v = (value || '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'pass', 'passed', 'success'].includes(v);
}

function parseNum(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function splitDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): ParsedObservation[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex((h) => names.includes(h));
  const latIdx = idx(['latitude', 'lat']);
  const lonIdx = idx(['longitude', 'lon', 'lng']);
  const wktIdx = idx(['wkt', 'geometry']);
  const successIdx = idx(['success', 'passed', 'pass']);
  const relayIdx = idx(['ack_relay', 'ack relay', 'relay']);
  const ackIdx = idx(['ack_snr', 'ack snr', 'ack_snr_db', 'ack snr db', 'ack', 'ack_db', 'ack db']);
  const timestampIdx = idx(['timestamp', 'time', 'datetime']);
  const notesIdx = idx(['notes', 'note', 'description']);
  const typeIdx = idx(['test_type', 'test type', 'type']);

  if (((latIdx < 0 || lonIdx < 0) && wktIdx < 0) || successIdx < 0) {
    throw new Error('CSV must include latitude/longitude or WKT, plus success.');
  }

  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    let latitude = latIdx >= 0 ? Number(cells[latIdx]) : NaN;
    let longitude = lonIdx >= 0 ? Number(cells[lonIdx]) : NaN;
    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && wktIdx >= 0) {
      const match = (cells[wktIdx] || '').match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (match) {
        longitude = Number(match[1]);
        latitude = Number(match[2]);
      }
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Invalid coordinate in row: ${line}`);
    }
    const testTypeRaw = (typeIdx >= 0 ? cells[typeIdx] : 'message') as FieldTestType;
    const test_type: FieldTestType = ['message', 'position', 'telemetry', 'voice', 'other'].includes(testTypeRaw)
      ? testTypeRaw
      : 'message';
    return {
      latitude,
      longitude,
      success: parseBool(cells[successIdx]),
      ack_relay: relayIdx >= 0 && cells[relayIdx] ? cells[relayIdx] : null,
      ack_db: ackIdx >= 0 ? parseNum(cells[ackIdx]) : null,
      test_type,
      timestamp: timestampIdx >= 0 && cells[timestampIdx] ? cells[timestampIdx] : null,
      notes: notesIdx >= 0 ? cells[notesIdx] || '' : '',
    };
  });
}

function downloadCsv(observations: FieldObservation[]) {
  const header = ['latitude', 'longitude', 'success', 'ack_relay', 'ack_snr_db', 'timestamp', 'notes', 'test_type'];
  const rows = observations.map((obs) => [
    obs.latitude,
    obs.longitude,
    obs.success,
    obs.ack_relay || '',
    obs.ack_db ?? '',
    obs.timestamp || '',
    obs.notes || '',
    obs.test_type,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'field-test-observations.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function FieldObservationsModal({
  isOpen,
  onClose,
  planId,
  observations,
  planNodes,
  onRefresh,
  onStartEntryMode,
  onEditObservation,
}: FieldObservationsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);
  const api = useMemo(() => getAPIClient(), []);
  const requestFitBounds = useMapStore((s) => s.requestFitBounds);

  const handleFile = useCallback(async (file: File) => {
    if (!planId) return;
    setSaving(true);
    setError(null);
    setLastImportCount(null);
    try {
      const parsed = parseCsv(await file.text());
      for (const observation of parsed) {
        await api.createFieldObservation(planId, observation);
      }
      setLastImportCount(parsed.length);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import field observations.');
    } finally {
      setSaving(false);
    }
  }, [api, onRefresh, planId]);

  const handleDelete = useCallback(async (id: string) => {
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteFieldObservation(planId, id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete observation.');
    } finally {
      setSaving(false);
    }
  }, [api, onRefresh, planId]);

  const zoomTo = useCallback((obs: FieldObservation) => {
    const pad = 0.002;
    requestFitBounds([
      [obs.latitude - pad, obs.longitude - pad],
      [obs.latitude + pad, obs.longitude + pad],
    ]);
  }, [requestFitBounds]);

  if (!isOpen) return null;

  return (
    <div className="sim-overlay" role="dialog" aria-modal="true" aria-label="Field Test Observations">
      <div className="sim-modal">
        <div className="sim-header">
          <div>
            <h2 className="sim-title">Field Test Observations</h2>
            <p className="sim-subtitle">Import, export, and review Meshtastic field test observations</p>
          </div>
          <button className="sim-close" type="button" onClick={onClose} title="Close" aria-label="Close dialog">&times;</button>
        </div>

        <div className="sim-body">
          <div className="sim-phase-upload">
            <p className="sim-section-label">CSV columns: latitude, longitude or WKT, success, ack_relay, ack_snr_db, timestamp, notes</p>
            <div className="sim-actions sim-actions--split">
              <button className="sim-btn sim-btn--primary" type="button" onClick={onStartEntryMode} disabled={saving || !planId}>
                Start Entry Mode
              </button>
              <div className="sim-actions-right">
                <button className="sim-btn sim-btn--ghost" type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                  Import CSV
                </button>
                <button className="sim-btn sim-btn--ghost" type="button" onClick={() => downloadCsv(observations)} disabled={observations.length === 0}>
                  Export CSV
                </button>
              </div>
            </div>
            <div
              className={`sim-dropzone${saving ? ' sim-dropzone--loading' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => !saving && fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            >
              {saving ? 'Saving...' : 'Drop CSV here or choose file'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sim-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {error && <div className="sim-error" role="alert">{error}</div>}
            {lastImportCount != null && (
              <div className="sim-import-result sim-import-result--ok">
                Imported {lastImportCount} field observation{lastImportCount !== 1 ? 's' : ''}.
              </div>
            )}
          </div>

          <div className="sim-table-wrap">
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Result</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>ACK Relay</th>
                  <th>ACK SNR (dB)</th>
                  <th>Est. RSSI</th>
                  <th>Timestamp</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {observations.length === 0 && (
                  <tr><td colSpan={9} className="sim-empty">No field observations saved.</td></tr>
                )}
                {observations.map((obs) => {
                  const rf = observationRfSummary(obs, planNodes);
                  return (
                    <tr key={obs.id}>
                      <td><span className={obs.success ? 'sim-match-ok' : 'sim-match-none'}>{obs.success ? 'Success' : 'Fail'}</span></td>
                      <td>{obs.latitude.toFixed(5)}</td>
                      <td>{obs.longitude.toFixed(5)}</td>
                      <td>{obs.ack_relay || '-'}</td>
                      <td>{obs.ack_db != null ? obs.ack_db.toFixed(1) : '-'}</td>
                      <td>{rf.estimatedRssi != null ? `${rf.estimatedRssi.toFixed(1)} dBm` : '-'}</td>
                      <td>{obs.timestamp ? obs.timestamp.slice(0, 16).replace('T', ' ') : '-'}</td>
                      <td>{obs.notes || '-'}</td>
                      <td>
                        <button className="sim-btn sim-btn--ghost" type="button" onClick={() => zoomTo(obs)}>
                          Zoom
                        </button>
                        <button className="sim-btn sim-btn--ghost" type="button" onClick={() => onEditObservation(obs)}>
                          Edit
                        </button>
                        <button className="sim-btn sim-btn--ghost" type="button" onClick={() => handleDelete(obs.id)} disabled={saving}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sim-actions">
            <button className="sim-btn sim-btn--primary" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
