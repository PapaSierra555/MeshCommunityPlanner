"""Tests for Pydantic model field validation — coverage radius cap.

Verifies that TerrainCoverageGridRequest.max_radius_m accepts values up to
200,000 m (200 km) and rejects values above that limit. Also confirms that
values which were previously rejected by the old le=50000 cap are now accepted.
"""

import pytest
from pydantic import ValidationError

from backend.app.api.models import TerrainCoverageGridRequest


class TestTerrainCoverageMaxRadius:
    """max_radius_m field validation on TerrainCoverageGridRequest."""

    # Minimum required fields for a valid instance (besides max_radius_m)
    _BASE = dict(latitude=25.0, longitude=-80.0)

    def test_max_radius_accepts_200km(self):
        """le=200000: exactly 200,000 m should not raise."""
        req = TerrainCoverageGridRequest(**self._BASE, max_radius_m=200000.0)
        assert req.max_radius_m == 200000.0

    def test_max_radius_rejects_above_200km(self):
        """200,001 m exceeds le=200000 — ValidationError expected."""
        with pytest.raises(ValidationError):
            TerrainCoverageGridRequest(**self._BASE, max_radius_m=200001.0)

    def test_max_radius_rejects_old_50km_cap(self):
        """75,000 m was above the old le=50000 cap; must now be accepted."""
        req = TerrainCoverageGridRequest(**self._BASE, max_radius_m=75000.0)
        assert req.max_radius_m == 75000.0

    def test_max_radius_accepts_minimum_value(self):
        """ge=100: exactly 100 m is the lower bound — must not raise."""
        req = TerrainCoverageGridRequest(**self._BASE, max_radius_m=100.0)
        assert req.max_radius_m == 100.0

    def test_max_radius_rejects_below_minimum(self):
        """99 m is below ge=100 — ValidationError expected."""
        with pytest.raises(ValidationError):
            TerrainCoverageGridRequest(**self._BASE, max_radius_m=99.0)

    def test_max_radius_default_is_15km(self):
        """Default value of 15,000 m is preserved."""
        req = TerrainCoverageGridRequest(**self._BASE)
        assert req.max_radius_m == 15000.0
