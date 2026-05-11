import L from 'leaflet';
import type { Node } from '../../types';
import { escapeHtml } from '../../utils/html';

export const NODE_LABEL_TOOLTIP_OPTIONS: L.TooltipOptions = {
  permanent: true,
  direction: 'top',
  offset: [0, -42],
  className: 'node-label-tooltip',
};

export function createNodeIcon(selected: boolean = false, multiSelected: boolean = false) {
  let color = '#3498db'; // default blue
  if (selected) {
    color = '#e74c3c'; // red for primary selected
  } else if (multiSelected) {
    color = '#e67e22'; // orange for multi-selected
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: 'custom-marker-icon',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

export function buildNodePopupHtml(node: Node): string {
  return (
    `<b>${escapeHtml(node.name)}</b><br>` +
    `Lat: ${node.latitude.toFixed(5)}<br>` +
    `Lon: ${node.longitude.toFixed(5)}<br>` +
    `Height: ${node.antenna_height_m}m<br>` +
    `Device: ${escapeHtml(node.device_id)}<br>` +
    `Power: ${node.tx_power_dbm} dBm`
  );
}
