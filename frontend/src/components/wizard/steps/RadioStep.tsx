/**
 * RadioStep component
 * Step 3: Configure radio parameters
 */

import React from 'react';
import { Tooltip } from '../../common/Tooltip';
import { AccessibleIcon } from '../../common/AccessibleIcon';
import { NumberInput } from '../../common/NumberInput';
import type { Node } from '../../../types';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface RadioStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function RadioStep({ data, errors, onChange }: RadioStepProps) {
  return (
    <div className="wizard-step radio-step">
      <h3>Radio Configuration</h3>
      <p>Configure transmit power and sensitivity.</p>

      <div className="form-group">
        <label htmlFor="tx_power_dbm">
          TX Power (dBm){' '}
          <Tooltip
            content="Transmit power in decibels relative to 1 milliwatt (dBm). Higher values increase range but consume more battery power. Typical values: 14-20 dBm. Check your local regulations for maximum allowed power."
            position="right"
          >
            <AccessibleIcon name="info" label="TX Power information" />
          </Tooltip>
          <NumberInput
            id="tx_power_dbm"
            value={data.tx_power_dbm || 20}
            onChange={(v) => onChange('tx_power_dbm', v)}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="frequency_mhz">
          Frequency (MHz){' '}
          <Tooltip
            content="Operating center frequency in megahertz. Use a value allowed by the selected regulatory region and supported by your device."
            position="right"
          >
            <AccessibleIcon name="info" label="Frequency information" />
          </Tooltip>
          <NumberInput
            id="frequency_mhz"
            value={data.frequency_mhz || 906.875}
            onChange={(v) => onChange('frequency_mhz', v)}
            step={0.001}
          />
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="region">
          Region Code{' '}
          <Tooltip
            content="Regulatory region determining allowed frequency bands and maximum transmit power. Choose the region where your devices will operate to ensure compliance with local radio regulations."
            position="right"
          >
            <AccessibleIcon name="info" label="Region Code information" />
          </Tooltip>
          <select
            id="region"
            value={data.region || 'us_fcc'}
            onChange={(e) => onChange('region', e.target.value as Node['region'])}
          >
            <option value="us_fcc">US (FCC)</option>
            <option value="eu_868">EU 868</option>
            <option value="eu_433">EU 433</option>
            <option value="anz">Australia / New Zealand</option>
          </select>
        </label>
      </div>
    </div>
  );
}
