/**
 * CoverageCircle component
 * Semi-transparent circle showing node coverage based on FSPL calculations
 */

import React, { useMemo } from 'react';
import { Circle, Tooltip } from 'react-leaflet';
import type { Node } from '../../types';
import { calculateMaxDistance } from '../../utils/fspl';
import { formatDistance } from '../../utils/units';
import { getStatusColor } from '../../utils/colors';

const DEFAULT_ANTENNA_GAIN_DBI = 3.0;
const DEFAULT_RECEIVER_SENSITIVITY_DBM = -130.0;

export interface CoverageCircleProps {
  node: Node;
  color?: string;
  fillOpacity?: number;
}

const CoverageCircleComponent = ({
  node,
  color,
  fillOpacity = 0.2,
}: CoverageCircleProps) => {
  const center: [number, number] = [node.latitude, node.longitude];

  // Calculate coverage radius using FSPL
  const radiusMeters = useMemo(() => {
    if (node.desired_coverage_radius_m != null) {
      return node.desired_coverage_radius_m;
    }

    return calculateMaxDistance(
      node.tx_power_dbm,
      DEFAULT_RECEIVER_SENSITIVITY_DBM,
      DEFAULT_ANTENNA_GAIN_DBI,
      DEFAULT_ANTENNA_GAIN_DBI,
      node.region,
      node.frequency_mhz
    );
  }, [
    node.desired_coverage_radius_m,
    node.tx_power_dbm,
    node.region,
    node.frequency_mhz,
  ]);

  // Determine color based on node status if not provided
  const circleColor = useMemo(() => {
    if (color) return color;

    // Map node status to color status
    const statusMapping: Record<string, 'online' | 'offline' | 'degraded' | 'unknown'> = {
      'active': 'online',
      'candidate': 'unknown',
      'planned': 'unknown',
      'retired': 'offline',
      'rejected': 'offline',
    };

    const colorStatus = statusMapping[node.node_status || 'planned'] || 'unknown';
    return getStatusColor(colorStatus);
  }, [node.node_status, color]);

  return (
    <Circle
      center={center}
      radius={radiusMeters}
      pathOptions={{
        color: circleColor,
        fillColor: circleColor,
        fillOpacity: fillOpacity,
        weight: 2,
      }}
    >
      <Tooltip>
        <div className="coverage-tooltip">
          <strong>{node.name}</strong>
          <div>Coverage radius: {formatDistance(radiusMeters)}</div>
        </div>
      </Tooltip>
    </Circle>
  );
};

// Memoize to prevent re-rendering all coverage circles when one node changes
// Critical for performance with 50+ nodes
export const CoverageCircle = React.memo(CoverageCircleComponent, (prevProps, nextProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.latitude === nextProps.node.latitude &&
    prevProps.node.longitude === nextProps.node.longitude &&
    prevProps.node.desired_coverage_radius_m === nextProps.node.desired_coverage_radius_m &&
    prevProps.node.tx_power_dbm === nextProps.node.tx_power_dbm &&
    prevProps.node.region === nextProps.node.region &&
    prevProps.node.frequency_mhz === nextProps.node.frequency_mhz &&
    prevProps.node.node_status === nextProps.node.node_status &&
    prevProps.color === nextProps.color &&
    prevProps.fillOpacity === nextProps.fillOpacity
  );
});
