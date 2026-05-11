/**
 * CSV Import/Export Utilities for Node Locations
 * Pure functions — no API or store dependencies.
 */

import type { Node } from '../types';

/* ---- CSV Column Definitions ---- */

const CSV_COLUMNS = [
  'name', 'latitude', 'longitude', 'visibility', 'coordinate_precision',
  'node_role', 'node_status', 'antenna_height_m', 'device_id', 'firmware',
  'region', 'frequency_mhz', 'tx_power_dbm', 'spreading_factor',
  'bandwidth_khz', 'coding_rate', 'modem_preset', 'antenna_id', 'cable_id',
  'cable_length_m', 'pa_module_id', 'is_solar',
  'desired_coverage_radius_m', 'notes', 'environment',
] as const;

/** Column name aliases for flexible CSV import (lowercase → canonical name) */
const COLUMN_ALIASES: Record<string, string> = {
  'lat': 'latitude',
  'lon': 'longitude',
  'lng': 'longitude',
  'long': 'longitude',
  'privacy': 'visibility',
  'precision': 'coordinate_precision',
  'role': 'node_role',
  'status': 'node_status',
  'height': 'antenna_height_m',
  'antenna_height': 'antenna_height_m',
  'device': 'device_id',
  'tx_power': 'tx_power_dbm',
  'txpower': 'tx_power_dbm',
  'sf': 'spreading_factor',
  'bw': 'bandwidth_khz',
  'bandwidth': 'bandwidth_khz',
  'cr': 'coding_rate',
  'coding': 'coding_rate',
  'preset': 'modem_preset',
  'antenna': 'antenna_id',
  'cable': 'cable_id',
  'cable_length': 'cable_length_m',
  'pa_module': 'pa_module_id',
  'solar': 'is_solar',
  'coverage_radius': 'desired_coverage_radius_m',
  'env': 'environment',
};

type CSVColumn = typeof CSV_COLUMNS[number];

function setNodeField<K extends keyof Node>(
  node: Partial<Node>,
  key: K,
  value: Node[K]
): void {
  node[key] = value;
}

/* ---- Export ---- */

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function getExportValue(node: Node, col: CSVColumn): unknown {
  switch (col) {
    case 'visibility':
      return node.visibility || 'private';
    case 'coordinate_precision':
      return node.coordinate_precision || 'exact';
    case 'node_role':
      return node.node_role || 'planned';
    case 'node_status':
      return node.node_status || 'planned';
    default:
      return node[col as keyof Node];
  }
}

export function exportNodesCSV(nodes: Node[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = nodes.map((node) => {
    return CSV_COLUMNS.map((col) => {
      const value = getExportValue(node, col);
      if (value == null) return '';
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      if (typeof value === 'number') return String(value);
      return escapeCSVField(String(value));
    }).join(',');
  });
  return [header, ...rows].join('\n');
}

/* ---- Import ---- */

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function resolveColumnName(header: string): string | null {
  const lower = header.toLowerCase().trim();
  // Direct match
  if ((CSV_COLUMNS as readonly string[]).includes(lower)) return lower;
  // Alias match
  if (COLUMN_ALIASES[lower]) return COLUMN_ALIASES[lower];
  return null;
}

export interface ParseCSVResult {
  nodes: Partial<Node>[];
  errors: string[];
}

export function parseNodesCSV(csvText: string, defaults: Partial<Node>): ParseCSVResult {
  const errors: string[] = [];
  const nodes: Partial<Node>[] = [];

  // Strip BOM
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Normalize line endings and split
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Find header row
  if (lines.length < 2) {
    errors.push('CSV must have at least a header row and one data row.');
    return { nodes, errors };
  }

  const headerFields = parseCSVLine(lines[0]);
  const columnMap: Map<number, string> = new Map();

  for (let i = 0; i < headerFields.length; i++) {
    const resolved = resolveColumnName(headerFields[i]);
    if (resolved) {
      columnMap.set(i, resolved);
    }
  }

  // Validate required columns
  const mappedColumns = new Set(columnMap.values());
  if (!mappedColumns.has('name')) {
    errors.push('Missing required column: name');
  }
  if (!mappedColumns.has('latitude')) {
    errors.push('Missing required column: latitude (or lat)');
  }
  if (!mappedColumns.has('longitude')) {
    errors.push('Missing required column: longitude (or lon/lng)');
  }
  if (errors.length > 0) {
    return { nodes, errors };
  }

  // Parse data rows
  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const line = lines[rowIdx].trim();
    if (line === '') continue; // skip blank lines

    const fields = parseCSVLine(line);
    const row: Record<string, string> = {};

    for (const [colIdx, colName] of columnMap) {
      if (colIdx < fields.length) {
        row[colName] = fields[colIdx];
      }
    }

    // Validate required fields
    if (!row.name || row.name.trim() === '') {
      errors.push(`Row ${rowIdx + 1}: missing name`);
      continue;
    }

    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push(`Row ${rowIdx + 1}: invalid latitude "${row.latitude}"`);
      continue;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.push(`Row ${rowIdx + 1}: invalid longitude "${row.longitude}"`);
      continue;
    }

    // Build node with defaults
    const node: Partial<Node> = {
      ...defaults,
      name: row.name.trim(),
      latitude: lat,
      longitude: lon,
      visibility: defaults.visibility || 'private',
      coordinate_precision: defaults.coordinate_precision || 'exact',
      node_role: defaults.node_role || 'planned',
      node_status: defaults.node_status || 'planned',
    };

    // Optional numeric fields
    const numFields: [string, keyof Node][] = [
      ['antenna_height_m', 'antenna_height_m'],
      ['frequency_mhz', 'frequency_mhz'],
      ['tx_power_dbm', 'tx_power_dbm'],
      ['spreading_factor', 'spreading_factor'],
      ['bandwidth_khz', 'bandwidth_khz'],
      ['cable_length_m', 'cable_length_m'],
      ['desired_coverage_radius_m', 'desired_coverage_radius_m'],
    ];

    for (const [csvKey, nodeKey] of numFields) {
      if (row[csvKey] !== undefined && row[csvKey] !== '') {
        const val = parseFloat(row[csvKey]);
        if (!isNaN(val)) {
          setNodeField(node, nodeKey, val as Node[typeof nodeKey]);
        }
      }
    }

    // Optional string fields
    const strFields: [string, keyof Node][] = [
      ['device_id', 'device_id'],
      ['firmware', 'firmware'],
      ['region', 'region'],
      ['coding_rate', 'coding_rate'],
      ['modem_preset', 'modem_preset'],
      ['antenna_id', 'antenna_id'],
      ['cable_id', 'cable_id'],
      ['pa_module_id', 'pa_module_id'],
      ['notes', 'notes'],
    ];

    for (const [csvKey, nodeKey] of strFields) {
      if (row[csvKey] !== undefined && row[csvKey] !== '') {
        setNodeField(node, nodeKey, row[csvKey] as Node[typeof nodeKey]);
      }
    }

    // Boolean field
    if (row.is_solar !== undefined && row.is_solar !== '') {
      node.is_solar = row.is_solar.toLowerCase() === 'true' || row.is_solar === '1';
    }

    // Privacy/domain fields (validate against known values)
    const validVisibility = ['private', 'community', 'public'];
    if (row.visibility !== undefined && row.visibility !== '') {
      const visibility = row.visibility.toLowerCase().trim();
      if (validVisibility.includes(visibility)) {
        node.visibility = visibility as Node['visibility'];
      }
    }

    const validCoordinatePrecision = ['exact', 'approximate', 'hidden'];
    if (row.coordinate_precision !== undefined && row.coordinate_precision !== '') {
      const precision = row.coordinate_precision.toLowerCase().trim();
      if (validCoordinatePrecision.includes(precision)) {
        node.coordinate_precision = precision as Node['coordinate_precision'];
      }
    }

    const validNodeRoles = ['client', 'repeater', 'gateway', 'sensor', 'planned', 'experimental'];
    if (row.node_role !== undefined && row.node_role !== '') {
      const role = row.node_role.toLowerCase().trim();
      if (validNodeRoles.includes(role)) {
        node.node_role = role as Node['node_role'];
      }
    }

    const validNodeStatuses = ['candidate', 'planned', 'active', 'retired', 'rejected'];
    if (row.node_status !== undefined && row.node_status !== '') {
      const status = row.node_status.toLowerCase().trim();
      if (validNodeStatuses.includes(status)) {
        node.node_status = status as Node['node_status'];
      }
    }

    // Environment field (validate against known values)
    const validEnvironments = ['los_elevated', 'open_rural', 'suburban', 'urban', 'indoor'];
    if (row.environment !== undefined && row.environment !== '') {
      const env = row.environment.toLowerCase().trim();
      if (validEnvironments.includes(env)) {
        node.environment = env;
      }
      // Invalid values silently fall through to default
    }

    nodes.push(node);
  }

  return { nodes, errors };
}
