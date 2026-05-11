import type { FieldObservation, Node } from '../types';

const DEFAULT_NOISE_FIGURE_DB = 6;
const DEFAULT_BANDWIDTH_KHZ = 250;

export function findAckRelayNode(observation: FieldObservation, nodes: Node[]): Node | null {
  if (!observation.ack_relay) return null;
  const relay = observation.ack_relay.trim().toLowerCase();
  return nodes.find((node) => node.name.trim().toLowerCase() === relay) ?? null;
}

export function noiseFloorDbm(bandwidthKhz: number, noiseFigureDb = DEFAULT_NOISE_FIGURE_DB): number {
  const bwHz = Math.max(1, bandwidthKhz) * 1000;
  return -174 + 10 * Math.log10(bwHz) + noiseFigureDb;
}

export function estimateRssiFromSnrDbm(
  ackSnrDb: number | null,
  bandwidthKhz: number | null | undefined,
  noiseFigureDb = DEFAULT_NOISE_FIGURE_DB,
): number | null {
  if (ackSnrDb == null) return null;
  return noiseFloorDbm(bandwidthKhz || DEFAULT_BANDWIDTH_KHZ, noiseFigureDb) + ackSnrDb;
}

export function observationRfSummary(observation: FieldObservation, nodes: Node[]) {
  const relay = findAckRelayNode(observation, nodes);
  const bandwidthKhz = relay?.bandwidth_khz ?? DEFAULT_BANDWIDTH_KHZ;
  const noiseFloor = noiseFloorDbm(bandwidthKhz);
  const estimatedRssi = estimateRssiFromSnrDbm(observation.ack_db, bandwidthKhz);
  const txToRssiDelta =
    relay && estimatedRssi != null && Number.isFinite(relay.tx_power_dbm)
      ? relay.tx_power_dbm - estimatedRssi
      : null;

  return {
    relay,
    bandwidthKhz,
    noiseFloor,
    estimatedRssi,
    txToRssiDelta,
  };
}
