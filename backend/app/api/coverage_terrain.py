"""Terrain-aware coverage grid API handler.

Computes a radial sweep coverage grid using SRTM elevation data
and knife-edge diffraction, returning signal strength points for
SPLAT!-style heat map rendering.
"""

from __future__ import annotations

import logging
import math
import statistics
from typing import Any

from backend.app.services.propagation.srtm import tiles_for_bounds

logger = logging.getLogger(__name__)


async def _ensure_srtm_tiles_for_coverage(
    srtm_manager: Any,
    center_lat: float,
    center_lon: float,
    max_radius_m: float,
) -> tuple[int, int]:
    """Download SRTM tiles needed for coverage grid around a center point.

    Returns (tiles_needed, tiles_available) tuple.
    """
    # Approximate bounding box from center + radius
    # ~111km per degree latitude, ~111km * cos(lat) per degree longitude
    lat_offset = max_radius_m / 111_000.0
    lon_offset = max_radius_m / (111_000.0 * max(math.cos(math.radians(center_lat)), 0.01))

    min_lat = center_lat - lat_offset
    max_lat = center_lat + lat_offset
    min_lon = center_lon - lon_offset
    max_lon = center_lon + lon_offset

    tiles = tiles_for_bounds(min_lat, min_lon, max_lat, max_lon)
    tiles_needed = len(tiles)
    tiles_available = 0

    for tile_lat, tile_lon in tiles:
        try:
            if not srtm_manager.has_hgt(tile_lat, tile_lon):
                logger.info("Downloading SRTM tile for (%d, %d)...", tile_lat, tile_lon)
                await srtm_manager.download_tile(tile_lat, tile_lon)
            if srtm_manager.has_hgt(tile_lat, tile_lon):
                tiles_available += 1
            else:
                logger.warning("SRTM tile (%d, %d) still not available", tile_lat, tile_lon)
        except Exception as e:
            logger.warning("Failed to download SRTM tile (%d, %d): %s", tile_lat, tile_lon, e)

    logger.info("SRTM tiles for coverage: %d/%d available", tiles_available, tiles_needed)
    return tiles_needed, tiles_available


async def handle_terrain_coverage_grid(request_data: dict) -> dict:
    """Handle terrain coverage grid computation request.

    Args:
        request_data: Dict with node params + optional _srtm_manager.

    Returns:
        Dict with node_id, points, bounds, environment, elevation_source,
        computation_time_ms.
    """
    from backend.app.services.propagation.coverage_grid import (
        compute_terrain_coverage_grid,
        compute_terrain_signal_to_point,
    )

    srtm_manager = request_data.pop("_srtm_manager", None)

    node_id = request_data.get("node_id", "node")
    node_name = request_data.get("node_name")
    latitude = request_data["latitude"]
    longitude = request_data["longitude"]
    antenna_height_m = request_data.get("antenna_height_m", 2.0)
    frequency_mhz = request_data.get("frequency_mhz", 906.875)
    tx_power_dbm = request_data.get("tx_power_dbm", 22.0)
    antenna_gain_dbi = request_data.get("antenna_gain_dbi", 3.0)
    cable_loss_db = request_data.get("cable_loss_db", 0.0)
    receiver_sensitivity_dbm = request_data.get("receiver_sensitivity_dbm", -130.0)
    spreading_factor = request_data.get("spreading_factor")
    bandwidth_khz = request_data.get("bandwidth_khz")
    coding_rate = request_data.get("coding_rate", "4/5")
    environment = request_data.get("environment", "suburban")
    max_radius_m = request_data.get("max_radius_m", 15000.0)
    num_radials = request_data.get("num_radials", 360)
    sample_interval_m = request_data.get("sample_interval_m", 30.0)
    use_field_calibration = bool(request_data.get("use_field_calibration", False))
    calibration_observations = request_data.get("calibration_observations") or []

    # PA signal chain: if PA params provided, compute effective TX power
    # effective_tx = min(device_tx + pa_gain, pa_max_output)
    pa_max_output = request_data.get("pa_max_output_power_dbm")
    pa_input_max = request_data.get("pa_input_range_max_dbm")
    if pa_max_output is not None and pa_input_max is not None:
        pa_gain = float(pa_max_output) - float(pa_input_max)
        effective_tx = min(tx_power_dbm + pa_gain, float(pa_max_output))
        logger.debug(
            "PA applied: device_tx=%.1f dBm + gain=%.1f dB → effective_tx=%.1f dBm (max_output=%.1f dBm)",
            tx_power_dbm, pa_gain, effective_tx, pa_max_output,
        )
        tx_power_dbm = effective_tx

    # Ensure SRTM tiles are available
    if srtm_manager is not None:
        await _ensure_srtm_tiles_for_coverage(
            srtm_manager, latitude, longitude, max_radius_m,
        )

    # Use cached elevation reader for performance
    def read_elevation(lat: float, lon: float):
        if srtm_manager is not None:
            return srtm_manager.read_elevation_cached(lat, lon)
        return None

    calibration_offset_db = 0.0
    calibration_used = 0
    calibration_residuals: list[float] = []
    if use_field_calibration and calibration_observations:
        relay_name = str(node_name or node_id).strip().lower()
        bw_hz = max(float(bandwidth_khz or 250.0), 1.0) * 1000.0
        noise_floor_dbm = -174.0 + 10.0 * math.log10(bw_hz) + 6.0

        for obs in calibration_observations:
            try:
                if not obs.get("success") or obs.get("ack_db") is None:
                    continue
                ack_relay = str(obs.get("ack_relay") or "").strip().lower()
                if ack_relay and ack_relay != relay_name:
                    continue

                observed_rssi_dbm = noise_floor_dbm + float(obs["ack_db"])
                predicted_rssi_dbm = compute_terrain_signal_to_point(
                    tx_lat=latitude,
                    tx_lon=longitude,
                    rx_lat=float(obs["latitude"]),
                    rx_lon=float(obs["longitude"]),
                    antenna_height_m=antenna_height_m,
                    frequency_mhz=frequency_mhz,
                    tx_power_dbm=tx_power_dbm,
                    antenna_gain_dbi=antenna_gain_dbi,
                    cable_loss_db=cable_loss_db,
                    read_elevation=read_elevation,
                    environment=environment,
                    sample_interval_m=sample_interval_m,
                )
                residual = observed_rssi_dbm - predicted_rssi_dbm
                if math.isfinite(residual):
                    calibration_residuals.append(residual)
            except Exception as e:
                logger.debug("Skipping calibration observation for %s: %s", node_id, e)

        if calibration_residuals:
            raw_offset = statistics.median(calibration_residuals)
            calibration_offset_db = max(-30.0, min(20.0, raw_offset))
            calibration_used = len(calibration_residuals)
            logger.info(
                "Coverage calibration for %s: %d observation(s), median residual %.1f dB, applied %.1f dB",
                node_id,
                calibration_used,
                raw_offset,
                calibration_offset_db,
            )

    try:
        result = compute_terrain_coverage_grid(
            tx_lat=latitude,
            tx_lon=longitude,
            antenna_height_m=antenna_height_m,
            frequency_mhz=frequency_mhz,
            tx_power_dbm=tx_power_dbm,
            antenna_gain_dbi=antenna_gain_dbi,
            cable_loss_db=cable_loss_db,
            receiver_sensitivity_dbm=receiver_sensitivity_dbm,
            read_elevation=read_elevation,
            environment=environment,
            spreading_factor=spreading_factor,
            bandwidth_khz=bandwidth_khz,
            coding_rate=coding_rate,
            calibration_offset_db=calibration_offset_db,
            num_radials=num_radials,
            max_radius_m=max_radius_m,
            sample_interval_m=sample_interval_m,
        )
    finally:
        # Free memory cache after computation
        if srtm_manager is not None:
            srtm_manager.clear_memory_cache()

    return {
        "node_id": node_id,
        "points": result["points"],
        "bounds": result["bounds"],
        "environment": environment,
        "elevation_source": result["elevation_source"],
        "computation_time_ms": result["computation_time_ms"],
        "stats": {
            **result["stats"],
            "calibration_enabled": use_field_calibration,
            "calibration_observations_used": calibration_used,
            "calibration_offset_db": round(calibration_offset_db, 1),
        },
    }
