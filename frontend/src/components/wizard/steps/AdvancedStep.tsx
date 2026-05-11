/**
 * AdvancedStep component
 * Step 5: Advanced configuration options
 */

import React from 'react';
import type { CoordinatePrecision, NodeLifecycleStatus, NodeRole, NodeVisibility } from '../../../types';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface AdvancedStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function AdvancedStep({ data, onChange }: AdvancedStepProps) {
  return (
    <div className="wizard-step advanced-step">
      <h3>Advanced Options</h3>
      <p>Configure advanced settings (optional).</p>

      <div className="form-group">
        <label htmlFor="node-visibility">
          Visibility
          <select
            id="node-visibility"
            value={data.visibility || 'private'}
            onChange={(e) => onChange('visibility', e.target.value as NodeVisibility)}
          >
            <option value="private">Private</option>
            <option value="community">Community</option>
            <option value="public">Public</option>
          </select>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="coordinate-precision">
          Coordinate Precision
          <select
            id="coordinate-precision"
            value={data.coordinate_precision || 'exact'}
            onChange={(e) => onChange('coordinate_precision', e.target.value as CoordinatePrecision)}
          >
            <option value="exact">Exact</option>
            <option value="approximate">Approximate</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="node-role">
          Node Role
          <select
            id="node-role"
            value={data.node_role || 'planned'}
            onChange={(e) => onChange('node_role', e.target.value as NodeRole)}
          >
            <option value="client">Client</option>
            <option value="repeater">Repeater</option>
            <option value="gateway">Gateway</option>
            <option value="sensor">Sensor</option>
            <option value="planned">Planned</option>
            <option value="experimental">Experimental</option>
          </select>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="node-status">
          Node Status
          <select
            id="node-status"
            value={data.node_status || 'planned'}
            onChange={(e) => onChange('node_status', e.target.value as NodeLifecycleStatus)}
          >
            <option value="candidate">Candidate</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>
    </div>
  );
}
