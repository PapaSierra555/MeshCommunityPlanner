"""Terrain-aware coverage grid computation using radial sweep.

Computes signal strength at grid points radiating outward from a transmitter,
using SRTM elevation data and knife-edge diffraction for terrain obstructions.
Produces a SPLAT!-style coverage heat map dataset.

Algorithm (per radial azimuth):
  1. Walk outward from TX at sample_interval_m steps, recording terrain elevation
  2. At each sample point, draw the LOS line from TX antenna tip → RX point
     (sample ground elevation + 1.5m handheld height)
  3. Check all previously-recorded terrain along this radial against that LOS line
  4. Find the single worst obstruction above LOS (dominant knife-edge)
  5. Compute Fresnel zone radius at the obstruction point and diffraction loss
  6. Signal = TX EIRP − FSPL(d) − diffraction_loss − environment_excess
  7. Stop radial when signal drops below −135 dBm

Optimization: instead of O(n²) re-scan of all intermediate points, track the
terrain point with the steepest angle from TX.  For each new sample this
single dominant obstacle is re-evaluated against the specific TX→sample LOS
line, giving correct per-point diffraction with O(n) complexity per radial.
"""

from __future__ import annotations

import logging
import math
import time
from typing import Callable, Optional

from backend.app.services.propagation.fspl import fspl_loss_db
from backend.app.services.propagation.lora import lora_receiver_sensitivity_dbm
from backend.app.services.link_analysis import (
    fresnel_zone_radius,
    estimate_diffraction_loss,
    C,
)

logger = logging.getLogger(__name__)

# Environment excess loss model: path loss exponent beyond free-space (n=2.0)
ENVIRONMENT_EXPONENTS: dict[str, float] = {
    "los_elevated": 2.0,
    "open_rural": 2.8,
    "open": 2.0,       # legacy alias
    "suburban": 3.3,
    "urban": 4.0,
    "indoor": 4.5,
}

# Safety floor for radial sweep. The actual coverage cutoff is the receiver
# sensitivity for the node's LoRa settings, clamped no weaker than this floor.
SIGNAL_CUTOFF_FLOOR_DBM = -150.0

# Default receiver height (handheld at ground level)
RX_HEIGHT_M = 1.5

# Earth curvature correction — standard 4/3 effective Earth radius
# h_bulge(d) = d^2 / (2 * k * Re) gives the apparent rise of the terrain
# at distance d relative to the TX horizontal plane.  Without this, the
# sweep treats every path as flat, making coverage unrealistically large
# at long range (e.g. 80m antenna appears to cover 50km on flat terrain
# instead of the correct ~37km radio horizon).
_K_FACTOR = 4.0 / 3.0
EFFECTIVE_EARTH_RADIUS_M = _K_FACTOR * 6_371_000.0  # ~8,494,667 m

# Type alias for elevation read function
ElevationReader = Callable[[float, float], Optional[int]]


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two WGS84 points."""
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 to point 2 in degrees."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_lambda = math.radians(lon2 - lon1)
    y = math.sin(d_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def destination_point(
    lat: float, lon: float, bearing_deg: float, distance_m: float
) -> tuple[float, float]:
    """Haversine forward projection: compute destination point.

    Given a start point, bearing, and distance, compute the destination
    lat/lon on the WGS84 ellipsoid (spherical approximation).

    Args:
        lat: Start latitude in degrees.
        lon: Start longitude in degrees.
        bearing_deg: Bearing in degrees (0=N, 90=E, 180=S, 270=W).
        distance_m: Distance in meters.

    Returns:
        (lat2, lon2) in degrees.
    """
    R = 6_371_000.0  # Earth radius in meters

    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    brng = math.radians(bearing_deg)
    d_R = distance_m / R

    sin_d = math.sin(d_R)
    cos_d = math.cos(d_R)
    sin_lat1 = math.sin(lat1)
    cos_lat1 = math.cos(lat1)

    lat2 = math.asin(sin_lat1 * cos_d + cos_lat1 * sin_d * math.cos(brng))
    lon2 = lon1 + math.atan2(
        math.sin(brng) * sin_d * cos_lat1,
        cos_d - sin_lat1 * math.sin(lat2),
    )

    return math.degrees(lat2), math.degrees(lon2)


def _environment_excess_loss(distance_m: float, exponent: float) -> float:
    """Compute excess loss beyond free-space for a given environment.

    excess = 10 * (n - 2.0) * log10(d)  for d > 1m
    When n=2.0 (open/free-space), excess is 0.
    """
    if distance_m <= 1.0 or exponent <= 2.0:
        return 0.0
    return 10.0 * (exponent - 2.0) * math.log10(distance_m)


def compute_terrain_signal_to_point(
    tx_lat: float,
    tx_lon: float,
    rx_lat: float,
    rx_lon: float,
    antenna_height_m: float,
    frequency_mhz: float,
    tx_power_dbm: float,
    antenna_gain_dbi: float,
    cable_loss_db: float,
    read_elevation: ElevationReader,
    environment: str = "suburban",
    sample_interval_m: float = 30.0,
) -> float:
    """Predict received signal at one point using the same terrain model as coverage grids."""
    distance_total = haversine_distance_m(tx_lat, tx_lon, rx_lat, rx_lon)
    if distance_total <= 1.0:
        return tx_power_dbm + antenna_gain_dbi - cable_loss_db

    env_n = ENVIRONMENT_EXPONENTS.get(environment, 3.3)
    wavelength_m = C / (frequency_mhz * 1e6)
    bearing = bearing_degrees(tx_lat, tx_lon, rx_lat, rx_lon)

    tx_ground = read_elevation(tx_lat, tx_lon)
    if tx_ground is None:
        tx_ground = 0
    tx_tip = tx_ground + antenna_height_m

    best_obstacle_slope = -1e30
    best_obstacle_elev = 0.0
    best_obstacle_dist = 0.0

    sample_count = max(1, int(distance_total / sample_interval_m))
    for si in range(1, sample_count + 1):
        distance = min(si * sample_interval_m, distance_total)
        if distance >= distance_total:
            break
        pt_lat, pt_lon = destination_point(tx_lat, tx_lon, bearing, distance)
        pt_elev_raw = read_elevation(pt_lat, pt_lon)
        pt_elev = float(pt_elev_raw) if pt_elev_raw is not None else 0.0
        earth_bulge = (distance * distance) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)
        pt_elev_curved = pt_elev + earth_bulge
        terrain_slope = (pt_elev_curved - tx_tip) / distance
        if terrain_slope > best_obstacle_slope:
            best_obstacle_slope = terrain_slope
            best_obstacle_elev = pt_elev_curved
            best_obstacle_dist = distance

    rx_ground_raw = read_elevation(rx_lat, rx_lon)
    rx_ground = float(rx_ground_raw) if rx_ground_raw is not None else 0.0
    rx_bulge = (distance_total * distance_total) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)
    rx_h = rx_ground + rx_bulge + RX_HEIGHT_M

    diffraction_loss = 0.0
    if 0 < best_obstacle_dist < distance_total:
        los_h_at_obstacle = tx_tip + (rx_h - tx_tip) * (best_obstacle_dist / distance_total)
        obstruction_m = best_obstacle_elev - los_h_at_obstacle
        if obstruction_m > 0:
            d1 = best_obstacle_dist
            d2 = distance_total - best_obstacle_dist
            fr = fresnel_zone_radius(wavelength_m, d1, d2)
            diffraction_loss = estimate_diffraction_loss(obstruction_m, fr if fr > 0 else 1.0)

    return (
        tx_power_dbm
        + antenna_gain_dbi
        - cable_loss_db
        - fspl_loss_db(distance_total, frequency_mhz)
        - diffraction_loss
        - _environment_excess_loss(distance_total, env_n)
    )


def compute_terrain_coverage_grid(
    tx_lat: float,
    tx_lon: float,
    antenna_height_m: float,
    frequency_mhz: float,
    tx_power_dbm: float,
    antenna_gain_dbi: float,
    cable_loss_db: float,
    receiver_sensitivity_dbm: float,
    read_elevation: ElevationReader,
    environment: str = "suburban",
    spreading_factor: Optional[int] = None,
    bandwidth_khz: Optional[float] = None,
    coding_rate: str = "4/5",
    calibration_offset_db: float = 0.0,
    num_radials: int = 360,
    max_radius_m: float = 15000.0,
    sample_interval_m: float = 30.0,
) -> dict:
    """Compute terrain-aware coverage grid using radial sweep.

    For each azimuth bearing, steps outward from TX computing the received
    signal at each sample.  At every sample the LOS line from TX antenna tip
    to that sample's RX point (ground + 1.5 m) is drawn, and the dominant
    terrain obstruction along the radial so far is evaluated against it.
    Knife-edge diffraction loss is added when terrain protrudes above LOS.

    Args:
        tx_lat: Transmitter latitude.
        tx_lon: Transmitter longitude.
        antenna_height_m: TX antenna height above ground (m).
        frequency_mhz: Operating frequency (MHz).
        tx_power_dbm: Transmit power (dBm).
        antenna_gain_dbi: Antenna gain (dBi).
        cable_loss_db: Cable/connector loss (dB).
        receiver_sensitivity_dbm: Receiver sensitivity fallback (dBm).
        read_elevation: Function(lat, lon) -> elevation_m or None.
        environment: "open"|"suburban"|"urban"|"indoor".
        spreading_factor: Optional LoRa spreading factor for sensitivity derivation.
        bandwidth_khz: Optional LoRa bandwidth for sensitivity derivation.
        coding_rate: Optional LoRa coding rate for sensitivity derivation.
        calibration_offset_db: Empirical signal correction from field observations.
        num_radials: Number of azimuth bearings (default 360).
        max_radius_m: Maximum sweep radius (m).
        sample_interval_m: Distance between samples (m).

    Returns:
        Dict with keys: points, bounds, elevation_source, timing_ms, stats.
    """
    t_start = time.perf_counter()

    env_n = ENVIRONMENT_EXPONENTS.get(environment, 3.3)
    wavelength_m = C / (frequency_mhz * 1e6)
    effective_sensitivity_dbm = receiver_sensitivity_dbm
    if spreading_factor is not None and bandwidth_khz is not None:
        effective_sensitivity_dbm = lora_receiver_sensitivity_dbm(
            spreading_factor=spreading_factor,
            bandwidth_khz=bandwidth_khz,
            coding_rate=coding_rate,
        )
    signal_cutoff_dbm = max(effective_sensitivity_dbm, SIGNAL_CUTOFF_FLOOR_DBM)

    # TX ground elevation
    tx_ground = read_elevation(tx_lat, tx_lon)
    if tx_ground is None:
        tx_ground = 0
    tx_tip = tx_ground + antenna_height_m  # TX antenna tip AMSL

    max_steps = int(max_radius_m / sample_interval_m)
    bearing_step = 360.0 / num_radials

    points: list[dict] = []
    min_lat = tx_lat
    max_lat = tx_lat
    min_lon = tx_lon
    max_lon = tx_lon
    elevation_reads = 0
    elevation_hits = 0

    for ri in range(num_radials):
        bearing = ri * bearing_step

        # ---- Per-radial terrain profile tracking ----
        # We track the terrain point with the steepest angle from TX tip.
        # This is the dominant single knife-edge obstacle.
        # slope = (terrain_elev - tx_tip) / distance
        best_obstacle_slope = -1e30  # steepest angle seen so far
        best_obstacle_elev = 0.0    # elevation at that point
        best_obstacle_dist = 0.0    # distance from TX to that point

        for si in range(1, max_steps + 1):
            distance = si * sample_interval_m

            # Compute sample point location
            pt_lat, pt_lon = destination_point(tx_lat, tx_lon, bearing, distance)

            # Read terrain elevation at this point
            elevation_reads += 1
            pt_elev_raw = read_elevation(pt_lat, pt_lon)
            if pt_elev_raw is not None:
                elevation_hits += 1
                pt_elev = float(pt_elev_raw)
            else:
                pt_elev = 0.0  # fallback to sea level

            # Earth curvature correction: the terrain at distance d appears
            # d^2 / (2 * k * Re) higher than its AMSL elevation when viewed
            # from the TX horizontal plane.  Without this, coverage extends
            # far beyond the true radio horizon on flat terrain.
            earth_bulge = (distance * distance) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)
            pt_elev_curved = pt_elev + earth_bulge

            # --- Update dominant obstacle tracking ---
            # Slope from TX tip to corrected terrain at this point
            terrain_slope = (pt_elev_curved - tx_tip) / distance
            if terrain_slope > best_obstacle_slope:
                best_obstacle_slope = terrain_slope
                best_obstacle_elev = pt_elev_curved
                best_obstacle_dist = distance

            # --- Compute signal at this sample point ---
            # RX point: curvature-corrected ground elevation + handheld height
            rx_h = pt_elev_curved + RX_HEIGHT_M

            # Diffraction loss from the dominant obstacle
            diffraction_loss = 0.0
            if best_obstacle_dist > 0 and best_obstacle_dist < distance:
                # LOS line from TX tip (height tx_tip at d=0) to RX (height rx_h at d=distance)
                # Height of LOS line at the obstacle distance:
                # los_h = tx_tip + (rx_h - tx_tip) * (obstacle_dist / distance)
                los_h_at_obstacle = tx_tip + (rx_h - tx_tip) * (best_obstacle_dist / distance)

                obstruction_m = best_obstacle_elev - los_h_at_obstacle
                if obstruction_m > 0:
                    # Fresnel zone radius at the obstacle point
                    d1 = best_obstacle_dist
                    d2 = distance - best_obstacle_dist
                    fr = fresnel_zone_radius(wavelength_m, d1, d2)
                    diffraction_loss = estimate_diffraction_loss(
                        obstruction_m, fr if fr > 0 else 1.0
                    )

            # Free-space path loss
            try:
                fspl = fspl_loss_db(distance, frequency_mhz)
            except ValueError:
                break

            # Environment excess loss
            env_excess = _environment_excess_loss(distance, env_n)

            signal_dbm = (
                tx_power_dbm
                + antenna_gain_dbi
                - cable_loss_db
                - fspl
                - diffraction_loss
                - env_excess
                + calibration_offset_db
            )

            # Stop this radial once the signal falls below the LoRa demodulation
            # threshold for this node's SF/BW/CR settings.
            if signal_dbm < signal_cutoff_dbm:
                break

            points.append({
                "lat": round(pt_lat, 6),
                "lon": round(pt_lon, 6),
                "signal_dbm": round(signal_dbm, 1),
            })

            # Update bounds
            if pt_lat < min_lat:
                min_lat = pt_lat
            if pt_lat > max_lat:
                max_lat = pt_lat
            if pt_lon < min_lon:
                min_lon = pt_lon
            if pt_lon > max_lon:
                max_lon = pt_lon

    timing_ms = round((time.perf_counter() - t_start) * 1000)

    elevation_source = "srtm_30m" if (elevation_hits > elevation_reads * 0.5) else (
        "srtm_partial" if elevation_hits > 0 else "flat_terrain"
    )

    logger.info(
        "Coverage grid: %d points, %d radials, %d elevation reads (%d hits), %.1fs",
        len(points), num_radials, elevation_reads, elevation_hits, timing_ms / 1000,
    )

    return {
        "points": points,
        "bounds": {
            "min_lat": round(min_lat, 6),
            "min_lon": round(min_lon, 6),
            "max_lat": round(max_lat, 6),
            "max_lon": round(max_lon, 6),
        },
        "elevation_source": elevation_source,
        "computation_time_ms": timing_ms,
        "stats": {
            "num_points": len(points),
            "num_radials": num_radials,
            "elevation_reads": elevation_reads,
            "elevation_hits": elevation_hits,
            "receiver_sensitivity_dbm": round(effective_sensitivity_dbm, 1),
            "signal_cutoff_dbm": round(signal_cutoff_dbm, 1),
            "calibration_offset_db": round(calibration_offset_db, 1),
        },
    }
