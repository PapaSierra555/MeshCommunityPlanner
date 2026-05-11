/**
 * IsolatedNodeIndicator component
 * Shows warning badge/red marker for nodes with no coverage overlap
 * Helps users identify nodes that may not form a mesh network
 */

import React from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';

export interface IsolatedNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface IsolatedNodeIndicatorProps {
  node: IsolatedNode;
  isIsolated: boolean;
  onClick?: (nodeId: string) => void;
  className?: string;
}

const IsolatedNodeIndicatorComponent = ({
  node,
  isIsolated,
  onClick,
  className = '',
}: IsolatedNodeIndicatorProps) => {
  // Don't render if node is not isolated
  if (!isIsolated) {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick(node.id);
    }
  };

  return (
    <CircleMarker
      center={[node.latitude, node.longitude]}
      radius={12}
      pathOptions={{
        color: '#DC2626', // Red border
        fillColor: '#DC2626', // Red fill
        fillOpacity: 0.3,
        weight: 2,
      }}
      eventHandlers={{
        click: handleClick,
      }}
      className={className}
    >
      <Tooltip permanent={false}>
        <div className="isolated-node-tooltip" role="alert">
          <strong>⚠ {node.name}</strong>
          <br />
          Isolated - No coverage overlap with other nodes
        </div>
      </Tooltip>
    </CircleMarker>
  );
};

// Memoize to prevent unnecessary re-renders
export const IsolatedNodeIndicator = React.memo(IsolatedNodeIndicatorComponent);
