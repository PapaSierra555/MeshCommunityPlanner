/**
 * GeoJSON Export Utility
 * Generates RFC 7946 GeoJSON FeatureCollection for GIS tools (QGIS, ArcGIS, mapbox).
 * Pure function — no API or store dependencies.
 */

import type { Node } from '../types';

/** Minimal LOS link data needed for GeoJSON export */
export interface GeoJSONLink {
  nodeAName: string;
  nodeBName: string;
  nodeALat: number;
  nodeALon: number;
  nodeBLat: number;
  nodeBLon: number;
  distanceM: number;
  linkQuality: string;
  isViable: boolean;
  receivedSignalDbm?: number;
  fresnelClearancePct?: number;
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString';
    coordinates: number[] | number[][];
  };
  properties: Record<string, unknown>;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  name: string;
  metadata: {
    privacy_notice: string;
    node_privacy_fields: string[];
  };
  features: GeoJSONFeature[];
}

export function exportGeoJSON(nodes: Node[], planName: string, links?: GeoJSONLink[]): string {
  const features: GeoJSONFeature[] = [];

  // Node points
  for (const node of nodes) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [node.longitude, node.latitude] },
      properties: {
        name: node.name,
        type: 'node',
        visibility: node.visibility || 'private',
        coordinate_precision: node.coordinate_precision || 'exact',
        node_role: node.node_role || 'planned',
        node_status: node.node_status || 'planned',
        device_id: node.device_id,
        firmware: node.firmware,
        antenna_height_m: node.antenna_height_m,
        tx_power_dbm: node.tx_power_dbm,
        environment: node.environment,
        is_solar: node.is_solar,
        notes: node.notes,
      },
    });
  }

  // Link lines
  if (links) {
    for (const link of links) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [link.nodeALon, link.nodeALat],
            [link.nodeBLon, link.nodeBLat],
          ],
        },
        properties: {
          type: 'link',
          from: link.nodeAName,
          to: link.nodeBName,
          distance_m: link.distanceM,
          quality: link.linkQuality,
          viable: link.isViable,
          signal_dbm: link.receivedSignalDbm ?? null,
          fresnel_pct: link.fresnelClearancePct ?? null,
        },
      });
    }
  }

  const collection: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    name: planName,
    metadata: {
      privacy_notice: 'Node privacy metadata is labeled per feature; coordinates are exported as stored.',
      node_privacy_fields: ['visibility', 'coordinate_precision', 'node_role', 'node_status'],
    },
    features,
  };

  return JSON.stringify(collection, null, 2);
}
