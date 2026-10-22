"""
Unit tests for predictive maintenance degradation trends and RUL data sufficiency guards.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from predictive_maintenance import compute_predictive_maintenance


def test_insufficient_data_guard():
    # Only 1 defect record - cannot fit regression
    defects = [
        {"id": "D1", "revolution": 1, "laserDeviationMm": 2.0, "isJointAssociated": True}
    ]

    report = compute_predictive_maintenance(defects, current_belt_rpm=12.0, min_required_revolutions=3)
    assert report["dataSufficient"] is False
    assert "INSUFFICIENT_DATA" in report["warningMessage"]
    assert report["estimatedHoursRemaining"] == 0.0


def test_sufficient_data_linear_rul():
    # 4 distinct revolutions showing linear degradation from 4.0mm to 6.4mm
    defects = [
        {"id": "D1", "revolution": 10, "laserDeviationMm": 4.0, "isJointAssociated": True},
        {"id": "D2", "revolution": 12, "laserDeviationMm": 4.8, "isJointAssociated": True},
        {"id": "D3", "revolution": 14, "laserDeviationMm": 5.6, "isJointAssociated": True},
        {"id": "D4", "revolution": 16, "laserDeviationMm": 6.4, "isJointAssociated": True}
    ]

    report = compute_predictive_maintenance(
        defects,
        current_belt_rpm=12.0,
        critical_threshold_mm=8.0,
        min_required_revolutions=3
    )

    assert report["dataSufficient"] is True
    # Rate = 0.40 mm/rev
    assert abs(report["degradationRateMmPerRev"] - 0.40) < 0.02

    # Remaining = (8.0 - 6.4) / 0.40 = 1.6 / 0.40 = 4 revolutions
    assert report["estimatedRevolutionsRemaining"] == 4

    # At 12 RPM, 1 rev = 5 seconds. 4 revs = 20 seconds = 20 / 3600 hrs = ~0.0055 hrs (rounds to 0.0)
    assert report["confidenceScore"] >= 0.85
