/**
 * KML Export Utility
 * Generates KML 2.2 XML for viewing mesh network plans in Google Earth and GIS tools.
 * Pure function — no API or store dependencies.
 */

import type { Node } from '../types';

/** Minimal LOS link data needed for KML export */
export interface KMLLink {
  nodeAName: string;
  nodeBName: string;
  nodeALat: number;
  nodeALon: number;
  nodeAAlt: number;
  nodeBLat: number;
  nodeBLon: number;
  nodeBAlt: number;
  distanceM: number;
  linkQuality: string;
  isViable: boolean;
  receivedSignalDbm?: number;
  fresnelClearancePct?: number;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function linkQualityColor(quality: string): string {
  // KML colors are aaBBGGRR format
  switch (quality) {
    case 'excellent':
    case 'good':
      return 'ff00cc00'; // green
    case 'marginal':
      return 'ff00cccc'; // yellow
    case 'poor':
      return 'ff0088ff'; // orange
    case 'not_viable':
    default:
      return 'ff0000cc'; // red
  }
}

function nodePrivacyMetadata(node: Node): Record<string, string> {
  return {
    visibility: node.visibility || 'private',
    coordinate_precision: node.coordinate_precision || 'exact',
    node_role: node.node_role || 'planned',
    node_status: node.node_status || 'planned',
  };
}

export function exportKML(nodes: Node[], planName: string, links?: KMLLink[]): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">');
  lines.push('<Document>');
  lines.push(`  <name>${escapeXml(planName)}</name>`);
  lines.push(`  <description>${escapeXml(`Mesh Community Planner export — ${nodes.length} node(s). Privacy metadata is labeled per node; coordinates are exported as stored.`)}</description>`);

  // Node styles
  lines.push('  <Style id="nodeDefault">');
  lines.push('    <IconStyle>');
  lines.push('      <color>ff0000ff</color>');
  lines.push('      <scale>1.1</scale>');
  lines.push('      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>');
  lines.push('    </IconStyle>');
  lines.push('  </Style>');
  lines.push('  <Style id="nodeSolar">');
  lines.push('    <IconStyle>');
  lines.push('      <color>ff00cc00</color>');
  lines.push('      <scale>1.1</scale>');
  lines.push('      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>');
  lines.push('    </IconStyle>');
  lines.push('  </Style>');

  // Nodes folder
  lines.push('  <Folder>');
  lines.push('    <name>Nodes</name>');

  for (const node of nodes) {
    const privacy = nodePrivacyMetadata(node);
    const desc = [
      `<b>Device:</b> ${escapeXml(node.device_id || 'N/A')}`,
      `<b>Visibility:</b> ${escapeXml(privacy.visibility)}`,
      `<b>Coordinate Precision:</b> ${escapeXml(privacy.coordinate_precision)}`,
      `<b>Node Role:</b> ${escapeXml(privacy.node_role)}`,
      `<b>Node Status:</b> ${escapeXml(privacy.node_status)}`,
      `<b>Antenna Height:</b> ${node.antenna_height_m} m`,
      `<b>TX Power:</b> ${node.tx_power_dbm} dBm`,
      `<b>Firmware:</b> ${escapeXml(node.firmware || 'N/A')}`,
      `<b>Frequency:</b> ${node.frequency_mhz} MHz`,
      `<b>Modem:</b> SF${node.spreading_factor}/BW${node.bandwidth_khz}/CR${node.coding_rate}`,
      node.is_solar ? '<b>Solar:</b> Yes' : '',
      node.notes ? `<b>Notes:</b> ${escapeXml(node.notes)}` : '',
    ].filter(Boolean).join('<br/>');

    const styleUrl = node.is_solar ? '#nodeSolar' : '#nodeDefault';

    lines.push('    <Placemark>');
    lines.push(`      <name>${escapeXml(node.name)}</name>`);
    lines.push(`      <description><![CDATA[${desc}]]></description>`);
    lines.push(`      <styleUrl>${styleUrl}</styleUrl>`);
    lines.push('      <ExtendedData>');
    for (const [key, value] of Object.entries(privacy)) {
      lines.push(`        <Data name="${key}"><value>${escapeXml(value)}</value></Data>`);
    }
    lines.push('      </ExtendedData>');
    lines.push('      <Point>');
    lines.push(`        <altitudeMode>relativeToGround</altitudeMode>`);
    lines.push(`        <coordinates>${node.longitude},${node.latitude},${node.antenna_height_m}</coordinates>`);
    lines.push('      </Point>');
    lines.push('    </Placemark>');
  }

  lines.push('  </Folder>');

  // Links folder (if provided)
  if (links && links.length > 0) {
    lines.push('  <Folder>');
    lines.push('    <name>Links</name>');

    for (const link of links) {
      const color = linkQualityColor(link.linkQuality);
      const distKm = (link.distanceM / 1000).toFixed(2);
      const desc = [
        `<b>Distance:</b> ${distKm} km`,
        `<b>Quality:</b> ${escapeXml(link.linkQuality)}`,
        `<b>Viable:</b> ${link.isViable ? 'Yes' : 'No'}`,
        link.receivedSignalDbm != null ? `<b>Signal:</b> ${link.receivedSignalDbm} dBm` : '',
        link.fresnelClearancePct != null ? `<b>Fresnel Clearance:</b> ${link.fresnelClearancePct}%` : '',
      ].filter(Boolean).join('<br/>');

      lines.push('    <Placemark>');
      lines.push(`      <name>${escapeXml(link.nodeAName)} ↔ ${escapeXml(link.nodeBName)}</name>`);
      lines.push(`      <description><![CDATA[${desc}]]></description>`);
      lines.push('      <Style>');
      lines.push('        <LineStyle>');
      lines.push(`          <color>${color}</color>`);
      lines.push('          <width>2</width>');
      lines.push('        </LineStyle>');
      lines.push('      </Style>');
      lines.push('      <LineString>');
      lines.push('        <altitudeMode>relativeToGround</altitudeMode>');
      lines.push(`        <coordinates>${link.nodeALon},${link.nodeALat},${link.nodeAAlt} ${link.nodeBLon},${link.nodeBLat},${link.nodeBAlt}</coordinates>`);
      lines.push('      </LineString>');
      lines.push('    </Placemark>');
    }

    lines.push('  </Folder>');
  }

  lines.push('</Document>');
  lines.push('</kml>');

  return lines.join('\n');
}
