"""LoRa radio parameter helpers."""

from __future__ import annotations

import math


REQUIRED_SNR_BY_SF: dict[int, float] = {
    5: -2.5,
    6: -5.0,
    7: -7.5,
    8: -10.0,
    9: -12.5,
    10: -15.0,
    11: -17.5,
    12: -20.0,
}

CODING_RATE_GAIN_DB: dict[str, float] = {
    "4/5": 0.0,
    "4/6": 0.7,
    "4/7": 1.2,
    "4/8": 1.5,
}


def lora_receiver_sensitivity_dbm(
    spreading_factor: int,
    bandwidth_khz: float,
    coding_rate: str = "4/5",
    noise_figure_db: float = 6.0,
) -> float:
    """Estimate LoRa receiver sensitivity from modem settings.

    Formula:
        sensitivity = thermal_noise + 10log10(BW) + NF + required_SNR - CR_gain

    The required SNR table follows common Semtech LoRa planning values. Coding
    rate has a smaller effect than SF/BW, but including it prevents CR4/8 links
    from being treated exactly the same as CR4/5.
    """
    if spreading_factor not in REQUIRED_SNR_BY_SF:
        raise ValueError(f"Unsupported LoRa spreading factor: {spreading_factor}")
    if bandwidth_khz <= 0:
        raise ValueError(f"Bandwidth must be > 0, got {bandwidth_khz}")

    bandwidth_hz = bandwidth_khz * 1000.0
    thermal_noise_dbm = -174.0 + 10.0 * math.log10(bandwidth_hz)
    required_snr = REQUIRED_SNR_BY_SF[spreading_factor]
    coding_gain = CODING_RATE_GAIN_DB.get(coding_rate, 0.0)
    return thermal_noise_dbm + noise_figure_db + required_snr - coding_gain
