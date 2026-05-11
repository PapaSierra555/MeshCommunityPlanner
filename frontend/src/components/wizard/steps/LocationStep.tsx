/**
 * LocationStep component
 * Step 1: Set node location (latitude, longitude)
 */

import React from 'react';
import { NumberInput } from '../../common/NumberInput';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface LocationStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function LocationStep({ data, errors, onChange }: LocationStepProps) {
  return (
    <div className="wizard-step location-step">
      <h3>Node Location</h3>
      <p>Enter the geographic coordinates where this node will be located.</p>

      <div className="form-group">
        <label htmlFor="latitude">
          Latitude <span aria-label="required">*</span>
          <NumberInput
            id="latitude"
            value={data.latitude || 0}
            onChange={(v) => onChange('latitude', v)}
            step={0.000001}
            min={-90}
            max={90}
            required
            aria-invalid={!!errors.latitude}
            aria-describedby={errors.latitude ? 'latitude-error' : undefined}
          />
        </label>
        {errors.latitude && (
          <span id="latitude-error" className="error" role="alert">
            {errors.latitude}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="longitude">
          Longitude <span aria-label="required">*</span>
          <NumberInput
            id="longitude"
            value={data.longitude || 0}
            onChange={(v) => onChange('longitude', v)}
            step={0.000001}
            min={-180}
            max={180}
            required
            aria-invalid={!!errors.longitude}
            aria-describedby={errors.longitude ? 'longitude-error' : undefined}
          />
        </label>
        {errors.longitude && (
          <span id="longitude-error" className="error" role="alert">
            {errors.longitude}
          </span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="name">
          Node Name
          <input
            type="text"
            id="name"
            value={data.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="e.g., Tower Hill"
          />
        </label>
      </div>
    </div>
  );
}
