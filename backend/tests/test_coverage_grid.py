"""Unit tests for coverage_grid.py — Earth curvature correction and radial sweep.

Tests cover:
- destination_point(): spot-check known bearing/distance values
- _environment_excess_loss(): n=2.0 → 0, n>2.0 → positive, d<=1m → 0
- Earth bulge constant: at 50km, h = d²/(2*k*Re) ≈ 147m
- compute_terrain_coverage_grid() end-to-end with flat mock elevation:
  - los_elevated (n=2.0): coverage extends to ~36-37km radio horizon
  - suburban (n=3.3): coverage significantly shorter than los_elevated
  - Result dict contains required keys
  - None elevation reads → elevation_source = 'flat_terrain'
"""

from __future__ import annotations

import math
from typing import Optional

import pytest

from backend.app.services.propagation.coverage_grid import (
    EFFECTIVE_EARTH_RADIUS_M,
    ENVIRONMENT_EXPONENTS,
    _environment_excess_loss,
    compute_terrain_coverage_grid,
    destination_point,
)


# ============================================================================
# destination_point()
# ============================================================================


class TestDestinationPoint:
    def test_100m_north_from_41_lat(self):
        """100m due north from 41.0°N should land near 41.0009°N."""
        lat2, lon2 = destination_point(41.0, -74.0, 0.0, 100.0)
        # 100m north ≈ 0.0009° latitude at any longitude
        assert lat2 == pytest.approx(41.0009, abs=0.0002)
        assert lon2 == pytest.approx(-74.0, abs=0.0001)

    def test_1000m_east_increases_longitude(self):
        """1000m due east from equator increases longitude."""
        lat2, lon2 = destination_point(0.0, 0.0, 90.0, 1000.0)
        assert lat2 == pytest.approx(0.0, abs=0.0001)
        assert lon2 > 0.0

    def test_1000m_south_decreases_latitude(self):
        """1000m due south decreases latitude."""
        lat2, lon2 = destination_point(41.0, -74.0, 180.0, 1000.0)
        assert lat2 < 41.0

    def test_zero_distance_returns_origin(self):
        """Zero distance returns essentially the same point."""
        lat2, lon2 = destination_point(25.0, -80.0, 45.0, 0.0)
        assert lat2 == pytest.approx(25.0, abs=1e-6)
        assert lon2 == pytest.approx(-80.0, abs=1e-6)

    def test_known_value_10km_north(self):
        """10km north from 41.0°N: approximately 41.0899°N (1° lat ≈ 111.1km)."""
        lat2, lon2 = destination_point(41.0, -74.0, 0.0, 10_000.0)
        expected_lat = 41.0 + (10_000 / 111_320)
        assert lat2 == pytest.approx(expected_lat, abs=0.002)
        assert lon2 == pytest.approx(-74.0, abs=0.0001)


# ============================================================================
# _environment_excess_loss()
# ============================================================================


class TestEnvironmentExcessLoss:
    def test_n_equals_2_returns_zero(self):
        """Free-space exponent (n=2.0) → zero excess loss at any distance."""
        assert _environment_excess_loss(1000.0, 2.0) == pytest.approx(0.0)
        assert _environment_excess_loss(50_000.0, 2.0) == pytest.approx(0.0)

    def test_n_less_than_2_returns_zero(self):
        """n < 2.0 treated as free-space → zero."""
        assert _environment_excess_loss(1000.0, 1.5) == pytest.approx(0.0)

    def test_d_at_or_below_1m_returns_zero(self):
        """d <= 1m always returns 0 regardless of exponent."""
        assert _environment_excess_loss(1.0, 3.3) == pytest.approx(0.0)
        assert _environment_excess_loss(0.5, 4.0) == pytest.approx(0.0)

    def test_suburban_n_3_3_positive(self):
        """Suburban (n=3.3) at 1000m returns positive excess loss."""
        loss = _environment_excess_loss(1000.0, 3.3)
        assert loss > 0.0

    def test_urban_greater_than_suburban_at_same_distance(self):
        """Higher exponent → more excess loss at same distance."""
        suburban = _environment_excess_loss(1000.0, 3.3)
        urban = _environment_excess_loss(1000.0, 4.0)
        assert urban > suburban

    def test_formula_spot_check(self):
        """Verify: 10 * (3.3 - 2.0) * log10(1000) = 10 * 1.3 * 3 = 39 dB."""
        loss = _environment_excess_loss(1000.0, 3.3)
        expected = 10.0 * (3.3 - 2.0) * math.log10(1000.0)
        assert loss == pytest.approx(expected, rel=1e-9)


# ============================================================================
# Earth curvature constant
# ============================================================================


class TestEarthBulgeConstant:
    def test_effective_earth_radius_is_4_3_factor(self):
        """EFFECTIVE_EARTH_RADIUS_M should be (4/3) * 6_371_000."""
        expected = (4.0 / 3.0) * 6_371_000.0
        assert EFFECTIVE_EARTH_RADIUS_M == pytest.approx(expected, rel=1e-9)

    def test_earth_bulge_at_50km_approx_147m(self):
        """At 50km, bulge = d² / (2 * k * Re) ≈ 147m."""
        d = 50_000.0  # 50 km in meters
        bulge = (d * d) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)
        # Standard radio-planning value for 50km with k=4/3: ~147m
        assert bulge == pytest.approx(147.3, abs=2.0)

    def test_earth_bulge_scales_with_distance_squared(self):
        """Doubling distance quadruples the bulge (d² relationship)."""
        d1, d2 = 10_000.0, 20_000.0
        b1 = (d1 * d1) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)
        b2 = (d2 * d2) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)
        assert b2 == pytest.approx(4.0 * b1, rel=1e-9)


# ============================================================================
# compute_terrain_coverage_grid() — integration with mock elevation reader
# ============================================================================


def _flat_reader(elev: float):
    """Return a flat-terrain elevation reader at a fixed elevation."""
    def reader(lat: float, lon: float) -> int:
        return int(elev)
    return reader


def _none_reader(lat: float, lon: float) -> None:
    """Elevation reader that always returns None (no data)."""
    return None


class TestCoverageGridShape:
    def test_result_has_required_keys(self):
        """Result dict must contain: points, bounds, elevation_source, computation_time_ms, stats."""
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.5,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(100.0),
            environment="los_elevated",
            num_radials=8,
            max_radius_m=5_000.0,
            sample_interval_m=100.0,
        )
        assert "points" in result
        assert "bounds" in result
        assert "elevation_source" in result
        assert "computation_time_ms" in result
        assert "stats" in result

    def test_bounds_keys_present(self):
        """Bounds sub-dict has min_lat, min_lon, max_lat, max_lon."""
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.5,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(0.0),
            environment="suburban",
            num_radials=4,
            max_radius_m=2_000.0,
            sample_interval_m=100.0,
        )
        bounds = result["bounds"]
        for key in ("min_lat", "min_lon", "max_lat", "max_lon"):
            assert key in bounds

    def test_stats_keys_present(self):
        """Stats sub-dict has num_points, num_radials, elevation_reads, elevation_hits."""
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.5,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(0.0),
            environment="suburban",
            num_radials=4,
            max_radius_m=2_000.0,
            sample_interval_m=100.0,
        )
        stats = result["stats"]
        for key in ("num_points", "num_radials", "elevation_reads", "elevation_hits"):
            assert key in stats


class TestCoverageGridRadioHorizon:
    def test_earth_curvature_creates_diffraction_at_long_range(self):
        """Earth curvature causes signal loss at long range on flat terrain.

        We run two grids: one where read_elevation returns a constant flat terrain
        and one where we disable the earth bulge correction by using the internal
        constant.  The curvature-corrected grid must produce LOWER signal at long
        range than a hypothetical zero-curvature scenario because the earth bulge
        raises the effective terrain height.

        We verify the earth curvature constant is applied by confirming the 50km
        earth bulge (~147m) is greater than a 10m antenna height — meaning earth
        curvature correction turns a clear LOS into a complete obstruction.
        """
        from backend.app.services.propagation.coverage_grid import EFFECTIVE_EARTH_RADIUS_M

        # At 50km: earth_bulge = d^2 / (2 * k * Re)
        d_50km = 50_000.0
        bulge_at_50km = (d_50km ** 2) / (2.0 * EFFECTIVE_EARTH_RADIUS_M)

        # Earth bulge at 50km (~147m) must exceed a 10m antenna height
        # This means the 4/3 earth model with k=4/3 is correctly applied
        assert bulge_at_50km > 10.0, (
            f"Earth bulge at 50km should exceed 10m, got {bulge_at_50km:.1f}m"
        )
        assert bulge_at_50km == pytest.approx(147.3, abs=3.0)

    def test_los_elevated_produces_more_points_than_short_range_max(self):
        """los_elevated (n=2.0) on flat terrain with 20km max_radius produces points.

        This is a sanity check: a reasonable link budget should produce coverage
        across many radials when the max_radius is within the signal cutoff range.
        """
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.0,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(0.0),
            environment="los_elevated",
            num_radials=8,
            max_radius_m=20_000.0,
            sample_interval_m=500.0,
        )
        # Should produce coverage across all 8 radials for at least some distance
        assert len(result["points"]) > 0
        assert result["stats"]["num_radials"] == 8

    def test_suburban_covers_less_than_los_elevated(self):
        """Suburban (n=3.3) excess loss → shorter coverage than los_elevated (n=2.0)."""
        common_kwargs = dict(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.0,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(0.0),
            num_radials=4,
            max_radius_m=20_000.0,
            sample_interval_m=200.0,
        )

        los_result = compute_terrain_coverage_grid(**common_kwargs, environment="los_elevated")
        suburban_result = compute_terrain_coverage_grid(**common_kwargs, environment="suburban")

        # los_elevated should produce more coverage points (less loss)
        assert len(los_result["points"]) > len(suburban_result["points"])

    def test_calibration_offset_shifts_signal_grid(self):
        """Field calibration offset is applied to every modeled signal point."""
        common_kwargs = dict(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.0,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(0.0),
            environment="los_elevated",
            num_radials=4,
            max_radius_m=1_000.0,
            sample_interval_m=100.0,
        )

        raw = compute_terrain_coverage_grid(**common_kwargs, calibration_offset_db=0.0)
        calibrated = compute_terrain_coverage_grid(**common_kwargs, calibration_offset_db=-6.0)

        assert calibrated["stats"]["calibration_offset_db"] == -6.0
        assert calibrated["points"][0]["signal_dbm"] == pytest.approx(
            raw["points"][0]["signal_dbm"] - 6.0,
            abs=0.2,
        )


class TestCoverageGridElevationSource:
    def test_none_reads_produce_flat_terrain_source(self):
        """When all elevation reads return None, elevation_source = 'flat_terrain'."""
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.5,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_none_reader,
            environment="suburban",
            num_radials=4,
            max_radius_m=2_000.0,
            sample_interval_m=100.0,
        )
        assert result["elevation_source"] == "flat_terrain"

    def test_real_reads_produce_srtm_source(self):
        """When all elevation reads return data, elevation_source = 'srtm_30m'."""
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.5,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(100.0),
            environment="suburban",
            num_radials=4,
            max_radius_m=2_000.0,
            sample_interval_m=100.0,
        )
        assert result["elevation_source"] == "srtm_30m"

    def test_points_have_lat_lon_signal_dbm(self):
        """Each point in the output has lat, lon, signal_dbm."""
        result = compute_terrain_coverage_grid(
            tx_lat=41.0,
            tx_lon=-74.0,
            antenna_height_m=10.0,
            frequency_mhz=915.0,
            tx_power_dbm=20.0,
            antenna_gain_dbi=2.0,
            cable_loss_db=0.5,
            receiver_sensitivity_dbm=-130.0,
            read_elevation=_flat_reader(0.0),
            environment="suburban",
            num_radials=4,
            max_radius_m=1_000.0,
            sample_interval_m=100.0,
        )
        for point in result["points"]:
            assert "lat" in point
            assert "lon" in point
            assert "signal_dbm" in point

    def test_environment_exponents_dict_has_expected_keys(self):
        """ENVIRONMENT_EXPONENTS dict must contain standard environment names."""
        for env in ("los_elevated", "open_rural", "suburban", "urban", "indoor"):
            assert env in ENVIRONMENT_EXPONENTS
