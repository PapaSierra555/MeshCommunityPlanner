import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FieldObservation, FieldTestType, Node } from '../../types';
import { getAPIClient } from '../../services/api';
import './SignalImportModal.css';

type ObservationForm = {
  latitude: string;
  longitude: string;
  success: boolean;
  ack_relay: string;
  ack_db: string;
  test_type: FieldTestType;
  timestamp: string;
  notes: string;
};

const EMPTY_FORM: ObservationForm = {
  latitude: '',
  longitude: '',
  success: true,
  ack_relay: '',
  ack_db: '',
  test_type: 'message',
  timestamp: '',
  notes: '',
};

interface FieldObservationEntryModalProps {
  isOpen: boolean;
  planId: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  observation: FieldObservation | null;
  planNodes: Node[];
  entryModeActive: boolean;
  onClose: () => void;
  onStopEntryMode: () => void;
  onRefresh: () => Promise<void> | void;
}

function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formFromObservation(observation: FieldObservation): ObservationForm {
  return {
    latitude: String(observation.latitude),
    longitude: String(observation.longitude),
    success: observation.success,
    ack_relay: observation.ack_relay || '',
    ack_db: observation.ack_db != null ? String(observation.ack_db) : '',
    test_type: observation.test_type,
    timestamp: observation.timestamp ? observation.timestamp.slice(0, 16) : '',
    notes: observation.notes || '',
  };
}

function toPayload(form: ObservationForm) {
  const latitude = Number(form.latitude);
  const longitude = Number(form.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }
  return {
    latitude,
    longitude,
    success: form.success,
    ack_relay: form.ack_relay || null,
    ack_db: parseOptionalNumber(form.ack_db),
    test_type: form.test_type,
    timestamp: form.timestamp || null,
    notes: form.notes.trim(),
  };
}

export function FieldObservationEntryModal({
  isOpen,
  planId,
  coordinates,
  observation,
  planNodes,
  entryModeActive,
  onClose,
  onStopEntryMode,
  onRefresh,
}: FieldObservationEntryModalProps) {
  const api = useMemo(() => getAPIClient(), []);
  const [form, setForm] = useState<ObservationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (observation) {
      setForm(formFromObservation(observation));
      return;
    }
    setForm({
      ...EMPTY_FORM,
      latitude: coordinates ? coordinates.latitude.toFixed(6) : '',
      longitude: coordinates ? coordinates.longitude.toFixed(6) : '',
      timestamp: new Date().toISOString().slice(0, 16),
    });
  }, [coordinates, isOpen, observation]);

  const handleSave = useCallback(async () => {
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      if (observation) {
        await api.updateFieldObservation(planId, observation.id, payload);
      } else {
        await api.createFieldObservation(planId, payload);
      }
      await onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save observation.');
    } finally {
      setSaving(false);
    }
  }, [api, form, observation, onClose, onRefresh, planId]);

  if (!isOpen) return null;

  return (
    <div className="sim-overlay" role="dialog" aria-modal="true" aria-label="Field Test Entry">
      <div className="sim-modal">
        <div className="sim-header">
          <div>
            <h2 className="sim-title">{observation ? 'Edit Field Test' : 'Add Field Test'}</h2>
            <p className="sim-subtitle">Meshtastic field entry mode records one observation per map click</p>
          </div>
          <button className="sim-close" type="button" onClick={onClose} title="Close" aria-label="Close dialog">&times;</button>
        </div>

        <div className="sim-body">
          <div className="sim-format-grid">
            <label className="sim-format-card">
              <span className="sim-format-name">Result</span>
              <select value={form.success ? 'true' : 'false'} onChange={(e) => setForm({ ...form, success: e.target.value === 'true' })}>
                <option value="true">Success</option>
                <option value="false">Fail</option>
              </select>
            </label>
            <label className="sim-format-card">
              <span className="sim-format-name">Latitude</span>
              <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </label>
            <label className="sim-format-card">
              <span className="sim-format-name">Longitude</span>
              <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </label>
            <label className="sim-format-card">
              <span className="sim-format-name">ACK Relay</span>
              <select value={form.ack_relay} onChange={(e) => setForm({ ...form, ack_relay: e.target.value })}>
                <option value="">None / no ACK</option>
                {planNodes.map((node) => (
                  <option key={node.id} value={node.name}>{node.name}</option>
                ))}
              </select>
            </label>
            <label className="sim-format-card">
              <span className="sim-format-name">ACK SNR (dB)</span>
              <input value={form.ack_db} onChange={(e) => setForm({ ...form, ack_db: e.target.value })} placeholder="10.25" />
            </label>
            <label className="sim-format-card">
              <span className="sim-format-name">Timestamp</span>
              <input type="datetime-local" value={form.timestamp} onChange={(e) => setForm({ ...form, timestamp: e.target.value })} />
            </label>
          </div>

          <label className="sim-format-card" style={{ marginTop: '0.5rem' }}>
            <span className="sim-format-name">Notes</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Message ACKed after one retry" />
          </label>

          {error && <div className="sim-error" role="alert">{error}</div>}

          <div className="sim-actions sim-actions--split">
            <button className="sim-btn sim-btn--ghost" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <div className="sim-actions-right">
              {entryModeActive && (
                <button className="sim-btn sim-btn--ghost" type="button" onClick={onStopEntryMode} disabled={saving}>
                  Stop Entry Mode
                </button>
              )}
              <button className="sim-btn sim-btn--primary" type="button" onClick={handleSave} disabled={saving || !planId}>
                {saving ? 'Saving...' : observation ? 'Save Changes' : 'Save Observation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
