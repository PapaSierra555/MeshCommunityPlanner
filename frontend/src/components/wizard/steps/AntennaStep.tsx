/**
 * AntennaStep component
 * Step 4: Configure antenna parameters
 */

import React from 'react';
import { Tooltip } from '../../common/Tooltip';
import { AccessibleIcon } from '../../common/AccessibleIcon';
import { NumberInput } from '../../common/NumberInput';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface AntennaStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function AntennaStep({ data, errors, onChange }: AntennaStepProps) {
  return (
    <div className="wizard-step antenna-step">
      <h3>Antenna Configuration</h3>
      <p>Configure antenna gain, height, and cable loss.</p>

      <div className="form-group">
        <label htmlFor="antenna_id">
          Antenna ID{' '}
          <Tooltip
            content="Catalog antenna identifier used by backend propagation calculations. Choose an antenna that matches the installed hardware."
            position="right"
          >
            <AccessibleIcon name="info" label="Antenna ID information" />
          </Tooltip>
          <input
            type="text"
            id="antenna_id"
            value={data.antenna_id || '915-3dbi-omni'}
            onChange={(e) => onChange('antenna_id', e.target.value)}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="antenna_height_m">
          Antenna Height (m){' '}
          <Tooltip
            content="Height of the antenna above ground level in meters. Higher placement improves line-of-sight and reduces obstacles. Typical values: 2-10 meters for ground-level deployments, higher for towers. Increasing height significantly improves range."
            position="right"
          >
            <AccessibleIcon name="info" label="Antenna Height information" />
          </Tooltip>
          <NumberInput
            id="antenna_height_m"
            value={data.antenna_height_m || 2}
            onChange={(v) => onChange('antenna_height_m', v)}
            step={0.1}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="cable_length_m">
          Cable Length (m){' '}
          <Tooltip
            content="Length of the coaxial cable between radio and antenna. Longer cables increase signal loss depending on cable type."
            position="right"
          >
            <AccessibleIcon name="info" label="Cable Length information" />
          </Tooltip>
          <NumberInput
            id="cable_length_m"
            value={data.cable_length_m || 0}
            onChange={(v) => onChange('cable_length_m', v)}
            step={0.1}
          />
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="environment">
          Environment{' '}
          <Tooltip
            content="Propagation environment for this node's coverage analysis. Determines path loss exponent and fade margin. A hilltop repeater might use 'Clear LOS' while a client in a neighborhood uses 'Suburban'."
            position="right"
          >
            <AccessibleIcon name="info" label="Environment information" />
          </Tooltip>
          <select
            id="environment"
            value={data.environment || 'suburban'}
            onChange={(e) => onChange('environment', e.target.value)}
          >
            <option value="los_elevated">Clear LOS (Elevated)</option>
            <option value="open_rural">Open / Rural</option>
            <option value="suburban">Suburban (default)</option>
            <option value="urban">Urban</option>
            <option value="indoor">Indoor / Dense Cover</option>
          </select>
        </label>
      </div>
    </div>
  );
}
