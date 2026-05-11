import { describe, expect, it } from 'vitest';
import type { Node } from '../../src/types';
import { exportNodesCSV, parseNodesCSV } from '../../src/utils/csv';
import { exportGeoJSON } from '../../src/utils/geojson';
import { exportKML } from '../../src/utils/kml';

const baseNode: Node = {
  id: 1,
  plan_id: 'plan-1',
  name: 'Hilltop',
  latitude: 40.1234,
  longitude: -105.5678,
  antenna_height_m: 9,
  visibility: 'community',
  coordinate_precision: 'approximate',
  node_role: 'repeater',
  node_status: 'active',
  device_id: 'tbeam-supreme',
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
  sort_order: 0,
  created_at: '2026-04-26T00:00:00Z',
  updated_at: '2026-04-26T00:00:00Z',
};

describe('privacy-aware node exports', () => {
  it('includes privacy/domain columns in CSV export and import', () => {
    const csv = exportNodesCSV([baseNode]);

    expect(csv.split('\n')[0]).toContain('visibility,coordinate_precision,node_role,node_status');
    expect(csv).toContain('community,approximate,repeater,active');

    const parsed = parseNodesCSV(csv, {});

    expect(parsed.errors).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({
      visibility: 'community',
      coordinate_precision: 'approximate',
      node_role: 'repeater',
      node_status: 'active',
    });
  });

  it('uses conservative privacy/domain labels when CSV-exporting older nodes', () => {
    const csv = exportNodesCSV([{
      ...baseNode,
      visibility: undefined,
      coordinate_precision: undefined,
      node_role: undefined,
      node_status: undefined,
    }]);

    expect(csv).toContain('private,exact,planned,planned');
  });

  it('uses conservative privacy/domain defaults when importing older CSV', () => {
    const csv = [
      'name,latitude,longitude,antenna_height_m',
      'Legacy Node,40.1,-105.2,3',
    ].join('\n');

    const parsed = parseNodesCSV(csv, {});

    expect(parsed.errors).toEqual([]);
    expect(parsed.nodes[0]).toMatchObject({
      visibility: 'private',
      coordinate_precision: 'exact',
      node_role: 'planned',
      node_status: 'planned',
    });
  });

  it('labels privacy/domain fields in KML placemarks', () => {
    const kml = exportKML([baseNode], 'Privacy Plan');

    expect(kml).toContain('<b>Visibility:</b> community');
    expect(kml).toContain('<b>Coordinate Precision:</b> approximate');
    expect(kml).toContain('<Data name="node_role"><value>repeater</value></Data>');
    expect(kml).toContain('<Data name="node_status"><value>active</value></Data>');
  });

  it('includes privacy/domain properties and export metadata in GeoJSON', () => {
    const geojson = JSON.parse(exportGeoJSON([baseNode], 'Privacy Plan'));

    expect(geojson.metadata.node_privacy_fields).toEqual([
      'visibility',
      'coordinate_precision',
      'node_role',
      'node_status',
    ]);
    expect(geojson.features[0].properties).toMatchObject({
      visibility: 'community',
      coordinate_precision: 'approximate',
      node_role: 'repeater',
      node_status: 'active',
    });
  });
});
