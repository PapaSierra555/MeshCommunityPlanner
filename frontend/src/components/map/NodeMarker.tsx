/**
 * NodeMarker component
 * Draggable map marker for mesh nodes with popup info
 */

import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Node } from '../../types';

export interface NodeMarkerProps {
  node: Node;
  onClick?: (node: Node) => void;
  onPositionChange?: (nodeId: string, lat: number, lng: number) => void;
}

const NodeMarkerComponent = ({
  node,
  onClick,
  onPositionChange,
}: NodeMarkerProps) => {
  const position: [number, number] = [node.latitude, node.longitude];

  // Create accessible label for screen readers
  const accessibleLabel = `${node.name} at ${node.latitude.toFixed(2)}, ${node.longitude.toFixed(2)}`;
  const nodeStatus = node.node_status || 'planned';

  const handleClick = () => {
    if (onClick) {
      onClick(node);
    }
  };

  const handleDragEnd = (e: L.DragEndEvent) => {
    const { lat, lng } = e.target.getLatLng();
    if (onPositionChange) {
      onPositionChange(String(node.id), lat, lng);
    }
  };

  return (
    <Marker
      position={position}
      draggable={true}
      title={accessibleLabel}
      alt={accessibleLabel}
      eventHandlers={{
        click: handleClick,
        dragend: handleDragEnd,
      }}
    >
      <Popup>
        <div className="node-popup">
          <h3>{node.name}</h3>
          <div className="node-status">Status: {nodeStatus}</div>
          <div className="node-coords">
            <div>Lat: {node.latitude.toFixed(6)}</div>
            <div>Lng: {node.longitude.toFixed(6)}</div>
          </div>
          {node.device_id && (
            <div className="node-device">Device: {node.device_id}</div>
          )}
          <div className="node-antenna">Height: {node.antenna_height_m}m</div>
          <div className="node-power">
            TX: {node.tx_power_dbm} dBm | Frequency: {node.frequency_mhz} MHz
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

// Memoize with custom comparison - only re-render if node data actually changed
// Critical for performance when rendering 100+ nodes
export const NodeMarker = React.memo(NodeMarkerComponent, (prevProps, nextProps) => {
  // Compare node properties that affect rendering
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.name === nextProps.node.name &&
    prevProps.node.latitude === nextProps.node.latitude &&
    prevProps.node.longitude === nextProps.node.longitude &&
    prevProps.node.node_status === nextProps.node.node_status &&
    prevProps.node.device_id === nextProps.node.device_id &&
    prevProps.node.antenna_height_m === nextProps.node.antenna_height_m &&
    prevProps.node.tx_power_dbm === nextProps.node.tx_power_dbm &&
    prevProps.node.frequency_mhz === nextProps.node.frequency_mhz
  );
});
