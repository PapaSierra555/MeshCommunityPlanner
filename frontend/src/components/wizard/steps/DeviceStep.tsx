/**
 * DeviceStep component
 * Step 2: Select device type and firmware
 */

import React from 'react';
import type { Node } from '../../../types';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface DeviceStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function DeviceStep({ data, errors, onChange }: DeviceStepProps) {
  return (
    <div className="wizard-step device-step">
      <h3>Device Configuration</h3>
      <p>Select the device type and firmware family.</p>

      <div className="form-group">
        <label htmlFor="device_id">
          Device ID
          <input
            type="text"
            id="device_id"
            value={data.device_id || ''}
            onChange={(e) => onChange('device_id', e.target.value)}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="firmware">
          Firmware Family
          <select
            id="firmware"
            value={data.firmware || 'meshtastic'}
            onChange={(e) => onChange('firmware', e.target.value as Node['firmware'])}
          >
            <option value="meshtastic">Meshtastic</option>
            <option value="meshcore">MeshCore</option>
            <option value="reticulum">Reticulum</option>
          </select>
        </label>
      </div>
    </div>
  );
}
