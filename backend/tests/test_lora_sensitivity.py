"""Tests for LoRa receiver sensitivity derivation."""

from __future__ import annotations

import pytest

from backend.app.services.propagation.lora import lora_receiver_sensitivity_dbm
from backend.app.services.propagation.coverage_grid import compute_terrain_coverage_grid


def _flat_reader(_lat: float, _lon: float) -> int:
    return 0


def test_lora_sensitivity_tracks_sf_bw_and_coding_rate() -> None:
    sf7_bw250 = lora_receiver_sensitivity_dbm(7, 250.0, "4/5")
    sf11_bw250 = lora_receiver_sensitivity_dbm(11, 250.0, "4/5")
    sf11_bw625 = lora_receiver_sensitivity_dbm(11, 62.5, "4/5")
    sf11_bw625_cr8 = lora_receiver_sensitivity_dbm(11, 62.5, "4/8")

    assert sf11_bw250 < sf7_bw250
    assert sf11_bw625 < sf11_bw250
    assert sf11_bw625_cr8 < sf11_bw625
    assert sf7_bw250 == pytest.approx(-121.5, abs=1.0)


def test_terrain_coverage_uses_lora_sensitivity_cutoff() -> None:
    common = dict(
        tx_lat=41.0,
        tx_lon=-74.0,
        antenna_height_m=10.0,
        frequency_mhz=915.0,
        tx_power_dbm=0.0,
        antenna_gain_dbi=0.0,
        cable_loss_db=0.0,
        receiver_sensitivity_dbm=-130.0,
        read_elevation=_flat_reader,
        environment="los_elevated",
        num_radials=4,
        max_radius_m=80_000.0,
        sample_interval_m=500.0,
    )

    short = compute_terrain_coverage_grid(
        **common,
        spreading_factor=7,
        bandwidth_khz=250.0,
        coding_rate="4/5",
    )
    long = compute_terrain_coverage_grid(
        **common,
        spreading_factor=11,
        bandwidth_khz=62.5,
        coding_rate="4/8",
    )

    assert long["stats"]["receiver_sensitivity_dbm"] < short["stats"]["receiver_sensitivity_dbm"]
    assert len(long["points"]) > len(short["points"])
