/**
 * OverlapZone component
 * Shows hatching/stippling where coverage circles overlap
 * Different patterns for different overlap counts
 */

import React from 'react';
import type { PathOptions } from 'leaflet';
import { Polygon, Tooltip } from 'react-leaflet';

export interface OverlapZone {
  node_ids: string[];
  bounds: [number, number][];
}

export interface OverlapZoneProps {
  zone: OverlapZone;
  visible?: boolean;
  onClick?: (nodeIds: string[]) => void;
  className?: string;
}

/**
 * Get color based on overlap count
 * More nodes = darker/more intense color
 */
function getOverlapColor(nodeCount: number): string {
  if (nodeCount === 2) return '#3B82F6'; // Blue
  if (nodeCount === 3) return '#8B5CF6'; // Purple
  return '#EC4899'; // Pink for 4+
}

/**
 * Get fill pattern based on overlap count
 */
function getFillPattern(nodeCount: number): string {
  if (nodeCount === 2) return 'diagonal-stripe';
  return 'dots'; // 3+ nodes use stippling
}

/**
 * Get opacity based on overlap count
 */
function getOpacity(nodeCount: number, visible: boolean): number {
  if (!visible) return 0;
  if (nodeCount === 2) return 0.2;
  if (nodeCount === 3) return 0.3;
  return 0.4; // 4+ nodes are more opaque
}

const OverlapZoneComponent = ({
  zone,
  visible = true,
  onClick,
  className = '',
}: OverlapZoneProps) => {
  const nodeCount = zone.node_ids.length;
  const color = getOverlapColor(nodeCount);
  const fillPattern = getFillPattern(nodeCount);
  const opacity = getOpacity(nodeCount, visible);

  const handleClick = () => {
    if (onClick) {
      onClick(zone.node_ids);
    }
  };

  const pathOptions: PathOptions & { fillPattern?: string } = {
    color,
    fillPattern,
    fillOpacity: opacity,
    weight: 1,
  };

  return (
    <Polygon
      positions={zone.bounds}
      pathOptions={pathOptions}
      eventHandlers={{
        click: handleClick,
      }}
      className={className}
    >
      <Tooltip>
        <div className="overlap-zone-tooltip">
          <strong>{nodeCount} nodes</strong> coverage overlap
        </div>
      </Tooltip>
    </Polygon>
  );
};

// Memoize to prevent unnecessary re-renders when zone data hasn't changed
export const OverlapZone = React.memo(OverlapZoneComponent);
