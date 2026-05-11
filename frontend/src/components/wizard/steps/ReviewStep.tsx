/**
 * ReviewStep component
 * Step 7: Review all configuration before saving
 */

import React from 'react';
import type { LegacyNodeCreatePayload, NodeWizardDraftField } from '../../../utils/nodeDomainAdapters';

export interface ReviewStepProps {
  data: LegacyNodeCreatePayload;
  errors: Record<string, string>;
  onChange: (field: NodeWizardDraftField, value: LegacyNodeCreatePayload[NodeWizardDraftField]) => void;
}

export function ReviewStep({ data }: ReviewStepProps) {
  return (
    <div className="wizard-step review-step">
      <h3>Review Configuration</h3>
      <p>Review your node configuration before finishing.</p>

      <div className="review-section">
        <h4>Location</h4>
        <dl>
          <dt>Latitude:</dt>
          <dd>{data.latitude || 'Not set'}</dd>
          <dt>Longitude:</dt>
          <dd>{data.longitude || 'Not set'}</dd>
          <dt>Name:</dt>
          <dd>{data.name || 'Not set'}</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Device</h4>
        <dl>
          <dt>Device ID:</dt>
          <dd>{data.device_id || 'Not set'}</dd>
          <dt>Firmware:</dt>
          <dd>{data.firmware || 'Not set'}</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Radio</h4>
        <dl>
          <dt>TX Power:</dt>
          <dd>{data.tx_power_dbm || 'Not set'} dBm</dd>
          <dt>Frequency:</dt>
          <dd>{data.frequency_mhz || 'Not set'} MHz</dd>
          <dt>Region:</dt>
          <dd>{data.region || 'Not set'}</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Antenna</h4>
        <dl>
          <dt>Antenna ID:</dt>
          <dd>{data.antenna_id || 'Not set'}</dd>
          <dt>Height:</dt>
          <dd>{data.antenna_height_m || 'Not set'} m</dd>
          <dt>Cable Length:</dt>
          <dd>{data.cable_length_m || 'Not set'} m</dd>
        </dl>
      </div>

      <div className="review-section">
        <h4>Privacy & Domain</h4>
        <dl>
          <dt>Visibility:</dt>
          <dd>{data.visibility || 'private'}</dd>
          <dt>Coordinate Precision:</dt>
          <dd>{data.coordinate_precision || 'exact'}</dd>
          <dt>Node Role:</dt>
          <dd>{data.node_role || 'planned'}</dd>
          <dt>Node Status:</dt>
          <dd>{data.node_status || 'planned'}</dd>
        </dl>
      </div>
    </div>
  );
}
