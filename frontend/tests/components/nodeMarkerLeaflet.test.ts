import { describe, expect, it } from 'vitest';
import type { Node } from '../../src/types';
import { NODE_LABEL_TOOLTIP_OPTIONS, buildNodePopupHtml, createNodeIcon } from '../../src/components/map/nodeMarkerLeaflet';

const baseNode: Node = {
  id: 'node-1',
  plan_id: 'plan-1',
  name: 'Alpha <script>',
  latitude: 39.123456,
  longitude: -104.987654,
  antenna_height_m: 12,
  visibility: 'private',
  coordinate_precision: 'exact',
  node_role: 'planned',
  node_status: 'planned',
  device_id: 'tbeam & "radio"',
  firmware: 'meshtastic',
  region: 'us_fcc',
  frequency_mhz: 906.875,
  tx_power_dbm: 20,
  spreading_factor: 11,
  bandwidth_khz: 250,
  coding_rate: '4/5',
  modem_preset: null,
  antenna_id: '915-3dbi-omni',
  cable_id: null,
  cable_length_m: 0,
  pa_module_id: null,
  is_solar: false,
  desired_coverage_radius_m: null,
  notes: '',
  environment: 'suburban',
  coverage_environment: null,
  sort_order: 1,
  created_at: '2026-04-26T00:00:00.000Z',
  updated_at: '2026-04-26T00:00:00.000Z',
};

describe('nodeMarkerLeaflet', () => {
  it('builds escaped node popup HTML with stable formatting', () => {
    expect(buildNodePopupHtml(baseNode)).toBe(
      '<b>Alpha &lt;script&gt;</b><br>' +
      'Lat: 39.12346<br>' +
      'Lon: -104.98765<br>' +
      'Height: 12m<br>' +
      'Device: tbeam &amp; &quot;radio&quot;<br>' +
      'Power: 20 dBm'
    );
  });

  it('exports permanent node label tooltip options', () => {
    expect(NODE_LABEL_TOOLTIP_OPTIONS).toEqual({
      permanent: true,
      direction: 'top',
      offset: [0, -42],
      className: 'node-label-tooltip',
    });
  });

  it('creates selected and multi-selected Leaflet div icons', () => {
    expect(createNodeIcon(true).options.html).toContain('fill="#e74c3c"');
    expect(createNodeIcon(false, true).options.html).toContain('fill="#e67e22"');
    expect(createNodeIcon().options.html).toContain('fill="#3498db"');
  });
});
